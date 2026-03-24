<template>
  <main class="page">
    <TopBar :username="authStore.user?.username" :role="authStore.role" @logout="logout" />

    <section class="panel form-panel">
      <h2>发布岗位（管理员）</h2>
      <form class="job-form" @submit.prevent="createJob">
        <input v-model.trim="form.title" placeholder="岗位名称" required />
        <input v-model.trim="form.company" placeholder="企业名称" required />
        <input v-model.trim="form.city" placeholder="城市" required />
        <input v-model.trim="form.salaryRange" placeholder="薪资范围，例如 12k-18k" required />
        <input v-model.trim="form.tags" placeholder="标签，逗号分隔" required />
        <textarea v-model.trim="form.description" placeholder="岗位描述" required />
        <button type="submit">发布岗位</button>
      </form>
      <p>{{ tip }}</p>
    </section>

    <section class="panel">
      <h2>行为统计（用户行为数据分析）</h2>
      <p>总行为数：{{ stats.total }}</p>
      <p>按行为统计：{{ stats.byAction }}</p>
      <p>按角色统计：{{ stats.byRole }}</p>
      <div class="actions">
        <button @click="loadStats">刷新统计</button>
        <a class="download" href="/api/reports/behavior.csv" target="_blank">下载行为报表 CSV</a>
      </div>
    </section>
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

const form = reactive({
  title: 'Junior Java Engineer',
  company: 'CampusTech',
  city: 'Nanjing',
  salaryRange: '10k-14k',
  tags: 'java,spring,backend',
  description: 'Campus recruitment for junior Java backend role.'
});

const tip = ref('');
const stats = ref({ total: 0, byAction: {}, byRole: {} });

async function createJob() {
  try {
    await http.post('/jobs', {
      ...form,
      tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean)
    });
    tip.value = '岗位发布成功，已通过 Socket 实时广播';
    await loadStats();
  } catch (error) {
    tip.value = error.response?.data?.message || '发布失败';
  }
}

async function loadStats() {
  const { data } = await http.get('/analytics/behavior');
  stats.value = data;
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(loadStats);
</script>
