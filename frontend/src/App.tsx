import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Menu, Moon, Sparkles, Sun } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { Composer } from './components/Composer';
import { SettingsDialog } from './components/SettingsDialog';
import { DeleteConversationDialog } from './components/DeleteConversationDialog';
import { checkBackend, sendChat } from './lib/chatApi';
import { loadConversations, saveConversations } from './lib/storage';
import type { Conversation, Message } from './types';

const makeId = () => crypto.randomUUID();
const starter: Conversation = { id: makeId(), title: 'New conversation', updatedAt: Date.now(), messages: [] };

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = loadConversations();
    return saved.length ? saved : [starter];
  });
  const [activeId, setActiveId] = useState(() => loadConversations()[0]?.id ?? starter.id);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem('stillroom.theme') === 'dark'; } catch { return false; } });
  const [sidebarHidden, setSidebarHidden] = useState(() => { try { return localStorage.getItem('stillroom.sidebarHidden') === 'true'; } catch { return false; } });
  const [appName, setAppName] = useState(() => { try { return localStorage.getItem('stillroom.appName') || 'stillroom'; } catch { return 'stillroom'; } });
  const [assistantName, setAssistantName] = useState(() => { try { return localStorage.getItem('stillroom.assistantName') || 'Stillroom'; } catch { return 'Stillroom'; } });
  const controllerRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];

  useEffect(() => saveConversations(conversations), [conversations]);
  useLayoutEffect(() => {
    shouldStickToBottomRef.current = true;
    const panel = chatScrollRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [activeId]);
  useLayoutEffect(() => {
    const panel = chatScrollRef.current;
    if (panel && shouldStickToBottomRef.current) panel.scrollTop = panel.scrollHeight;
  }, [active?.messages]);
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try { localStorage.setItem('stillroom.theme', darkMode ? 'dark' : 'light'); } catch { /* Theme still works for this session if storage is unavailable. */ }
  }, [darkMode]);
  useEffect(() => {
    try { localStorage.setItem('stillroom.sidebarHidden', String(sidebarHidden)); } catch { /* Sidebar preference is session-only if storage is unavailable. */ }
  }, [sidebarHidden]);
  useEffect(() => {
    try { localStorage.setItem('stillroom.appName', appName); } catch { /* Name settings remain active for this session. */ }
  }, [appName]);
  useEffect(() => {
    try { localStorage.setItem('stillroom.assistantName', assistantName); } catch { /* Name settings remain active for this session. */ }
  }, [assistantName]);
  useEffect(() => {
    let mounted = true;
    let checking = false;
    let timer = 0;
    const refresh = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      const connected = await checkBackend();
      checking = false;
      if (!mounted) return;
      setBackendConnected(connected);
      timer = window.setTimeout(refresh, 5000);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timer);
        void refresh();
      }
    };
    void refresh();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); createConversation(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
  useEffect(() => () => controllerRef.current?.abort(), []);

  function updateConversation(id: string, updater: (conversation: Conversation) => Conversation) {
    setConversations((current) => current.map((item) => item.id === id ? updater(item) : item));
  }
  function createConversation() {
    shouldStickToBottomRef.current = true;
    const item: Conversation = { id: makeId(), title: 'New conversation', updatedAt: Date.now(), messages: [] };
    setConversations((current) => [item, ...current]); setActiveId(item.id); setNotice('');
  }
  function stopGeneration() { controllerRef.current?.abort(); controllerRef.current = null; setGenerating(false); }
  function requestDeleteConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (conversation) setDeleteTarget(conversation);
  }
  function deleteConversation() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    if (id === activeId && controllerRef.current) stopGeneration();
    const remaining = conversations.filter((item) => item.id !== id);
    if (remaining.length) {
      setConversations(remaining);
      if (id === activeId) setActiveId(remaining[0].id);
    } else {
      const fresh: Conversation = { id: makeId(), title: 'New conversation', updatedAt: Date.now(), messages: [] };
      setConversations([fresh]);
      setActiveId(fresh.id);
    }
    setNotice('');
    setDeleteTarget(null);
  }
  function addAttachments(incoming: File[]) {
    const maxCount = 5;
    const maxBytes = 20 * 1024 * 1024;
    const supported = /\.(txt|md|pdf|docx|csv|json)$/i;
    const rejected = incoming.filter((file) => !supported.test(file.name) || file.size > maxBytes);
    const accepted = incoming.filter((file) => supported.test(file.name) && file.size <= maxBytes);
    const unique = accepted.filter((file) => !attachments.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified));
    const room = Math.max(0, maxCount - attachments.length);
    const skipped = rejected.length + Math.max(0, unique.length - room);
    setAttachments([...attachments, ...unique.slice(0, room)]);
    setNotice(skipped ? 'Some files were skipped. Attach up to 5 supported files, each no larger than 20 MB.' : '');
  }
  function toggleNavigation() {
    if (window.matchMedia('(max-width: 760px)').matches) setMobileOpen(true);
    else setSidebarHidden((hidden) => !hidden);
  }
  function handleChatScroll() {
    const panel = chatScrollRef.current;
    if (!panel) return;
    shouldStickToBottomRef.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 96;
  }
  function selectConversation(id: string) {
    shouldStickToBottomRef.current = true;
    setActiveId(id);
  }
  async function send() {
    const attachedFiles = [...attachments];
    const typedText = draft.trim();
    if ((!typedText && attachedFiles.length === 0) || generating || !active) return;
    const text = typedText || `Please read and summarize the attached file(s): ${attachedFiles.map((file) => file.name).join(', ')}`;
    shouldStickToBottomRef.current = true;
    setDraft(''); setAttachments([]); setNotice('');
    const userMessage: Message = { id: makeId(), role: 'user', content: text, createdAt: Date.now() };
    const assistantMessage: Message = { id: makeId(), role: 'assistant', content: '', createdAt: Date.now() };
    const id = active.id;
    updateConversation(id, (conversation) => ({ ...conversation, title: conversation.messages.length ? conversation.title : text.slice(0, 44), updatedAt: Date.now(), messages: [...conversation.messages, userMessage, assistantMessage] }));
    const controller = new AbortController(); controllerRef.current = controller; setGenerating(true);
    try {
      const messages = [...active.messages, userMessage]
        .filter((message) => message.content.trim().length > 0)
        .map(({ role, content }) => ({ role, content }));
      const result = await sendChat({ message: text, conversation_id: id, messages }, controller.signal, (token) => {
        updateConversation(id, (conversation) => ({ ...conversation, messages: conversation.messages.map((message) => message.id === assistantMessage.id ? { ...message, content: message.content + token } : message) }));
      }, attachedFiles);
      if (result.source === 'mock') setNotice('Preview response · backend not connected');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setNotice('The response stopped unexpectedly. Please try again.');
        updateConversation(id, (conversation) => ({ ...conversation, messages: conversation.messages.filter((message) => message.id !== assistantMessage.id) }));
      }
    } finally { if (controllerRef.current === controller) { controllerRef.current = null; setGenerating(false); } }
  }

  return <div className="app-shell">
    <Sidebar conversations={conversations} activeId={active?.id ?? ''} onNew={createConversation} onSelect={selectConversation} onDelete={requestDeleteConversation} appName={appName} hidden={sidebarHidden} onToggleSidebar={() => setSidebarHidden((hidden) => !hidden)} onSettings={() => setSettingsOpen(true)} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} backendConnected={backendConnected} />
    <main className="main-panel">
      <header className="topbar"><button className="icon-button menu-button" aria-label={sidebarHidden ? 'Show sidebar' : 'Toggle sidebar'} title={sidebarHidden ? 'Show sidebar' : 'Toggle sidebar'} onClick={toggleNavigation}><Menu size={19} /></button><div className="breadcrumb">Personal space <span>/</span> <strong>{active?.title ?? 'New conversation'}</strong></div><div className="topbar-right"><span className="local-tag"><span className="status-dot" /> Local &amp; private</span><button className="icon-button theme-toggle" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button><span className="topbar-separator" /><span className="avatar-mini">C</span></div></header>
      <div ref={chatScrollRef} onScroll={handleChatScroll} className={`chat-scroll ${active?.messages.length ? 'has-messages' : ''}`}>
        {active?.messages.length ? <div className="messages-area">{active.messages.map((message) => <ChatMessage key={message.id} message={message} assistantName={assistantName.trim() || 'Stillroom'} />)}{generating && active.messages.at(-1)?.content === '' && <div className="typing-indicator" role="status" aria-label="Assistant is responding"><span /><span /><span /></div>}</div> : <section className="welcome"><div className="welcome-icon"><Sparkles size={21} /></div><p className="eyebrow">A LITTLE SPACE TO THINK</p><h1>Good to see you.</h1><p className="welcome-copy">Your personal assistant, ready when you are.<br />Ask a question or explore something on your mind.</p><div className="suggestions"><button onClick={() => setDraft('Summarize the key ideas in my notes')}> <span>✳</span> Summarize my notes <span className="suggestion-arrow">↗</span></button><button onClick={() => setDraft('Help me think through a problem')}> <span>◇</span> Think through a problem <span className="suggestion-arrow">↗</span></button><button onClick={() => setDraft('What can you help me with?')}> <span>⌘</span> What can you help with? <span className="suggestion-arrow">↗</span></button></div></section>}
      </div>
      <div className="composer-dock">{notice && <div className="notice" role="status">{notice}</div>}<Composer value={draft} onChange={setDraft} onSend={send} onStop={stopGeneration} generating={generating} attachments={attachments} onAttach={addAttachments} onRemoveAttachment={(index) => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></div>
    </main>
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} appName={appName} assistantName={assistantName} onAppNameChange={setAppName} onAssistantNameChange={setAssistantName} />
    <DeleteConversationDialog conversationTitle={deleteTarget?.title || (deleteTarget ? 'New conversation' : null)} onCancel={() => setDeleteTarget(null)} onConfirm={deleteConversation} />
  </div>;
}
