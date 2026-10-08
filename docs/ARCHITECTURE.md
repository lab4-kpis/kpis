# Arquitectura

## Decisión

La solución implementa la opción A de [`PROPUESTA.md`](entregables/PROPUESTA.md): Postgres administrado por Supabase es la fuente de verdad y PostgREST expone el contrato sin backend propio. El portal es una SPA estática Vite/React para profesores.

```text
Reporter del equipo ── apikey + X-Project-Key ──> PostgREST ──> RLS + triggers ──> Postgres
Profesor ── Google OAuth ──> Portal Vite/GitHub Pages ── JWT ──> PostgREST ──> vistas y RPCs
```

## Límites de confianza

- La clave publishable de Supabase es pública y sólo identifica el proyecto.
- `X-Project-Key` identifica un equipo y un ambiente. Se muestra una vez y sólo se persiste su hash SHA-256.
- La sesión Google identifica a un profesor, pero la autorización real se resuelve contra `admin_users` en cada política RLS/RPC.
- `service_role` no se usa en la aplicación ni en los reporteros.
- El portal no tiene autoridad adicional: todas sus operaciones privilegiadas se vuelven a validar en Postgres.

## Reglas de datos

- `project_id` y `reported_at` siempre los fija el servidor.
- `date` la declara el equipo y no puede estar en el futuro.
- Una clave sólo permite su proyecto y su ambiente.
- Cada lote es una transacción; un error rechaza todas sus filas.
- La clave primaria `(project_id, kpi_id, date, env)` implementa “primer valor gana”.
- `measurement` no admite `UPDATE` ni `DELETE`, incluso si se intenta desde el panel SQL sin desactivar explícitamente el trigger.
- El rol `anon` tiene lectura sólo sobre las cuatro columnas del índice idempotente porque PostgreSQL la exige para `ON CONFLICT DO NOTHING`. La política RLS correspondiente se activa únicamente durante un `POST` y para el proyecto de la clave; un `GET` no expone mediciones.
- El cumplimiento cuenta KPIs distintos recibidos en `prod` según `reported_at` en `America/Argentina/Buenos_Aires`.
- Un proyecto admite 10 KPIs activos y 10 KPIs distintos recibidos por día y ambiente.

## Módulos

- Catálogo: autogestionado por cada equipo; alta y cambios limitados, sin borrado ni renombre.
- Ingesta: mediciones numéricas e inmutables.
- Cumplimiento: calendario global y vistas enriquecidas. `v_public_compliance` expone a `anon` sólo los agregados por equipo y día (estado, KPIs reportados y esperados, puntaje) a través de una función `security definer`; sin ids, valores, catálogos, claves ni contactos.
- Administración: equipos, claves, profesores y configuración.
- Auditoría: cambios administrativos y de catálogo sin secretos.
- Contrato: OpenAPI, JSON Schema y ejemplos sin SDK obligatorio.

## Decisiones conscientes

- Supabase Auth persiste la sesión de la SPA para sobrevivir recargas. En un sitio estático no hay una capa servidor propia capaz de emitir una cookie `HttpOnly`; por eso se reduce la superficie XSS con CSP, recursos autocontenidos y ausencia de HTML dinámico o scripts de terceros. `style-src-attr` permite únicamente los estilos de posición que necesitan Radix y Swagger; los scripts inline siguen bloqueados.
- GitHub Pages no permite configurar encabezados HTTP personalizados. El documento HTML entrega una CSP por `meta`, pero `frame-ancestors` y otros encabezados de borde requieren migrar el hosting o colocar un proxy/CDN. La autorización de datos no depende de esa defensa.
- La réplica diaria en GitHub no forma parte de esta primera entrega. Está registrada como mejora separada.
