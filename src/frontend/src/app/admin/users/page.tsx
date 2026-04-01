"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface UserRecord {
  id: string;
  name: string;
  login: string;
  org_node_id: string;
  is_active: boolean;
  roles: string[];
  scope: string | null;
}

const SCOPE_LABEL: Record<string, string> = {
  self_only: "仅自己",
  current_node: "本节点",
  current_and_below: "本节点及下级",
  selected_nodes: "指定节点",
  all: "全部",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [cName, setCName] = useState("");
  const [cLogin, setCLogin] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cNode, setCNode] = useState("");
  const [cRoles, setCRoles] = useState("");
  const [cScope, setCScope] = useState("self_only");
  const [cSaving, setCSaving] = useState(false);
  const [cMsg, setCMsg] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api.get<UserRecord[]>("/users"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCSaving(true);
    setCMsg(null);
    try {
      await api.post("/users", {
        name: cName, login: cLogin, password: cPassword,
        org_node_id: cNode,
        role_names: cRoles.split(",").map(s => s.trim()).filter(Boolean),
        scope: cScope,
      });
      setCName(""); setCLogin(""); setCPassword(""); setCNode(""); setCRoles("");
      setCMsg("创建成功");
      setShowCreate(false);
      fetchUsers();
    } catch (e) {
      setCMsg(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCSaving(false);
    }
  }

  async function toggleActive(user: UserRecord) {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>用户管理</h2>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "取消" : "+ 新建用户"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="create-form card">
          <div className="form-row">
            <input placeholder="姓名 *" value={cName} onChange={e => setCName(e.target.value)} required />
            <input placeholder="登录名 *" value={cLogin} onChange={e => setCLogin(e.target.value)} required />
            <input type="password" placeholder="密码 *" value={cPassword} onChange={e => setCPassword(e.target.value)} required />
          </div>
          <div className="form-row">
            <input placeholder="组织节点 ID *" value={cNode} onChange={e => setCNode(e.target.value)} required />
            <input placeholder="角色（逗号分隔，如：销售,战队队长）" value={cRoles} onChange={e => setCRoles(e.target.value)} />
            <select value={cScope} onChange={e => setCScope(e.target.value)}>
              {Object.entries(SCOPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {cMsg && <p className={cMsg.includes("失败") ? "error" : "success"}>{cMsg}</p>}
          <button type="submit" className="btn-primary" disabled={cSaving}>
            {cSaving ? "创建中…" : "创建用户"}
          </button>
        </form>
      )}

      {loading && <p className="hint">加载中…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr><th>姓名</th><th>登录名</th><th>角色</th><th>数据范围</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td><code>{u.login}</code></td>
                  <td>{u.roles.join(", ") || "—"}</td>
                  <td>{u.scope ? (SCOPE_LABEL[u.scope] ?? u.scope) : "—"}</td>
                  <td>
                    <span className={`status-tag ${u.is_active ? "active" : "inactive"}`}>
                      {u.is_active ? "活跃" : "停用"}
                    </span>
                  </td>
                  <td>
                    <button className="btn-toggle" onClick={() => toggleActive(u)}>
                      {u.is_active ? "停用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="empty">暂无用户</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .page { padding: 24px; max-width: 900px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
        .create-form { display: flex; flex-direction: column; gap: 10px; }
        .form-row { display: flex; gap: 10px; }
        input, select { flex: 1; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; }
        .btn-primary { align-self: flex-start; background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 13px; }
        .data-table th { font-weight: 500; color: var(--color-text-secondary); }
        code { font-size: 12px; background: #f5f5f5; padding: 1px 5px; border-radius: 3px; }
        .status-tag { padding: 1px 8px; border-radius: 10px; font-size: 12px; }
        .status-tag.active { background: #f6ffed; color: #52c41a; }
        .status-tag.inactive { background: #f5f5f5; color: #999; }
        .btn-toggle { background: none; border: 1px solid var(--color-border); padding: 3px 10px; border-radius: var(--radius); font-size: 12px; cursor: pointer; }
        .empty { text-align: center; color: var(--color-text-secondary); }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
        .success { color: #38a169; font-size: 13px; }
      `}</style>
    </div>
  );
}
