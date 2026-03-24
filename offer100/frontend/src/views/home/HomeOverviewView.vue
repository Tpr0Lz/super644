<template>
  <el-card class="panel" shadow="never">
    <h2>{{ isRecruiter ? '招聘总览' : '职位总览' }}</h2>
    <el-alert :title="`当前身份：${isRecruiter ? '招聘者' : '求职者'}`" type="info" :closable="false" show-icon />

    <template v-if="isRecruiter">
      <h3>求职者组件卡片（点击查看详情）</h3>
      <el-form :inline="true" class="search-bar">
        <el-form-item>
          <el-input
            v-model.trim="seekerKeyword"
            placeholder="搜索优势关键词（如：沟通、执行力）"
            clearable
            style="width: 260px"
            @change="loadData"
          />
        </el-form-item>
        <el-form-item>
          <el-select
            v-model="seekerJobTag"
            clearable
            placeholder="按岗位标签筛选"
            style="width: 220px"
            @change="loadData"
          >
            <el-option v-for="item in seekerTagOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-row :gutter="12" class="component-grid">
        <el-col v-for="seeker in seekerCards" :key="seeker.userId" :xs="24" :sm="12" :lg="8">
          <SeekerMiniCard :seeker="seeker" :show-experience="true" />
          <div class="card-actions">
            <el-button size="small" @click="chatWithSeeker(seeker.userId)">聊天</el-button>
            <el-button size="small" type="primary" @click="goInvite(seeker.userId)">邀请</el-button>
          </div>
        </el-col>
      </el-row>
      <el-empty v-if="seekerCards.length === 0" description="暂无已完善个人信息的求职者" />
    </template>

    <template v-else>
      <h3>岗位组件卡片（点击查看详情）</h3>
      <el-form :inline="true" class="search-bar">
        <el-form-item>
          <el-input
            v-model.trim="keyword"
            placeholder="搜索岗位名/公司/标签"
            clearable
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-select v-model="educationFilter" style="width: 160px">
            <el-option v-for="opt in educationOptions" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="categoryL1Filter" clearable placeholder="外层分类" style="width: 170px">
            <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="categoryL2Filter" clearable placeholder="内层岗位" style="width: 220px">
            <el-option v-for="opt in categoryL2Options" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="jobTagFilter" clearable placeholder="岗位标签" style="width: 160px">
            <el-option v-for="opt in jobTagOptions" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-row :gutter="12" class="component-grid">
        <el-col v-for="job in filteredJobCards" :key="job.id" :xs="24" :sm="12" :lg="8">
          <JobMiniCard :job="job" :show-description="true" />
          <div class="card-actions">
            <el-button type="primary" size="small" @click="applyJob(job.id)">立即投递</el-button>
            <el-button size="small" @click="chatWithRecruiter(job.recruiterUserId)" :disabled="!job.recruiterUserId">聊天</el-button>
          </div>
        </el-col>
      </el-row>
      <el-empty v-if="filteredJobCards.length === 0" description="没有匹配的岗位，请调整筛选条件" />
    </template>

    <el-alert v-if="tip" :title="tip" type="success" :closable="false" show-icon class="tip" />
  </el-card>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import http from '../../api/http';
import JobMiniCard from '../../components/JobMiniCard.vue';
import SeekerMiniCard from '../../components/SeekerMiniCard.vue';
import { useAuthStore } from '../../stores/auth';
import { JOB_CATEGORY_TREE } from '../../constants/jobCategories';

const router = useRouter();
const authStore = useAuthStore();

const seekerCards = ref([]);
const jobCards = ref([]);
const tip = ref('');
const keyword = ref('');
const educationFilter = ref('全部学历');
const categoryL1Filter = ref('');
const categoryL2Filter = ref('');
const jobTagFilter = ref('');
const seekerKeyword = ref('');
const seekerJobTag = ref('');
const seekerTagOptions = ref([]);
const jobTagOptions = ref([]);
const isRecruiter = computed(() => authStore.activeIdentity === 'recruiter');
const educationOptions = ['全部学历', '本科', '双一流', '专科', '无限制'];
const categoryOptions = JOB_CATEGORY_TREE;
const categoryL2Options = computed(() => {
  if (!categoryL1Filter.value) {
    return JOB_CATEGORY_TREE.flatMap((item) => item.children);
  }
  const item = JOB_CATEGORY_TREE.find((entry) => entry.value === categoryL1Filter.value);
  return item?.children || [];
});

const filteredJobCards = computed(() => {
  const key = keyword.value.toLowerCase();
  return jobCards.value.filter((job) => {
    const educationMatch =
      educationFilter.value === '全部学历' ||
      (job.educationRequirement || '无限制') === educationFilter.value;

    const categoryL1Match = !categoryL1Filter.value || job.categoryL1 === categoryL1Filter.value;
    const categoryL2Match = !categoryL2Filter.value || job.categoryL2 === categoryL2Filter.value;
    const tagMatch = !jobTagFilter.value
      || (Array.isArray(job.tags) && job.tags.includes(jobTagFilter.value));

    if (!educationMatch || !categoryL1Match || !categoryL2Match || !tagMatch) {
      return false;
    }

    if (!key) {
      return true;
    }

    const haystack = [
      job.title,
      job.company,
      job.city,
      job.description,
      ...(Array.isArray(job.tags) ? job.tags : [])
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(key);
  });
});

let socket;

async function loadData() {
  if (isRecruiter.value) {
    const params = {};
    if (seekerKeyword.value) {
      params.keyword = seekerKeyword.value;
    }
    if (seekerJobTag.value) {
      params.jobTag = seekerJobTag.value;
    }

    const [seekersRes, tagsRes] = await Promise.all([
      http.get('/resume/seekers', { params }),
      http.get('/resume/job-tags')
    ]);

    const data = seekersRes.data;
    seekerCards.value = data;
    seekerTagOptions.value = Array.isArray(tagsRes.data) ? tagsRes.data : [];
    jobCards.value = [];
    return;
  }

  const [jobsRes, tagsRes] = await Promise.all([
    http.get('/jobs'),
    http.get('/jobs/tags')
  ]);

  const data = jobsRes.data;
  jobCards.value = data;
  jobTagOptions.value = Array.isArray(tagsRes.data) ? tagsRes.data : [];
  seekerCards.value = [];
}

async function applyJob(jobId) {
  try {
    await http.post(`/jobs/${jobId}/apply`);
    tip.value = '投递成功，已发送个人信息组件与常用语';
  } catch (error) {
    tip.value = error.response?.data?.message || '投递失败';
  }
}

function chatWithSeeker(userId) {
  router.push(`/chat?with=${userId}`);
}

function goInvite(userId) {
  router.push(`/seekers/${userId}`);
}

function chatWithRecruiter(userId) {
  if (!userId) {
    return;
  }
  router.push(`/chat?with=${userId}`);
}

onMounted(async () => {
  await loadData();

  socket = io('http://localhost:3001');
  socket.on('recruitment:update', async (event) => {
    if (!event?.type) {
      return;
    }

    if (event.type === 'job_created' && !isRecruiter.value) {
      await loadData();
      return;
    }

    if (event.type === 'seeker_profile_ready' && isRecruiter.value) {
      await loadData();
    }
  });
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
  }
});
</script>

<style scoped>
.component-grid {
  margin-top: 10px;
}

.search-bar {
  margin-top: 8px;
}

.tip {
  margin-top: 12px;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.mini-link {
  text-decoration: none;
}
</style>
