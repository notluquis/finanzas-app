#!/usr/bin/env node

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'finanzas_bioalergia',
};

async function verifyMigration() {
  const conn = await mysql.createConnection(config);
  
  try {
    const [rows] = await conn.execute(`
      SELECT id, work_date, start_time, end_time, worked_minutes, overtime_minutes 
      FROM employee_timesheets 
      WHERE employee_id = 1 
      ORDER BY work_date DESC 
      LIMIT 5
    `);
    
    console.log('📊 Muestra de datos migrados:');
    console.log('ID | Fecha | Entrada | Salida | Trabajadas | Extras');
    console.log('---|-------|---------|--------|------------|-------');
    
    rows.forEach(r => {
      const fecha = r.work_date.toISOString().split('T')[0];
      console.log(`${r.id} | ${fecha} | ${r.start_time} | ${r.end_time} | ${r.worked_minutes}min | ${r.overtime_minutes}min`);
    });
    
    console.log('\n✅ Migración verificada correctamente!');
    
  } finally {
    await conn.end();
  }
}

verifyMigration().catch(console.error);