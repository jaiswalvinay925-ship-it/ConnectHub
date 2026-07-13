const express = require('express');
const router = express.Router();
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/blocks/:id — block a user
router.post('/:id', authenticateToken, async (req, res) => {
  try {
    const blockedId = parseInt(req.params.id);
    if (blockedId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself.' });
    await db('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?,?)', [req.user.id, blockedId]);
    // Also remove any follow relationships
    await db('DELETE FROM followers WHERE (follower_id=? AND following_id=?) OR (follower_id=? AND following_id=?)',
      [req.user.id, blockedId, blockedId, req.user.id]);
    res.json({ message: 'User blocked.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// DELETE /api/blocks/:id — unblock a user
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?', [req.user.id, parseInt(req.params.id)]);
    res.json({ message: 'User unblocked.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/blocks — list blocked users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT u.id, u.full_name, u.username, u.profile_picture FROM blocks b
       JOIN users u ON b.blocked_id=u.id WHERE b.blocker_id=? ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ blocked: result.rows });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/blocks/check/:id — check if user is blocked
router.get('/check/:id', authenticateToken, async (req, res) => {
  try {
    const otherId = parseInt(req.params.id);
    const iBlock = await db('SELECT id FROM blocks WHERE blocker_id=? AND blocked_id=?', [req.user.id, otherId]);
    const theyBlock = await db('SELECT id FROM blocks WHERE blocker_id=? AND blocked_id=?', [otherId, req.user.id]);
    res.json({ i_blocked: !!iBlock.rows.length, they_blocked: !!theyBlock.rows.length });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
