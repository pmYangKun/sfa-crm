"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface OrgNode {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  created_at: string;
  user_count: number;
}

const TYPE_LABEL: Record<string, string> = {
  root: "根节点",
  region: "大区",
  team: "战队",
  custom: "自定义",
};

export default function AdminOrgPage() {
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("region");
  const [formParent, setFormParent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fetchNodes() {
    setLoading(true);
    setError(null);
    try {
      setNodes(await api.get<OrgNode[]>("/org/nodes"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchNodes(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.post("/org/nodes", {
        name: formName,
        type: formType,
        parent_id: formParent || null,
      });
      setFormName(""); setFormParent(""); setShowForm(false);
      setMsg("创建成功");
      fetchNodes();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`确认删除节点「${name}」？`)) return;
    try {
      await api.delete(`/org/nodes/${id}`);
      fetchNodes();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  // Build tree structure for display
  const roots = nodes.filter(n => !n.parent_id);
  const childrenMap: Record<string, OrgNode[]> = {};
  nodes.forEach(n => {
    if (n.parent_id) {
      if (!childrenMap[n.parent_id]) childrenMap[n.parent_id] = [];
      childrenMap[n.parent_id].push(n);
    }
  });

  function renderTree(node: OrgNode, depth = 0): React.ReactNode {
    const children = childrenMap[node.id] || [];
    return (
      <div key={node.id} style={{ marginLeft: depth * 20 }}>
        <div className="node-row">
          <span className="node-name">{node.name}</span>
          <span className="node-type">{TYPE_LABEL[node.type] ?? node.type}</span>
          <span className="node-users">{node.user_count} 人</span>
          <button className="btn-del" onClick={() => handleDelete(node.id, node.name)}>删除</button>
        </div>
        {children.map(c => renderTree(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>组织管理</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "取消" : "+ 新增节点"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="create-form card">
          <div className="form-row">
            <input placeholder="节点名称 *" value={formName} onChange={e => setFormName(e.target.value)} required />
            <select value={formType} onChange={e => setFormType(e.target.value)}>
              <option value="region">大区</option>
              <option value="team">战队</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <select value={formParent} onChange={e => setFormParent(e.target.value)}>
            <option value="">无父节点（根）</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.name} ({TYPE_LABEL[n.type]})</option>)}
          </select>
          {msg && <p className={msg.includes("失败") ? "error" : "success"}>{msg}</p>}
          <button type="submit" className="btn-primary" disabled={saving || !formName}>
            {saving ? "创建中…" : "创建"}
          </button>
        </form>
      )}

      {loading && <p className="hint">加载中…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="card tree">
          {roots.length === 0 ? (
            <p className="hint">暂无组织节点</p>
          ) : (
            roots.map(r => renderTree(r))
          )}
        </div>
      )}

      <style jsx>{`
        .page { padding: 24px; max-width: 720px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
        .tree { }
        .node-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
        .node-name { flex: 1; font-size: 14px; font-weight: 500; }
        .node-type { font-size: 12px; color: var(--color-text-secondary); background: #f0f0f0; padding: 1px 6px; border-radius: 4px; }
        .node-users { font-size: 12px; color: var(--color-text-secondary); min-width: 40px; }
        .btn-del { background: none; border: none; color: #e53e3e; font-size: 12px; cursor: pointer; padding: 2px 6px; }
        .create-form { display: flex; flex-direction: column; gap: 10px; }
        .form-row { display: flex; gap: 10px; }
        input, select { flex: 1; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; }
        .btn-primary { align-self: flex-start; background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
        .success { color: #38a169; font-size: 13px; }
      `}</style>
    </div>
  );
}
