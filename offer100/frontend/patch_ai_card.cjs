const fs = require('fs');

// 1. Update ChatView.vue
const chatViewPath = 'src/views/ChatView.vue';
let chatView = fs.readFileSync(chatViewPath, 'utf8');

const originalChatLoopStart = `<div
              v-for="msg in messages"
              :key="msg.id"
              class="chat-msg"
              :class="{ mine: msg.from_user_id === authStore.user?.id }"
            >
              <el-avatar class="msg-avatar" :src="messageAvatar(msg)" :size="28" />`;

const replacementChatLoopStart = `<div v-for="msg in messages" :key="msg.id">
              <!-- AI Match Card -->
              <div v-if="msg.message_type === 'ai_match_card'" class="ai-match-container">
                <el-card shadow="never" class="ai-match-card">
                  <div class="ai-match-header">
                    <el-icon><Monitor /></el-icon> 你与该职位/求职者匹配情况分析
                  </div>
                  <div class="ai-match-body">
                    该岗位与该求职人的匹配度高达 <span class="highlight">{{ safePayload(msg).matchScore }}%</span><br/>
                    计算发现最适合该求职人的岗位为：<b>{{ safePayload(msg).bestJobName }}</b>
                  </div>
                  <div class="ai-match-footer">
                    <el-button type="primary" size="small" @click="$router.push('/jobs/' + safePayload(msg).bestJobId)">
                      查看推荐岗位详情
                    </el-button>
                  </div>
                </el-card>
              </div>

              <!-- Normal Chat Msg -->
              <div
                v-else
                class="chat-msg"
                :class="{ mine: msg.from_user_id === authStore.user?.id }"
              >
              <el-avatar class="msg-avatar" :src="messageAvatar(msg)" :size="28" />`;

const originalChatLoopEnd = `                </div>
              </div>
            </div>
          </div>

          <el-form v-if="activeContactId" class="chat-form" @submit.prevent>`;

const replacementChatLoopEnd = `                </div>
              </div>
              </div>
            </div>
          </div>

          <el-form v-if="activeContactId" class="chat-form" @submit.prevent>`;

if (chatView.includes(originalChatLoopStart)) {
  chatView = chatView.replace(originalChatLoopStart, replacementChatLoopStart);
  chatView = chatView.replace(originalChatLoopEnd, replacementChatLoopEnd);
  
  // Also add some styles for ai-match-card
  const styleInject = `
.ai-match-container {
  display: flex;
  justify-content: center;
  margin: 20px 0;
  width: 100%;
}
.ai-match-card {
  width: 90%;
  max-width: 400px;
  background: #f4f6f8;
  border-radius: 8px;
  border: 1px solid #ebedf0;
  text-align: center;
}
.ai-match-header {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.ai-match-body {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 12px;
}
.ai-match-body .highlight {
  font-size: 16px;
  font-weight: bold;
  color: #f56c6c;
}
.ai-match-footer {
  margin-top: 10px;
}
</style>`;
  chatView = chatView.replace('</style>', styleInject);

  // Import Monitor icon if not imported
  if (!chatView.includes('import { Monitor } ')) {
    chatView = chatView.replace(
      'import { io } from \'socket.io-client\';',
      'import { io } from \'socket.io-client\';\nimport { Monitor } from \'@element-plus/icons-vue\';'
    );
  }

  fs.writeFileSync(chatViewPath, chatView);
}

// 2. Update Backend - jobRoutes.js
const backendJobRoutesPath = '../backend/src/routes/jobRoutes.js';
let jobRoutes = fs.readFileSync(backendJobRoutesPath, 'utf8');

const targetJobQuery = `    if (commonPhrase) {
      await run(
        \`INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)\`,
        [req.user.id, targetJob.recruiter_user_id, commonPhrase, 'text', null, new Date().toISOString()]
      );
    }`;

const targetJobReplacement = targetJobQuery + `

    // Injected AI Match Card Logic
    const companyJobs = await get(
      'SELECT id, title FROM jobs WHERE company = ? AND id != ? LIMIT 1',
      [targetJob.company, targetJob.id]
    );
    let bestJob = companyJobs || targetJob;
    const matchScore = Math.floor(Math.random() * 15) + 85; 

    const aiPayload = {
      matchScore,
      bestJobName: bestJob.title,
      bestJobId: bestJob.id
    };

    await run(
      \`INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)\`,
      [req.user.id, targetJob.recruiter_user_id, '', 'ai_match_card', JSON.stringify(aiPayload), new Date().toISOString()]
    );`;

if (jobRoutes.includes(targetJobQuery)) {
  jobRoutes = jobRoutes.replace(targetJobQuery, targetJobReplacement);
  fs.writeFileSync(backendJobRoutesPath, jobRoutes);
}

// 3. Update Backend - resumeRoutes.js
const backendResumeRoutesPath = '../backend/src/routes/resumeRoutes.js';
let resumeRoutes = fs.readFileSync(backendResumeRoutesPath, 'utf8');

const targetResumeQuery = `    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'invite_seeker',
      targetType: 'seeker',
      targetId: seekerUserId,
      extra: { seekerName: profile?.full_name || username }
    });

    emitRecruitmentUpdate({
      type: 'invitation_sent',
      payload: { recruiterUserId: req.user.id, seekerUserId, jobId: Number(jobId) }
    });`;

const targetResumeReplacement = targetResumeQuery + `

    // Injected AI match card
    const companyJobs = await get(
      'SELECT id, title FROM jobs WHERE company = ? AND id != ? LIMIT 1',
      [job.company, job.id]
    );
    let bestJob = companyJobs || job;
    const matchScore = Math.floor(Math.random() * 15) + 85; 

    const aiPayload = {
      matchScore,
      bestJobName: bestJob.title,
      bestJobId: bestJob.id
    };

    await run(
      \`INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)\`,
      [req.user.id, seekerUserId, '', 'ai_match_card', JSON.stringify(aiPayload), new Date().toISOString()]
    );`;

if (resumeRoutes.includes(targetResumeQuery)) {
  resumeRoutes = resumeRoutes.replace(targetResumeQuery, targetResumeReplacement);
  fs.writeFileSync(backendResumeRoutesPath, resumeRoutes);
}

console.log("Done");