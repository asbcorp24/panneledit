package ru.specdpo.object360

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File

object PublicStorage {

    fun publishPhoto(
        context: Context,
        source: File,
        sessionId: String,
        row: Int,
        sector: Int
    ): Uri? {
        val extension = source.extension.lowercase().ifBlank { "jpg" }
        val displayName = "frame_${sector.toString().padStart(3, '0')}.$extension"
        val mimeType = when (extension) {
            "png" -> "image/png"
            "webp" -> "image/webp"
            else -> "image/jpeg"
        }
        val relativePath = "Pictures/Object360/$sessionId/row_${row + 1}/"

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            publishMediaStoreFile(
                context = context,
                source = source,
                collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                displayName = displayName,
                mimeType = mimeType,
                relativePath = relativePath
            )
        } else {
            publishLegacyFile(
                context = context,
                source = source,
                root = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                subDir = "Object360/$sessionId/row_${row + 1}",
                displayName = displayName,
                mimeType = mimeType
            )
        }
    }

    fun publishZip(
        context: Context,
        source: File,
        displayName: String
    ): Uri? {
        val relativePath = "Download/Object360/"

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            publishMediaStoreFile(
                context = context,
                source = source,
                collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                displayName = displayName,
                mimeType = "application/zip",
                relativePath = relativePath
            )
        } else {
            publishLegacyFile(
                context = context,
                source = source,
                root = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                subDir = "Object360",
                displayName = displayName,
                mimeType = "application/zip"
            )
        }
    }

    private fun publishMediaStoreFile(
        context: Context,
        source: File,
        collection: Uri,
        displayName: String,
        mimeType: String,
        relativePath: String
    ): Uri? {
        val resolver = context.contentResolver

        resolver.query(
            collection,
            arrayOf(MediaStore.MediaColumns._ID),
            "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?",
            arrayOf(displayName, relativePath),
            null
        )?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
            while (cursor.moveToNext()) {
                val existing = Uri.withAppendedPath(
                    collection,
                    cursor.getLong(idColumn).toString()
                )
                runCatching { resolver.delete(existing, null, null) }
            }
        }

        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
            put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }

        val uri = resolver.insert(collection, values) ?: return null

        return try {
            resolver.openOutputStream(uri, "w")?.use { out ->
                source.inputStream().use { input ->
                    input.copyTo(out)
                }
            } ?: throw IllegalStateException("Не удалось открыть публичный файл для записи")

            val ready = ContentValues().apply {
                put(MediaStore.MediaColumns.IS_PENDING, 0)
            }
            resolver.update(uri, ready, null, null)
            uri
        } catch (e: Exception) {
            runCatching { resolver.delete(uri, null, null) }
            throw e
        }
    }

    @Suppress("DEPRECATION")
    private fun publishLegacyFile(
        context: Context,
        source: File,
        root: File,
        subDir: String,
        displayName: String,
        mimeType: String
    ): Uri? {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            context.checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return null
        }

        val dir = File(root, subDir).apply { mkdirs() }
        val target = File(dir, displayName)
        source.copyTo(target, overwrite = true)

        MediaScannerConnection.scanFile(
            context,
            arrayOf(target.absolutePath),
            arrayOf(mimeType),
            null
        )
        return Uri.fromFile(target)
    }
}
