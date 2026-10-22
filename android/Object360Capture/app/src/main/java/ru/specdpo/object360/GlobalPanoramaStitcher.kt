package ru.specdpo.object360

import android.graphics.Bitmap
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.calib3d.Calib3d
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfDMatch
import org.opencv.core.MatOfKeyPoint
import org.opencv.core.MatOfPoint
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Rect
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.features2d.BFMatcher
import org.opencv.features2d.ORB
import org.opencv.imgproc.Imgproc
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

object GlobalPanoramaStitcher {
    private const val ANALYSIS_MAX = 2000
    private const val RENDER_MAX = 3600
    private const val MIN_MATCHES = 22
    private const val MIN_INLIERS = 12
    private const val MIN_INLIER_RATIO = 0.32
    private const val MAX_W = 14000
    private const val MAX_H = 9000

    fun stitch(
        files: List<File>,
        output: File,
        onProgress: (String) -> Unit = {}
    ): Boolean {
        if (files.size < 2 || !OpenCVLoader.initLocal()) return false

        val analysis = mutableListOf<Mat>()
        val render = mutableListOf<Mat>()
        val pairwise = mutableListOf<Mat>()
        val transformsA = mutableListOf<Mat>()
        val transformsR = mutableListOf<Mat>()

        try {
            files.forEachIndexed { i, file ->
                onProgress("OpenCV: подготовка " + (i + 1) + "/" + files.size)
                analysis += load(file, ANALYSIS_MAX)
                    ?: throw IllegalStateException("Не удалось открыть " + file.name)
                render += load(file, RENDER_MAX)
                    ?: throw IllegalStateException("Не удалось открыть " + file.name)
            }

            for (i in 0 until analysis.lastIndex) {
                onProgress("OpenCV: совмещение " + (i + 1) + "↔" + (i + 2))
                pairwise += estimateNextToPrev(analysis[i], analysis[i + 1])
                    ?: throw IllegalStateException("Плохое перекрытие")
            }

            val center = files.size / 2
            transformsA += buildTransforms(pairwise, files.size, center)

            for (i in files.indices) {
                val sx = render[i].cols().toDouble() / analysis[i].cols().toDouble()
                val sy = render[i].rows().toDouble() / analysis[i].rows().toDouble()
                transformsR += scaleHomography(transformsA[i], sx, sy)
            }

            val bounds = canvasBounds(render, transformsR)
                ?: throw IllegalStateException("Некорректная геометрия")

            if (bounds.w <= 0 || bounds.h <= 0 || bounds.w > MAX_W || bounds.h > MAX_H) {
                throw IllegalStateException("Некорректный размер холста")
            }

            onProgress("OpenCV: компенсация экспозиции")
            compensateExposure(render)

            onProgress("OpenCV: многомасштабная склейка")
            var result = featherBlend(render, transformsR, bounds)

            onProgress("OpenCV: обрезка")
            result = crop(result)
            save(result, output)
            result.release()
            return true
        } catch (_: Exception) {
            return false
        } finally {
            analysis.forEach { if (!it.empty()) it.release() }
            render.forEach { if (!it.empty()) it.release() }
            pairwise.forEach { if (!it.empty()) it.release() }
            transformsA.forEach { if (!it.empty()) it.release() }
            transformsR.forEach { if (!it.empty()) it.release() }
        }
    }

    private data class Bounds(
        val minX: Double,
        val minY: Double,
        val maxX: Double,
        val maxY: Double,
        val w: Int,
        val h: Int
    )

    private fun load(file: File, maxDim: Int): Mat? {
        val bitmap = GhostFrameDecoder.decodeMaxDimension(file, maxDim) ?: return null
        val rgba = Mat()
        Utils.bitmapToMat(bitmap, rgba)
        bitmap.recycle()
        val bgr = Mat()
        Imgproc.cvtColor(rgba, bgr, Imgproc.COLOR_RGBA2BGR)
        rgba.release()
        return bgr
    }

    private fun estimateNextToPrev(prev: Mat, next: Mat): Mat? {
        val g0 = Mat()
        val g1 = Mat()
        Imgproc.cvtColor(prev, g0, Imgproc.COLOR_BGR2GRAY)
        Imgproc.cvtColor(next, g1, Imgproc.COLOR_BGR2GRAY)

        val clahe = Imgproc.createCLAHE(2.0, Size(8.0, 8.0))
        val e0 = Mat()
        val e1 = Mat()
        clahe.apply(g0, e0)
        clahe.apply(g1, e1)
        g0.release()
        g1.release()

        val orb = ORB.create(8000)
        val kp0 = MatOfKeyPoint()
        val kp1 = MatOfKeyPoint()
        val d0 = Mat()
        val d1 = Mat()
        orb.detectAndCompute(e0, Mat(), kp0, d0)
        orb.detectAndCompute(e1, Mat(), kp1, d1)
        e0.release()
        e1.release()

        if (d0.empty() || d1.empty()) {
            kp0.release()
            kp1.release()
            d0.release()
            d1.release()
            return null
        }

        val matcher = BFMatcher.create(Core.NORM_HAMMING, false)
        val fwd = ArrayList<MatOfDMatch>()
        val rev = ArrayList<MatOfDMatch>()
        matcher.knnMatch(d0, d1, fwd, 2)
        matcher.knnMatch(d1, d0, rev, 2)

        val k0 = kp0.toArray()
        val k1 = kp1.toArray()
        val reverseBest = HashMap<Int, Int>()

        for (pair in rev) {
            val m = pair.toArray()
            if (m.size >= 2 && m[0].distance < m[1].distance * 0.78f) {
                reverseBest[m[0].queryIdx] = m[0].trainIdx
            }
            pair.release()
        }

        val srcNext = ArrayList<Point>()
        val dstPrev = ArrayList<Point>()

        for (pair in fwd) {
            val m = pair.toArray()
            if (m.size >= 2 && m[0].distance < m[1].distance * 0.78f) {
                val best = m[0]
                if (
                    reverseBest[best.trainIdx] == best.queryIdx &&
                    best.queryIdx in k0.indices &&
                    best.trainIdx in k1.indices
                ) {
                    dstPrev += k0[best.queryIdx].pt
                    srcNext += k1[best.trainIdx].pt
                }
            }
            pair.release()
        }

        kp0.release()
        kp1.release()
        d0.release()
        d1.release()

        if (srcNext.size < MIN_MATCHES) return null

        val src = MatOfPoint2f().apply { fromList(srcNext) }
        val dst = MatOfPoint2f().apply { fromList(dstPrev) }
        val mask = Mat()
        val h = Calib3d.findHomography(
            src,
            dst,
            Calib3d.RANSAC,
            3.0,
            mask,
            3000,
            0.995
        )
        src.release()
        dst.release()

        if (h.empty()) {
            mask.release()
            h.release()
            return null
        }

        val inliers = Core.countNonZero(mask)
        val ratio = inliers.toDouble() / srcNext.size.toDouble()
        mask.release()

        if (inliers < MIN_INLIERS || ratio < MIN_INLIER_RATIO || !sane(h, next)) {
            h.release()
            return null
        }

        return h
    }

    private fun sane(h: Mat, image: Mat): Boolean {
        val src = MatOfPoint2f(
            Point(0.0, 0.0),
            Point(image.cols().toDouble(), 0.0),
            Point(image.cols().toDouble(), image.rows().toDouble()),
            Point(0.0, image.rows().toDouble())
        )
        val dst = MatOfPoint2f()
        return try {
            Core.perspectiveTransform(src, dst, h)
            val p = dst.toArray()
            if (p.size != 4 || p.any { !it.x.isFinite() || !it.y.isFinite() }) return false
            val top = dist(p[0], p[1])
            val bottom = dist(p[3], p[2])
            val left = dist(p[0], p[3])
            val right = dist(p[1], p[2])
            val w = image.cols().toDouble()
            val hh = image.rows().toDouble()
            top in (w * 0.35)..(w * 2.8) &&
                bottom in (w * 0.35)..(w * 2.8) &&
                left in (hh * 0.35)..(hh * 2.8) &&
                right in (hh * 0.35)..(hh * 2.8)
        } finally {
            src.release()
            dst.release()
        }
    }

    private fun dist(a: Point, b: Point): Double {
        val dx = a.x - b.x
        val dy = a.y - b.y
        return sqrt(dx * dx + dy * dy)
    }

    private fun buildTransforms(pairwise: List<Mat>, count: Int, center: Int): List<Mat> {
        val out = MutableList(count) { Mat.eye(3, 3, CvType.CV_64F) }

        for (i in center + 1 until count) {
            val next = mul(out[i - 1], pairwise[i - 1])
            out[i].release()
            out[i] = next
        }

        for (i in center - 1 downTo 0) {
            val inv = pairwise[i].inv()
            val next = mul(out[i + 1], inv)
            inv.release()
            out[i].release()
            out[i] = next
        }

        return out
    }

    private fun mul(a: Mat, b: Mat): Mat {
        val out = Mat()
        val empty = Mat()
        Core.gemm(a, b, 1.0, empty, 0.0, out)
        empty.release()
        return out
    }

    private fun scaleHomography(h: Mat, sx: Double, sy: Double): Mat {
        val s = Mat.eye(3, 3, CvType.CV_64F)
        s.put(0, 0, sx)
        s.put(1, 1, sy)

        val inv = Mat.eye(3, 3, CvType.CV_64F)
        inv.put(0, 0, 1.0 / sx)
        inv.put(1, 1, 1.0 / sy)

        val t = mul(s, h)
        val out = mul(t, inv)
        s.release()
        inv.release()
        t.release()
        return out
    }

    private fun canvasBounds(images: List<Mat>, transforms: List<Mat>): Bounds? {
        var minX = Double.POSITIVE_INFINITY
        var minY = Double.POSITIVE_INFINITY
        var maxX = Double.NEGATIVE_INFINITY
        var maxY = Double.NEGATIVE_INFINITY

        for (i in images.indices) {
            val src = MatOfPoint2f(
                Point(0.0, 0.0),
                Point(images[i].cols().toDouble(), 0.0),
                Point(images[i].cols().toDouble(), images[i].rows().toDouble()),
                Point(0.0, images[i].rows().toDouble())
            )
            val dst = MatOfPoint2f()
            Core.perspectiveTransform(src, dst, transforms[i])
            src.release()

            val p = dst.toArray()
            dst.release()
            if (p.any { !it.x.isFinite() || !it.y.isFinite() }) return null

            for (point in p) {
                minX = min(minX, point.x)
                minY = min(minY, point.y)
                maxX = max(maxX, point.x)
                maxY = max(maxY, point.y)
            }
        }

        minX -= 8.0
        minY -= 8.0
        maxX += 8.0
        maxY += 8.0

        return Bounds(
            minX,
            minY,
            maxX,
            maxY,
            (maxX - minX).roundToInt(),
            (maxY - minY).roundToInt()
        )
    }

    private fun compensateExposure(images: List<Mat>) {
        if (images.size < 2) return

        val luminance = images.map { image ->
            val gray = Mat()
            Imgproc.cvtColor(image, gray, Imgproc.COLOR_BGR2GRAY)
            val value = Core.mean(gray).`val`[0]
            gray.release()
            value
        }

        val valid = luminance.filter { it.isFinite() && it > 2.0 }.sorted()
        if (valid.isEmpty()) return
        val target = valid[valid.size / 2]

        images.forEachIndexed { index, image ->
            val current = luminance[index]
            if (!current.isFinite() || current <= 2.0) return@forEachIndexed
            val gain = (target / current).coerceIn(0.72, 1.38)
            if (kotlin.math.abs(gain - 1.0) > 0.015) {
                image.convertTo(image, -1, gain, 0.0)
            }
        }
    }

    private fun featherBlend(images: List<Mat>, transforms: List<Mat>, b: Bounds): Mat {
        val translation = Mat.eye(3, 3, CvType.CV_64F)
        translation.put(0, 2, -b.minX)
        translation.put(1, 2, -b.minY)

        val accum = Mat.zeros(b.h, b.w, CvType.CV_32FC3)
        val weights = Mat.zeros(b.h, b.w, CvType.CV_32FC1)
        val size = Size(b.w.toDouble(), b.h.toDouble())

        for (i in images.indices) {
            val transform = mul(translation, transforms[i])

            val warped = Mat.zeros(b.h, b.w, CvType.CV_8UC3)
            Imgproc.warpPerspective(
                images[i],
                warped,
                transform,
                size,
                Imgproc.INTER_LINEAR,
                Core.BORDER_CONSTANT,
                Scalar.all(0.0)
            )

            val srcMask = Mat(images[i].rows(), images[i].cols(), CvType.CV_8UC1, Scalar(255.0))
            val mask = Mat.zeros(b.h, b.w, CvType.CV_8UC1)
            Imgproc.warpPerspective(
                srcMask,
                mask,
                transform,
                size,
                Imgproc.INTER_NEAREST,
                Core.BORDER_CONSTANT,
                Scalar.all(0.0)
            )
            srcMask.release()
            transform.release()

            val dist = Mat()
            Imgproc.distanceTransform(mask, dist, Imgproc.DIST_L2, 3)
            val maxVal = Core.minMaxLoc(dist).maxVal
            if (maxVal > 0.0) Core.divide(dist, Scalar(maxVal), dist)
            Core.max(dist, Scalar(0.03), dist)

            // Широкая многомасштабная маска заметно уменьшает видимые стыки:
            // мелкий уровень сохраняет детали, крупный сглаживает переход экспозиции.
            val fine = Mat()
            val coarse = Mat()
            Imgproc.GaussianBlur(dist, fine, Size(0.0, 0.0), 3.0)
            Imgproc.GaussianBlur(dist, coarse, Size(0.0, 0.0), 11.0)
            Core.addWeighted(dist, 0.55, fine, 0.30, 0.0, dist)
            Core.addWeighted(dist, 1.0, coarse, 0.15, 0.0, dist)
            fine.release()
            coarse.release()

            val warpedF = Mat()
            warped.convertTo(warpedF, CvType.CV_32FC3)

            val weight3 = Mat()
            Core.merge(listOf(dist, dist, dist), weight3)

            val weighted = Mat()
            Core.multiply(warpedF, weight3, weighted)
            Core.add(accum, weighted, accum)
            Core.add(weights, dist, weights)

            warped.release()
            mask.release()
            dist.release()
            warpedF.release()
            weight3.release()
            weighted.release()
        }

        translation.release()

        val safe = Mat()
        Core.max(weights, Scalar(1e-5), safe)
        val safe3 = Mat()
        Core.merge(listOf(safe, safe, safe), safe3)

        val outF = Mat()
        Core.divide(accum, safe3, outF)

        val out = Mat()
        outF.convertTo(out, CvType.CV_8UC3)

        accum.release()
        weights.release()
        safe.release()
        safe3.release()
        outF.release()

        return out
    }

    private fun crop(source: Mat): Mat {
        val gray = Mat()
        Imgproc.cvtColor(source, gray, Imgproc.COLOR_BGR2GRAY)
        val mask = Mat()
        Imgproc.threshold(gray, mask, 3.0, 255.0, Imgproc.THRESH_BINARY)
        gray.release()

        val nz = MatOfPoint()
        Core.findNonZero(mask, nz)
        mask.release()

        if (nz.empty()) {
            nz.release()
            return source
        }

        val r: Rect = Imgproc.boundingRect(nz)
        nz.release()
        if (r.width <= 0 || r.height <= 0) return source

        val out = Mat(source, r).clone()
        source.release()
        return out
    }

    private fun save(mat: Mat, output: File) {
        output.parentFile?.mkdirs()
        val rgba = Mat()
        Imgproc.cvtColor(mat, rgba, Imgproc.COLOR_BGR2RGBA)
        val bitmap = Bitmap.createBitmap(rgba.cols(), rgba.rows(), Bitmap.Config.ARGB_8888)
        Utils.matToBitmap(rgba, bitmap)
        rgba.release()

        FileOutputStream(output).use {
            bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it)
        }
        bitmap.recycle()
    }
}
