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
      <h2>所有求职者总览</h2>
      <el-alert title="当前身份：超级管理员" type="info" :closable="false" show-icon />

      <h3>求职者组件卡片（点击查看详情）</h3>
      <el-row :gutter="12" class="component-grid">
        <el-col v-for="seeker in seekerCards" :key="seeker.userId" :xs="24" :sm="12" :lg="8">
          <SeekerMiniCard :seeker="seeker" :show-experience="true" />
        </el-col>
      </el-row>
      <el-empty v-if="seekerCards.length === 0" description="暂无求职者数据" />
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
import SeekerMiniCard from '../../components/SeekerMiniCard.vue';

const seekerCards = ref([]);

async function loadData() {
  try {
    const { data } = await http.get('/seekers', {
      params: { 
        page: 1, 
        limit: 100 
      }
    });
    seekerCards.value = data.items || data || [];
  } catch (error) {
    console.error(error);
  }
}

onMounted(() => {
  loadData();
});
</script>
