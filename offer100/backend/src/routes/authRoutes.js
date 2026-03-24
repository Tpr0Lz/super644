const express = require('express');
const { get, run } = require('../data/db');
const { signToken } = require('../utils/token');

const router = express.Router();

function normalizeIdentities(initialIdentity) {
  const base = ['jobseeker', 'recruiter'];
  if (!base.includes(initialIdentity)) {
    return ['jobseeker'];
  }
  return [initialIdentity];
}

router.post('/register', async (req, res) => {
  try {
    const {
      username,
      nickname,
      password,
      initialIdentity,
      recruiterProfile = {},
      jobseekerProfile = {}
    } = req.body;

    if (!username || !password || !nickname) {
      return res.status(400).json({ message: '用户名、昵称和密码不能为空' });
    }
    if (!['recruiter', 'jobseeker'].includes(initialIdentity)) {
      return res.status(400).json({ message: '初始身份必须是 recruiter 或 jobseeker' });
    }

    if (initialIdentity === 'recruiter') {
      const { companyName, companyAddress, companySize } = recruiterProfile;
      if (!companyName || !companyAddress || !companySize) {
        return res.status(400).json({ message: '注册招聘者身份必须填写公司信息、地址、规模' });
      }
    }

    if (initialIdentity === 'jobseeker') {
      const { fullName, age, gender, strengths } = jobseekerProfile;
      if (!fullName || !age || !gender || !strengths) {
        return res.status(400).json({ message: '注册求职者身份必须填写个人信息、年龄、性别和个人优势' });
      }
    }

    const existed = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existed) {
      return res.status(409).json({ message: '用户名已存在' });
    }

    const identities = normalizeIdentities(initialIdentity);
    const role = initialIdentity;
    const now = new Date().toISOString();

    const created = await run(
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
        username,
        password,
        nickname,
        role,
        '',
        '[]',
        JSON.stringify(identities),
        initialIdentity,
        now
      ]
    );

    const userId = created.lastID;

    if (initialIdentity === 'recruiter') {
      const { companyName, companyAddress, companySize, companyIntro, commonPhrase, avatarUrl } =
        recruiterProfile;

      await run(
        'INSERT INTO companies (user_id, name, intro, website, address, company_size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, companyName, companyIntro || '', '', companyAddress, companySize, now]
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
          userId,
          'recruiter',
          avatarUrl || '',
          commonPhrase || '',
          companyName,
          companyAddress,
          companySize,
          companyIntro || '',
          now
        ]
      );
    }

    if (initialIdentity === 'jobseeker') {
      const {
        fullName,
        age,
        gender,
        strengths,
        internshipExperience,
        projectExperience,
        competitionExperience,
        campusExperience,
        expectedPosition,
        commonPhrase,
        avatarUrl
      } = jobseekerProfile;

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
          userId,
          fullName,
          '',
          internshipExperience || '',
          '',
          gender,
          Number(age),
          strengths,
          expectedPosition || '',
          internshipExperience || '',
          projectExperience || '',
          competitionExperience || '',
          campusExperience || '',
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
          userId,
          'jobseeker',
          avatarUrl || '',
          commonPhrase || '',
          fullName,
          Number(age),
          gender,
          strengths,
          expectedPosition || '',
          internshipExperience || '',
          projectExperience || '',
          competitionExperience || '',
          campusExperience || '',
          now
        ]
      );
    }

    return res.status(201).json({ message: '注册成功，请登录' });
  } catch (error) {
    return res.status(500).json({ message: '注册失败', detail: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await get(
      `SELECT id, username, nickname, role, major, preference_tags, identities, initial_identity
       FROM users
       WHERE username = ? AND password = ?`,
      [username, password]
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    let identities = ['recruiter', 'jobseeker'];
    try {
      identities = user.identities ? JSON.parse(user.identities) : ['jobseeker'];
    } catch (error) {
      identities = ['jobseeker'];
    }

    const initialIdentity = identities.includes(user.initial_identity)
      ? user.initial_identity
      : identities[0] || 'jobseeker';

    const token = signToken({
      id: user.id,
      role: user.role,
      username: user.username,
      identities,
      initialIdentity
    });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        role: user.role,
        identities,
        initialIdentity,
        major: user.major,
        preferenceTags: (() => {
          try {
            return user.preference_tags ? JSON.parse(user.preference_tags) : [];
          } catch (error) {
            return [];
          }
        })()
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', detail: error.message });
  }
});

module.exports = router;
