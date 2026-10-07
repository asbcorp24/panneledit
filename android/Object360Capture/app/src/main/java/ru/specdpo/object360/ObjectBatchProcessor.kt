package ru.specdpo.object360

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

enum class ObjectProcessMode {
    AUTO_CROP,
    TRANSPARENT_BACKGROUND,
    SOLID_BACKGROUND
}

data class ProcessResult(
    val processed: Int,
    val failed: Int,
    val transparent: Boolean
)

object ObjectBatchProcessor {

    private data class NormRect(
        var left: Float = 1f,
        var top: Float = 1f,
        var right: Float = 0f,
        var bottom: Float = 0f
    ) {
        fun include(other: NormRect) {
            left = min(left, other.left)
            top = min(top, other.top)
            right = max(right, other.right)
            bottom = max(bottom, other.bottom)
        }

        fun isValid(): Boolean =
            left < right && top < bottom &&
                left in 0f..1f && top in 0f..1f &&
                right in 0f..1f && bottom in 0f..1f
    }

    private data class BackgroundModel(
        val r: Int,
        val g: Int,
        val b: Int,
        val thresholdSq: Int
    )

    fun process(
        session: CaptureSession,
        mode: ObjectProcessMode,
        solidColor: Int = Color.WHITE,
        onProgress: (done: Int, total: Int, message: String) -> Unit = { _, _, _ -> }
    ): ProcessResult {
        val shots = synchronized(session) {
            session.shots.values
                .filter { it.file.exists() }
                .sortedWith(compareBy<ShotInfo> { it.row }.thenBy { it.sector })
        }

        if (shots.isEmpty()) return ProcessResult(0, 0, false)

        onProgress(0, shots.size, "Анализирую положение объекта…")
        val commonCrop = findCommonCrop(shots)

        var processed = 0
        var failed = 0

        shots.forEachIndexed { index, shot ->
            onProgress(
                index,
                shots.size,
                "Кадр ${index + 1} из ${shots.size}"
            )

            try {
                val oriented = GhostFrameDecoder.decode(shot.file, 3000, 3000)
                    ?: throw IllegalStateException("Не удалось открыть ${shot.file.name}")

                val crop = pixelCrop(commonCrop, oriented.width, oriented.height)
                val output = when (mode) {
                    ObjectProcessMode.AUTO_CROP ->
                        Bitmap.createBitmap(
                            oriented,
                            crop.left,
                            crop.top,
                            crop.width(),
                            crop.height()
                        )

                    ObjectProcessMode.TRANSPARENT_BACKGROUND,
                    ObjectProcessMode.SOLID_BACKGROUND -> {
                        val bgMask = buildBackgroundMask(oriented)
                        createMaskedCrop(
                            source = oriented,
                            background = bgMask,
                            crop = crop,
                            transparent = mode == ObjectProcessMode.TRANSPARENT_BACKGROUND,
                            solidColor = solidColor
                        )
                    }
                }

                val transparent = mode == ObjectProcessMode.TRANSPARENT_BACKGROUND
                val extension = if (transparent) "png" else "jpg"
                val target = File(
                    shot.file.parentFile,
                    "frame_${shot.sector.toString().padStart(3, '0')}.§extension"
                )
                val temp = File(target.parentFile, target.name + ".processing")

                FileOutputStream(temp).use { out ->
                    output.compress(
                        if (transparent) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG,
                        if (transparent) 100 else 94,
                        out
                    )
                }

                if (target.exists()) target.delete()
                if (!temp.renameTo(target)) {
                    temp.copyTo(target, overwrite = true)
                    temp.delete()
                }

                synchronized(session) {
                    session.register(
                        shot.row,
                        shot.sector,
                        shot.angleDeg,
                        target
                    )
                }

                if (output !== oriented && !output.isRecycled) output.recycle()
                if (!oriented.isRecycled) oriented.recycle()
                processed++
            } catch (_: Exception) {
                failed++
            }
        }

        onProgress(shots.size, shots.size, "Готово")
        return ProcessResult(
            processed = processed,
            failed = failed,
            transparent = mode == ObjectProcessMode.TRANSPARENT_BACKGROUND
        )
    }

    private fun findCommonCrop(shots: List<ShotInfo>): NormRect {
        val common = NormRect()
        var detected = 0

        shots.forEach { shot ->
            val bitmap = GhostFrameDecoder.decode(shot.file, 520, 520) ?: return@forEach
            try {
                val mask = buildBackgroundMask(bitmap)
                val bounds = foregroundBounds(mask, bitmap.width, bitmap.height)
                if (bounds != null) {
                    val padX = max(4, (bounds.width() * 0.06f).toInt())
                    val padY = max(4, (bounds.height() * 0.06f).toInt())
                    val l = max(0, bounds.left - padX)
                    val t = max(0, bounds.top - padY)
                    val r = min(bitmap.width, bounds.right + padX)
                    val b = min(bitmap.height, bounds.bottom + padY)

                    common.include(
                        NormRect(
                            l.toFloat() / bitmap.width,
                            t.toFloat() / bitmap.height,
                            r.toFloat() / bitmap.width,
                            b.toFloat() / bitmap.height
                        )
                    )
                    detected++
                }
            } finally {
                if (!bitmap.isRecycled) bitmap.recycle()
            }
        }

        if (detected == 0 || !common.isValid()) {
            return NormRect(0f, 0f, 1f, 1f)
        }

        val extraX = 0.025f
        val extraY = 0.025f
        common.left = (common.left - extraX).coerceAtLeast(0f)
        common.top = (common.top - extraY).coerceAtLeast(0f)
        common.right = (common.right + extraX).coerceAtMost(1f)
        common.bottom = (common.bottom + extraY).coerceAtMost(1f)

        val width = common.right - common.left
        val height = common.bottom - common.top

        return if (width > 0.96f && height > 0.96f) {
            NormRect(0f, 0f, 1f, 1f)
        } else {
            common
        }
    }

    private fun pixelCrop(rect: NormRect, width: Int, height: Int): Rect {
        val left = (rect.left * width).toInt().coerceIn(0, width - 1)
        val top = (rect.top * height).toInt().coerceIn(0, height - 1)
        val right = (rect.right * width).toInt().coerceIn(left + 1, width)
        val bottom = (rect.bottom * height).toInt().coerceIn(top + 1, height)
        return Rect(left, top, right, bottom)
    }

    private fun createMaskedCrop(
        source: Bitmap,
        background: ByteArray,
        crop: Rect,
        transparent: Boolean,
        solidColor: Int
    ): Bitmap {
        val outW = crop.width()
        val outH = crop.height()
        val out = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
        val row = IntArray(outW)

        for (y in 0 until outH) {
            source.getPixels(row, 0, outW, crop.left, crop.top + y, outW, 1)
            for (x in 0 until outW) {
                val srcX = crop.left + x
                val srcY = crop.top + y
                val index = srcY * source.width + srcX

                if (background[index].toInt() != 0) {
                    row[x] = if (transparent) Color.TRANSPARENT else solidColor
                } else if (touchesBackground(background, source.width, source.height, srcX, srcY)) {
                    val color = row[x]
                    if (transparent) {
                        row[x] = Color.argb(150, Color.red(color), Color.green(color), Color.blue(color))
                    } else {
                        row[x] = blend(color, solidColor, 0.34f)
                    }
                } else {
                    row[x] = row[x] or (0xFF shl 24)
                }
            }
            out.setPixels(row, 0, outW, 0, y, outW, 1)
        }

        return out
    }

    private fun blend(foreground: Int, background: Int, amount: Float): Int {
        val inv = 1f - amount
        return Color.rgb(
            (Color.red(foreground) * inv + Color.red(background) * amount).toInt(),
            (Color.green(foreground) * inv + Color.green(background) * amount).toInt(),
            (Color.blue(foreground) * inv + Color.blue(background) * amount).toInt()
        )
    }

    private fun touchesBackground(
        mask: ByteArray,
        width: Int,
        height: Int,
        x: Int,
        y: Int
    ): Boolean {
        if (x > 0 && mask[y * width + x - 1].toInt() != 0) return true
        if (x + 1 < width && mask[y * width + x + 1].toInt() != 0) return true
        if (y > 0 && mask[(y - 1) * width + x].toInt() != 0) return true
        if (y + 1 < height && mask[(y + 1) * width + x].toInt() != 0) return true
        return false
    }

    private fun foregroundBounds(mask: ByteArray, width: Int, height: Int): Rect? {
        var minX = width
        var minY = height
        var maxX = -1
        var maxY = -1
        var count = 0

        for (y in 0 until height) {
            val row = y * width
            for (x in 0 until width) {
                if (mask[row + x].toInt() == 0) {
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)
                    count++
                }
            }
        }

        val total = width * height
        if (count < total * 0.01f || maxX < minX || maxY < minY) return null

        return Rect(minX, minY, maxX + 1, maxY + 1)
    }

    private fun buildBackgroundMask(bitmap: Bitmap): ByteArray {
        val width = bitmap.width
        val height = bitmap.height
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        val model = estimateBackground(pixels, width, height)
        val mask = ByteArray(pixels.size)
        val queue = IntArray(pixels.size)
        var head = 0
        var tail = 0

        fun tryAdd(index: Int) {
            if (mask[index].toInt() != 0) return
            if (!matchesBackground(pixels[index], model)) return
            mask[index] = 1
            queue[tail++] = index
        }

        for (x in 0 until width) {
            tryAdd(x)
            tryAdd((height - 1) * width + x)
        }
        for (y in 1 until height - 1) {
            tryAdd(y * width)
            tryAdd(y * width + width - 1)
        }

        while (head < tail) {
            val index = queue[head++]
            val x = index % width
            val y = index / width

            if (x > 0) tryAdd(index - 1)
            if (x + 1 < width) tryAdd(index + 1)
            if (y > 0) tryAdd(index - width)
            if (y + 1 < height) tryAdd(index + width)
        }

        return mask
    }

    private fun estimateBackground(
        pixels: IntArray,
        width: Int,
        height: Int
    ): BackgroundModel {
        val edge = max(2, min(width, height) / 40)
        val step = max(1, min(width, height) / 180)

        var sumR = 0L
        var sumG = 0L
        var sumB = 0L
        var sumR2 = 0L
        var sumG2 = 0L
        var sumB2 = 0L
        var count = 0L

        fun add(color: Int) {
            val r = Color.red(color)
            val g = Color.green(color)
            val b = Color.blue(color)
            sumR += r
            sumG += g
            sumB += b
            sumR2 += r.toLong() * r
            sumG2 += g.toLong() * g
            sumB2 += b.toLong() * b
            count++
        }

        var y = 0
        while (y < height) {
            var x = 0
            while (x < width) {
                if (x < edge || x >= width - edge || y < edge || y >= height - edge) {
                    add(pixels[y * width + x])
                }
                x += step
            }
            y += step
        }

        if (count == 0L) return BackgroundModel(255, 255, 255, 55 * 55 * 3)

        val r = (sumR / count).toInt()
        val g = (sumG / count).toInt()
        val b = (sumB / count).toInt()

        fun variance(sum: Long, sum2: Long): Double {
            val mean = sum.toDouble() / count
            return max(0.0, sum2.toDouble() / count - mean * mean)
        }

        val sigma = sqrt(
            (variance(sumR, sumR2) + variance(sumG, sumG2) + variance(sumB, sumB2)) / 3.0
        )
        val threshold = (30.0 + sigma * 1.7).toInt().coerceIn(30, 82)

        return BackgroundModel(
            r = r,
            g = g,
            b = b,
            thresholdSq = threshold * threshold * 3
        )
    }

    private fun matchesBackground(color: Int, model: BackgroundModel): Boolean {
        val dr = Color.red(color) - model.r
        val dg = Color.green(color) - model.g
        val db = Color.blue(color) - model.b
        return dr * dr + dg * dg + db * db <= model.thresholdSq
    }
}
