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
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.ai.GeminiUiViewModel
import com.example.ai.configureAppCheck
import com.example.ui.screens.DojoPortalScreen
import com.example.ui.theme.ArslanDojoTheme
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoInk
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
object PortalRoute

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
                val context = LocalContext.current
                val navController = rememberNavController()
                val snackbarHostState = remember { SnackbarHostState() }
                val scope = rememberCoroutineScope()
                val geminiViewModel: GeminiUiViewModel = viewModel()
                val isConnected by geminiViewModel.isConnected.collectAsStateWithLifecycle()

                var reloadSignal by remember { mutableIntStateOf(0) }
                var previousConnected by remember { mutableStateOf<Boolean?>(null) }

                LaunchedEffect(isConnected) {
                    val prev = previousConnected
                    previousConnected = isConnected
                    if (!isConnected && (prev == null || prev == true)) {
                        snackbarHostState.currentSnackbarData?.dismiss()
                        val result = snackbarHostState.showSnackbar(
                            message = context.getString(R.string.error_network_disconnected),
                            actionLabel = context.getString(R.string.action_retry),
                            duration = SnackbarDuration.Long
                        )
                        if (result == SnackbarResult.ActionPerformed) {
                            reloadSignal++
                        }
                    } else if (prev == false && isConnected) {
                        snackbarHostState.currentSnackbarData?.dismiss()
                        reloadSignal++
                        snackbarHostState.showSnackbar(
                            message = context.getString(R.string.error_network_restored),
                            duration = SnackbarDuration.Short
                        )
                    }
                }

                LaunchedEffect(geminiViewModel) {
                    geminiViewModel.errorEvents.collect { event ->
                        snackbarHostState.currentSnackbarData?.dismiss()
                        val result = snackbarHostState.showSnackbar(
                            message = event.message,
                            actionLabel = if (event.showRetry) context.getString(R.string.action_retry) else null,
                            duration = SnackbarDuration.Long
                        )
                        if (result == SnackbarResult.ActionPerformed && event.showRetry) {
                            geminiViewModel.retryLastRequest()
                        }
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
                        }
                    }
                }
            }
        }
    }
}
