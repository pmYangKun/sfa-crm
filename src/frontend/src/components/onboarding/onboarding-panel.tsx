'use client';

import { useState } from 'react';
import {
  OnboardingCard as OnboardingCardData,
  getOnboardingCardsForRole,
  getRoleCardByLogin,
} from '@/lib/onboarding-config';
import { useAuth } from '@/lib/auth-context';
import RoleSwitchConfirm from './role-switch-confirm';

/** OnboardingPanel 写入 sessionStorage 后通知 chat 自动打开并消费 */
export const PENDING_PROMPT_EVENT = 'onboarding:pending-prompt';
export const PENDING_PROMPT_KEY = 'pending_prompt';

export default function OnboardingPanel({ currentLoginName }: { currentLoginName: string }) {
  const { quickSwitchRole } = useAuth();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  const cards = getOnboardingCardsForRole(currentLoginName, 'pc');
  const me = getRoleCardByLogin(currentLoginName);

  if (cards.length === 0) return null;

  const handleCardClick = (card: OnboardingCardData) => {
    if (card.type === 'demo' && card.fullPrompt) {
      sessionStorage.setItem(PENDING_PROMPT_KEY, card.fullPrompt);
      window.dispatchEvent(new CustomEvent(PENDING_PROMPT_EVENT, { detail: card.fullPrompt }));
    } else if (card.type === 'switch-role' && card.switchTo) {
      setConfirmTarget(card.switchTo);
    }
  };

  const handleConfirmSwitch = async () => {
    if (!confirmTarget) return;
    const target = getRoleCardByLogin(confirmTarget);
    if (!target) return;
    await quickSwitchRole(target.loginName, target.password);
    setConfirmTarget(null);
  };

  return (
    <>
      <section
        data-testid="onboarding-panel"
        style={{
          marginBottom: 32,
          padding: '24px 28px',
          background: 'linear-gradient(135deg, #fff8e7 0%, #fff1d4 100%)',
          border: '1px solid #ffe7a3',
          borderLeft: '4px solid #fa8c16',
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(250,140,22,0.12)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: 24,
            background: '#fa8c16',
            color: '#fff',
            padding: '3px 12px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
            boxShadow: '0 2px 6px rgba(250,140,22,0.3)',
          }}
        >
          🚀 AI COPILOT 演示
        </div>
        <div style={{ marginBottom: 18, marginTop: 4 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#262626' }}>
            👋 你好，{me?.displayName ?? currentLoginName}！
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#595959', lineHeight: 1.6 }}>
            点击下面的卡片，<strong style={{ color: '#262626' }}>会把示例提问自动带入到右侧 AI 助手</strong>，
            一键体验对话式 CRM —— AI 帮你查线索、录跟进、做决策。
          </p>
          <p
            data-testid="onboarding-chat-hint"
            style={{
              margin: '12px 0 0',
              fontSize: 13,
              color: '#7c2d12',
              background: '#fff7ed',
              border: '1px dashed #fb923c',
              borderRadius: 6,
              padding: '8px 12px',
              lineHeight: 1.5,
            }}
          >
            👉 不知道从哪开始？直接点卡片，看 AI 在<strong>右侧对话框</strong>实时给你跑结果。
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {cards.map((card) => (
            <OnboardingCardItem key={card.id} card={card} onClick={() => handleCardClick(card)} />
          ))}
        </div>
      </section>
      <RoleSwitchConfirm
        open={confirmTarget !== null}
        fromLogin={currentLoginName}
        toLogin={confirmTarget ?? ''}
        onConfirm={handleConfirmSwitch}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

function OnboardingCardItem({ card, onClick }: { card: OnboardingCardData; onClick: () => void }) {
  const isDemo = card.type === 'demo';
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`onboarding-card-${card.id}`}
      style={{
        textAlign: 'left',
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        padding: 14,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'inherit',
        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
        // <button> UA 默认居中内容，没 fullPrompt 段的卡片标题会浮到中央。
        // 改成 flex column + flex-start，标题永远顶对齐。
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.borderColor = '#1890ff';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(24,144,255,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.borderColor = '#e8e8e8';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#262626' }}>
        {card.shortTitle}
      </div>
      {isDemo && card.fullPrompt && (
        <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.6, marginBottom: 8, background: '#fafafa', padding: 8, borderRadius: 4 }}>
          &quot;{card.fullPrompt}&quot;
        </div>
      )}
      <div style={{ fontSize: 12, color: '#1890ff', fontWeight: 500 }}>
        {isDemo ? '试试看 →' : '切换 →'}
      </div>
    </button>
  );
}
