package ru.specdpo.object360

import android.app.Activity
import android.content.Context
import android.content.pm.ActivityInfo

enum class CaptureOrientationMode(
    val storageValue: String,
    val title: String,
    val buttonLabel: String
) {
    AUTO("auto", "Авто", "АВТО"),
    PORTRAIT("portrait", "Вертикально", "ВЕРТИКАЛЬНО"),
    LANDSCAPE("landscape", "Горизонтально", "ГОРИЗОНТАЛЬНО")
}

object CaptureOrientationSettings {

    private const val PREFS_NAME = "object360_capture_settings"
    private const val KEY_ORIENTATION = "capture_orientation"

    fun get(context: Context): CaptureOrientationMode {
        val stored = context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_ORIENTATION, CaptureOrientationMode.AUTO.storageValue)

        return CaptureOrientationMode.values()
            .firstOrNull { it.storageValue == stored }
            ?: CaptureOrientationMode.AUTO
    }

    fun set(context: Context, mode: CaptureOrientationMode) {
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_ORIENTATION, mode.storageValue)
            .apply()
    }

    fun apply(activity: Activity, mode: CaptureOrientationMode = get(activity)) {
        val requested = when (mode) {
            CaptureOrientationMode.AUTO ->
                ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR

            CaptureOrientationMode.PORTRAIT ->
                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT

            CaptureOrientationMode.LANDSCAPE ->
                ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        }

        if (activity.requestedOrientation != requested) {
            activity.requestedOrientation = requested
        }
    }
}
