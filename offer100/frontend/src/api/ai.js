import http from './http';

export const chatWithAI = (content, userId, userIdentity) => {
  return http.post('/ai/chat', {
    content,
    userId,
    userIdentity
  });
};
