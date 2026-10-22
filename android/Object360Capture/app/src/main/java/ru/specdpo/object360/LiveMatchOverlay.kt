package ru.specdpo.object360

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View

class LiveMatchOverlay(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var result = LiveOverlapResult()
    private var sourceW = 1
    private var sourceH = 1

    fun update(result: LiveOverlapResult, width: Int, height: Int) {
        this.result = result
        sourceW = width.coerceAtLeast(1)
        sourceH = height.coerceAtLeast(1)
        postInvalidateOnAnimation()
    }

    fun clear() {
        result = LiveOverlapResult()
        postInvalidateOnAnimation()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (result.points.isEmpty()) return

        val sx = width.toFloat() / sourceW
        val sy = height.toFloat() / sourceH
        val color = when {
            result.good -> Color.rgb(70, 230, 120)
            result.inlierRatio >= 0.25f -> Color.rgb(255, 196, 70)
            else -> Color.rgb(245, 90, 90)
        }

        paint.color = color
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 3f
        paint.alpha = 220

        val xs = result.points.map { it.first * sx }
        val ys = result.points.map { it.second * sy }
        val left = xs.minOrNull() ?: return
        val right = xs.maxOrNull() ?: return
        val top = ys.minOrNull() ?: return
        val bottom = ys.maxOrNull() ?: return
        canvas.drawRoundRect(left, top, right, bottom, 18f, 18f, paint)

        paint.style = Paint.Style.FILL
        result.points.take(80).forEach { (x, y) ->
            canvas.drawCircle(x * sx, y * sy, 5f, paint)
        }
    }
}
