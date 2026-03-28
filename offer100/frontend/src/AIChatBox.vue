<template>
  <div class="ai-assistant">
    <el-button 
      type="primary" 
      circle 
      class="ai-btn" 
      @click="visible = !visible"
    >
      <el-icon><ChatDotRound /></el-icon>
    </el-button>

    <el-drawer
      v-model="visible"
      title="Offer100 智能助手"
      direction="rtl"
      size="400px"
    >
      <div class="ai-chat-container">
        <div class="ai-messages" ref="msgContainer">
          <div v-for="(msg, i) in messages" :key="i" :class="['msg-item', msg.role]">
            <el-avatar :size="30">{{ msg.role === 'user' ? '我' : 'AI' }}</el-avatar>
            <div class="msg-content" v-html="renderMarkdown(msg.content)"></div>
          </div>
        </div>
        
        <div class="ai-input">
          <el-input
            v-model="input"
            placeholder="问问我：模拟面试或匹配岗位..."
            @keyup.enter="handleSend"
          >
            <template #append>
              <el-button @click="handleSend" :loading="loading">发送</el-button>
            </template>
          </el-input>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import { chatWithAI } from './api/ai';
import { useAuthStore } from './stores/auth';
import { marked } from 'marked'; // 需要安装: npm install marked

const authStore = useAuthStore();
const visible = ref(false);
const input = ref('');
const loading = ref(false);
const messages = ref([{ role: 'assistant', content: '你好！我是 Offer100 助手，准备好开启模拟面试了吗？' }]);
const msgContainer = ref(null);

const renderMarkdown = (text) => marked(text);

const handleSend = async () => {
  if (!input.value || loading.value) return;
  
  const userText = input.value;
  messages.value.push({ role: 'user', content: userText });
  input.value = '';
  loading.value = true;

  try {
    const { data } = await chatWithAI(userText, authStore.user?.id, messages.value);
    // 假设后端返回的对象里内容在 data.answer 中
    messages.value.push({ role: 'assistant', content: data.answer });
    scrollToBottom();
  } catch (e) {
    messages.value.push({
      role: 'assistant',
      content: e.response?.data?.answer || '抱歉，信号变弱了，请稍后再试。'
    });
  } finally {
    loading.value = false;
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (msgContainer.value) {
      msgContainer.value.scrollTop = msgContainer.value.scrollHeight;
    }
  });
};
</script>

<style scoped>
.ai-btn { position: fixed; right: 30px; bottom: 30px; width: 60px; height: 60px; font-size: 24px; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.ai-chat-container { display: flex; flex-direction: column; height: 100%; }
.ai-messages { flex: 1; overflow-y: auto; padding: 10px; }
.msg-item { display: flex; gap: 10px; margin-bottom: 15px; }
.msg-item.user { flex-direction: row-reverse; }
.msg-content { background: #f4f4f5; padding: 10px; border-radius: 8px; max-width: 80%; font-size: 14px; }
.user .msg-content { background: #409eff; color: white; }
.ai-input { padding: 20px; border-top: 1px solid #eee; }
</style>
