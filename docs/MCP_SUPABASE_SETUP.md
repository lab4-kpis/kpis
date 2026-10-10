# Configurar el MCP en Supabase (developers)

Procedimiento operativo para habilitar el MCP remoto con OAuth. **Este documento
no autoriza ni ejecuta cambios en producción.** En este trabajo no se corren
migraciones, no se despliega ninguna función y no se modifica ningún proyecto
Supabase. Producción no está accesible para este equipo; quien tenga acceso debe
completar la revisión y ejecución cuando el código esté aprobado.

## Antes de empezar

- El flujo verificado hasta ahora es ChatGPT Web en DEV. Claude Web solo debe
  considerarse compatible si la adaptación correspondiente queda en el PR y pasa
  una prueba end-to-end (E2E); todavía no hay una conexión Claude verificada en
  vivo.
- No copies configuración, secretos ni endpoints de DEV a producción.
- Reemplazá los marcadores `⟨...⟩` con valores confirmados del entorno. No
  inventes project ref ni URL. Guardá secretos únicamente en Supabase Secrets.
- En cada entorno, la URL del MCP es
  `https://⟨project-ref⟩.supabase.co/functions/v1/lab4-kpis-mcp` y el recurso
  OAuth debe corresponder exactamente a esa URL.

## Checklist de configuración: 5 pasos

1. **Confirmá el entorno y el código aprobado.** Revisá el PR y seleccioná
   explícitamente DEV o producción. Esta rama adapta issuer/recurso al proyecto y
   agrega soporte de origen/callback para ChatGPT y Claude; todavía hace falta
   revisión y E2E real antes de anunciar compatibilidad con Claude. No ejecutes
   `db push` ni deploy como parte de esta guía.
2. **Aplicá las migraciones solo con autorización de release.** Además de las
   migraciones de delegación y DCR, la migración planeada
   `202610100001_mcp_project_and_claude_oauth.sql` crea
   `private.mcp_oauth_config`. Esta migración **no fue ejecutada ni aplicada** en
   este trabajo. El operador con acceso debe revisar estado y dry-run; no ejecutes
   migraciones hasta que el PR esté aprobado y el responsable del entorno lo
   autorice.
3. **Configurá primero el recurso del proyecto y después Auth.** Tras aplicar la
   migración aprobada, en el SQL Editor del proyecto elegido insertá/actualizá la
   fila singleton con la URL exacta del MCP de ese proyecto. Reemplazá el marcador
   por el project ref confirmado; no uses la URL de DEV en producción:

   ```sql
   insert into private.mcp_oauth_config (singleton, resource)
   values (true, 'https://⟨project-ref⟩.supabase.co/functions/v1/lab4-kpis-mcp')
   on conflict (singleton) do update set resource = excluded.resource;
   ```

   Verificá que el valor coincida exactamente con el endpoint MCP y solo entonces
   en **Authentication → OAuth Server**, habilitá OAuth Server y **Dynamic Client
   Registration**. En **Authentication → Hooks**, configurá **Customize Access
   Token** con `public.hook_mcp_access_token`; no reemplaces el hook de registro
   de usuarios. Dejar la fila ausente mantiene la emisión OAuth cerrada; no
   habilites el hook antes de configurar el recurso.
4. **Configurá consentimiento y función Edge.** Ajustá Site URL, redirect URLs y
   Authorization path para el host de consentimiento aprobado para ese entorno.
   No dejes `localhost` en configuración productiva. Desplegá `lab4-kpis-mcp`
   con verificación JWT de plataforma deshabilitada solo si el diseño revisado lo
   requiere: la función valida el token OAuth, su audiencia e identidad. Guardá
   `MCP_PUBLISHABLE_KEY` y `MCP_PILOT_READY` como secrets del proyecto correcto;
   mantené el gate de datos cerrado (`false`) hasta la ventana autorizada.
5. **Verificá antes de anunciarlo.** Comprobá metadata protegida, discovery OAuth,
   DCR, callback y consentimiento con una cuenta autorizada; con el gate cerrado,
   confirmá que no se leen KPIs. En una ventana controlada, habilitá lectura
   únicamente según el proceso aprobado y volvé a cerrar el gate. Registrá
   entorno, resultado y rollback; nunca incluyas tokens, secretos o datos
   personales en el registro.

## Referencias del repositorio

- [Guía de conexión para profesores](MCP_PROFESORES.md)
- [Piloto DCR de DEV y evidencia histórica](MCP_OAUTH_DEV_PILOT.md)
- [Acceso delegado y políticas de solo lectura](MCP_DELEGATED_ACCESS.md)
- [Desarrollo del MCP remoto](MCP_REMOTE_DEV.md)

## Pendientes antes de producción

- Revisar el código y la migración nueva antes de release; no promover
  constantes de DEV ni aplicar la migración sin autorización del responsable.
- El responsable con acceso a producción debe revisar y ejecutar la migración,
  configuración Auth/hooks/secrets y despliegue conforme al release aprobado.
- Verificar el flujo real ChatGPT en producción y monitorear errores antes de
  comunicar disponibilidad.
- Claude Web: completar una prueba end-to-end (E2E) real antes de marcarla
  compatible o publicar instrucciones de conexión para profesores.

