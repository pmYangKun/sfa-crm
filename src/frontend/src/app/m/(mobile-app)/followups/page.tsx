'use client';

import { useRouter } from 'next/navigation';

/**
 * 移动端"跟进"tab — 占位入口，跟进 detail 录入走 chat 内嵌卡片范式（US3）。
 */
export default function MobileFollowupsPage() {
  const router = useRouter();
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>跟进</h1>
      <div
        data-testid="mobile-followups-cta"
        style={{
          padding: 16,
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          textAlign: 'center',
          color: '#595959',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.6 }}>
          移动端跟进录入推荐用 AI 对话方式：
          <br />
          说一句话，AI 自动帮你录入。
        </p>
        <button
          type="button"
          onClick={() => router.push('/m/chat')}
          style={{
            padding: '10px 20px',
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          去 AI 对话录入跟进 →
        </button>
      </div>
    </div>
  );
}
