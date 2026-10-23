package ru.specdpo.object360

import java.io.File
import java.util.Locale
import kotlin.math.sqrt

data class ScanTriangle(val a: Int, val b: Int, val c: Int)

class Scan3DMeshBuilder(private val maxEdgeM: Float = 0.055f) {
    fun build(points: List<ScanPoint>): Pair<List<ScanPoint>, List<ScanTriangle>> {
        if (points.size < 3) return points to emptyList()
        val sorted = points.sortedWith(compareBy<ScanPoint> { it.y }.thenBy { it.x })
        val triangles = ArrayList<ScanTriangle>()
        var i = 0
        while (i + 2 < sorted.size) {
            val a = sorted[i]; val b = sorted[i + 1]; val c = sorted[i + 2]
            if (distance(a,b) <= maxEdgeM && distance(b,c) <= maxEdgeM && distance(c,a) <= maxEdgeM) {
                triangles += ScanTriangle(i, i+1, i+2)
            }
            i += 2
        }
        return sorted to triangles
    }

    private fun distance(a: ScanPoint,b: ScanPoint): Float {
        val x=a.x-b.x; val y=a.y-b.y; val z=a.z-b.z
        return sqrt(x*x+y*y+z*z)
    }

    fun writeObj(file: File, vertices: List<ScanPoint>, faces: List<ScanTriangle>) {
        file.parentFile?.mkdirs()
        file.bufferedWriter().use { out ->
            out.appendLine("# Object360Capture on-device 3D scan")
            vertices.forEach { out.appendLine(String.format(Locale.US,"v %.6f %.6f %.6f",it.x,it.y,it.z)) }
            faces.forEach { out.appendLine("f ${it.a+1} ${it.b+1} ${it.c+1}") }
        }
    }
}
