package ru.specdpo.object360

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File
import kotlin.math.max

object GhostFrameDecoder {
    fun decode(file: File, targetWidth: Int, targetHeight: Int): Bitmap? {
        if (!file.exists()) return null

        val bounds = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(file.absolutePath, bounds)

        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        val safeTargetWidth = max(1, targetWidth)
        val safeTargetHeight = max(1, targetHeight)

        var sample = 1
        while (
            bounds.outWidth / (sample * 2) >= safeTargetWidth &&
            bounds.outHeight / (sample * 2) >= safeTargetHeight
        ) {
            sample *= 2
        }

        return BitmapFactory.decodeFile(
            file.absolutePath,
            BitmapFactory.Options().apply {
                inSampleSize = sample
                inPreferredConfig = Bitmap.Config.RGB_565
            }
        )
    }
}
