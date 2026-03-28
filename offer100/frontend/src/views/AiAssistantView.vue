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
          <div class="msg-stack">
            <div class="bubble">{{ msg.content }}</div>
            <div v-if="msg.role === 'ai' && msg.jobCards?.length" class="job-card-list">
              <button
                v-for="job in msg.jobCards"
                :key="job.id"
                class="job-card"
                type="button"
                @click="openJobDetail(job.id)"
              >
                <div class="job-card-head">
                  <strong>{{ job.title }}</strong>
                  <span v-if="job.salaryRange">{{ job.salaryRange }}</span>
                </div>
                <p class="job-card-meta">
                  {{ job.company || '未知公司' }}
                  <span v-if="job.city"> | {{ job.city }}</span>
                </p>
                <p v-if="job.categoryL1 || job.categoryL2" class="job-card-meta">
                  {{ job.categoryL1 || '岗位' }}
                  <span v-if="job.categoryL2"> / {{ job.categoryL2 }}</span>
                </p>
                <p v-if="job.matchReason" class="job-card-tip">{{ job.matchReason }}</p>
                <span class="job-card-link">点击查看详情</span>
              </button>
            </div>
          </div>
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
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';
import { useAiAssistantStore } from '../stores/aiAssistant';
import { chatWithAI } from '../api/ai';

const authStore = useAuthStore();
const aiAssistantStore = useAiAssistantStore();
const router = useRouter();

const userInput = ref('');
const isLoading = ref(false);
const currentUserId = computed(() => String(authStore.user?.id || 'anonymous'));
const chatList = computed(() => aiAssistantStore.conversations[currentUserId.value] || []);

watch(
  currentUserId,
  (userId) => {
    aiAssistantStore.ensureConversation(userId);
  },
  { immediate: true }
);

async function handleSend() {
  if (!userInput.value.trim() || isLoading.value) return;

  const userMsg = userInput.value;
  aiAssistantStore.appendMessage(currentUserId.value, { role: 'user', content: userMsg });
  userInput.value = '';
  isLoading.value = true;

  try {
    const res = await chatWithAI(userMsg, authStore.user?.id, chatList.value);

    if (res.data && res.data.answer) {
      aiAssistantStore.appendMessage(currentUserId.value, {
        role: 'ai',
        content: res.data.answer,
        jobCards: res.data.jobCards
      });
    } else {
      aiAssistantStore.appendMessage(currentUserId.value, {
        role: 'ai',
        content: 'AI 响应成功，但没有返回具体文字内容。'
      });
    }
  } catch (error) {
    console.error('AI Chat Error:', error);
    aiAssistantStore.appendMessage(currentUserId.value, {
      role: 'ai',
      content: error.response?.data?.answer || '对话失败，请确认后端已启动且 Coze 环境变量已配置。'
    });
  } finally {
    isLoading.value = false;
  }
}

function openJobDetail(jobId) {
  if (!jobId) {
    return;
  }
  router.push(`/jobs/${jobId}`);
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
  width: 100%;
}

.msg.user {
  justify-content: flex-end;
}

.bubble {
  border-radius: 10px;
  padding: 10px 12px;
  line-height: 1.5;
  max-width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-stack {
  width: fit-content;
  max-width: min(72%, 680px);
  display: grid;
  gap: 8px;
}

.msg.user .msg-stack {
  margin-left: auto;
  justify-items: end;
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

.job-card-list {
  display: grid;
  gap: 8px;
}

.job-card {
  width: 100%;
  border: 1px solid #bfd5ff;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.job-card:hover {
  transform: translateY(-1px);
  border-color: #7aa6ff;
  box-shadow: 0 8px 18px rgba(30, 99, 216, 0.12);
}

.job-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #1e3a8a;
}

.job-card-meta {
  margin: 6px 0 0;
  color: #475569;
  line-height: 1.5;
}

.job-card-tip {
  margin: 8px 0 0;
  color: #166534;
  line-height: 1.5;
}

.job-card-link {
  display: inline-block;
  margin-top: 8px;
  color: #2563eb;
  font-size: 13px;
}
</style>
