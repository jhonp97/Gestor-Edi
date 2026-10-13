# 🚚 Flota Camiones PWA

> Sistema de gestión de flota de camiones para trabajador autónomo en España.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Prisma](https://img.shields.io/badge/Prisma-7-2d3748)
![Status](https://img.shields.io/badge/CI/CD-Passing-green)

## 📋 Descripción

**Flota Camiones PWA** es una aplicación web progresiva para gestionar la flota de camiones de un trabajador autónomo. Permite registrar camiones, gestionar transacciones (ingresos/gastos), generar nóminas y descargar recibos en PDF.

### ✨ Características

- 📊 **Dashboard** - Resumen de ingresos, gastos y balance mensual con gráficos
- 🚚 **Gestión de Camiones** - CRUD completo con estadísticas por vehículo
- 💰 **Transacciones** - Registro de ingresos y gastos por camión
- 👷 **Trabajadores** - Gestión de empleados con sistema de nóminas
- 📄 **Nóminas** - Generación de nóminas con IRPF, Seguridad Social, bonos y deducciones
- 📑 **PDF** - Descarga de recibos salariales en PDF
- 📱 **PWA** - Instalable como app nativa en móvil
- 🔌 **Modo Offline** - Funciona sin conexión a internet
- 🔐 **Autenticación** - JWT + Google OAuth (NextAuth v5)

## 🛠️ Tech Stack

| Tecnología | Propósito |
|------------|-----------|
| **Next.js 16** | Framework full-stack (App Router) |
| **React 19** | UI Library |
| **TypeScript 5** | Tipado estático |
| **Tailwind CSS 4** | Estilos |
| **Shadcn UI** | Componentes accesibles |
| **Prisma 7** | ORM + SQLite |
| **NextAuth v5** | Autenticación |
| **Recharts** | Gráficos |
| **@react-pdf/renderer** | Generación PDF |
| **Vitest** | Tests unitarios |
| **Playwright** | Tests E2E |

## 📁 Estructura del Proyecto

```
flota-camiones-pwa/
├── prisma/                 # Schema de base de datos
│   └── schema.prisma      # Modelos: Truck, Transaction, Worker, Payroll, User
├── public/                # Archivos públicos (manifest.json, icons)
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (app)/         # Rutas protegidas (dashboard, trucks, etc.)
│   │   ├── api/           # API routes
│   │   └── login/         # Páginas públicas
│   ├── components/        # Componentes React
│   │   ├── ui/            # Shadcn UI
│   │   ├── layout/        # Sidebar, Header
│   │   ├── dashboard/     # Componentes del dashboard
│   │   └── trucks/        # Componentes de camiones
│   ├── services/          # Lógica de negocio
│   ├── repositories/      # Acceso a datos Prisma
│   ├── schemas/           # Validación Zod
│   ├── types/             # TypeScript types
│   ├── hooks/             # React hooks (useApi)
│   └── lib/               # Utilidades, auth, prisma
├── tests/                 # Tests
│   ├── unit/              # Unit tests (Vitest)
│   ├── e2e/               # E2E tests (Playwright)
│   └── factories/         # Factories para tests
├── .github/workflows/     # CI/CD pipeline
├── architecture.md        # Documentación de arquitectura
└── package.json           # Dependencias
```

## 🚀 Instalación

### Prerrequisitos

- Node.js 20+
- pnpm 9+ (recomendado) o npm/yarn

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/flota-camiones-pwa.git
cd flota-camiones-pwa

# 2. Instalar dependencias
pnpm install

# 3. Generar Prisma Client
pnpm prisma generate

# 4. Crear base de datos (opcional: con datos de ejemplo)
pnpm prisma db push      # Crea la base de datos vacía
pnpm db:seed             # Opcional: agrega datos de ejemplo

# 5. Iniciar servidor de desarrollo
pnpm dev
```

### Credenciales por defecto

El proyecto viene con un usuario admin precargado:

- **Email**: `admin@flota.com`
- **Contraseña**: `admin123`

También puedes crear nuevos usuarios desde la página de registro.

## 📅 Nóminas por intervalo

En **Nómina Individual**, mes y año seleccionan por defecto el mes completo. Puedes editar **Desde** y **Hasta**, incluso entre distintos meses o años; ambas fechas están incluidas. El formulario muestra los días trabajados registrados y propone la suma de sus importes diarios históricos, sin cambiar las tarifas. El salario puede ajustarse manualmente.

El intervalo se guarda en la nómina y aparece en el detalle, listado y PDF. Para filtrar el listado se utiliza el mes y año de la fecha **Desde**. Las nóminas antiguas sin fechas conservan su significado de mes completo.

El recibo PDF identifica a **Transportes Acevedo Hernandez** y muestra su logo en la esquina superior derecha. La imagen está en `public/branding/transportes-acevedo-hernandez.png` y se incrusta en el documento; no depende de OneDrive ni de una URL externa. Al descargar el PDF, comprueba el encabezado, el logo y que las fechas e importes se mantengan.

Las nóminas **pendientes** no bloquean nuevas generaciones aunque compartan días, y no se eliminan ni se pagan automáticamente. Solo los intervalos **ya pagados** bloquean nuevos documentos o pagos solapados. Al marcar como pagada se comprueba de nuevo el intervalo: dos pendientes que compartan días no pueden quedar ambas pagadas. Los resúmenes siguen sumando los documentos del mes, incluidos los pendientes; una regeneración crea otro documento, no reemplaza el anterior.

En `/nomina`, **Acciones → Eliminar** permite borrar únicamente una nómina **pendiente**, tanto en escritorio como en móvil. La confirmación identifica el trabajador y el intervalo; cancelar no cambia nada. El borrado es definitivo, no elimina al trabajador ni sus días trabajados. El listado y sus totales se actualizan tras completarse. Las nóminas **pagadas** no muestran esta opción y el servidor rechaza su eliminación, incluso si se marcaron pagadas mientras la confirmación estaba abierta. Si hay un error, se muestra sin dar la nómina por eliminada.

La generación para **todos los trabajadores** sigue siendo mensual. Los controles de pago del calendario diario son independientes de las nóminas y no se modifican con este flujo.

### Activación del cambio de esquema

Antes de ejecutar esta versión sobre una base existente, un operador debe revisar y aplicar la migración `20261013130000_payroll_custom_periods` con el procedimiento habitual de despliegue, previa copia de seguridad. Después debe generar el cliente Prisma y reiniciar la aplicación. La migración agrega fechas opcionales y sustituye la unicidad mensual por un índice; conserva los documentos existentes sin recalcularlos. No uses `db push` para sustituir la migración sobre datos reales. Preparar el código no aplica esta migración automáticamente.

### Comprobación manual con `pnpm dev`

Cuando la migración esté aplicada en la base elegida, inicia `pnpm dev` y abre **Nómina Individual**. Usa un trabajador y días de prueba, no pagos reales:

1. Comprueba que mes/año selecciona el mes completo y muestra el acumulado diario.
2. Cambia **Desde/Hasta** a un intervalo que cruce meses; comprueba los días listados y el importe. Ambas fechas cuentan.
3. Genera la nómina y revisa las mismas fechas en el listado, detalle y PDF.
4. Sin marcarla pagada, genera otra con el mismo intervalo y otro importe: ambas deben quedar pendientes.
5. Solo sobre documentos de prueba, marca una pagada: la otra debe rechazar el pago si comparte días. Un intervalo posterior sin días compartidos debe permitirse.

Para comprobar **Eliminar**, usa una nómina pendiente de prueba: cancela primero la confirmación y comprueba que siga en el listado; después confirma y verifica que desaparezca. Una nómina pagada no debe ofrecer **Eliminar**. No uses un pago real para probar el bloqueo.

Si falta la migración, iniciar el servidor no habilita por sí solo el nuevo esquema. La prueba manual no realiza push ni merge; son pasos separados después de revisar los resultados.

## 📊 Estadísticas de camiones

En `/trucks` y en el detalle del camión, el filtro de estadísticas permite **Mes actual** (por defecto), **Mes elegido**, **Total histórico** o **Desde/Hasta**. Actualiza ingresos, gastos y balance de las cards y del detalle; la selección se conserva al abrir un camión o volver al listado.

Las fechas usan **Europe/Madrid** y Desde/Hasta incluye ambos días, incluso en cambios de horario. Se admiten fechas entre 1900 y 2199. Solo se suman importes de transacciones registradas, sin salarios ni ingresos inferidos. Los movimientos mantienen sus filtros de tipo/orden; el informe mensual y su PDF conservan sus propios controles y cálculos. El filtro estadístico no utiliza el parámetro `month` del informe.

## 🧪 Tests

El proyecto tiene 55 tests unitarios que pasan en CI/CD.

### Ejecutar tests

```bash
# Tests unitarios (desarrollo interactivo)
pnpm test

# Tests unitarios (una vez)
pnpm test:unit

# Tests con cobertura
pnpm test:coverage

# Tests E2E (requiere haber corrido db push)
pnpm test:e2e
```

### Estructura de tests

- **Unit tests** (`tests/unit/`): Prueban servicios y repositories individualmente
- **E2E tests** (`tests/e2e/`): Prueban flujos completos de usuario
- **Factories** (`tests/factories/`): Generan datos de prueba

Los tests usan:
- **Vitest** - Runner de tests + @vitest/coverage-v8
- **@testing-library/react** - Testing de componentes
- **Playwright** - Tests E2E con navegador real

## 📝 Scripts Disponibles

```bash
# Desarrollo
pnpm dev              # Iniciar servidor de desarrollo
pnpm build            # Production build
pnpm start            # Iniciar servidor de producción

# Base de datos
pnpm prisma generate  # Generar Prisma Client
pnpm prisma db push   # Crear/actualizar esquema
pnpm db:seed          # Poblar con datos de ejemplo
pnpm db:studio        # Abrir Prisma Studio

# Calidad de código
pnpm lint             # ESLint
pnpm typecheck        # TypeScript

# Tests
pnpm test             # Tests en watch mode
pnpm test:unit        # Tests unitarios una vez
pnpm test:coverage    # Tests con cobertura
pnpm test:e2e         # Tests E2E
```

## 🔧 Configuración

### Variables de entorno

Crear archivo `.env`:

```env
# Base de datos
DATABASE_URL="file:./dev.db"

# Auth
JWT_SECRET="tu-secret-muy-seguro-aqui"
ADMIN_EMAIL="admin@flota.com"
ADMIN_PASSWORD="admin123"

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Email (Resend)
RESEND_API_KEY=""

# App
NEXT_PUBLIC_APP_NAME="Flota Camiones PWA"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### PWA

El manifest está en `public/manifest.json`. Para producción, cambia `theme_color` y `background_color` al color real de tu marca.

## 🌐 Despliegue

### Vercel (recomendado)

```bash
# Instalar Vercel CLI
pnpm i -g vercel

# Deploy
vercel
```

O conecta el repositorio directamente en vercel.com.

### Producción local

```bash
pnpm build
pnpm start
```

## 📄 Arquitectura

Consulta `architecture.md` para detalles completos de la arquitectura, incluyendo:

- Diagrama de capas (Presentation → Service → Repository → Data)
- Modelo de datos
- Sistema de autenticación
- Sistema offline con IndexedDB
- Pipeline CI/CD

## ⚠️ Notas Importantes

1. **Single User**: La app está diseñada para un solo usuario. Todos los datos son compartidos.
2. **SQLite**: Usa SQLite para desarrollo. Para producción, migra a PostgreSQL.
3. **Offline**: El modo offline funciona con IndexedDB, pero requiere red para.syncronizar datos.
4. **Google OAuth**: Necesitas configurar credenciales en Google Cloud Console para usar login con Google.

## 📄 Licencia

MIT License -  libre de usar y modificar este proyecto.

---
