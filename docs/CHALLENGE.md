**UNIVERSIDAD AUSTRAL | FACULTAD DE INGENIERÍA**

**LAB4 · CHALLENGE**

# Cross-Project KPI Reporting

### Cambio de alcance · decisión arquitectónica · coordinación transversal

**CONSIGNA PARA ALUMNOS**

#### Contexto

Aparece un nuevo requerimiento obligatorio para todos los proyectos. La fecha no cambia y la capacidad disponible de Lab2 tampoco aumenta.

# 01 Nuevo requerimiento

Cada sistema deberá reportar diariamente información a una plataforma central de la materia.

#### Volumen obligatorio

Cada equipo debe reportar al menos 5 y como máximo 10 KPIs válidos por día.


| Tipo         | Qué representa                     | Regla / ejemplo                            |
| ------------ | ---------------------------------- | ------------------------------------------ |
| Business KPI | Resultado o actividad del proyecto | Debe provenir de los KPIs definidos en DP. |



| Technical KPI      | Funcionamiento técnico  | Ej.: latencia, errores, jobs, integraciones. |
| ------------------ | ----------------------- | -------------------------------------------- |
| Health / Telemetry | Estado y disponibilidad | Ej.: health check, última ejecución exitosa. |


Los Business KPIs deben provenir de los KPIs definidos previamente por el equipo en DP.

**Nota del challenge = suma de KPIs válidos reportados / cantidad de días evaluados. Máximo: 10.**

# 02 Restricción técnica

La solución debe estar implementada mediante código. No se permite utilizar agentes de IA como mecanismo operativo de reporting.

- Puede ejecutarse automáticamente.
- Puede ser iniciada manualmente por una persona.
- En ambos casos, la obtención, procesamiento y envío de los datos debe estar programado.



# 03 Escenarios



#### ESCENARIO 1 ESCENARIO 2

**Equipos 1 al 8 Equipos 9 al 16** **Microsoft Dataverse Otras alternativas** Acordar una única propuesta común utilizando Acordar una única arquitectura alternativa. Los Microsoft Dataverse. profesores deben poder consultar fácilmente los KPIs y analizarlos luego con Claude, ChatGPT u otras herramientas similares.

LAB4 · Consigna para alumnos Página 1


| Contrato de datos: Identificación: Semántica: elementos anteriores. 05 Entregables | 04 Qué deben acordar qué información reportará cada proyecto y en qué formato. cómo se identifican proyectos, equipos, KPIs, ambientes y ejecuciones. qué significa cada dato y qué unidad utiliza. Autenticación y autorización: cómo se conectan y publican los distintos proyectos. Governance de la propuesta: cómo se administrará el estándar una vez adoptado: quién puede pedir cambios, cómo se proponen y aprueban, cómo se comunican, versionan y migran, cómo se preserva compatibilidad y cómo se retiran No alcanza con que funcione hoy También deben definir cómo los 16 equipos podrán cambiar el estándar mañana. |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                                                                                  | PRESENTACIÓN DEL ESCENARIO Próxima clase · 15 minutos Una única propuesta común por escenario, frente a todos los equipos y profesores de Lab4. • Arquitectura propuesta • Contrato de datos • Autenticación • Governance y gestión de cambios • Cómo se integra un proyecto • Esfuerzo estimado • Impacto esperado sobre los proyectos                                                                                                                                                                                                                                                                                             |
| 2                                                                                  | GUÍA PARA PROFESORES Entrega por escenario Debe permitir que los profesores configuren y utilicen la solución sin depender de quienes la diseñaron. • Crear/configurar la plataforma y estructuras • Configurar autenticación • Habilitar un nuevo proyecto • Consultar KPIs • Incorporar o modificar métricas • Validar que los datos estén llegando                                                                                                                                                                                                                                                                               |
| 3                                                                                  | ADR POR EQUIPO Campus · máximo 2 páginas Cada equipo documenta cómo incorpora el cambio a su proyecto. • Context • Decision Drivers • Options Considered: mínimo tres alternativas • Proposed Decision • KPIs seleccionados: 5 a 10; nombre, tipo, fuente, frecuencia, unidad y justificación • Impact on Current Project                                                                                                                                                                                                                                                                                                           |




# 06 ADR: impacto sobre el proyecto actual



#### La decisión difícil es obligatoria

Este requerimiento no puede incorporarse sin generar algún impacto sobre un proyecto que ya tiene alcance, tiempo y capacidad definidos. No alcanza con describir qué trabajo nuevo se agrega.

En el apartado Impact on Current Project deberán decidir explícitamente:

- qué se agrega;
- qué se modifica;
- qué se elimina, reduce o difiere;
- por qué eligieron afectar ese elemento y no otro;
- cómo justifican esa decisión;
- horas estimadas de Lab2;
- horas estimadas de Lab4. **“Incorporamos el cambio sin afectar nada del proyecto actual” no será considerada una respuesta suficiente.**



# 07 Cómo organizarse

Tienen una semana. No hay reglas sobre cómo deben organizarse los ocho equipos de cada escenario. Con tiempo infinito pueden hacer prácticamente cualquier cosa; el desafío es organizar la capacidad disponible para llegar bien dentro del plazo.

#### Recomendación

Trátenlo como un microproyecto transversal entre ocho equipos.

- Cada equipo puede avanzar la propuesta durante un día y transferirla al siguiente.
- Pueden asignar una persona de cada equipo durante toda la semana.
- Pueden formar un pequeño equipo transversal.
- Pueden trabajar principalmente de manera asíncrona.
- Los ocho equipos pueden empoderar a una persona para definir la solución.
- Pueden dividir arquitectura, datos, seguridad, governance y documentación.
- Pueden inventar cualquier otra modalidad. **No existe una organización correcta predeterminada. La regla es llegar a los entregables en una semana.**



# 08 Día de decisión y nueva iteración

Después de las dos presentaciones, los profesores seleccionarán una única arquitectura para toda la materia. Todos los equipos deberán trabajar sobre esa decisión.

#### Si su escenario no es seleccionado

Para la clase siguiente, cada equipo de ese escenario deberá subir un nuevo ADR de máximo 2 páginas, revisado sobre la arquitectura seleccionada por los profesores.

- Qué cambia respecto del ADR original.
- Qué decisiones anteriores dejan de ser válidas.
- Qué trabajo debe rehacerse.
- Qué se agrega, modifica, elimina o difiere.
- Nueva estimación de horas de Lab2 y Lab4.
No se trata de reemplazar una tecnología por otra en el documento. Se trata de revisar una decisión de proyecto después de que una decisión organizacional externa cambió las condiciones.



#### El challenge

Decidir cómo absorber un requerimiento nuevo cuando fecha y recursos no cambian.
