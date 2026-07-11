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
        customer_name, customer_address, gps, zone, district, enumeration_area, customer_status,
        customer_type, customer_class, nature_of_business, tariff_band, payment_type, metering_status, meter_number,
        feeder_name, substation_name, injection_substation,
        transformer_category, transformer_capacity, transformer_name,
        energy_source, connected_to_grid, load_month1, load_month2, load_month3,
        consumption_month1, consumption_month2, consumption_month3,
        connection_duration, monthly_bill_range, outage_frequency, satisfaction_rating, reported_issues,
        reason_not_connected, interest_in_connecting, acceptable_monthly_cost,
        willingness_to_accept_ipp,
        primary_livelihood, business_from_home, productivity_impact,
        notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,
        $39,$40,$41,$42,$43,$44,$45
      )
      ON CONFLICT (household_id) DO UPDATE SET
        enumerator_id           = EXCLUDED.enumerator_id,
        enumerator_name         = EXCLUDED.enumerator_name,
        survey_date             = EXCLUDED.survey_date,
        customer_name           = EXCLUDED.customer_name,
        customer_address        = EXCLUDED.customer_address,
        gps                     = EXCLUDED.gps,
        zone                    = EXCLUDED.zone,
        district                = EXCLUDED.district,
        enumeration_area        = EXCLUDED.enumeration_area,
        customer_status         = EXCLUDED.customer_status,
        customer_type           = EXCLUDED.customer_type,
        customer_class          = EXCLUDED.customer_class,
        nature_of_business      = EXCLUDED.nature_of_business,
        tariff_band             = EXCLUDED.tariff_band,
        payment_type            = EXCLUDED.payment_type,
        metering_status         = EXCLUDED.metering_status,
        meter_number            = EXCLUDED.meter_number,
        feeder_name             = EXCLUDED.feeder_name,
        substation_name         = EXCLUDED.substation_name,
        injection_substation    = EXCLUDED.injection_substation,
        transformer_category    = EXCLUDED.transformer_category,
        transformer_capacity    = EXCLUDED.transformer_capacity,
        transformer_name        = EXCLUDED.transformer_name,
        energy_source           = EXCLUDED.energy_source,
        connected_to_grid       = EXCLUDED.connected_to_grid,
        load_month1             = EXCLUDED.load_month1,
        load_month2             = EXCLUDED.load_month2,
        load_month3             = EXCLUDED.load_month3,
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
        willingness_to_accept_ipp = EXCLUDED.willingness_to_accept_ipp,
        primary_livelihood      = EXCLUDED.primary_livelihood,
        business_from_home      = EXCLUDED.business_from_home,
        productivity_impact     = EXCLUDED.productivity_impact,
        notes                   = EXCLUDED.notes,
        submitted_at            = NOW()
      RETURNING id, household_id, submitted_at
    `;

    const consumption = f.consumption || {};
    const load = f.load || {};

    const values = [
      f.householdId,
      req.user.enumerator_id,
      req.user.full_name,
      f.date || null,
      f.customerName        || null,
      f.customerAddress     || null,
      f.gps                 || null,
      f.zone                 || null,
      f.district            || null,
      f.enumerationArea     || null,
      f.customerStatus      || null,
      f.customerType        || null,
      f.customerClass       || null,
      f.natureOfBusiness    || null,
      f.tariffBand          || null,
      f.paymentType         || null,
      f.meteringStatus      || null,
      f.meterNumber         || null,
      f.feederName          || null,
      f.substationName      || null,
      f.injectionSubstation || null,
      f.transformerCategory || null,
      f.transformerCapacity || null,
      f.transformerName     || null,
      f.energySource        || null,
      f.connectedToGrid     || null,
      load["Month 1"] ? parseFloat(load["Month 1"]) : null,
      load["Month 2"] ? parseFloat(load["Month 2"]) : null,
      load["Month 3"] ? parseFloat(load["Month 3"]) : null,
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
      f.willingnessToAcceptIPP   || null,
      f.primaryLivelihood        || null,
      f.businessFromHome         || null,
      f.productivityImpact       || null,
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
  if (energySource) { conditions.push(`energy_source ILIKE $${idx++}`); values.push(`%${energySource}%`); }

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
        COUNT(*) FILTER (WHERE energy_source ILIKE '%Grid%')  AS connected,
        COUNT(*) FILTER (WHERE energy_source NOT ILIKE '%Grid%' OR energy_source IS NULL) AS unconnected,
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
      "Household ID","Customer Name","Address","Zone","District","EA","Enumerator","Date","Customer Status",
      "Type","Class","Nature of Business","Band","Payment","Metering Status","Meter",
      "Feeder","Substation","Injection SS","Transformer Category","Transformer Capacity (kVA)","Transformer Name",
      "Energy Source","Connected to Grid",
      "Month 1 Load (kVA)","Month 2 Load (kVA)","Month 3 Load (kVA)",
      "Month 1 (kWh)","Month 2 (kWh)","Month 3 (kWh)","Satisfaction","Outage Freq",
      "Reason Not Connected","Interest in Connecting","Willingness to Accept IPP","Livelihood",
      "Biz From Home","Productivity Impact","Submitted At",
    ];

    const escape = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';

    const rows = result.rows.map(r => [
      r.household_id, r.customer_name, r.customer_address, r.zone, r.district,
      r.enumeration_area, r.enumerator_id, r.survey_date, r.customer_status,
      r.customer_type, r.customer_class, r.nature_of_business, r.tariff_band, r.payment_type, r.metering_status, r.meter_number,
      r.feeder_name, r.substation_name, r.injection_substation, r.transformer_category, r.transformer_capacity, r.transformer_name,
      r.energy_source, r.connected_to_grid,
      r.load_month1, r.load_month2, r.load_month3,
      r.consumption_month1, r.consumption_month2, r.consumption_month3,
      r.satisfaction_rating, r.outage_frequency,
      r.reason_not_connected, r.interest_in_connecting, r.willingness_to_accept_ipp,
      r.primary_livelihood, r.business_from_home, r.productivity_impact,
      r.submitted_at,
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
