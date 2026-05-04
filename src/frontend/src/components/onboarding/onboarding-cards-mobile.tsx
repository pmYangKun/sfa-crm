'use client';

import { useState } from 'react';
import {
  OnboardingCard as OnboardingCardData,
  getOnboardingCardsForRole,
  getRoleCardByLogin,
} from '@/lib/onboarding-config';
import { useAuth } from '@/lib/auth-context';
import RoleSwitchConfirm from './role-switch-confirm';
import { PENDING_PROMPT_EVENT, PENDING_PROMPT_KEY } from './onboarding-panel';

interface OnboardingCardsMobileProps {
  currentLoginName: string;
  /** 是否折叠（chat 已有消息时折叠隐藏） */
  collapsed?: boolean;
}

export default function OnboardingCardsMobile({ currentLoginName, collapsed }: OnboardingCardsMobileProps) {
  const { quickSwitchRole } = useAuth();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  if (collapsed) return null;

  const cards = getOnboardingCardsForRole(currentLoginName, 'mobile');
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

  const me = getRoleCardByLogin(currentLoginName);

  return (
    <>
      <div
        data-testid="onboarding-cards-mobile"
        style={{ padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #fff8e7 0%, #fff1d4 100%)',
            border: '1px solid #ffe7a3',
            borderLeft: '4px solid #fa8c16',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 4,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -8,
              left: 12,
              background: '#fa8c16',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            🚀 AI COPILOT 演示
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#262626', marginTop: 4 }}>
            👋 你好，{me?.displayName ?? currentLoginName}！
          </div>
          <div style={{ fontSize: 13, color: '#595959', lineHeight: 1.6, marginTop: 4 }}>
            点下面的卡片，体验<strong style={{ color: '#262626' }}>对话式 CRM</strong>——
            AI 一句话帮你查线索、录跟进、做决策。
          </div>
        </div>
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => handleCardClick(card)}
            data-testid={`onboarding-card-mobile-${card.id}`}
            style={{
              textAlign: 'left',
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              padding: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'inherit',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#262626', marginBottom: 6 }}>
              {card.shortTitle}
            </div>
            {card.type === 'demo' && card.fullPrompt && (
              <div style={{ fontSize: 13, color: '#595959', lineHeight: 1.6, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                &quot;{card.fullPrompt}&quot;
              </div>
            )}
          </button>
        ))}
      </div>
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
