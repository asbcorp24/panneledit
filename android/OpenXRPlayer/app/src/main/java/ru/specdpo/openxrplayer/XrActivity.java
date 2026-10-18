package ru.specdpo.openxrplayer;

import android.app.NativeActivity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
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

    private MediaPlayer musicPlayer;
    private MediaPlayer narrationPlayer;
    private String musicPath = "";

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
            runOnUiThread(this::configureAudioForCurrentScene);
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
        return safePath(source);
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
    public synchronized String nativeGetMultiresBasePath() {
        JSONObject s = currentScene();
        JSONObject m = s != null ? s.optJSONObject("multires") : null;
        return m != null ? safePath(m.optString("basePath", "")) : "";
    }

    public synchronized int nativeGetMultiresTileResolution() {
        JSONObject s = currentScene();
        JSONObject m = s != null ? s.optJSONObject("multires") : null;
        return m != null ? Math.max(64, m.optInt("tileResolution", 512)) : 512;
    }

    public synchronized int nativeGetMultiresMaxLevel() {
        JSONObject s = currentScene();
        JSONObject m = s != null ? s.optJSONObject("multires") : null;
        return m != null ? Math.max(1, m.optInt("maxLevel", 1)) : 1;
    }

    public synchronized int nativeGetMultiresCubeResolution() {
        JSONObject s = currentScene();
        JSONObject m = s != null ? s.optJSONObject("multires") : null;
        return m != null ? Math.max(256, m.optInt("cubeResolution", 2048)) : 2048;
    }

    public synchronized int nativeGetObjectSectors() {
        JSONObject s = currentScene();
        return s != null ? Math.max(1, s.optInt("sectors", 1)) : 1;
    }

    public synchronized int nativeGetObjectRows() {
        JSONObject s = currentScene();
        return s != null ? Math.max(1, s.optInt("rows", 1)) : 1;
    }

    public synchronized int nativeGetObjectStartSector() {
        JSONObject s = currentScene();
        return s != null ? Math.max(0, s.optInt("startSector", 0)) : 0;
    }

    public synchronized int nativeGetObjectStartRow() {
        JSONObject s = currentScene();
        return s != null ? Math.max(0, s.optInt("startRow", 0)) : 0;
    }

    public synchronized String nativeGetObjectFramesPacked() {
        JSONObject s = currentScene();
        if (s == null || root == null) return "";
        JSONArray rows = s.optJSONArray("frames");
        if (rows == null) return "";

        StringBuilder out = new StringBuilder();
        for (int r = 0; r < rows.length(); r++) {
            JSONArray row = rows.optJSONArray(r);
            if (row == null) continue;
            for (int sector = 0; sector < row.length(); sector++) {
                String rel = row.optString(sector, "");
                String abs = safePath(rel);
                if (abs.isEmpty()) continue;
                out.append(r).append('\t')
                    .append(sector).append('\t')
                    .append(clean(abs)).append('\n');
            }
        }
        return out.toString();
    }

    public synchronized float nativeGetStlZoom() {
        JSONObject s = currentScene();
        return s != null ? (float)s.optDouble("zoom", 1.0) : 1f;
    }

    public synchronized boolean nativeGetStlWireframe() {
        JSONObject s = currentScene();
        return s != null && s.optBoolean("wireframe", false);
    }

    public synchronized int nativeGetStlColorRgb() {
        JSONObject s = currentScene();
        String color = s != null ? s.optString("color", "#7c8cff") : "#7c8cff";
        try {
            return android.graphics.Color.parseColor(color) & 0x00ffffff;
        } catch (Exception ignored) {
            return 0x7c8cff;
        }
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
            int anchorSector = h.optInt("anchorSector", 0);
            int anchorRow = h.optInt("anchorRow", 0);
            double anchorYaw = h.optDouble("anchorYaw", yaw);
            double anchorPitch = h.optDouble("anchorPitch", pitch);
            double anchorX = h.optDouble("anchorX", 50.0);
            double anchorY = h.optDouble("anchorY", 50.0);
            String anchorMode = clean(h.optString("anchorMode", ""));
            JSONArray point = h.optJSONArray("modelPoint");
            double px = point != null ? point.optDouble(0, Double.NaN) : Double.NaN;
            double py = point != null ? point.optDouble(1, Double.NaN) : Double.NaN;
            double pz = point != null ? point.optDouble(2, Double.NaN) : Double.NaN;
            out.append(id).append('\t')
                .append(type).append('\t')
                .append(target).append('\t')
                .append(yaw).append('\t')
                .append(pitch).append('\t')
                .append(anchorSector).append('\t')
                .append(anchorRow).append('\t')
                .append(px).append('\t')
                .append(py).append('\t')
                .append(pz).append('\t')
                .append(anchorYaw).append('\t')
                .append(anchorPitch).append('\t')
                .append(anchorX).append('\t')
                .append(anchorY).append('\t')
                .append(anchorMode).append('\n');
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
                    runOnUiThread(this::configureAudioForCurrentScene);
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

    public void nativeToggleNarration() {
        runOnUiThread(() -> {
            try {
                if (narrationPlayer != null && narrationPlayer.isPlaying()) {
                    narrationPlayer.stop();
                    narrationPlayer.release();
                    narrationPlayer = null;
                    return;
                }
                releaseNarration();

                JSONObject scene = currentScene();
                JSONObject audio = scene != null ? scene.optJSONObject("audio") : null;
                JSONObject narration = audio != null ? audio.optJSONObject("narration") : null;
                String src = narration != null ? narration.optString("src", "") : "";
                String path = safePath(src);
                if (path.isEmpty()) {
                    Toast.makeText(this, "У сцены нет озвучки", Toast.LENGTH_SHORT).show();
                    return;
                }

                float volume = narration != null
                    ? Math.max(0f, Math.min(1f, (float)narration.optDouble("volume", 80.0) / 100f))
                    : 0.8f;
                narrationPlayer = createAudioPlayer(path, volume, false);
            } catch (Exception e) {
                releaseNarration();
            }
        });
    }

    private void configureAudioForCurrentScene() {
        try {
            JSONObject scene = currentScene();
            JSONObject sceneAudio = scene != null ? scene.optJSONObject("audio") : null;
            JSONObject music = sceneAudio != null ? sceneAudio.optJSONObject("music") : null;

            if (music == null || music.optString("src", "").isEmpty()) {
                JSONObject projectAudio = manifest != null ? manifest.optJSONObject("projectAudio") : null;
                music = projectAudio != null ? projectAudio.optJSONObject("music") : null;
            }

            String src = music != null ? music.optString("src", "") : "";
            String path = safePath(src);
            if (path.equals(musicPath) && musicPlayer != null) return;

            releaseMusic();
            musicPath = path;
            if (path.isEmpty()) return;

            float volume = music != null
                ? Math.max(0f, Math.min(1f, (float)music.optDouble("volume", 35.0) / 100f))
                : 0.35f;
            boolean loop = music == null || music.optBoolean("loop", true);
            musicPlayer = createAudioPlayer(path, volume, loop);
        } catch (Exception ignored) {
            releaseMusic();
        }
        releaseNarration();
    }

    private MediaPlayer createAudioPlayer(String path, float volume, boolean loop) throws Exception {
        MediaPlayer player = new MediaPlayer();
        AudioAttributes.Builder audioBuilder = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC);
        if (Build.VERSION.SDK_INT >= 32) {
            audioBuilder.setSpatializationBehavior(AudioAttributes.SPATIALIZATION_BEHAVIOR_AUTO);
        }
        player.setAudioAttributes(audioBuilder.build());
        player.setDataSource(path);
        player.setLooping(loop);
        player.setVolume(volume, volume);
        player.prepare();
        player.start();
        return player;
    }

    private void releaseMusic() {
        if (musicPlayer != null) {
            try { musicPlayer.stop(); } catch (Exception ignored) {}
            musicPlayer.release();
            musicPlayer = null;
        }
        musicPath = "";
    }

    private void releaseNarration() {
        if (narrationPlayer != null) {
            try { narrationPlayer.stop(); } catch (Exception ignored) {}
            narrationPlayer.release();
            narrationPlayer = null;
        }
    }

    public void nativeToast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }

    private synchronized String safePath(String relative) {
        if (root == null || relative == null || relative.isEmpty()) return "";
        try {
            File f = new File(root, relative);
            String rp = root.getCanonicalPath() + File.separator;
            String fp = f.getCanonicalPath();
            return fp.startsWith(rp) ? fp : "";
        } catch (Exception e) {
            return "";
        }
    }

    @Override
    protected void onDestroy() {
        releaseNarration();
        releaseMusic();
        super.onDestroy();
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
