'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Notification } from '@/types';

export default function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = async () => {
    try {
      const data = await api.get<{ count: number }>('/notifications/unread-count');
      setCount(data.count);
    } catch { /* ignore */ }
  };

  const fetchNotifications = async () => {
    try {
      const data = await api.get<Notification[]>('/notifications');
      setNotifications(data);
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!user) return;
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 20, position: 'relative', padding: '4px 8px',
        }}
        title="通知"
      >
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#ff4d4f', color: '#fff',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600,
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 1000,
          width: 360, maxHeight: 400, background: '#fff',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600 }}>通知</span>
            {count > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', color: '#1890ff',
                cursor: 'pointer', fontSize: 13,
              }}>
                全部已读
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', color: '#999' }}>暂无通知</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    padding: '10px 16px', borderBottom: '1px solid #f5f5f5',
                    background: n.is_read ? '#fff' : '#e6f7ff',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>{n.content}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
