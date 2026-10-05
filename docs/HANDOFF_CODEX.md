# HANDOFF · Codex

Guia para transformar este protótipo na plataforma real: banco de dados, API, autenticação, e-mails, rotinas por data, importação do Google Forms e exportação para a ApexBrasil.

Documentos de referência:
- `docs/especificacao-perfil.md` (**spec 1**) e `docs/especificacao-contatos.md` (**spec 2**): fonte da verdade.
- `docs/SCHEMA.md`: tabelas, campos, tipos, relações e enums.
- `docs/DUVIDAS.md`: decisões tomadas onde a spec é ambígua.
- `data/seed/*.json`: dados de exemplo no formato das tabelas. Linhas com `"demo": true` são fictícias e devem ser apagadas antes de publicar.

## 1. Como o front está organizado

- **Sem build**: React 18 (UMD em `vendor/`) + htm, com módulos ES nativos. As rotas são por hash (`#/org/nintx`). Pode ser servido por qualquer servidor estático ou migrado para Vite sem mudar os componentes.
- **`src/services/api.js` é a única porta de dados.** Nenhuma tela importa `mockStore.js`, lê `data/seed` ou usa `localStorage` para dados. A única exceção é a preferência de idioma, em `src/lib/i18n.js`. Para ligar a API real, **reescreva só o `api.js`** com a mesma assinatura (funções `async`, mesmas entradas e saídas) chamando HTTP.
- Regras puras reaproveitáveis no servidor (Node), sem dependência de navegador:
  - `src/lib/formSchema.js`: campos, limites e obrigatoriedade do formulário.
  - `src/lib/profileValidation.js`: validação do envio para revisão.
  - `src/lib/crm.js`: dias úteis, completude, sugestão de produto Apex, continuidade.
  - `src/lib/directoryFilters.js`: filtros do diretório.

## 2. O que está mockado e onde

| O quê | Onde (arquivo · função) | Na versão real |
|---|---|---|
| Banco de dados | `src/services/mockStore.js` (todas as funções), carregado de `data/seed/*.json` e salvo no `localStorage` (`cp.v2.db`) | Banco relacional (ver SCHEMA.md) |
| Sessão / autenticação | `api.js` · `login`, `loginAs`, `logout`, `getCurrentUser` (chave `cp.v2.session` no localStorage) | Sessão no servidor ou JWT; senhas com hash; `loginAs` (atalho de demonstração) deve sumir |
| Seletor "Entrar como (demonstração)" | `src/pages/LoginPage.js` + `api.listDemoCompanyAccounts` | Remover |
| Senha em texto puro | `users.password` no seed e em `api.registerInvestor` | Hash (bcrypt/argon2) |
| Verificação de e-mail | `api.registerInvestor` (gera token), `api.verifyInvestorEmail`, `api.resendVerification`; o link aparece numa "caixa de entrada simulada" em `src/components/InvestorAuth.js` | Envio real do link por e-mail; rota `GET /verify?token=` |
| Envio de e-mails | `api.js` · `queueEmail()` grava em `email_outbox` | Fila de e-mails + provedor (ver seção 5) |
| Upload de imagens | `src/components/form/inputs.js` · `readImage()` converte em data URL reduzida (máx. 1600 px) | Upload para storage (S3/GCS) com validação no servidor; guardar o arquivo original e gerar versões |
| Importação do Google Forms | `data/seed/form_imports.json` e organizações/projetos do seed (gerados por `tools/seed/build_seed.py`) | Rotina de importação (seção 6) |
| Exportação Apex | `src/pages/team/CrmDashboardPage.js` · `ExportDialog` (só filtros e aviso) | Geração de XLSX (seção 7) |
| Rotinas por data | — (só os valores em `settings.deadlines`) | Jobs agendados (seção 5) |
| "Hoje" | `new Date()` no navegador | Data do servidor (fuso America/Sao_Paulo) |
| Resetar dados | `api.resetDemoData` | Remover |

## 3. Funções do `api.js` → endpoints

Sugestão REST. Todas exigem sessão, exceto as marcadas como **público**. "Empresa" = `company_user` (age sempre sobre `user.organization_id`, nunca sobre um id vindo do cliente). "Equipe" = `team`.

### Público

| Função | Endpoint | Entrada | Saída |
|---|---|---|---|
| `listPublicOrganizations()` | `GET /public/organizations` | — | `PublicOrganization[]`: só os campos de `PUBLIC_ORG_FIELDS` + `projects[{id, profile_type, summary, fields}]`; só `public_state ∈ {published, provisional}` |
| `getPublicOrganization(id)` | `GET /public/organizations/:id` | id | `PublicOrganization` ou 404 |
| `getPublicSettings()` | `GET /public/settings` | — | `{launch_date}` |

`PublicOrganization` **nunca** inclui `focal_point`, `status`, `invited_at`, `demo`, `seed_note` ou dados de rascunho.

### Sessão e investidor

| Função | Endpoint | Entrada | Saída |
|---|---|---|---|
| `getCurrentUser()` | `GET /me` | — | `{id, role, name, email, organization_id, organization_name, email_verified}` ou 401 |
| `login(email, password, role)` | `POST /auth/login` | `{email, password, role}` | `{ok, user}` / `{ok:false, error:'invalid_credentials'}` |
| `logout()` | `POST /auth/logout` | — | — |
| `registerInvestor(data)` | `POST /investors` (**público**) | `{name*, institution*, email*, country* (ISO-2), city*, password*, role, investor_type, phone, linkedin, accept_terms*, accept_privacy*, lang}` | `{ok, user_id}`; erros `missing` (+`fields`), `email`, `email_taken`. Envia o e-mail de verificação. Grava `consents` |
| `verifyInvestorEmail(token)` | `POST /investors/verify` (**público**) | `{token}` | `{ok, user}` + abre sessão |
| `resendVerification(userId)` | `POST /investors/verify/resend` | `{email}` (não usar `user_id` no real) | `{ok}` |
| `loginInvestor(email, password)` | `POST /auth/login` (role investor) | | `{ok, user}`; `{ok:false, error:'not_verified'}` se o e-mail não foi confirmado |
| `requestContact(orgId, projectId)` | `POST /organizations/:id/contact-requests` | `{project_id}` | `{ok, relationship_id, reused}`; `login_required` / `not_verified`. Regras: spec 2, 5.1 |

### Área da empresa · perfil

| Função | Endpoint | Entrada | Saída |
|---|---|---|---|
| `getMyProfileForm()` | `GET /me/profile-form` | — | `{organization: {id, name, status, public_state, last_approved_at}, draft: profile_version, imports: [{project_id, field, mode, previous_answer}], firstValidation}`. Cria o rascunho a partir da versão publicada. Na primeira validação, esvazia os campos `reference` |
| `saveMyProfileDraft(content, reviewedSteps)` | `PUT /me/profile-draft` | `{content, reviewed_steps}` | `{ok, draft}`; `locked` se estiver em revisão; `projects_changed` se a lista ou o perfil dos projetos mudou |
| `submitMyProfileForReview(content, reviewedSteps)` | `POST /me/profile-draft/submit` | idem | `{ok, draft}` ou `{ok:false, error:'invalid', check:{problems, unreviewed}}`. **Revalidar no servidor** com `validateDraft` |

### Equipe · revisão e organizações

| Função | Endpoint | Entrada | Saída |
|---|---|---|---|
| `listReviewQueue()` | `GET /team/reviews` | — | `[{version_id, organization_id, organization_name, submitted_at, first_validation, public_state, projects}]`, do envio mais antigo para o mais recente |
| `getReview(versionId)` | `GET /team/reviews/:id` | — | `{organization, draft, previous (conteúdo publicado ou null), previousIsProvisional, imports}` |
| `saveReviewEdits(versionId, content)` | `PUT /team/reviews/:id` | `{content}` (a equipe só altera os textos `en`) | `profile_version` |
| `approveReview(versionId, content)` | `POST /team/reviews/:id/approve` | `{content}` | `{ok}`: copia o conteúdo para `organizations`/`projects`, `status=published`, `public_state=published`, `last_approved_at=hoje`; versão vira `kind=published`; e-mail para a empresa |
| `returnReview(versionId, content, comment)` | `POST /team/reviews/:id/return` | `{content, comment*}` | `{ok}` ou `comment_required`; rascunho volta para `returned`; e-mail para a empresa com o comentário |
| `listOrganizationsForTeam()` | `GET /team/organizations` | — | lista com status, `public_state`, datas, `days_since_update`, `outdated`, perfis, `focal_point` |
| `setOrganizationPublicState(id, state)` | `PUT /team/organizations/:id/public-state` | `{public_state}` | organização (reativar / tirar do ar) |

### Registro de contatos

| Função | Endpoint | Quem | Entrada / saída |
|---|---|---|---|
| `listContactRows()` | `GET /contacts` | empresa (só os próprios) · equipe (todos) | `{rows: [{relationship, organization_name, contact{…}, institution{id,name}, last_interaction, interaction_count, events, interaction_dates, completeness, pending_request}], deadlines, origins}`. Para a empresa, `relationship` sai **sem** `apex_control` |
| `getContactRecord(relId)` | `GET /contacts/:relId` | empresa (se for dela) · equipe | `{relationship, organization_name, owner_name, contact, institution, interactions[], completeness, pending_request, origins, deadlines, apex_categories (só equipe)}` ou 404 |
| `lookupContactByEmail(email, orgId)` | `GET /contacts/lookup?email=` | empresa · equipe | `{contact, institution, existing_relationship_id (só da empresa atual)}` ou null. **Nunca** retorna relacionamentos ou interações de outras empresas |
| `searchInstitutions(q)` | `GET /institutions?q=` | empresa · equipe | até 8 instituições |
| `listContactOwners()` | `GET /team/contact-owners` | equipe | `[{id:'program', name:'Programa Abiquifi'}, …organizações]` |
| `createContactRecord(payload)` | `POST /contacts` | empresa · equipe | `{organization_id (só equipe), contact{name*, email*, country*, city*, role, linkedin, phone}, institution{name*, …}, relationship{origin, status, deal_expectation}, interaction{date*, description*, type, apex_product, event}}` → `{ok, relationship_id}`; erros `invalid`(+`fields`), `already_exists`(+`relationship_id`). Reaproveita contato (e-mail) e instituição (nome) |
| `addInteraction(relId, data)` | `POST /contacts/:relId/interactions` | empresa (dela) · equipe | `{date*, description*(500), type, apex_product, event}`; data não pode ser futura |
| `updateContactRecord(relId, patch)` | `PATCH /contacts/:relId` | empresa (dela) · equipe | `{contact, institution, relationship}`; e-mail não muda; obrigatórios não podem ficar vazios |
| `suggestClassification(relId, value, justification)` | `POST /contacts/:relId/classification-suggestions` | empresa · equipe | `value ∈ {nia, br}`, justificativa ≤ 300; e-mail para a equipe |
| `reportAnnouncement(relId, data)` | `POST /contacts/:relId/npia` | empresa · equipe | `{type a–h*, date*, amount_usd* (inteiro), description* (500), confidential* (bool)}`; e-mail para a equipe |
| `validateClassification(relId, value, comment)` | `POST /team/contacts/:relId/classification` | **equipe** | grava a classificação validada (+`validated_at`); e-mail para a empresa |
| `validateAnnouncement(relId, accept, comment)` | `POST /team/contacts/:relId/npia/decision` | **equipe** | aceita → `classification=npia`; e-mail para a empresa |
| `updateApexControl(relId, data)` | `PUT /team/contacts/:relId/apex-control` | **equipe** | campos da spec 2, 6.5 |
| `listDuplicateCandidates()` | `GET /team/duplicates` | **equipe** | `[{kind: contact\|institution, a, b}]` |
| `mergeContacts(keep, drop)` / `mergeInstitutions(keep, drop)` | `POST /team/merge/contacts` · `/institutions` | **equipe** | `{ok}` |
| `getCrmDashboard(year)` | `GET /team/contacts/dashboard?year=` | **equipe** | `{goals, indicators{lead, nia, npia, meetings, event_companies}, queue[], by_company[], years}` |

### Configurações

| Função | Endpoint | Quem | Entrada / saída |
|---|---|---|---|
| `getSettings()` | `GET /team/settings` | equipe | linha `settings` |
| `updateSettings(patch)` | `PUT /team/settings` | equipe | `{launch_date, deadlines{…}, goals{ano:{lead,nia,npia}}, origins[], apex_strategic_categories[]}`; inteiros > 0 (metas ≥ 0) |

## 4. Regras que PRECISAM rodar no servidor

1. **Permissões (spec 2, seção 10).** Aplicar por papel em cada endpoint, nunca confiar no front:

   | Ação | Empresa | Equipe | ApexBrasil | Investidor |
   |---|---|---|---|---|
   | Ver os próprios contatos e interações | sim | sim (todos) | pela exportação | não |
   | Ver contatos de outras empresas | **não** | sim | pela exportação | não |
   | Criar e editar contatos e interações | sim (próprios) | sim | não | não |
   | Sugerir classificação e informar anúncio | sim | sim | não | não |
   | Validar classificação e anúncio | não | sim | não | não |
   | Ver e editar o controle Apex | não | sim | não | não |
   | Unir duplicados e exportar | não | sim | não | não |

2. **Confidencialidade.** Toda consulta de `relationships`/`interactions` feita por empresa filtra por `organization_id = sessão.organization_id`, inclusive em buscas, contagens e detalhes. A busca por e-mail (`lookup`) devolve só os dados-base de contato e instituição. Anúncios sigilosos (`npia.confidential`) só aparecem para a própria empresa, a equipe e a exportação Apex. `apex_control` só para a equipe. Investidor não acessa nenhuma rota de contatos.
3. **Ponto focal nunca exposto (spec 1, 6.4).** Nem no HTML nem em resposta de API acessível ao investidor ou ao público: serializar organizações públicas com lista branca de campos (`PUBLIC_ORG_FIELDS` em `api.js`), não com lista negra.
4. **Aprovação antes de publicar.** A empresa só escreve em `profile_versions`. Somente `approveReview` (equipe) copia para `organizations`/`projects`. A versão publicada (ou provisória) continua no ar durante a revisão. Nova empresa só aparece depois da 1ª aprovação.
5. **Validação do envio.** `submit` revalida no servidor (`validateDraft`): obrigatórios, limites de caracteres, valores inteiros em USD, URL, e-mail, telefone com DDI, listas fechadas e todas as etapas marcadas como revisadas.
6. **Valores em USD.** Só inteiros ≥ 0; recusar no servidor também.
7. **Projetos.** A empresa não cria, apaga nem muda o perfil dos projetos (spec 1, 4.6); a equipe faz isso.
8. **Registro de contatos.** Só nome, instituição, e-mail, país, cidade e a 1ª interação (data e descrição) são obrigatórios. E-mail único (minúsculas). Instituição reaproveitada por nome normalizado. Índice único `(contact_id, organization_id)`. Data da interação não pode ser futura. Só a classificação **validada** conta para as metas.
9. **"Solicitar contato".** Exige investidor logado com e-mail verificado. Cria ou reaproveita instituição e contato com os dados do cadastro, cria o relacionamento (origem "Portfólio", Lead), registra a interação "Pedido de contato pela plataforma" e grava `contact_request_at`. Limitar a frequência de pedidos por investidor e empresa (anti-spam).
10. **Upload.** Validar tipo e dimensões (logo PNG/SVG ≥ 512 px; capa JPG/PNG ≤ 8 MB; galeria ≥ 1600 px, máx. 6, legenda obrigatória). Sanitizar SVG.

## 5. E-mails automáticos e prazos

Os prazos vêm de `settings.deadlines` (editáveis no painel da equipe). Dias úteis consideram `settings.holidays`. **E-mails para empresas: só em português** (spec 2, seção 2). O convite vai em português e inglês (spec 1, 4.2).

### Perfil (spec 1, seção 8)

| Evento | Quem recebe | Quando | Template no mock |
|---|---|---|---|
| Convite para validar ou cadastrar (PT + EN, link de ativação) | Ponto focal | Na abertura da validação ou no cadastro da empresa | — (criar) |
| Lembrete de validação | Ponto focal | `validation_reminder_days` (7 e 14) após o convite; depois a cada `validation_reminder_repeat_days` (14) | — (job) |
| Perfil enviado para revisão | Equipe | Na hora do envio | `profile_submitted` |
| Perfil aprovado | Empresa | Na aprovação | `profile_approved` |
| Perfil devolvido, com comentário | Empresa | Na devolução | `profile_returned` |
| Aviso de saída do perfil provisório | Empresa | `provisional_warning_days` (15 e 7) antes do dia `launch_date + provisional_profile_days` | — (job) |
| Lembrete de atualização trimestral | Empresa | `quarterly_update_reminder_days` (90) sem atualização | — (job) |
| Alerta de perfil desatualizado | Equipe | `outdated_profile_alert_days` (120) sem atualização (o painel já mostra o alerta) | — (job) |

**Rotina diária de perfis provisórios:** no dia `launch_date + provisional_profile_days`, organizações com `public_state = provisional` e sem aprovação passam a `public_state = hidden` e `status = offline`. A equipe pode reativar manualmente.

### Registro de contatos (spec 2, seção 9)

| Evento | Quem recebe | Quando | Template no mock |
|---|---|---|---|
| Boas-vindas com o texto Lead/NIA/NPIA (PT) | Empresa | Na ativação da conta da empresa | — (criar; texto da spec 2, 3.1) |
| Verificação de e-mail do investidor | Investidor | No cadastro e no "reenviar" | `investor_verify_email` |
| Novo pedido de contato | Empresa (ponto focal e usuários) e equipe | Na hora do pedido | `contact_request_company`, `contact_request_team` |
| Pedido sem interação registrada | Empresa | `contact_warning_business_days` (10, aviso) e `contact_overdue_business_days` (15, vencido) | — (job) |
| Pedido vencido | Equipe | Após `contact_overdue_business_days` (15) | — (job) |
| Sugestão de classificação ou anúncio | Equipe | Na hora do envio | `classification_suggested`, `npia_reported` |
| Classificação ou anúncio validado ou ajustado | Empresa | Na validação | `classification_validated`, `npia_validated` |
| Registros incompletos | Empresa | Mensal | — (job) |

## 6. Importação do Google Forms (spec 1, seção 7)

Planilha: "Formulário Complementar - Frente de Investimentos Abiquifi 2026-2028 (respostas)", colunas A a BP, 39 respostas → 32 organizações / 38 projetos. Cinco respostas não têm nome de empresa e precisam ser identificadas pela equipe antes. O vínculo resposta → organização/projeto deve ser feito pela equipe (sugestão: uma tabela de mapeamento `form_responses(row, organization_id, project_id)`).

Regras por tipo de campo:
- **Pré-preenchido**: a resposta entra no campo e grava `form_imports{mode:'prefilled'}`.
- **Só referência**: o campo fica vazio e grava `form_imports{mode:'reference', previous_answer:<texto bruto>}`. Vale para todos os valores (as respostas misturam reais, dólares e faixas) e para respostas fora das listas.
- **Novo**: em branco.
- **Inglês**: textos em inglês vêm do portfólio de junho/2026 quando a empresa está nele; senão a equipe traduz na revisão.
- A pergunta "Rodada atual / próxima rodada" aparece duas vezes (colunas **P e Q**): as duas respostas entram como referência em `rounds`.
- Porte, segmentos, tipo de parceria e ponto focal só existem em 15 das 39 respostas.

Mapeamento coluna → campo (tabelas 5.3 e 5.4):

| Coluna | Campo | Modo |
|---|---|---|
| C | organizations.name | pré-preenchido |
| BM | organizations.size | pré-preenchido |
| BN | organizations.segments | pré-preenchido |
| BO | organizations.partnership_types | pré-preenchido |
| BK, BL | organizations.focal_point | pré-preenchido |
| **Perfil A** | | |
| E | lead_product_name | pré-preenchido |
| F | segment | pré-preenchido |
| G | lead_product_moa | pré-preenchido |
| H | trl | pré-preenchido |
| I | regulatory_phase | pré-preenchido |
| J | milestones | pré-preenchido |
| K | pipeline | pré-preenchido |
| L | patents_filed | pré-preenchido |
| M | patents_granted | pré-preenchido |
| N | fto | pré-preenchido |
| O | raised | só referência |
| P, Q | rounds | só referência |
| R | revenue | só referência |
| S | gtm_models / gtm_text | pré-preenchido |
| T | target_markets | pré-preenchido |
| **Perfil B** | | |
| U | platform_description | pré-preenchido |
| V | competitive_edge | pré-preenchido |
| W | maturity | pré-preenchido |
| X | technology_tags / technology_text | pré-preenchido |
| Y | business_models / business_model_text | pré-preenchido |
| Z | traction | pré-preenchido |
| AA | revenue | só referência |
| **Perfil C** | | |
| AB | services / services_text | pré-preenchido |
| AC | molecule_types | pré-preenchido |
| AD | capacity_scales / utilization_pct / capacity_text | pré-preenchido |
| AE | certifications | pré-preenchido |
| AF | client_count / client_profiles | pré-preenchido |
| AG | revenue | só referência |
| AH | exports | só referência |
| AI | investment_types | pré-preenchido |
| AJ | target_markets | pré-preenchido |
| **Perfil D** | | |
| AK | services / services_text | pré-preenchido |
| AL | therapeutic_areas / scope_text | pré-preenchido |
| AM | models | pré-preenchido |
| AN | partner_sites | pré-preenchido |
| AO | certifications / certificate_numbers | pré-preenchido |
| AP | client_count / client_profiles | pré-preenchido |
| AQ | revenue | só referência |
| AR | exports | só referência |
| AS | investment_types | pré-preenchido |
| AT | target_markets | pré-preenchido |
| **Perfil E** | | |
| AU | product_portfolio | pré-preenchido |
| AV | production_capacity | pré-preenchido |
| AW | export_markets / export_markets_text | pré-preenchido |
| AX | certifications | pré-preenchido |
| AY | partnership_interests | pré-preenchido |
| AZ | partnership_models | pré-preenchido |
| BA | expansion_projects | pré-preenchido |
| BB | investment_range / investment_description | só referência |
| **Perfil F** | | |
| BC | products / products_text | pré-preenchido |
| BD | markets_served / markets_text | pré-preenchido |
| BE | certifications | pré-preenchido |
| BF | market_share | só referência |
| BG | revenue | só referência |
| BH | exports | só referência |
| BI | partnership_models | pré-preenchido |
| BJ | investment_range | só referência |

Campos "Novo (em branco)" na spec (logo, descrição, site, cidade/UF, tipo de plataforma, tipo de instituição, uso dos recursos de A, plano/estratégia de expansão etc.) não vêm da planilha. Antes da validação, a equipe monta o **perfil provisório** em inglês a partir do portfólio de junho/2026 e das respostas (spec 1, 4.1, passo 4); é o que o seed simula.

## 7. Exportação para a ApexBrasil (spec 2, 7.4 e anexo)

- **Formato:** XLSX com as abas e a ordem de colunas do modelo da Apex: **CG** (controle geral de contatos), **INV** (investidores), **ST** (empresas/startups). **ATD** é o modelo de controle geral de atendimentos.
- **Filtros:** período (pela **data da interação**), empresa, classificação e evento. O filtro de período substitui o controle por parcelas; não há campos de parcela.
- **Interações:** exportadas nos pares "Produto" e "Descritivo" (INV·M/N, O/P, Q/R, S/T, U/V, W/X), com o texto no formato `dd/mm/aaaa – descrição`. Acima de seis pares, as demais interações entram no último descritivo.
- **Uma linha por contato e empresa** (= por relacionamento) na aba INV.
- **Anúncios sigilosos** só saem para a Apex e para a equipe; nunca para outras empresas.
- Só a equipe exporta.

Mapeamento (anexo da spec 2):

| Nível | Campo | Coluna no modelo |
|---|---|---|
| Contato | Nome e sobrenome | CG·D, INV·J |
| Contato | E-mail | CG·F, INV·K |
| Contato | País | CG·G, INV·L |
| Contato | Cidade | CG·H |
| Contato | Cargo | CG·E, INV·I |
| Contato | LinkedIn | CG·J |
| Contato | Telefone | — |
| Instituição | Nome da instituição | CG·C, INV·G |
| Instituição | Tipo de investidor | CG·I |
| Instituição | Nicho | CG·S |
| Instituição | Tíquete estimado para o Brasil | CG·T, CG·U |
| Instituição | Tipo de interesse | CG·V |
| Instituição | Setores | CG·W |
| Instituição | Descrição da instituição | INV·E, INV·F |
| Instituição | Site | — |
| Relacionamento | Empresa do portfólio | INV·A, ST·C |
| Relacionamento | Responsável | CG·A |
| Relacionamento | Origem do contato | CG·R |
| Relacionamento | Status | ST·K |
| Relacionamento | Expectativa de deal | ST·L |
| Relacionamento | Classificação | CG·O–Q, INV·B |
| Relacionamento | Anúncio (NPIA) | — |
| Interação | Data | INV·N/P/R/T/V/X |
| Interação | Descrição | INV·N/P/R/T/V/X |
| Interação | Tipo de interação | — |
| Interação | Produto Apex | INV·M/O/Q/S/U/W |
| Interação | Evento | CG·R |
| Controle Apex | Conta no Dynamics | CG·B, CG·X, INV·C |
| Controle Apex | Contato cadastrado | CG·Y |
| Controle Apex | Oportunidade inserida | CG·Z, INV·D |
| Controle Apex | Descritivo da oportunidade (Word) | CG·AA |
| Controle Apex | Categoria estratégica | ATD·AZ |
| Controle Apex | Observações do atendimento | CG·AB |
| Controle Apex | Continuidade por ano | CG·K–N (calculado: `crm.continuityForYear`) |

Os modelos de planilha da Apex (arquivos) não vieram com este pacote: pedir à Abiquifi para conferir os nomes das abas e cabeçalhos exatos.

## 8. Checklist de publicação

- [ ] Apagar linhas `demo: true` (organizations, projects e dependentes) e todo o registro de contatos de exemplo.
- [ ] Trocar `api.js` pela versão HTTP; remover `mockStore.js`, `loginAs`, `listDemoCompanyAccounts`, `resetDemoData` e o seletor de demonstração do login.
- [ ] Hash de senha, sessões seguras, HTTPS, rate limit em login, cadastro e pedido de contato.
- [ ] Textos finais dos termos de uso e da política de privacidade (`#/legal/terms`, `#/legal/privacy`).
- [ ] Jobs agendados (seção 5) e provedor de e-mail.
- [ ] Importação do Google Forms (seção 6) e exportação XLSX (seção 7).
- [ ] Revisar os itens de `docs/DUVIDAS.md` com a Abiquifi/B2H.
