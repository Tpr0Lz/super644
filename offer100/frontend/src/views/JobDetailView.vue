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
        <el-card shadow="never" class="detail-card">
          <h3>{{ job.title }}</h3>
          <div class="tags" v-if="job.categoryL1 || job.categoryL2">
            <el-tag v-if="job.categoryL1" size="small" effect="plain">{{ job.categoryL1 }}</el-tag>
            <el-tag v-if="job.categoryL2" size="small" effect="plain">{{ job.categoryL2 }}</el-tag>
          </div>

          <el-descriptions :column="2" border class="meta-grid">
            <el-descriptions-item label="公司名称">{{ job.company }}</el-descriptions-item>
            <el-descriptions-item label="公司位置">{{ job.city }}</el-descriptions-item>
            <el-descriptions-item label="公司规模">{{ job.companySize || '不限' }}</el-descriptions-item>
            <el-descriptions-item label="详细地址">{{ job.companyAddress || '-' }}</el-descriptions-item>
            <el-descriptions-item label="薪资范围">{{ job.salaryRange || '-' }}</el-descriptions-item>
            <el-descriptions-item label="求职类型">{{ job.employmentType || '不限' }}</el-descriptions-item>
            <el-descriptions-item label="需求经验">{{ job.experienceRequirement || '不限' }}</el-descriptions-item>
            <el-descriptions-item label="学历要求">{{ job.educationRequirement || '不限' }}</el-descriptions-item>
            <el-descriptions-item label="发布时间">{{ job.publishAt || '-' }}</el-descriptions-item>
          </el-descriptions>

          <el-card shadow="never" class="intro-card">
            <h4>公司介绍</h4>
            <p>{{ job.companyIntro || '暂无公司介绍' }}</p>
          </el-card>

          <el-card shadow="never" class="intro-card">
            <h4>岗位简介</h4>
            <p>{{ job.description || '暂无岗位描述' }}</p>
          </el-card>

          <el-card shadow="never" class="recruiter-card">
            <div class="recruiter-box">
              <el-avatar :src="job.recruiterAvatar || DEFAULT_AVATAR" :size="44" />
              <div>
                <p class="recruiter-name">{{ job.recruiterNickname || '招聘者' }}</p>
                <p class="recruiter-active">最近活跃：{{ formatDateTime(job.recruiterLastActiveAt) }}</p>
              </div>
            </div>
          </el-card>

          <div class="actions">
            <button v-if="isJobseeker" @click="applyJob">投递（自动发送个人信息+常用语）</button>
            <button v-if="canChatRecruiter" @click="openChat">与招聘者聊天</button>
            <router-link :to="backLink">{{ backLinkText }}</router-link>
          </div>
          <p v-if="tip" class="tip">{{ tip }}</p>
        </el-card>
      </template>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElNotification } from 'element-plus';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="%23dbeafe"/><circle cx="40" cy="30" r="14" fill="%2393c5fd"/><path d="M16 66c4-12 14-18 24-18s20 6 24 18" fill="%2393c5fd"/></svg>';

const job = ref(null);
const tip = ref('');
const isJobseeker = computed(() => authStore.activeIdentity === 'jobseeker');
const fromMyJobs = computed(() => route.query.from === 'my-jobs');
const canChatRecruiter = computed(() => {
  if (!job.value?.recruiterUserId) {
    return false;
  }
  if (fromMyJobs.value) {
    return false;
  }
  return job.value.recruiterUserId !== authStore.user?.id;
});
const backLink = computed(() => (fromMyJobs.value ? '/my-jobs' : '/jobs'));
const backLinkText = computed(() => (fromMyJobs.value ? '返回我的发布' : '返回职位列表'));

async function loadJob() {
  const { data } = await http.get(`/jobs/${route.params.id}`);
  job.value = data;
}

async function applyJob() {
  try {
    await http.post(`/jobs/${route.params.id}/apply`);
    ElNotification({
      title: '投递成功',
      message: '已自动向招聘者发送个人信息卡片和常用语',
      type: 'success',
      duration: 1500,
      position: 'bottom-right'
    });
  } catch (error) {
    const errorMsg = error.response?.data?.message || '投递失败';
    ElNotification({
      title: '投递失败',
      message: errorMsg,
      type: 'error',
      duration: 1500,
      position: 'bottom-right'
    });
  }
}

function formatDateTime(value) {
  if (!value) {
    return '暂无';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '暂无';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
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

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.detail-card {
  border-radius: 12px;
}

.meta-grid {
  margin-top: 12px;
}

.intro-card,
.recruiter-card {
  margin-top: 12px;
}

.recruiter-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.recruiter-name {
  margin: 0;
  font-weight: 600;
}

.recruiter-active {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}
</style>
