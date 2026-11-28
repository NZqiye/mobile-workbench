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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class WorkbenchWidgets extends AppWidgetProvider {
    public static final class Plans extends WorkbenchWidgets { }
    public static final class Water extends WorkbenchWidgets { }
    public static final class Watch extends WorkbenchWidgets { }
    public static final class Assets extends WorkbenchWidgets { }
    public static final class Anniversaries extends WorkbenchWidgets { }
    static final String PREFS = "home-widgets";
    static final String NEXT_ANNIVERSARY = "cc.qiyeonline.workbench.NEXT_ANNIVERSARY";
    static final long ANNIVERSARY_INTERVAL = 1800000L;

    static String today() { return LocalDate.now(ZoneId.of("Asia/Shanghai")).toString(); }
    static JSONObject read(Context context) {
        try { return new JSONObject(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("snapshot", "{}")); }
        catch (Exception error) { return new JSONObject(); }
    }

    public static void sync(Context context, JSONObject source) throws Exception {
        JSONObject snapshot = new JSONObject();
        String date = source.getString("date"); LocalDate.parse(date);
        snapshot.put("date", date).put("tasks", safeLines(source.optJSONArray("tasks"), 3, 50));
        String owner = source.optString("owner", "personal-workbench");
        snapshot.put("owner", owner);
        JSONArray anniversaries = source.optJSONArray("anniversaryDetails"), safeAnniversaries = new JSONArray();
        if (anniversaries != null) for (int i = 0; i < Math.min(500, anniversaries.length()); i++) {
            JSONObject item = anniversaries.optJSONObject(i); if (item == null) continue;
            JSONArray dates = item.optJSONArray("dates"), safeDates = new JSONArray();
            if (dates != null) for (int j = 0; j < Math.min(3, dates.length()); j++) { String target = dates.getString(j); LocalDate.parse(target); safeDates.put(target); }
            String icon = item.optString("icon", "");
            if (!icon.matches("/assets-icons/thiings/[a-z0-9-]+/[a-z0-9-]+\\.webp")) icon = "/assets-icons/thiings/dates/heart.webp";
            JSONObject hints = item.optJSONObject("hints"), safeHints = new JSONObject();
            if (hints != null) for (String key : new String[] { "today", "tomorrow", "soon", "future", "past" }) safeHints.put(key, text(hints, key, 80));
            safeAnniversaries.put(new JSONObject().put("id", text(item, "id", 120)).put("title", text(item, "title", 80)).put("icon", icon).put("hints", safeHints).put("annual", item.optBoolean("annual", true)).put("calendarType", "lunar".equals(item.optString("calendarType")) ? "lunar" : "solar").put("dates", safeDates));
        }
        snapshot.put("anniversaryDetails", safeAnniversaries);
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
        android.content.SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        android.content.SharedPreferences.Editor edit = preferences.edit();
        if (!owner.equals(read(context).optString("owner", "personal-workbench"))) edit.clear();
        edit.putString("snapshot", snapshot.toString()).apply();
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
        for (Class<?> type : new Class<?>[] { Plans.class, Water.class, Watch.class, Assets.class, Anniversaries.class })
            for (int id : manager.getAppWidgetIds(new ComponentName(context, type))) render(context, manager, id, type);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { for (int id : ids) render(context, manager, id, getClass()); }
    @Override public void onReceive(Context context, Intent intent) {
        if (NEXT_ANNIVERSARY.equals(intent.getAction()) && getClass() == Anniversaries.class) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            for (int registered : manager.getAppWidgetIds(new ComponentName(context, Anniversaries.class))) if (registered == id) {
                android.content.SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                if (!preferences.getString("anniversary:" + id, "").isEmpty()) return;
                JSONArray queue = anniversaryQueue(read(context), today());
                if (queue.length() == 0) return;
                int index = anniversaryIndex(queue, preferences.getString("anniversary-current:" + id, ""), preferences.getLong("anniversary-switched:" + id, 0), System.currentTimeMillis(), true);
                preferences.edit().putString("anniversary-current:" + id, queue.optJSONObject(index).optString("id")).putLong("anniversary-switched:" + id, System.currentTimeMillis()).apply();
                render(context, manager, id, Anniversaries.class); return;
            }
            return;
        }
        super.onReceive(context, intent);
    }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) { render(context, manager, id, getClass()); }
    @Override public void onDeleted(Context context, int[] ids) {
        android.content.SharedPreferences.Editor edit = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        for (int id : ids) { edit.remove("asset:" + id); edit.remove("anniversary:" + id); edit.remove("anniversary-current:" + id); edit.remove("anniversary-switched:" + id); } edit.apply();
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
        int layout = type == Plans.class ? R.layout.widget_plans : type == Water.class ? R.layout.widget_water : type == Watch.class ? R.layout.widget_watch : type == Anniversaries.class ? R.layout.widget_anniversary : R.layout.widget_assets;
        int height = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 280);
        int width = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 140);
        float fontScale = context.getResources().getConfiguration().fontScale;
        if (type == Assets.class && (height < 250 * Math.min(fontScale, 1.25f) || width < 280)) layout = R.layout.widget_assets_compact;
        if (type == Water.class && (height < 185 * fontScale || width < 200 * fontScale)) layout = R.layout.widget_water_compact;
        if (type == Plans.class && (height < 185 * fontScale || width < 280)) layout = R.layout.widget_plans_compact;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        if (type == Plans.class) {
            int pending = fresh ? data.optInt("pendingCount") : 0, done = fresh ? data.optInt("completedCount") : 0;
            views.setTextViewText(R.id.widget_amount, fresh ? String.valueOf(pending) : "—");
            views.setTextViewText(R.id.widget_footer, fresh ? "已完成 " + done + " 项" : "打开 App 同步今日计划");
            views.setTextViewText(R.id.widget_date, date.substring(5).replace('-', '/'));
            JSONArray tasks = fresh ? data.optJSONArray("tasks") : null;
            boolean compact = layout == R.layout.widget_plans_compact;
            float available = height - (compact ? 44 : 60) - (compact ? 33 : 37) * fontScale;
            int visibleRows = Math.max(1, Math.min(3, (int)((available + (compact ? 4 : 5)) / ((compact ? 18 : 21) * fontScale + (compact ? 16 : 19)))));
            views.setProgressBar(R.id.widget_progress, Math.max(1, pending + done), done, false);
            views.setTextColor(R.id.widget_date, android.graphics.Color.rgb(214, 237, 225));
            views.setViewVisibility(R.id.widget_plan_footer, height < 160 && fontScale > 1.4f ? View.GONE : View.VISIBLE);
            views.setContentDescription(R.id.widget_root, fresh ? "今日待办 " + pending + " 项，已完成 " + done + " 项" : "打开 App 同步今日计划");
            int[] rows = { R.id.widget_task_1, R.id.widget_task_2, R.id.widget_task_3 };
            for (int i = 0; i < rows.length; i++) {
                views.setViewVisibility(rows[i], (i == 0 || tasks != null && i < tasks.length()) && i < visibleRows ? View.VISIBLE : View.GONE);
                views.setTextViewText(rows[i], tasks != null && i < tasks.length() ? tasks.optString(i) : fresh ? "今天暂无待办" : "点击查看今日计划");
            }
        } else if (type == Water.class) {
            int water = fresh ? data.optInt("waterMl") : 0, target = data.optInt("targetMl", 2000);
            int percent = Math.min(100, Math.round(water * 100f / target));
            views.setTextViewText(R.id.widget_amount, String.valueOf(water));
            views.setTextViewText(R.id.widget_goal, "/ " + target + " ml");
            views.setTextViewText(R.id.widget_percent, percent + "%");
            views.setTextViewText(R.id.widget_footer, water >= target ? "今日目标达成" : "还差 " + (target - water) + " ml");
            views.setProgressBar(R.id.widget_progress, target, Math.min(water, target), false);
            views.setImageViewBitmap(R.id.widget_icon, WidgetImages.waterGauge(water, target));
            views.setContentDescription(R.id.widget_icon, "已喝 " + water + " ml，目标 " + target + " ml，" + percent + "%");
            views.setContentDescription(R.id.widget_root, "喝水进度：已喝 " + water + " ml，目标 " + target + " ml，完成 " + percent + "%，" + (water >= target ? "今日目标达成" : "还差 " + (target - water) + " ml"));
        } else if (type == Watch.class) {
            JSONArray upcoming = upcoming(data, date);
            views.setTextViewText(R.id.widget_content, upcoming.length() == 0 ? fresh ? "暂无已知排期\n打开追剧日历添加或刷新" : "打开 App 同步最新排期" : "");
            views.setTextViewText(R.id.widget_footer, date.substring(5).replace('-', '/') + (fresh ? " · 未来两周排期" : " · 同步于 " + data.optString("date", "—")));
            Intent adapter = new Intent(context, WidgetWatchService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).setData(Uri.parse("qiye-widget://watch/" + id));
            views.setRemoteAdapter(R.id.widget_list, adapter); views.setEmptyView(R.id.widget_list, R.id.widget_content);
            views.setPendingIntentTemplate(R.id.widget_list, open(context, "consultations", 1000 + id, true));
            views.setOnClickPendingIntent(R.id.widget_heading, open(context, "consultations", 303, false));
        } else {
            if (type == Anniversaries.class) renderAnniversary(context, views, data, id, date);
            else renderAsset(context, views, data, id, date, width, height, fontScale);
        }
        String page = type == Plans.class ? "plans" : type == Water.class ? "diet" : type == Watch.class ? "consultations" : type == Anniversaries.class ? "anniversaries" : "assets";
        views.setOnClickPendingIntent(R.id.widget_root, open(context, page, type == Plans.class ? 301 : type == Water.class ? 302 : type == Watch.class ? 303 : type == Anniversaries.class ? 305 : 304, false));
        manager.updateAppWidget(id, views);
        if (type == Watch.class) manager.notifyAppWidgetViewDataChanged(id, R.id.widget_list);
    }

    static String anniversaryDate(JSONObject item, String today) {
        JSONArray dates = item.optJSONArray("dates"); String target = "";
        if (dates != null) for (int i = 0; i < dates.length(); i++) {
            String candidate = dates.optString(i);
            if (item.optBoolean("annual", true) && candidate.compareTo(today) < 0) continue;
            if (target.isEmpty() || candidate.compareTo(target) < 0) target = candidate;
        }
        return target;
    }

    static JSONArray anniversaryQueue(JSONObject data, String date) {
        ArrayList<JSONObject> queue = new ArrayList<>();
        JSONArray items = data.optJSONArray("anniversaryDetails");
        if (items != null) for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index); if (item == null) continue;
            String target = anniversaryDate(item, date);
            if (!target.isEmpty() && target.compareTo(date) >= 0) queue.add(item);
        }
        queue.sort(Comparator.comparing((JSONObject item) -> anniversaryDate(item, date)).thenComparing(item -> item.optString("id")));
        return new JSONArray(queue);
    }

    static int anniversaryIndex(JSONArray queue, String current, long changedAt, long now, boolean advance) {
        for (int index = 0; index < queue.length(); index++) if (current.equals(queue.optJSONObject(index).optString("id"))) {
            return advance || changedAt > 0 && now - changedAt >= ANNIVERSARY_INTERVAL ? (index + 1) % queue.length() : index;
        }
        return 0;
    }

    static String anniversaryHint(JSONObject item, long days) {
        JSONObject hints = item == null ? null : item.optJSONObject("hints");
        String key = days < 0 ? "past" : days == 0 ? "today" : days == 1 ? "tomorrow" : days <= 7 ? "soon" : "future";
        String hint = hints == null ? "" : hints.optString(key);
        return hint.isEmpty() ? days == 0 ? "就是今天，记得留下一份纪念。" : days == 1 ? "重要的日子就在明天，别忘了期待。" : "把值得期待的日子，放在心上。" : hint;
    }

    private static void renderAnniversary(Context context, RemoteViews views, JSONObject data, int id, String date) {
        android.content.SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String selection = preferences.getString("anniversary:" + id, "");
        JSONArray items = data.optJSONArray("anniversaryDetails"); JSONObject selected = null; String target = "";
        JSONArray queue = anniversaryQueue(data, date); int position = 0;
        if (selection.isEmpty() && queue.length() > 0) {
            String current = preferences.getString("anniversary-current:" + id, "");
            long changedAt = preferences.getLong("anniversary-switched:" + id, 0), now = System.currentTimeMillis();
            position = anniversaryIndex(queue, current, changedAt, now, false);
            selected = queue.optJSONObject(position);
            if (!current.equals(selected.optString("id")) || changedAt == 0 || changedAt > now) {
                preferences.edit().putString("anniversary-current:" + id, selected.optString("id")).putLong("anniversary-switched:" + id, now).apply();
            }
        } else if (items != null && !selection.isEmpty()) for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item != null && selection.equals(item.optString("id"))) { selected = item; break; }
        }
        if (selected != null) target = anniversaryDate(selected, date);
        boolean available = selected != null && !target.isEmpty();
        long days = available ? WidgetPolicy.remaining(target, date) : 0;
        views.setTextViewText(R.id.widget_position, selection.isEmpty() && queue.length() > 1 ? (position + 1) + " / " + queue.length() : "");
        int height = AppWidgetManager.getInstance(context).getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 140);
        float fontScale = context.getResources().getConfiguration().fontScale;
        if (height < 180) {
            int padding = Math.round(8 * context.getResources().getDisplayMetrics().density);
            views.setViewPadding(R.id.widget_root, padding, padding, padding, padding);
        }
        views.setTextViewTextSize(R.id.widget_heading, android.util.TypedValue.COMPLEX_UNIT_SP, Math.min(14, 20 / fontScale));
        views.setTextViewTextSize(R.id.widget_footer, android.util.TypedValue.COMPLEX_UNIT_SP, Math.min(11, 12 / fontScale));
        views.setTextViewTextSize(R.id.widget_position, android.util.TypedValue.COMPLEX_UNIT_SP, Math.min(11, 13 / fontScale));
        views.setTextViewText(R.id.widget_footer, available ? anniversaryHint(selected, days) : "打开 App，记录值得期待的日子。");
        int rowCount = Math.max(1, Math.min(5, (int) ((height - 90) / (50 * Math.min(fontScale, 1.4f)))));
        int[] rows = { R.id.widget_upcoming_row_1, R.id.widget_upcoming_row_2, R.id.widget_upcoming_row_3, R.id.widget_upcoming_row_4, R.id.widget_upcoming_row_5 };
        int[] icons = { R.id.widget_icon, R.id.widget_upcoming_icon_2, R.id.widget_upcoming_icon_3, R.id.widget_upcoming_icon_4, R.id.widget_upcoming_icon_5 };
        int[] titles = { R.id.widget_title, R.id.widget_upcoming_title_2, R.id.widget_upcoming_title_3, R.id.widget_upcoming_title_4, R.id.widget_upcoming_title_5 };
        int[] dates = { R.id.widget_date, R.id.widget_upcoming_date_2, R.id.widget_upcoming_date_3, R.id.widget_upcoming_date_4, R.id.widget_upcoming_date_5 };
        int[] amounts = { R.id.widget_amount, R.id.widget_upcoming_days_2, R.id.widget_upcoming_days_3, R.id.widget_upcoming_days_4, R.id.widget_upcoming_days_5 };
        for (int index = 0; index < rows.length; index++) {
            JSONObject item = index == 0 ? selected : selection.isEmpty() && index < queue.length() ? queue.optJSONObject((position + index) % queue.length()) : null;
            views.setViewVisibility(rows[index], index == 0 || index < rowCount && item != null ? View.VISIBLE : View.GONE);
            views.setTextViewTextSize(titles[index], android.util.TypedValue.COMPLEX_UNIT_SP, Math.min(14, 19 / fontScale));
            views.setTextViewTextSize(dates[index], android.util.TypedValue.COMPLEX_UNIT_SP, Math.min(10, 12 / fontScale));
            views.setTextViewTextSize(amounts[index], android.util.TypedValue.COMPLEX_UNIT_SP, Math.min(20, 28 / fontScale));
            if (item == null) {
                if (index == 0) {
                    views.setTextViewText(titles[index], "还没有临近日期");
                    views.setTextViewText(dates[index], selection.isEmpty() ? "打开 App 同步" : "记录已删除");
                    views.setTextViewText(amounts[index], "—");
                }
                continue;
            }
            String nextDate = anniversaryDate(item, date);
            long remaining = WidgetPolicy.remaining(nextDate, date);
            views.setTextViewText(titles[index], item.optString("title"));
            views.setTextViewText(dates[index], nextDate.replace('-', '/'));
            views.setTextViewText(amounts[index], remaining == 0 ? "今天" : remaining > 0 ? remaining + "天" : "已过" + Math.abs(remaining) + "天");
            if (Math.abs(remaining) > 9999) views.setTextViewTextSize(amounts[index], android.util.TypedValue.COMPLEX_UNIT_SP, Math.min(15, 20 / fontScale));
            android.graphics.Bitmap nextIcon = WidgetImages.icon(context, item.optString("icon", "/assets-icons/thiings/dates/heart.webp"));
            if (nextIcon != null) views.setImageViewBitmap(icons[index], nextIcon);
            views.setContentDescription(rows[index], item.optString("title") + (remaining == 0 ? "，就是今天" : remaining > 0 ? "，还有" + remaining + "天" : "，已过" + Math.abs(remaining) + "天"));
        }
        views.setContentDescription(R.id.widget_root, available ? selected.optString("title") + (days == 0 ? "，就是今天" : days > 0 ? "，还有" + days + "天" : "，已过" + Math.abs(days) + "天") : "纪念日倒数，暂无可展示日期");
        Intent configure = new Intent(context, WidgetAnniversaryConfigActivity.class).setAction(AppWidgetManager.ACTION_APPWIDGET_CONFIGURE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        views.setOnClickPendingIntent(R.id.widget_settings, PendingIntent.getActivity(context, 3000 + id, configure, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        boolean rotating = selection.isEmpty() && queue.length() > 1;
        views.setViewVisibility(R.id.widget_next, rotating ? View.VISIBLE : View.GONE);
        views.setContentDescription(R.id.widget_next, "下一个纪念日，当前第" + (position + 1) + "个，共" + queue.length() + "个");
        Intent next = new Intent(context, Anniversaries.class).setAction(NEXT_ANNIVERSARY).setData(Uri.parse("qiye-widget://anniversaries/" + id)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        views.setOnClickPendingIntent(R.id.widget_next, PendingIntent.getBroadcast(context, id, next, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }

    private static void renderAsset(Context context, RemoteViews views, JSONObject data, int id, String date, int width, int height, float fontScale) {
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
        String companionship = summary ? missing ? "打开 App 同步资产" : data.optInt("assetCount") + " 件物品正在陪伴你" : missing ? selection.isEmpty() ? "打开 App 同步资产" : "该物品已删除或不再服役" : days > 0 ? "陪伴了你 " + days + " 天" : days == 0 ? "还未到购买日期" : "补充购买日期后查看成本";
        views.setTextViewText(R.id.widget_days, companionship);
        views.setTextViewText(R.id.widget_daily, summary ? "—" : days > 0 ? currency(WidgetPolicy.daily(price, days)) : "—");
        views.setTextViewText(R.id.widget_amount, missing ? "—" : currency(price));
        views.setTextViewText(R.id.widget_drop, summary ? "—" : days > 0 ? currency(WidgetPolicy.drop(price, days)) : "—");
        views.setViewVisibility(R.id.widget_cost_row, summary ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_drop_column, summary ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_footer, summary ? lines(data.optJSONArray("recentAssets")) : "总金额");
        boolean tight = height < 185, largeText = fontScale > 1.25f;
        views.setTextColor(R.id.widget_date, android.graphics.Color.rgb(217, 231, 245));
        views.setViewVisibility(R.id.widget_asset_footer, height < 200 && fontScale > 1.25f ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_date, largeText ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_days, tight && !largeText ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_cost_label, width < 300 && fontScale > 1.25f ? View.GONE : View.VISIBLE);
        if (tight && !largeText) views.setTextViewText(R.id.widget_date, companionship);
        views.setContentDescription(R.id.widget_root, (summary ? "资产总览" : selected == null ? "资产记录" : selected.optString("name")) + "，" + companionship + "，购入金额" + currency(price) + (summary ? "" : "，日均成本" + (days > 0 ? currency(WidgetPolicy.daily(price, days)) : "未计算")));
        android.graphics.Bitmap icon = WidgetImages.icon(context, selected == null ? "/assets-icons/thiings/home/box.webp" : selected.optString("icon"));
        if (icon != null) views.setImageViewBitmap(R.id.widget_icon, icon);
        Intent configure = new Intent(context, WidgetAssetConfigActivity.class).setAction(AppWidgetManager.ACTION_APPWIDGET_CONFIGURE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        views.setOnClickPendingIntent(R.id.widget_settings, PendingIntent.getActivity(context, 2000 + id, configure, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }
}
