const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config({ quiet: true });

const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/aiRoutes');
const identityRoutes = require('./routes/identityRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { setSocketIo } = require('./modules/socketHub');
const { initDb, dbInfo } = require('./data/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

setSocketIo(io);

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'offer100-backend' });
});

app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

io.on('connection', (socket) => {
  socket.emit('recruitment:update', {
    type: 'connected',
    message: 'Connected to Offer100 recruitment realtime channel'
  });
});

const PORT = process.env.PORT || 3001;

function handleServerError(error) {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Another Offer100 backend may already be running.`
    );
    console.error(`Check http://localhost:${PORT}/api/health or stop the existing process first.`);
    process.exit(1);
  }

  console.error('Failed to start HTTP server:', error.message);
  process.exit(1);
}

server.on('error', handleServerError);

async function startServer() {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`Offer100 backend running at http://localhost:${PORT}`);
      console.log(`MySQL connection: ${dbInfo}`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  }
}

startServer();
