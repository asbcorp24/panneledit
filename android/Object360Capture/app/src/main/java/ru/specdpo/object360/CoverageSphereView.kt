package ru.specdpo.object360

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Compact pseudo-3D coverage map.
 *
 * Each horizontal belt is one capture row (low / middle / high).
 * Sector 0..N is projected around an ellipse. The current sector is rotated
 * to the front of the globe, so missing / captured neighbours are easy to see.
 */
class CoverageSphereView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    var sectors: Int = 36
        set(value) {
            field = max(1, value)
            invalidate()
        }

    var rows: Int = 1
        set(value) {
            field = max(1, value)
            invalidate()
        }

    var currentSector: Int = 0
        set(value) {
            field = value
            invalidate()
        }

    var currentRow: Int = 0
        set(value) {
            field = value
            invalidate()
        }

    var captured: Set<Pair<Int, Int>> = emptySet()
        set(value) {
            field = value
            invalidate()
        }

    private val spherePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(1.2f)
        color = Color.argb(100, 255, 255, 255)
    }

    private val backPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeWidth = dp(5.2f)
    }

    private val frontPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeWidth = dp(6.2f)
    }

    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.argb(210, 255, 255, 255)
        textSize = dp(9f)
        textAlign = Paint.Align.CENTER
    }

    private val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.WHITE
        textSize = dp(10f)
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val cx = w / 2f
        val cy = h * 0.46f
        val rx = min(w * 0.42f, h * 0.31f)
        val ry = rx * 0.78f

        // Sphere silhouette and reference latitude lines.
        canvas.drawOval(
            RectF(cx - rx, cy - ry, cx + rx, cy + ry),
            spherePaint
        )

        val rowCenters = rowCenters(cy, ry)

        // Draw back hemisphere first.
        for (row in 0 until rows) {
            drawRow(canvas, row, rowCenters[row], cx, rx, ry, front = false)
        }

        // Then front hemisphere, so it visually sits on top.
        for (row in 0 until rows) {
            drawRow(canvas, row, rowCenters[row], cx, rx, ry, front = true)
        }

        // Latitude helper curves.
        for (rowY in rowCenters) {
            val squash = 0.22f
            canvas.drawOval(
                RectF(cx - rx, rowY - ry * squash, cx + rx, rowY + ry * squash),
                spherePaint
            )
        }

        if (rows == 3) {
            canvas.drawText("ВЕРХ", cx, rowCenters[2] - dp(8f), labelPaint)
            canvas.drawText("СРЕД", cx, rowCenters[1] - dp(8f), labelPaint)
            canvas.drawText("НИЗ", cx, rowCenters[0] - dp(8f), labelPaint)
        } else {
            canvas.drawText("360°", cx, rowCenters[0] - dp(8f), labelPaint)
        }

        val total = sectors * rows
        val done = captured.size.coerceAtMost(total)
        canvas.drawText("$done / $total", cx, h - dp(5f), progressPaint)
    }

    private fun drawRow(
        canvas: Canvas,
        row: Int,
        rowY: Float,
        cx: Float,
        rx: Float,
        ry: Float,
        front: Boolean
    ) {
        val step = 2.0 * PI / sectors.toDouble()
        val half = step * 0.32

        for (sector in 0 until sectors) {
            // Rotate current sector to the viewer-facing centre.
            val relative = wrapSector(sector - currentSector)
            val theta = relative * step

            val z = cos(theta)
            val isFront = z >= 0.0
            if (isFront != front) continue

            val a1 = theta - half
            val a2 = theta + half

            val x1 = cx + sin(a1).toFloat() * rx
            val x2 = cx + sin(a2).toFloat() * rx

            // Small perspective lift / drop gives each belt a spherical feel.
            val depth1 = cos(a1).toFloat()
            val depth2 = cos(a2).toFloat()
            val y1 = rowY - depth1 * ry * 0.12f
            val y2 = rowY - depth2 * ry * 0.12f

            val paint = if (front) frontPaint else backPaint
            paint.color = cellColor(row, sector, front)
            paint.alpha = if (front) 235 else 75

            canvas.drawLine(x1, y1, x2, y2, paint)
        }
    }

    private fun cellColor(row: Int, sector: Int, front: Boolean): Int {
        return when {
            row == currentRow && sector == currentSector ->
                Color.rgb(255, 213, 79)

            captured.contains(row to sector) ->
                Color.rgb(0, 229, 168)

            front ->
                Color.rgb(105, 114, 125)

            else ->
                Color.rgb(80, 86, 96)
        }
    }

    private fun rowCenters(cy: Float, ry: Float): FloatArray {
        return if (rows <= 1) {
            floatArrayOf(cy)
        } else if (rows == 3) {
            floatArrayOf(
                cy + ry * 0.42f,
                cy,
                cy - ry * 0.42f
            )
        } else {
            FloatArray(rows) { index ->
                val t = if (rows == 1) 0f else index.toFloat() / (rows - 1)
                cy + ry * 0.55f - t * ry * 1.10f
            }
        }
    }

    private fun wrapSector(delta: Int): Int {
        var d = delta % sectors
        if (d > sectors / 2) d -= sectors
        if (d < -sectors / 2) d += sectors
        return d
    }

    private fun dp(value: Float): Float = value * resources.displayMetrics.density
}
