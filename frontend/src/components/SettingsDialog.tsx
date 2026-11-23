import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  appName: string;
  assistantName: string;
  onAppNameChange: (value: string) => void;
  onAssistantNameChange: (value: string) => void;
};

export function SettingsDialog({ open, onClose, appName, assistantName, onAppNameChange, onAssistantNameChange }: Props) {
  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="dialog-header"><div><p className="eyebrow">PREFERENCES</p><h2 id="settings-title">Settings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={18} /></button></div>
    <div className="name-settings">
      <label className="name-setting"><span>App name</span><input value={appName} maxLength={32} onChange={(event) => onAppNameChange(event.target.value)} placeholder="stillroom" /></label>
      <label className="name-setting"><span>Assistant name</span><input value={assistantName} maxLength={32} onChange={(event) => onAssistantNameChange(event.target.value)} placeholder="Stillroom" /></label>
      <p className="setting-help">These names appear in the sidebar and above assistant replies.</p>
    </div>
    <div className="setting-row"><div><strong>Local first</strong><p>Conversation history is stored in this browser.</p></div><span className="setting-badge">On</span></div><div className="setting-row"><div><strong>Backend connection</strong><p>Configure <code>VITE_API_BASE_URL</code> in <code>.env</code>.</p></div><span className="setting-badge neutral">Optional</span></div><div className="dialog-footer"><span>Stillroom · Phase 1</span><button className="primary-button" onClick={onClose}>Done</button></div></section></div>;
}
