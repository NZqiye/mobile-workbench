package cc.qiyeonline.workbench;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

final class NativeReminders {
    private static final String[] KINDS = { "tasks", "watch", "anniversaries", "subscriptions" };
    private static final String[] TITLES = { "任务到时间了", "追剧更新", "纪念日提醒", "订阅与话费提醒" };
    private static int index(String kind) { for (int i = 0; i < KINDS.length; i++) if (KINDS[i].equals(kind)) return i; return 0; }
    private static String channelId(String kind) { return "tasks".equals(kind) ? "task-reminders" : kind + "-reminders"; }
    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences("native-reminders", Context.MODE_PRIVATE); }
    private static NotificationManager manager(Context context) { return context.getSystemService(NotificationManager.class); }
    private static void channel(Context context) {
        for (int i = 0; i < KINDS.length; i++) {
            NotificationChannel channel = new NotificationChannel(channelId(KINDS[i]), TITLES[i], NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("已同步到本机的" + TITLES[i]);
            channel.enableVibration(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            manager(context).createNotificationChannel(channel);
        }
    }
    static boolean permitted(Context context) {
        channel(context);
        return (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            && manager(context).areNotificationsEnabled();
    }
    private static boolean allowed(Context context, String kind) {
        NotificationChannel channel = manager(context).getNotificationChannel(channelId(kind));
        return channel != null && channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
    static void configure(Context context, JSONObject settings) {
        SharedPreferences.Editor edit = prefs(context).edit();
        for (String kind : KINDS) edit.remove("category:" + kind);
        edit.apply(); refresh(context);
    }
    static boolean exact(Context context) { return Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager.class).canScheduleExactAlarms(); }
    static boolean enabled(Context context) { return prefs(context).getBoolean("enabled", false); }
    static void enable(Context context, boolean value) {
        prefs(context).edit().putBoolean("enabled", value).apply();
        if (!value) manager(context).cancelAll();
        refresh(context);
    }
    private static JSONArray tasks(Context context) {
        try { return new JSONArray(prefs(context).getString("tasks", "[]")); }
        catch (Exception error) { return new JSONArray(); }
    }
    static synchronized void sync(Context context, JSONArray input, String owner) throws Exception {
        if (input.length() > 5000) throw new Exception("提醒数量过多");
        boolean changedAccount = !owner.equals(prefs(context).getString("owner", "personal-workbench"));
        JSONArray clean = new JSONArray();
        JSONObject previous = new JSONObject(changedAccount ? "{}" : prefs(context).getString("delivered", "{}"));
        JSONObject delivered = new JSONObject();
        java.util.HashSet<String> ids = new java.util.HashSet<>();
        java.util.HashMap<String, Long> times = new java.util.HashMap<>();
        for (int i = 0; i < input.length(); i++) {
            JSONObject item = input.getJSONObject(i);
            String id = item.getString("id"), title = item.getString("title");
            long at = item.getLong("at");
            if (id.isEmpty() || id.length() > 200 || title.isEmpty() || title.length() > 500 || at <= 0 || at > 32503680000000L || !ids.add(id)) throw new Exception("提醒数据不正确");
            String kind = item.optString("kind", "tasks");
            if (!KINDS[index(kind)].equals(kind)) throw new Exception("提醒类型不正确");
            clean.put(new JSONObject().put("id", id).put("title", title).put("at", at).put("kind", kind));
            times.put(id, at);
            if (previous.optLong(id) == at) delivered.put(id, at);
        }
        if (changedAccount) manager(context).cancelAll();
        JSONArray older = tasks(context);
        for (int i = 0; i < older.length(); i++) {
            JSONObject old = older.getJSONObject(i);
            Long time = times.get(old.getString("id"));
            boolean unchanged = time != null && time == old.getLong("at");
            if (!unchanged) manager(context).cancel(old.getString("id"), 1);
        }
        prefs(context).edit().putString("owner", owner).putLong("lastSynced", System.currentTimeMillis()).putString("tasks", clean.toString()).putString("delivered", delivered.toString()).commit();
        refresh(context);
    }
    private static PendingIntent alarm(Context context) {
        Intent intent = new Intent(context, ReminderReceiver.class).setAction("cc.qiyeonline.workbench.REMIND");
        return PendingIntent.getBroadcast(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static synchronized void refresh(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent alarm = alarm(context);
        alarms.cancel(alarm);
        if (!enabled(context) || !permitted(context)) return;
        try {
            prefs(context).edit().remove("error").apply();
            long now = System.currentTimeMillis(), next = Long.MAX_VALUE;
            JSONArray tasks = tasks(context);
            JSONObject delivered = new JSONObject(prefs(context).getString("delivered", "{}"));
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.getJSONObject(i);
                String kind = task.optString("kind", "tasks");
                if (!allowed(context, kind)) continue;
                String id = task.getString("id"); long at = task.getLong("at");
                if (!ReminderPolicy.pending(at, delivered.optLong(id), now)) continue;
                if (ReminderPolicy.due(at, delivered.optLong(id), now)) {
                    notify(context, id, kind, TITLES[index(kind)], task.getString("title"));
                    delivered.put(id, at);
                    prefs(context).edit().putString("delivered", delivered.toString()).commit();
                } else next = Math.min(next, at);
            }
            prefs(context).edit().putString("delivered", delivered.toString()).commit();
            if (next != Long.MAX_VALUE) {
                if (exact(context)) {
                    try { alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarm); }
                    catch (SecurityException error) { alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarm); }
                } else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarm);
            }
        } catch (Exception error) { prefs(context).edit().putString("error", "系统提醒安排失败，请重新打开 App 或检查通知设置。").apply(); }
    }
    private static void notify(Context context, String tag, String kind, String title, String body) {
        String page = "watch".equals(kind) ? "consultations" : "tasks".equals(kind) ? "plans" : kind;
        Intent intent = new Intent(context, MainActivity.class).setAction("cc.qiyeonline.workbench.NOTIFICATION_" + page).putExtra("widgetPage", page).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(context, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int icon = context.getResources().getIdentifier("notification_icon", "drawable", context.getPackageName());
        Notification notification = new Notification.Builder(context, channelId(kind)).setSmallIcon(icon).setColor(Color.rgb(4, 117, 111))
            .setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(open)
            .setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE).build();
        manager(context).notify(tag, 1, notification);
    }
    static void test(Context context) throws Exception {
        if (permitted(context)) for (String kind : KINDS) if (allowed(context, kind)) { notify(context, "test-reminder", kind, "七夜online 测试通知", "App 通知已连通，四类提醒会按各自设置的时间发送。"); return; }
        throw new Exception("请在系统通知设置中允许至少一类提醒");
    }
    static JSONObject state(Context context) throws Exception {
        boolean permitted = permitted(context);
        int pending = 0; long now = System.currentTimeMillis(), next = Long.MAX_VALUE;
        JSONObject categories = new JSONObject(), counts = new JSONObject(), channels = new JSONObject();
        for (String kind : KINDS) { categories.put(kind, true); counts.put(kind, 0); channels.put(kind, manager(context).getNotificationChannel(channelId(kind)).getImportance() != NotificationManager.IMPORTANCE_NONE); }
        JSONObject delivered = new JSONObject(prefs(context).getString("delivered", "{}"));
        JSONArray tasks = tasks(context);
        for (int i = 0; i < tasks.length(); i++) {
            JSONObject task = tasks.getJSONObject(i); String kind = task.optString("kind", "tasks");
            if (allowed(context, kind) && ReminderPolicy.pending(task.getLong("at"), delivered.optLong(task.getString("id")), now)) { pending++; counts.put(kind, counts.optInt(kind) + 1); next = Math.min(next, task.getLong("at")); }
        }
        return new JSONObject().put("enabled", enabled(context)).put("permitted", permitted).put("exact", exact(context)).put("pending", pending).put("categories", categories).put("counts", counts).put("channels", channels).put("nextAt", next == Long.MAX_VALUE ? 0 : next).put("lastSynced", prefs(context).getLong("lastSynced", 0)).put("error", prefs(context).getString("error", ""));
    }
}
