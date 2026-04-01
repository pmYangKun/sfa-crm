import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { Sidebar } from "@/components/nav/sidebar";
import ChatSidebar from "@/components/chat/chat-sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SFA CRM",
  description: "AI-Native SFA CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <AuthProvider>
          <div className="app-shell">
            <Sidebar />
            <main className="main-content">{children}</main>
            <ChatSidebar />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
