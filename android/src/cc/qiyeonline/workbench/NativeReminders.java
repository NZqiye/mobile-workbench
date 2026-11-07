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
    private static final String CHANNEL = "task-reminders";
    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences("native-reminders", Context.MODE_PRIVATE); }
    private static NotificationManager manager(Context context) { return context.getSystemService(NotificationManager.class); }
    private static void channel(Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "任务提醒", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("已同步到本机且设置提醒时间的未完成任务");
        channel.enableVibration(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager(context).createNotificationChannel(channel);
    }
    static boolean permitted(Context context) {
        channel(context);
        return (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            && manager(context).areNotificationsEnabled() && manager(context).getNotificationChannel(CHANNEL).getImportance() != NotificationManager.IMPORTANCE_NONE;
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
    static synchronized void sync(Context context, JSONArray input) throws Exception {
        if (input.length() > 5000) throw new Exception("提醒数量过多");
        JSONArray clean = new JSONArray();
        JSONObject previous = new JSONObject(prefs(context).getString("delivered", "{}"));
        JSONObject delivered = new JSONObject();
        java.util.HashSet<String> ids = new java.util.HashSet<>();
        java.util.HashMap<String, Long> times = new java.util.HashMap<>();
        for (int i = 0; i < input.length(); i++) {
            JSONObject item = input.getJSONObject(i);
            String id = item.getString("id"), title = item.getString("title");
            long at = item.getLong("at");
            if (id.isEmpty() || id.length() > 200 || title.isEmpty() || title.length() > 500 || at <= 0 || at > 32503680000000L || !ids.add(id)) throw new Exception("提醒数据不正确");
            clean.put(new JSONObject().put("id", id).put("title", title).put("at", at));
            times.put(id, at);
            if (previous.optLong(id) == at) delivered.put(id, at);
        }
        JSONArray older = tasks(context);
        for (int i = 0; i < older.length(); i++) {
            JSONObject old = older.getJSONObject(i);
            Long time = times.get(old.getString("id"));
            boolean unchanged = time != null && time == old.getLong("at");
            if (!unchanged) manager(context).cancel(old.getString("id"), 1);
        }
        prefs(context).edit().putString("tasks", clean.toString()).putString("delivered", delivered.toString()).commit();
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
                String id = task.getString("id"); long at = task.getLong("at");
                if (!ReminderPolicy.pending(at, delivered.optLong(id), now)) continue;
                if (ReminderPolicy.due(at, delivered.optLong(id), now)) {
                    notify(context, id, "任务到时间了", task.getString("title"));
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
    private static void notify(Context context, String tag, String title, String body) {
        Intent intent = new Intent(context, MainActivity.class).putExtra("openTasks", true).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(context, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int icon = context.getResources().getIdentifier("notification_icon", "drawable", context.getPackageName());
        Notification notification = new Notification.Builder(context, CHANNEL).setSmallIcon(icon).setColor(Color.rgb(4, 117, 111))
            .setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(open)
            .setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE).build();
        manager(context).notify(tag, 1, notification);
    }
    static void test(Context context) { if (permitted(context)) notify(context, "test-reminder", "七夜online 测试通知", "App 通知已连通，点击返回任务安排。"); }
    static JSONObject state(Context context) throws Exception {
        int pending = 0; long now = System.currentTimeMillis();
        JSONObject delivered = new JSONObject(prefs(context).getString("delivered", "{}"));
        JSONArray tasks = tasks(context);
        for (int i = 0; i < tasks.length(); i++) { JSONObject task = tasks.getJSONObject(i); if (ReminderPolicy.pending(task.getLong("at"), delivered.optLong(task.getString("id")), now)) pending++; }
        return new JSONObject().put("enabled", enabled(context)).put("permitted", permitted(context)).put("exact", exact(context)).put("pending", pending).put("error", prefs(context).getString("error", ""));
    }
}
