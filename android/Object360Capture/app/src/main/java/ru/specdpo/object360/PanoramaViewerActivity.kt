package ru.specdpo.object360

import android.graphics.Bitmap
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.opengl.Matrix
import android.os.Bundle
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.ShortBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.cos
import kotlin.math.sin

class PanoramaViewerActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val path = intent.getStringExtra(EXTRA_FILE)
        val file = path?.let(::File)

        if (file == null || !file.isFile) {
            Toast.makeText(this, "Файл панорамы не найден", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        title = "Просмотр 360°"
        setContentView(PanoramaSurfaceView(this, file))
    }

    companion object {
        const val EXTRA_FILE = "panorama_file"
    }
}

private class PanoramaSurfaceView(
    context: android.content.Context,
    file: File
) : GLSurfaceView(context) {

    private val renderer360 = PanoramaRenderer(file)
    private val scaleDetector = ScaleGestureDetector(
        context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                renderer360.zoom(detector.scaleFactor)
                requestRender()
                return true
            }
        }
    )

    private var lastX = 0f
    private var lastY = 0f

    init {
        setEGLContextClientVersion(2)
        setRenderer(renderer360)
        renderMode = RENDERMODE_WHEN_DIRTY
        preserveEGLContextOnPause = true
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.x
                lastY = event.y
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                if (!scaleDetector.isInProgress && event.pointerCount == 1) {
                    val dx = event.x - lastX
                    val dy = event.y - lastY
                    renderer360.rotate(
                        dx * 0.16f,
                        dy * 0.16f
                    )
                    requestRender()
                }
                lastX = event.x
                lastY = event.y
                return true
            }
        }

        return true
    }
}

private class PanoramaRenderer(
    private val file: File
) : GLSurfaceView.Renderer {

    private val projection = FloatArray(16)
    private val view = FloatArray(16)
    private val model = FloatArray(16)
    private val mv = FloatArray(16)
    private val mvp = FloatArray(16)

    private var width = 1
    private var height = 1

    @Volatile
    private var yaw = 0f

    @Volatile
    private var pitch = 0f

    @Volatile
    private var fov = 75f

    private var program = 0
    private var textureId = 0

    private lateinit var vertexBuffer: FloatBuffer
    private lateinit var texBuffer: FloatBuffer
    private lateinit var indexBuffer: ShortBuffer
    private var indexCount = 0

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        GLES20.glDisable(GLES20.GL_CULL_FACE)
        GLES20.glEnable(GLES20.GL_DEPTH_TEST)

        buildSphere()
        program = createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
        textureId = loadTexture()

        Matrix.setLookAtM(
            view, 0,
            0f, 0f, 0f,
            0f, 0f, -1f,
            0f, 1f, 0f
        )
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        this.width = width.coerceAtLeast(1)
        this.height = height.coerceAtLeast(1)
        GLES20.glViewport(0, 0, this.width, this.height)
        updateProjection()
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)

        Matrix.setIdentityM(model, 0)
        Matrix.rotateM(model, 0, -pitch, 1f, 0f, 0f)
        Matrix.rotateM(model, 0, -yaw, 0f, 1f, 0f)
        Matrix.multiplyMM(mv, 0, view, 0, model, 0)
        Matrix.multiplyMM(mvp, 0, projection, 0, mv, 0)

        GLES20.glUseProgram(program)

        val pos = GLES20.glGetAttribLocation(program, "aPosition")
        val uv = GLES20.glGetAttribLocation(program, "aTexCoord")
        val matrix = GLES20.glGetUniformLocation(program, "uMvp")
        val sampler = GLES20.glGetUniformLocation(program, "uTexture")

        GLES20.glUniformMatrix4fv(matrix, 1, false, mvp, 0)

        vertexBuffer.position(0)
        GLES20.glEnableVertexAttribArray(pos)
        GLES20.glVertexAttribPointer(
            pos,
            3,
            GLES20.GL_FLOAT,
            false,
            3 * 4,
            vertexBuffer
        )

        texBuffer.position(0)
        GLES20.glEnableVertexAttribArray(uv)
        GLES20.glVertexAttribPointer(
            uv,
            2,
            GLES20.GL_FLOAT,
            false,
            2 * 4,
            texBuffer
        )

        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
        GLES20.glUniform1i(sampler, 0)

        indexBuffer.position(0)
        GLES20.glDrawElements(
            GLES20.GL_TRIANGLES,
            indexCount,
            GLES20.GL_UNSIGNED_SHORT,
            indexBuffer
        )

        GLES20.glDisableVertexAttribArray(pos)
        GLES20.glDisableVertexAttribArray(uv)
    }

    fun rotate(dx: Float, dy: Float) {
        yaw = (yaw + dx) % 360f
        pitch = (pitch + dy).coerceIn(-85f, 85f)
    }

    fun zoom(scaleFactor: Float) {
        if (scaleFactor <= 0f) return
        fov = (fov / scaleFactor).coerceIn(30f, 105f)
        updateProjection()
    }

    private fun updateProjection() {
        val aspect = width.toFloat() / height.coerceAtLeast(1).toFloat()
        Matrix.perspectiveM(
            projection,
            0,
            fov,
            aspect,
            0.1f,
            200f
        )
    }

    private fun buildSphere() {
        val lonSegments = 72
        val latSegments = 40
        val vertices = ArrayList<Float>((lonSegments + 1) * (latSegments + 1) * 3)
        val uvs = ArrayList<Float>((lonSegments + 1) * (latSegments + 1) * 2)
        val indices = ArrayList<Short>(lonSegments * latSegments * 6)

        for (y in 0..latSegments) {
            val v = y.toFloat() / latSegments.toFloat()
            val phi = Math.PI * (v - 0.5)
            val cp = cos(phi).toFloat()
            val sp = sin(phi).toFloat()

            for (x in 0..lonSegments) {
                val u = x.toFloat() / lonSegments.toFloat()
                val theta = 2.0 * Math.PI * (u - 0.5)
                val st = sin(theta).toFloat()
                val ct = cos(theta).toFloat()

                vertices.add(cp * st)
                vertices.add(sp)
                vertices.add(-cp * ct)

                uvs.add(u)
                uvs.add(1f - v)
            }
        }

        val stride = lonSegments + 1
        for (y in 0 until latSegments) {
            for (x in 0 until lonSegments) {
                val a = (y * stride + x).toShort()
                val b = (y * stride + x + 1).toShort()
                val c = ((y + 1) * stride + x).toShort()
                val d = ((y + 1) * stride + x + 1).toShort()

                indices.add(a)
                indices.add(c)
                indices.add(b)
                indices.add(b)
                indices.add(c)
                indices.add(d)
            }
        }

        vertexBuffer = ByteBuffer
            .allocateDirect(vertices.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
        vertices.forEach { vertexBuffer.put(it) }
        vertexBuffer.position(0)

        texBuffer = ByteBuffer
            .allocateDirect(uvs.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
        uvs.forEach { texBuffer.put(it) }
        texBuffer.position(0)

        indexBuffer = ByteBuffer
            .allocateDirect(indices.size * 2)
            .order(ByteOrder.nativeOrder())
            .asShortBuffer()
        indices.forEach { indexBuffer.put(it) }
        indexBuffer.position(0)
        indexCount = indices.size
    }

    private fun loadTexture(): Int {
        val bitmap: Bitmap = GhostFrameDecoder.decodeMaxDimension(file, 4096)
            ?: throw IllegalStateException("Не удалось открыть панораму")

        val ids = IntArray(1)
        GLES20.glGenTextures(1, ids, 0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, ids[0])

        GLES20.glTexParameteri(
            GLES20.GL_TEXTURE_2D,
            GLES20.GL_TEXTURE_MIN_FILTER,
            GLES20.GL_LINEAR
        )
        GLES20.glTexParameteri(
            GLES20.GL_TEXTURE_2D,
            GLES20.GL_TEXTURE_MAG_FILTER,
            GLES20.GL_LINEAR
        )
        GLES20.glTexParameteri(
            GLES20.GL_TEXTURE_2D,
            GLES20.GL_TEXTURE_WRAP_S,
            GLES20.GL_REPEAT
        )
        GLES20.glTexParameteri(
            GLES20.GL_TEXTURE_2D,
            GLES20.GL_TEXTURE_WRAP_T,
            GLES20.GL_CLAMP_TO_EDGE
        )

        GLUtils.texImage2D(
            GLES20.GL_TEXTURE_2D,
            0,
            bitmap,
            0
        )
        bitmap.recycle()
        return ids[0]
    }

    private fun createProgram(vertexSource: String, fragmentSource: String): Int {
        val vertex = compileShader(GLES20.GL_VERTEX_SHADER, vertexSource)
        val fragment = compileShader(GLES20.GL_FRAGMENT_SHADER, fragmentSource)
        return GLES20.glCreateProgram().also { p ->
            GLES20.glAttachShader(p, vertex)
            GLES20.glAttachShader(p, fragment)
            GLES20.glLinkProgram(p)

            val ok = IntArray(1)
            GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0)
            if (ok[0] == 0) {
                val message = GLES20.glGetProgramInfoLog(p)
                GLES20.glDeleteProgram(p)
                throw IllegalStateException("OpenGL link error: " + message)
            }

            GLES20.glDeleteShader(vertex)
            GLES20.glDeleteShader(fragment)
        }
    }

    private fun compileShader(type: Int, source: String): Int {
        return GLES20.glCreateShader(type).also { shader ->
            GLES20.glShaderSource(shader, source)
            GLES20.glCompileShader(shader)

            val ok = IntArray(1)
            GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, ok, 0)
            if (ok[0] == 0) {
                val message = GLES20.glGetShaderInfoLog(shader)
                GLES20.glDeleteShader(shader)
                throw IllegalStateException("OpenGL shader error: " + message)
            }
        }
    }

    companion object {
        private const val VERTEX_SHADER = """
            uniform mat4 uMvp;
            attribute vec3 aPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;

            void main() {
                vTexCoord = aTexCoord;
                gl_Position = uMvp * vec4(aPosition * 100.0, 1.0);
            }
        """

        private const val FRAGMENT_SHADER = """
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;

            void main() {
                gl_FragColor = texture2D(uTexture, vTexCoord);
            }
        """
    }
}
