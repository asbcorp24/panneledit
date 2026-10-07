package ru.specdpo.object360

import android.app.Activity
import android.app.Dialog
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.drawable.ColorDrawable
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.util.LruCache
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class Object360ReviewView @JvmOverloads constructor(
    context: android.content.Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    var sectors: Int = 36
        private set
    var rows: Int = 1
        private set
    var currentSector: Int = 0
        private set
    var currentRow: Int = 0
        private set

    var onFrameChanged: ((row: Int, sector: Int) -> Unit)? = null

    private var shots: Map<Pair<Int, Int>, ShotInfo> = emptyMap()
    private val cache = LruCache<String, Bitmap>(8)
    private val handler = Handler(Looper.getMainLooper())
    private var autoplay = false
    private var autoplayRunnable: Runnable? = null

    private var downX = 0f
    private var downY = 0f
    private var startSector = 0
    private var startRow = 0
    private var rowChangedByGesture = false

    private val backgroundPaint = Paint().apply { color = Color.BLACK }
    private val messagePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        textSize = 17f * resources.displayMetrics.scaledDensity
    }
    private val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(190, 255, 255, 255)
        textAlign = Paint.Align.CENTER
        textSize = 12f * resources.displayMetrics.scaledDensity
    }

    fun setSession(session: CaptureSession) {
        sectors = max(1, session.sectors)
        rows = max(1, session.rows)
        shots = synchronized(session) { session.shots.toMap() }
        currentRow = if (rows == 3) 1 else 0
        currentSector = firstAvailableSector(currentRow) ?: firstAvailableSectorAny()?.second ?: 0
        if (!shots.containsKey(currentRow to currentSector)) {
            firstAvailableSectorAny()?.let {
                currentRow = it.first
                currentSector = it.second
            }
        }
        invalidate()
        onFrameChanged?.invoke(currentRow, currentSector)
    }

    fun changeRow(delta: Int) {
        if (rows <= 1) return
        val nextRow = (currentRow + delta).coerceIn(0, rows - 1)
        if (nextRow == currentRow) return
        currentRow = nextRow
        currentSector = nearestAvailableSector(currentRow, currentSector) ?: currentSector
        invalidate()
        onFrameChanged?.invoke(currentRow, currentSector)
    }

    fun toggleAutoplay(): Boolean {
        autoplay = !autoplay
        if (autoplay) startAutoplay() else stopAutoplay()
        return autoplay
    }

    fun stopAutoplay() {
        autoplay = false
        autoplayRunnable?.let(handler::removeCallbacks)
        autoplayRunnable = null
    }

    fun release() {
        stopAutoplay()
        cache.evictAll()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backgroundPaint)

        val shot = shots[currentRow to currentSector]
        if (shot == null || !shot.file.exists()) {
            canvas.drawText("Нет кадра", width / 2f, height / 2f, messagePaint)
            canvas.drawText(
                "Снимите этот сектор или выберите другой",
                width / 2f,
                height / 2f + 34f * resources.displayMetrics.density,
                subPaint
            )
            return
        }

        val bitmap = bitmapFor(shot)
        if (bitmap == null) {
            canvas.drawText("Не удалось открыть кадр", width / 2f, height / 2f, messagePaint)
            return
        }

        val srcW = bitmap.width.toFloat()
        val srcH = bitmap.height.toFloat()
        val scale = min(width / srcW, height / srcH)
        val drawW = srcW * scale
        val drawH = srcH * scale
        val left = (width - drawW) / 2f
        val top = (height - drawH) / 2f

        canvas.drawBitmap(
            bitmap,
            null,
            RectF(left, top, left + drawW, top + drawH),
            null
        )
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (shots.isEmpty()) return true

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                stopAutoplay()
                downX = event.x
                downY = event.y
                startSector = currentSector
                startRow = currentRow
                rowChangedByGesture = false
                parent?.requestDisallowInterceptTouchEvent(true)
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - downX
                val dy = event.y - downY
                val stepPx = max(18f * resources.displayMetrics.density, width / 18f)
                val steps = (dx / stepPx).toInt()

                if (steps != 0) {
                    val raw = wrapSector(startSector - steps)
                    val direction = if (steps > 0) -1 else 1
                    val next = nextAvailableFrom(currentRow, raw, direction) ?: raw
                    setFrame(currentRow, next)
                }

                if (!rowChangedByGesture && rows > 1 &&
                    abs(dy) > 90f * resources.displayMetrics.density &&
                    abs(dy) > abs(dx) * 1.2f
                ) {
                    val nextRow = if (dy < 0) startRow + 1 else startRow - 1
                    val clamped = nextRow.coerceIn(0, rows - 1)
                    if (clamped != currentRow) {
                        currentRow = clamped
                        currentSector = nearestAvailableSector(currentRow, currentSector) ?: currentSector
                        rowChangedByGesture = true
                        invalidate()
                        onFrameChanged?.invoke(currentRow, currentSector)
                    }
                }
                return true
            }

            MotionEvent.ACTION_UP,
            MotionEvent.ACTION_CANCEL -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun setFrame(row: Int, sector: Int) {
        val normalized = wrapSector(sector)
        if (row == currentRow && normalized == currentSector) return
        currentRow = row.coerceIn(0, rows - 1)
        currentSector = normalized
        invalidate()
        onFrameChanged?.invoke(currentRow, currentSector)
    }

    private fun startAutoplay() {
        stopAutoplay()
        autoplay = true
        val runnable = object : Runnable {
            override fun run() {
                if (!autoplay) return
                val next = nextAvailableFrom(currentRow, wrapSector(currentSector + 1), 1)
                    ?: wrapSector(currentSector + 1)
                setFrame(currentRow, next)
                handler.postDelayed(this, 95L)
            }
        }
        autoplayRunnable = runnable
        handler.postDelayed(runnable, 95L)
    }

    private fun firstAvailableSector(row: Int): Int? =
        (0 until sectors).firstOrNull { shots.containsKey(row to it) }

    private fun firstAvailableSectorAny(): Pair<Int, Int>? {
        for (row in 0 until rows) {
            val sector = firstAvailableSector(row)
            if (sector != null) return row to sector
        }
        return null
    }

    private fun nearestAvailableSector(row: Int, sector: Int): Int? {
        if (shots.containsKey(row to sector)) return sector
        for (distance in 1 until sectors) {
            val plus = wrapSector(sector + distance)
            if (shots.containsKey(row to plus)) return plus
            val minus = wrapSector(sector - distance)
            if (shots.containsKey(row to minus)) return minus
        }
        return null
    }

    private fun nextAvailableFrom(row: Int, sector: Int, direction: Int): Int? {
        var current = wrapSector(sector)
        repeat(sectors) {
            if (shots.containsKey(row to current)) return current
            current = wrapSector(current + if (direction >= 0) 1 else -1)
        }
        return null
    }

    private fun wrapSector(value: Int): Int {
        val m = value % sectors
        return if (m < 0) m + sectors else m
    }

    private fun bitmapFor(shot: ShotInfo): Bitmap? {
        val key = shot.file.absolutePath
        cache.get(key)?.let { return it }

        val targetW = max(width, 720)
        val targetH = max(height, 720)

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(key, bounds)

        var sample = 1
        while (
            bounds.outWidth / (sample * 2) >= targetW &&
            bounds.outHeight / (sample * 2) >= targetH
        ) {
            sample *= 2
        }

        val bitmap = BitmapFactory.decodeFile(
            key,
            BitmapFactory.Options().apply {
                inSampleSize = sample
                inPreferredConfig = Bitmap.Config.RGB_565
            }
        ) ?: return null

        cache.put(key, bitmap)
        return bitmap
    }
}

object Object360ReviewDialog {

    fun show(
        activity: Activity,
        session: CaptureSession,
        onCoverageClick: (() -> Unit)? = null
    ) {
        if (session.shots.isEmpty()) {
            android.widget.Toast.makeText(
                activity,
                "Сначала сделайте хотя бы один кадр",
                android.widget.Toast.LENGTH_SHORT
            ).show()
            return
        }

        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)

        val root = FrameLayout(activity).apply {
            setBackgroundColor(Color.BLACK)
        }

        val viewer = Object360ReviewView(activity).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        root.addView(viewer)

        val top = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(activity, 10), dp(activity, 8), dp(activity, 10), dp(activity, 8))
            setBackgroundColor(Color.argb(185, 4, 8, 16))
        }
        val topParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.TOP
        )
        root.addView(top, topParams)

        val title = TextView(activity).apply {
            setTextColor(Color.WHITE)
            textSize = 15f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        top.addView(
            title,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        )

        if (onCoverageClick != null) {
            val coverage = Button(activity).apply {
                text = "КАРТА"
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.argb(150, 35, 48, 70))
                setOnClickListener {
                    dialog.dismiss()
                    onCoverageClick()
                }
            }
            top.addView(
                coverage,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    dp(activity, 44)
                )
            )
        }

        val close = Button(activity).apply {
            text = "✕"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(150, 35, 48, 70))
            setOnClickListener { dialog.dismiss() }
        }
        top.addView(
            close,
            LinearLayout.LayoutParams(
                dp(activity, 52),
                dp(activity, 44)
            ).apply { marginStart = dp(activity, 7) }
        )

        val bottom = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(activity, 10), dp(activity, 8), dp(activity, 10), dp(activity, 12))
            setBackgroundColor(Color.argb(185, 4, 8, 16))
        }
        val bottomParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM
        )
        root.addView(bottom, bottomParams)

        val hint = TextView(activity).apply {
            text = "Проведите пальцем влево / вправо — вращение • вверх / вниз — ряд"
            setTextColor(Color.argb(210, 255, 255, 255))
            textSize = 11f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(activity, 7))
        }
        bottom.addView(hint)

        val controls = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        bottom.addView(controls)

        val rowDown = Button(activity).apply {
            text = "РЯД −"
            setTextColor(Color.WHITE)
            setOnClickListener { viewer.changeRow(-1) }
        }
        val play = Button(activity).apply {
            text = "▶"
            setTextColor(Color.WHITE)
            setOnClickListener {
                text = if (viewer.toggleAutoplay()) "❚❚" else "▶"
            }
        }
        val rowUp = Button(activity).apply {
            text = "РЯД +"
            setTextColor(Color.WHITE)
            setOnClickListener { viewer.changeRow(1) }
        }

        controls.addView(rowDown)
        controls.addView(play)
        controls.addView(rowUp)

        viewer.onFrameChanged = { row, sector ->
            title.text =
                "3D ПРОСМОТР   •   Ряд ${row + 1}/${session.rows}   •   Кадр ${sector + 1}/${session.sectors}"
            rowDown.isEnabled = session.rows > 1 && row > 0
            rowUp.isEnabled = session.rows > 1 && row < session.rows - 1
        }
        viewer.setSession(session)

        dialog.setContentView(root)
        dialog.setOnDismissListener { viewer.release() }
        dialog.setOnShowListener {
            dialog.window?.apply {
                setBackgroundDrawable(ColorDrawable(Color.BLACK))
                setLayout(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
        dialog.show()
        dialog.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
    }

    private fun dp(activity: Activity, value: Int): Int =
        (value * activity.resources.displayMetrics.density).toInt()
}
