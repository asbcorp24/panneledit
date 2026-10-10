package ru.specdpo.object360

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import ru.specdpo.object360.databinding.ActivityProjectListBinding
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class ProjectListActivity : AppCompatActivity() {

    private lateinit var binding: ActivityProjectListBinding
    private lateinit var executor: ExecutorService

    private val baseDir: File
        get() = getExternalFilesDir(null) ?: filesDir

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProjectListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        executor = Executors.newSingleThreadExecutor()

        binding.btnHelp.setOnClickListener {
            startActivity(
                Intent(this, HelpActivity::class.java)
                    .putExtra(HelpActivity.EXTRA_SECTION, HelpActivity.SECTION_PROJECTS)
            )
        }

        binding.btnNewProject.setOnClickListener {
            showNewProjectDialog()
        }
    }

    override fun onResume() {
        super.onResume()
        renderProjects()
    }

    private fun renderProjects() {
        val projects = CaptureSession.list(baseDir)

        binding.projectContainer.removeAllViews()
        binding.emptyProjects.visibility = if (projects.isEmpty()) View.VISIBLE else View.GONE
        binding.projectScroll.visibility = if (projects.isEmpty()) View.GONE else View.VISIBLE

        projects.forEach { project ->
            binding.projectContainer.addView(projectCard(project))
        }
    }

    private fun projectCard(project: CaptureSession): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = roundedBackground(
                fill = Color.rgb(13, 19, 34),
                stroke = Color.argb(35, 255, 255, 255),
                radiusDp = 16
            )
        }
        card.layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = dp(12)
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        card.addView(header)

        val cover = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            setBackgroundColor(Color.rgb(4, 8, 18))
            contentDescription = "Обложка проекта"
        }
        header.addView(
            cover,
            LinearLayout.LayoutParams(dp(116), dp(86)).apply {
                marginEnd = dp(12)
            }
        )

        val info = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        header.addView(
            info,
            LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1f
            )
        )

        val title = TextView(this).apply {
            text = project.title
            setTextColor(Color.WHITE)
            textSize = 18f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setOnClickListener {
                showRenameDialog(project)
            }
        }
        info.addView(title)

        val mode = TextView(this).apply {
            text = modeLabel(project.captureMode)
            setTextColor(Color.rgb(117, 231, 214))
            textSize = 12f
            setPadding(0, dp(3), 0, 0)
        }
        info.addView(mode)

        val numbers = TextView(this).apply {
            text = "${project.completedTotal()} / ${project.requiredTotal()} кадр.   •   ${project.progressPercent()}%"
            setTextColor(Color.rgb(244, 247, 255))
            textSize = 14f
            setPadding(0, dp(8), 0, dp(5))
        }
        info.addView(numbers)

        val progress = ProgressBar(
            this,
            null,
            android.R.attr.progressBarStyleHorizontal
        ).apply {
            max = 100
            this.progress = project.progressPercent()
        }
        info.addView(
            progress,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(8)
            )
        )

        val status = TextView(this).apply {
            text = when {
                project.completedTotal() == 0 -> "Новый проект"
                project.progressPercent() >= 100 -> "✓ Съёмка завершена"
                else -> "Готовность ${project.progressPercent()}%"
            }
            setTextColor(
                if (project.progressPercent() >= 100)
                    Color.rgb(91, 233, 211)
                else
                    Color.rgb(142, 154, 181)
            )
            textSize = 11f
            setPadding(0, dp(5), 0, 0)
        }
        info.addView(status)

        val actionsTop = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, 0)
        }
        card.addView(actionsTop)

        actionsTop.addView(
            actionButton("Продолжить") {
                openProject(project)
            },
            actionParams()
        )
        actionsTop.addView(
            actionButton("3D просмотр") {
                Object360ReviewDialog.show(this, project)
            },
            actionParams(startMargin = 6)
        )
        actionsTop.addView(
            actionButton("Обработать") {
                ObjectProcessingDialog.show(
                    this,
                    project,
                    executor
                ) {
                    renderProjects()
                }
            },
            actionParams(startMargin = 6)
        )

        val actionsBottom = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(7), 0, 0)
        }
        card.addView(actionsBottom)

        actionsBottom.addView(
            actionButton("Выровнять") {
                startActivity(
                    Intent(this, ManualAlignmentActivity::class.java)
                        .putExtra(EXTRA_SESSION_ID, project.sessionId)
                )
            },
            actionParams()
        )
        actionsBottom.addView(
            actionButton("Экспорт") {
                exportProject(project, share = false)
            },
            actionParams(startMargin = 6)
        )
        actionsBottom.addView(
            actionButton("На ПК") {
                exportProject(project, share = true)
            },
            actionParams(startMargin = 6)
        )

        project.coverFile()?.let { file ->
            executor.execute {
                val bitmap = GhostFrameDecoder.decode(file, 700, 520)
                runOnUiThread {
                    if (!isFinishing && bitmap != null) {
                        cover.setImageBitmap(bitmap)
                    }
                }
            }
        }

        return card
    }

    private fun showNewProjectDialog() {
        val input = android.widget.EditText(this).apply {
            hint = "Например: Турбина, Макет корабля, Экспонат №1"
            setSingleLine(true)
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }

        AlertDialog.Builder(this)
            .setTitle("Новый Object360")
            .setMessage("Введите название объекта")
            .setView(input)
            .setPositiveButton("Далее") { _, _ ->
                val title = input.text.toString().trim().ifBlank {
                    "Новый объект"
                }
                showCaptureModeDialog(title)
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun showCaptureModeDialog(title: String) {
        val labels = arrayOf(
            "Обычная съёмка — обойти объект",
            "ARCore — точная траектория",
            "Поворотный стол — телефон неподвижен"
        )
        val modes = arrayOf("standard", "ar", "turntable")

        AlertDialog.Builder(this)
            .setTitle("Режим съёмки")
            .setItems(labels) { _, which ->
                val mode = modes[which]
                val project = CaptureSession(
                    baseDir = baseDir,
                    sectors = 36,
                    rows = 1,
                    initialTitle = title,
                    initialCaptureMode = mode
                )
                openProject(project)
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun showRenameDialog(project: CaptureSession) {
        val input = android.widget.EditText(this).apply {
            setText(project.title)
            setSelection(text.length)
            setSingleLine(true)
        }

        AlertDialog.Builder(this)
            .setTitle("Название проекта")
            .setView(input)
            .setPositiveButton("Сохранить") { _, _ ->
                project.setProjectTitle(input.text.toString())
                renderProjects()
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun openProject(project: CaptureSession) {
        val activity = when (project.captureMode) {
            "ar" -> ArCaptureActivity::class.java
            "turntable" -> TurntableCaptureActivity::class.java
            else -> MainActivity::class.java
        }

        startActivity(
            Intent(this, activity)
                .putExtra(EXTRA_SESSION_ID, project.sessionId)
        )
    }

    private fun exportProject(project: CaptureSession, share: Boolean) {
        if (project.shots.isEmpty()) {
            Toast.makeText(this, "В проекте ещё нет кадров", Toast.LENGTH_SHORT).show()
            return
        }

        Toast.makeText(
            this,
            if (share) "Готовлю ZIP для отправки…" else "Экспортирую ZIP…",
            Toast.LENGTH_SHORT
        ).show()

        executor.execute {
            try {
                val zip = Object360Exporter.export(
                    context = this,
                    session = project,
                    publish = !share
                )

                runOnUiThread {
                    if (share) {
                        shareZip(zip, project.title)
                    } else {
                        Toast.makeText(
                            this,
                            "ZIP сохранён в Загрузки/Object360",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(
                        this,
                        "Ошибка экспорта: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun shareZip(file: File, title: String) {
        val uri = FileProvider.getUriForFile(
            this,
            "${packageName}.files",
            file
        )

        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/zip"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Object360 — $title")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        startActivity(
            Intent.createChooser(
                send,
                "Отправить Object360 на ПК"
            )
        )
    }

    private fun actionButton(
        text: String,
        onClick: () -> Unit
    ): Button =
        Button(this).apply {
            this.text = text
            setTextColor(Color.WHITE)
            textSize = 11f
            isAllCaps = false
            background = roundedBackground(
                fill = Color.rgb(17, 26, 45),
                stroke = Color.argb(40, 255, 255, 255),
                radiusDp = 10
            )
            setOnClickListener { onClick() }
        }

    private fun actionParams(startMargin: Int = 0) =
        LinearLayout.LayoutParams(
            0,
            dp(44),
            1f
        ).apply {
            marginStart = dp(startMargin)
        }

    private fun roundedBackground(
        fill: Int,
        stroke: Int,
        radiusDp: Int
    ): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            setColor(fill)
            setStroke(dp(1), stroke)
            cornerRadius = dp(radiusDp).toFloat()
        }

    private fun modeLabel(mode: String): String =
        when (mode) {
            "ar" -> "ARCORE • ТОЧНАЯ ТРАЕКТОРИЯ"
            "turntable" -> "ПОВОРОТНЫЙ СТОЛ"
            else -> "ОБЫЧНАЯ СЪЁМКА"
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_SESSION_ID = "object360_session_id"
    }
}
