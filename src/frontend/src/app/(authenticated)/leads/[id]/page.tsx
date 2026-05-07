'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Lead, Contact, FollowUp, KeyEvent, PaginatedResponse } from '@/types';
import KeyEventForm from '@/components/leads/key-event-form';
import MeddiccPanel from '@/components/lead/MeddiccPanel';
import MeddiccTrendChart from '@/components/leads/meddicc-trend-chart';
import ForecastCellEditor from '@/components/pipeline/forecast-cell-editor';
import { ForecastCategory, formatAmount } from '@/lib/pipeline-types';

interface LeadDetail extends Lead {
  contacts: Contact[];
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [keyEvents, setKeyEvents] = useState<KeyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fuContent, setFuContent] = useState('');
  const [fuType, setFuType] = useState('phone');
  const [prefillKeType, setPrefillKeType] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const loadData = async () => {
    try {
      const [leadData, fuData, keData] = await Promise.all([
        api.get<LeadDetail>(`/leads/${id}`),
        api.get<PaginatedResponse<FollowUp>>(`/leads/${id}/followups?size=50`),
        api.get<PaginatedResponse<KeyEvent>>(`/leads/${id}/key-events?size=50`),
      ]);
      setLead(leadData);
      setFollowups(fuData.items);
      setKeyEvents(keData.items);
    } catch {
      router.push('/leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  // Read prefill data from sessionStorage (written by Copilot nav button)
  useEffect(() => {
    const raw = sessionStorage.getItem('copilot_prefill');
    if (!raw) return;
    sessionStorage.removeItem('copilot_prefill');

    const params = new URLSearchParams(raw);
    if (params.get('fu_content')) setFuContent(params.get('fu_content')!);
    if (params.get('fu_type')) setFuType(params.get('fu_type')!);
    if (params.get('ke_type')) setPrefillKeType(params.get('ke_type')!);
  }); // no deps — runs every render, but sessionStorage is consumed immediately

  // Auto-scroll to hash anchor after page loads
  useEffect(() => {
    if (!loading && lead) {
      const hash = window.location.hash.slice(1);
      if (hash) {
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    }
  }, [loading, lead]);

  const handleAddFollowup = async () => {
    if (!fuContent.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/leads/${id}/followups`, {
        type: fuType,
        content: fuContent,
        followed_at: new Date().toISOString(),
      });
      setFuContent('');
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvert = async () => {
    if (!confirm('确认将此线索转化为客户？')) return;
    setActionLoading('convert');
    try {
      await api.post(`/leads/${id}/convert`, {});
      loadData();
    } catch (err) {
      alert('转化失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRelease = async () => {
    if (!confirm('确认释放此线索到公共池？')) return;
    setActionLoading('release');
    try {
      await api.post(`/leads/${id}/release`, {});
      loadData();
    } catch (err) {
      alert('释放失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setActionLoading('');
    }
  };

  const handleMarkLost = async () => {
    if (!confirm('确认标记此线索为流失？')) return;
    setActionLoading('lost');
    try {
      await api.post(`/leads/${id}/mark-lost`, {});
      loadData();
    } catch (err) {
      alert('标记失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <p>加载中...</p>;
  if (!lead) return <p>线索不存在</p>;

  const stageLabel = { active: '活跃', converted: '已转化', lost: '已流失' }[lead.stage] || lead.stage;
  const sourceLabel = { referral: '转介绍', organic: '自然流量', koc_sem: 'KOC/SEM', outbound: '外呼' }[lead.source] || lead.source;
  const keyEventLabel: Record<string, string> = {
    visited_kp: '拜访KP',
    book_sent: '赠书',
    attended_small_course: '参加小课',
    purchased_big_course: '购买大课',
    contact_relation_discovered: '发现关系',
  };

  return (
    <div>
      <button onClick={() => router.back()} style={{
        padding: '6px 16px', background: '#fff', border: '1px solid #d9d9d9',
        borderRadius: 4, cursor: 'pointer', marginBottom: 16,
      }}>← 返回</button>

      <div style={{ background: '#fff', padding: 20, borderRadius: 8, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 14px', wordBreak: 'break-word' }}>
          {lead.company_name}
        </h1>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            columnGap: 12,
            rowGap: 10,
          }}
        >
          {[
            { label: '状态', value: stageLabel },
            { label: '大区', value: lead.region },
            { label: '来源', value: sourceLabel },
            { label: '负责人', value: lead.owner?.name || '公共池' },
            {
              label: 'Forecast',
              value:
                lead.stage === 'active' ? (
                  <ForecastCellEditor
                    leadId={lead.id}
                    current={(lead.forecast_category as ForecastCategory) || '进行中'}
                    onSaved={() => loadData()}
                  />
                ) : (
                  lead.forecast_category || '-'
                ),
            },
            { label: '预计金额', value: formatAmount(lead.amount ?? null) },
            { label: '预计关单', value: lead.close_date || '-' },
            { label: '组织机构代码', value: lead.unified_code || '-' },
            { label: '创建时间', value: new Date(lead.created_at).toLocaleString() },
          ].map((f) => (
            <div key={f.label} style={{ minWidth: 0 }}>
              <div style={{ color: '#8c8c8c', fontSize: 12, lineHeight: 1.4 }}>{f.label}</div>
              <div style={{ fontSize: 14, color: '#262626', marginTop: 2, wordBreak: 'break-word' }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
        {lead.stage === 'active' && (
          <div id="actions" style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
            <button onClick={handleConvert} disabled={!!actionLoading} style={{
              padding: '6px 16px', background: '#52c41a', color: '#fff',
              border: 'none', borderRadius: 4, cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}>
              {actionLoading === 'convert' ? '处理中...' : '转化客户'}
            </button>
            <button onClick={handleRelease} disabled={!!actionLoading} style={{
              padding: '6px 16px', background: '#faad14', color: '#fff',
              border: 'none', borderRadius: 4, cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}>
              {actionLoading === 'release' ? '处理中...' : '释放线索'}
            </button>
            <button onClick={handleMarkLost} disabled={!!actionLoading} style={{
              padding: '6px 16px', background: '#ff4d4f', color: '#fff',
              border: 'none', borderRadius: 4, cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}>
              {actionLoading === 'lost' ? '处理中...' : '标记流失'}
            </button>
          </div>
        )}
      </div>

      {/* Contacts */}
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>联系人</h2>
        {lead.contacts.length === 0 ? <p style={{ color: '#999' }}>暂无联系人</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {lead.contacts.map(c => (
              <div key={c.id} style={{
                padding: 12, border: '1px solid #f0f0f0', borderRadius: 6,
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8,
              }}>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>姓名</div>
                  <div style={{ fontWeight: 500 }}>
                    {c.name}{c.is_key_decision_maker && <span style={{ marginLeft: 6, padding: '1px 6px', background: '#fff7e6', color: '#fa8c16', borderRadius: 3, fontSize: 11 }}>KP</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>职务</div>
                  <div>{c.role || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>手机</div>
                  <div>{c.phone || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>微信</div>
                  <div>{c.wechat_id || '-'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-ups */}
      <div id="followup" style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>跟进记录</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={fuType} onChange={e => setFuType(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <option value="phone">电话</option>
            <option value="wechat">微信</option>
            <option value="visit">拜访</option>
            <option value="other">其他</option>
          </select>
          <input placeholder="跟进内容..." value={fuContent} onChange={e => setFuContent(e.target.value)}
            style={{ flex: '1 1 200px', minWidth: 0, padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }} />
          <button onClick={handleAddFollowup} disabled={submitting} style={{
            padding: '6px 16px', background: '#1890ff', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer',
          }}>
            {submitting ? '提交中...' : '添加跟进'}
          </button>
        </div>
        {followups.length === 0 ? <p style={{ color: '#999' }}>暂无跟进记录</p> : (
          <div>
            {followups.map(fu => (
              <div key={fu.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ padding: '2px 8px', background: '#e6f7ff', borderRadius: 4, fontSize: 12 }}>
                    {fu.type === 'phone' ? '电话' : fu.type === 'wechat' ? '微信' : fu.type === 'visit' ? '拜访' : '其他'}
                  </span>
                  <span style={{ color: '#999', fontSize: 13 }}>{new Date(fu.followed_at).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: 14 }}>{fu.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MEDDICC Panel — spec 003: 仪表盘 + 场景卡 + 对话记录 */}
      <MeddiccPanel leadId={id} />

      {/* MEDDICC Score 趋势图 — spec 004 T040 / T041 */}
      <div
        id="meddicc-trend"
        style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>📈 MEDDICC 趋势</h2>
        <MeddiccTrendChart leadId={id} width={'100%' as unknown as number} height={160} />
      </div>

      {/* Key Events */}
      <div id="keyevent" style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>关键事件</h2>
        <KeyEventForm entityType="lead" entityId={id} onCreated={loadData} initialType={prefillKeType} />
        {keyEvents.length === 0 ? <p style={{ color: '#999', marginTop: 16 }}>暂无关键事件</p> : (
          <div style={{ marginTop: 16 }}>
            {keyEvents.map(ke => (
              <div key={ke.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ padding: '2px 8px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, fontSize: 12 }}>
                    {keyEventLabel[ke.type] || ke.type}
                  </span>
                  <span style={{ color: '#999', fontSize: 13 }}>{new Date(ke.occurred_at).toLocaleString()}</span>
                </div>
                {ke.payload && Object.keys(ke.payload).length > 0 && (
                  <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    {Object.entries(ke.payload).map(([k, v]) => `${k}: ${v}`).join('、')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
