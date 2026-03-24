<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.username"
      :active-identity="authStore.activeIdentity"
      :identities="authStore.identities"
      @switch-identity="switchIdentity"
      @logout="logout"
    />

    <el-card class="panel chat-panel" shadow="never">
      <h2>在线对话</h2>

      <div class="chat-wrap">
        <aside class="chat-users">
          <el-button
            v-for="u in contacts"
            :key="u.id"
            class="chat-user"
            :type="u.id === activeContactId ? 'primary' : 'default'"
            plain
            @click="selectContact(u.id)"
          >
            <el-avatar v-if="u.avatarUrl" :src="u.avatarUrl" :size="26" />
            <el-avatar v-else :size="26">{{ (u.nickname || u.username || '?').slice(0, 1) }}</el-avatar>
            <span>{{ u.nickname || u.username }}</span>
          </el-button>
          <el-empty v-if="contacts.length === 0" description="暂无联系人" :image-size="70" />
        </aside>

        <div class="chat-main">
          <div class="chat-list">
            <el-empty v-if="messages.length === 0" description="暂无消息，开始沟通吧" :image-size="80" />
            <el-card v-for="msg in messages" :key="msg.id" class="chat-msg" shadow="never">
              <strong>{{ msg.from_user_id === authStore.user?.id ? '我' : '对方' }}:</strong>
              <template v-if="msg.message_type === 'application_card' || msg.message_type === 'invitation_card'">
                <p>{{ msg.content }}</p>
                <div class="card-msg" v-if="safePayload(msg)">
                  <p><strong>{{ safePayload(msg).title }}</strong></p>
                  <p v-if="safePayload(msg).job">
                    岗位：{{ safePayload(msg).job.title }} | {{ safePayload(msg).job.company }} | {{ safePayload(msg).job.city }}
                  </p>
                  <p v-if="safePayload(msg).seeker">
                    求职者：{{ safePayload(msg).seeker.fullName }}，优势：{{ safePayload(msg).seeker.strengths }}
                  </p>
                </div>
              </template>
              <template v-else>
                {{ msg.content }}
              </template>
            </el-card>
          </div>

          <el-form class="chat-form" @submit.prevent>
            <el-input
              v-model.trim="messageText"
              placeholder="输入消息..."
              clearable
              @keyup.enter="sendMessage"
            />
            <el-button type="primary" :disabled="!activeContactId || !messageText" @click="sendMessage">发送</el-button>
          </el-form>
        </div>
      </div>
    </el-card>
  </main>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import http from '../api/http';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const contacts = ref([]);
const messages = ref([]);
const activeContactId = ref(0);
const messageText = ref('');

let socket;

async function loadContacts() {
  const { data } = await http.get('/chat/contacts');
  contacts.value = data;

  const routeContactId = Number(route.query.with || 0);
  if (routeContactId && data.some((item) => item.id === routeContactId)) {
    activeContactId.value = routeContactId;
    await loadMessages();
    return;
  }

  if (!activeContactId.value && data.length > 0) {
    activeContactId.value = data[0].id;
    await loadMessages();
  }
}

async function loadMessages() {
  if (!activeContactId.value) return;
  const { data } = await http.get(`/chat/messages/${activeContactId.value}`);
  messages.value = data;
}

async function sendMessage() {
  if (!activeContactId.value || !messageText.value) return;
  const text = messageText.value;
  messageText.value = '';
  try {
    await http.post('/chat/messages', {
      toUserId: activeContactId.value,
      content: text
    });
    await loadMessages();
  } catch (error) {
    messageText.value = text;
  }
}

async function selectContact(userId) {
  activeContactId.value = userId;
  await loadMessages();
}

async function switchIdentity(identity) {
  authStore.setActiveIdentity(identity);
}

function safePayload(message) {
  if (!message.payload_json) {
    return null;
  }
  try {
    return JSON.parse(message.payload_json);
  } catch (error) {
    return null;
  }
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  await loadContacts();

  socket = io('http://localhost:3001');
  socket.on('recruitment:update', async (event) => {
    if (event.type === 'chat_message') {
      const msg = event.payload;
      if (
        msg.from_user_id === activeContactId.value ||
        msg.to_user_id === activeContactId.value
      ) {
        await loadMessages();
      }
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
.chat-panel h2 {
  margin-top: 0;
}

.chat-wrap {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 12px;
}

.chat-users {
  border: 1px solid #e5ebf5;
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 8px;
  align-content: start;
}

.chat-user {
  justify-content: flex-start;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-main {
  border: 1px solid #e5ebf5;
  border-radius: 10px;
  padding: 10px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 10px;
}

.chat-list {
  min-height: 200px;
  max-height: 420px;
  overflow: auto;
  display: grid;
  gap: 8px;
  align-content: start;
}

.chat-msg {
  border: 1px solid #e9effc;
}

.chat-msg strong {
  color: #1d4c95;
  margin-right: 4px;
}

.card-msg {
  margin-top: 6px;
  padding: 8px;
  border-radius: 8px;
  background: #ebf4ff;
  border: 1px solid #bfd5ff;
}

.chat-form {
  display: grid;
  grid-template-columns: 1fr 90px;
  gap: 10px;
}
</style>
