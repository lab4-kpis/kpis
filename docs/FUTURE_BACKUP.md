# Mejora posterior: réplica diaria en GitHub

Esta entrega usa Supabase/Postgres como única fuente de verdad. La copia diaria a GitHub propuesta en el anexo B de [`PROPUESTA.md`](entregables/PROPUESTA.md) queda deliberadamente fuera del alcance inicial para evitar sumar credenciales, workflows y una segunda ruta operativa antes de validar la plataforma central.

## Objetivo futuro

Exportar cada día las mediciones a `data/YYYY-MM-DD.csv` en una rama `data`, y replicar esa rama a una organización distinta de la cuenta dueña de Supabase.

## Condiciones antes de implementarla

- credencial de lectura con privilegio mínimo y rotación definida;
- rama de datos protegida contra force push y borrado;
- repositorio espejo independiente, no fork;
- CSV determinista, sin secretos ni datos personales;
- procedimiento documentado de restauración y verificación;
- monitoreo explícito del job y de exportaciones faltantes.

La réplica mejora la recuperación ante acciones intencionales del dueño de la base. Los triggers actuales son una protección contra errores, no una garantía frente a un propietario que puede desactivarlos.
