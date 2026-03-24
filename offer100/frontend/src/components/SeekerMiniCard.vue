<template>
  <el-card shadow="hover" class="seeker-card">
    <router-link :to="`/seekers/${seeker.userId}`" class="link">
      <div class="head">
        <el-avatar :size="42" :src="seeker.avatarUrl || ''">{{ (seeker.fullName || seeker.username || 'U').slice(0, 1) }}</el-avatar>
        <div>
          <h3>{{ seeker.fullName || seeker.username }}</h3>
          <p class="meta">{{ seeker.gender || '-' }} | {{ seeker.age || '-' }}岁</p>
        </div>
      </div>
      <p class="line">优势：{{ seeker.strengths || '未填写' }}</p>
      <p class="line">期望岗位：{{ seeker.expectedPosition || '未填写' }}</p>
      <p class="line" v-if="showExperience">经历：{{ seeker.experience || seeker.internshipExperience || '未填写' }}</p>
      <slot />
    </router-link>
  </el-card>
</template>

<script setup>
defineProps({
  seeker: {
    type: Object,
    required: true
  },
  showExperience: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.seeker-card {
  border-radius: 12px;
}

.link {
  display: block;
  text-decoration: none;
  color: #1f3f75;
  padding: 14px;
}

.head {
  display: flex;
  gap: 10px;
  align-items: center;
}

h3 {
  margin: 0;
}

.meta,
.line {
  margin: 6px 0 0;
  font-size: 14px;
}
</style>
