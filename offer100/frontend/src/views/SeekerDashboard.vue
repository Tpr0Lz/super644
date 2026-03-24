<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />

    <div class="workspace-layout">
      <aside class="workspace-menu">
        <router-link to="/" class="menu-item">主页面</router-link>
        <router-link to="/jobs" class="menu-item">职位大厅</router-link>
        <router-link to="/seeker" class="menu-item active">求职工作台</router-link>
        <router-link to="/chat" class="menu-item">在线对话</router-link>
        <router-link to="/profile" class="menu-item">个人/公司信息</router-link>
        <router-link to="/identity-register" class="menu-item">注册身份</router-link>
      </aside>

      <section class="workspace-main">
        <h2>求职者工作台</h2>

        <div class="form-section">
          <h3>我的简历</h3>
          <form class="job-form" @submit.prevent="saveResume">
            <input v-model.trim="resumeForm.fullName" placeholder="姓名" required />
            <input v-model.trim="resumeForm.skills" placeholder="技能" required />
            <textarea v-model.trim="resumeForm.experience" placeholder="项目/实习经历" required />
            <input v-model.trim="resumeForm.education" placeholder="教育背景" required />
            <button type="submit">保存简历</button>
          </form>
          <p v-if="tip" class="tip">{{ tip }}</p>
        </div>

        <div class="form-section">
          <h3>我的投递记录</h3>
          <p class="notice">在职位大厅中投递岗位即可记录。</p>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const tip = ref('');

const resumeForm = reactive({
  fullName: '张三',
  skills: 'Vue, Node.js, TypeScript',
  experience: '有实习经历，参与过招聘平台项目。',
  education: '计算机科学与技术'
});

async function loadResume() {
  const { data } = await http.get('/resume/me');
  resumeForm.fullName = data.full_name || '';
  resumeForm.skills = data.skills || '';
  resumeForm.experience = data.experience || '';
  resumeForm.education = data.education || '';
}

async function saveResume() {
  try {
    await http.put('/resume/me', resumeForm);
    tip.value = '简历已保存';
    setTimeout(() => {
      tip.value = '';
    }, 3000);
  } catch (error) {
    tip.value = error.response?.data?.message || '简历保存失败';
  }
}

async function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  await loadResume();
});
</script>

<style scoped>
.workspace-layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 16px;
  margin-top: 12px;
}

.workspace-menu {
  display: grid;
  gap: 8px;
}

.menu-item {
  display: block;
  padding: 12px;
  background: #ffffffd9;
  border: 1px solid #cfe0ff;
  border-radius: 10px;
  color: #1d4c95;
  text-decoration: none;
  text-align: center;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #edf3ff;
}

.menu-item.active,
.menu-item.router-link-active {
  background: #1e63d8;
  color: #fff;
  font-weight: 600;
}

.workspace-main {
  padding: 18px;
  background: #ffffffd9;
  border: 1px solid #cfe0ff;
  border-radius: 16px;
  box-shadow: 0 12px 26px rgba(19, 36, 58, 0.08);
}

.workspace-main h2 {
  margin-top: 0;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e8f2ff;
}

.form-section:last-child {
  border-bottom: none;
}

.form-section h3 {
  margin-top: 0;
  color: #13243a;
}

.notice {
  color: #466184;
  font-size: 14px;
}

.tip {
  margin-top: 8px;
  padding: 8px 12px;
  background: #edf3ff;
  color: #1d4c95;
  border-radius: 8px;
  font-size: 14px;
}
</style>
