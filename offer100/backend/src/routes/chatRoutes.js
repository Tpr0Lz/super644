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
              ) AS unread_count,
              COALESCE(uc.is_pinned, 0) AS is_pinned,
              COALESCE(uc.is_deleted, 0) AS is_deleted
       FROM users u
       INNER JOIN messages m
         ON (
           (m.from_user_id = u.id AND m.to_user_id = ?)
           OR
           (m.from_user_id = ? AND m.to_user_id = u.id)
         )
       LEFT JOIN identity_profiles ip
         ON ip.user_id = u.id AND ip.identity = ?
       LEFT JOIN user_contacts uc
         ON uc.user_id = ? AND uc.contact_user_id = u.id
       WHERE u.id != ? AND COALESCE(uc.is_deleted, 0) = 0
       GROUP BY u.id, u.username, u.nickname, ip.avatar_url, is_pinned, is_deleted
       ORDER BY is_pinned DESC, last_message_at DESC, last_message_id DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.activeIdentity, req.user.id, req.user.id]
    );

    // 获取管理员用户
    const admin = await get('SELECT id, username, nickname FROM users WHERE role = ? AND id != ?', [
      'admin',
      req.user.id
    ]);

    // 检查管理员是否已经在列表中
    const adminInList = rows.some((row) => row.id === admin?.id);
    if (admin && !adminInList) {
      rows.push({
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        avatar_url: '',
        last_message_at: null,
        last_message_id: null,
        unread_count: 0,
        is_pinned: 0,
        is_deleted: 0
      });
    }

    res.json(
      rows.map((row) => ({
        id: row.id,
        username: row.username,
        nickname: row.nickname || row.username,
        avatarUrl: row.avatar_url || '',
        lastMessageAt: row.last_message_at || '',
        unreadCount: Number(row.unread_count || 0),
        isPinned: Boolean(row.is_pinned),
        isAdmin: row.id === admin?.id
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
    await run(
      `UPDATE messages
       SET is_read = 1
       WHERE to_user_id = ?
         AND COALESCE(is_read, 0) = 0
         AND from_user_id NOT IN (SELECT id FROM users)`,
      [req.user.id]
    );

    const row = await get(
      `SELECT COUNT(*) AS unreadCount
       FROM messages m
       INNER JOIN users u ON u.id = m.from_user_id
       WHERE m.to_user_id = ? AND COALESCE(m.is_read, 0) = 0`,
      [req.user.id]
    );

    res.json({ unreadCount: Number(row?.unreadCount || 0) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load unread summary', detail: error.message });
  }
});

router.post('/mark-all-read', authenticate, async (req, res) => {
  try {
    const marked = await run(
      `UPDATE messages
       SET is_read = 1
       WHERE to_user_id = ? AND COALESCE(is_read, 0) = 0`,
      [req.user.id]
    );

    if (marked.changes > 0) {
      emitRecruitmentUpdate({
        type: 'chat_read',
        payload: {
          userId: req.user.id,
          withUserId: 0,
          readCount: marked.changes
        }
      });
    }

    return res.json({ readCount: Number(marked.changes || 0) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark all read', detail: error.message });
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

// 置顶联系人
router.post('/contacts/:contactId/pin', authenticate, async (req, res) => {
  try {
    const contactId = Number(req.params.contactId);
    if (!contactId) {
      return res.status(400).json({ message: 'Invalid contactId' });
    }

    const existing = await get(
      'SELECT id FROM user_contacts WHERE user_id = ? AND contact_user_id = ?',
      [req.user.id, contactId]
    );

    if (existing) {
      await run(
        'UPDATE user_contacts SET is_pinned = 1 WHERE user_id = ? AND contact_user_id = ?',
        [req.user.id, contactId]
      );
    } else {
      await run(
        'INSERT INTO user_contacts (user_id, contact_user_id, is_pinned, is_deleted, created_at) VALUES (?, ?, 1, 0, ?)',
        [req.user.id, contactId, new Date().toISOString()]
      );
    }

    return res.json({ message: 'Contact pinned successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to pin contact', detail: error.message });
  }
});

// 取消置顶
router.post('/contacts/:contactId/unpin', authenticate, async (req, res) => {
  try {
    const contactId = Number(req.params.contactId);
    if (!contactId) {
      return res.status(400).json({ message: 'Invalid contactId' });
    }

    const existing = await get(
      'SELECT id FROM user_contacts WHERE user_id = ? AND contact_user_id = ?',
      [req.user.id, contactId]
    );

    if (existing) {
      await run(
        'UPDATE user_contacts SET is_pinned = 0 WHERE user_id = ? AND contact_user_id = ?',
        [req.user.id, contactId]
      );
    } else {
      await run(
        'INSERT INTO user_contacts (user_id, contact_user_id, is_pinned, is_deleted, created_at) VALUES (?, ?, 0, 0, ?)',
        [req.user.id, contactId, new Date().toISOString()]
      );
    }

    return res.json({ message: 'Contact unpinned successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to unpin contact', detail: error.message });
  }
});

// 删除聊天记录
// 删除聊天记录
router.post('/contacts/:contactId/delete', authenticate, async (req, res) => {
  try {
    const contactId = Number(req.params.contactId);
    if (!contactId) {
      return res.status(400).json({ message: 'Invalid contactId' });
    }

    // 检查是否是管理员，如果是则禁止删除
    const contact = await get('SELECT role FROM users WHERE id = ?', [contactId]);
    if (contact?.role === 'admin') {
      return res.status(403).json({ message: '无法删除与管理员的聊天' });
    }

    const existing = await get(
      'SELECT id FROM user_contacts WHERE user_id = ? AND contact_user_id = ?',
      [req.user.id, contactId]
    );

    if (existing) {
      await run(
        'UPDATE user_contacts SET is_deleted = 1 WHERE user_id = ? AND contact_user_id = ?',
        [req.user.id, contactId]
      );
    } else {
      await run(
        'INSERT INTO user_contacts (user_id, contact_user_id, is_pinned, is_deleted, created_at) VALUES (?, ?, 0, 1, ?)',
        [req.user.id, contactId, new Date().toISOString()]
      );
    }

    return res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete chat', detail: error.message });
  }
});

// 恢复删除的聊天
router.post('/contacts/:contactId/restore', authenticate, async (req, res) => {
  try {
    const contactId = Number(req.params.contactId);
    if (!contactId) {
      return res.status(400).json({ message: 'Invalid contactId' });
    }

    const existing = await get(
      'SELECT id FROM user_contacts WHERE user_id = ? AND contact_user_id = ?',
      [req.user.id, contactId]
    );

    if (existing) {
      await run(
        'UPDATE user_contacts SET is_deleted = 0 WHERE user_id = ? AND contact_user_id = ?',
        [req.user.id, contactId]
      );
    } else {
      await run(
        'INSERT INTO user_contacts (user_id, contact_user_id, is_pinned, is_deleted, created_at) VALUES (?, ?, 0, 0, ?)',
        [req.user.id, contactId, new Date().toISOString()]
      );
    }

    return res.json({ message: 'Chat restored successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to restore chat', detail: error.message });
  }
});

module.exports = router;
