package ru.specdpo.tourplayer;

import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class TourWebViewClient extends WebViewClient {
    public static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String PREFIX = "/tour/";
    private final PlayerActivity activity;
    private final File root;

    public TourWebViewClient(PlayerActivity activity, File root) {
        this.activity = activity;
        this.root = root;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if ("appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())) return false;
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
        }
        return true;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!"appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || !path.startsWith(PREFIX)) return notFound();

        String relative = Uri.decode(path.substring(PREFIX.length()));
        if (relative.isEmpty()) relative = "index.html";

        try {
            File file = new File(root, relative);
            String rootCanonical = root.getCanonicalPath() + File.separator;
            String canonical = file.getCanonicalPath();

            if (!canonical.equals(root.getCanonicalPath()) && !canonical.startsWith(rootCanonical)) {
                return forbidden();
            }
            if (file.isDirectory()) file = new File(file, "index.html");
            if (!file.isFile()) return notFound();

            return fileResponse(file, request);
        } catch (Exception e) {
            return notFound();
        }
    }

    private WebResourceResponse fileResponse(File file, WebResourceRequest request) throws Exception {
        long length = file.length();
        long start = 0;
        long end = length - 1;
        boolean partial = false;

        String range = request.getRequestHeaders().get("Range");
        if (range == null) range = request.getRequestHeaders().get("range");

        if (range != null && range.startsWith("bytes=")) {
            String spec = range.substring(6).split(",", 2)[0].trim();
            String[] parts = spec.split("-", 2);
            try {
                if (!parts[0].isEmpty()) start = Long.parseLong(parts[0]);
                if (parts.length > 1 && !parts[1].isEmpty()) end = Long.parseLong(parts[1]);
                if (start < 0 || start >= length) {
                    Map<String,String> h = new HashMap<>();
                    h.put("Content-Range", "bytes */" + length);
                    return new WebResourceResponse("text/plain", "utf-8", 416, "Range Not Satisfiable", h, new ByteArrayInputStream(new byte[0]));
                }
                end = Math.min(end, length - 1);
                if (end < start) end = length - 1;
                partial = true;
            } catch (Exception ignored) {
                start = 0;
                end = length - 1;
            }
        }

        FileInputStream fis = new FileInputStream(file);
        long skipped = 0;
        while (skipped < start) {
            long n = fis.skip(start - skipped);
            if (n <= 0) break;
            skipped += n;
        }

        long contentLength = end - start + 1;
        InputStream body = new LimitedInputStream(fis, contentLength);
        Map<String,String> headers = new HashMap<>();
        headers.put("Accept-Ranges", "bytes");
        headers.put("Content-Length", String.valueOf(contentLength));
        headers.put("Cache-Control", "public, max-age=31536000, immutable");
        headers.put("Access-Control-Allow-Origin", "*");
        if (partial) headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);

        return new WebResourceResponse(
            mime(file.getName()),
            encoding(file.getName()),
            partial ? 206 : 200,
            partial ? "Partial Content" : "OK",
            headers,
            body
        );
    }

    private static String mime(String name) {
        String n = name.toLowerCase(Locale.US);
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".js") || n.endsWith(".mjs")) return "text/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".json") || n.endsWith(".webmanifest")) return "application/json";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".gif")) return "image/gif";
        if (n.endsWith(".mp4")) return "video/mp4";
        if (n.endsWith(".webm")) return "video/webm";
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".wav")) return "audio/wav";
        if (n.endsWith(".ogg")) return "audio/ogg";
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".stl")) return "model/stl";
        if (n.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }

    private static String encoding(String name) {
        String n = name.toLowerCase(Locale.US);
        return (n.endsWith(".html") || n.endsWith(".js") || n.endsWith(".mjs") || n.endsWith(".css") || n.endsWith(".json") || n.endsWith(".svg"))
            ? "utf-8" : null;
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    private static WebResourceResponse forbidden() {
        return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    private static final class LimitedInputStream extends FilterInputStream {
        private long remaining;

        LimitedInputStream(InputStream in, long remaining) {
            super(in);
            this.remaining = remaining;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) return -1;
            int value = super.read();
            if (value >= 0) remaining--;
            return value;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) return -1;
            int max = (int)Math.min(len, remaining);
            int n = super.read(b, off, max);
            if (n > 0) remaining -= n;
            return n;
        }
    }
}
