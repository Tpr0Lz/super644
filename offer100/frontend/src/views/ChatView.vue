<template>
  <main class="page">
    <TopBar
      :username="authStore.user?.nickname || authStore.user?.username"
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
              :class="{ active: u.id === activeContactId }"
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
            <el-empty v-if="visibleMessages.length === 0" description="暂无消息，开始沟通吧" :image-size="80" />
            <div
              v-for="msg in visibleMessages"
              :key="msg.id"
              class="chat-msg"
              :class="{ mine: msg.from_user_id === authStore.user?.id }"
            >
                <el-avatar class="msg-avatar" :src="messageAvatar(msg)" :size="28" />
              <div class="msg-content">
                <div class="msg-name" :class="{ mine: msg.from_user_id === authStore.user?.id }">
                  {{ msg.from_user_id === authStore.user?.id ? '我' : activeContactName }}
                </div>
                <div class="msg-bubble">
                  <template v-if="msg.message_type === 'application_card' || msg.message_type === 'invitation_card' || msg.message_type === 'job_card'">
                    <p v-if="msg.content">{{ msg.content }}</p>
                    <button class="card-msg" v-if="safePayload(msg)" @click="openCardDetail(safePayload(msg), msg.message_type)">
                      <p><strong>{{ safePayload(msg).title || '岗位卡片' }}</strong></p>
                      <p v-if="safePayload(msg).job">
                        岗位：{{ safePayload(msg).job.title }} | {{ safePayload(msg).job.company }} | {{ safePayload(msg).job.city }}
                      </p>
                      <p v-if="safePayload(msg).seeker">
                        求职者：{{ safePayload(msg).seeker.fullName }}，优势：{{ safePayload(msg).seeker.strengths }}
                      </p>
                      <p class="card-tip">点击查看岗位详情</p>
                    </button>
                  </template>
                  <template v-else-if="msg.message_type === 'resume_card'">
                    <p v-if="msg.content">{{ msg.content }}</p>
                    <button class="card-msg resume-card" v-if="safePayload(msg)" @click="openCardDetail(safePayload(msg), msg.message_type)">
                      <p><strong>{{ safePayload(msg).title || '求职者简历卡片' }}</strong></p>
                      <p>
                        姓名：{{ safePayload(msg).seeker?.fullName || '未填写' }}
                        <span v-if="safePayload(msg).seeker?.expectedPosition"> | 意向：{{ safePayload(msg).seeker.expectedPosition }}</span>
                      </p>
                      <p v-if="safePayload(msg).seeker?.strengths">优势：{{ safePayload(msg).seeker.strengths }}</p>
                      <p v-if="safePayload(msg).seeker?.school || safePayload(msg).seeker?.degree">
                        教育：{{ safePayload(msg).seeker?.school || '未填写' }}
                        <span v-if="safePayload(msg).seeker?.degree"> | {{ safePayload(msg).seeker.degree }}</span>
                      </p>
                      <p class="card-tip">点击查看简历详情</p>
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

          <el-form v-if="activeContactId" class="chat-form" @submit.prevent>
            <el-input
              v-model.trim="messageText"
              placeholder="输入消息..."
              clearable
              @keyup.enter="sendMessage"
            />
            <el-button
              v-if="authStore.activeIdentity === 'jobseeker'"
              type="success"
              plain
              :loading="sendingResume"
              @click="sendResumeCard"
            >
              发送简历
            </el-button>
            <el-button
              v-if="authStore.activeIdentity === 'recruiter'"
              type="warning"
              plain
              :loading="sendingJobCard"
              @click="openJobCardDialog"
            >
              发送岗位
            </el-button>
            <el-button type="primary" :disabled="!activeContactId || !messageText" @click="sendMessage">发送</el-button>
          </el-form>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="jobCardDialogVisible" title="选择要发送的岗位" width="480px">
      <el-select
        v-model="selectedJobId"
        style="width: 100%"
        filterable
        clearable
        placeholder="请选择岗位"
      >
        <el-option
          v-for="job in availableJobs"
          :key="job.id"
          :label="`${job.title} | ${job.company} | ${job.city}`"
          :value="job.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="jobCardDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="sendingJobCard" @click="sendJobCard">发送岗位卡片</el-button>
      </template>
    </el-dialog>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import { ElMessage } from 'element-plus';
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
const sendingResume = ref(false);
const sendingJobCard = ref(false);
const jobCardDialogVisible = ref(false);
const selectedJobId = ref(null);
const availableJobs = ref([]);
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
  contacts.value = Array.isArray(data) ? data : [];

  const routeContactId = Number(route.query.with || 0);
  if (routeContactId && contacts.value.some((item) => item.id === routeContactId)) {
    activeContactId.value = routeContactId;
    await loadMessages();
    return;
  }

  if (routeContactId && !contacts.value.some((item) => item.id === routeContactId)) {
    try {
      const { data: target } = await http.get(`/chat/users/${routeContactId}`);
      if (!target?.isDeleted) {
        contacts.value = [target, ...contacts.value];
        activeContactId.value = routeContactId;
        await loadMessages();
        return;
      }
      if (String(route.query.with || '') === String(routeContactId)) {
        await router.replace({ path: '/chat' });
      }
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

function buildResumePayload(resume) {
  return {
    title: '求职者简历卡片',
    seeker: {
      userId: authStore.user?.id,
      fullName: resume?.full_name || authStore.user?.nickname || authStore.user?.username || '未命名求职者',
      expectedPosition: resume?.expected_position || '',
      strengths: resume?.strengths || '',
      school: resume?.school || '',
      degree: resume?.degree || '',
      location: resume?.location || ''
    }
  };
}

async function sendResumeCard() {
  if (!activeContactId.value || authStore.activeIdentity !== 'jobseeker' || sendingResume.value) {
    return;
  }

  sendingResume.value = true;
  try {
    const { data: resume } = await http.get('/resume/me');
    const hasContent = Boolean(
      resume?.full_name || resume?.expected_position || resume?.strengths || resume?.school
    );
    if (!hasContent) {
      ElMessage.warning('你的简历信息为空，请先完善后再发送');
      return;
    }

    await http.post('/chat/messages', {
      toUserId: activeContactId.value,
      content: '我发送了一份简历卡片',
      messageType: 'resume_card',
      payload: buildResumePayload(resume)
    });
    ElMessage.success('简历卡片已发送');
    await loadMessages();
    await loadContacts();
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '发送简历失败');
  } finally {
    sendingResume.value = false;
  }
}

function normalizeJob(job) {
  return {
    id: Number(job?.id || 0),
    title: job?.title || '未命名岗位',
    company: job?.company || '未知公司',
    city: job?.city || '未知城市',
    salaryRange: job?.salaryRange || job?.salary_range || '',
    employmentType: job?.employmentType || job?.employment_type || ''
  };
}

async function loadAvailableJobs() {
  if (authStore.activeIdentity !== 'recruiter') {
    availableJobs.value = [];
    return;
  }

  const { data } = await http.get('/jobs/mine');
  const rows = Array.isArray(data) ? data : [];
  availableJobs.value = rows.map(normalizeJob).filter((job) => job.id > 0);
}

async function openJobCardDialog() {
  if (!activeContactId.value || authStore.activeIdentity !== 'recruiter') {
    return;
  }
  try {
    if (availableJobs.value.length === 0) {
      await loadAvailableJobs();
    }
    if (availableJobs.value.length === 0) {
      ElMessage.warning('当前没有可发送的岗位');
      return;
    }
    selectedJobId.value = availableJobs.value[0].id;
    jobCardDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '加载岗位失败');
  }
}

function buildJobPayload(job) {
  return {
    title: '岗位推荐卡片',
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      city: job.city,
      salaryRange: job.salaryRange,
      employmentType: job.employmentType
    }
  };
}

async function sendJobCard() {
  if (
    !activeContactId.value ||
    !selectedJobId.value ||
    sendingJobCard.value ||
    authStore.activeIdentity !== 'recruiter'
  ) {
    return;
  }

  const picked = availableJobs.value.find((job) => String(job.id) === String(selectedJobId.value));
  if (!picked) {
    ElMessage.warning('请选择有效岗位');
    return;
  }

  sendingJobCard.value = true;
  try {
    await http.post('/chat/messages', {
      toUserId: activeContactId.value,
      content: `我推荐了一个岗位：${picked.title}`,
      messageType: 'job_card',
      payload: buildJobPayload(picked)
    });
    ElMessage.success('岗位卡片已发送');
    jobCardDialogVisible.value = false;
    await loadMessages();
    await loadContacts();
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '发送岗位卡片失败');
  } finally {
    sendingJobCard.value = false;
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
    if (String(route.query.with || '') === String(userId)) {
      await router.replace({ path: '/chat' });
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

const visibleMessages = computed(() =>
  messages.value.filter((message) => message.message_type !== 'ai_match_card')
);

function openCardDetail(payload, messageType) {
  if (!payload) {
    return;
  }

  if (messageType === 'resume_card') {
    const seekerUserId = Number(payload?.seeker?.userId || 0);
    if (!seekerUserId) {
      return;
    }

    if (seekerUserId === authStore.user?.id) {
      if (authStore.activeIdentity !== 'jobseeker') {
        authStore.setActiveIdentity('jobseeker');
      }
      router.push('/profile');
      return;
    }

    if (authStore.activeIdentity === 'recruiter') {
      router.push(`/seekers/${seekerUserId}`);
      return;
    }

    ElMessage.warning('当前身份无法查看该求职者简历详情');
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
  await loadAvailableJobs();
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
    await loadAvailableJobs();
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
  border-color: #2563eb;
  box-shadow: inset 0 0 0 1px #2563eb;
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
  grid-template-columns: 1fr auto 90px;
  gap: 10px;
}

.resume-card {
  background: #f0fdf4;
  border-color: #86efac;
}

</style>
