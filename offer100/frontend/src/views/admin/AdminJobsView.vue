<template>
  <el-card class="panel" shadow="never">
    <h2>所有岗位总览</h2>
    <el-alert title="当前身份：超级管理员" type="info" :closable="false" show-icon />

    <h3>岗位组件卡片（点击查看详情）</h3>
    <el-row :gutter="12" class="component-grid">
      <el-col v-for="job in jobCards" :key="job.id" :xs="24" :sm="12" :lg="8">
        <JobMiniCard :job="job" :show-description="true" />
      </el-col>
    </el-row>
    <el-empty v-if="jobCards.length === 0" description="没有匹配的岗位" />
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import http from '../../api/http';
import JobMiniCard from '../../components/JobMiniCard.vue';

const jobCards = ref([]);

async function loadData() {
  try {
    const { data } = await http.get('/jobs', {
      params: { 
        page: 1, 
        limit: 100 
      }
    });
    jobCards.value = data.items || data || [];
  } catch (error) {
    console.error(error);
  }
}

onMounted(() => {
  loadData();
});
</script>