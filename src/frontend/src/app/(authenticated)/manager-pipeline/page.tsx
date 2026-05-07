'use client';

// Manager Pipeline 主页 (PC) — Forecast 6 tab + Deals/Team 切换 + 主表
// spec 004 T031-T039

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ForecastCategory,
  PipelineResponse,
  TeamRollupResponse,
} from '@/lib/pipeline-types';
import ForecastTabs from '@/components/pipeline/forecast-tabs';
import PipelineTable from '@/components/pipeline/pipeline-table';
import TeamRollupTable from '@/components/pipeline/team-rollup-table';
import DealsTeamToggle, { PipelineView } from '@/components/pipeline/deals-team-toggle';
import { useAuth } from '@/lib/auth-context';

export default function ManagerPipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const initialOwner = searchParams.get('owner') || null;
  const initialView = (searchParams.get('view') as PipelineView) || 'deals';
  const initialCategory = (searchParams.get('cat') as ForecastCategory) || '进行中';

  const [view, setView] = useState<PipelineView>(initialView);
  const [activeCategory, setActiveCategory] =
    useState<ForecastCategory>(initialCategory);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(initialOwner);
  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
  const [teamRollup, setTeamRollup] = useState<TeamRollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set('forecast_category', activeCategory);
      if (ownerFilter) params.set('owner_id', ownerFilter);
      params.set('sort_by', 'score_asc');
      params.set('limit', '50');
      const data = await api.get<PipelineResponse>(`/manager/pipeline?${params}`);
      setPipeline(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, ownerFilter]);

  const loadTeamRollup = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.get<TeamRollupResponse>(
        `/manager/team-rollup?sort_by=score_asc&limit=50`,
      );
      setTeamRollup(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'deals') {
      loadPipeline();
    } else {
      loadTeamRollup();
    }
  }, [view, loadPipeline, loadTeamRollup]);

  // 切到 Team 视图时清掉 owner filter
  useEffect(() => {
    if (view === 'team') {
      setOwnerFilter(null);
    }
  }, [view]);

  const handleSalesClick = (salesId: string) => {
    setOwnerFilter(salesId);
    setView('deals');
    // 把 owner_id 写到 URL 便于刷新
    const params = new URLSearchParams();
    params.set('view', 'deals');
    params.set('owner', salesId);
    params.set('cat', activeCategory);
    router.replace(`/manager-pipeline?${params}`);
  };

  const clearOwnerFilter = () => {
    setOwnerFilter(null);
    router.replace(`/manager-pipeline`);
  };

  return (
    <div data-testid="manager-pipeline-page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, margin: 0, fontWeight: 600 }}>
            🎯 经理 Pipeline
          </h1>
          <p style={{ color: '#8c8c8c', fontSize: 13, margin: '4px 0 0' }}>
            按 Forecast 分组看团队 deal 健康度 / 风险 / MEDDICC 完成度
            {user && (
              <span style={{ marginLeft: 8 }}>
                · 当前角色：{user.roles.join('、')}
              </span>
            )}
          </p>
        </div>
        <DealsTeamToggle value={view} onChange={setView} />
      </div>

      {err && (
        <div
          data-testid="pipeline-error"
          style={{
            padding: 12,
            marginBottom: 12,
            background: '#fff1f0',
            border: '1px solid #ffccc7',
            borderRadius: 6,
            color: '#cf1322',
            fontSize: 13,
          }}
        >
          加载失败：{err}
        </div>
      )}

      {view === 'deals' && (
        <>
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: '4px 12px 0',
              marginBottom: 12,
            }}
          >
            <ForecastTabs
              active={activeCategory}
              counts={pipeline?.category_counts || {}}
              warningCounts={pipeline?.category_warning_counts || {}}
              onChange={setActiveCategory}
            />
          </div>

          {ownerFilter && (
            <div
              data-testid="owner-filter-banner"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                padding: '4px 12px',
                background: '#e6f7ff',
                border: '1px solid #91d5ff',
                borderRadius: 6,
                fontSize: 13,
                color: '#0050b3',
              }}
            >
              <span>已 filter 销售（owner_id={ownerFilter.slice(0, 8)}…）</span>
              <button
                type="button"
                data-testid="owner-filter-clear"
                onClick={clearOwnerFilter}
                style={{
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

          {loading ? (
            <div
              data-testid="pipeline-loading"
              style={{ padding: 24, textAlign: 'center', color: '#999' }}
            >
              加载中...
            </div>
          ) : (
            <PipelineTable
              leads={pipeline?.leads || []}
              onLeadUpdated={loadPipeline}
            />
          )}
        </>
      )}

      {view === 'team' && (
        <>
          {loading ? (
            <div
              data-testid="team-rollup-loading"
              style={{ padding: 24, textAlign: 'center', color: '#999' }}
            >
              加载中...
            </div>
          ) : (
            <TeamRollupTable
              rows={teamRollup?.rows || []}
              onSalesClick={handleSalesClick}
            />
          )}
        </>
      )}
    </div>
  );
}
