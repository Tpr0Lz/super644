const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('../../routes/authRoutes');
const jobRoutes = require('../../routes/jobRoutes');
const analyticsRoutes = require('../../routes/analyticsRoutes');
const reportRoutes = require('../../routes/reportRoutes');
const companyRoutes = require('../../routes/companyRoutes');
const resumeRoutes = require('../../routes/resumeRoutes');
const chatRoutes = require('../../routes/chatRoutes');
const identityRoutes = require('../../routes/identityRoutes');
const profileRoutes = require('../../routes/profileRoutes');
const { setSocketIo } = require('../../modules/socketHub');
const { initDb, dbPath } = require('../../data/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

setSocketIo(io);

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'offer100-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);

io.on('connection', (socket) => {
  socket.emit('recruitment:update', {
    type: 'connected',
    message: 'Connected to Offer100 recruitment realtime channel'
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`Offer100 backend running at http://localhost:${PORT}`);
      console.log(`SQLite DB path: ${dbPath}`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  }
}

startServer();
