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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.unit.dp
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
import com.example.auth.onGoogleSignInClicked
import com.example.auth.signOut
import com.example.data.DojoCloudRepository
import com.example.ui.screens.AuthCardContent
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

private enum class PendingCloudRoute {
    MEAL_PLAN,
    PROGRESS
}

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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppNavigation() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }
    val auth = remember { FirebaseAuth.getInstance() }
    val currentUser by auth.authStateFlow().collectAsStateWithLifecycle(initialValue = auth.currentUser)

    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }

    val networkDisconnectedMsg = stringResource(R.string.error_network_disconnected)
    val networkRestoredMsg = stringResource(R.string.error_network_restored)
    val retryActionLabel = stringResource(R.string.action_retry)
    val googleSuccessMsg = stringResource(R.string.auth_portal_google_success)
    val googleCancelledMsg = stringResource(R.string.auth_portal_google_cancelled)

    var isCheckingAutoSignIn by remember { mutableStateOf(auth.currentUser == null) }
    var isGoogleSigningIn by remember { mutableStateOf(false) }
    var googleAuthError by remember { mutableStateOf<String?>(null) }
    var showAuthSheet by remember { mutableStateOf(false) }
    var pendingCloudRoute by remember { mutableStateOf<PendingCloudRoute?>(null) }
    var reloadSignal by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        if (auth.currentUser == null) {
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
    val geminiViewModel: GeminiUiViewModel? = if (user != null) {
        viewModel(
            key = user.uid,
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
                        currentUserId = user.uid,
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
    } else {
        null
    }

    val connectivityFlow = remember(context) { observeConnectivity(context.applicationContext) }
    val isConnected by connectivityFlow.collectAsStateWithLifecycle(
        initialValue = isCurrentlyConnected(context.applicationContext)
    )
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

    LaunchedEffect(user?.uid) {
        if (user != null) {
            isCheckingAutoSignIn = false
            googleAuthError = null
            showAuthSheet = false
            when (pendingCloudRoute) {
                PendingCloudRoute.MEAL_PLAN -> {
                    pendingCloudRoute = null
                    navController.navigate(MealPlanRoute) { launchSingleTop = true }
                }
                PendingCloudRoute.PROGRESS -> {
                    pendingCloudRoute = null
                    navController.navigate(ProgressDashboardRoute) { launchSingleTop = true }
                }
                null -> Unit
            }
        }
    }

    LaunchedEffect(geminiViewModel) {
        val vm = geminiViewModel ?: return@LaunchedEffect
        vm.errorEvents.collect { event ->
            snackbarHostState.currentSnackbarData?.dismiss()
            val result = snackbarHostState.showSnackbar(
                message = event.message,
                actionLabel = if (event.showRetry) retryActionLabel else null,
                duration = SnackbarDuration.Long
            )
            if (result == SnackbarResult.ActionPerformed && event.showRetry) {
                vm.retryLastRequest()
            }
        }
    }

    LaunchedEffect(geminiViewModel) {
        val vm = geminiViewModel ?: return@LaunchedEffect
        vm.infoEvents.collect { message ->
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Short
            )
        }
    }

    fun triggerPortalGoogleSignIn() {
        if (isGoogleSigningIn) return
        googleAuthError = null
        isGoogleSigningIn = true
        onGoogleSignInClicked(
            context = context,
            credentialManager = credentialManager,
            onAuthSuccess = {
                isGoogleSigningIn = false
                googleAuthError = null
                scope.launch {
                    snackbarHostState.currentSnackbarData?.dismiss()
                    snackbarHostState.showSnackbar(
                        message = googleSuccessMsg,
                        duration = SnackbarDuration.Short
                    )
                }
            },
            onAuthError = { msg ->
                isGoogleSigningIn = false
                googleAuthError = msg
                scope.launch {
                    snackbarHostState.currentSnackbarData?.dismiss()
                    snackbarHostState.showSnackbar(
                        message = msg,
                        duration = SnackbarDuration.Long
                    )
                }
            },
            scope = scope,
            onAuthCancelled = {
                isGoogleSigningIn = false
                googleAuthError = googleCancelledMsg
                scope.launch {
                    snackbarHostState.currentSnackbarData?.dismiss()
                    snackbarHostState.showSnackbar(
                        message = googleCancelledMsg,
                        duration = SnackbarDuration.Long
                    )
                }
            }
        )
    }

    fun handleSignOut() {
        pendingCloudRoute = null
        signOut(
            credentialManager = credentialManager,
            scope = scope,
            onSignOutComplete = {
                navController.popBackStack(PortalRoute, inclusive = false)
            }
        )
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
                        isGoogleSignedIn = user != null,
                        googleUserEmail = user?.email.orEmpty(),
                        isGoogleSigningIn = isGoogleSigningIn,
                        googleAuthError = googleAuthError,
                        onGoogleSignInClick = { triggerPortalGoogleSignIn() },
                        onOpenMealPlan = {
                            if (user != null) {
                                navController.navigate(MealPlanRoute) {
                                    launchSingleTop = true
                                }
                            } else {
                                pendingCloudRoute = PendingCloudRoute.MEAL_PLAN
                                showAuthSheet = true
                            }
                        },
                        onOpenProgressDashboard = {
                            if (user != null) {
                                navController.navigate(ProgressDashboardRoute) {
                                    launchSingleTop = true
                                }
                            } else {
                                pendingCloudRoute = PendingCloudRoute.PROGRESS
                                showAuthSheet = true
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
                    val vm = geminiViewModel
                    val activeUser = user
                    if (vm != null && activeUser != null) {
                        MealPlanScreen(
                            viewModel = vm,
                            userDisplayName = activeUser.displayName.orEmpty(),
                            userEmail = activeUser.email.orEmpty(),
                            onSignOut = { handleSignOut() },
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
                    } else {
                        LaunchedEffect(Unit) {
                            navController.popBackStack(PortalRoute, inclusive = false)
                        }
                    }
                }
                composable<ProgressDashboardRoute> {
                    val vm = geminiViewModel
                    val activeUser = user
                    if (vm != null && activeUser != null) {
                        ProgressDashboardScreen(
                            viewModel = vm,
                            userDisplayName = activeUser.displayName.orEmpty(),
                            userEmail = activeUser.email.orEmpty(),
                            onSignOut = { handleSignOut() },
                            onBack = { navController.popBackStack() }
                        )
                    } else {
                        LaunchedEffect(Unit) {
                            navController.popBackStack(PortalRoute, inclusive = false)
                        }
                    }
                }
            }
        }
    }

    if (showAuthSheet && user == null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = {
                showAuthSheet = false
                pendingCloudRoute = null
            },
            sheetState = sheetState,
            containerColor = Color(0xFFF4F4F5)
        ) {
            Box(
                modifier = Modifier
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
            ) {
                AuthCardContent(
                    isCheckingAutoSignIn = isCheckingAutoSignIn,
                    subtitle = stringResource(R.string.auth_portal_sheet_subtitle),
                    externalErrorMessage = googleAuthError,
                    onAuthSuccess = {
                        showAuthSheet = false
                    }
                )
            }
        }
    }
}
