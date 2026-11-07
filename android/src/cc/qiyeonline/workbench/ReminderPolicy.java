package cc.qiyeonline.workbench;

final class ReminderPolicy {
    static boolean pending(long at, long delivered, long now) {
        return at > 0 && delivered != at && at >= now - 86400000L;
    }
    static boolean due(long at, long delivered, long now) { return pending(at, delivered, now) && at <= now; }
}
