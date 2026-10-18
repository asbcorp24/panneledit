package ru.specdpo.tourplayer;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;
import android.content.pm.ActivityInfo;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

import java.io.File;

public class PlayerActivity extends AppCompatActivity {
    public static final String EXTRA_ROOT = "tour_root";
    public static final String EXTRA_TITLE = "tour_title";
    public static final String EXTRA_QUALITY = "tour_quality";

    private FrameLayout root;
    private WebView webView;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String rootPath = getIntent().getStringExtra(EXTRA_ROOT);
        File tourRoot = rootPath != null ? new File(rootPath) : null;
        if (tourRoot == null || !new File(tourRoot, "player-manifest.json").isFile()) {
            Toast.makeText(this, "Player-пакет не найден", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildUi();
        configureWebView(tourRoot);
        enterImmersive();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (customView != null) {
                    hideCustomView();
                } else if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    private void buildUi() {
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        Button close = new Button(this);
        close.setText("×");
        close.setTextSize(20);
        close.setTextColor(Color.WHITE);
        close.setBackgroundColor(Color.argb(120, 4, 8, 18));
        close.setPadding(0,0,0,0);
        close.setOnClickListener(v -> finish());

        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(dp(46), dp(46), Gravity.TOP | Gravity.START);
        p.topMargin = dp(10);
        p.leftMargin = dp(10);
        root.addView(close, p);

        setContentView(root);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(File tourRoot) {
        webView.setBackgroundColor(Color.BLACK);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setSupportZoom(false);
        webView.getSettings().setBuiltInZoomControls(false);
        webView.getSettings().setDisplayZoomControls(false);
        webView.getSettings().setUseWideViewPort(true);
        webView.getSettings().setLoadWithOverviewMode(false);
        webView.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
        webView.getSettings().setOffscreenPreRaster(true);
        webView.getSettings().setUserAgentString(
            webView.getSettings().getUserAgentString() + " XR-Tour-Player/1.0"
        );

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.addJavascriptInterface(new NativeBridge(), "TourPlayerNative");
        webView.setWebViewClient(new TourWebViewClient(this, tourRoot));
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> request.deny());
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return true;
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ));
                webView.setVisibility(View.GONE);
                enterImmersive();
            }

            @Override
            public void onHideCustomView() {
                hideCustomView();
            }
        });

        String profile = getIntent().getStringExtra(EXTRA_QUALITY);
        if (profile == null || profile.trim().isEmpty()) profile = "auto";

        if ("auto".equals(profile)) {
            long maxMemMb = Runtime.getRuntime().maxMemory() / (1024L * 1024L);
            int maxPx = Math.max(
                getResources().getDisplayMetrics().widthPixels,
                getResources().getDisplayMetrics().heightPixels
            );
            if (maxMemMb < 256 || maxPx < 1600) profile = "eco";
            else if (maxMemMb >= 512 && maxPx >= 2400) profile = "max";
            else profile = "balanced";
        }

        webView.loadUrl(
            TourWebViewClient.ORIGIN + "/tour/index.html?playerProfile=" + profile
        );
    }

    private final class NativeBridge {
        @JavascriptInterface
        public void setCardboard(boolean enabled) {
            runOnUiThread(() -> {
                setRequestedOrientation(
                    enabled
                        ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                        : ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                );
                enterImmersive();
            });
        }
    }

    private void hideCustomView() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        webView.setVisibility(View.VISIBLE);
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        customViewCallback = null;
        enterImmersive();
    }

    private void enterImmersive() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            //noinspection deprecation
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();
        }
        super.onDestroy();
    }
}
