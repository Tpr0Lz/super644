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
      <h2>注册新身份</h2>
      <p>当前已注册：{{ authStore.identities.join(' / ') || '无' }}</p>
      <label>
        选择身份
        <select v-model="identity">
          <option value="jobseeker">求职者</option>
          <option value="recruiter">招聘者</option>
        </select>
      </label>

      <form class="job-form" @submit.prevent="submit">
        <template v-if="identity === 'jobseeker'">
          <input v-model.trim="jobseekerProfile.fullName" placeholder="姓名" required />
          <input v-model.number="jobseekerProfile.age" placeholder="年龄" required />
          <input v-model.trim="jobseekerProfile.gender" placeholder="性别" required />
          <input v-model.trim="jobseekerProfile.strengths" placeholder="个人优势" required />
          <textarea v-model.trim="jobseekerProfile.projectExperience" placeholder="项目经历" />
        </template>
        <template v-else>
          <input v-model.trim="recruiterProfile.companyName" placeholder="公司名称" required />
          <input v-model.trim="recruiterProfile.companyAddress" placeholder="公司地址" required />
          <input v-model.trim="recruiterProfile.companySize" placeholder="公司规模" required />
          <textarea v-model.trim="recruiterProfile.companyIntro" placeholder="公司介绍" />
        </template>
        <button type="submit">注册该身份</button>
      </form>

      <p v-if="tip" class="tip">{{ tip }}</p>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const identity = ref('jobseeker');
const tip = ref('');

const recruiterProfile = reactive({
  companyName: '',
  companyAddress: '',
  companySize: '',
  companyIntro: ''
});

const jobseekerProfile = reactive({
  fullName: '',
  age: 22,
  gender: '',
  strengths: '',
  projectExperience: ''
});

async function submit() {
  try {
    const { data } = await http.post('/profile/register-identity', {
      identity: identity.value,
      recruiterProfile,
      jobseekerProfile
    });
    authStore.setUserIdentities(data.identities);
    tip.value = '身份注册成功，可以在顶部切换';
  } catch (error) {
    tip.value = error.response?.data?.message || '身份注册失败';
  }
}

function switchIdentity(nextIdentity) {
  authStore.setActiveIdentity(nextIdentity);
}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.tip {
  margin-top: 12px;
  color: #1d4ed8;
}
</style>
