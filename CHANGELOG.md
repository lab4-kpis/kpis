# Changelog

## Sin publicar

- **Panel público de cumplimiento** en `#/cumplimiento`, sin login: estado del último día y matriz del período por equipo. `v_public_compliance` expone a `anon` sólo agregados (equipo, día, KPIs reportados/esperados, por tipo, estado y puntaje) mediante una función `security definer`; `anon` sigue sin leer tablas ni `v_compliance`. Migración `202610080002`.

## 0.1.1 - 2026-10-07

- Cumplimiento: un día es completo sólo si el equipo reporta todos los KPIs activos de su catálogo, acotado a 5..10. `v_compliance` expone `expected_kpis` y el portal muestra reportados/esperados. Migraciones `202610070001` y `202610070002`.
- MCP de solo lectura para profesores (`@lab4-kpis/mcp@0.1.2`), con plugins para Claude Code y Codex, publicación en npm con trusted publishing y runbook.
- Claves: contacto de cada equipo, envío de la clave emitida al PM por WhatsApp y emisión `prod` por defecto.
- Portal: al volver a la pestaña ya no se pierde la pantalla abierta, se recuerda la última ruta, nuevo login con Google y logo, y la página de la API tiene el botón Portal arriba a la izquierda.
- Entorno de desarrollo separado: rama `dev`, portal en `/kpis/dev/` y proyecto Supabase propio.
- OpenAPI y guía de equipos documentan los códigos reales: `403` para clave ausente o inválida, `401` para ambiente o campo no permitido.
- Instructivo para profesores y propuesta como entregables.

## 0.1.0 - 2026-10-05

- Esquema Supabase con RLS, claves por equipo/ambiente, catálogo e ingesta inmutable.
- Seed de 16 equipos y calendario global.
- Portal docente Vite con Google OAuth, cumplimiento, administración y CSV.
- OpenAPI, JSON Schema, ejemplos y guías operativas.
- Primer despliegue público mediante GitHub Pages.
