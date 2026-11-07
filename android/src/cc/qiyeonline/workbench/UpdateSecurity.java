package cc.qiyeonline.workbench;

import java.io.File;
import java.io.FileInputStream;
import java.net.URI;
import java.security.MessageDigest;

final class UpdateSecurity {
    static boolean validRelease(String version, int code, String url, String hash) {
        return code > 0 && version.matches("[0-9]+\\.[0-9]+\\.[0-9]+") && hash.matches("[0-9a-f]{64}")
            && url.equals("https://github.com/NZqiye/mobile-workbench/releases/download/android-v" + version + "/qiyeonline-" + version + ".apk");
    }

    static boolean trustedDownload(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            return "https".equals(uri.getScheme()) && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
                && ("github.com".equals(host) || "release-assets.githubusercontent.com".equals(host) || "objects.githubusercontent.com".equals(host));
        } catch (IllegalArgumentException error) { return false; }
    }

    static boolean matchesHash(File file, String expected) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream stream = new FileInputStream(file)) {
            byte[] buffer = new byte[16384];
            int count;
            while ((count = stream.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder value = new StringBuilder();
        for (byte part : digest.digest()) value.append(String.format(java.util.Locale.ROOT, "%02x", part & 255));
        return value.toString().equals(expected);
    }
}
