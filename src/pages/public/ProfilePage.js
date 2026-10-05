// Public profile page: loads the public organization and renders ProfileView.
import { html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';
import { href, navigate } from '../../lib/router.js';
import { ProfileView } from '../../components/profile/ProfileView.js';

export function ProfilePage({ orgId, projectId, onRequestContact }) {
  const { t } = useI18n();
  const [org, setOrg] = useState(undefined);
  const [sent, setSent] = useState({});

  useEffect(() => { setOrg(undefined); api.getPublicOrganization(orgId).then(setOrg); }, [orgId]);

  if (org === undefined) return html`<div class="section">${t('common.loading')}</div>`;
  if (org === null) return html`<div class="empty-state"><strong>${t('common.not_found')}</strong><a href=${href('/')}>${t('common.back_to_directory')}</a></div>`;

  const current = projectId || org.projects[0].id;
  const request = async (pid) => {
    const result = await onRequestContact(org, pid);
    if (result === 'sent') setSent({ ...sent, [pid]: true });
  };
  return html`<${ProfileView} org=${org} projectId=${current} backHref=${href('/')}
    onSelectProject=${(pid) => navigate('/org/' + org.id + '?project=' + pid, { keepScroll: true })}
    onRequestContact=${request} contactState=${sent[current] ? 'sent' : null} />`;
}
