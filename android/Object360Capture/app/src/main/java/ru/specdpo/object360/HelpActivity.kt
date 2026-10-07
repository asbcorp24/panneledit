package ru.specdpo.object360

import android.graphics.Color
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import ru.specdpo.object360.databinding.ActivityHelpBinding

class HelpActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHelpBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHelpBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnHelpBack.setOnClickListener { finish() }

        val section = intent.getStringExtra(EXTRA_SECTION)
        val target = sectionView(section)
        target?.post {
            binding.helpScroll.smoothScrollTo(0, (target.top - dp(10)).coerceAtLeast(0))
            target.setBackgroundColor(Color.argb(38, 117, 231, 214))
            target.postDelayed({
                target.setBackgroundResource(ru.specdpo.object360.R.drawable.bg_panel)
            }, 1800L)
        }
    }

    private fun sectionView(section: String?): View? =
        when (section) {
            SECTION_PROJECTS -> binding.helpProjects
            SECTION_STANDARD -> binding.helpStandard
            SECTION_AR -> binding.helpAr
            SECTION_TURNTABLE -> binding.helpTurntable
            SECTION_GHOST -> binding.helpGhost
            SECTION_PROCESSING -> binding.helpProcessing
            SECTION_REVIEW -> binding.helpReview
            SECTION_EXPORT -> binding.helpExport
            else -> binding.helpQuick
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_SECTION = "help_section"

        const val SECTION_PROJECTS = "projects"
        const val SECTION_STANDARD = "standard"
        const val SECTION_AR = "ar"
        const val SECTION_TURNTABLE = "turntable"
        const val SECTION_GHOST = "ghost"
        const val SECTION_PROCESSING = "processing"
        const val SECTION_REVIEW = "review"
        const val SECTION_EXPORT = "export"
    }
}
