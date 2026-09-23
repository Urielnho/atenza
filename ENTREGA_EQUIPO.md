# Entrega de ATENZA a los compañeros

## Propósito

Un checador de asistencia conectado a una pantalla inteligente. La persona confirma su entrada/salida desde el celular; Supabase guarda el registro y la pantalla muestra actividad y avisos en tiempo real. Administración gestiona los avisos remotamente.

## Lo que pidió el profesor

> Desarrollar una aplicación de pantalla inteligente (Smart Display / TV) en React Native que despliegue información en tiempo real, tableros de avisos o reproducción multimedia, permitiendo la gestión y autenticación remota mediante sensores móviles (Huella/Rostro) y la nube a modo de checador.

| Requisito | Estado del proyecto | Qué verificar o completar |
| --- | --- | --- |
| React Native para Smart Display / TV | Interfaz creada y configuración de TV iniciada | Restablecer el perfil TV y probar compilación, navegación con control y legibilidad en una pantalla. |
| Información en tiempo real | Suscripciones Supabase Realtime implementadas y probadas desde scripts | Confirmar actualización entre dos dispositivos/sesiones. |
| Tablero de avisos o multimedia | Crear, editar y eliminar avisos implementado | Probar las operaciones desde administración y observarlas en pantalla. No incluye reproducción multimedia. |
| Gestión remota | Cuenta y pantalla de administración con permisos por rol | Probar gestión desde otro dispositivo. |
| Autenticación por huella/rostro | Llamada a expo-local-authentication implementada | No probada con sensor físico. Face ID no funciona en Expo Go; requiere app propia. |
| Nube y checador | Tablas, autenticación, permisos y función de entradas/salidas implementados | Probar el flujo completo, errores de conexión y registros duplicados. |
| Demostración en Expo Go | Cambio a React Native estándar iniciado | Completar compatibilidad y ejecución. La simulación biométrica todavía no existe. |

**Conclusión de entrega:** hay una base funcional de interfaz y nube, pero no está completo ni comprobado el flujo integral exigido. Una simulación debe mostrarse como simulación y no presentarse como prueba de un sensor real.

## Acceso para colaborar

**Mándenme por privado su correo de Supabase si quieren colaborar en la base de datos de ATENZA.** Con ese correo, Uriel gestionará la invitación a superteam según los permisos necesarios. Para colaborar en GitHub, envíen también su usuario de GitHub.

No se comparten las credenciales personales de Uriel. Las cuentas de demostración de la app y la configuración local se solicitan por privado. `.env` y `.secrets` no forman parte del repositorio.

## Cómo comenzar la revisión

1. Clonar en una ruta corta, especialmente en Windows, por ejemplo `C:\dev\atenza`.
2. Revisar `README.md`, `VALIDACION.md`, `package.json` y `app.config.js`.
3. Copiar `.env.example` a `.env` y pedir a Uriel URL y clave pública del proyecto. Nunca colocar service_role en el cliente.
4. Instalar con `npm ci`. Iniciar la vista web con `npm run web` o intentar Expo Go con `npx expo start --go --android` cuando el emulador esté listo.
5. Ejecutar typecheck, lint y Expo Doctor. Las comprobaciones previas no sustituyen validar la configuración actual.
6. Usar cuentas de roles distintos para probar checador, administración y pantalla. No usar cuentas de administrador como usuarios del checador.
7. Registrar fallos reproducibles y completar los pendientes antes de declarar que cumple el enunciado.

## Límites importantes

- La función de asistencia autentica la cuenta y usa la hora del servidor, pero no verifica una prueba criptográfica del evento biométrico. Un cliente modificado podría llamar directamente a la función. Revisar este punto si se pide seguridad de producción.
- No hay comprobación de ubicación física ni QR temporal.
- Las cuentas de demostración usan correos sin buzón; no sirven para recuperación por correo.
- `scripts/test-cloud.mjs` crea y elimina sus propios datos temporales en la nube: revisen el proyecto de destino y obtengan acceso antes de ejecutarlo.
- El script `bootstrap-demo.mjs` ya fue usado. No volver a ejecutarlo como paso normal de instalación.

## Archivos principales

- `src/app/`: tablero, inicio de sesión, checador y administración.
- `src/lib/`: conexión y sincronización con Supabase.
- `supabase/migrations/`: estructura, permisos y función de asistencia.
- `scripts/`: pruebas de nube y utilidades administrativas que requieren Supabase CLI autorizado.
