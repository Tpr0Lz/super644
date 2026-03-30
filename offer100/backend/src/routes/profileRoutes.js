const express = require('express');
const { get, run } = require('../data/db');
const { authenticate } = require('../middleware/auth');
const { emitRecruitmentUpdate } = require('../modules/socketHub');
const { currentDateTime } = require('../utils/datetime');

const router = express.Router();
const JOB_HUNTING_STATUS = ['随时到岗', '月内到岗', '考虑机会', '暂不考虑'];

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

function parseIdentities(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function makeWordHtml({ nickname, identity, profile }) {
  const isRecruiter = identity === 'recruiter';
  const rows = [];

  const append = (label, value) => {
    const text = String(value || '').trim();
    if (text) {
      rows.push(`<tr><td class="label">${label}</td><td>${text}</td></tr>`);
    }
  };

  append('昵称', nickname);
  append('身份', isRecruiter ? '招聘者' : '求职者');

  if (isRecruiter) {
    append('公司名称', profile.company_name);
    append('公司地址', profile.company_address);
    append('公司规模', profile.company_size);
    append('公司介绍', profile.company_intro);
  } else {
    append('姓名', profile.full_name);
    append('年龄', profile.age);
    append('性别', profile.gender);
    append('期望薪资', profile.expected_salary);
    append('学校', profile.school);
    append('专业', profile.major);
    append('学历', profile.degree);
    append('毕业届别', profile.graduation_cohort);
    append('工作经验', profile.work_experience);
    append('个人所在地', profile.location);
    append('联系电话', profile.contact_phone);
    append('联系邮箱', profile.contact_email);
    append('求职状态', profile.job_hunting_status);
    append('求职类型', profile.expected_job_type);
    append('个人优势', profile.strengths);
    append('期望岗位', profile.expected_position);
    append('在校经历', profile.campus_experience);
    append('实习经历', profile.internship_experience);
    append('项目经历', profile.project_experience);
    append('比赛经历', profile.competition_experience);
  }

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
    <h1>职遇 资料导出</h1>
    <table>${rows.join('')}</table>
  </div>
</body>
</html>`;
}

function emitSeekerProfileUpdate(req, expectedPosition) {
  if (!isBlank(expectedPosition)) {
    emitRecruitmentUpdate({
      type: 'seeker_profile_updated',
      payload: {
        seekerUserId: req.user.id,
        username: req.user.username,
        expectedPosition: String(expectedPosition).trim()
      }
    });
  }
}

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await get(
      'SELECT id, username, nickname, identities, initial_identity FROM users WHERE id = ?',
      [req.user.id]
    );

    const profile = await get(
      'SELECT * FROM identity_profiles WHERE user_id = ? AND identity = ?',
      [req.user.id, req.user.activeIdentity]
    );

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        identities: parseIdentities(user.identities),
        initialIdentity: user.initial_identity
      },
      activeIdentity: req.user.activeIdentity,
      profile: profile || null
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load profile', detail: error.message });
  }
});

router.put('/me', authenticate, async (req, res) => {
  try {
    const now = currentDateTime();
    const identity = req.user.activeIdentity;
    const {
      nickname,
      avatarUrl,
      commonPhrase,
      companyName,
      companyAddress,
      companySize,
      companyIntro,
      fullName,
      age,
      gender,
      strengths,
      expectedSalary,
      school,
      major,
      degree,
      graduationCohort,
      workExperience,
      location,
      contactPhone,
      contactEmail,
      jobHuntingStatus,
      expectedJobType,
      expectedPosition,
      internshipExperience,
      projectExperience,
      competitionExperience,
      campusExperience
    } = req.body;

    if (nickname) {
      await run('UPDATE users SET nickname = ? WHERE id = ?', [nickname, req.user.id]);
    }

    if (identity === 'jobseeker' && jobHuntingStatus && !JOB_HUNTING_STATUS.includes(jobHuntingStatus)) {
      return res.status(400).json({ message: '求职状态不合法' });
    }

    if (identity === 'jobseeker') {
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
    }

    const existed = await get(
      'SELECT id FROM identity_profiles WHERE user_id = ? AND identity = ?',
      [req.user.id, identity]
    );

    if (existed) {
      await run(
        `UPDATE identity_profiles
         SET avatar_url = ?, common_phrase = ?,
             company_name = ?, company_address = ?, company_size = ?, company_intro = ?,
             full_name = ?, age = ?, gender = ?, strengths = ?,
             expected_salary = ?, school = ?, major = ?, degree = ?, graduation_cohort = ?, work_experience = ?, location = ?, contact_phone = ?, contact_email = ?,
             job_hunting_status = ?, expected_job_type = ?, expected_position = ?,
             internship_experience = ?, project_experience = ?, competition_experience = ?,
             campus_experience = ?, updated_at = ?
         WHERE user_id = ? AND identity = ?`,
        [
          avatarUrl || '',
          commonPhrase || '',
          companyName || '',
          companyAddress || '',
          companySize || '',
          companyIntro || '',
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
          identity === 'jobseeker' ? (jobHuntingStatus || '考虑机会') : '',
          identity === 'jobseeker' ? (expectedJobType || '不限') : '',
          expectedPosition || '',
          internshipExperience || '',
          projectExperience || '',
          competitionExperience || '',
          campusExperience || '',
          now,
          req.user.id,
          identity
        ]
      );
    } else {
      await run(
        `INSERT INTO identity_profiles (
          user_id, identity, avatar_url, common_phrase,
          company_name, company_address, company_size, company_intro,
          full_name, age, gender, strengths,
          expected_salary, school, major, degree, graduation_cohort, work_experience, location, contact_phone, contact_email,
          job_hunting_status, expected_job_type, expected_position,
          internship_experience, project_experience, competition_experience,
          campus_experience, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          identity,
          avatarUrl || '',
          commonPhrase || '',
          companyName || '',
          companyAddress || '',
          companySize || '',
          companyIntro || '',
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
          identity === 'jobseeker' ? (jobHuntingStatus || '考虑机会') : '',
          identity === 'jobseeker' ? (expectedJobType || '不限') : '',
          expectedPosition || '',
          internshipExperience || '',
          projectExperience || '',
          competitionExperience || '',
          campusExperience || '',
          now
        ]
      );
    }

    if (identity === 'recruiter') {
      const company = await get('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
      if (company) {
        await run(
          `UPDATE companies
           SET name = ?, intro = ?, address = ?, company_size = ?, updated_at = ?
           WHERE user_id = ?`,
          [companyName || '', companyIntro || '', companyAddress || '', companySize || '', now, req.user.id]
        );
      } else {
        await run(
          `INSERT INTO companies (user_id, name, intro, website, address, company_size, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [req.user.id, companyName || '', companyIntro || '', '', companyAddress || '', companySize || '', now]
        );
      }
    }

    if (identity === 'jobseeker') {
      const resume = await get('SELECT id FROM resumes WHERE user_id = ?', [req.user.id]);
      if (resume) {
        await run(
          `UPDATE resumes
           SET full_name = ?, age = ?, gender = ?, strengths = ?,
               expected_salary = ?, school = ?, major = ?, degree = ?, graduation_cohort = ?, work_experience = ?, location = ?, contact_phone = ?, contact_email = ?,
               job_hunting_status = ?, expected_job_type = ?, expected_position = ?,
               internship_experience = ?, project_experience = ?, competition_experience = ?,
               campus_experience = ?, updated_at = ?
           WHERE user_id = ?`,
          [
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
            req.user.id
          ]
        );
      } else {
        await run(
          `INSERT INTO resumes (
            user_id, full_name, skills, experience, education, gender, age, strengths,
            expected_salary, school, major, degree, graduation_cohort, work_experience, location, contact_phone, contact_email,
            job_hunting_status, expected_job_type, expected_position,
            internship_experience, project_experience, competition_experience,
            campus_experience, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            req.user.id,
            fullName || '',
            '',
            internshipExperience || '',
            '',
            gender || '',
            age ? Number(age) : null,
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

      emitSeekerProfileUpdate(req, expectedPosition);
    }

    return res.json({ message: 'Profile saved' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save profile', detail: error.message });
  }
});

router.post('/register-identity', authenticate, async (req, res) => {
  try {
    const { identity, recruiterProfile = {}, jobseekerProfile = {} } = req.body;

    if (!['recruiter', 'jobseeker'].includes(identity)) {
      return res.status(400).json({ message: 'identity must be recruiter or jobseeker' });
    }

    const user = await get('SELECT identities FROM users WHERE id = ?', [req.user.id]);
    const identities = parseIdentities(user.identities);
    if (identities.includes(identity)) {
      return res.status(409).json({ message: '该身份已注册' });
    }

    const now = currentDateTime();
    if (identity === 'recruiter') {
      if (!recruiterProfile.companyName || !recruiterProfile.companyAddress || !recruiterProfile.companySize) {
        return res.status(400).json({ message: '招聘者身份需要公司名称、地址、规模' });
      }

      await run(
        `INSERT INTO identity_profiles (
          user_id, identity, avatar_url, common_phrase,
          company_name, company_address, company_size, company_intro, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          'recruiter',
          recruiterProfile.avatarUrl || '',
          recruiterProfile.commonPhrase || '',
          recruiterProfile.companyName,
          recruiterProfile.companyAddress,
          recruiterProfile.companySize,
          recruiterProfile.companyIntro || '',
          now
        ]
      );

      const companyExisted = await get('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
      if (companyExisted) {
        await run(
          `UPDATE companies
           SET name = ?, intro = ?, address = ?, company_size = ?, updated_at = ?
           WHERE user_id = ?`,
          [
            recruiterProfile.companyName,
            recruiterProfile.companyIntro || '',
            recruiterProfile.companyAddress,
            recruiterProfile.companySize,
            now,
            req.user.id
          ]
        );
      } else {
        await run(
          `INSERT INTO companies (user_id, name, intro, website, address, company_size, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            recruiterProfile.companyName,
            recruiterProfile.companyIntro || '',
            '',
            recruiterProfile.companyAddress,
            recruiterProfile.companySize,
            now
          ]
        );
      }
    }

    if (identity === 'jobseeker') {
      if (jobseekerProfile.jobHuntingStatus && !JOB_HUNTING_STATUS.includes(jobseekerProfile.jobHuntingStatus)) {
        return res.status(400).json({ message: '求职状态不合法' });
      }

      const requiredMessage = validateRequiredJobseekerProfile({
        fullName: jobseekerProfile.fullName,
        age: jobseekerProfile.age,
        gender: jobseekerProfile.gender,
        jobHuntingStatus: jobseekerProfile.jobHuntingStatus,
        expectedJobType: jobseekerProfile.expectedJobType,
        expectedSalary: jobseekerProfile.expectedSalary,
        degree: jobseekerProfile.degree,
        workExperience: jobseekerProfile.workExperience,
        location: jobseekerProfile.location,
        strengths: jobseekerProfile.strengths,
        expectedPosition: jobseekerProfile.expectedPosition,
        projectExperience: jobseekerProfile.projectExperience,
        contactPhone: jobseekerProfile.contactPhone,
        contactEmail: jobseekerProfile.contactEmail
      });
      if (requiredMessage) {
        return res.status(400).json({ message: requiredMessage });
      }

      await run(
        `INSERT INTO identity_profiles (
          user_id, identity, avatar_url, common_phrase,
          full_name, age, gender, strengths,
          expected_salary, school, major, degree, graduation_cohort, work_experience, location, contact_phone, contact_email,
          job_hunting_status, expected_job_type, expected_position,
          internship_experience, project_experience, competition_experience,
          campus_experience, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          'jobseeker',
          jobseekerProfile.avatarUrl || '',
          jobseekerProfile.commonPhrase || '',
          jobseekerProfile.fullName,
          Number(jobseekerProfile.age),
          jobseekerProfile.gender,
          jobseekerProfile.strengths,
          jobseekerProfile.expectedSalary || '',
          jobseekerProfile.school || '',
          jobseekerProfile.major || '',
          jobseekerProfile.degree || '',
          jobseekerProfile.graduationCohort || '',
          jobseekerProfile.workExperience || '',
          jobseekerProfile.location || '其他',
          jobseekerProfile.contactPhone || '',
          jobseekerProfile.contactEmail || '',
          jobseekerProfile.jobHuntingStatus || '考虑机会',
          jobseekerProfile.expectedJobType || '不限',
          jobseekerProfile.expectedPosition || '',
          jobseekerProfile.internshipExperience || '',
          jobseekerProfile.projectExperience || '',
          jobseekerProfile.competitionExperience || '',
          jobseekerProfile.campusExperience || '',
          now
        ]
      );

      const resumeExisted = await get('SELECT id FROM resumes WHERE user_id = ?', [req.user.id]);
      if (resumeExisted) {
        await run(
          `UPDATE resumes
           SET full_name = ?, age = ?, gender = ?, strengths = ?,
               expected_salary = ?, school = ?, major = ?, degree = ?, graduation_cohort = ?, work_experience = ?, location = ?, contact_phone = ?, contact_email = ?,
               job_hunting_status = ?, expected_job_type = ?, expected_position = ?,
               internship_experience = ?, project_experience = ?, competition_experience = ?,
               campus_experience = ?, updated_at = ?
           WHERE user_id = ?`,
          [
            jobseekerProfile.fullName,
            Number(jobseekerProfile.age),
            jobseekerProfile.gender,
            jobseekerProfile.strengths,
            jobseekerProfile.expectedSalary || '',
            jobseekerProfile.school || '',
            jobseekerProfile.major || '',
            jobseekerProfile.degree || '',
            jobseekerProfile.graduationCohort || '',
            jobseekerProfile.workExperience || '',
            jobseekerProfile.location || '其他',
            jobseekerProfile.contactPhone || '',
            jobseekerProfile.contactEmail || '',
            jobseekerProfile.jobHuntingStatus || '考虑机会',
            jobseekerProfile.expectedJobType || '不限',
            jobseekerProfile.expectedPosition || '',
            jobseekerProfile.internshipExperience || '',
            jobseekerProfile.projectExperience || '',
            jobseekerProfile.competitionExperience || '',
            jobseekerProfile.campusExperience || '',
            now,
            req.user.id
          ]
        );
      } else {
        await run(
          `INSERT INTO resumes (
            user_id, full_name, skills, experience, education, gender, age, strengths,
            expected_salary, school, major, degree, graduation_cohort, work_experience, location, contact_phone, contact_email,
            job_hunting_status, expected_job_type, expected_position,
            internship_experience, project_experience, competition_experience,
            campus_experience, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            req.user.id,
            jobseekerProfile.fullName,
            '',
            jobseekerProfile.internshipExperience || '',
            '',
            jobseekerProfile.gender,
            Number(jobseekerProfile.age),
            jobseekerProfile.strengths,
            jobseekerProfile.expectedSalary || '',
            jobseekerProfile.school || '',
            jobseekerProfile.major || '',
            jobseekerProfile.degree || '',
            jobseekerProfile.graduationCohort || '',
            jobseekerProfile.workExperience || '',
            jobseekerProfile.location || '其他',
            jobseekerProfile.contactPhone || '',
            jobseekerProfile.contactEmail || '',
            jobseekerProfile.jobHuntingStatus || '考虑机会',
            jobseekerProfile.expectedJobType || '不限',
            jobseekerProfile.expectedPosition || '',
            jobseekerProfile.internshipExperience || '',
            jobseekerProfile.projectExperience || '',
            jobseekerProfile.competitionExperience || '',
            jobseekerProfile.campusExperience || '',
            now
          ]
        );
      }

      emitSeekerProfileUpdate(req, jobseekerProfile.expectedPosition);
    }

    const nextIdentities = [...identities, identity];
    await run('UPDATE users SET identities = ? WHERE id = ?', [JSON.stringify(nextIdentities), req.user.id]);

    return res.status(201).json({ message: '身份注册成功', identities: nextIdentities });
  } catch (error) {
    return res.status(500).json({ message: '身份注册失败', detail: error.message });
  }
});

router.get('/export-word', authenticate, async (req, res) => {
  try {
    const user = await get('SELECT nickname FROM users WHERE id = ?', [req.user.id]);
    const profile = await get(
      'SELECT * FROM identity_profiles WHERE user_id = ? AND identity = ?',
      [req.user.id, req.user.activeIdentity]
    );

    if (!profile) {
      return res.status(404).json({ message: '当前身份资料为空，无法导出' });
    }

    const html = makeWordHtml({
      nickname: user?.nickname || req.user.username,
      identity: req.user.activeIdentity,
      profile
    });

    const fileName = `offer100-profile-${req.user.activeIdentity}.doc`;
    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(html);
  } catch (error) {
    return res.status(500).json({ message: '导出失败', detail: error.message });
  }
});

module.exports = router;
