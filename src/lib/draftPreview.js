// Turns draft content (profile_versions.content) into the PUBLIC organization shape used by ProfileView,
// so the preview and the team review show exactly what investors will see. Drops the focal point.
export function draftToPublic(orgMeta, content, { publicState = 'published', approvedAt = null } = {}) {
  const o = content.organization;
  return {
    id: orgMeta.id,
    name: o.name,
    logo_url: o.logo_url,
    cover_url: o.cover_url,
    description: o.description,
    website: o.website,
    city: o.city,
    state: o.state,
    size: o.size,
    segments: o.segments || [],
    partnership_types: o.partnership_types || [],
    leadership: o.leadership || [],
    gallery: o.gallery || [],
    public_state: publicState,
    last_approved_at: approvedAt,
    is_featured: false,
    projects: content.projects.map((p) => ({ id: p.id, profile_type: p.profile_type, summary: p.summary, fields: p.fields })),
  };
}
