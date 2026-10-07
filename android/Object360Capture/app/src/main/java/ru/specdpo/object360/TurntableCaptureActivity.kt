package ru.specdpo.object360

import android.Manifest
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.view.View
import android.view.ViewGroup
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
import ru.specdpo.object360.databinding.ActivityTurntableCaptureBinding
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.math.roundToInt

class TurntableCaptureActivity : AppCompatActivity() {

    private lateinit var binding: ActivityTurntableCaptureBinding
    private lateinit var cameraExecutor: ExecutorService
    private lateinit var session: CaptureSession

    private var imageCapture: ImageCapture? = null
    private var previewUseCase: Preview? = null

    private val handler = Handler(Looper.getMainLooper())
    private var sequenceRunning = false
    private var captureBusy = false
    private var currentSector = 0
    private var interfaceHidden = false

    private val angleSteps = floatArrayOf(5f, 10f, 15f)
    private var angleIndex = 1

    private val intervalOptionsMs = longArrayOf(1000L, 2000L, 3000L, 5000L)
    private var intervalIndex = 2

    private var ghostEnabled = true
    private var ghostBitmap: Bitmap? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startCamera()
        else {
            Toast.makeText(this, "Для режима стола нужен доступ к камере", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTurntableCaptureBinding.inflate(layoutInflater)
        setContentView(binding.root)

        cameraExecutor = Executors.newSingleThreadExecutor()
        session = CaptureSession(
            getExternalFilesDir(null) ?: filesDir,
            sectors = sectorsForAngle(angleSteps[angleIndex]),
            rows = 1
        )

        setupUi()
        CaptureOrientationSettings.apply(this)
        requestLegacyStoragePermission()
        applyResponsiveLayout()
        updateUi()

        if (
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun setupUi() {
        binding.btnTurntableBack.setOnClickListener { finish() }

        binding.btnTurntableAngle.setOnClickListener {
            if (sequenceRunning) {
                Toast.makeText(this, "Сначала поставьте серию на паузу", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val next = (angleIndex + 1) % angleSteps.size
            changeAngleStep(next)
        }

        binding.btnTurntableInterval.setOnClickListener {
            intervalIndex = (intervalIndex + 1) % intervalOptionsMs.size
            updateUi()
        }

        binding.btnTurntableOrientation.setOnClickListener {
            if (sequenceRunning) pauseSequence()
            showOrientationDialog()
        }

        binding.btnTurntableGhost.setOnClickListener { toggleGhost() }

        binding.btnTurntableHideUi.setOnClickListener { setInterfaceHidden(true) }
        binding.btnTurntableShowUi.setOnClickListener { setInterfaceHidden(false) }

        binding.btnTurntableManual.setOnClickListener {
            if (sequenceRunning) pauseSequence()
            takeShot(false)
        }
        binding.btnTurntableCleanManual.setOnClickListener {
            if (sequenceRunning) pauseSequence()
            takeShot(false)
        }

        binding.btnTurntableStart.setOnClickListener {
            if (sequenceRunning) pauseSequence() else startSequence()
        }

        binding.btnTurntableReview.setOnClickListener {
            pauseSequence()
            Object360ReviewDialog.show(this, session)
        }

        binding.btnTurntableProcess.setOnClickListener {
            pauseSequence()
            ObjectProcessingDialog.show(
                this,
                session,
                cameraExecutor
            ) {
                updateUi()
                refreshGhost()
            }
        }

        binding.btnTurntableExport.setOnClickListener {
            pauseSequence()
            exportZip()
        }
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
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()
            val rotation = currentDisplayRotation()

            val preview = Preview.Builder()
                .setTargetRotation(rotation)
                .build()
                .also {
                    it.setSurfaceProvider(binding.turntablePreview.surfaceProvider)
                }
            previewUseCase = preview

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setTargetRotation(rotation)
                .build()

            try {
                provider.unbindAll()
                provider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageCapture
                )
            } catch (e: Exception) {
                Toast.makeText(
                    this,
                    "Ошибка камеры: ${e.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun changeAngleStep(nextIndex: Int) {
        val apply = {
            angleIndex = nextIndex
            val sectors = sectorsForAngle(angleSteps[angleIndex])
            session.resetGrid(newSectors = sectors, newRows = 1)
            currentSector = 0
            clearGhost()
            updateUi()
        }

        if (session.shots.isEmpty()) {
            apply()
        } else {
            AlertDialog.Builder(this)
                .setTitle("Изменить шаг поворота?")
                .setMessage("Снятая серия будет сброшена, потому что изменится количество кадров на оборот.")
                .setPositiveButton("Изменить") { _, _ -> apply() }
                .setNegativeButton("Отмена", null)
                .show()
        }
    }

    private fun startSequence() {
        if (captureBusy) return

        val missing = firstMissingSector()
        if (missing == null) {
            binding.turntableHint.text = "✓ Полный оборот уже снят"
            Toast.makeText(this, "Серия уже готова", Toast.LENGTH_SHORT).show()
            return
        }

        currentSector = missing
        sequenceRunning = true
        binding.btnTurntableStart.text = "ПАУЗА"
        scheduleCountdown()
        updateUi()
    }

    private fun pauseSequence() {
        sequenceRunning = false
        handler.removeCallbacksAndMessages(null)
        binding.btnTurntableStart.text = "СТАРТ"
        binding.turntableHint.text =
            "Пауза. Установите объект на сектор ${currentSector + 1} и продолжайте."
    }

    private fun scheduleCountdown() {
        if (!sequenceRunning) return

        var seconds = (intervalOptionsMs[intervalIndex] / 1000L).toInt().coerceAtLeast(1)

        fun tick() {
            if (!sequenceRunning) return

            if (seconds <= 0) {
                if (!captureBusy) {
                    takeShot(true)
                } else {
                    handler.postDelayed({ tick() }, 250L)
                }
                return
            }

            val step = angleSteps[angleIndex]
            binding.turntableHint.text =
                "Поверните стол на ${formatAngle(step)}° • кадр ${currentSector + 1}/${session.sectors} через $seconds с"
            binding.turntableCleanStatus.text =
                "${session.completedTotal()} / ${session.requiredTotal()} • $seconds с"

            seconds--
            handler.postDelayed({ tick() }, 1000L)
        }

        tick()
    }

    private fun takeShot(fromSequence: Boolean) {
        val capture = imageCapture ?: return
        if (captureBusy) return

        if (session.isShot(0, currentSector)) {
            val next = firstMissingSector()
            if (next == null) {
                finishSequence()
                return
            }
            currentSector = next
        }

        captureBusy = true

        val sector = currentSector
        val angle = sector * angleSteps[angleIndex]
        val file = session.fileFor(0, sector)
        val options = ImageCapture.OutputFileOptions.Builder(file).build()

        capture.takePicture(
            options,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    synchronized(session) {
                        session.register(0, sector, angle, file)
                    }

                    runCatching {
                        PublicStorage.publishPhoto(
                            this@TurntableCaptureActivity,
                            file,
                            session.sessionId,
                            0,
                            sector
                        )
                    }

                    loadGhost(file)

                    runOnUiThread {
                        captureBusy = false
                        updateUi()

                        val next = firstMissingSectorAfter(sector)
                        if (next == null) {
                            finishSequence()
                        } else {
                            currentSector = next
                            updateUi()

                            if (fromSequence && sequenceRunning) {
                                scheduleCountdown()
                            } else {
                                binding.turntableHint.text =
                                    "Кадр ${sector + 1} снят. Поверните стол на ${formatAngle(angleSteps[angleIndex])}°."
                            }
                        }
                    }
                }

                override fun onError(exc: ImageCaptureException) {
                    runOnUiThread {
                        captureBusy = false
                        binding.turntableHint.text =
                            "Ошибка кадра: ${exc.message ?: "неизвестная ошибка"}"
                        if (fromSequence && sequenceRunning) {
                            handler.postDelayed({ scheduleCountdown() }, 1000L)
                        }
                    }
                }
            }
        )
    }

    private fun finishSequence() {
        sequenceRunning = false
        handler.removeCallbacksAndMessages(null)
        binding.btnTurntableStart.text = "СТАРТ"
        binding.turntableHint.text =
            "✓ Серия готова: ${session.completedTotal()} / ${session.requiredTotal()}. Проверьте 3D-просмотр."
        updateUi()
    }

    private fun firstMissingSector(): Int? =
        (0 until session.sectors).firstOrNull { !session.isShot(0, it) }

    private fun firstMissingSectorAfter(after: Int): Int? {
        for (offset in 1..session.sectors) {
            val sector = (after + offset) % session.sectors
            if (!session.isShot(0, sector)) return sector
        }
        return null
    }

    private fun updateUi() {
        val step = angleSteps[angleIndex]
        val intervalSec = intervalOptionsMs[intervalIndex] / 1000L
        val orientationMode = CaptureOrientationSettings.get(this)

        binding.btnTurntableAngle.text = "ШАГ: ${formatAngle(step)}°"
        binding.btnTurntableInterval.text = "ИНТЕРВАЛ: $intervalSec С"
        binding.btnTurntableOrientation.text =
            "ОРИЕНТАЦИЯ: ${orientationMode.buttonLabel}"
        binding.btnTurntableGhost.text =
            if (ghostEnabled) "GHOST: 20%" else "GHOST: ВЫКЛ"

        binding.turntableProgress.text =
            "${session.completedTotal()} / ${session.requiredTotal()}"
        binding.turntableCleanStatus.text =
            "${session.completedTotal()} / ${session.requiredTotal()}"

        binding.turntableStatus.text =
            "Стол • ${formatAngle(step)}° • ${session.sectors} кадров"

        binding.turntableCoverageOverlay.landscapeLayout =
            resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        binding.turntableCoverageOverlay.sectors = session.sectors
        binding.turntableCoverageOverlay.rows = 1
        binding.turntableCoverageOverlay.currentRow = 0
        binding.turntableCoverageOverlay.currentSector = currentSector
        binding.turntableCoverageOverlay.captured =
            synchronized(session) { session.shots.keys.toSet() }

        binding.btnTurntableAngle.isEnabled = !sequenceRunning
        binding.btnTurntableOrientation.isEnabled = !sequenceRunning
    }

    private fun toggleGhost() {
        ghostEnabled = !ghostEnabled
        binding.btnTurntableGhost.text =
            if (ghostEnabled) "GHOST: 20%" else "GHOST: ВЫКЛ"

        if (!ghostEnabled) {
            binding.turntableGhostOverlay.visibility = View.GONE
        } else if (ghostBitmap != null) {
            binding.turntableGhostOverlay.visibility = View.VISIBLE
        } else {
            refreshGhost()
        }
    }

    private fun refreshGhost() {
        if (!ghostEnabled) return

        val shot = synchronized(session) {
            session.shots.values
                .filter { it.file.exists() }
                .maxByOrNull { it.file.lastModified() }
        }

        if (shot == null) clearGhost() else loadGhost(shot.file)
    }

    private fun loadGhost(file: File) {
        val targetWidth = resources.displayMetrics.widthPixels
        val targetHeight = resources.displayMetrics.heightPixels

        cameraExecutor.execute {
            val bitmap = GhostFrameDecoder.decode(file, targetWidth, targetHeight)
            runOnUiThread {
                if (isFinishing || isDestroyed) {
                    bitmap?.recycle()
                    return@runOnUiThread
                }

                val old = ghostBitmap
                ghostBitmap = bitmap
                binding.turntableGhostOverlay.setImageBitmap(bitmap)
                binding.turntableGhostOverlay.visibility =
                    if (ghostEnabled && bitmap != null) View.VISIBLE else View.GONE

                if (old != null && old !== bitmap && !old.isRecycled) {
                    old.recycle()
                }
            }
        }
    }

    private fun clearGhost() {
        val old = ghostBitmap
        ghostBitmap = null
        binding.turntableGhostOverlay.setImageDrawable(null)
        binding.turntableGhostOverlay.visibility = View.GONE
        if (old != null && !old.isRecycled) old.recycle()
    }

    private fun setInterfaceHidden(hidden: Boolean) {
        interfaceHidden = hidden
        binding.turntableTopPanel.visibility = if (hidden) View.GONE else View.VISIBLE
        binding.turntableBottomPanel.visibility = if (hidden) View.GONE else View.VISIBLE
        binding.turntableCleanControls.visibility = if (hidden) View.VISIBLE else View.GONE
        binding.turntableCoverageOverlay.minimalMode = hidden
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
                binding.btnTurntableOrientation.text =
                    "ОРИЕНТАЦИЯ: ${mode.buttonLabel}"
                dialog.dismiss()
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun exportZip() {
        val shots = synchronized(session) {
            session.shots.values
                .filter { it.file.exists() }
                .sortedBy { it.sector }
        }

        if (shots.isEmpty()) {
            Toast.makeText(this, "Сначала снимите объект", Toast.LENGTH_SHORT).show()
            return
        }

        val zip = File(
            session.dir.parentFile,
            "${session.sessionId}.turntable.object360.zip"
        )

        cameraExecutor.execute {
            try {
                ZipOutputStream(FileOutputStream(zip)).use { zos ->
                    val json = buildString {
                        append("{\n")
                        append("  \"format\": \"object360\",\n")
                        append("  \"version\": 3,\n")
                        append("  \"captureMode\": \"turntable\",\n")
                        append("  \"sectors\": ${session.sectors},\n")
                        append("  \"rows\": 1,\n")
                        append("  \"angleStepDegrees\": ${formatAngle(angleSteps[angleIndex])},\n")
                        append("  \"intervalSeconds\": ${intervalOptionsMs[intervalIndex] / 1000L},\n")
                        append("  \"complete\": ${shots.size == session.requiredTotal()}\n")
                        append("}\n")
                    }

                    zos.putNextEntry(ZipEntry("config.json"))
                    zos.write(json.toByteArray())
                    zos.closeEntry()

                    shots.forEach { shot ->
                        zos.putNextEntry(ZipEntry("row_1/${shot.file.name}"))
                        shot.file.inputStream().use { it.copyTo(zos) }
                        zos.closeEntry()
                    }
                }

                PublicStorage.publishZip(
                    this,
                    zip,
                    "${session.sessionId}.turntable.object360.zip"
                )

                runOnUiThread {
                    AlertDialog.Builder(this)
                        .setTitle("Экспорт поворотного стола готов")
                        .setMessage(
                            "ZIP сохранён в Загрузки/Object360/.\n\n" +
                                "Шаг: ${formatAngle(angleSteps[angleIndex])}°\n" +
                                "Интервал: ${intervalOptionsMs[intervalIndex] / 1000L} с"
                        )
                        .setPositiveButton("OK", null)
                        .show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(
                        this,
                        "Ошибка ZIP: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun sectorsForAngle(angle: Float): Int =
        (360f / angle).roundToInt().coerceAtLeast(1)

    private fun formatAngle(angle: Float): String =
        if (angle % 1f == 0f) angle.toInt().toString() else "%.1f".format(angle)

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

    private fun applyResponsiveLayout() {
        val landscape =
            resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

        binding.turntableCoverageOverlay.landscapeLayout = landscape
        binding.turntableHint.maxWidth = dp(if (landscape) 560 else 360)

        binding.btnTurntableProcess.layoutParams =
            binding.btnTurntableProcess.layoutParams.apply {
                width = if (landscape) dp(520) else ViewGroup.LayoutParams.MATCH_PARENT
            }
        binding.btnTurntableProcess.requestLayout()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        updateCameraRotation()
        applyResponsiveLayout()
        updateUi()
    }

    override fun onPause() {
        if (sequenceRunning) pauseSequence()
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        clearGhost()
        cameraExecutor.shutdown()
        super.onDestroy()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
