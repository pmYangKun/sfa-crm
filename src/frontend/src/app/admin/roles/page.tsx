"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Permission {
  id: string;
  code: string;
  module: string;
  name: string;
}

interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cSaving, setCSaving] = useState(false);
  const [cMsg, setCMsg] = useState<string | null>(null);

  // Permission editing
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingPerms, setEditingPerms] = useState<Set<string>>(new Set());
  const [permSaving, setPermSaving] = useState(false);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [r, p] = await Promise.all([
        api.get<RoleRecord[]>("/roles"),
        api.get<Permission[]>("/permissions"),
      ]);
      setRoles(r);
      setPermissions(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCSaving(true);
    setCMsg(null);
    try {
      await api.post("/roles", { name: cName, description: cDesc || null });
      setCName(""); setCDesc("");
      setCMsg("创建成功");
      setShowCreate(false);
      fetchData();
    } catch (e) {
      setCMsg(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCSaving(false);
    }
  }

  async function handleDelete(role: RoleRecord) {
    if (!confirm(`确认删除角色「${role.name}」？`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  function startEditPerms(role: RoleRecord) {
    setEditingRoleId(role.id);
    setEditingPerms(new Set(role.permissions));
  }

  function togglePerm(code: string) {
    setEditingPerms(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function savePerms(roleId: string) {
    setPermSaving(true);
    try {
      await api.put(`/roles/${roleId}/permissions`, {
        permission_codes: Array.from(editingPerms),
      });
      setEditingRoleId(null);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPermSaving(false);
    }
  }

  // Group permissions by module
  const permsByModule: Record<string, Permission[]> = {};
  permissions.forEach(p => {
    if (!permsByModule[p.module]) permsByModule[p.module] = [];
    permsByModule[p.module].push(p);
  });

  return (
    <div className="page">
      <div className="page-header">
        <h2>角色权限管理</h2>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "取消" : "+ 新建角色"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="create-form card">
          <div className="form-row">
            <input placeholder="角色名称 *" value={cName} onChange={e => setCName(e.target.value)} required />
            <input placeholder="描述（选填）" value={cDesc} onChange={e => setCDesc(e.target.value)} />
          </div>
          {cMsg && <p className={cMsg.includes("失败") ? "error" : "success"}>{cMsg}</p>}
          <button type="submit" className="btn-primary" disabled={cSaving}>
            {cSaving ? "创建中…" : "创建角色"}
          </button>
        </form>
      )}

      {loading && <p className="hint">加载中…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && roles.map(role => (
        <div key={role.id} className="card role-card">
          <div className="role-header">
            <div className="role-title">
              <span className="role-name">{role.name}</span>
              {role.is_system && <span className="badge-system">系统</span>}
              {role.description && <span className="role-desc">{role.description}</span>}
            </div>
            <div className="role-actions">
              {editingRoleId === role.id ? (
                <>
                  <button className="btn-save" onClick={() => savePerms(role.id)} disabled={permSaving}>
                    {permSaving ? "保存中…" : "保存权限"}
                  </button>
                  <button className="btn-cancel" onClick={() => setEditingRoleId(null)}>取消</button>
                </>
              ) : (
                <>
                  <button className="btn-edit" onClick={() => startEditPerms(role)}>配置权限</button>
                  {!role.is_system && (
                    <button className="btn-del" onClick={() => handleDelete(role)}>删除</button>
                  )}
                </>
              )}
            </div>
          </div>

          {editingRoleId === role.id ? (
            <div className="perm-editor">
              {Object.entries(permsByModule).map(([module, perms]) => (
                <div key={module} className="perm-group">
                  <div className="perm-module">{module}</div>
                  <div className="perm-items">
                    {perms.map(p => (
                      <label key={p.code} className="perm-item">
                        <input
                          type="checkbox"
                          checked={editingPerms.has(p.code)}
                          onChange={() => togglePerm(p.code)}
                        />
                        {p.name}
                        <code className="perm-code">{p.code}</code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="perm-tags">
              {role.permissions.length === 0
                ? <span className="hint">未配置权限</span>
                : role.permissions.map(code => (
                  <span key={code} className="perm-tag">{code}</span>
                ))
              }
            </div>
          )}
        </div>
      ))}

      <style jsx>{`
        .page { padding: 24px; max-width: 900px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
        .create-form { display: flex; flex-direction: column; gap: 10px; }
        .form-row { display: flex; gap: 10px; }
        input { flex: 1; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; }
        .btn-primary { align-self: flex-start; background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .role-card { }
        .role-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .role-title { display: flex; align-items: center; gap: 8px; }
        .role-name { font-size: 15px; font-weight: 600; }
        .badge-system { font-size: 11px; background: #e6f7ff; color: #1890ff; padding: 1px 6px; border-radius: 4px; }
        .role-desc { font-size: 12px; color: var(--color-text-secondary); }
        .role-actions { display: flex; gap: 8px; }
        .btn-edit { background: none; border: 1px solid var(--color-primary); color: var(--color-primary); padding: 4px 12px; border-radius: var(--radius); font-size: 12px; cursor: pointer; }
        .btn-save { background: var(--color-primary); color: #fff; border: none; padding: 4px 12px; border-radius: var(--radius); font-size: 12px; cursor: pointer; }
        .btn-save:disabled { opacity: 0.6; }
        .btn-cancel { background: none; border: 1px solid var(--color-border); padding: 4px 12px; border-radius: var(--radius); font-size: 12px; cursor: pointer; }
        .btn-del { background: none; border: none; color: #e53e3e; font-size: 12px; cursor: pointer; padding: 4px 8px; }
        .perm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .perm-tag { font-size: 11px; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; font-family: monospace; }
        .perm-editor { margin-top: 10px; }
        .perm-group { margin-bottom: 12px; }
        .perm-module { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; margin-bottom: 6px; }
        .perm-items { display: flex; flex-wrap: wrap; gap: 8px; }
        .perm-item { display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer; }
        .perm-code { font-size: 10px; color: #999; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
        .success { color: #38a169; font-size: 13px; }
      `}</style>
    </div>
  );
}
