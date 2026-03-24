const express = require('express');
const { get, run } = require('../data/db');
const { authenticate, requireIdentity } = require('../middleware/auth');
const { trackBehavior } = require('../services/behaviorService');

const router = express.Router();

router.get('/me', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const company = await get(
      'SELECT id, name, intro, website, updated_at FROM companies WHERE user_id = ?',
      [req.user.id]
    );
    res.json(
      company || {
        id: 0,
        name: '',
        intro: '',
        website: '',
        updated_at: ''
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Failed to load company profile', detail: error.message });
  }
});

router.put('/me', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const { name, intro, website } = req.body;
    const now = new Date().toISOString();
    const existed = await get('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);

    if (existed) {
      await run(
        'UPDATE companies SET name = ?, intro = ?, website = ?, updated_at = ? WHERE user_id = ?',
        [name, intro, website, now, req.user.id]
      );
    } else {
      await run(
        'INSERT INTO companies (user_id, name, intro, website, updated_at) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, name, intro, website, now]
      );
    }

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'save_company_profile',
      targetType: 'company',
      targetId: req.user.id
    });

    res.json({ message: 'Company profile saved' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save company profile', detail: error.message });
  }
});

module.exports = router;
