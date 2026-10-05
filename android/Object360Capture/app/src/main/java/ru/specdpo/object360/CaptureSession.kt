package ru.specdpo.object360

import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class ShotInfo(
    val row: Int,
    val sector: Int,
    val angleDeg: Float,
    val file: File
)

class CaptureSession(
    private val baseDir: File,
    var sectors: Int = 36,
    var rows: Int = 1
) {
    val sessionId: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
    val dir: File = File(baseDir, "Object360/$sessionId").apply { mkdirs() }
    val shots = mutableMapOf<Pair<Int, Int>, ShotInfo>()

    fun fileFor(row: Int, sector: Int): File {
        val rowDir = File(dir, "row_${row + 1}").apply { mkdirs() }
        return File(rowDir, "frame_${sector.toString().padStart(3, '0')}.jpg")
    }

    fun register(row: Int, sector: Int, angleDeg: Float, file: File) {
        shots[row to sector] = ShotInfo(row, sector, angleDeg, file)
    }

    fun isShot(row: Int, sector: Int): Boolean = shots.containsKey(row to sector)

    fun completedInRow(row: Int): Int = (0 until sectors).count { isShot(row, it) }

    fun completedTotal(): Int = shots.size

    fun requiredTotal(): Int = sectors * rows

    fun resetGrid(newSectors: Int = sectors, newRows: Int = rows) {
        sectors = newSectors
        rows = newRows
        shots.clear()
    }
}
