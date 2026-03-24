<template>
  <main class="login-page">
    <section class="card">
      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>

      <template v-if="mode === 'login'">
        <h2>登录 Offer100</h2>
        <p>登录后默认以注册时选择的初始身份进入系统。</p>
        <form @submit.prevent="submitLogin" class="form">
          <div class="line-field">
            <span class="line-label">账号</span>
            <input v-model.trim="loginForm.username" placeholder="请输入用户名" required />
          </div>
          <div class="line-field">
            <span class="line-label">密码</span>
            <input v-model="loginForm.password" type="password" placeholder="请输入密码" required />
          </div>
          <button type="submit" :disabled="loading">{{ loading ? '登录中...' : '登录' }}</button>
        </form>
      </template>

      <template v-else>
        <h2>注册 Offer100</h2>
        <p>注册时选择初始身份，首次登录将以该身份进入页面。</p>
        <form @submit.prevent="submitRegister" class="form">
          <label>
            用户名
            <input v-model.trim="registerForm.username" placeholder="唯一用户名" required />
          </label>
          <label>
            昵称
            <input v-model.trim="registerForm.nickname" placeholder="展示昵称" required />
          </label>
          <label>
            密码
            <input v-model="registerForm.password" type="password" placeholder="登录密码" required />
          </label>
          <label>
            初始身份
            <select v-model="registerForm.initialIdentity">
              <option value="jobseeker">求职者</option>
              <option value="recruiter">招聘者</option>
            </select>
          </label>

          <div v-if="registerForm.initialIdentity === 'jobseeker'" class="sub-panel">
            <h3>求职者基础信息</h3>
            <input v-model.trim="registerForm.jobseekerProfile.fullName" placeholder="姓名" required />
            <input v-model.number="registerForm.jobseekerProfile.age" placeholder="年龄" required />
            <input v-model.trim="registerForm.jobseekerProfile.gender" placeholder="性别" required />
            <input
              v-model.trim="registerForm.jobseekerProfile.strengths"
              placeholder="个人优势"
              required
            />
            <input
              v-model.trim="registerForm.jobseekerProfile.expectedPosition"
              placeholder="期望岗位"
            />
            <textarea
              v-model.trim="registerForm.jobseekerProfile.internshipExperience"
              placeholder="实习经历"
            />
            <textarea
              v-model.trim="registerForm.jobseekerProfile.projectExperience"
              placeholder="项目经历"
            />
            <textarea
              v-model.trim="registerForm.jobseekerProfile.competitionExperience"
              placeholder="比赛经历"
            />
            <textarea
              v-model.trim="registerForm.jobseekerProfile.campusExperience"
              placeholder="在校经历"
            />
          </div>

          <div v-else class="sub-panel">
            <h3>招聘者公司信息</h3>
            <input
              v-model.trim="registerForm.recruiterProfile.companyName"
              placeholder="公司名称"
              required
            />
            <input
              v-model.trim="registerForm.recruiterProfile.companyAddress"
              placeholder="公司地址"
              required
            />
            <input
              v-model.trim="registerForm.recruiterProfile.companySize"
              placeholder="公司规模（人数）"
              required
            />
            <textarea
              v-model.trim="registerForm.recruiterProfile.companyIntro"
              placeholder="公司介绍"
            />
          </div>

          <button type="submit" :disabled="loading">{{ loading ? '提交中...' : '完成注册' }}</button>
        </form>
      </template>

      <p v-if="tip" class="tip">{{ tip }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/http';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const mode = ref('login');
const loading = ref(false);
const error = ref('');
const tip = ref('');

const loginForm = reactive({
  username: 'studentA',
  password: '123456'
});

const registerForm = reactive({
  username: '',
  nickname: '',
  password: '',
  initialIdentity: 'jobseeker',
  recruiterProfile: {
    companyName: '',
    companyAddress: '',
    companySize: '',
    companyIntro: '',
    commonPhrase: ''
  },
  jobseekerProfile: {
    fullName: '',
    age: 22,
    gender: '',
    strengths: '',
    expectedPosition: '',
    internshipExperience: '',
    projectExperience: '',
    competitionExperience: '',
    campusExperience: '',
    commonPhrase: ''
  }
});

async function submitLogin() {
  loading.value = true;
  error.value = '';
  tip.value = '';
  try {
    const { data } = await http.post('/auth/login', loginForm);
    authStore.setAuth(data);
    router.push('/');
  } catch (err) {
    error.value = err.response?.data?.message || '登录失败，请重试';
  } finally {
    loading.value = false;
  }
}

async function submitRegister() {
  loading.value = true;
  error.value = '';
  tip.value = '';
  try {
    await http.post('/auth/register', registerForm);
    tip.value = '注册成功，请直接登录';
    mode.value = 'login';
    loginForm.username = registerForm.username;
    loginForm.password = registerForm.password;
  } catch (err) {
    error.value = err.response?.data?.message || '注册失败，请重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.tabs button {
  border: 1px solid #cfe0ff;
  border-radius: 10px;
  padding: 10px;
  background: #f5f9ff;
  color: #1d4c95;
  cursor: pointer;
}

.tabs button.active {
  background: #1e63d8;
  color: #fff;
}

.form {
  display: grid;
  gap: 10px;
}

.sub-panel {
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.sub-panel h3 {
  margin: 4px 0;
}

.line-field {
  display: grid;
  grid-template-columns: 48px 1fr;
  align-items: center;
  gap: 8px;
}

.line-label {
  text-align: right;
  color: #334155;
}

.tip {
  margin-top: 12px;
  color: #17623b;
}
</style>
