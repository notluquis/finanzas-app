# Guía de Optimizaciones y Modularización

Este documento describe las optimizaciones implementadas en el proyecto para reducir duplicación de código y mejorar la modularización.

## 🔧 Nuevos Hooks Reutilizables

### `useFileUpload`
Centraliza toda la lógica de upload de archivos que antes estaba duplicada.

```tsx
import { useFileUpload } from "@/hooks/useFileUpload";

const { files, loading, error, results, handleUpload, handleFileChange } = useFileUpload({
  endpoint: "/api/transactions/upload",
  logContext: "[upload]",
  validator: analyzeTransactionHeaders, // Función opcional de validación
  multiple: true,
  confirmOnValidationWarning: true,
});
```

### `useForm`
Hook robusto para manejo de formularios con validación Zod integrada.

```tsx
import { useForm } from "@/hooks/useForm";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido"),
});

const form = useForm({
  initialValues: { name: "", email: "" },
  validationSchema: schema,
  onSubmit: async (values) => {
    await apiClient.post("/api/users", values);
  },
  validateOnBlur: true,
});

// En el JSX:
<Input {...form.getFieldProps("name")} />
{form.getFieldError("name") && <span>{form.getFieldError("name")}</span>}
```

### `useTable`
Combina paginación, ordenamiento y visibilidad de columnas.

```tsx
import { useTable } from "@/hooks/useTable";

const table = useTable<"name" | "email" | "role">({
  initialPageSize: 25,
  columns: ["name", "email", "role"],
  initialSortColumn: "name",
});

// Acceder a paginación
const { pagination, setPage, setPageSize, canGoNext } = table;

// Acceder a ordenamiento  
const { sortState, sort, getSortIcon, getSortProps } = table;

// Acceder a visibilidad de columnas
const { isColumnVisible, toggleColumn } = table;
```

## 📊 Utilidades de Base de Datos

### Query Builder
Construcción segura de consultas SQL complejas.

```typescript
import { SQLBuilder, selectMany } from "@/server/lib/database";

const { sql, params } = new SQLBuilder("mp_transactions")
  .select("id", "amount", "timestamp")
  .where("direction = ?", "OUT")
  .where("amount > ?", 1000)
  .orderBy("timestamp", "DESC")
  .limit(50)
  .build();

const results = await selectMany(pool, sql, params);
```

### Helpers de Consulta
Funciones utilitarias para operaciones comunes.

```typescript
import { selectOne, insertOne, paginate, withTransaction } from "@/server/lib/database";

// Selección simple
const user = await selectOne(pool, "SELECT * FROM users WHERE id = ?", [userId]);

// Inserción con ID de retorno
const newId = await insertOne(pool, "INSERT INTO users (name) VALUES (?)", [name]);

// Paginación automática
const result = await paginate(pool, "SELECT * FROM users", [], { page: 1, pageSize: 25 });

// Transacciones
await withTransaction(pool, async (connection) => {
  await connection.execute("INSERT INTO...");
  await connection.execute("UPDATE...");
});
```

## 🎯 Esquemas de Validación Modulares

Esquemas reutilizables en `server/lib/schemas.ts`:

```typescript
import { 
  EmailSchema, 
  CurrencyAmountSchema, 
  CounterpartBaseSchema,
  PaginationSchema 
} from "@/server/lib/schemas";

// Combinar esquemas base
const createUserSchema = z.object({
  email: EmailSchema,
  salary: CurrencyAmountSchema,
}).merge(PaginationSchema);
```

## 🎨 Utilidades de Formato Centralizadas

Todas las funciones de formato ahora están en `src/lib/format.ts`:

```typescript
import { 
  fmtCLP, 
  formatRut, 
  formatDate, 
  formatFileSize,
  minutesToDuration 
} from "@/lib/format";

const price = fmtCLP(150000); // "$150.000"
const rut = formatRut("12345678-9"); // "12.345.678-9"
const date = formatDate(new Date()); // "03/10/2025"
const size = formatFileSize(1024); // "1.0 KB"
const duration = minutesToDuration(90); // "1:30"
```

## 📁 Imports Mejorados

### Barrel Exports
Usa los nuevos index files para imports más limpios:

```typescript
// Antes
import { fmtCLP } from "@/lib/format";
import { logger } from "@/lib/logger"; 
import { apiClient } from "@/lib/apiClient";

// Después  
import { fmtCLP, logger, apiClient } from "@/lib";
```

```typescript
// Hooks
import { useForm, useTable, useFileUpload } from "@/hooks";

// Server utilities
import { selectMany, PaginationSchema, asyncHandler } from "@/server/lib";
```

## 🔄 Migraciones Recomendadas

### 1. Formularios Existentes
Migra formularios que usan `useState` manual a `useForm`:

```typescript
// ❌ Antes: Manejo manual de estado
const [form, setForm] = useState(initialValues);
const [errors, setErrors] = useState({});

// ✅ Después: Hook centralizado
const form = useForm({
  initialValues,
  validationSchema,
  onSubmit: handleSubmit,
});
```

### 2. Componentes de Upload
Reemplaza implementaciones duplicadas con `useFileUpload`:

```typescript
// ❌ Antes: Lógica duplicada en cada componente
function useFileUpload(endpoint, logContext) { /* 50+ líneas */ }

// ✅ Después: Hook reutilizable
const upload = useFileUpload({ endpoint, logContext, validator });
```

### 3. Tablas con Paginación
Usa `useTable` para funcionalidad completa:

```typescript
// ❌ Antes: Estado separado para cada funcionalidad
const [page, setPage] = useState(1);
const [sortColumn, setSortColumn] = useState(null);
const [visibleColumns, setVisibleColumns] = useState({});

// ✅ Después: Estado unificado
const table = useTable({ initialPageSize: 25, columns });
```

### 4. Consultas SQL
Migra consultas complejas al query builder:

```typescript
// ❌ Antes: SQL concatenado manualmente
const sql = `SELECT * FROM users WHERE active = 1`;
if (search) sql += ` AND name LIKE '%${search}%'`; // ¡Riesgo de SQL injection!

// ✅ Después: Query builder seguro
const { sql, params } = new SQLBuilder("users")
  .where("active = ?", 1)
  .where("name LIKE ?", `%${search}%`)
  .build();
```

## 🚀 Beneficios Obtenidos

1. **Reducción de código duplicado**: ~40% menos líneas en componentes de formularios y upload
2. **Mejor type safety**: Validación Zod integrada en formularios
3. **Consultas SQL más seguras**: Query builder previene SQL injection
4. **Imports más limpios**: Barrel exports reducen verbosidad
5. **Consistencia**: Patrones unificados en toda la aplicación
6. **Mantenibilidad**: Cambios centralizados se propagan automáticamente

## 📚 Ejemplos Completos

Ver `EmployeeFormRefactored.tsx` para un ejemplo completo de cómo usar todos estos nuevos patrones juntos.