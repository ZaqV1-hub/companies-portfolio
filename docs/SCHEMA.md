# SCHEMA · Modelo de dados

Estrutura de dados do Companies Portfolio, pronta para virar tabelas. O seed em `data/seed/<tabela>.json` segue exatamente esta estrutura: um arquivo por tabela, uma linha por objeto.

Convenções:
- **id** é texto (slug ou id gerado). No banco pode ser `uuid`/`text`, mas os ids do seed precisam continuar valendo.
- **T** = texto traduzível, guardado como objeto `{"pt": "...", "en": "..."}` (sugestão: `jsonb`). A empresa preenche `pt`; a equipe revisa `en`.
- **USD** = número inteiro em dólares (`bigint`), nunca decimal e nunca outra moeda.
- **Período** = `{"year": 2027, "month": 6}` ou `{"year": 2026, "semester": 2}`.
- Datas: `date` (AAAA-MM-DD) ou `timestamptz` (ISO 8601).
- Obrig. = obrigatório **para enviar o perfil para revisão** (o rascunho pode ficar incompleto). Nas tabelas do registro de contatos, obrigatório para salvar.
- 🔒 = interno: nunca sai para telas ou APIs públicas.

Diagrama das relações:

```
organizations 1──n projects
organizations 1──n profile_versions          (rascunhos e versões aprovadas)
organizations 1──n form_imports ──n─1 projects (pré-carga do Google Forms)
organizations 1──n users (company_user)
institutions 1──n contacts 1──n relationships n──1 organizations (ou "program")
relationships 1──n interactions
users (investor) 1──1 contacts      (users.contact_id, criado no 1º pedido de contato)
users 1──n consents
settings (linha única)
email_outbox (fila de e-mails; no protótipo, só registro)
```

---

## 1. Perfil da empresa (spec 1)

### organizations

Dados comuns da organização (spec 1, tabela 5.3), mais o estado da publicação. As colunas de conteúdo guardam a **versão publicada** (a que está no ar). As edições ficam em `profile_versions` até a aprovação.

| Campo | Tipo | Obrig. | Observação |
|---|---|---|---|
| id | text PK | — | slug (`imunotera`) |
| name | text(80) | sim | |
| logo_url | text | sim | PNG ou SVG, fundo transparente, ≥ 512 px |
| cover_url | text | não | JPG/PNG 1920×720, ≤ 8 MB (fundo do cabeçalho) |
| description | T (600) | sim | 1º bloco da coluna principal; 2 linhas no card |
| website | text (URL) | sim | |
| city | text | sim | |
| state | enum `uf` | sim | |
| size | enum `size` | sim | |
| segments | enum[] `segments` | sim | filtro do diretório |
| partnership_types | enum[] `partnership_types` | sim | topo do card "O que buscamos"; filtro |
| leadership | jsonb[] (máx. 4) | não | `{name, role: T, experience: T(150)}` |
| gallery | jsonb[] (máx. 6) | não | `{url, caption: T}`; legenda obrigatória; ≥ 1600 px no lado maior |
| focal_point 🔒 | jsonb | sim | `{name, role, email, phone}`; telefone com DDI; recebe os avisos de pedido de contato |
| status | enum `org_status` | — | fluxo (spec 1, 4.4) |
| public_state | enum `public_state` | — | o que o site mostra |
| is_featured | boolean | — | "Destaques escolhidos pela equipe" |
| last_approved_at | date | — | "Atualizado em" / data da última aprovação |
| last_updated_at | date | — | base dos lembretes de 90 e 120 dias |
| invited_at | date | — | base dos lembretes de validação |
| created_at | timestamptz | — | |
| demo | boolean | — | **só seed**: organização fictícia, apagar antes de publicar |
| seed_note | text | — | **só seed** |

### projects

Um por perfil de atuação. A organização tem 1..n projetos (spec 1, seção 3).

| Campo | Tipo | Obrig. | Observação |
|---|---|---|---|
| id | text PK | — | |
| organization_id | FK organizations | sim | |
| profile_type | enum `profile_type` (A–F) | sim | definido pela equipe; a empresa não altera |
| sort_order | int | sim | ordem no seletor; o 1º aparece no card |
| summary | T (300) | sim **se** a organização tiver > 1 projeto | "Resumo do projeto" |
| fields | jsonb | — | campos do perfil (abaixo) |
| demo | boolean | — | **só seed** |

Sugestão para o banco: manter `fields` como `jsonb` e criar colunas geradas ou índices para os filtros do diretório: `fields->>'regulatory_phase'`, `(fields->>'trl')::int`, `fields->>'maturity'`, `fields->'target_markets'`, `fields->'markets_served'` e `fields->'export_markets'`.

#### fields por perfil (spec 1, tabelas 5.4)

Tipos compostos usados abaixo:
- `rounds` = `[{stage: enum round_stage, period: Período, amount_usd: USD, purpose: T(100)}]`
- `raised` = `[{source: enum raised_source, amount_usd: USD, note?: text}]` + `raised_none: boolean` ("nenhum valor captado"). O total é somado pela plataforma.
- `revenue` = `{amount_usd: USD, year: int}` ou `{pre_revenue: true}` (pré-receita só em A e B)
- `investment_range` = `{min: USD, max: USD}`
- `exports` (C) = `{amount_usd: USD, year: int}` ou `{none: true}`. `exports` (D, F) = `{pct: 0–100, destinations: enum[] markets}`

**Perfil A · Drug Discovery & Product Development**

| Campo | Tipo | Obrig. |
|---|---|---|
| segment | T(100) | sim |
| trl | int 1–9 | sim |
| regulatory_phase | enum `regulatory_phase` | sim |
| lead_product_name | text(80) | sim |
| lead_product_moa | T(400) | sim |
| pipeline | `[{name: text, indication: T}]` | não |
| patents_filed | T(300) | não |
| patents_granted | T(300) | não |
| fto | enum `fto` | não |
| milestones | `[{period: Período, description: T(150)}]` (mín. 1) | sim |
| rounds | rounds (mín. 1) | sim |
| use_of_funds | T(300) | sim |
| raised / raised_none | raised | sim (uma fonte ou "nenhum") |
| revenue | revenue | não |
| gtm_models | enum[] `gtm_models` | sim |
| gtm_text | T(200) | não |
| target_markets | enum[] `markets` | sim |

**Perfil B · Technology Platform**

| Campo | Tipo | Obrig. |
|---|---|---|
| platform_type | T(100) | sim |
| maturity | enum `maturity` | sim |
| platform_description | T(800) | sim |
| technology_tags | enum[] `technology_tags` | sim |
| technology_text | T(300) | não |
| business_models | enum[] `business_models` | sim |
| business_model_text | T(300) | não |
| traction | T(400) | sim |
| revenue | revenue | não |
| competitive_edge | T(600) | sim |
| rounds | rounds | não |
| use_of_funds | T(300) | não |
| raised / raised_none | raised | não |

**Perfil C · CDMO & CMO**

| Campo | Tipo | Obrig. |
|---|---|---|
| services | enum[] `c_services` | sim |
| services_text | T(300) | não |
| molecule_types | enum[] `molecule_types` | sim |
| capacity_scales | enum[] `capacity_scale` | sim |
| utilization_pct | int 0–100 | não |
| capacity_text | T(300) | não |
| certifications | enum[] `certifications` (GMP, ISO, BPL, Anvisa, FDA, EMA, DMF, outra) | sim |
| client_count | int | não |
| client_profiles | enum[] `client_profiles` | não |
| revenue | revenue (sem pré-receita) | não |
| exports | exports (C) | não |
| expansion_plan | T(300) | não |
| investment_types | enum[] `c_investment_types` | sim |
| investment_range | investment_range | não |
| target_markets | enum[] `markets` | sim |

**Perfil D · CRO & Laboratory Services**

| Campo | Tipo | Obrig. |
|---|---|---|
| services | enum[] `d_services` | sim |
| services_text | T(400) | não |
| therapeutic_areas | enum[] `therapeutic_areas` (provisória, ver DUVIDAS) | sim |
| scope_text | T(200) | não |
| models | T(200) | não |
| certifications | enum[] `certifications` (BPL, BPC, GMP, ISO, Anvisa, REBLAS, FDA, outra) | sim |
| certificate_numbers | text(200) | não |
| partner_sites | text[] | não |
| client_count | int | não |
| client_profiles | enum[] `client_profiles` | não |
| revenue | revenue (sem pré-receita) | não |
| exports | exports (D/F) | não |
| investment_types | enum[] `d_investment_types` | sim |
| investment_range | investment_range | não |
| target_markets | enum[] `markets` | sim |

**Perfil E · Established Producer & Institution**

| Campo | Tipo | Obrig. |
|---|---|---|
| institution_type | T(150) | sim |
| product_portfolio | `[{category: T, description: T(200)}]` (mín. 1) | sim |
| production_capacity | T(400) | sim |
| export_markets | enum[] `markets` | não |
| export_markets_text | T(200) | não |
| certifications | enum[] `certifications` (Anvisa, OMS, OMS PQ, FDA, EMA, outra) | sim |
| partnership_interests | `[{area: T, description: T(200)}]` (mín. 1) | sim |
| partnership_models | enum[] `e_partnership_models` | sim |
| expansion_projects | T(400) | não |
| investment_range | investment_range | não |
| investment_description | T(200) | não |

**Perfil F · Specialty Inputs & Services**

| Campo | Tipo | Obrig. |
|---|---|---|
| products | T[] (mín. 1) | sim |
| products_text | T(400) | não |
| markets_served | enum[] `markets` | sim |
| markets_text | T(200) | não |
| certifications | enum[] `certifications` (ISO, GMP, DMF, outra) | sim |
| market_share | `{pct: 0–100, segment: T}` | não |
| revenue | revenue (sem pré-receita) | não |
| exports | exports (D/F) | não |
| expansion_strategy | T(300) | não |
| partnership_models | enum[] `f_partnership_models` | sim |
| investment_range | investment_range | não |

### profile_versions

Rascunhos e versões aprovadas (spec 1, 4.2, 4.3 e 4.6). A versão publicada continua no ar (em `organizations`/`projects`) enquanto há rascunho em revisão.

| Campo | Tipo | Observação |
|---|---|---|
| id | text PK | |
| organization_id | FK organizations | |
| kind | enum `published` \| `draft` | `draft` vira `published` na aprovação (histórico) |
| status | enum `filling` \| `in_review` \| `returned` \| `published` | só 1 rascunho aberto (`filling`/`in_review`/`returned`) por organização |
| content | jsonb | `{organization: {...campos de organizations, incl. focal_point}, projects: [{id, profile_type, summary, fields}]}` |
| reviewed_steps | jsonb | `{"organization": true, "project:<id>": true, "leadership": true, "images": true}` ("Revisei esta etapa") |
| created_at, updated_at | timestamptz | |
| submitted_at, submitted_by | timestamptz, FK users | "Enviar para revisão" |
| review_comment | text | obrigatório ao devolver |
| reviewed_at, reviewed_by | timestamptz, FK users | |
| approved_at | timestamptz | |

### form_imports

Pré-carga a partir da planilha do Google Forms (spec 1, seção 7). Diz ao formulário que marca mostrar em cada campo.

| Campo | Tipo | Observação |
|---|---|---|
| id | text PK | |
| organization_id | FK organizations | |
| project_id | FK projects, nulo | nulo = campo da organização |
| field | text | chave do campo (`rounds`, `raised`, `size`…) |
| mode | enum `prefilled` \| `reference` | `prefilled` = "Importado do formulário · confirme"; `reference` = campo vazio + "Resposta anterior: …" |
| previous_answer | text | texto bruto da resposta (só em `reference`) |
| source_column | text | **sugerido** para a importação real (ex.: `P`, `Q`) |

---

## 2. Usuários

### users

| Campo | Tipo | Observação |
|---|---|---|
| id | text PK | |
| role | enum `user_role` | `investor`, `company_user`, `team` |
| name | text | |
| email | text **único** | |
| password 🔒 | text | **protótipo: texto puro.** No servidor, apenas hash (bcrypt/argon2) |
| organization_id | FK organizations | obrigatório para `company_user` |
| contact_id | FK contacts | investidor: preenchido no 1º "Solicitar contato" |
| email_verified_at | timestamptz | login do investidor exige verificação |
| verification_token 🔒 | text | link de confirmação |
| lang | enum `pt` \| `en` | |
| investor_profile | jsonb | investidor (spec 2, 6.1): `{institution, country (ISO-2), city, role, investor_type, phone, linkedin}` |
| terms_accepted_at, privacy_accepted_at | timestamptz | |
| created_at | timestamptz | |

### consents

Registro de consentimento do investidor (spec 2, 6.1).

| Campo | Tipo |
|---|---|
| id | text PK |
| user_id | FK users |
| terms_version | text |
| privacy_version | text |
| accepted_at | timestamptz |

---

## 3. Registro de contatos (spec 2) — CONFIDENCIAL

### institutions

Cadastrada uma vez e compartilhada por todas as empresas.

| Campo | Tipo | Nível |
|---|---|---|
| id | text PK | |
| name | text | **obrig.** (reaproveitada por nome) |
| investor_type | enum `investor_types` | recomendado |
| niche | enum `niche` | recomendado |
| ticket_min_musd, ticket_max_musd | numeric (USD milhões) | recomendado |
| interest_type | enum `interest_types` | recomendado |
| sectors | enum[] `sectors` | recomendado |
| description_original | text (inglês) | recomendado |
| description_pt | text (resumo) | recomendado |
| website | text | recomendado |
| hq_country | ISO-2 | sugere o país do contato |
| hq_city | text | sugere a cidade do contato |
| created_at | timestamptz | |

### contacts

A pessoa. **O e-mail é a chave que evita duplicidade.**

| Campo | Tipo | Nível |
|---|---|---|
| id | text PK | |
| institution_id | FK institutions | **obrig.** |
| name | text | **obrig.** |
| email | text **único** (minúsculas) | **obrig.** |
| country | ISO 3166-1 alfa-2 | **obrig.** |
| city | text | **obrig.** |
| role | text | recomendado |
| linkedin | text (URL) | recomendado |
| phone | text (com DDI) | opcional |
| created_at | timestamptz | |

### relationships

Vínculo contato × empresa. Guarda a classificação, porque o mesmo investidor pode estar em estágios diferentes com empresas diferentes. Índice único `(contact_id, organization_id)`.

| Campo | Tipo | Observação |
|---|---|---|
| id | text PK | |
| contact_id | FK contacts | |
| organization_id | FK organizations **ou** `'program'` | `'program'` = "Programa Abiquifi" (sugestão: criar uma organização técnica com esse id) |
| owner_user_id | FK users | "Responsável" (nulo quando criado pelo pedido de contato) |
| origin | text (valor de `settings.origins`) | recomendado; "Portfólio" no pedido de contato |
| status | enum `rel_status` | recomendado; padrão `in_progress` |
| deal_expectation | jsonb `{min_usd, max_usd, type: enum deal_types}` | opcional |
| classification | enum `classification` | **validada**; nasce `lead` |
| classification_state | `validated` | a classificação gravada é sempre a validada |
| suggested | jsonb | `{value: nia\|br, justification(300), at, by, state: pending\|validated\|adjusted, team_comment, decided_at}` |
| validated_at, validated_by | timestamptz, FK users | conta para as metas do ano |
| npia | jsonb | `{type: a–h, date, amount_usd: USD, description(500), confidential: bool, state: pending\|validated\|rejected, at, by, validated_at, validated_by, team_comment}` |
| contact_request_at | date | data do último "Solicitar contato" (início dos 15 dias úteis) |
| apex_control 🔒 só equipe | jsonb | `{dynamics_account, contact_registered, opportunity_inserted, opportunity_word: bool, strategic_category: text, notes: text}`. "Continuidade por ano" é calculada |
| created_at | timestamptz | |

### interactions

Cada conversa, reunião ou envio.

| Campo | Tipo | Nível |
|---|---|---|
| id | text PK | |
| relationship_id | FK relationships | |
| date | date, **não futura** | **obrig.** |
| description | text(500) | **obrig.** |
| type | enum `interaction_types` | recomendado |
| apex_product | enum `apex_products` | recomendado (sugerido pelo tipo) |
| event | text (valor de `settings.origins`) | opcional |
| project_id | FK projects | projeto de onde veio o pedido de contato |
| auto | boolean | `true` = "Pedido de contato pela plataforma" |
| created_by | FK users | |
| created_at | timestamptz | |

---

## 4. Configuração e e-mails

### settings (linha única, id `settings`)

| Campo | Tipo | Padrão |
|---|---|---|
| launch_date | date | 2026-10-01 |
| deadlines.provisional_profile_days | int | 60 |
| deadlines.provisional_warning_days | int[] | [15, 7] |
| deadlines.validation_reminder_days | int[] | [7, 14] |
| deadlines.validation_reminder_repeat_days | int | 14 |
| deadlines.quarterly_update_reminder_days | int | 90 |
| deadlines.outdated_profile_alert_days | int | 120 |
| deadlines.contact_warning_business_days | int | 10 |
| deadlines.contact_overdue_business_days | int | 15 |
| goals | jsonb `{"2026": {lead, nia, npia}, …}` | metas do convênio |
| origins | text[] | lista de ações/eventos mantida pela equipe |
| apex_strategic_categories | text[] | padrão "Indústria da saúde (CNDI Missão 2)" |
| holidays | date[] | feriados nacionais (contagem de dias úteis) |

### email_outbox

Fila de e-mails. No protótipo só registra; o servidor envia. Lista completa em HANDOFF_CODEX.md.

| Campo | Tipo |
|---|---|
| id | text PK |
| template | text |
| to | text (`team`, `company` ou e-mail) |
| data | jsonb |
| created_at | timestamptz |
| sent | boolean |

---

## 5. Enums (listas fechadas)

Os valores (chaves) são estáveis; os rótulos em PT/EN estão em `i18n/pt.json` e `i18n/en.json`, em `enum.<lista>`.

| Enum | Valores |
|---|---|
| profile_type | A Drug Discovery & Product Development · B Technology Platform · C CDMO & CMO · D CRO & Laboratory Services · E Established Producer & Institution · F Specialty Inputs & Services |
| org_status | awaiting_validation (Aguardando validação) · filling (Em preenchimento) · in_review (Em revisão) · returned (Devolvido) · published (Publicado) · provisional (Provisório) · offline (Fora do ar) |
| public_state | published · provisional (selo "Em atualização") · hidden |
| size | startup · medium (até R$ 300 mi) · large (acima de R$ 300 mi) |
| segments | pharmaceutical · biotechnology · human_health · animal_health · devices_diagnostics · apis · biodiversity_bioeconomy · cro · other |
| partnership_types | vc · joint_venture · co_development · market_distribution · out_licensing · infrastructure_investment |
| markets | brazil · north_america · latin_america · europe · asia · oceania · africa |
| regulatory_phase | preclinical · phase_1 · phase_2 · phase_3 · registered |
| fto | yes · no · in_progress |
| round_stage | pre_seed · seed · series_a · series_b · series_c_plus · other |
| raised_source | fapesp · finep · bndes · cnpq · embrapii · angel · vc · cvc · award · donation · own_resources · other |
| gtm_models | out_licensing · co_development · direct_sales · partnership_distribution |
| maturity | pre_operational · partially_operational · fully_operational |
| technology_tags | ai_ml · genomics · electrochemistry · biosensors · microfluidics · fermentation · other |
| business_models | equipment · consumables · saas · licensing · service |
| c_services | process_development · formulation · manufacturing · analytical |
| molecule_types | small_molecules · biologics · antibodies · vaccines · apis · other |
| capacity_scale | laboratory · pilot · commercial |
| certifications | gmp · iso · bpl · bpc · anvisa · reblas · fda · ema · dmf · who · who_pq · other (cada perfil usa um subconjunto, acima) |
| client_profiles | startups · national_pharma · multinational |
| c_investment_types | jv · pe · infrastructure_expansion · strategic_partner |
| d_services | preclinical · clinical_phase_1_4 · analytical · quality_control · bpl |
| therapeutic_areas | oncology · infectious_diseases · immunology · cns · cardiovascular · dermatology · metabolic · animal_health · consumer_goods · other (**provisória**) |
| d_investment_types | expansion · strategic_partner · jv |
| e_partnership_models | co_development · technology_transfer · jv · licensing |
| f_partnership_models | jv · pe · expansion · distribution |
| uf | AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO |
| user_role | investor · company_user · team |
| investor_types (Apex) | accelerator · angel · angel_network · asset_wealth_management · cvc · dfi · endowment · family_office · foundation · fund_of_funds · hnwi · non_profit · organization · pe_firm · pension_fund · service_provider · vc |
| niche (Apex) | pe · vc · pevc · impact · pevc_impact · vc_impact |
| interest_types (Apex) | direct · direct_and_coinvestment · fund_indirect · coinvestment · new_fund_expansion · licensing · tech_transfer · rd_agreement |
| sectors | health · biotechnology · pharmaceutical · animal_health · multisector |
| rel_status | in_progress · closed · deal |
| classification | lead · nia · npia · br · incomplete |
| deal_types | investment · licensing · co_development · other |
| npia_types | a…h (os oito tipos da spec 2, seção 3) |
| interaction_types | in_person_meeting · virtual_meeting · email · material_sent · nda · proposal_term_sheet · other |
| apex_products | promotion_event · promotion_webinar · facilitation_webinar · basic_investor_info · custom_intelligence · custom_business_agenda · investment_portfolio · investment_matchmaking · pitch_training |
| continuity | yes · left · unknown (calculado por ano) |

As listas também estão, como código, em `tools/seed/enums.py` (validação do seed) e em `src/components/form/inputs.js` (`LIST_OPTIONS`).
