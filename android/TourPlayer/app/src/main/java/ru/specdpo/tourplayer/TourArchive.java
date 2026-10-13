package ru.specdpo.tourplayer;

import android.content.Context;
import android.net.Uri;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public final class TourArchive {
    public static final class Item {
        public final File packageDir;
        public final File rootDir;
        public final File indexFile;
        public final String title;
        public final long sizeBytes;
        public final long modifiedAt;

        public Item(File packageDir, File rootDir, File indexFile, String title, long sizeBytes, long modifiedAt) {
            this.packageDir = packageDir;
            this.rootDir = rootDir;
            this.indexFile = indexFile;
            this.title = title;
            this.sizeBytes = sizeBytes;
            this.modifiedAt = modifiedAt;
        }
    }

    private TourArchive() {}

    public static File toursRoot(Context context) {
        File dir = new File(context.getFilesDir(), "tours");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public static Item importZip(Context context, Uri uri) throws Exception {
        String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(new Date());
        File packageDir = new File(toursRoot(context), "tour_" + stamp);
        if (!packageDir.mkdirs()) throw new IllegalStateException("Не удалось создать папку тура");

        boolean ok = false;
        try (InputStream raw = context.getContentResolver().openInputStream(uri)) {
            if (raw == null) throw new IllegalStateException("Не удалось открыть ZIP");
            unzipSecure(raw, packageDir);
            File index = findIndex(packageDir);
            if (index == null) throw new IllegalArgumentException("В архиве не найден index.html");
            File root = index.getParentFile();
            validateTour(root);
            ok = true;
            return createItem(packageDir, root, index);
        } finally {
            if (!ok) deleteRecursive(packageDir);
        }
    }

    public static List<Item> list(Context context) {
        List<Item> out = new ArrayList<>();
        File[] packages = toursRoot(context).listFiles(File::isDirectory);
        if (packages == null) return out;

        for (File pkg : packages) {
            try {
                File index = findIndex(pkg);
                if (index == null) continue;
                File root = index.getParentFile();
                validateTour(root);
                out.add(createItem(pkg, root, index));
            } catch (Exception ignored) {
            }
        }
        out.sort(Comparator.comparingLong((Item x) -> x.modifiedAt).reversed());
        return out;
    }

    public static void delete(Item item) {
        deleteRecursive(item.packageDir);
    }

    private static Item createItem(File packageDir, File root, File index) {
        String title = readTitle(root);
        long size = folderSize(root);
        long modified = Math.max(packageDir.lastModified(), index.lastModified());
        return new Item(packageDir, root, index, title, size, modified);
    }

    private static void validateTour(File root) {
        if (!new File(root, "index.html").isFile()) {
            throw new IllegalArgumentException("index.html отсутствует");
        }
        if (!new File(root, "assets/tour.js").isFile()) {
            throw new IllegalArgumentException("Это не архив Tour Editor: assets/tour.js отсутствует");
        }
    }

    private static String readTitle(File root) {
        File json = new File(root, "tour.json");
        if (json.isFile()) {
            try {
                String text = readText(json, 2 * 1024 * 1024);
                JSONObject obj = new JSONObject(text);
                JSONObject start = obj.optJSONObject("startScreen");
                String title = start != null ? start.optString("title", "") : "";
                if (!title.trim().isEmpty()) return title.trim();
                JSONObject scenes = obj.optJSONObject("sceneMeta");
                if (scenes != null && scenes.keys().hasNext()) {
                    JSONObject first = scenes.optJSONObject(scenes.keys().next());
                    if (first != null) {
                        title = first.optString("title", "");
                        if (!title.trim().isEmpty()) return title.trim();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return root.getName();
    }

    private static void unzipSecure(InputStream input, File target) throws Exception {
        String rootPath = target.getCanonicalPath() + File.separator;
        byte[] buffer = new byte[64 * 1024];
        int entries = 0;
        long total = 0;
        long maxTotal = 6L * 1024L * 1024L * 1024L;

        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(input))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                entries++;
                if (entries > 100000) throw new IllegalArgumentException("Слишком много файлов в ZIP");

                File out = new File(target, entry.getName());
                String canonical = out.getCanonicalPath();
                if (!canonical.startsWith(rootPath)) {
                    throw new SecurityException("Некорректный путь внутри ZIP");
                }

                if (entry.isDirectory()) {
                    out.mkdirs();
                    continue;
                }

                File parent = out.getParentFile();
                if (parent != null) parent.mkdirs();

                try (FileOutputStream fos = new FileOutputStream(out)) {
                    int n;
                    while ((n = zis.read(buffer)) > 0) {
                        total += n;
                        if (total > maxTotal) throw new IllegalArgumentException("Архив слишком большой");
                        fos.write(buffer, 0, n);
                    }
                }
                out.setLastModified(System.currentTimeMillis());
                zis.closeEntry();
            }
        }
    }

    private static File findIndex(File dir) {
        File direct = new File(dir, "index.html");
        if (direct.isFile()) return direct;
        File[] children = dir.listFiles();
        if (children == null) return null;

        for (File f : children) {
            if (f.isDirectory()) {
                File candidate = new File(f, "index.html");
                if (candidate.isFile()) return candidate;
            }
        }

        for (File f : children) {
            if (f.isDirectory()) {
                File candidate = findIndexDepth(f, 0);
                if (candidate != null) return candidate;
            }
        }
        return null;
    }

    private static File findIndexDepth(File dir, int depth) {
        if (depth > 3) return null;
        File direct = new File(dir, "index.html");
        if (direct.isFile()) return direct;
        File[] children = dir.listFiles(File::isDirectory);
        if (children == null) return null;
        for (File child : children) {
            File found = findIndexDepth(child, depth + 1);
            if (found != null) return found;
        }
        return null;
    }

    private static long folderSize(File file) {
        if (file.isFile()) return file.length();
        long sum = 0;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) sum += folderSize(child);
        return sum;
    }

    private static String readText(File file, int maxBytes) throws Exception {
        long length = Math.min(file.length(), maxBytes);
        byte[] bytes = new byte[(int) length];
        try (FileInputStream in = new FileInputStream(file)) {
            int offset = 0;
            int n;
            while (offset < bytes.length && (n = in.read(bytes, offset, bytes.length - offset)) > 0) {
                offset += n;
            }
            return new String(bytes, 0, offset, StandardCharsets.UTF_8);
        }
    }

    public static void deleteRecursive(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursive(child);
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }
}
