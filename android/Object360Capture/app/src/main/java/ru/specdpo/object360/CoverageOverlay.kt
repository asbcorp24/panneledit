package ru.specdpo.object360

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import kotlin.math.min

class CoverageOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    var sectors: Int = 36
        set(value) { field = value; invalidate() }
    var currentSector: Int = 0
        set(value) { field = value; invalidate() }
    var currentRow: Int = 0
        set(value) { field = value; invalidate() }
    var rows: Int = 1
        set(value) { field = value; invalidate() }
    var captured: Set<Pair<Int, Int>> = emptySet()
        set(value) { field = value; invalidate() }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.BUTT
    }
    private val reticlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f * resources.displayMetrics.density
        color = Color.WHITE
        alpha = 220
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f
        val baseRadius = min(w, h) * 0.30f
        val ringGap = 13f * resources.displayMetrics.density
        val stroke = 9f * resources.displayMetrics.density
        val gapDeg = if (sectors >= 72) 0.8f else 1.5f
        val sweep = 360f / sectors
        paint.strokeWidth = stroke

        for (row in 0 until rows) {
            val radius = baseRadius + (row - (rows - 1) / 2f) * ringGap
            val rect = RectF(cx - radius, cy - radius, cx + radius, cy + radius)
            for (sector in 0 until sectors) {
                paint.color = when {
                    sector == currentSector && row == currentRow -> Color.rgb(255, 213, 79)
                    captured.contains(row to sector) -> Color.rgb(0, 229, 168)
                    else -> Color.argb(145, 105, 114, 125)
                }
                canvas.drawArc(rect, -90f + sector * sweep + gapDeg / 2f, sweep - gapDeg, false, paint)
            }
        }

        val r = 24f * resources.displayMetrics.density
        canvas.drawCircle(cx, cy, r, reticlePaint)
        canvas.drawLine(cx - r * 1.5f, cy, cx - r * 0.45f, cy, reticlePaint)
        canvas.drawLine(cx + r * 0.45f, cy, cx + r * 1.5f, cy, reticlePaint)
        canvas.drawLine(cx, cy - r * 1.5f, cx, cy - r * 0.45f, reticlePaint)
        canvas.drawLine(cx, cy + r * 0.45f, cx, cy + r * 1.5f, reticlePaint)
    }
}
