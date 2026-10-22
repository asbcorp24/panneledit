package ru.specdpo.object360

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import kotlin.math.max
import kotlin.math.min

class ZoomablePanoramaView(context: Context, private val bitmap: Bitmap) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val matrix = Matrix()
    private var scale = 1f
    private var minScale = 1f
    private var maxScale = 6f
    private var tx = 0f
    private var ty = 0f

    private val scaler = ScaleGestureDetector(context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                val old = scale
                scale = (scale * detector.scaleFactor).coerceIn(minScale, maxScale)
                val ratio = scale / old
                tx = detector.focusX - (detector.focusX - tx) * ratio
                ty = detector.focusY - (detector.focusY - ty) * ratio
                clamp()
                invalidate()
                return true
            }
        })

    private val gestures = GestureDetector(context,
        object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean = true
            override fun onScroll(e1: MotionEvent?, e2: MotionEvent, dx: Float, dy: Float): Boolean {
                if (!scaler.isInProgress) {
                    tx -= dx; ty -= dy
                    clamp(); invalidate()
                }
                return true
            }
            override fun onDoubleTap(e: MotionEvent): Boolean {
                if (scale > minScale * 1.15f) reset() else {
                    val target = (minScale * 2.2f).coerceAtMost(maxScale)
                    val ratio = target / scale
                    tx = e.x - (e.x - tx) * ratio
                    ty = e.y - (e.y - ty) * ratio
                    scale = target
                    clamp(); invalidate()
                }
                return true
            }
        })

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        if (w <= 0 || h <= 0) return
        minScale = min(w.toFloat() / bitmap.width, h.toFloat() / bitmap.height)
        maxScale = max(6f, minScale * 6f)
        reset()
    }

    private fun reset() {
        scale = minScale
        tx = (width - bitmap.width * scale) / 2f
        ty = (height - bitmap.height * scale) / 2f
        invalidate()
    }

    private fun clamp() {
        val sw = bitmap.width * scale
        val sh = bitmap.height * scale
        tx = if (sw <= width) (width - sw) / 2f else tx.coerceIn(width - sw, 0f)
        ty = if (sh <= height) (height - sh) / 2f else ty.coerceIn(height - sh, 0f)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        matrix.reset()
        matrix.postScale(scale, scale)
        matrix.postTranslate(tx, ty)
        canvas.drawBitmap(bitmap, matrix, paint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaler.onTouchEvent(event)
        gestures.onTouchEvent(event)
        return true
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        if (!bitmap.isRecycled) bitmap.recycle()
    }
}
