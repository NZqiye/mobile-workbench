package cc.qiyeonline.workbench;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;

public final class WidgetAssetConfigActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); setResult(RESULT_CANCELED);
        int id = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(id);
        if (info == null || !getPackageName().equals(info.provider.getPackageName()) || !WorkbenchWidgets.Assets.class.getName().equals(info.provider.getClassName())) { finish(); return; }
        JSONArray assets = WorkbenchWidgets.read(this).optJSONArray("assetDetails");
        int count = assets == null ? 0 : assets.length();
        String[] names = new String[count + 1], keys = new String[count + 1];
        names[0] = "全部在用物品 · 资产总览"; keys[0] = "summary";
        for (int i = 0; i < count; i++) { JSONObject asset = assets.optJSONObject(i); names[i + 1] = asset.optString("name") + " · " + WorkbenchWidgets.currency(asset.optDouble("price")); keys[i + 1] = asset.optString("id"); }
        new AlertDialog.Builder(this).setTitle("选择桌面展示的物品")
            .setItems(names, (dialog, which) -> {
                getSharedPreferences(WorkbenchWidgets.PREFS, MODE_PRIVATE).edit().putString("asset:" + id, keys[which]).apply();
                WorkbenchWidgets.updateAll(this);
                setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)); finish();
            }).setNegativeButton("取消", (dialog, which) -> finish()).setOnCancelListener(dialog -> finish()).show();
    }
}
