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
      <h2>个人/公司信息</h2>
      <form class="job-form" @submit.prevent="saveProfile">
        <input v-model.trim="form.nickname" placeholder="昵称" />
        <label class="file-label">
          头像（本地选择）
          <input type="file" accept="image/*" @change="onAvatarFileChange" />
        </label>
        <img v-if="form.avatarUrl" :src="form.avatarUrl" alt="avatar" class="avatar-preview" />
        <textarea v-model.trim="form.commonPhrase" placeholder="常用语（用于投递/邀请自动发送）" />

        <template v-if="authStore.activeIdentity === 'jobseeker'">
          <input v-model.trim="form.fullName" placeholder="姓名" />
          <input v-model.number="form.age" placeholder="年龄" />
          <input v-model.trim="form.gender" placeholder="性别" />
          <input v-model.trim="form.strengths" placeholder="个人优势" />
          <input v-model.trim="form.expectedPosition" placeholder="期望岗位" />
          <textarea v-model.trim="form.internshipExperience" placeholder="实习经历" />
          <textarea v-model.trim="form.projectExperience" placeholder="项目经历" />
          <textarea v-model.trim="form.competitionExperience" placeholder="比赛经历" />
          <textarea v-model.trim="form.campusExperience" placeholder="在校经历" />
        </template>

        <template v-else>
          <input v-model.trim="form.companyName" placeholder="公司名称" />
          <input v-model.trim="form.companyAddress" placeholder="公司地址" />
          <input v-model.trim="form.companySize" placeholder="公司规模" />
          <textarea v-model.trim="form.companyIntro" placeholder="公司介绍" />
        </template>

        <div class="actions">
          <button type="submit">保存资料</button>
          <button type="button" @click="exportWord">导出 Word</button>
        </div>
      </form>
      <p v-if="tip" class="tip">{{ tip }}</p>
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
const tip = ref('');

const form = reactive({
  nickname: '',
  avatarUrl: '',
  commonPhrase: '',
  companyName: '',
  companyAddress: '',
  companySize: '',
  companyIntro: '',
  fullName: '',
  age: null,
  gender: '',
  strengths: '',
  expectedPosition: '',
  internshipExperience: '',
  projectExperience: '',
  competitionExperience: '',
  campusExperience: ''
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('头像读取失败'));
    reader.readAsDataURL(file);
  });
}

async function onAvatarFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    form.avatarUrl = await fileToDataUrl(file);
    tip.value = '头像已选择，点击保存资料后生效';
  } catch (error) {
    tip.value = '头像读取失败，请重试';
  }
}

async function loadProfile() {
  const { data } = await http.get('/profile/me');
  form.nickname = data.user.nickname || '';
  Object.assign(form, {
    avatarUrl: data.profile?.avatar_url || '',
    commonPhrase: data.profile?.common_phrase || '',
    companyName: data.profile?.company_name || '',
    companyAddress: data.profile?.company_address || '',
    companySize: data.profile?.company_size || '',
    companyIntro: data.profile?.company_intro || '',
    fullName: data.profile?.full_name || '',
    age: data.profile?.age || null,
    gender: data.profile?.gender || '',
    strengths: data.profile?.strengths || '',
    expectedPosition: data.profile?.expected_position || '',
    internshipExperience: data.profile?.internship_experience || '',
    projectExperience: data.profile?.project_experience || '',
    competitionExperience: data.profile?.competition_experience || '',
    campusExperience: data.profile?.campus_experience || ''
  });
}

async function saveProfile() {
  try {
    await http.put('/profile/me', form);
    tip.value = '资料已保存';
  } catch (error) {
    tip.value = error.response?.data?.message || '保存失败';
  }
}

async function exportWord() {
  try {
    const response = await http.get('/profile/export-word', { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offer100-profile-${authStore.activeIdentity}.doc`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    tip.value = error.response?.data?.message || '导出失败';
  }
}

function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
  loadProfile();
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(loadProfile);
</script>

<style scoped>
.actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.file-label {
  display: grid;
  gap: 6px;
  color: #243b63;
  font-size: 14px;
}

.avatar-preview {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #cfe0ff;
}

.tip {
  margin-top: 12px;
  color: #1d4ed8;
}
</style>
