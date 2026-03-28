<template>
  <main class="page ai-page">
    <TopBar :username="authStore.user?.nickname || authStore.user?.username" :active-identity="authStore.activeIdentity"
      :identities="authStore.identities" @switch-identity="switchIdentity" @logout="logout" />

    <el-card class="panel ai-shell" shadow="never">
      <div class="hero">
  <el-avatar :size="68" class="ai-avatar">AI</el-avatar>
  <div>
  <h2>超级644AI 助手</h2>
  <p>已成功连接 Coze 智能体，为您提供实时的就业数据分析与建议。</p>
</div>
</div>

      <div class="chat-mock">
        <div v-for="(msg, index) in chatList" :key="index" :class="['msg', msg.role]">
          <el-avatar v-if="msg.role === 'ai'" :size="34" class="mini-avatar">AI</el-avatar>
          <div class="bubble">{{ msg.content }}</div>
        </div>

        <div v-if="isLoading" class="msg ai">
          <el-avatar :size="34" class="mini-avatar">AI</el-avatar>
          <div class="bubble">思考中...</div>
        </div>
      </div>

      <div class="composer">
        <el-input v-model="userInput" placeholder="描述你的问题，例如：帮我分析一下数据库里的前端岗位" :disabled="isLoading"
          @keyup.enter="handleSend" />
        <el-button type="primary" :loading="isLoading" @click="handleSend">发送</el-button>
      </div>
    </el-card>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';
import { chatWithAI } from '../api/ai';

const authStore = useAuthStore();
const router = useRouter();

const userInput = ref('');
const isLoading = ref(false);
const chatList = ref([
  { role: 'ai', content: '你好，我是超级644AI助手。你可以让我分析岗位、简历或招聘数据。' }
]);

async function handleSend() {
  if (!userInput.value.trim() || isLoading.value) return;

  const userMsg = userInput.value;
  chatList.value.push({ role: 'user', content: userMsg });
  userInput.value = '';
  isLoading.value = true;

  try {
    const res = await chatWithAI(userMsg, authStore.user?.id, authStore.activeIdentity);

    if (res.data && res.data.answer) {
      chatList.value.push({
        role: 'ai',
        content: res.data.answer
      });
    } else {
      chatList.value.push({
        role: 'ai',
        content: 'AI 响应成功，但没有返回具体文字内容。'
      });
    }
  } catch (error) {
    console.error('AI Chat Error:', error);
    chatList.value.push({
      role: 'ai',
      content: '对话失败，请确认后端已启动且 Coze 环境变量已配置。'
    });
  } finally {
    isLoading.value = false;
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
</style>
