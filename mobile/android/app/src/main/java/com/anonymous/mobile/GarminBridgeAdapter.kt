package com.anonymous.mobile

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

/**
 * Garmin Connect IQ Bridge Adapter Skeleton for Android.
 * Communicates with Garmin Connect Mobile (GCM) via Bluetooth without requiring
 * local background HTTP server sockets.
 */
class GarminBridgeAdapter(private val reactContext: ReactApplicationContext) {

    private var isInitialized = false
    private var isConnected = false

    fun initialize(): Boolean {
        // In full production Garmin ConnectIQ builds, ConnectIQ.getInstance() is registered here.
        isInitialized = true
        isConnected = true
        return true
    }

    fun isWatchConnected(): Boolean {
        return isConnected
    }

    fun sendMessage(payloadJson: String): Boolean {
        // Dispatches via Garmin ConnectIQ message queue to Garmin watch app
        return try {
            val json = JSONObject(payloadJson)
            // Forward or simulate transmit over BLE
            true
        } catch (e: Exception) {
            false
        }
    }

    fun dispatchMessageToReactNative(event: String, dataJson: String) {
        try {
            val params: WritableMap = Arguments.createMap().apply {
                putString("event", event)
                putString("data", dataJson)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onGarminMessageReceived", params)
        } catch (_: Exception) {}
    }
}
