package cc.qiyeonline.workbench;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.OutputStream;
import java.io.File;
import java.nio.file.Files;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOME = "https://qiyeonline.cc.cd/";
    private static final int FILE_PICK = 10, FILE_SAVE = 11, AUDIO_PERMISSION = 12, NATIVE_AUDIO_PERMISSION = 13;
    private LinearLayout root;
    private WebView web;
    private LinearLayout errorView;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest audioRequest;
    private WebMessagePort downloadPort;
    private byte[] pendingDownload;
    private WebMessagePort nativePort;
    private MediaRecorder nativeRecorder;
    private File audioFile;
    private String audioId;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable recordingLimit = () -> finishNativeAudio(false);
    private boolean keyboardVisible;
    private AppUpdater updater;

    private boolean trusted(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && "qiyeonline.cc.cd".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(231, 239, 238));
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            boolean previousKeyboard = keyboardVisible;
            if (Build.VERSION.SDK_INT >= 30) {
                keyboardVisible = insets.isVisible(WindowInsets.Type.ime());
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                keyboardVisible = insets.getSystemWindowInsetBottom() > getResources().getDisplayMetrics().density * 100;
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            if (web != null && previousKeyboard != keyboardVisible) web.evaluateJavascript("document.documentElement.classList.toggle('android-keyboard', " + keyboardVisible + ")", null);
            return insets;
        });
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(231, 239, 238));
        root.addView(web, new LinearLayout.LayoutParams(-1, -1));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        try { web.getSettings().setUserAgentString(web.getSettings().getUserAgentString() + " QiyeAndroid/" + getPackageManager().getPackageInfo(getPackageName(), 0).versionName); }
        catch (PackageManager.NameNotFoundException ignored) { }
        updater = new AppUpdater(this, () -> nativeRecorder == null, status -> {
            if (nativePort == null) return;
            try { nativePort.postMessage(new WebMessage(new JSONObject().put("action", "update-status").put("status", status).toString())); }
            catch (Exception ignored) { }
        });
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        CookieManager.getInstance().setAcceptCookie(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (trusted(request.getUrl())) return false;
                if (request.isForMainFrame() && !"blob".equals(request.getUrl().getScheme())) openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                finishNativeAudio(true);
                if (nativePort != null) { nativePort.close(); nativePort = null; }
                if (downloadPort != null) { downloadPort.close(); downloadPort = null; }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (trusted(Uri.parse(url))) { connectNative(); connectDownloads(); }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showNetworkError();
            }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
                showNetworkError();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try { startActivityForResult(picker, FILE_PICK); }
                catch (ActivityNotFoundException error) { callback.onReceiveValue(null); fileCallback = null; toast("手机没有可用的文件选择器"); }
                return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean audio = java.util.Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                    if (!trusted(request.getOrigin()) || !audio) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                    } else {
                        if (audioRequest != null) audioRequest.deny();
                        audioRequest = request;
                        requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, AUDIO_PERMISSION);
                    }
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (audioRequest == request) audioRequest = null; }
        });
        web.setDownloadListener((url, agent, disposition, mime, size) -> {
            if (url.startsWith("blob:") && trusted(Uri.parse(web.getUrl()))) {
                web.evaluateJavascript("window.__qiyeSaveBlob && window.__qiyeSaveBlob(" + JSONObject.quote(url) + ", 'workbench-backup.json')", null);
            } else if (trusted(Uri.parse(url))) {
                openExternal(Uri.parse(url));
            }
        });
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
    }

    private void connectNative() {
        try {
            String script;
            try (java.io.InputStream stream = getAssets().open("native-shell.js")) {
                java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                byte[] bytes = new byte[4096];
                int count;
                while ((count = stream.read(bytes)) != -1) buffer.write(bytes, 0, count);
                script = buffer.toString("UTF-8");
            }
            web.evaluateJavascript(script, value -> {
                if (!trusted(Uri.parse(web.getUrl()))) return;
                if (nativePort != null) nativePort.close();
                WebMessagePort[] ports = web.createWebMessageChannel();
                nativePort = ports[0];
                nativePort.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                    @Override public void onMessage(WebMessagePort port, WebMessage message) {
                        if (!trusted(Uri.parse(web.getUrl()))) return;
                        try {
                            JSONObject data = new JSONObject(message.getData());
                            switch (data.optString("action")) {
                                case "update-check": updater.check(true); break;
                                case "audio-start":
                                    if (audioId != null) { replyNative(data.optString("id"), "已有录音正在进行", "Error"); return; }
                                    audioId = data.getString("id");
                                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startNativeAudio();
                                    else requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, NATIVE_AUDIO_PERMISSION);
                                    break;
                                case "audio-stop": finishNativeAudio(false); break;
                                case "audio-cancel": finishNativeAudio(true); break;
                                case "permissions": startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); break;
                            }
                        } catch (Exception error) {
                            replyNative(audioId, "手机录音连接失败，请重试", "Error");
                            finishNativeAudio(true);
                        }
                    }
                });
                web.postWebMessage(new WebMessage("qiye-native-port", new WebMessagePort[] { ports[1] }), Uri.parse(HOME));
            });
        } catch (Exception error) { toast("手机录音尚未就绪，请重新打开应用"); }
    }

    private void replyNative(String id, String error, String name) {
        if (nativePort == null || id == null) return;
        try { nativePort.postMessage(new WebMessage(new JSONObject().put("id", id).put("error", error).put("name", name).toString())); }
        catch (Exception ignored) { }
    }

    private void startNativeAudio() {
        if (audioId == null) return;
        try {
            audioFile = File.createTempFile("quick-record-", ".m4a", getCacheDir());
            nativeRecorder = new MediaRecorder();
            nativeRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            nativeRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            nativeRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            nativeRecorder.setAudioSamplingRate(44100);
            nativeRecorder.setAudioEncodingBitRate(64000);
            nativeRecorder.setOutputFile(audioFile.getAbsolutePath());
            nativeRecorder.setOnErrorListener((recorder, what, extra) -> {
                replyNative(audioId, "录音中断，请重试", "Error");
                finishNativeAudio(true);
            });
            nativeRecorder.prepare();
            nativeRecorder.start();
            nativePort.postMessage(new WebMessage(new JSONObject().put("id", audioId).put("started", true).toString()));
            handler.postDelayed(recordingLimit, 60000);
        } catch (Exception error) {
            replyNative(audioId, "无法启动麦克风，请确认系统麦克风开关已开启，并关闭其他正在录音的应用", "NotReadableError");
            finishNativeAudio(true);
        }
    }

    private void finishNativeAudio(boolean cancel) {
        handler.removeCallbacks(recordingLimit);
        if (audioId == null) return;
        String id = audioId;
        audioId = null;
        try {
            if (nativeRecorder != null) {
                if (!cancel) nativeRecorder.stop();
                nativeRecorder.release();
                nativeRecorder = null;
            }
            if (cancel) replyNative(id, "录音已取消，未保存任何内容", "AbortError");
            else if (audioFile == null || audioFile.length() == 0) replyNative(id, "录音太短，请说完一句话后再停止", "Error");
            else if (nativePort != null) nativePort.postMessage(new WebMessage(new JSONObject().put("id", id).put("audio", Base64.encodeToString(Files.readAllBytes(audioFile.toPath()), Base64.NO_WRAP)).toString()));
        } catch (Exception error) { replyNative(id, "录音太短或已中断，请重试", "Error"); }
        finally {
            if (nativeRecorder != null) { nativeRecorder.release(); nativeRecorder = null; }
            if (audioFile != null) { audioFile.delete(); audioFile = null; }
        }
    }

    private void connectDownloads() {
        web.evaluateJavascript("(() => { if(window.__qiyeDownloadReady)return; window.__qiyeDownloadReady=true; " +
            "const blobs=new Map(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);" +
            "URL.createObjectURL=blob=>{const url=create(blob);blobs.set(url,blob);return url;};URL.revokeObjectURL=url=>{blobs.delete(url);revoke(url);};" +
            "window.addEventListener('message', e => { if(e.data==='qiye-download-port' && e.ports[0]) window.__qiyePort=e.ports[0]; });" +
            "window.__qiyeSaveBlob=async (url,name) => { try { const blob=blobs.get(url)||await (await fetch(url)).blob(); if(blob.size>12582912)throw Error('备份文件过大'); " +
            "const data=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(blob);}); " +
            "if(!window.__qiyePort)throw Error('导出尚未就绪，请重试'); window.__qiyePort.postMessage(JSON.stringify({name,type:blob.type,data})); " +
            "} catch(e){alert('导出失败：'+e.message);} };" +
            "const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){window.__qiyeSaveBlob(this.href,this.download);return;}click.call(this);};" +
            "document.addEventListener('click', e => {const a=e.target.closest('a[download]'); if(a && a.href.startsWith('blob:')){e.preventDefault();window.__qiyeSaveBlob(a.href,a.download);}},true); })()", value -> {
                if (!trusted(Uri.parse(web.getUrl()))) return;
                WebMessagePort[] ports = web.createWebMessageChannel();
                downloadPort = ports[0];
                downloadPort.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                    @Override public void onMessage(WebMessagePort port, WebMessage message) { saveDownload(message.getData()); }
                });
                web.postWebMessage(new WebMessage("qiye-download-port", new WebMessagePort[] { ports[1] }), Uri.parse(HOME));
            });
    }

    private void saveDownload(String data) {
        if (!trusted(Uri.parse(web.getUrl())) || pendingDownload != null || data == null || data.length() > 18 * 1024 * 1024) return;
        try {
            JSONObject payload = new JSONObject(data);
            String encoded = payload.getString("data");
            int comma = encoded.indexOf(',');
            if (!encoded.startsWith("data:") || comma < 0 || !encoded.substring(0, comma).endsWith(";base64")) throw new IllegalArgumentException();
            pendingDownload = Base64.decode(encoded.substring(comma + 1), Base64.DEFAULT);
            String type = payload.optString("type", "application/octet-stream").split(";")[0];
            String name = payload.optString("name", "workbench-backup.json").replaceAll("[\\\\/\\r\\n]", "_");
            Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type).putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(save, FILE_SAVE);
        } catch (Exception error) { pendingDownload = null; toast("无法导出文件，请重试"); }
    }

    @Override public void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == FILE_PICK && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
        if (request == FILE_SAVE && pendingDownload != null) {
            if (result == RESULT_OK && data != null && data.getData() != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    stream.write(pendingDownload);
                    toast("文件已保存");
                } catch (Exception error) { toast("保存失败，请重新导出"); }
            }
            pendingDownload = null;
        }
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants);
        if (request == NATIVE_AUDIO_PERMISSION && audioId != null) {
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) startNativeAudio();
            else {
                replyNative(audioId, "麦克风权限未开启，请点“开启麦克风权限”，在应用权限中允许录音", "NotAllowedError");
                finishNativeAudio(true);
            }
        }
        if (request == AUDIO_PERMISSION && audioRequest != null) {
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) audioRequest.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            else { audioRequest.deny(); toast("未获得录音权限，仍可使用文字录入"); }
            audioRequest = null;
        }
    }

    private void showNetworkError() {
        web.setVisibility(View.GONE);
        if (errorView != null) return;
        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(android.view.Gravity.CENTER);
        errorView.setPadding(48, 48, 48, 48);
        TextView text = new TextView(this);
        text.setText("暂时无法连接工作台\n请检查网络后重试。");
        text.setTextSize(18);
        text.setGravity(android.view.Gravity.CENTER);
        errorView.addView(text);
        Button retry = new Button(this);
        retry.setText("重新连接");
        retry.setOnClickListener(view -> { root.removeView(errorView); errorView = null; web.setVisibility(View.VISIBLE); web.loadUrl(HOME); });
        errorView.addView(retry);
        root.addView(errorView, new LinearLayout.LayoutParams(-1, -1));
    }

    private void openExternal(Uri uri) {
        if (!java.util.Arrays.asList("https", "http", "mailto", "tel").contains(uri.getScheme())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (ActivityNotFoundException error) { toast("手机没有可打开此链接的应用"); }
    }

    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    private void goBack() {
        if (keyboardVisible) {
            ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(web.getWindowToken(), 0);
            web.evaluateJavascript("document.activeElement && document.activeElement.blur()", null);
            return;
        }
        web.evaluateJavascript("Boolean(window.__qiyeHandleBack && window.__qiyeHandleBack())", result -> {
            if ("true".equals(result)) return;
            if (nativeRecorder != null) {
                new AlertDialog.Builder(this).setMessage("放弃这次录音？").setPositiveButton("放弃", (dialog, which) -> finishNativeAudio(true)).setNegativeButton("继续录音", null).show();
            } else if (errorView == null && web.canGoBack()) web.goBack();
            else moveTaskToBack(true);
        });
    }
    @Override public void onBackPressed() { goBack(); }
    @Override public void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override public void onPause() { if (updater != null) updater.pause(); if (nativeRecorder != null) finishNativeAudio(true); CookieManager.getInstance().flush(); web.onPause(); super.onPause(); }
    @Override public void onResume() { super.onResume(); if (web != null) web.onResume(); if (updater != null) updater.resume(); }
    @Override public void onDestroy() {
        if (updater != null) updater.close();
        finishNativeAudio(true);
        if (nativePort != null) nativePort.close();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (audioRequest != null) audioRequest.deny();
        if (downloadPort != null) downloadPort.close();
        root.removeView(web);
        web.destroy();
        super.onDestroy();
    }
}
