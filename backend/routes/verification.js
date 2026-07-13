const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { uploadVerification, handleMulterError } = require('../middleware/upload');

// POST /api/verification
router.post('/', authenticateToken, uploadVerification.single('document'), handleMulterError,
  [body('reason').trim().notEmpty().withMessage('Reason is required')],
  async (req, res) => {
    try {
      const setting = await db("SELECT value FROM platform_settings WHERE key='verification_requests_enabled'");
      if (setting.rows[0]?.value === 'false') return res.status(403).json({ error: 'Verification requests are currently disabled.' });

      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const existing = await db("SELECT id FROM verification_requests WHERE user_id=? AND status='pending'", [req.user.id]);
      if (existing.rows.length) return res.status(409).json({ error: 'You already have a pending verification request.' });

      const documentUrl = req.file ? `/uploads/verifications/${req.file.filename}` : null;
      await db('INSERT INTO verification_requests (user_id, reason, document_url) VALUES (?,?,?)',
        [req.user.id, req.body.reason, documentUrl]);

      res.status(201).json({ message: 'Verification request submitted.' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
  }
);

// GET /api/verification/my
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await db('SELECT * FROM verification_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 1', [req.user.id]);
    res.json({ request: result.rows[0] || null });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
