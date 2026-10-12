package ru.specdpo.object360

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max
import kotlin.math.min

class PanoramaEditorActivity : AppCompatActivity() {

    private lateinit var sourceFile: File
    private lateinit var preview: ImageView
    private lateinit var sourceBitmap: Bitmap
    private lateinit var previewBitmap: Bitmap

    private var horizon = 0f
    private var startRotation = 0f
    private var brightness = 0f
    private var contrast = 1f
    private var shadows = 0f
    private var saturation = 1f
    private var cropPercent = 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val path = intent.getStringExtra(EXTRA_FILE)
        sourceFile = path?.let(::File) ?: run {
            finish()
            return
        }

        sourceBitmap = GhostFrameDecoder.decodeMaxDimension(sourceFile, 4096) ?: run {
            Toast.makeText(this, "Не удалось открыть панораму", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        buildUi()
        renderPreview()
    }

    override fun onDestroy() {
        if (::sourceBitmap.isInitialized && !sourceBitmap.isRecycled) sourceBitmap.recycle()
        if (::previewBitmap.isInitialized && previewBitmap !== sourceBitmap && !previewBitmap.isRecycled) previewBitmap.recycle()
        super.onDestroy()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(7, 11, 20))
        }

        preview = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.BLACK)
        }
        root.addView(preview, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        ))

        val scroll = ScrollView(this)
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(10), dp(14), dp(18))
        }
        scroll.addView(controls)
        root.addView(scroll, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(330)
        ))

        controls.addView(title("Редактор панорамы"))

        addSlider(controls, "Горизонт", -10f, 10f, 0f) { horizon = it; renderPreview() }
        addSlider(controls, "Стартовый поворот", -180f, 180f, 0f) { startRotation = it; renderPreview() }
        addSlider(controls, "Crop", 0f, 12f, 0f) { cropPercent = it; renderPreview() }
        addSlider(controls, "Яркость", -80f, 80f, 0f) { brightness = it; renderPreview() }
        addSlider(controls, "Контраст", 0.5f, 1.8f, 1f) { contrast = it; renderPreview() }
        addSlider(controls, "Тени", -70f, 70f, 0f) { shadows = it; renderPreview() }
        addSlider(controls, "Насыщенность", 0f, 2f, 1f) { saturation = it; renderPreview() }

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, 0)
        }
        controls.addView(row)

        row.addView(button("Убрать чёрные края") {
            sourceBitmap = trimBlackBorders(sourceBitmap)
            renderPreview()
        }, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginEnd = dp(6) })

        row.addView(button("Сброс") {
            horizon = 0f
            startRotation = 0f
            brightness = 0f
            contrast = 1f
            shadows = 0f
            saturation = 1f
            cropPercent = 0f
            renderPreview()
        }, LinearLayout.LayoutParams(0, dp(48), 1f))

        val save = button("СОХРАНИТЬ КОПИЮ") { saveEdited() }
        controls.addView(save, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(54)
        ).apply { topMargin = dp(8) })

        setContentView(root)
    }

    private fun renderPreview() {
        val edited = applyEdits(sourceBitmap)
        if (::previewBitmap.isInitialized && previewBitmap !== sourceBitmap && previewBitmap !== edited && !previewBitmap.isRecycled) {
            previewBitmap.recycle()
        }
        previewBitmap = edited
        preview.setImageBitmap(previewBitmap)
    }

    private fun applyEdits(input: Bitmap): Bitmap {
        var current = input

        if (cropPercent > 0.01f) {
            val dx = (current.width * cropPercent / 100f).toInt().coerceAtMost(current.width / 4)
            val dy = (current.height * cropPercent / 100f).toInt().coerceAtMost(current.height / 4)
            current = Bitmap.createBitmap(
                current,
                dx,
                dy,
                max(1, current.width - dx * 2),
                max(1, current.height - dy * 2)
            )
        }

        if (kotlin.math.abs(startRotation) > 0.1f) {
            current = rotateStart(current, startRotation)
        }

        if (kotlin.math.abs(horizon) > 0.05f) {
            val m = Matrix().apply { postRotate(horizon) }
            current = Bitmap.createBitmap(current, 0, 0, current.width, current.height, m, true)
        }

        val output = Bitmap.createBitmap(current.width, current.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)

        val sat = ColorMatrix().apply { setSaturation(saturation) }
        val scale = contrast
        val translate = brightness + shadows * 0.35f
        val adjust = ColorMatrix(floatArrayOf(
            scale, 0f, 0f, 0f, translate,
            0f, scale, 0f, 0f, translate,
            0f, 0f, scale, 0f, translate,
            0f, 0f, 0f, 1f, 0f
        ))
        sat.postConcat(adjust)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            colorFilter = ColorMatrixColorFilter(sat)
        }
        canvas.drawBitmap(current, 0f, 0f, paint)

        if (current !== input && current !== output && !current.isRecycled) current.recycle()
        return output
    }

    private fun rotateStart(bitmap: Bitmap, degrees: Float): Bitmap {
        val shift = ((degrees / 360f) * bitmap.width).toInt()
        if (shift == 0) return bitmap
        val normalized = ((shift % bitmap.width) + bitmap.width) % bitmap.width
        val out = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        canvas.drawBitmap(bitmap, (-normalized).toFloat(), 0f, null)
        canvas.drawBitmap(bitmap, (bitmap.width - normalized).toFloat(), 0f, null)
        return out
    }

    private fun trimBlackBorders(bitmap: Bitmap): Bitmap {
        val step = max(1, min(bitmap.width, bitmap.height) / 500)
        var left = 0
        var right = bitmap.width - 1
        var top = 0
        var bottom = bitmap.height - 1

        fun dark(x: Int, y: Int): Boolean {
            val c = bitmap.getPixel(x.coerceIn(0, bitmap.width - 1), y.coerceIn(0, bitmap.height - 1))
            return Color.red(c) < 10 && Color.green(c) < 10 && Color.blue(c) < 10
        }

        while (left < right && (0 until bitmap.height step step).count { dark(left, it) } > bitmap.height / step * 0.85) left++
        while (right > left && (0 until bitmap.height step step).count { dark(right, it) } > bitmap.height / step * 0.85) right--
        while (top < bottom && (0 until bitmap.width step step).count { dark(it, top) } > bitmap.width / step * 0.85) top++
        while (bottom > top && (0 until bitmap.width step step).count { dark(it, bottom) } > bitmap.width / step * 0.85) bottom--

        if (right - left < bitmap.width / 2 || bottom - top < bitmap.height / 2) return bitmap
        return Bitmap.createBitmap(bitmap, left, top, right - left + 1, bottom - top + 1)
    }

    private fun saveEdited() {
        try {
            val edited = applyEdits(sourceBitmap)
            val dir = sourceFile.parentFile ?: filesDir
            val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val out = File(dir, "edited_" + stamp + ".jpg")
            FileOutputStream(out).use {
                edited.compress(Bitmap.CompressFormat.JPEG, 95, it)
            }
            if (!edited.isRecycled) edited.recycle()
            Toast.makeText(this, "Сохранено: " + out.name, Toast.LENGTH_LONG).show()
            setResult(RESULT_OK)
        } catch (e: Exception) {
            Toast.makeText(this, "Ошибка сохранения: " + e.message, Toast.LENGTH_LONG).show()
        }
    }

    private fun addSlider(
        parent: LinearLayout,
        label: String,
        minValue: Float,
        maxValue: Float,
        initial: Float,
        onChange: (Float) -> Unit
    ) {
        val title = TextView(this).apply {
            text = label
            setTextColor(Color.WHITE)
            textSize = 13f
        }
        parent.addView(title)

        val seek = SeekBar(this).apply {
            max = 1000
            progress = (((initial - minValue) / (maxValue - minValue)) * max).toInt().coerceIn(0, max)
        }
        parent.addView(seek)
        seek.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val value = minValue + (maxValue - minValue) * progress / 1000f
                title.text = "$label: " + String.format(Locale.US, "%.2f", value)
                if (fromUser) onChange(value)
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
    }

    private fun title(text: String) = TextView(this).apply {
        this.text = text
        setTextColor(Color.WHITE)
        textSize = 20f
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, 0, 0, dp(8))
    }

    private fun button(text: String, action: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(24, 40, 67))
        setOnClickListener { action() }
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_FILE = "panorama_editor_file"
    }
}
