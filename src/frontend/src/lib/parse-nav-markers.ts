/**
 * 解析 AI 回复里的 [[nav:label|url]] 标记，把消息切成 text 段 + nav 段。
 * PC chat-sidebar 渲染成跳转按钮；移动 chat-fullscreen 渲染成 ChatFormCard 待确认卡。
 */

export type Segment =
  | { type: 'text'; value: string }
  | { type: 'nav'; label: string; url: string };

export function parseNavMarkers(text: string): Segment[] {
  const parts: Segment[] = [];
  const regex = /\[\[nav:(.+?)\|(.+?)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'nav', label: match[1].trim(), url: match[2].trim() });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}
