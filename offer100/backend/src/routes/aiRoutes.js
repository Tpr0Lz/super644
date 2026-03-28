const express = require('express');
const axios = require('axios');
const { all, run } = require('../data/db');
const { currentDateTime } = require('../utils/datetime');

const router = express.Router();
const PROXY_ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'];
const MAX_CONTEXT_MESSAGES = 12;

function stripWrappedQuotes(value) {
  const text = String(value || '').trim();
  if (text.length < 2) {
    return text;
  }

  const pairs = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’']
  ];

  for (const [start, end] of pairs) {
    if (text.startsWith(start) && text.endsWith(end)) {
      return text.slice(1, -1).trim();
    }
  }

  return text;
}

function sanitizeProxyEnv() {
  for (const key of PROXY_ENV_KEYS) {
    if (process.env[key]) {
      process.env[key] = stripWrappedQuotes(process.env[key]);
    }
  }
}

sanitizeProxyEnv();

function getCozeConfig() {
  return {
    apiBase: (process.env.COZE_API_BASE || 'https://api.coze.cn/v3').replace(/\/$/, ''),
    apiToken: process.env.COZE_API_TOKEN || '',
    botId: process.env.COZE_BOT_ID || '',
    workflowId: process.env.COZE_WORKFLOW_ID || '',
    conversationName: process.env.COZE_CONVERSATION_NAME || 'Default'
  };
}

function getCozeHeaders(apiToken) {
  return {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  };
}

function resolveUserKey(userId) {
  return String(userId || 'anonymous');
}

function normalizeHistoryMessages(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: String(message.content || '').trim()
    }))
    .filter((message) => message.content)
    .slice(-MAX_CONTEXT_MESSAGES);
}

async function loadRecentHistory(userKey, limit = MAX_CONTEXT_MESSAGES) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || MAX_CONTEXT_MESSAGES));
  const rows = await all(
    `SELECT role, content
     FROM ai_chat_history
     WHERE user_key = ?
     ORDER BY id DESC
     LIMIT ${safeLimit}`,
    [userKey]
  );

  return rows
    .reverse()
    .map((row) => ({
      role: row.role === 'user' ? 'user' : 'assistant',
      content: String(row.content || '').trim()
    }))
    .filter((message) => message.content);
}

function buildCozeMessages(history, currentInput) {
  const currentText = String(currentInput || '').trim();
  const normalizedHistory = normalizeHistoryMessages(history);
  const dedupedHistory = [...normalizedHistory];
  const lastMessage = dedupedHistory[dedupedHistory.length - 1];

  if (lastMessage?.role === 'user' && lastMessage.content === currentText) {
    dedupedHistory.pop();
  }

  const historyMessages = dedupedHistory.map((message) => ({
    role: message.role,
    content: message.content,
    content_type: 'text',
    type: message.role === 'user' ? 'question' : 'answer'
  }));

  historyMessages.push({
    role: 'user',
    content: currentText,
    content_type: 'text',
    type: 'question'
  });

  return historyMessages;
}

function buildHistoryText(history, currentInput = '') {
  const currentText = String(currentInput || '').trim();
  const normalizedHistory = normalizeHistoryMessages(history);
  const dedupedHistory = [...normalizedHistory];
  const lastMessage = dedupedHistory[dedupedHistory.length - 1];

  if (lastMessage?.role === 'user' && lastMessage.content === currentText) {
    dedupedHistory.pop();
  }

  return dedupedHistory
    .map((message) => `${message.role === 'user' ? '用户' : 'AI'}: ${message.content}`)
    .join('\n');
}

async function saveHistoryTurn(userKey, userContent, assistantContent) {
  const now = currentDateTime();
  await run(
    `INSERT INTO ai_chat_history (user_key, role, content, created_at)
     VALUES (?, ?, ?, ?)`,
    [userKey, 'user', String(userContent || '').trim(), now]
  );
  await run(
    `INSERT INTO ai_chat_history (user_key, role, content, created_at)
     VALUES (?, ?, ?, ?)`,
    [userKey, 'assistant', String(assistantContent || '').trim(), now]
  );
}

function normalizeTags(rawTags) {
  if (!rawTags) {
    return '';
  }

  try {
    const parsed = JSON.parse(rawTags);
    if (Array.isArray(parsed)) {
      return parsed.join(',');
    }
  } catch (error) {
    // ignore json parse failure and fall back to string value
  }

  return String(rawTags);
}

function dedupeTerms(terms) {
  return Array.from(new Set(terms.filter(Boolean)));
}

function extractTerms(text) {
  const raw = String(text || '').toLowerCase();
  if (!raw.trim()) {
    return [];
  }

  const englishTerms = raw.match(/[a-z0-9+#.]{2,}/g) || [];
  const chineseChunks = raw.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const chineseTerms = chineseChunks.flatMap((chunk) => {
    const terms = [chunk];
    if (chunk.length > 4) {
      for (let i = 0; i <= chunk.length - 2; i += 1) {
        terms.push(chunk.slice(i, i + 2));
      }
      for (let i = 0; i <= chunk.length - 3; i += 1) {
        terms.push(chunk.slice(i, i + 3));
      }
    }
    return terms;
  });

  const stopTerms = new Set([
    '你好',
    '您好',
    '帮我',
    '一下',
    '看看',
    '推荐',
    '分析',
    '需要',
    '想找',
    '可以',
    '这个',
    '那个',
    '以及',
    '或者',
    '然后',
    '工作',
    '职位',
    '岗位',
    '招聘',
    '相关'
  ]);

  return dedupeTerms([...englishTerms, ...chineseTerms]).filter((term) => {
    if (!term || stopTerms.has(term)) {
      return false;
    }
    return term.length >= 2;
  });
}

function inferMatchReason(job, matchedTerms) {
  if (matchedTerms.length === 0) {
    return '与你当前咨询的话题较相关';
  }

  const highlighted = matchedTerms.slice(0, 3).join('、');
  return `匹配关键词：${highlighted}`;
}

async function findRelevantJobs(userInput, aiAnswer) {
  const terms = extractTerms(`${userInput} ${aiAnswer}`);
  if (terms.length === 0) {
    return [];
  }

  const rows = await all(
    `SELECT id, title, company, city, salary_range, category_l1, category_l2, tags, publish_at
     FROM jobs
     ORDER BY id DESC
     LIMIT 100`
  );

  const jobs = rows.map((row) => {
    const tags = normalizeTags(row.tags);
    const searchable = [
      row.title,
      row.company,
      row.city,
      row.category_l1,
      row.category_l2,
      tags
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    let score = 0;
    const matchedTerms = [];

    for (const term of terms) {
      if (!searchable.includes(term)) {
        continue;
      }

      matchedTerms.push(term);
      score += term.length >= 4 ? 14 : 8;

      if (String(row.title || '').toLowerCase().includes(term)) {
        score += 10;
      }
      if (String(row.category_l2 || '').toLowerCase().includes(term)) {
        score += 6;
      }
      if (String(tags).toLowerCase().includes(term)) {
        score += 5;
      }
      if (String(row.city || '').toLowerCase().includes(term)) {
        score += 4;
      }
    }

    return {
      id: row.id,
      title: row.title,
      company: row.company,
      city: row.city,
      salaryRange: row.salary_range || '',
      categoryL1: row.category_l1 || '',
      categoryL2: row.category_l2 || '',
      publishAt: row.publish_at || '',
      matchedTerms: dedupeTerms(matchedTerms),
      score
    };
  });

  return jobs
    .filter((job) => job.score >= 12)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aPublish = Date.parse(a.publishAt || '') || 0;
      const bPublish = Date.parse(b.publishAt || '') || 0;
      if (bPublish !== aPublish) {
        return bPublish - aPublish;
      }
      return b.id - a.id;
    })
    .slice(0, 3)
    .map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      city: job.city,
      salaryRange: job.salaryRange,
      categoryL1: job.categoryL1,
      categoryL2: job.categoryL2,
      matchReason: inferMatchReason(job, job.matchedTerms)
    }));
}

function normalizeCozeAnswer(content) {
  if (content == null) {
    return '';
  }

  let text = String(content).trim();

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') {
      text = parsed.trim();
    }
  } catch (error) {
    // keep original text
  }

  text = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n')
    .trim();

  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
  ) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

function looksLikeWorkflowPromptLeak(content) {
  const text = String(content || '');
  const leakMarkers = [
    '# 格式要求',
    '# 变量信息',
    '## 处理逻辑',
    '固定回复模板',
    '触发条件',
    '执行要求',
    '核心约束'
  ];

  return leakMarkers.filter((marker) => text.includes(marker)).length >= 2;
}

router.post('/chat', async (req, res) => {
  const { content, userId: manualUserId, history: clientHistory = [] } = req.body;
  const userId = resolveUserKey(manualUserId);
  const { apiBase, apiToken, botId, workflowId, conversationName } = getCozeConfig();

  if (!String(content || '').trim()) {
    return res.status(400).json({ success: false, answer: '消息内容不能为空' });
  }

  if (!apiToken || !botId) {
    return res.status(500).json({
      success: false,
      answer: '服务端未配置 COZE_API_TOKEN 或 COZE_BOT_ID'
    });
  }

  try {
    const storedHistory = await loadRecentHistory(userId);
    const recentHistory = normalizeHistoryMessages(clientHistory).length > 0
      ? normalizeHistoryMessages(clientHistory)
      : storedHistory;
    const cozeMessages = buildCozeMessages(recentHistory, content);
    const historyText = buildHistoryText(recentHistory, content);

    const requestData = {
      bot_id: botId,
      user_id: userId,
      stream: false,
      additional_messages: cozeMessages,
      parameters: {
        CONVERSATION_NAME: conversationName,
        USER_INPUT: content,
        current_uid: userId,
        CHAT_HISTORY: historyText
      }
    };

    if (workflowId) {
      requestData.workflow_id = workflowId;
    }

    const cozeResponse = await axios.post(`${apiBase}/chat`, requestData, {
      headers: getCozeHeaders(apiToken),
      timeout: 60000 
    });

    if (!cozeResponse.data || !cozeResponse.data.data) {
      throw new Error('Coze 响应结构异常');
    }

    const { id: chat_id, conversation_id } = cozeResponse.data.data;
    let status = cozeResponse.data.data.status;

    while (status === 'in_progress' || status === 'created') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const checkStatus = await axios.get(
        `${apiBase}/chat/retrieve`,
        {
          headers: getCozeHeaders(apiToken),
          params: {
            chat_id,
            conversation_id
          }
        }
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
      `${apiBase}/chat/message/list`,
      {
        headers: getCozeHeaders(apiToken),
        params: {
          chat_id,
          conversation_id
        }
      }
    );

    const messages = messageResponse.data.data;
    let aiMessage = 'AI 已完成任务，但未生成回答。';

    if (Array.isArray(messages)) {
      const answerMsgs = messages.filter((message) => message.type === 'answer' && message.role === 'assistant');
      const finalAnswer = answerMsgs.pop();
      if (finalAnswer?.content) {
        aiMessage = normalizeCozeAnswer(finalAnswer.content) || aiMessage;
      }
    }

    if (looksLikeWorkflowPromptLeak(aiMessage)) {
      console.error('Coze workflow returned internal prompt/template instead of a user-facing answer.');
      return res.status(502).json({
        success: false,
        answer: 'Coze 工作流当前返回了内部模板内容，不是面向用户的答案，请检查工作流的最终输出节点或插件返回配置。'
      });
    }

    await saveHistoryTurn(userId, content, aiMessage);

    const jobCards = await findRelevantJobs(content, aiMessage);

    res.json({ success: true, answer: aiMessage, jobCards });
  } catch (err) {
    console.error('后端请求 Coze 失败:', err.response?.data || err.message);
    res.status(500).json({ success: false, answer: '连接 Coze 服务失败' });
  }
});

router.get('/sync-data', async (req, res) => {
  try {
    const jobRows = await all(
      `SELECT id, title, salary_range, city, tags, description, publish_at
       FROM jobs
       ORDER BY id DESC
       LIMIT 50`
    );

    const userRows = await all(
      `SELECT u.id, u.username, u.nickname, u.role,
              r.full_name, r.expected_salary, r.location, r.skills, r.experience
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
      tech_stack: normalizeTags(row.tags),
      description: row.description || '',
      create_time: row.publish_at || ''
    }));

    const users = userRows.map((row) => ({
      uid: row.id,
      username: row.full_name || row.nickname || row.username,
      expect_salary: row.expected_salary || '不限',
      current_location: row.location || '',
      skills: row.skills || '',
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
