package ru.specdpo.object360

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import kotlin.math.atan2
import kotlin.math.min

class ManualAlignmentView(context: Context) : View(context) {

    var referenceBitmap: Bitmap? = null
        set(value) {
            field = value
            invalidate()
        }

    var currentBitmap: Bitmap? = null
        set(value) {
            field = value
            invalidate()
        }

    var transform = ManualFrameTransform()
        private set

    var referenceAlpha: Float = 0.38f
        set(value) {
            field = value.coerceIn(0f, 1f)
            invalidate()
        }

    var showGrid: Boolean = true
        set(value) {
            field = value
            invalidate()
        }

    var editable: Boolean = true
        set(value) {
            field = value
            invalidate()
        }

    var onTransformChanged: ((ManualFrameTransform) -> Unit)? = null

    private val frameRect = RectF()
    private val backgroundPaint = Paint().apply { color = Color.rgb(4, 8, 18) }
    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(1.5f)
        color = Color.argb(180, 117, 231, 214)
    }
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(1f)
        color = Color.argb(120, 255, 255, 255)
    }
    private val centerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(1.5f)
        color = Color.argb(220, 255, 183, 77)
    }
    private val bitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

    private var lastX = 0f
    private var lastY = 0f
    private var lastAngle: Float? = null

    private val scaleDetector = ScaleGestureDetector(
        context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                if (!editable) return false
                transform.scale = (transform.scale * detector.scaleFactor).coerceIn(0.2f, 4f)
                notifyChanged()
                return true
            }
        }
    )

    fun setTransform(value: ManualFrameTransform) {
        transform = value.normalized()
        invalidate()
    }

    fun resetTransform() {
        transform = ManualFrameTransform()
        notifyChanged()
    }

    fun nudge(dx: Float, dy: Float) {
        if (!editable) return
        transform.offsetX = (transform.offsetX + dx).coerceIn(-1.5f, 1.5f)
        transform.offsetY = (transform.offsetY + dy).coerceIn(-1.5f, 1.5f)
        notifyChanged()
    }

    fun zoomBy(factor: Float) {
        if (!editable) return
        transform.scale = (transform.scale * factor).coerceIn(0.2f, 4f)
        notifyChanged()
    }

    fun rotateBy(degrees: Float) {
        if (!editable) return
        transform.rotation = normalizeAngle(transform.rotation + degrees)
        notifyChanged()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backgroundPaint)

        val reference = referenceBitmap ?: return
        val current = currentBitmap ?: return

        updateFrameRect(reference)
        if (frameRect.width() <= 1f || frameRect.height() <= 1f) return

        canvas.save()
        canvas.clipRect(frameRect)
        canvas.translate(frameRect.left, frameRect.top)

        val sx = frameRect.width() / reference.width.coerceAtLeast(1)
        val sy = frameRect.height() / reference.height.coerceAtLeast(1)
        val viewScale = min(sx, sy)
        canvas.scale(viewScale, viewScale)

        val refW = reference.width.toFloat()
        val refH = reference.height.toFloat()

        val baseScale = min(
            refW / current.width.coerceAtLeast(1),
            refH / current.height.coerceAtLeast(1)
        )

        canvas.save()
        canvas.translate(
            refW * (0.5f + transform.offsetX),
            refH * (0.5f + transform.offsetY)
        )
        canvas.rotate(transform.rotation)
        val finalScale = baseScale * transform.scale
        canvas.scale(finalScale, finalScale)
        canvas.translate(-current.width / 2f, -current.height / 2f)
        bitmapPaint.alpha = 255
        canvas.drawBitmap(current, 0f, 0f, bitmapPaint)
        canvas.restore()

        if (reference !== current && referenceAlpha > 0.001f) {
            bitmapPaint.alpha = (255 * referenceAlpha).toInt().coerceIn(0, 255)
            canvas.drawBitmap(reference, 0f, 0f, bitmapPaint)
            bitmapPaint.alpha = 255
        }

        canvas.restore()

        if (showGrid) drawGrid(canvas)
        canvas.drawRect(frameRect, borderPaint)
    }

    private fun drawGrid(canvas: Canvas) {
        val left = frameRect.left
        val top = frameRect.top
        val right = frameRect.right
        val bottom = frameRect.bottom
        val w = frameRect.width()
        val h = frameRect.height()

        for (i in 1..3) {
            val x = left + w * i / 4f
            val y = top + h * i / 4f
            canvas.drawLine(x, top, x, bottom, gridPaint)
            canvas.drawLine(left, y, right, y, gridPaint)
        }

        val cx = frameRect.centerX()
        val cy = frameRect.centerY()
        canvas.drawLine(cx - dp(26f), cy, cx + dp(26f), cy, centerPaint)
        canvas.drawLine(cx, cy - dp(26f), cx, cy + dp(26f), centerPaint)
        canvas.drawCircle(cx, cy, dp(8f), centerPaint)
    }

    private fun updateFrameRect(reference: Bitmap) {
        val pad = dp(10f)
        val availableW = (width - pad * 2f).coerceAtLeast(1f)
        val availableH = (height - pad * 2f).coerceAtLeast(1f)
        val scale = min(
            availableW / reference.width.coerceAtLeast(1),
            availableH / reference.height.coerceAtLeast(1)
        )
        val w = reference.width * scale
        val h = reference.height * scale
        val left = (width - w) / 2f
        val top = (height - h) / 2f
        frameRect.set(left, top, left + w, top + h)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!editable) return true
        scaleDetector.onTouchEvent(event)

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.x
                lastY = event.y
                lastAngle = null
                parent?.requestDisallowInterceptTouchEvent(true)
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                if (event.pointerCount >= 2) {
                    lastAngle = pointerAngle(event)
                }
            }

            MotionEvent.ACTION_MOVE -> {
                if (event.pointerCount >= 2) {
                    val angle = pointerAngle(event)
                    val previous = lastAngle
                    if (previous != null) {
                        val delta = shortestAngle(angle - previous)
                        if (kotlin.math.abs(delta) < 12f) {
                            transform.rotation = normalizeAngle(transform.rotation + delta)
                            notifyChanged()
                        }
                    }
                    lastAngle = angle
                } else if (!scaleDetector.isInProgress && frameRect.width() > 0f && frameRect.height() > 0f) {
                    val dx = event.x - lastX
                    val dy = event.y - lastY
                    transform.offsetX = (transform.offsetX + dx / frameRect.width()).coerceIn(-1.5f, 1.5f)
                    transform.offsetY = (transform.offsetY + dy / frameRect.height()).coerceIn(-1.5f, 1.5f)
                    notifyChanged()
                    lastX = event.x
                    lastY = event.y
                }
            }

            MotionEvent.ACTION_POINTER_UP -> {
                lastAngle = null
                if (event.pointerCount > 1) {
                    val remainingIndex = if (event.actionIndex == 0) 1 else 0
                    lastX = event.getX(remainingIndex)
                    lastY = event.getY(remainingIndex)
                }
            }

            MotionEvent.ACTION_UP,
            MotionEvent.ACTION_CANCEL -> {
                lastAngle = null
                parent?.requestDisallowInterceptTouchEvent(false)
            }
        }

        return true
    }

    private fun pointerAngle(event: MotionEvent): Float {
        if (event.pointerCount < 2) return 0f
        val dx = event.getX(1) - event.getX(0)
        val dy = event.getY(1) - event.getY(0)
        return Math.toDegrees(atan2(dy.toDouble(), dx.toDouble())).toFloat()
    }

    private fun shortestAngle(value: Float): Float {
        var result = value
        while (result > 180f) result -= 360f
        while (result < -180f) result += 360f
        return result
    }

    private fun normalizeAngle(value: Float): Float {
        var result = value
        while (result > 180f) result -= 360f
        while (result < -180f) result += 360f
        return result
    }

    private fun notifyChanged() {
        transform = transform.normalized()
        invalidate()
        onTransformChanged?.invoke(transform.copy())
    }

    private fun dp(value: Float): Float = value * resources.displayMetrics.density
}
