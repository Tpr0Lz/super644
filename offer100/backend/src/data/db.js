const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../../offer100.sqlite');
const db = new sqlite3.Database(dbPath);
const DEFAULT_COMMON_PHRASE_JOBSEEKER = '你好，我对贵公司的该岗位很感兴趣，想跟您详细聊聊';
const DEFAULT_COMMON_PHRASE_RECRUITER = '你好，我发现你的简历十分合适这份岗位，有兴趣聊聊吗';

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
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
  const cols = await all(`PRAGMA table_info(${tableName})`);
  const exists = cols.some((col) => col.name === columnName);
  if (!exists) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

async function seedUsers() {
  // 迁移：如果存在 admin 用户，删除它，改用 adminzsb
  try {
    const adminUser = await get("SELECT id FROM users WHERE username = 'admin'");
    if (adminUser) {
      await run("DELETE FROM users WHERE username = 'admin'");
    }
  } catch (error) {
    // ignore
  }

  const userCountRow = await get('SELECT COUNT(*) AS count FROM users');
  if (userCountRow.count > 0) {
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
        new Date().toISOString()
      ]
    );
  }
}

async function seedJobs() {
  const jobCountRow = await get('SELECT COUNT(*) AS count FROM jobs');
  if (jobCountRow.count > 0) {
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
  if (row.count > 0) {
    return;
  }
  const now = new Date().toISOString();
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
  if (row.count > 0) {
    return;
  }
  const now = new Date().toISOString();
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
  const now = new Date().toISOString();
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

async function initDb() {
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      nickname TEXT,
      role TEXT NOT NULL,
      major TEXT,
      preference_tags TEXT,
      identities TEXT,
      initial_identity TEXT,
      created_at TEXT
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      city TEXT NOT NULL,
      salary_range TEXT NOT NULL,
      employment_type TEXT,
      company_size TEXT,
      experience_requirement TEXT,
      education_requirement TEXT,
      category_l1 TEXT,
      category_l2 TEXT,
      tags TEXT,
      description TEXT,
      publish_at TEXT,
      recruiter_user_id INTEGER
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS behavior_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      extra TEXT,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      intro TEXT,
      website TEXT,
      address TEXT,
      company_size TEXT,
      updated_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      skills TEXT,
      experience TEXT,
      education TEXT,
      expected_salary TEXT,
      school TEXT,
      major TEXT,
      degree TEXT,
      graduation_cohort TEXT,
      work_experience TEXT,
      location TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      gender TEXT,
      age INTEGER,
      strengths TEXT,
      job_hunting_status TEXT,
      expected_job_type TEXT,
      expected_position TEXT,
      internship_experience TEXT,
      project_experience TEXT,
      competition_experience TEXT,
      campus_experience TEXT,
      updated_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      seeker_user_id INTEGER NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      snapshot_profile TEXT,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recruiter_user_id INTEGER NOT NULL,
      seeker_user_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'sent',
      snapshot_job TEXT,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      payload_json TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS identity_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      identity TEXT NOT NULL,
      avatar_url TEXT,
      common_phrase TEXT,
      company_name TEXT,
      company_address TEXT,
      company_size TEXT,
      company_intro TEXT,
      full_name TEXT,
      age INTEGER,
      gender TEXT,
      strengths TEXT,
      expected_salary TEXT,
      school TEXT,
      major TEXT,
      degree TEXT,
      graduation_cohort TEXT,
      work_experience TEXT,
      location TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      job_hunting_status TEXT,
      expected_job_type TEXT,
      expected_position TEXT,
      internship_experience TEXT,
      project_experience TEXT,
      competition_experience TEXT,
      campus_experience TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, identity)
    )`
  );

  await ensureColumn('users', 'nickname', 'TEXT');
  await ensureColumn('users', 'identities', 'TEXT');
  await ensureColumn('users', 'initial_identity', 'TEXT');
  await ensureColumn('users', 'created_at', 'TEXT');
  await ensureColumn('users', 'status', "TEXT DEFAULT 'active'");
  await ensureColumn('users', 'role', 'TEXT');

  await ensureColumn('companies', 'address', 'TEXT');
  await ensureColumn('companies', 'company_size', 'TEXT');

  await ensureColumn('resumes', 'gender', 'TEXT');
  await ensureColumn('resumes', 'age', 'INTEGER');
  await ensureColumn('resumes', 'strengths', 'TEXT');
  await ensureColumn('resumes', 'expected_salary', 'TEXT');
  await ensureColumn('resumes', 'school', 'TEXT');
  await ensureColumn('resumes', 'major', 'TEXT');
  await ensureColumn('resumes', 'degree', 'TEXT');
  await ensureColumn('resumes', 'graduation_cohort', 'TEXT');
  await ensureColumn('resumes', 'work_experience', 'TEXT');
  await ensureColumn('resumes', 'location', 'TEXT');
  await ensureColumn('resumes', 'contact_phone', 'TEXT');
  await ensureColumn('resumes', 'contact_email', 'TEXT');
  await ensureColumn('resumes', 'job_hunting_status', 'TEXT');
  await ensureColumn('resumes', 'expected_job_type', 'TEXT');
  await ensureColumn('resumes', 'expected_position', 'TEXT');
  await ensureColumn('resumes', 'internship_experience', 'TEXT');
  await ensureColumn('resumes', 'project_experience', 'TEXT');
  await ensureColumn('resumes', 'competition_experience', 'TEXT');
  await ensureColumn('resumes', 'campus_experience', 'TEXT');

  await ensureColumn('jobs', 'recruiter_user_id', 'INTEGER');
  await ensureColumn('jobs', 'employment_type', 'TEXT');
  await ensureColumn('jobs', 'company_size', 'TEXT');
  await ensureColumn('jobs', 'experience_requirement', 'TEXT');
  await ensureColumn('jobs', 'education_requirement', 'TEXT');
  await ensureColumn('jobs', 'category_l1', 'TEXT');
  await ensureColumn('jobs', 'category_l2', 'TEXT');
  await ensureColumn('applications', 'message', 'TEXT');
  await ensureColumn('applications', 'status', "TEXT DEFAULT 'pending'");
  await ensureColumn('applications', 'snapshot_profile', 'TEXT');
  await ensureColumn('messages', 'message_type', "TEXT DEFAULT 'text'");
  await ensureColumn('messages', 'payload_json', 'TEXT');
  await ensureColumn('messages', 'is_read', 'INTEGER DEFAULT 0');
  await ensureColumn('identity_profiles', 'expected_salary', 'TEXT');
  await ensureColumn('identity_profiles', 'school', 'TEXT');
  await ensureColumn('identity_profiles', 'major', 'TEXT');
  await ensureColumn('identity_profiles', 'degree', 'TEXT');
  await ensureColumn('identity_profiles', 'graduation_cohort', 'TEXT');
  await ensureColumn('identity_profiles', 'work_experience', 'TEXT');
  await ensureColumn('identity_profiles', 'location', 'TEXT');
  await ensureColumn('identity_profiles', 'contact_phone', 'TEXT');
  await ensureColumn('identity_profiles', 'contact_email', 'TEXT');
  await ensureColumn('identity_profiles', 'job_hunting_status', 'TEXT');
  await ensureColumn('identity_profiles', 'expected_job_type', 'TEXT');

  await run(
     `UPDATE jobs
      SET employment_type = COALESCE(employment_type, '不限')
      WHERE employment_type IS NULL OR employment_type = ''`
    );

    await run(
    `UPDATE jobs
     SET company_size = COALESCE(company_size, '不限')
     WHERE company_size IS NULL OR company_size = ''`
  );

  await run(
     `UPDATE jobs
      SET experience_requirement = COALESCE(experience_requirement, '不限')
      WHERE experience_requirement IS NULL OR experience_requirement = ''`
    );

    await run(
    `UPDATE jobs
      SET education_requirement = COALESCE(education_requirement, '不限')
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
     SET category_l1 = COALESCE(category_l1, '互联网 / AI')
     WHERE category_l1 IS NULL OR category_l1 = ''`
  );

  await run(
    `UPDATE jobs
     SET category_l2 = COALESCE(category_l2, title)
     WHERE category_l2 IS NULL OR category_l2 = ''`
  );

  await run(
    `UPDATE messages
     SET is_read = COALESCE(is_read, 0)
     WHERE is_read IS NULL`
  );

  await run(
    `UPDATE users
     SET identities = COALESCE(identities, '["recruiter","jobseeker"]')
     WHERE identities IS NULL OR identities = ''`
  );

  await run(
    `UPDATE users
     SET initial_identity = COALESCE(initial_identity, role)
     WHERE initial_identity IS NULL OR initial_identity = ''`
  );

  await run(
    `UPDATE users
     SET nickname = COALESCE(nickname, username)
     WHERE nickname IS NULL OR nickname = ''`
  );

  await run(
    `UPDATE users
     SET created_at = COALESCE(created_at, ?)
     WHERE created_at IS NULL OR created_at = ''`,
    [new Date().toISOString()]
  );

  await run(
    `UPDATE resumes
     SET job_hunting_status = COALESCE(job_hunting_status, '考虑机会')
     WHERE job_hunting_status IS NULL OR job_hunting_status = ''`
  );

  await run(
    `UPDATE resumes
     SET expected_job_type = COALESCE(expected_job_type, '不限')
     WHERE expected_job_type IS NULL OR expected_job_type = ''`
  );

  await run(
    `UPDATE resumes
     SET location = COALESCE(location, '其他')
     WHERE location IS NULL OR location = ''`
  );

  await run(
    `UPDATE identity_profiles
     SET job_hunting_status = COALESCE(job_hunting_status, '考虑机会')
     WHERE identity = 'jobseeker' AND (job_hunting_status IS NULL OR job_hunting_status = '')`
  );

  await run(
    `UPDATE identity_profiles
     SET expected_job_type = COALESCE(expected_job_type, '不限')
     WHERE identity = 'jobseeker' AND (expected_job_type IS NULL OR expected_job_type = '')`
  );

  await run(
    `UPDATE identity_profiles
     SET location = COALESCE(location, '其他')
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

  await seedUsers();
  
  // 添加 user_contacts 表用于管理聊天列表的置顶和删除
  await run(
    `CREATE TABLE IF NOT EXISTS user_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contact_user_id INTEGER NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      last_message_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, contact_user_id)
    )`
  );

  await seedJobs();
  await seedCompanies();
  await seedResumes();
  await backfillIdentityProfiles();
}

module.exports = {
  dbPath,
  run,
  get,
  all,
  initDb
};