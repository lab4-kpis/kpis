# Checklist manual de seguridad y contrato

Ejecutar sobre la instancia descartable con una clave publishable y claves de prueba. No pegar secretos en issues, commits ni capturas.

## Preparación

```bash
export SUPABASE_URL='https://rzlalzowistpiphmdqpp.supabase.co'
export SUPABASE_PUBLISHABLE_KEY='sb_publishable_...'
export PROJECT_KEY_DEV='kpi_...'
export PROJECT_KEY_PROD='kpi_...'
```

## Casos obligatorios

1. Un POST sin `X-Project-Key` falla; un GET protegido puede responder `200 []`, sin revelar filas.
2. Una clave revocada falla.
3. Una clave de un equipo no ve ni modifica el catálogo de otro.
4. Una clave `dev` no puede insertar una fila `prod`.
5. Un KPI fuera del catálogo rechaza todo el lote.
6. Una fecha futura se rechaza.
7. Un valor no numérico se rechaza.
8. Once KPIs activos o once KPIs distintos recibidos el mismo día se rechazan.
9. Reenviar el mismo lote con `resolution=ignore-duplicates` no duplica ni cambia el valor.
10. Un intento `PATCH` o `DELETE` sobre `measurement` falla.
11. `reported_at` coincide con el servidor y no con un valor suministrado por el cliente.
12. Un lote con nueve filas válidas y una inválida no persiste ninguna.
13. Sólo las filas `prod` aparecen en `v_compliance`.
14. Un correo fuera de `admin_users` no crea usuario mediante Google.
15. Un usuario autenticado fuera de la allowlist no puede leer tablas ni ejecutar RPCs administrativas.
16. No se puede desactivar al último administrador activo.
17. No se puede emitir una clave `prod` sin inicio y fin globales.
18. La auditoría nunca contiene el texto completo de una clave.

## Comandos de inspección

Listar el catálogo propio:

```bash
curl --fail-with-body \
  "$SUPABASE_URL/rest/v1/kpi_catalog?select=id,kind,unit,description&order=id.asc" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "X-Project-Key: $PROJECT_KEY_DEV"
```

Intentar ambiente incorrecto (debe fallar):

```bash
curl --fail-with-body \
  -X POST "$SUPABASE_URL/rest/v1/measurement?on_conflict=project_id,kpi_id,date,env" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "X-Project-Key: $PROJECT_KEY_DEV" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=ignore-duplicates" \
  -d '[{"kpi_id":"latencia_p95","date":"2026-10-05","env":"prod","value":100,"run_id":"0192d36a-7b35-7cc4-b1bd-2d55f0d61a56"}]'
```

## Navegador

- Comprobar login y logout con el correo permitido.
- Comprobar estados de carga, vacío, error y acceso denegado.
- Confirmar que el bundle no contiene `DATABASE_URL`, `service_role`, secretos OAuth ni claves de equipo.
- Verificar CSP en la respuesta/documento. GitHub Pages no puede entregar `frame-ancestors`, `X-Frame-Options`, `nosniff` o `Permissions-Policy`; si esos controles son requeridos, colocar un CDN/proxy con encabezados o cambiar el hosting.

## Última verificación de la instancia descartable

Ejecutada el 05-10-2026 sin Playwright ni suite automatizada. Se comprobaron manualmente: alta de catálogo, aislamiento por ambiente, KPI inexistente, fecha futura, inserción válida, idempotencia, primer valor inmutable, atomicidad del lote, bloqueo de actualización y de `reported_at`, retiro de KPI, límite de 10 KPIs, protección del último administrador, bloqueo de claves `prod` sin calendario, allowlist del hook y ausencia de claves completas en auditoría. La clave temporal fue revocada; quedó una medición `dev` de verificación y ninguna medición `prod`.
