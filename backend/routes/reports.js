const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/reports
router.post('/', authenticateToken,
  [
    body('target_type').isIn(['post','comment','user','message']),
    body('target_id').isInt(),
    body('reason').trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      await db('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?,?,?,?)',
        [req.user.id, req.body.target_type, req.body.target_id, req.body.reason]);
      res.status(201).json({ message: 'Report submitted.' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
  }
);

module.exports = router;
