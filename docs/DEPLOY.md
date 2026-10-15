# Publicação na VM Windows

Este documento descreve a implantação de teste de Companies Portfolio em `https://companiesportfolio.brevia.company`. Não use os comandos deste guia para alterar outros sites ou serviços da VM.

## Site e IIS

O site chama-se `CompaniesPortfolio` (ID 98) e usa a pasta `C:\Sites\AzureIIS\companiesportfolio`, com o application pool dedicado `CompaniesPortfolioAppPool`. O pool usa identidade ApplicationPoolIdentity e No Managed Code. O site está associado aos bindings HTTP e HTTPS de `companiesportfolio.brevia.company`; o certificado e sua renovação pelo win-acme foram mantidos. A tarefa agendada `win-acme renew (acme-v02.api.letsencrypt.org)` continua habilitada.

O `web.config` do site encaminha somente `/api` para `http://127.0.0.1:4317/api`. URL Rewrite e ARR já estavam instalados. Para que imagens públicas possam ser lidas sem ampliar permissões para outros sites, a autenticação anônima deste site usa a identidade do seu application pool. A pasta do site e a pasta de uploads já concedem leitura a essa identidade.

As áreas privadas abrem em `/empresa` e `/painel`. O `web.config` também encaminha essas rotas, os perfis públicos em `/org` e as páginas `/legal` para `index.html`. O script de publicação preserva o `web.config` já instalado no IIS; quando a regra de rotas mudar no repositório, atualize esse arquivo no site separadamente.
Os links de confirmação e recuperação usam `/verify-email` e `/reset-password`; essas rotas também precisam apontar para `index.html` no IIS.
O IIS desabilita cache dos arquivos estáticos deste protótipo para que o navegador carregue imediatamente o JavaScript novo depois de cada publicação.

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

As variáveis configuradas são `NODE_ENV`, `API_PORT`, `PUBLIC_ORIGIN`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DEMO_MODE`, `SESSION_TTL_SECONDS`, `UPLOAD_ROOT` e `SESSION_SECRET`. Não inclua os valores em código, Git, logs ou documentação. A antiga opção `DEMO_MODE` já não permite contornar a verificação de e-mail; ela pode ser retirada da configuração quando conveniente.
Para habilitar o cadastro do investidor e a recuperação de senha por e-mail, configure também `SMTP_HOST`, `SMTP_PORT` (465 ou 587), `SMTP_FROM` e, se o servidor exigir autenticação, `SMTP_USER` e `SMTP_PASSWORD` no mesmo arquivo protegido. Enquanto o SMTP não estiver configurado, a API responde que o envio está indisponível e não conclui o primeiro passo do cadastro. O e-mail precisa ser confirmado antes da criação da conta; o link vale 24 horas. O link de redefinição de senha vale uma hora. A sessão do investidor dura 30 dias após o cadastro ou login.

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

Os PDFs publicados pela equipe ficam em `C:\CompaniesPortfolioData\documents` (ou no caminho definido por `DOCUMENT_ROOT`), fora da pasta pública do IIS. Só a API serve documentos publicados, por `/api/public/documents/:id/file`. A equipe envia e gerencia os PDFs em `/painel/documents`; a página inicial os mostra ao lado dos filtros. Inclua essa pasta no plano de backup dos dados, junto com `uploads`. A publicação automática do código não apaga nem copia essas pastas.

Os usuários, sessões, perfis e registros do CRM ficam no banco MySQL da VM. As imagens enviadas ficam na pasta de uploads da VM, e o banco guarda os caminhos usados pelos perfis. As áreas de empresa e equipe exigem login por e-mail e senha; a antiga entrada de demonstração sem senha foi removida.

A migração `004_crm_dashboard_demo.sql` adiciona contatos e interações fictícios ao banco de teste para preencher os gráficos do CRM. Seus IDs começam com `demo-crm-`, seus e-mails usam `example.com` e a interface os identifica como `DEMO`. Os registros antigos do seed com ID `rel-<número>` também são tratados como demonstração. O filtro “Dados” do painel separa os contatos reais desses exemplos; as exportações CSV e PDF indicam quando incluem dados fictícios. A publicação normal executa essa migração uma única vez e não roda o seed.

## Backup da versão estática anterior

Antes da troca, a versão estática original foi copiada para `C:\Sites\AzureIIS\backups\companiesportfolio-static-20261005-084359`. Preserve esse backup até que o cliente aprove a versão nova. Faça outro backup da pasta do site antes de cada publicação futura.

## Publicação automática (GitHub Actions)

Cada push na `main` publica a nova versão na VM sem intervenção. O fluxo está em `.github/workflows/deploy.yml`:

1. **Checks** (máquina do GitHub): sintaxe de todo o JavaScript do front e da API, validade dos JSON (traduções e seed) e instalação das dependências da API a partir do `package-lock.json`. Se algo falhar, nada é publicado.
2. **Publish on the VM** (runner instalado na própria VM): baixa a revisão da `main` e roda `deploy/windows/deploy.ps1`.

O script `deploy/windows/deploy.ps1` faz os mesmos passos da publicação manual:

- confere pastas, serviço, Node e arquivo de ambiente;
- faz backup do site e da API em `C:\Sites\AzureIIS\backups\companiesportfolio-auto-<data-hora>` e mantém só os 10 últimos backups automáticos (o backup estático original não é tocado);
- para **somente** o serviço `CompaniesPortfolioApi`, copia `server` e `data\seed`, roda `npm ci --omit=dev --include=optional` e `npm run migrate` (apenas migrações pendentes), religa o serviço e espera `/api/health` responder;
- copia o front (`index.html`, `src`, `i18n`, `assets`, `vendor`) para a pasta do site, **mantendo o `web.config` do site**;
- confere `https://companiesportfolio.brevia.company/api/health` e a página inicial;
- grava a revisão publicada em `C:\Services\CompaniesPortfolioApi\app\deploy-info.json`.

Se qualquer etapa falhar, o script restaura automaticamente o site e a API a partir do backup e religa o serviço. **Migrações de banco não são desfeitas automaticamente**: se uma migração rodou antes da falha, avalie o banco manualmente.

O script nunca roda o seed nem o `reset-demo` e não usa `iisreset`. Também não reinicia pools nem altera bindings, certificados, outros sites ou o arquivo de ambiente.

### Acompanhar e repetir

- Andamento e logs: aba **Actions** do repositório, workflow **Deploy**.
- Publicar de novo sem novo commit, ou só simular: **Actions → Deploy → Run workflow**. A opção `dry_run` lista o que mudaria sem copiar, parar ou fazer backup.
- Para exigir aprovação antes de cada publicação: **Settings → Environments → production → Required reviewers**.

### Instalação do runner na VM (uma vez, por um administrador)

O runner é um serviço Windows que busca os jobs no GitHub. Ele só faz conexões de saída (HTTPS para github.com); não abre nenhuma porta na VM.

1. **Criar a conta de serviço** do runner, sem privilégios de administrador e com senha forte que nunca expira. Esta VM é um controlador de domínio (`A4BEDU`), por isso a conta usada é a conta de domínio `A4BEDU\svc-cp-deploy`; não há contas locais nesta máquina.
2. **Dar à conta só as permissões necessárias** (PowerShell como administrador):

   ```powershell
   $acct = 'A4BEDU\svc-cp-deploy'
   icacls 'C:\Sites\AzureIIS\companiesportfolio' /grant "${acct}:(OI)(CI)M"
   icacls 'C:\Services\CompaniesPortfolioApi' /grant "${acct}:RX"
   icacls 'C:\Services\CompaniesPortfolioApi\app' /grant "${acct}:(OI)(CI)M"
   icacls 'C:\Sites\AzureIIS\backups' /grant "${acct}:(OI)(CI)M"
   icacls 'C:\Secrets\companiesportfolio' /grant "${acct}:RX"
   icacls 'C:\Secrets\companiesportfolio\test.env' /grant "${acct}:R"
   icacls 'C:\Lumi\runtime\node-v22.14.0-win-x64' /grant "${acct}:(OI)(CI)RX"
   ```

   As permissões `RX` nas pastas pais da API e do ambiente permitem à conta acessar somente os caminhos necessários dentro delas. O script põe o Node 22 no início do `PATH` ao chamar o npm, inclusive para os comandos filhos de migração.

   Permissão para parar e iniciar **somente** o `CompaniesPortfolioApi`:

   ```powershell
   $sid = (New-Object System.Security.Principal.NTAccount($acct)).Translate([System.Security.Principal.SecurityIdentifier]).Value
   $sd = (sc.exe sdshow CompaniesPortfolioApi | Out-String).Trim()
   # Acrescenta "consultar, iniciar, parar" para a conta, antes da parte S: (auditoria), se houver
   $ace = "(A;;RPWPLCRC;;;$sid)"
   $newSd = if ($sd -match 'S:') { $sd -replace 'S:', "${ace}S:" } else { $sd + $ace }
   sc.exe sdset CompaniesPortfolioApi $newSd
   ```

3. **Registrar o runner**: no GitHub, abra **Settings → Actions → Runners → New self-hosted runner → Windows (x64)** e siga os comandos de download da página na pasta `C:\actions-runner-companiesportfolio`, usada nesta VM. Na configuração, use o token mostrado na página:

   ```powershell
   .\config.cmd --url https://github.com/ZaqV1-hub/companies-portfolio --token <TOKEN-DA-PAGINA> `
     --name companiesportfolio-vm --labels companiesportfolio --work _work `
     --runasservice --windowslogonaccount 'A4BEDU\svc-cp-deploy' --windowslogonpassword '<senha>'
   ```

   O rótulo `companiesportfolio` é o que o workflow procura (junto com `self-hosted` e `windows`, que o runner já recebe sozinho). O token de registro vale por uma hora e não deve ser guardado.

4. **Opcional**: instalar o Git for Windows, para o checkout ser mais rápido (sem ele, o runner baixa o código pela API do GitHub).
5. **Testar**: **Actions → Deploy → Run workflow** com `dry_run` marcado. Depois rode sem `dry_run`, ou faça um push na `main`.

Para remover o runner: `.\config.cmd remove --token <TOKEN>`, com um token gerado na mesma página do GitHub.

## Publicação manual (alternativa)

Se o runner estiver parado, a mesma publicação pode ser feita à mão na VM. Abra o PowerShell como um usuário com as permissões acima, num checkout atualizado da `main`:

```powershell
git pull
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\deploy.ps1           # publica
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\deploy.ps1 -DryRun   # só simula
```

Todos os caminhos (site, API, Node, arquivo de ambiente, URLs de health) têm valores padrão iguais aos desta VM e podem ser trocados por parâmetros do script.

Não use `iisreset`, não reinicie pools compartilhados e não altere bindings, certificados ou bancos de outros clientes. A publicação estática não requer reiniciar o IIS nem o application pool.
