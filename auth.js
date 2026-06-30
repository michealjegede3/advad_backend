// routes/auth.js
const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const db       = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
// Body: { enumerator_id, password }
router.post("/login", async (req, res) => {
  const { enumerator_id, password } = req.body;

  if (!enumerator_id || !password) {
    return res.status(400).json({ error: "Enumerator ID and password are required." });
  }

  try {
    const result = await db.query(
      "SELECT * FROM users WHERE enumerator_id = $1 AND is_active = TRUE",
      [enumerator_id.trim()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid ID or password." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid ID or password." });
    }

    // Create JWT token (expires in 12 hours)
    const token = jwt.sign(
      {
        id:            user.id,
        enumerator_id: user.enumerator_id,
        full_name:     user.full_name,
        role:          user.role,
        district:      user.district,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      token,
      user: {
        enumerator_id: user.enumerator_id,
        full_name:     user.full_name,
        role:          user.role,
        district:      user.district,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// GET /api/auth/me — verify token and return current user info
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
