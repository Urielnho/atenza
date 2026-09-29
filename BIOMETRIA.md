# Probar la huella en ATENZA

ATENZA Android solicita la huella mediante el sensor del sistema. Una clave privada protegida por Android Keystore firma un desafío de un solo uso; el servicio valida la firma y registra la asistencia en Supabase. La hora proviene del servidor y se muestra en `America/Hermosillo`.

En Android puede probarse con Expo Go mediante `expo-local-authentication`. La APK propia agrega una firma verificable con Android Keystore; Expo Go solo informa a la aplicación que el aviso biométrico local terminó correctamente.

## Preparación en Windows

Requisitos: Node, Python 3.13, Android Studio/SDK, JDK de Android Studio, una cuenta de miembro de ATENZA y Supabase CLI autenticado. Trabaja en una ruta corta como `C:\dev\atenza` para evitar el límite de rutas de CMake.

La primera vez, inicia sesión con una cuenta de Supabase que tenga acceso al proyecto ATENZA:

```powershell
npx supabase login
```

```powershell
npm ci
py -3.13 -m venv biometric-server/.venv
biometric-server/.venv/Scripts/python.exe -m pip install -r biometric-server/requirements.txt
```

El comando de Expo Go inicia también el servicio en `127.0.0.1:8787`. El lanzador obtiene la clave `service_role` mediante Supabase CLI y la entrega únicamente al servidor. Nunca coloques esa clave en `.env` de Expo ni en variables `EXPO_PUBLIC_*`.

En otra terminal, con el emulador encendido:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
npm run expo-go
```

El comando configura ADB, inicia el servicio y abre Expo Go. Para probar la APK propia usa `$env:EXPO_TV='0'; npm run android`.

## Prueba en el emulador

1. Configura bloqueo de pantalla y una huella en Ajustes de Android.
2. Inicia sesión en ATENZA con una cuenta de miembro.
3. Pulsa **Registrar asistencia**.
4. En los controles extendidos del emulador, abre **Fingerprint** y pulsa **Touch Sensor**.
5. ATENZA registra automáticamente entrada o salida según el último movimiento y actualiza el historial.

El emulador genera un evento virtual; no escanea físicamente un dedo. La prueba real del sensor requiere un teléfono Android con lector de huellas.

## Casos que debes probar

- Huella válida: registra una sola asistencia y muestra confirmación.
- Cancelación o huella no registrada: no guarda asistencia.
- Primer movimiento o último movimiento en salida: registra entrada.
- Último movimiento en entrada: registra salida.
- Nuevo intento antes de 30 segundos: el servidor lo rechaza.
- Servicio apagado o sin internet: muestra un error sin informar éxito.
- Cambiar de pantalla durante la verificación: cancela el intento.

## Datos y alcance

La huella permanece dentro de Android. El servicio almacena únicamente la clave pública vinculada a la cuenta en `biometric-server/data/biometrics.sqlite3`; no recibe ni guarda imágenes ni datos de la huella.

Para desvincular el dispositivo de un usuario, administración puede ejecutar:

```powershell
biometric-server/.venv/Scripts/python.exe biometric-server/reset_identity.py UUID_DEL_USUARIO --confirm
```

Cualquier huella inscrita en el dispositivo puede autorizar el registro. La APK propia vincula una clave al dispositivo, pero no incluye atestación de hardware. Expo Go no puede demostrarle al servidor que ocurrió la biometría: el servidor confía en el resultado enviado por el cliente. Esta ruta es adecuada para la demostración académica, no para un sistema de control de acceso de producción.

## Comprobaciones automatizadas

```powershell
biometric-server/.venv/Scripts/python.exe -m pytest biometric-server -q
npm run typecheck
npm run lint
node scripts/test-time.mjs
node scripts/test-cloud.mjs
```

Referencia: [FingerprintManager de Android](https://developer.android.com/reference/android/hardware/fingerprint/FingerprintManager). Se usa deliberadamente para solicitar huella en el prototipo; se debe comprobar compatibilidad en cada dispositivo objetivo.
