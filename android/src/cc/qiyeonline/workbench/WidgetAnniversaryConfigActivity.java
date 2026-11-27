package cc.qiyeonline.workbench;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;

public final class WidgetAnniversaryConfigActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); setResult(RESULT_CANCELED);
        int id = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(id);
        if (info == null || !getPackageName().equals(info.provider.getPackageName()) || !WorkbenchWidgets.Anniversaries.class.getName().equals(info.provider.getClassName())) { finish(); return; }
        JSONArray items = WorkbenchWidgets.read(this).optJSONArray("anniversaryDetails");
        int count = items == null ? 0 : items.length();
        String[] names = new String[count + 1], keys = new String[count + 1];
        names[0] = "自动轮换即将到来的日子"; keys[0] = "";
        for (int i = 0; i < count; i++) { JSONObject item = items.optJSONObject(i); names[i + 1] = item.optString("title"); keys[i + 1] = item.optString("id"); }
        new AlertDialog.Builder(this).setTitle("选择桌面纪念日")
            .setItems(names, (dialog, which) -> {
                getSharedPreferences(WorkbenchWidgets.PREFS, MODE_PRIVATE).edit().putString("anniversary:" + id, keys[which]).remove("anniversary-current:" + id).remove("anniversary-switched:" + id).apply();
                WorkbenchWidgets.updateAll(this);
                setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)); finish();
            }).setNegativeButton("取消", (dialog, which) -> finish()).setOnCancelListener(dialog -> finish()).show();
    }
}
