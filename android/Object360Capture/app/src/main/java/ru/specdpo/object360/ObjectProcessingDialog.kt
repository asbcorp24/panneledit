package ru.specdpo.object360

import android.app.Activity
import android.graphics.Color
import android.text.InputFilter
import android.view.Gravity
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import java.util.concurrent.ExecutorService

object ObjectProcessingDialog {

    fun show(
        activity: Activity,
        session: CaptureSession,
        executor: ExecutorService,
        onDone: (() -> Unit)? = null
    ) {
        if (session.shots.isEmpty()) {
            Toast.makeText(activity, "Сначала снимите хотя бы один кадр", Toast.LENGTH_SHORT).show()
            return
        }

        val items = arrayOf(
            "Автообрезка — одинаковый crop всей серии",
            "Удалить фон → прозрачный PNG",
            "Удалить фон → однотонный цвет"
        )

        AlertDialog.Builder(activity)
            .setTitle("Обработка Object360")
            .setMessage(
                "Обработка применяется ко всей серии. " +
                    "Автообрезка использует общую рамку для всех кадров, чтобы объект не прыгал."
            )
            .setItems(items) { _, which ->
                when (which) {
                    0 -> run(
                        activity,
                        session,
                        executor,
                        ObjectProcessMode.AUTO_CROP,
                        Color.WHITE,
                        onDone
                    )

                    1 -> run(
                        activity,
                        session,
                        executor,
                        ObjectProcessMode.TRANSPARENT_BACKGROUND,
                        Color.TRANSPARENT,
                        onDone
                    )

                    2 -> askSolidColor(activity) { color ->
                        run(
                            activity,
                            session,
                            executor,
                            ObjectProcessMode.SOLID_BACKGROUND,
                            color,
                            onDone
                        )
                    }
                }
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun askSolidColor(
        activity: Activity,
        onColor: (Int) -> Unit
    ) {
        val root = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(activity, 20), dp(activity, 12), dp(activity, 20), 0)
        }

        root.addView(TextView(activity).apply {
            text = "Цвет фона HEX, например #FFFFFF, #000000 или #E9EEF5"
            setPadding(0, 0, 0, dp(activity, 8))
        })

        val input = EditText(activity).apply {
            setText("#FFFFFF")
            filters = arrayOf(InputFilter.LengthFilter(9))
            singleLine = true
        }
        root.addView(
            input,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        val dialog = AlertDialog.Builder(activity)
            .setTitle("Однотонный фон")
            .setView(root)
            .setPositiveButton("Обработать", null)
            .setNegativeButton("Отмена", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val value = input.text.toString().trim()
                val color = runCatching { Color.parseColor(value) }.getOrNull()
                if (color == null) {
                    input.error = "Введите цвет, например #FFFFFF"
                } else {
                    dialog.dismiss()
                    onColor(color)
                }
            }
        }
        dialog.show()
    }

    private fun run(
        activity: Activity,
        session: CaptureSession,
        executor: ExecutorService,
        mode: ObjectProcessMode,
        solidColor: Int,
        onDone: (() -> Unit)?
    ) {
        val progressText = TextView(activity).apply {
            gravity = Gravity.CENTER
            setPadding(
                dp(activity, 24),
                dp(activity, 24),
                dp(activity, 24),
                dp(activity, 24)
            )
            text = "Подготовка…"
            textSize = 16f
        }

        val progressDialog = AlertDialog.Builder(activity)
            .setTitle("Обработка кадров")
            .setView(progressText)
            .setCancelable(false)
            .create()
        progressDialog.show()

        executor.execute {
            val result = try {
                ObjectBatchProcessor.process(
                    session = session,
                    mode = mode,
                    solidColor = solidColor
                ) { done, total, message ->
                    activity.runOnUiThread {
                        progressText.text =
                            "$message\n\n$done / $total"
                    }
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    progressDialog.dismiss()
                    Toast.makeText(
                        activity,
                        "Ошибка обработки: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
                return@execute
            }

            synchronized(session) {
                session.shots.values.forEach { shot ->
                    runCatching {
                        PublicStorage.publishPhoto(
                            activity,
                            shot.file,
                            session.sessionId,
                            shot.row,
                            shot.sector
                        )
                    }
                }
            }

            activity.runOnUiThread {
                progressDialog.dismiss()

                val format = if (result.transparent) "PNG с прозрачностью" else "JPEG"
                val message = buildString {
                    append("Обработано: ${result.processed}\n")
                    append("Ошибок: ${result.failed}\n")
                    append("Формат: $format\n\n")
                    append(
                        if (mode == ObjectProcessMode.AUTO_CROP) {
                            "Для всей серии применена одна общая рамка."
                        } else {
                            "Фон определён автоматически от краёв кадра. " +
                                "Лучше всего работает на контрастном однотонном фоне."
                        }
                    )
                }

                AlertDialog.Builder(activity)
                    .setTitle("Обработка завершена")
                    .setMessage(message)
                    .setPositiveButton("3D просмотр") { _, _ ->
                        Object360ReviewDialog.show(activity, session)
                    }
                    .setNegativeButton("Закрыть", null)
                    .show()

                onDone?.invoke()
            }
        }
    }

    private fun dp(activity: Activity, value: Int): Int =
        (value * activity.resources.displayMetrics.density).toInt()
}
