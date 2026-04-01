"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface LeadSummary {
  id: string;
  company_name: string;
  stage: string;
  pool: string;
  owner_id: string | null;
  created_at: string;
}

interface CustomerSummary {
  id: string;
  company_name: string;
  owner_id: string;
  created_at: string;
}

interface UserStat {
  user_id: string;
  user_name: string;
  private_leads: number;
  customers: number;
  conversions_30d: number;
}

const STAGE_LABEL: Record<string, string> = {
  new: "新线索",
  contacted: "已接触",
  negotiating: "洽谈中",
  converted: "已转化",
  lost: "已丢失",
};

const STAGE_COLOR: Record<string, string> = {
  new: "#1890ff",
  contacted: "#fa8c16",
  negotiating: "#722ed1",
  converted: "#52c41a",
  lost: "#f5222d",
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const [l, c] = await Promise.all([
          api.get<LeadSummary[]>("/leads?limit=500"),
          api.get<CustomerSummary[]>("/customers?limit=500"),
        ]);
        setLeads(l);
        setCustomers(c);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  // Compute funnel stats
  const stageCounts: Record<string, number> = {};
  leads.forEach(l => { stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1; });

  const privateLeads = leads.filter(l => l.pool === "private").length;
  const publicLeads = leads.filter(l => l.pool === "public").length;
  const totalLeads = leads.length;
  const totalCustomers = customers.length;

  // 30-day conversions
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentConversions = customers.filter(c => c.created_at >= thirtyDaysAgo).length;

  // Conversion rate
  const convRate = totalLeads > 0
    ? ((stageCounts["converted"] ?? 0) / totalLeads * 100).toFixed(1)
    : "0.0";

  const funnelStages = ["new", "contacted", "negotiating", "converted", "lost"];

  return (
    <div className="page">
      <h2>数据概览</h2>

      {loading && <p className="hint">加载中…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          {/* KPI cards */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-value">{totalLeads}</div>
              <div className="kpi-label">总线索数</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{privateLeads}</div>
              <div className="kpi-label">私有池</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{publicLeads}</div>
              <div className="kpi-label">公共池</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{totalCustomers}</div>
              <div className="kpi-label">客户总数</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{recentConversions}</div>
              <div className="kpi-label">30天新增客户</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{convRate}%</div>
              <div className="kpi-label">累计转化率</div>
            </div>
          </div>

          {/* Funnel */}
          <div className="card">
            <h3>线索漏斗</h3>
            <div className="funnel">
              {funnelStages.map(stage => {
                const count = stageCounts[stage] ?? 0;
                const pct = totalLeads > 0 ? (count / totalLeads * 100) : 0;
                return (
                  <div key={stage} className="funnel-row">
                    <div className="funnel-label">{STAGE_LABEL[stage]}</div>
                    <div className="funnel-bar-wrap">
                      <div
                        className="funnel-bar"
                        style={{ width: `${Math.max(pct, 2)}%`, background: STAGE_COLOR[stage] }}
                      />
                    </div>
                    <div className="funnel-count">{count}</div>
                    <div className="funnel-pct">{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pool usage */}
          <div className="card">
            <h3>私有池使用率</h3>
            <div className="pool-bar-wrap">
              <div className="pool-bar" style={{ width: `${Math.min(privateLeads / 100 * 100, 100)}%` }} />
            </div>
            <p className="pool-text">{privateLeads} / 100（配置上限）条线索在私有池中</p>
          </div>
        </>
      )}

      <style jsx>{`
        .page { padding: 24px; max-width: 960px; }
        h2 { font-size: 18px; font-weight: 600; margin-bottom: 20px; }
        h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
        .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
        .kpi-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px 20px; text-align: center; }
        .kpi-value { font-size: 28px; font-weight: 700; color: var(--color-primary); }
        .kpi-label { font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; }
        .funnel { display: flex; flex-direction: column; gap: 8px; }
        .funnel-row { display: flex; align-items: center; gap: 10px; }
        .funnel-label { width: 70px; font-size: 13px; text-align: right; flex-shrink: 0; }
        .funnel-bar-wrap { flex: 1; background: #f0f0f0; border-radius: 4px; height: 20px; overflow: hidden; }
        .funnel-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
        .funnel-count { width: 40px; font-size: 13px; font-weight: 600; text-align: right; }
        .funnel-pct { width: 50px; font-size: 12px; color: var(--color-text-secondary); }
        .pool-bar-wrap { background: #f0f0f0; border-radius: 6px; height: 12px; overflow: hidden; margin-bottom: 8px; }
        .pool-bar { height: 100%; background: var(--color-primary); border-radius: 6px; transition: width 0.3s; }
        .pool-text { font-size: 13px; color: var(--color-text-secondary); }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
      `}</style>
    </div>
  );
}
