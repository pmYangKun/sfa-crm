'use client';

// Manager Pipeline 移动端 (spec 004 T046)
// 卡片化 Deals 视图 + 6 tab 横滑 + Team 卡片栈

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ForecastCategory,
  PipelineLead,
  PipelineResponse,
  TeamRollupResponse,
} from '@/lib/pipeline-types';
import MobileForecastTabs from '@/components/m/pipeline/mobile-forecast-tabs';
import DealCard from '@/components/m/pipeline/deal-card';
import MobileDealsTeamToggle from '@/components/m/pipeline/mobile-deals-team-toggle';
import MobileTeamRollup from '@/components/m/pipeline/mobile-team-rollup';
import MobileForecastEditSheet from '@/components/m/pipeline/mobile-forecast-edit-sheet';
import { PipelineView } from '@/components/pipeline/deals-team-toggle';

export default function MobileManagerPipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialOwner = searchParams.get('owner') || null;
  const initialView = (searchParams.get('view') as PipelineView) || 'deals';
  const initialCategory = (searchParams.get('cat') as ForecastCategory) || '进行中';

  const [view, setView] = useState<PipelineView>(initialView);
  const [activeCategory, setActiveCategory] = useState<ForecastCategory>(initialCategory);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(initialOwner);
  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
  const [teamRollup, setTeamRollup] = useState<TeamRollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editLead, setEditLead] = useState<PipelineLead | null>(null);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('forecast_category', activeCategory);
      if (ownerFilter) params.set('owner_id', ownerFilter);
      params.set('sort_by', 'score_asc');
      params.set('limit', '50');
      const data = await api.get<PipelineResponse>(`/manager/pipeline?${params}`);
      setPipeline(data);
    } catch {
      /* err: silent toast on mobile */
    } finally {
      setLoading(false);
    }
  }, [activeCategory, ownerFilter]);

  const loadTeamRollup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TeamRollupResponse>(
        `/manager/team-rollup?sort_by=score_asc&limit=50`,
      );
      setTeamRollup(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'deals') loadPipeline();
    else loadTeamRollup();
  }, [view, loadPipeline, loadTeamRollup]);

  useEffect(() => {
    if (view === 'team') setOwnerFilter(null);
  }, [view]);

  const handleSalesClick = (salesId: string) => {
    setOwnerFilter(salesId);
    setView('deals');
    const params = new URLSearchParams();
    params.set('view', 'deals');
    params.set('owner', salesId);
    params.set('cat', activeCategory);
    router.replace(`/m/manager-pipeline?${params}`);
  };

  const clearOwnerFilter = () => {
    setOwnerFilter(null);
    router.replace(`/m/manager-pipeline`);
  };

  return (
    <div
      data-testid="mobile-manager-pipeline-page"
      style={{ paddingBottom: 80, minHeight: '100vh' }}
    >
      <div
        style={{
          padding: '12px 12px 4px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>🎯 经理 Pipeline</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
            按 Forecast 分组看团队 deal
          </div>
        </div>
        <MobileDealsTeamToggle value={view} onChange={setView} />
      </div>

      {view === 'deals' && (
        <>
          <MobileForecastTabs
            active={activeCategory}
            counts={pipeline?.category_counts || {}}
            warningCounts={pipeline?.category_warning_counts || {}}
            onChange={setActiveCategory}
          />

          {ownerFilter && (
            <div
              data-testid="mobile-owner-filter-banner"
              style={{
                margin: '8px 12px',
                padding: '6px 10px',
                background: '#e6f7ff',
                border: '1px solid #91d5ff',
                borderRadius: 6,
                fontSize: 12,
                color: '#0050b3',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>已 filter 销售</span>
              <button
                type="button"
                data-testid="mobile-owner-filter-clear"
                onClick={clearOwnerFilter}
                style={{
                  marginLeft: 'auto',
                  border: 'none',
                  background: 'transparent',
                  color: '#1890ff',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >
                清除
              </button>
            </div>
          )}

          <div style={{ padding: 12 }}>
            {loading ? (
              <div
                data-testid="mobile-pipeline-loading"
                style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: 13 }}
              >
                加载中...
              </div>
            ) : (pipeline?.leads || []).length === 0 ? (
              <div
                data-testid="mobile-pipeline-empty"
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: 13,
                  background: '#fff',
                  borderRadius: 8,
                }}
              >
                当前 forecast 桶下暂无 lead
              </div>
            ) : (
              (pipeline?.leads || []).map((lead) => (
                <DealCard
                  key={lead.id}
                  lead={lead}
                  onForecastTap={(l) => setEditLead(l)}
                />
              ))
            )}
          </div>
        </>
      )}

      {view === 'team' && (
        <div style={{ padding: 12 }}>
          {loading ? (
            <div
              data-testid="mobile-team-loading"
              style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: 13 }}
            >
              加载中...
            </div>
          ) : (
            <MobileTeamRollup
              rows={teamRollup?.rows || []}
              onSalesClick={handleSalesClick}
            />
          )}
        </div>
      )}

      <MobileForecastEditSheet
        open={!!editLead}
        leadId={editLead?.id || null}
        current={editLead?.forecast_category || '进行中'}
        onClose={() => setEditLead(null)}
        onSaved={() => loadPipeline()}
      />
    </div>
  );
}
