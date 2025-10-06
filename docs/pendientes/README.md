# Tareas Pendientes - Finanzas App

Este directorio contiene documentación de funcionalidades y mejoras que se han planificado pero no implementado completamente.

## 📁 Estructura

### `sueldo-fijo-timesheets.md`
**Estado:** Parcialmente implementado (backend + formularios ✅, timesheets ❌)  
**Prioridad:** Media  
**Descripción:** Soporte completo para empleados con sueldo fijo mensual en lugar de pago por horas.

**Lo que funciona:**
- Formularios de empleados permiten seleccionar tipo de salario
- Base de datos guarda `salary_type` y `fixed_salary`
- Campo "No tiene horario fijo" para empleados flexibles

**Lo que falta:**
- Lógica de cálculo de nómina para empleados fijos
- UI de timesheets adaptada para mostrar empleados fijos
- Validaciones específicas para cada tipo de empleado

---

## 🔄 Cómo agregar nuevos pendientes

1. Crear archivo `.md` en esta carpeta con nombre descriptivo
2. Incluir secciones:
   - **Estado actual** (qué funciona, qué no)
   - **Cambios necesarios** (archivos específicos y líneas)
   - **Verificaciones** (cómo probar antes de implementar)
   - **Notas de implementación** (consideraciones técnicas)
3. Actualizar este `README.md` con un resumen

## 📋 Template para nuevos pendientes

```markdown
# Funcionalidad Pendiente: [NOMBRE]

## Estado Actual (Fecha)

### ✅ Completado
- [x] Elemento completado

### ❌ Pendiente
- [ ] Elemento pendiente

## Archivos a Modificar
- `ruta/archivo.ts` - Líneas aproximadas, qué cambiar

## Verificaciones Antes de Implementar
1. Comando o prueba para verificar estado actual
2. Otra verificación necesaria

## Notas de Implementación
- Consideración técnica importante
- Edge case a tener en cuenta
```