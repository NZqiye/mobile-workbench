package cc.qiyeonline.workbench;

import android.content.res.AssetManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.FilterInputStream;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.json.JSONObject;

final class BundledAssets {
    private final AssetManager assets;
    private final Map<String, String> versions = new HashMap<>();
    private final Map<String, Long> sizes = new HashMap<>();

    BundledAssets(AssetManager assets) {
        this.assets = assets;
        try (InputStream stream = assets.open("bundled-assets.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) != -1) bytes.write(buffer, 0, count);
            JSONObject manifest = new JSONObject(bytes.toString("UTF-8"));
            JSONObject scopes = manifest.getJSONObject("scopes"), files = manifest.getJSONObject("files");
            for (Iterator<String> keys = files.keys(); keys.hasNext();) {
                String path = keys.next();
                sizes.put(path, files.getLong(path));
                for (Iterator<String> prefixes = scopes.keys(); prefixes.hasNext();) {
                    String prefix = prefixes.next();
                    if (prefix.endsWith("/") ? path.startsWith(prefix) : path.equals(prefix)) { versions.put(path, scopes.getString(prefix)); break; }
                }
            }
        } catch (Exception error) { versions.clear(); sizes.clear(); }
    }

    WebResourceResponse intercept(WebResourceRequest request) {
        if (!"GET".equals(request.getMethod()) || request.isForMainFrame()) return null;
        String url = request.getUrl().toString();
        String path = BundledAssetPolicy.path(url), version = BundledAssetPolicy.version(url);
        if (path == null || version == null || !version.equals(versions.get(path))) return null;
        long length = sizes.get(path);
        String rangeHeader = null;
        for (Map.Entry<String, String> header : request.getRequestHeaders().entrySet()) {
            if ("Range".equalsIgnoreCase(header.getKey())) rangeHeader = header.getValue();
        }
        long[] range = BundledAssetPolicy.range(rangeHeader, length);
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("Accept-Ranges", "bytes");
        headers.put("X-Qiye-Asset", "bundled");
        String mime = path.endsWith(".webm") ? "video/webm" : path.endsWith(".webp") ? "image/webp" : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".png") ? "image/png" : "text/plain";
        if (range == null) {
            headers.put("Content-Range", "bytes */" + length);
            return new WebResourceResponse(mime, null, 416, "Range Not Satisfiable", headers, new ByteArrayInputStream(new byte[0]));
        }
        try {
            InputStream stream = assets.open("web" + path, AssetManager.ACCESS_RANDOM);
            long remaining = range[0];
            while (remaining > 0) {
                long skipped = stream.skip(remaining);
                if (skipped == 0) { if (stream.read() == -1) { stream.close(); return null; } skipped = 1; }
                remaining -= skipped;
            }
            long count = range[1] - range[0] + 1;
            headers.put("Content-Length", Long.toString(count));
            if (rangeHeader != null) headers.put("Content-Range", "bytes " + range[0] + "-" + range[1] + "/" + length);
            return new WebResourceResponse(mime, path.endsWith(".svg") || mime.equals("text/plain") ? "UTF-8" : null, rangeHeader == null ? 200 : 206, rangeHeader == null ? "OK" : "Partial Content", headers, new LimitedStream(stream, count));
        } catch (Exception error) { return null; }
    }

    private static final class LimitedStream extends FilterInputStream {
        private long remaining;
        LimitedStream(InputStream stream, long length) { super(stream); remaining = length; }
        @Override public int read() throws java.io.IOException {
            if (remaining == 0) return -1;
            int value = super.read();
            if (value != -1) remaining--;
            return value;
        }
        @Override public int read(byte[] bytes, int offset, int length) throws java.io.IOException {
            if (remaining == 0) return -1;
            int count = in.read(bytes, offset, (int) Math.min(length, remaining));
            if (count != -1) remaining -= count;
            return count;
        }
    }
}
