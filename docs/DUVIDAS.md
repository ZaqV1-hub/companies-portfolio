# Dúvidas e decisões tomadas

Pontos em que as especificações (docs/especificacao-perfil.md = **spec 1**, docs/especificacao-contatos.md = **spec 2**) deixam margem, ou em que o protótipo e a especificação divergem. Em cada caso foi seguida a opção mais simples; tudo pode ser revisto.

## Dados de exemplo

1. **Volume e empresas fictícias (confirmado pelo cliente).** O protótipo tinha 23 empresas, e a spec fala em 32 organizações e 38 projetos. Foram criadas 9 organizações **fictícias** (Aurora Farma, Instituto Vital Bio, BioFactor CDMO, Nexa Insumos, Amazônia Bioativos, Veritas Clinical CRO, Synthera Bio, Lumina Diagnostics, Pharmaplex Industrial) e segundos projetos fictícios para Crop Labs e Embrapa, chegando a 32 organizações e 38 projetos. Os dados reais virão da importação do Google Forms (spec 1, seção 7). Organizações e projetos fictícios têm `"demo": true` no seed (`data/seed/organizations.json` e `projects.json`) para serem removidos antes de publicar; `seed_note` explica a origem.
2. **Dados preenchidos para a demonstração nas 23 empresas reais.** Os textos em português, cidades, sites (sempre no domínio `.example`), nomes da liderança, pontos focais, porte e a separação dos valores em listas (rodadas, fontes de captação) foram preenchidos só para a demonstração. Valores que o protótipo trazia em reais foram convertidos a cerca de R$ 5,40 por dólar apenas para preencher o exemplo; na plataforma real a empresa informa em USD (spec 1, seção 2).
3. **Organizações com vários projetos de perfis diferentes.** A Aurora Farma (fictícia, no lugar do caso Aché) tem projetos A, A, C e F. A Embrapa tem projetos E e B.

## Perfil e página pública

4. **Nome do projeto.** A spec não define um campo "nome do projeto". No seletor de projetos e no card, o título de cada projeto é o subtítulo do perfil (segmento, tipo de plataforma, serviços, tipo de instituição ou produtos), seguido do "Resumo do projeto".
5. **Card de organização com vários projetos.** O card mostra o chip, o subtítulo, o estágio e o resumo de "O que buscamos" do **primeiro** projeto (ordem `sort_order`), seguidos de "X projects", na ordem da spec 6.1. Os filtros consideram todos os projetos da organização. O link do card abre o primeiro projeto; os demais ficam no seletor.
6. **Título do card lateral em inglês.** A spec chama o card de "O que buscamos" e o primeiro item de "Looking for". Em inglês o card ficou "What We're Looking For" e o item "Looking for"; em português, "O que buscamos" e "Buscamos".
7. **Gráfico de estágio.** A tabela 6.3 não inclui o gráfico na ordem da coluna principal; ele ficou no cabeçalho, junto do chip de estágio, para não alterar a ordem dos blocos.
8. **Status dos marcos.** O protótipo mostrava "Concluído / Em andamento / Previsto" em cada marco, calculado pela data. A spec não pede isso, mas também não proíbe; foi mantido (cálculo automático, não é campo).
9. **Blocos do protótipo removidos.** Os painéis "Raised vs. Target" (barra de captação) e "Pipeline Stage" do protótipo não existem na spec e foram substituídos pela estrutura da tabela 6.3. A galeria foi para o fim da página (spec 6.2).
10. **Ordem do diretório.** O protótipo mostrava a busca antes dos destaques; a spec (6.1) pede destaques antes da busca. Foi seguida a spec.
11. **Acesso da equipe.** A barra superior da spec (6.1) tem só idioma, acesso do investidor e acesso da empresa. O botão "Admin Access" do protótipo saiu da barra; o acesso da equipe ficou num link discreto no rodapé ("Program team").
12. **Nomes próprios não traduzidos.** Nome da organização, nome do produto principal, nomes de itens do pipeline e nomes de centros parceiros são guardados como texto único (não têm versão `pt`/`en`).

## Listas fechadas incompletas na spec

13. Algumas listas da spec terminam em "…" ou não trazem os valores. Foram usados só os valores citados, mais "Outro", em:
    - **Tecnologia (Perfil B):** AI/ML, genômica, eletroquímica, biossensores, microfluídica, fermentação, outra.
    - **Tipos de moléculas (Perfil C):** pequenas moléculas, biológicos, anticorpos, vacinas, IFAs, outro.
    - **Certificações:** as citadas em cada perfil, mais "Outra".
    - **Áreas terapêuticas (Perfil D):** a spec diz "Múltipla" sem listar valores. Foi criada uma lista provisória: oncologia, doenças infecciosas, imunologia, sistema nervoso central, cardiovascular, dermatologia, metabólico, saúde animal, bens de consumo, outro. **Precisa de validação.**
    - **Perfil de clientes (Perfil D):** a spec diz "perfil" sem lista; foi usada a mesma do Perfil C (startups, farma nacional, multinacionais).
14. **Exportações têm formatos diferentes por perfil**, como na spec: Perfil C usa valor em USD por ano ou "não exporta"; Perfis D e F usam percentual do faturamento + destinos.
15. **Foto da liderança.** A spec (5.5) pede nome, cargo e uma linha de experiência, sem foto. A página mostra as iniciais num círculo no lugar da foto.
16. **Dois rodapés no perfil.** O rodapé do perfil (texto do programa + data da última aprovação, spec 6.2 item 7) fica no fim da página, e o rodapé geral do site (com o link da equipe) fica logo abaixo.
17. **Perfil provisório no rodapé.** Sem aprovação, o rodapé mostra "Perfil provisório montado pela equipe… aguardando a validação da empresa" no lugar da data da última aprovação.
