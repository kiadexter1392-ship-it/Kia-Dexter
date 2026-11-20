package com.example.ai

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.DojoCloudRepository
import com.example.data.NewProgressLogRequest
import com.example.data.SavedMealPlanDoc
import com.example.data.UserProfileDoc
import com.example.data.WorkoutProgressLogDoc
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class UiErrorBanner(
    val message: String,
    val showRetry: Boolean = false
)

sealed interface CloudProfileUiState {
    data object Loading : CloudProfileUiState
    data class Success(val profile: UserProfileDoc?) : CloudProfileUiState
    data class Error(val message: String) : CloudProfileUiState
}

sealed interface SavedPlansUiState {
    data object Loading : SavedPlansUiState
    data class Success(val plans: List<SavedMealPlanDoc>) : SavedPlansUiState
    data class Error(val message: String) : SavedPlansUiState
}

sealed interface ProgressLogsUiState {
    data object Loading : ProgressLogsUiState
    data class Success(val logs: List<WorkoutProgressLogDoc>) : ProgressLogsUiState
    data class Error(val message: String) : ProgressLogsUiState
}

private enum class LastRequestType {
    TEXT,
    STREAM,
    MEAL_PLAN
}

class GeminiUiViewModel(
    private val aiClient: GeminiAiClient,
    private val cloudRepository: DojoCloudRepository,
    private val currentUserId: String,
    connectivityFlow: Flow<Boolean>,
    initialConnected: Boolean,
    private val savedSuccessMessage: String,
    private val saveWarningMessage: String,
    private val cloudLoadErrorMessage: String,
    private val progressSavedMessage: String,
    private val progressSaveErrorMessage: String
) : ViewModel() {

    private val _uiState = MutableStateFlow<AiResponseState>(AiResponseState.Idle)
    val uiState: StateFlow<AiResponseState> = _uiState.asStateFlow()

    private val _mealPlanState = MutableStateFlow<MealPlanUiState>(MealPlanUiState.Idle)
    val mealPlanState: StateFlow<MealPlanUiState> = _mealPlanState.asStateFlow()

    private val _isSavingProgress = MutableStateFlow(false)
    val isSavingProgress: StateFlow<Boolean> = _isSavingProgress.asStateFlow()

    private val _errorEvents = MutableSharedFlow<UiErrorBanner>(extraBufferCapacity = 4)
    val errorEvents: SharedFlow<UiErrorBanner> = _errorEvents.asSharedFlow()

    private val _infoEvents = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val infoEvents: SharedFlow<String> = _infoEvents.asSharedFlow()

    val isConnected: StateFlow<Boolean> = connectivityFlow
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = initialConnected
        )

    val userProfileState: StateFlow<CloudProfileUiState> = cloudRepository
        .observeUserProfile(currentUserId)
        .map<UserProfileDoc?, CloudProfileUiState> { CloudProfileUiState.Success(it) }
        .catch { error ->
            val firestoreError = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (firestoreError == null && error is CancellationException) throw error
            val rootError = firestoreError ?: error
            Log.w(TAG, "Error observing user profile", rootError)
            emit(CloudProfileUiState.Error(cloudLoadErrorMessage))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = CloudProfileUiState.Loading
        )

    val savedPlansState: StateFlow<SavedPlansUiState> = cloudRepository
        .observeMealPlans(currentUserId)
        .map<List<SavedMealPlanDoc>, SavedPlansUiState> { SavedPlansUiState.Success(it) }
        .catch { error ->
            val firestoreError = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (firestoreError == null && error is CancellationException) throw error
            val rootError = firestoreError ?: error
            Log.w(TAG, "Error observing saved meal plans", rootError)
            emit(SavedPlansUiState.Error(cloudLoadErrorMessage))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = SavedPlansUiState.Loading
        )

    val progressLogsState: StateFlow<ProgressLogsUiState> = cloudRepository
        .observeProgressLogs(currentUserId)
        .map<List<WorkoutProgressLogDoc>, ProgressLogsUiState> { ProgressLogsUiState.Success(it) }
        .catch { error ->
            val firestoreError = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (firestoreError == null && error is CancellationException) throw error
            val rootError = firestoreError ?: error
            Log.w(TAG, "Error observing progress logs", rootError)
            emit(ProgressLogsUiState.Error(cloudLoadErrorMessage))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = ProgressLogsUiState.Loading
        )

    private var lastPrompt: String? = null
    private var lastMealPlanRequest: MealPlanRequest? = null
    private var lastRequestType: LastRequestType? = null

    init {
        syncUserIdentity()
    }

    private fun syncUserIdentity() {
        val currentUser = FirebaseAuth.getInstance().currentUser ?: return
        if (currentUser.uid != currentUserId) return
        viewModelScope.launch {
            cloudRepository.syncSignedInUserProfile(currentUser)
        }
    }

    fun generateContent(prompt: String) {
        lastPrompt = prompt
        lastRequestType = LastRequestType.TEXT
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
        lastRequestType = LastRequestType.STREAM
        viewModelScope.launch {
            aiClient.streamText(prompt).collect { state ->
                _uiState.value = state
                if (state is AiResponseState.Error) {
                    _errorEvents.tryEmit(UiErrorBanner(state.message, showRetry = true))
                }
            }
        }
    }

    fun generateMealPlan(request: MealPlanRequest) {
        lastMealPlanRequest = request
        lastRequestType = LastRequestType.MEAL_PLAN
        viewModelScope.launch {
            _mealPlanState.value = MealPlanUiState.Loading
            // Persist dietary preferences on server immediately so nothing is lost
            cloudRepository.saveDietaryPreferences(currentUserId, request)

            val result = aiClient.generateMealPlan(request)
            _mealPlanState.value = result
            when (result) {
                is MealPlanUiState.Success -> {
                    val saveResult = cloudRepository.saveMealPlan(
                        userId = currentUserId,
                        request = request,
                        plan = result.plan
                    )
                    if (saveResult.isSuccess) {
                        _infoEvents.tryEmit(savedSuccessMessage)
                    } else {
                        _infoEvents.tryEmit(saveWarningMessage)
                    }
                }
                is MealPlanUiState.Error -> {
                    _errorEvents.tryEmit(UiErrorBanner(result.message, showRetry = true))
                }
                else -> Unit
            }
        }
    }

    fun selectSavedMealPlan(savedPlan: SavedMealPlanDoc) {
        _mealPlanState.value = MealPlanUiState.Success(savedPlan.toDomainMealPlanResult())
    }

    fun resetMealPlan() {
        _mealPlanState.value = MealPlanUiState.Idle
    }

    fun retryLastRequest() {
        when (lastRequestType) {
            LastRequestType.TEXT -> lastPrompt?.let { generateContent(it) }
            LastRequestType.STREAM -> lastPrompt?.let { streamContent(it) }
            LastRequestType.MEAL_PLAN -> lastMealPlanRequest?.let { generateMealPlan(it) }
            null -> Unit
        }
    }

    fun postError(message: String, showRetry: Boolean = false) {
        _errorEvents.tryEmit(UiErrorBanner(message, showRetry))
    }

    fun logWorkoutProgress(
        request: NewProgressLogRequest,
        onSaved: () -> Unit = {}
    ) {
        if (_isSavingProgress.value) return
        viewModelScope.launch {
            _isSavingProgress.value = true
            val result = cloudRepository.saveProgressLog(currentUserId, request)
            _isSavingProgress.value = false
            if (result.isSuccess) {
                _infoEvents.tryEmit(progressSavedMessage)
                onSaved()
            } else {
                _errorEvents.tryEmit(UiErrorBanner(progressSaveErrorMessage, showRetry = false))
            }
        }
    }

    private companion object {
        const val TAG = "GeminiUiVM"
        const val STOP_TIMEOUT_MILLIS = 5_000L
    }
}
