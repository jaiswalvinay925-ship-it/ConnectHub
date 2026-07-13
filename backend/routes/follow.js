const express = require('express');
const router = express.Router();
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/follow/:id
router.post('/:id', authenticateToken, async (req, res) => {
  try {
    const followingId = parseInt(req.params.id);
    const followerId = req.user.id;
    if (followerId === followingId) return res.status(400).json({ error: 'Cannot follow yourself.' });

    const target = await db('SELECT id, is_private FROM users WHERE id=?', [followingId]);
    if (!target.rows.length) return res.status(404).json({ error: 'User not found.' });

    const existing = await db('SELECT id, status FROM followers WHERE follower_id=? AND following_id=?', [followerId, followingId]);
    if (existing.rows.length) return res.status(409).json({ error: 'Already following or request pending.', status: existing.rows[0].status });

    const isPrivate = !!target.rows[0].is_private;
    const status = isPrivate ? 'pending' : 'accepted';

    await db('INSERT INTO followers (follower_id, following_id, status) VALUES (?,?,?)', [followerId, followingId, status]);

    const notifType = isPrivate ? 'follow_request' : 'follow';
    await db('INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?,?,?,?)', [followingId, followerId, notifType, followerId]);

    res.json({ message: isPrivate ? 'Follow request sent.' : 'Now following.', status });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// DELETE /api/follow/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db('DELETE FROM followers WHERE follower_id=? AND following_id=?', [req.user.id, parseInt(req.params.id)]);
    if (!result.rowCount) return res.status(404).json({ error: 'Follow relationship not found.' });
    res.json({ message: 'Unfollowed.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/follow/requests/pending
router.get('/requests/pending', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT f.id, f.created_at, u.id AS user_id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM followers f JOIN users u ON f.follower_id=u.id
       WHERE f.following_id=? AND f.status='pending' ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: result.rows.map(r => ({ ...r, is_verified: !!r.is_verified })) });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/follow/requests/:followerId/accept
router.put('/requests/:followerId/accept', authenticateToken, async (req, res) => {
  try {
    const followerId = parseInt(req.params.followerId);
    const result = await db(
      `UPDATE followers SET status='accepted' WHERE follower_id=? AND following_id=? AND status='pending'`,
      [followerId, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Request not found.' });
    await db('INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?,?,?,?)',
      [followerId, req.user.id, 'follow_accepted', req.user.id]);
    res.json({ message: 'Follow request accepted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// DELETE /api/follow/requests/:followerId/reject
router.delete('/requests/:followerId/reject', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `DELETE FROM followers WHERE follower_id=? AND following_id=? AND status='pending'`,
      [parseInt(req.params.followerId), req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Request not found.' });
    res.json({ message: 'Follow request rejected.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
