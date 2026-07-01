// middleware/auth.js — Protects routes that require login
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;

  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, enumerator_id, role, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin" && req.user.role !== "supervisor") {
    return res.status(403).json({ error: "Access denied. Admins and supervisors only." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
