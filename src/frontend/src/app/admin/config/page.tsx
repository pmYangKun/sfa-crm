"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// ── System Config ─────────────────────────────────────────────────────────────

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

// ── LLM Config ────────────────────────────────────────────────────────────────

interface LLMConfig {
  id: string;
  provider: string;
  model_name: string;
  base_url: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Skill ─────────────────────────────────────────────────────────────────────

interface Skill {
  id: string;
  name: string;
  description: string;
  system_prompt: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminConfigPage() {
  // System config state
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  // LLM config state
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([]);
  const [showLlmForm, setShowLlmForm] = useState(false);
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [llmModel, setLlmModel] = useState("claude-opus-4-6");
  const [llmKey, setLlmKey] = useState("");
  const [llmBase, setLlmBase] = useState("");
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmMsg, setLlmMsg] = useState<string | null>(null);

  // Skill state
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillDesc, setSkillDesc] = useState("");
  const [skillPrompt, setSkillPrompt] = useState("");
  const [skillSaving, setSkillSaving] = useState(false);
  const [skillMsg, setSkillMsg] = useState<string | null>(null);

  async function fetchAll() {
    setConfigLoading(true);
    try {
      const [cfgs, llms, sks] = await Promise.all([
        api.get<ConfigEntry[]>("/config"),
        api.get<LLMConfig[]>("/agent/llm-configs"),
        api.get<Skill[]>("/agent/skills"),
      ]);
      setConfigs(cfgs);
      const init: Record<string, string> = {};
      cfgs.forEach(c => { init[c.key] = c.value; });
      setEdits(init);
      setLlmConfigs(llms);
      setSkills(sks);
    } catch (e) {
      console.error(e);
    } finally {
      setConfigLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function saveConfig() {
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      const changed: Record<string, string> = {};
      configs.forEach(c => { if (edits[c.key] !== c.value) changed[c.key] = edits[c.key]; });
      if (Object.keys(changed).length === 0) { setConfigMsg("无变更"); return; }
      await api.patch("/config", { updates: changed });
      setConfigMsg("保存成功");
      fetchAll();
    } catch (e) {
      setConfigMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setConfigSaving(false);
    }
  }

  async function createLlmConfig(e: React.FormEvent) {
    e.preventDefault();
    setLlmSaving(true);
    setLlmMsg(null);
    try {
      await api.post("/agent/llm-configs", {
        provider: llmProvider,
        model_name: llmModel,
        api_key: llmKey,
        base_url: llmBase || null,
      });
      setLlmKey(""); setLlmBase(""); setShowLlmForm(false);
      setLlmMsg("创建成功");
      fetchAll();
    } catch (e) {
      setLlmMsg(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLlmSaving(false);
    }
  }

  async function activateLlm(id: string) {
    try {
      await api.post(`/agent/llm-configs/${id}/activate`, {});
      fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  async function deleteLlm(id: string) {
    if (!confirm("确认删除此 LLM 配置？")) return;
    try {
      await api.delete(`/agent/llm-configs/${id}`);
      fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  async function createSkill(e: React.FormEvent) {
    e.preventDefault();
    setSkillSaving(true);
    setSkillMsg(null);
    try {
      await api.post("/agent/skills", {
        name: skillName,
        description: skillDesc,
        system_prompt: skillPrompt || null,
      });
      setSkillName(""); setSkillDesc(""); setSkillPrompt("");
      setSkillMsg("创建成功");
      setShowSkillForm(false);
      fetchAll();
    } catch (e) {
      setSkillMsg(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSkillSaving(false);
    }
  }

  async function toggleSkill(skill: Skill) {
    try {
      await api.patch(`/agent/skills/${skill.id}`, { is_active: !skill.is_active });
      fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  async function deleteSkill(id: string) {
    if (!confirm("确认删除此 Skill？")) return;
    try {
      await api.delete(`/agent/skills/${id}`);
      fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="page">
      <h2>系统配置</h2>

      {/* ── System Config ── */}
      <div className="section-header">
        <h3>基础参数</h3>
        <button className="btn-primary" onClick={saveConfig} disabled={configSaving || configLoading}>
          {configSaving ? "保存中…" : "保存更改"}
        </button>
      </div>
      {configMsg && <p className={configMsg.includes("失败") ? "error" : "success"}>{configMsg}</p>}
      {!configLoading && (
        <div className="card">
          <table className="config-table">
            <thead>
              <tr><th>配置项</th><th>说明</th><th>值</th></tr>
            </thead>
            <tbody>
              {configs.map(c => (
                <tr key={c.key}>
                  <td><code>{c.key}</code></td>
                  <td className="desc">{KEY_LABELS[c.key] ?? c.description ?? "—"}</td>
                  <td className="value-cell">
                    {c.key === "region_claim_rules" ? (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── LLM Config ── */}
      <div className="section-header">
        <h3>LLM 配置</h3>
        <button className="btn-secondary" onClick={() => setShowLlmForm(!showLlmForm)}>
          {showLlmForm ? "取消" : "+ 添加 LLM"}
        </button>
      </div>
      {showLlmForm && (
        <form onSubmit={createLlmConfig} className="create-form card">
          <div className="form-row">
            <select value={llmProvider} onChange={e => setLlmProvider(e.target.value)}>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI 兼容</option>
            </select>
            <input placeholder="模型名称 *" value={llmModel} onChange={e => setLlmModel(e.target.value)} required />
          </div>
          <div className="form-row">
            <input placeholder="API Key *" value={llmKey} onChange={e => setLlmKey(e.target.value)} required type="password" />
            <input placeholder="Base URL（可选，OpenAI 兼容）" value={llmBase} onChange={e => setLlmBase(e.target.value)} />
          </div>
          {llmMsg && <p className={llmMsg.includes("失败") ? "error" : "success"}>{llmMsg}</p>}
          <button type="submit" className="btn-primary" disabled={llmSaving}>
            {llmSaving ? "保存中…" : "添加"}
          </button>
        </form>
      )}
      <div className="card">
        {llmConfigs.length === 0 ? (
          <p className="hint">暂无 LLM 配置</p>
        ) : (
          <table className="config-table">
            <thead>
              <tr><th>Provider</th><th>模型</th><th>Base URL</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              {llmConfigs.map(c => (
                <tr key={c.id}>
                  <td>{c.provider}</td>
                  <td><code>{c.model_name}</code></td>
                  <td className="desc">{c.base_url ?? "—"}</td>
                  <td>
                    <span className={`status-tag ${c.is_active ? "active" : "inactive"}`}>
                      {c.is_active ? "激活" : "未激活"}
                    </span>
                  </td>
                  <td>
                    {!c.is_active && (
                      <button className="btn-sm" onClick={() => activateLlm(c.id)}>激活</button>
                    )}
                    <button className="btn-del" onClick={() => deleteLlm(c.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Skills ── */}
      <div className="section-header">
        <h3>Skill 管理</h3>
        <button className="btn-secondary" onClick={() => setShowSkillForm(!showSkillForm)}>
          {showSkillForm ? "取消" : "+ 新建 Skill"}
        </button>
      </div>
      {showSkillForm && (
        <form onSubmit={createSkill} className="create-form card">
          <div className="form-row">
            <input placeholder="名称 *" value={skillName} onChange={e => setSkillName(e.target.value)} required />
            <input placeholder="描述 *" value={skillDesc} onChange={e => setSkillDesc(e.target.value)} required />
          </div>
          <textarea
            placeholder="System Prompt（可选，为此 Skill 定制 AI 行为）"
            value={skillPrompt}
            onChange={e => setSkillPrompt(e.target.value)}
            rows={4}
            className="full-textarea"
          />
          {skillMsg && <p className={skillMsg.includes("失败") ? "error" : "success"}>{skillMsg}</p>}
          <button type="submit" className="btn-primary" disabled={skillSaving}>
            {skillSaving ? "创建中…" : "创建"}
          </button>
        </form>
      )}
      <div className="card">
        {skills.length === 0 ? (
          <p className="hint">暂无 Skill</p>
        ) : (
          <table className="config-table">
            <thead>
              <tr><th>名称</th><th>描述</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              {skills.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="desc">{s.description}</td>
                  <td>
                    <span className={`status-tag ${s.is_active ? "active" : "inactive"}`}>
                      {s.is_active ? "启用" : "停用"}
                    </span>
                  </td>
                  <td>
                    <button className="btn-sm" onClick={() => toggleSkill(s)}>
                      {s.is_active ? "停用" : "启用"}
                    </button>
                    <button className="btn-del" onClick={() => deleteSkill(s.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .page { padding: 24px; max-width: 960px; }
        h2 { font-size: 18px; font-weight: 600; margin-bottom: 20px; }
        h3 { font-size: 15px; font-weight: 600; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin: 20px 0 10px; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
        .create-form { display: flex; flex-direction: column; gap: 10px; }
        .form-row { display: flex; gap: 10px; }
        input, select, textarea { flex: 1; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; }
        .full-textarea { width: 100%; resize: vertical; font-family: monospace; font-size: 12px; }
        .config-table { width: 100%; border-collapse: collapse; }
        .config-table th, .config-table td { padding: 9px 10px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 13px; vertical-align: middle; }
        .config-table th { font-weight: 500; color: var(--color-text-secondary); }
        .desc { color: var(--color-text-secondary); }
        .value-cell { min-width: 200px; }
        .value-input { width: 100%; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; }
        .value-textarea { width: 100%; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 12px; font-family: monospace; resize: vertical; }
        .btn-primary { align-self: flex-start; background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { background: none; border: 1px solid var(--color-primary); color: var(--color-primary); padding: 6px 14px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-sm { background: none; border: 1px solid var(--color-border); padding: 3px 10px; border-radius: var(--radius); font-size: 12px; cursor: pointer; margin-right: 6px; }
        .btn-del { background: none; border: none; color: #e53e3e; font-size: 12px; cursor: pointer; }
        .status-tag { padding: 1px 8px; border-radius: 10px; font-size: 12px; }
        .status-tag.active { background: #f6ffed; color: #52c41a; }
        .status-tag.inactive { background: #f5f5f5; color: #999; }
        code { font-size: 12px; background: #f5f5f5; padding: 1px 5px; border-radius: 3px; }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
        .success { color: #38a169; font-size: 13px; }
      `}</style>
    </div>
  );
}
