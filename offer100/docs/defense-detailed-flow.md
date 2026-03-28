# Offer100 答辩讲解稿（详细流程 + 功能实现 + 四人分工）

## 1. 项目定位与一句话介绍
Offer100 是一个面向求职者与招聘者的双边就业平台，支持同账号多身份切换，覆盖岗位发布、岗位浏览、岗位投递、简历管理、即时聊天、管理员治理，以及 AI 辅助咨询能力。

建议开场话术：
- 本项目核心价值是把招聘与求职流程打通为一个闭环，用户从注册到沟通再到投递，全流程可在平台内完成。
- 技术上采用 Vue3 + Node.js + Express + MySQL + Socket.IO，强调实时性、权限控制和可扩展的数据结构。

## 2. 系统整体流程（端到端）

### 2.1 启动流程
1. 后端启动并执行数据库初始化：创建表、迁移字段、规范化数据、种子数据注入。
2. 前端启动后，通过路由守卫控制访问权限。
3. Axios 拦截器自动注入 JWT 和当前活跃身份到请求头。

### 2.2 用户业务主流程
1. 用户注册：选择初始身份（jobseeker/recruiter），提交基础资料。
2. 用户登录：后端签发 JWT，前端写入 Pinia 与 localStorage。
3. 身份切换：顶部导航切换 activeIdentity，不同身份看到不同页面能力。
4. 求职者路径：浏览岗位 -> 搜索筛选 -> 投递 -> 与招聘者聊天 -> 维护简历。
5. 招聘者路径：发布岗位 -> 管理岗位 -> 查看求职者简历 -> 发起沟通/邀请。
6. 管理员路径：管理用户发布权限、简历可见性、岗位质量、岗位分类。
7. AI路径：用户发送问题 -> 后端转发 Coze -> 返回 AI 建议（已带入用户身份参数）。

### 2.3 实时事件流程（Socket）
1. 发布岗位成功后，服务端广播 recruitment:update(job_created)。
2. 投递成功后，服务端广播 recruitment:update(job_applied)。
3. 前端列表页监听后刷新数据与动态提示。

## 3. 技术架构与关键实现

### 3.1 前端（Vue3 + Pinia + Router + Element Plus）
- 状态管理：auth store 持有 token/user/activeIdentity。
- 身份注入：请求自动附带 X-Active-Identity。
- 路由权限：requiresAuth + meta.identity 双重限制。
- 主要页面：登录注册、首页总览、发布岗位、我的岗位、岗位详情、简历中心、聊天页、AI助手、管理员页。

### 3.2 后端（Express + JWT + Socket.IO）
- 中间件 authenticate：解析 JWT，并根据 X-Active-Identity 得到当前身份。
- requireIdentity：接口级身份限制（如投递仅 jobseeker，发布仅 recruiter）。
- 模块化路由：auth/identity/jobs/resume/chat/profile/analytics/reports/admin/ai。
- 行为追踪：关键动作写入 behavior_logs，支持统计与报表导出。

### 3.3 数据库（MySQL）
- 初始化脚本自动建表 + 补字段迁移 + 规范化数据。
- 关键表：users/jobs/applications/resumes/messages/identity_profiles/job_categories/behavior_logs。
- 身份模型：users.identities + users.initial_identity + identity_profiles(按身份维度存档)。

### 3.4 AI接入（Coze）
- 前端发送 content + userId + userIdentity。
- 后端 aiRoutes 将 user_identity/identity_type 作为 parameters 传入 Coze。
- 返回结果统一封装为 answer，前端直接渲染。

## 4. 功能清单逐项讲解（结合 F001-F026）

说明：你给的清单中 F017 出现两次，缺少 F018。为保证一致性，本文保留原编号，同时把第二个 F017 按“F018”语义说明。

| 编号 | 模块 | 需求 | 优先级 | 现状 | 核心实现说明 |
|---|---|---|---|---|---|
| F001 | 用户管理 | 用户注册 | P0 | 已实现 | /api/auth/register，按初始身份校验必填项，并写入 users + resumes/companies + identity_profiles。 |
| F002 | 用户管理 | 用户登录 | P0 | 已实现 | /api/auth/login，返回 token、identities、initialIdentity，前端落库并进入主页。 |
| F003 | 用户管理 | 身份切换 | P0 | 已实现 | 前端 TopBar 切换 activeIdentity；请求头带 X-Active-Identity；后端按身份鉴权。 |
| F004 | 岗位浏览 | 岗位列表 | P0 | 已实现 | /api/jobs 返回岗位卡片数据，含公司信息与招聘者活跃时间。 |
| F005 | 岗位浏览 | 搜索/筛选 | P1 | 已实现 | 支持关键词、分类、学历、经验、城市、公司规模、薪资区间等筛选。 |
| F006 | 岗位投递 | 投递岗位 | P0 | 已实现 | /api/jobs/:id/apply；写 applications；自动生成 application_card 消息 + 常用语。 |
| F007 | 简历管理 | 简历维护 | P0 | 已实现 | /api/resume/me PUT；必填校验，写 resumes 与 identity_profiles(jobseeker)。 |
| F008 | 简历管理 | 简历查看 | P0 | 已实现 | /api/resume/me GET；招聘者可通过 seeker 列表与详情查看简历。 |
| F009 | 岗位管理 | 发布岗位 | P0 | 已实现 | /api/jobs POST；招聘者身份限制；支持分类、标签；发布后广播实时事件。 |
| F010 | 岗位管理 | 管理岗位 | P1 | 已实现 | 招聘者可查看 /api/jobs/mine，并删除本人岗位 /api/jobs/:id DELETE。 |
| F011 | 公司管理 | 公司信息维护 | P0 | 已实现 | /api/profile/me（recruiter）维护公司名、规模、地址、介绍。 |
| F012 | 招聘管理 | 查看简历 | P0 | 已实现 | /api/resume/seekers（招聘者）查看满足完整度条件的求职者简历。 |
| F013 | 聊天系统 | 联系人列表 | P1 | 已实现 | /api/chat/contacts 聚合最近会话、未读数、置顶状态。 |
| F014 | 聊天系统 | 消息发送 | P0 | 已实现 | /api/chat/messages + /conversation + 已读回执；消息落 messages 表。 |
| F015 | AI功能 | 求职建议 | P2 | 已实现（基础） | /api/ai/chat 已接 Coze，可基于文本与身份生成建议。 |
| F016 | AI功能 | 岗位匹配 | P2 | 部分实现 | 有数据同步接口 /api/ai/sync-data；匹配度评分可在 Coze 工作流继续细化。 |
| F017 | AI功能 | 模拟面试 | P2 | 部分实现 | 可通过 /api/ai/chat 以提示词实现模拟问答，自动评价逻辑可继续增强。 |
| F018(原第二个F017) | 用户数据 | 用户信息存储 | P0 | 已实现 | users 表存账号、密码、身份集、状态、权限开关等。 |
| F019 | 岗位数据 | 岗位信息管理 | P0 | 已实现 | jobs 表承载发布、查询、筛选、分类等核心岗位数据。 |
| F020 | 投递数据 | 投递记录管理 | P0 | 已实现 | applications 表记录投递关系、状态、投递快照。 |
| F021 | 简历数据 | 简历信息管理 | P0 | 已实现 | resumes + identity_profiles(jobseeker) 双层存储，兼顾标准字段与扩展字段。 |
| F022 | 聊天数据 | 消息记录管理 | P1 | 已实现 | messages 表记录文本/卡片消息、payload、已读状态。 |
| F023 | 行为数据 | 用户行为记录 | P1 | 已实现 | behavior_logs 表记录浏览、发布、投递等行为，支持统计报表。 |
| F024 | 管理员管理 | 管理用户权限 | P1 | 已实现 | /api/admin/users + 启停发布权限 + 简历可见性开关。 |
| F025 | 管理员管理 | 管理岗位 | P1 | 已实现 | /api/admin/jobs/:id 删除低质量岗位。 |
| F026 | 管理员管理 | 新建岗位分类 | P1 | 已实现 | /api/admin/categories 新增 category_l1/category_l2。 |

## 5. 按角色讲业务闭环（答辩易讲）

### 5.1 求职者闭环
1. 注册/登录并进入 jobseeker 身份。
2. 在首页总览按关键词和条件筛选岗位。
3. 点击投递，系统自动附带个人快照与常用语发送给招聘者。
4. 在聊天页继续沟通。
5. 在资料页维护简历与个人信息，提升曝光质量。

### 5.2 招聘者闭环
1. 切换 recruiter 身份。
2. 发布岗位并自动同步公司信息。
3. 查看求职者简历卡片并筛选。
4. 接收投递卡片消息，继续私聊。
5. 管理“我的发布”岗位。

### 5.3 管理员闭环
1. 查看用户列表与状态。
2. 限制违规用户发布权限、控制简历可见。
3. 删除低质量岗位。
4. 维护岗位分类体系，保障平台数据质量。

## 6. 数据模型讲解（面向答辩老师）

### 6.1 关键表职责
- users：账号主体 + 权限开关（can_publish_jobs/resume_visible）。
- identity_profiles：同一用户按身份保存差异资料（求职者/招聘者）。
- resumes：求职者标准化简历主表（便于筛选与统计）。
- jobs：岗位信息主表。
- applications：投递关系与快照。
- messages：即时通讯记录（含卡片消息）。
- behavior_logs：行为埋点与统计基础。
- job_categories：岗位分类字典。

### 6.2 为什么 identity_profiles + resumes 双表并存
- resumes 更适合做“结构化筛选查询”。
- identity_profiles 更适合“同账号多身份资料”的统一抽象。
- 双层设计让后续新增身份类型时扩展成本更低。

## 7. 四人职责拆分（前端/后端/数据库/AI）

### 7.1 前端负责人（同学A）
- 负责内容：页面设计与交互、路由守卫、状态管理、身份切换、通知反馈、Socket 客户端。
- 关键产出：登录注册页、首页总览、岗位页、简历页、聊天页、管理员页、AI助手页。
- 可讲亮点：统一 TopBar 身份切换、筛选器体验、投递成功通知、实时动态展示。

### 7.2 后端负责人（同学B）
- 负责内容：API 设计与鉴权、中间件、业务规则、Socket 服务、行为统计服务。
- 关键产出：auth/jobs/resume/chat/profile/admin/ai 等路由；requireIdentity 权限模型。
- 可讲亮点：同账号多身份鉴权链路、投递自动生成消息卡片、实时广播机制。

### 7.3 数据库负责人（同学C）
- 负责内容：表结构设计、初始化脚本、迁移策略、种子数据、字段规范化。
- 关键产出：initDb(create/migrate/seed/normalize) 完整流程，支持一键启动。
- 可讲亮点：迁移补字段策略、数据一致性处理、面向查询场景的表划分。

### 7.4 AI训练与接入负责人（同学D）
- 负责内容：AI接口封装、Coze参数协议、提示词工程、数据同步接口。
- 关键产出：/api/ai/chat、/api/ai/sync-data，前端 AI 助手对话体验。
- 可讲亮点：已将 userIdentity 注入 AI 上下文，实现“同一模型按身份分流答复”。
- 后续规划：岗位匹配评分函数、模拟面试评估维度、模型效果评测集。

## 8. 里程碑与协作流程（建议答辩这样讲）
1. M1（需求冻结）：确定 F001-F026 清单、优先级与验收标准。
2. M2（骨架搭建）：前后端脚手架 + 数据库初始化 + 登录链路打通。
3. M3（核心功能）：岗位、投递、简历、聊天闭环完成。
4. M4（治理能力）：管理员权限控制、分类维护、报表导出。
5. M5（AI增强）：接入 Coze，完成身份感知聊天。
6. M6（联调与验收）：角色场景回归测试、答辩材料准备。

## 9. 关键难点与解决方案
1. 难点：同账号多身份权限冲突。
- 方案：前端存 activeIdentity + 请求头传递 + 后端 requireIdentity 二次校验。

2. 难点：投递后信息传递链路复杂。
- 方案：投递动作拆成 applications 落库 + application_card 消息入库 + Socket 广播。

3. 难点：数据字段迭代导致兼容问题。
- 方案：initDb 引入 ensureColumn 迁移函数，兼容旧库平滑升级。

4. 难点：AI回答缺乏身份上下文。
- 方案：请求参数增加 user_identity/identity_type，提升回复针对性。

## 10. 可直接用于答辩的总结话术
- 我们项目不是单点功能，而是“招聘与求职双边业务闭环”系统。
- 技术亮点是多身份权限模型、实时通信和可扩展的数据层设计。
- 工程亮点是建表+迁移+种子一体化初始化，降低了部署门槛。
- AI部分已经完成业务接入，下一步重点是做岗位匹配与面试评估的算法化与可解释化。

## 11. 后续优化路线（老师常问）
1. 安全性：密码加密（bcrypt）、AI接口鉴权增强、敏感词审查。
2. 性能：热门列表缓存、消息分页优化、索引优化。
3. AI能力：建立评测集，量化命中率、满意度、覆盖率。
4. 工程化：补充单元测试和E2E测试、CI/CD自动化部署。
5. 产品化：消息通知中心、投递进度看板、推荐系统。
