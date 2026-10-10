package ru.specdpo.object360

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Build
import java.io.File
import java.io.FileOutputStream
import kotlin.math.min

data class ManualAlignmentResult(
    val processed: Int,
    val failed: Int
)

object ManualAlignmentProcessor {

    private fun backupRoot(session: CaptureSession): File =
        File(session.dir, "manual_original").apply { mkdirs() }

    fun backupFor(session: CaptureSession, shot: ShotInfo): File {
        val rowDir = File(backupRoot(session), "row_${shot.row + 1}").apply { mkdirs() }
        return File(rowDir, shot.file.name)
    }

    fun sourceForEditing(session: CaptureSession, shot: ShotInfo): File {
        val backup = backupFor(session, shot)
        return if (backup.exists()) backup else shot.file
    }

    private fun ensureBackup(session: CaptureSession, shot: ShotInfo): File {
        val backup = backupFor(session, shot)
        if (!backup.exists()) {
            shot.file.copyTo(backup, overwrite = false)
        }
        return backup
    }

    fun hasBackups(session: CaptureSession): Boolean =
        File(session.dir, "manual_original").walkTopDown().any {
            it.isFile && it.name.startsWith("frame_")
        }

    fun apply(
        session: CaptureSession,
        store: ManualAlignmentStore,
        onProgress: (done: Int, total: Int, message: String) -> Unit = { _, _, _ -> }
    ): ManualAlignmentResult {
        val shots = synchronized(session) {
            session.shots.values
                .filter { it.file.exists() }
                .sortedWith(compareBy<ShotInfo> { it.row }.thenBy { it.sector })
        }
        if (shots.isEmpty()) return ManualAlignmentResult(0, 0)

        val reference = shots.firstOrNull {
            it.row == store.referenceRow && it.sector == store.referenceSector
        } ?: shots.first()

        val referenceSource = ensureBackup(session, reference)
        val referenceSize = GhostFrameDecoder.orientedDimensions(referenceSource)
            ?: throw IllegalStateException("Не удалось определить размер эталонного кадра")
        val targetWidth = referenceSize.first.coerceAtLeast(1)
        val targetHeight = referenceSize.second.coerceAtLeast(1)

        var processed = 0
        var failed = 0

        shots.forEachIndexed { index, shot ->
            onProgress(index, shots.size, "Выравниваю кадр ${index + 1} из ${shots.size}")

            try {
                val sourceFile = ensureBackup(session, shot)
                val source = GhostFrameDecoder.decodeFullResolution(sourceFile)
                    ?: throw IllegalStateException("Не удалось открыть ${sourceFile.name}")
                val transform = store.transformFor(shot.row, shot.sector).normalized()

                val transparent = shot.file.extension.equals("png", ignoreCase = true)
                val output = Bitmap.createBitmap(
                    targetWidth,
                    targetHeight,
                    Bitmap.Config.ARGB_8888
                )
                val canvas = Canvas(output)

                if (transparent) {
                    canvas.drawColor(Color.TRANSPARENT)
                } else {
                    canvas.drawColor(edgeColor(source))
                }

                val baseScale = min(
                    targetWidth.toFloat() / source.width.coerceAtLeast(1),
                    targetHeight.toFloat() / source.height.coerceAtLeast(1)
                )

                canvas.save()
                canvas.translate(
                    targetWidth * (0.5f + transform.offsetX),
                    targetHeight * (0.5f + transform.offsetY)
                )
                canvas.rotate(transform.rotation)
                val finalScale = baseScale * transform.scale
                canvas.scale(finalScale, finalScale)
                canvas.translate(-source.width / 2f, -source.height / 2f)
                canvas.drawBitmap(
                    source,
                    0f,
                    0f,
                    Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
                )
                canvas.restore()

                val temp = File(shot.file.parentFile, shot.file.name + ".manual")
                FileOutputStream(temp).use { out ->
                    when (shot.file.extension.lowercase()) {
                        "png" -> output.compress(Bitmap.CompressFormat.PNG, 100, out)
                        "webp" -> {
                            @Suppress("DEPRECATION")
                            val format = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                Bitmap.CompressFormat.WEBP_LOSSY
                            } else {
                                Bitmap.CompressFormat.WEBP
                            }
                            output.compress(format, 96, out)
                        }
                        else -> output.compress(Bitmap.CompressFormat.JPEG, 96, out)
                    }
                }

                if (shot.file.exists() && !shot.file.delete()) {
                    temp.delete()
                    throw IllegalStateException("Не удалось заменить ${shot.file.name}")
                }
                if (!temp.renameTo(shot.file)) {
                    temp.copyTo(shot.file, overwrite = true)
                    temp.delete()
                }

                synchronized(session) {
                    session.register(
                        shot.row,
                        shot.sector,
                        shot.angleDeg,
                        shot.file
                    )
                }

                if (!source.isRecycled) source.recycle()
                if (!output.isRecycled) output.recycle()
                processed++
            } catch (_: Exception) {
                failed++
            }
        }

        onProgress(shots.size, shots.size, "Готово")
        return ManualAlignmentResult(processed, failed)
    }

    fun restoreOriginals(
        session: CaptureSession,
        onProgress: (done: Int, total: Int, message: String) -> Unit = { _, _, _ -> }
    ): ManualAlignmentResult {
        val shots = synchronized(session) {
            session.shots.values
                .sortedWith(compareBy<ShotInfo> { it.row }.thenBy { it.sector })
        }
        var processed = 0
        var failed = 0

        shots.forEachIndexed { index, shot ->
            onProgress(index, shots.size, "Восстанавливаю кадр ${index + 1} из ${shots.size}")
            val backup = backupFor(session, shot)
            if (!backup.exists()) return@forEachIndexed

            try {
                backup.copyTo(shot.file, overwrite = true)
                synchronized(session) {
                    session.register(
                        shot.row,
                        shot.sector,
                        shot.angleDeg,
                        shot.file
                    )
                }
                processed++
            } catch (_: Exception) {
                failed++
            }
        }

        onProgress(shots.size, shots.size, "Готово")
        return ManualAlignmentResult(processed, failed)
    }

    private fun edgeColor(bitmap: Bitmap): Int {
        val maxX = (bitmap.width - 1).coerceAtLeast(0)
        val maxY = (bitmap.height - 1).coerceAtLeast(0)
        val colors = intArrayOf(
            bitmap.getPixel(0, 0),
            bitmap.getPixel(maxX, 0),
            bitmap.getPixel(0, maxY),
            bitmap.getPixel(maxX, maxY)
        )

        var r = 0
        var g = 0
        var b = 0
        colors.forEach {
            r += Color.red(it)
            g += Color.green(it)
            b += Color.blue(it)
        }
        return Color.rgb(r / colors.size, g / colors.size, b / colors.size)
    }
}
