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
      <h2>求职者详情</h2>
      <p v-if="!seeker">加载中...</p>
      <template v-else>
        <h3>{{ seeker.fullName }}（{{ seeker.username }}）</h3>
        <p>性别：{{ seeker.gender || '-' }} | 年龄：{{ seeker.age || '-' }}</p>
        <p>个人优势：{{ seeker.strengths || '-' }}</p>
        <p>期望岗位：{{ seeker.expectedPosition || '-' }}</p>
        <p>实习经历：{{ seeker.internshipExperience || '-' }}</p>
        <p>项目经历：{{ seeker.projectExperience || '-' }}</p>
        <p>比赛经历：{{ seeker.competitionExperience || '-' }}</p>
        <p>在校经历：{{ seeker.campusExperience || '-' }}</p>

        <div class="actions">
          <label>
            邀请岗位
            <select v-model="selectedJobId">
              <option value="">请选择岗位</option>
              <option v-for="job in myJobs" :key="job.id" :value="job.id">
                {{ job.title }} - {{ job.company }}
              </option>
            </select>
          </label>
          <button @click="inviteSeeker">邀请应聘（自动发送岗位卡片+常用语）</button>
          <button @click="openChat">与求职者聊天</button>
          <router-link to="/recruiter">返回招聘工作台</router-link>
        </div>
        <p v-if="tip" class="tip">{{ tip }}</p>
      </template>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const seeker = ref(null);
const myJobs = ref([]);
const selectedJobId = ref('');
const tip = ref('');

async function loadData() {
  const [seekerRes, jobsRes] = await Promise.all([
    http.get(`/resume/seekers/${route.params.userId}`),
    http.get('/jobs')
  ]);
  seeker.value = seekerRes.data;
  myJobs.value = (jobsRes.data || []).filter((item) => item.recruiterUserId === authStore.user?.id);
}

async function inviteSeeker() {
  if (!selectedJobId.value) {
    tip.value = '请先选择岗位';
    return;
  }
  try {
    await http.post(`/resume/seekers/${route.params.userId}/invite`, { jobId: Number(selectedJobId.value) });
    tip.value = '邀请已发送，并自动发送岗位组件和常用语';
  } catch (error) {
    tip.value = error.response?.data?.message || '邀请失败';
  }
}

function openChat() {
  router.push(`/chat?with=${route.params.userId}`);
}

function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(loadData);
</script>

<style scoped>
.actions {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}

.tip {
  margin-top: 12px;
  color: #1d4ed8;
}
</style>
