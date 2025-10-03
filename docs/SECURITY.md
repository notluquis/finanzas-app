# 🔐 Guía de Seguridad - Variables de Entorno

## 📋 Resumen

Este proyecto implementa las mejores prácticas de seguridad para el manejo de variables de entorno usando **dotenvx**.

## 🛡️ Medidas de Seguridad Implementadas

### 1. **Prevención de Commits Accidentales**
- ✅ Hook de pre-commit que bloquea subida de archivos `.env`
- ✅ `.gitignore` actualizado con patrones de seguridad
- ✅ Solo `.env.example` y `.env.vault` están permitidos en el repo

### 2. **Encriptación de Secrets (Producción)**
```bash
# Encriptar variables para producción
npm run env:encrypt

# Ejecutar con variables encriptadas
npm run prod:secure
```

### 3. **Auditoría y Monitoreo**
```bash
# Verificar seguridad general
npm run security:check

# Auditar dependencias
npm audit
```

## 📁 Estructura de Archivos

- `.env` - Variables locales (NO se sube al repo) ❌
- `.env.example` - Plantilla documentada (se sube al repo) ✅
- `.env.vault` - Variables encriptadas (se sube al repo) ✅
- `.git/hooks/pre-commit` - Hook de seguridad ✅

## 🚀 Comandos de Dotenvx

```bash
# Desarrollo normal
npm run dev:full

# Producción con seguridad básica
npm run prod

# Producción con encriptación (recomendado)
npm run prod:secure

# Encriptar secrets nuevos
npm run env:encrypt

# Ver secrets (solo desarrollo)
npm run env:decrypt
```

## 🎯 Beneficios

1. **🔒 Prevención de leaks**: Imposible subir secrets por accidente
2. **🔐 Encriptación**: Variables sensibles encriptadas en producción
3. **📊 Observabilidad**: Monitoreo del uso de variables de entorno
4. **👥 Colaboración**: Equipo comparte configuración sin exponer secrets
5. **✅ Auditoría**: Logs de cuándo y cómo se usan las variables

## ⚠️ Importante

- **Nunca** edites manualmente el archivo `.env.vault`
- **Siempre** usa `npm run env:encrypt` para nuevos secrets
- **Mantén** actualizado el `.env.example` para el equipo
- **Rota** secrets regularmente en producción

## 🆘 Recuperación de Emergencia

Si pierdes el archivo `.env`:
1. Copia `.env.example` a `.env`
2. Completa con tus valores reales
3. Para producción, recupera desde `.env.vault` con la key correcta