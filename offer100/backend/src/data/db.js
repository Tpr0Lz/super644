const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { currentDateTime } = require('../utils/datetime');

dotenv.config({ quiet: true });

const DEFAULT_COMMON_PHRASE_JOBSEEKER = '你好，我对贵公司的该岗位很感兴趣，想跟您详细聊聊';
const DEFAULT_COMMON_PHRASE_RECRUITER = '你好，我发现你的简历十分合适这份岗位，有兴趣聊聊吗';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'offer100',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

const dbInfo = `${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

let pool;

function escapeIdentifier(identifier) {
  return String(identifier).replace(/`/g, '``');
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
}

async function run(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return {
    lastID: Number(result.insertId || 0),
    changes: Number(result.affectedRows || 0)
  };
}

async function get(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined;
}

async function all(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return Array.isArray(rows) ? rows : [];
}

function safeJsonParse(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

async function ensureColumn(tableName, columnName, columnDef) {
  const row = await get(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = ?
       AND table_name = ?
       AND column_name = ?`,
    [dbConfig.database, tableName, columnName]
  );

  if (!Number(row?.count || 0)) {
    await run(
      `ALTER TABLE \`${escapeIdentifier(tableName)}\`
       ADD COLUMN \`${escapeIdentifier(columnName)}\` ${columnDef}`
    );
  }
}

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    charset: 'utf8mb4'
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${escapeIdentifier(dbConfig.database)}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function seedUsers() {
  try {
    const adminUser = await get("SELECT id FROM users WHERE username = 'admin'");
    if (adminUser) {
      await run("DELETE FROM users WHERE username = 'admin'");
    }
  } catch (error) {
    // ignore
  }

  const userCountRow = await get('SELECT COUNT(*) AS count FROM users');
  if (Number(userCountRow?.count || 0) > 0) {
    return;
  }

  const users = [
    {
      username: 'adminzsb',
      password: '123456',
      nickname: '系统管理员',
      role: 'admin',
      major: 'Admin',
      preferenceTags: [],
      identities: '[]',
      initialIdentity: 'admin',
      status: 'active'
    },
    {
      username: 'studentA',
      password: '123456',
      nickname: '学生A',
      role: 'jobseeker',
      major: 'Software Engineering',
      preferenceTags: ['frontend', 'vue'],
      identities: '["recruiter", "jobseeker"]',
      initialIdentity: 'jobseeker',
      status: 'active'
    },
    {
      username: 'socialUser',
      password: '123456',
      nickname: '社招用户',
      role: 'jobseeker',
      major: 'N/A',
      preferenceTags: ['operations', 'marketing'],
      identities: '["recruiter", "jobseeker"]',
      initialIdentity: 'jobseeker',
      status: 'active'
    }
  ];

  for (const user of users) {
    await run(
      `INSERT INTO users (
        username,
        password,
        nickname,
        role,
        major,
        preference_tags,
        identities,
        initial_identity,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.username,
        user.password,
        user.nickname,
        user.role,
        user.major,
        JSON.stringify(user.preferenceTags),
        user.identities,
        user.initialIdentity,
        user.status || 'active',
        currentDateTime()
      ]
    );
  }
}

async function seedJobs() {
  const jobCountRow = await get('SELECT COUNT(*) AS count FROM jobs');
  if (Number(jobCountRow?.count || 0) > 0) {
    return;
  }

  const jobs = [
    {
      title: '前端开发工程师',
      company: '校园科技',
      city: '上海',
      salaryRange: '12k-18k',
      employmentType: '全职',
      companySize: '100-200人',
      educationRequirement: '本科',
      experienceRequirement: '1-3年',
      categoryL1: '互联网 / AI',
      categoryL2: '前端开发（Vue / React）',
      tags: ['vue', 'javascript', 'frontend'],
      description: '负责企业级 Web 前端开发。',
      publishAt: '2026-03-01'
    },
    {
      title: '后端开发工程师',
      company: '云川科技',
      city: '杭州',
      salaryRange: '15k-22k',
      employmentType: '全职',
      companySize: '200-500人',
      educationRequirement: '本科',
      experienceRequirement: '3-5年',
      categoryL1: '互联网 / AI',
      categoryL2: '后端开发（Java / Go / Python）',
      tags: ['nodejs', 'express', 'api'],
      description: '负责高并发后端服务与接口开发。',
      publishAt: '2026-03-03'
    },
    {
      title: '产品运营专员',
      company: '增长实验室',
      city: '深圳',
      salaryRange: '9k-14k',
      employmentType: '全职',
      companySize: '20-100人',
      educationRequirement: '无限制',
      experienceRequirement: '1年以内',
      categoryL1: '产品',
      categoryL2: '增长产品经理',
      tags: ['operations', 'analysis'],
      description: '负责活动运营与用户增长转化。',
      publishAt: '2026-03-05'
    }
  ];

  for (const job of jobs) {
    await run(
      `INSERT INTO jobs (
        title, company, city, salary_range, employment_type, company_size, experience_requirement, education_requirement,
        category_l1, category_l2, tags, description, publish_at, recruiter_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.title,
        job.company,
        job.city,
        job.salaryRange,
        job.employmentType,
        job.companySize,
        job.experienceRequirement,
        job.educationRequirement,
        job.categoryL1,
        job.categoryL2,
        JSON.stringify(job.tags),
        job.description,
        job.publishAt,
        1
      ]
    );
  }
}

async function seedCompanies() {
  const row = await get('SELECT COUNT(*) AS count FROM companies');
  if (Number(row?.count || 0) > 0) {
    return;
  }

  const now = currentDateTime();
  await run(
    'INSERT INTO companies (user_id, name, intro, website, address, company_size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [1, 'TechNova', 'Focus on campus hiring and frontend products.', 'https://technova.example', '上海浦东', '100-499', now]
  );

  await run(
    `INSERT INTO identity_profiles (
      user_id,
      identity,
      avatar_url,
      common_phrase,
      company_name,
      company_address,
      company_size,
      company_intro,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      'recruiter',
      '',
      '你好，我们对你的背景很感兴趣，欢迎沟通。',
      'TechNova',
      '上海浦东',
      '100-499',
      '聚焦校园招聘与企业数字化服务。',
      now
    ]
  );
}

async function seedResumes() {
  const row = await get('SELECT COUNT(*) AS count FROM resumes');
  if (Number(row?.count || 0) > 0) {
    return;
  }

  const now = currentDateTime();
  await run(
    `INSERT INTO resumes (
      user_id,
      full_name,
      skills,
      experience,
      education,
      gender,
      age,
      strengths,
      job_hunting_status,
      expected_position,
      internship_experience,
      project_experience,
      competition_experience,
      campus_experience,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      2,
      'Student A',
      'Vue, JavaScript, Node.js',
      'Built multiple school web projects.',
      'Software Engineering',
      '女',
      22,
      '上手快，沟通顺畅，执行力强',
      '考虑机会',
      '前端开发工程师',
      '在互联网公司实习3个月',
      '校园招聘系统、二手交易平台',
      '蓝桥杯省赛二等奖',
      '担任学院技术部负责人',
      now
    ]
  );

  await run(
    `INSERT INTO identity_profiles (
      user_id,
      identity,
      avatar_url,
      common_phrase,
      full_name,
      age,
      gender,
      strengths,
      job_hunting_status,
      expected_position,
      internship_experience,
      project_experience,
      competition_experience,
      campus_experience,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      2,
      'jobseeker',
      '',
      '你好，我对贵司岗位很感兴趣，期待进一步沟通。',
      'Student A',
      22,
      '女',
      '上手快，沟通顺畅，执行力强',
      '考虑机会',
      '前端开发工程师',
      '在互联网公司实习3个月',
      '校园招聘系统、二手交易平台',
      '蓝桥杯省赛二等奖',
      '担任学院技术部负责人',
      now
    ]
  );
}

async function backfillIdentityProfiles() {
  const users = await all('SELECT id, identities, initial_identity FROM users');
  const now = currentDateTime();

  for (const user of users) {
    const identities = safeJsonParse(user.identities, ['jobseeker']);
    const initialIdentity = identities.includes(user.initial_identity)
      ? user.initial_identity
      : identities[0] || 'jobseeker';

    await run('UPDATE users SET initial_identity = ? WHERE id = ?', [initialIdentity, user.id]);

    for (const identity of identities) {
      const existed = await get(
        'SELECT id FROM identity_profiles WHERE user_id = ? AND identity = ?',
        [user.id, identity]
      );

      if (!existed) {
        await run(
          'INSERT INTO identity_profiles (user_id, identity, avatar_url, common_phrase, updated_at) VALUES (?, ?, ?, ?, ?)',
          [
            user.id,
            identity,
            '',
            identity === 'recruiter' ? DEFAULT_COMMON_PHRASE_RECRUITER : DEFAULT_COMMON_PHRASE_JOBSEEKER,
            now
          ]
        );
      }
    }
  }
}

async function createTables() {
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(191) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      nickname VARCHAR(191),
      role VARCHAR(50) NOT NULL,
      major VARCHAR(191),
      preference_tags LONGTEXT,
      identities LONGTEXT,
      initial_identity VARCHAR(50),
      status VARCHAR(32) DEFAULT 'active',
      can_publish_jobs TINYINT(1) DEFAULT 1,
      resume_visible TINYINT(1) DEFAULT 1,
      created_at VARCHAR(40)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS jobs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(191) NOT NULL,
      company VARCHAR(191) NOT NULL,
      city VARCHAR(191) NOT NULL,
      salary_range VARCHAR(191) NOT NULL,
      employment_type VARCHAR(100),
      company_size VARCHAR(100),
      experience_requirement VARCHAR(100),
      education_requirement VARCHAR(100),
      category_l1 VARCHAR(191),
      category_l2 VARCHAR(191),
      tags LONGTEXT,
      description LONGTEXT,
      publish_at VARCHAR(40),
      recruiter_user_id INT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS behavior_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      role VARCHAR(50) NOT NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(100) NOT NULL,
      target_id INT,
      extra LONGTEXT,
      created_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS companies (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL UNIQUE,
      name VARCHAR(191) NOT NULL,
      intro LONGTEXT,
      website VARCHAR(255),
      address VARCHAR(255),
      company_size VARCHAR(100),
      updated_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS resumes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL UNIQUE,
      full_name VARCHAR(191) NOT NULL,
      skills LONGTEXT,
      experience LONGTEXT,
      education VARCHAR(191),
      expected_salary VARCHAR(100),
      school VARCHAR(191),
      major VARCHAR(191),
      degree VARCHAR(100),
      graduation_cohort VARCHAR(100),
      work_experience VARCHAR(100),
      location VARCHAR(191),
      contact_phone VARCHAR(100),
      contact_email VARCHAR(191),
      gender VARCHAR(20),
      age INT,
      strengths LONGTEXT,
      job_hunting_status VARCHAR(50),
      expected_job_type VARCHAR(50),
      expected_position VARCHAR(191),
      internship_experience LONGTEXT,
      project_experience LONGTEXT,
      competition_experience LONGTEXT,
      campus_experience LONGTEXT,
      updated_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS applications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      job_id INT NOT NULL,
      seeker_user_id INT NOT NULL,
      message LONGTEXT,
      status VARCHAR(32) DEFAULT 'pending',
      snapshot_profile LONGTEXT,
      created_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS invitations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      recruiter_user_id INT NOT NULL,
      seeker_user_id INT NOT NULL,
      job_id INT NOT NULL,
      message LONGTEXT,
      status VARCHAR(32) DEFAULT 'sent',
      snapshot_job LONGTEXT,
      created_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS messages (
      id INT PRIMARY KEY AUTO_INCREMENT,
      from_user_id INT NOT NULL,
      to_user_id INT NOT NULL,
      content LONGTEXT NOT NULL,
      message_type VARCHAR(50) DEFAULT 'text',
      payload_json LONGTEXT,
      is_read TINYINT(1) DEFAULT 0,
      created_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS identity_profiles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      identity VARCHAR(50) NOT NULL,
      avatar_url LONGTEXT,
      common_phrase LONGTEXT,
      company_name VARCHAR(191),
      company_address VARCHAR(255),
      company_size VARCHAR(100),
      company_intro LONGTEXT,
      full_name VARCHAR(191),
      age INT,
      gender VARCHAR(20),
      strengths LONGTEXT,
      expected_salary VARCHAR(100),
      school VARCHAR(191),
      major VARCHAR(191),
      degree VARCHAR(100),
      graduation_cohort VARCHAR(100),
      work_experience VARCHAR(100),
      location VARCHAR(191),
      contact_phone VARCHAR(100),
      contact_email VARCHAR(191),
      job_hunting_status VARCHAR(50),
      expected_job_type VARCHAR(50),
      expected_position VARCHAR(191),
      internship_experience LONGTEXT,
      project_experience LONGTEXT,
      competition_experience LONGTEXT,
      campus_experience LONGTEXT,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE KEY uniq_user_identity (user_id, identity)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS job_categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      category_l1 VARCHAR(191) NOT NULL,
      category_l2 VARCHAR(191) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS user_contacts (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      contact_user_id INT NOT NULL,
      is_pinned TINYINT(1) DEFAULT 0,
      is_deleted TINYINT(1) DEFAULT 0,
      last_message_at VARCHAR(40),
      created_at VARCHAR(40) NOT NULL,
      UNIQUE KEY uniq_user_contact (user_id, contact_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS ai_chat_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_key VARCHAR(191) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content LONGTEXT NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      INDEX idx_ai_chat_history_user_key_id (user_key, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function applyMigrations() {
  await ensureColumn('users', 'nickname', 'VARCHAR(191)');
  await ensureColumn('users', 'identities', 'LONGTEXT');
  await ensureColumn('users', 'initial_identity', 'VARCHAR(50)');
  await ensureColumn('users', 'created_at', 'VARCHAR(40)');
  await ensureColumn('users', 'status', "VARCHAR(32) DEFAULT 'active'");
  await ensureColumn('users', 'role', 'VARCHAR(50)');
  await ensureColumn('users', 'can_publish_jobs', 'TINYINT(1) DEFAULT 1');
  await ensureColumn('users', 'resume_visible', 'TINYINT(1) DEFAULT 1');

  await ensureColumn('companies', 'address', 'VARCHAR(255)');
  await ensureColumn('companies', 'company_size', 'VARCHAR(100)');

  await ensureColumn('resumes', 'gender', 'VARCHAR(20)');
  await ensureColumn('resumes', 'age', 'INT');
  await ensureColumn('resumes', 'strengths', 'LONGTEXT');
  await ensureColumn('resumes', 'expected_salary', 'VARCHAR(100)');
  await ensureColumn('resumes', 'school', 'VARCHAR(191)');
  await ensureColumn('resumes', 'major', 'VARCHAR(191)');
  await ensureColumn('resumes', 'degree', 'VARCHAR(100)');
  await ensureColumn('resumes', 'graduation_cohort', 'VARCHAR(100)');
  await ensureColumn('resumes', 'work_experience', 'VARCHAR(100)');
  await ensureColumn('resumes', 'location', 'VARCHAR(191)');
  await ensureColumn('resumes', 'contact_phone', 'VARCHAR(100)');
  await ensureColumn('resumes', 'contact_email', 'VARCHAR(191)');
  await ensureColumn('resumes', 'job_hunting_status', 'VARCHAR(50)');
  await ensureColumn('resumes', 'expected_job_type', 'VARCHAR(50)');
  await ensureColumn('resumes', 'expected_position', 'VARCHAR(191)');
  await ensureColumn('resumes', 'internship_experience', 'LONGTEXT');
  await ensureColumn('resumes', 'project_experience', 'LONGTEXT');
  await ensureColumn('resumes', 'competition_experience', 'LONGTEXT');
  await ensureColumn('resumes', 'campus_experience', 'LONGTEXT');

  await ensureColumn('jobs', 'recruiter_user_id', 'INT');
  await ensureColumn('jobs', 'employment_type', 'VARCHAR(100)');
  await ensureColumn('jobs', 'company_size', 'VARCHAR(100)');
  await ensureColumn('jobs', 'experience_requirement', 'VARCHAR(100)');
  await ensureColumn('jobs', 'education_requirement', 'VARCHAR(100)');
  await ensureColumn('jobs', 'category_l1', 'VARCHAR(191)');
  await ensureColumn('jobs', 'category_l2', 'VARCHAR(191)');

  await ensureColumn('applications', 'message', 'LONGTEXT');
  await ensureColumn('applications', 'status', "VARCHAR(32) DEFAULT 'pending'");
  await ensureColumn('applications', 'snapshot_profile', 'LONGTEXT');

  await ensureColumn('messages', 'message_type', "VARCHAR(50) DEFAULT 'text'");
  await ensureColumn('messages', 'payload_json', 'LONGTEXT');
  await ensureColumn('messages', 'is_read', 'TINYINT(1) DEFAULT 0');

  await ensureColumn('identity_profiles', 'expected_salary', 'VARCHAR(100)');
  await ensureColumn('identity_profiles', 'school', 'VARCHAR(191)');
  await ensureColumn('identity_profiles', 'major', 'VARCHAR(191)');
  await ensureColumn('identity_profiles', 'degree', 'VARCHAR(100)');
  await ensureColumn('identity_profiles', 'graduation_cohort', 'VARCHAR(100)');
  await ensureColumn('identity_profiles', 'work_experience', 'VARCHAR(100)');
  await ensureColumn('identity_profiles', 'location', 'VARCHAR(191)');
  await ensureColumn('identity_profiles', 'contact_phone', 'VARCHAR(100)');
  await ensureColumn('identity_profiles', 'contact_email', 'VARCHAR(191)');
  await ensureColumn('identity_profiles', 'job_hunting_status', 'VARCHAR(50)');
  await ensureColumn('identity_profiles', 'expected_job_type', 'VARCHAR(50)');
}

async function normalizeData() {
  await run(
    `UPDATE jobs
     SET employment_type = COALESCE(NULLIF(employment_type, ''), '不限')
     WHERE employment_type IS NULL OR employment_type = ''`
  );

  await run(
    `UPDATE jobs
     SET company_size = COALESCE(NULLIF(company_size, ''), '不限')
     WHERE company_size IS NULL OR company_size = ''`
  );

  await run(
    `UPDATE jobs
     SET experience_requirement = COALESCE(NULLIF(experience_requirement, ''), '不限')
     WHERE experience_requirement IS NULL OR experience_requirement = ''`
  );

  await run(
    `UPDATE jobs
     SET education_requirement = COALESCE(NULLIF(education_requirement, ''), '不限')
     WHERE education_requirement IS NULL OR education_requirement = ''`
  );

  await run(
    `UPDATE jobs
     SET experience_requirement = '不限'
     WHERE experience_requirement = '无限制'`
  );

  await run(
    `UPDATE jobs
     SET education_requirement = '不限'
     WHERE education_requirement = '无限制'`
  );

  await run(
    `UPDATE jobs
     SET category_l1 = COALESCE(NULLIF(category_l1, ''), '互联网 / AI')
     WHERE category_l1 IS NULL OR category_l1 = ''`
  );

  await run(
    `UPDATE jobs
     SET category_l2 = COALESCE(NULLIF(category_l2, ''), title)
     WHERE category_l2 IS NULL OR category_l2 = ''`
  );

  await run(
    `UPDATE messages
     SET is_read = COALESCE(is_read, 0)
     WHERE is_read IS NULL`
  );

  await run(
    `UPDATE users
     SET identities = COALESCE(NULLIF(identities, ''), '["recruiter","jobseeker"]')
     WHERE identities IS NULL OR identities = ''`
  );

  await run(
    `UPDATE users
     SET initial_identity = COALESCE(NULLIF(initial_identity, ''), role)
     WHERE initial_identity IS NULL OR initial_identity = ''`
  );

  await run(
    `UPDATE users
     SET nickname = COALESCE(NULLIF(nickname, ''), username)
     WHERE nickname IS NULL OR nickname = ''`
  );

  await run(
    `UPDATE users
     SET created_at = COALESCE(created_at, ?)
     WHERE created_at IS NULL`,
    [currentDateTime()]
  );

  await run(
    `UPDATE resumes
     SET job_hunting_status = COALESCE(NULLIF(job_hunting_status, ''), '考虑机会')
     WHERE job_hunting_status IS NULL OR job_hunting_status = ''`
  );

  await run(
    `UPDATE resumes
     SET expected_job_type = COALESCE(NULLIF(expected_job_type, ''), '不限')
     WHERE expected_job_type IS NULL OR expected_job_type = ''`
  );

  await run(
    `UPDATE resumes
     SET location = COALESCE(NULLIF(location, ''), '其他')
     WHERE location IS NULL OR location = ''`
  );

  await run(
    `UPDATE identity_profiles
     SET job_hunting_status = COALESCE(NULLIF(job_hunting_status, ''), '考虑机会')
     WHERE identity = 'jobseeker' AND (job_hunting_status IS NULL OR job_hunting_status = '')`
  );

  await run(
    `UPDATE identity_profiles
     SET expected_job_type = COALESCE(NULLIF(expected_job_type, ''), '不限')
     WHERE identity = 'jobseeker' AND (expected_job_type IS NULL OR expected_job_type = '')`
  );

  await run(
    `UPDATE identity_profiles
     SET location = COALESCE(NULLIF(location, ''), '其他')
     WHERE identity = 'jobseeker' AND (location IS NULL OR location = '')`
  );

  await run(
    `UPDATE identity_profiles
     SET common_phrase = ?
     WHERE identity = 'jobseeker' AND (common_phrase IS NULL OR TRIM(common_phrase) = '')`,
    [DEFAULT_COMMON_PHRASE_JOBSEEKER]
  );

  await run(
    `UPDATE identity_profiles
     SET common_phrase = ?
     WHERE identity = 'recruiter' AND (common_phrase IS NULL OR TRIM(common_phrase) = '')`,
    [DEFAULT_COMMON_PHRASE_RECRUITER]
  );
}

async function seedAdmin() {
  const admin = await get("SELECT id FROM users WHERE username = 'adm'");
  if (!admin) {
    const now = currentDateTime();
    await run(
      `INSERT INTO users (username, password, nickname, role, initial_identity, status, created_at)
       VALUES ('adm', '123456', 'Admin', 'admin', 'admin', 'active', ?)`,
      [now]
    );
  }
}

async function seedCategories() {
  const countRow = await get('SELECT COUNT(*) AS count FROM job_categories');
  if (Number(countRow?.count || 0) > 0) {
    return;
  }

  const categories = [
    { l1: '互联网/ AI', l2: '前端开发（Vue / React）' },
    { l1: '互联网/ AI', l2: '后端开发（Java / Go / Python）' },
    { l1: '产品', l2: '增长产品经理' }
  ];

  for (const cat of categories) {
    await run('INSERT INTO job_categories (category_l1, category_l2) VALUES (?, ?)', [cat.l1, cat.l2]);
  }
}

async function initDb() {
  await ensureDatabase();
  pool = mysql.createPool(dbConfig);

  await createTables();
  await applyMigrations();
  await normalizeData();
  await seedUsers();
  await seedAdmin();
  await seedCategories();
  await seedJobs();
  await seedCompanies();
  await seedResumes();
  await backfillIdentityProfiles();
}

module.exports = {
  dbInfo,
  run,
  get,
  all,
  initDb
};
