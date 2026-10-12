package ru.specdpo.object360

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import java.io.File
import java.io.FileOutputStream
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

enum class PanoramaKind { FULL_360, RECTANGULAR }

data class PanoramaFrame(val file: File, val row: Int, val index: Int)

object PanoramaStitcher {
    fun stitch(
        frames: List<PanoramaFrame>,
        kind: PanoramaKind,
        output: File,
        onProgress: (String) -> Unit = {}
    ): File {
        require(frames.isNotEmpty()) { "Нет кадров" }
        val rows = frames.groupBy { it.row }.toSortedMap().mapNotNull { (row, list) ->
            onProgress("Склейка ряда " + (row + 1))
            stitchRow(list.sortedBy { it.index }.map { it.file })
        }
        require(rows.isNotEmpty()) { "Не удалось собрать панораму" }
        val mosaic = if (rows.size == 1) rows[0] else stack(rows)
        val result = if (kind == PanoramaKind.FULL_360) twoToOne(mosaic) else mosaic
        output.parentFile?.mkdirs()
        FileOutputStream(output).use { result.compress(Bitmap.CompressFormat.JPEG, 94, it) }
        if (result !== mosaic) result.recycle()
        if (!mosaic.isRecycled) mosaic.recycle()
        rows.forEach { if (it !== mosaic && !it.isRecycled) it.recycle() }
        return output
    }

    private fun stitchRow(files: List<File>): Bitmap? {
        var out = files.firstOrNull()?.let { GhostFrameDecoder.decodeMaxDimension(it, 1000) } ?: return null
        files.drop(1).forEach { file ->
            val right = GhostFrameDecoder.decodeMaxDimension(file, 1000) ?: return@forEach
            val merged = merge(out, right)
            out.recycle()
            right.recycle()
            out = limitWidth(merged, 4096)
        }
        return out
    }

    private fun merge(left: Bitmap, right: Bitmap): Bitmap {
        val overlap = bestOverlap(left, right)
        val width = left.width + right.width - overlap
        val height = max(left.height, right.height)
        val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(left, 0f, 0f, paint)
        val x0 = left.width - overlap
        for (x in 0 until right.width) {
            val alpha = if (x < overlap) (255f * x / overlap).toInt() else 255
            paint.alpha = alpha.coerceIn(0, 255)
            canvas.drawBitmap(
                right,
                Rect(x, 0, x + 1, right.height),
                Rect(x0 + x, 0, x0 + x + 1, right.height),
                paint
            )
        }
        paint.alpha = 255
        return out
    }

    private fun bestOverlap(a: Bitmap, b: Bitmap): Int {
        val minW = min(a.width, b.width)
        val minH = min(a.height, b.height)
        val start = max(16, (minW * 0.20f).toInt())
        val end = max(start + 1, (minW * 0.75f).toInt())
        val step = max(8, minW / 28)
        val sample = max(6, minH / 70)
        var best = max(1, (minW * 0.35f).toInt())
        var bestScore = Long.MAX_VALUE
        var overlap = start
        while (overlap <= end) {
            var score = 0L
            var n = 0
            var x = 0
            while (x < overlap) {
                var y = 0
                while (y < minH) {
                    val p = a.getPixel(a.width - overlap + x, y)
                    val q = b.getPixel(x, y)
                    score += diff(p, q)
                    n++
                    y += sample
                }
                x += sample
            }
            if (n > 0 && score / n < bestScore) {
                bestScore = score / n
                best = overlap
            }
            overlap += step
        }
        return best.coerceIn(1, minW - 1)
    }

    private fun diff(a: Int, b: Int): Long =
        (abs(((a shr 16) and 255) - ((b shr 16) and 255)) +
         abs(((a shr 8) and 255) - ((b shr 8) and 255)) +
         abs((a and 255) - (b and 255))).toLong()

    private fun stack(rows: List<Bitmap>): Bitmap {
        val width = rows.minOf { it.width }
        val scaled = rows.map {
            if (it.width == width) it
            else Bitmap.createScaledBitmap(it, width, max(1, it.height * width / it.width), true)
        }
        val out = Bitmap.createBitmap(width, scaled.sumOf { it.height }, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        var y = 0f
        scaled.forEach { bmp ->
            canvas.drawBitmap(bmp, 0f, y, null)
            y += bmp.height
        }
        scaled.forEachIndexed { i, bmp -> if (bmp !== rows[i]) bmp.recycle() }
        return out
    }

    private fun limitWidth(source: Bitmap, maxWidth: Int): Bitmap {
        if (source.width <= maxWidth) return source
        val targetHeight = max(1, source.height * maxWidth / source.width)
        val scaled = Bitmap.createScaledBitmap(source, maxWidth, targetHeight, true)
        source.recycle()
        return scaled
    }

    private fun twoToOne(source: Bitmap): Bitmap {
        val targetWidth = min(4096, source.width)
        val targetHeight = max(1, targetWidth / 2)
        if (source.width == targetWidth && source.height == targetHeight) return source
        return Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
    }
}
