# Reporte diario de KPIs — propuesta para el escenario 2 (equipos 9 a 16)

**Estado: implementada.** La votación cerró el lunes 6/10 con la opción A. La plataforma está en el repo [`lab4-kpis/kpis`](https://github.com/lab4-kpis/kpis), con el portal docente en https://lab4-kpis.github.io/kpis/ y un MCP de sólo lectura para profesores. Presentación: jueves 9/10, 15 minutos, frente a todos los equipos y profesores, a cargo del equipo 14 (VaiVen). Este documento conserva el análisis que llevó a la decisión y está actualizado con lo que efectivamente se construyó. La guía operativa es el [instructivo para profesores](INSTRUCTIVO_PROFESORES.md).

## 1. Qué nos piden

Cada proyecto reporta **todos los días entre 5 y 10 KPIs** a una plataforma central: de negocio (salen del charter), técnicos (latencia, errores, jobs) y de salud (health check, última ejecución exitosa). El envío es **código programado** (cron o botón). No puede ser un agente de IA. Los equipos 9 a 16 acordamos **una sola arquitectura**, distinta de Dataverse, donde **los profesores** **consultan los KPIs fácil y los analizan con Claude, ChatGPT o similar**. Entregamos: arquitectura, contrato de datos, autenticación, governance, cómo se integra un proyecto, esfuerzo e impacto. Más una **guía para que los profesores la configuren solos**: crear la plataforma, configurar auth, habilitar un proyecto, consultar, agregar o cambiar métricas y validar que los datos llegan. Los profesores eligen una de las dos propuestas (Dataverse o la nuestra) y **todos** la adoptan.

## 2. Con qué criterio se compararon

1. **Un profesor la opera sin nosotros**, con los seis pasos de la guía en herramientas que ya existen.
2. **Claude o ChatGPT llegan a los datos en un paso**: un CSV exportado del portal sirve para cualquier IA, y el MCP propio deja a Claude Code o Codex consultar en vivo con la cuenta Google del portal.
3. **Un equipo se integra en una tarde**: un script que arma el JSON y lo manda, con cron o botón.
4. **Cada pieza copia una práctica publicada**: OpenTelemetry, OpenMetrics, CloudEvents, SemVer, compatibilidad hacia atrás de Schema Registry, Idempotency-Key, claves por API. No es gusto de nadie.
5. **Nadie puede borrar datos, ni sin querer ni a propósito**, tampoco quien administra la plataforma. El dato de un día, una vez recibido, es inmutable y sobrevive a que alguien vacíe la tabla.
6. **Sin sobreingeniería.** El volumen total es de unas 10.000 filas en todo el cuatrimestre. Cualquier capa que no sirva a los puntos 1, 2 o 5 sobra.

## 3. Las tres opciones

||A · Base Postgres central (Supabase)|B · Archivo de datos en git (GitHub)|C · Google Sheets + Apps Script|
|---|---|---|---|
|Qué es|Un proyecto Supabase de la cátedra con tres tablas: proyectos, catálogo de KPIs y mediciones. Se escribe por la API REST que Supabase genera sola; no se despliega código|Cada equipo sube un archivo JSON por día a un repo; un workflow lo valida y compila un CSV consolidado. Es el patrón «datos en git» de Flat Data (GitHub) y del dataset diario de COVID de Johns Hopkins|Una planilla; cada equipo hace POST a un script que agrega filas|
|Setup del profesor|Crear proyecto, pegar un SQL, cargar una fila por equipo. ~20 min|Crear repo, pegar dos workflows y un esquema, crear tokens. ~20 min más la auth|Crear planilla, pegar script, desplegar. ~15 min|
|Integración por equipo|Script de ~50 líneas + cron. 3 a 5 h|Lo mismo más commit por API, un archivo por request. 4 a 6 h|Lo mismo con POST simple. 3 a 4 h|
|Auth|Una clave por proyecto y ambiente, emitida desde el portal. Los profesores entran con Google contra una allowlist|Token de GitHub por equipo (vive en la cuenta de un alumno) o GitHub App (más pasos)|Un secreto en el script|
|Consulta y análisis con IA|Portal docente con export CSV para cualquier IA, y MCP propio de sólo lectura para Claude Code y Codex|CSV en una URL pública; se pega o se sube a la IA|Descargar CSV y subirlo|
|¿Están llegando?|Resumen diario del portal, sobre una vista con proyecto × día × KPIs válidos: es la nota del challenge|Página estática o CSV con conteos|Fórmula en una pestaña|
|Validación|En el ingreso : un KPI fuera del catálogo o un valor mal tipado rebota con 400/409|Después del commit, en CI: el dato malo ya entró|Ninguna: los encabezados son el esquema|
|Protección contra borrado|La tabla de mediciones es sólo de inserción : los proyectos no pueden actualizar ni borrar y un trigger frena el borrado desde el panel. La copia diaria en git queda como mejora posterior|Git con rama protegida es inmutable, salvo que un dueño borre el repo. Un espejo lo cubre|Cualquiera con edición borra filas; el historial de versiones es la única red|
|Governance|SQL versionado en un repo con CHANGELOG y PRs|JSON Schema versionado en el mismo repo|Nadie controla la planilla|
|Qué le van a objetar|«Free tier, ¿en la cuenta de quién?»|«Valida tarde, los tokens son de alumnos, consultar es abrir Excel»|«Es un formulario y muere con la cuenta del dueño»|

Descartadas antes de llegar acá, con el motivo verificado: BigQuery + Looker Studio (cuentas de servicio por equipo, el doble de integración y el sandbox expira toda tabla a los 60 días), Grafana Cloud (retiene métricas 14 días), Neon (Postgres sin API REST generada; restauración de 6 horas), Prometheus propio, Cloudflare Worker + D1, Airtable/NocoDB.

## 4. Recomendación: A

**Se opera desde un portal.** Los profesores entran con Google. Habilitar un equipo es emitir su clave y mandarla por WhatsApp con un botón. Un KPI nuevo lo agrega el propio equipo. Ver quién reportó hoy es abrir el Resumen diario.

**La base rechaza lo inválido en el momento**, con un código HTTP que explica por qué. No hay validador aparte que mantener. **El análisis con IA tiene dos caminos.** Cualquier IA (Claude, ChatGPT u otra) recibe el CSV que exporta el portal. Para consultar en vivo, el MCP propio `@lab4-kpis/mcp` se instala como plugin en Claude Code o Codex y usa la misma cuenta Google y los mismos permisos que el portal, sólo en lectura. Descartamos el conector oficial de Supabase porque exige que cada profesor sea miembro del proyecto Supabase y expone SQL y migraciones. **Es Postgres estándar.** El día que quieran irse, un pg_dump se lleva todo. Cualquier IA escribe el SQL para consultarlo. **Cero licencias, cero backend.** El portal es estático en GitHub Pages y el MCP corre en la máquina del profesor; no hay servidor nuestro que mantener. **El dato recibido no se toca más.** Los proyectos sólo insertan. El trigger es una traba contra el error desde el panel; contra la intención, hoy protege el registro de envíos que guarda cada equipo. La copia diaria en git y el espejo en otra organización quedan como mejora posterior ([FUTURE_BACKUP.md](../FUTURE_BACKUP.md)). **Portal docente.** Una SPA estática en GitHub Pages, con acceso por Google, que muestra el **Resumen diario** con los equipos sin envío arriba, el detalle por equipo (catálogo, mediciones, cumplimiento), exporta CSV y administra equipos, claves, período y profesores. **La demo cabe en 15 minutos y es real:** un curl que inserta un día de KPIs y recibe 201; el mismo curl con un KPI inventado y recibe 409; el mismo día reenviado, que no duplica; la vista de cumplimiento del día; y una pregunta en Claude Code, a través del MCP, sobre qué equipo tuvo más errores en la semana.

**Segunda opción: B.** No tiene servidor y git es la auditoría. Es la base de la réplica diaria a CSV que queda como mejora posterior de A.

|5. Contra Dataverse: dónde ganamos y dónde no||
|---|---|
|Dataverse gana en|Nosotros ganamos en|
|Identidad y roles maduros (Entra ID); Power BI y Copilot si la facultad tiene licencias; está pago y adentro del tenant|Costo de integración : curl con una clave. En Dataverse cada equipo necesita un service principal que sólo un administrador del tenant de la facultad puede crear. ¿Quién registra 16 aplicaciones en el Entra de la universidad?|
|MCP oficial de Microsoft, con endpoint remoto. Pero exige registrar una app en Entra ID, consentimiento de un administrador del tenant y habilitar el cliente en el Power Platform admin center; está documentado para Claude Desktop y Claude Code, no para Claude.ai ni ChatGPT|MCP propio de sólo lectura en Claude Code y Codex con la cuenta Google del portal, y CSV para cualquier otra IA. Sin registrar nada en ningún tenant|
|Pausa a los 30 días sin uso|Portabilidad : Postgres, pg_dump, SQL universal|
|Un administrador del sistema también puede borrar|Inmutabilidad por diseño: en Dataverse la protección es un rol; acá el borrado no existe para la API. El estándar se cambia por PR, no por una pantalla; el historial queda en git|

Si los profesores pesan «ya lo tenemos por Microsoft 365», van a elegir Dataverse y es una decisión razonable. Lo que compite no son los features: es que un alumno de Lab II se integra en una tarde, la demo corre en vivo y la guía entra en una carilla.

## 6. Qué cambia para cada equipo, y cuánto cuesta

Un script en el lenguaje del proyecto que (1) calcula sus 5 a 10 KPIs del día, (2) arma un JSON con el formato del anexo A, (3) hace un POST con su clave y (4) guarda una copia de lo que envió en su propia base. Corre con un cron de GitHub Actions (gratis, independiente del stack, con disparo manual por botón) o con lo que el proyecto ya tenga: pg_cron si está en Supabase, cron de Vercel, un workflow programado de n8n.

**Quién Cuánto**

Lab II, por equipo **3 a 5 h** de desarrollo, una vez. Si la cátedra elige Dataverse, el paso (3) se rehace y el resto queda

Lab IV, por equipo **~3 h**: el ADR de dos páginas que pide la cátedra, con sus 5 a 10 KPIs

Profesor, en régimen **~15 min por semana**: abrir el panel el lunes, habilitar un equipo o rotar una clave cuando haga falta

## 7. Estado y próximos pasos

|Cuándo|Qué|
|---|---|
|sáb 3/10|Sale este documento, la versión corta y la encuesta|
|lun 6/10|Cierra la votación: opción A|
|mar 7/10|Plataforma implementada en `lab4-kpis/kpis`: esquema Supabase, portal docente, contrato (OpenAPI, JSON Schema, ejemplos) y MCP para profesores. Ambientes de producción y desarrollo separados|
|mié 8/10|Instructivo para profesores y slides. `dev` se mergea a `main` para publicar el plugin del MCP|
|**jue 9/10**|**Presentación, 15 minutos, con demo en vivo.** Se entregan la presentación y el instructivo|
|clase siguiente|ADR revisado de cada equipo sobre la arquitectura elegida|

**Gane la que gane, lo que cada equipo tiene que hacer esta semana:** elegir sus 5 a 10 KPIs con nombre, tipo, fuente, frecuencia, unidad y justificación. Lo pide el ADR individual y no depende de la plataforma.

|Tabla project|Forma larga: una fila por medición.|Anexo A — Contrato de datos Es el modelo de datos ordenados que usan OpenTelemetry y cualquier serie de tiempo: el esquema no cambia cuando un equipo agrega un KPI, y dieciséis proyectos con KPIs distintos caben en la misma tabla. La fuente de verdad es la migración SQL; no hay esquema paralelo. (la carga el profesor)|||
|---|---|---|---|---|
|Campo|Regla|||Práctica que lo respalda|
|id team active Tabla|project_key|slug en kebab-case, lo asigna la cátedra (equipo-14-vaiven) número de equipo booleano; deshabilitar un equipo es ponerlo en falso (la emite el profesor, una por proyecto y ambiente)||OpenTelemetry resource attributes|
|Campo||Regla||Práctica que lo respalda|
|project_id, env key_hash revoked_at Tabla|kpi_catalog|a qué proyecto y ambiente pertenece hash SHA-256 de la clave; el texto plano se muestra una sola vez al emitirla y no se guarda fecha de revocación; rotar es emitir una nueva y revocar la anterior (una fila por KPI de cada proyecto; la inserta el propio equipo)||OWASP: claves guardadas hasheadas|
|Campo||Regla||Práctica que lo respalda|
|project_id, id id kind unit description deprecated_at|Vocabulario común recomendado ultima_ejecucion_antiguedad|clave primaria compuesta : dos equipos pueden tener latencia_p95 sin chocar, y un equipo no puede reportar el KPI de otro snake_case, sin la unidad en el nombre (latencia_p95, no latencia_ms) business / technical / health UCUM: ms, s, %, 1, y {publicacion}, {request} para conteos una línea de semántica: qué significa, cómo se calcula y cómo se agrega en el tiempo (se suma, se promedia) fecha de retiro, nula si vigente Cada equipo inserta y edita sus propias filas por la API (descripción y fecha de retiro); nunca las borra. para que «qué equipo tuvo más errores» tenga respuesta: errores_5xx (technical, {request}), latencia_p95 (technical, ms), api_alcanzable (health, 1), (health, s). Vienen como ejemplo en el repo del contrato.||OpenMetrics · OpenTelemetry naming consigna de la cátedra OpenTelemetry semantic conventions OpenTelemetry: la semántica va en metadata política de deprecación con fecha|

### Tabla measurement (la escriben los proyectos)

**Campo Regla Práctica que lo respalda**

project_id **lo pone el servidor**, no el cliente: un valor por defecto que lo PostgREST request.headers · deduce de la clave del header; la política RLS rechaza RLS WITH CHECK

|deduce de la clave del header; la política RLS rechaza||RLS|
|---|---|---|
|cualquier fila cuyo proyecto no coincida|||
|FK compuesta (project_id, día calendario medido, en|||
|/ qa|/ prod|OpenTelemetry resource|
|numérico no nulo||OpenMetrics gauge|
|UUID generado por la corrida; identifica la ejecución||RFC 9562 · CloudEvents id|
|lo pone el servidor, UTC. La nota se cuenta por este campo, no por date||CloudEvents time|
|UNIQUE: un valor por KPI, día y ambiente. Reenviar no||Idempotency-Key (IETF) como|
|duplica ni modifica: el primer valor recibido queda. Un valor mal enviado no se corrige; la nota cuenta presencia, no||regla;|
|exactitud||como mecanismo|

kpi_id kpi_id) al catálogo

date America/Argentina/Buenos_Aires, nunca futuro

env dev

value

run_id

reported_at

(project_id, kpi_id, date, on_conflict + ignore- env) duplicates de PostgREST

**Todo valor es un número.** Un KPI es una medición; un texto no es un KPI, es una etiqueta. Por eso value es numérico siempre, como en OpenMetrics y OpenTelemetry. Lo que parece texto se expresa en número: un estado de salud es 1 o 0; «última ejecución exitosa» es la antigüedad en segundos, la convención *_timestamp_seconds de Prometheus; una versión desplegada no es un KPI y no se reporta. **Por qué date no da nota.** Si la nota se contara por el día medido, un equipo podría mandar el cuatrimestre entero el último día. Se cuenta por el día en que la plataforma recibió la fila. Reenviar un día pasado completa la historia para el análisis, pero no suma a la nota.

### Cómo se envía

POST https://<proyecto>.supabase.co/rest/v1/measurement?on_conflict=project_id,kpi_id,date,env apikey: <clave pública del proyecto Supabase, la misma para todos> X-Project-Key: <clave secreta del equipo> Prefer: resolution=ignore-duplicates Content-Type: application/json

[ {"kpi_id": "publicaciones_activas", "date": "2026-10-09", "env": "prod", "value": 42, "run_id": "0192..."}, {"kpi_id": "latencia_p95", "date": "2026-10-09", "env": "prod", "value": 830, "run_id": "0192..."}, {"kpi_id": "api_alcanzable", "date": "2026-10-09", "env": "prod", "value": 1, "run_id": "0192..."}]

La clave del equipo va en un header propio y no en Authorization, porque PostgREST intenta leer ese header como un token JWT y rechazaría la clave. Un kpi_id que no está en el catálogo responde 409 con el detalle. Un env fuera del enum o una date futura responde 400. El mismo cuerpo reenviado responde 201 sin crear nada.

### Qué clave tiene quién

|Clave|Quién la tiene|Dónde vive|
|---|---|---|
|Clave pública del proyecto Supabase|todos: va en cada reporter, en el portal y en el MCP|en la configuración pública del portal; viaja en el mensaje de WhatsApp con la clave del equipo|
|Clave de proyecto (X- Project-Key)|un equipo, por ambiente (`dev` para probar, `prod` para la nota)|en el gestor de secretos del equipo; se muestra una vez al emitirla y se envía por WhatsApp al referente del equipo|
|Sesión Google del profesor|cada profesor habilitado en la allowlist|en el navegador (portal) y en un archivo local `0600` (MCP)|
|service_role|nadie la usa|no sale del panel de Supabase|
|Contraseña de la base|los profesores|no sale del panel|

**Emitir una clave** es un botón del portal que llama a una función del servidor con proyecto y ambiente; devuelve el texto plano una vez, guarda sólo el hash y ofrece mandarla por WhatsApp al referente del equipo. **Rotar** es emitir una nueva y revocar la anterior. **Deshabilitar un equipo** es poner active en falso, y no se revierte.

### Vista v_compliance y qué es un KPI válido

Proyecto × día de recepción × cantidad de KPIs válidos, con una columna por tipo (business, technical, health). Un KPI válido es una fila en prod, de un KPI del catálogo propio, recibida ese día; se cuenta cada KPI una vez por día y como máximo 10. Qué mezcla de tipos exige la cátedra lo decide la cátedra; la vista lo muestra, no lo impone. Es la nota del challenge y la respuesta a «¿están llegando los datos?».

### Sólo inserción y el acceso de los profesores

El rol que usan los proyectos tiene permiso de INSERT sobre measurement y nada más: no existe actualizar ni borrar por la API. Un trigger BEFORE DELETE OR UPDATE lanza una excepción: es una traba contra el borrado por error desde el panel, no contra la intención, porque quien creó la tabla puede desactivarlo. Contra la intención están las copias del anexo B. El portal y el MCP usan la sesión Google del profesor: la autorización la decide RLS contra la allowlist `admin_users`, y el MCP sólo expone herramientas de lectura. Quien crea el proyecto en Supabase queda como dueño y el plan gratuito no permite bajarlo a sólo lectura (el rol *Read-only* existe desde el plan Team). Se hace lo que hace cualquier operación seria: la cuenta dueña es la de emergencia y no se usa en el día a día. **Con qué cuenta.** El proyecto Supabase y la organización de GitHub los creamos nosotros para llegar con la demo funcionando, y se transfieren: un profesor queda como owner de ambos y, si hace falta, la cátedra los reconstruye desde cero con [SETUP.md](../SETUP.md). No se entrega ninguna contraseña. Si la cátedra quiere un respaldo pago además de las copias, el plan Pro de Supabase trae backups diarios con 7 días de retención por US$25 al mes.

## Anexo B — Governance del estándar

1. **El contrato es un repositorio** (`lab4-kpis/kpis`): `supabase/migrations/*.sql`, `schemas/` (OpenAPI y JSON Schema), `CHANGELOG.md`, `examples/` con reporters en Python, TypeScript y shell, el portal y el MCP. Lo que no está ahí no es contrato.
2. **El repo es público.** En una organización gratuita de GitHub, las ramas protegidas, las revisiones obligatorias, CODEOWNERS y Pages existen sólo en repos públicos; privado exige el plan Team pago. Los datos son agregados sin información personal. Si la cátedra prefiere privado, paga Team o acepta que caen las reglas 4, 5 y el panel. **Queda abierto para la cátedra.**
3. **Versionado con SemVer** en el tag del repo, con la diferencia decidida por el texto de la migración, no por criterio de nadie: es **MINOR** si sólo contiene CREATE o ALTER … ADD COLUMN sin NOT NULL; es **MAJOR** si aparece DROP, ALTER … TYPE, NOT NULL, DELETE o TRUNCATE. El workflow que lo comprueba y bloquea el PR se configura cuando la cátedra toma el ownership del repo. No hay PATCH. Dar de alta un KPI no es un cambio del esquema y no pasa por acá.
4. **Compatibilidad hacia atrás** (regla de Schema Registry): se aceptan las versiones N y N-1. Un MAJOR es una tabla nueva con sufijo; la anterior sigue viva hasta la fecha de retiro escrita en el CHANGELOG el día que se publica la nueva, nunca menos de 30 días.
5. **Un cambio es un PR** cuya descripción trae contexto, decisión e impacto sobre N-1. **CODEOWNERS:** un responsable por equipo, que se carga al adoptar la propuesta. Nadie aprueba su propio PR: GitHub no lo permite. MINOR necesita una aprobación de otro equipo. MAJOR necesita dos aprobaciones de equipos distintos y una ventana de 48 horas en la que cualquier equipo o profesor puede objetar; si nadie objeta, se mergea. Es el consenso tácito de la Apache Software Foundation.
6. **Cómo se comunica un cambio.** Todo PR mergeado se anuncia en el grupo de los 16 equipos con el enlace al CHANGELOG; todo MAJOR se anuncia además en clase. Nadie lee un CHANGELOG por iniciativa propia.
7. **Cómo se aplica un cambio del esquema.** Un PR mergeado no toca la base solo: la cátedra pega la migración en el SQL Editor de Supabase (o corre `npm run db:push`) **dentro de los 7** **días**; si no, se plantea en clase con el PR a la vista. Es un veto asumido: toda credencial que altera una tabla puede borrarla, y elegimos «nadie borra» sobre «nadie veta». Lo hace barato que el esquema está diseñado para no necesitar migraciones en el cuatrimestre: los KPIs van por API.
8. **Un KPI nuevo lo da de alta el propio equipo por la API**, insertando la fila en su catálogo. No hay PR ni despliegue; el profesor lo ve aparecer en la tabla. Un KPI no se renombra: se le pone fecha de retiro y se crea otro; su historia queda.
9. **Una clave por proyecto y ambiente.** La emite y la rota el profesor con una llamada a la función; se muestra una vez. Un equipo que filtró su clave pide una nueva.
10. **Copias que el administrador no controla.** *Diferido: en esta entrega sólo rige (c); (a) y (b) están descritas en [FUTURE_BACKUP.md](../FUTURE_BACKUP.md).* (a) Un workflow del repo del contrato exporta cada día las mediciones a data/AAAA-MM-DD.csv en una **rama data separada**, protegida sólo contra force push y borrado, porque la rama principal exige revisiones y un workflow no las tiene. (b) **Espejo, no fork**: un fork depende del original y GitHub borra los forks de un repo privado al borrarlo; un espejo es un repo propio en otra organización que el dueño del central no puede tocar. El equipo 14 mantiene uno ( vaiven- austral/kpi-replica) con un workflow de cinco líneas y un token de sólo lectura; cualquier equipo que quiera hace otro. (c) Cada reporter guarda lo que envió en su propia base, porque una foto como «publicaciones activas el 9/10» no se recalcula después. Si la base y el repo central desaparecen juntos, se restaura del último CSV con un COPY y los equipos reenvían el día que falte.

11. **Retirar la plataforma o el estándar es un MAJOR** con las mismas reglas: PR, dos aprobaciones y ventana de objeción. No se apaga por decisión de una persona.
## Anexo C — Qué se verificó

Verificado en documentación oficial el 3/10: el plan gratuito de Supabase no incluye backups y su rol *Read-only* es de plan Team; la pausa por inactividad no aplica con inserciones diarias; PostgREST rechaza una clave propia en Authorization y la lee bien desde un header propio; en una organización gratuita de GitHub, protección de ramas, revisiones, CODEOWNERS y Pages son sólo para repos públicos; Dataverse tiene endpoint MCP remoto pero exige app en Entra ID y consentimiento del administrador del tenant.

Implementado en las migraciones: la función que deduce el proyecto desde el header y la política WITH CHECK, `ignore-duplicates` con `on_conflict` sobre la clave compuesta, el trigger de inmutabilidad y el conteo de la nota por `reported_at`. La demo del jueves lo recorre entero. Probado contra el proyecto de desarrollo: los códigos `401`/`403` reales de la API, el ingreso con Google al MCP y cada herramienta del MCP con una sesión real.

Pendiente: instalar el plugin del MCP desde los marketplaces, que leen `main`, y preguntar a la cátedra desde qué día cuenta la nota (se carga en el período del portal).
