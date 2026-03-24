const express = require('express');
const { all, get, run } = require('../data/db');
const { authenticate } = require('../middleware/auth');
const { trackBehavior } = require('../services/behaviorService');
const { emitRecruitmentUpdate } = require('../modules/socketHub');

const router = express.Router();

async function saveMessage({ fromUserId, toUserId, content, messageType = 'text', payload = null }) {
  const now = new Date().toISOString();
  const result = await run(
    `INSERT INTO messages (from_user_id, to_user_id, content, message_type, payload_json, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fromUserId,
      Number(toUserId),
      String(content || ''),
      messageType,
      payload ? JSON.stringify(payload) : null,
      0,
      now
    ]
  );

  return {
    id: result.lastID,
    from_user_id: fromUserId,
    to_user_id: Number(toUserId),
    content: String(content || ''),
    message_type: messageType,
    payload_json: payload ? JSON.stringify(payload) : null,
    created_at: now
  };
}

router.get('/contacts', authenticate, async (req, res) => {
  try {
    const rows = await all(
      `SELECT u.id, u.username, u.nickname,
              COALESCE(ip.avatar_url, '') AS avatar_url,
              MAX(m.created_at) AS last_message_at,
              MAX(m.id) AS last_message_id,
              SUM(
                CASE
                  WHEN m.to_user_id = ? AND m.from_user_id = u.id AND COALESCE(m.is_read, 0) = 0
                  THEN 1 ELSE 0
                END
              ) AS unread_count
       FROM users u
       INNER JOIN messages m
         ON (
           (m.from_user_id = u.id AND m.to_user_id = ?)
           OR
           (m.from_user_id = ? AND m.to_user_id = u.id)
         )
       LEFT JOIN identity_profiles ip
         ON ip.user_id = u.id AND ip.identity = ?
       WHERE u.id != ?
       GROUP BY u.id, u.username, u.nickname, ip.avatar_url
       ORDER BY last_message_id DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.activeIdentity, req.user.id]
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        username: row.username,
        nickname: row.nickname || row.username,
        avatarUrl: row.avatar_url || '',
        lastMessageAt: row.last_message_at || '',
        unreadCount: Number(row.unread_count || 0)
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Failed to load chat contacts', detail: error.message });
  }
});

router.get('/users/:userId', authenticate, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId || userId === req.user.id) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const row = await get(
      `SELECT u.id, u.username, u.nickname,
              COALESCE(ip.avatar_url, '') AS avatar_url
       FROM users u
       LEFT JOIN identity_profiles ip ON ip.user_id = u.id AND ip.identity = ?
       WHERE u.id = ?`,
      [req.user.activeIdentity, userId]
    );

    if (!row) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    return res.json({
      id: row.id,
      username: row.username,
      nickname: row.nickname || row.username,
      avatarUrl: row.avatar_url || '',
      lastMessageAt: '',
      unreadCount: 0
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load target user', detail: error.message });
  }
});

router.get('/unread-summary', authenticate, async (req, res) => {
  try {
    const row = await get(
      'SELECT COUNT(*) AS unreadCount FROM messages WHERE to_user_id = ? AND COALESCE(is_read, 0) = 0',
      [req.user.id]
    );

    res.json({ unreadCount: Number(row?.unreadCount || 0) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load unread summary', detail: error.message });
  }
});

router.get('/conversation/:userId', authenticate, async (req, res) => {
  try {
    const otherUserId = Number(req.params.userId);
    const rows = await all(
      `SELECT m.id,
              m.from_user_id,
              m.to_user_id,
              m.content,
              m.message_type,
              m.payload_json,
              m.created_at,
              fu.nickname AS from_nickname,
              tu.nickname AS to_nickname
       FROM messages m
       LEFT JOIN users fu ON fu.id = m.from_user_id
       LEFT JOIN users tu ON tu.id = m.to_user_id
       WHERE (m.from_user_id = ? AND m.to_user_id = ?)
          OR (m.from_user_id = ? AND m.to_user_id = ?)
       ORDER BY m.id ASC`,
      [req.user.id, otherUserId, otherUserId, req.user.id]
    );

    const formatted = rows.map((row) => ({
      id: row.id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      content: row.content,
      messageType: row.message_type || 'text',
      payload: row.payload_json ? JSON.parse(row.payload_json) : null,
      createdAt: row.created_at,
      fromNickname: row.from_nickname,
      toNickname: row.to_nickname
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load messages', detail: error.message });
  }
});

router.get('/messages/:userId', authenticate, async (req, res) => {
  try {
    const otherUserId = Number(req.params.userId);

    const marked = await run(
      `UPDATE messages
       SET is_read = 1
       WHERE from_user_id = ? AND to_user_id = ? AND COALESCE(is_read, 0) = 0`,
      [otherUserId, req.user.id]
    );

    if (marked.changes > 0) {
      emitRecruitmentUpdate({
        type: 'chat_read',
        payload: {
          userId: req.user.id,
          withUserId: otherUserId,
          readCount: marked.changes
        }
      });
    }

    const rows = await all(
      `SELECT id, from_user_id, to_user_id, content, message_type, payload_json, is_read, created_at
       FROM messages
       WHERE (from_user_id = ? AND to_user_id = ?)
          OR (from_user_id = ? AND to_user_id = ?)
       ORDER BY id ASC`,
      [req.user.id, otherUserId, otherUserId, req.user.id]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load messages', detail: error.message });
  }
});

router.post('/messages', authenticate, async (req, res) => {
  try {
    const { toUserId, content, messageType = 'text', payload = null } = req.body;
    const text = String(content || '').trim();

    if (!text && !payload) {
      return res.status(400).json({ message: 'Message content is empty' });
    }

    const target = await get('SELECT id, username FROM users WHERE id = ?', [toUserId]);
    if (!target) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    const saved = await saveMessage({
      fromUserId: req.user.id,
      toUserId,
      content: text,
      messageType,
      payload
    });

    await trackBehavior({
      userId: req.user.id,
      role: req.user.activeIdentity,
      action: 'send_message',
      targetType: 'chat',
      targetId: Number(toUserId)
    });

    emitRecruitmentUpdate({
      type: 'chat_message',
      payload: saved
    });

    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message', detail: error.message });
  }
});

router.post('/system-message', authenticate, async (req, res) => {
  try {
    const { toUserId, content, messageType = 'system', payload = null } = req.body;

    if (!toUserId) {
      return res.status(400).json({ message: 'toUserId required' });
    }

    const target = await get('SELECT id FROM users WHERE id = ?', [toUserId]);
    if (!target) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    const saved = await saveMessage({
      fromUserId: req.user.id,
      toUserId,
      content: content || '',
      messageType,
      payload
    });

    emitRecruitmentUpdate({ type: 'chat_message', payload: saved });
    return res.status(201).json(saved);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send system message', detail: error.message });
  }
});

module.exports = router;
