<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />

    <div class="workspace-layout">
      <aside class="workspace-menu">
        <router-link to="/" class="menu-item">主页面</router-link>
        <router-link to="/jobs" class="menu-item">职位大厅</router-link>
        <router-link to="/recruiter" class="menu-item active">招聘工作台</router-link>
        <router-link to="/chat" class="menu-item">在线对话</router-link>
        <router-link to="/profile" class="menu-item">个人/公司信息</router-link>
        <router-link to="/identity-register" class="menu-item">注册身份</router-link>
      </aside>

      <section class="workspace-main">
        <h2>招聘人工作台</h2>

        <div class="form-section">
          <h3>公司信息</h3>
          <form class="job-form" @submit.prevent="saveCompany">
            <input v-model.trim="companyForm.name" placeholder="公司名称" required />
            <input v-model.trim="companyForm.website" placeholder="公司官网" />
            <textarea v-model.trim="companyForm.intro" placeholder="公司介绍" />
            <button type="submit">保存公司信息</button>
          </form>
        </div>

        <div class="form-section">
          <h3>求职者列表</h3>
          <ul class="seeker-list">
            <li v-for="seeker in seekers" :key="seeker.userId" class="seeker-item">
              <SeekerMiniCard :seeker="seeker" :show-experience="true" />
            </li>
          </ul>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import SeekerMiniCard from '../components/SeekerMiniCard.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const seekers = ref([]);
const tip = ref('');

const companyForm = reactive({
  name: 'CampusTech',
  intro: '聚焦校园招聘与企业数字化服务。',
  website: 'https://campustech.example'
});

async function loadCompany() {
  const { data } = await http.get('/company/me');
  companyForm.name = data.name || '';
  companyForm.intro = data.intro || '';
  companyForm.website = data.website || '';
}

async function loadSeekers() {
  const { data } = await http.get('/resume/seekers');
  seekers.value = data;
}

async function saveCompany() {
  try {
    await http.put('/company/me', companyForm);
    tip.value = '公司信息已保存';
    setTimeout(() => {
      tip.value = '';
    }, 3000);
  } catch (error) {
    tip.value = error.response?.data?.message || '公司信息保存失败';
  }
}

async function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  await loadCompany();
  await loadSeekers();
});
</script>

<style scoped>
.workspace-layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 16px;
  margin-top: 12px;
}

.workspace-menu {
  display: grid;
  gap: 8px;
}

.menu-item {
  display: block;
  padding: 12px;
  background: #ffffffd9;
  border: 1px solid #cfe0ff;
  border-radius: 10px;
  color: #1d4c95;
  text-decoration: none;
  text-align: center;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #edf3ff;
}

.menu-item.active,
.menu-item.router-link-active {
  background: #1e63d8;
  color: #fff;
  font-weight: 600;
}

.workspace-main {
  padding: 18px;
  background: #ffffffd9;
  border: 1px solid #cfe0ff;
  border-radius: 16px;
  box-shadow: 0 12px 26px rgba(19, 36, 58, 0.08);
}

.workspace-main h2 {
  margin-top: 0;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e8f2ff;
}

.form-section:last-child {
  border-bottom: none;
}

.form-section h3 {
  margin-top: 0;
  color: #13243a;
}

.seeker-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.seeker-item {
  border: none;
  padding: 0;
}

.tip {
  margin-top: 8px;
  padding: 8px 12px;
  background: #edf3ff;
  color: #1d4c95;
  border-radius: 8px;
  font-size: 14px;
}
</style>
