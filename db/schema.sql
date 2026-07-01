-- db/schema.sql
-- Run this file once to set up your database tables.
-- Command: psql -U postgres -d advad_db -f db/schema.sql

-- ─────────────────────────────────────────────
--  USERS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  enumerator_id   VARCHAR(20)  UNIQUE NOT NULL,
  full_name       VARCHAR(100) NOT NULL,
  password_hash   TEXT         NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'enumerator', -- enumerator | supervisor | admin
  district        VARCHAR(100),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  SURVEYS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surveys (
  id                      SERIAL PRIMARY KEY,
  household_id            VARCHAR(30)  UNIQUE NOT NULL,
  enumerator_id           VARCHAR(20)  REFERENCES users(enumerator_id),
  enumerator_name         VARCHAR(100),
  submitted_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Part 1: Customer Identification
  customer_name           VARCHAR(150),
  customer_address        TEXT,
  gps                     VARCHAR(60),
  district                VARCHAR(100),
  enumeration_area        VARCHAR(50),
  survey_date             DATE,

  -- Part 1: Customer Classification
  customer_type           VARCHAR(30),   -- Residential | Commercial | Industrial
  tariff_band             VARCHAR(10),   -- Band A–E
  payment_type            VARCHAR(20),   -- Prepaid | Postpaid
  meter_number            VARCHAR(50),

  -- Part 1: Supply Infrastructure
  substation_name         VARCHAR(100),
  injection_substation    VARCHAR(100),

  -- Part 2: Energy Access
  energy_source           VARCHAR(30),   -- Grid | Solar | Generator | None
  consumption_month1      NUMERIC(10,2),
  consumption_month2      NUMERIC(10,2),
  consumption_month3      NUMERIC(10,2),

  -- Part 2: Grid Satisfaction (grid customers only)
  connection_duration     VARCHAR(50),
  monthly_bill_range      VARCHAR(50),
  outage_frequency        VARCHAR(50),
  satisfaction_rating     SMALLINT,      -- 1–5
  reported_issues         TEXT,

  -- Part 2: Unconnected Profile (off-grid customers only)
  reason_not_connected    VARCHAR(100),
  interest_in_connecting  VARCHAR(10),   -- Yes | No | Maybe
  acceptable_monthly_cost VARCHAR(30),

  -- Part 2: Willingness to Pay
  max_monthly_amount      VARCHAR(30),
  preferred_payment_method VARCHAR(20),
  payment_frequency       VARCHAR(20),

  -- Part 2: Economic Activity
  primary_livelihood      VARCHAR(50),
  business_from_home      VARCHAR(5),    -- Yes | No
  productivity_impact     VARCHAR(30),
  estimated_income_lost   VARCHAR(30),

  -- Field notes (JSON)
  notes                   JSONB          DEFAULT '{}'
);

-- ─────────────────────────────────────────────
--  INDEXES for common queries
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_surveys_enumerator ON surveys(enumerator_id);
CREATE INDEX IF NOT EXISTS idx_surveys_district   ON surveys(district);
CREATE INDEX IF NOT EXISTS idx_surveys_submitted  ON surveys(submitted_at DESC);

-- ─────────────────────────────────────────────
--  NETWORK ASSESSMENTS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_assessments (
  id                    SERIAL PRIMARY KEY,
  asset_id              VARCHAR(30)  UNIQUE NOT NULL,
  enumerator_id         VARCHAR(20)  REFERENCES users(enumerator_id),
  enumerator_name       VARCHAR(100),
  submitted_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Asset Identification
  asset_type            VARCHAR(30),   -- Pole | Transformer | Feeder | Meter | Line
  asset_tag             VARCHAR(60),
  gps                   VARCHAR(60),
  district               VARCHAR(100),
  location_description  TEXT,
  assessment_date        DATE,

  -- Technical Specifications
  capacity_rating        VARCHAR(50),  -- e.g. "500 kVA", "11kV"
  voltage_level          VARCHAR(30),  -- e.g. "11kV", "415V", "230V"
  install_year           VARCHAR(10),
  phase_type             VARCHAR(20),  -- Single Phase | Three Phase
  conductor_type         VARCHAR(50),

  -- Condition Assessment
  physical_condition     VARCHAR(20),  -- Excellent | Good | Fair | Poor | Critical
  visible_defects        TEXT,
  last_maintenance_date  DATE,
  repair_urgency         VARCHAR(20),  -- None | Low | Medium | High | Immediate

  -- Notes
  notes                  JSONB         DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_network_enumerator ON network_assessments(enumerator_id);
CREATE INDEX IF NOT EXISTS idx_network_district   ON network_assessments(district);
CREATE INDEX IF NOT EXISTS idx_network_submitted  ON network_assessments(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_asset_type ON network_assessments(asset_type);

-- ─────────────────────────────────────────────
--  SEED: default admin + enumerator accounts
--  Passwords are all "Advad2026!" (bcrypt hash below)
-- ─────────────────────────────────────────────
INSERT INTO users (enumerator_id, full_name, password_hash, role, district)
VALUES
  ('EN-ADMIN', 'System Admin',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVMd98r0Tu', 'admin',       NULL),
  ('EN-001',   'Chidi Okonkwo',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVMd98r0Tu', 'enumerator',  'Ikeja'),
  ('EN-002',   'Aisha Bello',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVMd98r0Tu', 'enumerator',  'Surulere'),
  ('EN-003',   'Emeka Nwosu',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVMd98r0Tu', 'supervisor',  'Apapa')
ON CONFLICT (enumerator_id) DO NOTHING;
