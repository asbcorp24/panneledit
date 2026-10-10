package ru.specdpo.object360

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
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

        val bitmap = BitmapFactory.decodeFile(
            file.absolutePath,
            BitmapFactory.Options().apply {
                inSampleSize = sample
                inPreferredConfig = Bitmap.Config.RGB_565
            }
        ) ?: return null

        return applyExifOrientation(file, bitmap)
    }

    fun decodeMaxDimension(file: File, maxDimension: Int): Bitmap? {
        if (!file.exists()) return null

        val bounds = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(file.absolutePath, bounds)

        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        val safeMax = max(1, maxDimension)
        var sample = 1
        while (
            max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= safeMax
        ) {
            sample *= 2
        }

        val bitmap = BitmapFactory.decodeFile(
            file.absolutePath,
            BitmapFactory.Options().apply {
                inSampleSize = sample
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
        ) ?: return null

        return applyExifOrientation(file, bitmap)
    }

    fun decodeFullResolution(file: File): Bitmap? {
        if (!file.exists()) return null

        val bitmap = BitmapFactory.decodeFile(
            file.absolutePath,
            BitmapFactory.Options().apply {
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
        ) ?: return null

        return applyExifOrientation(file, bitmap)
    }

    fun orientedDimensions(file: File): Pair<Int, Int>? {
        if (!file.exists()) return null

        val bounds = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        val orientation = runCatching {
            ExifInterface(file.absolutePath).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
        }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)

        return when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90,
            ExifInterface.ORIENTATION_ROTATE_270,
            ExifInterface.ORIENTATION_TRANSPOSE,
            ExifInterface.ORIENTATION_TRANSVERSE ->
                bounds.outHeight to bounds.outWidth

            else ->
                bounds.outWidth to bounds.outHeight
        }
    }

    private fun applyExifOrientation(file: File, bitmap: Bitmap): Bitmap {
        val orientation = runCatching {
            ExifInterface(file.absolutePath).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
        }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)

        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL ->
                matrix.setScale(-1f, 1f)

            ExifInterface.ORIENTATION_ROTATE_180 ->
                matrix.setRotate(180f)

            ExifInterface.ORIENTATION_FLIP_VERTICAL -> {
                matrix.setRotate(180f)
                matrix.postScale(-1f, 1f)
            }

            ExifInterface.ORIENTATION_TRANSPOSE -> {
                matrix.setRotate(90f)
                matrix.postScale(-1f, 1f)
            }

            ExifInterface.ORIENTATION_ROTATE_90 ->
                matrix.setRotate(90f)

            ExifInterface.ORIENTATION_TRANSVERSE -> {
                matrix.setRotate(-90f)
                matrix.postScale(-1f, 1f)
            }

            ExifInterface.ORIENTATION_ROTATE_270 ->
                matrix.setRotate(270f)

            else -> return bitmap
        }

        return try {
            val rotated = Bitmap.createBitmap(
                bitmap,
                0,
                0,
                bitmap.width,
                bitmap.height,
                matrix,
                true
            )
            if (rotated !== bitmap && !bitmap.isRecycled) bitmap.recycle()
            rotated
        } catch (_: Exception) {
            bitmap
        }
    }
}
