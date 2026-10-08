# Copia diaria en la rama `data`

Supabase/Postgres sigue siendo la única fuente de verdad. La copia en git es la parte (a) de la regla 10 del anexo B de [`PROPUESTA.md`](entregables/PROPUESTA.md): una copia que el dueño de la base no controla. La parte (b), el espejo en otra organización, es [`vaiven-austral/kpi-replica`](https://github.com/vaiven-austral/kpi-replica): copia `data` una hora después, sólo hacia adelante.

Se respalda **sólo el proyecto Supabase de producción**, con las mediciones de los tres ambientes de los equipos (`dev`, `qa`, `prod`). El proyecto de desarrollo de la plataforma no tiene secret y no se exporta.

## Qué hace

[`backup-data.yml`](../.github/workflows/backup-data.yml) corre todos los días a las 06:17 de Buenos Aires, y a mano desde Actions. Llama a [`scripts/backup-data.sh`](../scripts/backup-data.sh), que escribe en la rama `data`:

| Archivo | Contenido |
|---|---|
| `data/AAAA-MM-DD.csv` | las mediciones **recibidas** ese día, hora de Buenos Aires: el mismo día que cuenta la nota. Sólo días cerrados; el día en curso nunca se exporta |
| `catalog.csv`, `projects.csv`, `settings.csv` | foto del catálogo, de los equipos (sin contactos) y del período. Se reescribe en cada corrida y git guarda el historial |

En cada corrida se regeneran **todos** los días cerrados. Si falta un archivo, se agrega: un día que el cron no corrió se completa solo al siguiente. Si un día ya guardado sale distinto, o desapareció de la base, la corrida **falla sin escribir nada**. Las mediciones no se editan ni se borran, así que ese fallo significa que alguien desactivó el trigger de inmutabilidad. El aviso es el mail de GitHub por el workflow fallido.

## Puesta en marcha (una vez)

1. Aplicar la migración `202610080004_backup_reader.sql`, como cualquier otra, en desarrollo y en producción (instructivo, sección 8). Crea el rol `kpi_backup`: sólo lectura, sin acceso a claves, profesores, auditoría ni contactos.
2. En el SQL Editor de producción, con una contraseña generada que no se guarda en ningún archivo:
   `alter role kpi_backup with login password '...';`
3. En el repo, crear el secret `KPI_BACKUP_DB_URL` con la cadena del **session pooler de producción** (Connect → Session pooler en Supabase), con el usuario `kpi_backup.<project-ref>`. Los runners de GitHub no tienen IPv6, así que la conexión directa no sirve.
4. Correr el workflow a mano una vez. Eso crea la rama `data`.
5. Proteger la rama `data` sólo contra force push y borrado, sin exigir revisiones: el workflow pushea directo.

Para rotar la contraseña se repiten los pasos 2 y 3.

## Restaurar

Sobre una base con todas las migraciones aplicadas, como `postgres`:

```bash
git clone --branch data https://github.com/lab4-kpis/kpis.git kpi-data
DATABASE_URL=postgresql://postgres:...@.../postgres scripts/restore-data.sh kpi-data
```

[`restore-data.sh`](../scripts/restore-data.sh) carga equipos, período, catálogo y cada día de mediciones en una transacción, con los triggers apagados para conservar `project_id` y `reported_at` originales, y al final imprime las filas por día. Las claves no se restauran: se emiten nuevas. Los contactos se recargan a mano.

## Límites

- Entre que llega una medición y su primera exportación pasan hasta ~30 h. En esa ventana, una edición no se detecta.
- Un owner de la organización de GitHub puede quitar la protección de `data`. El espejo no sigue reescrituras ni borrados: falla y conserva su copia.
- Cambiar el formato del CSV hace fallar todos los días. Se resuelve con un commit deliberado en `data` que regenere los archivos.
