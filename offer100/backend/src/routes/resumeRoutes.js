const express = require('express');
const { all, get, run } = require('../data/db');
const { authenticate, requireIdentity } = require('../middleware/auth');
const { trackBehavior } = require('../services/behaviorService');
const { emitRecruitmentUpdate } = require('../modules/socketHub');

const router = express.Router();

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
    strengths: row.strengths,
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
              r.age, r.gender, r.strengths, r.expected_position,
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
        age: null,
        gender: '',
        strengths: '',
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
      age,
      gender,
      strengths,
      expectedPosition,
      internshipExperience,
      projectExperience,
      competitionExperience,
      campusExperience,
      avatarUrl,
      commonPhrase
    } = req.body;

    const now = new Date().toISOString();
    const existed = await get('SELECT id FROM resumes WHERE user_id = ?', [req.user.id]);

    if (existed) {
      await run(
        `UPDATE resumes
         SET full_name = ?, skills = ?, experience = ?, education = ?,
             age = ?, gender = ?, strengths = ?, expected_position = ?,
             internship_experience = ?, project_experience = ?,
             competition_experience = ?, campus_experience = ?, updated_at = ?
         WHERE user_id = ?`,
        [
          fullName,
          skills,
          experience,
          education,
          age ? Number(age) : null,
          gender,
          strengths,
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
          user_id, full_name, skills, experience, education, age, gender, strengths,
          expected_position, internship_experience, project_experience,
          competition_experience, campus_experience, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          fullName,
          skills,
          experience,
          education,
          age ? Number(age) : null,
          gender,
          strengths,
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
          expected_position, internship_experience, project_experience,
          competition_experience, campus_experience, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          'jobseeker',
          avatarUrl || '',
          commonPhrase || '',
          fullName || '',
          age ? Number(age) : null,
          gender || '',
          strengths || '',
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
        type: 'seeker_profile_ready',
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
    const rows = await all(
      `SELECT u.id AS user_id, u.username,
              r.full_name, r.skills, r.experience, r.education, r.updated_at,
              r.age, r.gender, r.strengths, r.expected_position,
              r.internship_experience, r.project_experience,
              r.competition_experience, r.campus_experience,
              COALESCE(ip.avatar_url, '') AS avatar_url,
              COALESCE(ip.common_phrase, '') AS common_phrase
       FROM users u
       JOIN resumes r ON r.user_id = u.id
       LEFT JOIN identity_profiles ip ON ip.user_id = u.id AND ip.identity = 'jobseeker'
       WHERE TRIM(COALESCE(r.expected_position, '')) != ''
         AND TRIM(COALESCE(r.strengths, '')) != ''
       ORDER BY r.updated_at DESC`
    );

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'view_seekers',
      targetType: 'resume_list',
      targetId: 0
    });

    res.json(rows.map(mapResumeRow));
  } catch (error) {
    res.status(500).json({ message: 'Failed to load seekers', detail: error.message });
  }
});

router.get('/seekers/:userId', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const row = await get(
      `SELECT u.id AS user_id, u.username,
              r.full_name, r.skills, r.experience, r.education, r.updated_at,
              r.age, r.gender, r.strengths, r.expected_position,
              r.internship_experience, r.project_experience,
              r.competition_experience, r.campus_experience,
              COALESCE(ip.avatar_url, '') AS avatar_url,
              COALESCE(ip.common_phrase, '') AS common_phrase
       FROM users u
       JOIN resumes r ON r.user_id = u.id
       LEFT JOIN identity_profiles ip ON ip.user_id = u.id AND ip.identity = 'jobseeker'
       WHERE u.id = ?`,
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
    const commonPhrase = commonPhraseRow?.common_phrase || '';

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
        `${req.user.username} 邀请你应聘岗位`,
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

    return res.status(201).json({ message: 'Invitation sent' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send invitation', detail: error.message });
  }
});

module.exports = router;
