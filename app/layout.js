import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";

export const metadata = {
  title: "七夜的工作台",
  description: "移动优先的个人生活与行情工作台",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "七夜工作台",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
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