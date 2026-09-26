# Validación de ATENZA

## Ajustes del 25 de septiembre de 2026

- Reloj, fecha del tablero y registros usan explícitamente `America/Hermosillo`, formato de 24 horas. Las fechas de asistencia siguen procediendo del servidor; el reloj en vivo usa el reloj del dispositivo, convertido a esa zona, y requiere que el dispositivo tenga su hora correcta.
- `node scripts/test-time.mjs` comprueba cambio de fecha UTC, medianoche, invierno/verano y fechas con otros desfases horarios.
- Se redujeron lemas, encabezados redundantes y textos de relleno. Se conservan estados de conexión, errores y avisos necesarios.
- Solicitud nueva pendiente: exigir **huella y rostro reales** al registrar entrada. Expo LocalAuthentication no permite seleccionar ni acreditar por separado qué modalidad se usó. No se implementó una simulación ni una segunda llamada presentada falsamente como otro sensor. Falta confirmar el dispositivo y la integración biométrica adecuada.

## Estado de entrega — 22 de septiembre de 2026

Las comprobaciones descritas abajo corresponden a la versión anterior con react-native-tvos. Después se cambió a React Native estándar 0.86.3 para iniciar compatibilidad con Expo Go; **no se volvió a ejecutar ni validar la aplicación tras ese cambio**, por petición del propietario de detener la ejecución y entregar el trabajo al equipo.

La compilación nativa de Android TV terminó con error de Ninja/CMake: ruta de archivo superior a 260 caracteres en Windows. No se obtuvo una APK validada. Expo Go, el emulador y la biometría siguen pendientes. La simulación biométrica no está implementada.

## Verificado el 21 de septiembre de 2026

- TypeScript: sin errores.
- ESLint: sin errores.
- Expo Doctor: 21/21 comprobaciones correctas.
- Exportación JavaScript web y Android: correcta.
- Generación del proyecto Android TV: correcta; manifiesto con LEANBACK_LAUNCHER y pantalla táctil opcional.
- Tablero web: inspección visual en navegador y navegación a inicio de sesión.
- Formulario: rechaza datos incompletos.
- Supabase: migración aplicada al proyecto ATENZA de superteam.
- Prueba de nube: autenticación, roles, RLS, aislamiento entre miembros, bloqueo de elevación de privilegios, rechazo de escritura directa, entradas concurrentes, duplicados, salida sin entrada, entrada/salida válidas, gestión de avisos y recepción Realtime.
- Limpieza: todas las cuentas y registros creados por la prueba automática se eliminaron al finalizar.
- Cuentas de demostración: administrador, miembro y pantalla creadas; inicio de sesión y roles comprobados. Accesos en `.secrets/accesos-atenza.txt`, fuera de Git.

## Pruebas con dispositivos pendientes

1. Abrir la app en un celular con huella/rostro registrado y usar la cuenta de miembro.
2. Cancelar el aviso biométrico: no debe crearse asistencia.
3. Confirmar biometría: la entrada debe aparecer en la pantalla conectada.
4. Intentar entrada duplicada: debe rechazarse sin crear otro registro.
5. Después de 30 segundos, confirmar salida: debe registrarse.
6. Desconectar internet: no debe mostrarse éxito sin confirmación del servidor.
7. Publicar/editar/eliminar un aviso desde administración y comprobarlo en la TV.
8. Verificar foco y navegación mediante control remoto en Android TV.

La biometría local no equivale a una prueba criptográfica verificada por el servidor ni a una comprobación de presencia física. Ver alcance en README.md.
