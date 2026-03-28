const express = require('express');
const axios = require('axios');
const { all } = require('../data/db');

const router = express.Router();
const userConversations = new Map();
const COZE_API_BASE = (process.env.COZE_API_BASE || 'https://api.coze.cn/v3').replace(/\/$/, '');
const COZE_API_TOKEN = process.env.COZE_API_TOKEN || '';
const COZE_BOT_ID = process.env.COZE_BOT_ID || '';

function getCozeHeaders() {
  return {
    Authorization: `Bearer ${COZE_API_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

router.post('/chat', async (req, res) => {
  const { content, userId: manualUserId, userIdentity } = req.body;
  const userId = String(manualUserId || 'anonymous');
  const existingConversationId = userConversations.get(userId);

  if (!String(content || '').trim()) {
    return res.status(400).json({ success: false, answer: '消息内容不能为空' });
  }

  if (!COZE_API_TOKEN || !COZE_BOT_ID) {
    return res.status(500).json({
      success: false,
      answer: '服务端未配置 COZE_API_TOKEN 或 COZE_BOT_ID'
    });
  }

  try {
    const requestData = {
      bot_id: COZE_BOT_ID,
      user_id: userId,
      stream: false,
      additional_messages: [
        {
          role: 'user',
          content,
          content_type: 'text'
        }
      ],
      parameters: {
        manual_input: content,
        current_uid: userId,
        user_identity: userIdentity,
        identity_type: userIdentity === 'recruiter' ? '招聘者' : '求职者'
      }
    };

    if (existingConversationId && existingConversationId !== 'undefined') {
      requestData.conversation_id = existingConversationId;
    }

    const cozeResponse = await axios.post(`${COZE_API_BASE}/chat`, requestData, {
      headers: getCozeHeaders(),
      timeout: 60000 
    });

    if (!cozeResponse.data || !cozeResponse.data.data) {
      throw new Error('Coze 响应结构异常');
    }

    const { id: chat_id, conversation_id } = cozeResponse.data.data;
    let status = cozeResponse.data.data.status;
    
    userConversations.set(userId, conversation_id);

    while (status === 'in_progress' || status === 'created') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const checkStatus = await axios.get(
        `${COZE_API_BASE}/chat/retrieve?chat_id=${chat_id}&conversation_id=${conversation_id}`,
        { headers: getCozeHeaders() }
      );
      status = checkStatus.data.data.status;
    }

    if (status !== 'completed') {
      return res.json({
        success: false,
        answer: `Coze 运行失败，当前状态：${status}`
      });
    }

    const messageResponse = await axios.get(
      `${COZE_API_BASE}/chat/message/list?chat_id=${chat_id}&conversation_id=${conversation_id}`,
      { headers: getCozeHeaders() }
    );

    const messages = messageResponse.data.data;
    let aiMessage = 'AI 已完成任务，但未生成回答。';

    if (Array.isArray(messages)) {
      const answerMsgs = messages.filter((message) => message.type === 'answer' && message.role === 'assistant');
      const finalAnswer = answerMsgs.pop();
      if (finalAnswer?.content) {
        aiMessage = finalAnswer.content;
      }
    }

    res.json({ success: true, answer: aiMessage });
  } catch (err) {
    console.error('后端请求 Coze 失败:', err.response?.data || err.message);
    res.status(500).json({ success: false, answer: '连接 Coze 服务失败' });
  }
});

router.get('/sync-data', async (req, res) => {
  try {
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
    }));

    const users = userRows.map((row) => ({
      uid: row.id,
      username: row.full_name || row.nickname || row.username,
      expect_salary: row.expected_salary || '不限',
      current_location: row.location || '',
      skills: row.strengths || '',
      experience: row.experience || '',
      role_type: row.role === 'recruiter' ? 1 : 0
    }));

    res.json({ success: true, data: { jobs, users } });
  } catch (err) {
    console.error('同步 AI 数据失败:', err.message);
    res.status(500).json({ success: false, message: '数据库同步失败' });
  }
});

module.exports = router;
