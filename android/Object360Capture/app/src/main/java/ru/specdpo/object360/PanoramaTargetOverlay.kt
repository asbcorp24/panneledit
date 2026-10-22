package ru.specdpo.object360

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View
import kotlin.math.abs

class PanoramaTargetOverlay(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var visibleTarget = false
    private var errorDeg = 0f
    private var maxErrorDeg = 35f
    private var pitchErrorDeg = 0f
    private var ready = false

    fun update(errorDeg: Float, maxErrorDeg: Float, pitchErrorDeg: Float, ready: Boolean) {
        visibleTarget = true
        this.errorDeg = errorDeg
        this.maxErrorDeg = maxErrorDeg.coerceAtLeast(10f)
        this.pitchErrorDeg = pitchErrorDeg
        this.ready = ready
        postInvalidateOnAnimation()
    }

    fun clear() {
        visibleTarget = false
        postInvalidateOnAnimation()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (!visibleTarget) return

        val cx = width / 2f
        val cy = height / 2f
        val radius = (width.coerceAtMost(height) * 0.045f).coerceAtLeast(22f)
        val range = width * 0.36f
        val dx = (errorDeg / maxErrorDeg).coerceIn(-1f, 1f) * range
        val dy = (pitchErrorDeg / 18f).coerceIn(-1f, 1f) * height * 0.16f
        val tx = cx + dx
        val ty = cy + dy

        paint.strokeWidth = 4f
        paint.style = Paint.Style.STROKE
        paint.color = Color.argb(210, 255, 255, 255)
        canvas.drawCircle(cx, cy, radius, paint)
        canvas.drawLine(cx - radius * 1.5f, cy, cx + radius * 1.5f, cy, paint)
        canvas.drawLine(cx, cy - radius * 1.5f, cx, cy + radius * 1.5f, paint)

        val close = abs(errorDeg) < 5f && abs(pitchErrorDeg) < 5f
        paint.color = when {
            ready -> Color.rgb(70, 230, 120)
            close -> Color.rgb(255, 196, 70)
            else -> Color.WHITE
        }
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = if (ready) 8f else 5f
        canvas.drawLine(cx, cy, tx, ty, paint)

        paint.style = Paint.Style.FILL
        canvas.drawCircle(tx, ty, if (ready) radius * 0.72f else radius * 0.58f, paint)

        if (ready) {
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 7f
            canvas.drawCircle(cx, cy, radius * 1.35f, paint)
        }
    }
}
