# Guía para equipos

Cada equipo recibe dos valores:

- `SUPABASE_PUBLISHABLE_KEY`: pública y compartida.
- `PROJECT_KEY`: privada, única por equipo y ambiente.

Guardá `PROJECT_KEY` en el gestor de secretos de tu plataforma. No la escribas en el código, logs ni repositorio.

## 1. Registrar el catálogo

Antes de reportar, crear entre 5 y 10 KPIs. El mínimo no bloquea técnicamente el catálogo. Un día cuenta como completo sólo si reportan todos los KPIs activos de su catálogo; con menos de 5 KPIs se exigen igual 5, así que nunca llegan a completo.

```bash
curl --fail-with-body \
  -X POST "$SUPABASE_URL/rest/v1/kpi_catalog" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "X-Project-Key: $PROJECT_KEY" \
  -H "Content-Type: application/json" \
  -d '[{
    "id":"latencia_p95",
    "kind":"technical",
    "unit":"ms",
    "description":"Percentil 95 de latencia HTTP del día.",
    "source":"APM",
    "aggregation":"avg",
    "justification":"Detecta degradación de experiencia."
  }]'
```

`id`, `kind`, `unit` y `description` son el contrato obligatorio. Los demás campos son opcionales. Para retirar un KPI, asignar `deprecated_at`; no se borra ni se renombra.

## 2. Reportar el lote

Usar el ejemplo que corresponda en `examples/`. El POST canónico es:

```text
POST /rest/v1/measurement?on_conflict=project_id,kpi_id,date,env
Prefer: resolution=ignore-duplicates
```

El cuerpo lleva de 1 a 10 objetos con `kpi_id`, `date`, `env`, `value` numérico y `run_id` UUID. `project_id` y `reported_at` no se envían.

Reenviar un lote ya aceptado responde exitosamente sin duplicar ni corregir valores. Si una fila del lote es inválida, no se guarda ninguna.

## 3. Programar

Ejecutar una vez al día con el mecanismo existente del proyecto: cron propio, scheduler de la plataforma o GitHub Actions. La automatización debe:

1. calcular los KPIs desde datos reales;
2. construir el JSON;
3. enviarlo;
4. fallar visiblemente ante un HTTP no exitoso;
5. conservar una copia local de lo enviado.

El estado diario de todos los equipos se ve sin login en el [panel público de cumplimiento](https://lab4-kpis.github.io/kpis/#/cumplimiento). Para ver los valores que recibió la plataforma, entrar a [Mi equipo](https://lab4-kpis.github.io/kpis/#/mi-equipo) con la `PROJECT_KEY`: muestra el catálogo, las mediciones por día de recepción y el cumplimiento. La clave va directo a Supabase y queda sólo en esa pestaña. Por API, `GET /rest/v1/measurement` con el header `X-Project-Key` devuelve las mediciones propias del ambiente de la clave.

Sólo `prod` suma para cumplimiento. `dev` y `qa` permiten validar la integración sin afectar la nota.

## 4. Errores esperables

- `400`: JSON, tipo, unidad, fecha futura o límite inválido.
- `401`: la clave es válida pero no corresponde al ambiente enviado, o el campo no es editable.
- `403`: clave ausente, inválida, revocada o de un proyecto inactivo.
- `409`: KPI inexistente/ajeno o conflicto de integridad.

La especificación completa y ejecutable está en `#/docs`.
