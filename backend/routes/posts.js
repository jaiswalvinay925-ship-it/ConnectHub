const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query: db, _db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { uploadPost, handleMulterError } = require('../middleware/upload');

// GET /api/posts - feed
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const uid = req.user.id;

    const result = await db(
      `SELECT p.id, p.caption, p.created_at, p.user_id,
              u.full_name, u.username, u.profile_picture, u.is_verified,
              (SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comments_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) AS is_liked
       FROM posts p JOIN users u ON p.user_id=u.id
       WHERE p.is_hidden=0 AND u.is_banned=0
         AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=p.user_id) OR (blocker_id=p.user_id AND blocked_id=?))
         AND (p.user_id=?
              OR p.user_id IN (SELECT following_id FROM followers WHERE follower_id=? AND status='accepted')
              OR u.is_private=0)
       ORDER BY
         CASE WHEN p.user_id=? OR p.user_id IN (SELECT following_id FROM followers WHERE follower_id=? AND status='accepted')
              THEN 0 ELSE 1 END,
         p.created_at DESC
       LIMIT ? OFFSET ?`,
      [uid, uid, uid, uid, uid, uid, uid, limit, offset]
    );

    // Attach media to each post
    const posts = await Promise.all(result.rows.map(async post => {
      const media = await db('SELECT id, file_url, media_type FROM post_media WHERE post_id=? ORDER BY display_order', [post.id]);
      return { ...post, is_liked: !!post.is_liked, is_verified: !!post.is_verified, media: media.rows };
    }));

    res.json({ posts, page, limit });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/posts
router.post('/', authenticateToken, uploadPost.array('media', 10), handleMulterError,
  [body('caption').optional().isLength({ max: 2200 })],
  async (req, res) => {
    try {
      if (!req.files?.length) return res.status(400).json({ error: 'At least one media file is required.' });

      const insertPost = _db.prepare('INSERT INTO posts (user_id, caption) VALUES (?, ?)');
      const insertMedia = _db.prepare('INSERT INTO post_media (post_id, file_url, media_type, display_order) VALUES (?, ?, ?, ?)');

      const create = _db.transaction(() => {
        const info = insertPost.run(req.user.id, req.body.caption || null);
        const postId = info.lastInsertRowid;
        req.files.forEach((file, i) => {
          const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
          insertMedia.run(postId, `/uploads/posts/${file.filename}`, mediaType, i);
        });
        return postId;
      });

      const postId = create();
      const post = await db(
        `SELECT p.*, u.full_name, u.username, u.profile_picture, u.is_verified FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id=?`,
        [postId]
      );
      const media = await db('SELECT id, file_url, media_type FROM post_media WHERE post_id=? ORDER BY display_order', [postId]);
      res.status(201).json({ message: 'Post created.', post: { ...post.rows[0], media: media.rows } });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
  }
);

// GET /api/posts/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT p.id, p.caption, p.created_at, p.user_id,
              u.full_name, u.username, u.profile_picture, u.is_verified,
              (SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comments_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) AS is_liked
       FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id=? AND p.is_hidden=0`,
      [req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Post not found.' });
    const media = await db('SELECT id, file_url, media_type FROM post_media WHERE post_id=? ORDER BY display_order', [req.params.id]);
    const post = { ...result.rows[0], is_liked: !!result.rows[0].is_liked, is_verified: !!result.rows[0].is_verified, media: media.rows };
    res.json({ post });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/posts/:id
router.put('/:id', authenticateToken, [body('caption').optional().isLength({ max: 2200 })], async (req, res) => {
  try {
    const post = await db('SELECT * FROM posts WHERE id=?', [req.params.id]);
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found.' });
    if (post.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });
    await db("UPDATE posts SET caption=?, updated_at=datetime('now') WHERE id=?", [req.body.caption, req.params.id]);
    res.json({ message: 'Post updated.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// DELETE /api/posts/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await db('SELECT user_id FROM posts WHERE id=?', [req.params.id]);
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found.' });
    if (post.rows[0].user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
    await db('DELETE FROM posts WHERE id=?', [req.params.id]);
    res.json({ message: 'Post deleted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/posts/:id/like
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = await db('SELECT user_id FROM posts WHERE id=?', [postId]);
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found.' });
    await db('INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?,?)', [req.user.id, postId]);
    if (post.rows[0].user_id !== req.user.id) {
      await db('INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?,?,?,?)',
        [post.rows[0].user_id, req.user.id, 'like', postId]).catch(() => {});
    }
    const count = await db('SELECT COUNT(*) as c FROM likes WHERE post_id=?', [postId]);
    res.json({ message: 'Liked.', likes_count: count.rows[0].c });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// DELETE /api/posts/:id/like
router.delete('/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    await db('DELETE FROM likes WHERE user_id=? AND post_id=?', [req.user.id, postId]);
    const count = await db('SELECT COUNT(*) as c FROM likes WHERE post_id=?', [postId]);
    res.json({ message: 'Unliked.', likes_count: count.rows[0].c });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/posts/:id/comments
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT c.id, c.comment, c.created_at, c.updated_at,
              u.id AS user_id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=? ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json({ comments: result.rows.map(c => ({ ...c, is_verified: !!c.is_verified })) });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/posts/:id/comments
router.post('/:id/comments', authenticateToken, [body('comment').trim().notEmpty().isLength({ max: 2200 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const postId = parseInt(req.params.id);
    const post = await db('SELECT user_id FROM posts WHERE id=?', [postId]);
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found.' });
    await db('INSERT INTO comments (user_id, post_id, comment) VALUES (?,?,?)', [req.user.id, postId, req.body.comment]);
    const cId = _db.prepare('SELECT last_insert_rowid() as id').get().id;
    if (post.rows[0].user_id !== req.user.id) {
      await db('INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?,?,?,?)',
        [post.rows[0].user_id, req.user.id, 'comment', postId]).catch(() => {});
    }
    const comment = await db(
      `SELECT c.*, u.full_name, u.username, u.profile_picture, u.is_verified FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=?`, [cId]
    );
    res.status(201).json({ message: 'Comment added.', comment: { ...comment.rows[0], is_verified: !!comment.rows[0].is_verified } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/comments/:id
router.put('/comments/:id', authenticateToken, [body('comment').trim().notEmpty()], async (req, res) => {
  try {
    const c = await db('SELECT * FROM comments WHERE id=?', [req.params.id]);
    if (!c.rows.length) return res.status(404).json({ error: 'Comment not found.' });
    if (c.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });
    await db("UPDATE comments SET comment=?, updated_at=datetime('now') WHERE id=?", [req.body.comment, req.params.id]);
    res.json({ message: 'Comment updated.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// DELETE /api/comments/:id
router.delete('/comments/:id', authenticateToken, async (req, res) => {
  try {
    const c = await db('SELECT user_id FROM comments WHERE id=?', [req.params.id]);
    if (!c.rows.length) return res.status(404).json({ error: 'Comment not found.' });
    if (c.rows[0].user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
    await db('DELETE FROM comments WHERE id=?', [req.params.id]);
    res.json({ message: 'Comment deleted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
