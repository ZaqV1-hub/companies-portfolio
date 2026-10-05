# Companies Portfolio · Brazilian Pharma & Health (v2)

Diretório de investimento de empresas brasileiras de saúde, biotech e farma (Abiquifi + ApexBrasil).
Protótipo front-end evoluído conforme as duas especificações da Bio2Health, com dados de exemplo, pronto para ser ligado a uma API real (ver `docs/HANDOFF_CODEX.md`).

## Como abrir no seu computador

O app não tem etapa de build, mas precisa ser aberto por um servidor local, porque o navegador bloqueia módulos e arquivos de dados em `file://`. Abrir o `index.html` com duplo clique não funciona.

1. Descompacte a pasta do projeto.
2. Abra um terminal dentro dela e rode `python3 -m http.server 8000`. No Windows, use `py -m http.server 8000`.
3. Abra `http://localhost:8000` no navegador.

Qualquer servidor estático serve (`npx serve`, nginx, Apache).

### Acessos de demonstração

Senha de todos: `demo`.

| Perfil | Como entrar |
|---|---|
| Investidor | "Investor Access" → `sarah.chen@meridiancapital.example`, ou crie uma conta nova (a confirmação de e-mail é simulada na própria tela) |
| Empresa | "Company Access" → escolha a empresa em "Log in as (demo)". Sugestões: **KRABS** (primeira validação, com marcas de pré-carga), **Aurora Farma** (4 projetos), **ImunoTera** (contatos) |
| Equipe Abiquifi/B2H | link "Program team" no rodapé → `team@abiquifi.org.br` |

Os dados alterados ficam no navegador (`localStorage`). Para voltar ao estado inicial, rode `localStorage.clear()` no console do navegador e recarregue a página.

### O que dá para testar

- **Site público (EN/PT):** diretório com destaques, busca e 8 filtros; perfis A a F; seletor de projetos; "Request Contact" exige conta de investidor.
- **Área da empresa:** formulário em etapas com prévia e envio para revisão; contatos (pendências, novo contato, ficha, sugestão de classificação, anúncio NPIA).
- **Painel da equipe:** fila de revisão com antes/depois, aprovar e devolver; status das organizações; registro de contatos (indicadores, fila de validação, Controle Apex, exportação); configurações.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Página única; carrega React 18, htm e `src/main.js` |
| `src/services/api.js` | **Única porta de dados.** Toda leitura e escrita das telas passa por aqui |
| `src/services/mockStore.js` | Persistência mock (seed JSON + localStorage), usada só pelo `api.js` |
| `src/lib/` | i18n, formatos (moeda, datas), rotas, regras de exibição, formulário, validação e CRM |
| `src/components/`, `src/pages/` | Telas (React + htm, sem JSX nem build) |
| `src/styles/app.css` | Identidade visual (navy, verde-limão, Archivo Black / Poppins / Inter) |
| `i18n/en.json`, `i18n/pt.json` | Todos os textos da interface e os rótulos das listas fechadas |
| `data/seed/` | Dados de exemplo, um JSON por tabela. `"demo": true` = fictício |
| `tools/seed/` | Gerador do seed (`python3 tools/seed/build_seed.py`) |
| `docs/especificacao-perfil.md`, `docs/especificacao-contatos.md` | Especificações B2H em Markdown |
| `docs/SCHEMA.md` | Entidades, campos, tipos, obrigatoriedade, relações e enums |
| `docs/HANDOFF_CODEX.md` | O que está mockado, funções → endpoints, regras de servidor, e-mails e prazos, importação e exportação |
| `docs/DUVIDAS.md` | Pontos ambíguos e a opção escolhida |
| `original/` | Arquivos recebidos (protótipo bundled e as especificações em .docx) |
| `prototype-v1/` | Protótipo original desempacotado, sem mudanças (referência visual) |
| `tools/unpack_bundle.py` | Desempacota o HTML bundled |
| `vendor/`, `assets/` | React 18.3.1, htm 3.1.1, fontes e imagens locais |

## Checklist de aceite

- [x] Versão desempacotada idêntica ao original antes das mudanças (comparação pixel a pixel em 13 telas)
- [x] Seletor EN/PT funcionando; site abre em inglês
- [x] 6 perfis com os campos e a ordem da spec 1 (6.3)
- [x] Organização com vários projetos mostra seletor e "X projects" no card
- [x] Nenhum bloco vazio ou placeholder aparece na página pública
- [x] Ponto focal não aparece em nenhuma tela pública (lista branca de campos no `api.js`)
- [x] Formulário em etapas com progresso, rascunho, "Revisei esta etapa" e prévia
- [x] Campos de valor recusam texto, "R$" e vírgula, com a mensagem certa
- [x] Envio bloqueado com obrigatório vazio ou etapa não revisada
- [x] Fila de revisão + tela antes/depois + Aprovar/Devolver funcionando (simulado)
- [x] Cadastro e login do investidor; "Solicitar contato" exige login
- [x] "Solicitar contato" cria Lead com origem "Portfólio" e primeira interação
- [x] "Novo contato" reaproveita e-mail existente
- [x] Empresa nunca vê contatos de outra empresa
- [x] Ajuda Lead/NIA/NPIA nos dois idiomas
- [x] Painel da equipe com indicadores, fila de validação e Controle Apex
- [x] Toda leitura e escrita passa por `api.js`
- [x] `SCHEMA.md`, `HANDOFF_CODEX.md`, `DUVIDAS.md` e `README.md` criados
- [x] `.zip` gerado

## Stack

- React 18.3.1 (UMD) com [htm](https://github.com/developit/htm) no lugar de JSX: módulos ES nativos, sem build.
- Rotas por hash (`#/org/nintx`), que funcionam em qualquer servidor estático.
- Fontes, React e htm são locais; o app roda sem CDN. Só as fotos de capa e galeria do exemplo vêm da internet (picsum.photos e unsplash.com, como no protótipo).
