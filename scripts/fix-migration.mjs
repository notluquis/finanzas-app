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

async function fixMigrationIssues() {
  const conn = await mysql.createConnection(config);
  
  try {
    console.log('🔍 Analizando datos migrados...');
    
    // Buscar registros problemáticos
    const [rows] = await conn.execute(`
      SELECT id, work_date, start_time, end_time, worked_minutes, overtime_minutes, comment
      FROM employee_timesheets 
      ORDER BY work_date DESC
    `);
    
    console.log('📊 Análisis de registros:');
    console.log('ID | Fecha | Entrada | Salida | Trabajadas | Extras | Problema');
    console.log('---|-------|---------|--------|------------|--------|----------');
    
    const fixes = [];
    const warnings = [];
    
    for (const row of rows) {
      const totalMinutes = row.worked_minutes + row.overtime_minutes;
      const startTime = row.start_time;
      const endTime = row.end_time;
      let problema = '';
      
      // Caso 1: Sin trabajo (0 minutos) pero tiene horarios
      if (totalMinutes === 0 && (startTime !== '00:00:00' || endTime !== '00:00:00')) {
        problema = 'Sin trabajo → 00:00';
        fixes.push({
          id: row.id,
          start_time: '00:00:00',
          end_time: '00:00:00',
          reason: 'Sin trabajo'
        });
      }
      // Caso 2: Mismo horario entrada/salida pero con minutos trabajados
      else if (startTime === endTime && totalMinutes > 0) {
        problema = 'Entrada=Salida con trabajo → Error';
        fixes.push({
          id: row.id,
          start_time: '00:00:00',
          end_time: '00:00:00',
          reason: 'Error de migración',
          addComment: `Error migración: ${totalMinutes}min no convertidos`
        });
      }
      // Caso 3: Turnos muy cortos (< 2 horas)
      else if (totalMinutes > 0 && totalMinutes < 120) {
        problema = `Turno corto (${Math.floor(totalMinutes/60)}h${totalMinutes%60}m)`;
        warnings.push({
          id: row.id,
          addComment: `Turno corto: ${Math.floor(totalMinutes/60)}h${totalMinutes%60}m`
        });
      }
      // Caso 4: Turnos muy largos (> 16 horas)
      else if (totalMinutes > 960) {
        problema = `Turno largo (${Math.floor(totalMinutes/60)}h${totalMinutes%60}m)`;
        warnings.push({
          id: row.id,
          addComment: `Turno largo: ${Math.floor(totalMinutes/60)}h${totalMinutes%60}m - revisar`
        });
      }
      
      const fecha = row.work_date.toISOString().split('T')[0];
      console.log(`${row.id} | ${fecha} | ${startTime} | ${endTime} | ${row.worked_minutes}min | ${row.overtime_minutes}min | ${problema}`);
    }
    
    console.log(`\n📋 Resumen:`);
    console.log(`🔧 Correcciones necesarias: ${fixes.length}`);
    console.log(`⚠️  Advertencias a agregar: ${warnings.length}`);
    
    if (fixes.length === 0 && warnings.length === 0) {
      console.log('✅ No se encontraron problemas.');
      return;
    }
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('\n¿Aplicar correcciones? (y/N): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Correcciones canceladas.');
      return;
    }
    
    console.log('\n🔄 Aplicando correcciones...');
    
    // Aplicar correcciones
    for (const fix of fixes) {
      await conn.execute(
        'UPDATE employee_timesheets SET start_time = ?, end_time = ? WHERE id = ?',
        [fix.start_time, fix.end_time, fix.id]
      );
      
      if (fix.addComment) {
        await conn.execute(
          'UPDATE employee_timesheets SET comment = CONCAT(COALESCE(comment, ""), IF(comment IS NULL OR comment = "", "", " | "), ?) WHERE id = ?',
          [fix.addComment, fix.id]
        );
      }
      
      console.log(`✓ Corregido ID ${fix.id}: ${fix.reason}`);
    }
    
    // Aplicar advertencias (comentarios)
    for (const warning of warnings) {
      await conn.execute(
        'UPDATE employee_timesheets SET comment = CONCAT(COALESCE(comment, ""), IF(comment IS NULL OR comment = "", "", " | "), ?) WHERE id = ?',
        [warning.addComment, warning.id]
      );
      
      console.log(`⚠️  Advertencia agregada ID ${warning.id}: ${warning.addComment}`);
    }
    
    console.log(`\n🎉 Correcciones aplicadas!`);
    console.log('💡 Los registros con advertencias ahora tienen comentarios con "!" visible');
    
  } finally {
    await conn.end();
  }
}

fixMigrationIssues().catch(console.error);