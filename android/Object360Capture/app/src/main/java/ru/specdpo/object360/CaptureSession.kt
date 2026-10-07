package ru.specdpo.object360

import org.json.JSONObject
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
    var rows: Int = 1,
    sessionIdOverride: String? = null,
    initialTitle: String? = null,
    initialCaptureMode: String = "standard"
) {
    val sessionId: String =
        sessionIdOverride ?: SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())

    val dir: File = File(baseDir, "Object360/$sessionId").apply { mkdirs() }
    private val metadataFile = File(dir, "project.json")

    var title: String = initialTitle?.trim().takeUnless { it.isNullOrEmpty() }
        ?: defaultTitle(sessionId)
        private set

    var captureMode: String = initialCaptureMode
        private set

    var createdAt: Long = System.currentTimeMillis()
        private set

    var updatedAt: Long = System.currentTimeMillis()
        private set

    val shots = mutableMapOf<Pair<Int, Int>, ShotInfo>()

    init {
        val hadMetadata = metadataFile.exists()
        loadMetadataIfPresent()
        loadExistingShots()
        if (!hadMetadata) saveMetadata()
    }

    fun fileFor(row: Int, sector: Int): File {
        val rowDir = File(dir, "row_${row + 1}").apply { mkdirs() }
        return File(rowDir, "frame_${sector.toString().padStart(3, '0')}.jpg")
    }

    fun register(row: Int, sector: Int, angleDeg: Float, file: File) {
        val previous = shots[row to sector]
        if (previous != null && previous.file.absolutePath != file.absolutePath) {
            runCatching { previous.file.delete() }
        }

        shots[row to sector] = ShotInfo(row, sector, angleDeg, file)
        touch()
    }

    fun setProjectTitle(value: String) {
        val clean = value.trim()
        if (clean.isEmpty()) return
        title = clean
        touch()
    }

    fun setCaptureMode(value: String) {
        captureMode = value.ifBlank { "standard" }
        touch()
    }

    fun isShot(row: Int, sector: Int): Boolean = shots.containsKey(row to sector)

    fun completedInRow(row: Int): Int = (0 until sectors).count { isShot(row, it) }

    fun completedTotal(): Int = shots.size

    fun requiredTotal(): Int = sectors * rows

    fun progressPercent(): Int {
        val total = requiredTotal().coerceAtLeast(1)
        return ((completedTotal() * 100f) / total).toInt().coerceIn(0, 100)
    }

    fun coverFile(): File? =
        shots.values
            .filter { it.file.exists() }
            .sortedWith(compareBy<ShotInfo> { it.row }.thenBy { it.sector })
            .firstOrNull()
            ?.file

    fun resetGrid(newSectors: Int = sectors, newRows: Int = rows) {
        dir.listFiles()
            ?.filter { it.isDirectory && it.name.startsWith("row_") }
            ?.forEach { rowDir ->
                rowDir.listFiles()
                    ?.filter { it.isFile && it.name.startsWith("frame_") }
                    ?.forEach { runCatching { it.delete() } }
            }

        sectors = newSectors
        rows = newRows
        shots.clear()
        touch()
    }

    fun saveMetadata() {
        val json = JSONObject()
            .put("format", "object360-project")
            .put("version", 1)
            .put("sessionId", sessionId)
            .put("title", title)
            .put("captureMode", captureMode)
            .put("sectors", sectors)
            .put("rows", rows)
            .put("createdAt", createdAt)
            .put("updatedAt", updatedAt)

        runCatching {
            metadataFile.writeText(json.toString(2))
        }
    }

    private fun touch() {
        updatedAt = System.currentTimeMillis()
        saveMetadata()
    }

    private fun loadMetadataIfPresent() {
        if (!metadataFile.exists()) return

        runCatching {
            val json = JSONObject(metadataFile.readText())
            title = json.optString("title", title).ifBlank { title }
            captureMode = json.optString("captureMode", captureMode).ifBlank { captureMode }
            sectors = json.optInt("sectors", sectors).coerceAtLeast(1)
            rows = json.optInt("rows", rows).coerceAtLeast(1)
            createdAt = json.optLong("createdAt", createdAt)
            updatedAt = json.optLong("updatedAt", updatedAt)
        }
    }

    private fun loadExistingShots() {
        val rowDirs = dir.listFiles()
            ?.filter { it.isDirectory && it.name.matches(Regex("row_\\d+")) }
            ?.sortedBy { it.name }
            .orEmpty()

        var inferredRows = 0
        var inferredSectors = 0

        rowDirs.forEach { rowDir ->
            val row = rowDir.name.removePrefix("row_").toIntOrNull()?.minus(1) ?: return@forEach
            inferredRows = maxOf(inferredRows, row + 1)

            rowDir.listFiles()
                ?.filter {
                    it.isFile &&
                        it.name.matches(
                            Regex("frame_(\\d+)\\.(jpg|jpeg|png|webp)", RegexOption.IGNORE_CASE)
                        )
                }
                ?.forEach { file ->
                    val match = Regex(
                        "frame_(\\d+)\\.(jpg|jpeg|png|webp)",
                        RegexOption.IGNORE_CASE
                    ).matchEntire(file.name) ?: return@forEach

                    val sector = match.groupValues[1].toIntOrNull() ?: return@forEach
                    inferredSectors = maxOf(inferredSectors, sector + 1)
                    shots[row to sector] = ShotInfo(
                        row = row,
                        sector = sector,
                        angleDeg = if (sectors > 0) sector * (360f / sectors) else 0f,
                        file = file
                    )
                }
        }

        if (!metadataFile.exists()) {
            if (inferredRows > 0) rows = inferredRows
            if (inferredSectors > sectors) sectors = inferredSectors
        }
    }

    companion object {
        fun list(baseDir: File): List<CaptureSession> {
            val root = File(baseDir, "Object360")
            if (!root.exists()) return emptyList()

            return root.listFiles()
                ?.filter { it.isDirectory }
                ?.mapNotNull { dir ->
                    runCatching {
                        CaptureSession(
                            baseDir = baseDir,
                            sessionIdOverride = dir.name
                        )
                    }.getOrNull()
                }
                ?.sortedByDescending { it.updatedAt }
                .orEmpty()
        }

        private fun defaultTitle(sessionId: String): String {
            val parsed = runCatching {
                SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).parse(sessionId)
            }.getOrNull()

            return if (parsed != null) {
                "Объект " + SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault()).format(parsed)
            } else {
                "Объект $sessionId"
            }
        }
    }
}
