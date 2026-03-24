<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.nickname || authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />

    <el-card v-if="isRecruiter" shadow="never" class="sub-nav-card">
      <el-segmented :model-value="activeSegment" :options="segmentOptions" @change="onSegmentChange" />
    </el-card>

    <router-view />
  </main>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isRecruiter = computed(() => authStore.activeIdentity === 'recruiter');
const activeSegment = computed(() => (route.name === 'home-publish' ? 'publish' : 'overview'));
const segmentOptions = computed(() => {
  return [
    { label: '招聘总览', value: 'overview' },
    { label: '发布岗位', value: 'publish' }
  ];
});

function onSegmentChange(value) {
  if (value === 'publish') {
    router.push({ name: 'home-publish' });
    return;
  }
  router.push({ name: 'home-overview' });
}

function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
  if (identity !== 'recruiter' && route.name === 'home-publish') {
    router.push({ name: 'home-overview' });
  }
}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.sub-nav-card {
  margin-bottom: 12px;
}
</style>
