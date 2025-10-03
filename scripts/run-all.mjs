#!/usr/bin/env node

/**
 * 🚀 Finanzas App - Script de Ejecución Completa
 * 
 * Comando único para ejecutar todo el proyecto:
 * - Limpia procesos previos
 * - Verifica builds
 * - Inicia desarrollo completo
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function step(message) {
  log(`\n🔄 ${message}`, 'cyan');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function runCommand(command, description) {
  step(description);
  try {
    const { stdout, stderr } = await execAsync(command, { 
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    if (stderr && !stderr.includes('warning')) {
      warning(`Stderr: ${stderr.slice(0, 200)}...`);
    }
    
    success(`${description} completado`);
    return { success: true, output: stdout };
  } catch (err) {
    error(`${description} falló: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function checkHealth() {
  step('Verificando salud del proyecto');
  
  // Verificar que existan archivos clave
  const keyFiles = [
    'package.json',
    'vite.config.ts', 
    'server/index.ts',
    'src/main.tsx'
  ];
  
  for (const file of keyFiles) {
    try {
      await execAsync(`test -f ${file}`, { cwd: projectRoot });
      log(`  ✓ ${file}`, 'green');
    } catch {
      error(`  ✗ ${file} no encontrado`);
      return false;
    }
  }
  
  success('Verificación de archivos completada');
  return true;
}

async function main() {
  log('\n🎯 FINANZAS APP - EJECUCIÓN COMPLETA', 'magenta');
  log('=====================================', 'magenta');
  
  // Verificar salud del proyecto
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    error('El proyecto no está en buen estado. Abortando.');
    process.exit(1);
  }
  
  // Limpiar procesos previos
  const cleanup = await runCommand(
    'node scripts/reset-dev.mjs', 
    'Limpiando procesos previos'
  );
  
  if (!cleanup.success) {
    warning('No se pudieron limpiar procesos previos, continuando...');
  }
  
  // Verificar builds
  step('Verificando que los builds funcionen');
  const builds = [
    { cmd: 'npm run build:server', desc: 'Build del servidor' },
    { cmd: 'npm run build', desc: 'Build del frontend' }
  ];
  
  for (const build of builds) {
    const result = await runCommand(build.cmd, build.desc);
    if (!result.success) {
      error(`Build falló. Revisa los errores de ${build.desc}`);
      process.exit(1);
    }
  }
  
  success('Todos los builds están funcionando correctamente');
  
  // Iniciar desarrollo
  step('Iniciando entorno de desarrollo completo');
  log('\n📱 Frontend: http://localhost:5173/intranet/', 'blue');
  log('🌐 Backend:  http://localhost:4000/api/health', 'blue');
  log('\n💡 Usa Ctrl+C para detener ambos servidores\n', 'yellow');
  
  // Spawn desarrollo con output en tiempo real
  const devProcess = spawn('npm', ['run', 'dev:full'], {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  devProcess.on('close', (code) => {
    if (code === 0) {
      success('Aplicación cerrada correctamente');
    } else {
      error(`Aplicación cerrada con código: ${code}`);
    }
  });
  
  // Manejar señales de interrupción
  process.on('SIGINT', () => {
    log('\n\n🛑 Cerrando aplicación...', 'yellow');
    devProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    log('\n\n🛑 Cerrando aplicación...', 'yellow');
    devProcess.kill('SIGTERM');
  });
}

// Ejecutar script principal
main().catch(err => {
  error(`Error fatal: ${err.message}`);
  process.exit(1);
});