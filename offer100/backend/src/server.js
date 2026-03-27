// server.js
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const companyRoutes = require('./routes/companyRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const chatRoutes = require('./routes/chatRoutes');
const identityRoutes = require('./routes/identityRoutes');
const profileRoutes = require('./routes/profileRoutes');
const aiRoutes = require('./routes/aiRoutes'); // 引入 AI 路由

const { setSocketIo } = require('./modules/socketHub');
const { initDb } = require('./data/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

setSocketIo(io);
app.use(cors());
app.use(express.json());

// --- 路由挂载开始 ---

// 1. AI 路由建议放在最前，确保测试时不受其他业务逻辑拦截
app.use('/api/ai', aiRoutes); 
app.use('/api/jobs', jobRoutes);
// 2. 基础认证
app.use('/api/auth', authRoutes);

// 3. 业务路由（已清理原文件中的重复项）
app.use('/api/identity', identityRoutes);

app.use('/api/company', companyRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/chat', chatRoutes); 
app.use('/api/profile', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);

// --- 路由挂载结束 ---

const PORT = 3001;
async function startServer() {
  try {
    await initDb();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 后端已启动：http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    process.exit(1);
  }
}
startServer();