package cc.qiyeonline.workbench;

import java.net.URI;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;

final class WidgetPolicy {
    static String posterUrl(String value) {
        try {
            URI url = new URI(value);
            if (!"https".equals(url.getScheme()) || url.getUserInfo() != null || url.getPort() != -1 || value.length() > 768) return "";
            if (!Arrays.asList("image.tmdb.org", "lain.bgm.tv", "images.bgm.tv", "static.tvmaze.com", "cdn.myanimelist.net").contains(url.getHost())) return "";
            return value;
        } catch (Exception error) { return ""; }
    }

    static long days(String purchase, String today) {
        try { return Math.max(0, ChronoUnit.DAYS.between(LocalDate.parse(purchase), LocalDate.parse(today)) + 1); }
        catch (Exception error) { return -1; }
    }

    static long remaining(String date, String today) {
        try { return ChronoUnit.DAYS.between(LocalDate.parse(today), LocalDate.parse(date)); }
        catch (Exception error) { return -1; }
    }

    static double daily(double price, long days) { return days > 0 ? Math.max(0, price) / days : 0; }
    static double drop(double price, long days) { return days > 0 ? daily(price, days) - daily(price, days + 1) : 0; }
}
