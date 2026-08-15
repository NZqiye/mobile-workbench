import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";

export const metadata = {
  title: "七夜online",
  description: "移动优先的个人生活与行情工作台",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "七夜online",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f1c1a",
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
