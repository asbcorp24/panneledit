package ru.specdpo.object360

import android.graphics.Bitmap
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Point
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.photo.Photo
import org.opencv.imgproc.Imgproc
import java.io.File
import java.io.FileOutputStream
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan

object Spherical360Stitcher {
    private const val OUT_W = 4096
    private const val OUT_H = 2048
    private const val INPUT_MAX = 1800

    fun stitch(
        frames: List<PanoramaFrame>,
        output: File,
        onProgress: (String) -> Unit = {}
    ): Boolean {
        if (frames.size < 6 || !OpenCVLoader.initLocal()) return false

        val accum = Mat.zeros(OUT_H, OUT_W, CvType.CV_32FC3)
        val weights = Mat.zeros(OUT_H, OUT_W, CvType.CV_32FC1)

        try {
            val ordered = frames.sortedWith(
                compareBy<PanoramaFrame> { it.row }.thenBy { it.index }
            )

            ordered.forEachIndexed { idx, frame ->
                onProgress("360°: кадр " + (idx + 1) + "/" + ordered.size)

                var image = load(frame.file) ?: return@forEachIndexed
                image = levelRoll(image, frame.rollDeg)

                val landscape = image.cols() >= image.rows()
                val hfov = if (landscape) 68.0 else 52.0
                val vfov = if (landscape) 52.0 else 68.0

                val cylindrical = cylindricalWarp(image, hfov)
                image.release()

                val yaw = if (frame.yawDeg.isFinite()) {
                    normalize360(frame.yawDeg.toDouble())
                } else {
                    normalize360(frame.index * (360.0 / 12.0))
                }

                val pitch = if (frame.pitchDeg.isFinite()) {
                    frame.pitchDeg.toDouble()
                } else {
                    when (frame.row) {
                        0 -> 28.0
                        1 -> 0.0
                        else -> -28.0
                    }
                }

                val targetW = max(64, (OUT_W * hfov / 360.0).toInt())
                val targetH = max(64, (OUT_H * vfov / 180.0).toInt())

                val resized = Mat()
                Imgproc.resize(
                    cylindrical,
                    resized,
                    Size(targetW.toDouble(), targetH.toDouble()),
                    0.0,
                    0.0,
                    Imgproc.INTER_AREA
                )
                cylindrical.release()

                val mask = createFeatherMask(targetW, targetH)

                val cx = (yaw / 360.0 * OUT_W).toInt()
                val cy = (OUT_H / 2.0 + pitch / 180.0 * OUT_H).toInt()

                blendWrapped(
                    accum,
                    weights,
                    resized,
                    mask,
                    cx - targetW / 2,
                    cy - targetH / 2
                )

                resized.release()
                mask.release()
            }

            onProgress("360°: нормализация")

            val safe = Mat()
            Core.max(weights, Scalar(1e-5), safe)

            val safe3 = Mat()
            Core.merge(listOf(safe, safe, safe), safe3)

            val outF = Mat()
            Core.divide(accum, safe3, outF)

            val out = Mat()
            outF.convertTo(out, CvType.CV_8UC3)

            safe.release()
            safe3.release()
            outF.release()

            onProgress("360°: заполнение мелких разрывов")
            fillSmallHoles(out)

            save(out, output)
            out.release()
            return true
        } catch (_: Exception) {
            return false
        } finally {
            accum.release()
            weights.release()
        }
    }

    private fun load(file: File): Mat? {
        val bitmap = GhostFrameDecoder.decodeMaxDimension(file, INPUT_MAX) ?: return null

        val rgba = Mat()
        Utils.bitmapToMat(bitmap, rgba)
        bitmap.recycle()

        val bgr = Mat()
        Imgproc.cvtColor(rgba, bgr, Imgproc.COLOR_RGBA2BGR)
        rgba.release()

        return bgr
    }

    private fun levelRoll(source: Mat, rollDeg: Float): Mat {
        if (!rollDeg.isFinite() || abs(rollDeg) < 0.35f) return source

        val center = Point(
            source.cols() / 2.0,
            source.rows() / 2.0
        )

        val rotation = Imgproc.getRotationMatrix2D(
            center,
            rollDeg.toDouble(),
            1.0
        )

        val out = Mat()
        Imgproc.warpAffine(
            source,
            out,
            rotation,
            source.size(),
            Imgproc.INTER_LINEAR,
            Core.BORDER_REFLECT
        )

        rotation.release()
        source.release()
        return out
    }

    private fun cylindricalWarp(source: Mat, hfovDeg: Double): Mat {
        val w = source.cols()
        val h = source.rows()

        val cx = (w - 1) / 2.0
        val cy = (h - 1) / 2.0
        val focal = (w / 2.0) / tan(hfovDeg * PI / 360.0)

        val mapX = Mat(h, w, CvType.CV_32FC1)
        val mapY = Mat(h, w, CvType.CV_32FC1)

        val rowX = FloatArray(w)
        val rowY = FloatArray(w)

        for (y in 0 until h) {
            val yn = (y - cy) / focal

            for (x in 0 until w) {
                val theta = (x - cx) / focal
                val cosine = max(0.15, cos(theta))

                rowX[x] = (focal * tan(theta) + cx).toFloat()
                rowY[x] = (focal * yn / cosine + cy).toFloat()
            }

            mapX.put(y, 0, rowX)
            mapY.put(y, 0, rowY)
        }

        val out = Mat()

        Imgproc.remap(
            source,
            out,
            mapX,
            mapY,
            Imgproc.INTER_LINEAR,
            Core.BORDER_CONSTANT,
            Scalar.all(0.0)
        )

        mapX.release()
        mapY.release()

        return out
    }

    private fun createFeatherMask(w: Int, h: Int): Mat {
        val binary = Mat(
            h,
            w,
            CvType.CV_8UC1,
            Scalar(255.0)
        )

        val border = max(3, min(w, h) / 35)

        Imgproc.rectangle(
            binary,
            Point(0.0, 0.0),
            Point((w - 1).toDouble(), (h - 1).toDouble()),
            Scalar(0.0),
            border
        )

        val dist = Mat()

        Imgproc.distanceTransform(
            binary,
            dist,
            Imgproc.DIST_L2,
            3
        )

        binary.release()

        val maxValue = Core.minMaxLoc(dist).maxVal

        if (maxValue > 0.0) {
            Core.divide(
                dist,
                Scalar(maxValue),
                dist
            )
        }

        Core.max(
            dist,
            Scalar(0.03),
            dist
        )

        return dist
    }

    private fun blendWrapped(
        accum: Mat,
        weights: Mat,
        image: Mat,
        mask: Mat,
        x: Int,
        y: Int
    ) {
        blendAt(accum, weights, image, mask, x, y)
        blendAt(accum, weights, image, mask, x - OUT_W, y)
        blendAt(accum, weights, image, mask, x + OUT_W, y)
    }

    private fun blendAt(
        accum: Mat,
        weights: Mat,
        image: Mat,
        mask: Mat,
        x: Int,
        y: Int
    ) {
        val dstX0 = max(0, x)
        val dstY0 = max(0, y)
        val dstX1 = min(OUT_W, x + image.cols())
        val dstY1 = min(OUT_H, y + image.rows())

        if (
            dstX1 <= dstX0 ||
            dstY1 <= dstY0
        ) {
            return
        }

        val srcX0 = dstX0 - x
        val srcY0 = dstY0 - y

        val width = dstX1 - dstX0
        val height = dstY1 - dstY0

        val srcRect = org.opencv.core.Rect(
            srcX0,
            srcY0,
            width,
            height
        )

        val dstRect = org.opencv.core.Rect(
            dstX0,
            dstY0,
            width,
            height
        )

        val imageRoi = Mat(image, srcRect)
        val maskRoi = Mat(mask, srcRect)
        val accumRoi = Mat(accum, dstRect)
        val weightRoi = Mat(weights, dstRect)

        val imageFloat = Mat()
        imageRoi.convertTo(
            imageFloat,
            CvType.CV_32FC3
        )

        val mask3 = Mat()
        Core.merge(
            listOf(maskRoi, maskRoi, maskRoi),
            mask3
        )

        val weighted = Mat()
        Core.multiply(
            imageFloat,
            mask3,
            weighted
        )

        Core.add(
            accumRoi,
            weighted,
            accumRoi
        )

        Core.add(
            weightRoi,
            maskRoi,
            weightRoi
        )

        imageFloat.release()
        mask3.release()
        weighted.release()
        imageRoi.release()
        maskRoi.release()
        accumRoi.release()
        weightRoi.release()
    }

    private fun fillSmallHoles(out: Mat) {
        val gray = Mat()
        Imgproc.cvtColor(
            out,
            gray,
            Imgproc.COLOR_BGR2GRAY
        )

        val holes = Mat()
        Imgproc.threshold(
            gray,
            holes,
            2.0,
            255.0,
            Imgproc.THRESH_BINARY_INV
        )

        gray.release()

        val kernel = Imgproc.getStructuringElement(
            Imgproc.MORPH_ELLIPSE,
            Size(5.0, 5.0)
        )

        Imgproc.morphologyEx(
            holes,
            holes,
            Imgproc.MORPH_OPEN,
            kernel
        )

        kernel.release()

        if (Core.countNonZero(holes) > 0) {
            Photo.inpaint(
                out,
                holes,
                out,
                3.0,
                Photo.INPAINT_TELEA
            )
        }

        holes.release()
    }

    private fun normalize360(value: Double): Double {
        var result = value % 360.0

        if (result < 0.0) {
            result += 360.0
        }

        return result
    }

    private fun save(
        mat: Mat,
        output: File
    ) {
        output.parentFile?.mkdirs()

        val rgba = Mat()

        Imgproc.cvtColor(
            mat,
            rgba,
            Imgproc.COLOR_BGR2RGBA
        )

        val bitmap = Bitmap.createBitmap(
            rgba.cols(),
            rgba.rows(),
            Bitmap.Config.ARGB_8888
        )

        Utils.matToBitmap(
            rgba,
            bitmap
        )

        rgba.release()

        FileOutputStream(output).use {
            bitmap.compress(
                Bitmap.CompressFormat.JPEG,
                95,
                it
            )
        }

        bitmap.recycle()
    }
}
