package ru.specdpo.object360

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

object Object360Exporter {

    fun export(
        context: Context,
        session: CaptureSession,
        publish: Boolean = true
    ): File {
        val shots = synchronized(session) {
            session.shots.values
                .filter { it.file.exists() }
                .sortedWith(compareBy<ShotInfo> { it.row }.thenBy { it.sector })
        }

        require(shots.isNotEmpty()) { "В проекте нет кадров" }

        val suffix = when (session.captureMode) {
            "ar" -> ".ar.object360.zip"
            "turntable" -> ".turntable.object360.zip"
            else -> ".object360.zip"
        }

        val zip = File(session.dir.parentFile, session.sessionId + suffix)

        ZipOutputStream(FileOutputStream(zip)).use { zos ->
            val json = buildString {
                append("{\n")
                append("  \"format\": \"object360\",\n")
                append("  \"version\": 3,\n")
                append("  \"title\": \"")
                append(session.title.replace("\\", "\\\\").replace("\"", "\\\""))
                append("\",\n")
                append("  \"captureMode\": \"${session.captureMode}\",\n")
                append("  \"sectors\": ${session.sectors},\n")
                append("  \"rows\": ${session.rows},\n")
                append("  \"complete\": ${shots.size == session.requiredTotal()}\n")
                append("}\n")
            }

            zos.putNextEntry(ZipEntry("config.json"))
            zos.write(json.toByteArray())
            zos.closeEntry()

            shots.forEach { shot ->
                zos.putNextEntry(
                    ZipEntry("row_${shot.row + 1}/${shot.file.name}")
                )
                shot.file.inputStream().use { it.copyTo(zos) }
                zos.closeEntry()
            }
        }

        if (publish) {
            PublicStorage.publishZip(context, zip, zip.name)
        }

        return zip
    }
}
