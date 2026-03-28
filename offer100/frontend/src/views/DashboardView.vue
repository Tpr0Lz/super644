<template>
  <main class="page">
    <TopBar :username="authStore.user?.nickname || authStore.user?.username" :role="authStore.role" @logout="logout" />

    <section class="panel">
      <h2>职位列表</h2>
      <p>当前角色：{{ authStore.role }}。学生和社会人士可投递岗位。</p>
      <ul class="job-list">
        <li v-for="job in jobs" :key="job.id" class="job-item">
          <h3>{{ job.title }}</h3>
          <p>{{ job.company }} | {{ job.city }} | {{ job.salaryRange }}</p>
          <p>{{ job.description }}</p>
          <div class="tags" v-if="job.categoryL1 || job.categoryL2">
            <el-tag v-if="job.categoryL1" size="small" effect="plain">{{ job.categoryL1 }}</el-tag>
            <el-tag v-if="job.categoryL2" size="small" effect="plain">{{ job.categoryL2 }}</el-tag>
          </div>
          <button
            v-if="canApply"
            @click="applyJob(job.id)"
            :disabled="applyingId === job.id"
          >
            {{ applyingId === job.id ? '投递中...' : '投递职位' }}
          </button>
        </li>
      </ul>
    </section>

    <section class="panel">
      <h2>实时动态（Socket）</h2>
      <ul class="events">
        <li v-for="(item, index) in events" :key="index">{{ item }}</li>
      </ul>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElNotification } from 'element-plus';
import { io } from 'socket.io-client';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const jobs = ref([]);
const events = ref([]);
const applyingId = ref(0);

const canApply = computed(() => ['student', 'social'].includes(authStore.role));

let socket;

function appendEvent(message) {
  events.value.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
  events.value = events.value.slice(0, 20);
}

async function loadJobs() {
  const { data } = await http.get('/jobs');
  jobs.value = data;
}

async function applyJob(jobId) {
  applyingId.value = jobId;
  try {
    await http.post(`/jobs/${jobId}/apply`);
    appendEvent(`你已投递职位 #${jobId}`);
    ElNotification({
      title: '投递成功',
      message: '已自动向招聘者发送个人信息卡片和常用语',
      type: 'success',
      duration: 1500,
      position: 'bottom-right'
    });
  } catch (error) {
    const errorMsg = error.response?.data?.message || '投递失败';
    appendEvent(errorMsg);
    ElNotification({
      title: '投递失败',
      message: errorMsg,
      type: 'error',
      duration: 1500,
      position: 'bottom-right'
    });
  } finally {
    applyingId.value = 0;
  }
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  await loadJobs();
  socket = io('http://localhost:3001');
  socket.on('recruitment:update', (payload) => {
    if (payload.type === 'job_created') {
      jobs.value.unshift(payload.job);
      appendEvent(`新职位发布：${payload.job.title}`);
      return;
    }

    if (payload.type === 'job_applied') {
      appendEvent(`${payload.payload.applicant} 投递了职位 #${payload.payload.jobId}`);
      return;
    }

    appendEvent(payload.message || JSON.stringify(payload));
  });
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
  }
});
</script>

<style scoped>
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
</style>
