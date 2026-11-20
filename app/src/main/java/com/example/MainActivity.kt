package com.example

import android.graphics.Color as AndroidColor
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import androidx.credentials.CredentialManager
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.ai.GeminiAiClient
import com.example.ai.GeminiUiViewModel
import com.example.ai.configureAppCheck
import com.example.auth.attemptAutoSignIn
import com.example.auth.authStateFlow
import com.example.auth.signOut
import com.example.data.DojoCloudRepository
import com.example.ui.screens.AuthScreen
import com.example.ui.screens.DojoPortalScreen
import com.example.ui.screens.MealPlanScreen
import com.example.ui.screens.ProgressDashboardScreen
import com.example.ui.theme.ArslanDojoTheme
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoInk
import com.example.util.isCurrentlyConnected
import com.example.util.observeConnectivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
object PortalRoute

@Serializable
object MealPlanRoute

@Serializable
object ProgressDashboardRoute

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureAppCheck(this, intent)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT)
        )
        setContent {
            ArslanDojoTheme {
                AppNavigation()
            }
        }
    }
}

@Composable
private fun AppNavigation() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }
    val auth = remember { FirebaseAuth.getInstance() }
    val currentUser by auth.authStateFlow().collectAsStateWithLifecycle(initialValue = auth.currentUser)

    var isCheckingAutoSignIn by remember { mutableStateOf(auth.currentUser == null) }

    LaunchedEffect(currentUser) {
        if (currentUser == null) {
            isCheckingAutoSignIn = true
            attemptAutoSignIn(
                context = context,
                credentialManager = credentialManager,
                onAuthSuccess = { isCheckingAutoSignIn = false },
                onUnauthenticated = { isCheckingAutoSignIn = false },
                scope = scope
            )
        } else {
            isCheckingAutoSignIn = false
        }
    }

    val user = currentUser
    if (user == null) {
        AuthScreen(
            isCheckingAutoSignIn = isCheckingAutoSignIn,
            onAuthSuccess = { isCheckingAutoSignIn = false }
        )
    } else {
        key(user.uid) {
            AuthenticatedAppShell(
                currentUserId = user.uid,
                userDisplayName = user.displayName.orEmpty(),
                userEmail = user.email.orEmpty(),
                onSignOut = {
                    signOut(
                        credentialManager = credentialManager,
                        scope = scope
                    )
                }
            )
        }
    }
}

@Composable
private fun AuthenticatedAppShell(
    currentUserId: String,
    userDisplayName: String,
    userEmail: String,
    onSignOut: () -> Unit
) {
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val networkDisconnectedMsg = stringResource(R.string.error_network_disconnected)
    val networkRestoredMsg = stringResource(R.string.error_network_restored)
    val retryActionLabel = stringResource(R.string.action_retry)

    val geminiViewModel: GeminiUiViewModel = viewModel(
        key = currentUserId,
        factory = viewModelFactory {
            initializer {
                val app = checkNotNull(this[APPLICATION_KEY]) {
                    "APPLICATION_KEY missing from CreationExtras"
                }
                val databaseId = app.getString(R.string.firestore_database_id)
                val db = FirebaseFirestore.getInstance(databaseId)
                GeminiUiViewModel(
                    aiClient = GeminiAiClient(app),
                    cloudRepository = DojoCloudRepository(db = db),
                    currentUserId = currentUserId,
                    connectivityFlow = observeConnectivity(app),
                    initialConnected = isCurrentlyConnected(app),
                    savedSuccessMessage = app.getString(R.string.cloud_saved_success),
                    saveWarningMessage = app.getString(R.string.cloud_save_warning),
                    cloudLoadErrorMessage = app.getString(R.string.error_server_connection),
                    progressSavedMessage = app.getString(R.string.progress_saved_success),
                    progressSaveErrorMessage = app.getString(R.string.progress_save_error)
                )
            }
        }
    )

    val isConnected by geminiViewModel.isConnected.collectAsStateWithLifecycle()

    var reloadSignal by remember { mutableIntStateOf(0) }
    var previousConnected by remember { mutableStateOf<Boolean?>(null) }

    LaunchedEffect(isConnected) {
        val prev = previousConnected
        previousConnected = isConnected
        if (!isConnected && (prev == null || prev == true)) {
            snackbarHostState.currentSnackbarData?.dismiss()
            val result = snackbarHostState.showSnackbar(
                message = networkDisconnectedMsg,
                actionLabel = retryActionLabel,
                duration = SnackbarDuration.Long
            )
            if (result == SnackbarResult.ActionPerformed) {
                reloadSignal++
            }
        } else if (prev == false && isConnected) {
            snackbarHostState.currentSnackbarData?.dismiss()
            reloadSignal++
            snackbarHostState.showSnackbar(
                message = networkRestoredMsg,
                duration = SnackbarDuration.Short
            )
        }
    }

    LaunchedEffect(geminiViewModel) {
        geminiViewModel.errorEvents.collect { event ->
            snackbarHostState.currentSnackbarData?.dismiss()
            val result = snackbarHostState.showSnackbar(
                message = event.message,
                actionLabel = if (event.showRetry) retryActionLabel else null,
                duration = SnackbarDuration.Long
            )
            if (result == SnackbarResult.ActionPerformed && event.showRetry) {
                geminiViewModel.retryLastRequest()
            }
        }
    }

    LaunchedEffect(geminiViewModel) {
        geminiViewModel.infoEvents.collect { message ->
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Short
            )
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        contentWindowInsets = WindowInsets(0),
        snackbarHost = {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                SnackbarHost(
                    hostState = snackbarHostState,
                    modifier = Modifier
                        .navigationBarsPadding()
                        .imePadding()
                        .testTag("error_snackbar")
                ) { data ->
                    Snackbar(
                        snackbarData = data,
                        containerColor = DojoInk,
                        contentColor = Color.White,
                        actionColor = DojoGold
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            NavHost(
                navController = navController,
                startDestination = PortalRoute
            ) {
                composable<PortalRoute> {
                    DojoPortalScreen(
                        reloadSignal = reloadSignal,
                        onOpenMealPlan = {
                            navController.navigate(MealPlanRoute) {
                                launchSingleTop = true
                            }
                        },
                        onOpenProgressDashboard = {
                            navController.navigate(ProgressDashboardRoute) {
                                launchSingleTop = true
                            }
                        },
                        onToast = { message ->
                            scope.launch {
                                snackbarHostState.currentSnackbarData?.dismiss()
                                snackbarHostState.showSnackbar(
                                    message = message,
                                    duration = SnackbarDuration.Long
                                )
                            }
                        }
                    )
                }
                composable<MealPlanRoute> {
                    MealPlanScreen(
                        viewModel = geminiViewModel,
                        userDisplayName = userDisplayName,
                        userEmail = userEmail,
                        onSignOut = onSignOut,
                        onBack = { navController.popBackStack() },
                        onShowMessage = { message ->
                            scope.launch {
                                snackbarHostState.currentSnackbarData?.dismiss()
                                snackbarHostState.showSnackbar(
                                    message = message,
                                    duration = SnackbarDuration.Short
                                )
                            }
                        }
                    )
                }
                composable<ProgressDashboardRoute> {
                    ProgressDashboardScreen(
                        viewModel = geminiViewModel,
                        userDisplayName = userDisplayName,
                        userEmail = userEmail,
                        onSignOut = onSignOut,
                        onBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}
