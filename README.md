# Finanzas App

React + Vite + TS + **Tailwind v4**. Incluye servidor Express para subir reportes de Mercado Pago a MySQL (HostGator), autenticación con roles y un panel moderno totalmente tematizable con los colores corporativos de Bioalergia.

## Scripts
- `npm run dev` → desarrollo
- `npm run dev:full` → front + backend en paralelo (Vite + Express)
- `npm run build` → producción
- `npm run preview` → previsualización

## Notas
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
