const express = require('express');
const { all, get, run } = require('../data/db');
const { authenticate, requireIdentity } = require('../middleware/auth');
const { trackBehavior } = require('../services/behaviorService');
const { emitRecruitmentUpdate } = require('../modules/socketHub');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'view_jobs',
      targetType: 'job_list',
      targetId: 0
    });

    const rows = await all(
      'SELECT id, title, company, city, salary_range, tags, description, publish_at, recruiter_user_id FROM jobs ORDER BY id DESC'
    );

    const jobs = rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      city: row.city,
      salaryRange: row.salary_range,
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
    }));

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load jobs', detail: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const row = await get(
      `SELECT j.id, j.title, j.company, j.city, j.salary_range, j.tags, j.description, j.publish_at,
              j.recruiter_user_id, u.nickname AS recruiter_nickname,
              COALESCE(ip.avatar_url, '') AS recruiter_avatar
       FROM jobs j
       LEFT JOIN users u ON u.id = j.recruiter_user_id
       LEFT JOIN identity_profiles ip ON ip.user_id = j.recruiter_user_id AND ip.identity = 'recruiter'
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
      recruiterAvatar: row.recruiter_avatar || ''
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load job detail', detail: error.message });
  }
});

router.post('/', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const { title, company, city, salaryRange, tags = [], description } = req.body;
    const publishAt = new Date().toISOString().slice(0, 10);

    const insert = await run(
      'INSERT INTO jobs (title, company, city, salary_range, tags, description, publish_at, recruiter_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, company, city, salaryRange, JSON.stringify(tags), description, publishAt, req.user.id]
    );

    const newJob = {
      id: insert.lastID,
      title,
      company,
      city,
      salaryRange,
      tags,
      description,
      publishAt,
      recruiterUserId: req.user.id
    };

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
    const commonPhrase = commonPhraseRow?.common_phrase || '';

    const snapshotProfile = {
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
        `${req.user.username} 向你投递了岗位`,
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
