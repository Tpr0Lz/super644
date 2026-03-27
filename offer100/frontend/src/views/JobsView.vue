<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.nickname || authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />

    <div class="workspace-layout">
      <aside class="workspace-menu">
        <router-link to="/" class="menu-item">主页面</router-link>
        <router-link to="/jobs" class="menu-item active">职位大厅</router-link>
        <router-link v-if="isJobseeker" to="/seeker" class="menu-item">求职工作台</router-link>
        <router-link to="/chat" class="menu-item">在线对话</router-link>
        <router-link to="/profile" class="menu-item">个人/公司信息</router-link>
        <router-link to="/identity-register" class="menu-item">注册身份</router-link>
      </aside>

      <section class="workspace-main">
        <h2>职位大厅</h2>
        <ul class="job-list">
          <li v-for="job in jobs" :key="job.id">
            <JobMiniCard :job="job" :show-description="true" />
            <button v-if="isJobseeker" @click="applyJob(job.id)" style="margin-top: 8px">投递</button>
          </li>
        </ul>

        <h2 style="margin-top: 30px">实时动态</h2>
        <ul class="events">
          <li v-for="(item, index) in events" :key="index">{{ item }}</li>
        </ul>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import JobMiniCard from '../components/JobMiniCard.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const jobs = ref([]);
const events = ref([]);

const isJobseeker = computed(() => authStore.activeIdentity === 'jobseeker');

let socket;

function appendEvent(message) {
  events.value.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
  events.value = events.value.slice(0, 30);
}

async function loadJobs() {
  const { data } = await http.get('/jobs');
  jobs.value = data;
}

async function applyJob(jobId) {
  try {
    await http.post(`/jobs/${jobId}/apply`);
    appendEvent(`已投递岗位 #${jobId}`);
  } catch (error) {
    appendEvent(error.response?.data?.message || '投递失败');
  }
}

async function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
  appendEvent(`已切换身份至：${identity === 'recruiter' ? '招聘人' : '求职者'}`);
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  await loadJobs();

  socket = io('http://localhost:3001');
  socket.on('recruitment:update', async (event) => {
    if (event.type === 'job_created') {
      await loadJobs();
      appendEvent(`新岗位：${event.job.title}`);
      return;
    }
    if (event.type === 'job_applied') {
      appendEvent(`${event.payload.applicant} 投递了岗位 #${event.payload.jobId}`);
      return;
    }
    appendEvent(event.message || '系统通知');
  });
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
  }
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

.job-list {
  list-style: none;
  padding: 0;
}

.job-item {
  margin-bottom: 12px;
}

.job-item h3 {
  margin: 0 0 8px;
  color: #1d4c95;
}

.tags {
  display: flex;
  gap: 6px;
  margin: 8px 0;
  flex-wrap: wrap;
}

.tags span {
  display: inline-block;
  font-size: 12px;
  padding: 4px 10px;
  background: #1e63d8;
  color: #fff;
  border-radius: 4px;
}

.events {
  list-style: none;
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
}

.events li {
  padding: 6px;
  color: #666;
  font-size: 13px;
  border-bottom: 1px solid #f0f0f0;
}
</style>
