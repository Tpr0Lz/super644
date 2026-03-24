<template>
  <header class="topbar-wrap">
    <el-card shadow="never" class="top-shell">
      <div class="topbar">
        <div>
          <h1>Offer100 就业服务平台</h1>
          <p>仿 BOSS 模式：同账号可切换招聘人 / 求职者身份</p>
        </div>
        <div class="actions">
          <el-tag type="info" size="large">{{ username }}</el-tag>
          <el-select
            :model-value="activeIdentity"
            class="identity-select"
            @change="$emit('switch-identity', $event)"
          >
            <el-option v-for="item in identities" :key="item" :label="labelMap[item] || item" :value="item" />
          </el-select>
          <el-button type="primary" @click="$emit('logout')">退出登录</el-button>
        </div>
      </div>

      <el-menu :default-active="activeMenu" mode="horizontal" router class="top-nav-menu">
        <el-menu-item index="/">{{ homeLabel }}</el-menu-item>
        <el-menu-item index="/profile">个人信息</el-menu-item>
        <el-menu-item index="/identity-register">注册身份</el-menu-item>
        <el-menu-item index="/chat">聊天消息</el-menu-item>
      </el-menu>
    </el-card>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps({
  username: {
    type: String,
    default: ''
  },
  activeIdentity: {
    type: String,
    default: 'jobseeker'
  },
  identities: {
    type: Array,
    default: () => []
  }
});

const route = useRoute();
const homeLabel = computed(() => (props.activeIdentity === 'recruiter' ? '招聘' : '职位'));
const activeMenu = computed(() => {
  if (route.path.startsWith('/profile')) return '/profile';
  if (route.path.startsWith('/identity-register')) return '/identity-register';
  if (route.path.startsWith('/chat')) return '/chat';
  return '/';
});

const labelMap = {
  recruiter: '招聘人',
  jobseeker: '求职者'
};
</script>

<style scoped>
.topbar-wrap {
  margin-bottom: 16px;
}

.top-shell {
  border-radius: 14px;
  background: #fdfefe;
}

.identity-select {
  width: 110px;
}

.top-nav-menu {
  margin-top: 10px;
  border-bottom: none;
}
</style>
