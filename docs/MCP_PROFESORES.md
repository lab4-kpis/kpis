# Conectar el MCP desde ChatGPT Web (profesores)

Guía para vincular tu propia cuenta de profesor con el servidor remoto de KPIs.
No necesitás crear credenciales OAuth ni pedir un client ID. **Conectate solo
cuando el equipo te confirme que el servidor está habilitado para profesores.**

## ChatGPT Web: conexión en 5 pasos

1. En ChatGPT Web, abrí **Configuración → Complementos → + → Add custom MCP
   server** (el nombre puede variar con el idioma o la versión).
2. Escribí un nombre único, por ejemplo `Lab IV KPIs - Ana`. Los nombres
   duplicados pueden impedir la creación.
3. Pegá la URL del servidor que te comparta el equipo. **No uses la URL de DEV
   para consultar información real.** La URL productiva se publicará aquí cuando
   el equipo la habilite: `<URL MCP productiva>`.
4. Elegí **OAuth**. En **Advanced OAuth settings**, seleccioná **Dynamic Client
   Registration (DCR)** y conservá los endpoints y scopes descubiertos. No
   completes client ID, secreto, callback ni Registration URL manualmente.
5. Creá la aplicación, iniciá sesión con **tu propia cuenta habilitada** y
   aprobá el consentimiento. Después pedí, por ejemplo: “Mostrame el resumen
   diario de KPIs”.

Cada profesor vincula su propia cuenta. No compartas tu sesión ni tokens. Si la
conexión devuelve que el servicio no está habilitado, no insistas: el equipo
mantiene cerrado el acceso hasta anunciar la ventana de uso.

## Claude Web

**Todavía no hay un instructivo de conexión validado para Claude Web.** La
adaptación del servidor y el flujo OAuth deben estar implementados y pasar una
prueba end-to-end (E2E) antes de anunciar compatibilidad. No uses la URL de
ChatGPT ni intentes reutilizar esa vinculación. Esta sección se actualizará cuando
el equipo confirme ambos puntos; no hay una conexión Claude verificada en vivo.

## Ayuda

Si no aparece OAuth/DCR, la ventana de consentimiento falla o una herramienta no
está disponible, enviá al equipo el mensaje de error y una captura sin datos
personales ni tokens. Para el estado técnico y el procedimiento de operación,
consultá [configuración de Supabase para developers](MCP_SUPABASE_SETUP.md).

