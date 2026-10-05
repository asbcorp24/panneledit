package ru.specdpo.object360

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.View
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

class TrajectoryOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private data class OrbitPoint(
        val angleDeg: Float,
        val radiusRatio: Float
    )

    private val points = ArrayList<OrbitPoint>()

    private var currentAngleDeg = 0f
    private var currentRadiusRatio = 1f
    private var currentGood = false
    private var hasCurrent = false

    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f * resources.displayMetrics.density
        color = Color.argb(190, 255, 255, 255)
    }

    private val tolerancePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1f * resources.displayMetrics.density
        color = Color.argb(80, 255, 255, 255)
    }

    private val pathPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2.5f * resources.displayMetrics.density
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        color = Color.rgb(0, 229, 168)
    }

    private val objectPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.WHITE
    }

    private val currentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    fun reset() {
        points.clear()
        hasCurrent = false
        invalidate()
    }

    fun updatePosition(angleDeg: Float, radiusRatio: Float, good: Boolean) {
        currentAngleDeg = angleDeg
        currentRadiusRatio = radiusRatio.coerceIn(0.35f, 1.8f)
        currentGood = good
        hasCurrent = true

        val last = points.lastOrNull()
        if (
            last == null ||
            angularDistance(last.angleDeg, angleDeg) >= 1.5f ||
            kotlin.math.abs(last.radiusRatio - currentRadiusRatio) >= 0.025f
        ) {
            points.add(OrbitPoint(angleDeg, currentRadiusRatio))
            if (points.size > 900) points.removeAt(0)
        }

        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val cx = width / 2f
        val cy = height / 2f
        val maxRadius = min(width, height) * 0.42f
        val targetRadius = maxRadius / 1.8f

        canvas.drawCircle(cx, cy, targetRadius * 0.88f, tolerancePaint)
        canvas.drawCircle(cx, cy, targetRadius, ringPaint)
        canvas.drawCircle(cx, cy, targetRadius * 1.12f, tolerancePaint)

        val path = Path()
        points.forEachIndexed { index, point ->
            val xy = toCanvas(point.angleDeg, point.radiusRatio, cx, cy, targetRadius)
            if (index == 0) path.moveTo(xy.first, xy.second)
            else path.lineTo(xy.first, xy.second)
        }
        if (points.size > 1) canvas.drawPath(path, pathPaint)

        canvas.drawCircle(cx, cy, 6f * resources.displayMetrics.density, objectPaint)

        if (hasCurrent) {
            val xy = toCanvas(
                currentAngleDeg,
                currentRadiusRatio,
                cx,
                cy,
                targetRadius
            )
            currentPaint.color =
                if (currentGood) Color.rgb(0, 229, 168)
                else Color.rgb(255, 193, 7)

            canvas.drawCircle(
                xy.first,
                xy.second,
                7f * resources.displayMetrics.density,
                currentPaint
            )
        }
    }

    private fun toCanvas(
        angleDeg: Float,
        radiusRatio: Float,
        cx: Float,
        cy: Float,
        targetRadius: Float
    ): Pair<Float, Float> {
        val rad = Math.toRadians(angleDeg.toDouble() - 90.0)
        val r = targetRadius * radiusRatio
        val x = cx + cos(rad).toFloat() * r
        val y = cy + sin(rad).toFloat() * r
        return x to y
    }

    private fun angularDistance(a: Float, b: Float): Float {
        var d = kotlin.math.abs(a - b) % 360f
        if (d > 180f) d = 360f - d
        return d
    }
}
