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
            v-if="activeIdentity !== 'admin'"
            :model-value="activeIdentity"
            class="identity-select"
            @change="$emit('switch-identity', $event)"
          >
            <el-option v-for="item in identities" :key="item" :label="labelMap[item] || item" :value="item" />
          </el-select>
          <el-tag v-else type="danger" size="large" style="margin-right: 12px; margin-left: 12px;">超级管理员</el-tag>
          <el-button type="primary" @click="$emit('logout')">退出登录</el-button>
        </div>
      </div>

      <el-menu :default-active="activeMenu" mode="horizontal" router class="top-nav-menu">
        <el-menu-item v-if="activeIdentity !== 'admin'" index="/">{{ homeLabel }}</el-menu-item>
        <el-menu-item v-if="activeIdentity !== 'admin'" index="/ai">超级644AI</el-menu-item>
        <el-menu-item v-if="activeIdentity !== 'admin'" index="/profile">个人信息</el-menu-item>
        <el-menu-item v-if="activeIdentity !== 'admin'" index="/identity-register">注册身份</el-menu-item>
        <el-menu-item v-if="authStore.user?.username === 'adm'" index="/admin"> 管理员后台</el-menu-item>
        <el-menu-item v-if="authStore.user?.username === 'adm'" index="/admin-jobs">岗位列表</el-menu-item>
        <el-menu-item v-if="authStore.user?.username === 'adm'" index="/admin-seekers">求职者列表</el-menu-item>
        <el-menu-item index="/chat">
          <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99" type="danger">
            <span>聊天消息</span>
          </el-badge>
        </el-menu-item>
      </el-menu>
    </el-card>
  </header>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { io } from 'socket.io-client';
import http from '../api/http';
import { useAuthStore } from '../stores/auth';

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
const authStore = useAuthStore();
const unreadCount = ref(0);
let socket;

async function loadUnreadSummary() {
  // 更加严格的判断：必须有 token 且长度大于 10（排除掉 'undefined' 或 'null' 字符串）
  if (!authStore.token || authStore.token.length < 10) {
    unreadCount.value = 0;
    return;
  }
  try {
    const { data } = await http.get('/chat/unread-summary');
    unreadCount.value = Number(data?.unreadCount || 0);
  } catch (error) {
    // 如果报错 401，说明 token 无效，静默处理不再报错
    unreadCount.value = 0;
  }
}
const homeLabel = computed(() => {
  if (props.activeIdentity === 'admin') return '系统浏览';
  return props.activeIdentity === 'recruiter' ? '招聘' : '职位';
});
const activeMenu = computed(() => {
  if (route.path.startsWith('/chat')) return '/chat';
  if (route.path.startsWith('/admin-seekers')) return '/admin-seekers';
  if (route.path.startsWith('/admin-jobs')) return '/admin-jobs';
  if (route.path.startsWith('/admin')) return '/admin';
  if (route.path.startsWith('/ai')) return '/ai';
  if (route.path.startsWith('/profile')) return '/profile';
  if (route.path.startsWith('/identity-register')) return '/identity-register';
  return '/';
});

const labelMap = {
  recruiter: '招聘人',
  jobseeker: '求职者',
  admin: '管理员'
};;

onMounted(async () => {
  // 只有明确登录了才去加载消息和启动 socket
  if (authStore.token && authStore.token.length > 10) {
    await loadUnreadSummary();
    socket = io('http://localhost:3001');
    socket.on('recruitment:update', async (event) => {
      if (event?.type === 'chat_message' || event?.type === 'chat_read') {
        await loadUnreadSummary();
      }
    });
  } else {
    console.log("当前处于测试模式（未登录），已跳过权限接口请求");
  }
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
  }
});
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
















