package ru.specdpo.object360

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class ManualFrameTransform(
    var offsetX: Float = 0f,
    var offsetY: Float = 0f,
    var scale: Float = 1f,
    var rotation: Float = 0f
) {
    fun normalized(): ManualFrameTransform = ManualFrameTransform(
        offsetX = offsetX.coerceIn(-1.5f, 1.5f),
        offsetY = offsetY.coerceIn(-1.5f, 1.5f),
        scale = scale.coerceIn(0.2f, 4f),
        rotation = rotation.coerceIn(-180f, 180f)
    )

    fun isIdentity(): Boolean =
        kotlin.math.abs(offsetX) < 0.0001f &&
            kotlin.math.abs(offsetY) < 0.0001f &&
            kotlin.math.abs(scale - 1f) < 0.0001f &&
            kotlin.math.abs(rotation) < 0.0001f
}

class ManualAlignmentStore(
    var referenceRow: Int,
    var referenceSector: Int,
    val transforms: MutableMap<String, ManualFrameTransform> = linkedMapOf()
) {
    fun key(row: Int, sector: Int): String = "${row}:${sector}"

    fun transformFor(row: Int, sector: Int): ManualFrameTransform =
        transforms.getOrPut(key(row, sector)) { ManualFrameTransform() }

    fun setTransform(row: Int, sector: Int, value: ManualFrameTransform) {
        transforms[key(row, sector)] = value.normalized()
    }

    fun resetAll(referenceRow: Int, referenceSector: Int) {
        this.referenceRow = referenceRow
        this.referenceSector = referenceSector
        transforms.clear()
    }

    fun save(session: CaptureSession) {
        val frames = JSONArray()
        transforms.entries.sortedBy { it.key }.forEach { (key, value) ->
            val parts = key.split(':')
            val row = parts.getOrNull(0)?.toIntOrNull() ?: return@forEach
            val sector = parts.getOrNull(1)?.toIntOrNull() ?: return@forEach
            frames.put(
                JSONObject()
                    .put("row", row)
                    .put("sector", sector)
                    .put("offsetX", value.offsetX.toDouble())
                    .put("offsetY", value.offsetY.toDouble())
                    .put("scale", value.scale.toDouble())
                    .put("rotation", value.rotation.toDouble())
            )
        }

        val json = JSONObject()
            .put("format", "object360-manual-alignment")
            .put("version", 1)
            .put("referenceRow", referenceRow)
            .put("referenceSector", referenceSector)
            .put("frames", frames)

        file(session).writeText(json.toString(2))
    }

    companion object {
        private const val FILE_NAME = "manual_alignment.json"

        fun file(session: CaptureSession): File = File(session.dir, FILE_NAME)

        fun load(session: CaptureSession): ManualAlignmentStore {
            val first = session.shots.values
                .filter { it.file.exists() }
                .sortedWith(compareBy<ShotInfo> { it.row }.thenBy { it.sector })
                .firstOrNull()

            val fallback = ManualAlignmentStore(
                referenceRow = first?.row ?: 0,
                referenceSector = first?.sector ?: 0
            )

            val file = file(session)
            if (!file.exists()) return fallback

            return runCatching {
                val json = JSONObject(file.readText())
                val store = ManualAlignmentStore(
                    referenceRow = json.optInt("referenceRow", fallback.referenceRow),
                    referenceSector = json.optInt("referenceSector", fallback.referenceSector)
                )
                val frames = json.optJSONArray("frames") ?: JSONArray()
                for (index in 0 until frames.length()) {
                    val item = frames.optJSONObject(index) ?: continue
                    val row = item.optInt("row", -1)
                    val sector = item.optInt("sector", -1)
                    if (row < 0 || sector < 0) continue
                    store.setTransform(
                        row,
                        sector,
                        ManualFrameTransform(
                            offsetX = item.optDouble("offsetX", 0.0).toFloat(),
                            offsetY = item.optDouble("offsetY", 0.0).toFloat(),
                            scale = item.optDouble("scale", 1.0).toFloat(),
                            rotation = item.optDouble("rotation", 0.0).toFloat()
                        )
                    )
                }
                store
            }.getOrElse { fallback }
        }
    }
}
