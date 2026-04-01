'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { OrgNode } from '@/types';

export default function OrgManagePage() {
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('team');
  const [parentId, setParentId] = useState('');

  const loadNodes = async () => {
    try {
      const data = await api.get<OrgNode[]>('/org/nodes');
      setNodes(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadNodes(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await api.post('/org/nodes', { name: newName, type: newType, parent_id: parentId || null });
    setNewName('');
    loadNodes();
  };

  if (loading) return <p>加载中...</p>;

  const rootNodes = nodes.filter(n => !n.parent_id);

  const renderTree = (nodeId: string | null, depth: number = 0): JSX.Element[] => {
    const children = nodes.filter(n => n.parent_id === nodeId);
    return children.flatMap(node => [
      <div key={node.id} style={{ padding: '8px 16px', paddingLeft: 16 + depth * 24, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <span>
          <span style={{ color: '#999', fontSize: 12, marginRight: 8 }}>[{node.type}]</span>
          {node.name}
        </span>
        <span style={{ color: '#999', fontSize: 12 }}>{node.id.substring(0, 8)}...</span>
      </div>,
      ...renderTree(node.id, depth + 1),
    ]);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>组织管理</h1>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>新增节点</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="节点名称" value={newName} onChange={e => setNewName(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 4, flex: 1 }} />
          <select value={newType} onChange={e => setNewType(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <option value="region">大区</option>
            <option value="team">战队</option>
            <option value="custom">自定义</option>
          </select>
          <select value={parentId} onChange={e => setParentId(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <option value="">无父节点</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <button onClick={handleCreate} style={{ padding: '6px 16px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>添加</button>
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 8 }}>
        <h3 style={{ padding: '16px 16px 8px' }}>组织树</h3>
        {renderTree(null)}
        {nodes.filter(n => !n.parent_id).length === 0 && <p style={{ padding: 16, color: '#999' }}>暂无节点</p>}
      </div>
    </div>
  );
}
