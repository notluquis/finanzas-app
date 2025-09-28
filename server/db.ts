import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import type { PayoutRecord } from "./transformPayouts.js";
import { EFFECTIVE_TIMESTAMP_EXPR } from "./lib/transactions.js";
import { normalizeRut, validateRut } from "./lib/rut.js";
import { InventoryCategory, InventoryItem, InventoryMovement } from "./types.js";

dotenv.config();

type Pool = mysql.Pool;
export type UserRole = "GOD" | "ADMIN" | "ANALYST" | "VIEWER";

export type UserRecord = {
  id: number;
  email: string;
  role: UserRole;
  password_hash: string;
  name: string | null;
};

export type CounterpartPersonType = "PERSON" | "COMPANY" | "OTHER";

export type CounterpartRecord = {
  id: number;
  rut: string | null;
  name: string;
  personType: CounterpartPersonType;
  category: "SUPPLIER" | "PATIENT" | "EMPLOYEE" | "PARTNER" | "RELATED" | "OTHER";
  employeeId: number | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CounterpartAccountRecord = {
  id: number;
  counterpart_id: number;
  account_identifier: string;
  bank_name: string | null;
  account_type: string | null;
  holder: string | null;
  concept: string | null;
  metadata: CounterpartAccountMetadata | null;
  created_at: string;
  updated_at: string;
};

export type CounterpartAccountMetadata = {
  bankAccountNumber?: string | null;
  withdrawId?: string | null;
};

export type AppSettings = {
  orgName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  dbDisplayHost: string;
  dbDisplayName: string;
  dbConsoleUrl: string;
  cpanelUrl: string;
  orgAddress: string;
  orgPhone: string;
  primaryCurrency: string;
  supportEmail: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  orgName: "Bioalergia",
  tagline: "Gestión integral de finanzas",
  primaryColor: "#0e64b7",
  secondaryColor: "#f1a722",
  logoUrl:
    "https://bioalergia.cl/wp-content/uploads/2025/04/Logo-Bioalergia-con-eslogan-y-marca-registrada-1-scaled.png",
  dbDisplayHost: "localhost",
  dbDisplayName: "finanzas",
  dbConsoleUrl: "",
  cpanelUrl: "",
  orgAddress: "",
  orgPhone: "",
  primaryCurrency: "CLP",
  supportEmail: "soporte@bioalergia.cl",
};

const SETTINGS_KEY_MAP: Record<keyof AppSettings, string> = {
  orgName: "brand.orgName",
  tagline: "brand.tagline",
  primaryColor: "brand.primaryColor",
  secondaryColor: "brand.secondaryColor",
  logoUrl: "brand.logoUrl",
  dbDisplayHost: "db.displayHost",
  dbDisplayName: "db.displayName",
  dbConsoleUrl: "db.consoleUrl",
  cpanelUrl: "cpanel.url",
  orgAddress: "org.address",
  orgPhone: "org.phone",
  primaryCurrency: "org.primaryCurrency",
  supportEmail: "contact.supportEmail",
};

const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"] as const;

let pool: Pool | null = null;

async function addColumnIfMissing(pool: Pool, table: string, columnDefinition: string) {
  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}` as string);
  } catch (error) {
    if (typeof error !== "object" || error == null) throw error;
    const code = (error as { code?: string }).code;
    if (code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
}

function assertEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno para la base de datos: ${missing.join(", ")}. ` +
        `Configura el archivo .env con las credenciales de HostGator.`
    );
  }
}

export function getPool(): Pool {
  if (pool) return pool;
  assertEnv();

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 8,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT ?? 5000),
    namedPlaceholders: false,
    dateStrings: true,
  });

  return pool;
}

export async function ensureSchema() {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_transactions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      timestamp_raw VARCHAR(64) NOT NULL,
      timestamp DATETIME NOT NULL,
      description VARCHAR(255) NULL,
      origin VARCHAR(191) NULL,
      destination VARCHAR(191) NULL,
      source_id VARCHAR(191) NULL,
      direction ENUM('IN','OUT','NEUTRO') NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      raw_json TEXT NULL,
      source_file VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_movement (timestamp_raw, direction, amount, origin, destination, source_file)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing(pool, "mp_transactions", "`source_id` VARCHAR(191) NULL AFTER `destination`");

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_withdrawals (
      withdraw_id VARCHAR(191) NOT NULL,
      date_created DATETIME NULL,
      status VARCHAR(64) NULL,
      status_detail VARCHAR(120) NULL,
      amount DECIMAL(15, 2) NULL,
      fee DECIMAL(15, 2) NULL,
      activity_url TEXT NULL,
      payout_desc VARCHAR(255) NULL,
      bank_account_holder VARCHAR(191) NULL,
      identification_type VARCHAR(32) NULL,
      identification_number VARCHAR(64) NULL,
      bank_id VARCHAR(32) NULL,
      bank_name VARCHAR(120) NULL,
      bank_branch VARCHAR(120) NULL,
      bank_account_type VARCHAR(64) NULL,
      bank_account_number VARCHAR(64) NULL,
      raw_json JSON NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (withdraw_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_counterparts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      rut VARCHAR(64) NULL,
      name VARCHAR(191) NOT NULL,
      person_type ENUM('PERSON','COMPANY','OTHER') NOT NULL DEFAULT 'OTHER',
      category ENUM('SUPPLIER','PATIENT','EMPLOYEE','PARTNER','RELATED','OTHER') NOT NULL DEFAULT 'SUPPLIER',
      employee_id INT UNSIGNED NULL,
      email VARCHAR(191) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_counterpart_rut (rut),
      INDEX idx_counterpart_employee (employee_id),
      CONSTRAINT fk_counterpart_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_counterpart_accounts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      counterpart_id INT UNSIGNED NOT NULL,
      account_identifier VARCHAR(191) NOT NULL,
      bank_name VARCHAR(191) NULL,
      account_type VARCHAR(64) NULL,
      holder VARCHAR(191) NULL,
      concept VARCHAR(191) NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_counterpart_account_identifier (account_identifier),
      CONSTRAINT fk_counterpart_account FOREIGN KEY (counterpart_id) REFERENCES mp_counterparts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing(
    pool,
    "mp_counterparts",
    "`category` ENUM('SUPPLIER','PATIENT','EMPLOYEE','PARTNER','RELATED','OTHER') NOT NULL DEFAULT 'SUPPLIER' AFTER person_type"
  );
  await addColumnIfMissing(
    pool,
    "mp_counterparts",
    "`employee_id` INT UNSIGNED NULL AFTER category"
  );
  try {
    await pool.query(
      `ALTER TABLE mp_counterparts
        ADD CONSTRAINT fk_counterpart_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id) ON DELETE SET NULL`
    );
  } catch (error) {
    if ((error as { code?: string }).code !== "ER_CANT_CREATE_TABLE") {
      const code = (error as { code?: string }).code;
      if (code !== "ER_DUP_KEY" && code !== "ER_CANNOT_ADD_FOREIGN" && code !== "ER_FOREIGN_DUPLICATE_KEY") {
        // ignore duplicate constraint errors
      }
    }
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_daily_balances (
      balance_date DATE NOT NULL,
      balance DECIMAL(15, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (balance_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(191) NOT NULL,
      password_hash VARCHAR(191) NOT NULL,
      role ENUM('GOD','ADMIN','ANALYST','VIEWER') NOT NULL DEFAULT 'VIEWER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      config_key VARCHAR(128) NOT NULL,
      config_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (config_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      full_name VARCHAR(191) NOT NULL,
      role VARCHAR(120) NOT NULL,
      email VARCHAR(191) NULL,
      hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
      overtime_rate DECIMAL(10, 2) NULL,
      retention_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
      status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS employee_timesheets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      employee_id INT UNSIGNED NOT NULL,
      work_date DATE NOT NULL,
      start_time TIME NULL,
      end_time TIME NULL,
      worked_minutes INT NOT NULL,
      overtime_minutes INT NOT NULL DEFAULT 0,
      extra_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      comment VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_employee_day (employee_id, work_date),
      INDEX idx_employee_timesheets_employee (employee_id),
      CONSTRAINT fk_timesheet_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS common_supplies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        brand VARCHAR(255),
        model VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS supply_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        supply_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        brand VARCHAR(255),
        model VARCHAR(255),
        notes TEXT,
        status ENUM('pending', 'ordered', 'in_transit', 'delivered', 'rejected') DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await seedDefaultSettings(pool);
  await seedDefaultAdmin(pool);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS role_mappings (
      employee_role VARCHAR(120) NOT NULL,
      app_role ENUM('GOD','ADMIN','ANALYST','VIEWER') NOT NULL,
      PRIMARY KEY (employee_role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const inventorySchemaPath = path.join(__dirname, 'sql', 'create_inventory_tables.sql');
  const inventorySchemaSql = await fs.readFile(inventorySchemaPath, 'utf-8');
  const inventoryStatements = inventorySchemaSql.split(';').filter(s => s.trim().length > 0);

  for (const statement of inventoryStatements) {
    if (statement.trim().length === 0) continue;
    await pool.execute(statement);
  }
}

export type DailyBalance = {
  date: string;
  balance: number;
  note: string | null;
};

export async function listDailyBalances(options: { from?: string; to?: string }) {
  const pool = getPool();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (options.from) {
    conditions.push("balance_date >= ?");
    params.push(options.from);
  }

  if (options.to) {
    conditions.push("balance_date <= ?");
    params.push(options.to);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT balance_date, balance, note
     FROM mp_daily_balances
     ${whereClause}
     ORDER BY balance_date ASC`,
    params
  );

  return rows.map((row) => ({
    date: toDateOnly(row.balance_date),
    balance: Number(row.balance ?? 0),
    note: (row.note as string) ?? null,
  })) satisfies DailyBalance[];
}

export async function getPreviousDailyBalance(date: string) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT balance_date, balance, note
     FROM mp_daily_balances
     WHERE balance_date < ?
     ORDER BY balance_date DESC
     LIMIT 1`,
    [date]
  );

  const row = rows[0];
  if (!row) return null;
  return {
    date: toDateOnly(row.balance_date),
    balance: Number(row.balance ?? 0),
    note: (row.note as string) ?? null,
  } satisfies DailyBalance;
}

export async function upsertDailyBalance(entry: { date: string; balance: number; note?: string | null }) {
  const pool = getPool();
  await pool.query<ResultSetHeader>(
    `INSERT INTO mp_daily_balances (balance_date, balance, note)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = VALUES(balance), note = VALUES(note)`,
    [entry.date, entry.balance, entry.note ?? null]
  );
}

function toDateOnly(value: Date | string | null): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return "";
}

export type EmployeeRecord = {
  id: number;
  full_name: string;
  role: string;
  email: string | null;
  hourly_rate: number;
  overtime_rate: number | null;
  retention_rate: number;
  status: "ACTIVE" | "INACTIVE";
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const EMPLOYEE_FIELDS = `id, full_name, role, email, hourly_rate, overtime_rate, retention_rate, status, metadata, created_at, updated_at`;

export async function listEmployees(options: { includeInactive?: boolean } = {}) {
  const pool = getPool();
  const whereClause = options.includeInactive ? "" : "WHERE status = 'ACTIVE'";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
     FROM employees
     ${whereClause}
     ORDER BY full_name ASC`
  );

  return rows.map(mapEmployeeRow);
}

export async function getEmployeeById(id: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
     FROM employees
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row ? mapEmployeeRow(row) : null;
}

export async function findEmployeeByEmail(email: string) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
       FROM employees
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1`,
    [email]
  );
  const row = rows[0];
  return row ? mapEmployeeRow(row) : null;
}

export async function createEmployee(data: {
  full_name: string;
  role: string;
  email?: string | null;
  hourly_rate: number;
  overtime_rate?: number | null;
  retention_rate: number;
  metadata?: Record<string, unknown> | null;
}) {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO employees
      (full_name, role, email, hourly_rate, overtime_rate, retention_rate, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    [
      data.full_name,
      data.role,
      data.email ?? null,
      data.hourly_rate,
      data.overtime_rate ?? null,
      data.retention_rate,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );

  return getEmployeeById(Number(result.insertId));
}

export async function updateEmployee(
  id: number,
  data: {
    full_name?: string;
    role?: string;
    email?: string | null;
    hourly_rate?: number;
    overtime_rate?: number | null;
    retention_rate?: number;
    status?: "ACTIVE" | "INACTIVE";
    metadata?: Record<string, unknown> | null;
  }
) {
  const pool = getPool();
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (data.full_name != null) {
    fields.push("full_name = ?");
    params.push(data.full_name);
  }
  if (data.role != null) {
    fields.push("role = ?");
    params.push(data.role);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    params.push(data.email ?? null);
  }
  if (data.hourly_rate != null) {
    fields.push("hourly_rate = ?");
    params.push(data.hourly_rate);
  }
  if (data.overtime_rate !== undefined) {
    fields.push("overtime_rate = ?");
    params.push(data.overtime_rate ?? null);
  }
  if (data.retention_rate != null) {
    fields.push("retention_rate = ?");
    params.push(data.retention_rate);
  }
  if (data.status != null) {
    fields.push("status = ?");
    params.push(data.status);
  }
  if (data.metadata !== undefined) {
    fields.push("metadata = ?");
    params.push(data.metadata ? JSON.stringify(data.metadata) : null);
  }

  if (!fields.length) return getEmployeeById(id);

  params.push(id);
  await pool.query<ResultSetHeader>(
    `UPDATE employees
     SET ${fields.join(", ")}
     WHERE id = ?`,
    params
  );

  return getEmployeeById(id);
}

export async function deactivateEmployee(id: number) {
  await updateEmployee(id, { status: "INACTIVE" });
}

function mapEmployeeRow(row: RowDataPacket): EmployeeRecord {
  return {
    id: Number(row.id),
    full_name: String(row.full_name),
    role: String(row.role),
    email: row.email ? String(row.email) : null,
    hourly_rate: Number(row.hourly_rate ?? 0),
    overtime_rate: row.overtime_rate != null ? Number(row.overtime_rate) : null,
    retention_rate: Number(row.retention_rate ?? 0),
    status: row.status as EmployeeRecord["status"],
    metadata: row.metadata ? safeParseJson(row.metadata as string) : null,
    created_at: toDateTime(row.created_at),
    updated_at: toDateTime(row.updated_at),
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toDateTime(value: Date | string | null): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value.includes("T") ? value : `${value}Z`;
  }
  return "";
}

export type TimesheetEntry = {
  id: number;
  employee_id: number;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  extra_amount: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export async function upsertTimesheetEntry(entry: {
  employee_id: number;
  work_date: string;
  worked_minutes: number;
  overtime_minutes: number;
  extra_amount: number;
  start_time?: string | null;
  end_time?: string | null;
  comment?: string | null;
}) {
  const pool = getPool();
  const startTime = entry.start_time ?? null;
  const endTime = entry.end_time ?? null;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO employee_timesheets
      (employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       start_time = VALUES(start_time),
       end_time = VALUES(end_time),
       worked_minutes = VALUES(worked_minutes),
       overtime_minutes = VALUES(overtime_minutes),
       extra_amount = VALUES(extra_amount),
       comment = VALUES(comment),
       updated_at = CURRENT_TIMESTAMP`,
    [
      entry.employee_id,
      entry.work_date,
      startTime,
      endTime,
      entry.worked_minutes,
      entry.overtime_minutes,
      entry.extra_amount,
      entry.comment ?? null,
    ]
  );

  const insertedId = result.insertId ? Number(result.insertId) : null;
  if (insertedId) {
    return getTimesheetEntryById(insertedId);
  }

  const poolRow = await getTimesheetEntryByEmployeeAndDate(entry.employee_id, entry.work_date);
  return poolRow;
}

export async function updateTimesheetEntry(
  id: number,
  data: {
    start_time?: string | null;
    end_time?: string | null;
    worked_minutes?: number;
    overtime_minutes?: number;
    extra_amount?: number;
    comment?: string | null;
  }
) {
  const pool = getPool();
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (data.start_time !== undefined) {
    fields.push("start_time = ?");
    params.push(data.start_time ?? null);
  }
  if (data.end_time !== undefined) {
    fields.push("end_time = ?");
    params.push(data.end_time ?? null);
  }
  if (data.worked_minutes != null) {
    fields.push("worked_minutes = ?");
    params.push(data.worked_minutes);
  }
  if (data.overtime_minutes != null) {
    fields.push("overtime_minutes = ?");
    params.push(data.overtime_minutes);
  }
  if (data.extra_amount != null) {
    fields.push("extra_amount = ?");
    params.push(data.extra_amount);
  }
  if (data.comment !== undefined) {
    fields.push("comment = ?");
    params.push(data.comment ?? null);
  }

  if (!fields.length) return getTimesheetEntryById(id);

  params.push(id);
  await pool.query<ResultSetHeader>(
    `UPDATE employee_timesheets
     SET ${fields.join(", ")}
     WHERE id = ?`,
    params
  );

  return getTimesheetEntryById(id);
}

export async function deleteTimesheetEntry(id: number) {
  const pool = getPool();
  await pool.query<ResultSetHeader>(`DELETE FROM employee_timesheets WHERE id = ?`, [id]);
}

export async function listTimesheetEntries(options: {
  employee_id?: number;
  from: string;
  to: string;
}) {
  const pool = getPool();
  const conditions = ["work_date >= ?", "work_date <= ?"];
  const params: Array<string | number> = [options.from, options.to];
  if (options.employee_id) {
    conditions.push("employee_id = ?");
    params.push(options.employee_id);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE ${conditions.join(" AND ")}
     ORDER BY work_date ASC`,
    params
  );

  return rows.map(mapTimesheetRow);
}

export async function getTimesheetEntryByEmployeeAndDate(employeeId: number, workDate: string) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE employee_id = ? AND work_date = ?
     LIMIT 1`,
    [employeeId, workDate]
  );
  const row = rows[0];
  return row ? mapTimesheetRow(row) : null;
}

export async function getTimesheetEntryById(id: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row ? mapTimesheetRow(row) : null;
}

function mapTimesheetRow(row: RowDataPacket): TimesheetEntry {
  return {
    id: Number(row.id),
    employee_id: Number(row.employee_id),
    work_date: toDateOnly(row.work_date),
    start_time: row.start_time ? String(row.start_time).slice(0, 5) : null,
    end_time: row.end_time ? String(row.end_time).slice(0, 5) : null,
    worked_minutes: Number(row.worked_minutes ?? 0),
    overtime_minutes: Number(row.overtime_minutes ?? 0),
    extra_amount: Number(row.extra_amount ?? 0),
    comment: row.comment ? String(row.comment) : null,
    created_at: toDateTime(row.created_at),
    updated_at: toDateTime(row.updated_at),
  };
}

async function seedDefaultSettings(pool: Pool) {
  const entries = Object.entries(SETTINGS_KEY_MAP) as [keyof AppSettings, string][];
  const values = entries.map(([field, key]) => [key, DEFAULT_SETTINGS[field]]);
  await pool.query(
    `INSERT INTO settings (config_key, config_value)
     VALUES ?
     ON DUPLICATE KEY UPDATE config_key = config_key` as string,
    [values]
  );
}

async function seedDefaultAdmin(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM users`
  );
  const total = rows.length ? Number(rows[0].total ?? 0) : 0;
  if (total > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "No se creó un usuario administrador inicial. Define ADMIN_EMAIL y ADMIN_PASSWORD en tu .env para el bootstrap."
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'GOD')`,
    [email.toLowerCase(), passwordHash]
  );

  console.info(
    `Usuario administrador inicial creado (${email.toLowerCase()}). Cambia la contraseña después del primer inicio.`
  );
}

export async function loadSettings(): Promise<AppSettings> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT config_key AS keyName, config_value AS value FROM settings`
  );

  const map = new Map<string, string>();
  rows.forEach((row) => {
    if (row.keyName) map.set(String(row.keyName), row.value ? String(row.value) : "");
  });

  const result: AppSettings = { ...DEFAULT_SETTINGS };
  (Object.keys(SETTINGS_KEY_MAP) as (keyof AppSettings)[]).forEach((field) => {
    const key = SETTINGS_KEY_MAP[field];
    const value = map.get(key);
    if (typeof value === "string" && value.length) {
      result[field] = value;
    }
  });

  return result;
}

export async function saveSettings(update: Partial<AppSettings>) {
  const entries = Object.entries(update) as [keyof AppSettings, string | undefined][];
  const filtered = entries.filter(([, value]) => typeof value === "string");
  if (!filtered.length) return;

  const pool = getPool();
  const values = filtered.map(([field, value]) => [SETTINGS_KEY_MAP[field], value ?? ""]);

  await pool.query(
    `INSERT INTO settings (config_key, config_value)
     VALUES ?
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)` as string,
    [values]
  );
}

export async function upsertWithdrawals(payouts: PayoutRecord[]) {
  if (!payouts.length) {
    return { inserted: 0, updated: 0 };
  }

  const pool = getPool();
  const values = payouts.map((payout) => [
    payout.withdrawId,
    payout.dateCreated,
    payout.status,
    payout.statusDetail,
    payout.amount,
    payout.fee,
    payout.activityUrl,
    payout.payoutDesc,
    payout.bankAccountHolder,
    payout.identificationType,
    payout.identificationNumber,
    payout.bankId,
    payout.bankName,
    payout.bankBranch,
    payout.bankAccountType,
    payout.bankAccountNumber,
    JSON.stringify(payout.raw),
  ]);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO mp_withdrawals (
        withdraw_id,
        date_created,
        status,
        status_detail,
        amount,
        fee,
        activity_url,
        payout_desc,
        bank_account_holder,
        identification_type,
        identification_number,
        bank_id,
        bank_name,
        bank_branch,
        bank_account_type,
        bank_account_number,
        raw_json
      ) VALUES ?
      ON DUPLICATE KEY UPDATE
        date_created = VALUES(date_created),
        status = VALUES(status),
        status_detail = VALUES(status_detail),
        amount = VALUES(amount),
        fee = VALUES(fee),
        activity_url = VALUES(activity_url),
        payout_desc = VALUES(payout_desc),
        bank_account_holder = VALUES(bank_account_holder),
        identification_type = VALUES(identification_type),
        identification_number = VALUES(identification_number),
        bank_id = VALUES(bank_id),
        bank_name = VALUES(bank_name),
        bank_branch = VALUES(bank_branch),
        bank_account_type = VALUES(bank_account_type),
        bank_account_number = VALUES(bank_account_number),
        raw_json = VALUES(raw_json)` as string,
    [values]
  );

  const inserted = result.affectedRows - result.changedRows;
  const updated = result.changedRows;

  return { inserted, updated };
}

function mapCounterpart(row: RowDataPacket): CounterpartRecord {
  return {
    id: Number(row.id),
    rut: row.rut ? String(row.rut) : null,
    name: String(row.name),
    personType: (row.person_type as CounterpartPersonType) ?? "OTHER",
    category: (row.category as CounterpartRecord["category"]) ?? "SUPPLIER",
    employeeId: row.employee_id != null ? Number(row.employee_id) : null,
    email: row.email ? String(row.email) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapCounterpartAccount(row: RowDataPacket): CounterpartAccountRecord {
  let metadata: CounterpartAccountMetadata | null = null;
  if (row.metadata) {
    try {
      const parsed = JSON.parse(String(row.metadata));
      metadata = parsed && typeof parsed === "object" ? parsed : null;
    } catch (_err) {
      metadata = null;
    }
  }

  const withdrawBankAccountNumber = row.mw_bank_account_number ? String(row.mw_bank_account_number) : null;
  const withdrawBankName = row.mw_bank_name ? String(row.mw_bank_name) : null;
  const withdrawHolder = row.mw_bank_account_holder ? String(row.mw_bank_account_holder) : null;
  const withdrawAccountType = row.mw_bank_account_type ? String(row.mw_bank_account_type) : null;

  if (withdrawBankAccountNumber || row.account_identifier) {
    const nextMetadata: CounterpartAccountMetadata = {
      bankAccountNumber: withdrawBankAccountNumber ?? metadata?.bankAccountNumber ?? null,
      withdrawId: metadata?.withdrawId ?? (row.account_identifier ? String(row.account_identifier) : null),
    };
    metadata = metadata ? { ...metadata, ...nextMetadata } : nextMetadata;
  }

  return {
    id: Number(row.id),
    counterpart_id: Number(row.counterpart_id),
    account_identifier: String(row.account_identifier),
    bank_name: row.bank_name ? String(row.bank_name) : withdrawBankName,
    account_type: row.account_type ? String(row.account_type) : withdrawAccountType,
    holder: row.holder ? String(row.holder) : withdrawHolder,
    concept: row.concept ? String(row.concept) : null,
    metadata,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listCounterparts(): Promise<CounterpartRecord[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, rut, name, person_type, category, employee_id, email, notes, created_at, updated_at
       FROM mp_counterparts
      ORDER BY name ASC`
  );
  return rows.map(mapCounterpart);
}

export async function getCounterpartById(id: number) {
  const pool = getPool();
  const [[counterpartRow]] = await pool.query<RowDataPacket[]>(
    `SELECT id, rut, name, person_type, category, employee_id, email, notes, created_at, updated_at
       FROM mp_counterparts
      WHERE id = ?
      LIMIT 1` as string,
    [id]
  );
  if (!counterpartRow) return null;
  const [accountRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id,
            a.counterpart_id,
            a.account_identifier,
            a.bank_name,
            a.account_type,
            a.holder,
            a.concept,
            a.metadata,
            a.created_at,
            a.updated_at,
            MAX(mw.bank_account_number) AS mw_bank_account_number,
            MAX(mw.bank_name) AS mw_bank_name,
            MAX(mw.bank_account_holder) AS mw_bank_account_holder,
            MAX(mw.bank_account_type) AS mw_bank_account_type
       FROM mp_counterpart_accounts a
       LEFT JOIN mp_withdrawals mw ON mw.withdraw_id = a.account_identifier
      WHERE a.counterpart_id = ?
      GROUP BY a.id
      ORDER BY a.created_at ASC` as string,
    [id]
  );
  return {
    counterpart: mapCounterpart(counterpartRow),
    accounts: accountRows.map(mapCounterpartAccount),
  };
}

export async function createCounterpart(payload: {
  rut?: string | null;
  name: string;
  personType: CounterpartPersonType;
  category?: CounterpartRecord["category"];
  employeeId?: number | null;
  employeeEmail?: string | null;
  email?: string | null;
  notes?: string | null;
}) {
  const pool = getPool();
  const rutNormalized = payload.rut ? normalizeRut(payload.rut) : null;
  if (payload.rut && (!rutNormalized || !validateRut(rutNormalized))) {
    throw new Error("RUT inválido");
  }

  let employeeId = payload.employeeId ?? null;
  if (payload.category === "EMPLOYEE") {
    employeeId = await ensureEmployeeForCounterpart(payload.name, payload.email ?? payload.employeeEmail ?? null);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO mp_counterparts (rut, name, person_type, category, employee_id, email, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)` as string,
    [
      rutNormalized,
      payload.name,
      payload.personType,
      payload.category ?? "SUPPLIER",
      employeeId,
      payload.email?.trim() || null,
      payload.notes ?? null,
    ]
  );
  const id = Number(result.insertId);
  if (rutNormalized) {
    await attachAccountsByRut(id, rutNormalized);
  }
  return id;
}

export async function updateCounterpart(
  id: number,
  payload: {
    rut?: string | null;
    name?: string;
    personType?: CounterpartPersonType;
    category?: CounterpartRecord["category"];
    employeeId?: number | null;
    employeeEmail?: string | null;
    email?: string | null;
    notes?: string | null;
  }
) {
  const fields: string[] = [];
  const params: Array<string | number | null> = [];
  let normalizedRut: string | null | undefined;
  if (payload.rut !== undefined) {
    normalizedRut = payload.rut ? normalizeRut(payload.rut) : null;
    if (payload.rut && (!normalizedRut || !validateRut(normalizedRut))) {
      throw new Error("RUT inválido");
    }
    fields.push("rut = ?");
    params.push(normalizedRut);
  }
  if (payload.name !== undefined) {
    fields.push("name = ?");
    params.push(payload.name);
  }
  if (payload.personType !== undefined) {
    fields.push("person_type = ?");
    params.push(payload.personType);
  }
  let employeeId = payload.employeeId ?? null;
  if (payload.category !== undefined) {
    fields.push("category = ?");
    params.push(payload.category);
  }
  if (payload.category === "EMPLOYEE") {
    employeeId = await ensureEmployeeForCounterpart(
      payload.name ?? (await getCounterpartById(id))?.counterpart.name ?? "",
      payload.email ?? payload.employeeEmail ?? null
    );
  }
  if (payload.category !== undefined || payload.employeeId !== undefined || payload.employeeEmail !== undefined) {
    fields.push("employee_id = ?");
    params.push(employeeId);
  }
  if (payload.email !== undefined) {
    fields.push("email = ?");
    params.push(payload.email?.trim() || null);
  }
  if (payload.notes !== undefined) {
    fields.push("notes = ?");
    params.push(payload.notes ?? null);
  }
  if (!fields.length) return;
  params.push(id);
  const pool = getPool();
  await pool.query(`UPDATE mp_counterparts SET ${fields.join(", ")} WHERE id = ? LIMIT 1` as string, params);
  if (normalizedRut) {
    await attachAccountsByRut(id, normalizedRut);
  }
}

async function ensureEmployeeForCounterpart(name: string, email?: string | null) {
  const trimmedEmail = email?.trim();
  if (!trimmedEmail) {
    const employee = await createEmployee({
      full_name: name,
      role: "GENERATED",
      email: null,
      hourly_rate: 0,
      retention_rate: 0,
      metadata: { source: "counterpart" },
    });
    return employee?.id ?? null;
  }
  const existing = await findEmployeeByEmail(trimmedEmail);
  if (existing) {
    return existing.id;
  }
  const employee = await createEmployee({
    full_name: name,
    role: "GENERATED",
    email: trimmedEmail,
    hourly_rate: 0,
    retention_rate: 0,
    metadata: { source: "counterpart" },
  });
  return employee?.id ?? null;
}

async function attachAccountsByRut(counterpartId: number, rut: string) {
  const normalized = normalizeRut(rut);
  if (!normalized) return;
  const numericRut = normalized.replace(/[^0-9K]/gi, "");
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
        t.source_id AS account_identifier,
        MAX(mw.bank_account_holder) AS holder,
        MAX(mw.bank_name) AS bank_name,
        MAX(mw.bank_account_type) AS account_type,
        MAX(mw.bank_account_number) AS bank_account_number
       FROM mp_transactions t
       LEFT JOIN mp_withdrawals mw ON t.source_id = mw.withdraw_id
      WHERE t.direction = 'OUT'
        AND t.source_id IS NOT NULL
        AND mw.identification_number IS NOT NULL
        AND REPLACE(REPLACE(REPLACE(UPPER(mw.identification_number),'.',''),'-',''),' ','') = ?
      GROUP BY t.source_id` as string,
    [numericRut]
  );
  for (const row of rows) {
    const accountIdentifier = row.account_identifier as string | null;
    if (!accountIdentifier) continue;
    await upsertCounterpartAccount(counterpartId, {
      accountIdentifier,
      bankName: row.bank_name ? String(row.bank_name) : null,
      accountType: row.account_type ? String(row.account_type) : null,
      holder: row.holder ? String(row.holder) : null,
      metadata: {
        bankAccountNumber: row.bank_account_number ? String(row.bank_account_number) : null,
        withdrawId: accountIdentifier,
      },
    });
  }
}

export async function upsertCounterpartAccount(
  counterpartId: number,
  payload: {
    accountIdentifier: string;
    bankName?: string | null;
    accountType?: string | null;
    holder?: string | null;
    concept?: string | null;
    metadata?: CounterpartAccountMetadata | null;
  }
): Promise<number> {
  const pool = getPool();
  const identifier = payload.accountIdentifier.trim();
  const metadataJson = payload.metadata != null ? JSON.stringify(payload.metadata) : null;

  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, counterpart_id, metadata FROM mp_counterpart_accounts WHERE account_identifier = ? LIMIT 1` as string,
    [identifier]
  );
  if (existingRows.length) {
    const existing = existingRows[0];
    let metadataValue = existing.metadata as string | null;
    if (payload.metadata !== undefined) {
      metadataValue = metadataJson;
    }
    await pool.query(
      `UPDATE mp_counterpart_accounts
          SET counterpart_id = ?, bank_name = ?, account_type = ?, holder = ?, concept = ?, metadata = ?
        WHERE id = ?` as string,
      [
        counterpartId,
        payload.bankName ?? null,
        payload.accountType ?? null,
        payload.holder ?? null,
        payload.concept ?? null,
        metadataValue,
        Number(existing.id),
      ]
    );
    return Number(existing.id);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO mp_counterpart_accounts
        (counterpart_id, account_identifier, bank_name, account_type, holder, concept, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)` as string,
    [
      counterpartId,
      identifier,
      payload.bankName ?? null,
      payload.accountType ?? null,
      payload.holder ?? null,
      payload.concept ?? null,
      metadataJson,
    ]
  );
  return Number(result.insertId);
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: {
    bankName?: string | null;
    accountType?: string | null;
    holder?: string | null;
    concept?: string | null;
    metadata?: any;
  }
) {
  const fields: string[] = [];
  const params: Array<string | number | null> = [];
  if (payload.bankName !== undefined) {
    fields.push("bank_name = ?");
    params.push(payload.bankName ?? null);
  }
  if (payload.accountType !== undefined) {
    fields.push("account_type = ?");
    params.push(payload.accountType ?? null);
  }
  if (payload.holder !== undefined) {
    fields.push("holder = ?");
    params.push(payload.holder ?? null);
  }
  if (payload.concept !== undefined) {
    fields.push("concept = ?");
    params.push(payload.concept ?? null);
  }
  if (payload.metadata !== undefined) {
    fields.push("metadata = ?");
    params.push(payload.metadata ? JSON.stringify(payload.metadata) : null);
  }
  if (!fields.length) return;
  params.push(accountId);
  const pool = getPool();
  await pool.query(
    `UPDATE mp_counterpart_accounts SET ${fields.join(", ")} WHERE id = ? LIMIT 1` as string,
    params
  );
}

export type CounterpartAccountSuggestion = {
  accountIdentifier: string;
  rut: string | null;
  holder: string | null;
  bankName: string | null;
  accountType: string | null;
  totalAmount: number;
  movements: number;
  assignedCounterpartId: number | null;
};

export async function listAccountSuggestions(query: string, limit: number): Promise<CounterpartAccountSuggestion[]> {
  const pool = getPool();
  const like = `%${query.trim()}%`;
  const normalizedRut = normalizeRut(query);
  const numericRut = normalizedRut ? normalizedRut.replace(/[^0-9K]/gi, "") : null;
  const conditions = [
    "t.source_id LIKE ?",
    "mw.bank_account_number LIKE ?",
    "mw.bank_account_holder LIKE ?",
    "mw.identification_number LIKE ?",
  ];
  const params: Array<string | number> = [like, like, like, like];
  if (numericRut) {
    conditions.push("REPLACE(REPLACE(REPLACE(UPPER(mw.identification_number),'.',''),'-',''),' ','') = ?");
    params.push(numericRut);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
        t.source_id AS account_identifier,
        MAX(mw.bank_account_number) AS bank_account_number,
        MAX(mw.identification_number) AS rut,
        MAX(mw.bank_account_holder) AS holder,
        MAX(mw.bank_name) AS bank_name,
        MAX(mw.bank_account_type) AS account_type,
        SUM(t.amount) AS total_amount,
        COUNT(*) AS movements,
        MAX(ca.counterpart_id) AS assigned_counterpart_id
      FROM mp_transactions t
      LEFT JOIN mp_withdrawals mw ON t.source_id = mw.withdraw_id
      LEFT JOIN mp_counterpart_accounts ca ON ca.account_identifier = t.source_id
     WHERE t.direction = 'OUT'
       AND (${conditions.join(" OR ")})
     GROUP BY t.source_id
     ORDER BY total_amount DESC, movements DESC
     LIMIT ?` as string,
    [...params, limit]
  );

  return rows.map((row) => ({
    accountIdentifier: String(row.account_identifier),
    rut: row.rut ? String(row.rut) : null,
    holder: row.holder ? String(row.holder) : null,
    bankName: row.bank_name ? String(row.bank_name) : null,
    accountType: row.account_type ? String(row.account_type) : null,
    bankAccountNumber: row.bank_account_number ? String(row.bank_account_number) : null,
    withdrawId: row.account_identifier ? String(row.account_identifier) : null,
    totalAmount: Number(row.total_amount ?? 0),
    movements: Number(row.movements ?? 0),
    assignedCounterpartId: row.assigned_counterpart_id != null ? Number(row.assigned_counterpart_id) : null,
  }));
}

export async function counterpartSummary(
  counterpartId: number,
  params: { from?: string; to?: string }
): Promise<{
  monthly: Array<{ month: string; concept: string; total: number }>;
  byAccount: Array<{
    account_identifier: string;
    concept: string | null;
    bank_name: string | null;
    total: number;
    count: number;
  }>;
}> {
  const pool = getPool();
  const conditions: string[] = ["a.counterpart_id = ?", "t.direction = 'OUT'"];
  const paramsList: Array<string | number> = [counterpartId];
  if (params.from) {
    conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} >= ?`);
    paramsList.push(params.from);
  }
  if (params.to) {
    conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} <= ?`);
    paramsList.push(params.to);
  }
  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const [monthlyRows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(${EFFECTIVE_TIMESTAMP_EXPR}, '%Y-%m-01') AS month,
            COALESCE(a.concept, 'Sin concepto') AS concept,
            SUM(t.amount) AS total
       FROM mp_transactions t
       JOIN mp_counterpart_accounts a ON t.source_id = a.account_identifier
      ${whereClause}
      GROUP BY month, concept
      ORDER BY month ASC` as string,
    paramsList
  );

  const [accountRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.account_identifier,
            a.concept,
            a.bank_name,
            SUM(t.amount) AS total,
            COUNT(*) AS count
       FROM mp_transactions t
       JOIN mp_counterpart_accounts a ON t.source_id = a.account_identifier
      ${whereClause}
      GROUP BY a.account_identifier, a.concept, a.bank_name
      ORDER BY total DESC` as string,
    paramsList
  );

  return {
    monthly: monthlyRows.map((row) => ({
      month: String(row.month),
      concept: String(row.concept),
      total: Number(row.total ?? 0),
    })),
    byAccount: accountRows.map((row) => ({
      account_identifier: String(row.account_identifier),
      concept: row.concept ? String(row.concept) : null,
      bank_name: row.bank_name ? String(row.bank_name) : null,
      total: Number(row.total ?? 0),
      count: Number(row.count ?? 0),
    })),
  };
}

export async function assignAccountsToCounterpartByRut(counterpartId: number, rut: string) {
  const normalized = normalizeRut(rut);
  if (!normalized || !validateRut(normalized)) {
    throw new Error("El RUT no es válido");
  }
  await attachAccountsByRut(counterpartId, normalized);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.email, u.password_hash, u.role, e.full_name as name
     FROM users u
     LEFT JOIN employees e ON u.email = e.email
     WHERE u.email = ? LIMIT 1`,
    [email.toLowerCase()]
  );

  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: Number(row.id),
    email: String(row.email),
    password_hash: String(row.password_hash),
    role: row.role as UserRole,
    name: row.name ? String(row.name) : null,
  };
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.email, u.password_hash, u.role, e.full_name as name
     FROM users u
     LEFT JOIN employees e ON u.email = e.email
     WHERE u.id = ? LIMIT 1`,
    [id]
  );

  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: Number(row.id),
    email: String(row.email),
    password_hash: String(row.password_hash),
    role: row.role as UserRole,
    name: row.name ? String(row.name) : null,
  };
}

export function isRoleAtLeast(role: UserRole, expected: UserRole[]): boolean {
  if (role === "GOD") return true;
  if (expected.includes(role)) return true;
  return false;
}

// --- Role Mapping Functions ---

export type RoleMapping = {
  employee_role: string;
  app_role: UserRole;
};

export async function listRoleMappings(): Promise<RoleMapping[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT employee_role, app_role FROM role_mappings`
  );
  return rows as RoleMapping[];
}

export async function upsertRoleMapping(employee_role: string, app_role: UserRole): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO role_mappings (employee_role, app_role) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE app_role = VALUES(app_role)`,
    [employee_role, app_role]
  );
}

// --- Inventory Functions ---

export async function listInventoryCategories(): Promise<InventoryCategory[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, created_at FROM inventory_categories ORDER BY name ASC`
  );
  return rows as InventoryCategory[];
}

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory_categories (name) VALUES (?)`,
    [name]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, created_at FROM inventory_categories WHERE id = ?`,
    [result.insertId]
  );
  return rows[0] as InventoryCategory;
}

export async function listInventoryItems(): Promise<InventoryItem[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      i.id, i.category_id, i.name, i.description, i.current_stock, i.created_at, i.updated_at, c.name as category_name
     FROM inventory_items i
     LEFT JOIN inventory_categories c ON i.category_id = c.id
     ORDER BY i.name ASC`
  );
  return rows as InventoryItem[];
}

export async function createInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryItem> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory_items (category_id, name, description, current_stock) VALUES (?, ?, ?, ?)`,
    [item.category_id, item.name, item.description, item.current_stock]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, category_id, name, description, current_stock, created_at, updated_at FROM inventory_items WHERE id = ?`,
    [result.insertId]
  );
  return rows[0] as InventoryItem;
}

export async function updateInventoryItem(id: number, item: Partial<Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>>): Promise<InventoryItem> {
  const pool = getPool();
  const fields = Object.keys(item).map(k => `\`${k}\` = ?`).join(', ');
  const values = Object.values(item);
  await pool.query(
    `UPDATE inventory_items SET ${fields} WHERE id = ?`,
    [...values, id]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, category_id, name, description, current_stock, created_at, updated_at FROM inventory_items WHERE id = ?`,
    [id]
  );
  return rows[0] as InventoryItem;
}

export async function deleteInventoryItem(id: number): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM inventory_items WHERE id = ?', [id]);
}

export async function createInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'created_at'>): Promise<void> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO inventory_movements (item_id, quantity_change, reason) VALUES (?, ?, ?)`,
      [movement.item_id, movement.quantity_change, movement.reason]
    );
    await connection.query(
      `UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?`,
      [movement.quantity_change, movement.item_id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
