package cc.qiyeonline.workbench;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.ZoneId;
import org.json.JSONArray;
import org.json.JSONObject;

public class WorkbenchWidgets extends AppWidgetProvider {
    public static final class Plans extends WorkbenchWidgets { }
    public static final class Water extends WorkbenchWidgets { }
    private static final String PREFS = "home-widgets";

    public static void sync(Context context, JSONObject source) throws Exception {
        JSONObject snapshot = new JSONObject();
        String date = source.getString("date");
        LocalDate.parse(date);
        snapshot.put("date", date);
        JSONArray tasks = source.optJSONArray("tasks"), safeTasks = new JSONArray();
        if (tasks != null) for (int i = 0; i < Math.min(3, tasks.length()); i++) {
            String title = tasks.optString(i, "");
            safeTasks.put(title.substring(0, Math.min(50, title.length())));
        }
        snapshot.put("tasks", safeTasks);
        snapshot.put("pendingCount", Math.max(0, Math.min(999, source.optInt("pendingCount"))));
        snapshot.put("waterMl", Math.max(0, Math.min(100000, source.optInt("waterMl"))));
        snapshot.put("targetMl", Math.max(250, Math.min(100000, source.optInt("targetMl", 2000))));
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("snapshot", snapshot.toString()).apply();
        updateAll(context);
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> type : new Class<?>[] { Plans.class, Water.class }) {
            for (int id : manager.getAppWidgetIds(new ComponentName(context, type))) render(context, manager, id, type == Plans.class);
        }
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id, this instanceof Plans);
    }

    private static void render(Context context, AppWidgetManager manager, int id, boolean plans) {
        JSONObject data;
        try { data = new JSONObject(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("snapshot", "{}")); }
        catch (Exception error) { data = new JSONObject(); }
        boolean today = LocalDate.now(ZoneId.of("Asia/Shanghai")).toString().equals(data.optString("date"));
        RemoteViews views = new RemoteViews(context.getPackageName(), plans ? R.layout.widget_plans : R.layout.widget_water);
        if (plans) {
            JSONArray tasks = today ? data.optJSONArray("tasks") : null;
            StringBuilder text = new StringBuilder();
            if (tasks != null) for (int i = 0; i < tasks.length(); i++) { if (i > 0) text.append("\n"); text.append("• ").append(tasks.optString(i)); }
            views.setTextViewText(R.id.widget_content, text.length() == 0 ? today ? "今天暂无待办" : "打开 App 更新今日计划" : text.toString());
            views.setTextViewText(R.id.widget_footer, today ? "待办 " + data.optInt("pendingCount") + " 项 · 点击查看" : "点击查看计划");
        } else {
            int water = today ? data.optInt("waterMl") : 0, target = data.optInt("targetMl", 2000);
            String cups = water % 250 == 0 ? String.valueOf(water / 250) : String.format(java.util.Locale.ROOT, "%.1f", water / 250.0);
            views.setTextViewText(R.id.widget_content, cups + " / " + (int)Math.ceil(target / 250.0) + " 杯");
            views.setTextViewText(R.id.widget_footer, (today ? "已喝 " + water + " ml · " : "") + "点击打卡");
        }
        Intent open = new Intent(context, MainActivity.class).setAction("cc.qiyeonline.workbench.WIDGET_" + (plans ? "PLANS" : "WATER"))
            .putExtra("widgetPage", plans ? "plans" : "diet").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, plans ? 301 : 302, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(id, views);
    }
}
