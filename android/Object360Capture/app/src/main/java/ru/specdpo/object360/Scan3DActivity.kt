package ru.specdpo.object360

import android.Manifest
import android.content.pm.PackageManager
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.NotYetAvailableException
import java.nio.ByteOrder
import java.util.concurrent.Executors
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class Scan3DActivity : AppCompatActivity(), GLSurfaceView.Renderer {
    private lateinit var surface: GLSurfaceView
    private lateinit var status: TextView
    private val renderer = ArBackgroundRenderer()
    private val io = Executors.newSingleThreadExecutor()
    private var session: Session? = null
    private var textureSession: Session? = null
    private var project: Scan3DProject? = null
    @Volatile private var scanning = false
    private var lastDepthNs = 0L

    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        if (it) startAr() else finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        project = Scan3DProject(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xff050914.toInt())
        }
        status = TextView(this).apply {
            text = "3D SCAN • подготовка ARCore"
            setTextColor(0xffffffff.toInt()); textSize = 16f
            setPadding(24, 20, 24, 20)
        }
        surface = GLSurfaceView(this).apply {
            setEGLContextClientVersion(2)
            preserveEGLContextOnPause = true
            setRenderer(this@Scan3DActivity)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }
        val controls = LinearLayout(this).apply { gravity = Gravity.CENTER }
        controls.addView(Button(this).apply {
            text = "СТАРТ / СТОП"
            setOnClickListener {
                scanning = !scanning
                status.text = if (scanning) "3D SCAN • идёт захват RGB/Depth/Pose" else "3D SCAN • пауза"
            }
        })
        controls.addView(Button(this).apply { text = "ГОТОВО"; setOnClickListener { finish() } })
        root.addView(status)
        root.addView(surface, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(controls)
        setContentView(root)
    }

    override fun onResume() {
        super.onResume(); surface.onResume()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startAr()
        else permission.launch(Manifest.permission.CAMERA)
    }

    private fun startAr() {
        if (session != null) { runCatching { session?.resume() }; return }
        runCatching {
            val s = Session(this)
            val c = Config(s).apply {
                updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                focusMode = Config.FocusMode.AUTO
                if (s.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) depthMode = Config.DepthMode.AUTOMATIC
            }
            s.configure(c); session = s; s.resume()
            runOnUiThread { status.text = if (c.depthMode == Config.DepthMode.AUTOMATIC) "3D SCAN • Depth GPU/ARCore готов" else "3D SCAN • Depth нет, RGB fallback" }
        }.onFailure { Toast.makeText(this, "ARCore: "+it.message, Toast.LENGTH_LONG).show() }
    }

    override fun onPause() {
        scanning = false; session?.pause(); surface.onPause(); super.onPause()
    }

    override fun onDestroy() {
        session?.close(); io.shutdown(); super.onDestroy()
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) { renderer.createOnGlThread() }
    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        android.opengl.GLES20.glViewport(0,0,width,height)
        session?.setDisplayGeometry(windowManager.defaultDisplay.rotation,width,height)
    }

    override fun onDrawFrame(gl: GL10?) {
        val s = session ?: return
        if (textureSession !== s) { s.setCameraTextureName(renderer.textureId); textureSession = s }
        val frame = runCatching { s.update() }.getOrNull() ?: return
        renderer.draw(frame)
        if (!scanning || frame.camera.trackingState != TrackingState.TRACKING) return
        if (frame.timestamp - lastDepthNs < 180_000_000L) return
        captureDepth(frame)
    }

    private fun captureDepth(frame: Frame) {
        try {
            val image = frame.acquireDepthImage16Bits()
            val plane = image.planes[0]
            val width = image.width; val height = image.height
            val src = plane.buffer.order(ByteOrder.LITTLE_ENDIAN)
            val rowStride = plane.rowStride; val pixelStride = plane.pixelStride
            val depth = ShortArray(width * height)
            for (y in 0 until height) for (x in 0 until width) {
                depth[y * width + x] = src.getShort(y * rowStride + x * pixelStride)
            }
            val pose = frame.camera.pose
            val intrinsics = frame.camera.imageIntrinsics
            val index = project?.frameCount ?: 0
            image.close(); lastDepthNs = frame.timestamp
            io.execute {
                project?.saveDepth(index, width, height, depth, pose, intrinsics)
                runOnUiThread { status.text = "3D SCAN • Depth/Pose: "+(index+1)+" кадров" }
            }
        } catch (_: NotYetAvailableException) { }
    }
}
