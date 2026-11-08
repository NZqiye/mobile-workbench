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
    public static final class Watch extends WorkbenchWidgets { }
    public static final class Assets extends WorkbenchWidgets { }
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
        JSONArray days = source.optJSONArray("watchDays"), safeDays = new JSONArray();
        if (days != null) for (int i = 0; i < Math.min(14, days.length()); i++) {
            JSONObject day = days.optJSONObject(i);
            if (day == null) continue;
            LocalDate.parse(day.getString("date"));
            safeDays.put(new JSONObject().put("date", day.getString("date"))
                .put("count", Math.max(0, Math.min(999, day.optInt("count"))))
                .put("episodeCount", Math.max(0, Math.min(9999, day.optInt("episodeCount"))))
                .put("lines", safeLines(day.optJSONArray("lines"), 3, 70)));
        }
        snapshot.put("watchDays", safeDays);
        if (source.has("assetCount")) {
            snapshot.put("assetCount", Math.max(0, Math.min(99999, source.optInt("assetCount"))));
            double total = source.optDouble("assetTotal", 0);
            snapshot.put("assetTotal", Double.isFinite(total) ? Math.max(0, Math.min(1e12, total)) : 0);
            snapshot.put("recentAssets", safeLines(source.optJSONArray("recentAssets"), 2, 40));
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("snapshot", snapshot.toString()).apply();
        updateAll(context);
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> type : new Class<?>[] { Plans.class, Water.class, Watch.class, Assets.class }) {
            for (int id : manager.getAppWidgetIds(new ComponentName(context, type))) render(context, manager, id, type);
        }
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id, getClass());
    }

    private static JSONArray safeLines(JSONArray source, int count, int length) {
        JSONArray result = new JSONArray();
        if (source != null) for (int i = 0; i < Math.min(count, source.length()); i++) {
            String text = source.optString(i, "").replaceAll("\\s+", " ");
            result.put(text.substring(0, Math.min(length, text.length())));
        }
        return result;
    }

    private static String lines(JSONArray source) {
        StringBuilder result = new StringBuilder();
        if (source != null) for (int i = 0; i < source.length(); i++) {
            if (i > 0) result.append("\n");
            result.append(source.optString(i));
        }
        return result.toString();
    }

    private static void render(Context context, AppWidgetManager manager, int id, Class<?> type) {
        JSONObject data;
        try { data = new JSONObject(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("snapshot", "{}")); }
        catch (Exception error) { data = new JSONObject(); }
        String date = LocalDate.now(ZoneId.of("Asia/Shanghai")).toString();
        boolean today = date.equals(data.optString("date"));
        int layout = type == Plans.class ? R.layout.widget_plans : type == Water.class ? R.layout.widget_water : type == Watch.class ? R.layout.widget_watch : R.layout.widget_assets;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        if (type == Plans.class) {
            JSONArray tasks = today ? data.optJSONArray("tasks") : null;
            StringBuilder text = new StringBuilder();
            if (tasks != null) for (int i = 0; i < tasks.length(); i++) { if (i > 0) text.append("\n"); text.append("• ").append(tasks.optString(i)); }
            views.setTextViewText(R.id.widget_content, text.length() == 0 ? today ? "今天暂无待办" : "打开 App 更新今日计划" : text.toString());
            views.setTextViewText(R.id.widget_footer, today ? "待办 " + data.optInt("pendingCount") + " 项 · 点击查看" : "点击查看计划");
        } else if (type == Water.class) {
            int water = today ? data.optInt("waterMl") : 0, target = data.optInt("targetMl", 2000);
            String cups = water % 250 == 0 ? String.valueOf(water / 250) : String.format(java.util.Locale.ROOT, "%.1f", water / 250.0);
            views.setTextViewText(R.id.widget_content, cups + " / " + (int)Math.ceil(target / 250.0) + " 杯");
            views.setTextViewText(R.id.widget_footer, (today ? "已喝 " + water + " ml · " : "") + "点击打卡");
        } else if (type == Watch.class) {
            JSONObject current = null;
            JSONArray days = data.optJSONArray("watchDays");
            if (days != null) for (int i = 0; i < days.length(); i++) {
                JSONObject day = days.optJSONObject(i);
                if (day != null && date.equals(day.optString("date"))) { current = day; break; }
            }
            String text = current == null ? "打开 App 同步最新排期" : lines(current.optJSONArray("lines"));
            views.setTextViewText(R.id.widget_content, text.isEmpty() ? "今天暂无已知更新" : text);
            String footer = date.substring(5).replace('-', '/') + " · ";
            footer += current == null ? "点击查看追剧日历" : current.optInt("count") + " 部更新" + (current.optInt("episodeCount") > 0 ? " · " + current.optInt("episodeCount") + " 集" : "");
            if (current != null && !today) footer += "\n排期同步于 " + data.optString("date");
            views.setTextViewText(R.id.widget_footer, footer);
        } else {
            boolean ready = data.has("assetCount");
            java.text.NumberFormat money = java.text.NumberFormat.getNumberInstance(java.util.Locale.CHINA);
            money.setMinimumFractionDigits(2); money.setMaximumFractionDigits(2);
            views.setTextViewText(R.id.widget_amount, ready ? "¥" + money.format(data.optDouble("assetTotal", 0)) : "待同步");
            String recent = lines(data.optJSONArray("recentAssets"));
            views.setTextViewText(R.id.widget_content, !ready ? "打开 App 同步资产记录" : data.optInt("assetCount") == 0 ? "还没有在用物品" : data.optInt("assetCount") + " 件在用物品" + (recent.isEmpty() ? "" : "\n" + recent));
            views.setTextViewText(R.id.widget_footer, ready ? "购入金额 · 点击查看资产" : "点击查看资产");
        }
        String page = type == Plans.class ? "plans" : type == Water.class ? "diet" : type == Watch.class ? "consultations" : "assets";
        int requestCode = type == Plans.class ? 301 : type == Water.class ? 302 : type == Watch.class ? 303 : 304;
        Intent open = new Intent(context, MainActivity.class).setAction("cc.qiyeonline.workbench.WIDGET_" + page)
            .putExtra("widgetPage", page).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, requestCode, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(id, views);
    }
}
