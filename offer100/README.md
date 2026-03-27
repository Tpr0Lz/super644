# Offer100 就业服务平台（Vue + Node.js + Express）

## 1. 项目简介
Offer100 面向大学生与社会求职者，提供招聘岗位、企业动态、人才需求统计与就业指导服务。

后端数据库：MySQL（支持通过 `.env` 连接本地或云端实例）

当前版本实现：
- 同账号双身份切换（recruiter / jobseeker）
- 招聘人：发布岗位、维护公司信息、查看求职者简历
- 求职者：投递岗位、维护个人简历
- 招聘人和求职者实时对话（Socket + 消息持久化）
- 基于用户行为数据统计分析
- 报表导出（CSV）
- 预留 AI 接口规划说明（暂不实现）

## 2. 目录结构

```text
offer100/
  backend/
    src/
      data/
      middleware/
      modules/
      routes/
      services/
      utils/
      server.js
  frontend/
    src/
      api/
      components/
      router/
      stores/
      views/
      App.vue
      main.js
      style.css
```

## 3. 身份与权限
- recruiter（招聘人）：发布职位、维护公司信息、查看求职者、查看报表
- jobseeker（求职者）：浏览职位、投递职位、维护简历
- 任意登录账号可在前端顶部切换上述两种身份

## 4. 快速启动

### 4.1 启动后端

```bash
cd backend
npm install
npm run dev
```

默认端口：`3001`

### 4.2 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认端口：`5173`

## 5. 测试账号
- admin / 123456
- studentA / 123456
- socialUser / 123456

## 6. 核心接口
- `POST /api/auth/login` 登录
- `GET /api/jobs` 获取岗位列表（登录后）
- `POST /api/jobs` 发布岗位（招聘人身份）
- `POST /api/jobs/:id/apply` 投递岗位（求职者身份）
- `GET /api/company/me` 获取我的公司信息（招聘人身份）
- `PUT /api/company/me` 保存我的公司信息（招聘人身份）
- `GET /api/resume/me` 获取我的简历（求职者身份）
- `PUT /api/resume/me` 保存我的简历（求职者身份）
- `GET /api/resume/seekers` 查看求职者简历列表（招聘人身份）
- `GET /api/chat/contacts` 获取可聊天对象
- `GET /api/chat/messages/:userId` 获取会话消息
- `POST /api/chat/messages` 发送消息
- `GET /api/analytics/behavior` 行为统计（招聘人身份）
- `GET /api/reports/behavior.csv` 下载行为报表（招聘人身份）
- `GET /api/reports/summary` 综合摘要报表（招聘人身份）

## 7. Socket 事件
- 服务端事件名：`recruitment:update`
- 推送场景：
  - 岗位发布成功
  - 用户投递成功

## 8. AI 接口未来规划（本期不实现）
后续可新增：
- `POST /api/ai/career-advice`：基于简历与岗位偏好输出求职建议
- `POST /api/ai/job-match-score`：对职位进行匹配度评分

## 9. 说明
该版本默认通过后端 `.env` 连接 MySQL，便于本地开发与云端部署。后续可继续接入 Redis、消息队列与更完整的报表系统（如 FreeReportBuilder 或替代方案）。
