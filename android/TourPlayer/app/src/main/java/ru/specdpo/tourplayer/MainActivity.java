package ru.specdpo.tourplayer;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import java.text.DateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private LinearLayout list;
    private TextView empty;
    private TextView status;
    private Button importButton;
    private Button qualityButton;

    private final ActivityResultLauncher<String[]> openZip =
        registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
            if (uri != null) importArchive(uri, true);
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        handleIncoming(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncoming(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(5, 7, 12));
        root.setPadding(dp(14), dp(16), dp(14), dp(12));

        TextView title = new TextView(this);
        title.setText("XR TOUR PLAYER");
        title.setTextColor(Color.WHITE);
        title.setTextSize(25);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Телефон / планшет • быстрый офлайн-плеер");
        subtitle.setTextColor(Color.rgb(142, 154, 181));
        subtitle.setTextSize(13);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, dp(3), 0, dp(14));
        root.addView(subtitle);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);

        importButton = button("ИМПОРТ .PLAYER.ZIP");
        importButton.setOnClickListener(v -> openZip.launch(new String[] {
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream"
        }));
        actions.addView(importButton, weightParams(0));

        Button refresh = button("ОБНОВИТЬ");
        refresh.setOnClickListener(v -> refresh());
        actions.addView(refresh, weightParams(7));

        root.addView(actions, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(50)
        ));

        qualityButton = button("");
        qualityButton.setOnClickListener(v -> cycleQualityProfile());
        root.addView(qualityButton, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(44)
        ));
        updateQualityButton();

        status = new TextView(this);
        status.setTextColor(Color.rgb(117, 231, 214));
        status.setTextSize(12);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, dp(8), 0, dp(8));
        status.setVisibility(View.GONE);
        root.addView(status);

        empty = new TextView(this);
        empty.setText("Нет импортированных туров.\nВ редакторе нажмите «Для Android Player».");
        empty.setTextColor(Color.rgb(142, 154, 181));
        empty.setTextSize(16);
        empty.setGravity(Gravity.CENTER);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(0, dp(8), 0, dp(28));
        scroll.addView(list);

        root.addView(empty, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        ));
        root.addView(scroll, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        ));

        setContentView(root);
    }

    private void refresh() {
        io.execute(() -> {
            List<TourArchive.Item> tours = TourArchive.list(this);
            runOnUiThread(() -> {
                list.removeAllViews();
                empty.setVisibility(tours.isEmpty() ? View.VISIBLE : View.GONE);
                for (TourArchive.Item item : tours) list.addView(card(item));
            });
        });
    }

    private View card(TourArchive.Item item) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(13), dp(14), dp(13));
        card.setBackground(round(Color.rgb(14, 21, 36), Color.argb(45,255,255,255), 15));

        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cp.bottomMargin = dp(10);
        card.setLayoutParams(cp);

        TextView title = new TextView(this);
        title.setText(item.title);
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        card.addView(title);

        TextView meta = new TextView(this);
        meta.setText(formatSize(item.sizeBytes) + " • " +
            DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(new Date(item.modifiedAt)));
        meta.setTextColor(Color.rgb(117,231,214));
        meta.setTextSize(12);
        meta.setPadding(0, dp(4), 0, 0);
        card.addView(meta);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, dp(10), 0, 0);
        card.addView(row);

        Button open = button("▶ ОТКРЫТЬ");
        open.setOnClickListener(v -> openTour(item));
        row.addView(open, weightParams(0));

        Button delete = button("УДАЛИТЬ");
        delete.setOnClickListener(v -> new AlertDialog.Builder(this)
            .setTitle("Удалить тур?")
            .setMessage(item.title)
            .setPositiveButton("Удалить", (d,w) -> io.execute(() -> {
                TourArchive.delete(item);
                runOnUiThread(this::refresh);
            }))
            .setNegativeButton("Отмена", null)
            .show());
        row.addView(delete, weightParams(7));

        card.setOnClickListener(v -> openTour(item));
        return card;
    }

    private void openTour(TourArchive.Item item) {
        String profile = getSharedPreferences("player", MODE_PRIVATE)
            .getString("quality_profile", "auto");
        startActivity(new Intent(this, PlayerActivity.class)
            .putExtra(PlayerActivity.EXTRA_ROOT, item.rootDir.getAbsolutePath())
            .putExtra(PlayerActivity.EXTRA_TITLE, item.title)
            .putExtra(PlayerActivity.EXTRA_QUALITY, profile));
    }

    private void cycleQualityProfile() {
        android.content.SharedPreferences prefs = getSharedPreferences("player", MODE_PRIVATE);
        String current = prefs.getString("quality_profile", "auto");
        String next;
        if ("auto".equals(current)) next = "eco";
        else if ("eco".equals(current)) next = "balanced";
        else if ("balanced".equals(current)) next = "max";
        else next = "auto";
        prefs.edit().putString("quality_profile", next).apply();
        updateQualityButton();
    }

    private void updateQualityButton() {
        if (qualityButton == null) return;
        String profile = getSharedPreferences("player", MODE_PRIVATE)
            .getString("quality_profile", "auto");
        String label;
        if ("eco".equals(profile)) label = "ЭКОНОМИЯ";
        else if ("balanced".equals(profile)) label = "БАЛАНС";
        else if ("max".equals(profile)) label = "МАКСИМУМ";
        else label = "АВТО";
        qualityButton.setText("КАЧЕСТВО: " + label);
    }

    private void importArchive(Uri uri, boolean openAfter) {
        setBusy(true, "Оптимизированный пакет распаковывается…");
        io.execute(() -> {
            try {
                TourArchive.Item item = TourArchive.importPlayerZip(this, uri);
                runOnUiThread(() -> {
                    setBusy(false, "");
                    refresh();
                    if (openAfter) openTour(item);
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    setBusy(false, "");
                    Toast.makeText(this, "Ошибка: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void handleIncoming(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            } else {
                //noinspection deprecation
                uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            }
        }
        if (uri != null) {
            intent.setAction(null);
            importArchive(uri, true);
        }
    }

    private void setBusy(boolean busy, String text) {
        importButton.setEnabled(!busy);
        status.setText(text);
        status.setVisibility(busy ? View.VISIBLE : View.GONE);
    }

    private Button button(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(Color.WHITE);
        b.setTextSize(11);
        b.setAllCaps(false);
        b.setBackground(round(Color.rgb(24,40,67), Color.argb(50,255,255,255), 10));
        return b;
    }

    private LinearLayout.LayoutParams weightParams(int marginStart) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
        p.setMarginStart(dp(marginStart));
        return p;
    }

    private GradientDrawable round(int fill, int stroke, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setStroke(dp(1), stroke);
        d.setCornerRadius(dp(radius));
        return d;
    }

    private String formatSize(long bytes) {
        double mb = bytes / 1048576.0;
        if (mb >= 1024) return String.format(Locale.US, "%.2f ГБ", mb / 1024.0);
        return String.format(Locale.US, "%.1f МБ", mb);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        io.shutdownNow();
        super.onDestroy();
    }
}
