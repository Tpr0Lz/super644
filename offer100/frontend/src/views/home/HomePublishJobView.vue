<template>
  <el-card class="panel" shadow="never">
    <h2>发布岗位</h2>
    <el-alert title="该页面与招聘总览解耦，专用于岗位发布" type="info" :closable="false" show-icon />

    <el-form label-width="90px" class="job-form" @submit.prevent>
      <el-form-item label="岗位名称" required>
        <el-input v-model.trim="jobForm.title" placeholder="如：前端开发工程师" />
      </el-form-item>
      <el-form-item label="公司名称" required>
        <el-input v-model.trim="jobForm.company" placeholder="如：CampusTech" />
      </el-form-item>
      <el-form-item label="工作城市" required>
        <el-input v-model.trim="jobForm.city" placeholder="如：上海" />
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
        <el-input v-model.trim="jobForm.salaryRange" placeholder="如：12k-18k" />
      </el-form-item>
      <el-form-item label="学历要求" required>
        <el-select v-model="jobForm.educationRequirement" placeholder="请选择学历要求">
          <el-option label="本科" value="本科" />
          <el-option label="双一流" value="双一流" />
          <el-option label="专科" value="专科" />
          <el-option label="无限制" value="无限制" />
        </el-select>
      </el-form-item>
      <el-form-item label="岗位标签" required>
        <el-input v-model.trim="jobForm.tags" placeholder="如：vue,javascript,frontend" />
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
import { computed, reactive, ref } from 'vue';
import http from '../../api/http';
import { JOB_CATEGORY_TREE } from '../../constants/jobCategories';

const tip = ref('');
const categoryOptions = JOB_CATEGORY_TREE;

const jobForm = reactive({
  title: '前端开发工程师',
  company: 'CampusTech',
  city: '上海',
  categoryL1: '互联网 / AI',
  categoryL2: '前端开发（Vue / React）',
  salaryRange: '12k-18k',
  educationRequirement: '本科',
  tags: 'vue,javascript,frontend',
  description: '负责企业级 Web 前端开发。'
});

const subCategoryOptions = computed(() => {
  const target = JOB_CATEGORY_TREE.find((item) => item.value === jobForm.categoryL1);
  return target?.children || [];
});

function onCategoryL1Change(value) {
  const target = JOB_CATEGORY_TREE.find((item) => item.value === value);
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
</script>

<style scoped>
.tip {
  margin-top: 8px;
  color: #1d4ed8;
}
</style>
