import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";

export const metadata = {
  title: "涓冨online",
  description: "绉诲姩浼樺厛鐨勪釜浜虹敓娲讳笌琛屾儏宸ヤ綔鍙?",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "涓冨online",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d13a45",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
