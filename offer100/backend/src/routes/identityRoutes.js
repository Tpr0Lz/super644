const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, (req, res) => {
  res.json({
    userId: req.user.id,
    username: req.user.username,
    identities: req.user.identities,
    activeIdentity: req.user.activeIdentity
  });
});

module.exports = router;
