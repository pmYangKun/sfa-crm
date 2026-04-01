"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ConfigEntry {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

const KEY_LABELS: Record<string, string> = {
  private_pool_limit: "私有池线索上限",
  followup_release_days: "未跟进释放天数",
  conversion_release_days: "未成单释放天数",
  claim_rate_limit: "每分钟最大抢占次数",
  daily_report_generate_at: "日报生成时间",
  name_similarity_threshold: "公司名模糊匹配阈值（0-100）",
  region_claim_rules: "大区抢占规则 JSON",
};

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fetchConfig() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ConfigEntry[]>("/config");
      setConfigs(data);
      const init: Record<string, string> = {};
      data.forEach(c => { init[c.key] = c.value; });
      setEdits(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchConfig(); }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      // Only send changed values
      const changed: Record<string, string> = {};
      configs.forEach(c => {
        if (edits[c.key] !== c.value) changed[c.key] = edits[c.key];
      });
      if (Object.keys(changed).length === 0) {
        setMsg("无变更");
        return;
      }
      await api.patch("/config", { updates: changed });
      setMsg("保存成功");
      fetchConfig();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const isLongValue = (key: string) => key === "region_claim_rules";

  return (
    <div className="page">
      <div className="page-header">
        <h2>系统配置</h2>
        <button className="btn-primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? "保存中…" : "保存所有更改"}
        </button>
      </div>

      {msg && <p className={msg.includes("失败") ? "error" : "success"}>{msg}</p>}
      {loading && <p className="hint">加载中…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="card">
          <table className="config-table">
            <thead>
              <tr><th>配置项</th><th>说明</th><th>值</th><th>最后更新</th></tr>
            </thead>
            <tbody>
              {configs.map(c => (
                <tr key={c.key}>
                  <td><code>{c.key}</code></td>
                  <td className="desc">{KEY_LABELS[c.key] ?? c.description ?? "—"}</td>
                  <td className="value-cell">
                    {isLongValue(c.key) ? (
                      <textarea
                        className="value-textarea"
                        value={edits[c.key] ?? c.value}
                        onChange={e => setEdits(prev => ({ ...prev, [c.key]: e.target.value }))}
                        rows={3}
                      />
                    ) : (
                      <input
                        className="value-input"
                        value={edits[c.key] ?? c.value}
                        onChange={e => setEdits(prev => ({ ...prev, [c.key]: e.target.value }))}
                      />
                    )}
                  </td>
                  <td className="updated">{c.updated_at.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .page { padding: 24px; max-width: 900px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; }
        .config-table { width: 100%; border-collapse: collapse; }
        .config-table th, .config-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 13px; vertical-align: middle; }
        .config-table th { font-weight: 500; color: var(--color-text-secondary); }
        .desc { color: var(--color-text-secondary); min-width: 160px; }
        .value-cell { min-width: 200px; }
        .value-input { width: 100%; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; }
        .value-textarea { width: 100%; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 12px; font-family: monospace; resize: vertical; }
        .updated { font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
        code { font-size: 12px; background: #f5f5f5; padding: 1px 5px; border-radius: 3px; }
        .btn-primary { background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
        .success { color: #38a169; font-size: 13px; }
      `}</style>
    </div>
  );
}
