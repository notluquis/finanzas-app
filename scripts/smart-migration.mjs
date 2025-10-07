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

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
}

function addMinutesToTime(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = (hours * 60) + mins + minutes;
  
  // Si pasa de 24 horas, truncar a 23:59
  const finalMinutes = Math.min(totalMinutes, 23 * 60 + 59);
  return minutesToTime(finalMinutes);
}

async function smartMigration() {
  const conn = await mysql.createConnection(config);
  
  try {
    console.log('🧠 Migración inteligente de timesheets...');
    
    const [rows] = await conn.execute(`
      SELECT id, work_date, worked_minutes, overtime_minutes, comment
      FROM employee_timesheets 
      ORDER BY work_date DESC
    `);
    
    console.log('📊 Interpretando datos originales:');
    console.log('ID | Fecha | Worked | Overtime | Interpretación');
    console.log('---|-------|--------|----------|---------------');
    
    const fixes = [];
    
    for (const row of rows) {
      const { id, worked_minutes, overtime_minutes } = row;
      const fecha = row.work_date.toISOString().split('T')[0];
      
      let interpretation = '';
      let newStartTime = '00:00:00';
      let newEndTime = '00:00:00';
      let newComment = row.comment || '';
      
      // Caso 1: Sin trabajo
      if (worked_minutes === 0 && overtime_minutes === 0) {
        interpretation = 'Sin trabajo';
        newStartTime = '00:00:00';
        newEndTime = '00:00:00';
      }
      // Caso 2: Solo worked_minutes (turno normal)
      else if (worked_minutes > 0 && overtime_minutes === 0) {
        interpretation = `Turno normal ${Math.floor(worked_minutes/60)}h${worked_minutes%60}m`;
        newStartTime = '09:00:00';
        newEndTime = addMinutesToTime('09:00:00', worked_minutes);
      }
      // Caso 3: worked_minutes + overtime_minutes (lo más común)
      else if (worked_minutes > 0 && overtime_minutes > 0) {
        // Interpretar: worked_minutes = base (ej: 8 horas), overtime_minutes = extras reales
        if (worked_minutes >= 480 && worked_minutes <= 600) { // 8-10 horas base es normal
          const totalHours = Math.floor((worked_minutes + overtime_minutes) / 60);
          const totalMins = (worked_minutes + overtime_minutes) % 60;
          
          if (totalHours <= 12) {
            // Turno normal + extras
            interpretation = `${Math.floor(worked_minutes/60)}h + ${Math.floor(overtime_minutes/60)}h${overtime_minutes%60}m extra`;
            newStartTime = '09:00:00';
            newEndTime = addMinutesToTime('09:00:00', worked_minutes + overtime_minutes);
          } else {
            // Probablemente datos erróneos - usar solo worked_minutes
            interpretation = `Datos sospechosos (${totalHours}h) → usar solo base`;
            newStartTime = '09:00:00';
            newEndTime = addMinutesToTime('09:00:00', worked_minutes);
            newComment = (newComment ? newComment + ' | ' : '') + `Datos originales: ${totalHours}h${totalMins}m total - revisar`;
          }
        } else {
          // worked_minutes atípico
          interpretation = 'Datos atípicos → revisar manualmente';
          newStartTime = '00:00:00';
          newEndTime = '00:00:00';
          newComment = (newComment ? newComment + ' | ' : '') + `Datos originales: ${worked_minutes}min + ${overtime_minutes}min - revisar`;
        }
      }
      // Caso 4: Solo overtime_minutes (raro)
      else if (worked_minutes === 0 && overtime_minutes > 0) {
        interpretation = `Solo extras (${Math.floor(overtime_minutes/60)}h${overtime_minutes%60}m)`;
        newStartTime = '00:00:00';
        newEndTime = '00:00:00';
        newComment = (newComment ? newComment + ' | ' : '') + `Solo extras: ${Math.floor(overtime_minutes/60)}h${overtime_minutes%60}m - verificar`;
      }
      
      console.log(`${id} | ${fecha} | ${worked_minutes}min | ${overtime_minutes}min | ${interpretation}`);
      
      fixes.push({
        id,
        start_time: newStartTime,
        end_time: newEndTime,
        comment: newComment
      });
    }
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('\n¿Aplicar migración inteligente? (y/N): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Migración cancelada.');
      return;
    }
    
    console.log('\n🔄 Aplicando migración inteligente...');
    
    for (const fix of fixes) {
      await conn.execute(
        'UPDATE employee_timesheets SET start_time = ?, end_time = ?, comment = ? WHERE id = ?',
        [fix.start_time, fix.end_time, fix.comment, fix.id]
      );
      
      console.log(`✓ Migrado ID ${fix.id}: ${fix.start_time} → ${fix.end_time}`);
    }
    
    console.log('\n🎉 Migración inteligente completada!');
    console.log('💡 Ahora revisa los registros con comentarios "!" para ajustes manuales');
    
  } finally {
    await conn.end();
  }
}

smartMigration().catch(console.error);