import { html, useEffect, useRef } from '../../lib/html.js';
import { useI18n } from '../../lib/i18n.js';

export function EditorDialog({ title, children, action, onConfirm, onClose, busy }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return html`<dialog ref=${ref} class="profile-editor-dialog" aria-label=${title}
      onCancel=${(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 class="block-title">${title}</h2>
    <div class="profile-editor-dialog-body">${children}</div>
    <div class="profile-editor-dialog-actions">
      <button type="button" class="btn btn-outline" disabled=${busy} onClick=${onClose}>${t('form.editor_cancel')}</button>
      <button type="button" class="btn btn-lime" disabled=${busy} onClick=${onConfirm}>${action}</button>
    </div>
  </dialog>`;
}
