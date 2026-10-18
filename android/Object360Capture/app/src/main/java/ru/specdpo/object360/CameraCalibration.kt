package ru.specdpo.object360

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.util.SizeF
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.core.CameraInfo
import kotlin.math.atan

data class CameraCalibration(
    val fx: Float = Float.NaN,
    val fy: Float = Float.NaN,
    val cx: Float = Float.NaN,
    val cy: Float = Float.NaN,
    val k1: Float = 0f,
    val k2: Float = 0f,
    val k3: Float = 0f,
    val k4: Float = 0f,
    val k5: Float = 0f,
    val horizontalFovDeg: Float = Float.NaN,
    val verticalFovDeg: Float = Float.NaN
) {
    val hasIntrinsics: Boolean
        get() = fx.isFinite() && fy.isFinite() && fx > 0f && fy > 0f

    val hasDistortion: Boolean
        get() = listOf(k1, k2, k3, k4, k5).any { kotlin.math.abs(it) > 1e-7f }
}

object CameraCalibrationReader {
    fun read(context: Context, cameraInfo: CameraInfo): CameraCalibration {
        return try {
            val cameraId = Camera2CameraInfo.from(cameraInfo).cameraId
            val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val c = manager.getCameraCharacteristics(cameraId)

            val intr = c.get(CameraCharacteristics.LENS_INTRINSIC_CALIBRATION)
            val distortion = c.get(CameraCharacteristics.LENS_DISTORTION)
            val focalLengths = c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
            val sensorSize: SizeF? = c.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)

            val fx = intr?.getOrNull(0) ?: Float.NaN
            val fy = intr?.getOrNull(1) ?: Float.NaN
            val cx = intr?.getOrNull(2) ?: Float.NaN
            val cy = intr?.getOrNull(3) ?: Float.NaN

            val d = distortion ?: FloatArray(0)

            val focalMm = focalLengths?.firstOrNull()
            val hfov = if (focalMm != null && sensorSize != null && focalMm > 0f) {
                Math.toDegrees(2.0 * atan((sensorSize.width / (2.0 * focalMm)).toDouble())).toFloat()
            } else Float.NaN
            val vfov = if (focalMm != null && sensorSize != null && focalMm > 0f) {
                Math.toDegrees(2.0 * atan((sensorSize.height / (2.0 * focalMm)).toDouble())).toFloat()
            } else Float.NaN

            CameraCalibration(
                fx = fx,
                fy = fy,
                cx = cx,
                cy = cy,
                k1 = d.getOrElse(0) { 0f },
                k2 = d.getOrElse(1) { 0f },
                k3 = d.getOrElse(2) { 0f },
                k4 = d.getOrElse(3) { 0f },
                k5 = d.getOrElse(4) { 0f },
                horizontalFovDeg = hfov,
                verticalFovDeg = vfov
            )
        } catch (_: Throwable) {
            CameraCalibration()
        }
    }
}
