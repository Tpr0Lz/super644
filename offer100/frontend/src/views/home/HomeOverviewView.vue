<template>
  <el-card class="panel" shadow="never">
    <h2>{{ isRecruiter ? '招聘总览' : '职位总览' }}</h2>
    <el-alert :title="`当前身份：${isRecruiter ? '招聘者' : '求职者'}`" type="info" :closable="false" show-icon />

    <template v-if="isRecruiter">
      <h3>求职者组件卡片（点击查看详情）</h3>
      <el-row :gutter="12" class="component-grid">
        <el-col v-for="seeker in seekerCards" :key="seeker.userId" :xs="24" :sm="12" :lg="8">
          <SeekerMiniCard :seeker="seeker" :show-experience="true" />
          <div class="card-actions">
            <el-button size="small" @click="chatWithSeeker(seeker.userId)">聊天</el-button>
            <el-button size="small" type="primary" @click="goInvite(seeker.userId)">邀请</el-button>
          </div>
        </el-col>
      </el-row>
      <el-empty v-if="seekerCards.length === 0" description="暂无已完善个人信息的求职者" />
    </template>

    <template v-else>
      <h3>岗位组件卡片（点击查看详情）</h3>
      <el-row :gutter="12" class="component-grid">
        <el-col v-for="job in jobCards" :key="job.id" :xs="24" :sm="12" :lg="8">
          <JobMiniCard :job="job" :show-description="true" />
          <div class="card-actions">
            <el-button type="primary" size="small" @click="applyJob(job.id)">立即投递</el-button>
            <el-button size="small" @click="chatWithRecruiter(job.recruiterUserId)" :disabled="!job.recruiterUserId">聊天</el-button>
          </div>
        </el-col>
      </el-row>
      <el-empty v-if="jobCards.length === 0" description="暂无岗位，请等待招聘者创建岗位" />
    </template>

    <el-alert v-if="tip" :title="tip" type="success" :closable="false" show-icon class="tip" />
  </el-card>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import http from '../../api/http';
import JobMiniCard from '../../components/JobMiniCard.vue';
import SeekerMiniCard from '../../components/SeekerMiniCard.vue';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const seekerCards = ref([]);
const jobCards = ref([]);
const tip = ref('');
const isRecruiter = computed(() => authStore.activeIdentity === 'recruiter');

let socket;

async function loadData() {
  if (isRecruiter.value) {
    const { data } = await http.get('/resume/seekers');
    seekerCards.value = data;
    jobCards.value = [];
    return;
  }

  const { data } = await http.get('/jobs');
  jobCards.value = data;
  seekerCards.value = [];
}

async function applyJob(jobId) {
  try {
    await http.post(`/jobs/${jobId}/apply`);
    tip.value = '投递成功，已发送个人信息组件与常用语';
  } catch (error) {
    tip.value = error.response?.data?.message || '投递失败';
  }
}

function chatWithSeeker(userId) {
  router.push(`/chat?with=${userId}`);
}

function goInvite(userId) {
  router.push(`/seekers/${userId}`);
}

function chatWithRecruiter(userId) {
  if (!userId) {
    return;
  }
  router.push(`/chat?with=${userId}`);
}

onMounted(async () => {
  await loadData();

  socket = io('http://localhost:3001');
  socket.on('recruitment:update', async (event) => {
    if (!event?.type) {
      return;
    }

    if (event.type === 'job_created' && !isRecruiter.value) {
      await loadData();
      return;
    }

    if (event.type === 'seeker_profile_ready' && isRecruiter.value) {
      await loadData();
    }
  });
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
  }
});
</script>

<style scoped>
.component-grid {
  margin-top: 10px;
}

.tip {
  margin-top: 12px;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.mini-link {
  text-decoration: none;
}
</style>
