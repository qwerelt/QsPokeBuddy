package com.anonymous.mobile

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

class HealthConnectModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), SensorEventListener {

    private val moduleScope = CoroutineScope(Dispatchers.IO)
    private var sensorManager: SensorManager? = null
    private var lastHardwareSteps: Long = 0

    init {
        try {
            sensorManager = reactContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            val stepSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            if (stepSensor != null) {
                sensorManager?.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI)
            }
        } catch (e: Exception) {
            // Sensor not available
        }
    }

    override fun getName(): String = "HealthConnectBridge"

    private val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class)
    )

    @ReactMethod
    fun checkAvailability(promise: Promise) {
        try {
            val status = HealthConnectClient.getSdkStatus(reactContext)
            when (status) {
                HealthConnectClient.SDK_AVAILABLE -> promise.resolve("Available")
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> promise.resolve("UpdateRequired")
                else -> promise.resolve("NotSupported")
            }
        } catch (e: Exception) {
            promise.resolve("NotSupported")
        }
    }

    @ReactMethod
    fun openHealthConnectSettings(promise: Promise) {
        try {
            val intent = Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS").apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                // Fallback to app settings
                val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", reactContext.packageName, null)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } catch (err: Exception) {
                promise.reject("ERR_SETTINGS", err.message)
            }
        }
    }

    @ReactMethod
    fun getInstalledFitnessApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val apps = Arguments.createArray()

            val targetApps = listOf(
                Triple("zepp", "Zepp (Amazfit)", "com.huami.watch.hmwatchmanager"),
                Triple("zepp_life", "Zepp Life (Mi Fit)", "com.xiaomi.hm.health"),
                Triple("google_fit", "Google Fit", "com.google.android.apps.fitness"),
                Triple("samsung_health", "Samsung Health", "com.sec.android.app.shealth"),
                Triple("garmin", "Garmin Connect", "com.garmin.android.apps.connectmobile"),
                Triple("health_connect", "Android Health Connect", "com.google.android.apps.healthdata")
            )

            for (target in targetApps) {
                var isInstalled = false
                try {
                    pm.getPackageInfo(target.third, 0)
                    isInstalled = true
                } catch (_: Exception) {
                    isInstalled = false
                }

                val map = Arguments.createMap().apply {
                    putString("id", target.first)
                    putString("name", target.second)
                    putString("packageName", target.third)
                    putBoolean("isInstalled", isInstalled)
                }
                apps.pushMap(map)
            }

            promise.resolve(apps)
        } catch (e: Exception) {
            promise.reject("ERR_APPS", e.message)
        }
    }

    @ReactMethod
    fun openFitnessApp(packageName: String, promise: Promise) {
        try {
            val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                reactContext.startActivity(launchIntent)
                promise.resolve(true)
            } else {
                val uri = Uri.parse("market://details?id=$packageName")
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERR_OPEN_APP", e.message)
        }
    }

    @ReactMethod
    fun openPlayStore(promise: Promise) {
        try {
            val uri = Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding")
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            val webUri = Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata")
            val webIntent = Intent(Intent.ACTION_VIEW, webUri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(webIntent)
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun getHealthData(promise: Promise) {
        moduleScope.launch {
            try {
                if (HealthConnectClient.getSdkStatus(reactContext) != HealthConnectClient.SDK_AVAILABLE) {
                    // Fallback to hardware sensors if Health Connect unavailable
                    val map = Arguments.createMap().apply {
                        putInt("steps", lastHardwareSteps.toInt())
                        putDouble("distanceMeters", lastHardwareSteps * 0.762) // Standard stride length
                        putDouble("sleepDurationHours", 0.0)
                        putBoolean("isRested", false)
                        putArray("workouts", Arguments.createArray())
                        putString("source", "HardwareSensor")
                    }
                    promise.resolve(map)
                    return@launch
                }

                val healthConnectClient = HealthConnectClient.getOrCreate(reactContext)
                val granted = healthConnectClient.permissionController.getGrantedPermissions()

                val now = Instant.now()
                val startOfToday = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant()
                val last24Hours = now.minus(24, ChronoUnit.HOURS)

                // 1. Query Steps for today
                var totalSteps: Long = 0
                if (granted.contains(HealthPermission.getReadPermission(StepsRecord::class))) {
                    val response = healthConnectClient.aggregate(
                        AggregateRequest(
                            metrics = setOf(StepsRecord.COUNT_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(startOfToday, now)
                        )
                    )
                    totalSteps = response[StepsRecord.COUNT_TOTAL] ?: 0L
                }

                // If Health Connect has 0 steps, fallback to hardware sensor if higher
                if (totalSteps == 0L && lastHardwareSteps > 0) {
                    totalSteps = lastHardwareSteps
                }

                // 2. Query Distance
                var totalDistanceMeters = totalSteps * 0.762
                if (granted.contains(HealthPermission.getReadPermission(DistanceRecord::class))) {
                    try {
                        val distanceResponse = healthConnectClient.aggregate(
                            AggregateRequest(
                                metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startOfToday, now)
                            )
                        )
                        val meters = distanceResponse[DistanceRecord.DISTANCE_TOTAL]?.inMeters
                        if (meters != null && meters > 0) {
                            totalDistanceMeters = meters
                        }
                    } catch (_: Exception) {}
                }

                // 3. Query Sleep Sessions (Last 24-36h)
                var totalSleepMinutes: Long = 0
                if (granted.contains(HealthPermission.getReadPermission(SleepSessionRecord::class))) {
                    val sleepResponse = healthConnectClient.readRecords(
                        ReadRecordsRequest(
                            recordType = SleepSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(last24Hours, now)
                        )
                    )
                    for (session in sleepResponse.records) {
                        val duration = Duration.between(session.startTime, session.endTime)
                        totalSleepMinutes += duration.toMinutes()
                    }
                }
                val sleepHours = totalSleepMinutes / 60.0
                val isRested = sleepHours in 7.0..9.0

                // 4. Query Exercise Sessions
                val workoutsArray: WritableArray = Arguments.createArray()
                if (granted.contains(HealthPermission.getReadPermission(ExerciseSessionRecord::class))) {
                    val exerciseResponse = healthConnectClient.readRecords(
                        ReadRecordsRequest(
                            recordType = ExerciseSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(last24Hours, now)
                        )
                    )
                    for (exercise in exerciseResponse.records) {
                        val durationMins = Duration.between(exercise.startTime, exercise.endTime).toMinutes()
                        val typeName = mapExerciseTypeToName(exercise.exerciseType)
                        val evType = mapExerciseTypeToEV(exercise.exerciseType)

                        val workoutMap = Arguments.createMap().apply {
                            putString("title", exercise.title ?: typeName)
                            putString("type", typeName)
                            putString("evType", evType)
                            putInt("durationMinutes", durationMins.toInt())
                        }
                        workoutsArray.pushMap(workoutMap)
                    }
                }

                val resultMap: WritableMap = Arguments.createMap().apply {
                    putInt("steps", totalSteps.toInt())
                    putDouble("distanceMeters", totalDistanceMeters)
                    putDouble("sleepDurationHours", sleepHours)
                    putBoolean("isRested", isRested)
                    putArray("workouts", workoutsArray)
                    putString("source", "HealthConnect")
                    putInt("grantedPermissionsCount", granted.size)
                }

                promise.resolve(resultMap)
            } catch (e: Exception) {
                // Return sensor fallback gracefully
                val fallbackMap = Arguments.createMap().apply {
                    putInt("steps", lastHardwareSteps.toInt())
                    putDouble("distanceMeters", lastHardwareSteps * 0.762)
                    putDouble("sleepDurationHours", 0.0)
                    putBoolean("isRested", false)
                    putArray("workouts", Arguments.createArray())
                    putString("source", "SensorFallback")
                    putString("error", e.message)
                }
                promise.resolve(fallbackMap)
            }
        }
    }

    @ReactMethod
    fun getHardwareSteps(promise: Promise) {
        promise.resolve(lastHardwareSteps.toDouble())
    }

    private fun mapExerciseTypeToName(type: Int): String {
        return when (type) {
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "Running (Cardio)"
            ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Walking (Cardio)"
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "Biking (Speed)"
            ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "Weightlifting (Attack)"
            ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> "Calisthenics (Attack)"
            ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "HIIT (Sp. Atk)"
            ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "Yoga (Sp. Def)"
            ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> "Pilates (Defense)"
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER,
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "Swimming (HP)"
            else -> "General Exercise"
        }
    }

    private fun mapExerciseTypeToEV(type: Int): String {
        return when (type) {
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
            ExerciseSessionRecord.EXERCISE_TYPE_WALKING,
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "speed"

            ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING,
            ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> "attack"

            ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> "defense"

            ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "spAtk"

            ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "spDef"

            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER,
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "hp"

            else -> "hp"
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER && event.values.isNotEmpty()) {
            lastHardwareSteps = event.values[0].toLong()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
