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
          <h2>超级644AI 助手</h2>
          <p>这里是预留的 AI 对话入口，后续可直接接入你的模型 API。</p>
        </div>
      </div>

      <div class="chat-mock">
        <div class="msg ai">
          <el-avatar :size="34" class="mini-avatar">AI</el-avatar>
          <div class="bubble">你好，我是超级644AI。你可以问我岗位推荐、简历优化和面试问题。</div>
        </div>

        <div class="msg user">
          <div class="bubble">我想找一个前端开发岗位，偏向 Vue。</div>
        </div>

        <div class="msg ai">
          <el-avatar :size="34" class="mini-avatar">AI</el-avatar>
          <div class="bubble">收到，后续接入模型后我会结合你的经历和岗位标签做精准推荐。</div>
        </div>
      </div>

      <div class="composer">
        <el-input
          placeholder="输入问题（演示页暂不调用接口）"
          disabled
        />
        <el-button type="primary" disabled>发送</el-button>
      </div>
    </el-card>
  </main>
</template>

<script setup>
import { useRouter } from 'vue-router';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();

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
