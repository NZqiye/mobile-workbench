package cc.qiyeonline.workbench;

import java.net.URI;

final class BundledAssetPolicy {
    static String path(String url) {
        try {
            URI uri = new URI(url);
            String path = uri.getRawPath();
            if (!"https".equals(uri.getScheme()) || !"qiyeonline.cc.cd".equals(uri.getHost()) || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) return null;
            if (path == null || !path.matches("/[a-zA-Z0-9_./-]+") || path.contains("..") || path.contains("//")) return null;
            return path;
        } catch (Exception error) { return null; }
    }

    static String version(String url) {
        try {
            String query = new URI(url).getRawQuery();
            if (query == null) return null;
            String found = null;
            for (String part : query.split("&")) {
                if (!part.startsWith("bundle=")) continue;
                if (found != null) return null;
                found = part.substring(7);
            }
            return found != null && found.matches("[a-f0-9]{64}") ? found : null;
        } catch (Exception error) { return null; }
    }

    static long[] range(String header, long length) {
        if (header == null) return new long[] { 0, length - 1 };
        if (!header.matches("bytes=([0-9]+-[0-9]*|-[0-9]+)")) return null;
        try {
            String[] parts = header.substring(6).split("-", -1);
            long start, end;
            if (parts[0].isEmpty()) {
                long suffix = Long.parseLong(parts[1]);
                if (suffix == 0) return null;
                start = Math.max(0, length - suffix);
                end = length - 1;
            } else {
                start = Long.parseLong(parts[0]);
                end = parts[1].isEmpty() ? length - 1 : Math.min(Long.parseLong(parts[1]), length - 1);
            }
            return start < length && start <= end ? new long[] { start, end } : null;
        } catch (NumberFormatException error) { return null; }
    }
}
