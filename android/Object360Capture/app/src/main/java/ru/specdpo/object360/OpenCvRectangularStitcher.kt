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

object OpenCvRectangularStitcher {
    private const val MAX_INPUT_DIMENSION = 1600
    private const val MAX_CANVAS_WIDTH = 10000
    private const val MIN_GOOD_MATCHES = 14
    private const val RATIO_TEST = 0.76f

    fun stitch(
        files: List<File>,
        output: File,
        onProgress: (String) -> Unit = {}
    ): Boolean {
        if (files.size < 2) return false
        if (!OpenCVLoader.initLocal()) return false

        var panorama = loadOrientedMat(files.first()) ?: return false

        try {
            files.drop(1).forEachIndexed { i, file ->
                onProgress("OpenCV: совмещение кадра ${i + 2}/${files.size}")
                val next = loadOrientedMat(file)
                    ?: throw IllegalStateException("Не удалось открыть ${file.name}")

                val merged = mergePair(panorama, next)
                next.release()

                if (merged == null) {
                    throw IllegalStateException(
                        "Недостаточно общих деталей между кадрами ${i + 1} и ${i + 2}"
                    )
                }

                panorama.release()
                panorama = limitWidth(merged, MAX_CANVAS_WIDTH)
            }

            onProgress("OpenCV: обрезка пустых полей")
            val cropped = cropEmptyBorders(panorama)
            if (cropped !== panorama) {
                panorama.release()
                panorama = cropped
            }

            output.parentFile?.mkdirs()
            val rgba = Mat()
            Imgproc.cvtColor(panorama, rgba, Imgproc.COLOR_BGR2RGBA)
            val bitmap = Bitmap.createBitmap(rgba.cols(), rgba.rows(), Bitmap.Config.ARGB_8888)
            Utils.matToBitmap(rgba, bitmap)
            rgba.release()

            FileOutputStream(output).use {
                bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it)
            }
            bitmap.recycle()
            return true
        } catch (_: Exception) {
            return false
        } finally {
            if (!panorama.empty()) panorama.release()
        }
    }

    private fun loadOrientedMat(file: File): Mat? {
        val bitmap = GhostFrameDecoder.decodeMaxDimension(file, MAX_INPUT_DIMENSION)
            ?: return null

        val rgba = Mat()
        Utils.bitmapToMat(bitmap, rgba)
        bitmap.recycle()

        val bgr = Mat()
        Imgproc.cvtColor(rgba, bgr, Imgproc.COLOR_RGBA2BGR)
        rgba.release()
        return bgr
    }

    private fun mergePair(left: Mat, right: Mat): Mat? {
        val grayLeft = Mat()
        val grayRight = Mat()
        Imgproc.cvtColor(left, grayLeft, Imgproc.COLOR_BGR2GRAY)
        Imgproc.cvtColor(right, grayRight, Imgproc.COLOR_BGR2GRAY)

        val orb = ORB.create(3500)
        val kpLeft = MatOfKeyPoint()
        val kpRight = MatOfKeyPoint()
        val descLeft = Mat()
        val descRight = Mat()

        orb.detectAndCompute(grayLeft, Mat(), kpLeft, descLeft)
        orb.detectAndCompute(grayRight, Mat(), kpRight, descRight)
        grayLeft.release()
        grayRight.release()

        if (descLeft.empty() || descRight.empty()) {
            kpLeft.release()
            kpRight.release()
            descLeft.release()
            descRight.release()
            return null
        }

        val matcher = BFMatcher.create(Core.NORM_HAMMING, false)
        val knn = ArrayList<MatOfDMatch>()
        matcher.knnMatch(descLeft, descRight, knn, 2)

        val leftKeys = kpLeft.toArray()
        val rightKeys = kpRight.toArray()
        val srcRight = ArrayList<Point>()
        val dstLeft = ArrayList<Point>()

        for (pair in knn) {
            val matches = pair.toArray()
            if (matches.size >= 2 && matches[0].distance < matches[1].distance * RATIO_TEST) {
                val m = matches[0]
                if (m.queryIdx in leftKeys.indices && m.trainIdx in rightKeys.indices) {
                    dstLeft.add(leftKeys[m.queryIdx].pt)
                    srcRight.add(rightKeys[m.trainIdx].pt)
                }
            }
            pair.release()
        }

        kpLeft.release()
        kpRight.release()
        descLeft.release()
        descRight.release()

        if (srcRight.size < MIN_GOOD_MATCHES) return null

        val src = MatOfPoint2f()
        val dst = MatOfPoint2f()
        src.fromList(srcRight)
        dst.fromList(dstLeft)

        val inlierMask = Mat()
        val h = Calib3d.findHomography(src, dst, Calib3d.RANSAC, 4.0, inlierMask)
        src.release()
        dst.release()

        val inliers = Core.countNonZero(inlierMask)
        inlierMask.release()
        if (h.empty() || inliers < 10) {
            h.release()
            return null
        }

        val rightCorners = MatOfPoint2f(
            Point(0.0, 0.0),
            Point(right.cols().toDouble(), 0.0),
            Point(right.cols().toDouble(), right.rows().toDouble()),
            Point(0.0, right.rows().toDouble())
        )
        val warpedCorners = MatOfPoint2f()
        Core.perspectiveTransform(rightCorners, warpedCorners, h)
        rightCorners.release()

        val pts = warpedCorners.toArray()
        warpedCorners.release()

        var minX = 0.0
        var minY = 0.0
        var maxX = left.cols().toDouble()
        var maxY = left.rows().toDouble()

        for (p in pts) {
            minX = min(minX, p.x)
            minY = min(minY, p.y)
            maxX = max(maxX, p.x)
            maxY = max(maxY, p.y)
        }

        val tx = if (minX < 0.0) -minX else 0.0
        val ty = if (minY < 0.0) -minY else 0.0
        val canvasW = (maxX + tx).roundToInt().coerceAtLeast(left.cols())
        val canvasH = (maxY + ty).roundToInt().coerceAtLeast(left.rows())

        if (canvasW <= 0 || canvasH <= 0 || canvasW > 14000 || canvasH > 9000) {
            h.release()
            return null
        }

        val translation = Mat.eye(3, 3, CvType.CV_64F)
        translation.put(0, 2, tx)
        translation.put(1, 2, ty)

        val rightTransform = Mat()
        val empty = Mat()
        Core.gemm(translation, h, 1.0, empty, 0.0, rightTransform)
        empty.release()
        h.release()

        val size = Size(canvasW.toDouble(), canvasH.toDouble())
        val warpedLeft = Mat.zeros(canvasH, canvasW, left.type())
        val warpedRight = Mat.zeros(canvasH, canvasW, right.type())

        Imgproc.warpPerspective(left, warpedLeft, translation, size)
        Imgproc.warpPerspective(right, warpedRight, rightTransform, size)

        val maskLeftSrc = Mat(left.rows(), left.cols(), CvType.CV_8UC1, Scalar(255.0))
        val maskRightSrc = Mat(right.rows(), right.cols(), CvType.CV_8UC1, Scalar(255.0))
        val maskLeft = Mat.zeros(canvasH, canvasW, CvType.CV_8UC1)
        val maskRight = Mat.zeros(canvasH, canvasW, CvType.CV_8UC1)

        Imgproc.warpPerspective(maskLeftSrc, maskLeft, translation, size)
        Imgproc.warpPerspective(maskRightSrc, maskRight, rightTransform, size)
        maskLeftSrc.release()
        maskRightSrc.release()
        translation.release()
        rightTransform.release()

        val overlap = Mat()
        val notLeft = Mat()
        val notRight = Mat()
        val leftOnly = Mat()
        val rightOnly = Mat()
        Core.bitwise_and(maskLeft, maskRight, overlap)
        Core.bitwise_not(maskLeft, notLeft)
        Core.bitwise_not(maskRight, notRight)
        Core.bitwise_and(maskLeft, notRight, leftOnly)
        Core.bitwise_and(maskRight, notLeft, rightOnly)

        val result = Mat.zeros(canvasH, canvasW, left.type())
        warpedLeft.copyTo(result, leftOnly)
        warpedRight.copyTo(result, rightOnly)

        val average = Mat()
        Core.addWeighted(warpedLeft, 0.5, warpedRight, 0.5, 0.0, average)
        average.copyTo(result, overlap)

        warpedLeft.release()
        warpedRight.release()
        maskLeft.release()
        maskRight.release()
        overlap.release()
        notLeft.release()
        notRight.release()
        leftOnly.release()
        rightOnly.release()
        average.release()

        return result
    }

    private fun cropEmptyBorders(source: Mat): Mat {
        val gray = Mat()
        Imgproc.cvtColor(source, gray, Imgproc.COLOR_BGR2GRAY)
        val mask = Mat()
        Imgproc.threshold(gray, mask, 2.0, 255.0, Imgproc.THRESH_BINARY)
        gray.release()

        val kernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(7.0, 7.0))
        Imgproc.morphologyEx(mask, mask, Imgproc.MORPH_CLOSE, kernel)
        kernel.release()

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
        return Mat(source, r).clone()
    }

    private fun limitWidth(source: Mat, maxWidth: Int): Mat {
        if (source.cols() <= maxWidth) return source
        val scale = maxWidth.toDouble() / source.cols().toDouble()
        val out = Mat()
        Imgproc.resize(
            source,
            out,
            Size(maxWidth.toDouble(), max(1.0, source.rows() * scale)),
            0.0,
            0.0,
            Imgproc.INTER_AREA
        )
        source.release()
        return out
    }
}
