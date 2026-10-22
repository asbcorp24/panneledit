package ru.specdpo.object360

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.Surface
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.floor

class PanoramaCaptureActivity : AppCompatActivity() {
    private val executor = Executors.newSingleThreadExecutor()
    private var imageCapture: ImageCapture? = null
    private lateinit var preview: PreviewView
    private lateinit var status: TextView
    private lateinit var hint: TextView
    private lateinit var rowText: TextView
    private lateinit var btnStart: Button
    private lateinit var btnBuild: Button
    private lateinit var btnUp: Button
    private lateinit var btnDown: Button
    private lateinit var guide: TextView
    private lateinit var ghost: ImageView
    private lateinit var btnOrientation: Button
    private lateinit var cameraGuideOverlay: PanoramaGuideOverlay
    private var rectangularDirection = 1
    private var rectangularStartYaw = Float.NaN
    private var rectangularLastShotYaw = Float.NaN
    private var rectangularTargetStepDeg = 0f
    private var rectangularTargetYaw = Float.NaN

    private var kind = PanoramaKind.FULL_360
    private val sectors = 12
    private var row = 1
    private var baseYaw = 0f
    private var yaw = 0f
    private var pitchNow = 0f
    private var rollNow = 0f
    private var cameraCalibration = CameraCalibration()
    private var calibrated = false
    private var busy = false
    private var rectangularIndex = 0
    private var stableSince = 0L
    private var lastAutoRow = -1
    private var lastAutoSector = -1
    private var autoCapture = true
    private var ghostBitmap: android.graphics.Bitmap? = null
    private val frames = mutableListOf<PanoramaFrame>()

    private val sessionId = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
    private val sessionDir: File by lazy {
        File(getExternalFilesDir(null) ?: filesDir, "Panorama/" + sessionId).apply { mkdirs() }
    }

    private lateinit var tracker: OrientationTracker

    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) startCamera() else Toast.makeText(this, "Нужен доступ к камере", Toast.LENGTH_LONG).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        tracker = OrientationTracker(
            this,
            { newYaw, pitch, stable ->
                runOnUiThread {
                    yaw = newYaw
                    pitchNow = pitch
                    updateStatus(pitch)
                    updateGuide(pitch, stable)
                }
            },
            { _, _, roll, _ ->
                runOnUiThread {
                    rollNow = roll
                    cameraGuideOverlay.updateRoll(roll)
                }
            }
        )
        CaptureOrientationSettings.apply(this)
        chooseMode()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else permission.launch(Manifest.permission.CAMERA)
    }

    override fun onResume() {
        super.onResume()
        if (::tracker.isInitialized) tracker.start()
    }

    override fun onPause() {
        if (::tracker.isInitialized) tracker.stop()
        super.onPause()
    }

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
    }

    private fun chooseMode() {
        AlertDialog.Builder(this)
            .setTitle("Новая панорама")
            .setItems(arrayOf("360° панорама", "Прямоугольная панорама")) { _, which ->
                kind = if (which == 0) PanoramaKind.FULL_360 else PanoramaKind.RECTANGULAR
                row = if (kind == PanoramaKind.FULL_360) 1 else 0
                calibrated = false
                frames.clear()
                rectangularIndex = 0
                rectangularDirection = 1
                rectangularStartYaw = Float.NaN
                rectangularLastShotYaw = Float.NaN
                rectangularTargetYaw = Float.NaN
                rectangularTargetStepDeg = 0f
                updateModeUi()
            }
            .setCancelable(false)
            .show()
    }

    private fun buildUi() {
        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }

        preview = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
        root.addView(preview, FrameLayout.LayoutParams(-1, -1))

        ghost = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            alpha = 0.25f
            visibility = android.view.View.GONE
        }
        root.addView(ghost, FrameLayout.LayoutParams(-1, -1))

        cameraGuideOverlay = PanoramaGuideOverlay(this)
        root.addView(cameraGuideOverlay, FrameLayout.LayoutParams(-1, -1))

        guide = TextView(this).apply {
            gravity = Gravity.CENTER
            textSize = 22f
            setTextColor(Color.WHITE)
            setPadding(dp(12), dp(8), dp(12), dp(8))
            setBackgroundColor(0x66000000)
        }
        root.addView(
            guide,
            FrameLayout.LayoutParams(-2, -2, Gravity.CENTER)
        )

        val top = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setBackgroundColor(0x77000000)
        }
        root.addView(top, FrameLayout.LayoutParams(-1, -2, Gravity.TOP))

        status = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 18f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        top.addView(status)

        hint = TextView(this).apply {
            setTextColor(0xFFE0E6F0.toInt())
            textSize = 13f
            setPadding(0, dp(5), 0, dp(7))
        }
        top.addView(hint)

        val topButtons = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        top.addView(topButtons)

        topButtons.addView(button("РЕЖИМ") { chooseMode() }, weightParams())
        btnStart = button("СТАРТ / 0°") {
            baseYaw = yaw
            calibrated = true
            Toast.makeText(this, "Нулевая точка сохранена", Toast.LENGTH_SHORT).show()
            updateStatus(0f)
        }
        topButtons.addView(btnStart, weightParams(8))

        topButtons.addView(button("AUTO") {
            autoCapture = !autoCapture
            updateGuide(0f, false)
        }, weightParams())

        btnOrientation = button("ОРИЕНТАЦИЯ") {
            showOrientationDialog()
        }
        topButtons.addView(btnOrientation, weightParams())

        topButtons.addView(button("НАПРАВЛЕНИЕ") {
            if (kind == PanoramaKind.RECTANGULAR) {
                rectangularDirection *= -1
                frames.lastOrNull()?.file?.let { loadGhost(it) }
                updateModeUi()
            } else {
                Toast.makeText(this, "Направление используется для прямоугольной панорамы", Toast.LENGTH_SHORT).show()
            }
        }, weightParams())

        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(10), dp(12), dp(16))
            setBackgroundColor(0x77000000)
        }
        root.addView(bottom, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM))

        val rows = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        bottom.addView(rows)

        btnDown = button("НИЖЕ") {
            if (row > 0) row--
            updateModeUi()
        }
        rows.addView(btnDown, weightParams())

        rowText = TextView(this).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 15f
        }
        rows.addView(rowText, weightParams(8))

        btnUp = button("ВЫШЕ") {
            if (row < 2) row++
            updateModeUi()
        }
        rows.addView(btnUp, weightParams())

        val captureLine = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, 0)
        }
        bottom.addView(captureLine)

        val shutter = Button(this).apply {
            text = "СНЯТЬ"
            setTextColor(Color.WHITE)
            textSize = 18f
            setBackgroundColor(0xFF1769AA.toInt())
            setOnClickListener { takeShot() }
        }
        captureLine.addView(shutter, LinearLayout.LayoutParams(0, dp(64), 1f).apply {
            marginEnd = dp(8)
        })

        btnBuild = Button(this).apply {
            text = "СОБРАТЬ JPG"
            setTextColor(Color.WHITE)
            textSize = 15f
            setBackgroundColor(0xFF1A8F6A.toInt())
            setOnClickListener { buildPanorama() }
        }
        captureLine.addView(btnBuild, LinearLayout.LayoutParams(0, dp(64), 1f))

        setContentView(root)
        updateModeUi()
    }

    private fun showOrientationDialog() {
        val modes = CaptureOrientationMode.values()
        val current = CaptureOrientationSettings.get(this)
        val checked = modes.indexOf(current).coerceAtLeast(0)

        AlertDialog.Builder(this)
            .setTitle("Ориентация съёмки")
            .setSingleChoiceItems(
                modes.map { it.title }.toTypedArray(),
                checked
            ) { dialog, which ->
                val mode = modes[which]
                CaptureOrientationSettings.set(this, mode)
                CaptureOrientationSettings.apply(this, mode)
                btnOrientation.text = "ОРИЕНТАЦИЯ: " + mode.buttonLabel
                dialog.dismiss()
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun button(text: String, action: () -> Unit): Button =
        Button(this).apply {
            this.text = text
            setTextColor(Color.WHITE)
            textSize = 12f
            setBackgroundColor(0xCC202A3A.toInt())
            setOnClickListener { action() }
        }

    private fun weightParams(endMargin: Int = 0) =
        LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginEnd = dp(endMargin) }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()
            val rotation = preview.display?.rotation ?: Surface.ROTATION_0
            val previewUseCase = Preview.Builder().setTargetRotation(rotation).build().also {
                it.setSurfaceProvider(preview.surfaceProvider)
            }
            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setTargetRotation(rotation)
                .build()
            try {
                provider.unbindAll()
                val camera = provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, previewUseCase, imageCapture)
                cameraCalibration = CameraCalibrationReader.read(this, camera.cameraInfo)
            } catch (e: Exception) {
                Toast.makeText(this, "Ошибка камеры: " + e.message, Toast.LENGTH_LONG).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun takeShot() {
        val capture = imageCapture ?: return
        if (busy) return
        val index = if (kind == PanoramaKind.FULL_360) {
            if (!calibrated) {
                Toast.makeText(this, "Сначала нажмите СТАРТ / 0°", Toast.LENGTH_SHORT).show()
                return
            }
            currentSector()
        } else rectangularIndex

        frames.firstOrNull { it.row == row && it.index == index }?.file?.delete()
        frames.removeAll { it.row == row && it.index == index }

        val rowDir = File(sessionDir, "row_" + (row + 1)).apply { mkdirs() }
        val file = File(rowDir, "frame_" + index.toString().padStart(3, '0') + ".jpg")
        busy = true

        capture.takePicture(
            ImageCapture.OutputFileOptions.Builder(file).build(),
            executor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(result: ImageCapture.OutputFileResults) {
                    val frameYaw = if (kind == PanoramaKind.FULL_360) normalize(yaw - baseYaw) else yaw
                    frames.add(
                        PanoramaFrame(
                            file = file,
                            row = row,
                            index = index,
                            yawDeg = frameYaw,
                            pitchDeg = pitchNow,
                            rollDeg = rollNow,
                            calibration = cameraCalibration
                        )
                    )
                    if (kind == PanoramaKind.RECTANGULAR) {
                        if (!rectangularStartYaw.isFinite()) rectangularStartYaw = frameYaw
                        rectangularLastShotYaw = frameYaw
                        rectangularTargetStepDeg = rectangularStepDeg()
                        rectangularTargetYaw = normalizeSigned(
                            frameYaw + rectangularDirection * rectangularTargetStepDeg
                        )
                        rectangularIndex++
                    }
                    runOnUiThread {
                        busy = false
                        lastAutoRow = row
                        lastAutoSector = index
                        stableSince = 0L
                        loadGhost(file)
                        updateModeUi()
                    }
                }

                override fun onError(exc: ImageCaptureException) {
                    runOnUiThread {
                        busy = false
                        Toast.makeText(this@PanoramaCaptureActivity, "Ошибка: " + exc.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        )
    }

    private fun currentSector(): Int {
        val rel = normalize(yaw - baseYaw)
        val step = 360f / sectors
        return floor((rel + step / 2f) / step).toInt() % sectors
    }

    private fun updateGuide(pitch: Float, stable: Boolean) {
        if (kind == PanoramaKind.RECTANGULAR) {
            updateRectangularGuide(stable)
            return
        }

        if (!calibrated) {
            guide.setTextColor(Color.WHITE)
            guide.text = "СТАРТ / 0°"
            stableSince = 0L
            return
        }

        val rel = normalize(yaw - baseYaw)
        val step = 360f / sectors
        val sector = currentSector()
        val target = sector * step
        val signedError = signedAngularError(rel, target)
        val error = kotlin.math.abs(signedError)
        val targetPitch = when (row) {
            0 -> 28f
            1 -> 0f
            else -> -28f
        }
        val pitchError = targetPitch - pitch
        val pitchGood = kotlin.math.abs(pitchError) < 8f
        val captured = frames.any { it.row == row && it.index == sector }
        val good = stable && error < 5f && pitchGood

        guide.setTextColor(
            when {
                captured -> 0xFF9AA7B8.toInt()
                good -> 0xFF7CFF9B.toInt()
                else -> Color.WHITE
            }
        )

        guide.text = when {
            captured -> "✓ СЕКТОР СНЯТ\nПОВЕРНИТЕСЬ ДАЛЬШЕ →"
            kotlin.math.abs(pitchError) >= 8f ->
                if (pitchError > 0f)
                    "↑ ПОДНИМИТЕ КАМЕРУ\n" + kotlin.math.abs(pitchError).toInt() + "°"
                else
                    "↓ ОПУСТИТЕ КАМЕРУ\n" + kotlin.math.abs(pitchError).toInt() + "°"
            good -> "● ГОТОВО\nДЕРЖИТЕ НЕПОДВИЖНО"
            signedError > 0f -> "← ПОВЕРНИТЕ " + error.toInt() + "°"
            else -> "ПОВЕРНИТЕ " + error.toInt() + "° →"
        }

        if (autoCapture && good && !captured && !busy) {
            if (stableSince == 0L) stableSince = System.currentTimeMillis()
            if (
                System.currentTimeMillis() - stableSince > 650L &&
                !(lastAutoRow == row && lastAutoSector == sector)
            ) {
                takeShot()
                stableSince = 0L
            }
        } else {
            stableSince = 0L
        }
    }

    private fun rectangularStepDeg(): Float {
        // Целимся примерно в 42% перекрытия. Это достаточно для ORB/RANSAC
        // и при этом не заставляет делать чрезмерное количество кадров.
        val hfov = cameraCalibration.horizontalFovDeg
        val usableFov = if (hfov.isFinite() && hfov in 30f..120f) hfov else 68f
        return (usableFov * 0.58f).coerceIn(18f, 42f)
    }

    private fun updateRectangularGuide(stable: Boolean) {
        if (frames.isEmpty() || !rectangularLastShotYaw.isFinite()) {
            guide.setTextColor(Color.WHITE)
            guide.text = "СНИМИТЕ ПЕРВЫЙ КАДР"
            stableSince = 0L
            return
        }

        if (!rectangularTargetYaw.isFinite()) {
            rectangularTargetStepDeg = rectangularStepDeg()
            rectangularTargetYaw = normalizeSigned(
                rectangularLastShotYaw + rectangularDirection * rectangularTargetStepDeg
            )
        }

        val error = signedAngularError(rectangularTargetYaw, yaw)
        val absError = kotlin.math.abs(error)
        val rollGood = kotlin.math.abs(rollNow) < 5.5f
        val pitchReference = frames.lastOrNull()?.pitchDeg ?: pitchNow
        val pitchError = kotlin.math.abs(pitchNow - pitchReference)
        val aligned = absError < 3.5f && pitchError < 5f && rollGood
        val good = stable && aligned

        guide.setTextColor(
            when {
                good -> 0xFF7CFF9B.toInt()
                absError < 8f -> 0xFFFFD166.toInt()
                else -> Color.WHITE
            }
        )

        val overlap = ((1f - kotlin.math.abs(
            signedAngularError(yaw, rectangularLastShotYaw)
        ) / (cameraCalibration.horizontalFovDeg.takeIf {
            it.isFinite() && it in 30f..120f
        } ?: 68f)) * 100f).toInt().coerceIn(0, 100)

        guide.text = when {
            pitchError >= 5f -> "ДЕРЖИТЕ ВЫСОТУ • Δ " + pitchError.toInt() + "°"
            !rollGood -> "ВЫРОВНЯЙТЕ ГОРИЗОНТ • " + kotlin.math.abs(rollNow).toInt() + "°"
            good -> "● КАДР ГОТОВ • ПЕРЕКРЫТИЕ ~" + overlap + "%"
            error * rectangularDirection > 0f ->
                "ЕЩЁ " + absError.toInt() + "° →  •  ПЕРЕКРЫТИЕ ~" + overlap + "%"
            else ->
                "← НАЗАД " + absError.toInt() + "°  •  ПЕРЕКРЫТИЕ ~" + overlap + "%"
        }

        if (autoCapture && good && !busy) {
            if (stableSince == 0L) stableSince = System.currentTimeMillis()
            if (System.currentTimeMillis() - stableSince > 500L) {
                takeShot()
                stableSince = 0L
            }
        } else {
            stableSince = 0L
        }
    }

    private fun normalizeSigned(value: Float): Float {
        var out = (value + 180f) % 360f
        if (out < 0f) out += 360f
        return out - 180f
    }

    private fun signedAngularError(a: Float, b: Float): Float {
        var d = (a - b + 540f) % 360f - 180f
        if (d < -180f) d += 360f
        return d
    }

    private fun loadGhost(file: File) {
        executor.execute {
            val source = GhostFrameDecoder.decode(file, 960, 960)

            val prepared = if (source != null && kind == PanoramaKind.RECTANGULAR) {
                val stripWidth = (source.width * 0.34f).toInt().coerceAtLeast(1)
                val startX =
                    if (rectangularDirection >= 0)
                        (source.width - stripWidth).coerceAtLeast(0)
                    else
                        0

                val strip = android.graphics.Bitmap.createBitmap(
                    source,
                    startX,
                    0,
                    stripWidth,
                    source.height
                )

                if (strip !== source && !source.isRecycled) source.recycle()
                strip
            } else {
                source
            }

            runOnUiThread {
                val old = ghostBitmap
                ghostBitmap = prepared
                ghost.setImageBitmap(prepared)

                if (kind == PanoramaKind.RECTANGULAR && prepared != null) {
                    ghost.scaleType = ImageView.ScaleType.FIT_XY
                    val width = (resources.displayMetrics.widthPixels * 0.34f).toInt()
                    val params = FrameLayout.LayoutParams(
                        width,
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        if (rectangularDirection >= 0) Gravity.START else Gravity.END
                    )
                    ghost.layoutParams = params
                } else {
                    ghost.scaleType = ImageView.ScaleType.CENTER_CROP
                    ghost.layoutParams = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                }

                ghost.visibility =
                    if (prepared != null) android.view.View.VISIBLE else android.view.View.GONE

                if (old != null && old !== prepared && !old.isRecycled) old.recycle()
            }
        }
    }

    private fun updateStatus(pitch: Float) {
        if (kind == PanoramaKind.FULL_360) {
            val sector = if (calibrated) currentSector() + 1 else 0
            status.text = "360° • сектор " + sector + " / " + sectors + " • ряд " + (row + 1) + "/3"
            hint.text = if (calibrated)
                "Поворачивайтесь вокруг своей оси. Снимайте сектор, когда кадр стабилен."
            else
                "Наведите камеру вперёд и нажмите СТАРТ / 0°. Для 360° снимите 3 ряда."
        } else {
            status.text = "ПРЯМОУГОЛЬНАЯ • кадров: " + frames.size +
                if (rectangularDirection >= 0) " • →" else " • ←"
            hint.text =
                if (rectangularDirection >= 0)
                    "Двигайтесь слева направо. Совмещайте левую часть нового кадра с ghost правого края предыдущего."
                else
                    "Двигайтесь справа налево. Совмещайте правую часть нового кадра с ghost левого края предыдущего."
        }
    }

    private fun updateModeUi() {
        val is360 = kind == PanoramaKind.FULL_360
        btnStart.visibility = if (is360) android.view.View.VISIBLE else android.view.View.GONE
        btnUp.visibility = if (is360) android.view.View.VISIBLE else android.view.View.GONE
        btnDown.visibility = if (is360) android.view.View.VISIBLE else android.view.View.GONE
        rowText.visibility = if (is360) android.view.View.VISIBLE else android.view.View.GONE
        rowText.text = when (row) {
            0 -> "НИЖНИЙ РЯД"
            1 -> "ЦЕНТРАЛЬНЫЙ РЯД"
            else -> "ВЕРХНИЙ РЯД"
        }
        btnDown.isEnabled = row > 0
        btnUp.isEnabled = row < 2
        btnBuild.isEnabled = frames.size >= 2
        btnOrientation.text =
            "ОРИЕНТАЦИЯ: " + CaptureOrientationSettings.get(this).buttonLabel
        ghost.alpha = if (kind == PanoramaKind.RECTANGULAR) 0.38f else 0.20f
        if (frames.isEmpty()) {
            ghost.visibility = android.view.View.GONE
        }
        updateStatus(0f)
        updateGuide(0f, false)
    }

    private fun buildPanorama() {
        if (frames.size < 2 || busy) {
            Toast.makeText(this, "Нужно минимум два кадра", Toast.LENGTH_SHORT).show()
            return
        }

        if (kind == PanoramaKind.FULL_360) {
            val missing = (0..2).sumOf { r ->
                (0 until sectors).count { s -> frames.none { it.row == r && it.index == s } }
            }
            if (missing > 0) {
                AlertDialog.Builder(this)
                    .setTitle("Есть неснятые сектора")
                    .setMessage("Не хватает " + missing + " кадров. Собрать панораму всё равно?")
                    .setPositiveButton("Собрать") { _, _ -> doBuild() }
                    .setNegativeButton("Продолжить съёмку", null)
                    .show()
                return
            }
        }
        doBuild()
    }

    private fun doBuild() {
        busy = true
        btnBuild.isEnabled = false
        val output = File(sessionDir, "panorama_" + sessionId + ".jpg")
        hint.text = "Собираю панораму…"

        executor.execute {
            try {
                PanoramaStitcher.stitch(frames.toList(), kind, output) { message ->
                    runOnUiThread { hint.text = message }
                }
                val uri = PublicStorage.publishPanorama(
                    this@PanoramaCaptureActivity,
                    output,
                    output.name
                )
                runOnUiThread {
                    busy = false
                    btnBuild.isEnabled = true
                    val dialog = AlertDialog.Builder(this)
                        .setTitle("Панорама готова")
                        .setMessage(
                            "Итоговый JPG сохранён в Pictures/Panorama.\n\n" +
                            "Файл: " + output.name + "\n" +
                            "Кадров: " + frames.size
                        )

                    if (kind == PanoramaKind.FULL_360) {
                        dialog.setPositiveButton("Смотреть 360°") { _, _ ->
                            startActivity(
                                Intent(this, PanoramaViewerActivity::class.java)
                                    .putExtra(PanoramaViewerActivity.EXTRA_FILE, output.absolutePath)
                            )
                        }
                        dialog.setNeutralButton("Редактор") { _, _ ->
                            startActivity(
                                Intent(this, PanoramaEditorActivity::class.java)
                                    .putExtra(PanoramaEditorActivity.EXTRA_FILE, output.absolutePath)
                            )
                        }
                    } else {
                        dialog.setPositiveButton("Открыть JPG") { _, _ ->
                            if (uri != null) {
                                startActivity(Intent(Intent.ACTION_VIEW).apply {
                                    setDataAndType(uri, "image/jpeg")
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                })
                            }
                        }
                        dialog.setNeutralButton("Редактор") { _, _ ->
                            startActivity(
                                Intent(this, PanoramaEditorActivity::class.java)
                                    .putExtra(PanoramaEditorActivity.EXTRA_FILE, output.absolutePath)
                            )
                        }
                    }

                    dialog
                        .setNegativeButton("Закрыть", null)
                        .show()
                    updateModeUi()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    busy = false
                    btnBuild.isEnabled = true
                    Toast.makeText(this, "Ошибка склейки: " + e.message, Toast.LENGTH_LONG).show()
                    updateModeUi()
                }
            }
        }
    }

    private fun normalize(value: Float): Float {
        var result = value % 360f
        if (result < 0) result += 360f
        return result
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
