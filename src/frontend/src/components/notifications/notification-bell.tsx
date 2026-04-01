"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

const POLL_INTERVAL = 30_000; // 30 seconds

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  async function fetchNotifications() {
    try {
      const data = await api.get<NotificationRecord[]>("/notifications?limit=20");
      setNotifications(data);
    } catch {
      // Silently ignore — user might not be logged in yet
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}`, { is_read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    try {
      await api.post("/notifications/mark-all-read", {});
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  }

  return (
    <div className="bell-wrap" ref={panelRef}>
      <button className="bell-btn" onClick={() => setOpen(!open)}>
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="panel-header">
            <span>通知</span>
            {unreadCount > 0 && (
              <button className="mark-all" onClick={markAllRead}>全部已读</button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 && (
              <p className="empty">暂无通知</p>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`notif-item ${n.is_read ? "read" : "unread"}`}
                onClick={() => !n.is_read && markRead(n.id)}
              >
                <div className="notif-title">{n.title}</div>
                {n.body && <div className="notif-body">{n.body}</div>}
                <div className="notif-time">{n.created_at.slice(0, 16).replace("T", " ")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .bell-wrap { position: relative; display: inline-block; }
        .bell-btn {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          position: relative;
          padding: 4px 8px;
          line-height: 1;
        }
        .badge {
          position: absolute;
          top: 0;
          right: 0;
          background: #e53e3e;
          color: #fff;
          font-size: 10px;
          border-radius: 10px;
          padding: 1px 4px;
          min-width: 16px;
          text-align: center;
          line-height: 14px;
        }
        .notif-panel {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 320px;
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          z-index: 500;
          overflow: hidden;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid var(--color-border);
          font-size: 13px;
          font-weight: 600;
        }
        .mark-all {
          background: none;
          border: none;
          color: var(--color-primary);
          font-size: 12px;
          cursor: pointer;
        }
        .notif-list { max-height: 360px; overflow-y: auto; }
        .notif-item {
          padding: 10px 14px;
          border-bottom: 1px solid var(--color-border);
          cursor: pointer;
        }
        .notif-item:hover { background: #fafafa; }
        .notif-item.unread { background: #f0f7ff; }
        .notif-title { font-size: 13px; font-weight: 500; margin-bottom: 2px; }
        .notif-body { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px; }
        .notif-time { font-size: 11px; color: #aaa; }
        .empty { padding: 20px; text-align: center; color: var(--color-text-secondary); font-size: 13px; }
      `}</style>
    </div>
  );
}
