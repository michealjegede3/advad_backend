// server.js — Advad Backend API
require("dotenv").config();

const express = require("express");
const cors    = require("cors");

const authRoutes       = require("./routes/auth");
const surveyRoutes     = require("./routes/surveys");
const userRoutes       = require("./routes/users");
const networkRoutes    = require("./routes/networkAssessments");

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json({ limit: "5mb" })); // 5mb to handle GPS + notes payloads

// ─── Health check ────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────
app.use("/api/auth",                authRoutes);
app.use("/api/surveys",             surveyRoutes);
app.use("/api/users",               userRoutes);
app.use("/api/network-assessments", networkRoutes);

// ─── 404 handler ─────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global error handler ─────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "An unexpected error occurred." });
});

// ─── Start server ────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Advad API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});
