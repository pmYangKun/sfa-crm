'use client';

// MEDDICC Panel — 仪表盘 + 场景卡 + 对话记录（spec 003 US1+US2 合并组件）
// 一个组件聚合 spec 003 全部 lead 详情页核心 UI，便于在 page.tsx 一处挂载

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  ConversationItem,
  DashboardData,
  Dimension,
  DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_SHORT,
  ScenarioCardItem,
} from '@/lib/meddicc-types';
import { getNextBestAction } from '@/lib/meddicc-nba-templates';

interface Props {
  leadId: string;
  // 用于 Mobile 简版：true 表示隐藏场景卡 + 隐藏新增对话按钮 + 单维度只读
  readOnly?: boolean;
}

export default function MeddiccPanel({ leadId, readOnly = false }: Props) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [scenarioCards, setScenarioCards] = useState<ScenarioCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [applyingCardId, setApplyingCardId] = useState<string | null>(null);
  const [showAddConv, setShowAddConv] = useState(false);
  const [newConvContent, setNewConvContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedDim, setExpandedDim] = useState<Dimension | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // 数字补间动画用
  const [displayedScore, setDisplayedScore] = useState<number>(0);
  const animatingScoreRef = useRef<number | null>(null);
  // 圆点逐个亮起动画用
  const [animatedLitMap, setAnimatedLitMap] = useState<Record<string, boolean>>({});

  const loadAll = useCallback(async () => {
    try {
      const [dash, convs, cards] = await Promise.all([
        api.get<DashboardData>(`/leads/${leadId}/meddicc`),
        api.get<{ conversations: ConversationItem[] }>(`/leads/${leadId}/conversations`),
        api.get<{ cards: ScenarioCardItem[] }>(`/leads/${leadId}/scenario-cards`),
      ]);
      setDashboard(dash);
      setConversations(convs.conversations || []);
      setScenarioCards(cards.cards || []);
    } catch (e) {
      console.error('MeddiccPanel loadAll failed', e);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Score 数字补间
  useEffect(() => {
    const target = dashboard?.meddicc_score ?? 0;
    if (animatingScoreRef.current === target) return;
    animatingScoreRef.current = target;
    const start = displayedScore;
    const startedAt = performance.now();
    const duration = 800;
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const next = Math.round(start + (target - start) * progress);
      setDisplayedScore(next);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard?.meddicc_score]);

  // 圆点逐个亮起：每次 dashboard 更新时重置 animatedLitMap，按 DIMENSIONS 顺序延迟亮
  useEffect(() => {
    if (!dashboard) return;
    setAnimatedLitMap({});
    const timers: ReturnType<typeof setTimeout>[] = [];
    dashboard.dimensions.forEach((d, i) => {
      if (d.is_lit) {
        timers.push(
          setTimeout(() => {
            setAnimatedLitMap((prev) => ({ ...prev, [d.dimension]: true }));
          }, i * 100),
        );
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [dashboard]);

  const showStatus = (msg: string, ms = 2500) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), ms);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    showStatus('正在分析中...', 4000);
    try {
      const resp = await api.post<{ dashboard: DashboardData; message?: string }>(
        `/leads/${leadId}/meddicc/analyze`,
        {},
      );
      setDashboard(resp.dashboard);
      showStatus(resp.message || '✓ 分析完成');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      showStatus(`分析失败：${msg}`, 4000);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyCard = async (cardId: string) => {
    setApplyingCardId(cardId);
    showStatus('正在注入对话并分析中...', 6000);
    try {
      const resp = await api.post<{ dashboard: DashboardData }>(
        `/leads/${leadId}/scenario-cards/${cardId}/apply`,
        {},
      );
      setDashboard(resp.dashboard);
      // 刷新 conversations + scenario-cards 状态
      const [convs, cards] = await Promise.all([
        api.get<{ conversations: ConversationItem[] }>(`/leads/${leadId}/conversations`),
        api.get<{ cards: ScenarioCardItem[] }>(`/leads/${leadId}/scenario-cards`),
      ]);
      setConversations(convs.conversations || []);
      setScenarioCards(cards.cards || []);
      showStatus('✓ 完成');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      showStatus(`应用失败：${msg}`, 4000);
    } finally {
      setApplyingCardId(null);
    }
  };

  const handleAddConversation = async () => {
    if (!newConvContent.trim()) return;
    setSubmitting(true);
    showStatus('保存并分析中...', 6000);
    try {
      const resp = await api.post<{ dashboard: DashboardData }>(`/leads/${leadId}/conversations`, {
        recorded_at: new Date().toISOString(),
        content: newConvContent,
      });
      setDashboard(resp.dashboard);
      setNewConvContent('');
      setShowAddConv(false);
      const convs = await api.get<{ conversations: ConversationItem[] }>(
        `/leads/${leadId}/conversations`,
      );
      setConversations(convs.conversations || []);
      showStatus('✓ 完成');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      showStatus(`保存失败：${msg}`, 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    if (!confirm('删除这条对话后会触发重新分析，确认？')) return;
    try {
      const resp = await api.delete<{ dashboard: DashboardData }>(`/conversations/${convId}`);
      setDashboard(resp.dashboard);
      const convs = await api.get<{ conversations: ConversationItem[] }>(
        `/leads/${leadId}/conversations`,
      );
      setConversations(convs.conversations || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      showStatus(`删除失败：${msg}`, 4000);
    }
  };

  const handleDeleteEvidence = async (evId: string) => {
    if (!confirm('删除这条证据并重算 Score，确认？')) return;
    try {
      const resp = await api.delete<{ dashboard: DashboardData }>(`/meddicc-evidence/${evId}`);
      setDashboard(resp.dashboard);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      showStatus(`删除失败：${msg}`, 4000);
    }
  };

  if (loading) {
    return (
      <div data-testid="meddicc-panel-loading" style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        加载中...
      </div>
    );
  }

  const score = dashboard?.meddicc_score ?? 0;
  const completion = dashboard?.meddicc_completion ?? 0;
  const lastAnalyzed = dashboard?.last_analyzed_at;
  const nba = getNextBestAction(dashboard);

  return (
    <>
      {/* ─── MEDDICC 仪表盘 ─── */}
      <div
        id="meddicc"
        data-testid="meddicc-dashboard"
        style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>🎯 MEDDICC 仪表盘</h2>
          <button
            data-testid="meddicc-reanalyze-btn"
            onClick={handleAnalyze}
            disabled={analyzing}
            style={{
              padding: '6px 16px',
              background: analyzing ? '#d9d9d9' : '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: analyzing ? 'not-allowed' : 'pointer',
            }}
          >
            {analyzing ? '分析中...' : '重新分析'}
          </button>
        </div>

        {/* 顶部条 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%)',
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <div data-testid="meddicc-score" style={{ fontSize: 36, fontWeight: 700, color: '#1890ff', minWidth: 80 }}>
            {displayedScore}
            <span style={{ fontSize: 16, color: '#999', fontWeight: 400 }}>/100</span>
          </div>
          <div data-testid="meddicc-completion" style={{ fontSize: 16, color: '#595959' }}>
            完成度 <strong>{completion}/7</strong>
          </div>
          <div style={{ flex: 1, color: '#999', fontSize: 13 }}>
            {lastAnalyzed ? `上次分析于 ${formatRelativeTime(lastAnalyzed)}` : '尚未分析'}
          </div>
          {statusMessage && (
            <div
              data-testid="meddicc-status-msg"
              style={{
                padding: '6px 12px',
                background: '#fff',
                border: '1px solid #91d5ff',
                borderRadius: 4,
                fontSize: 13,
                color: '#1890ff',
              }}
            >
              {statusMessage}
            </div>
          )}
        </div>

        {/* 7 维度卡片网格 */}
        <div
          data-testid="meddicc-dimensions-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {DIMENSIONS.map((dim) => {
            const status = dashboard?.dimensions.find((d) => d.dimension === dim);
            const realLit = status?.is_lit ?? false;
            const animatedLit = animatedLitMap[dim] ?? false;
            const isExpanded = expandedDim === dim;
            const dotColor = animatedLit ? '#52c41a' : realLit ? '#bfbfbf' : '#d9d9d9';

            return (
              <div
                key={dim}
                data-testid={`meddicc-dim-${dim}`}
                data-lit={realLit ? 'true' : 'false'}
                onClick={() =>
                  status && status.evidences.length > 0
                    ? setExpandedDim(isExpanded ? null : dim)
                    : null
                }
                style={{
                  padding: 14,
                  border: `1px solid ${realLit ? '#91d5ff' : '#f0f0f0'}`,
                  borderRadius: 6,
                  background: realLit ? '#fff' : '#fafafa',
                  cursor: status && status.evidences.length > 0 ? 'pointer' : 'default',
                  transition: 'all 0.3s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  <span
                    data-testid={`meddicc-dot-${dim}`}
                    data-lit={animatedLit ? 'true' : 'false'}
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: dotColor,
                      transition: 'background 0.3s',
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <strong style={{ fontSize: 13, flex: 1, lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {DIMENSION_LABELS[dim]}
                  </strong>
                  <span style={{
                    fontSize: 12,
                    color: '#999',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}>
                    {status?.count ?? 0} 条
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 8, lineHeight: 1.4 }}>
                  {DIMENSION_SHORT[dim]}
                </div>
                {status && status.evidences.length > 0 && !isExpanded && (
                  <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.5 }}>
                    {status.evidences[0].evidence_text.slice(0, 50)}
                    {status.evidences[0].evidence_text.length > 50 ? '...' : ''}
                  </div>
                )}
                {isExpanded && status && (
                  <div data-testid={`meddicc-dim-${dim}-evidences`} style={{ marginTop: 8 }}>
                    {status.evidences.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          padding: 8,
                          background: '#fafafa',
                          borderRadius: 4,
                          marginBottom: 6,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ marginBottom: 4 }}>{ev.evidence_text}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#999', fontSize: 11 }}>
                          <span>
                            来源: {ev.source_type} · confidence{' '}
                            {(ev.confidence * 100).toFixed(0)}%
                          </span>
                          {!readOnly && (
                            <button
                              data-testid={`meddicc-evidence-delete-${ev.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvidence(ev.id);
                              }}
                              style={{
                                marginLeft: 'auto',
                                padding: '2px 8px',
                                background: '#fff',
                                border: '1px solid #ff4d4f',
                                color: '#ff4d4f',
                                borderRadius: 3,
                                cursor: 'pointer',
                                fontSize: 11,
                              }}
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Next Best Action */}
        <div
          data-testid="meddicc-nba"
          style={{
            padding: '12px 16px',
            background: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: 6,
            fontSize: 13,
            color: '#7a5b00',
          }}
        >
          ⚠ <strong>Next Best Action</strong>: {nba}
        </div>
      </div>

      {/* ─── 对话记录 + 场景卡 ─── */}
      {!readOnly && (
        <div
          data-testid="meddicc-conversation-section"
          style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>💬 对话记录（AI 抽 MEDDICC 的燃料）</h2>

          {/* 演示场景卡片网格 */}
          {scenarioCards.length > 0 && (
            <div data-testid="scenario-card-grid" style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 13,
                  color: '#fa8c16',
                  background: '#fff7e6',
                  border: '1px dashed #ffd591',
                  borderRadius: 6,
                  padding: '8px 12px',
                  marginBottom: 12,
                }}
              >
                🚀 <strong>演示场景卡片</strong>：点击下方任一卡片，系统会自动注入对话 + AI 抽证据 + 仪表盘动画刷新
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {scenarioCards.map((card) => (
                  <div
                    key={card.id}
                    data-testid={`scenario-card-${card.id}`}
                    data-applied={card.applied ? 'true' : 'false'}
                    style={{
                      padding: 14,
                      border: card.applied ? '1px solid #d9d9d9' : '1px solid #ffd591',
                      background: card.applied ? '#fafafa' : '#fff',
                      borderRadius: 8,
                      opacity: card.applied ? 0.6 : 1,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{card.title}</div>
                    <div style={{ fontSize: 12, color: '#595959', marginBottom: 12, minHeight: 32 }}>
                      {card.description}
                    </div>
                    <button
                      data-testid={`scenario-card-apply-${card.id}`}
                      onClick={() => !card.applied && handleApplyCard(card.id)}
                      disabled={card.applied || applyingCardId === card.id}
                      style={{
                        padding: '6px 14px',
                        background: card.applied ? '#d9d9d9' : '#fa8c16',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: card.applied ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {card.applied ? '已应用 ✓' : applyingCardId === card.id ? '应用中...' : '应用 →'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 已有对话列表 + 新增 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>已有对话（{conversations.length} 条）</strong>
            <button
              data-testid="add-conversation-btn"
              onClick={() => setShowAddConv(!showAddConv)}
              style={{
                padding: '6px 14px',
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {showAddConv ? '取消' : '+ 新增对话'}
            </button>
          </div>

          {showAddConv && (
            <div
              data-testid="add-conversation-form"
              style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}
            >
              <textarea
                data-testid="conversation-content-input"
                placeholder="粘贴一段销售-客户对话，例如：&#10;销售：王总您好...&#10;客户：嗯，我们最近..."
                value={newConvContent}
                onChange={(e) => setNewConvContent(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: 13,
                }}
              />
              <button
                data-testid="conversation-save-btn"
                onClick={handleAddConversation}
                disabled={submitting || !newConvContent.trim()}
                style={{
                  marginTop: 8,
                  padding: '6px 16px',
                  background: submitting ? '#d9d9d9' : '#52c41a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? '保存中...' : '保存并触发分析'}
              </button>
            </div>
          )}

          {conversations.length === 0 ? (
            <p data-testid="no-conversations" style={{ color: '#999' }}>
              暂无对话记录。点击场景卡或新增对话开始。
            </p>
          ) : (
            <div data-testid="conversation-list">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  data-testid={`conversation-item-${c.id}`}
                  style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        background:
                          c.source === 'manual'
                            ? '#e6f7ff'
                            : c.source === 'scenario_card'
                            ? '#fff7e6'
                            : '#f6ffed',
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                    >
                      {c.source === 'manual'
                        ? '手动录入'
                        : c.source === 'scenario_card'
                        ? '来自场景卡'
                        : '种子数据'}
                    </span>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {new Date(c.recorded_at).toLocaleString()}
                    </span>
                    <button
                      data-testid={`conversation-delete-${c.id}`}
                      onClick={() => handleDeleteConversation(c.id)}
                      style={{
                        marginLeft: 'auto',
                        padding: '2px 8px',
                        background: '#fff',
                        border: '1px solid #ff4d4f',
                        color: '#ff4d4f',
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      删除
                    </button>
                  </div>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      color: '#262626',
                    }}
                  >
                    {c.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const dt = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - dt);
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return `${Math.floor(diff / 86_400_000)} 天前`;
  } catch {
    return iso;
  }
}
