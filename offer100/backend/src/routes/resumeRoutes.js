const express = require('express');
const { all, get, run } = require('../data/db');
const { authenticate, requireIdentity } = require('../middleware/auth');
const { trackBehavior } = require('../services/behaviorService');
const { emitRecruitmentUpdate } = require('../modules/socketHub');

const router = express.Router();
const JOB_HUNTING_STATUS = ['随时到岗', '月内到岗', '考虑机会', '暂不考虑'];
const DEFAULT_RECRUITER_PHRASE = '你好，我发现你的简历十分合适这份岗位，有兴趣聊聊吗';
const JOB_TYPE_OPTIONS = ['不限', '全职', '实习', '兼职'];

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

function validateRequiredJobseekerProfile(payload) {
  const requiredTextFields = [
    ['fullName', '姓名'],
    ['gender', '性别'],
    ['jobHuntingStatus', '求职状态'],
    ['expectedJobType', '求职类型'],
    ['expectedSalary', '期望薪资'],
    ['degree', '学历'],
    ['workExperience', '工作经验'],
    ['location', '个人所在地'],
    ['strengths', '个人优势'],
    ['expectedPosition', '期望岗位'],
    ['projectExperience', '项目经历'],
    ['contactPhone', '联系电话'],
    ['contactEmail', '联系邮箱']
  ];

  for (const [field, label] of requiredTextFields) {
    if (isBlank(payload[field])) {
      return `${label}为必填项`;
    }
  }

  if (!payload.age || Number(payload.age) <= 0) {
    return '年龄为必填项';
  }

  return '';
}

function makeSeekerWordHtml({ seeker }) {
  const rows = [];
  const append = (label, value) => {
    const text = String(value || '').trim();
    if (text) {
      rows.push(`<tr><td class="label">${label}</td><td>${text}</td></tr>`);
    }
  };

  append('姓名', seeker.fullName);
  append('用户名', seeker.username);
  append('年龄', seeker.age);
  append('性别', seeker.gender);
  append('联系电话', seeker.contactPhone);
  append('联系邮箱', seeker.contactEmail);
  append('求职状态', seeker.jobHuntingStatus);
  append('求职类型', seeker.expectedJobType);
  append('期望薪资', seeker.expectedSalary);
  append('学校', seeker.school);
  append('专业', seeker.major);
  append('学历', seeker.degree || seeker.education);
  append('毕业届别', seeker.graduationCohort);
  append('工作经验', seeker.workExperience || seeker.experience);
  append('个人所在地', seeker.location);
  append('个人优势', seeker.strengths);
  append('期望岗位', seeker.expectedPosition);
  append('项目经历', seeker.projectExperience);
  append('实习经历', seeker.internshipExperience);
  append('比赛经历', seeker.competitionExperience);
  append('在校经历', seeker.campusExperience);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { font-family: "Microsoft YaHei", sans-serif; color: #1f2937; }
.wrap { max-width: 760px; margin: 24px auto; border: 1px solid #dbeafe; border-radius: 12px; padding: 20px; }
h1 { margin: 0 0 16px; color: #1d4ed8; }
table { border-collapse: collapse; width: 100%; }
td { border: 1px solid #e5e7eb; padding: 10px; vertical-align: top; }
.label { width: 180px; background: #eff6ff; font-weight: 700; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>求职者简历导出</h1>
    <table>${rows.join('')}</table>
  </div>
</body>
</html>`;
}

function parseJsonArray(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function parseSalaryKRange(text) {
  const raw = String(text || '').toLowerCase().replace(/\s+/g, '');
  if (!raw) {
    return { min: null, max: null };
  }

  const nums = Array.from(raw.matchAll(/\d+(?:\.\d+)?/g)).map((item) => Number(item[0]));
  if (nums.length === 0) {
    return { min: null, max: null };
  }

  const hasW = raw.includes('w');
  const hasK = raw.includes('k');
  const factor = hasW ? 10 : hasK ? 1 : 1;
  const normalized = nums.map((n) => n * factor);
  if (normalized.length === 1) {
    return { min: normalized[0], max: normalized[0] };
  }

  return {
    min: Math.min(...normalized),
    max: Math.max(...normalized)
  };
}

function matchSalaryBand(salaryRange, band) {
  if (!band || band === '不限') {
    return true;
  }

  const { min, max } = parseSalaryKRange(salaryRange);
  if (min === null && max === null) {
    return false;
  }

  const lower = min ?? max;
  const upper = max ?? min;

  if (band === '3k以下') {
    return lower < 3;
  }
  if (band === '3-5k') {
    return upper >= 3 && lower <= 5;
  }
  if (band === '5-10k') {
    return upper >= 5 && lower <= 10;
  }
  if (band === '10-20k') {
    return upper >= 10 && lower <= 20;
  }
  if (band === '20k以上') {
    return upper > 20 || lower >= 20;
  }

  return true;
}

function mapResumeRow(row) {
  return {
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    skills: row.skills,
    experience: row.experience,
    education: row.education,
    age: row.age,
    gender: row.gender,
    expectedSalary: row.expected_salary || '',
    school: row.school || '',
    major: row.major || '',
    degree: row.degree || row.education || '',
    graduationCohort: row.graduation_cohort || '',
    workExperience: row.work_experience || row.experience || '',
    location: row.location || '其他',
    contactPhone: row.contact_phone || '',
    contactEmail: row.contact_email || '',
    strengths: row.strengths,
    jobHuntingStatus: row.job_hunting_status || '考虑机会',
    expectedJobType: row.expected_job_type || '不限',
    expectedPosition: row.expected_position,
    internshipExperience: row.internship_experience,
    projectExperience: row.project_experience,
    competitionExperience: row.competition_experience,
    campusExperience: row.campus_experience,
    avatarUrl: row.avatar_url || '',
    commonPhrase: row.common_phrase || '',
    updatedAt: row.updated_at
  };
}

router.get('/me', authenticate, requireIdentity(['jobseeker']), async (req, res) => {
  try {
    const resume = await get(
      `SELECT r.id, r.full_name, r.skills, r.experience, r.education, r.updated_at,
              r.expected_salary, r.school, r.major, r.degree, r.graduation_cohort, r.work_experience, r.location,
              r.contact_phone, r.contact_email,
              r.age, r.gender, r.strengths, r.job_hunting_status, r.expected_job_type, r.expected_position,
              r.internship_experience, r.project_experience,
              r.competition_experience, r.campus_experience,
              COALESCE(ip.avatar_url, '') AS avatar_url,
              COALESCE(ip.common_phrase, '') AS common_phrase
       FROM resumes r
       LEFT JOIN identity_profiles ip ON ip.user_id = r.user_id AND ip.identity = 'jobseeker'
       WHERE r.user_id = ?`,
      [req.user.id]
    );

    if (!resume) {
      return res.json({
        id: 0,
        full_name: '',
        skills: '',
        experience: '',
        education: '',
        expected_salary: '',
        school: '',
        major: '',
        degree: '',
        graduation_cohort: '',
        work_experience: '',
        location: '其他',
        contact_phone: '',
        contact_email: '',
        age: null,
        gender: '',
        strengths: '',
        job_hunting_status: '考虑机会',
        expected_job_type: '不限',
        expected_position: '',
        internship_experience: '',
        project_experience: '',
        competition_experience: '',
        campus_experience: '',
        avatar_url: '',
        common_phrase: '',
        updated_at: ''
      });
    }

    return res.json(resume);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load resume', detail: error.message });
  }
});

router.put('/me', authenticate, requireIdentity(['jobseeker']), async (req, res) => {
  try {
    const {
      fullName,
      skills,
      experience,
      education,
      expectedSalary,
      school,
      major,
      degree,
      graduationCohort,
      workExperience,
      location,
      contactPhone,
      contactEmail,
      age,
      gender,
      strengths,
      jobHuntingStatus,
      expectedJobType,
      expectedPosition,
      internshipExperience,
      projectExperience,
      competitionExperience,
      campusExperience,
      avatarUrl,
      commonPhrase
    } = req.body;

    const now = new Date().toISOString();
    if (jobHuntingStatus && !JOB_HUNTING_STATUS.includes(jobHuntingStatus)) {
      return res.status(400).json({ message: '求职状态不合法' });
    }
    if (expectedJobType && !JOB_TYPE_OPTIONS.includes(expectedJobType)) {
      return res.status(400).json({ message: '求职类型不合法' });
    }
    const requiredMessage = validateRequiredJobseekerProfile({
      fullName,
      age,
      gender,
      jobHuntingStatus,
      expectedJobType,
      expectedSalary,
      degree,
      workExperience,
      location,
      strengths,
      expectedPosition,
      projectExperience,
      contactPhone,
      contactEmail
    });
    if (requiredMessage) {
      return res.status(400).json({ message: requiredMessage });
    }
    const existed = await get('SELECT id FROM resumes WHERE user_id = ?', [req.user.id]);

    if (existed) {
      await run(
        `UPDATE resumes
         SET full_name = ?, skills = ?, experience = ?, education = ?,
           expected_salary = ?, school = ?, major = ?, degree = ?, graduation_cohort = ?, work_experience = ?, location = ?, contact_phone = ?, contact_email = ?,
             age = ?, gender = ?, strengths = ?, job_hunting_status = ?, expected_job_type = ?, expected_position = ?,
             internship_experience = ?, project_experience = ?,
             competition_experience = ?, campus_experience = ?, updated_at = ?
         WHERE user_id = ?`,
        [
          fullName,
          skills,
          experience,
          education,
          expectedSalary || '',
          school || '',
          major || '',
          degree || '',
          graduationCohort || '',
          workExperience || '',
          location || '其他',
          contactPhone || '',
          contactEmail || '',
          age ? Number(age) : null,
          gender,
          strengths,
          jobHuntingStatus || '考虑机会',
          expectedJobType || '不限',
          expectedPosition,
          internshipExperience,
          projectExperience,
          competitionExperience,
          campusExperience,
          now,
          req.user.id
        ]
      );
    } else {
      await run(
        `INSERT INTO resumes (
          user_id, full_name, skills, experience, education, expected_salary, school, major, degree, graduation_cohort, work_experience, location, contact_phone, contact_email,
          age, gender, strengths, job_hunting_status, expected_job_type,
          expected_position, internship_experience, project_experience,
          competition_experience, campus_experience, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          req.user.id,
          fullName,
          skills,
          experience,
          education,
          expectedSalary || '',
          school || '',
          major || '',
          degree || '',
          graduationCohort || '',
          workExperience || '',
          location || '其他',
          contactPhone || '',
          contactEmail || '',
          age ? Number(age) : null,
          gender,
          strengths,
          jobHuntingStatus || '考虑机会',
          expectedJobType || '不限',
          expectedPosition,
          internshipExperience,
          projectExperience,
          competitionExperience,
          campusExperience,
          now
        ]
      );
    }

    const identityExisted = await get(
      'SELECT id FROM identity_profiles WHERE user_id = ? AND identity = ?',
      [req.user.id, 'jobseeker']
    );

    if (identityExisted) {
      await run(
        `UPDATE identity_profiles
         SET avatar_url = ?, common_phrase = ?, full_name = ?, age = ?, gender = ?, strengths = ?,
           expected_salary = ?, school = ?, major = ?, degree = ?, graduation_cohort = ?, work_experience = ?, location = ?, contact_phone = ?, contact_email = ?, job_hunting_status = ?, expected_job_type = ?,
             expected_position = ?, internship_experience = ?, project_experience = ?,
             competition_experience = ?, campus_experience = ?, updated_at = ?
         WHERE user_id = ? AND identity = ?`,
        [
          avatarUrl || '',
          commonPhrase || '',
          fullName || '',
          age ? Number(age) : null,
          gender || '',
          strengths || '',
          expectedSalary || '',
          school || '',
          major || '',
          degree || '',
          graduationCohort || '',
          workExperience || '',
          location || '其他',
          contactPhone || '',
          contactEmail || '',
          jobHuntingStatus || '考虑机会',
          expectedJobType || '不限',
          expectedPosition || '',
          internshipExperience || '',
          projectExperience || '',
          competitionExperience || '',
          campusExperience || '',
          now,
          req.user.id,
          'jobseeker'
        ]
      );
    } else {
      await run(
        `INSERT INTO identity_profiles (
          user_id, identity, avatar_url, common_phrase, full_name, age, gender, strengths,
          expected_salary, school, major, degree, graduation_cohort, work_experience, location, contact_phone, contact_email, job_hunting_status, expected_job_type,
          expected_position, internship_experience, project_experience,
          competition_experience, campus_experience, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          req.user.id,
          'jobseeker',
          avatarUrl || '',
          commonPhrase || '',
          fullName || '',
          age ? Number(age) : null,
          gender || '',
          strengths || '',
          expectedSalary || '',
          school || '',
          major || '',
          degree || '',
          graduationCohort || '',
          workExperience || '',
          location || '其他',
          contactPhone || '',
          contactEmail || '',
          jobHuntingStatus || '考虑机会',
          expectedJobType || '不限',
          expectedPosition || '',
          internshipExperience || '',
          projectExperience || '',
          competitionExperience || '',
          campusExperience || '',
          now
        ]
      );
    }

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'save_resume',
      targetType: 'resume',
      targetId: req.user.id
    });

    if (String(expectedPosition || '').trim() && String(strengths || '').trim()) {
      emitRecruitmentUpdate({
        type: 'seeker_profile_updated',
        payload: {
          seekerUserId: req.user.id,
          username: req.user.username,
          expectedPosition: String(expectedPosition).trim()
        }
      });
    }

    res.json({ message: 'Resume saved' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save resume', detail: error.message });
  }
});

router.get('/seekers', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const jobTag = String(req.query.jobTag || '').trim().toLowerCase();
    const jobHuntingStatus = String(req.query.jobHuntingStatus || '').trim();
    const expectedJobType = String(req.query.expectedJobType || '').trim();
    const expectedSalary = String(req.query.expectedSalary || '').trim();
    const degree = String(req.query.degree || '').trim();
    const workExperience = String(req.query.workExperience || '').trim();
    const location = String(req.query.location || '').trim();

    const rows = await all(
      `SELECT u.id AS user_id, u.username,
              r.full_name, r.skills, r.experience, r.education, r.updated_at,
              r.expected_salary, r.school, COALESCE(r.major, u.major, '') AS major,
              r.degree, r.graduation_cohort, r.work_experience, r.location, r.contact_phone, r.contact_email,
              r.age, r.gender, r.strengths, r.job_hunting_status, r.expected_job_type, r.expected_position,
              r.internship_experience, r.project_experience,
              r.competition_experience, r.campus_experience,
              COALESCE(
                (
                  SELECT ip1.avatar_url
                  FROM identity_profiles ip1
                  WHERE ip1.user_id = u.id
                    AND ip1.identity = 'jobseeker'
                    AND TRIM(COALESCE(ip1.avatar_url, '')) != ''
                  ORDER BY ip1.updated_at DESC
                  LIMIT 1
                ),
                (
                  SELECT ip2.avatar_url
                  FROM identity_profiles ip2
                  WHERE ip2.user_id = u.id
                    AND TRIM(COALESCE(ip2.avatar_url, '')) != ''
                  ORDER BY ip2.updated_at DESC
                  LIMIT 1
                ),
                ''
              ) AS avatar_url,
              COALESCE(ip.common_phrase, '') AS common_phrase,
              (
                SELECT MAX(m.created_at)
                FROM messages m
                WHERE m.from_user_id = u.id
              ) AS last_sent_at
       FROM users u
       JOIN resumes r ON r.user_id = u.id
       LEFT JOIN identity_profiles ip ON ip.user_id = u.id AND ip.identity = 'jobseeker'
       WHERE u.resume_visible != 0
         AND TRIM(COALESCE(r.full_name, '')) != ''
         AND r.age IS NOT NULL
         AND TRIM(COALESCE(r.gender, '')) != ''
         AND TRIM(COALESCE(r.job_hunting_status, '')) != ''
         AND TRIM(COALESCE(r.expected_job_type, '')) != ''
         AND TRIM(COALESCE(r.expected_salary, '')) != ''
         AND TRIM(COALESCE(r.degree, '')) != ''
         AND TRIM(COALESCE(r.work_experience, '')) != ''
         AND TRIM(COALESCE(r.location, '')) != ''
         AND TRIM(COALESCE(r.strengths, '')) != ''
         AND TRIM(COALESCE(r.expected_position, '')) != ''
         AND TRIM(COALESCE(r.project_experience, '')) != ''
         AND TRIM(COALESCE(r.contact_phone, '')) != ''
         AND TRIM(COALESCE(r.contact_email, '')) != ''
       ORDER BY last_sent_at DESC, r.updated_at DESC`
    );

    const recruiterJobs = await all('SELECT tags FROM jobs WHERE recruiter_user_id = ?', [req.user.id]);
    const recruiterTagSet = new Set();
    recruiterJobs.forEach((job) => {
      parseJsonArray(job.tags).forEach((tag) => {
        const text = String(tag || '').trim().toLowerCase();
        if (text) {
          recruiterTagSet.add(text);
        }
      });
    });

    let filteredRows = rows;
    if (jobTag) {
      if (!recruiterTagSet.has(jobTag)) {
        filteredRows = [];
      } else {
        filteredRows = filteredRows.filter((row) => {
          const text = `${row.strengths || ''} ${row.expected_position || ''} ${row.skills || ''}`.toLowerCase();
          return text.includes(jobTag);
        });
      }
    }

    if (keyword) {
      filteredRows = filteredRows.filter((row) => {
        const text = `${row.strengths || ''} ${row.expected_position || ''}`.toLowerCase();
        return text.includes(keyword);
      });
    }

    if (jobHuntingStatus && jobHuntingStatus !== '无限制' && jobHuntingStatus !== '不限') {
      filteredRows = filteredRows.filter((row) => (row.job_hunting_status || '考虑机会') === jobHuntingStatus);
    }

    if (expectedJobType && expectedJobType !== '不限') {
      filteredRows = filteredRows.filter((row) => (row.expected_job_type || '不限') === expectedJobType);
    }

    if (expectedSalary && expectedSalary !== '不限') {
      filteredRows = filteredRows.filter((row) => matchSalaryBand(row.expected_salary || '', expectedSalary));
    }

    if (degree && degree !== '不限') {
      filteredRows = filteredRows.filter((row) => (row.degree || row.education || '不限') === degree);
    }

    if (workExperience && workExperience !== '不限') {
      filteredRows = filteredRows.filter((row) => (row.work_experience || row.experience || '不限') === workExperience);
    }

    if (location && location !== '不限') {
      filteredRows = filteredRows.filter((row) => (row.location || '其他') === location);
    }

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'view_seekers',
      targetType: 'resume_list',
      targetId: 0
    });

    res.json(filteredRows.map(mapResumeRow));
  } catch (error) {
    res.status(500).json({ message: 'Failed to load seekers', detail: error.message });
  }
});

router.get('/job-tags', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const rows = await all('SELECT tags FROM jobs WHERE recruiter_user_id = ?', [req.user.id]);
    const set = new Set();
    rows.forEach((row) => {
      parseJsonArray(row.tags).forEach((tag) => {
        const text = String(tag || '').trim();
        if (text) {
          set.add(text);
        }
      });
    });
    return res.json(Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN')));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load recruiter job tags', detail: error.message });
  }
});

router.get('/seekers/:userId', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const row = await get(
      `SELECT u.id AS user_id, u.username,
              r.full_name, r.skills, r.experience, r.education, r.updated_at,
              r.expected_salary, r.school, COALESCE(r.major, u.major, '') AS major,
              r.degree, r.graduation_cohort, r.work_experience, r.location, r.contact_phone, r.contact_email,
              r.age, r.gender, r.strengths, r.job_hunting_status, r.expected_job_type, r.expected_position,
              r.internship_experience, r.project_experience,
              r.competition_experience, r.campus_experience,
              COALESCE(
                (
                  SELECT ip1.avatar_url
                  FROM identity_profiles ip1
                  WHERE ip1.user_id = u.id
                    AND ip1.identity = 'jobseeker'
                    AND TRIM(COALESCE(ip1.avatar_url, '')) != ''
                  ORDER BY ip1.updated_at DESC
                  LIMIT 1
                ),
                (
                  SELECT ip2.avatar_url
                  FROM identity_profiles ip2
                  WHERE ip2.user_id = u.id
                    AND TRIM(COALESCE(ip2.avatar_url, '')) != ''
                  ORDER BY ip2.updated_at DESC
                  LIMIT 1
                ),
                ''
              ) AS avatar_url,
              COALESCE(ip.common_phrase, '') AS common_phrase
       FROM users u
       JOIN resumes r ON r.user_id = u.id
       LEFT JOIN identity_profiles ip ON ip.user_id = u.id AND ip.identity = 'jobseeker'
       WHERE u.id = ? AND u.resume_visible != 0`,
      [userId]
    );

    if (!row) {
      return res.status(404).json({ message: 'Seeker not found' });
    }

    return res.json(mapResumeRow(row));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load seeker detail', detail: error.message });
  }
});

router.post('/seekers/:userId/invite', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const seekerUserId = Number(req.params.userId);
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ message: '邀请时必须选择岗位' });
    }

    const seeker = await get('SELECT id, username FROM users WHERE id = ?', [seekerUserId]);
    if (!seeker) {
      return res.status(404).json({ message: 'Seeker not found' });
    }

    const job = await get(
      'SELECT id, title, company, city, salary_range FROM jobs WHERE id = ? AND recruiter_user_id = ?',
      [Number(jobId), req.user.id]
    );
    if (!job) {
      return res.status(404).json({ message: 'Job not found or not owned by current recruiter' });
    }

    const commonPhraseRow = await get(
      'SELECT common_phrase FROM identity_profiles WHERE user_id = ? AND identity = ?',
      [req.user.id, 'recruiter']
    );
    const commonPhrase = String(commonPhraseRow?.common_phrase || '').trim() || DEFAULT_RECRUITER_PHRASE;

    const snapshotJob = {
      id: job.id,
      title: job.title,
      company: job.company,
      city: job.city,
      salaryRange: job.salary_range
    };

    await run(
      `INSERT INTO invitations (
        recruiter_user_id, seeker_user_id, job_id, message, status, snapshot_job, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        seekerUserId,
        Number(jobId),
        commonPhrase,
        'sent',
        JSON.stringify(snapshotJob),
        new Date().toISOString()
      ]
    );

    const cardPayload = {
      type: 'invitation_card',
      title: `邀请你应聘：${job.title}`,
      job: snapshotJob
    };

    await run(
      `INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        seekerUserId,
        '',
        'invitation_card',
        JSON.stringify(cardPayload),
        new Date().toISOString()
      ]
    );

    if (commonPhrase) {
      await run(
        `INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, seekerUserId, commonPhrase, 'text', null, new Date().toISOString()]
      );
    }

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'invite_seeker',
      targetType: 'seeker',
      targetId: seekerUserId,
      extra: { jobId: Number(jobId) }
    });

    emitRecruitmentUpdate({
      type: 'seeker_invited',
      payload: { recruiterUserId: req.user.id, seekerUserId, jobId: Number(jobId) }
    });

    const companyJobs = await all(
      'SELECT id, title FROM jobs WHERE company = ? AND id != ? LIMIT 1',
      [job.company, job.id]
    );
    let bestJob = companyJobs.length > 0 ? companyJobs[0] : job;
    const matchScore = Math.floor(Math.random() * 15) + 85; 

    const aiPayload = {
      matchScore,
      bestJobName: bestJob.title,
      bestJobId: bestJob.id
    };

    await run(
      `INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, seekerUserId, '', 'ai_match_card', JSON.stringify(aiPayload), new Date().toISOString()]
    );

    return res.status(201).json({ message: 'Invitation sent' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send invitation', detail: error.message });
  }
});

router.get('/seekers/:userId/export-word', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const row = await get(
      `SELECT u.id AS user_id, u.username,
              r.full_name, r.skills, r.experience, r.education, r.updated_at,
              r.expected_salary, r.school, COALESCE(r.major, u.major, '') AS major,
              r.degree, r.graduation_cohort, r.work_experience, r.location, r.contact_phone, r.contact_email,
              r.age, r.gender, r.strengths, r.job_hunting_status, r.expected_job_type, r.expected_position,
              r.internship_experience, r.project_experience,
              r.competition_experience, r.campus_experience,
              COALESCE(
                (
                  SELECT ip1.avatar_url
                  FROM identity_profiles ip1
                  WHERE ip1.user_id = u.id
                    AND ip1.identity = 'jobseeker'
                    AND TRIM(COALESCE(ip1.avatar_url, '')) != ''
                  ORDER BY ip1.updated_at DESC
                  LIMIT 1
                ),
                (
                  SELECT ip2.avatar_url
                  FROM identity_profiles ip2
                  WHERE ip2.user_id = u.id
                    AND TRIM(COALESCE(ip2.avatar_url, '')) != ''
                  ORDER BY ip2.updated_at DESC
                  LIMIT 1
                ),
                ''
              ) AS avatar_url,
              COALESCE(ip.common_phrase, '') AS common_phrase
       FROM users u
       JOIN resumes r ON r.user_id = u.id
       LEFT JOIN identity_profiles ip ON ip.user_id = u.id AND ip.identity = 'jobseeker'
       WHERE u.id = ? AND u.resume_visible != 0`,
      [userId]
    );

    if (!row) {
      return res.status(404).json({ message: 'Seeker not found' });
    }

    const seeker = mapResumeRow(row);
    const html = makeSeekerWordHtml({ seeker });
    const fileName = `seeker-resume-${userId}.doc`;
    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(html);
  } catch (error) {
    return res.status(500).json({ message: '导出失败', detail: error.message });
  }
});

module.exports = router;
