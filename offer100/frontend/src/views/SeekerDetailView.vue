<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.nickname || authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />

    <section class="panel detail-panel">
      <h2>求职者详情</h2>
      <p v-if="!seeker">加载中...</p>
      <template v-else>
        <div class="profile-head">
          <el-avatar :size="72" :src="seeker.avatarUrl || ''">{{ (seeker.fullName || seeker.username || 'U').slice(0, 1) }}</el-avatar>
          <div>
            <h3>{{ seeker.fullName }}（{{ seeker.username }}）</h3>
            <p class="sub">{{ seeker.gender || '-' }} | {{ seeker.age || '-' }}岁 | {{ seeker.graduationCohort || '届别未填' }}</p>
            <el-tag type="success" size="small">{{ seeker.jobHuntingStatus || '考虑机会' }}</el-tag>
          </div>
        </div>

        <el-descriptions :column="2" border class="base-info">
          <el-descriptions-item label="期望薪资">{{ seeker.expectedSalary || '-' }}</el-descriptions-item>
          <el-descriptions-item label="期望岗位">{{ seeker.expectedPosition || '-' }}</el-descriptions-item>
          <el-descriptions-item label="学校">{{ seeker.school || '-' }}</el-descriptions-item>
          <el-descriptions-item label="专业">{{ seeker.major || '-' }}</el-descriptions-item>
          <el-descriptions-item label="个人所在地">{{ seeker.location || '其他' }}</el-descriptions-item>
          <el-descriptions-item label="学历">{{ seeker.degree || seeker.education || '-' }}</el-descriptions-item>
          <el-descriptions-item label="工作经验">{{ seeker.workExperience || seeker.experience || '-' }}</el-descriptions-item>
          <el-descriptions-item label="求职类型">{{ seeker.expectedJobType || '不限' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ seeker.contactPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系邮箱">{{ seeker.contactEmail || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-card shadow="never" class="section-card">
          <template #header>个人优势</template>
          <p class="pre-line">{{ seeker.strengths || '-' }}</p>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>在校经历</template>
          <p class="pre-line">{{ seeker.campusExperience || '-' }}</p>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>项目经历</template>
          <p class="pre-line">{{ seeker.projectExperience || '-' }}</p>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>实习经历</template>
          <p class="pre-line">{{ seeker.internshipExperience || '-' }}</p>
        </el-card>

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
          <button @click="inviteSeeker">邀请应聘（自动发送岗位卡片和常用语）</button>
          <button @click="openChat">与求职者聊天</button>
          <button @click="exportSeekerWord">导出简历 Word</button>
          <router-link to="/">返回首页</router-link>
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
    tip.value = '邀请已发送，并自动发送岗位卡片和常用语';
  } catch (error) {
    tip.value = error.response?.data?.message || '邀请失败';
  }
}

function openChat() {
  router.push(`/chat?with=${route.params.userId}`);
}

async function exportSeekerWord() {
  try {
    const response = await http.get(`/resume/seekers/${route.params.userId}/export-word`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `seeker-${route.params.userId}.doc`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    tip.value = error.response?.data?.message || '导出失败';
  }
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
.detail-panel {
  display: grid;
  gap: 14px;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sub {
  margin: 6px 0 8px;
  color: #5e7ba7;
}

.base-info {
  margin-top: 2px;
}

.section-card :deep(.el-card__header) {
  padding: 10px 14px;
  background: #f4f8ff;
  color: #1f3f75;
  font-weight: 600;
}

.pre-line {
  white-space: pre-line;
  margin: 0;
  color: #2f4c78;
  line-height: 1.7;
}

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
