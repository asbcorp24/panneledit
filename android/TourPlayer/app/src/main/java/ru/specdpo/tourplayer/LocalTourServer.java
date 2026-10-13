package ru.specdpo.tourplayer;

import android.net.Uri;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class LocalTourServer {
    private final File root;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private volatile boolean running;
    private ServerSocket server;
    private Thread acceptThread;

    public LocalTourServer(File root) {
        this.root = root;
    }

    public int start() throws Exception {
        if (running) return server.getLocalPort();
        server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        running = true;
        acceptThread = new Thread(() -> {
            while (running) {
                try {
                    Socket socket = server.accept();
                    pool.execute(() -> handle(socket));
                } catch (Exception e) {
                    if (running) e.printStackTrace();
                }
            }
        }, "tour-http-accept");
        acceptThread.start();
        return server.getLocalPort();
    }

    public void stop() {
        running = false;
        try { if (server != null) server.close(); } catch (Exception ignored) {}
        pool.shutdownNow();
    }

    private void handle(Socket socket) {
        try (Socket s = socket;
             BufferedReader reader = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.ISO_8859_1));
             OutputStream rawOut = new BufferedOutputStream(s.getOutputStream())) {

            String request = reader.readLine();
            if (request == null || request.isEmpty()) return;
            String[] first = request.split(" ");
            if (first.length < 2) return;
            String method = first[0].toUpperCase(Locale.US);
            String rawPath = first[1];

            Map<String, String> headers = new HashMap<>();
            String line;
            while ((line = reader.readLine()) != null && !line.isEmpty()) {
                int p = line.indexOf(':');
                if (p > 0) headers.put(line.substring(0, p).trim().toLowerCase(Locale.US), line.substring(p + 1).trim());
            }

            if (!method.equals("GET") && !method.equals("HEAD")) {
                sendText(rawOut, 405, "Method Not Allowed");
                return;
            }

            String path = rawPath.split("\\?", 2)[0];
            path = Uri.decode(path);
            while (path.startsWith("/")) path = path.substring(1);
            if (path.isEmpty()) path = "index.html";

            File file = new File(root, path);
            String rootPath = root.getCanonicalPath() + File.separator;
            String canonical = file.getCanonicalPath();
            if (!canonical.equals(root.getCanonicalPath()) && !canonical.startsWith(rootPath)) {
                sendText(rawOut, 403, "Forbidden");
                return;
            }
            if (file.isDirectory()) file = new File(file, "index.html");
            if (!file.isFile()) {
                sendText(rawOut, 404, "Not Found");
                return;
            }

            long length = file.length();
            long start = 0;
            long end = length - 1;
            boolean partial = false;
            String range = headers.get("range");
            if (range != null && range.startsWith("bytes=")) {
                String spec = range.substring(6).split(",", 2)[0].trim();
                String[] parts = spec.split("-", 2);
                try {
                    if (!parts[0].isEmpty()) start = Long.parseLong(parts[0]);
                    if (parts.length > 1 && !parts[1].isEmpty()) end = Long.parseLong(parts[1]);
                    if (start < 0 || start >= length) {
                        writeAscii(rawOut, "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */" + length + "\r\nConnection: close\r\n\r\n");
                        return;
                    }
                    end = Math.min(end, length - 1);
                    if (end < start) end = length - 1;
                    partial = true;
                } catch (NumberFormatException ignored) {
                    start = 0;
                    end = length - 1;
                }
            }

            long contentLength = end - start + 1;
            StringBuilder response = new StringBuilder();
            response.append(partial ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n");
            response.append("Content-Type: ").append(mime(file.getName())).append("\r\n");
            response.append("Content-Length: ").append(contentLength).append("\r\n");
            response.append("Accept-Ranges: bytes\r\n");
            response.append("Cache-Control: public, max-age=31536000\r\n");
            response.append("Access-Control-Allow-Origin: *\r\n");
            if (partial) response.append("Content-Range: bytes ").append(start).append('-').append(end).append('/').append(length).append("\r\n");
            response.append("Connection: close\r\n\r\n");
            writeAscii(rawOut, response.toString());

            if (method.equals("HEAD")) return;

            try (BufferedInputStream in = new BufferedInputStream(new FileInputStream(file))) {
                long skipped = 0;
                while (skipped < start) {
                    long n = in.skip(start - skipped);
                    if (n <= 0) break;
                    skipped += n;
                }
                byte[] buf = new byte[64 * 1024];
                long remaining = contentLength;
                while (remaining > 0) {
                    int n = in.read(buf, 0, (int) Math.min(buf.length, remaining));
                    if (n < 0) break;
                    rawOut.write(buf, 0, n);
                    remaining -= n;
                }
                rawOut.flush();
            }
        } catch (Exception ignored) {
        }
    }

    private static void sendText(OutputStream out, int code, String text) throws Exception {
        byte[] body = text.getBytes(StandardCharsets.UTF_8);
        writeAscii(out, "HTTP/1.1 " + code + " " + text + "\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: " + body.length + "\r\nConnection: close\r\n\r\n");
        out.write(body);
        out.flush();
    }

    private static void writeAscii(OutputStream out, String value) throws Exception {
        out.write(value.getBytes(StandardCharsets.ISO_8859_1));
        out.flush();
    }

    private static String mime(String name) {
        String n = name.toLowerCase(Locale.US);
        if (n.endsWith(".html")) return "text/html; charset=utf-8";
        if (n.endsWith(".js") || n.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (n.endsWith(".css")) return "text/css; charset=utf-8";
        if (n.endsWith(".json") || n.endsWith(".webmanifest")) return "application/json; charset=utf-8";
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
}
