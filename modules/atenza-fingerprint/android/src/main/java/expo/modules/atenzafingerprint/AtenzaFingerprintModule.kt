package expo.modules.atenzafingerprint

import android.app.AlertDialog
import android.content.Context
import android.hardware.fingerprint.FingerprintManager
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/** Fingerprint-only API is intentionally used: BiometricPrompt cannot select
 * fingerprint independently of face. No PIN, face, or JS-success fallback. */
@Suppress("DEPRECATION")
class AtenzaFingerprintModule : Module() {
  private var cancellation: CancellationSignal? = null
  private var dialog: AlertDialog? = null
  private var pending: Promise? = null
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { reject("E_TIMEOUT", "La verificación de huella venció.") }

  private fun finish() {
    handler.removeCallbacks(timeout)
    cancellation?.cancel()
    cancellation = null
    dialog?.dismiss()
    dialog = null
  }
  private fun reject(code: String, message: String) {
    val promise = pending ?: return
    pending = null
    finish()
    promise.reject(code, message, null)
  }
  override fun definition() = ModuleDefinition {
    Name("AtenzaFingerprint")
    AsyncFunction("authorize") { userId: String, challenge: String, promise: Promise ->
      if (pending != null) {
        promise.reject("E_BUSY", "Ya hay una verificación en curso.", null)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      val manager = activity?.getSystemService(Context.FINGERPRINT_SERVICE) as? FingerprintManager
      if (activity == null || manager == null || !manager.isHardwareDetected || !manager.hasEnrolledFingerprints()) {
        promise.reject("E_UNAVAILABLE", "Configura una huella en los ajustes de Android.", null)
        return@AsyncFunction
      }
      pending = promise
      try {
        require(challenge.length in 16..512 && userId.length in 1..128)
        val suffix = MessageDigest.getInstance("SHA-256").digest(userId.toByteArray()).joinToString("") { "%02x".format(it) }
        val alias = "atenza.fingerprint.$suffix"
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (!store.containsAlias(alias)) {
          val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
          generator.initialize(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationValidityDurationSeconds(-1)
            .setInvalidatedByBiometricEnrollment(true)
            .build())
          generator.generateKeyPair()
        }
        val signature = Signature.getInstance("SHA256withECDSA").apply {
          initSign(store.getKey(alias, null) as PrivateKey)
        }
        val publicKey = Base64.encodeToString(store.getCertificate(alias).publicKey.encoded, Base64.NO_WRAP)
        dialog = AlertDialog.Builder(activity)
          .setTitle("Paso 1 de 2 · Huella")
          .setMessage("Coloca tu dedo en el sensor de huella.")
          .setNegativeButton("Cancelar") { _, _ -> reject("E_CANCELLED", "Verificación cancelada.") }
          .setOnCancelListener { reject("E_CANCELLED", "Verificación cancelada.") }
          .create().also { it.setCanceledOnTouchOutside(false); it.show() }
        cancellation = CancellationSignal()
        handler.postDelayed(timeout, 60000)
        manager.authenticate(FingerprintManager.CryptoObject(signature), cancellation, 0,
          object : FingerprintManager.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: FingerprintManager.AuthenticationResult) {
              val waiting = pending ?: return
              try {
                val signer = result.cryptoObject?.signature ?: error("No authenticated signature")
                signer.update(challenge.toByteArray(Charsets.UTF_8))
                val signed = Base64.encodeToString(signer.sign(), Base64.NO_WRAP)
                pending = null
                finish()
                waiting.resolve(mapOf("publicKey" to publicKey, "signature" to signed))
              } catch (e: Exception) { reject("E_KEY", "No se pudo firmar la verificación. Revisa la huella registrada.") }
            }
            override fun onAuthenticationFailed() { dialog?.setMessage("Huella no reconocida. Intenta de nuevo.") }
            override fun onAuthenticationHelp(code: Int, text: CharSequence) { dialog?.setMessage(text) }
            override fun onAuthenticationError(code: Int, text: CharSequence) { reject("E_FINGERPRINT", text.toString()) }
          }, handler)
      } catch (e: Exception) {
        reject("E_KEY", "No se pudo usar la huella. Si cambiaste las huellas o reinstalaste la app, solicita restablecer el registro biométrico.")
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancel") { reject("E_CANCELLED", "Verificación cancelada.") }.runOnQueue(Queues.MAIN)
    OnActivityEntersBackground { handler.post { reject("E_CANCELLED", "Verificación interrumpida.") } }
    OnDestroy { handler.post { reject("E_CANCELLED", "Verificación interrumpida.") } }
  }
}
