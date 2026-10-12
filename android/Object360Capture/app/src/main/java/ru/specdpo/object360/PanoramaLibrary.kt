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
            .filter { it.isFile && it.extension.lowercase() in setOf("jpg", "jpeg", "png", "webp") }
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
}
