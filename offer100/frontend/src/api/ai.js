import http from './http';

export const chatWithAI = (content, userId, history = []) => {
  return http.post('/ai/chat', {
    content: content,
    userId: userId,
    history: Array.isArray(history) ? history : []
  });
};
