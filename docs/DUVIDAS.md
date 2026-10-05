# Dúvidas e decisões tomadas

**Para decidir com a Abiquifi/B2H (mais importantes):** itens 13 (lista de áreas terapêuticas do Perfil D), 37 (textos dos termos e da política de privacidade), 44 (regra de contagem anual de Lead/NIA/NPIA) e 50 (lista de categorias estratégicas Apex).

Pontos em que as especificações (docs/especificacao-perfil.md = **spec 1**, docs/especificacao-contatos.md = **spec 2**) deixam margem, ou em que o protótipo e a especificação divergem. Em cada caso foi seguida a opção mais simples; tudo pode ser revisto.

## Dados de exemplo

1. **Volume e empresas fictícias (confirmado pelo cliente).** O protótipo tinha 23 empresas, e a spec fala em 32 organizações e 38 projetos. Foram criadas 9 organizações **fictícias** (Aurora Farma, Instituto Vital Bio, BioFactor CDMO, Nexa Insumos, Amazônia Bioativos, Veritas Clinical CRO, Synthera Bio, Lumina Diagnostics, Pharmaplex Industrial) e segundos projetos fictícios para Crop Labs e Embrapa, chegando a 32 organizações e 38 projetos. Os dados reais virão da importação do Google Forms (spec 1, seção 7). Organizações e projetos fictícios têm `"demo": true` no seed (`data/seed/organizations.json` e `projects.json`) para serem removidos antes de publicar; `seed_note` explica a origem.
2. **Dados preenchidos para a demonstração nas 23 empresas reais.** Os textos em português, cidades, sites (sempre no domínio `.example`), nomes da liderança, pontos focais, porte e a separação dos valores em listas (rodadas, fontes de captação) foram preenchidos só para a demonstração. Valores que o protótipo trazia em reais foram convertidos a cerca de R$ 5,40 por dólar apenas para preencher o exemplo; na plataforma real a empresa informa em USD (spec 1, seção 2).
3. **Organizações com vários projetos de perfis diferentes.** A Aurora Farma (fictícia, no lugar do caso Aché) tem projetos A, A, C e F. A Embrapa tem projetos E e B.

## Perfil e página pública

4. **Nome do projeto.** A spec não define um campo "nome do projeto". No seletor de projetos e no card, o título de cada projeto é o subtítulo do perfil (segmento, tipo de plataforma, serviços, tipo de instituição ou produtos), seguido do "Resumo do projeto".
5. **Card de organização com vários projetos.** O card mostra o chip, o subtítulo, o estágio e o resumo de "O que buscamos" do **primeiro** projeto (ordem `sort_order`), seguidos de "X projects", na ordem da spec 6.1. Os filtros consideram todos os projetos da organização. O link do card abre o primeiro projeto; os demais ficam no seletor. Quando há filtro de projeto ativo (perfil, mercado, fase, TRL, maturidade), o card mostra e abre o projeto que atende ao filtro.
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
18. **Filtro de TRL.** A spec lista "TRL" entre os filtros sem dizer o formato. Foi usado "TRL n ou mais" (mínimo), que é o uso mais comum para investidores.
19. **Filtros de mercado em E e F.** O filtro "Mercados-alvo" também considera "Mercados de exportação" (Perfil E) e "Mercados atendidos" (Perfil F), que usam a mesma lista de mercados.
20. **Filtros combinados.** Porte, segmento e tipo de parceria são da organização; perfil, mercado, fase, TRL e maturidade precisam valer para o **mesmo** projeto.

## Formulário da empresa

21. **Idioma do preenchimento.** A empresa preenche só a versão em português de cada texto (spec 1, seção 2). A versão em inglês não aparece no formulário da empresa; a equipe a edita na revisão. Na prévia em inglês, texto ainda sem tradução aparece em português.
22. **Campos "lista + texto".** Onde a spec diz "Múltipla + texto até N caracteres" e o campo é obrigatório, a lista é obrigatória e o texto complementar é opcional.
23. **Formulário bloqueado durante a revisão.** Enquanto o perfil está "Em revisão", o formulário fica só para leitura (a spec não diz se a empresa pode editar nesse período). Após "Devolver", volta a ser editável.
24. **Projetos fixos para a empresa.** A empresa não cria, apaga nem muda o perfil dos projetos; isso é feito pela equipe (spec 1, 4.6). O `api.js` recusa rascunhos com projetos diferentes.
25. **Marcas de pré-carga só na primeira validação.** "Importado do formulário · confirme" e "Resposta anterior: …" aparecem só para organizações que ainda não tiveram nenhuma aprovação. Depois da primeira aprovação, o formulário abre com a versão publicada.
26. **Campos "só referência" vazios.** Para essas organizações, o rascunho abre com os campos "só referência" vazios (mesmo que o perfil provisório no ar mostre valores montados pela equipe), como pede a spec 1, 5.2.
27. **Limites não definidos na spec.** Linha de experiência da liderança: 150 caracteres. Legenda da galeria: 120 caracteres. Nomes de itens (pipeline, centros parceiros, produtos): sem limite.
28. **Separador de milhar no campo de valor.** O separador segue o idioma da área da empresa: ponto em português ("1.000.000") e vírgula em inglês ("1,000,000"). A vírgula é recusada em português, por ser decimal; o ponto é recusado em inglês, pelo mesmo motivo.
29. **Imagens no protótipo.** Sem servidor, as imagens enviadas ficam no navegador, reduzidas para no máximo 1600 px de largura. As regras de formato e tamanho mínimo da spec são verificadas no envio. O servidor deve guardar o arquivo original (ver HANDOFF_CODEX.md).
30. **Salvamento automático.** Além do botão "Salvar rascunho", o rascunho é salvo ao trocar de etapa.

## Revisão pela equipe

31. **Ordem da fila.** "Ordenada por data" foi interpretado como do envio mais antigo para o mais recente (quem esperou mais aparece primeiro).
32. **O que a equipe edita.** Na tela de revisão, a equipe edita só a versão em inglês dos textos (spec 1, 4.3). Para mudar o conteúdo em português ou valores, a equipe usa "Devolver" com comentário.
33. **"Versão anterior" de empresa nova.** Sem versão publicada, a coluna da esquerda mostra a resposta do Google Forms dos campos "só referência" e "—" nos demais.
34. **Reativar / tirar do ar.** A lista de organizações tem um botão para tirar o perfil do ar ou reativá-lo manualmente (spec 1, 4.4). A saída automática no 60º dia fica para o servidor (rotina por data, fora deste escopo).
35. **Alerta de perfil desatualizado.** A lista de organizações já mostra "N dias sem atualização" quando um perfil publicado passa do prazo configurado (120 dias por padrão). O e-mail correspondente fica para o servidor.

## Investidor

36. **Senha no cadastro.** A tabela 6.1 da spec 2 não lista senha, mas o login precisa de uma. Foi incluído o campo "Senha" (obrigatório). No protótipo a senha fica em texto puro no navegador; o servidor deve guardar só o hash.
37. **Textos dos termos de uso e da política de privacidade.** Não foram fornecidos. As páginas `#/legal/terms` e `#/legal/privacy` têm um texto provisório. O aceite é gravado com data e versão (tabela `consents`).
38. **Tipo de investidor.** A lista Apex aparece com os nomes originais em inglês nos dois idiomas, como nos modelos da Apex.
39. **Login exige e-mail confirmado.** Uma conta não confirmada volta à tela "Verifique seu e-mail", com "Reenviar link". No protótipo, o link de confirmação aparece numa "caixa de entrada simulada".
40. **Pedido de contato repetido.** Se o investidor pede contato de novo com a mesma empresa, o relacionamento existente é reaproveitado (não se cria um segundo) e uma nova interação "Pedido de contato pela plataforma" é registrada, reiniciando a contagem dos 15 dias úteis.
41. **Projeto do pedido.** O relacionamento é com a organização (spec 2, seção 4); o projeto de onde veio o pedido fica registrado na interação (`project_id`).

## Registro de contatos

42. **Produto Apex sugerido.** A spec dá dois exemplos (reunião → Matchmaking de investimentos; envio de material → Portfólio de oportunidades). Para os demais tipos foi usado: e-mail → Informações básicas para o investidor; NDA e Proposta/term sheet → Matchmaking de investimentos; Outro → sem sugestão. A empresa pode trocar.
43. **Completude.** Conta os 11 campos "recomendados" da spec 2, 6.2: cargo, LinkedIn, tipo de investidor, nicho, tíquete, tipo de interesse, setores, descrição da instituição, site, origem e status. "Registro incompleto" = qualquer um desses faltando; esses registros aparecem primeiro na lista.
44. **Contagem dos indicadores por ano.** Leads: relacionamentos criados no ano (exceto BR e "Contato incompleto"). NIAs: relacionamentos validados como NIA ou NPIA no ano. NPIAs: anúncios validados no ano. Reuniões: interações do tipo reunião presencial ou virtual no ano. Empresas em eventos: empresas com interação de produto "Evento/seminário de promoção" no ano. **Precisa de confirmação da equipe Abiquifi/ApexBrasil.**
45. **Pedido sem interação.** O pedido sai das pendências quando a empresa registra qualquer interação manual com data igual ou posterior à do pedido. A contagem usa dias úteis com os feriados nacionais listados em `settings.holidays`.
46. **Possíveis duplicados.** Contatos com nomes muito parecidos (até 2 letras de diferença) e instituições com nomes parecidos entram na fila. "Unir" mantém o primeiro registro e move relacionamentos e interações do segundo.
47. **E-mail existente no "Novo contato".** Preenche contato e instituição com os dados-base (nome, país, cidade, cargo, LinkedIn, dados da instituição), como pede a spec. Isso revela que a pessoa já está na base, mas nunca mostra relacionamentos, interações ou empresas.
48. **Dados de instituição compartilhados.** A empresa pode editar os dados da instituição na ficha, e eles valem para todas as empresas (spec 2, 5.6). Ao criar contato com e-mail ou instituição existente, o sistema só preenche campos vazios e nunca sobrescreve.
49. **Tíquete estimado.** Em USD milhões, aceitando decimais (ex.: 0,5), como diz a spec ("USD milhões"). É o único campo de valor que aceita decimal.
50. **Lista de categorias estratégicas Apex.** Só o valor padrão foi informado ("Indústria da saúde (CNDI Missão 2)"). A lista fica em `settings.apex_strategic_categories` para a equipe completar.
51. **Exportação.** O botão "Exportar para ApexBrasil" mostra os filtros e a mensagem "disponível na versão com banco de dados". O mapeamento de colunas está em HANDOFF_CODEX.md.


## Outros

52. **Fotos de exemplo.** As capas das organizações sem imagem própria usam fotos aleatórias (picsum.photos), como o protótipo fazia. A capa é opcional na spec (5.5); na plataforma real, sem capa, o cabeçalho fica no fundo navy.
53. **Pasta `prototype-v1/`.** Guarda o protótipo original desempacotado só como referência visual; não faz parte do app novo e pode ser removida na publicação.
