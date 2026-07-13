const express = require('express');
const router = express.Router();
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT n.id, n.type, n.reference_id, n.is_read, n.created_at,
              u.id AS actor_id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM notifications n JOIN users u ON n.actor_id=u.id
       WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = await db('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]);
    res.json({
      notifications: result.rows.map(n => ({ ...n, is_read: !!n.is_read, is_verified: !!n.is_verified })),
      unread_count: unread.rows[0].c
    });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await db('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await db('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
