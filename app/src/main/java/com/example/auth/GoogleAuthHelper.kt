package com.example.auth

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.util.Log
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.example.R
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.Companion.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

private const val TAG = "Auth"

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

private fun isConfigurationOrShaError(raw: String?): Boolean {
    val msg = raw?.lowercase() ?: return false
    return msg.contains("28444") ||
        msg.contains("developer") ||
        msg.contains("configured") ||
        msg.contains("caller") ||
        msg.contains("fingerprint") ||
        msg.contains("sha") ||
        msg.contains("10:")
}

internal fun FirebaseAuth.authStateFlow(): Flow<FirebaseUser?> = callbackFlow {
    val listener = FirebaseAuth.AuthStateListener { auth ->
        trySend(auth.currentUser)
    }
    addAuthStateListener(listener)
    awaitClose { removeAuthStateListener(listener) }
}

fun attemptAutoSignIn(
    context: Context,
    credentialManager: CredentialManager,
    onAuthSuccess: () -> Unit,
    onUnauthenticated: () -> Unit,
    scope: CoroutineScope
) {
    if (FirebaseAuth.getInstance().currentUser != null) {
        onAuthSuccess()
        return
    }
    val clientId = try {
        context.getString(R.string.default_web_client_id)
    } catch (_: Exception) {
        onUnauthenticated()
        return
    }
    val googleIdOption = GetGoogleIdOption.Builder()
        .setFilterByAuthorizedAccounts(true)
        .setServerClientId(clientId)
        .setAutoSelectEnabled(true)
        .build()
    val request = GetCredentialRequest.Builder()
        .addCredentialOption(googleIdOption)
        .build()

    scope.launch {
        try {
            val hostContext = context.findActivity() ?: context
            val cred = credentialManager.getCredential(hostContext, request).credential
            if (cred is CustomCredential && cred.type == TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                val token = GoogleIdTokenCredential.createFrom(cred.data).idToken
                FirebaseAuth.getInstance().signInWithCredential(GoogleAuthProvider.getCredential(token, null)).await()
                onAuthSuccess()
            } else {
                onUnauthenticated()
            }
        } catch (e: NoCredentialException) {
            Log.d(TAG, "No authorized Google credentials on device yet: ${e.message}")
            onUnauthenticated()
        } catch (e: Exception) {
            Log.d(TAG, "Silent auto sign-in unavailable: ${e.message}")
            onUnauthenticated()
        }
    }
}

fun onGoogleSignInClicked(
    context: Context,
    credentialManager: CredentialManager,
    onAuthSuccess: () -> Unit,
    onAuthError: (String) -> Unit,
    scope: CoroutineScope,
    onAuthCancelled: () -> Unit = {}
) {
    val clientId = try {
        context.getString(R.string.default_web_client_id)
    } catch (_: Exception) {
        onAuthError("پیکربندی ورود با گوگل یافت نشد.")
        return
    }
    val signInOption = GetSignInWithGoogleOption.Builder(serverClientId = clientId).build()
    val request = GetCredentialRequest.Builder()
        .addCredentialOption(signInOption)
        .build()

    scope.launch {
        try {
            val hostContext = context.findActivity() ?: context
            val cred = credentialManager.getCredential(hostContext, request).credential
            if (cred is CustomCredential && cred.type == TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                val token = GoogleIdTokenCredential.createFrom(cred.data).idToken
                FirebaseAuth.getInstance().signInWithCredential(GoogleAuthProvider.getCredential(token, null)).await()
                onAuthSuccess()
            } else {
                onAuthError("نوع اعتبارسنجی دریافت‌شده معتبر نیست.")
            }
        } catch (e: GetCredentialCancellationException) {
            val detail = e.errorMessage?.toString() ?: e.message
            Log.w(TAG, "Google Sign-In flow cancelled or dismissed: $detail", e)
            if (isConfigurationOrShaError(detail)) {
                onAuthError(context.getString(R.string.auth_error_sha1_mismatch))
            } else {
                onAuthCancelled()
            }
        } catch (e: NoCredentialException) {
            Log.w(TAG, "No Google account/credential available on device: ${e.message}", e)
            onAuthError("حساب گوگل معتبری روی این دستگاه یافت نشد. لطفاً ابتدا حساب گوگل خود را روی دستگاه فعال کنید.")
        } catch (e: GetCredentialException) {
            val detail = e.errorMessage?.toString() ?: e.localizedMessage ?: e.message
            Log.e(TAG, "Google Sign-In GetCredentialException (${e.type}): $detail", e)
            if (isConfigurationOrShaError(detail)) {
                onAuthError(context.getString(R.string.auth_error_sha1_mismatch))
            } else {
                onAuthError(detail ?: "خطا در ورود با حساب گوگل. لطفاً دوباره تلاش کنید.")
            }
        } catch (e: Exception) {
            val detail = e.localizedMessage ?: e.message
            Log.e(TAG, "Google Sign-In failed: $detail", e)
            if (isConfigurationOrShaError(detail)) {
                onAuthError(context.getString(R.string.auth_error_sha1_mismatch))
            } else {
                onAuthError(detail ?: "خطا در ورود با حساب گوگل. لطفاً دوباره تلاش کنید.")
            }
        }
    }
}

fun signOut(
    credentialManager: CredentialManager,
    scope: CoroutineScope,
    onSignOutComplete: () -> Unit = {}
) {
    scope.launch {
        withContext(NonCancellable) {
            try {
                credentialManager.clearCredentialState(ClearCredentialStateRequest())
            } catch (e: Exception) {
                Log.w(TAG, "Failed to clear credential state: ${e.message}")
            } finally {
                FirebaseAuth.getInstance().signOut()
                onSignOutComplete()
            }
        }
    }
}
