<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.nickname || authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />

    <section class="panel">
      <h2>岗位详情</h2>
      <p v-if="!job">加载中...</p>
      <template v-else>
        <h3>{{ job.title }}</h3>
        <p>{{ job.company }} | {{ job.city }} | {{ job.salaryRange }}</p>
        <p>{{ job.description }}</p>
        <div class="tags">
          <span v-for="tag in job.tags" :key="tag">{{ tag }}</span>
        </div>

        <div class="actions">
          <button v-if="isJobseeker" @click="applyJob">投递（自动发送个人信息+常用语）</button>
          <button @click="openChat">与招聘者聊天</button>
          <router-link to="/jobs">返回职位列表</router-link>
        </div>
        <p v-if="tip" class="tip">{{ tip }}</p>
      </template>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const job = ref(null);
const tip = ref('');
const isJobseeker = computed(() => authStore.activeIdentity === 'jobseeker');

async function loadJob() {
  const { data } = await http.get(`/jobs/${route.params.id}`);
  job.value = data;
}

async function applyJob() {
  try {
    await http.post(`/jobs/${route.params.id}/apply`);
    tip.value = '投递成功，已自动向招聘者发送个人信息卡片和常用语';
  } catch (error) {
    tip.value = error.response?.data?.message || '投递失败';
  }
}

function openChat() {
  if (!job.value?.recruiterUserId) {
    return;
  }
  router.push(`/chat?with=${job.value.recruiterUserId}`);
}

function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(loadJob);
</script>

<style scoped>
.actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tip {
  margin-top: 12px;
  color: #1d4ed8;
}
</style>
