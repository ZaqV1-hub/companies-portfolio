#!/usr/bin/env python3
"""Builds data/seed/*.json (one file per entity) from orgs_existing.py + orgs_new.py + the CRM data below.

Run: python3 tools/seed/build_seed.py
The JSON files are what the app (src/services/mockStore.js) loads. This script is only a dev
tool to keep the seed consistent; the real data will come from the Google Forms import.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import enums as E  # noqa: E402
from helpers import T  # noqa: E402
import orgs_existing  # noqa: E402
import orgs_new  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'seed')
TODAY = '2026-10-05'

ORG_FIELDS = ('name', 'logo', 'description', 'website', 'city', 'state', 'size', 'segments', 'partnership_types',
              'leadership', 'cover', 'gallery')
APPROVED = {  # date of the last approval ("Atualizado em") for published organizations
    'imunotera': '2026-09-22', 'nintx': '2026-09-10', 'techtrials': '2026-09-18', 'huna': '2026-09-25',
    'croplabs': '2026-09-12', 'embrapa': '2026-09-08', 'biomanguinhos': '2026-09-15', 'aurora': '2026-09-29',
    'vitalbio': '2026-09-19', 'biofactor': '2026-09-24', 'nexa': '2026-09-17', 'amazonia': '2026-09-26',
    'lumina': '2026-09-30',
}


def check(value, allowed, where):
    vals = value if isinstance(value, list) else [value]
    for v in vals:
        if v not in allowed:
            raise SystemExit('invalid value %r for %s (allowed: %s)' % (v, where, allowed))


def validate_project(p):
    t = p['type']
    f = p
    check(t, E.PROFILE_TYPES, 'profile_type')
    if 'target_markets' in f: check(f.get('target_markets', []), E.MARKETS, 'target_markets')
    if t == 'A':
        check(f['regulatory_phase'], E.REGULATORY_PHASE, 'regulatory_phase')
        if 'fto' in f: check(f.get('fto', []), E.FTO, 'fto')
        for r in f.get('rounds', []): check(r['stage'], E.ROUND_STAGE, 'round.stage')
        for r in f.get('raised', []): check(r['source'], E.RAISED_SOURCE, 'raised.source')
        if 'gtm_models' in f: check(f.get('gtm_models', []), E.GTM_MODELS, 'gtm_models')
    if t == 'B':
        check(f['maturity'], E.MATURITY, 'maturity')
        check(f.get('technology_tags', []), E.TECHNOLOGY_TAGS, 'technology_tags')
        check(f.get('business_models', []), E.BUSINESS_MODELS, 'business_models')
    if t == 'C':
        check(f.get('services', []), E.C_SERVICES, 'C.services')
        check(f.get('molecule_types', []), E.MOLECULE_TYPES, 'molecule_types')
        check(f.get('capacity_scales', []), E.CAPACITY_SCALE, 'capacity_scales')
        check(f.get('certifications', []), E.C_CERTIFICATIONS, 'C.certifications')
        check(f.get('client_profiles', []), E.CLIENT_PROFILES, 'client_profiles')
        check(f.get('investment_types', []), E.C_INVESTMENT_TYPES, 'C.investment_types')
    if t == 'D':
        check(f.get('services', []), E.D_SERVICES, 'D.services')
        check(f.get('therapeutic_areas', []), E.THERAPEUTIC_AREAS, 'therapeutic_areas')
        check(f.get('certifications', []), E.D_CERTIFICATIONS, 'D.certifications')
        check(f.get('client_profiles', []), E.CLIENT_PROFILES, 'client_profiles')
        check(f.get('investment_types', []), E.D_INVESTMENT_TYPES, 'D.investment_types')
    if t == 'E':
        check(f.get('certifications', []), E.E_CERTIFICATIONS, 'E.certifications')
        check(f.get('partnership_models', []), E.E_PARTNERSHIP_MODELS, 'E.partnership_models')
        check(f.get('export_markets', []), E.MARKETS, 'export_markets')
    if t == 'F':
        check(f.get('certifications', []), E.F_CERTIFICATIONS, 'F.certifications')
        check(f.get('partnership_models', []), E.F_PARTNERSHIP_MODELS, 'F.partnership_models')
        check(f.get('markets_served', []), E.MARKETS, 'markets_served')


def build_profile_entities():
    organizations, projects = [], []
    for o in orgs_existing.ORGS + orgs_new.ORGS:
        check(o['status'], E.ORG_STATUS, 'status')
        check(o['public_state'], E.PUBLIC_STATE, 'public_state')
        check(o.get('size') or 'startup', E.SIZE, 'size')
        check(o['segments'], E.SEGMENTS, 'segments')
        check(o['partnership_types'], E.PARTNERSHIP_TYPES, 'partnership_types')
        oid = o['id']
        organizations.append({
            'id': oid,
            'name': o['name'],
            'logo_url': o.get('logo'),
            'cover_url': o.get('cover') or 'https://picsum.photos/seed/%s-hero/1600/720' % oid,
            'description': o['description'],
            'website': o.get('website'),
            'city': o.get('city'),
            'state': o.get('state'),
            'size': o.get('size'),
            'segments': o['segments'],
            'partnership_types': o['partnership_types'],
            'leadership': o.get('leadership', []),
            'gallery': [{'url': u, 'caption': c} for u, c in o.get('gallery', [])],
            # internal: never sent to public screens (spec 1, 6.4)
            'focal_point': {
                'name': 'Ponto focal %s' % o['name'], 'role': 'Diretor(a) de negócios',
                'email': 'contato@%s.example' % oid, 'phone': '+55 11 9%04d-%04d' % (len(oid) * 137 % 10000, len(o['name']) * 911 % 10000),
            },
            'status': o['status'],
            'public_state': o['public_state'],
            'is_featured': bool(o.get('featured')),
            'last_approved_at': APPROVED.get(oid),
            'invited_at': '2026-08-20',
            'last_updated_at': APPROVED.get(oid) or '2026-06-30',
            'created_at': '2026-06-30',
            # demo = fictitious organization created only for the demo: remove before publishing
            'demo': bool(o.get('fictitious')),
            'seed_note': 'fictitious' if o.get('fictitious') else 'from June/2026 prototype; PT texts and some fields filled for the demo',
        })
        for i, p in enumerate(o['projects']):
            validate_project(p)
            fields = {k: v for k, v in p.items() if k not in ('id', 'type', 'summary', 'demo')}
            # list-of-pairs → objects
            if 'pipeline' in fields:
                fields['pipeline'] = [{'name': n, 'indication': ind} for n, ind in fields['pipeline']]
            for key, a, b in (('product_portfolio', 'category', 'description'), ('partnership_interests', 'area', 'description')):
                if key in fields:
                    fields[key] = [{a: x, b: y} for x, y in fields[key]]
            projects.append({
                'id': p['id'], 'organization_id': oid, 'profile_type': p['type'], 'sort_order': i,
                # fictitious project (whole demo organization, or an extra project added to a real one)
                'demo': bool(o.get('fictitious') or p.get('demo')),
                'summary': p.get('summary'),
                'fields': fields,
            })
    return organizations, projects


# ------------------------------------------------------------------ Google Forms pre-load (spec 1, section 7)
# Which fields came from the form ("Importado do formulário · confirme") and which are reference only
# ("Resposta anterior: …"). The previous answers below are the raw June/2026 texts (or fictitious ones).
def build_form_imports(projects, organizations):
    raw = {
        'imunotera-terah7': {
            'rounds': 'USD 1M (Seed) · USD 3M (Series A)',
            'raised': 'FAPESP (USD 1.11M), CNPq (USD 57K), Catalisa ICT (USD 22K), awards (USD 33K), angel investor (USD 39K) and donations (USD 19K)',
        },
        'heptech-lmwh': {'rounds': 'USD 3M', 'raised': 'FINEP (USD 1M) and B2B partner (USD 1M)'},
        'krabs-klk7': {'rounds': 'USD 1M', 'raised': 'FAPESP and FINEP (~USD 539K)', 'revenue': 'annual revenue ~USD 30K'},
        'cellertz-cellbite': {'rounds': 'USD 1.8M (pre-seed completion)', 'raised': 'USD 600K via VC + R$4M in a partner project'},
        'aptah-apt20': {'rounds': 'USD 20M (Series A)', 'raised': 'R$48M in grants, angel investors and venture capital'},
        'wecare-topical': {'rounds': 'USD 6M (current round) · USD 24M (next round)',
                           'raised': 'FINEP (USD 1.14M), FAPESP (USD 347K), Seed (USD 597K), angel (USD 539K)', 'revenue': 'annual revenue ~USD 578K'},
        'nintx-ntx06': {'rounds': 'USD 30M (Series B)', 'raised': 'USD 13M via VCs (Pitanga, ECOA, MOV) and USD 5M in grants'},
        'mirscience-mt01': {'rounds': 'USD 5M', 'raised': 'R$1.2M'},
        'biocase-psilo': {'rounds': 'USD 6M', 'raised': 'USD 1.5M (family office and grants)', 'revenue': 'annual revenue ~USD 400K'},
        'celluris-cart': {'rounds': 'USD 20M', 'raised': 'USD 3M'},
        'microforge-synbio': {'revenue': 'USD 20K/year'},
        'techtrials-rwe': {'revenue': 'USD 400K/year'},
        'huna-ai': {'rounds': 'USD 5M (Seed)', 'raised': 'USD 2M+ via VCs, impact funds and angel investors'},
        'croplabs-pharma': {'revenue': 'USD 600K/year (last fiscal year)', 'exports': '12% of revenue — North America, Europe, Latin America'},
        'ionvet-cro': {'revenue': 'USD 828,745/year (last fiscal year)', 'exports': 'Seeking investment for expansion and distribution models.'},
        'embrapa-genomics': {'investment_range': 'USD 100K – USD 10M+'},
        'biomanguinhos-main': {'investment_range': 'USD 50M'},
        'aurora-au101': {'rounds': 'R$ 80 milhões para a Fase II', 'revenue': 'Faturamento 2025: R$ 1,7 bi'},
        'aurora-packaging': {'market_share': 'cerca de 15% do mercado nacional', 'revenue': 'R$ 97 mi', 'exports': '8% (Argentina, Paraguai)'},
        'pharmaplex-main': {'investment_range': 'entre R$ 20 e R$ 50 milhões'},
    }
    prefilled_by_type = {
        'A': ['segment', 'trl', 'regulatory_phase', 'lead_product_name', 'lead_product_moa', 'pipeline', 'patents_filed',
              'patents_granted', 'fto', 'milestones', 'gtm_models', 'target_markets'],
        'B': ['maturity', 'platform_description', 'technology_tags', 'business_models', 'traction', 'competitive_edge'],
        'C': ['services', 'molecule_types', 'capacity_scales', 'certifications', 'client_count', 'investment_types', 'target_markets'],
        'D': ['services', 'therapeutic_areas', 'models', 'certifications', 'partner_sites', 'client_count', 'investment_types', 'target_markets'],
        'E': ['product_portfolio', 'production_capacity', 'export_markets', 'certifications', 'partnership_interests', 'partnership_models', 'expansion_projects'],
        'F': ['products', 'markets_served', 'certifications', 'partnership_models'],
    }
    out = []
    for p in projects:
        for key in prefilled_by_type[p['profile_type']]:
            if key in p['fields']:
                out.append({'project_id': p['id'], 'organization_id': p['organization_id'], 'field': key, 'mode': 'prefilled', 'previous_answer': None})
        for key, answer in raw.get(p['id'], {}).items():
            out.append({'project_id': p['id'], 'organization_id': p['organization_id'], 'field': key, 'mode': 'reference', 'previous_answer': answer})
    # organization fields (table 5.3): name (col. C) is always pre-filled; size, segments, partnership type and
    # focal point (cols. BM, BN, BO, BK, BL) only exist in 15 of the 39 answers (spec 1, 5.3)
    for o in organizations:
        keys = ['name'] + (['size', 'segments', 'partnership_types', 'focal_point'] if o['size'] else [])
        for key in keys:
            out.append({'project_id': None, 'organization_id': o['id'], 'field': key, 'mode': 'prefilled', 'previous_answer': None})
    for i, row in enumerate(out):
        row['id'] = 'fi-%03d' % (i + 1)
    return out


# ------------------------------------------------------------------ Draft versions (spec 1, 4.2–4.3, 4.6)
def build_versions(organizations, projects):
    by_org = {o['id']: o for o in organizations}

    def snapshot(oid):
        o = by_org[oid]
        org_part = {k: o[k] for k in ('name', 'logo_url', 'cover_url', 'description', 'website', 'city', 'state', 'size',
                                      'segments', 'partnership_types', 'leadership', 'gallery', 'focal_point')}
        return {'organization': json.loads(json.dumps(org_part)),
                'projects': [json.loads(json.dumps({k: p[k] for k in ('id', 'profile_type', 'summary', 'fields')}))
                             for p in projects if p['organization_id'] == oid]}

    versions = []

    # Nintx: published profile + an edit waiting for review (published version stays online).
    c = snapshot('nintx')
    c['organization']['description'] = T(
        'A Nintx desenvolve o NTX-06, ingrediente de origem natural para doença inflamatória intestinal (DII) com abordagem multimecanística, apoiado pelas plataformas próprias xGIbiomics® e GAIApath™. Em 2026 iniciou o estudo clínico de Fase I.',
        'Nintx develops NTX-06, a nature-derived ingredient for IBD with a multi-mechanistic approach, supported by its proprietary xGIbiomics® and GAIApath™ platforms. In 2026 it started its Phase I clinical study.')
    p = c['projects'][0]['fields']
    p['trl'] = 6
    p['milestones'].insert(0, {'period': {'year': 2026, 'month': 9}, 'description': T('Primeiro paciente incluído na Fase I', 'First patient enrolled in Phase I')})
    p['rounds'][0]['amount_usd'] = 25000000
    c['organization']['leadership'].append({'name': 'Beatriz Lemos', 'role': T('Diretora médica', 'Chief Medical Officer'),
                                            'experience': T('Ex-gerente médica de imunologia em multinacional.', 'Former immunology medical manager at a multinational.')})
    versions.append({'id': 'pv-nintx-1', 'organization_id': 'nintx', 'kind': 'draft', 'status': 'in_review', 'content': c,
                     'reviewed_steps': {'organization': True, 'project:nintx-ntx06': True, 'leadership': True, 'images': True},
                     'created_at': '2026-09-28', 'updated_at': '2026-10-01', 'submitted_at': '2026-10-01', 'submitted_by': 'u-nintx',
                     'review_comment': None, 'reviewed_at': None, 'reviewed_by': None})

    # IonVet: provisional profile + first validation submitted (provisional stays online during review).
    c = snapshot('ionvet')
    c['organization'].update({'city': 'Pirassununga', 'state': 'SP', 'website': 'https://www.ionvet.example', 'size': 'startup'})
    c['projects'][0]['fields']['certifications'] = []
    c['projects'][0]['fields']['investment_range'] = {'min': 500000, 'max': 2000000}
    versions.append({'id': 'pv-ionvet-1', 'organization_id': 'ionvet', 'kind': 'draft', 'status': 'in_review', 'content': c,
                     'reviewed_steps': {'organization': True, 'project:ionvet-cro': True, 'leadership': True, 'images': True},
                     'created_at': '2026-09-20', 'updated_at': '2026-09-27', 'submitted_at': '2026-09-27', 'submitted_by': 'u-ionvet',
                     'review_comment': None, 'reviewed_at': None, 'reviewed_by': None})

    # Veritas: new company, first submission (no public profile until the first approval, spec 1, 4.5).
    c = snapshot('veritas')
    versions.append({'id': 'pv-veritas-1', 'organization_id': 'veritas', 'kind': 'draft', 'status': 'in_review', 'content': c,
                     'reviewed_steps': {'organization': True, 'project:veritas-main': True, 'leadership': True, 'images': True},
                     'created_at': '2026-09-25', 'updated_at': '2026-10-03', 'submitted_at': '2026-10-03', 'submitted_by': 'u-veritas',
                     'review_comment': None, 'reviewed_at': None, 'reviewed_by': None})

    # Wecare: filling in the form (draft, not submitted).
    c = snapshot('wecare')
    versions.append({'id': 'pv-wecare-1', 'organization_id': 'wecare', 'kind': 'draft', 'status': 'filling', 'content': c,
                     'reviewed_steps': {'organization': True},
                     'created_at': '2026-09-30', 'updated_at': '2026-10-02', 'submitted_at': None, 'submitted_by': None,
                     'review_comment': None, 'reviewed_at': None, 'reviewed_by': None})

    # Heptech: returned by the team with a comment.
    c = snapshot('heptech')
    versions.append({'id': 'pv-heptech-1', 'organization_id': 'heptech', 'kind': 'draft', 'status': 'returned', 'content': c,
                     'reviewed_steps': {},
                     'created_at': '2026-09-12', 'updated_at': '2026-09-26', 'submitted_at': '2026-09-18', 'submitted_by': 'u-heptech',
                     'review_comment': 'Informe os valores de "Captado até hoje" separados por fonte, em USD, e inclua o site e a cidade da empresa.',
                     'reviewed_at': '2026-09-26', 'reviewed_by': 'u-team-1'})
    return versions


# ------------------------------------------------------------------ Users
def build_users(organizations):
    users = [
        {'id': 'u-team-1', 'role': 'team', 'name': 'Equipe Abiquifi', 'email': 'team@abiquifi.org.br', 'password': 'demo',
         'organization_id': None, 'email_verified_at': '2026-06-01', 'lang': 'pt'},
        {'id': 'u-team-2', 'role': 'team', 'name': 'Equipe B2H', 'email': 'equipe@bio2health.com.br', 'password': 'demo',
         'organization_id': None, 'email_verified_at': '2026-06-01', 'lang': 'pt'},
        {'id': 'u-inv-1', 'role': 'investor', 'name': 'Sarah Chen', 'email': 'sarah.chen@meridiancapital.example', 'password': 'demo',
         'organization_id': None, 'contact_id': 'ct-01', 'email_verified_at': '2026-09-02', 'lang': 'en',
         'investor_profile': {'institution': 'Meridian Capital', 'country': 'US', 'city': 'Boston', 'role': 'Partner',
                              'investor_type': 'vc', 'phone': '+1 617 555 0101', 'linkedin': None},
         'terms_accepted_at': '2026-09-02', 'privacy_accepted_at': '2026-09-02'},
    ]
    for o in organizations:
        if o['status'] == 'awaiting_validation':
            continue  # invitation sent, account not activated yet
        users.append({'id': 'u-%s' % o['id'], 'role': 'company_user', 'name': o['focal_point']['name'],
                      'email': o['focal_point']['email'], 'password': 'demo', 'organization_id': o['id'],
                      'email_verified_at': '2026-08-25', 'lang': 'pt', 'terms_accepted_at': '2026-08-25'})
    return users


# ------------------------------------------------------------------ Contacts registry (spec 2)
def build_crm():
    institutions = [
        dict(id='in-01', name='Meridian Capital', investor_type='vc', niche='vc', ticket_min_musd=1, ticket_max_musd=10, interest_type='direct',
             sectors=['health', 'biotechnology'], description_original='Boston-based life-sciences VC investing from seed to Series B.',
             description_pt='VC de ciências da vida sediado em Boston, investe de seed a Série B.', website='https://www.meridiancapital.example', hq_country='US', hq_city='Boston'),
        dict(id='in-02', name='Blue Harbor Ventures', investor_type='cvc', niche='vc', ticket_min_musd=2, ticket_max_musd=15, interest_type='direct_and_coinvestment',
             sectors=['pharmaceutical'], description_original='Corporate venture arm of a European pharmaceutical group.',
             description_pt='Braço de venture capital corporativo de um grupo farmacêutico europeu.', website='https://www.blueharbor.example', hq_country='DE', hq_city='Frankfurt'),
        dict(id='in-03', name='Andes Growth Partners', investor_type='pe_firm', niche='pe', ticket_min_musd=10, ticket_max_musd=50, interest_type='direct',
             sectors=['health', 'multisector'], description_original=None, description_pt=None, website=None, hq_country='CL', hq_city='Santiago'),
        dict(id='in-04', name='Northstar Health Fund', investor_type='vc', niche='vc_impact', ticket_min_musd=0.5, ticket_max_musd=5, interest_type='direct',
             sectors=['health'], description_original='Impact fund focused on access to healthcare in emerging markets.',
             description_pt='Fundo de impacto focado em acesso à saúde em mercados emergentes.', website='https://www.northstarhealth.example', hq_country='GB', hq_city='London'),
        dict(id='in-05', name='Cascade Life Sciences', investor_type='organization', niche=None, ticket_min_musd=None, ticket_max_musd=None, interest_type='licensing',
             sectors=['biotechnology', 'pharmaceutical'], description_original=None, description_pt=None, website=None, hq_country='US', hq_city='Seattle'),
        dict(id='in-06', name='Ipê Investimentos', investor_type='family_office', niche='pevc', ticket_min_musd=1, ticket_max_musd=8, interest_type='direct',
             sectors=['health'], description_original=None, description_pt='Family office brasileiro com tese em saúde.', website=None, hq_country='BR', hq_city='São Paulo'),
        dict(id='in-07', name='Union Bay Capital', investor_type='vc', niche='vc', ticket_min_musd=3, ticket_max_musd=20, interest_type='coinvestment',
             sectors=['biotechnology'], description_original=None, description_pt=None, website=None, hq_country='US', hq_city='San Francisco'),
        dict(id='in-08', name='Kyoto BioPartners', investor_type='organization', niche=None, ticket_min_musd=None, ticket_max_musd=None, interest_type='tech_transfer',
             sectors=['pharmaceutical'], description_original='Japanese mid-size pharma seeking in-licensing.', description_pt=None, website=None, hq_country='JP', hq_city='Kyoto'),
        dict(id='in-09', name='Solace Partners', investor_type='angel_network', niche='vc', ticket_min_musd=0.1, ticket_max_musd=1, interest_type='direct',
             sectors=['health'], description_original=None, description_pt=None, website=None, hq_country='PT', hq_city='Lisboa'),
    ]
    contacts = [
        dict(id='ct-01', institution_id='in-01', name='Sarah Chen', email='sarah.chen@meridiancapital.example', country='US', city='Boston', role='Partner', linkedin='https://www.linkedin.com/in/sarah-chen-example', phone='+1 617 555 0101'),
        dict(id='ct-02', institution_id='in-02', name='Michael Bennett', email='m.bennett@blueharbor.example', country='DE', city='Frankfurt', role='Investment Director', linkedin=None, phone=None),
        dict(id='ct-03', institution_id='in-03', name='Elena Reyes', email='elena.reyes@andesgrowth.example', country='CL', city='Santiago', role=None, linkedin=None, phone=None),
        dict(id='ct-04', institution_id='in-04', name='James Okafor', email='james@northstarhealth.example', country='GB', city='London', role='Principal', linkedin='https://www.linkedin.com/in/james-okafor-example', phone='+44 20 5555 0104'),
        dict(id='ct-05', institution_id='in-05', name='Priya Kapoor', email='priya.kapoor@cascadels.example', country='US', city='Seattle', role='BD Director', linkedin=None, phone=None),
        dict(id='ct-06', institution_id='in-06', name='Fernanda Costa', email='fernanda@ipeinvest.example', country='BR', city='São Paulo', role='Sócia', linkedin=None, phone='+55 11 95555-0106'),
        dict(id='ct-07', institution_id='in-07', name='Thomas Nakamura', email='t.nakamura@unionbay.example', country='US', city='San Francisco', role='Associate', linkedin=None, phone=None),
        dict(id='ct-08', institution_id='in-08', name='Kenji Sato', email='k.sato@kyotobio.example', country='JP', city='Kyoto', role='Head of Licensing', linkedin=None, phone=None),
        dict(id='ct-09', institution_id='in-09', name='Olivia Park', email='olivia@solace.example', country='PT', city='Lisboa', role=None, linkedin=None, phone=None),
        # possible duplicate of ct-02 (same person, other e-mail): goes to the team's validation queue
        dict(id='ct-10', institution_id='in-02', name='Michael Bennet', email='michael.bennett@gmail.example', country='DE', city='Frankfurt', role=None, linkedin=None, phone=None),
    ]
    O = 'Portfólio'
    relationships = [
        # Sarah Chen talks to 3 companies: each company only sees its own relationship.
        dict(id='rel-01', contact_id='ct-01', organization_id='nintx', origin=O, status='in_progress', classification='nia', classification_state='validated',
             suggested={'value': 'nia', 'justification': 'Três reuniões e NDA assinado.', 'at': '2026-09-12', 'by': 'u-nintx', 'state': 'validated'}, validated_at='2026-09-15', validated_by='u-team-1'),
        dict(id='rel-02', contact_id='ct-01', organization_id='huna', origin='BIO Convention', status='in_progress', classification='lead', classification_state='validated'),
        dict(id='rel-03', contact_id='ct-01', organization_id='imunotera', origin=O, status='in_progress', classification='lead', classification_state='validated', contact_request_at='2026-09-22'),
        dict(id='rel-04', contact_id='ct-02', organization_id='nintx', origin='JPM', status='deal', classification='nia', classification_state='validated',
             npia={'type': 'e', 'date': '2026-09-30', 'amount_usd': 8000000, 'description': 'Term sheet assinado para liderar a Série B.', 'confidential': True, 'state': 'pending', 'at': '2026-10-01', 'by': 'u-nintx'},
             deal_expectation={'min_usd': 5000000, 'max_usd': 10000000, 'type': 'investment'}),
        dict(id='rel-05', contact_id='ct-03', organization_id='aurora', origin='Invest in Brazil Day', status='in_progress', classification='lead', classification_state='validated'),
        dict(id='rel-06', contact_id='ct-04', organization_id='huna', origin=O, status='in_progress', classification='lead', classification_state='validated',
             suggested={'value': 'nia', 'justification': 'Reuniões mensais desde agosto.', 'at': '2026-10-02', 'by': 'u-huna', 'state': 'pending'}),
        dict(id='rel-07', contact_id='ct-05', organization_id='imunotera', origin=O, status='in_progress', classification='lead', classification_state='validated', contact_request_at='2026-09-08'),
        dict(id='rel-08', contact_id='ct-06', organization_id='techtrials', origin='Contato da empresa', status='in_progress', classification='lead', classification_state='validated',
             suggested={'value': 'br', 'justification': 'Investidor brasileiro.', 'at': '2026-09-29', 'by': 'u-techtrials', 'state': 'pending'}),
        dict(id='rel-09', contact_id='ct-07', organization_id='croplabs', origin='RESI', status='closed', classification='lead', classification_state='validated'),
        dict(id='rel-10', contact_id='ct-08', organization_id='aurora', origin='BIO Convention', status='deal', classification='npia', classification_state='validated',
             npia={'type': 'c', 'date': '2026-08-14', 'amount_usd': 12000000, 'description': 'Acordo de co-desenvolvimento do AU-101 para o Japão.', 'confidential': False, 'state': 'validated', 'at': '2026-08-20', 'by': 'u-aurora', 'validated_at': '2026-08-25', 'validated_by': 'u-team-1'},
             validated_at='2026-08-25', validated_by='u-team-1'),
        dict(id='rel-11', contact_id='ct-09', organization_id='imunotera', origin=O, status='in_progress', classification='lead', classification_state='validated', contact_request_at='2026-10-01'),
        dict(id='rel-12', contact_id='ct-10', organization_id='biofactor', origin='Indicação de parceiro', status='in_progress', classification='incomplete', classification_state='validated'),
        dict(id='rel-13', contact_id='ct-04', organization_id='program', origin='Deep Tech Summit', status='in_progress', classification='nia', classification_state='validated', validated_at='2026-07-10', validated_by='u-team-1'),
    ]
    for r in relationships:
        r.setdefault('owner_user_id', 'u-%s' % r['organization_id'] if r['organization_id'] != 'program' else 'u-team-1')
        r.setdefault('deal_expectation', None)
        r.setdefault('suggested', None)
        r.setdefault('npia', None)
        r.setdefault('contact_request_at', None)
        r.setdefault('validated_at', None)
        r.setdefault('validated_by', None)
        r.setdefault('created_at', '2026-07-01')
        r['apex_control'] = {'dynamics_account': r['id'] in ('rel-01', 'rel-10'), 'contact_registered': r['id'] in ('rel-01', 'rel-10'),
                             'opportunity_inserted': r['id'] == 'rel-10', 'opportunity_word': False,
                             'strategic_category': 'Indústria da saúde (CNDI Missão 2)', 'notes': ''}
    interactions = [
        dict(relationship_id='rel-01', date='2026-07-14', description='Primeira reunião virtual com o CEO; apresentação do NTX-06.', type='virtual_meeting', apex_product='investment_matchmaking', event=None),
        dict(relationship_id='rel-01', date='2026-08-05', description='Envio do data room e do deck atualizado.', type='material_sent', apex_product='investment_portfolio', event=None),
        dict(relationship_id='rel-01', date='2026-09-10', description='NDA assinado; discussão de termos da Série B.', type='nda', apex_product='investment_matchmaking', event=None),
        dict(relationship_id='rel-02', date='2026-06-04', description='Conversa no estande do Brasil na BIO.', type='in_person_meeting', apex_product='promotion_event', event='BIO Convention'),
        dict(relationship_id='rel-03', date='2026-09-22', description='Pedido de contato pela plataforma', type='other', apex_product='investment_portfolio', event=None, auto=True),
        dict(relationship_id='rel-04', date='2026-01-13', description='Reunião em San Francisco durante a JPM.', type='in_person_meeting', apex_product='custom_business_agenda', event='JPM'),
        dict(relationship_id='rel-04', date='2026-09-30', description='Term sheet recebido.', type='proposal_term_sheet', apex_product='investment_matchmaking', event=None),
        dict(relationship_id='rel-05', date='2026-05-20', description='Apresentação no Invest in Brazil Day.', type='in_person_meeting', apex_product='promotion_event', event='Invest in Brazil Day'),
        dict(relationship_id='rel-06', date='2026-08-12', description='Pedido de contato pela plataforma', type='other', apex_product='investment_portfolio', event=None, auto=True),
        dict(relationship_id='rel-06', date='2026-08-20', description='Reunião virtual de apresentação.', type='virtual_meeting', apex_product='investment_matchmaking', event=None),
        dict(relationship_id='rel-06', date='2026-09-18', description='Segunda reunião com o time técnico.', type='virtual_meeting', apex_product='investment_matchmaking', event=None),
        dict(relationship_id='rel-07', date='2026-09-08', description='Pedido de contato pela plataforma', type='other', apex_product='investment_portfolio', event=None, auto=True),
        dict(relationship_id='rel-08', date='2026-09-03', description='Café com a sócia em São Paulo.', type='in_person_meeting', apex_product=None, event=None),
        dict(relationship_id='rel-09', date='2026-04-16', description='Conversa no RESI; sem interesse no momento.', type='in_person_meeting', apex_product='promotion_event', event='RESI'),
        dict(relationship_id='rel-10', date='2026-06-05', description='Reunião na BIO Convention.', type='in_person_meeting', apex_product='promotion_event', event='BIO Convention'),
        dict(relationship_id='rel-10', date='2026-08-14', description='Assinatura do acordo de co-desenvolvimento.', type='proposal_term_sheet', apex_product='investment_matchmaking', event=None),
        dict(relationship_id='rel-11', date='2026-10-01', description='Pedido de contato pela plataforma', type='other', apex_product='investment_portfolio', event=None, auto=True),
        dict(relationship_id='rel-12', date='2026-09-15', description='Indicação feita por parceiro industrial.', type='email', apex_product=None, event=None),
        dict(relationship_id='rel-13', date='2026-06-18', description='Reunião do programa no Deep Tech Summit.', type='in_person_meeting', apex_product='promotion_event', event='Deep Tech Summit'),
    ]
    for i, it in enumerate(interactions):
        it['id'] = 'it-%02d' % (i + 1)
        rel = next(r for r in relationships if r['id'] == it['relationship_id'])
        it['created_by'] = rel['owner_user_id']
        it['created_at'] = it['date']
        it['auto'] = bool(it.get('auto'))
        if it['type']: check(it['type'], E.INTERACTION_TYPES, 'interaction.type')
        if it['apex_product']: check(it['apex_product'], E.APEX_PRODUCTS, 'apex_product')
    for ins in institutions:
        check(ins['investor_type'], E.INVESTOR_TYPES, 'investor_type')
        if ins['niche']: check(ins['niche'], E.NICHE, 'niche')
        check(ins['interest_type'], E.INTEREST_TYPES, 'interest_type')
        check(ins['sectors'], E.SECTORS, 'sectors')
    for r in relationships:
        check(r['status'], E.REL_STATUS, 'rel.status')
        check(r['classification'], E.CLASSIFICATION, 'classification')
    return institutions, contacts, relationships, interactions


SETTINGS = {
    'id': 'settings',
    'launch_date': '2026-10-01',
    'deadlines': {
        'provisional_profile_days': 60,               # spec 1, 4.4
        'provisional_warning_days': [15, 7],          # spec 1, 8
        'validation_reminder_days': [7, 14],          # spec 1, 8 (then every 14 days)
        'validation_reminder_repeat_days': 14,
        'quarterly_update_reminder_days': 90,         # spec 1, 4.6
        'outdated_profile_alert_days': 120,           # spec 1, 4.6
        'contact_warning_business_days': 10,          # spec 2, 9
        'contact_overdue_business_days': 15,          # spec 2, 2 and 9
    },
    'goals': {'2026': {'lead': 60, 'nia': 20, 'npia': 4}, '2027': {'lead': 80, 'nia': 30, 'npia': 6}},
    # "Lista de ações mantida pela equipe" (spec 2, 6.2, block 3)
    'origins': ['BIO Convention', 'RESI', 'JPM', 'Deep Tech Summit', 'Invest in Brazil Day', 'Portfólio', 'Contato da empresa',
                'Indicação de investidor', 'Indicação de parceiro', 'Cold call'],
    'apex_strategic_categories': ['Indústria da saúde (CNDI Missão 2)'],
    # Brazilian national holidays used for business-day counting (spec 2, 9)
    'holidays': ['2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07',
                 '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
                 '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21', '2027-05-01', '2027-05-27', '2027-09-07',
                 '2027-10-12', '2027-11-02', '2027-11-15', '2027-11-20', '2027-12-25'],
}


def main():
    organizations, projects = build_profile_entities()
    institutions, contacts, relationships, interactions = build_crm()
    data = {
        'organizations': organizations,
        'projects': projects,
        'profile_versions': build_versions(organizations, projects),
        'form_imports': build_form_imports(projects, organizations),
        'users': build_users(organizations),
        'institutions': institutions,
        'contacts': contacts,
        'relationships': relationships,
        'interactions': interactions,
        'settings': [SETTINGS],
        'consents': [{'id': 'cons-001', 'user_id': 'u-inv-1', 'terms_version': '2026-09', 'privacy_version': '2026-09', 'accepted_at': '2026-09-02'}],  # spec 2, 6.1
        'email_outbox': [],   # e-mails the platform would send (mock; see HANDOFF_CODEX.md)
    }
    os.makedirs(OUT, exist_ok=True)
    for name, rows in data.items():
        with open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print('%-18s %3d' % (name, len(rows)))
    multi = [o['id'] for o in organizations if sum(p['organization_id'] == o['id'] for p in projects) > 1]
    print('multi-project organizations:', multi)


if __name__ == '__main__':
    main()
