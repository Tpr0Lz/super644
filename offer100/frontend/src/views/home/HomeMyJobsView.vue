<template>
  <el-card class="panel" shadow="never">
    <h2>我的发布岗位</h2>
    <el-alert title="仅显示当前招聘者发布的岗位，可查看、编辑或删除" type="info" :closable="false" show-icon />

    <el-table :data="jobs" style="width: 100%; margin-top: 12px">
      <el-table-column prop="title" label="岗位名称" min-width="180" />
      <el-table-column prop="city" label="城市" width="100" />
      <el-table-column prop="salaryRange" label="薪资" width="120" />
      <el-table-column prop="employmentType" label="类型" width="100" />
      <el-table-column prop="publishAt" label="发布时间" width="120" />
      <el-table-column label="操作" width="260">
        <template #default="scope">
          <el-button link type="primary" @click="goDetail(scope.row.id)">查看</el-button>
          <el-button link type="warning" @click="startEdit(scope.row)">编辑</el-button>
          <el-button link type="danger" @click="removeJob(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!jobs.length" description="暂无已发布岗位" :image-size="80" />
    <el-alert v-if="tip" :title="tip" type="success" :closable="false" show-icon class="tip" />

    <el-dialog v-model="editVisible" title="编辑岗位" width="720px" destroy-on-close>
      <el-form label-width="90px" class="job-form" @submit.prevent>
        <el-form-item label="岗位名称" required>
          <el-input v-model.trim="editForm.title" placeholder="如：前端开发工程师" />
        </el-form-item>
        <el-form-item label="公司名称" required>
          <el-input v-model.trim="editForm.company" placeholder="如：CampusTech" />
        </el-form-item>
        <el-form-item label="工作城市" required>
          <el-select v-model="editForm.city" filterable allow-create default-first-option placeholder="请选择或输入城市">
            <el-option v-for="item in cityOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="求职类型" required>
          <el-select v-model="editForm.employmentType" placeholder="请选择求职类型">
            <el-option label="不限" value="不限" />
            <el-option label="全职" value="全职" />
            <el-option label="实习" value="实习" />
            <el-option label="兼职" value="兼职" />
          </el-select>
        </el-form-item>
        <el-form-item label="外层分类" required>
          <el-select v-model="editForm.categoryL1" placeholder="请选择岗位大类" @change="onEditCategoryL1Change">
            <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="内层岗位" required>
          <el-select v-model="editForm.categoryL2" placeholder="请选择具体岗位">
            <el-option v-for="item in editSubCategoryOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="薪资范围" required>
          <el-select v-model="editForm.salaryRange" placeholder="请选择薪资范围">
            <el-option v-for="item in salaryOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="学历要求" required>
          <el-select v-model="editForm.educationRequirement" placeholder="请选择学历要求">
            <el-option label="不限" value="不限" />
            <el-option label="高中" value="高中" />
            <el-option label="大专" value="大专" />
            <el-option label="本科" value="本科" />
            <el-option label="硕士" value="硕士" />
            <el-option label="博士" value="博士" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求经验" required>
          <el-select v-model="editForm.experienceRequirement" placeholder="请选择经验要求">
            <el-option label="不限" value="不限" />
            <el-option label="在校生" value="在校生" />
            <el-option label="应届生" value="应届生" />
            <el-option label="1年以内" value="1年以内" />
            <el-option label="1-3年" value="1-3年" />
            <el-option label="3-5年" value="3-5年" />
            <el-option label="5-10年" value="5-10年" />
            <el-option label="10年以上" value="10年以上" />
          </el-select>
        </el-form-item>
        <el-form-item label="公司规模" required>
          <el-select v-model="editForm.companySize" placeholder="请选择公司规模">
            <el-option label="不限" value="不限" />
            <el-option label="0-20人" value="0-20人" />
            <el-option label="20-100人" value="20-100人" />
            <el-option label="100-200人" value="100-200人" />
            <el-option label="200-500人" value="200-500人" />
            <el-option label="500-1000人" value="500-1000人" />
            <el-option label="1000人以上" value="1000人以上" />
          </el-select>
        </el-form-item>
        <el-form-item label="公司地址">
          <el-input v-model.trim="editForm.companyAddress" placeholder="如：上海浦东新区" />
        </el-form-item>
        <el-form-item label="公司介绍">
          <el-input v-model.trim="editForm.companyIntro" type="textarea" :rows="3" placeholder="用于求职者快速了解公司" />
        </el-form-item>
        <el-form-item label="岗位描述" required>
          <el-input v-model.trim="editForm.description" type="textarea" :rows="4" placeholder="描述岗位职责与要求" />
        </el-form-item>
      </el-form>

      <el-alert v-if="editTip" :title="editTip" type="warning" :closable="false" show-icon class="tip" />

      <template #footer>
        <div class="dialog-actions">
          <el-button type="primary" :loading="editing" @click="completeEdit">完成</el-button>
          <el-button @click="cancelEdit">返回</el-button>
        </div>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import http from '../../api/http';
import { JOB_CATEGORY_TREE, loadCategories } from '../../constants/jobCategories';

const router = useRouter();
const jobs = ref([]);
const tip = ref('');
const categoryOptions = JOB_CATEGORY_TREE;
const cityOptions = ['北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆', '武汉', '西安'];
const salaryOptions = ['不限', '3k以下', '3-5k', '5-10k', '10-20k', '20k以上'];
const editVisible = ref(false);
const editing = ref(false);
const editTip = ref('');
const editingJobId = ref(null);

const editForm = reactive({
  title: '',
  company: '',
  city: '',
  employmentType: '不限',
  categoryL1: '',
  categoryL2: '',
  salaryRange: '不限',
  educationRequirement: '不限',
  experienceRequirement: '不限',
  companySize: '不限',
  companyAddress: '',
  companyIntro: '',
  tags: '',
  description: ''
});

const editSubCategoryOptions = computed(() => {
  const target = JOB_CATEGORY_TREE.value.find((item) => item.value === editForm.categoryL1);
  return target?.children || [];
});

async function loadJobs() {
  try {
    const { data } = await http.get('/jobs/mine');
    jobs.value = Array.isArray(data) ? data : [];
  } catch (error) {
    tip.value = error.response?.data?.message || '加载岗位失败';
  }
}

function goDetail(jobId) {
  router.push({ path: `/jobs/${jobId}`, query: { from: 'my-jobs' } });
}

function onEditCategoryL1Change(value) {
  const target = JOB_CATEGORY_TREE.value.find((item) => item.value === value);
  editForm.categoryL2 = target?.children?.[0] || '';
}

function patchEditForm(data) {
  editForm.title = data?.title || '';
  editForm.company = data?.company || '';
  editForm.city = data?.city || '';
  editForm.employmentType = data?.employmentType || '不限';
  editForm.categoryL1 = data?.categoryL1 || JOB_CATEGORY_TREE.value[0]?.value || '';
  const defaultL2 = JOB_CATEGORY_TREE.value.find((item) => item.value === editForm.categoryL1)?.children?.[0] || '';
  editForm.categoryL2 = data?.categoryL2 || defaultL2;
  editForm.salaryRange = data?.salaryRange || '不限';
  editForm.educationRequirement = data?.educationRequirement || '不限';
  editForm.experienceRequirement = data?.experienceRequirement || '不限';
  editForm.companySize = data?.companySize || '不限';
  editForm.companyAddress = data?.companyAddress || '';
  editForm.companyIntro = data?.companyIntro || '';
  editForm.tags = Array.isArray(data?.tags) ? data.tags.join(',') : String(data?.tags || '');
  editForm.description = data?.description || '';
}

async function startEdit(job) {
  try {
    const { data } = await http.get(`/jobs/${job.id}`);
    editingJobId.value = job.id;
    patchEditForm(data);
    editTip.value = '';
    editVisible.value = true;
  } catch (error) {
    tip.value = error.response?.data?.message || '加载岗位详情失败，无法编辑';
  }
}

function cancelEdit() {
  editVisible.value = false;
  editTip.value = '';
  editingJobId.value = null;
}

async function completeEdit() {
  if (!editingJobId.value) {
    editTip.value = '未找到原岗位信息';
    return;
  }

  editing.value = true;
  editTip.value = '';

  try {
    await http.delete(`/jobs/${editingJobId.value}`);

    await http.post('/jobs', {
      ...editForm,
      tags: String(editForm.tags || '').split(',').map((item) => item.trim()).filter(Boolean)
    });

    tip.value = '岗位编辑完成：已删除旧岗位并发布新岗位';

    editVisible.value = false;
    editingJobId.value = null;
    await loadJobs();
  } catch (error) {
    editTip.value = error.response?.data?.message || '编辑失败';
  } finally {
    editing.value = false;
  }
}

async function removeJob(job) {
  const ok = window.confirm(`确认删除岗位：${job.title}？`);
  if (!ok) {
    return;
  }

  try {
    await http.delete(`/jobs/${job.id}`);
    tip.value = '岗位删除成功';
    await loadJobs();
  } catch (error) {
    tip.value = error.response?.data?.message || '岗位删除失败';
  }
}

onMounted(loadJobs);
</script>

<style scoped>
.tip {
  margin-top: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
