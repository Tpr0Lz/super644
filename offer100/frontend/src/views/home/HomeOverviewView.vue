<template>
  <el-card class="panel" shadow="never">
    <h2>{{ isRecruiter ? '招聘总览' : '职位总览' }}</h2>
    <el-alert :title="`当前身份：${isRecruiter ? '招聘者' : '求职者'}`" type="info" :closable="false" show-icon />

    <template v-if="isRecruiter">
      <h3>求职者组件卡片（点击查看详情）</h3>
      <p class="filter-tip">招聘者关键词搜索范围：个人优势 + 期望岗位</p>
      <el-form class="search-bar">
        <el-row :gutter="12">
          <el-col :xs="24" :sm="12">
            <el-form-item label="关键词">
              <el-input
                v-model.trim="seekerKeyword"
                placeholder="搜索个人优势 / 期望岗位"
                clearable
                @change="loadData"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="求职类型">
              <el-select v-model="seekerJobTypeFilter" style="width: 100%" @change="loadData">
                <el-option v-for="opt in seekerJobTypeOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="薪资待遇">
              <el-select v-model="seekerSalaryFilter" style="width: 100%" @change="loadData">
                <el-option v-for="opt in seekerSalaryOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="学历要求">
              <el-select v-model="seekerDegreeFilter" style="width: 100%" @change="loadData">
                <el-option v-for="opt in seekerDegreeOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="工作经验">
              <el-select v-model="seekerWorkExperienceFilter" style="width: 100%" @change="loadData">
                <el-option v-for="opt in seekerWorkExperienceOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="个人所在地">
              <el-select v-model="seekerLocationFilter" style="width: 100%" @change="loadData">
                <el-option v-for="opt in seekerLocationOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="求职状态">
              <el-select v-model="seekerStatusFilter" style="width: 100%" @change="loadData">
                <el-option v-for="opt in seekerStatusOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item>
              <el-button @click="resetSeekerFilters">重置</el-button>
            </el-form-item>
          </el-col>
        </el-row>
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
      <p class="filter-tip">求职者关键词搜索范围：岗位名称 + 公司名称 + 公司位置 + 公司详细地址</p>
      <el-form class="search-bar">
        <el-row :gutter="12">
          <el-col :xs="24" :sm="12">
            <el-form-item label="关键词">
              <el-input
                v-model.trim="keyword"
                placeholder="搜索岗位名称/公司名称/公司位置/详细地址"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="求职类型">
              <el-select v-model="jobTypeFilter" style="width: 100%">
                <el-option v-for="opt in jobTypeOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="薪资待遇">
              <el-select v-model="salaryFilter" style="width: 100%">
                <el-option v-for="opt in salaryOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="学历要求">
              <el-select v-model="educationFilter" style="width: 100%">
                <el-option v-for="opt in educationOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="工作经验">
              <el-select v-model="experienceFilter" style="width: 100%">
                <el-option v-for="opt in experienceOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="公司位置">
              <el-select v-model="cityFilter" style="width: 100%">
                <el-option v-for="opt in cityOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="公司规模">
              <el-select v-model="companySizeFilter" style="width: 100%">
                <el-option v-for="opt in companySizeOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="外层分类">
              <el-select v-model="categoryL1Filter" clearable placeholder="外层分类" style="width: 100%">
                <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="内层岗位">
              <el-select v-model="categoryL2Filter" clearable placeholder="内层岗位" style="width: 100%">
                <el-option v-for="opt in categoryL2Options" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item>
              <el-button @click="resetJobFilters">重置</el-button>
            </el-form-item>
          </el-col>
        </el-row>
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import http from '../../api/http';
import JobMiniCard from '../../components/JobMiniCard.vue';
import SeekerMiniCard from '../../components/SeekerMiniCard.vue';
import { useAuthStore } from '../../stores/auth';
import { JOB_CATEGORY_TREE, loadCategories } from '../../constants/jobCategories';

const router = useRouter();
const authStore = useAuthStore();

const seekerCards = ref([]);
const jobCards = ref([]);
const tip = ref('');
const keyword = ref('');
const jobTypeFilter = ref('不限');
const salaryFilter = ref('不限');
const educationFilter = ref('不限');
const experienceFilter = ref('不限');
const cityFilter = ref('不限');
const companySizeFilter = ref('不限');
const categoryL1Filter = ref('');
const categoryL2Filter = ref('');
const seekerKeyword = ref('');
const seekerJobTypeFilter = ref('不限');
const seekerSalaryFilter = ref('不限');
const seekerDegreeFilter = ref('不限');
const seekerWorkExperienceFilter = ref('不限');
const seekerLocationFilter = ref('不限');
const seekerStatusFilter = ref('不限');
const isRecruiter = computed(() => authStore.activeIdentity === 'recruiter');
const jobTypeOptions = ['不限', '全职', '实习', '兼职'];
const salaryOptions = ['不限', '3k以下', '3-5k', '5-10k', '10-20k', '20k以上'];
const educationOptions = ['不限', '高中', '大专', '本科', '博士', '硕士'];
const experienceOptions = ['不限', '在校生', '应届生', '1年以内', '1-3年', '3-5年', '5-10年', '10年以上'];
const cityOptions = ['不限', '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆', '武汉', '西安'];
const companySizeOptions = ['不限', '0-20人', '20-100人', '100-200人', '200-500人', '500-1000人', '1000人以上'];
const seekerJobTypeOptions = ['不限', '全职', '实习', '兼职'];
const seekerSalaryOptions = ['不限', '3k以下', '3-5k', '5-10k', '10-20k', '20k以上'];
const seekerDegreeOptions = ['不限', '高中', '大专', '本科', '博士', '硕士'];
const seekerWorkExperienceOptions = ['不限', '在校生', '应届生', '1年以内', '1-3年', '3-5年', '5-10年', '10年以上'];
const seekerLocationOptions = ['不限', '其他', '北京市', '天津市', '上海市', '重庆市', '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省', '海南省', '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区', '香港特别行政区', '澳门特别行政区'];
const seekerStatusOptions = ['不限', '暂不考虑', '考虑机会', '月内到岗', '随时到岗'];
const categoryOptions = JOB_CATEGORY_TREE;
const categoryL2Options = computed(() => {
  if (!categoryL1Filter.value) {
    return JOB_CATEGORY_TREE.value.flatMap((item) => item.children);
  }
  const item = JOB_CATEGORY_TREE.value.find((entry) => entry.value === categoryL1Filter.value);
  return item?.children || [];
});

const filteredJobCards = computed(() => {
  const key = keyword.value.toLowerCase();
  return jobCards.value.filter((job) => {
    const jobTypeMatch =
      jobTypeFilter.value === '不限' ||
      (job.employmentType || '不限') === jobTypeFilter.value;

    const educationMatch =
      educationFilter.value === '不限' ||
      (job.educationRequirement || '不限') === educationFilter.value;

    const experienceMatch =
      experienceFilter.value === '不限' ||
      (job.experienceRequirement || '不限') === experienceFilter.value;

    const cityMatch = cityFilter.value === '不限' || (job.city || '') === cityFilter.value;

    const companySizeMatch =
      companySizeFilter.value === '不限' ||
      (job.companySize || '不限') === companySizeFilter.value;

    const salaryMatch = matchSalaryBand(job.salaryRange, salaryFilter.value);

    const categoryL1Match = !categoryL1Filter.value || job.categoryL1 === categoryL1Filter.value;
    const categoryL2Match = !categoryL2Filter.value || job.categoryL2 === categoryL2Filter.value;

    if (
      !jobTypeMatch ||
      !salaryMatch ||
      !educationMatch ||
      !experienceMatch ||
      !cityMatch ||
      !companySizeMatch ||
      !categoryL1Match ||
      !categoryL2Match
    ) {
      return false;
    }

    if (!key) {
      return true;
    }

    const haystack = [
      job.title,
      job.company,
      job.city,
      job.companyAddress
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(key);
  });
});

function parseSalaryKRange(text) {
  const raw = String(text || '').toLowerCase().replace(/\s+/g, '');
  if (!raw) {
    return { min: null, max: null };
  }

  const nums = Array.from(raw.matchAll(/\d+(?:\.\d+)?/g)).map((item) => Number(item[0]));
  if (nums.length === 0) {
    return { min: null, max: null };
  }

  const hasW = raw.includes('w');
  const hasK = raw.includes('k');
  const factor = hasW ? 10 : hasK ? 1 : 1;
  const normalized = nums.map((n) => n * factor);
  if (normalized.length === 1) {
    return { min: normalized[0], max: normalized[0] };
  }

  return {
    min: Math.min(...normalized),
    max: Math.max(...normalized)
  };
}

function matchSalaryBand(salaryRange, band) {
  if (!band || band === '不限') {
    return true;
  }

  const { min, max } = parseSalaryKRange(salaryRange);
  if (min === null && max === null) {
    return false;
  }

  const lower = min ?? max;
  const upper = max ?? min;

  if (band === '3k以下') {
    return lower < 3;
  }
  if (band === '3-5k') {
    return upper >= 3 && lower <= 5;
  }
  if (band === '5-10k') {
    return upper >= 5 && lower <= 10;
  }
  if (band === '10-20k') {
    return upper >= 10 && lower <= 20;
  }
  if (band === '20k以上') {
    return upper > 20 || lower >= 20;
  }

  return true;
}

let socket;

function isCurrentUser(userId) {
  if (!authStore.user?.id || !userId) {
    return false;
  }
  return String(userId) === String(authStore.user.id);
}

async function loadData() {
  if (isRecruiter.value) {
    const params = {};
    if (seekerKeyword.value) {
      params.keyword = seekerKeyword.value;
    }
    if (seekerJobTypeFilter.value && seekerJobTypeFilter.value !== '不限') {
      params.expectedJobType = seekerJobTypeFilter.value;
    }
    if (seekerSalaryFilter.value && seekerSalaryFilter.value !== '不限') {
      params.expectedSalary = seekerSalaryFilter.value;
    }
    if (seekerDegreeFilter.value && seekerDegreeFilter.value !== '不限') {
      params.degree = seekerDegreeFilter.value;
    }
    if (seekerWorkExperienceFilter.value && seekerWorkExperienceFilter.value !== '不限') {
      params.workExperience = seekerWorkExperienceFilter.value;
    }
    if (seekerLocationFilter.value && seekerLocationFilter.value !== '不限') {
      params.location = seekerLocationFilter.value;
    }
    if (seekerStatusFilter.value && seekerStatusFilter.value !== '不限') {
      params.jobHuntingStatus = seekerStatusFilter.value;
    }

    const seekersRes = await http.get('/resume/seekers', { params });

    const data = seekersRes.data;
    seekerCards.value = (Array.isArray(data) ? data : []).filter((seeker) => !isCurrentUser(seeker.userId));
    jobCards.value = [];
    return;
  }

  const jobsRes = await http.get('/jobs');

  const data = jobsRes.data;
  jobCards.value = (Array.isArray(data) ? data : []).filter((job) => !isCurrentUser(job.recruiterUserId));
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

async function resetSeekerFilters() {
  seekerKeyword.value = '';
  seekerJobTypeFilter.value = '不限';
  seekerSalaryFilter.value = '不限';
  seekerDegreeFilter.value = '不限';
  seekerWorkExperienceFilter.value = '不限';
  seekerLocationFilter.value = '不限';
  seekerStatusFilter.value = '不限';
  await loadData();
}

function resetJobFilters() {
  keyword.value = '';
  jobTypeFilter.value = '不限';
  salaryFilter.value = '不限';
  educationFilter.value = '不限';
  experienceFilter.value = '不限';
  cityFilter.value = '不限';
  companySizeFilter.value = '不限';
  categoryL1Filter.value = '';
  categoryL2Filter.value = '';
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

    if ((event.type === 'seeker_profile_ready' || event.type === 'seeker_profile_updated') && isRecruiter.value) {
      await loadData();
    }
  });
});

watch(
  () => authStore.activeIdentity,
  async () => {
    tip.value = '';
    await loadData();
  }
);

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

.filter-tip {
  margin: 8px 0 0;
  color: #5c78a5;
  font-size: 13px;
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
