package ru.specdpo.object360

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.YuvImage
import android.media.Image
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

data class YuvPlaneSnapshot(
    val bytes: ByteArray,
    val rowStride: Int,
    val pixelStride: Int
)

data class YuvFrameSnapshot(
    val width: Int,
    val height: Int,
    val y: YuvPlaneSnapshot,
    val u: YuvPlaneSnapshot,
    val v: YuvPlaneSnapshot
)

object YuvJpeg {

    fun snapshot(image: Image): YuvFrameSnapshot {
        require(image.format == ImageFormat.YUV_420_888)

        fun copyPlane(plane: Image.Plane): YuvPlaneSnapshot {
            val buffer = plane.buffer.duplicate()
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)
            return YuvPlaneSnapshot(
                bytes = bytes,
                rowStride = plane.rowStride,
                pixelStride = plane.pixelStride
            )
        }

        return YuvFrameSnapshot(
            width = image.width,
            height = image.height,
            y = copyPlane(image.planes[0]),
            u = copyPlane(image.planes[1]),
            v = copyPlane(image.planes[2])
        )
    }

    fun saveJpeg(
        frame: YuvFrameSnapshot,
        file: File,
        rotationDegrees: Int,
        quality: Int = 94
    ) {
        val nv21 = toNv21(frame)
        val rawJpeg = ByteArrayOutputStream()

        YuvImage(
            nv21,
            ImageFormat.NV21,
            frame.width,
            frame.height,
            null
        ).compressToJpeg(
            android.graphics.Rect(0, 0, frame.width, frame.height),
            quality,
            rawJpeg
        )

        file.parentFile?.mkdirs()

        val normalizedRotation = ((rotationDegrees % 360) + 360) % 360
        if (normalizedRotation == 0) {
            FileOutputStream(file).use { it.write(rawJpeg.toByteArray()) }
            return
        }

        val source = BitmapFactory.decodeByteArray(
            rawJpeg.toByteArray(),
            0,
            rawJpeg.size()
        ) ?: throw IllegalStateException("Не удалось декодировать кадр ARCore")

        val matrix = Matrix().apply { postRotate(normalizedRotation.toFloat()) }
        val rotated = Bitmap.createBitmap(
            source,
            0,
            0,
            source.width,
            source.height,
            matrix,
            true
        )

        FileOutputStream(file).use {
            rotated.compress(Bitmap.CompressFormat.JPEG, quality, it)
        }

        if (rotated !== source) rotated.recycle()
        source.recycle()
    }

    private fun toNv21(frame: YuvFrameSnapshot): ByteArray {
        val width = frame.width
        val height = frame.height
        val output = ByteArray(width * height * 3 / 2)

        copyLuma(frame.y, width, height, output)
        copyChroma(frame.u, frame.v, width, height, output)

        return output
    }

    private fun copyLuma(
        plane: YuvPlaneSnapshot,
        width: Int,
        height: Int,
        output: ByteArray
    ) {
        var out = 0
        for (row in 0 until height) {
            val rowStart = row * plane.rowStride
            for (col in 0 until width) {
                output[out++] = plane.bytes[rowStart + col * plane.pixelStride]
            }
        }
    }

    private fun copyChroma(
        u: YuvPlaneSnapshot,
        v: YuvPlaneSnapshot,
        width: Int,
        height: Int,
        output: ByteArray
    ) {
        val chromaWidth = width / 2
        val chromaHeight = height / 2
        var out = width * height

        for (row in 0 until chromaHeight) {
            val uRow = row * u.rowStride
            val vRow = row * v.rowStride

            for (col in 0 until chromaWidth) {
                output[out++] = v.bytes[vRow + col * v.pixelStride]
                output[out++] = u.bytes[uRow + col * u.pixelStride]
            }
        }
    }
}
