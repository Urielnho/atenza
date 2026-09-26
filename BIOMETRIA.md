# Probar huella y después rostro

ATENZA Android solicita primero huella con una clave de Android Keystore. Después abre la cámara frontal y compara el rostro con la plantilla registrada para esa cuenta usando OpenCV YuNet + SFace. Solo el servicio biométrico puede guardar la asistencia en Supabase. La hora se guarda desde el servidor y se muestra en `America/Hermosillo`.

Esto necesita una **compilación propia Android**, no Expo Go. No usa Face Unlock del sistema ni necesita registrar el rostro en Ajustes de Android. La primera vez se registra el rostro dentro de ATENZA, con consentimiento y después de la huella.

## Preparación en Windows

Requisitos: Node, Python 3.13, Android Studio/SDK, JDK de Android Studio, cuenta de miembro de ATENZA y Supabase CLI autenticado con acceso al proyecto. Trabaja en una ruta corta como `C:\dev\atenza` para evitar el límite de rutas de CMake.

Desde la raíz del repositorio (con `.env` configurado):

```powershell
npm ci
py -3.13 -m venv biometric-server/.venv
biometric-server/.venv/Scripts/python.exe -m pip install -r biometric-server/requirements.txt
biometric-server/.venv/Scripts/python.exe biometric-server/download_models.py
npm run biometrics
```

El servicio escucha en `127.0.0.1:8787`. Deja esa terminal abierta. El lanzador obtiene la clave administrativa con Supabase CLI y la pasa únicamente al servidor; también admite `SUPABASE_SERVICE_ROLE_KEY` en el entorno del servidor. Nunca pongas esa clave en `.env` de Expo ni en variables `EXPO_PUBLIC_*`.

En otra terminal, con el emulador encendido:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
& "$env:ANDROID_HOME\platform-tools\adb.exe" reverse tcp:8787 tcp:8787
& "$env:ANDROID_HOME\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
$env:EXPO_TV='0'
npm run android
```

Si ya tienes la APK de desarrollo instalada, basta `npx expo start --localhost` y abrir ATENZA. Repite `adb reverse` al reiniciar el emulador. Para varios dispositivos selecciona el destino con `adb -s SERIAL`.

## Configuración del emulador

1. Usa un AVD Android con soporte de huella. En Ajustes de Android configura bloqueo de pantalla y una huella. En los controles extendidos del emulador, sección Fingerprint, se envían las lecturas durante el registro y la comprobación.
2. Configura la cámara frontal del AVD para usar la webcam de la computadora y reinícialo si corresponde. La escena virtual no sirve para registrar tu rostro.
3. Inicia sesión en ATENZA con una cuenta de **miembro**, no de administrador ni pantalla.
4. Acepta registrar tu plantilla facial, pulsa «Registrar mi rostro», confirma la huella y captura tu rostro con buena luz.
5. Pulsa «Registrar entrada»: confirma primero huella y después rostro. Comprueba la asistencia en tu historial y el tablero. Espera 30 segundos antes de registrar salida.

El emulador emite eventos de huella virtuales: no escanea físicamente tu dedo. La comparación facial sí procesa la imagen de la webcam. Para validar el sensor de huella real hace falta un teléfono Android con lector; no basta con que el AVD se llame Pixel.

## Casos que debes probar

- Cancelar la huella o usar una huella no registrada: no debe llegar al rostro ni guardar asistencia.
- Cancelar la cámara, no mostrar rostro o mostrar uno diferente: no debe guardar asistencia.
- Completar ambos pasos: una sola asistencia, con hora de Hermosillo.
- Repetir entrada: rechazo de duplicado. Salida después de 30 segundos: registro correcto.
- Apagar el servicio o quitar internet: mensaje de error, sin éxito aparente.
- Cambiar de pantalla durante la verificación: se cancela el intento.

## Datos y alcance

La huella permanece en Android. El servicio conserva una plantilla facial cifrada y la clave pública del dispositivo en `biometric-server/data/biometrics.sqlite3`; no conserva la foto recibida. La cámara puede generar archivos temporales en la caché de la app. La llave de cifrado está en `.secrets/face-template.key`. Ambos directorios están excluidos de Git. Protege y respalda los archivos localmente; perder la llave impide leer las plantillas.

Para retirar el consentimiento o restablecer el dispositivo, el administrador ejecuta localmente:

```powershell
biometric-server/.venv/Scripts/python.exe biometric-server/reset_identity.py UUID_DEL_USUARIO --confirm
```

La eliminación no borra asistencias históricas ni copias de respaldo. Cambiar las huellas registradas puede invalidar la clave Android; puede requerirse reinstalar ATENZA y restablecer su registro con este comando.

**Límites:** reconocimiento facial sin detección de vida; una fotografía podría superar la comparación. No acredita presencia física ni identidad legal. Cualquier huella inscrita en ese dispositivo puede autorizar su clave. El primer enrolamiento confía en la cuenta y la app: no se valida atestación de hardware, por lo que no se presenta como protección contra clientes manipulados. La firma y el desafío de un uso bloquean repetición de respuestas, pero no sustituyen esa atestación. El umbral facial requiere calibración en dispositivos reales.

El servicio actual es local y debe permanecer encendido. Para acceso remoto necesita despliegue con HTTPS, protección de secretos y política de conservación de datos. La app rechaza HTTP fuera de loopback.

## Comprobaciones automatizadas

```powershell
biometric-server/.venv/Scripts/python.exe -m pytest biometric-server -q
npm run typecheck
npm run lint
node scripts/test-time.mjs
node scripts/test-cloud.mjs
```

Las pruebas Python usan claves criptográficas reales y un comparador facial de prueba para comprobar orden, consentimiento, cifrado, caducidad, aislamiento, rechazo y reutilización. No sustituyen la prueba de tu rostro y sensor. La prueba de nube crea y elimina exclusivamente cuentas y registros temporales.

Referencias: [cámara Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [FingerprintManager Android](https://developer.android.com/reference/android/hardware/fingerprint/FingerprintManager), [OpenCV SFace](https://docs.opencv.org/4.x/d0/dd4/tutorial_dnn_face.html). FingerprintManager está obsoleto, pero se utiliza deliberadamente para solicitar específicamente huella; se debe comprobar compatibilidad en cada dispositivo objetivo.
