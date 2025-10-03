# 🏦 Finanzas App

React + Vite + TypeScript + **Tailwind v4**. Sistema completo de gestión financiera para Bioalergia con Express + MySQL backend, autenticación con roles y panel moderno tematizable.

## 🚀 Scripts de Desarrollo

```bash
# Desarrollo
npm run dev:full      # Frontend + Backend en paralelo (recomendado)
npm run dev           # Solo frontend (Vite)
npm run server        # Solo backend (Express)

# Producción
npm run prod          # Build completo + start
npm run deploy        # Solo build
npm start             # Solo start (requiere build previo)

# Seguridad
npm run security:check    # Auditoría de seguridad
npm run env:encrypt      # Encriptar variables para producción
npm run prod:secure      # Producción con encriptación
```

## 🔐 Seguridad y Variables de Entorno

⚠️ **Importante**: Este proyecto implementa las mejores prácticas de seguridad con **dotenvx**.

### Configuración Inicial
1. Copia `.env.example` a `.env`
2. Completa con tus valores reales
3. **Nunca** subas `.env` al repositorio

### Medidas de Seguridad
- ✅ Hook de pre-commit previene subida accidental de secrets
- ✅ Variables encriptadas para producción con dotenvx
- ✅ Auditoría automática de dependencias
- ✅ Documentación completa en `docs/SECURITY.md`

## 🏗️ Arquitectura
- Tailwind v4 se integra con `@tailwindcss/vite`. No se requiere `tailwind.config` ni `postcss.config` para el caso base.
- Para Excel se usa `exceljs`. Prefiere CSV cuando sea posible con `papaparse`.
- Los reportes de Mercado Pago se manejan en `src/mp/reports.ts`. El parser autodetecta separadores `,`, `;` o `|`; si necesitas casos más complejos, considera integrar Papa Parse.
- El flujo manual (`/report`) permite fijar el saldo inicial y revisar la tabla consolidada con columnas Fecha / Descripción / Desde / Hacia / Tipo / Monto / Saldo cuenta.
- Los colores, logo, correos y metadatos de referencia se guardan en la tabla `settings` y se gestionan desde la página **Configuración** (`/settings`).

## Backend (Express + MySQL)
- Variables de entorno en `.env` (ver `.env.example`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- En el primer arranque, si la tabla `users` está vacía y `ADMIN_EMAIL`/`ADMIN_PASSWORD` están definidos, se crea automáticamente un usuario con rol **GOD**.
- Ejecuta `npm run server` para levantar la API (por defecto en `http://localhost:4000`).
- Ejecuta `npm run dev` para levantar el front; `/api` se proxyea automáticamente al servidor Express.
- Endpoints principales:
  - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` → manejo de sesión vía cookie HTTP-only.
  - `GET /api/settings`, `PUT /api/settings` → lectura y actualización de la configuración de marca (requiere rol `ADMIN` o `GOD`).
  - `POST /api/transactions/upload` → recibe un CSV, lo parsea y lo inserta en la tabla `mp_transactions` (se crea automáticamente si no existe).
  - `GET /api/transactions` → devuelve los movimientos guardados (ordenados por fecha).
- Para compilar el backend ejecuta `npm run build:server`; la salida queda en `dist/server` y se puede iniciar con `npm run start:server`.

## Vistas
- `/` → Resumen y accesos rápidos.
- `/report` → Vista local para analizar CSV sin cargarlo a la base.
- `/upload` → Subir CSV a la base de datos.
- `/data` → Consultar los movimientos almacenados en MySQL con saldo acumulado configurable.
- `/settings` → Editar branding (colores, logo, tagline), datos de contacto y referencias de la base.
- `/login` → Acceso con correo corporativo y contraseña; los roles controlan qué secciones están visibles (por ahora: `VIEWER`, `ANALYST`, `ADMIN`, `GOD`).
