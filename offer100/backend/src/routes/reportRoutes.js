const express = require('express');
const { authenticate, requireIdentity } = require('../middleware/auth');
const { buildBehaviorCsv, buildSummaryReport } = require('../services/reportService');

const router = express.Router();

router.get('/summary', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    res.json(await buildSummaryReport());
  } catch (error) {
    res.status(500).json({ message: 'Failed to build summary report', detail: error.message });
  }
});

router.get('/behavior.csv', authenticate, requireIdentity(['recruiter']), async (req, res) => {
  try {
    const csv = await buildBehaviorCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="behavior-report.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Failed to export behavior csv', detail: error.message });
  }
});

module.exports = router;
