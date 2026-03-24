const express = require('express');
const { authenticate, requireIdentity } = require('../middleware/auth');
const { getBehaviorStats } = require('../services/behaviorService');

const router = express.Router();

router.get('/behavior', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const stats = await getBehaviorStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load behavior stats', detail: error.message });
  }
});

module.exports = router;
