package ru.specdpo.object360

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.SeekBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class ManualAlignmentActivity : AppCompatActivity() {

    private lateinit var session: CaptureSession
    private lateinit var store: ManualAlignmentStore
    private lateinit var shots: List<ShotInfo>
    private lateinit var executor: ExecutorService

    private lateinit var alignmentView: ManualAlignmentView
    private lateinit var frameLabel: TextView
    private lateinit var transformLabel: TextView
    private lateinit var ghostLabel: TextView
    private lateinit var btnSetReference: Button
    private lateinit var btnReset: Button

    private var currentIndex = 0
    private var loadToken = 0
    private var referenceBitmap: Bitmap? = null
    private var currentBitmap: Bitmap? = null
    private var referencePixelWidth: Int = 1
    private var referencePixelHeight: Int = 1

    private val baseDir: File
        get() = getExternalFilesDir(null) ?: filesDir

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sessionId = intent.getStringExtra(ProjectListActivity.EXTRA_SESSION_ID)
        if (sessionId.isNullOrBlank()) {
            finish()
            return
        }

        session = CaptureSession(
            baseDir = baseDir,
            sessionIdOverride = sessionId
        )
        shots = session.shots.values
            .filter { it.file.exists() }
            .sortedWith(compareBy<ShotInfo> { it.row }.thenBy { it.sector })

        if (shots.isEmpty()) {
            Toast.makeText(this, "В проекте нет кадров для выравнивания", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        executor = Executors.newSingleThreadExecutor()
        store = ManualAlignmentStore.load(session)
        ensureReferenceExists()

        currentIndex = shots.indexOfFirst {
            it.row == store.referenceRow && it.sector == store.referenceSector
        }.coerceAtLeast(0)

        buildUi()
        loadCurrentFrame()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(7, 11, 20))
        }
        setContentView(root)

        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(10), dp(12), dp(8))
        }
        root.addView(
            top,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        top.addView(
            button("←") {
                saveStore()
                finish()
            },
            LinearLayout.LayoutParams(dp(52), dp(46))
        )

        val titleBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), 0, dp(8), 0)
        }
        titleBox.addView(TextView(this).apply {
            text = "Ручное выравнивание"
            setTextColor(Color.WHITE)
            textSize = 20f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        titleBox.addView(TextView(this).apply {
            text = session.title
            setTextColor(Color.rgb(142, 154, 181))
            textSize = 12f
        })
        top.addView(
            titleBox,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        )

        top.addView(
            button("?") {
                startActivity(
                    Intent(this, HelpActivity::class.java)
                        .putExtra(HelpActivity.EXTRA_SECTION, HelpActivity.SECTION_ALIGNMENT)
                )
            },
            LinearLayout.LayoutParams(dp(48), dp(46))
        )

        frameLabel = TextView(this).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(117, 231, 214))
            textSize = 13f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(12), dp(2), dp(12), dp(4))
        }
        root.addView(frameLabel)

        transformLabel = TextView(this).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(244, 247, 255))
            textSize = 12f
            setPadding(dp(10), 0, dp(10), dp(6))
        }
        root.addView(transformLabel)

        alignmentView = ManualAlignmentView(this).apply {
            minimumHeight = dp(260)
            onTransformChanged = { value ->
                val shot = currentShot()
                if (!isReference(shot)) {
                    store.setTransform(shot.row, shot.sector, value)
                }
                updateTransformLabel()
            }
        }
        root.addView(
            alignmentView,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        val controlsScroll = ScrollView(this).apply {
            isFillViewport = true
        }
        root.addView(
            controlsScroll,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), dp(8), dp(10), dp(12))
        }
        controlsScroll.addView(controls)

        val nav = row()
        controls.addView(nav)
        nav.addView(
            button("← КАДР") { navigate(-1) },
            equalParams()
        )
        val navInfo = TextView(this).apply {
            text = "соседний кадр"
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(142, 154, 181))
            textSize = 11f
        }
        nav.addView(navInfo, equalParams(startMargin = 6))
        nav.addView(
            button("КАДР →") { navigate(1) },
            equalParams(startMargin = 6)
        )

        val move = row(topMargin = 7)
        controls.addView(move)
        move.addView(button("← 1px") { nudgePixels(-1, 0) }, equalParams())
        move.addView(button("1px →") { nudgePixels(1, 0) }, equalParams(5))
        move.addView(button("↑ 1px") { nudgePixels(0, -1) }, equalParams(5))
        move.addView(button("1px ↓") { nudgePixels(0, 1) }, equalParams(5))

        val geometry = row(topMargin = 7)
        controls.addView(geometry)
        geometry.addView(button("РАЗМЕР −") { alignmentView.zoomBy(0.99f) }, equalParams())
        geometry.addView(button("РАЗМЕР +") { alignmentView.zoomBy(1.01f) }, equalParams(5))
        geometry.addView(button("УГОЛ −") { alignmentView.rotateBy(-0.2f) }, equalParams(5))
        geometry.addView(button("УГОЛ +") { alignmentView.rotateBy(0.2f) }, equalParams(5))

        val tools = row(topMargin = 7)
        controls.addView(tools)
        btnReset = button("СБРОС КАДРА") {
            if (!isReference(currentShot())) {
                alignmentView.resetTransform()
            }
        }
        tools.addView(btnReset, equalParams())
        btnSetReference = button("ЭТАЛОН = ЭТОТ") {
            setCurrentAsReference()
        }
        tools.addView(btnSetReference, equalParams(6))
        tools.addView(
            button("СЕТКА") {
                alignmentView.showGrid = !alignmentView.showGrid
            },
            equalParams(6)
        )

        val ghostRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(7), 0, 0)
        }
        controls.addView(ghostRow)

        ghostLabel = TextView(this).apply {
            text = "Эталон 38%"
            setTextColor(Color.rgb(174, 186, 210))
            textSize = 11f
        }
        ghostRow.addView(
            ghostLabel,
            LinearLayout.LayoutParams(dp(92), ViewGroup.LayoutParams.WRAP_CONTENT)
        )

        val ghostSeek = SeekBar(this).apply {
            max = 90
            progress = 38
            setOnSeekBarChangeListener(
                object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                        alignmentView.referenceAlpha = progress / 100f
                        ghostLabel.text = "Эталон ${progress}%"
                    }

                    override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                    override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
                }
            )
        }
        ghostRow.addView(
            ghostSeek,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        )

        controls.addView(TextView(this).apply {
            text =
                "Жесты: 1 палец — сдвиг X/Y · pinch — размер · 2 пальца — поворот. " +
                    "Эталон накладывается полупрозрачно; совмещайте объект и контрольные точки."
            setTextColor(Color.rgb(142, 154, 181))
            textSize = 11f
            setPadding(0, dp(7), 0, dp(8))
        })

        val applyRow = row()
        controls.addView(applyRow)
        applyRow.addView(
            button("ПРИМЕНИТЬ ВСЮ СЕРИЮ") {
                applySeries()
            },
            equalParams()
        )
        applyRow.addView(
            button("ВОССТАНОВИТЬ ОРИГИНАЛЫ") {
                restoreOriginals()
            },
            equalParams(6)
        )
    }

    private fun loadCurrentFrame() {
        ensureReferenceExists()
        val shot = currentShot()
        val reference = referenceShot()
        val token = ++loadToken

        frameLabel.text =
            "Загрузка · ряд ${shot.row + 1} · сектор ${shot.sector + 1}/${session.sectors}"

        executor.execute {
            val referenceSource = ManualAlignmentProcessor.sourceForEditing(session, reference)
            val currentSource = ManualAlignmentProcessor.sourceForEditing(session, shot)

            val referenceSize = GhostFrameDecoder.orientedDimensions(referenceSource)
            val refBitmap = GhostFrameDecoder.decodeMaxDimension(referenceSource, 1500)
            val curBitmap = if (
                reference.row == shot.row &&
                reference.sector == shot.sector
            ) {
                refBitmap
            } else {
                GhostFrameDecoder.decodeMaxDimension(currentSource, 1500)
            }

            runOnUiThread {
                if (isFinishing || token != loadToken) {
                    if (curBitmap !== refBitmap) curBitmap?.recycle()
                    refBitmap?.recycle()
                    return@runOnUiThread
                }

                if (referenceSize != null) {
                    referencePixelWidth = referenceSize.first.coerceAtLeast(1)
                    referencePixelHeight = referenceSize.second.coerceAtLeast(1)
                }
                replaceBitmaps(refBitmap, curBitmap)
                val referenceFrame = isReference(shot)
                alignmentView.editable = !referenceFrame
                alignmentView.setTransform(
                    if (referenceFrame) {
                        ManualFrameTransform()
                    } else {
                        store.transformFor(shot.row, shot.sector).copy()
                    }
                )

                frameLabel.text = buildString {
                    append("Ряд ${shot.row + 1} · сектор ${shot.sector + 1}/${session.sectors}")
                    if (referenceFrame) append(" · ЭТАЛОН")
                }

                btnReset.isEnabled = !referenceFrame
                btnSetReference.isEnabled = !referenceFrame
                updateTransformLabel()
            }
        }
    }

    private fun navigate(delta: Int) {
        saveStore()
        if (shots.isEmpty()) return
        currentIndex = (currentIndex + delta + shots.size) % shots.size
        loadCurrentFrame()
    }

    private fun setCurrentAsReference() {
        val shot = currentShot()
        AlertDialog.Builder(this)
            .setTitle("Сделать кадр эталоном?")
            .setMessage(
                "Все ручные смещения и масштабы будут сброшены. " +
                    "Этот кадр задаст итоговый размер холста и нулевые координаты объекта."
            )
            .setPositiveButton("Сделать эталоном") { _, _ ->
                store.resetAll(shot.row, shot.sector)
                saveStore()
                loadCurrentFrame()
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun applySeries() {
        saveStore()

        AlertDialog.Builder(this)
            .setTitle("Применить ручное выравнивание")
            .setMessage(
                "Все кадры будут приведены к размеру эталона. " +
                    "Оригиналы автоматически сохранятся в резервной папке и их можно будет восстановить."
            )
            .setPositiveButton("Применить") { _, _ ->
                runBatchOperation(
                    title = "Выравнивание серии",
                    operation = { progress ->
                        ManualAlignmentProcessor.apply(session, store, progress)
                    },
                    finishedTitle = "Выравнивание завершено",
                    after = {
                        loadCurrentFrame()
                    }
                )
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun restoreOriginals() {
        if (!ManualAlignmentProcessor.hasBackups(session)) {
            Toast.makeText(this, "Резервных оригиналов пока нет", Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Восстановить оригиналы?")
            .setMessage(
                "Кадры будут восстановлены из manual_original. " +
                    "Параметры ручного выравнивания также будут сброшены."
            )
            .setPositiveButton("Восстановить") { _, _ ->
                runBatchOperation(
                    title = "Восстановление",
                    operation = { progress ->
                        ManualAlignmentProcessor.restoreOriginals(session, progress)
                    },
                    finishedTitle = "Оригиналы восстановлены",
                    after = {
                        val ref = referenceShot()
                        store.resetAll(ref.row, ref.sector)
                        saveStore()
                        loadCurrentFrame()
                    }
                )
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun runBatchOperation(
        title: String,
        operation: ((Int, Int, String) -> Unit) -> ManualAlignmentResult,
        finishedTitle: String,
        after: () -> Unit
    ) {
        val progressText = TextView(this).apply {
            gravity = Gravity.CENTER
            text = "Подготовка…"
            setTextColor(Color.WHITE)
            textSize = 15f
            setPadding(dp(20), dp(20), dp(20), dp(8))
        }
        val progress = ProgressBar(
            this,
            null,
            android.R.attr.progressBarStyleHorizontal
        ).apply {
            max = shots.size.coerceAtLeast(1)
            this.progress = 0
        }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(10), dp(18), dp(20))
            addView(progressText)
            addView(
                progress,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    dp(8)
                )
            )
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(title)
            .setView(box)
            .setCancelable(false)
            .create()
        dialog.show()

        executor.execute {
            val result = try {
                operation { done, total, message ->
                    runOnUiThread {
                        progress.max = total.coerceAtLeast(1)
                        progress.progress = done.coerceAtMost(progress.max)
                        progressText.text = "$message\n$done / $total"
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    dialog.dismiss()
                    Toast.makeText(
                        this,
                        "Ошибка: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
                return@execute
            }

            synchronized(session) {
                session.shots.values.forEach { shot ->
                    if (!shot.file.exists()) return@forEach
                    runCatching {
                        PublicStorage.publishPhoto(
                            this,
                            shot.file,
                            session.sessionId,
                            shot.row,
                            shot.sector
                        )
                    }
                }
            }

            runOnUiThread {
                dialog.dismiss()
                AlertDialog.Builder(this)
                    .setTitle(finishedTitle)
                    .setMessage(
                        "Обработано: ${result.processed}\n" +
                            "Ошибок: ${result.failed}\n\n" +
                            "Все сохранённые кадры имеют размер эталонного кадра."
                    )
                    .setPositiveButton("3D просмотр") { _, _ ->
                        Object360ReviewDialog.show(this, session)
                    }
                    .setNegativeButton("Закрыть", null)
                    .show()
                after()
            }
        }
    }

    private fun updateTransformLabel() {
        val shot = currentShot()
        if (isReference(shot)) {
            transformLabel.text =
                "Эталон ${referencePixelWidth}×${referencePixelHeight} · X 0 px · Y 0 px · размер 100.0% · угол 0.0°"
            return
        }

        val t = store.transformFor(shot.row, shot.sector)
        transformLabel.text = String.format(
            Locale.US,
            "Итог %dx%d · X %+d px · Y %+d px · размер %.1f%% · угол %+.1f°",
            referencePixelWidth,
            referencePixelHeight,
            (t.offsetX * referencePixelWidth).toInt(),
            (t.offsetY * referencePixelHeight).toInt(),
            t.scale * 100f,
            t.rotation
        )
    }

    private fun nudgePixels(dx: Int, dy: Int) {
        if (referencePixelWidth <= 0 || referencePixelHeight <= 0) return
        alignmentView.nudge(
            dx.toFloat() / referencePixelWidth,
            dy.toFloat() / referencePixelHeight
        )
    }

    private fun ensureReferenceExists() {
        val exists = shots.any {
            it.row == store.referenceRow && it.sector == store.referenceSector
        }
        if (!exists && shots.isNotEmpty()) {
            store.resetAll(shots.first().row, shots.first().sector)
            saveStore()
        }
    }

    private fun referenceShot(): ShotInfo =
        shots.firstOrNull {
            it.row == store.referenceRow && it.sector == store.referenceSector
        } ?: shots.first()

    private fun currentShot(): ShotInfo = shots[currentIndex.coerceIn(0, shots.lastIndex)]

    private fun isReference(shot: ShotInfo): Boolean =
        shot.row == store.referenceRow && shot.sector == store.referenceSector

    private fun saveStore() {
        runCatching { store.save(session) }
    }

    private fun replaceBitmaps(reference: Bitmap?, current: Bitmap?) {
        alignmentView.referenceBitmap = null
        alignmentView.currentBitmap = null

        val oldReference = referenceBitmap
        val oldCurrent = currentBitmap
        referenceBitmap = reference
        currentBitmap = current

        if (oldCurrent != null && oldCurrent !== oldReference && !oldCurrent.isRecycled) {
            oldCurrent.recycle()
        }
        if (oldReference != null && !oldReference.isRecycled) {
            oldReference.recycle()
        }

        alignmentView.referenceBitmap = reference
        alignmentView.currentBitmap = current
    }

    private fun row(topMargin: Int = 0): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            if (topMargin > 0) setPadding(0, dp(topMargin), 0, 0)
        }

    private fun button(text: String, onClick: () -> Unit): Button =
        Button(this).apply {
            this.text = text
            isAllCaps = false
            setTextColor(Color.WHITE)
            textSize = 10f
            setBackgroundResource(R.drawable.bg_button)
            setOnClickListener { onClick() }
        }

    private fun equalParams(startMargin: Int = 0) =
        LinearLayout.LayoutParams(
            0,
            dp(42),
            1f
        ).apply {
            marginStart = dp(startMargin)
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    override fun onStop() {
        saveStore()
        super.onStop()
    }

    override fun onDestroy() {
        loadToken++
        if (::executor.isInitialized) executor.shutdownNow()
        if (::alignmentView.isInitialized) {
            replaceBitmaps(null, null)
        } else {
            referenceBitmap?.takeIf { !it.isRecycled }?.recycle()
            currentBitmap?.takeIf { it !== referenceBitmap && !it.isRecycled }?.recycle()
            referenceBitmap = null
            currentBitmap = null
        }
        super.onDestroy()
    }
}
