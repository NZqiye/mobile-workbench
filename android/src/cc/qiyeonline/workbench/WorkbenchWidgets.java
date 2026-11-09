package cc.qiyeonline.workbench;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class WorkbenchWidgets extends AppWidgetProvider {
    public static final class Plans extends WorkbenchWidgets { }
    public static final class Water extends WorkbenchWidgets { }
    public static final class Watch extends WorkbenchWidgets { }
    public static final class Assets extends WorkbenchWidgets { }
    static final String PREFS = "home-widgets";

    static String today() { return LocalDate.now(ZoneId.of("Asia/Shanghai")).toString(); }
    static JSONObject read(Context context) {
        try { return new JSONObject(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("snapshot", "{}")); }
        catch (Exception error) { return new JSONObject(); }
    }

    public static void sync(Context context, JSONObject source) throws Exception {
        JSONObject snapshot = new JSONObject();
        String date = source.getString("date"); LocalDate.parse(date);
        snapshot.put("date", date).put("tasks", safeLines(source.optJSONArray("tasks"), 3, 50));
        snapshot.put("pendingCount", count(source, "pendingCount", 999)).put("completedCount", count(source, "completedCount", 999));
        snapshot.put("waterMl", count(source, "waterMl", 100000)).put("targetMl", Math.max(250, Math.min(100000, source.optInt("targetMl", 2000))));
        JSONArray days = source.optJSONArray("watchDays"), safeDays = new JSONArray();
        if (days != null) for (int i = 0; i < Math.min(14, days.length()); i++) {
            JSONObject day = days.optJSONObject(i); if (day == null) continue;
            LocalDate.parse(day.getString("date"));
            JSONObject clean = new JSONObject().put("date", day.getString("date")).put("count", count(day, "count", 999))
                .put("episodeCount", count(day, "episodeCount", 9999)).put("lines", safeLines(day.optJSONArray("lines"), 3, 70));
            JSONArray shows = day.optJSONArray("shows"), rows = new JSONArray();
            if (shows != null) for (int j = 0; j < Math.min(60, shows.length()); j++) {
                JSONObject show = shows.optJSONObject(j); if (show == null) continue;
                rows.put(new JSONObject().put("id", text(show, "id", 120)).put("title", text(show, "title", 80))
                    .put("season", text(show, "season", 4)).put("episodes", text(show, "episodes", 100))
                    .put("time", text(show, "time", 5)).put("poster", WidgetPolicy.posterUrl(show.optString("poster"))));
            }
            clean.put("shows", rows); safeDays.put(clean);
        }
        snapshot.put("watchDays", safeDays);
        if (source.has("assetCount")) {
            snapshot.put("assetCount", count(source, "assetCount", 99999)).put("assetTotal", money(source, "assetTotal"));
            snapshot.put("recentAssets", safeLines(source.optJSONArray("recentAssets"), 2, 40));
            JSONArray assets = source.optJSONArray("assetDetails"), details = new JSONArray();
            if (assets != null) for (int i = 0; i < Math.min(500, assets.length()); i++) {
                JSONObject asset = assets.optJSONObject(i); if (asset == null) continue;
                String purchase = text(asset, "purchaseDate", 10);
                try { LocalDate.parse(purchase); } catch (Exception ignored) { purchase = ""; }
                String icon = text(asset, "icon", 200);
                if (!icon.matches("/assets-icons/thiings/[a-z0-9-]+/[a-z0-9-]+\\.webp")) icon = "/assets-icons/thiings/home/box.webp";
                details.put(new JSONObject().put("id", text(asset, "id", 120)).put("name", text(asset, "name", 80))
                    .put("price", money(asset, "price")).put("purchaseDate", purchase).put("icon", icon));
            }
            snapshot.put("assetDetails", details);
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("snapshot", snapshot.toString()).apply();
        updateAll(context); WidgetImages.refresh(context);
    }

    static JSONArray upcoming(JSONObject data, String date) {
        JSONArray result = new JSONArray(), days = data.optJSONArray("watchDays"); Set<String> seen = new HashSet<>();
        if (days != null) for (int i = 0; i < days.length() && result.length() < 60; i++) {
            JSONObject day = days.optJSONObject(i); if (day == null || WidgetPolicy.remaining(day.optString("date"), date) < 0) continue;
            JSONArray shows = day.optJSONArray("shows"); if (shows == null) continue;
            for (int j = 0; j < shows.length() && result.length() < 60; j++) {
                JSONObject show = shows.optJSONObject(j); if (show == null || !seen.add(show.optString("id"))) continue;
                try { JSONObject row = new JSONObject(show.toString()); row.put("date", day.getString("date")); result.put(row); }
                catch (Exception ignored) { }
            }
        }
        return result;
    }

    static boolean hasWatch(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, Watch.class)).length > 0;
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> type : new Class<?>[] { Plans.class, Water.class, Watch.class, Assets.class })
            for (int id : manager.getAppWidgetIds(new ComponentName(context, type))) render(context, manager, id, type);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { for (int id : ids) render(context, manager, id, getClass()); }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) { render(context, manager, id, getClass()); }
    @Override public void onDeleted(Context context, int[] ids) {
        android.content.SharedPreferences.Editor edit = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        for (int id : ids) edit.remove("asset:" + id); edit.apply();
    }

    private static int count(JSONObject value, String key, int max) { return Math.max(0, Math.min(max, value.optInt(key))); }
    private static double money(JSONObject value, String key) { double amount = value.optDouble(key, 0); return Double.isFinite(amount) ? Math.max(0, Math.min(1e12, amount)) : 0; }
    private static String text(JSONObject value, String key, int length) { String text = value.optString(key, "").replaceAll("\\s+", " "); return text.substring(0, Math.min(length, text.length())); }
    private static JSONArray safeLines(JSONArray source, int count, int length) {
        JSONArray result = new JSONArray();
        if (source != null) for (int i = 0; i < Math.min(count, source.length()); i++) { String text = source.optString(i, "").replaceAll("\\s+", " "); result.put(text.substring(0, Math.min(length, text.length()))); }
        return result;
    }
    private static String lines(JSONArray source) { StringBuilder text = new StringBuilder(); if (source != null) for (int i = 0; i < source.length(); i++) { if (i > 0) text.append("\n"); text.append(source.optString(i)); } return text.toString(); }
    static String currency(double value) { java.text.NumberFormat format = java.text.NumberFormat.getNumberInstance(java.util.Locale.CHINA); format.setMinimumFractionDigits(2); format.setMaximumFractionDigits(2); return "¥" + format.format(value); }

    private static PendingIntent open(Context context, String page, int code, boolean collection) {
        Intent intent = new Intent(context, MainActivity.class).setAction("cc.qiyeonline.workbench.WIDGET_" + page).putExtra("widgetPage", page)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | (collection ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE));
    }

    private static void render(Context context, AppWidgetManager manager, int id, Class<?> type) {
        JSONObject data = read(context); String date = today(); boolean fresh = date.equals(data.optString("date"));
        int layout = type == Plans.class ? R.layout.widget_plans : type == Water.class ? R.layout.widget_water : type == Watch.class ? R.layout.widget_watch : R.layout.widget_assets;
        int height = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 280);
        if (type == Assets.class && height < 250) layout = R.layout.widget_assets_compact;
        if (type == Water.class && height < 145) layout = R.layout.widget_water_compact;
        if (type == Plans.class && height < 140) layout = R.layout.widget_plans_compact;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        if (type == Plans.class) {
            int pending = fresh ? data.optInt("pendingCount") : 0, done = fresh ? data.optInt("completedCount") : 0;
            views.setTextViewText(R.id.widget_amount, fresh ? String.valueOf(pending) : "—");
            views.setTextViewText(R.id.widget_footer, fresh ? "已完成 " + done + " 项" : "打开 App 同步今日计划");
            views.setTextViewText(R.id.widget_date, date.substring(5).replace('-', '/'));
            JSONArray tasks = fresh ? data.optJSONArray("tasks") : null;
            boolean compact = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180) < 180;
            if (compact) views.setTextViewTextSize(R.id.widget_amount, android.util.TypedValue.COMPLEX_UNIT_SP, 28);
            int[] rows = { R.id.widget_task_1, R.id.widget_task_2, R.id.widget_task_3 };
            for (int i = 0; i < rows.length; i++) {
                views.setViewVisibility(rows[i], (i == 0 || tasks != null && i < tasks.length()) && !(compact && i == 2) ? View.VISIBLE : View.GONE);
                views.setTextViewText(rows[i], tasks != null && i < tasks.length() ? tasks.optString(i) : fresh ? "今天暂无待办" : "点击查看今日计划");
            }
        } else if (type == Water.class) {
            int water = fresh ? data.optInt("waterMl") : 0, target = data.optInt("targetMl", 2000);
            int percent = Math.min(100, Math.round(water * 100f / target));
            views.setTextViewText(R.id.widget_amount, String.valueOf(water));
            views.setTextViewText(R.id.widget_goal, "/ " + target + " ml");
            views.setTextViewText(R.id.widget_footer, percent + "% · " + (water >= target ? "今日目标达成" : "还差 " + (target - water) + " ml"));
            views.setProgressBar(R.id.widget_progress, target, Math.min(water, target), false);
            views.setImageViewBitmap(R.id.widget_icon, WidgetImages.waterGauge(water, target));
            views.setContentDescription(R.id.widget_icon, "已喝 " + water + " ml，目标 " + target + " ml，" + percent + "%");
        } else if (type == Watch.class) {
            JSONArray upcoming = upcoming(data, date);
            views.setTextViewText(R.id.widget_content, upcoming.length() == 0 ? fresh ? "暂无已知排期\n打开追剧日历添加或刷新" : "打开 App 同步最新排期" : "");
            views.setTextViewText(R.id.widget_footer, date.substring(5).replace('-', '/') + (fresh ? " · 未来两周排期" : " · 同步于 " + data.optString("date", "—")));
            Intent adapter = new Intent(context, WidgetWatchService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).setData(Uri.parse("qiye-widget://watch/" + id));
            views.setRemoteAdapter(R.id.widget_list, adapter); views.setEmptyView(R.id.widget_list, R.id.widget_content);
            views.setPendingIntentTemplate(R.id.widget_list, open(context, "consultations", 1000 + id, true));
            views.setOnClickPendingIntent(R.id.widget_heading, open(context, "consultations", 303, false));
        } else {
            renderAsset(context, views, data, id, date);
        }
        String page = type == Plans.class ? "plans" : type == Water.class ? "diet" : type == Watch.class ? "consultations" : "assets";
        views.setOnClickPendingIntent(R.id.widget_root, open(context, page, type == Plans.class ? 301 : type == Water.class ? 302 : type == Watch.class ? 303 : 304, false));
        manager.updateAppWidget(id, views);
        if (type == Watch.class) manager.notifyAppWidgetViewDataChanged(id, R.id.widget_list);
    }

    private static void renderAsset(Context context, RemoteViews views, JSONObject data, int id, String date) {
        String selection = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("asset:" + id, "");
        JSONArray assets = data.optJSONArray("assetDetails"); JSONObject selected = null;
        if (assets != null) for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.optJSONObject(i); if (asset == null) continue;
            if (selection.equals(asset.optString("id")) || selection.isEmpty() && selected == null) selected = asset;
        }
        boolean summary = "summary".equals(selection), missing = summary ? !data.has("assetCount") : selected == null;
        long days = selected == null ? -1 : WidgetPolicy.days(selected.optString("purchaseDate"), date);
        double price = selected == null ? data.optDouble("assetTotal", 0) : selected.optDouble("price", 0);
        views.setTextViewText(R.id.widget_title, summary ? "资产总览" : selected == null ? "资产记录" : selected.optString("name"));
        views.setTextViewText(R.id.widget_date, summary ? "在用物品 · 购入金额" : selected == null ? "点击右上角选择物品" : selected.optString("purchaseDate").isEmpty() ? "购买日期未记录" : "购买于 " + selected.optString("purchaseDate"));
        views.setTextViewText(R.id.widget_days, summary ? missing ? "打开 App 同步资产" : data.optInt("assetCount") + " 件物品正在陪伴你" : missing ? selection.isEmpty() ? "打开 App 同步资产" : "该物品已删除或不再服役" : days > 0 ? "陪伴了你 " + days + " 天" : days == 0 ? "还未到购买日期" : "补充购买日期后查看成本");
        views.setTextViewText(R.id.widget_daily, summary ? "—" : days > 0 ? currency(WidgetPolicy.daily(price, days)) : "—");
        views.setTextViewText(R.id.widget_amount, missing ? "—" : currency(price));
        views.setTextViewText(R.id.widget_drop, summary ? "—" : days > 0 ? currency(WidgetPolicy.drop(price, days)) : "—");
        views.setViewVisibility(R.id.widget_cost_row, summary ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_drop_column, summary ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_footer, summary ? lines(data.optJSONArray("recentAssets")) : "总金额");
        android.graphics.Bitmap icon = WidgetImages.icon(context, selected == null ? "/assets-icons/thiings/home/box.webp" : selected.optString("icon"));
        if (icon != null) views.setImageViewBitmap(R.id.widget_icon, icon);
        Intent configure = new Intent(context, WidgetAssetConfigActivity.class).setAction(AppWidgetManager.ACTION_APPWIDGET_CONFIGURE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        views.setOnClickPendingIntent(R.id.widget_settings, PendingIntent.getActivity(context, 2000 + id, configure, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }
}
