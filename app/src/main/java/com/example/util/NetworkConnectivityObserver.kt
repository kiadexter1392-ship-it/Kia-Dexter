package com.example.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

private fun NetworkCapabilities.hasUsableInternet(): Boolean {
    val hasInternet = hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    val notSuspended = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_SUSPENDED)
    } else {
        true
    }
    return hasInternet && notSuspended
}

fun isCurrentlyConnected(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        ?: return false
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasUsableInternet()
}

fun observeConnectivity(context: Context): Flow<Boolean> = callbackFlow {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    if (cm == null) {
        trySend(false)
        close()
        return@callbackFlow
    }

    val activeNetworks = mutableSetOf<Network>()

    fun emitCurrent() {
        trySend(activeNetworks.isNotEmpty() || isCurrentlyConnected(context))
    }

    val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            val caps = cm.getNetworkCapabilities(network)
            if (caps?.hasUsableInternet() == true) {
                activeNetworks.add(network)
                emitCurrent()
            }
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
            if (networkCapabilities.hasUsableInternet()) {
                activeNetworks.add(network)
            } else {
                activeNetworks.remove(network)
            }
            trySend(activeNetworks.isNotEmpty() || isCurrentlyConnected(context))
        }

        override fun onLost(network: Network) {
            activeNetworks.remove(network)
            trySend(activeNetworks.isNotEmpty() || isCurrentlyConnected(context))
        }

        override fun onUnavailable() {
            trySend(false)
        }
    }

    trySend(isCurrentlyConnected(context))
    cm.registerDefaultNetworkCallback(callback)

    awaitClose {
        runCatching { cm.unregisterNetworkCallback(callback) }
    }
}.distinctUntilChanged()
