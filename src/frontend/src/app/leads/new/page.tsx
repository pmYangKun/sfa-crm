"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface WarningInfo {
  message: string;
  duplicate_lead_id: string;
}

export default function NewLeadPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    unified_code: "",
    region: "",
    source: "referral" as const,
  });
  const [warning, setWarning] = useState<WarningInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setLoading(true);

    const body = {
      company_name: form.company_name,
      unified_code: form.unified_code || null,
      region: form.region,
      source: form.source,
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/leads`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (res.status === 409) {
        const data = await res.json();
        setError(data.detail?.message ?? "企业已存在");
        return;
      }

      if (res.status === 202) {
        const data = await res.json();
        setWarning(data._warning);
        // Still created — navigate after user acknowledges
        setTimeout(() => router.push("/leads"), 3000);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "录入失败");
        return;
      }

      router.push("/leads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h2>录入线索</h2>

      {warning && (
        <div className="warn-banner">
          ⚠️ {warning.message}（3秒后跳转…）
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label>公司名称 *</label>
          <input
            name="company_name"
            value={form.company_name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="field">
          <label>统一社会信用代码</label>
          <input
            name="unified_code"
            value={form.unified_code}
            onChange={handleChange}
            placeholder="可选"
          />
        </div>
        <div className="field">
          <label>大区 *</label>
          <input
            name="region"
            value={form.region}
            onChange={handleChange}
            required
            placeholder="如：华东、华南"
          />
        </div>
        <div className="field">
          <label>来源 *</label>
          <select name="source" value={form.source} onChange={handleChange}>
            <option value="referral">转介绍</option>
            <option value="organic">自然流量</option>
            <option value="koc_sem">KOC/SEM</option>
            <option value="outbound">外呼</option>
          </select>
        </div>

        <div className="actions">
          <button type="button" onClick={() => router.back()}>
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "提交中…" : "录入线索"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .page { padding: 24px; max-width: 520px; }
        h2 { font-size: 18px; font-weight: 600; margin-bottom: 20px; }
        .warn-banner {
          background: #fffbe6;
          border: 1px solid #ffe58f;
          border-radius: var(--radius);
          padding: 10px 14px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .error-banner {
          background: #fff2f0;
          border: 1px solid #ffccc7;
          border-radius: var(--radius);
          padding: 10px 14px;
          margin-bottom: 16px;
          color: #cf1322;
          font-size: 13px;
        }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 13px; color: var(--color-text-secondary); }
        input, select {
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          font-size: 14px;
        }
        input:focus, select:focus { outline: none; border-color: var(--color-primary); }
        .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
        button {
          padding: 8px 20px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-surface);
          cursor: pointer;
          font-size: 14px;
        }
        .btn-primary {
          background: var(--color-primary);
          color: #fff;
          border-color: var(--color-primary);
        }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
