package cc.qiyeonline.workbench;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

final class WidgetImages {
    static Bitmap waterGauge(int amount, int target) {
        Bitmap bitmap = Bitmap.createBitmap(360, 480, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.scale(3, 3);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        android.graphics.Path cup = new android.graphics.Path();
        cup.moveTo(22, 22); cup.lineTo(98, 22); cup.lineTo(92, 137);
        cup.quadTo(91, 146, 81, 147); cup.lineTo(39, 147);
        cup.quadTo(29, 146, 28, 137); cup.close();
        paint.setColor(0x10274F65); canvas.drawOval(new RectF(28, 147, 92, 155), paint);
        canvas.save(); canvas.clipPath(cup);
        paint.setAlpha(255);
        paint.setShader(new LinearGradient(22, 0, 98, 0,
            new int[] { 0xB8FFFFFF, 0x35FFFFFF, 0x70B5D4E3, 0xA0FFFFFF },
            new float[] { 0, 0.28f, 0.82f, 1 }, Shader.TileMode.CLAMP));
        canvas.drawPath(cup, paint);
        float ratio = Math.max(0, Math.min(1, amount / (float)Math.max(1, target)));
        float top = 139 - 106 * ratio;
        if (ratio > 0) {
            paint.setAlpha(255);
            paint.setShader(new LinearGradient(24, 0, 96, 0,
                new int[] { 0xE874BEDD, 0xD6B9E7F1, 0xEA55A6D0 },
                new float[] { 0, 0.42f, 1 }, Shader.TileMode.CLAMP));
            canvas.drawRect(22, top, 98, 143, paint);
            paint.setShader(null); paint.setColor(0xCCB9EAF6);
            float inset = (top - 22) * 0.052f;
            canvas.drawOval(new RectF(22 + inset, top - 3, 98 - inset, top + 3), paint);
            paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(0.8f); paint.setColor(0xAA438AAF);
            canvas.drawOval(new RectF(22 + inset, top - 3, 98 - inset, top + 3), paint);
            paint.setStyle(Paint.Style.FILL);
        }
        paint.setAlpha(255); paint.setShader(new LinearGradient(0, 138, 0, 148,
            new int[] { 0x10FFFFFF, 0xE6E7F5FA, 0xB595BED1 }, null, Shader.TileMode.CLAMP));
        canvas.drawRect(26, 139, 94, 149, paint);
        paint.setShader(null); paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(0xCFFFFFFF); paint.setStrokeWidth(2.6f); canvas.drawLine(29, 34, 34, 128, paint);
        paint.setColor(0x88FFFFFF); paint.setStrokeWidth(1); canvas.drawLine(91, 37, 87, 126, paint);
        paint.setColor(0x9050778E); paint.setStrokeWidth(1);
        for (int i = 1; i < 4; i++) {
            float y = 139 - 106 * i / 4f, right = 92 - (y - 22) * 0.052f;
            canvas.drawLine(right - 8, y, right, y, paint);
        }
        canvas.restore(); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(1.3f); paint.setColor(0xAD7199B0);
        canvas.drawPath(cup, paint);
        paint.setStyle(Paint.Style.FILL); paint.setColor(0xC7EEF8FC); canvas.drawOval(new RectF(22, 17, 98, 27), paint);
        paint.setStyle(Paint.Style.STROKE); paint.setColor(0xBE7199B0); paint.setStrokeWidth(1.3f);
        canvas.drawOval(new RectF(22, 17, 98, 27), paint);
        paint.setColor(0xE6FFFFFF); paint.setStrokeWidth(0.9f); canvas.drawOval(new RectF(25, 19, 95, 25), paint);
        return bitmap;
    }

    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean running = new AtomicBoolean();
    private static final AtomicBoolean pending = new AtomicBoolean();

    private static File file(Context context, String url) throws Exception {
        StringBuilder key = new StringBuilder();
        for (byte value : MessageDigest.getInstance("SHA-256").digest(url.getBytes("UTF-8"))) key.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        File folder = new File(context.getCacheDir(), "widget-posters");
        folder.mkdirs();
        return new File(folder, key + ".png");
    }

    static Bitmap poster(Context context, String url) {
        if (WidgetPolicy.posterUrl(url).isEmpty()) return null;
        try { return BitmapFactory.decodeFile(file(context, url).getAbsolutePath()); }
        catch (Exception error) { return null; }
    }

    static Bitmap icon(Context context, String path) {
        if (!path.matches("/assets-icons/thiings/[a-z0-9-]+/[a-z0-9-]+\\.webp")) path = "/assets-icons/thiings/home/box.webp";
        try (InputStream stream = context.getAssets().open("web" + path)) {
            BitmapFactory.Options options = new BitmapFactory.Options(); options.inSampleSize = 2;
            Bitmap bitmap = BitmapFactory.decodeStream(stream, null, options);
            if (bitmap == null) return null;
            Bitmap result = Bitmap.createScaledBitmap(bitmap, 144, 144, true);
            if (result != bitmap) bitmap.recycle();
            return result;
        } catch (Exception error) { return null; }
    }

    static void refresh(Context source) {
        if (!WorkbenchWidgets.hasWatch(source)) return;
        if (!running.compareAndSet(false, true)) { pending.set(true); return; }
        Context context = source.getApplicationContext();
        worker.execute(() -> {
            try {
                Set<String> keep = new LinkedHashSet<>();
                JSONArray rows = WorkbenchWidgets.upcoming(WorkbenchWidgets.read(context), WorkbenchWidgets.today());
                for (int i = 0; i < rows.length(); i++) {
                    String url = WidgetPolicy.posterUrl(rows.getJSONObject(i).optString("poster"));
                    if (!url.isEmpty()) keep.add(file(context, url).getName());
                }
                long deadline = android.os.SystemClock.elapsedRealtime() + 20000;
                for (int i = 0; i < rows.length(); i++) {
                    String url = WidgetPolicy.posterUrl(rows.getJSONObject(i).optString("poster"));
                    if (url.isEmpty()) continue;
                    File target = file(context, url);
                    if (target.isFile() && target.length() > 0) continue;
                    if (android.os.SystemClock.elapsedRealtime() > deadline) break;
                    try {
                        Bitmap image = download(url);
                        if (image != null) {
                            try (FileOutputStream stream = new FileOutputStream(target)) { image.compress(Bitmap.CompressFormat.PNG, 100, stream); }
                            image.recycle();
                        }
                    } catch (Exception ignored) { if (target.isFile()) target.delete(); }
                }
                File[] cached = new File(context.getCacheDir(), "widget-posters").listFiles();
                if (cached != null && cached.length > 60) for (File old : cached) if (!keep.contains(old.getName())) old.delete();
                WorkbenchWidgets.updateAll(context);
            } catch (Exception ignored) { }
            finally { running.set(false); if (pending.getAndSet(false)) refresh(context); }
        });
    }

    private static Bitmap download(String value) throws Exception {
        String url = value;
        for (int redirect = 0; redirect < 3; redirect++) {
            if (WidgetPolicy.posterUrl(url).isEmpty()) return null;
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(4000); connection.setReadTimeout(4000); connection.setInstanceFollowRedirects(false);
            try {
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) { String location = connection.getHeaderField("Location"); if (location == null) return null; url = new URL(new URL(url), location).toString(); continue; }
                if (status != 200 || connection.getContentLengthLong() > 2 * 1024 * 1024) return null;
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream stream = connection.getInputStream()) {
                    byte[] buffer = new byte[4096]; int count;
                    while ((count = stream.read(buffer)) != -1) { if (bytes.size() + count > 2 * 1024 * 1024) return null; bytes.write(buffer, 0, count); }
                }
                byte[] data = bytes.toByteArray(); BitmapFactory.Options bounds = new BitmapFactory.Options(); bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || (long) bounds.outWidth * bounds.outHeight > 20000000) return null;
                BitmapFactory.Options options = new BitmapFactory.Options();
                while (bounds.outWidth / Math.max(1, options.inSampleSize) > 384 || bounds.outHeight / Math.max(1, options.inSampleSize) > 576) options.inSampleSize = Math.max(1, options.inSampleSize) * 2;
                Bitmap image = BitmapFactory.decodeByteArray(data, 0, data.length, options);
                if (image == null) return null;
                Bitmap result = Bitmap.createBitmap(96, 144, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(result); Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
                canvas.clipPath(rounded());
                float scale = Math.max(96f / image.getWidth(), 144f / image.getHeight()), w = image.getWidth() * scale, h = image.getHeight() * scale;
                canvas.drawBitmap(image, null, new RectF((96 - w) / 2, (144 - h) / 2, (96 + w) / 2, (144 + h) / 2), paint);
                image.recycle(); return result;
            } finally { connection.disconnect(); }
        }
        return null;
    }

    private static android.graphics.Path rounded() {
        android.graphics.Path path = new android.graphics.Path();
        path.addRoundRect(new RectF(0, 0, 96, 144), 12, 12, android.graphics.Path.Direction.CW);
        return path;
    }
}
