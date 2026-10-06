package ru.specdpo.object360

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Surface
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
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
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import ru.specdpo.object360.databinding.ActivityMainBinding
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.math.abs
import kotlin.math.floor

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var cameraExecutor: ExecutorService
    private var imageCapture: ImageCapture? = null
    private var previewUseCase: Preview? = null
    private lateinit var session: CaptureSession
    private lateinit var orientationTracker: OrientationTracker

    private var yawDeg = 0f
    private var baseYawDeg = 0f
    private var calibrated = false
    private var currentSector = 0
    private var currentRow = 0
    private var autoMode = false
    private var stableSince = 0L
    private var lastAutoSector = -1
    private var captureBusy = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startCamera() else Toast.makeText(this, "Нужен доступ к камере", Toast.LENGTH_LONG).show()
    }

    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        cameraExecutor = Executors.newSingleThreadExecutor()
        session = CaptureSession(getExternalFilesDir(null) ?: filesDir)

        orientationTracker = OrientationTracker(this) { yaw, _, stable ->
            runOnUiThread { onOrientation(yaw, stable) }
        }

        setupUi()
        requestLegacyStoragePermission()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun setupUi() {
        binding.btnCaptureOrientation.setOnClickListener {
            showOrientationDialog()
        }
        binding.btnArMode.setOnClickListener {
            startActivity(Intent(this, ArCaptureActivity::class.java))
        }
        binding.btn36.setOnClickListener { changeSectors(36) }
        binding.btn72.setOnClickListener { changeSectors(72) }
        binding.btnCalibrate.setOnClickListener {
            baseYawDeg = yawDeg
            calibrated = true
            currentSector = 0
            lastAutoSector = -1
            binding.hintText.text = "Нулевая точка сохранена. Обойдите объект по кругу."
            updateUi()
        }
        binding.btnAuto.setOnClickListener {
            autoMode = !autoMode
            binding.btnAuto.text = if (autoMode) "AUTO: ВКЛ" else "AUTO: ВЫКЛ"
            stableSince = 0L
        }
        binding.btnShutter.setOnClickListener { takeShot(false) }
        binding.btnRowsMode.setOnClickListener { toggleRows() }
        binding.btnRowUp.setOnClickListener {
            if (currentRow < session.rows - 1) currentRow++
            updateUi()
        }
        binding.btnRowDown.setOnClickListener {
            if (currentRow > 0) currentRow--
            updateUi()
        }
        binding.btnReview.setOnClickListener { showReview() }
        binding.btnExport.setOnClickListener { exportZip() }
        applyResponsiveLayout()
        updateUi()
    }

    private fun requestLegacyStoragePermission() {
        if (
            Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            storagePermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val rotation = currentDisplayRotation()
            val preview = Preview.Builder()
                .setTargetRotation(rotation)
                .build()
                .also {
                    it.setSurfaceProvider(binding.previewView.surfaceProvider)
                }
            previewUseCase = preview
            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setTargetRotation(rotation)
                .build()
            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageCapture
                )
            } catch (e: Exception) {
                Toast.makeText(this, "Ошибка камеры: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun onOrientation(yaw: Float, stable: Boolean) {
        yawDeg = yaw
        if (!calibrated) {
            binding.angleText.text = "—"
            return
        }
        val rel = normalize360(yawDeg - baseYawDeg)
        val step = 360f / session.sectors
        currentSector = floor((rel + step / 2f) / step).toInt() % session.sectors
        binding.angleText.text = "${rel.toInt()}°"
        updateUi()

        if (autoMode && !session.isShot(currentRow, currentSector) && !captureBusy) {
            val target = currentSector * step
            val error = angularDistance(rel, target)
            if (stable && error < step * 0.26f) {
                if (stableSince == 0L) stableSince = System.currentTimeMillis()
                if (System.currentTimeMillis() - stableSince > 450 && lastAutoSector != currentSector) {
                    lastAutoSector = currentSector
                    takeShot(true)
                    stableSince = 0L
                }
            } else {
                stableSince = 0L
            }
        }
    }

    private fun takeShot(fromAuto: Boolean) {
        if (!calibrated) {
            Toast.makeText(this, "Сначала наведитесь на объект и нажмите СТАРТ / 0°", Toast.LENGTH_SHORT).show()
            return
        }
        val capture = imageCapture ?: return
        if (captureBusy) return
        captureBusy = true

        val row = currentRow
        val sector = currentSector
        val rel = normalize360(yawDeg - baseYawDeg)
        val file = session.fileFor(row, sector)
        val options = ImageCapture.OutputFileOptions.Builder(file).build()

        capture.takePicture(
            options,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    session.register(row, sector, rel, file)
                    runCatching {
                        PublicStorage.publishPhoto(
                            this@MainActivity,
                            file,
                            session.sessionId,
                            row,
                            sector
                        )
                    }
                    runOnUiThread {
                        captureBusy = false
                        updateUi()
                        binding.hintText.text = if (fromAuto) {
                            "AUTO: снят сектор ${sector + 1}"
                        } else {
                            "Снят сектор ${sector + 1} из ${session.sectors}"
                        }
                    }
                }

                override fun onError(exc: ImageCaptureException) {
                    runOnUiThread {
                        captureBusy = false
                        Toast.makeText(this@MainActivity, "Ошибка снимка: ${exc.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        )
    }

    private fun changeSectors(count: Int) {
        if (session.shots.isNotEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("Изменить количество кадров?")
                .setMessage("Текущая разметка кадров будет сброшена.")
                .setPositiveButton("Изменить") { _, _ -> applySectorCount(count) }
                .setNegativeButton("Отмена", null)
                .show()
        } else applySectorCount(count)
    }

    private fun applySectorCount(count: Int) {
        session.resetGrid(newSectors = count, newRows = session.rows)
        currentSector = 0
        calibrated = false
        updateUi()
    }

    private fun toggleRows() {
        val newRows = if (session.rows == 1) 3 else 1
        if (session.shots.isNotEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("Переключить режим рядов?")
                .setMessage("Текущая разметка кадров будет сброшена.")
                .setPositiveButton("Переключить") { _, _ -> applyRows(newRows) }
                .setNegativeButton("Отмена", null)
                .show()
        } else applyRows(newRows)
    }

    private fun applyRows(rows: Int) {
        session.resetGrid(newRows = rows)
        currentRow = if (rows == 1) 0 else 1
        calibrated = false
        updateUi()
    }

    private fun updateUi() {
        val orientationMode = CaptureOrientationSettings.get(this)
        binding.btnCaptureOrientation.text = "ОРИЕНТАЦИЯ: ${orientationMode.buttonLabel}"
        binding.coverageOverlay.landscapeLayout =
            resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        binding.coverageOverlay.sectors = session.sectors
        binding.coverageOverlay.rows = session.rows
        binding.coverageOverlay.currentSector = currentSector
        binding.coverageOverlay.currentRow = currentRow
        binding.coverageOverlay.captured = session.shots.keys.toSet()
        binding.statusText.text = "${session.completedTotal()} / ${session.requiredTotal()}"
        binding.rowText.text = "Ряд\n${currentRow + 1} / ${session.rows}"
        binding.btnRowsMode.text = if (session.rows == 1) "1 РЯД" else "3 РЯДА"
        binding.btnRowUp.isEnabled = session.rows > 1 && currentRow < session.rows - 1
        binding.btnRowDown.isEnabled = session.rows > 1 && currentRow > 0
    }

    private fun showReview() {
        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20, 20, 20, 20)
        }
        for (row in 0 until session.rows) {
            root.addView(TextView(this).apply {
                text = "Ряд ${row + 1}: ${session.completedInRow(row)} / ${session.sectors}"
                textSize = 18f
                setPadding(0, 18, 0, 8)
            })
            for (start in 0 until session.sectors step 6) {
                val line = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                for (s in start until minOf(start + 6, session.sectors)) {
                    val shot = session.shots[row to s]
                    if (shot != null && shot.file.exists()) {
                        val iv = ImageView(this).apply {
                            layoutParams = LinearLayout.LayoutParams(0, 140, 1f).apply { setMargins(3, 3, 3, 3) }
                            scaleType = ImageView.ScaleType.CENTER_CROP
                            setImageBitmap(BitmapFactory.decodeFile(shot.file.absolutePath))
                            contentDescription = "Сектор ${s + 1}"
                            setOnClickListener {
                                AlertDialog.Builder(this@MainActivity)
                                    .setTitle("Сектор ${s + 1}")
                                    .setMessage(shot.file.name)
                                    .setPositiveButton("Переснять") { _, _ ->
                                        currentRow = row
                                        currentSector = s
                                        updateUi()
                                    }
                                    .setNegativeButton("Закрыть", null)
                                    .show()
                            }
                        }
                        line.addView(iv)
                    } else {
                        line.addView(TextView(this).apply {
                            layoutParams = LinearLayout.LayoutParams(0, 140, 1f).apply { setMargins(3, 3, 3, 3) }
                            gravity = android.view.Gravity.CENTER
                            text = "${s + 1}\n—"
                            setBackgroundColor(0xFF30343B.toInt())
                            setTextColor(0xFFFFFFFF.toInt())
                        })
                    }
                }
                root.addView(line)
            }
        }
        scroll.addView(root)
        AlertDialog.Builder(this)
            .setTitle("Покрытие объекта")
            .setView(scroll)
            .setPositiveButton("Готово", null)
            .show()
    }

    private fun exportZip() {
        if (session.shots.isEmpty()) {
            Toast.makeText(this, "Сначала сделайте хотя бы один кадр", Toast.LENGTH_SHORT).show()
            return
        }
        val zip = File(session.dir.parentFile, "${session.sessionId}.object360.zip")
        cameraExecutor.execute {
            try {
                ZipOutputStream(FileOutputStream(zip)).use { zos ->
                    val json = buildString {
                        append("{\n")
                        append("  \"format\": \"object360\",\n")
                        append("  \"version\": 1,\n")
                        append("  \"sectors\": ${session.sectors},\n")
                        append("  \"rows\": ${session.rows},\n")
                        append("  \"complete\": ${session.completedTotal() == session.requiredTotal()}\n")
                        append("}\n")
                    }
                    zos.putNextEntry(ZipEntry("config.json"))
                    zos.write(json.toByteArray())
                    zos.closeEntry()

                    session.shots.values.sortedWith(compareBy<ShotInfo> { it.row }.thenBy { it.sector }).forEach { shot ->
                        val name = "row_${shot.row + 1}/${shot.file.name}"
                        zos.putNextEntry(ZipEntry(name))
                        shot.file.inputStream().use { it.copyTo(zos) }
                        zos.closeEntry()
                    }
                }
                PublicStorage.publishZip(
                    this,
                    zip,
                    "${session.sessionId}.object360.zip"
                )
                runOnUiThread {
                    AlertDialog.Builder(this)
                        .setTitle("Экспорт готов")
                        .setMessage(
                            "ZIP сохранён в Загрузки/Object360/\n\n" +
                                "Фотографии доступны в Pictures/Object360/${session.sessionId}/"
                        )
                        .setPositiveButton("OK", null)
                        .show()
                }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this, "Ошибка ZIP: ${e.message}", Toast.LENGTH_LONG).show() }
            }
        }
    }

    private fun showOrientationDialog() {
        val modes = CaptureOrientationMode.values()
        val current = CaptureOrientationSettings.get(this)

        AlertDialog.Builder(this)
            .setTitle("Ориентация съёмки")
            .setSingleChoiceItems(
                modes.map { it.title }.toTypedArray(),
                current.ordinal
            ) { dialog, which ->
                val mode = modes[which]
                CaptureOrientationSettings.set(this, mode)
                CaptureOrientationSettings.apply(this, mode)
                binding.btnCaptureOrientation.text =
                    "ОРИЕНТАЦИЯ: ${mode.buttonLabel}"
                dialog.dismiss()
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun applyResponsiveLayout() {
        val landscape =
            resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

        binding.coverageOverlay.landscapeLayout = landscape

        val horizontalPadding = dp(if (landscape) 8 else 12)
        binding.topPanel.setPadding(
            horizontalPadding,
            horizontalPadding,
            horizontalPadding,
            horizontalPadding
        )

        val bottomPadding = dp(if (landscape) 8 else 16)
        binding.bottomPanel.setPadding(
            bottomPadding,
            bottomPadding,
            bottomPadding,
            bottomPadding
        )

        binding.hintText.maxWidth = dp(if (landscape) 520 else 340)

        binding.btnArMode.layoutParams = binding.btnArMode.layoutParams.apply {
            width = if (landscape) dp(520) else ViewGroup.LayoutParams.MATCH_PARENT
        }
        binding.btnArMode.requestLayout()
    }

    private fun updateCameraRotation() {
        val rotation = currentDisplayRotation()
        previewUseCase?.targetRotation = rotation
        imageCapture?.targetRotation = rotation
    }

    private fun currentDisplayRotation(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            display?.rotation ?: Surface.ROTATION_0
        } else {
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.rotation
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        updateCameraRotation()
        applyResponsiveLayout()
        updateUi()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    override fun onResume() {
        super.onResume()
        orientationTracker.start()
    }

    override fun onPause() {
        orientationTracker.stop()
        super.onPause()
    }

    override fun onDestroy() {
        cameraExecutor.shutdown()
        super.onDestroy()
    }

    private fun normalize360(value: Float): Float {
        var v = value % 360f
        if (v < 0) v += 360f
        return v
    }

    private fun angularDistance(a: Float, b: Float): Float {
        var d = abs(a - b) % 360f
        if (d > 180f) d = 360f - d
        return d
    }
}
