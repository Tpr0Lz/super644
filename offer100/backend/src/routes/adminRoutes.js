const express = require('express');
const { get, run, all } = require('../data/db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.username !== 'adm') {
    return res.status(403).json({ error: 'Require admin role' });
  }
  next();
});

router.get('/users', async (req, res) => {
  try {
    const rows = await all(
      `SELECT id, username, nickname, role, status, can_publish_jobs, resume_visible, created_at
       FROM users
       ORDER BY id ASC`
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        username: row.username,
        nickname: row.nickname || row.username,
        role: row.role,
        status: row.status || 'active',
        canPublishJobs: Number(row.can_publish_jobs ?? 1) !== 0,
        resumeVisible: Number(row.resume_visible ?? 1) !== 0,
        createdAt: row.created_at || ''
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/seekers', async (req, res) => {
  try {
    const rows = await all(
      `SELECT u.id AS user_id, u.username,
              r.full_name, r.skills, r.experience, r.education, r.updated_at,
              r.expected_salary, r.school, COALESCE(r.major, u.major, '') AS major,
              r.degree, r.graduation_cohort, r.work_experience, r.location, r.contact_phone, r.contact_email,
              r.age, r.gender, r.strengths, r.job_hunting_status, r.expected_job_type, r.expected_position,
              r.internship_experience, r.project_experience, r.competition_experience, r.campus_experience,
              COALESCE(ip.avatar_url, '') AS avatar_url,
              COALESCE(ip.common_phrase, '') AS common_phrase
       FROM users u
       JOIN resumes r ON r.user_id = u.id
       LEFT JOIN identity_profiles ip ON ip.user_id = u.id AND ip.identity = 'jobseeker'
       WHERE TRIM(COALESCE(r.full_name, '')) != ''
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
       ORDER BY r.updated_at DESC`
    );

    res.json(
      rows.map((row) => ({
        userId: row.user_id,
        username: row.username,
        fullName: row.full_name,
        skills: row.skills || '',
        experience: row.experience || '',
        education: row.education || '',
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
        strengths: row.strengths || '',
        jobHuntingStatus: row.job_hunting_status || '考虑机会',
        expectedJobType: row.expected_job_type || '不限',
        expectedPosition: row.expected_position || '',
        internshipExperience: row.internship_experience || '',
        projectExperience: row.project_experience || '',
        competitionExperience: row.competition_experience || '',
        campusExperience: row.campus_experience || '',
        avatarUrl: row.avatar_url || '',
        commonPhrase: row.common_phrase || '',
        updatedAt: row.updated_at || ''
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/jobs/:id', async (req, res) => {
  try {
    await run('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id/disable-publish', async (req, res) => {
  try {
    await run('UPDATE users SET can_publish_jobs = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id/hide-resume', async (req, res) => {
  try {
    await run('UPDATE users SET resume_visible = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  const { category_l1, category_l2 } = req.body;
  try {
    const result = await run('INSERT INTO job_categories (category_l1, category_l2) VALUES (?, ?)', [category_l1, category_l2]);
    res.json({ id: result.lastID, category_l1, category_l2 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
