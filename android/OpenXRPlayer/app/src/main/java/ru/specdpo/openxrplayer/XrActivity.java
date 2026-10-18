package ru.specdpo.openxrplayer;

import android.app.NativeActivity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public final class XrActivity extends NativeActivity {
    public static final String EXTRA_ROOT = "tour_root";

    private File root;
    private JSONObject manifest;
    private final Map<String, JSONObject> scenes = new HashMap<>();
    private String currentSceneId = "";
    private int revision = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            String rootPath = getIntent().getStringExtra(EXTRA_ROOT);
            if (rootPath == null) throw new IllegalArgumentException("Путь к туру отсутствует");
            root = new File(rootPath);

            File file = new File(root, "openxr-manifest.json");
            if (!file.isFile()) throw new IllegalArgumentException("openxr-manifest.json отсутствует");

            manifest = new JSONObject(readText(file));
            JSONArray items = manifest.optJSONArray("scenes");
            if (items == null || items.length() == 0) throw new IllegalArgumentException("Нет сцен");

            for (int i = 0; i < items.length(); i++) {
                JSONObject scene = items.optJSONObject(i);
                if (scene == null) continue;
                String id = scene.optString("id", "");
                if (!id.isEmpty()) scenes.put(id, scene);
            }

            currentSceneId = manifest.optString("firstScene", "");
            if (!scenes.containsKey(currentSceneId)) {
                currentSceneId = scenes.keySet().iterator().next();
            }
        } catch (Exception e) {
            Toast.makeText(this, "OpenXR: " + e.getMessage(), Toast.LENGTH_LONG).show();
            finish();
        }
    }

    private synchronized JSONObject currentScene() {
        return scenes.get(currentSceneId);
    }

    public synchronized String nativeGetTourRoot() {
        return root != null ? root.getAbsolutePath() : "";
    }

    public synchronized String nativeGetSceneId() {
        return currentSceneId;
    }

    public synchronized int nativeGetSceneRevision() {
        return revision;
    }

    public synchronized String nativeGetSceneType() {
        JSONObject s = currentScene();
        return s != null ? s.optString("type", "panorama") : "";
    }

    public synchronized String nativeGetSceneSource() {
        JSONObject s = currentScene();
        if (s == null || root == null) return "";
        String source = s.optString("source", "");
        if (source.isEmpty()) return "";
        try {
            File f = new File(root, source);
            String rp = root.getCanonicalPath() + File.separator;
            String fp = f.getCanonicalPath();
            return fp.startsWith(rp) ? fp : "";
        } catch (Exception e) {
            return "";
        }
    }

    public synchronized String nativeGetSceneProjection() {
        JSONObject s = currentScene();
        return s != null ? s.optString("projection", "360") : "360";
    }

    public synchronized String nativeGetSceneKind() {
        JSONObject s = currentScene();
        return s != null ? s.optString("kind", "image") : "image";
    }

    public synchronized float nativeGetSceneYaw() {
        JSONObject s = currentScene();
        return s != null ? (float)s.optDouble("yaw", 0.0) : 0f;
    }

    public synchronized float nativeGetScenePitch() {
        JSONObject s = currentScene();
        return s != null ? (float)s.optDouble("pitch", 0.0) : 0f;
    }

    public synchronized float nativeGetSceneFov() {
        JSONObject s = currentScene();
        return s != null ? (float)s.optDouble("fov", 90.0) : 90f;
    }

    // One line per hotspot:
    // id<TAB>type<TAB>targetSceneId<TAB>yaw<TAB>pitch
    public synchronized String nativeGetHotspotsPacked() {
        JSONObject s = currentScene();
        if (s == null) return "";
        JSONArray hs = s.optJSONArray("hotspots");
        if (hs == null) return "";

        StringBuilder out = new StringBuilder();
        for (int i = 0; i < hs.length(); i++) {
            JSONObject h = hs.optJSONObject(i);
            if (h == null) continue;
            String id = clean(h.optString("id", ""));
            String type = clean(h.optString("type", "info"));
            String target = clean(h.optString("targetSceneId", ""));
            double yaw = h.optDouble("yaw", 0.0);
            double pitch = h.optDouble("pitch", 0.0);
            out.append(id).append('\t')
                .append(type).append('\t')
                .append(target).append('\t')
                .append(yaw).append('\t')
                .append(pitch).append('\n');
        }
        return out.toString();
    }

    public synchronized boolean nativeActivateHotspot(String hotspotId) {
        JSONObject s = currentScene();
        if (s == null || hotspotId == null) return false;
        JSONArray hs = s.optJSONArray("hotspots");
        if (hs == null) return false;

        for (int i = 0; i < hs.length(); i++) {
            JSONObject h = hs.optJSONObject(i);
            if (h == null || !hotspotId.equals(h.optString("id", ""))) continue;

            String type = h.optString("type", "info");
            if ("scene".equals(type)) {
                String target = h.optString("targetSceneId", "");
                if (scenes.containsKey(target)) {
                    currentSceneId = target;
                    revision++;
                    return true;
                }
                return false;
            }

            if ("url".equals(type)) {
                String url = h.optString("url", "");
                if (!url.isEmpty()) {
                    runOnUiThread(() -> {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        } catch (Exception ignored) {}
                    });
                }
                return false;
            }

            if ("info".equals(type)) {
                String text = h.optString("info", h.optString("text", ""));
                runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show());
                return false;
            }
        }
        return false;
    }

    public void nativeToast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }

    private static String readText(File file) throws Exception {
        if (file.length() > 4L * 1024L * 1024L) {
            throw new IllegalArgumentException("OpenXR manifest слишком большой");
        }
        byte[] data = new byte[(int)file.length()];
        int offset = 0;
        try (FileInputStream in = new FileInputStream(file)) {
            while (offset < data.length) {
                int n = in.read(data, offset, data.length - offset);
                if (n <= 0) break;
                offset += n;
            }
        }
        return new String(data, 0, offset, StandardCharsets.UTF_8);
    }

    private static String clean(String value) {
        return value == null ? "" : value.replace("\t", " ").replace("\n", " ").replace("\r", " ");
    }
}
