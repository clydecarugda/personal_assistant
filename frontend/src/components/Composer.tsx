import { ArrowUp, Paperclip, Square, X } from 'lucide-react';
import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  generating: boolean;
  attachments: File[];
  onAttach: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;
};

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Composer({ value, onChange, onSend, onStop, generating, attachments, onAttach, onRemoveAttachment }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resize = (text: string) => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 180)}px`;
  };
  return <div className="composer-wrap"><form className="composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
    <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept=".txt,.md,.pdf,.docx,.csv,.json" aria-label="Choose files to attach" onChange={(event) => { onAttach(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
    {attachments.length > 0 && <div className="attachment-list" aria-label="Files attached to this message">{attachments.map((file, index) => <div className="attachment-chip" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}><Paperclip size={13} /><span className="attachment-name" title={file.name}>{file.name}</span><span className="attachment-size">{formatBytes(file.size)}</span><button type="button" className="remove-attachment" onClick={() => onRemoveAttachment(index)} aria-label={`Remove ${file.name}`} title={`Remove ${file.name}`}><X size={13} /></button></div>)}</div>}
    <textarea ref={ref} rows={1} value={value} onChange={(event) => { onChange(event.target.value); resize(event.target.value); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} placeholder={attachments.length ? 'Ask something about these files...' : 'Ask anything about your notes...'} aria-label="Message" />
    <div className="composer-actions"><button type="button" className="attach-button" aria-label="Attach files" title="Attach .txt, .md, .pdf, .docx, .csv, or .json files" onClick={() => fileInputRef.current?.click()}><Paperclip size={16} /><span>Attach files</span></button><span className="composer-hint">Shift + Enter for new line</span>{generating ? <button type="button" className="send-button stop-button" aria-label="Stop generating" onClick={onStop}><Square size={13} fill="currentColor" /></button> : <button type="submit" className="send-button" aria-label="Send message" disabled={!value.trim() && attachments.length === 0}><ArrowUp size={18} strokeWidth={2.5} /></button>}</div>
  </form><p className="disclaimer">Files are sent to your configured local backend when you send the message.</p></div>;
}
