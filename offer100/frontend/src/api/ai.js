import http from './http';

// AI 聊天接口封装
export const chatWithAI = (content, userId, userIdentity) => {
  return http.post('/ai/chat', {
    content,
    userId,
    userIdentity
  });
};
