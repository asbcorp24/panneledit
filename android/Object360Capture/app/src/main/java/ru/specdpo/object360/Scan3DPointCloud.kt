package ru.specdpo.object360

import com.google.ar.core.CameraIntrinsics
import com.google.ar.core.Pose
import kotlin.math.abs

data class ScanPoint(val x: Float, val y: Float, val z: Float)

class Scan3DPointCloud(
    private val voxelM: Float = 0.012f,
    private val maxPoints: Int = 350_000
) {
    private val voxels = LinkedHashMap<Long, ScanPoint>()
    val size: Int get() = voxels.size

    @Synchronized
    fun integrate(depthMm: ShortArray, width: Int, height: Int, pose: Pose, intrinsics: CameraIntrinsics) {
        val f = intrinsics.focalLength
        val p = intrinsics.principalPoint
        val fx = f[0]; val fy = f[1]; val cx = p[0]; val cy = p[1]
        val stride = when {
            width * height > 250_000 -> 4
            width * height > 100_000 -> 3
            else -> 2
        }
        val local = FloatArray(3)
        val world = FloatArray(3)
        for (v in 0 until height step stride) {
            for (u in 0 until width step stride) {
                val mm = depthMm[v * width + u].toInt() and 0xffff
                if (mm < 120 || mm > 5000) continue
                val z = -mm / 1000f
                local[0] = -(u - cx) * z / fx
                local[1] = (v - cy) * z / fy
                local[2] = z
                pose.transformPoint(local, 0, world, 0)
                put(world[0], world[1], world[2])
            }
        }
        trimIfNeeded()
    }

    private fun put(x: Float, y: Float, z: Float) {
        val ix = kotlin.math.floor(x / voxelM).toInt()
        val iy = kotlin.math.floor(y / voxelM).toInt()
        val iz = kotlin.math.floor(z / voxelM).toInt()
        val key = ((ix.toLong() and 0x1fffffL) shl 42) or
            ((iy.toLong() and 0x1fffffL) shl 21) or
            (iz.toLong() and 0x1fffffL)
        voxels.putIfAbsent(key, ScanPoint(x, y, z))
    }

    private fun trimIfNeeded() {
        if (voxels.size <= maxPoints) return
        val remove = voxels.size - maxPoints
        val it = voxels.entries.iterator()
        repeat(remove) { if (it.hasNext()) { it.next(); it.remove() } }
    }

    @Synchronized
    fun snapshot(): List<ScanPoint> = voxels.values.toList()

    @Synchronized
    fun writePly(file: java.io.File) {
        file.parentFile?.mkdirs()
        file.bufferedWriter().use { out ->
            out.appendLine("ply")
            out.appendLine("format ascii 1.0")
            out.appendLine("element vertex ${voxels.size}")
            out.appendLine("property float x")
            out.appendLine("property float y")
            out.appendLine("property float z")
            out.appendLine("end_header")
            voxels.values.forEach { out.appendLine("${it.x} ${it.y} ${it.z}") }
        }
    }
}
