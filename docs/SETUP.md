# Setup técnico de la plataforma

Para quien mantiene o reconstruye la plataforma. Para el uso diario alcanza con el [instructivo para profesores](entregables/INSTRUCTIVO_PROFESORES.md), que también resume estos pasos.

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

## 4. Contacto de cada equipo

El referente y el teléfono de cada equipo (`projects.contact_name`, `projects.contact_phone`) alimentan el botón de WhatsApp al emitir una clave. No se editan desde el portal.

La migración `202610070001_project_contacts.sql` crea sólo las columnas. **Los datos no se versionan**, porque el repo es público: se cargan una vez por proyecto Supabase pegando en el **SQL Editor** un `update` como este, que se guarda localmente en `supabase/private/` (ignorado por git):

```sql
update public.projects p
set contact_name = c.contact_name, contact_phone = c.contact_phone
from (values
  (1, 'Nombre Apellido', '5491100000000')
  -- una fila por equipo
) as c(team_number, contact_name, contact_phone)
where p.team_number = c.team_number;
```

El teléfono va en dígitos E.164 sin `+`, como lo espera `wa.me`. La lista de referentes la tiene el grupo de WhatsApp de Lab IV.

## Publicar en GitHub Pages

1. En el repositorio, definir la variable pública `VITE_SUPABASE_PUBLISHABLE_KEY` en **Settings → Secrets and variables → Actions → Variables**.
2. En **Settings → Pages**, elegir **GitHub Actions** como fuente.
3. Hacer push a `main` cuando se desee desplegar.

El workflow usa `npm ci` y no necesita credenciales privadas.

## MCP de Supabase para mantenimiento

Para consultar cumplimiento, catálogos y mediciones desde Claude Code o Codex con la cuenta Google del portal, usar el [MCP para profesores](MCP.md). Lo que sigue aplica sólo a quien mantiene la base.

El MCP de Supabase puede agregarse únicamente al Codex del profesor; no forma parte del repositorio:

```bash
codex mcp add supabase --url 'https://mcp.supabase.com/mcp?project_ref=rzlalzowistpiphmdqpp&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching'
```

Para consultas habituales, preferir acceso de sólo lectura. Revocar la conexión local cuando deje de usarse.
