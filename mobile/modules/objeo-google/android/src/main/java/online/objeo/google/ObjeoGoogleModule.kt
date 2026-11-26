package online.objeo.google

import androidx.credentials.CredentialManager
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ObjeoGoogleModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ObjeoGoogle")
    AsyncFunction("signIn") Coroutine { clientId: String, nonce: String ->
      withContext(Dispatchers.Main) {
        val activity = appContext.currentActivity ?: error("Ouvrez Objeo avant de vous connecter.")
        require(clientId.endsWith(".apps.googleusercontent.com") && nonce.matches(Regex("[0-9a-f]{64}"))) { "Configuration Google invalide." }
        val manager = CredentialManager.create(activity)
        val option = GetSignInWithGoogleOption.Builder(clientId).setNonce(nonce).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        try {
          val credential = manager.getCredential(activity, request).credential
          if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            error("Type de compte Google non reconnu.")
          }
          val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
          mapOf("idToken" to token, "cancelled" to false)
        } catch (_: GetCredentialCancellationException) {
          mapOf("cancelled" to true)
        } catch (_: NoCredentialException) {
          error("Aucun compte Google disponible. Ajoutez un compte dans les paramètres Android ou utilisez votre e-mail.")
        } catch (_: GetCredentialProviderConfigurationException) {
          error("Services Google Play indisponibles sur cet appareil. Utilisez votre e-mail.")
        }
      }
    }
    AsyncFunction("clearSession") Coroutine { ->
      withContext(Dispatchers.Main) {
        val context = appContext.reactContext ?: return@withContext
        CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
      }
    }
  }
}
