const { createObjectCsvStringifier } = require('csv-writer');
const { all, get } = require('../../data/db');
const { getBehaviorStats } = require('./behaviorService');

async function buildBehaviorCsv() {
  const rows = await all(
    'SELECT id, user_id, role, action, target_type, target_id, created_at FROM behavior_logs ORDER BY id ASC'
  );

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'id', title: 'ID' },
      { id: 'userId', title: 'USER_ID' },
      { id: 'role', title: 'ROLE' },
      { id: 'action', title: 'ACTION' },
      { id: 'targetType', title: 'TARGET_TYPE' },
      { id: 'targetId', title: 'TARGET_ID' },
      { id: 'createdAt', title: 'CREATED_AT' }
    ]
  });

  const recordsData = rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    createdAt: row.created_at
  }));

  const header = csvStringifier.getHeaderString();
  const records = csvStringifier.stringifyRecords(recordsData);
  return `${header}${records}`;
}

async function buildSummaryReport() {
  const stats = await getBehaviorStats();
  const jobCountRow = await get('SELECT COUNT(*) AS count FROM jobs');
  return {
    generatedAt: new Date().toISOString(),
    jobCount: jobCountRow ? jobCountRow.count : 0,
    behaviorStats: stats
  };
}

module.exports = {
  buildBehaviorCsv,
  buildSummaryReport
};
