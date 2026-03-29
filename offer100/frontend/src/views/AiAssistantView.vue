<template>
  <main class="page ai-page">
    <TopBar
      :username="authStore.user?.nickname || authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />

    <el-card class="panel ai-shell" shadow="never">
      <div class="hero">
        <el-avatar :size="68" class="ai-avatar">AI</el-avatar>
        <div>
          <h2>{{ ui.heroTitle }}</h2>
          <p>{{ ui.heroDesc }}</p>
        </div>
      </div>

      <div class="chat-mock">
        <div v-for="(msg, index) in chatList" :key="index" :class="['msg', msg.role]">
          <el-avatar v-if="msg.role === 'ai'" :size="34" class="mini-avatar">AI</el-avatar>
          <div
            v-if="msg.role === 'ai'"
            class="bubble markdown-body"
            v-html="renderMarkdown(msg.content)"
          ></div>
          <div v-else class="bubble">{{ msg.content }}</div>
        </div>

        <div v-if="isLoading" class="msg ai">
          <el-avatar :size="34" class="mini-avatar">AI</el-avatar>
          <div class="bubble">{{ ui.thinking }}</div>
        </div>
      </div>

      <div class="composer">
        <el-input
          v-model="userInput"
          :placeholder="ui.inputPlaceholder"
          :disabled="isLoading"
          @keyup.enter="handleSend"
        />
        <el-button type="primary" :loading="isLoading" @click="handleSend">
          {{ ui.send }}
        </el-button>
      </div>
    </el-card>
  </main>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';
import { chatWithAI } from '../api/ai';
import { renderAiMarkdown } from '../utils/aiMarkdown';

const ui = {
  heroTitle: '\u8d85\u7ea7 Offer100 AI \u52a9\u624b',
  heroDesc:
    '',
  thinking: '\u601d\u8003\u4e2d...',
  inputPlaceholder:
    '\u63cf\u8ff0\u4f60\u7684\u95ee\u9898\uff0c\u4f8b\u5982\uff1a\u63a8\u8350\u9002\u5408\u524d\u7aef\u5c97\u4f4d\u7684\u5019\u9009\u4eba',
  send: '\u53d1\u9001',
  welcome:
    '\u4f60\u597d\uff0c\u6211\u662f Offer100 AI \u52a9\u624b\uff0c\u6709\u4ec0\u4e48\u6211\u53ef\u4ee5\u5e2e\u52a9\u4f60\u7684\u5417',
  emptyAnswer:
    'AI \u54cd\u5e94\u6210\u529f\uff0c\u4f46\u6ca1\u6709\u8fd4\u56de\u5177\u4f53\u6587\u672c\u5185\u5bb9\u3002',
  chatError:
    '\u5bf9\u8bdd\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4\u540e\u7aef\u5df2\u542f\u52a8\u4e14 AI \u670d\u52a1\u73af\u5883\u53d8\u91cf\u5df2\u6b63\u786e\u914d\u7f6e\u3002'
};

const authStore = useAuthStore();
const router = useRouter();

const userInput = ref('');
const isLoading = ref(false);
const chatList = ref([
  {
    role: 'ai',
    content: ui.welcome
  }
]);

function renderMarkdown(text) {
  return renderAiMarkdown(text);
}

async function handleSend() {
  if (!userInput.value.trim() || isLoading.value) {
    return;
  }

  const userMsg = userInput.value;
  chatList.value.push({ role: 'user', content: userMsg });
  userInput.value = '';
  isLoading.value = true;

  try {
    // 携带用户 id 与身份，便于后端注入 Coze 上下文
    const res = await chatWithAI(userMsg, authStore.user?.id, authStore.activeIdentity);

    if (res.data?.answer) {
      chatList.value.push({
        role: 'ai',
        content: res.data.answer
      });
    } else {
      chatList.value.push({
        role: 'ai',
        content: ui.emptyAnswer
      });
    }
  } catch (error) {
    console.error('AI Chat Error:', error);
    chatList.value.push({
      role: 'ai',
      content: ui.chatError
    });
  } finally {
    isLoading.value = false;
    saveChatHistory(); // 保存聊天记录
  }
}

function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.ai-shell {
  background: linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%);
}

.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}

.ai-avatar {
  background: #1e63d8;
  color: #fff;
}

.chat-mock {
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  display: grid;
  gap: 10px;
}

.msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.msg.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 72%;
  border-radius: 10px;
  padding: 10px 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.msg.ai .bubble {
  background: #edf4ff;
  border: 1px solid #cfe0ff;
}

.msg.user .bubble {
  background: #1e63d8;
  color: #fff;
}

.composer {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 90px;
  gap: 10px;
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
  background: rgba(255, 255, 255, 0.82);
}

.markdown-body :deep(strong) {
  color: #0f2f75;
}
</style>
