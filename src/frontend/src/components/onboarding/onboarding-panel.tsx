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
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #f0f7ff 0%, #f9f0ff 100%)',
          border: '1px solid #d6e4ff',
          borderRadius: 12,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#262626' }}>
            👋 你好，{me?.displayName ?? currentLoginName}！试试下面的演示问题
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#595959' }}>
            点击任一卡片 → 问题自动发送到右下角 Chat 并执行
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
