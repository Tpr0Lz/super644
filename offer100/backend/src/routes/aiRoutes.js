﻿const express = require('express');
const axios = require('axios');
const { all, get, run } = require('../data/db'); // 数据库查询工具
const { currentDateTime } = require('../utils/datetime');

const router = express.Router();
const COZE_API_BASE = (process.env.COZE_API_BASE || 'https://api.coze.cn/v3').replace(/\/$/, ''); // Coze 基础地址
const COZE_API_ROOT = COZE_API_BASE.replace(/\/v\d+$/, ''); // 用于 v1 接口
const COZE_API_TOKEN = process.env.COZE_API_TOKEN || ''; // Coze 访问令牌
const COZE_BOT_ID = process.env.COZE_BOT_ID || ''; // Coze Bot ID

// 仅用于当前进程的会话缓存（单机可用，多实例请换 Redis 等）
const conversationCache = new Map();

function getCozeHeaders() {
  return {
    Authorization: `Bearer ${COZE_API_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

function getCachedConversationId(userId) {
  return conversationCache.get(userId) || null;
}

function setCachedConversationId(userId, conversationId) {
  if (!userId) return;
  if (!conversationId || conversationId === 'undefined') {
    conversationCache.delete(userId);
    return;
  }
  conversationCache.set(userId, conversationId);
}

function createLogWithId(requestId) {
  return (tag, payload) => {
    const safePayload = payload || {};
    const pretty = JSON.stringify(safePayload, null, 2);
    console.log(`[coze][${requestId}] ${tag}\n${pretty}`);
  };
}

async function createCozeConversation(log) {
  log('create.conversation.request', { bot_id: COZE_BOT_ID });
  const response = await axios.post(
    `${COZE_API_ROOT}/v1/conversation/create`,
    { bot_id: COZE_BOT_ID },
    {
      headers: getCozeHeaders(),
      timeout: 60000
    }
  );

  const payload = response?.data;
  log('create.conversation.response', {
    code: payload?.code,
    msg: payload?.msg,
    id: payload?.data?.id,
    created_at: payload?.data?.created_at,
    last_section_id: payload?.data?.last_section_id
  });
  if (!payload || payload.code !== 0 || !payload.data?.id) {
    throw new Error(payload?.msg || '创建会话失败');
  }

  return payload.data.id;
}

// 从数据库获取用户的会话 ID
async function getUserConversationId(userId) {
  const row = await get(
    'SELECT conversation_id FROM ai_conversations WHERE user_id = ?',
    [userId]
  );
  return row?.conversation_id || null;
}

// 保存或更新用户的会话 ID
async function saveUserConversationId(userId, conversationId) {
  setCachedConversationId(userId, conversationId);
  const now = currentDateTime();
  const existing = await get(
    'SELECT id FROM ai_conversations WHERE user_id = ?',
    [userId]
  );

  if (existing) {
    await run(
      'UPDATE ai_conversations SET conversation_id = ?, updated_at = ? WHERE user_id = ?',
      [conversationId, now, userId]
    );
  } else {
    await run(
      'INSERT INTO ai_conversations (user_id, conversation_id, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [userId, conversationId, 'coze', now, now]
    );
  }
}

// 从数据库聚合岗位与用户简历数据，用于同步给 Coze 工作流
async function buildAiSyncData() {
  const jobRows = await all(
    `SELECT id, title, salary_range, city, description, publish_at
     FROM jobs
     ORDER BY id DESC
     LIMIT 50`
  );

  const userRows = await all(
    `SELECT u.id, u.username, u.nickname, u.role,
            r.full_name, r.expected_salary, r.location, r.strengths, r.experience
     FROM users u
     LEFT JOIN resumes r ON r.user_id = u.id
     ORDER BY u.id DESC
     LIMIT 50`
  );

  const jobs = jobRows.map((row) => ({
    id: row.id,
    job_name: row.title,
    salary_range: row.salary_range || '',
    location: row.city || '',
    tech_stack: row.description || '',
    description: row.description || '',
    create_time: row.publish_at || ''
  }))
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

  const users = userRows.map((row) => ({
    uid: String(row.id),
    user_id: row.id,
    username: row.full_name || row.nickname || row.username,
    expect_salary: row.expected_salary || '不限',
    current_location: row.location || '',
    skills: row.strengths || '',
    experience: row.experience || '',
    user_identity: row.role === 'recruiter' ? 'recruiter' : 'jobseeker',
    identity_type: row.role === 'recruiter' ? '招聘者' : '求职者'
  }))
    .sort((a, b) => Number(b.user_id || b.uid || 0) - Number(a.user_id || a.uid || 0));

  return { jobs, users };
}

// AI 聊天入口：转发至 Coze 并返回最终回答
router.post('/chat', async (req, res) => {
  const requestId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const log = createLogWithId(requestId);
  const { content, userId: manualUserId, userIdentity, conversationId: manualConversationId } = req.body;
  const parsedUserId = Number(manualUserId);
  const userId = Number.isFinite(parsedUserId) ? String(parsedUserId) : '';
  const normalizedUserIdentity = userIdentity === 'recruiter' ? 'recruiter' : 'jobseeker'; // 统一身份枚举
  const identityType = normalizedUserIdentity === 'recruiter' ? '招聘者' : '求职者'; // 传给 Coze 的中文身份

  if (!String(content || '').trim()) {
    return res.status(400).json({ success: false, answer: '消息内容不能为空' });
  }

  if (!userId) {
    return res.status(400).json({ success: false, answer: '缺少 userId，无法保持会话记忆' });
  }

  if (!COZE_API_TOKEN || !COZE_BOT_ID) {
    return res.status(500).json({
      success: false,
      answer: '服务端未配置 COZE_API_TOKEN 或 COZE_BOT_ID'
    });
  }

  try {
    let existingConversationId = getCachedConversationId(userId);
    if (!existingConversationId) {
      existingConversationId = await getUserConversationId(userId);
      if (existingConversationId) {
        setCachedConversationId(userId, existingConversationId);
      }
    }
    if (!existingConversationId && manualConversationId && manualConversationId !== 'undefined') {
      existingConversationId = String(manualConversationId);
      await saveUserConversationId(userId, existingConversationId);
    }
    if (!existingConversationId) {
      existingConversationId = await createCozeConversation(log);
      await saveUserConversationId(userId, existingConversationId);
    }

    const syncData = await buildAiSyncData(); // 同步数据给工作流使用
    const requestData = {
      bot_id: COZE_BOT_ID,
      user_id: userId,
      stream: false,
      additional_messages: [
        {
          role: 'user',
          content: JSON.stringify({
            manual_input: content,
            current_uid: userId,
            user_identity: normalizedUserIdentity,
            identity_type: identityType
          }),
          content_type: 'text'
        }
      ],
      parameters: { sync_data: syncData }
    };

    if (existingConversationId && existingConversationId !== 'undefined') {
      // 为兼容不同版本实现，同时放在 query + body
      requestData.conversation_id = existingConversationId;
    }

    const chatUrl = existingConversationId && existingConversationId !== 'undefined'
      ? `${COZE_API_BASE}/chat?conversation_id=${encodeURIComponent(existingConversationId)}`
      : `${COZE_API_BASE}/chat`;

    log('chat.request', {
      url: chatUrl,
      user_id: userId,
      bot_id: COZE_BOT_ID,
      conversation_id: existingConversationId || null,
      content: String(content),
      content_length: String(content || '').length,
      user_identity: normalizedUserIdentity,
      identity_type: identityType,
      sync_data_summary: {
        jobs: syncData.jobs.length,
        users: syncData.users.length
      }
    });

    // 发送 Coze /chat 请求，创建任务
    const cozeResponse = await axios.post(chatUrl, requestData, {
      headers: getCozeHeaders(),
      timeout: 60000
    });

    if (!cozeResponse.data || !cozeResponse.data.data) {
      throw new Error('Coze 响应结构异常');
    }

    log('chat.response', {
      code: cozeResponse.data?.code,
      msg: cozeResponse.data?.msg,
      id: cozeResponse.data?.data?.id,
      conversation_id: cozeResponse.data?.data?.conversation_id,
      status: cozeResponse.data?.data?.status,
      last_error: cozeResponse.data?.data?.last_error
    });

    const { id: chat_id, conversation_id } = cozeResponse.data.data;
    let status = cozeResponse.data.data.status;

    // 保存会话 ID 到数据库
    if (conversation_id && conversation_id !== 'undefined') {
      await saveUserConversationId(userId, conversation_id);
    }

    // 轮询任务状态直至完成
    while (status === 'in_progress' || status === 'created') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const checkStatus = await axios.get(
        `${COZE_API_BASE}/chat/retrieve?chat_id=${chat_id}&conversation_id=${conversation_id}`,
        { headers: getCozeHeaders() }
      );
      status = checkStatus.data.data.status;
    }

    if (status !== 'completed') {
      log('chat.retrieve.final', {
        chat_id,
        conversation_id,
        status
      });
      return res.json({
        success: false,
        answer: `Coze 运行失败，当前状态：${status}`
      });
    }

    log('chat.retrieve.final', {
      chat_id,
      conversation_id,
      status
    });

    // 拉取消息列表并取最后一条答案
    const messageResponse = await axios.get(
      `${COZE_API_BASE}/chat/message/list?chat_id=${chat_id}&conversation_id=${conversation_id}`,
      { headers: getCozeHeaders() }
    );

    const messages = messageResponse.data.data;
    let aiMessage = 'AI 已完成任务，但未生成回答。';
    let answerCount = 0;

    if (Array.isArray(messages)) {
      const answerMsgs = messages.filter((message) => message.type === 'answer' && message.role === 'assistant');
      const finalAnswer = answerMsgs.pop();
      answerCount = answerMsgs.length + (finalAnswer ? 1 : 0);
      if (finalAnswer?.content) {
        aiMessage = finalAnswer.content;
      }
    }

    log('chat.message.list', {
      chat_id,
      conversation_id,
      total_messages: Array.isArray(messages) ? messages.length : 0,
      answer_messages: answerCount,
      answer_preview: aiMessage ? String(aiMessage).slice(0, 120) : ''
    });

    res.json({
      success: true,
      answer: aiMessage,
      conversationId: conversation_id,
      usedConversationId: existingConversationId || conversation_id
    });
  } catch (err) {
    console.error('后端请求 Coze 失败:', err.response?.data || err.message);
    res.status(500).json({ success: false, answer: '连接 Coze 服务失败' });
  }
});

// 获取同步数据（便于联调/调试 Coze 工作流参数）
router.get('/sync-data', async (req, res) => {
  try {
    const data = await buildAiSyncData();
    res.json({ success: true, data });
  } catch (err) {
    console.error('同步 AI 数据失败:', err.message);
    res.status(500).json({ success: false, message: '数据库同步失败' });
  }
});

module.exports = router;
