const express = require('express');
const { all, get, run } = require('../data/db');
const { authenticate, requireIdentity } = require('../middleware/auth');
const { trackBehavior } = require('../services/behaviorService');
const { emitRecruitmentUpdate } = require('../modules/socketHub');

const router = express.Router();
const DEFAULT_JOBSEEKER_PHRASE = '你好，我对贵公司的该岗位很感兴趣，想跟您详细聊聊';

function normalizeUnlimited(value) {
  const text = String(value || '').trim();
  if (!text || text === '无限制') {
    return '不限';
  }
  return text;
}

router.get('/', authenticate, async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const tag = String(req.query.tag || '').trim().toLowerCase();
    const categoryL1 = String(req.query.categoryL1 || '').trim();
    const categoryL2 = String(req.query.categoryL2 || '').trim();
    const educationRequirement = String(req.query.educationRequirement || '').trim();
    const experienceRequirement = String(req.query.experienceRequirement || '').trim();
    const employmentType = String(req.query.employmentType || '').trim();
    const city = String(req.query.city || '').trim();
    const companySize = String(req.query.companySize || '').trim();

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'view_jobs',
      targetType: 'job_list',
      targetId: 0
    });

    const rows = await all(
            `SELECT j.id, j.title, j.company, j.city, j.salary_range,
              j.employment_type, j.company_size,
              j.experience_requirement, j.education_requirement,
              j.category_l1, j.category_l2,
              j.tags, j.description, j.publish_at, j.recruiter_user_id,
              COALESCE(c.address, '') AS company_address,
              COALESCE(c.intro, '') AS company_intro,
              lm.last_sent_at
       FROM jobs j
             LEFT JOIN companies c ON c.user_id = j.recruiter_user_id
       LEFT JOIN (
         SELECT from_user_id, MAX(created_at) AS last_sent_at
         FROM messages
         GROUP BY from_user_id
       ) lm ON lm.from_user_id = j.recruiter_user_id`
    );

    const jobs = rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      city: row.city,
      salaryRange: row.salary_range,
      employmentType: row.employment_type || '不限',
      companySize: row.company_size || '不限',
      experienceRequirement: normalizeUnlimited(row.experience_requirement),
      educationRequirement: normalizeUnlimited(row.education_requirement),
      categoryL1: row.category_l1 || '',
      categoryL2: row.category_l2 || '',
      tags: (() => {
        try {
          return row.tags ? JSON.parse(row.tags) : [];
        } catch (error) {
          return [];
        }
      })(),
      description: row.description,
      publishAt: row.publish_at,
      recruiterUserId: row.recruiter_user_id,
      companyAddress: row.company_address || '',
      companyIntro: row.company_intro || '',
      recruiterLastActiveAt: row.last_sent_at || ''
    }));

    const filtered = jobs.filter((job) => {
      if (categoryL1 && job.categoryL1 !== categoryL1) {
        return false;
      }
      if (categoryL2 && job.categoryL2 !== categoryL2) {
        return false;
      }
      if (educationRequirement && educationRequirement !== '全部学历' && educationRequirement !== '不限' && job.educationRequirement !== educationRequirement) {
        return false;
      }
      if (experienceRequirement && experienceRequirement !== '不限' && job.experienceRequirement !== experienceRequirement) {
        return false;
      }
      if (employmentType && employmentType !== '不限' && job.employmentType !== employmentType) {
        return false;
      }
      if (city && city !== '不限' && job.city !== city) {
        return false;
      }
      if (companySize && companySize !== '不限' && job.companySize !== companySize) {
        return false;
      }
      if (tag) {
        const hasTag = Array.isArray(job.tags)
          && job.tags.some((item) => String(item || '').toLowerCase().includes(tag));
        if (!hasTag) {
          return false;
        }
      }
      if (!keyword) {
        return true;
      }
      const haystack = [job.title, job.company, job.city, job.companyAddress]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });

    filtered.sort((a, b) => {
      const aActive = new Date(a.recruiterLastActiveAt || 0).getTime();
      const bActive = new Date(b.recruiterLastActiveAt || 0).getTime();
      if (bActive !== aActive) {
        return bActive - aActive;
      }
      const aPublish = new Date(a.publishAt || 0).getTime();
      const bPublish = new Date(b.publishAt || 0).getTime();
      if (bPublish !== aPublish) {
        return bPublish - aPublish;
      }
      return b.id - a.id;
    });

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load jobs', detail: error.message });
  }
});

router.get('/tags', authenticate, async (req, res) => {
  try {
    const rows = await all('SELECT tags FROM jobs');
    const set = new Set();
    for (const row of rows) {
      try {
        const parsed = row.tags ? JSON.parse(row.tags) : [];
        if (Array.isArray(parsed)) {
          parsed.forEach((tag) => {
            const text = String(tag || '').trim();
            if (text) {
              set.add(text);
            }
          });
        }
      } catch (error) {
        continue;
      }
    }
    res.json(Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN')));
  } catch (error) {
    res.status(500).json({ message: 'Failed to load tags', detail: error.message });
  }
});

router.get('/mine', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const rows = await all(
      `SELECT id, title, company, city, salary_range, employment_type, company_size,
              experience_requirement, education_requirement, category_l1, category_l2,
              tags, description, publish_at, recruiter_user_id
       FROM jobs
       WHERE recruiter_user_id = ?
       ORDER BY id DESC`,
      [req.user.id]
    );

    return res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        company: row.company,
        city: row.city,
        salaryRange: row.salary_range,
        employmentType: row.employment_type || '不限',
        companySize: row.company_size || '不限',
        experienceRequirement: normalizeUnlimited(row.experience_requirement),
        educationRequirement: normalizeUnlimited(row.education_requirement),
        categoryL1: row.category_l1 || '',
        categoryL2: row.category_l2 || '',
        tags: (() => {
          try {
            return row.tags ? JSON.parse(row.tags) : [];
          } catch (error) {
            return [];
          }
        })(),
        description: row.description,
        publishAt: row.publish_at,
        recruiterUserId: row.recruiter_user_id
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load recruiter jobs', detail: error.message });
  }
});

router.delete('/:id', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    if (!jobId) {
      return res.status(400).json({ message: 'Invalid job id' });
    }

    const target = await get('SELECT id, recruiter_user_id, title FROM jobs WHERE id = ?', [jobId]);
    if (!target) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (target.recruiter_user_id !== req.user.id) {
      return res.status(403).json({ message: '无权删除该岗位' });
    }

    await run('DELETE FROM jobs WHERE id = ?', [jobId]);

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'delete_job',
      targetType: 'job',
      targetId: jobId,
      extra: { title: target.title }
    });

    emitRecruitmentUpdate({
      type: 'job_deleted',
      payload: {
        jobId,
        recruiterUserId: req.user.id,
        at: new Date().toISOString()
      }
    });

    return res.json({ message: 'Job deleted', jobId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete job', detail: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const row = await get(
          `SELECT j.id, j.title, j.company, j.city, j.salary_range,
            j.employment_type, j.company_size,
            j.experience_requirement, j.education_requirement,
            j.category_l1, j.category_l2,
            j.tags, j.description, j.publish_at,
              j.recruiter_user_id, u.nickname AS recruiter_nickname,
              COALESCE(c.address, '') AS company_address,
              COALESCE(c.intro, '') AS company_intro,
              COALESCE(
                (
                  SELECT ip1.avatar_url
                  FROM identity_profiles ip1
                  WHERE ip1.user_id = j.recruiter_user_id
                    AND ip1.identity = 'recruiter'
                    AND TRIM(COALESCE(ip1.avatar_url, '')) != ''
                  ORDER BY ip1.updated_at DESC
                  LIMIT 1
                ),
                (
                  SELECT ip2.avatar_url
                  FROM identity_profiles ip2
                  WHERE ip2.user_id = j.recruiter_user_id
                    AND TRIM(COALESCE(ip2.avatar_url, '')) != ''
                  ORDER BY ip2.updated_at DESC
                  LIMIT 1
                ),
                ''
              ) AS recruiter_avatar,
              (
                SELECT MAX(m.created_at)
                FROM messages m
                WHERE m.from_user_id = j.recruiter_user_id
              ) AS recruiter_last_active_at
       FROM jobs j
       LEFT JOIN users u ON u.id = j.recruiter_user_id
       LEFT JOIN companies c ON c.user_id = j.recruiter_user_id
       WHERE j.id = ?`,
      [jobId]
    );

    if (!row) {
      return res.status(404).json({ message: 'Job not found' });
    }

    return res.json({
      id: row.id,
      title: row.title,
      company: row.company,
      city: row.city,
      salaryRange: row.salary_range,
      employmentType: row.employment_type || '不限',
      companySize: row.company_size || '不限',
      experienceRequirement: normalizeUnlimited(row.experience_requirement),
      educationRequirement: normalizeUnlimited(row.education_requirement),
      categoryL1: row.category_l1 || '',
      categoryL2: row.category_l2 || '',
      tags: (() => {
        try {
          return row.tags ? JSON.parse(row.tags) : [];
        } catch (error) {
          return [];
        }
      })(),
      description: row.description,
      publishAt: row.publish_at,
      recruiterUserId: row.recruiter_user_id,
      recruiterNickname: row.recruiter_nickname,
      companyAddress: row.company_address || '',
      companyIntro: row.company_intro || '',
      recruiterAvatar: row.recruiter_avatar || '',
      recruiterLastActiveAt: row.recruiter_last_active_at || ''
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load job detail', detail: error.message });
  }
});

router.post('/', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const {
      title,
      company,
      city,
      salaryRange,
      employmentType = '不限',
      companySize = '不限',
      experienceRequirement = '不限',
      educationRequirement = '不限',
      categoryL1 = '互联网 / AI',
      categoryL2 = title,
      tags = [],
      description,
      companyAddress = '',
      companyIntro = ''
    } = req.body;
    const publishAt = new Date().toISOString().slice(0, 10);

    const duplicate = await get(
      `SELECT id FROM jobs
       WHERE recruiter_user_id = ?
         AND title = ?
         AND company = ?
         AND city = ?
         AND category_l1 = ?
         AND category_l2 = ?
       LIMIT 1`,
      [req.user.id, title, company, city, categoryL1, categoryL2]
    );

    if (duplicate) {
      return res.status(409).json({ message: '检测到重复岗位（名称、公司、城市、外层分类、内层岗位一致），请勿重复发布' });
    }

    const insert = await run(
      `INSERT INTO jobs (
        title, company, city, salary_range, employment_type, company_size, experience_requirement, education_requirement,
        category_l1, category_l2, tags, description, publish_at, recruiter_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        title,
        company,
        city,
        salaryRange,
        employmentType,
        companySize,
        normalizeUnlimited(experienceRequirement),
        normalizeUnlimited(educationRequirement),
        categoryL1,
        categoryL2,
        JSON.stringify(tags),
        description,
        publishAt,
        req.user.id
      ]
    );

    const newJob = {
      id: insert.lastID,
      title,
      company,
      city,
      salaryRange,
      employmentType,
      companySize,
      experienceRequirement: normalizeUnlimited(experienceRequirement),
      educationRequirement: normalizeUnlimited(educationRequirement),
      categoryL1,
      categoryL2,
      tags,
      description,
      publishAt,
      recruiterUserId: req.user.id,
      companyAddress: companyAddress || '',
      companyIntro: companyIntro || ''
    };

    const existedCompany = await get('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
    if (existedCompany) {
      await run(
        `UPDATE companies
         SET name = ?, address = ?, company_size = ?, intro = ?, updated_at = ?
         WHERE user_id = ?`,
        [company, companyAddress || '', companySize || '不限', companyIntro || '', new Date().toISOString(), req.user.id]
      );
    } else {
      await run(
        `INSERT INTO companies (user_id, name, intro, website, address, company_size, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, company, companyIntro || '', '', companyAddress || '', companySize || '不限', new Date().toISOString()]
      );
    }

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'create_job',
      targetType: 'job',
      targetId: newJob.id,
      extra: { title: newJob.title }
    });

    emitRecruitmentUpdate({ type: 'job_created', job: newJob });
    res.status(201).json(newJob);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create job', detail: error.message });
  }
});

router.post('/:id/apply', authenticate, requireIdentity(['jobseeker']), async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const targetJob = await get(
      'SELECT id, title, company, city, salary_range, recruiter_user_id FROM jobs WHERE id = ?',
      [jobId]
    );

    if (!targetJob) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (!targetJob.recruiter_user_id) {
      return res.status(400).json({ message: '岗位缺少招聘者信息，暂不可投递' });
    }

    const existed = await get(
      'SELECT id FROM applications WHERE job_id = ? AND seeker_user_id = ?',
      [jobId, req.user.id]
    );
    if (existed) {
      return res.status(409).json({ message: 'You already applied this job' });
    }

    const profile = await get(
      `SELECT full_name, age, gender, strengths, expected_position,
              internship_experience, project_experience, competition_experience, campus_experience
       FROM identity_profiles
       WHERE user_id = ? AND identity = 'jobseeker'`,
      [req.user.id]
    );

    const commonPhraseRow = await get(
      'SELECT common_phrase FROM identity_profiles WHERE user_id = ? AND identity = ?',
      [req.user.id, 'jobseeker']
    );
    const commonPhrase = String(commonPhraseRow?.common_phrase || '').trim() || DEFAULT_JOBSEEKER_PHRASE;

    const snapshotProfile = {
      userId: req.user.id,
      fullName: profile?.full_name || req.user.username,
      age: profile?.age || null,
      gender: profile?.gender || '',
      strengths: profile?.strengths || '',
      expectedPosition: profile?.expected_position || '',
      internshipExperience: profile?.internship_experience || '',
      projectExperience: profile?.project_experience || '',
      competitionExperience: profile?.competition_experience || '',
      campusExperience: profile?.campus_experience || ''
    };

    await run(
      'INSERT INTO applications (job_id, seeker_user_id, message, status, snapshot_profile, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        jobId,
        req.user.id,
        commonPhrase,
        'pending',
        JSON.stringify(snapshotProfile),
        new Date().toISOString()
      ]
    );

    const cardPayload = {
      type: 'application_card',
      title: `投递：${targetJob.title}`,
      job: {
        id: targetJob.id,
        title: targetJob.title,
        company: targetJob.company,
        city: targetJob.city,
        salaryRange: targetJob.salary_range
      },
      seeker: snapshotProfile
    };

    await run(
      `INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        targetJob.recruiter_user_id,
        '',
        'application_card',
        JSON.stringify(cardPayload),
        new Date().toISOString()
      ]
    );

    if (commonPhrase) {
      await run(
        `INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, targetJob.recruiter_user_id, commonPhrase, 'text', null, new Date().toISOString()]
      );
    }

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'apply_job',
      targetType: 'job',
      targetId: jobId,
      extra: { company: targetJob.company }
    });

    emitRecruitmentUpdate({
      type: 'job_applied',
      payload: {
        jobId,
        applicant: req.user.username,
        recruiterUserId: targetJob.recruiter_user_id,
        role: req.user.activeIdentity,
        at: new Date().toISOString()
      }
    });

    return res.json({ message: 'Application submitted', jobId });
  } catch (error) {
    return res.status(500).json({ message: 'Application failed', detail: error.message });
  }
});

module.exports = router;
