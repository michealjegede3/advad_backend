// routes/networkAssessments.js
const express = require("express");
const db      = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────
//  POST /api/network-assessments
//  Submit a new assessment (or overwrite if asset_id exists)
// ─────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const f = req.body;

  if (!f.assetId) {
    return res.status(400).json({ error: "assetId is required." });
  }

  try {
    const sql = `
      INSERT INTO network_assessments (
        asset_id, enumerator_id, enumerator_name, assessment_date,
        asset_type, asset_tag, gps, district, location_description,
        capacity_rating, voltage_level, install_year, phase_type, conductor_type,
        physical_condition, visible_defects, last_maintenance_date, repair_urgency,
        notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      ON CONFLICT (asset_id) DO UPDATE SET
        enumerator_id          = EXCLUDED.enumerator_id,
        enumerator_name        = EXCLUDED.enumerator_name,
        assessment_date         = EXCLUDED.assessment_date,
        asset_type              = EXCLUDED.asset_type,
        asset_tag               = EXCLUDED.asset_tag,
        gps                     = EXCLUDED.gps,
        district                = EXCLUDED.district,
        location_description    = EXCLUDED.location_description,
        capacity_rating         = EXCLUDED.capacity_rating,
        voltage_level           = EXCLUDED.voltage_level,
        install_year            = EXCLUDED.install_year,
        phase_type              = EXCLUDED.phase_type,
        conductor_type          = EXCLUDED.conductor_type,
        physical_condition      = EXCLUDED.physical_condition,
        visible_defects         = EXCLUDED.visible_defects,
        last_maintenance_date   = EXCLUDED.last_maintenance_date,
        repair_urgency          = EXCLUDED.repair_urgency,
        notes                   = EXCLUDED.notes,
        submitted_at            = NOW()
      RETURNING id, asset_id, submitted_at
    `;

    const values = [
      f.assetId,
      req.user.enumerator_id,
      req.user.full_name,
      f.date                  || null,
      f.assetType              || null,
      f.assetTag               || null,
      f.gps                    || null,
      f.district               || null,
      f.locationDescription    || null,
      f.capacityRating         || null,
      f.voltageLevel           || null,
      f.installYear            || null,
      f.phaseType              || null,
      f.conductorType          || null,
      f.physicalCondition      || null,
      f.visibleDefects         || null,
      f.lastMaintenanceDate    || null,
      f.repairUrgency          || null,
      JSON.stringify(f.notes || {}),
    ];

    const result = await db.query(sql, values);
    res.status(201).json({ success: true, assessment: result.rows[0] });

  } catch (err) {
    console.error("Submit network assessment error:", err);
    res.status(500).json({ error: "Failed to save assessment." });
  }
});

// ─────────────────────────────────────────────
//  GET /api/network-assessments
//  List all assessments (admin/supervisor sees all; enumerator sees own)
// ─────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const {
    district, assetType, physicalCondition, repairUrgency, search,
    page = 1, limit = 100,
  } = req.query;

  const isAdmin = req.user.role === "admin" || req.user.role === "supervisor";
  const offset  = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let values     = [];
  let idx        = 1;

  if (!isAdmin) {
    conditions.push(`enumerator_id = $${idx++}`);
    values.push(req.user.enumerator_id);
  }

  if (district)          { conditions.push(`district = $${idx++}`);           values.push(district); }
  if (assetType)         { conditions.push(`asset_type = $${idx++}`);         values.push(assetType); }
  if (physicalCondition) { conditions.push(`physical_condition = $${idx++}`); values.push(physicalCondition); }
  if (repairUrgency)     { conditions.push(`repair_urgency = $${idx++}`);     values.push(repairUrgency); }

  if (search) {
    conditions.push(`(
      asset_tag ILIKE $${idx} OR
      asset_id  ILIKE $${idx} OR
      district  ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM network_assessments ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT * FROM network_assessments ${where}
       ORDER BY submitted_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, parseInt(limit), offset]
    );

    res.json({
      total,
      page:        parseInt(page),
      limit:       parseInt(limit),
      assessments: dataResult.rows,
    });
  } catch (err) {
    console.error("List network assessments error:", err);
    res.status(500).json({ error: "Failed to fetch assessments." });
  }
});

// ─────────────────────────────────────────────
//  GET /api/network-assessments/stats
// ─────────────────────────────────────────────
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE physical_condition IN ('Poor','Critical')) AS poor_condition,
        COUNT(*) FILTER (WHERE repair_urgency IN ('High','Immediate'))    AS urgent_repairs,
        COUNT(DISTINCT asset_type)                                       AS asset_types_count,
        COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '24 hours') AS new_today
      FROM network_assessments
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Network stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

// ─────────────────────────────────────────────
//  GET /api/network-assessments/:assetId
// ─────────────────────────────────────────────
router.get("/:assetId", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM network_assessments WHERE asset_id = $1",
      [req.params.assetId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Assessment not found." });
    }

    const assessment = result.rows[0];
    if (req.user.role === "enumerator" && assessment.enumerator_id !== req.user.enumerator_id) {
      return res.status(403).json({ error: "Access denied." });
    }

    res.json(assessment);
  } catch (err) {
    console.error("Get network assessment error:", err);
    res.status(500).json({ error: "Failed to fetch assessment." });
  }
});

// ─────────────────────────────────────────────
//  GET /api/network-assessments/export/csv
// ─────────────────────────────────────────────
router.get("/export/csv", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM network_assessments ORDER BY submitted_at DESC"
    );

    const headers = [
      "Asset ID","Asset Type","Asset Tag","District","Location","Enumerator","Date",
      "Capacity/Rating","Voltage Level","Install Year","Phase Type","Conductor Type",
      "Condition","Defects","Last Maintenance","Repair Urgency","Submitted At",
    ];

    const escape = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';

    const rows = result.rows.map(r => [
      r.asset_id, r.asset_type, r.asset_tag, r.district, r.location_description,
      r.enumerator_id, r.assessment_date,
      r.capacity_rating, r.voltage_level, r.install_year, r.phase_type, r.conductor_type,
      r.physical_condition, r.visible_defects, r.last_maintenance_date, r.repair_urgency,
      r.submitted_at,
    ].map(escape).join(","));

    const csv = [headers.map(escape).join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="advad_network_assessments.csv"');
    res.send(csv);
  } catch (err) {
    console.error("Export network CSV error:", err);
    res.status(500).json({ error: "Failed to export assessments." });
  }
});

module.exports = router;
