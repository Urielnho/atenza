# ATENZA

Aplicación React Native / Expo para Android TV, móvil y vista previa web. Identidad minimalista: azul marino, blanco y turquesa.

## Entrega al equipo — proyecto en desarrollo

Este repositorio se entrega para que los compañeros revisen el estado actual, comprueben su funcionamiento y completen lo que falta. **No se presenta como una aplicación terminada ni validada en dispositivos.**

**Mensaje de Uriel:** Si quieren colaborar en la base de datos de Supabase, mándenme por privado el correo con el que usan Supabase para invitarlos al proyecto/organización correspondiente. Si también necesitan acceso al repositorio, mándenme su usuario de GitHub. No pongan contraseñas, claves ni correos personales en issues públicos.

Tener una cuenta de usuario de ATENZA no da acceso al panel de Supabase. Las invitaciones de colaboración las gestiona Uriel; no se envían automáticamente desde esta app.

Lean [ENTREGA_EQUIPO.md](ENTREGA_EQUIPO.md) para comparar el avance con lo solicitado por el profesor, y [VALIDACION.md](VALIDACION.md) para conocer las pruebas realizadas y pendientes.

## Huella y después rostro

El checador Android ahora utiliza huella mediante un módulo nativo y comparación facial con cámara. Requiere la app Android propia y el servicio biométrico local encendido. **Expo Go y web no pueden completar este flujo.** Sigue [BIOMETRIA.md](BIOMETRIA.md) para instalar, registrar el rostro y probarlo.

Para preparar una laptop nueva con Windows paso a paso (ruta corta, Supabase CLI, emulador con webcam y problemas conocidos), consulta [INSTALACION.md](INSTALACION.md).

## Iniciar

```powershell
cd atenza
Copy-Item .env.example .env
npm ci
npm run web
```

La conexión local está en `.env` (ignorado por Git). Para otro equipo, copia `.env.example` y completa URL y clave pública de Supabase. Nunca uses una clave service_role en variables EXPO_PUBLIC.

## Flujo

1. Crea cuentas desde «Iniciar sesión → Crear una cuenta» y confirma el correo.
2. Las cuentas nuevas son miembros. En el celular, el miembro registra entrada/salida tras verificar primero su huella y después su rostro.
3. Crea una cuenta para administración y otra para pantalla; asigna sus roles mediante la terminal autenticada en Supabase:

```powershell
node scripts/set-role.mjs tu-correo@dominio.com admin
node scripts/set-role.mjs correo-pantalla@dominio.com display
```

4. Inicia sesión como administrador para publicar, editar o eliminar avisos desde web o móvil. Inicia sesión con la cuenta de pantalla en TV. El tablero recibe avisos y asistencias por Supabase Realtime. Los miembros solo pueden ver sus propias asistencias.

## Android móvil y TV

Actualmente se usa **React Native estándar 0.86.3 con Expo SDK 57**. La dependencia `react-native-tvos` se sustituyó al iniciar la adaptación a Expo Go, pero esa adaptación quedó **sin validar**. El plugin de TV sigue en la configuración. La compilación JS Android no equivale a validar una APK.

Para intentar abrir en Expo Go (con una versión compatible con SDK 57):
```powershell
npx expo start --go
```

En el emulador Android Studio se puede usar `npx expo start --go --android`. `npm run android` todavía genera una app nativa; no abre Expo Go. El checador de dos pasos requiere la compilación propia Android descrita en BIOMETRIA.md. La vista web/Expo Go sirve para tablero y administración.

Móvil:
```powershell
$env:EXPO_TV='0'
npx expo run:android
```

Para retomar la compilación TV, primero restablecer la dependencia compatible y usar un emulador Android TV o una TV conectada por ADB:
```powershell
npx expo install react-native@npm:react-native-tvos@0.86-stable
$env:EXPO_TV='1'
npx expo prebuild --clean --platform android
npx expo run:android
```

Al cambiar de TV a móvil, regenera los directorios nativos con EXPO_TV=0 y prebuild --clean. Solo se deben regenerar directorios generados, sin cambios nativos manuales. Android TV tiene foco visible en los botones. No se ha validado Apple TV ni televisores Tizen/webOS.

La compilación nativa intentada falló por rutas de más de 260 caracteres en Windows. Para retomarla, clonen en una ruta corta (por ejemplo `C:\dev\atenza`) y regeneren los archivos nativos. No hay APK validada.

## Nube

Proyecto: ATENZA, organización superteam, referencia kgxyfphjnaondupjakfj.
Migración: `supabase/migrations/202609220001_atenza.sql`.
Tablas: atenza_profiles, atenza_notices, atenza_attendance.
RLS impide escritura directa de asistencias, elevación de rol y lectura de otras personas por miembros. La función de registro usa usuario y hora del servidor, serializa operaciones por persona y rechaza duplicados y salidas sin entrada.

## Validación

```powershell
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform web
npx expo export --platform android
node scripts/test-cloud.mjs
```

La prueba de nube requiere Supabase CLI autenticado. Crea cuentas temporales en el proyecto especificado, prueba permisos/Realtime y elimina exclusivamente sus propios datos. Las claves administrativas se mantienen en memoria del script y nunca se envían a la app.

## Alcance de esta primera versión

- Implementa la alternativa de tablero de avisos e información en tiempo real del enunciado. La reproducción multimedia es opcional y no está incluida.
- La huella se autoriza en Android y firma un desafío de un solo uso. El rostro se compara en el servicio local con una plantilla cifrada; no se almacena la foto recibida.
- La RPC de registro anterior está revocada para clientes; la nueva solo permite al servicio guardar asistencias. No hay atestación de hardware ni detección de vida facial: no es una solución de seguridad de producción. Ver BIOMETRIA.md.
- No comprueba ubicación ni presencia física. QR temporal/proximidad quedan fuera de esta primera versión.
- La prueba real de huella/rostro requiere un celular físico. El navegador muestra la interfaz pero no simula una biometría exitosa.
- Pendientes de validación: APK Android TV, navegación con control remoto y biometría en dispositivo real.

Referencias: https://docs.expo.dev/guides/building-for-tv/ , https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/ , https://supabase.com/docs/guides/auth/quickstarts/react-native
