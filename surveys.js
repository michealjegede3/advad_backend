// routes/surveys.js
const express = require("express");
const db      = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────
//  POST /api/surveys
//  Submit a new survey (or overwrite if household_id exists)
// ─────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const f = req.body;

  if (!f.householdId) {
    return res.status(400).json({ error: "householdId is required." });
  }

  try {
    const sql = `
      INSERT INTO surveys (
        household_id, enumerator_id, enumerator_name, survey_date,
        customer_name, customer_address, gps, district, enumeration_area,
        customer_type, tariff_band, payment_type, meter_number,
        substation_name, injection_substation,
        energy_source, consumption_month1, consumption_month2, consumption_month3,
        connection_duration, monthly_bill_range, outage_frequency, satisfaction_rating, reported_issues,
        reason_not_connected, interest_in_connecting, acceptable_monthly_cost,
        max_monthly_amount, preferred_payment_method, payment_frequency,
        primary_livelihood, business_from_home, productivity_impact, estimated_income_lost,
        notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
      )
      ON CONFLICT (household_id) DO UPDATE SET
        enumerator_id           = EXCLUDED.enumerator_id,
        enumerator_name         = EXCLUDED.enumerator_name,
        survey_date             = EXCLUDED.survey_date,
        customer_name           = EXCLUDED.customer_name,
        customer_address        = EXCLUDED.customer_address,
        gps                     = EXCLUDED.gps,
        district                = EXCLUDED.district,
        enumeration_area        = EXCLUDED.enumeration_area,
        customer_type           = EXCLUDED.customer_type,
        tariff_band             = EXCLUDED.tariff_band,
        payment_type            = EXCLUDED.payment_type,
        meter_number            = EXCLUDED.meter_number,
        substation_name         = EXCLUDED.substation_name,
        injection_substation    = EXCLUDED.injection_substation,
        energy_source           = EXCLUDED.energy_source,
        consumption_month1      = EXCLUDED.consumption_month1,
        consumption_month2      = EXCLUDED.consumption_month2,
        consumption_month3      = EXCLUDED.consumption_month3,
        connection_duration     = EXCLUDED.connection_duration,
        monthly_bill_range      = EXCLUDED.monthly_bill_range,
        outage_frequency        = EXCLUDED.outage_frequency,
        satisfaction_rating     = EXCLUDED.satisfaction_rating,
        reported_issues         = EXCLUDED.reported_issues,
        reason_not_connected    = EXCLUDED.reason_not_connected,
        interest_in_connecting  = EXCLUDED.interest_in_connecting,
        acceptable_monthly_cost = EXCLUDED.acceptable_monthly_cost,
        max_monthly_amount      = EXCLUDED.max_monthly_amount,
        preferred_payment_method= EXCLUDED.preferred_payment_method,
        payment_frequency       = EXCLUDED.payment_frequency,
        primary_livelihood      = EXCLUDED.primary_livelihood,
        business_from_home      = EXCLUDED.business_from_home,
        productivity_impact     = EXCLUDED.productivity_impact,
        estimated_income_lost   = EXCLUDED.estimated_income_lost,
        notes                   = EXCLUDED.notes,
        submitted_at            = NOW()
      RETURNING id, household_id, submitted_at
    `;

    const consumption = f.consumption || {};

    const values = [
      f.householdId,
      req.user.enumerator_id,
      req.user.full_name,
      f.date || null,
      f.customerName        || null,
      f.customerAddress     || null,
      f.gps                 || null,
      f.district            || null,
      f.enumerationArea     || null,
      f.customerType        || null,
      f.tariffBand          || null,
      f.paymentType         || null,
      f.meterNumber         || null,
      f.substationName      || null,
      f.injectionSubstation || null,
      f.energySource        || null,
      consumption["Month 1"] ? parseFloat(consumption["Month 1"]) : null,
      consumption["Month 2"] ? parseFloat(consumption["Month 2"]) : null,
      consumption["Month 3"] ? parseFloat(consumption["Month 3"]) : null,
      f.connectionDuration       || null,
      f.monthlyBillRange         || null,
      f.outageFrequency          || null,
      f.satisfactionRating       ? parseInt(f.satisfactionRating) : null,
      f.reportedIssues           || null,
      f.reasonNotConnected       || null,
      f.interestInConnecting     || null,
      f.acceptableMonthlyCost    || null,
      f.maxMonthlyAmount         || null,
      f.preferredPaymentMethod   || null,
      f.paymentFrequency         || null,
      f.primaryLivelihood        || null,
      f.businessFromHome         || null,
      f.productivityImpact       || null,
      f.estimatedIncomeLost      || null,
      JSON.stringify(f.notes || {}),
    ];

    const result = await db.query(sql, values);
    res.status(201).json({ success: true, survey: result.rows[0] });

  } catch (err) {
    console.error("Submit survey error:", err);
    res.status(500).json({ error: "Failed to save survey." });
  }
});

// ─────────────────────────────────────────────
//  GET /api/surveys
//  List all surveys (admin/supervisor sees all; enumerator sees own)
//  Query params: district, customerType, tariffBand, energySource, search, page, limit
// ─────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const {
    district, customerType, tariffBand, energySource, search,
    page = 1, limit = 100,
  } = req.query;

  const isAdmin = req.user.role === "admin" || req.user.role === "supervisor";
  const offset  = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let values     = [];
  let idx        = 1;

  // Enumerators can only see their own submissions
  if (!isAdmin) {
    conditions.push(`enumerator_id = $${idx++}`);
    values.push(req.user.enumerator_id);
  }

  if (district)     { conditions.push(`district = $${idx++}`);      values.push(district); }
  if (customerType) { conditions.push(`customer_type = $${idx++}`); values.push(customerType); }
  if (tariffBand)   { conditions.push(`tariff_band = $${idx++}`);   values.push(tariffBand); }
  if (energySource) { conditions.push(`energy_source = $${idx++}`); values.push(energySource); }

  if (search) {
    conditions.push(`(
      customer_name ILIKE $${idx} OR
      household_id  ILIKE $${idx} OR
      district      ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM surveys ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT * FROM surveys ${where}
       ORDER BY submitted_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, parseInt(limit), offset]
    );

    res.json({
      total,
      page:    parseInt(page),
      limit:   parseInt(limit),
      surveys: dataResult.rows,
    });
  } catch (err) {
    console.error("List surveys error:", err);
    res.status(500).json({ error: "Failed to fetch surveys." });
  }
});

// ─────────────────────────────────────────────
//  GET /api/surveys/stats
//  Summary stats for the dashboard
// ─────────────────────────────────────────────
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)                                             AS total,
        COUNT(*) FILTER (WHERE energy_source = 'Grid')      AS connected,
        COUNT(*) FILTER (WHERE energy_source != 'Grid')     AS unconnected,
        ROUND(AVG(satisfaction_rating), 1)                  AS avg_satisfaction,
        COUNT(*) FILTER (WHERE productivity_impact = 'Significantly') AS severely_impacted,
        COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '24 hours') AS new_today
      FROM surveys
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

// ─────────────────────────────────────────────
//  GET /api/surveys/:householdId
//  Get a single survey by household ID
// ─────────────────────────────────────────────
router.get("/:householdId", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM surveys WHERE household_id = $1",
      [req.params.householdId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Survey not found." });
    }

    // Enumerators can only view their own
    const survey = result.rows[0];
    if (req.user.role === "enumerator" && survey.enumerator_id !== req.user.enumerator_id) {
      return res.status(403).json({ error: "Access denied." });
    }

    res.json(survey);
  } catch (err) {
    console.error("Get survey error:", err);
    res.status(500).json({ error: "Failed to fetch survey." });
  }
});

// ─────────────────────────────────────────────
//  GET /api/surveys/export/csv
//  Download all surveys as CSV (admin only)
// ─────────────────────────────────────────────
router.get("/export/csv", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM surveys ORDER BY submitted_at DESC"
    );

    const headers = [
      "Household ID","Customer Name","Address","District","EA","Enumerator","Date",
      "Type","Band","Payment","Meter","Substation","Injection SS","Energy Source",
      "Month 1 (kWh)","Month 2 (kWh)","Month 3 (kWh)","Satisfaction","Outage Freq",
      "Reason Not Connected","Interest in Connecting","Max Monthly","Livelihood",
      "Biz From Home","Productivity Impact","Income Lost","Submitted At",
    ];

    const escape = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';

    const rows = result.rows.map(r => [
      r.household_id, r.customer_name, r.customer_address, r.district,
      r.enumeration_area, r.enumerator_id, r.survey_date,
      r.customer_type, r.tariff_band, r.payment_type, r.meter_number,
      r.substation_name, r.injection_substation, r.energy_source,
      r.consumption_month1, r.consumption_month2, r.consumption_month3,
      r.satisfaction_rating, r.outage_frequency,
      r.reason_not_connected, r.interest_in_connecting, r.max_monthly_amount,
      r.primary_livelihood, r.business_from_home, r.productivity_impact,
      r.estimated_income_lost, r.submitted_at,
    ].map(escape).join(","));

    const csv = [headers.map(escape).join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="advad_surveys.csv"');
    res.send(csv);
  } catch (err) {
    console.error("Export CSV error:", err);
    res.status(500).json({ error: "Failed to export surveys." });
  }
});

module.exports = router;
