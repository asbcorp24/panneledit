package ru.specdpo.object360

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View
import kotlin.math.abs

class PanoramaGuideOverlay(context: Context) : View(context) {

    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(120, 255, 255, 255)
        strokeWidth = dp(1f)
    }

    private val crossPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = dp(2f)
    }

    private val horizonPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = dp(3f)
        strokeCap = Paint.Cap.ROUND
    }

    private val horizonBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(160, 0, 0, 0)
        strokeWidth = dp(7f)
        strokeCap = Paint.Cap.ROUND
    }

    private var rollDeg = 0f

    fun updateRoll(roll: Float) {
        rollDeg = roll.coerceIn(-45f, 45f)
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()

        // Rule-of-thirds grid.
        canvas.drawLine(w / 3f, 0f, w / 3f, h, gridPaint)
        canvas.drawLine(w * 2f / 3f, 0f, w * 2f / 3f, h, gridPaint)
        canvas.drawLine(0f, h / 3f, w, h / 3f, gridPaint)
        canvas.drawLine(0f, h * 2f / 3f, w, h * 2f / 3f, gridPaint)

        // Center cross.
        val cx = w / 2f
        val cy = h / 2f
        val arm = dp(14f)
        canvas.drawLine(cx - arm, cy, cx + arm, cy, crossPaint)
        canvas.drawLine(cx, cy - arm, cx, cy + arm, crossPaint)

        // Electronic horizon. Green inside +/- 2 degrees.
        horizonPaint.color =
            if (abs(rollDeg) <= 2f) Color.rgb(91, 233, 150)
            else Color.rgb(255, 193, 73)

        val lineHalf = (w * 0.19f).coerceAtLeast(dp(54f))
        canvas.save()
        canvas.rotate(-rollDeg, cx, cy)
        canvas.drawLine(cx - lineHalf, cy, cx + lineHalf, cy, horizonBgPaint)
        canvas.drawLine(cx - lineHalf, cy, cx + lineHalf, cy, horizonPaint)
        canvas.restore()
    }

    private fun dp(v: Float): Float = v * resources.displayMetrics.density
}
