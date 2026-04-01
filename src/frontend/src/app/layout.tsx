import type { Metadata } from 'next';
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
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
