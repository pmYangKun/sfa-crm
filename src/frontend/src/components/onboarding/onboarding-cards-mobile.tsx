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

  return (
    <>
      <div
        data-testid="onboarding-cards-mobile"
        style={{ padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ fontSize: 12, color: '#8c8c8c', padding: '0 4px 4px' }}>
          点击试试这些 demo 问题：
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
