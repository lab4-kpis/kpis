# Lab4 KPIs

Plataforma central y minimalista para recibir KPIs diarios de los equipos de Lab4. Supabase/Postgres es la única fuente de verdad; el portal Vite en GitHub Pages es exclusivo para profesores y consume la API generada por Supabase.

## Componentes

- `supabase/migrations`: esquema, validaciones, RLS, inmutabilidad, vistas y seed de los 16 equipos.
- `src`: portal docente con Google OAuth, cumplimiento, equipos, claves, calendario, auditoría y CSV.
- `public/openapi.yaml`: contrato OpenAPI publicado en `#/docs`.
- `examples`: integraciones mínimas en curl, TypeScript y Python.
- `public/schemas`: JSON Schema publicado del lote de mediciones.
- `docs`: instalación y operación.

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

## Verificación

```bash
npm run lint
npm run typecheck
npm run build
```

No se agregaron tests automatizados ni Playwright por decisión de alcance. La validación operativa está en [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md).

## Documentación

- [Consigna original](docs/CHALLENGE.md)
- [Propuesta acordada](docs/PROPUESTA.md)
- [Guía para profesores](docs/PROFESSOR_GUIDE.md)
- [Guía para equipos](docs/TEAM_GUIDE.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Checklist manual](docs/SECURITY_CHECKLIST.md)
- [Respaldo futuro en GitHub](docs/FUTURE_BACKUP.md)

El workflow de Pages está preparado, pero crear este repositorio no publica ni despliega nada por sí solo hasta que un mantenedor haga push y habilite GitHub Pages con origen “GitHub Actions”.
