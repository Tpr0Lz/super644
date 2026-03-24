const { run, get, all } = require('../data/db');

async function trackBehavior({ userId, role, action, targetType, targetId, extra = {} }) {
  const createdAt = new Date().toISOString();
  const result = await run(
    'INSERT INTO behavior_logs (user_id, role, action, target_type, target_id, extra, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, role, action, targetType, targetId, JSON.stringify(extra), createdAt]
  );
  return {
    id: result.lastID,
    userId,
    role,
    action,
    targetType,
    targetId,
    extra,
    createdAt
  };
}

function safeParseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

async function getBehaviorStats() {
  const totalRow = await get('SELECT COUNT(*) AS total FROM behavior_logs');
  const actionRows = await all(
    'SELECT action, COUNT(*) AS count FROM behavior_logs GROUP BY action ORDER BY count DESC'
  );
  const roleRows = await all(
    'SELECT role, COUNT(*) AS count FROM behavior_logs GROUP BY role ORDER BY count DESC'
  );
  const latestRows = await all(
    'SELECT id, user_id, role, action, target_type, target_id, extra, created_at FROM behavior_logs ORDER BY id DESC LIMIT 20'
  );

  const byAction = {};
  const byRole = {};

  for (const row of actionRows) {
    byAction[row.action] = row.count;
  }

  for (const row of roleRows) {
    byRole[row.role] = row.count;
  }

  return {
    total: totalRow ? totalRow.total : 0,
    byAction,
    byRole,
    latest: latestRows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      extra: safeParseJson(row.extra, {}),
      createdAt: row.created_at
    }))
  };
}

module.exports = {
  trackBehavior,
  getBehaviorStats
};
