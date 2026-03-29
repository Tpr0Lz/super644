import http from './http';

// AI 聊天接口封装
export const chatWithAI = (content, userId, userIdentity) => {
  return http.post('/ai/chat', {
    content: content,
    userId: userId, // 对应你工作流中的 USER_ID
    userIdentity: userIdentity // 用户身份：jobseeker 或 recruiter
  });
};
