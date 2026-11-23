import { useState } from 'react';
import { Bot, Check, ChevronDown, MessageSquare, PanelLeftClose, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import type { Conversation } from '../types';

type Props = {
  conversations: Conversation[];
  activeId: string;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  appName: string;
  hidden: boolean;
  onToggleSidebar: () => void;
  onSettings: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  backendConnected: boolean | null;
};

export function Sidebar({ conversations, activeId, onNew, onSelect, onDelete, appName, hidden, onToggleSidebar, onSettings, mobileOpen, onMobileClose, backendConnected }: Props) {
  const [query, setQuery] = useState('');
  const visible = conversations.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  return <>
    {mobileOpen && <button className="scrim" aria-label="Close navigation" onClick={onMobileClose} />}
    <aside className={`sidebar ${hidden ? 'sidebar-hidden' : ''} ${mobileOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation" aria-hidden={hidden && !mobileOpen} inert={hidden && !mobileOpen}>
      <div className="brand-row"><div className="brand-mark"><Bot size={18} /></div><span className="brand-name">{appName.trim() || 'stillroom'}</span><button className="icon-button sidebar-collapse" aria-label="Hide sidebar" title="Hide sidebar" onClick={onToggleSidebar}><PanelLeftClose size={17} /></button><button className="icon-button mobile-close" aria-label="Close navigation" onClick={onMobileClose}><X size={18} /></button></div>
      <button className="new-chat" onClick={() => { onNew(); onMobileClose(); }}><Plus size={17} strokeWidth={2.2} /><span>New conversation</span><kbd>⌘ K</kbd></button>
      <div className="history-head"><span>YOUR SPACE</span><ChevronDown size={13} /></div>
      <label className="search-box"><Search size={15} /><input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="history-list" role="list" aria-label="Conversation history">
        {visible.length ? visible.map((conversation) => <div key={conversation.id} className="history-entry" role="listitem">
          <button className={`history-item ${activeId === conversation.id ? 'active' : ''}`} onClick={() => { onSelect(conversation.id); onMobileClose(); }}><MessageSquare size={15} /><span>{conversation.title || 'New conversation'}</span></button>
          <button className="delete-chat-button" onClick={() => onDelete(conversation.id)} aria-label={`Delete conversation: ${conversation.title || 'New conversation'}`} title="Delete conversation"><Trash2 size={14} /></button>
        </div>) : <p className="empty-history">No conversations yet</p>}
      </div>
      <div className="sidebar-bottom">
        <div className="model-card"><div className="model-icon"><Bot size={15} /></div><div className="model-copy"><span className="model-title">Local model</span><span className="model-subtitle" aria-live="polite">{backendConnected === null ? 'Checking connection…' : backendConnected ? 'Backend connected' : 'Preview mode'}</span></div><span className={`status-dot ${backendConnected === false ? 'status-offline' : ''}`} aria-label={backendConnected ? 'Backend connected' : backendConnected === false ? 'Backend unavailable' : 'Checking backend'} title="Flask backend status" /></div>
        <button className="settings-button" onClick={() => { onSettings(); onMobileClose(); }}><Settings2 size={16} /><span>Settings</span></button>
        <div className="privacy-note"><span className="privacy-lock">◈</span><span>History stays in this<br />browser profile.</span><Check size={13} /></div>
      </div>
    </aside>
  </>;
}
