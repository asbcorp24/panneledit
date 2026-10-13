package ru.specdpo.object360

import android.graphics.BitmapFactory
import java.io.File

data class PanoramaLibraryItem(
    val file: File,
    val is360: Boolean,
    val width: Int,
    val height: Int,
    val modifiedAt: Long
)

object PanoramaLibrary {

    fun root(baseDir: File): File =
        File(baseDir, "Panorama").apply { mkdirs() }

    fun list(baseDir: File): List<PanoramaLibraryItem> {
        val root = root(baseDir)
        return root.walkTopDown()
            .filter { file ->
                file.isFile &&
                    file.extension.lowercase() in setOf("jpg", "jpeg", "png", "webp") &&
                    isGalleryCandidate(root, file)
            }
            .mapNotNull { file ->
                val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(file.absolutePath, options)
                if (options.outWidth <= 0 || options.outHeight <= 0) return@mapNotNull null
                val ratio = options.outWidth.toFloat() / options.outHeight.toFloat()
                PanoramaLibraryItem(
                    file = file,
                    is360 = ratio in 1.90f..2.10f,
                    width = options.outWidth,
                    height = options.outHeight,
                    modifiedAt = file.lastModified()
                )
            }
            .sortedByDescending { it.modifiedAt }
            .toList()
    }

    fun importDir(baseDir: File): File =
        File(root(baseDir), "Imported").apply { mkdirs() }

    /**
     * Исходные кадры лежат внутри Panorama/<session>/row_N/frame_XXX.jpg
     * и не должны появляться в пользовательской галерее.
     *
     * В галерее показываем только:
     * - итоговые panorama_*.jpg;
     * - обработанные edited_*.jpg;
     * - файлы, добавленные через раздел Imported.
     */
    private fun isGalleryCandidate(root: File, file: File): Boolean {
        val name = file.name.lowercase()
        if (name.startsWith("panorama_")) return true
        if (name.startsWith("edited_")) return true

        val imported = File(root, "Imported")
        return try {
            val importedPath = imported.canonicalPath + File.separator
            file.canonicalPath.startsWith(importedPath)
        } catch (_: Exception) {
            false
        }
    }
}
