// routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../data/db');

const userConversations = new Map();

router.post('/chat', async (req, res) => {
  const { content, userId: manualUserId } = req.body;
  const userId = String(manualUserId || "5"); 
  const existingConversationId = userConversations.get(userId);

  console.log('--- 收到 AI 请求 ---');
  console.log('用户提问:', content);

  try {
    // 【关键修复】：根据 image_83c58c.jpg 截图，你的变量名是 manual_input
    const requestData = {
  bot_id: '7620663401027026990',
  user_id: userId,
  stream: false,
  // 1. 显式提供 additional_messages，确保 UserInput 节点能抓取到 query
  additional_messages: [
    {
      role: "user",
      content: content,
      content_type: "text"
    }
  ],
  // 2. 同时保留 parameters，确保工作流变量被填充
  parameters: {
    manual_input: content,
    current_uid: userId
  }
};

    // 如果有历史会话，加入 conversation_id 保持上下文
    if (existingConversationId && existingConversationId !== 'undefined') {
      requestData.conversation_id = existingConversationId;
    }

    console.log('发送给 Coze 的数据包:', JSON.stringify(requestData));

    const cozeResponse = await axios.post('https://api.coze.cn/v3/chat', requestData, {
      headers: {
        'Authorization': 'Bearer pat_ucGwKsRz6ynpjlqbnyPZwOx6e4FIetwDaGmr4M3x9SrfzfoYWS2TEqNvK8Vggv7e',
        'Content-Type': 'application/json'
      },
      timeout: 60000 
    });

    if (!cozeResponse.data || !cozeResponse.data.data) {
      throw new Error('Coze 响应结构异常');
    }

    const { id: chat_id, conversation_id } = cozeResponse.data.data;
    let status = cozeResponse.data.data.status;
    
    userConversations.set(userId, conversation_id);

    // 轮询逻辑保持不变
    while (status === 'in_progress' || status === 'created') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const checkStatus = await axios.get(
            `https://api.coze.cn/v3/chat/retrieve?chat_id=${chat_id}&conversation_id=${conversation_id}`, 
            { headers: { 'Authorization': 'Bearer pat_ucGwKsRz6ynpjlqbnyPZwOx6e4FIetwDaGmr4M3x9SrfzfoYWS2TEqNvK8Vggv7e' } }
        );
        status = checkStatus.data.data.status; 
        console.log('轮询中...', status);
    }

    if (status !== 'completed') {
        // 如果依然失败，打印出具体的错误信息
        console.error(`Coze 任务失败。ChatID: ${chat_id}, 状态: ${status}`);
        return res.json({ success: false, answer: `Coze 运行失败(状态:${status})。请检查工作流中“查询数据库”节点是否报错。` });
    }

    const messageResponse = await axios.get(`https://api.coze.cn/v3/chat/message/list?chat_id=${chat_id}&conversation_id=${conversation_id}`, {
        headers: { 'Authorization': 'Bearer pat_ucGwKsRz6ynpjlqbnyPZwOx6e4FIetwDaGmr4M3x9SrfzfoYWS2TEqNvK8Vggv7e' }
    });

    const messages = messageResponse.data.data;
    let aiMessage = "AI 已完成任务但未生成回答。";

    if (Array.isArray(messages)) {
        const answerMsgs = messages.filter(m => m.type === 'answer' && m.role === 'assistant');
        const finalAnswer = answerMsgs.pop(); 
        if (finalAnswer) aiMessage = finalAnswer.content;
    }

    res.json({ success: true, answer: aiMessage });

  } catch (err) {
    console.error('后端请求 Coze 失败:', err.message);
    res.status(500).json({ success: false, answer: "连接 Coze 服务失败" });
  }
});

// 数据同步接口保持不变
router.get('/sync-data', async (req, res) => {
  try {
    const jobs = await db.all(`SELECT id, job_name, salary_range, location, tech_stack, description FROM job_pool LIMIT 50`);
    const users = await db.all(`SELECT uid, username, expect_salary, current_location, skills, role_type FROM user_profile LIMIT 50`);
    res.json({ success: true, data: { job_list: jobs, user_list: users } });
  } catch (err) {
    res.status(500).json({ success: false, message: "数据库同步失败" });
  }
});

module.exports = router;