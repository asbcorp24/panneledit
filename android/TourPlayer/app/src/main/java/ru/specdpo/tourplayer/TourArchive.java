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
        public final String title;
        public final long sizeBytes;
        public final long modifiedAt;

        Item(File packageDir, File rootDir, String title, long sizeBytes, long modifiedAt) {
            this.packageDir = packageDir;
            this.rootDir = rootDir;
            this.title = title;
            this.sizeBytes = sizeBytes;
            this.modifiedAt = modifiedAt;
        }
    }

    private TourArchive() {}

    public static File toursRoot(Context context) {
        File dir = new File(context.getFilesDir(), "player_tours");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public static Item importPlayerZip(Context context, Uri uri) throws Exception {
        String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(new Date());
        File packageDir = new File(toursRoot(context), "tour_" + stamp);
        if (!packageDir.mkdirs()) throw new IllegalStateException("Не удалось создать папку тура");

        boolean ok = false;
        try (InputStream raw = context.getContentResolver().openInputStream(uri)) {
            if (raw == null) throw new IllegalStateException("Не удалось открыть архив");
            unzipSecure(raw, packageDir);

            File root = findPlayerRoot(packageDir);
            if (root == null) {
                throw new IllegalArgumentException(
                    "Это не пакет Android Player. В редакторе используйте «Для Android Player»."
                );
            }
            validatePlayerPackage(root);
            ok = true;
            return createItem(packageDir, root);
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
                File root = findPlayerRoot(pkg);
                if (root == null) continue;
                validatePlayerPackage(root);
                out.add(createItem(pkg, root));
            } catch (Exception ignored) {
            }
        }

        out.sort(Comparator.comparingLong((Item x) -> x.modifiedAt).reversed());
        return out;
    }

    public static void delete(Item item) {
        deleteRecursive(item.packageDir);
    }

    private static Item createItem(File packageDir, File root) throws Exception {
        JSONObject manifest = readManifest(root);
        String title = manifest.optString("title", "Виртуальная экскурсия").trim();
        if (title.isEmpty()) title = "Виртуальная экскурсия";
        return new Item(
            packageDir,
            root,
            title,
            folderSize(root),
            Math.max(packageDir.lastModified(), new File(root, "player-manifest.json").lastModified())
        );
    }

    private static void validatePlayerPackage(File root) throws Exception {
        JSONObject manifest = readManifest(root);
        if (!"xr-tour-player".equals(manifest.optString("format"))) {
            throw new IllegalArgumentException("Неверный формат Player-пакета");
        }
        if (manifest.optInt("version", 0) != 1) {
            throw new IllegalArgumentException("Версия Player-пакета не поддерживается");
        }
        String entry = manifest.optString("entry", "index.html");
        if (!new File(root, entry).isFile()) throw new IllegalArgumentException("index.html отсутствует");
        if (!new File(root, "assets/tour.js").isFile()) throw new IllegalArgumentException("assets/tour.js отсутствует");
        if (!new File(root, "assets/three.module.min.js").isFile()) throw new IllegalArgumentException("Three.js отсутствует");
    }

    private static JSONObject readManifest(File root) throws Exception {
        File file = new File(root, "player-manifest.json");
        if (!file.isFile()) throw new IllegalArgumentException("player-manifest.json отсутствует");
        return new JSONObject(readText(file, 512 * 1024));
    }

    private static File findPlayerRoot(File dir) {
        if (new File(dir, "player-manifest.json").isFile()) return dir;
        File[] children = dir.listFiles(File::isDirectory);
        if (children == null) return null;
        for (File child : children) {
            if (new File(child, "player-manifest.json").isFile()) return child;
        }
        return null;
    }

    private static void unzipSecure(InputStream input, File target) throws Exception {
        String rootPath = target.getCanonicalPath() + File.separator;
        byte[] buffer = new byte[128 * 1024];
        int entries = 0;
        long total = 0;
        final long maxTotal = 8L * 1024L * 1024L * 1024L;

        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(input, 256 * 1024))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (++entries > 150000) throw new IllegalArgumentException("Слишком много файлов");

                File out = new File(target, entry.getName());
                String canonical = out.getCanonicalPath();
                if (!canonical.startsWith(rootPath)) throw new SecurityException("Некорректный путь в ZIP");

                if (entry.isDirectory()) {
                    out.mkdirs();
                    zis.closeEntry();
                    continue;
                }

                File parent = out.getParentFile();
                if (parent != null) parent.mkdirs();

                try (FileOutputStream fos = new FileOutputStream(out, false)) {
                    int n;
                    while ((n = zis.read(buffer)) > 0) {
                        total += n;
                        if (total > maxTotal) throw new IllegalArgumentException("Пакет слишком большой");
                        fos.write(buffer, 0, n);
                    }
                }
                out.setLastModified(System.currentTimeMillis());
                zis.closeEntry();
            }
        }
    }

    private static long folderSize(File file) {
        if (file.isFile()) return file.length();
        long sum = 0;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) sum += folderSize(child);
        return sum;
    }

    private static String readText(File file, int maxBytes) throws Exception {
        int length = (int) Math.min(file.length(), maxBytes);
        byte[] bytes = new byte[length];
        try (FileInputStream in = new FileInputStream(file)) {
            int offset = 0;
            while (offset < bytes.length) {
                int n = in.read(bytes, offset, bytes.length - offset);
                if (n <= 0) break;
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
