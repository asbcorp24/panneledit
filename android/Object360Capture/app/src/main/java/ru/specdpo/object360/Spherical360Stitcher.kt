package ru.specdpo.object360

import android.graphics.Bitmap
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfDouble
import org.opencv.core.MatOfInt
import org.opencv.core.Point
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.photo.Photo
import org.opencv.imgproc.Imgproc
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.calib3d.Calib3d
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
    private const val OUT_8K_W = 8192
    private const val OUT_8K_H = 4096
    private const val INPUT_8K_MAX = 3000
    private const val BAND_8K_H = 512

    fun stitch(
        frames: List<PanoramaFrame>,
        output: File,
        onProgress: (String) -> Unit = {}
    ): Boolean {
        if (frames.size < 6 || !OpenCVLoader.initLocal()) return false

        val ordered = optimizeOrientations(
            frames.sortedWith(
                compareBy<PanoramaFrame> { it.row }.thenBy { it.index }
            )
        )
        val exposure = buildExposureGains(ordered)

        if (shouldUse8k(ordered)) {
            onProgress("360°: режим 8K 8192×4096")
            if (stitch8kTiled(ordered, exposure, output, onProgress)) return true
            onProgress("360°: 8K не завершён, переход на 4K")
        }

        val accum = Mat.zeros(OUT_H, OUT_W, CvType.CV_32FC3)
        val weights = Mat.zeros(OUT_H, OUT_W, CvType.CV_32FC1)

        try {
            ordered.forEachIndexed { idx, frame ->
                onProgress("360°: кадр " + (idx + 1) + "/" + ordered.size)

                var image = load(frame.file) ?: return@forEachIndexed
                image = undistort(image, frame.calibration)
                image = levelRoll(image, frame.rollDeg)

                val landscape = image.cols() >= image.rows()
                val calibratedHfov = frame.calibration.horizontalFovDeg
                val calibratedVfov = frame.calibration.verticalFovDeg
                val hfov = if (calibratedHfov.isFinite() && calibratedHfov in 25f..130f) {
                    if (landscape) calibratedHfov.toDouble() else calibratedVfov.toDouble()
                } else {
                    if (landscape) 68.0 else 52.0
                }
                val vfov = if (calibratedVfov.isFinite() && calibratedVfov in 20f..130f) {
                    if (landscape) calibratedVfov.toDouble() else calibratedHfov.toDouble()
                } else {
                    if (landscape) 52.0 else 68.0
                }

                val cylindrical = cylindricalWarp(image, hfov)
                image.release()
                applyExposureGain(cylindrical, exposure[frame.file.absolutePath] ?: 1.0)

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

    private fun buildExposureGains(frames: List<PanoramaFrame>): Map<String, Double> {
        val samples = ArrayList<Pair<String, Double>>()

        frames.forEach { frame ->
            val image = load(frame.file, 420) ?: return@forEach
            try {
                val gray = Mat()
                Imgproc.cvtColor(image, gray, Imgproc.COLOR_BGR2GRAY)
                val mean = MatOfDouble()
                val std = MatOfDouble()
                Core.meanStdDev(gray, mean, std)
                val value = mean.toArray().firstOrNull() ?: 0.0
                mean.release()
                std.release()
                gray.release()
                if (value > 2.0) samples += frame.file.absolutePath to value
            } finally {
                image.release()
            }
        }

        if (samples.isEmpty()) return emptyMap()
        val sorted = samples.map { it.second }.sorted()
        val median = sorted[sorted.size / 2]

        return samples.associate { (path, value) ->
            path to (median / value).coerceIn(0.72, 1.38)
        }
    }

    private fun applyExposureGain(image: Mat, gain: Double) {
        if (kotlin.math.abs(gain - 1.0) < 0.015) return
        image.convertTo(image, -1, gain, 0.0)
    }

    private fun shouldUse8k(frames: List<PanoramaFrame>): Boolean {
        if (frames.size < 30) return false
        val maxMemoryMb = Runtime.getRuntime().maxMemory() / (1024L * 1024L)
        return maxMemoryMb >= 320L
    }

    private fun frameFov(frame: PanoramaFrame, image: Mat): Pair<Double, Double> {
        val landscape = image.cols() >= image.rows()
        val h = frame.calibration.horizontalFovDeg
        val v = frame.calibration.verticalFovDeg

        val hfov = if (h.isFinite() && h in 25f..130f && v.isFinite()) {
            if (landscape) h.toDouble() else v.toDouble()
        } else {
            if (landscape) 68.0 else 52.0
        }

        val vfov = if (v.isFinite() && v in 20f..130f && h.isFinite()) {
            if (landscape) v.toDouble() else h.toDouble()
        } else {
            if (landscape) 52.0 else 68.0
        }

        return hfov to vfov
    }

    private fun stitch8kTiled(
        frames: List<PanoramaFrame>,
        exposure: Map<String, Double>,
        output: File,
        onProgress: (String) -> Unit
    ): Boolean {
        val finalOut = Mat.zeros(OUT_8K_H, OUT_8K_W, CvType.CV_8UC3)

        try {
            var bandY = 0
            var bandIndex = 0
            val bandCount = (OUT_8K_H + BAND_8K_H - 1) / BAND_8K_H

            while (bandY < OUT_8K_H) {
                val bandHeight = min(BAND_8K_H, OUT_8K_H - bandY)
                bandIndex++
                onProgress("360° 8K: полоса " + bandIndex + "/" + bandCount)

                val accum = Mat.zeros(bandHeight, OUT_8K_W, CvType.CV_32FC3)
                val weights = Mat.zeros(bandHeight, OUT_8K_W, CvType.CV_32FC1)

                try {
                    frames.forEach { frame ->
                        var image = load(frame.file, INPUT_8K_MAX) ?: return@forEach
                        image = undistort(image, frame.calibration)
                        image = levelRoll(image, frame.rollDeg)

                        val (hfov, vfov) = frameFov(frame, image)
                        val cylindrical = cylindricalWarp(image, hfov)
                        image.release()
                        applyExposureGain(cylindrical, exposure[frame.file.absolutePath] ?: 1.0)

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

                        val targetW = max(64, (OUT_8K_W * hfov / 360.0).toInt())
                        val targetH = max(64, (OUT_8K_H * vfov / 180.0).toInt())

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
                        val cx = (yaw / 360.0 * OUT_8K_W).toInt()
                        val cy = (OUT_8K_H / 2.0 + pitch / 180.0 * OUT_8K_H).toInt()

                        blendWrappedBand(
                            accum,
                            weights,
                            resized,
                            mask,
                            cx - targetW / 2,
                            cy - targetH / 2,
                            bandY,
                            bandHeight
                        )

                        resized.release()
                        mask.release()
                    }

                    val safe = Mat()
                    Core.max(weights, Scalar(1e-5), safe)
                    val safe3 = Mat()
                    Core.merge(listOf(safe, safe, safe), safe3)

                    val bandFloat = Mat()
                    Core.divide(accum, safe3, bandFloat)

                    val band8 = Mat()
                    bandFloat.convertTo(band8, CvType.CV_8UC3)

                    val dst = Mat(
                        finalOut,
                        org.opencv.core.Rect(0, bandY, OUT_8K_W, bandHeight)
                    )
                    band8.copyTo(dst)

                    dst.release()
                    band8.release()
                    bandFloat.release()
                    safe3.release()
                    safe.release()
                } finally {
                    accum.release()
                    weights.release()
                }

                bandY += bandHeight
            }

            onProgress("360° 8K: финальная коррекция")
            fillSmallHoles(finalOut)

            output.parentFile?.mkdirs()
            val params = MatOfInt(
                Imgcodecs.IMWRITE_JPEG_QUALITY,
                95
            )
            val ok = Imgcodecs.imwrite(output.absolutePath, finalOut, params)
            params.release()
            return ok
        } catch (_: Throwable) {
            return false
        } finally {
            finalOut.release()
        }
    }

    private fun blendWrappedBand(
        accum: Mat,
        weights: Mat,
        image: Mat,
        mask: Mat,
        x: Int,
        y: Int,
        bandY: Int,
        bandHeight: Int
    ) {
        blendAtBand(accum, weights, image, mask, x, y, bandY, bandHeight)
        blendAtBand(accum, weights, image, mask, x - OUT_8K_W, y, bandY, bandHeight)
        blendAtBand(accum, weights, image, mask, x + OUT_8K_W, y, bandY, bandHeight)
    }

    private fun blendAtBand(
        accum: Mat,
        weights: Mat,
        image: Mat,
        mask: Mat,
        x: Int,
        y: Int,
        bandY: Int,
        bandHeight: Int
    ) {
        val dstX0 = max(0, x)
        val dstX1 = min(OUT_8K_W, x + image.cols())
        val globalY0 = max(bandY, y)
        val globalY1 = min(bandY + bandHeight, y + image.rows())

        if (dstX1 <= dstX0 || globalY1 <= globalY0) return

        val srcX0 = dstX0 - x
        val srcY0 = globalY0 - y
        val width = dstX1 - dstX0
        val height = globalY1 - globalY0
        val localY = globalY0 - bandY

        val srcRect = org.opencv.core.Rect(srcX0, srcY0, width, height)
        val dstRect = org.opencv.core.Rect(dstX0, localY, width, height)

        val imageRoi = Mat(image, srcRect)
        val maskRoi = Mat(mask, srcRect)
        val accumRoi = Mat(accum, dstRect)
        val weightRoi = Mat(weights, dstRect)

        val imageFloat = Mat()
        imageRoi.convertTo(imageFloat, CvType.CV_32FC3)

        val mask3 = Mat()
        Core.merge(listOf(maskRoi, maskRoi, maskRoi), mask3)

        val weighted = Mat()
        Core.multiply(imageFloat, mask3, weighted)
        Core.add(accumRoi, weighted, accumRoi)
        Core.add(weightRoi, maskRoi, weightRoi)

        weighted.release()
        mask3.release()
        imageFloat.release()
        imageRoi.release()
        maskRoi.release()
        accumRoi.release()
        weightRoi.release()
    }

    private fun load(file: File, maxDimension: Int = INPUT_MAX): Mat? {
        val bitmap = GhostFrameDecoder.decodeMaxDimension(file, maxDimension) ?: return null

        val rgba = Mat()
        Utils.bitmapToMat(bitmap, rgba)
        bitmap.recycle()

        val bgr = Mat()
        Imgproc.cvtColor(rgba, bgr, Imgproc.COLOR_RGBA2BGR)
        rgba.release()

        return bgr
    }

    private fun undistort(source: Mat, calibration: CameraCalibration): Mat {
        if (!calibration.hasIntrinsics || !calibration.hasDistortion) return source

        try {
            val sourceLandscape = source.cols() >= source.rows()
            val sensorLandscape = calibration.sensorPixelWidth >= calibration.sensorPixelHeight

            var fx = calibration.fx.toDouble()
            var fy = calibration.fy.toDouble()
            var cx = calibration.cx.toDouble()
            var cy = calibration.cy.toDouble()
            var refW = calibration.sensorPixelWidth.toDouble()
            var refH = calibration.sensorPixelHeight.toDouble()

            if (refW <= 0.0 || refH <= 0.0) return source

            if (sourceLandscape != sensorLandscape) {
                val oldFx = fx
                val oldCx = cx
                fx = fy
                fy = oldFx
                cx = cy
                cy = oldCx

                val oldW = refW
                refW = refH
                refH = oldW
            }

            val sx = source.cols().toDouble() / refW
            val sy = source.rows().toDouble() / refH

            fx *= sx
            fy *= sy
            cx *= sx
            cy *= sy

            val cameraMatrix = Mat.eye(3, 3, CvType.CV_64F)
            cameraMatrix.put(0, 0, fx)
            cameraMatrix.put(1, 1, fy)
            cameraMatrix.put(0, 2, cx)
            cameraMatrix.put(1, 2, cy)

            // Android exposes radial k1..k5. OpenCV's common 5-value model is
            // k1,k2,p1,p2,k3, so use radial k1/k2/k3 and zero tangential terms.
            val distortion = MatOfDouble(
                calibration.k1.toDouble(),
                calibration.k2.toDouble(),
                0.0,
                0.0,
                calibration.k3.toDouble()
            )

            val out = Mat()
            Calib3d.undistort(source, out, cameraMatrix, distortion)

            cameraMatrix.release()
            distortion.release()
            source.release()
            return out
        } catch (_: Throwable) {
            return source
        }
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

    private fun optimizeOrientations(frames: List<PanoramaFrame>): List<PanoramaFrame> {
        val sectorStep = 360.0 / 12.0
        val byRow = frames.groupBy { it.row }
        val result = ArrayList<PanoramaFrame>(frames.size)

        for ((row, rowFrames) in byRow) {
            val valid = rowFrames.filter { it.yawDeg.isFinite() }
            val center = if (valid.isNotEmpty()) valid.map { it.index }.average() else 0.0

            var sumX = 0.0
            var sumY = 0.0
            var sumXX = 0.0
            var sumXY = 0.0

            valid.forEach { frame ->
                val x = frame.index - center
                val nominal = frame.index * sectorStep
                val error = signedAngle(frame.yawDeg.toDouble() - nominal)
                sumX += x
                sumY += error
                sumXX += x * x
                sumXY += x * error
            }

            val n = valid.size.toDouble().coerceAtLeast(1.0)
            val denom = (sumXX - sumX * sumX / n)
            val slope = if (kotlin.math.abs(denom) > 1e-6) {
                (sumXY - sumX * sumY / n) / denom
            } else 0.0
            val bias = sumY / n - slope * (sumX / n)

            val nominalPitch = when (row) {
                0 -> 28.0
                1 -> 0.0
                else -> -28.0
            }

            rowFrames.forEach { frame ->
                val optimizedYaw = if (frame.yawDeg.isFinite()) {
                    val x = frame.index - center
                    val correction = (bias + slope * x).coerceIn(-12.0, 12.0)
                    normalize360(frame.yawDeg.toDouble() - correction).toFloat()
                } else {
                    normalize360(frame.index * sectorStep).toFloat()
                }

                val optimizedPitch = if (frame.pitchDeg.isFinite()) {
                    (frame.pitchDeg * 0.35f + nominalPitch.toFloat() * 0.65f)
                } else nominalPitch.toFloat()

                result += frame.copy(
                    yawDeg = optimizedYaw,
                    pitchDeg = optimizedPitch
                )
            }
        }

        return result.sortedWith(
            compareBy<PanoramaFrame> { it.row }.thenBy { it.index }
        )
    }

    private fun signedAngle(value: Double): Double {
        var d = (value + 180.0) % 360.0 - 180.0
        if (d < -180.0) d += 360.0
        return d
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

        // Multi-scale feather: broad gradients hide exposure/seam transitions,
        // while the original distance mask preserves local detail.
        val blurSmall = Mat()
        val blurLarge = Mat()
        Imgproc.GaussianBlur(
            dist,
            blurSmall,
            Size(0.0, 0.0),
            max(2.0, min(w, h) / 120.0)
        )
        Imgproc.GaussianBlur(
            dist,
            blurLarge,
            Size(0.0, 0.0),
            max(6.0, min(w, h) / 45.0)
        )

        val mixed = Mat()
        Core.addWeighted(dist, 0.55, blurSmall, 0.30, 0.0, mixed)
        Core.addWeighted(mixed, 1.0, blurLarge, 0.15, 0.0, mixed)

        blurSmall.release()
        blurLarge.release()
        dist.release()

        return mixed
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
