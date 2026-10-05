# Publicação na VM Windows

Este documento descreve a implantação de teste de Companies Portfolio em `https://companiesportfolio.brevia.company`. Não use os comandos deste guia para alterar outros sites ou serviços da VM.

## Site e IIS

O site chama-se `CompaniesPortfolio` (ID 98) e usa a pasta `C:\Sites\AzureIIS\companiesportfolio`, com o application pool dedicado `CompaniesPortfolioAppPool`. O pool usa identidade ApplicationPoolIdentity e No Managed Code. O site está associado aos bindings HTTP e HTTPS de `companiesportfolio.brevia.company`; o certificado e sua renovação pelo win-acme foram mantidos. A tarefa agendada `win-acme renew (acme-v02.api.letsencrypt.org)` continua habilitada.

O `web.config` do site encaminha somente `/api` para `http://127.0.0.1:4317/api`. URL Rewrite e ARR já estavam instalados. Para que imagens públicas possam ser lidas sem ampliar permissões para outros sites, a autenticação anônima deste site usa a identidade do seu application pool. A pasta do site e a pasta de uploads já concedem leitura a essa identidade.

## API, serviço e logs

A API usa Node.js 22.14.0 com Express e escuta apenas em `127.0.0.1:4317`. O serviço Windows chama-se `CompaniesPortfolioApi`, inicia automaticamente e reinicia após falha. Ele segue o padrão WinSW usado na VM. O wrapper e a configuração ficam em `C:\Services\CompaniesPortfolioApi`; o código executável está em `C:\Services\CompaniesPortfolioApi\app\server`.

O serviço aparece no Windows como `NT AUTHORITY\LocalService`, com o SID exclusivo `NT SERVICE\CompaniesPortfolioApi` habilitado. Esse SID recebe leitura do arquivo de ambiente, modificação nos logs e gravação nos uploads. Para verificar ou reiniciar somente esta API:

```powershell
Get-Service CompaniesPortfolioApi
Restart-Service CompaniesPortfolioApi
Invoke-RestMethod http://127.0.0.1:4317/api/health
```

Os logs do WinSW ficam em `C:\Services\CompaniesPortfolioApi\logs` e rodam por tamanho, mantendo até cinco arquivos. A API também registra falhas de inicialização e erros de rota nesses logs.

## Ambiente e dados

O arquivo de ambiente está fora do site em `C:\Secrets\companiesportfolio\test.env`. A pasta e o arquivo autorizam o Administrador e o SID exclusivo do serviço da API. Não copie esse arquivo para o repositório, para a pasta pública nem para backups compartilhados sem proteção.

As variáveis configuradas são `NODE_ENV`, `API_PORT`, `PUBLIC_ORIGIN`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DEMO_MODE`, `SESSION_TTL_SECONDS`, `UPLOAD_ROOT` e `SESSION_SECRET`. Não inclua os valores em código, Git, logs ou documentação. `DEMO_MODE=true` habilita as rotas de demonstração neste ambiente; em outros ambientes, deixe-as desligadas.

O banco de teste é `companiesportfolio_test`, no MySQL 8.0.32, porta 3306. A API conecta-se como `cp_test_app` em `localhost`, com acesso restrito a esse banco. O banco deve ser provisionado previamente por um administrador de MySQL; a conta da aplicação não cria bancos nem usuários.

Para inicializar um banco de teste recém-provisionado, abra o PowerShell na pasta `C:\Services\CompaniesPortfolioApi\app\server`, carregue o arquivo de ambiente sem imprimir seu conteúdo e rode a migração e o seed com o Node configurado:

```powershell
$env:ENV_FILE = 'C:\Secrets\companiesportfolio\test.env'
$node = 'C:\Lumi\runtime\node-v22.14.0-win-x64\node.exe'
$npm = 'C:\Lumi\runtime\node-v22.14.0-win-x64\node_modules\npm\bin\npm-cli.js'
& $node $npm run migrate
& $node $npm run seed
```

A migração verifica a conexão com o banco já existente e cria apenas as tabelas da aplicação. O seed carrega os arquivos de `data/seed/`, preserva os IDs e gera hashes para as senhas. Ele inclui os registros marcados como demo. Não rode o seed ou `reset-demo` durante uma atualização normal, pois essas operações podem regravar dados de demonstração.

Uploads ficam em `C:\CompaniesPortfolioData\uploads`, fora do código. O IIS publica essa pasta no caminho `/uploads`; a identidade do application pool lê os arquivos e o SID do serviço grava neles. A API valida tipo, dimensão e tamanho e sanitiza SVG antes de gravar.

## Backup da versão estática anterior

Antes da troca, a versão estática original foi copiada para `C:\Sites\AzureIIS\backups\companiesportfolio-static-20261005-084359`. Preserve esse backup até que o cliente aprove a versão nova. Faça outro backup da pasta do site antes de cada publicação futura.

## Atualização futura

No checkout autorizado do repositório `ZaqV1-hub/companies-portfolio`, atualize a partir da `main` e confirme a revisão que será publicada. Antes de substituir arquivos, copie `C:\Sites\AzureIIS\companiesportfolio` para uma nova pasta de backup sob `C:\Sites\AzureIIS\backups`.

Copie os arquivos públicos do front para `C:\Sites\AzureIIS\companiesportfolio`, preservando o `web.config` configurado para o proxy. Copie `server` para `C:\Services\CompaniesPortfolioApi\app\server` e `data\seed` para `C:\Services\CompaniesPortfolioApi\app\data\seed`, sem sobrescrever o arquivo externo de ambiente. Na pasta `C:\Services\CompaniesPortfolioApi\app\server`, use Node 22.14.0 e seu npm empacotado para reinstalar dependências: `& $node $npm ci --omit=dev --include=optional`. Rode somente as migrações pendentes com `& $node $npm run migrate`; não rode o seed em uma atualização normal. Em seguida, reinicie apenas `CompaniesPortfolioApi` e confirme o resultado em `http://127.0.0.1:4317/api/health` e `https://companiesportfolio.brevia.company/api/health`.

Não use `iisreset`, não reinicie pools compartilhados e não altere bindings, certificados ou bancos de outros clientes. A publicação estática não requer reiniciar o IIS nem o application pool.
