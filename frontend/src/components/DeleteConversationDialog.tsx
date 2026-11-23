import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

type Props = {
  conversationTitle: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConversationDialog({ conversationTitle, onCancel, onConfirm }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!conversationTitle) return;
    cancelRef.current?.focus();
  }, [conversationTitle]);

  if (!conversationTitle) return null;

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Tab') {
      const first = cancelRef.current;
      const last = deleteRef.current;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return <div className="dialog-backdrop delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onKeyDown={handleKeyDown}>
      <div className="delete-dialog-icon"><AlertTriangle size={20} /></div>
      <h2 id="delete-dialog-title">Delete this conversation?</h2>
      <p id="delete-dialog-description">“{conversationTitle}” will be removed from this browser. This can’t be undone.</p>
      <div className="delete-dialog-actions">
        <button ref={cancelRef} className="secondary-button" onClick={onCancel}>Keep conversation</button>
        <button ref={deleteRef} className="danger-button" onClick={onConfirm}><Trash2 size={15} />Delete conversation</button>
      </div>
    </section>
  </div>;
}
