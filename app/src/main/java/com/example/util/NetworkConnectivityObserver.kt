package com.example.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

fun isCurrentlyConnected(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        ?: return false
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
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
            if (caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true) {
                activeNetworks.add(network)
                emitCurrent()
            }
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
            val hasInternet =
                networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            if (hasInternet) {
                activeNetworks.add(network)
            } else {
                activeNetworks.remove(network)
            }
            trySend(activeNetworks.isNotEmpty())
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
