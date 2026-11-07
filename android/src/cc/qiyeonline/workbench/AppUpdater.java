package cc.qiyeonline.workbench;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import org.json.JSONObject;

final class AppUpdater {
    private final Activity activity;
    private final BooleanSupplier canPrompt;
    private final Consumer<String> status;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final File apk;
    private boolean resumed, busy, installReady, awaitingPermission;
    private volatile boolean closed;
    private JSONObject release;
    private AlertDialog dialog;
    private final Runnable automaticCheck = () -> check(false);

    AppUpdater(Activity activity, BooleanSupplier canPrompt, Consumer<String> status) {
        this.activity = activity;
        this.canPrompt = canPrompt;
        this.status = status;
        apk = new File(activity.getCacheDir(), "app-update.apk");
    }

    void resume() {
        resumed = true;
        if (awaitingPermission) {
            awaitingPermission = false;
            if (activity.getPackageManager().canRequestPackageInstalls()) install();
            else { status.accept("安装权限未开启，点“检查更新”可重试。"); installReady = false; }
        } else if (installReady) install();
        else handler.postDelayed(automaticCheck, 1800);
    }

    void pause() { resumed = false; handler.removeCallbacks(automaticCheck); }
    void close() { closed = true; handler.removeCallbacksAndMessages(null); worker.shutdownNow(); if (dialog != null) dialog.dismiss(); }

    void check(boolean manual) {
        if (closed || busy) { if (manual) toast("正在处理更新，请稍候"); return; }
        if (!canPrompt.getAsBoolean()) { if (manual) toast("请先停止并保存录音，再检查更新"); return; }
        long last = activity.getPreferences(0).getLong("update-check", 0);
        if (!manual && (!resumed || System.currentTimeMillis() - last < 86400000L)) return;
        busy = true;
        activity.getPreferences(0).edit().putLong("update-check", System.currentTimeMillis()).apply();
        status.accept("正在检查新版本…");
        worker.execute(() -> {
            try {
                HttpURLConnection connection = connect("https://qiyeonline.cc.cd/app-update.json?t=" + System.currentTimeMillis(), false);
                JSONObject data;
                try (InputStream stream = connection.getInputStream(); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    byte[] bytes = new byte[4096]; int count;
                    while ((count = stream.read(bytes)) != -1) { if (buffer.size() + count > 65536) throw new Exception(); buffer.write(bytes, 0, count); }
                    data = new JSONObject(buffer.toString("UTF-8"));
                } finally { connection.disconnect(); }
                if (!UpdateSecurity.validRelease(data.getString("version"), data.getInt("versionCode"), data.getString("url"), data.getString("sha256"))) throw new Exception();
                int current = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionCode;
                handler.post(() -> {
                    if (closed) return;
                    busy = false;
                    activity.getPreferences(0).edit().putLong("update-check", System.currentTimeMillis()).apply();
                    if (data.optInt("versionCode") <= current) { status.accept("已是最新版本"); if (manual) toast("已是最新版本"); return; }
                    release = data;
                    status.accept("发现新版本 " + data.optString("version"));
                    if (resumed && canPrompt.getAsBoolean()) offer();
                    else activity.getPreferences(0).edit().remove("update-check").apply();
                });
            } catch (Exception error) {
                handler.post(() -> { if (closed) return; busy = false; status.accept("检查失败，请确认网络后重试。"); if (manual) toast("检查更新失败，请稍后重试"); });
            }
        });
    }

    private void offer() {
        if (dialog != null && dialog.isShowing()) return;
        dialog = new AlertDialog.Builder(activity).setTitle("发现新版本 " + release.optString("version"))
            .setMessage(release.optString("notes", "优化使用体验") + "\n\n下载后由系统确认安装，保留现有记录。")
            .setPositiveButton("下载更新", (view, which) -> download()).setNegativeButton("稍后", null).create();
        dialog.show();
    }

    private HttpURLConnection connect(String address, boolean download) throws Exception {
        for (int redirect = 0; redirect < 6; redirect++) {
            if (download && !UpdateSecurity.trustedDownload(address)) throw new Exception("下载地址不可信");
            HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(false); connection.setUseCaches(false);
            int code = connection.getResponseCode();
            if (download && code >= 300 && code < 400) {
                String location = connection.getHeaderField("Location"); connection.disconnect();
                if (location == null) throw new Exception();
                address = new URL(new URL(address), location).toString(); continue;
            }
            if (code != 200) { connection.disconnect(); throw new Exception("网络响应失败"); }
            return connection;
        }
        throw new Exception("下载跳转过多");
    }

    private void download() {
        if (busy || closed) return;
        if (!canPrompt.getAsBoolean()) { toast("请先停止并保存录音"); return; }
        busy = true;
        status.accept("正在下载更新…");
        dialog = new AlertDialog.Builder(activity).setTitle("正在下载更新").setMessage("正在连接下载服务器…").setNegativeButton("收起进度", null).create();
        dialog.show();
        JSONObject target = release;
        worker.execute(() -> {
            File partial = null;
            try {
                partial = File.createTempFile("app-update-", ".apk", activity.getCacheDir());
                HttpURLConnection connection = connect(target.getString("url"), true);
                long total = connection.getContentLengthLong();
                try (InputStream stream = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                    byte[] bytes = new byte[16384]; int count; long received = 0; int previous = -1;
                    while ((count = stream.read(bytes)) != -1) {
                        if (closed || Thread.currentThread().isInterrupted() || received + count > 100 * 1024 * 1024) throw new Exception();
                        output.write(bytes, 0, count); received += count;
                        int progress = total > 0 ? (int) Math.min(99, received * 100 / total) : 0;
                        if (progress != previous) { previous = progress; handler.post(() -> { if (!closed && dialog != null) dialog.setMessage("已下载 " + progress + "%"); }); }
                    }
                    if (received == 0 || (total > 0 && received != total)) throw new Exception();
                } finally { connection.disconnect(); }
                verify(partial, target);
                if (closed || Thread.currentThread().isInterrupted()) throw new Exception();
                Files.move(partial.toPath(), apk.toPath(), StandardCopyOption.REPLACE_EXISTING);
                handler.post(() -> { if (closed) return; busy = false; dialog.dismiss(); installReady = true; status.accept("下载完成，准备安装"); if (resumed) install(); });
            } catch (Exception error) {
                if (partial != null) partial.delete();
                handler.post(() -> { if (closed) return; busy = false; dialog.dismiss(); status.accept("下载或校验失败，请检查网络后重试。"); if (resumed) new AlertDialog.Builder(activity).setTitle("更新未完成").setMessage("安装包下载或校验失败，请检查网络后重试。").setPositiveButton("重试", (view, which) -> download()).setNegativeButton("稍后", null).show(); });
            }
        });
    }

    private void verify(File file, JSONObject target) throws Exception {
        if (!UpdateSecurity.matchesHash(file, target.getString("sha256"))) throw new Exception("安装包校验失败");
        PackageManager manager = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo incoming = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = manager.getPackageInfo(activity.getPackageName(), flags);
        if (incoming == null || !activity.getPackageName().equals(incoming.packageName) || incoming.versionCode != target.getInt("versionCode") || incoming.versionCode <= installed.versionCode || !target.getString("version").equals(incoming.versionName)) throw new Exception("安装包版本不匹配");
        Signature[] next = Build.VERSION.SDK_INT >= 28 ? incoming.signingInfo.getApkContentsSigners() : incoming.signatures;
        Signature[] current = Build.VERSION.SDK_INT >= 28 ? installed.signingInfo.getApkContentsSigners() : installed.signatures;
        if (next == null || current == null || next.length != 1 || current.length != 1 || !Arrays.equals(next[0].toByteArray(), current[0].toByteArray())) throw new Exception("安装包签名不匹配");
    }

    private void install() {
        if (!resumed || !canPrompt.getAsBoolean() || closed) return;
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            installReady = false;
            dialog = new AlertDialog.Builder(activity).setTitle("允许安装更新").setMessage("请在下一页允许七夜online安装应用，然后返回继续安装。")
                .setPositiveButton("去开启", (view, which) -> {
                    try { awaitingPermission = true; activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))); }
                    catch (Exception error) { awaitingPermission = false; toast("无法打开安装权限，请在手机应用设置中开启"); }
                }).setNegativeButton("稍后", null).create();
            dialog.show();
            status.accept("下载完成，等待安装权限");
            return;
        }
        installReady = false;
        try {
            Uri uri = Uri.parse("content://cc.qiyeonline.workbench.updates/update.apk");
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(android.content.ClipData.newRawUri("应用更新", uri));
            activity.startActivity(intent);
            status.accept("已打开系统安装，请确认安装。");
        } catch (Exception error) { status.accept("无法打开安装程序，请稍后重试。"); toast("手机无法打开安装程序，请稍后重试"); }
    }

    private void toast(String message) { Toast.makeText(activity, message, Toast.LENGTH_LONG).show(); }
}
