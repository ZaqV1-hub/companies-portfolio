# Companies Portfolio · Brazilian Pharma & Health (v2)

Diretório de investimento de empresas brasileiras de saúde, biotech e farma (Abiquifi + ApexBrasil).
Protótipo front-end evoluído conforme as especificações da Bio2Health, com dados mockados, pronto para
ser ligado a uma API real.

## Como rodar

O app não tem etapa de build. Basta servir a pasta por HTTP, porque o navegador bloqueia módulos e `fetch` em `file://`:

```bash
python3 -m http.server 8000
# abra http://localhost:8000/
```

Qualquer servidor estático serve (`npx serve`, nginx etc.).

**Acessos de demonstração** (senha `demo`):

| Área | Como entrar |
|---|---|
| Empresa | "Acesso da empresa" → escolha a empresa na lista "Entrar como" |
| Equipe Abiquifi/B2H | link "Equipe do programa" no rodapé → `team@abiquifi.org.br` |

Os dados alterados ficam no `localStorage` do navegador. Para voltar ao estado inicial, rode `localStorage.clear()` no console e recarregue.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `index.html` | Página única; carrega React 18 (`vendor/`), htm e `src/main.js` |
| `src/services/api.js` | **Única porta de dados.** Toda leitura e escrita das telas passa por aqui |
| `src/services/mockStore.js` | Persistência mock (seed JSON + localStorage), usada só pelo `api.js` |
| `src/lib/` | i18n, formatos (moeda, datas), rotas, regras de exibição dos perfis |
| `src/components/`, `src/pages/` | Telas (React + htm, sem JSX/build) |
| `src/styles/app.css` | Identidade visual do protótipo (navy, verde-limão, Archivo Black / Poppins / Inter) |
| `i18n/en.json`, `i18n/pt.json` | Textos da interface |
| `data/seed/` | Dados de exemplo, um JSON por entidade (mesma estrutura do banco) |
| `tools/seed/` | Script que gera `data/seed/` (`python3 tools/seed/build_seed.py`) |
| `docs/` | Especificações em Markdown, SCHEMA, HANDOFF_CODEX, DUVIDAS |
| `original/` | Arquivos recebidos (protótipo bundled e as duas especificações em .docx) |
| `prototype-v1/` | Protótipo original desempacotado (referência visual) |
| `tools/unpack_bundle.py` | Desempacota o HTML bundled |

## Stack

- React 18.3.1 (UMD, em `vendor/`) com [htm](https://github.com/developit/htm) no lugar de JSX: módulos ES nativos, sem build.
- Rotas por hash (`#/org/nintx`), que funcionam em qualquer servidor estático.
- Fontes locais em `assets/fonts/` (extraídas do protótipo).
