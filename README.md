# Lab4 KPIs

Plataforma central y minimalista para recibir KPIs diarios de los equipos de Lab4. Supabase/Postgres es la única fuente de verdad; el portal Vite en GitHub Pages es exclusivo para profesores y consume la API generada por Supabase.

## Componentes

- `supabase/migrations`: esquema, validaciones, RLS, inmutabilidad, vistas y seed de los 16 equipos.
- `src`: portal docente con Google OAuth, cumplimiento, equipos, claves, calendario, auditoría y CSV.
- `public/openapi.yaml`: contrato OpenAPI publicado en `#/docs`.
- `examples`: integraciones mínimas en curl, TypeScript y Python.
- `mcp` y `plugins`: servidor MCP de sólo lectura para profesores y sus plugins de Claude Code y Codex.
- `public/schemas`: JSON Schema publicado del lote de mediciones.
- `docs`: instalación y operación. [`docs/MCP.md`](docs/MCP.md) describe el MCP de consulta para profesores.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Las únicas variables visibles al navegador son la URL de Supabase y su clave **publishable**, que es pública por diseño. `DATABASE_URL`, las claves de equipos, el secreto OAuth y cualquier `service_role` nunca deben llevar prefijo `VITE_` ni entrar al repositorio.

## Base de datos

```bash
npm run db:push:dry
npm run db:push
npm run db:bootstrap-admin
npm run db:types
```

`db:push` usa Supabase CLI y las migraciones versionadas. El bootstrap toma `BOOTSTRAP_ADMIN_EMAIL` de `.env.local`; no hay correos personales en el código. `db:types` regenera `src/types/database.ts` desde el esquema remoto una vez aplicada la migración.

## Entornos

| Entorno | Rama | Portal | Supabase |
|---|---|---|---|
| Producción | `main` | https://lab4-kpis.github.io/kpis/ | `rzlalzowistpiphmdqpp` |
| Desarrollo | `dev` | https://lab4-kpis.github.io/kpis/dev/ | proyecto `lab4-kpis-dev` |

Cada push a `main` o `dev` reconstruye y publica ambos portales. El build de desarrollo toma `DEV_VITE_SUPABASE_URL` y `DEV_VITE_SUPABASE_PUBLISHABLE_KEY` de las variables del repositorio; si falla, producción se publica igual.

Las credenciales de desarrollo van en `.env.development` (ignorado por git) con `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` y `BOOTSTRAP_ADMIN_EMAIL`. Vite lo carga en `npm run dev`, así que el desarrollo local usa la base de desarrollo. Para la base:

```bash
npm run db:push:dev
npm run db:bootstrap-admin:dev
```

Las migraciones se prueban primero en desarrollo y se aplican a producción con `npm run db:push` después del merge a `main`. Nunca copiar datos ni claves de equipos de producción a desarrollo.

## Verificación

```bash
npm run lint
npm run typecheck
npm run build
```

No se agregaron tests automatizados ni Playwright por decisión de alcance. La validación operativa está en [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md).

## Documentación

- [Consigna original](docs/CHALLENGE.md)
- [Propuesta acordada](docs/entregables/PROPUESTA.md)
- [Instructivo para profesores](docs/entregables/INSTRUCTIVO_PROFESORES.md)
- [Setup técnico](docs/SETUP.md)
- [Guía para equipos](docs/TEAM_GUIDE.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Checklist manual](docs/SECURITY_CHECKLIST.md)
- [Respaldo futuro en GitHub](docs/FUTURE_BACKUP.md)

El workflow de Pages está preparado, pero crear este repositorio no publica ni despliega nada por sí solo hasta que un mantenedor haga push y habilite GitHub Pages con origen “GitHub Actions”.
