import { defineStore } from 'pinia';

const STORAGE_KEY = 'offer100_ai_assistant';
const DEFAULT_MESSAGES = [
  { role: 'ai', content: '你好，我是超级644AI助手。你可以让我分析岗位、简历或招聘数据。' }
];

function normalizeJobCards(jobCards) {
  if (!Array.isArray(jobCards)) {
    return [];
  }

  return jobCards
    .filter((job) => job && job.id)
    .map((job) => ({
      id: Number(job.id),
      title: String(job.title || ''),
      company: String(job.company || ''),
      city: String(job.city || ''),
      salaryRange: String(job.salaryRange || ''),
      categoryL1: String(job.categoryL1 || ''),
      categoryL2: String(job.categoryL2 || ''),
      matchReason: String(job.matchReason || '')
    }));
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [...DEFAULT_MESSAGES];
  }

  const normalized = messages
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({
      role: message.role === 'user' ? 'user' : 'ai',
      content: message.content,
      jobCards: normalizeJobCards(message.jobCards)
    }));

  return normalized.length > 0 ? normalized : [...DEFAULT_MESSAGES];
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, messages]) => [key, normalizeMessages(messages)])
    );
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

function resolveUserKey(userId) {
  return String(userId || 'anonymous');
}

export const useAiAssistantStore = defineStore('aiAssistant', {
  state: () => ({
    conversations: loadFromStorage()
  }),
  actions: {
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.conversations));
    },
    ensureConversation(userId) {
      const key = resolveUserKey(userId);
      if (!this.conversations[key]?.length) {
        this.conversations[key] = [...DEFAULT_MESSAGES];
        this.persist();
      }
      return this.conversations[key];
    },
    appendMessage(userId, message) {
      const key = resolveUserKey(userId);
      this.ensureConversation(key);
      this.conversations[key].push({
        role: message.role === 'user' ? 'user' : 'ai',
        content: String(message.content || ''),
        jobCards: normalizeJobCards(message.jobCards)
      });
      this.persist();
    },
    resetConversation(userId) {
      const key = resolveUserKey(userId);
      this.conversations[key] = [...DEFAULT_MESSAGES];
      this.persist();
    }
  }
});
