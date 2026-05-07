'use client';

// MEDDICC Score 趋势小折线图 — recharts
// spec 004 T040 + T041 (PC) / T053 (Mobile 复用 + width auto-fit)
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api';
import { MeddiccHistoryResponse } from '@/lib/pipeline-types';

interface Props {
  leadId: string;
  /** PC 默认 200x120；mobile 传 width=100% (auto-fit) + height 自定义 */
  width?: number | string;
  height?: number;
  sinceDays?: number;
}

export default function MeddiccTrendChart({
  leadId,
  width = 240,
  height = 140,
  sinceDays = 30,
}: Props) {
  const [data, setData] = useState<MeddiccHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<MeddiccHistoryResponse>(`/leads/${leadId}/meddicc-history?since_days=${sinceDays}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [leadId, sinceDays]);

  const points = (data?.snapshots || [])
    .filter((s) => s.meddicc_score != null)
    .map((s) => ({
      ts: s.snapshot_at,
      ts_label: formatShort(s.snapshot_at),
      score: Math.round(s.meddicc_score as number),
    }));

  const chartHeight = height;

  return (
    <div
      data-testid="meddicc-trend-chart"
      style={{
        width: typeof width === 'number' ? width : '100%',
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
        padding: 8,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: '#595959',
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        📈 MEDDICC Score 趋势（近 {sinceDays} 天）
      </div>

      {loading && (
        <div
          data-testid="trend-loading"
          style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf', fontSize: 12 }}
        >
          加载中...
        </div>
      )}

      {!loading && err && (
        <div
          data-testid="trend-error"
          style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf', fontSize: 12 }}
        >
          趋势数据准备中
        </div>
      )}

      {!loading && !err && points.length < 2 && (
        <div
          data-testid="trend-empty"
          style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf', fontSize: 12 }}
        >
          暂无趋势数据
        </div>
      )}

      {!loading && !err && points.length >= 2 && (
        <div
          data-testid="trend-chart"
          data-points={points.length}
          style={{ width: '100%', height: chartHeight }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="ts_label"
                tick={{ fontSize: 10, fill: '#8c8c8c' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#8c8c8c' }}
                width={28}
              />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v) => [`${v}`, 'Score'] as [string, string]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload as { ts?: string } | undefined;
                  if (item?.ts) {
                    try {
                      return new Date(item.ts).toLocaleString();
                    } catch {
                      return label;
                    }
                  }
                  return label;
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#1890ff"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1890ff' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function formatShort(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return iso;
  }
}
