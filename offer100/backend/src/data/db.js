const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../../offer100.sqlite');
const db = new sqlite3.Database(dbPath);

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
  const userCountRow = await get('SELECT COUNT(*) AS count FROM users');
  if (userCountRow.count > 0) {
    return;
  }

  const users = [
    {
      username: 'admin',
      password: '123456',
      nickname: '管理员',
      role: 'recruiter',
      major: 'Computer Science',
      preferenceTags: ['fullstack', 'management'],
      identities: ['recruiter', 'jobseeker'],
      initialIdentity: 'recruiter'
    },
    {
      username: 'studentA',
      password: '123456',
      nickname: '学生A',
      role: 'jobseeker',
      major: 'Software Engineering',
      preferenceTags: ['frontend', 'vue'],
      identities: ['recruiter', 'jobseeker'],
      initialIdentity: 'jobseeker'
    },
    {
      username: 'socialUser',
      password: '123456',
      nickname: '社招用户',
      role: 'jobseeker',
      major: 'N/A',
      preferenceTags: ['operations', 'marketing'],
      identities: ['recruiter', 'jobseeker'],
      initialIdentity: 'jobseeker'
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
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.username,
        user.password,
        user.nickname,
        user.role,
        user.major,
        JSON.stringify(user.preferenceTags),
        JSON.stringify(user.identities),
        user.initialIdentity,
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
      title: 'Vue Frontend Engineer',
      company: 'TechNova',
      city: 'Shanghai',
      salaryRange: '12k-18k',
      tags: ['vue', 'javascript', 'frontend'],
      description: 'Develop and optimize enterprise SPA applications.',
      publishAt: '2026-03-01'
    },
    {
      title: 'Node.js Backend Engineer',
      company: 'CloudRiver',
      city: 'Hangzhou',
      salaryRange: '15k-22k',
      tags: ['nodejs', 'express', 'api'],
      description: 'Build scalable backend services and APIs.',
      publishAt: '2026-03-03'
    },
    {
      title: 'Product Operations Specialist',
      company: 'GrowthLab',
      city: 'Shenzhen',
      salaryRange: '9k-14k',
      tags: ['operations', 'analysis'],
      description: 'Coordinate campaigns and optimize user conversion.',
      publishAt: '2026-03-05'
    }
  ];

  for (const job of jobs) {
    await run(
      'INSERT INTO jobs (title, company, city, salary_range, tags, description, publish_at, recruiter_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        job.title,
        job.company,
        job.city,
        job.salaryRange,
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
      expected_position,
      internship_experience,
      project_experience,
      competition_experience,
      campus_experience,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      2,
      'Student A',
      'Vue, JavaScript, Node.js',
      'Built multiple school web projects.',
      'Software Engineering',
      '女',
      22,
      '上手快，沟通顺畅，执行力强',
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
      expected_position,
      internship_experience,
      project_experience,
      competition_experience,
      campus_experience,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      2,
      'jobseeker',
      '',
      '你好，我对贵司岗位很感兴趣，期待进一步沟通。',
      'Student A',
      22,
      '女',
      '上手快，沟通顺畅，执行力强',
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
          [user.id, identity, '', '', now]
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
      gender TEXT,
      age INTEGER,
      strengths TEXT,
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

  await ensureColumn('companies', 'address', 'TEXT');
  await ensureColumn('companies', 'company_size', 'TEXT');

  await ensureColumn('resumes', 'gender', 'TEXT');
  await ensureColumn('resumes', 'age', 'INTEGER');
  await ensureColumn('resumes', 'strengths', 'TEXT');
  await ensureColumn('resumes', 'expected_position', 'TEXT');
  await ensureColumn('resumes', 'internship_experience', 'TEXT');
  await ensureColumn('resumes', 'project_experience', 'TEXT');
  await ensureColumn('resumes', 'competition_experience', 'TEXT');
  await ensureColumn('resumes', 'campus_experience', 'TEXT');

  await ensureColumn('jobs', 'recruiter_user_id', 'INTEGER');
  await ensureColumn('applications', 'message', 'TEXT');
  await ensureColumn('applications', 'status', "TEXT DEFAULT 'pending'");
  await ensureColumn('applications', 'snapshot_profile', 'TEXT');
  await ensureColumn('messages', 'message_type', "TEXT DEFAULT 'text'");
  await ensureColumn('messages', 'payload_json', 'TEXT');

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

  await seedUsers();
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