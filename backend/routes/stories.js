const express = require('express');
const router = express.Router();
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { uploadStory, handleMulterError } = require('../middleware/upload');

// GET /api/stories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db(
      `SELECT s.id, s.media_url, s.media_type, s.expires_at, s.created_at,
              u.id AS user_id, u.full_name, u.username, u.profile_picture, u.is_verified,
              EXISTS(SELECT 1 FROM story_views WHERE story_id=s.id AND viewer_id=?) AS is_viewed
       FROM stories s JOIN users u ON s.user_id=u.id
       WHERE s.expires_at > datetime('now') AND u.is_banned=0
         AND (s.user_id=?
              OR s.user_id IN (SELECT following_id FROM followers WHERE follower_id=? AND status='accepted'))
       ORDER BY s.user_id=? DESC, s.created_at DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );

    const grouped = {};
    result.rows.forEach(s => {
      if (!grouped[s.user_id]) {
        grouped[s.user_id] = {
          user_id: s.user_id, full_name: s.full_name, username: s.username,
          profile_picture: s.profile_picture, is_verified: !!s.is_verified,
          has_unseen: false, stories: []
        };
      }
      if (!s.is_viewed) grouped[s.user_id].has_unseen = true;
      grouped[s.user_id].stories.push({ ...s, is_viewed: !!s.is_viewed });
    });

    res.json({ story_groups: Object.values(grouped) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/stories
router.post('/', authenticateToken, uploadStory.single('media'), handleMulterError, async (req, res) => {
  try {
    const setting = await db("SELECT value FROM platform_settings WHERE key='stories_enabled'");
    if (setting.rows[0]?.value === 'false') return res.status(403).json({ error: 'Stories are currently disabled.' });

    const textOverlay = req.body.text_overlay || null;
    // Allow text-only stories OR media stories
    if (!req.file && !textOverlay) return res.status(400).json({ error: 'Media file or text required.' });

    const mediaUrl  = req.file ? `/uploads/stories/${req.file.filename}` : null;
    const mediaType = req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : 'text';

    await db(
      `INSERT INTO stories (user_id, media_url, media_type, text_overlay) VALUES (?,?,?,?)`,
      [req.user.id, mediaUrl, mediaType, textOverlay]
    );
    res.status(201).json({ message: 'Story created.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/stories/:id/view
router.post('/:id/view', authenticateToken, async (req, res) => {
  try {
    const story = await db("SELECT user_id FROM stories WHERE id=? AND expires_at > datetime('now')", [req.params.id]);
    if (!story.rows.length) return res.status(404).json({ error: 'Story not found or expired.' });
    await db('INSERT OR IGNORE INTO story_views (story_id, viewer_id) VALUES (?,?)', [req.params.id, req.user.id]);
    res.json({ message: 'Story viewed.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/stories/:id/viewers
router.get('/:id/viewers', authenticateToken, async (req, res) => {
  try {
    const story = await db('SELECT user_id FROM stories WHERE id=?', [req.params.id]);
    if (!story.rows.length) return res.status(404).json({ error: 'Story not found.' });
    if (story.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });
    const result = await db(
      `SELECT sv.viewed_at, u.id, u.full_name, u.username, u.profile_picture, u.is_verified
       FROM story_views sv JOIN users u ON sv.viewer_id=u.id
       WHERE sv.story_id=? ORDER BY sv.viewed_at DESC`,
      [req.params.id]
    );
    res.json({ viewers: result.rows.map(v => ({ ...v, is_verified: !!v.is_verified })) });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// DELETE /api/stories/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const story = await db('SELECT user_id FROM stories WHERE id=?', [req.params.id]);
    if (!story.rows.length) return res.status(404).json({ error: 'Story not found.' });
    if (story.rows[0].user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
    await db('DELETE FROM stories WHERE id=?', [req.params.id]);
    res.json({ message: 'Story deleted.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
