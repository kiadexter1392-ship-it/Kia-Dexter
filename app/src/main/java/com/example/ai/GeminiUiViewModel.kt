package com.example.ai

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.util.isCurrentlyConnected
import com.example.util.observeConnectivity
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class UiErrorBanner(
    val message: String,
    val showRetry: Boolean = false
)

class GeminiUiViewModel(application: Application) : AndroidViewModel(application) {

    private val aiClient = GeminiAiClient(application)

    private val _uiState = MutableStateFlow<AiResponseState>(AiResponseState.Idle)
    val uiState: StateFlow<AiResponseState> = _uiState.asStateFlow()

    private val _errorEvents = MutableSharedFlow<UiErrorBanner>(extraBufferCapacity = 4)
    val errorEvents: SharedFlow<UiErrorBanner> = _errorEvents.asSharedFlow()

    val isConnected: StateFlow<Boolean> = observeConnectivity(application)
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000L),
            initialValue = isCurrentlyConnected(application)
        )

    private var lastPrompt: String? = null
    private var lastWasStream: Boolean = false

    fun generateContent(prompt: String) {
        lastPrompt = prompt
        lastWasStream = false
        viewModelScope.launch {
            _uiState.value = AiResponseState.Loading
            val result = aiClient.generateText(prompt)
            _uiState.value = result
            if (result is AiResponseState.Error) {
                _errorEvents.tryEmit(UiErrorBanner(result.message, showRetry = true))
            }
        }
    }

    fun streamContent(prompt: String) {
        lastPrompt = prompt
        lastWasStream = true
        viewModelScope.launch {
            aiClient.streamText(prompt).collect { state ->
                _uiState.value = state
                if (state is AiResponseState.Error) {
                    _errorEvents.tryEmit(UiErrorBanner(state.message, showRetry = true))
                }
            }
        }
    }

    fun retryLastRequest() {
        val prompt = lastPrompt ?: return
        if (lastWasStream) {
            streamContent(prompt)
        } else {
            generateContent(prompt)
        }
    }

    fun postError(message: String, showRetry: Boolean = false) {
        _errorEvents.tryEmit(UiErrorBanner(message, showRetry))
    }
}
