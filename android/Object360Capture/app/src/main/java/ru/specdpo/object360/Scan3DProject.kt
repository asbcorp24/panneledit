package ru.specdpo.object360

import android.content.Context
import com.google.ar.core.CameraIntrinsics
import com.google.ar.core.Pose
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class Scan3DProject(context: Context) {
    val id = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
    val root = File(context.getExternalFilesDir(null) ?: context.filesDir, "scan3d/$id")
    val rgbDir = File(root, "rgb").apply { mkdirs() }
    val depthDir = File(root, "depth").apply { mkdirs() }
    val metaDir = File(root, "meta").apply { mkdirs() }
    var frameCount: Int = 0
        private set

    init {
        root.mkdirs()
        File(root, "scan.json").writeText("{\"version\":1,\"engine\":\"arcore-depth\",\"deviceOnly\":true}")
    }

    fun saveDepth(frame: Int, width: Int, height: Int, depthMm: ShortArray, pose: Pose, intrinsics: CameraIntrinsics) {
        val raw = File(depthDir, "%05d.depth16".format(Locale.US, frame))
        FileOutputStream(raw).channel.use { channel ->
            val buffer = ByteBuffer.allocate(depthMm.size * 2).order(ByteOrder.LITTLE_ENDIAN)
            depthMm.forEach { buffer.putShort(it) }
            buffer.flip()
            channel.write(buffer)
        }
        val t = pose.translation
        val q = pose.rotationQuaternion
        val focal = intrinsics.focalLength
        val principal = intrinsics.principalPoint
        val json = "{\"width\":$width,\"height\":$height,\"fx\":${focal[0]},\"fy\":${focal[1]},\"cx\":${principal[0]},\"cy\":${principal[1]},\"tx\":${t[0]},\"ty\":${t[1]},\"tz\":${t[2]},\"qx\":${q[0]},\"qy\":${q[1]},\"qz\":${q[2]},\"qw\":${q[3]}}"
        File(metaDir, "%05d.json".format(Locale.US, frame)).writeText(json)
        frameCount = maxOf(frameCount, frame + 1)
    }
}
