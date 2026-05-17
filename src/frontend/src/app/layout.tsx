import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'SFA CRM',
  description: 'AI-Native SFA CRM System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baiduId = process.env.NEXT_PUBLIC_BAIDU_ID;
  return (
    <html lang="zh-CN">
      <body>
        {children}
        {baiduId && (
          <Script id="baidu-tongji" strategy="afterInteractive">
            {`var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?${baiduId}";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`}
          </Script>
        )}
      </body>
    </html>
  );
}
