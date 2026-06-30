// routes/users.js
const express = require("express");
const bcrypt  = require("bcryptjs");
const db      = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/users — list all users (admin only)
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, enumerator_id, full_name, role, district, is_active, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// POST /api/users — create a new enumerator (admin only)
// Body: { enumerator_id, full_name, password, role, district }
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { enumerator_id, full_name, password, role = "enumerator", district } = req.body;

  if (!enumerator_id || !full_name || !password) {
    return res.status(400).json({ error: "enumerator_id, full_name, and password are required." });
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (enumerator_id, full_name, password_hash, role, district)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, enumerator_id, full_name, role, district, created_at`,
      [enumerator_id.trim(), full_name.trim(), password_hash, role, district || null]
    );

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Enumerator ID already exists." });
    }
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user." });
  }
});

// PATCH /api/users/:enumerator_id/deactivate — disable a user account
router.patch("/:enumerator_id/deactivate", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.query(
      "UPDATE users SET is_active = FALSE WHERE enumerator_id = $1",
      [req.params.enumerator_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Deactivate user error:", err);
    res.status(500).json({ error: "Failed to deactivate user." });
  }
});

// PATCH /api/users/:enumerator_id/password — reset password
// Body: { new_password }
router.patch("/:enumerator_id/password", requireAuth, requireAdmin, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE enumerator_id = $2",
      [password_hash, req.params.enumerator_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

module.exports = router;
