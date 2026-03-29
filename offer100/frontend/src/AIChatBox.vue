<template>
  <div class="ai-assistant">
    <el-button type="primary" circle class="ai-btn" @click="visible = !visible">
      <el-icon><ChatDotRound /></el-icon>
    </el-button>

    <el-drawer v-model="visible" :title="ui.drawerTitle" direction="rtl" size="400px">
      <div class="ai-chat-container">
        <div class="ai-messages" ref="msgContainer">
          <div v-for="(msg, i) in messages" :key="i" :class="['msg-item', msg.role]">
            <el-avatar :size="30">{{ msg.role === 'user' ? ui.me : 'AI' }}</el-avatar>
            <div
              v-if="msg.role === 'assistant'"
              class="msg-content markdown-body"
              v-html="renderMarkdown(msg.content)"
            ></div>
            <div v-else class="msg-content">{{ msg.content }}</div>
          </div>
        </div>

        <div class="ai-input">
          <el-input
            v-model="input"
            :placeholder="ui.inputPlaceholder"
            @keyup.enter="handleSend"
          >
            <template #append>
              <el-button @click="handleSend" :loading="loading">{{ ui.send }}</el-button>
            </template>
          </el-input>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { chatWithAI } from './api/ai';
import { useAuthStore } from './stores/auth';
import { renderAiMarkdown } from './utils/aiMarkdown';

const ui = {
  drawerTitle: 'Offer100 \u667a\u80fd\u52a9\u624b',
  me: '\u6211',
  inputPlaceholder:
    '\u95ee\u6211\uff1a\u63a8\u8350\u5c97\u4f4d\u3001\u63a8\u8350\u5019\u9009\u4eba\u3001\u6a21\u62df\u9762\u8bd5...',
  send: '\u53d1\u9001',
  welcome:
    '\u4f60\u597d\uff0c\u6211\u662f Offer100 AI \u52a9\u624b\uff0c\u6709\u4ec0\u4e48\u6211\u53ef\u4ee5\u5e2e\u52a9\u4f60\u7684\u5417',
  emptyAnswer:
    'AI \u5df2\u5b8c\u6210\u4efb\u52a1\uff0c\u4f46\u672a\u751f\u6210\u56de\u7b54\u3002',
  error: '\u62b1\u6b49\uff0c\u8fde\u63a5 AI \u670d\u52a1\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002'
};

const authStore = useAuthStore();
const visible = ref(false);
const input = ref('');
const loading = ref(false);
const messages = ref([
  {
    role: 'assistant',
    content: ui.welcome
  }
]);
const msgContainer = ref(null);

const renderMarkdown = (text) => renderAiMarkdown(text);

const handleSend = async () => {
  if (!input.value || loading.value) {
    return;
  }

  const userText = input.value;
  messages.value.push({ role: 'user', content: userText });
  input.value = '';
  loading.value = true;

  try {
    const { data } = await chatWithAI(userText, authStore.user?.id, authStore.activeIdentity);
    messages.value.push({ role: 'assistant', content: data.answer || ui.emptyAnswer });
    scrollToBottom();
  } catch (error) {
    console.error('AI drawer chat error:', error);
    messages.value.push({ role: 'assistant', content: ui.error });
  } finally {
    loading.value = false;
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (msgContainer.value) {
      msgContainer.value.scrollTop = msgContainer.value.scrollHeight;
    }
  });
};

watch(visible, (isVisible) => {
  if (isVisible) {
    scrollToBottom();
  }
});
</script>

<style scoped>
.ai-btn {
  position: fixed;
  right: 30px;
  bottom: 30px;
  width: 60px;
  height: 60px;
  font-size: 24px;
  z-index: 2000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.ai-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.msg-item {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.msg-item.user {
  flex-direction: row-reverse;
}

.msg-content {
  background: #f4f4f5;
  padding: 10px;
  border-radius: 8px;
  max-width: 80%;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.user .msg-content {
  background: #409eff;
  color: white;
}

.ai-input {
  padding: 20px;
  border-top: 1px solid #eee;
}

.markdown-body {
  white-space: normal;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 0 0 10px;
  color: #1146a6;
  line-height: 1.45;
  font-size: 15px;
  font-weight: 700;
}

.markdown-body :deep(p) {
  margin: 0 0 10px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0;
  padding-left: 18px;
}

.markdown-body :deep(li + li) {
  margin-top: 8px;
}

.markdown-body :deep(ul ul) {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
}

.markdown-body :deep(strong) {
  color: #0f2f75;
}
</style>
