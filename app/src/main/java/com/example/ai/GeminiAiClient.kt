package com.example.ai

import android.content.Context
import android.util.Log
import com.example.R
import com.example.util.isCurrentlyConnected
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.withTimeout
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

private const val TAG = "GeminiAiClient"
private const val DEFAULT_TIMEOUT_MS = 60_000L

sealed interface AiResponseState {
    data object Idle : AiResponseState
    data object Loading : AiResponseState
    data class Streaming(val text: String) : AiResponseState
    data class Success(val text: String) : AiResponseState
    data class Error(val message: String) : AiResponseState
}

class GeminiAiClient(
    private val context: Context,
    modelName: String = "gemini-3.8-flash"
) {
    private val appContext = context.applicationContext

    private val model by lazy {
        Firebase.ai.generativeModel(modelName)
    }

    suspend fun generateText(prompt: String): AiResponseState {
        if (!isCurrentlyConnected(appContext)) {
            return AiResponseState.Error(appContext.getString(R.string.error_gemini_offline))
        }
        return try {
            val response = withTimeout(DEFAULT_TIMEOUT_MS) {
                model.generateContent(prompt)
            }
            val text = response.text
            if (!text.isNullOrBlank()) {
                AiResponseState.Success(text)
            } else {
                AiResponseState.Error(appContext.getString(R.string.error_gemini_generic))
            }
        } catch (e: TimeoutCancellationException) {
            Log.e(TAG, "Generation timed out", e)
            AiResponseState.Error(appContext.getString(R.string.error_gemini_timeout))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Firebase AI generation failed", e)
            AiResponseState.Error(toUserFriendlyMessage(e))
        }
    }

    fun streamText(prompt: String): Flow<AiResponseState> = flow {
        if (!isCurrentlyConnected(appContext)) {
            emit(AiResponseState.Error(appContext.getString(R.string.error_gemini_offline)))
            return@flow
        }
        emit(AiResponseState.Loading)
        val accumulated = StringBuilder()
        withTimeout(DEFAULT_TIMEOUT_MS) {
            model.generateContentStream(prompt).collect { chunk ->
                val chunkText = chunk.text.orEmpty()
                if (chunkText.isNotEmpty()) {
                    accumulated.append(chunkText)
                    emit(AiResponseState.Streaming(accumulated.toString()))
                }
            }
        }
        if (accumulated.isNotBlank()) {
            emit(AiResponseState.Success(accumulated.toString()))
        } else {
            emit(AiResponseState.Error(appContext.getString(R.string.error_gemini_generic)))
        }
    }.catch { e ->
        when (e) {
            is CancellationException -> throw e
            is TimeoutCancellationException -> {
                Log.e(TAG, "Streaming timed out", e)
                emit(AiResponseState.Error(appContext.getString(R.string.error_gemini_timeout)))
            }
            else -> {
                Log.e(TAG, "Streaming generation failed", e)
                emit(AiResponseState.Error(toUserFriendlyMessage(e)))
            }
        }
    }

    private fun toUserFriendlyMessage(error: Throwable): String {
        if (!isCurrentlyConnected(appContext)) {
            return appContext.getString(R.string.error_gemini_offline)
        }
        val msg = error.message?.lowercase().orEmpty()
        val cause = error.cause
        return when {
            error is UnknownHostException ||
                error is ConnectException ||
                cause is UnknownHostException ||
                cause is ConnectException ||
                msg.contains("unable to resolve host") ||
                msg.contains("network") -> {
                appContext.getString(R.string.error_gemini_offline)
            }
            error is SocketTimeoutException ||
                cause is SocketTimeoutException ||
                msg.contains("timeout") -> {
                appContext.getString(R.string.error_gemini_timeout)
            }
            msg.contains("429") || msg.contains("quota") || msg.contains("resource_exhausted") -> {
                appContext.getString(R.string.error_gemini_quota)
            }
            msg.contains("403") ||
                msg.contains("app check") ||
                msg.contains("unavailable") ||
                msg.contains("503") ||
                error is IOException -> {
                appContext.getString(R.string.error_gemini_unavailable)
            }
            else -> appContext.getString(R.string.error_gemini_generic)
        }
    }
}
