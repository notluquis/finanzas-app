#!/usr/bin/env node

/**
 * Script de migración para convertir worked_minutes a start_time/end_time
 * 
 * Este script:
 * 1. Busca registros con worked_minutes > 0 pero sin start_time/end_time
 * 2. Calcula start_time y end_time basado en worked_minutes
 * 3. Asume un horario estándar: 09:00 inicio, calcula fin basado en minutos trabajados
 * 4. Para overtime_minutes, extiende el end_time
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'finanzas_bioalergia',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  charset: 'utf8mb4',
  timezone: '+00:00',
};

/**
 * Convierte minutos a formato HH:MM
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Suma minutos a una hora en formato HH:MM
 */
function addMinutesToTime(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = (hours * 60) + mins + minutes;
  
  // Manejar overflow de 24 horas (para turnos nocturnos)
  const finalMinutes = totalMinutes % (24 * 60);
  return minutesToTime(finalMinutes);
}

async function migrateTimesheets() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('🔍 Buscando registros para migrar...');
    
    // Buscar registros que necesitan migración
    const [rows] = await connection.execute(`
      SELECT id, employee_id, work_date, worked_minutes, overtime_minutes, start_time, end_time
      FROM employee_timesheets 
      WHERE worked_minutes > 0 
        AND (start_time IS NULL OR end_time IS NULL)
      ORDER BY work_date DESC
    `);
    
    if (rows.length === 0) {
      console.log('✅ No hay registros que necesiten migración.');
      return;
    }
    
    console.log(`📋 Encontrados ${rows.length} registros para migrar:`);
    console.log('ID | Empleado | Fecha | Worked | Overtime | Start | End');
    console.log('---|----------|-------|--------|----------|-------|----');
    
    rows.forEach(row => {
      console.log(`${row.id} | ${row.employee_id} | ${row.work_date.toISOString().split('T')[0]} | ${row.worked_minutes}min | ${row.overtime_minutes}min | ${row.start_time || 'NULL'} | ${row.end_time || 'NULL'}`);
    });
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('\n¿Proceder con la migración? (y/N): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Migración cancelada.');
      return;
    }
    
    console.log('\n🔄 Iniciando migración...');
    
    let migratedCount = 0;
    
    for (const row of rows) {
      const { id, worked_minutes, overtime_minutes } = row;
      
      // Hora de inicio estándar: 09:00
      const startTime = '09:00';
      
      // Calcular hora de fin: inicio + worked_minutes + overtime_minutes
      const totalMinutes = worked_minutes + overtime_minutes;
      const endTime = addMinutesToTime(startTime, totalMinutes);
      
      // Actualizar registro
      await connection.execute(`
        UPDATE employee_timesheets 
        SET start_time = ?, end_time = ?
        WHERE id = ?
      `, [startTime, endTime, id]);
      
      migratedCount++;
      console.log(`✓ Migrado ID ${id}: ${startTime} → ${endTime} (${totalMinutes} minutos)`);
    }
    
    console.log(`\n🎉 Migración completada exitosamente!`);
    console.log(`📊 Registros migrados: ${migratedCount}`);
    console.log('\n💡 Notas importantes:');
    console.log('• Todos los registros ahora tienen start_time = 09:00');
    console.log('• end_time se calculó basado en worked_minutes + overtime_minutes');
    console.log('• Los usuarios pueden ajustar manualmente las horas si es necesario');
    console.log('• Los cálculos futuros usarán start_time/end_time automáticamente');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Ejecutar migración
migrateTimesheets().catch(error => {
  console.error('💥 Migración fallida:', error);
  process.exit(1);
});