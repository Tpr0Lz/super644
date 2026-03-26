<template>
  <main class="page admin-view">
    <TopBar :username="authStore.user?.username" :role="authStore.role" @logout="logout" />

    <section class="panel admin-panel">
      <h2>管理员后台</h2>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="岗位管理" name="jobs">
          <el-table :data="jobs" border style="width: 100%">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="title" label="岗位名称" />
            <el-table-column prop="company" label="公司" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click="deleteJob(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="用户管理" name="users">
          <el-table :data="users" border style="width: 100%">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="username" label="用户名" />
            <el-table-column prop="role" label="角色" />
            <el-table-column label="操作" width="220">
              <template #default="{ row }">
                <el-button type="warning" size="small" @click="disablePublish(row.id)">禁发岗位</el-button>
                <el-button type="info" size="small" @click="hideResume(row.id)">隐藏简历</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="分类管理" name="categories">
          <el-form :model="categoryForm" label-width="100px" class="category-form" @submit.prevent="createCategory">
            <el-form-item label="一级分类">
              <el-select v-model="categoryForm.category_l1" filterable allow-create placeholder="选择或输入一级分类">
                <el-option
                  v-for="item in JOB_CATEGORY_TREE"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="二级分类">
              <el-input v-model="categoryForm.category_l2" placeholder="输入二级分类名称" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" native-type="submit">添加分类</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import { JOB_CATEGORY_TREE, loadCategories } from '../constants/jobCategories';

const router = useRouter();
const authStore = useAuthStore();
const activeTab = ref('jobs');

const jobs = ref([]);
const users = ref([]);
const categoryForm = ref({
  category_l1: '',
  category_l2: '',
});

async function loadData() {
  await Promise.all([
    loadCategories(),
    fetchJobs(),
    fetchUsers()
  ]);
}

async function fetchJobs() {
  try {
    const res = await http.get('/jobs');
    jobs.value = res.data?.items || res.data || [];
  } catch (err) {
    console.error(err);
  }
}

async function fetchUsers() {
  try {
    const res = await http.get('/admin/users'); // Adjust if endpoint difference
    users.value = res.data?.items || res.data || [];
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error(err);
    }
  }
}

async function deleteJob(id) {
  try {
    await http.delete(`/admin/jobs/${id}`);
    ElMessage.success('删除成功');
    fetchJobs();
  } catch (err) {
    ElMessage.error('删除失败');
  }
}

async function disablePublish(id) {
  try {
    await http.put(`/admin/users/${id}/disable-publish`);
    ElMessage.success('已禁止发布');
  } catch (err) {
    ElMessage.error('操作失败');
  }
}

async function hideResume(id) {
  try {
    await http.put(`/admin/users/${id}/hide-resume`);
    ElMessage.success('已隐藏简历');
  } catch (err) {
    ElMessage.error('操作失败');
  }
}

async function createCategory() {
  if (!categoryForm.value.category_l1 || !categoryForm.value.category_l2) {
    return ElMessage.warning('请填写完整分类信息');
  }
  try {
    await http.post('/admin/categories', {
      category_l1: categoryForm.value.category_l1,
      category_l2: categoryForm.value.category_l2
    });
    ElMessage.success('添加分类成功');
    categoryForm.value.category_l2 = '';
    // Reload categories
    JOB_CATEGORY_TREE.value = [];
    await loadCategories();
  } catch (err) {
    ElMessage.error('添加失败');
  }
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(() => {
  if (!authStore.user || authStore.user.username !== 'adm') {
    ElMessage.error('无权访问');
    router.push('/');
    return;
  }
  loadData();
});
</script>

<style scoped>
.page {
  background: var(--bg-color, #f4f6f8);
  min-height: 100vh;
}
.admin-panel {
  max-width: 1000px;
  margin: 20px auto;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}
.category-form {
  max-width: 500px;
}
</style>
