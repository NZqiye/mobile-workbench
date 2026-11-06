package cc.qiyeonline.workbench;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
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
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOME = "https://qiyeonline.cc.cd/";
    private static final int FILE_PICK = 10, FILE_SAVE = 11, AUDIO_PERMISSION = 12;
    private LinearLayout root;
    private WebView web;
    private LinearLayout errorView;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest audioRequest;
    private WebMessagePort downloadPort;
    private byte[] pendingDownload;

    private boolean trusted(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && "qiyeonline.cc.cd".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(231, 239, 238));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(231, 239, 238));
        root.addView(web, new LinearLayout.LayoutParams(-1, -1));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
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
                if (downloadPort != null) { downloadPort.close(); downloadPort = null; }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (trusted(Uri.parse(url))) connectDownloads();
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
        if (errorView == null && web.canGoBack()) web.goBack();
        else new AlertDialog.Builder(this).setMessage("退出工作台？").setPositiveButton("退出", (dialog, which) -> finish()).setNegativeButton("继续使用", null).show();
    }
    @Override public void onBackPressed() { goBack(); }
    @Override public void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override public void onPause() { CookieManager.getInstance().flush(); web.onPause(); super.onPause(); }
    @Override public void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override public void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (audioRequest != null) audioRequest.deny();
        if (downloadPort != null) downloadPort.close();
        root.removeView(web);
        web.destroy();
        super.onDestroy();
    }
}
