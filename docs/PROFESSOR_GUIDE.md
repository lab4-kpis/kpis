# Guía para profesores

La instalación mantiene las credenciales personales fuera del repositorio. Requiere Node LTS, acceso al proyecto Supabase y este checkout.

## 1. Configurar variables locales

Copiar `.env.example` a `.env.local` y completar:

```dotenv
VITE_SUPABASE_URL=https://rzlalzowistpiphmdqpp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
BOOTSTRAP_ADMIN_EMAIL=profesor@universidad.edu
```

Conservar `DATABASE_URL` sólo en `.env`. Si la conexión directa es IPv6 y la computadora no tiene IPv6, definir además el host del pooler que muestra Supabase en **Connect → Session pooler**.

Nunca copiar aquí `service_role`, la contraseña de la base ni el secreto OAuth de Google.

## 2. Crear las estructuras

```bash
npm install
npm run db:push:dry
npm run db:push
npm run db:bootstrap-admin
npm run db:types
```

La migración crea el esquema, RLS, vistas, funciones y los 16 equipos. El último comando agrega únicamente el correo local como primer administrador.

## 3. Configurar Google OAuth

1. En Google Auth Platform crear un cliente OAuth de tipo **Web application**.
2. Agregar como origen JavaScript `https://lab4-kpis.github.io` y, para desarrollo, `http://localhost:5173`.
3. Agregar como redirect URI exacta `https://rzlalzowistpiphmdqpp.supabase.co/auth/v1/callback`.
4. Copiar Client ID y Client Secret directamente en **Supabase → Authentication → Providers → Google**. No guardarlos en archivos del proyecto.
5. En **Authentication → URL Configuration**, usar `https://lab4-kpis.github.io/kpis/` como Site URL y admitir también `http://localhost:5173` durante desarrollo.
6. En **Authentication → Hooks**, habilitar **Before User Created** y elegir la función Postgres `public.hook_restrict_admin_signup`.
7. Mantener deshabilitados los proveedores de acceso que no se utilicen. La autorización del portal exige además que el JWT indique proveedor Google.

El hook evita crear usuarios fuera de la allowlist; RLS sigue bloqueando el acceso aunque el hook se configurara mal.

## 4. Configurar el período

Abrir el portal, ingresar con Google y entrar en **Configuración**. Definir inicio, fin y días evaluables. La interfaz usa `DD-MM-YYYY`; la API y la base usan `YYYY-MM-DD`.

No se puede emitir una clave `prod` hasta guardar ambas fechas.

## 5. Habilitar un equipo

Los equipos 1 a 16 ya existen. En **Equipos → detalle → Claves**:

1. elegir `dev`, `qa` o `prod`;
2. pulsar **Emitir o rotar**;
3. copiar la clave en ese momento y entregarla por un canal privado;
4. pedir al equipo que la guarde en su gestor de secretos.

Rotar emite una clave nueva y revoca la anterior en la misma transacción. Desactivar un equipo bloquea sus claves sin cambiar el cumplimiento histórico.

## 6. Operar y consultar

- **Resumen diario** lista primero los equipos sin reporte e indica 0–10 KPIs recibidos.
- **Equipo → Catálogo** muestra definición, unidad, tipo y retiros.
- **Equipo → Mediciones** muestra la recepción inmutable y permite exportar CSV.
- **Equipo → Cumplimiento** muestra el historial por día.
- **Configuración → Profesores** administra la allowlist; el último administrador activo no puede desactivarse.
- **Configuración → Actividad reciente** registra cambios sin claves completas.

La documentación interactiva pública está en `#/docs`. Para análisis externo, exportar CSV o conectar Supabase en modo sólo lectura cuando el producto utilizado lo soporte.

## Publicar en GitHub Pages

1. En el repositorio, definir la variable pública `VITE_SUPABASE_PUBLISHABLE_KEY` en **Settings → Secrets and variables → Actions → Variables**.
2. En **Settings → Pages**, elegir **GitHub Actions** como fuente.
3. Hacer push a `main` cuando se desee desplegar.

El workflow usa `npm ci` y no necesita credenciales privadas.

## MCP opcional para la cuenta local

El MCP de Supabase puede agregarse únicamente al Codex del profesor; no forma parte del repositorio:

```bash
codex mcp add supabase --url 'https://mcp.supabase.com/mcp?project_ref=rzlalzowistpiphmdqpp&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching'
```

Para consultas habituales, preferir acceso de sólo lectura. Revocar la conexión local cuando deje de usarse.
