# Instalar ATENZA en otra laptop (Windows)

Guía paso a paso para dejar funcionando ATENZA Android (huella y después rostro) en una computadora nueva. Complementa [BIOMETRIA.md](BIOMETRIA.md), que explica el flujo y los casos de prueba.

Probado el 25/09/2026 en Windows 11 con Node 22.13, Python 3.13, Android Studio (JDK incluido) y el emulador `Pixel 9 API 35`: dependencias, pruebas automáticas, compilación del APK, instalación en el emulador y arranque del servicio biométrico. **La prueba completa de huella + rostro en el emulador todavía está pendiente de validar.**

## 1. Programas necesarios

| Programa | Notas |
| --- | --- |
| Git | Para clonar y actualizar el repositorio. |
| Node.js 22 | Recomendado 22.18 o superior (ver [problemas conocidos](#problemas-conocidos)). |
| Python 3.13 | Para el servicio biométrico. Comprueba con `py -3.13 --version`. |
| Android Studio | Instala el SDK y crea un emulador **API 35** con Google APIs. |
| Supabase CLI | El servicio lo usa para obtener la clave de administrador. |

Instalar Supabase CLI con Scoop (**no** funciona `npm install -g supabase`):

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Sin Scoop: descarga `supabase_<versión>_windows_amd64.zip` de https://github.com/supabase/cli/releases, descomprímelo en una carpeta (por ejemplo `%LOCALAPPDATA%\Programs\supabase`) y agrega esa carpeta al `Path` de tu usuario. Abre una terminal nueva y comprueba con `supabase --version`.

## 2. Accesos

- **Supabase:** pídele a Uriel que invite tu correo al proyecto ATENZA. Después:
  ```powershell
  supabase login
  supabase projects list   # debe aparecer kgxyfphjnaondupjakfj (ATENZA)
  ```
- **`.env`:** pide por privado la URL y la clave pública (anon) de Supabase.
- **Cuenta de miembro** de ATENZA para checar (no de administrador ni de pantalla).

## 3. Clonar en una ruta corta

La compilación Android falla en Windows si la ruta es larga (límite de 260 caracteres de CMake). Usa `C:\dev\atenza`:

```powershell
mkdir C:\dev
git clone https://github.com/Urielnho/atenza.git C:\dev\atenza
cd C:\dev\atenza
Copy-Item .env.example .env
```

Llena `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `.env`. Deja `EXPO_PUBLIC_BIOMETRIC_URL=http://127.0.0.1:8787`. **Nunca** pongas la clave `service_role` en `.env`.

## 4. Instalar dependencias (una sola vez)

```powershell
npm ci
py -3.13 -m venv biometric-server/.venv
biometric-server/.venv/Scripts/python.exe -m pip install -r biometric-server/requirements.txt
biometric-server/.venv/Scripts/python.exe biometric-server/download_models.py
```

Comprobaciones:

```powershell
biometric-server/.venv/Scripts/python.exe -m pytest biometric-server -q
npm run typecheck
npm run lint
node --experimental-strip-types scripts/test-time.mjs
```

## 5. Compilar e instalar la app Android (una sola vez, o al cambiar código nativo)

Enciende el emulador primero (ver paso 6). Luego:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:EXPO_TV='0'
npx expo run:android
```

La primera compilación tarda alrededor de 10 minutos. Instala ATENZA en el emulador y abre Metro. No sirve Expo Go: la huella usa un módulo nativo propio (`modules/atenza-fingerprint`).

## 6. Emulador con webcam y huella

La cámara frontal del emulador debe ser tu webcam; si no, no puede reconocer tu rostro. Sin editar el AVD, arráncalo así:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -webcam-list        # nombre de la webcam, normalmente webcam0
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_9_API_35 -camera-front webcam0
```

En Android: configura un PIN y registra una huella (Ajustes → Seguridad → Huella). Los toques se envían desde los controles extendidos del emulador (**⋯ → Fingerprint → Touch sensor**).

## 7. Cada vez que vayas a probar

Terminal 1, servicio biométrico (déjala abierta):

```powershell
cd C:\dev\atenza
npm run biometrics
```

Terminal 2, con el emulador encendido:

```powershell
cd C:\dev\atenza
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8787 tcp:8787
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
npx expo start --localhost
```

Abre ATENZA en el emulador y sigue los pasos 3 a 5 de la sección «Configuración del emulador» de [BIOMETRIA.md](BIOMETRIA.md). Repite `adb reverse` cada vez que reinicies el emulador.

## 8. Actualizar a la última versión

```powershell
cd C:\dev\atenza
git pull
npm ci
```

Si cambió `package.json`, `app.config.js` o `modules/`, vuelve a compilar con el paso 5.

## Problemas conocidos

- **`ninja`/CMake: ruta de archivo demasiado larga.** El proyecto no está en una ruta corta. Clónalo en `C:\dev\atenza`.
- **`ERR_UNKNOWN_FILE_EXTENSION ".ts"` en `scripts/test-time.mjs`.** Node anterior a 22.18. Usa `node --experimental-strip-types scripts/test-time.mjs` o actualiza Node.
- **El emulador reinicia su sistema o no instala apps (`Can't find service: package`, `Broken pipe`).** Visto con la imagen `android-36.1`: la emulación gráfica se cae (`hasReadColorBufferDma`). Borrar datos o usar `-gpu swiftshader_indirect` no lo arregló; usa un emulador **API 35**.
- **`Configura SUPABASE_SERVICE_ROLE_KEY solo en el servidor`.** Supabase CLI no está en el `Path` o no iniciaste sesión (`supabase login`).
- **La app dice que no puede conectar con la verificación facial.** El servicio de la terminal 1 está apagado o falta `adb reverse tcp:8787 tcp:8787`.
- **La cámara muestra una escena virtual.** El emulador no se arrancó con `-camera-front webcam0`.
- **ATENZA no abre y el emulador pide PIN.** Desbloquea el emulador; Android no abre apps con el usuario bloqueado tras reiniciar.
