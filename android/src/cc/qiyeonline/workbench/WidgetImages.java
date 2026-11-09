package cc.qiyeonline.workbench;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
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
        Bitmap bitmap = Bitmap.createBitmap(120, 160, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        android.graphics.Path cup = new android.graphics.Path();
        cup.moveTo(18, 12); cup.lineTo(102, 12); cup.lineTo(94, 142);
        cup.quadTo(94, 150, 86, 150); cup.lineTo(34, 150);
        cup.quadTo(26, 150, 26, 142); cup.close();
        canvas.save(); canvas.clipPath(cup);
        paint.setColor(0xFFF1F8FA); canvas.drawRect(0, 0, 120, 160, paint);
        float ratio = Math.max(0, Math.min(1, amount / (float)Math.max(1, target)));
        float top = 150 - 138 * ratio;
        paint.setColor(0xFF81C5D5); canvas.drawRect(0, top, 120, 160, paint);
        paint.setColor(0xFF21677B); paint.setStrokeWidth(2);
        if (amount > 0) canvas.drawLine(18, top, 102, top, paint);
        for (int i = 1; i < 4; i++) canvas.drawLine(77, 12 + i * 34.5f, 90, 12 + i * 34.5f, paint);
        canvas.restore(); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(4);
        canvas.drawPath(cup, paint);
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
