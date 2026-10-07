package ru.specdpo.object360

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Build
import android.os.Bundle
import android.view.Surface
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.ar.core.Anchor
import com.google.ar.core.ArCoreApk
import com.google.ar.core.CameraConfig
import com.google.ar.core.CameraConfigFilter
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.NotYetAvailableException
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableException
import com.google.ar.core.exceptions.UnavailableSdkTooOldException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import ru.specdpo.object360.databinding.ActivityArCaptureBinding
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class ArCaptureActivity : AppCompatActivity(), GLSurfaceView.Renderer {

    private lateinit var binding: ActivityArCaptureBinding
    private val backgroundRenderer = ArBackgroundRenderer()
    private val ioExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    @Volatile
    private var arSession: Session? = null

    private var textureSession: Session? = null
    private var installRequested = false
    private var surfaceWidth = 0
    private var surfaceHeight = 0
    private var displayRotation = Surface.ROTATION_0

    private lateinit var captureSession: CaptureSession
    private lateinit var orientationTracker: OrientationTracker

    @Volatile
    private var motionStable = false

    @Volatile
    private var placeCenterRequested = false

    @Volatile
    private var manualCaptureRequested = false

    @Volatile
    private var captureBusy = false

    private var centerAnchor: Anchor? = null
    private var initialOrbitAngleRad = 0.0
    private var baseRadiusM = 0f
    private var baseCameraHeightM = 0f
    private var rowSpacingM = 0.25f

    private var currentSector = 0
    private var currentRow = 0
    private var autoMode = false
    private var stableSince = 0L
    private var lastAutoKey = ""
    private var lastUiUpdateMs = 0L
    private var interfaceHidden = false

    private val objectDepthOptionsM = floatArrayOf(0.20f, 0.50f, 1.00f, 2.00f, 0.00f)
    private var objectDepthIndex = 0
    private var objectDepthM = objectDepthOptionsM[objectDepthIndex]

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) resumeAr() else {
            Toast.makeText(this, "Для AR-режима нужен доступ к камере", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityArCaptureBinding.inflate(layoutInflater)
        setContentView(binding.root)

        captureSession = CaptureSession(getExternalFilesDir(null) ?: filesDir)

        orientationTracker = OrientationTracker(this) { _, _, stable ->
            motionStable = stable
        }

        binding.arSurface.apply {
            preserveEGLContextOnPause = true
            setEGLContextClientVersion(2)
            setRenderer(this@ArCaptureActivity)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }

        setupUi()
        CaptureOrientationSettings.apply(this)
        requestLegacyStoragePermission()
        applyResponsiveLayout()
        updateStaticUi()
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

    private fun setupUi() {
        binding.btnArBack.setOnClickListener { finish() }
        binding.btnArOrientation.setOnClickListener {
            showOrientationDialog()
        }
        binding.btnArHideUi.setOnClickListener { setInterfaceHidden(true) }
        binding.btnArShowUi.setOnClickListener { setInterfaceHidden(false) }
        binding.btnArCleanShutter.setOnClickListener {
            manualCaptureRequested = true
        }

        binding.btnAr36.setOnClickListener { changeGrid(36, captureSession.rows) }
        binding.btnAr72.setOnClickListener { changeGrid(72, captureSession.rows) }

        binding.btnArRows.setOnClickListener {
            val rows = if (captureSession.rows == 1) 3 else 1
            changeGrid(captureSession.sectors, rows)
        }

        binding.btnArDepth.setOnClickListener {
            objectDepthIndex = (objectDepthIndex + 1) % objectDepthOptionsM.size
            objectDepthM = objectDepthOptionsM[objectDepthIndex]
            updateStaticUi()
            if (centerAnchor != null) {
                binding.arGuideText.text = "Глубина изменена. Задайте центр объекта заново."
            }
        }

        binding.btnArAuto.setOnClickListener {
            autoMode = !autoMode
            stableSince = 0L
            lastAutoKey = ""
            updateStaticUi()
        }

        binding.btnArSetCenter.setOnClickListener {
            if (captureCount() > 0) {
                AlertDialog.Builder(this)
                    .setTitle("Задать центр заново?")
                    .setMessage("Текущие отметки кадров будут сброшены, потому что изменится система координат.")
                    .setPositiveButton("Сбросить и задать") { _, _ ->
                        resetShots()
                        placeCenterRequested = true
                        binding.arGuideText.text = "Ищу поверхность в центре прицела..."
                    }
                    .setNegativeButton("Отмена", null)
                    .show()
            } else {
                placeCenterRequested = true
                binding.arGuideText.text = "Ищу поверхность в центре прицела..."
            }
        }

        binding.btnArShutter.setOnClickListener {
            manualCaptureRequested = true
        }

        binding.btnArRowUp.setOnClickListener {
            if (currentRow < captureSession.rows - 1) {
                currentRow++
                stableSince = 0L
                lastAutoKey = ""
                updateStaticUi()
            }
        }

        binding.btnArRowDown.setOnClickListener {
            if (currentRow > 0) {
                currentRow--
                stableSince = 0L
                lastAutoKey = ""
                updateStaticUi()
            }
        }

        binding.btnArReview.setOnClickListener { showReview() }
        binding.btnArExport.setOnClickListener { exportZip() }
    }

    override fun onResume() {
        super.onResume()
        orientationTracker.start()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
            return
        }

        resumeAr()
    }

    private fun resumeAr() {
        try {
            if (arSession == null) {
                val arCoreApk = ArCoreApk.getInstance()
                val availability = arCoreApk.checkAvailability(this)

                if (availability.isUnsupported) {
                    arUnavailable("Этот телефон не поддерживает ARCore.")
                    return
                }

                if (availability.isTransient) {
                    binding.arStatusText.text = "AR: проверяю совместимость..."
                    arCoreApk.checkAvailabilityAsync(this) { result ->
                        if (result.isSupported) {
                            resumeAr()
                        } else {
                            arUnavailable("ARCore не поддерживается или его доступность не удалось подтвердить.")
                        }
                    }
                    return
                }

                if (!availability.isSupported) {
                    arUnavailable("Не удалось подтвердить поддержку ARCore на этом устройстве.")
                    return
                }

                when (arCoreApk.requestInstall(this, !installRequested)) {
                    ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
                        installRequested = true
                        return
                    }

                    ArCoreApk.InstallStatus.INSTALLED -> Unit
                }

                val session = Session(this)
                configureSession(session)
                arSession = session
            }

            arSession?.resume()
            binding.arSurface.onResume()
            binding.arStatusText.text = "AR: ведите телефоном, чтобы окружение распозналось"
        } catch (e: UnavailableDeviceNotCompatibleException) {
            arUnavailable("Этот телефон не поддерживает ARCore.")
        } catch (e: UnavailableUserDeclinedInstallationException) {
            arUnavailable("Google Play Services for AR не установлены.")
        } catch (e: UnavailableSdkTooOldException) {
            arUnavailable("Нужно обновить Google Play Services for AR.")
        } catch (e: UnavailableException) {
            arUnavailable("ARCore недоступен: ${e.message}")
        } catch (e: CameraNotAvailableException) {
            arUnavailable("Камера занята другим приложением.")
        } catch (e: Exception) {
            arUnavailable("Не удалось запустить AR: ${e.message}")
        }
    }

    private fun configureSession(session: Session) {
        try {
            val filter = CameraConfigFilter(session)
                .setFacingDirection(CameraConfig.FacingDirection.BACK)

            val configs = session.getSupportedCameraConfigs(filter)
            val best = configs.maxByOrNull {
                it.imageSize.width.toLong() * it.imageSize.height.toLong()
            }
            if (best != null) session.cameraConfig = best
        } catch (_: Exception) {
            // Если конкретный телефон не даёт выбрать конфигурацию, используем стандартную.
        }

        val config = Config(session).apply {
            planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
            updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
            focusMode = Config.FocusMode.AUTO
            instantPlacementMode = Config.InstantPlacementMode.LOCAL_Y_UP
            if (session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
                depthMode = Config.DepthMode.AUTOMATIC
            }
        }

        try {
            session.configure(config)
        } catch (_: Exception) {
            config.focusMode = Config.FocusMode.FIXED
            if (!session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
                config.depthMode = Config.DepthMode.DISABLED
            }
            session.configure(config)
        }
    }

    override fun onPause() {
        orientationTracker.stop()
        binding.arSurface.onPause()
        try {
            arSession?.pause()
        } catch (_: Exception) {
        }
        super.onPause()
    }

    override fun onDestroy() {
        centerAnchor?.detach()
        centerAnchor = null
        try {
            arSession?.close()
        } catch (_: Exception) {
        }
        arSession = null
        ioExecutor.shutdown()
        super.onDestroy()
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        backgroundRenderer.createOnGlThread()
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        surfaceWidth = width
        surfaceHeight = height
        GLES20.glViewport(0, 0, width, height)
        displayRotation = currentDisplayRotation()
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)

        val session = arSession ?: return

        try {
            if (textureSession !== session && backgroundRenderer.textureId >= 0) {
                session.setCameraTextureName(backgroundRenderer.textureId)
                textureSession = session
            }

            if (surfaceWidth > 0 && surfaceHeight > 0) {
                session.setDisplayGeometry(displayRotation, surfaceWidth, surfaceHeight)
            }

            val frame = session.update()
            backgroundRenderer.draw(frame)

            if (frame.camera.trackingState != TrackingState.TRACKING) {
                updateTrackingPaused(frame)
                return
            }

            if (placeCenterRequested) {
                placeCenterRequested = false
                placeCenter(frame, session)
            }

            val metrics = calculateMetrics(frame)
            if (metrics != null) {
                currentSector = metrics.sector
                processAutoCapture(frame, metrics)
            }

            if (manualCaptureRequested) {
                manualCaptureRequested = false
                if (centerAnchor == null) {
                    runOnUiThread {
                        binding.arGuideText.text = "Сначала задайте центр объекта."
                    }
                } else {
                    queueCapture(frame, metrics, false)
                }
            }

            pushUi(metrics)
        } catch (_: CameraNotAvailableException) {
            runOnUiThread {
                binding.arGuideText.text = "Камера ARCore временно недоступна."
            }
        } catch (e: Exception) {
            runOnUiThread {
                binding.arStatusText.text = "AR: ${e.javaClass.simpleName}"
            }
        }
    }

    private fun placeCenter(frame: Frame, session: Session) {
        if (surfaceWidth <= 0 || surfaceHeight <= 0) return

        val x = surfaceWidth / 2f
        val y = surfaceHeight / 2f

        var hit = frame.hitTest(x, y).firstOrNull {
            it.trackable.trackingState == TrackingState.TRACKING
        }

        if (hit == null) {
            hit = frame.hitTestInstantPlacement(x, y, 1.5f).firstOrNull()
        }

        if (hit == null) {
            runOnUiThread {
                binding.arGuideText.text =
                    "Центр не найден. Медленно поводите телефоном и снова наведите прицел на объект."
            }
            return
        }

        val cameraPos = frame.camera.pose.translation
        val hitPos = hit.hitPose.translation

        val vx = hitPos[0] - cameraPos[0]
        val vy = hitPos[1] - cameraPos[1]
        val vz = hitPos[2] - cameraPos[2]
        val length = max(0.001f, sqrt(vx * vx + vy * vy + vz * vz))

        val halfDepth = objectDepthM / 2f
        val centerX = hitPos[0] + vx / length * halfDepth
        val centerY = hitPos[1] + vy / length * halfDepth
        val centerZ = hitPos[2] + vz / length * halfDepth

        centerAnchor?.detach()
        centerAnchor = session.createAnchor(
            Pose.makeTranslation(centerX, centerY, centerZ)
        )

        val dx = cameraPos[0] - centerX
        val dz = cameraPos[2] - centerZ

        baseRadiusM = max(0.20f, sqrt(dx * dx + dz * dz))
        baseCameraHeightM = cameraPos[1] - centerY
        rowSpacingM = min(0.50f, max(0.18f, baseRadiusM * 0.20f))
        initialOrbitAngleRad = atan2(dx.toDouble(), dz.toDouble())

        currentSector = 0
        currentRow = if (captureSession.rows == 3) 1 else 0
        stableSince = 0L
        lastAutoKey = ""

        runOnUiThread {
            binding.arTrajectoryOverlay.reset()
            binding.arStatusText.text = "AR: центр зафиксирован"
            binding.arGuideText.text =
                "✓ Центр задан. Сохраняйте примерно тот же радиус и обходите объект."
            updateStaticUi()
        }
    }

    private fun calculateMetrics(frame: Frame): ArMetrics? {
        val anchor = centerAnchor ?: return null
        if (anchor.trackingState != TrackingState.TRACKING) return null

        val cameraPose = frame.camera.pose
        val camera = cameraPose.translation
        val center = anchor.pose.translation

        val dx = camera[0] - center[0]
        val dy = camera[1] - center[1]
        val dz = camera[2] - center[2]

        val radius = sqrt(dx * dx + dz * dz)
        val orbit = atan2(dx.toDouble(), dz.toDouble())
        val angleDeg = normalizeDegrees(Math.toDegrees(orbit - initialOrbitAngleRad).toFloat())

        val step = 360f / captureSession.sectors
        val sector = (((angleDeg + step / 2f) / step).toInt() % captureSession.sectors)
            .coerceAtLeast(0)

        val rowOffset = if (captureSession.rows == 3) currentRow - 1 else 0
        val targetHeight = baseCameraHeightM + rowOffset * rowSpacingM
        val actualHeight = dy
        val heightError = actualHeight - targetHeight

        val radiusTolerance = max(0.12f, baseRadiusM * 0.12f)
        val heightTolerance = max(0.10f, rowSpacingM * 0.35f)

        val radiusGood = abs(radius - baseRadiusM) <= radiusTolerance
        val heightGood = abs(heightError) <= heightTolerance

        val toCenterX = center[0] - camera[0]
        val toCenterY = center[1] - camera[1]
        val toCenterZ = center[2] - camera[2]
        val toCenterLength = max(
            0.001f,
            sqrt(
                toCenterX * toCenterX +
                    toCenterY * toCenterY +
                    toCenterZ * toCenterZ
            )
        )

        val zAxis = cameraPose.zAxis
        val forwardX = -zAxis[0]
        val forwardY = -zAxis[1]
        val forwardZ = -zAxis[2]

        val dot = (
            forwardX * toCenterX / toCenterLength +
                forwardY * toCenterY / toCenterLength +
                forwardZ * toCenterZ / toCenterLength
            ).coerceIn(-1f, 1f)

        val alignmentDeg = Math.toDegrees(acos(dot.toDouble())).toFloat()
        val alignmentGood = alignmentDeg <= 9f

        val angleTarget = sector * step
        val angleError = angularDistance(angleDeg, angleTarget)
        val sectorCentered = angleError <= step * 0.30f

        val shot = isShot(currentRow, sector)

        val guide = when {
            radius < baseRadiusM - radiusTolerance ->
                "Отойдите дальше от объекта"
            radius > baseRadiusM + radiusTolerance ->
                "Подойдите ближе к объекту"
            heightError < -heightTolerance ->
                "↑ Поднимите телефон"
            heightError > heightTolerance ->
                "↓ Опустите телефон"
            !alignmentGood ->
                "Наведите центральный прицел точно на объект"
            shot ->
                "✓ Этот сектор уже снят"
            !sectorCentered ->
                "Немного сместитесь до центра следующего сектора"
            else ->
                "✓ Положение хорошее — можно снимать"
        }

        return ArMetrics(
            angleDeg = angleDeg,
            sector = sector,
            radiusM = radius,
            heightM = actualHeight,
            targetHeightM = targetHeight,
            alignmentDeg = alignmentDeg,
            radiusGood = radiusGood,
            heightGood = heightGood,
            alignmentGood = alignmentGood,
            sectorCentered = sectorCentered,
            shot = shot,
            guide = guide
        )
    }

    private fun processAutoCapture(frame: Frame, metrics: ArMetrics) {
        if (!autoMode || captureBusy) {
            stableSince = 0L
            return
        }

        val key = "${currentRow}:${metrics.sector}"
        val good =
            !metrics.shot &&
                metrics.radiusGood &&
                metrics.heightGood &&
                metrics.alignmentGood &&
                metrics.sectorCentered &&
                motionStable

        if (!good) {
            stableSince = 0L
            return
        }

        if (lastAutoKey == key) return

        val now = System.currentTimeMillis()
        if (stableSince == 0L) stableSince = now

        if (now - stableSince >= 500L) {
            queueCapture(frame, metrics, true)
            stableSince = 0L
        }
    }

    private fun queueCapture(frame: Frame, metrics: ArMetrics?, fromAuto: Boolean) {
        if (captureBusy) return

        val actual = metrics ?: calculateMetrics(frame) ?: return
        val row = currentRow
        val sector = actual.sector

        if (fromAuto && isShot(row, sector)) return

        try {
            val image = frame.acquireCameraImage()
            val snapshot = try {
                YuvJpeg.snapshot(image)
            } finally {
                image.close()
            }

            captureBusy = true
            val file = captureSession.fileFor(row, sector)
            val rotation = jpegRotationDegrees()

            ioExecutor.execute {
                try {
                    YuvJpeg.saveJpeg(snapshot, file, rotation)
                    synchronized(captureSession) {
                        captureSession.register(row, sector, actual.angleDeg, file)
                    }

                    runCatching {
                        PublicStorage.publishPhoto(
                            this@ArCaptureActivity,
                            file,
                            captureSession.sessionId,
                            row,
                            sector
                        )
                    }

                    if (fromAuto) lastAutoKey = "${row}:${sector}"

                    runOnUiThread {
                        binding.arGuideText.text =
                            if (fromAuto) "AUTO: снят сектор ${sector + 1}"
                            else "Снят сектор ${sector + 1} из ${captureSession.sectors}"
                        updateStaticUi()
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(
                            this,
                            "Не удалось сохранить AR-кадр: ${e.message}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                } finally {
                    captureBusy = false
                }
            }
        } catch (_: NotYetAvailableException) {
            if (!fromAuto) {
                runOnUiThread {
                    binding.arGuideText.text = "Кадр ещё не готов. Попробуйте ещё раз через секунду."
                }
            }
        } catch (e: Exception) {
            runOnUiThread {
                binding.arGuideText.text = "Ошибка кадра: ${e.message}"
            }
        }
    }

    private fun pushUi(metrics: ArMetrics?) {
        val now = System.currentTimeMillis()
        if (now - lastUiUpdateMs < 120L) return
        lastUiUpdateMs = now

        val capturedKeys = synchronized(captureSession) {
            captureSession.shots.keys.toSet()
        }

        runOnUiThread {
            binding.arCoverageOverlay.sectors = captureSession.sectors
            binding.arCoverageOverlay.rows = captureSession.rows
            binding.arCoverageOverlay.currentSector = metrics?.sector ?: currentSector
            binding.arCoverageOverlay.currentRow = currentRow
            binding.arCoverageOverlay.captured = capturedKeys

            binding.arCoverageSphere.sectors = captureSession.sectors
            binding.arCoverageSphere.rows = captureSession.rows
            binding.arCoverageSphere.currentSector = metrics?.sector ?: currentSector
            binding.arCoverageSphere.currentRow = currentRow
            binding.arCoverageSphere.captured = capturedKeys

            if (metrics == null) {
                if (centerAnchor == null) {
                    binding.arMetricsText.text = "Угол —   Радиус —   Высота —"
                }
            } else {
                binding.arMetricsText.text =
                    "Угол %.0f°   Радиус %.2f м / %.2f м   Высота %+.2f м".format(
                        metrics.angleDeg,
                        metrics.radiusM,
                        baseRadiusM,
                        metrics.heightM - metrics.targetHeightM
                    )

                val radiusRatio =
                    if (baseRadiusM > 0.001f) metrics.radiusM / baseRadiusM else 1f
                binding.arTrajectoryOverlay.updatePosition(
                    metrics.angleDeg,
                    radiusRatio,
                    metrics.radiusGood && metrics.heightGood && metrics.alignmentGood
                )

                binding.arGuideText.text = metrics.guide
                binding.arGuideText.setTextColor(
                    if (
                        metrics.radiusGood &&
                        metrics.heightGood &&
                        metrics.alignmentGood &&
                        metrics.sectorCentered
                    ) Color.rgb(130, 255, 210)
                    else Color.WHITE
                )
            }

            binding.arProgressText.text =
                "${captureCount()} / ${captureSession.requiredTotal()}"
            binding.arRowText.text = "Ряд\n${currentRow + 1} / ${captureSession.rows}"
        }
    }

    private fun updateTrackingPaused(frame: Frame) {
        val reason = frame.camera.trackingFailureReason.name
        val now = System.currentTimeMillis()
        if (now - lastUiUpdateMs < 250L) return
        lastUiUpdateMs = now

        runOnUiThread {
            binding.arStatusText.text = "AR: поиск позиции"
            binding.arGuideText.text =
                "ARCore ещё не уверен в позиции ($reason). Медленно поводите телефоном по объекту и окружению."
        }
    }

    private fun changeGrid(sectors: Int, rows: Int) {
        val apply = {
            synchronized(captureSession) {
                captureSession.resetGrid(newSectors = sectors, newRows = rows)
            }
            currentRow = if (rows == 3) 1 else 0
            currentSector = 0
            stableSince = 0L
            lastAutoKey = ""
            updateStaticUi()
        }

        if (captureCount() == 0) {
            apply()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Изменить сетку съёмки?")
            .setMessage("Отметки уже снятых кадров будут сброшены.")
            .setPositiveButton("Изменить") { _, _ -> apply() }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun updateStaticUi() {
        val orientationMode = CaptureOrientationSettings.get(this)
        binding.btnArOrientation.text = "ОРИЕНТАЦИЯ: ${orientationMode.buttonLabel}"
        binding.arCoverageOverlay.landscapeLayout =
            resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        binding.arCoverageOverlay.minimalMode = interfaceHidden
        binding.btnArRows.text = if (captureSession.rows == 1) "1 РЯД" else "3 РЯДА"
        binding.btnArAuto.text = if (autoMode) "AUTO: ВКЛ" else "AUTO: ВЫКЛ"

        binding.btnArDepth.text =
            if (objectDepthM <= 0.001f) "ГЛУБИНА 0"
            else "ГЛУБИНА ${(objectDepthM * 100).toInt()} СМ"

        binding.btnArRowUp.isEnabled =
            captureSession.rows > 1 && currentRow < captureSession.rows - 1
        binding.btnArRowDown.isEnabled =
            captureSession.rows > 1 && currentRow > 0

        binding.arRowText.text =
            "Ряд\n${currentRow + 1} / ${captureSession.rows}"
        binding.arProgressText.text =
            "${captureCount()} / ${captureSession.requiredTotal()}"

        binding.arCoverageOverlay.sectors = captureSession.sectors
        binding.arCoverageOverlay.rows = captureSession.rows
        binding.arCoverageOverlay.currentRow = currentRow
        val capturedKeys = synchronized(captureSession) {
            captureSession.shots.keys.toSet()
        }

        binding.arCoverageOverlay.currentSector = currentSector
        binding.arCoverageOverlay.captured = capturedKeys

        binding.arCoverageSphere.sectors = captureSession.sectors
        binding.arCoverageSphere.rows = captureSession.rows
        binding.arCoverageSphere.currentRow = currentRow
        binding.arCoverageSphere.currentSector = currentSector
        binding.arCoverageSphere.captured = capturedKeys
    }

    private fun setInterfaceHidden(hidden: Boolean) {
        interfaceHidden = hidden
        binding.arTopPanel.visibility = if (hidden) View.GONE else View.VISIBLE
        binding.arMapPanel.visibility = if (hidden) View.GONE else View.VISIBLE
        binding.arRowPanel.visibility = if (hidden) View.GONE else View.VISIBLE
        binding.arBottomPanel.visibility = if (hidden) View.GONE else View.VISIBLE
        binding.arCleanCaptureControls.visibility = if (hidden) View.VISIBLE else View.GONE
        binding.arCoverageOverlay.minimalMode = hidden
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
                binding.btnArOrientation.text =
                    "ОРИЕНТАЦИЯ: ${mode.buttonLabel}"
                dialog.dismiss()
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun applyResponsiveLayout() {
        val landscape =
            resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

        binding.arCoverageOverlay.landscapeLayout = landscape

        val topPadding = dp(if (landscape) 6 else 10)
        binding.arTopPanel.setPadding(
            topPadding,
            topPadding,
            topPadding,
            topPadding
        )

        val bottomPadding = dp(if (landscape) 7 else 14)
        binding.arBottomPanel.setPadding(
            bottomPadding,
            bottomPadding,
            bottomPadding,
            bottomPadding
        )

        binding.arGuideText.maxWidth = dp(if (landscape) 560 else 340)

        binding.arMapPanel.layoutParams = binding.arMapPanel.layoutParams.apply {
            width = dp(if (landscape) 124 else 148)
            height = dp(if (landscape) 250 else 330)
        }
        binding.arMapPanel.requestLayout()

        binding.arTrajectoryOverlay.layoutParams =
            binding.arTrajectoryOverlay.layoutParams.apply {
                width = dp(if (landscape) 106 else 124)
                height = dp(if (landscape) 106 else 124)
            }
        binding.arTrajectoryOverlay.requestLayout()

        binding.arCoverageSphere.layoutParams =
            binding.arCoverageSphere.layoutParams.apply {
                width = dp(if (landscape) 116 else 134)
                height = dp(if (landscape) 118 else 142)
            }
        binding.arCoverageSphere.requestLayout()

        binding.arRowPanel.layoutParams = binding.arRowPanel.layoutParams.apply {
            width = if (landscape) dp(70) else ViewGroup.LayoutParams.WRAP_CONTENT
        }
        binding.arRowPanel.requestLayout()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        displayRotation = currentDisplayRotation()
        applyResponsiveLayout()
        updateStaticUi()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun showReview() {
        Object360ReviewDialog.show(this, captureSession) {
            showCoverageReview()
        }
    }

    private fun showCoverageReview() {
        val text = buildString {
            append("Режим: ARCore\n")
            append("Секторов: ${captureSession.sectors}\n")
            append("Рядов: ${captureSession.rows}\n")
            append("Снято: ${captureCount()} / ${captureSession.requiredTotal()}\n")

            if (baseRadiusM > 0f) {
                append("Базовый радиус: %.2f м\n".format(baseRadiusM))
            }

            append("\nПропуски:\n")
            for (row in 0 until captureSession.rows) {
                val missing = (0 until captureSession.sectors)
                    .filterNot { isShot(row, it) }
                    .map { it + 1 }

                append("Ряд ${row + 1}: ")
                append(if (missing.isEmpty()) "готов ✓" else missing.joinToString(", "))
                append("\n")
            }
        }

        AlertDialog.Builder(this)
            .setTitle("Карта покрытия")
            .setMessage(text)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun exportZip() {
        val shots = synchronized(captureSession) {
            captureSession.shots.values.toList()
        }

        if (shots.isEmpty()) {
            Toast.makeText(this, "Сначала снимите объект", Toast.LENGTH_SHORT).show()
            return
        }

        val zip = File(
            captureSession.dir.parentFile,
            "${captureSession.sessionId}.ar.object360.zip"
        )

        ioExecutor.execute {
            try {
                ZipOutputStream(FileOutputStream(zip)).use { zos ->
                    val json = buildString {
                        append("{\n")
                        append("  \"format\": \"object360\",\n")
                        append("  \"version\": 2,\n")
                        append("  \"captureMode\": \"arcore\",\n")
                        append("  \"sectors\": ${captureSession.sectors},\n")
                        append("  \"rows\": ${captureSession.rows},\n")
                        append("  \"baseRadiusMeters\": ${"%.4f".format(java.util.Locale.US, baseRadiusM)},\n")
                        append("  \"rowSpacingMeters\": ${"%.4f".format(java.util.Locale.US, rowSpacingM)},\n")
                        append("  \"objectDepthMeters\": ${"%.4f".format(java.util.Locale.US, objectDepthM)},\n")
                        append("  \"complete\": ${shots.size == captureSession.requiredTotal()}\n")
                        append("}\n")
                    }

                    zos.putNextEntry(ZipEntry("config.json"))
                    zos.write(json.toByteArray())
                    zos.closeEntry()

                    shots.sortedWith(
                        compareBy<ShotInfo> { it.row }.thenBy { it.sector }
                    ).forEach { shot ->
                        if (shot.file.exists()) {
                            zos.putNextEntry(
                                ZipEntry("row_${shot.row + 1}/${shot.file.name}")
                            )
                            shot.file.inputStream().use { it.copyTo(zos) }
                            zos.closeEntry()
                        }
                    }
                }

                PublicStorage.publishZip(
                    this,
                    zip,
                    "${captureSession.sessionId}.ar.object360.zip"
                )

                runOnUiThread {
                    AlertDialog.Builder(this)
                        .setTitle("AR-экспорт готов")
                        .setMessage(
                            "ZIP сохранён в Загрузки/Object360/\n\n" +
                                "Фотографии доступны в Pictures/Object360/${captureSession.sessionId}/"
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

    private fun resetShots() {
        synchronized(captureSession) {
            captureSession.resetGrid(
                newSectors = captureSession.sectors,
                newRows = captureSession.rows
            )
        }
        centerAnchor?.detach()
        centerAnchor = null
        binding.arTrajectoryOverlay.reset()
        currentSector = 0
        currentRow = if (captureSession.rows == 3) 1 else 0
        stableSince = 0L
        lastAutoKey = ""
        updateStaticUi()
    }

    private fun captureCount(): Int = synchronized(captureSession) {
        captureSession.completedTotal()
    }

    private fun isShot(row: Int, sector: Int): Boolean = synchronized(captureSession) {
        captureSession.isShot(row, sector)
    }

    private fun jpegRotationDegrees(): Int {
        val session = arSession ?: return 90

        return try {
            val cameraManager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraId = session.cameraConfig.cameraId
            val sensorOrientation = cameraManager
                .getCameraCharacteristics(cameraId)
                .get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90

            val deviceDegrees = when (currentDisplayRotation()) {
                Surface.ROTATION_90 -> 90
                Surface.ROTATION_180 -> 180
                Surface.ROTATION_270 -> 270
                else -> 0
            }

            (sensorOrientation - deviceDegrees + 360) % 360
        } catch (_: Exception) {
            90
        }
    }

    private fun currentDisplayRotation(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            display?.rotation ?: Surface.ROTATION_0
        } else {
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.rotation
        }
    }

    private fun arUnavailable(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        binding.arStatusText.text = "AR недоступен"
        binding.arGuideText.text = message
    }

    private fun normalizeDegrees(value: Float): Float {
        var result = value % 360f
        if (result < 0f) result += 360f
        return result
    }

    private fun angularDistance(a: Float, b: Float): Float {
        var d = abs(a - b) % 360f
        if (d > 180f) d = 360f - d
        return d
    }

    private data class ArMetrics(
        val angleDeg: Float,
        val sector: Int,
        val radiusM: Float,
        val heightM: Float,
        val targetHeightM: Float,
        val alignmentDeg: Float,
        val radiusGood: Boolean,
        val heightGood: Boolean,
        val alignmentGood: Boolean,
        val sectorCentered: Boolean,
        val shot: Boolean,
        val guide: String
    )
}
