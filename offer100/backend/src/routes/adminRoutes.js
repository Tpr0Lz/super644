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
