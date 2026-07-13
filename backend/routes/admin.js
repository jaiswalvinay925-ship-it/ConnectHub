const express = require('express');
const router = express.Router();
const { query: db } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [users, posts, comments, stories, messages, verifications, reports, newUsers] = await Promise.all([
      db("SELECT COUNT(*) as c FROM users WHERE role!='admin'"),
      db('SELECT COUNT(*) as c FROM posts'),
      db('SELECT COUNT(*) as c FROM comments'),
      db("SELECT COUNT(*) as c FROM stories WHERE expires_at > datetime('now')"),
      db('SELECT COUNT(*) as c FROM messages'),
      db("SELECT COUNT(*) as c FROM verification_requests WHERE status='pending'"),
      db("SELECT COUNT(*) as c FROM reports WHERE status='pending'"),
      db("SELECT COUNT(*) as c FROM users WHERE created_at > datetime('now','-7 days') AND role!='admin'"),
    ]);
    res.json({
      total_users: users.rows[0].c,
      total_posts: posts.rows[0].c,
      total_comments: comments.rows[0].c,
      total_stories: stories.rows[0].c,
      total_messages: messages.rows[0].c,
      pending_verifications: verifications.rows[0].c,
      pending_reports: reports.rows[0].c,
      new_users_this_week: newUsers.rows[0].c,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// ---- USERS ----
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const like = `%${search}%`;

    const result = await db(
      `SELECT u.id, u.full_name, u.username, u.email, u.role, u.profile_picture,
              u.is_verified, u.is_banned, u.is_private, u.last_seen, u.created_at,
              (SELECT COUNT(*) FROM followers WHERE following_id=u.id AND status='accepted') AS followers_count,
              (SELECT COUNT(*) FROM followers WHERE follower_id=u.id AND status='accepted') AS following_count,
              (SELECT COUNT(*) FROM posts WHERE user_id=u.id) AS posts_count
       FROM users u
       WHERE (? = '' OR LOWER(u.full_name) LIKE LOWER(?) OR LOWER(u.username) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [search, like, like, like, limit, offset]
    );
    const total = await db(
      `SELECT COUNT(*) as c FROM users WHERE (?='' OR LOWER(full_name) LIKE LOWER(?) OR LOWER(username) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))`,
      [search, like, like, like]
    );
    res.json({
      users: result.rows.map(u => ({ ...u, is_verified: !!u.is_verified, is_banned: !!u.is_banned, is_private: !!u.is_private })),
      total: total.rows[0].c, page, limit
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const result = await db(
      `SELECT u.id, u.full_name, u.username, u.email, u.role, u.profile_picture, u.bio,
              u.is_verified, u.is_banned, u.is_private, u.last_seen, u.created_at,
              (SELECT COUNT(*) FROM posts WHERE user_id=u.id) AS posts_count,
              (SELECT COUNT(*) FROM followers WHERE following_id=u.id AND status='accepted') AS followers_count,
              (SELECT COUNT(*) FROM followers WHERE follower_id=u.id AND status='accepted') AS following_count,
              (SELECT COUNT(*) FROM stories WHERE user_id=u.id) AS stories_count,
              (SELECT COUNT(*) FROM comments WHERE user_id=u.id) AS comments_count,
              (SELECT COUNT(*) FROM messages WHERE sender_id=u.id) AS messages_sent
       FROM users u WHERE u.id=?`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });

    const recentPosts = await db(
      `SELECT p.id, p.caption, p.created_at,
              (SELECT file_url FROM post_media WHERE post_id=p.id ORDER BY display_order LIMIT 1) AS thumbnail
       FROM posts p WHERE p.user_id=? ORDER BY p.created_at DESC LIMIT 5`,
      [req.params.id]
    );
    const recentStories = await db(
      'SELECT id, media_url, media_type, created_at FROM stories WHERE user_id=? ORDER BY created_at DESC LIMIT 5',
      [req.params.id]
    );
    const u = result.rows[0];
    res.json({
      user: { ...u, is_verified: !!u.is_verified, is_banned: !!u.is_banned, is_private: !!u.is_private },
      recent_posts: recentPosts.rows,
      recent_stories: recentStories.rows
    });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/users/:id/ban', async (req, res) => {
  try {
    await db('UPDATE users SET is_banned=1 WHERE id=?', [req.params.id]);
    res.json({ message: 'User banned.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/users/:id/unban', async (req, res) => {
  try {
    await db('UPDATE users SET is_banned=0 WHERE id=?', [req.params.id]);
    res.json({ message: 'User unbanned.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/users/:id/verify', async (req, res) => {
  try {
    const verified = req.body.verified !== false ? 1 : 0;
    await db('UPDATE users SET is_verified=? WHERE id=?', [verified, req.params.id]);
    res.json({ message: `Verification ${verified ? 'granted' : 'removed'}.` });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin','user'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    await db('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
    res.json({ message: `Role updated to ${role}.` });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const u = await db('SELECT username FROM users WHERE id=?', [req.params.id]);
    if (!u.rows.length) return res.status(404).json({ error: 'User not found.' });
    await db('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ message: `User @${u.rows[0].username} deleted.` });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ---- POSTS ----
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const result = await db(
      `SELECT p.id, p.caption, p.is_hidden, p.created_at,
              u.id AS owner_id, u.full_name, u.username, u.profile_picture,
              (SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comments_count,
              (SELECT COUNT(*) FROM post_media WHERE post_id=p.id) AS media_count,
              (SELECT file_url FROM post_media WHERE post_id=p.id ORDER BY display_order LIMIT 1) AS thumbnail
       FROM posts p JOIN users u ON p.user_id=u.id
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const total = await db('SELECT COUNT(*) as c FROM posts');
    res.json({
      posts: result.rows.map(p => ({ ...p, is_hidden: !!p.is_hidden })),
      total: total.rows[0].c, page, limit
    });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const post = await db(
      `SELECT p.*, u.full_name, u.username, u.profile_picture,
              (SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likes_count
       FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id=?`,
      [req.params.id]
    );
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found.' });
    const media = await db('SELECT id, file_url, media_type FROM post_media WHERE post_id=? ORDER BY display_order', [req.params.id]);
    const comments = await db(
      `SELECT c.*, u.full_name, u.username, u.profile_picture
       FROM comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=? ORDER BY c.created_at DESC LIMIT 20`,
      [req.params.id]
    );
    res.json({ post: { ...post.rows[0], is_hidden: !!post.rows[0].is_hidden, media: media.rows }, comments: comments.rows });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    await db('DELETE FROM posts WHERE id=?', [req.params.id]);
    res.json({ message: 'Post deleted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/posts/:id/hide', async (req, res) => {
  try {
    await db('UPDATE posts SET is_hidden=1 WHERE id=?', [req.params.id]);
    res.json({ message: 'Post hidden.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/posts/:id/restore', async (req, res) => {
  try {
    await db('UPDATE posts SET is_hidden=0 WHERE id=?', [req.params.id]);
    res.json({ message: 'Post restored.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ---- COMMENTS ----
router.get('/comments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const result = await db(
      `SELECT c.id, c.comment, c.created_at,
              u.id AS user_id, u.full_name, u.username, u.profile_picture,
              p.id AS post_id, p.caption AS post_caption
       FROM comments c JOIN users u ON c.user_id=u.id JOIN posts p ON c.post_id=p.id
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const total = await db('SELECT COUNT(*) as c FROM comments');
    res.json({ comments: result.rows, total: total.rows[0].c, page, limit });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/comments/:id', async (req, res) => {
  try {
    await db('DELETE FROM comments WHERE id=?', [req.params.id]);
    res.json({ message: 'Comment deleted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ---- STORIES ----
router.get('/stories', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const result = await db(
      `SELECT s.id, s.media_url, s.media_type, s.expires_at, s.created_at,
              u.id AS user_id, u.full_name, u.username, u.profile_picture,
              (SELECT COUNT(*) FROM story_views WHERE story_id=s.id) AS views_count,
              CASE WHEN s.expires_at > datetime('now') THEN 'active' ELSE 'expired' END AS status
       FROM stories s JOIN users u ON s.user_id=u.id
       ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const total = await db('SELECT COUNT(*) as c FROM stories');
    res.json({ stories: result.rows, total: total.rows[0].c, page, limit });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/stories/:id', async (req, res) => {
  try {
    await db('DELETE FROM stories WHERE id=?', [req.params.id]);
    res.json({ message: 'Story deleted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ---- MESSAGES ----
router.get('/messages', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const result = await db(
      `SELECT m.id, m.message, m.media_url, m.media_type, m.status, m.is_deleted_for_everyone, m.created_at,
              s.id AS sender_id, s.full_name AS sender_name, s.username AS sender_username,
              r.id AS receiver_id, r.full_name AS receiver_name, r.username AS receiver_username
       FROM messages m JOIN users s ON m.sender_id=s.id JOIN users r ON m.receiver_id=r.id
       ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const total = await db('SELECT COUNT(*) as c FROM messages');
    res.json({
      messages: result.rows.map(m => ({ ...m, is_deleted_for_everyone: !!m.is_deleted_for_everyone })),
      total: total.rows[0].c, page, limit
    });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/messages/:id', async (req, res) => {
  try {
    await db('DELETE FROM messages WHERE id=?', [req.params.id]);
    res.json({ message: 'Message deleted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ---- VERIFICATION ----
router.get('/verification', async (req, res) => {
  try {
    const result = await db(
      `SELECT vr.id, vr.reason, vr.document_url, vr.status, vr.created_at,
              u.id AS user_id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM verification_requests vr JOIN users u ON vr.user_id=u.id
       ORDER BY vr.created_at DESC`
    );
    res.json({ requests: result.rows.map(r => ({ ...r, is_verified: !!r.is_verified })) });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/verification/:id/approve', async (req, res) => {
  try {
    const vr = await db('SELECT user_id FROM verification_requests WHERE id=?', [req.params.id]);
    if (!vr.rows.length) return res.status(404).json({ error: 'Request not found.' });
    await db("UPDATE verification_requests SET status='approved', updated_at=datetime('now') WHERE id=?", [req.params.id]);
    await db('UPDATE users SET is_verified=1 WHERE id=?', [vr.rows[0].user_id]);
    res.json({ message: 'Verification approved. Badge granted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/verification/:id/reject', async (req, res) => {
  try {
    await db("UPDATE verification_requests SET status='rejected', updated_at=datetime('now') WHERE id=?", [req.params.id]);
    res.json({ message: 'Verification rejected.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ---- REPORTS ----
router.get('/reports', async (req, res) => {
  try {
    const result = await db(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
              u.id AS reporter_id, u.full_name AS reporter_name, u.username AS reporter_username
       FROM reports r JOIN users u ON r.reporter_id=u.id
       ORDER BY r.created_at DESC`
    );
    res.json({ reports: result.rows });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/reports/:id/dismiss', async (req, res) => {
  try {
    await db("UPDATE reports SET status='dismissed' WHERE id=?", [req.params.id]);
    res.json({ message: 'Report dismissed.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    await db('DELETE FROM reports WHERE id=?', [req.params.id]);
    res.json({ message: 'Report deleted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ---- SETTINGS ----
router.get('/settings', async (req, res) => {
  try {
    const result = await db('SELECT key, value FROM platform_settings ORDER BY key');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ settings });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/settings', async (req, res) => {
  try {
    const allowed = ['registrations_enabled','stories_enabled','messaging_enabled',
      'verification_requests_enabled','private_accounts_enabled','max_upload_size_mb'];
    const updates = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await db("UPDATE platform_settings SET value=?, updated_at=datetime('now') WHERE key=?", [String(req.body[key]), key]);
        updates.push(key);
      }
    }
    res.json({ message: `Settings updated: ${updates.join(', ')}` });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
