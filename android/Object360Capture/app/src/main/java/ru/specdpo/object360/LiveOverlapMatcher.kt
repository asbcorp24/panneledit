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
import org.opencv.core.MatOfPoint2f
import org.opencv.features2d.BFMatcher
import org.opencv.features2d.ORB
import org.opencv.imgproc.Imgproc
import java.io.File

data class LiveOverlapResult(
    val matches: Int = 0,
    val inliers: Int = 0,
    val inlierRatio: Float = 0f,
    val good: Boolean = false,
    val points: List<Pair<Float, Float>> = emptyList(),
    val frameWidth: Int = 1,
    val frameHeight: Int = 1
)

object LiveOverlapMatcher {
    fun compare(previous: File, current: Bitmap): LiveOverlapResult {
        if (!OpenCVLoader.initLocal()) return LiveOverlapResult()
        val previousBitmap = GhostFrameDecoder.decodeMaxDimension(previous, 720)
            ?: return LiveOverlapResult()
        return try {
            val a = gray(previousBitmap)
            val b = gray(current)
            try { compareGray(a, b) } finally { a.release(); b.release() }
        } finally {
            previousBitmap.recycle()
        }
    }

    private fun gray(bitmap: Bitmap): Mat {
        val rgba = Mat()
        Utils.bitmapToMat(bitmap, rgba)
        val gray = Mat()
        Imgproc.cvtColor(rgba, gray, Imgproc.COLOR_RGBA2GRAY)
        rgba.release()
        if (gray.cols() > 720) {
            val scaled = Mat()
            val scale = 720.0 / gray.cols()
            Imgproc.resize(gray, scaled, org.opencv.core.Size(720.0, gray.rows() * scale))
            gray.release()
            return scaled
        }
        return gray
    }

    private fun compareGray(a: Mat, b: Mat): LiveOverlapResult {
        val orb = ORB.create(1800)
        val ka = MatOfKeyPoint(); val kb = MatOfKeyPoint()
        val da = Mat(); val db = Mat()
        try {
            orb.detectAndCompute(a, Mat(), ka, da)
            orb.detectAndCompute(b, Mat(), kb, db)
            if (da.empty() || db.empty()) return LiveOverlapResult()

            val matcher = BFMatcher.create(Core.NORM_HAMMING, false)
            val knn = ArrayList<MatOfDMatch>()
            matcher.knnMatch(da, db, knn, 2)
            val good = knn.mapNotNull { row ->
                val x = row.toArray()
                if (x.size >= 2 && x[0].distance < x[1].distance * 0.76f) x[0] else null
            }
            knn.forEach { it.release() }
            if (good.size < 16) return LiveOverlapResult(good.size, 0, 0f, false)

            val p1 = ka.toArray(); val p2 = kb.toArray()
            val src = MatOfPoint2f(*good.map { p1[it.queryIdx].pt }.toTypedArray())
            val dst = MatOfPoint2f(*good.map { p2[it.trainIdx].pt }.toTypedArray())
            val mask = Mat()
            val h = Calib3d.findHomography(src, dst, Calib3d.RANSAC, 3.0, mask, 1200, 0.995)
            val maskBytes = ByteArray(mask.rows().coerceAtLeast(0))
            if (!mask.empty() && maskBytes.isNotEmpty()) mask.get(0, 0, maskBytes)
            val currentPoints = good.mapIndexedNotNull { index, match ->
                if (index < maskBytes.size && maskBytes[index].toInt() != 0) {
                    val pt = p2[match.trainIdx].pt
                    pt.x.toFloat() to pt.y.toFloat()
                } else null
            }
            val inliers = currentPoints.size
            val ratio = if (good.isEmpty()) 0f else inliers.toFloat() / good.size
            h.release(); mask.release(); src.release(); dst.release()
            return LiveOverlapResult(
                good.size, inliers, ratio,
                inliers >= 12 && ratio >= 0.38f,
                currentPoints, b.cols(), b.rows()
            )
        } catch (_: Throwable) {
            return LiveOverlapResult()
        } finally {
            ka.release(); kb.release(); da.release(); db.release(); orb.clear()
        }
    }
}
