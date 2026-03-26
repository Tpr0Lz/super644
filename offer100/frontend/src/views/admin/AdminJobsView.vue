<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.nickname || authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />
    <el-card class="panel" shadow="never">
      <h2>所有岗位总览</h2>
      <el-alert title="当前身份：超级管理员" type="info" :closable="false" show-icon />

      <h3>岗位组件卡片（点击查看详情）</h3>
      <el-row :gutter="12" class="component-grid">
        <el-col v-for="job in jobCards" :key="job.id" :xs="24" :sm="12" :lg="8">
          <JobMiniCard :job="job" :show-description="true" />
        </el-col>
      </el-row>
      <el-empty v-if="jobCards.length === 0" description="没有匹配的岗位" />
    </el-card>
  </main>
</template>

<script setup>
import TopBar from '../../components/TopBar.vue';
import { useAuthStore } from '../../stores/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
}

function logout() {
  authStore.logout();
  router.push('/login');
}

import { ref, onMounted } from 'vue';
import http from '../../api/http';
import JobMiniCard from '../../components/JobMiniCard.vue';

const jobCards = ref([]);

async function loadData() {
  try {
    const { data } = await http.get('/jobs', {
      params: { 
        page: 1, 
        limit: 100 
      }
    });
    jobCards.value = data.items || data || [];
  } catch (error) {
    console.error(error);
  }
}

onMounted(() => {
  loadData();
});
</script>
