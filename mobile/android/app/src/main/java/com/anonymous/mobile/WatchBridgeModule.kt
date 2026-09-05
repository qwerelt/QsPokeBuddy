package com.anonymous.mobile

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap

/**
 * Authoritative Android Watch Bridge HTTP API Module.
 * Hosts a lightweight loopback API on 127.0.0.1:8088 to serve as Boundary A
 * between the Android Authoritative Game Engine and the Zepp Side Service.
 */
class WatchBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val serverScope = CoroutineScope(Dispatchers.IO)
    private var serverJob: Job? = null
    private var serverSocket: ServerSocket? = null
    private var isRunning = false
    private var currentPort = 8088

    private val garminAdapter = GarminBridgeAdapter(reactContext)

    @Volatile
    private var currentStateVersion: Long = 100

    @Volatile
    private var authoritativeStateJson: String = "{}"

    // Thread-safe cache of processed operation IDs for idempotency
    private val processedOperationIds = Collections.newSetFromMap(ConcurrentHashMap<String, Boolean>())

    override fun getName(): String = "WatchBridge"

    @ReactMethod
    fun startServer(port: Int, initialStateJson: String, stateVersion: Double, promise: Promise) {
        val targetPort = if (port > 0) port else 8088
        if (initialStateJson.isNotEmpty()) {
            this.authoritativeStateJson = initialStateJson
        }
        if (stateVersion > 0) {
            this.currentStateVersion = stateVersion.toLong()
        }

        if (isRunning && serverSocket != null && !serverSocket!!.isClosed && currentPort == targetPort) {
            promise.resolve(true)
            return
        }

        stopInternalServer()
        currentPort = targetPort

        serverJob = serverScope.launch {
            try {
                // Strictly bind to 127.0.0.1 loopback for secure local phone IPC
                serverSocket = ServerSocket(currentPort, 50, InetAddress.getByName("127.0.0.1"))
                isRunning = true
                println("[ANDROID_API] Server started on 127.0.0.1:$currentPort (StateVersion=$currentStateVersion)")

                launch(Dispatchers.Main) {
                    promise.resolve(true)
                }

                while (isRunning && serverSocket != null && !serverSocket!!.isClosed) {
                    try {
                        val clientSocket = serverSocket!!.accept()
                        serverScope.launch {
                            handleClient(clientSocket)
                        }
                    } catch (e: Exception) {
                        if (!isRunning) break
                    }
                }
            } catch (e: Exception) {
                isRunning = false
                println("[ANDROID_API] Failed to start server: ${e.message}")
                launch(Dispatchers.Main) {
                    promise.reject("ERR_SERVER_START", e.message)
                }
            }
        }
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        stopInternalServer()
        promise.resolve(true)
    }

    private fun stopInternalServer() {
        isRunning = false
        try {
            serverSocket?.close()
        } catch (_: Exception) {}
        serverSocket = null
        serverJob?.cancel()
        serverJob = null
    }

    @ReactMethod
    fun updateAuthoritativeState(stateJson: String, stateVersion: Double, promise: Promise) {
        if (stateJson.isNotEmpty()) {
            this.authoritativeStateJson = stateJson
        }
        if (stateVersion > 0) {
            this.currentStateVersion = stateVersion.toLong()
        }
        println("[ANDROID_API] Updated Authoritative State (Version=$currentStateVersion)")
        promise.resolve(true)
    }

    @ReactMethod
    fun isServerRunning(promise: Promise) {
        val active = isRunning && serverSocket != null && !serverSocket!!.isClosed
        promise.resolve(active)
    }

    @ReactMethod
    fun getServerStatus(promise: Promise) {
        val active = isRunning && serverSocket != null && !serverSocket!!.isClosed
        val map: WritableMap = Arguments.createMap().apply {
            putBoolean("isRunning", active)
            putInt("port", currentPort)
            putString("host", "127.0.0.1")
            putString("url", "http://127.0.0.1:$currentPort")
            putDouble("stateVersion", currentStateVersion.toDouble())
            putInt("processedOperationsCount", processedOperationIds.size)
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun sendToGarmin(payloadJson: String, promise: Promise) {
        val success = garminAdapter.sendMessage(payloadJson)
        promise.resolve(success)
    }

    @ReactMethod
    fun isGarminConnected(promise: Promise) {
        promise.resolve(garminAdapter.isWatchConnected())
    }

    @ReactMethod
    fun initGarminSdk(promise: Promise) {
        val success = garminAdapter.initialize()
        promise.resolve(success)
    }

    private fun handleClient(socket: Socket) {
        try {
            socket.soTimeout = 10000
            val reader = BufferedReader(InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))
            val output: OutputStream = socket.getOutputStream()

            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) {
                socket.close()
                return
            }

            val method = parts[0].uppercase()
            val uri = parts[1]
            val path = if (uri.contains("?")) uri.substringBefore("?") else uri
            val query = if (uri.contains("?")) uri.substringAfter("?") else ""

            // Parse Headers
            var contentLength = 0
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                if (line.isNullOrEmpty()) break
                val header = line!!
                if (header.lowercase().startsWith("content-length:")) {
                    contentLength = header.substringAfter(":").trim().toIntOrNull() ?: 0
                }
            }

            // Handle CORS Preflight
            if (method == "OPTIONS") {
                sendHttpResponse(output, 200, "OK", "text/plain", "")
                socket.close()
                return
            }

            when {
                // 1. GET /api/v1/health
                method == "GET" && (path == "/api/v1/health" || path == "/health" || path == "/api/status") -> {
                    val healthObj = JSONObject().apply {
                        put("protocolVersion", 1)
                        put("ok", true)
                        put("type", "HEALTH")
                        put("payload", JSONObject().apply {
                            put("status", "READY")
                            put("stateVersion", currentStateVersion)
                            put("timestamp", System.currentTimeMillis())
                        })
                    }
                    sendHttpResponse(output, 200, "OK", "application/json", healthObj.toString())
                }

                // 2. GET /api/v1/state
                method == "GET" && (path == "/api/v1/state" || path == "/api/active-pokemon") -> {
                    val stateObj = JSONObject().apply {
                        put("protocolVersion", 1)
                        put("ok", true)
                        put("type", "STATE")
                        put("payload", JSONObject().apply {
                            put("stateVersion", currentStateVersion)
                            put("timestamp", System.currentTimeMillis())
                            try {
                                val parsed = JSONObject(authoritativeStateJson)
                                put("state", parsed)
                            } catch (_: Exception) {
                                put("state", JSONObject())
                            }
                        })
                    }
                    sendHttpResponse(output, 200, "OK", "application/json", stateObj.toString())
                }

                // 3. GET /api/v1/sync?sinceVersion=N
                method == "GET" && path == "/api/v1/sync" -> {
                    val sinceVersion = query.split("&")
                        .find { it.startsWith("sinceVersion=") }
                        ?.substringAfter("sinceVersion=")
                        ?.toLongOrNull() ?: -1

                    val changed = sinceVersion != currentStateVersion
                    val syncObj = JSONObject().apply {
                        put("protocolVersion", 1)
                        put("ok", true)
                        put("type", "SYNC")
                        put("payload", JSONObject().apply {
                            put("changed", changed)
                            put("stateVersion", currentStateVersion)
                            if (changed) {
                                try {
                                    put("state", JSONObject(authoritativeStateJson))
                                } catch (_: Exception) {
                                    put("state", JSONObject())
                                }
                            }
                        })
                    }
                    sendHttpResponse(output, 200, "OK", "application/json", syncObj.toString())
                }

                // 4. POST /api/v1/watch/operations
                method == "POST" && (path == "/api/v1/watch/operations" || path == "/api/sync-ledger" || path == "/api/task-complete" || path == "/api/water-log") -> {
                    val bodyString = readBody(reader, contentLength)
                    var requestId = "req_" + System.currentTimeMillis()
                    var operationId = "op_" + System.currentTimeMillis()
                    var opType = "GENERIC_OPERATION"
                    var isDuplicate = false

                    try {
                        val bodyJson = JSONObject(bodyString)
                        requestId = bodyJson.optString("requestId", requestId)
                        operationId = bodyJson.optString("operationId", bodyJson.optString("batch_id", operationId))
                        opType = bodyJson.optString("type", opType)

                        if (processedOperationIds.contains(operationId)) {
                            isDuplicate = true
                            println("[ANDROID_API] Duplicate operation detected (idempotent ignore): $operationId")
                        } else {
                            processedOperationIds.add(operationId)
                            if (processedOperationIds.size > 500) {
                                val first = processedOperationIds.iterator().next()
                                processedOperationIds.remove(first)
                            }
                            // Increment state version for authoritative mutation
                            currentStateVersion++
                            println("[ANDROID_API] Applied Operation [$opType] operationId=$operationId -> New StateVersion=$currentStateVersion")
                            emitEventToJS("onWatchOperationReceived", bodyString)
                        }
                    } catch (e: Exception) {
                        println("[ANDROID_API] Error processing operation body: ${e.message}")
                    }

                    val resObj = JSONObject().apply {
                        put("protocolVersion", 1)
                        put("requestId", requestId)
                        put("ok", true)
                        put("type", "OPERATION_ACK")
                        put("payload", JSONObject().apply {
                            put("operationId", operationId)
                            put("isDuplicate", isDuplicate)
                            put("committed", true)
                            put("stateVersion", currentStateVersion)
                            put("timestamp", System.currentTimeMillis())
                            try {
                                put("state", JSONObject(authoritativeStateJson))
                            } catch (_: Exception) {}
                        })
                    }

                    sendHttpResponse(output, 200, "OK", "application/json", resObj.toString())
                }

                else -> {
                    val notFound = JSONObject().apply {
                        put("protocolVersion", 1)
                        put("ok", false)
                        put("error", JSONObject().apply {
                            put("code", "NOT_FOUND")
                            put("message", "Endpoint not found: $path")
                        })
                    }.toString()
                    sendHttpResponse(output, 404, "Not Found", "application/json", notFound)
                }
            }

            socket.close()
        } catch (_: Exception) {
            try {
                socket.close()
            } catch (_: Exception) {}
        }
    }

    private fun readBody(reader: BufferedReader, contentLength: Int): String {
        if (contentLength <= 0) return ""
        val bodyBuilder = CharArray(contentLength)
        var read = 0
        while (read < contentLength) {
            val r = reader.read(bodyBuilder, read, contentLength - read)
            if (r == -1) break
            read += r
        }
        return String(bodyBuilder, 0, read)
    }

    private fun sendHttpResponse(out: OutputStream, code: Int, statusText: String, contentType: String, body: String) {
        val bodyBytes = body.toByteArray(StandardCharsets.UTF_8)
        val headers = "HTTP/1.1 $code $statusText\r\n" +
                "Content-Type: $contentType; charset=utf-8\r\n" +
                "Content-Length: ${bodyBytes.size}\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type, Authorization\r\n" +
                "Connection: close\r\n\r\n"

        out.write(headers.toByteArray(StandardCharsets.UTF_8))
        if (bodyBytes.isNotEmpty()) {
            out.write(bodyBytes)
        }
        out.flush()
    }

    private fun emitEventToJS(eventName: String, paramsJson: String) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, paramsJson)
        } catch (_: Exception) {}
    }
}
