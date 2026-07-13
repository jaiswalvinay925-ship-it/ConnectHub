const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { uploadMessage, handleMulterError } = require('../middleware/upload');

// GET /api/messages — all conversations (SQLite-compatible, no ROW_NUMBER)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const setting = await db("SELECT value FROM platform_settings WHERE key='messaging_enabled'");
    if (setting.rows[0]?.value === 'false') return res.status(403).json({ error: 'Messaging is currently disabled.' });

    const uid = req.user.id;
    // Get all distinct conversation partners with their latest message
    // Get distinct conversation partners using a simple subquery (SQLite-compatible)
    const partners = await db(
      `SELECT DISTINCT CASE WHEN sender_id=? THEN receiver_id ELSE sender_id END AS other_user
       FROM messages WHERE (sender_id=? OR receiver_id=?) AND is_deleted_for_everyone=0`,
      [uid, uid, uid]
    );

    const rows = [];
    for (const p of partners.rows) {
      const otherId = p.other_user;
      // Skip blocked users
      const blocked = await db(
        'SELECT id FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',
        [uid, otherId, otherId, uid]
      );
      if (blocked.rows.length) continue;

      const lastMsg = await db(
        `SELECT id, message, media_url, created_at, status, sender_id
         FROM messages WHERE ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?))
           AND is_deleted_for_everyone=0
         ORDER BY created_at DESC LIMIT 1`,
        [uid, otherId, otherId, uid]
      );
      if (!lastMsg.rows.length) continue;

      const user = await db(
        'SELECT id, full_name, username, profile_picture, is_verified, last_seen FROM users WHERE id=?',
        [otherId]
      );
      if (!user.rows.length) continue;

      const unread = await db(
        "SELECT COUNT(*) as c FROM messages WHERE receiver_id=? AND sender_id=? AND status!='seen'",
        [uid, otherId]
      );

      const m = lastMsg.rows[0];
      const u = user.rows[0];
      rows.push({
        other_user: otherId,
        full_name: u.full_name, username: u.username,
        profile_picture: u.profile_picture, is_verified: !!u.is_verified, last_seen: u.last_seen,
        last_message_id: m.id, last_message: m.message, last_media_url: m.media_url,
        last_message_time: m.created_at, last_status: m.status, last_sender_id: m.sender_id,
        unread_count: unread.rows[0].c
      });
    }

    // Sort by most recent message
    rows.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
    const result = { rows };
    res.json({ conversations: result.rows.map(c => ({ ...c, is_verified: !!c.is_verified })) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/messages/:userId — get conversation with a user
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const otherId = parseInt(req.params.userId);
    const myId = req.user.id;

    // Check block
    const blocked = await db(
      'SELECT id FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',
      [myId, otherId, otherId, myId]
    );
    if (blocked.rows.length) return res.status(403).json({ error: 'Cannot message this user.' });

    const result = await db(
      `SELECT id, sender_id, receiver_id, message, media_url, media_type, status, created_at, is_deleted_for_everyone
       FROM messages
       WHERE ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?))
       ORDER BY created_at ASC`,
      [myId, otherId, otherId, myId]
    );

    await db("UPDATE messages SET status='seen' WHERE sender_id=? AND receiver_id=? AND status!='seen'", [otherId, myId]);

    const user = await db('SELECT id, full_name, username, profile_picture, is_verified, last_seen FROM users WHERE id=?', [otherId]);
    // Check if I blocked them or they blocked me
    const iBlocked = await db('SELECT id FROM blocks WHERE blocker_id=? AND blocked_id=?', [myId, otherId]);
    const theyBlocked = await db('SELECT id FROM blocks WHERE blocker_id=? AND blocked_id=?', [otherId, myId]);

    res.json({
      messages: result.rows.map(m => ({ ...m, is_deleted_for_everyone: !!m.is_deleted_for_everyone })),
      other_user: user.rows[0] ? { ...user.rows[0], is_verified: !!user.rows[0].is_verified } : null,
      i_blocked: !!iBlocked.rows.length,
      they_blocked: !!theyBlocked.rows.length,
    });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/messages — send a message
router.post('/', authenticateToken, uploadMessage.single('media'), handleMulterError,
  [body('receiver_id').isInt().withMessage('Valid receiver required')],
  async (req, res) => {
    try {
      const setting = await db("SELECT value FROM platform_settings WHERE key='messaging_enabled'");
      if (setting.rows[0]?.value === 'false') return res.status(403).json({ error: 'Messaging is currently disabled.' });

      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const receiverId = parseInt(req.body.receiver_id);
      if (req.user.id === receiverId) return res.status(400).json({ error: 'Cannot message yourself.' });

      // Check block
      const blocked = await db(
        'SELECT id FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',
        [req.user.id, receiverId, receiverId, req.user.id]
      );
      if (blocked.rows.length) return res.status(403).json({ error: 'Cannot message this user.' });

      const receiver = await db('SELECT id FROM users WHERE id=?', [receiverId]);
      if (!receiver.rows.length) return res.status(404).json({ error: 'Receiver not found.' });

      const message = req.body.message || null;
      let mediaUrl = null, mediaType = null;
      if (req.file) {
        mediaUrl = `/uploads/messages/${req.file.filename}`;
        mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      }
      if (!message && !mediaUrl) return res.status(400).json({ error: 'Message or media required.' });

      await db('INSERT INTO messages (sender_id, receiver_id, message, media_url, media_type) VALUES (?,?,?,?,?)',
        [req.user.id, receiverId, message, mediaUrl, mediaType]);

      res.status(201).json({ message: 'Message sent.' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
  }
);

// DELETE /api/messages/:id — delete for everyone
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const msg = await db('SELECT sender_id FROM messages WHERE id=?', [req.params.id]);
    if (!msg.rows.length) return res.status(404).json({ error: 'Message not found.' });
    if (msg.rows[0].sender_id !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });
    await db('UPDATE messages SET is_deleted_for_everyone=1, message=NULL, media_url=NULL WHERE id=?', [req.params.id]);
    res.json({ message: 'Message deleted for everyone.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
