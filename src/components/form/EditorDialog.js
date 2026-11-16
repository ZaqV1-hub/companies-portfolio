import { cx, html, React, useEffect, useRef } from '../../lib/html.js';
import { useI18n } from '../../lib/i18n.js';

export function EditorDialog({ title, description, children, action, onConfirm, onClose, busy, confirmDisabled, compact, danger }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const titleId = React.useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    dialog.querySelector('.profile-editor-dialog-body input:not([type=file]), .profile-editor-dialog-body select, .profile-editor-dialog-body textarea')?.focus({ preventScroll:true });
    return () => dialog.close();
  }, []);
  return html`<dialog ref=${ref} class=${cx('profile-editor-dialog',compact && 'compact')} aria-labelledby=${titleId}
      aria-describedby=${description ? titleId+'-description' : undefined}
      onClick=${(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}
      onCancel=${(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div class="profile-editor-dialog-header">
      <div><h2 id=${titleId}>${title}</h2>${description && html`<p id=${titleId+'-description'}>${description}</p>`}</div>
      <button class="profile-editor-dialog-close" type="button" aria-label=${t('common.close')} disabled=${busy} onClick=${onClose}>×</button>
    </div>
    ${children && html`<div class="profile-editor-dialog-body">${children}</div>`}
    <div class="profile-editor-dialog-actions">
      <button type="button" class="btn btn-outline" disabled=${busy} onClick=${onClose}>${t('form.editor_cancel')}</button>
      <button type="button" class=${cx('btn',danger ? 'profile-editor-dialog-danger' : 'btn-lime')} disabled=${busy || confirmDisabled} onClick=${onConfirm}>${action}</button>
    </div>
  </dialog>`;
}
