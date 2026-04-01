"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Contact } from "@/types";

interface Props {
  entityType: "lead" | "customer";
  entityId: string;
  contacts: Contact[];
  onRefresh: () => void;
}

export function ContactPanel({ entityType, entityId, contacts, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [wechat, setWechat] = useState("");
  const [phone, setPhone] = useState("");
  const [isKdm, setIsKdm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.post(`/${entityType === "lead" ? "leads" : "customers"}/${entityId}/contacts`, {
        name: name.trim(),
        role: role.trim() || null,
        is_key_decision_maker: isKdm,
        wechat_id: wechat.trim() || null,
        phone: phone.trim() || null,
      });
      setName(""); setRole(""); setWechat(""); setPhone(""); setIsKdm(false);
      setMsg("已添加");
      setShowForm(false);
      onRefresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "添加失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="contact-panel">
      <div className="panel-header">
        <span>联系人（{contacts.length}）</span>
        <button className="btn-add" onClick={() => setShowForm(!showForm)}>
          {showForm ? "取消" : "+ 添加"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="add-form">
          <div className="form-row">
            <input placeholder="姓名 *" value={name} onChange={(e) => setName(e.target.value)} required />
            <input placeholder="职务" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="form-row">
            <input placeholder="微信 ID" value={wechat} onChange={(e) => setWechat(e.target.value)} />
            <input placeholder="手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <label className="kdm-label">
            <input type="checkbox" checked={isKdm} onChange={(e) => setIsKdm(e.target.checked)} />
            关键决策人
          </label>
          {msg && <p className={msg === "已添加" ? "success" : "error"}>{msg}</p>}
          <button type="submit" className="btn-save" disabled={saving || !name.trim()}>
            {saving ? "保存中…" : "保存"}
          </button>
        </form>
      )}

      {contacts.length > 0 ? (
        <table className="contact-table">
          <thead>
            <tr><th>姓名</th><th>职务</th><th>微信</th><th>电话</th><th>决策人</th></tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.role ?? "—"}</td>
                <td>{c.wechat_id ?? "—"}</td>
                <td>{c.phone ?? "—"}</td>
                <td>{c.is_key_decision_maker ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !showForm && <p className="empty">暂无联系人</p>
      )}

      <style jsx>{`
        .contact-panel { }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; font-weight: 500; }
        .btn-add { background: none; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 3px 10px; font-size: 12px; cursor: pointer; color: var(--color-primary); }
        .add-form { background: #fafafa; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
        .form-row { display: flex; gap: 8px; }
        input[type="text"], input:not([type]) {
          flex: 1; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px;
        }
        .kdm-label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
        .btn-save { align-self: flex-start; background: var(--color-primary); color: #fff; border: none; padding: 5px 14px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .contact-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .contact-table th, .contact-table td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--color-border); }
        .contact-table th { color: var(--color-text-secondary); font-weight: 500; }
        .empty { font-size: 13px; color: var(--color-text-secondary); }
        .success { color: #38a169; font-size: 12px; }
        .error { color: #e53e3e; font-size: 12px; }
      `}</style>
    </div>
  );
}
