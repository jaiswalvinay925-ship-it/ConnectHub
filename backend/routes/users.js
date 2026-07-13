const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { uploadProfile, handleMulterError } = require('../middleware/upload');

// GET /api/users/me/connections — followers + following merged (for share modal)
router.get('/me/connections', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    // Get followers
    const followers = await db(
      `SELECT u.id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM followers f JOIN users u ON f.follower_id=u.id
       WHERE f.following_id=? AND f.status='accepted'`,
      [uid]
    );
    // Get following
    const following = await db(
      `SELECT u.id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM followers f JOIN users u ON f.following_id=u.id
       WHERE f.follower_id=? AND f.status='accepted'`,
      [uid]
    );
    // Merge unique
    const seen = new Set();
    const people = [];
    [...followers.rows, ...following.rows].forEach(u => {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        people.push({ ...u, is_verified: !!u.is_verified });
      }
    });
    res.json({ users: people });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/users/search
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json({ users: [] });
    const result = await db(
      `SELECT u.id, u.full_name, u.username, u.profile_picture, u.is_verified,
              EXISTS(SELECT 1 FROM followers WHERE follower_id=? AND following_id=u.id AND status='accepted') AS is_following
       FROM users u
       WHERE (LOWER(u.username) LIKE LOWER(?) OR LOWER(u.full_name) LIKE LOWER(?))
         AND u.id != ? AND u.is_banned = 0
       ORDER BY u.is_verified DESC, u.username LIMIT 20`,
      [req.user.id, `%${q.trim()}%`, `%${q.trim()}%`, req.user.id]
    );
    res.json({ users: result.rows.map(u => ({ ...u, is_verified: !!u.is_verified, is_following: !!u.is_following })) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/users/discover/suggestions
router.get('/discover/suggestions', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT id, full_name, username, profile_picture, is_verified FROM users
       WHERE id != ? AND is_banned = 0
         AND id NOT IN (SELECT following_id FROM followers WHERE follower_id = ?)
       ORDER BY created_at DESC LIMIT 10`,
      [req.user.id, req.user.id]
    );
    res.json({ users: result.rows.map(u => ({ ...u, is_verified: !!u.is_verified })) });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/users/:id/followers
router.get('/:id/followers', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT u.id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM followers f JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = ? AND f.status = 'accepted' ORDER BY f.created_at DESC`,
      [req.params.id]
    );
    res.json({ users: result.rows.map(u => ({ ...u, is_verified: !!u.is_verified })) });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/users/:id/following
router.get('/:id/following', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT u.id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM followers f JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = ? AND f.status = 'accepted' ORDER BY f.created_at DESC`,
      [req.params.id]
    );
    res.json({ users: result.rows.map(u => ({ ...u, is_verified: !!u.is_verified })) });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/users/:username
router.get('/:username', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT u.id, u.full_name, u.username, u.profile_picture, u.bio,
              u.is_private, u.is_verified, u.is_banned, u.last_seen, u.created_at,
              (SELECT COUNT(*) FROM posts WHERE user_id=u.id) AS posts_count,
              (SELECT COUNT(*) FROM followers WHERE following_id=u.id AND status='accepted') AS followers_count,
              (SELECT COUNT(*) FROM followers WHERE follower_id=u.id AND status='accepted') AS following_count
       FROM users u WHERE LOWER(u.username) = LOWER(?) LIMIT 1`,
      [req.params.username]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });

    const user = result.rows[0];
    user.is_private = !!user.is_private; user.is_verified = !!user.is_verified;

    const isOwn = req.user.id === user.id;
    let followStatus = null;
    if (!isOwn) {
      const fr = await db('SELECT status FROM followers WHERE follower_id=? AND following_id=?', [req.user.id, user.id]);
      followStatus = fr.rows[0]?.status || null;
    }

    const canView = isOwn || !user.is_private || followStatus === 'accepted';
    let posts = [];
    if (canView) {
      const pr = await db(
        `SELECT p.id, p.caption, p.created_at,
                (SELECT file_url FROM post_media WHERE post_id=p.id ORDER BY display_order LIMIT 1) AS thumbnail,
                (SELECT media_type FROM post_media WHERE post_id=p.id ORDER BY display_order LIMIT 1) AS media_type,
                (SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comments_count,
                (SELECT COUNT(*) FROM post_media WHERE post_id=p.id) AS media_count
         FROM posts p WHERE p.user_id=? AND p.is_hidden=0 ORDER BY p.created_at DESC`,
        [user.id]
      );
      posts = pr.rows;
    }
    res.json({ user, posts, isOwn, followStatus });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/users/profile
router.put('/profile', authenticateToken,
  uploadProfile.single('profile_picture'), handleMulterError,
  [
    body('full_name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('username').optional().trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
    body('bio').optional().isLength({ max: 150 }),
    body('is_private').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const current = await db('SELECT * FROM users WHERE id=?', [req.user.id]);
      if (!current.rows.length) return res.status(404).json({ error: 'User not found.' });
      const user = current.rows[0];

      const { full_name, username, bio, is_private } = req.body;

      if (username && username.toLowerCase() !== user.username.toLowerCase()) {
        const check = await db('SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id!=?', [username, req.user.id]);
        if (check.rows.length) return res.status(409).json({ error: 'Username already taken.' });
      }

      const newName = full_name || user.full_name;
      const newUser = username ? username.toLowerCase() : user.username;
      const newBio  = bio !== undefined ? bio : user.bio;
      const newPriv = is_private !== undefined ? (is_private === 'true' || is_private === true ? 1 : 0) : user.is_private;
      const newPic  = req.file ? `/uploads/profiles/${req.file.filename}` : user.profile_picture;

      await db(
        `UPDATE users SET full_name=?, username=?, bio=?, is_private=?, profile_picture=?, updated_at=datetime('now') WHERE id=?`,
        [newName, newUser, newBio, newPriv, newPic, req.user.id]
      );

      const updated = await db('SELECT id,full_name,username,email,bio,is_private,is_verified,profile_picture FROM users WHERE id=?', [req.user.id]);
      const u = updated.rows[0];
      u.is_private = !!u.is_private; u.is_verified = !!u.is_verified;
      res.json({ message: 'Profile updated.', user: u });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
  }
);

module.exports = router;
