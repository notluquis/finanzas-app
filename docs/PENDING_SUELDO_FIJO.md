# Implementación Pendiente: Sueldo Fijo en Timesheets

## Estado Actual (Octubre 2025)

### ✅ Completado
- [x] Base de datos: Campos `salary_type` y `fixed_salary` agregados a tabla `employees`
- [x] Tipos TypeScript: `Employee`, `EmployeePayload`, `EmployeeUpdatePayload` actualizados
- [x] Esquemas Zod: `employeeSchema` y `employeeUpdateSchema` actualizados
- [x] Formularios de empleados: Selector de tipo de salario y campo de sueldo fijo
- [x] Campo opcional: "No tiene horario fijo" para empleados de sueldo fijo

### ❌ Pendiente: Lógica de Timesheets

#### 1. Backend: Cálculo de Nómina
**Archivo:** `server/db.ts` - función que calcula resúmenes de timesheet
**Ubicación aproximada:** Buscar funciones relacionadas con cálculo de salarios por empleado

**Cambios necesarios:**
- Detectar empleados con `salary_type = 'fixed'`
- Para empleados fijos:
  - Si `metadata.no_fixed_schedule = true`: No requerir registro de horas, usar `fixed_salary` como subtotal mensual
  - Si `metadata.no_fixed_schedule = false`: Permitir registro de horas pero usar `fixed_salary` como base + horas extra
- Mantener cálculo actual para empleados `salary_type = 'hourly'`

#### 2. Frontend: UI de Timesheets
**Archivos a modificar:**

**A. `src/features/timesheets/components/TimesheetDetailTable.tsx`**
- Líneas ~80-120: Deshabilitar/ocultar campos de horas si empleado es sueldo fijo sin horario
- Mostrar mensaje informativo para empleados de sueldo fijo
- Verificar prop `selectedEmployee.salary_type` y `selectedEmployee.metadata?.no_fixed_schedule`

**B. `src/features/timesheets/components/TimesheetSummaryTable.tsx`**
- Líneas ~35-45: Actualizar encabezados de tabla si hay empleados de sueldo fijo
- Mostrar "Sueldo fijo" en lugar de tarifa por hora para estos empleados
- Ajustar cálculo de horas para empleados fijos

**C. `src/features/timesheets/utils.ts`**
- Función `buildBulkRows()`: Adaptar para empleados de sueldo fijo
- Función `computeExtraAmount()`: Considerar empleados fijos
- Nuevas funciones helper para detectar tipo de empleado

#### 3. Tipos TypeScript
**Archivo:** `src/features/timesheets/types.ts`
- Actualizar `TimesheetSummaryRow` para incluir `salary_type` y `fixed_salary`
- Considerar si `TimesheetEntry` necesita cambios

#### 4. API Backend
**Archivo:** `server/routes/timesheets.ts` (si existe) o similar
- Endpoint de resumen mensual: Incluir lógica para empleados fijos
- Endpoint de detalle: Validar que empleados sin horario fijo no requieren horas

## Verificaciones Antes de Implementar

### 1. Revisar Estructura Actual
```bash
# Buscar archivos relacionados con timesheets
find src/features/timesheets -name "*.ts" -o -name "*.tsx"
find server -name "*timesheet*" -o -name "*payroll*"
```

### 2. Verificar Esquema de Base de Datos
```sql
-- Confirmar que los campos existen
DESCRIBE employees;
-- Verificar datos de ejemplo
SELECT salary_type, fixed_salary, metadata FROM employees LIMIT 5;
```

### 3. Revisar API Endpoints
```bash
# Buscar rutas de timesheets
grep -r "timesheet" server/routes/
grep -r "/api.*timesheet" src/
```

### 4. Probar Formulario de Empleados
- Crear empleado con sueldo fijo
- Verificar que se guarda `salary_type = 'fixed'` y `fixed_salary`
- Probar checkbox "No tiene horario fijo" y verificar `metadata.no_fixed_schedule`

## Notas de Implementación

### Lógica de Negocio
1. **Empleado hourly**: Funciona como antes (horas × tarifa)
2. **Empleado fixed + sin horario**: `fixed_salary` como subtotal, no requiere horas
3. **Empleado fixed + con horario**: `fixed_salary` como base + horas extra calculadas

### Consideraciones de UI/UX
- Mostrar claramente el tipo de empleado en timesheets
- Deshabilitar campos irrelevantes según el tipo
- Mensajes informativos para guiar al usuario
- Mantener compatibilidad con empleados existentes (hourly)

### Testing
- Probar cálculos con empleados mixtos (hourly + fixed)
- Verificar que empleados existentes no se vean afectados
- Probar edge cases: empleado fijo con 0 horas, empleado fijo con overtime

## Archivos de Referencia
- `/Users/notluquis/finanzas-app/server/db.ts` - Tipos y funciones de empleados
- `/Users/notluquis/finanzas-app/src/features/employees/types.ts` - Tipos frontend
- `/Users/notluquis/finanzas-app/src/features/employees/components/` - Formularios de empleados
- `/Users/notluquis/finanzas-app/src/features/timesheets/` - Componentes de timesheets