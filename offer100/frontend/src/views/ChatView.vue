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
          <div
            v-for="u in contacts"
            :key="u.id"
            class="contact-item"
            :class="{ active: u.id === activeContactId }"
          >
            <el-button
              class="chat-user"
              type="default"
              plain
              @click="selectContact(u.id)"
            >
              <el-avatar :src="u.avatarUrl || DEFAULT_AVATAR" :size="26" />
              <span>
                {{ u.nickname || u.username }}
                <el-tag v-if="u.username === 'adm'" type="danger" size="small" style="margin-left: 4px;">管理员</el-tag>
              </span>
              <el-badge
                v-if="u.unreadCount > 0"
                :value="u.unreadCount"
                type="danger"
                class="contact-badge"
              />
            </el-button>
            <div class="contact-actions">
              <el-button
                v-if="u.isPinned"
                icon="Unlock"
                size="small"
                type="text"
                @click.stop="unpinContact(u.id)"
                title="取消置顶"
              />
              <el-button
                v-else
                icon="Pin"
                size="small"
                type="text"
                @click.stop="pinContact(u.id)"
                title="置顶"
              />
              <el-button
                icon="Delete"
                size="small"
                type="text"
                @click.stop="deleteContact(u.id)"
                title="删除聊天"
              />
            </div>
          </div>
          <el-empty v-if="contacts.length === 0" description="暂无历史消息，聊天界面默认空白" :image-size="70" />
        </aside>

        <div class="chat-main">
          <el-empty
            v-if="!activeContactId"
            description="暂无会话，请先通过投递/邀请/互发消息建立联系"
            :image-size="90"
          />
          <div v-else ref="chatListRef" class="chat-list">
            <el-empty v-if="messages.length === 0" description="暂无消息，开始沟通吧" :image-size="80" />
            <div v-for="msg in messages" :key="msg.id">
              <div v-if="msg.message_type === 'ai_match_card'" class="ai-match-container">
                <el-card shadow="never" class="ai-match-card">
                  <div class="ai-match-header">
                    你与该职位的匹配分析
                  </div>
                  <div class="ai-match-body">
                    该岗位与该求职人的匹配度高达 <span class="highlight">{{ safePayload(msg).matchScore }}%</span><br/>
                    计算发现最适合该求职人的岗位为：<b>{{ safePayload(msg).bestJobName }}</b>
                  </div>
                  <div class="ai-match-footer">
                    <el-button type="primary" size="small" @click="$router.push('/jobs/' + safePayload(msg).bestJobId)">
                      查看详细分析
                    </el-button>
                  </div>
                </el-card>
              </div>
              <div
                v-else
                class="chat-msg"
                :class="{ mine: msg.from_user_id === authStore.user?.id }"
              >
                <el-avatar class="msg-avatar" :src="messageAvatar(msg)" :size="28" />
              <div class="msg-content">
                <div class="msg-name" :class="{ mine: msg.from_user_id === authStore.user?.id }">
                  {{ msg.from_user_id === authStore.user?.id ? '我' : activeContactName }}
                </div>
                <div class="msg-bubble">
                  <template v-if="msg.message_type === 'application_card' || msg.message_type === 'invitation_card'">
                    <p v-if="msg.content">{{ msg.content }}</p>
                    <button class="card-msg" v-if="safePayload(msg)" @click="openCardDetail(safePayload(msg), msg.message_type)">
                      <p><strong>{{ safePayload(msg).title }}</strong></p>
                      <p v-if="safePayload(msg).job">
                        岗位：{{ safePayload(msg).job.title }} | {{ safePayload(msg).job.company }} | {{ safePayload(msg).job.city }}
                      </p>
                      <p v-if="safePayload(msg).seeker">
                        求职者：{{ safePayload(msg).seeker.fullName }}，优势：{{ safePayload(msg).seeker.strengths }}
                      </p>
                      <p class="card-tip">点击查看详情</p>
                    </button>
                  </template>
                  <template v-else>
                    {{ msg.content }}
                  </template>
                </div>
                <div class="msg-time" :class="{ mine: msg.from_user_id === authStore.user?.id }">
                  {{ formatMessageTime(msg.created_at) }}
                </div>
              </div>
            </div>
            </div>
          </div>

          <el-form v-if="activeContactId" class="chat-form" @submit.prevent>
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
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
const chatListRef = ref(null);
const myAvatarUrl = ref('');
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="%23dbeafe"/><circle cx="40" cy="30" r="14" fill="%2393c5fd"/><path d="M16 66c4-12 14-18 24-18s20 6 24 18" fill="%2393c5fd"/></svg>';

let socket;

async function loadMyAvatar() {
  try {
    const { data } = await http.get('/profile/me');
    myAvatarUrl.value = data?.profile?.avatar_url || '';
  } catch (error) {
    myAvatarUrl.value = '';
  }
}

async function loadContacts() {
  const { data } = await http.get('/chat/contacts');
  contacts.value = Array.isArray(data)
    ? [...data].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
    : [];

  const routeContactId = Number(route.query.with || 0);
  if (routeContactId && contacts.value.some((item) => item.id === routeContactId)) {
    activeContactId.value = routeContactId;
    await loadMessages();
    return;
  }

  if (routeContactId && !contacts.value.some((item) => item.id === routeContactId)) {
    try {
      const { data: target } = await http.get(`/chat/users/${routeContactId}`);
      contacts.value = [target, ...contacts.value];
      activeContactId.value = routeContactId;
      await loadMessages();
      return;
    } catch (error) {
      // ignore invalid route target and keep empty state
    }
  }

  if (!activeContactId.value && contacts.value.length > 0) {
    activeContactId.value = contacts.value[0].id;
    await loadMessages();
    return;
  }

  if (!contacts.value.some((item) => item.id === activeContactId.value)) {
    activeContactId.value = 0;
    messages.value = [];
  }
}

async function scrollChatToBottom() {
  await nextTick();
  if (chatListRef.value) {
    chatListRef.value.scrollTop = chatListRef.value.scrollHeight;
  }
}

async function loadMessages() {
  if (!activeContactId.value) return;
  const { data } = await http.get(`/chat/messages/${activeContactId.value}`);
  messages.value = data;
  await scrollChatToBottom();
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
    await loadContacts();
  } catch (error) {
    messageText.value = text;
  }
}

async function selectContact(userId) {
  if (String(route.query.with || '') !== String(userId)) {
    await router.replace({ path: '/chat', query: { with: String(userId) } });
  }
  activeContactId.value = userId;
  await loadMessages();
}

async function pinContact(userId) {
  try {
    await http.post(`/chat/contacts/${userId}/pin`);
    await loadContacts();
  } catch (error) {
    console.error('Failed to pin contact', error);
  }
}

async function unpinContact(userId) {
  try {
    await http.post(`/chat/contacts/${userId}/unpin`);
    await loadContacts();
  } catch (error) {
    console.error('Failed to unpin contact', error);
  }
}

async function deleteContact(userId) {
  try {
    await http.post(`/chat/contacts/${userId}/delete`);
    if (activeContactId.value === userId) {
      activeContactId.value = 0;
      messages.value = [];
    }
    await loadContacts();
  } catch (error) {
    console.error('Failed to delete contact', error);
  }
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

function activeContact() {
  return contacts.value.find((item) => item.id === activeContactId.value) || null;
}

function messageAvatar(message) {
  if (message.from_user_id === authStore.user?.id) {
    return myAvatarUrl.value || DEFAULT_AVATAR;
  }
  return activeContact()?.avatarUrl || DEFAULT_AVATAR;
}

const activeContactName = computed(() => {
  const target = activeContact();
  return target?.nickname || target?.username || '对方';
});

function openCardDetail(payload, messageType) {
  if (!payload) {
    return;
  }

  if (messageType === 'application_card' && authStore.activeIdentity === 'recruiter' && payload.seeker?.userId) {
    router.push(`/seekers/${payload.seeker.userId}`);
    return;
  }

  if (payload.job?.id) {
    router.push(`/jobs/${payload.job.id}`);
  }
}

function formatMessageTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  await loadMyAvatar();
  try {
    await http.post('/chat/mark-all-read');
  } catch (error) {
    // ignore mark-all-read failure to keep chat usable
  }
  await loadContacts();

  socket = io('http://localhost:3001');
  socket.on('recruitment:update', async (event) => {
    if (event.type === 'chat_message' || event.type === 'chat_read') {
      const msg = event.payload;
      if (
        event.type === 'chat_read' ||
        msg?.from_user_id === activeContactId.value ||
        msg?.to_user_id === activeContactId.value
      ) {
        await loadMessages();
      }
      await loadContacts();
    }
  });
});

watch(
  () => route.query.with,
  async () => {
    await loadContacts();
  }
);

watch(
  () => authStore.activeIdentity,
  async () => {
    activeContactId.value = 0;
    messages.value = [];
    await loadMyAvatar();
    await loadContacts();
  }
);

watch(
  () => messages.value.length,
  async () => {
    await scrollChatToBottom();
  }
);

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
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chat-user {
  justify-content: flex-start;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
}

.contact-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.contact-item:hover .contact-actions {
  opacity: 1;
}

.contact-item.active .contact-actions {
  opacity: 1;
}

.chat-users :deep(.el-button + .el-button) {
  margin-left: 0 !important;
}

.chat-user.active {
  border-color: #7fb2ff;
  background: #edf5ff;
}

.contact-badge {
  margin-left: auto;
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
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.chat-msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.chat-msg.mine {
  flex-direction: row-reverse;
}

.msg-avatar {
  flex-shrink: 0;
}

.msg-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.msg-bubble {
  max-width: min(100%, 680px);
  padding: 8px 10px;
  border: 1px solid #e9effc;
  border-radius: 10px;
  background: #ffffff;
  color: #1f2937;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-msg.mine .msg-bubble {
  background: #edf5ff;
  border-color: #bfd5ff;
}

.msg-name {
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
  padding: 0 2px;
}

.msg-name.mine {
  text-align: right;
}

.msg-time {
  margin-top: 2px;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1;
  padding: 0 2px;
}

.msg-time.mine {
  text-align: right;
}

.card-msg {
  appearance: none;
  width: 100%;
  margin-top: 6px;
  padding: 8px;
  border-radius: 8px;
  background: #edfdf3;
  border: 1px solid #b8e8c8;
  text-align: left;
  cursor: pointer;
  color: #166534;
  line-height: 1.5;
  word-break: break-word;
  overflow: hidden;
}

.card-tip {
  margin: 6px 0 0;
  color: #15803d;
  font-size: 12px;
}

.chat-form {
  display: grid;
  grid-template-columns: 1fr 90px;
  gap: 10px;
}

.ai-match-container {
  display: flex;
  justify-content: center;
  margin: 20px 0;
  width: 100%;
}
.ai-match-card {
  width: 90%;
  max-width: 400px;
  background: #eff6ff;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  text-align: center;
}
.ai-match-header {
  font-weight: 600;
  color: #1e3a8a;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 15px;
}
.ai-match-body {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 12px;
}
.ai-match-body .highlight {
  font-size: 16px;
  font-weight: bold;
  color: #2563eb;
}
.ai-match-footer {
  margin-top: 10px;
  text-align: center;
}
</style>
