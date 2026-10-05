"""Closed lists (enums) from the specs. Values are stable keys; labels live in i18n.

Single source of truth for the seed generator. The same lists are mirrored in
src/lib/enums.js (front end) and documented in docs/SCHEMA.md.
"""

PROFILE_TYPES = ['A', 'B', 'C', 'D', 'E', 'F']

ORG_STATUS = ['awaiting_validation', 'filling', 'in_review', 'returned', 'published', 'provisional', 'offline']
PUBLIC_STATE = ['published', 'provisional', 'hidden']

SIZE = ['startup', 'medium', 'large']
SEGMENTS = ['pharmaceutical', 'biotechnology', 'human_health', 'animal_health', 'devices_diagnostics',
            'apis', 'biodiversity_bioeconomy', 'cro', 'other']
PARTNERSHIP_TYPES = ['vc', 'joint_venture', 'co_development', 'market_distribution', 'out_licensing',
                     'infrastructure_investment']
MARKETS = ['brazil', 'north_america', 'latin_america', 'europe', 'asia', 'oceania', 'africa']

# Profile A
REGULATORY_PHASE = ['preclinical', 'phase_1', 'phase_2', 'phase_3', 'registered']
FTO = ['yes', 'no', 'in_progress']
ROUND_STAGE = ['pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus', 'other']
RAISED_SOURCE = ['fapesp', 'finep', 'bndes', 'cnpq', 'embrapii', 'angel', 'vc', 'cvc', 'award', 'donation',
                 'own_resources', 'other']
GTM_MODELS = ['out_licensing', 'co_development', 'direct_sales', 'partnership_distribution']
# Profile B
MATURITY = ['pre_operational', 'partially_operational', 'fully_operational']
TECHNOLOGY_TAGS = ['ai_ml', 'genomics', 'electrochemistry', 'biosensors', 'microfluidics', 'fermentation', 'other']
BUSINESS_MODELS = ['equipment', 'consumables', 'saas', 'licensing', 'service']
# Profile C
C_SERVICES = ['process_development', 'formulation', 'manufacturing', 'analytical']
MOLECULE_TYPES = ['small_molecules', 'biologics', 'antibodies', 'vaccines', 'apis', 'other']
CAPACITY_SCALE = ['laboratory', 'pilot', 'commercial']
C_CERTIFICATIONS = ['gmp', 'iso', 'bpl', 'anvisa', 'fda', 'ema', 'dmf', 'other']
CLIENT_PROFILES = ['startups', 'national_pharma', 'multinational']
C_INVESTMENT_TYPES = ['jv', 'pe', 'infrastructure_expansion', 'strategic_partner']
# Profile D
D_SERVICES = ['preclinical', 'clinical_phase_1_4', 'analytical', 'quality_control', 'bpl']
THERAPEUTIC_AREAS = ['oncology', 'infectious_diseases', 'immunology', 'cns', 'cardiovascular', 'dermatology',
                     'metabolic', 'animal_health', 'consumer_goods', 'other']  # spec gives no list: see DUVIDAS
D_CERTIFICATIONS = ['bpl', 'bpc', 'gmp', 'iso', 'anvisa', 'reblas', 'fda', 'other']
D_INVESTMENT_TYPES = ['expansion', 'strategic_partner', 'jv']
# Profile E
E_CERTIFICATIONS = ['anvisa', 'who', 'who_pq', 'fda', 'ema', 'other']
E_PARTNERSHIP_MODELS = ['co_development', 'technology_transfer', 'jv', 'licensing']
# Profile F
F_CERTIFICATIONS = ['iso', 'gmp', 'dmf', 'other']
F_PARTNERSHIP_MODELS = ['jv', 'pe', 'expansion', 'distribution']

# --- Contacts (spec 2) ---
INVESTOR_TYPES = ['accelerator', 'angel', 'angel_network', 'asset_wealth_management', 'cvc', 'dfi', 'endowment',
                  'family_office', 'foundation', 'fund_of_funds', 'hnwi', 'non_profit', 'organization', 'pe_firm',
                  'pension_fund', 'service_provider', 'vc']
NICHE = ['pe', 'vc', 'pevc', 'impact', 'pevc_impact', 'vc_impact']
INTEREST_TYPES = ['direct', 'direct_and_coinvestment', 'fund_indirect', 'coinvestment', 'new_fund_expansion',
                  'licensing', 'tech_transfer', 'rd_agreement']
SECTORS = ['health', 'biotechnology', 'pharmaceutical', 'animal_health', 'multisector']
REL_STATUS = ['in_progress', 'closed', 'deal']
CLASSIFICATION = ['lead', 'nia', 'npia', 'br', 'incomplete']
DEAL_TYPES = ['investment', 'licensing', 'co_development', 'other']
NPIA_TYPES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
INTERACTION_TYPES = ['in_person_meeting', 'virtual_meeting', 'email', 'material_sent', 'nda', 'proposal_term_sheet',
                     'other']
APEX_PRODUCTS = ['promotion_event', 'promotion_webinar', 'facilitation_webinar', 'basic_investor_info',
                 'custom_intelligence', 'custom_business_agenda', 'investment_portfolio', 'investment_matchmaking',
                 'pitch_training']
CONTINUITY = ['yes', 'left', 'unknown']
USER_ROLES = ['investor', 'company_user', 'team']
