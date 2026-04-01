'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SystemConfigItem } from '@/types';

interface LLMConfigItem {
  id: string;
  provider: string;
  model: string;
  is_active: boolean;
}

interface SkillItem {
  id: string;
  name: string;
  trigger: string;
  category: string | null;
}

export default function ConfigPage() {
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // LLM Config state
  const [llmConfig, setLlmConfig] = useState<{ configured: boolean; provider?: string; model?: string } | null>(null);
  const [llmForm, setLlmForm] = useState({ provider: 'anthropic', model: 'claude-sonnet-4-20250514', api_key: '' });
  const [llmSaving, setLlmSaving] = useState(false);

  // Skills state
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skillForm, setSkillForm] = useState({ name: '', trigger: '', content: '', category: '' });
  const [showSkillForm, setShowSkillForm] = useState(false);

  const loadConfig = async () => {
    try {
      const data = await api.get<SystemConfigItem[]>('/config');
      setConfigs(data);
      const map: Record<string, string> = {};
      data.forEach(c => { map[c.key] = c.value; });
      setEditing(map);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadLLMConfig = async () => {
    try {
      const data = await api.get<{ configured: boolean; provider?: string; model?: string }>('/agent/llm-config');
      setLlmConfig(data);
      if (data.configured) {
        setLlmForm(f => ({ ...f, provider: data.provider || 'anthropic', model: data.model || '' }));
      }
    } catch { /* ignore if agent not available */ }
  };

  const loadSkills = async () => {
    try {
      const data = await api.get<SkillItem[]>('/agent/skills');
      setSkills(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadConfig();
    loadLLMConfig();
    loadSkills();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/config', { items: editing });
      loadConfig();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleLLMSave = async () => {
    if (!llmForm.api_key && !llmConfig?.configured) {
      alert('请输入 API Key');
      return;
    }
    setLlmSaving(true);
    try {
      await api.post('/agent/llm-config', llmForm);
      loadLLMConfig();
      setLlmForm(f => ({ ...f, api_key: '' }));
    } catch (err) { console.error(err); }
    finally { setLlmSaving(false); }
  };

  const handleAddSkill = async () => {
    if (!skillForm.name || !skillForm.trigger || !skillForm.content) {
      alert('请填写技能名称、触发词和内容');
      return;
    }
    try {
      await api.post('/agent/skills', skillForm);
      setSkillForm({ name: '', trigger: '', content: '', category: '' });
      setShowSkillForm(false);
      loadSkills();
    } catch (err) { console.error(err); }
  };

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>系统配置</h1>

      {/* System Config */}
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>基础配置</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>配置项</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>说明</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', width: 200 }}>值</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(c => (
              <tr key={c.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{c.key}</td>
                <td style={{ padding: '12px 16px', color: '#666' }}>{c.description || '-'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <input
                    value={editing[c.key] || ''}
                    onChange={e => setEditing({ ...editing, [c.key]: e.target.value })}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 24px', background: '#1890ff', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer',
          }}>
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {/* LLM Config */}
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>AI 模型配置</h2>
        {llmConfig?.configured && (
          <p style={{ color: '#52c41a', marginBottom: 12 }}>
            当前已配置：{llmConfig.provider} / {llmConfig.model}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Provider</label>
            <select
              value={llmForm.provider}
              onChange={e => setLlmForm({ ...llmForm, provider: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Model</label>
            <input
              value={llmForm.model}
              onChange={e => setLlmForm({ ...llmForm, model: e.target.value })}
              placeholder="e.g. claude-sonnet-4-20250514"
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>API Key</label>
            <input
              type="password"
              value={llmForm.api_key}
              onChange={e => setLlmForm({ ...llmForm, api_key: e.target.value })}
              placeholder={llmConfig?.configured ? '(已配置，留空不修改)' : '输入 API Key'}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
            />
          </div>
          <div>
            <button onClick={handleLLMSave} disabled={llmSaving} style={{
              padding: '8px 24px', background: '#1890ff', color: '#fff',
              border: 'none', borderRadius: 4, cursor: 'pointer',
            }}>
              {llmSaving ? '保存中...' : '保存 LLM 配置'}
            </button>
          </div>
        </div>
      </div>

      {/* Skills Management */}
      <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Skill 管理</h2>
          <button onClick={() => setShowSkillForm(!showSkillForm)} style={{
            padding: '6px 16px', background: '#1890ff', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer',
          }}>
            {showSkillForm ? '取消' : '添加 Skill'}
          </button>
        </div>

        {showSkillForm && (
          <div style={{ border: '1px solid #f0f0f0', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={skillForm.name}
                onChange={e => setSkillForm({ ...skillForm, name: e.target.value })}
                placeholder="技能名称"
                style={{ padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
              />
              <input
                value={skillForm.trigger}
                onChange={e => setSkillForm({ ...skillForm, trigger: e.target.value })}
                placeholder="触发词（如：/search）"
                style={{ padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
              />
              <input
                value={skillForm.category}
                onChange={e => setSkillForm({ ...skillForm, category: e.target.value })}
                placeholder="分类（可选）"
                style={{ padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
              />
              <textarea
                value={skillForm.content}
                onChange={e => setSkillForm({ ...skillForm, content: e.target.value })}
                placeholder="Skill 内容（Prompt 模板）"
                rows={4}
                style={{ padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4, resize: 'vertical' }}
              />
              <button onClick={handleAddSkill} style={{
                padding: '6px 16px', background: '#52c41a', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer', alignSelf: 'flex-start',
              }}>
                保存
              </button>
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>名称</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>触发词</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>分类</th>
            </tr>
          </thead>
          <tbody>
            {skills.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px' }}>{s.name}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{s.trigger}</td>
                <td style={{ padding: '12px 16px', color: '#666' }}>{s.category || '-'}</td>
              </tr>
            ))}
            {skills.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#999' }}>暂无 Skill</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
