package ru.specdpo.object360

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.abs

class CardboardHeadTracker(
    context: Context,
    private val onOrientation: (yaw: Float, pitch: Float, roll: Float) -> Unit
) : SensorEventListener {
    private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val sensor = manager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
        ?: manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    private val matrix = FloatArray(9)
    private val orientation = FloatArray(3)
    private var zeroYaw: Float? = null

    fun start() {
        zeroYaw = null
        sensor?.let { manager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    fun stop() = manager.unregisterListener(this)

    fun recenter() {
        zeroYaw = null
    }

    override fun onSensorChanged(event: SensorEvent) {
        SensorManager.getRotationMatrixFromVector(matrix, event.values)
        SensorManager.getOrientation(matrix, orientation)
        val rawYaw = Math.toDegrees(orientation[0].toDouble()).toFloat()
        val pitch = Math.toDegrees(orientation[1].toDouble()).toFloat()
        val roll = Math.toDegrees(orientation[2].toDouble()).toFloat()
        if (zeroYaw == null) zeroYaw = rawYaw
        var yaw = rawYaw - (zeroYaw ?: rawYaw)
        while (yaw > 180f) yaw -= 360f
        while (yaw < -180f) yaw += 360f
        if (abs(pitch) <= 90f) onOrientation(yaw, pitch, roll)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
