<template>
  <el-card class="panel" shadow="never">
    <h2>发布岗位</h2>
    <el-alert title="该页面与招聘总览解耦，专用于岗位发布" type="info" :closable="false" show-icon />

    <el-form label-width="90px" class="job-form" @submit.prevent>
      <el-form-item label="岗位名称" required>
        <el-input v-model.trim="jobForm.title" placeholder="如：前端开发工程师" />
      </el-form-item>
      <el-form-item label="公司名称" required>
        <el-input v-model.trim="jobForm.company" placeholder="如：CampusTech">
          <template #append>
            <el-button @click="fillFromProfile(true)">使用我的资料</el-button>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="工作城市" required>
        <el-select v-model="jobForm.city" filterable allow-create default-first-option placeholder="请选择或输入城市">
          <el-option v-for="item in cityOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="求职类型" required>
        <el-select v-model="jobForm.employmentType" placeholder="请选择求职类型">
          <el-option label="不限" value="不限" />
          <el-option label="全职" value="全职" />
          <el-option label="实习" value="实习" />
          <el-option label="兼职" value="兼职" />
        </el-select>
      </el-form-item>
      <el-form-item label="外层分类" required>
        <el-select v-model="jobForm.categoryL1" placeholder="请选择岗位大类" @change="onCategoryL1Change">
          <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="内层岗位" required>
        <el-select v-model="jobForm.categoryL2" placeholder="请选择具体岗位">
          <el-option v-for="item in subCategoryOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="薪资范围" required>
        <el-select v-model="jobForm.salaryRange" placeholder="请选择薪资范围">
          <el-option v-for="item in salaryOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="学历要求" required>
        <el-select v-model="jobForm.educationRequirement" placeholder="请选择学历要求">
          <el-option label="不限" value="不限" />
          <el-option label="高中" value="高中" />
          <el-option label="大专" value="大专" />
          <el-option label="本科" value="本科" />
          <el-option label="硕士" value="硕士" />
          <el-option label="博士" value="博士" />
        </el-select>
      </el-form-item>
      <el-form-item label="需求经验" required>
        <el-select v-model="jobForm.experienceRequirement" placeholder="请选择经验要求">
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
        <el-select v-model="jobForm.companySize" placeholder="请选择公司规模">
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
        <el-input v-model.trim="jobForm.companyAddress" placeholder="如：上海浦东新区" />
      </el-form-item>
      <el-form-item label="公司介绍">
        <el-input v-model.trim="jobForm.companyIntro" type="textarea" :rows="3" placeholder="用于求职者快速了解公司" />
      </el-form-item>
      <el-form-item label="岗位描述" required>
        <el-input v-model.trim="jobForm.description" type="textarea" :rows="4" placeholder="描述岗位职责与要求" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="createJob">发布岗位</el-button>
      </el-form-item>
    </el-form>

    <el-alert v-if="tip" :title="tip" type="success" :closable="false" show-icon class="tip" />
  </el-card>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import http from '../../api/http';
import { JOB_CATEGORY_TREE, loadCategories } from '../../constants/jobCategories';

const tip = ref('');
const categoryOptions = JOB_CATEGORY_TREE;
const cityOptions = ['北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆', '武汉', '西安'];
const salaryOptions = ['不限', '3k以下', '3-5k', '5-10k', '10-20k', '20k以上'];

const jobForm = reactive({
  title: '前端开发工程师',
  company: 'CampusTech',
  city: '上海',
  employmentType: '全职',
  categoryL1: '互联网 / AI',
  categoryL2: '前端开发（Vue / React）',
  salaryRange: '5-10k',
  educationRequirement: '本科',
  experienceRequirement: '不限',
  companySize: '100-200人',
  companyAddress: '上海浦东新区',
  companyIntro: '专注校园招聘数字化平台与企业人才服务。',
  tags: 'vue,javascript,frontend',
  description: '负责企业级 Web 前端开发。'
});

const subCategoryOptions = computed(() => {
  const target = JOB_CATEGORY_TREE.value.find((item) => item.value === jobForm.categoryL1);
  return target?.children || [];
});

function onCategoryL1Change(value) {
  const target = JOB_CATEGORY_TREE.value.find((item) => item.value === value);
  jobForm.categoryL2 = target?.children?.[0] || '';
}

async function createJob() {
  try {
    await http.post('/jobs', {
      ...jobForm,
      tags: jobForm.tags.split(',').map((item) => item.trim()).filter(Boolean)
    });
    tip.value = '岗位发布成功，求职者将实时看到新岗位';
  } catch (error) {
    tip.value = error.response?.data?.message || '岗位发布失败';
  }
}

function pickCityFromAddress(address) {
  const text = String(address || '').trim();
  if (!text) {
    return '';
  }
  const hit = cityOptions.find((city) => text.includes(city));
  return hit || '';
}

async function fillFromProfile(force = false) {
  try {
    const { data } = await http.get('/profile/me');
    const profile = data?.profile || {};

    if (!force && jobForm.company && jobForm.companyAddress && jobForm.companySize && jobForm.companyIntro) {
      return;
    }

    if (profile.company_name) {
      jobForm.company = profile.company_name;
    }
    if (profile.company_address) {
      jobForm.companyAddress = profile.company_address;
      const city = pickCityFromAddress(profile.company_address);
      if (city) {
        jobForm.city = city;
      }
    }
    if (profile.company_size) {
      jobForm.companySize = profile.company_size;
    }
    if (profile.company_intro) {
      jobForm.companyIntro = profile.company_intro;
    }

    if (profile.company_name || profile.company_address || profile.company_size || profile.company_intro) {
      tip.value = '已从个人信息预填公司资料';
    }
  } catch (error) {
    if (force) {
      tip.value = '读取个人信息失败，请稍后重试';
    }
  }
}

onMounted(async () => {
  await loadCategories();
  fillFromProfile(false);
});
</script>

<style scoped>
.tip {
  margin-top: 8px;
  color: #1d4ed8;
}
</style>
