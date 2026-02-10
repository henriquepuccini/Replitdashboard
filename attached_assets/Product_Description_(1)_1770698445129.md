# **Product Description**

Dashboard de Performance Comercial multi-nível para uma rede de seis escolas. Consolida dados de CRM, financeiro e acadêmico para apresentar KPIs comerciais e financeiros segmentados por vendedor, escola e rede, com controle de acesso por função. Fornece visões operacionais, administrativas e executivas, filtros, drilldowns e exportação de relatórios para apoiar decisões táticas e estratégicas em tempo quase real.

**DESIGN**

\*\*Design Movement\*\*: Corporativo Moderno \+ Data Visualization

\- Inspiração em dashboards de empresas educacionais de alto padrão

\- Foco em clareza, hierarquia visual e apresentação de dados

\*\*Core Principles\*\*:

1\. Hierarquia clara através de tipografia e espaçamento

2\. Dados como protagonista \- gráficos interativos em posição de destaque

3\. Navegação intuitiva com sidebar persistente

4\. Ênfase em legibilidade e acessibilidade

\*\*Color Philosophy\*\*:

\- Paleta: Azul profundo (\#1e40af), branco, cinza neutro (\#6b7280)

\- Azul transmite confiança e profissionalismo (ideal para educação)

\- Acentos em verde suave (\#10b981) para ações positivas

\- Fundo branco com cards em cinza muito claro para contraste suave

\*\*Layout Paradigm\*\*:

\- Sidebar esquerda fixa com navegação

\- Conteúdo principal em grid responsivo

\- Cards com sombras suaves para profundidade

\- Seções bem definidas: Overview, Processo de Vendas, KPIs, Fluxos

\*\*Signature Elements\*\*:

1\. Cards com borda superior colorida (azul/verde)

2\. Gráficos com gradientes suaves

3\. Ícones minimalistas em cada seção

4\. Badges de status (ativo, concluído, em progresso)

\*\*Interaction Philosophy\*\*:

\- Hover effects sutis em cards (elevação leve)

\- Cliques expandem detalhes em modais

\- Transições suaves entre seções

\- Tooltips informativos

\*\*Animation\*\*:

\- Fade-in ao carregar seções

\- Slide-in para cards

\- Animações de contagem para números (0 → valor final)

\- Transições de 300ms para mudanças de estado

\*\*Typography System\*\*:

\- Display: Poppins Bold (títulos principais)

\- Heading: Poppins SemiBold (subtítulos)

\- Body: Inter Regular (conteúdo)

\- Mono: Courier (dados/código)

\- Hierarquia: 32px → 24px → 18px → 16px → 14px

# **Key features**

1. Usuários podem autenticar-se e ter controle de acesso por papel  
2. Sistema conecta e sincroniza dados de fontes externas (CRM/Financeiro/Acadêmico)  
3. Plataforma calcula e fornece KPIs padronizados e metas  
4. Usuários acessam Dashboard Operacional por vendedor/escola  
5. Usuários acessam Dashboard Administrativo por escola  
6. Usuários acessam Dashboard Executivo consolidado da rede  
7. Usuários aplicam filtros, drilldowns e navegação entre níveis  
8. Usuários exportam e agendam relatórios (PDF/CSV)

REGRAS DE NEGÓCIOS

1. Regras de Negócio — Churn  
* Definições (parametrizáveis por escola):  
  * lead\_conversion\_window\_days (padrão sugerido: 90 dias)  
  * rematricula\_grace\_period\_days (padrão sugerido: 30 dias)  
* Churn Comercial:  
  * Perda de Lead: lead cadastrado no CRM/Sheets que não se converte em matrícula dentro de lead\_conversion\_window\_days a partir do primeiro contato OU marcado explicitamente como lost/no\_interest.  
  * Não Rematrícula: aluno matriculado no ciclo anterior que não tiver registro de rematrícula ativa até rematricula\_grace\_period\_days após o fim do período oficial de rematrícula.  
* Churn Acadêmico:  
  * Abandono Escolar: aluno com matrícula confirmada que registra desligamento/baixa durante o ano letivo.  
  * Transferência: mudança para outra unidade ou escola externa é registrada como churn para a unidade de origem, com motivo \= “transferência”.  
* Requisitos operacionais:  
  * Eventos de churn devem registrar: timestamp, origem do registro (CRM / sistema acadêmico / google\_sheets), user/responsável, motivo (categoria padronizada).  
  * Campos obrigatórios para contabilização: student\_id OR record\_id, school\_id, date\_event, churn\_flag, churn\_reason (opcional).  
  * Regras são configuráveis por unidade (overrides possíveis).  
2. Frequência de Atualização (Latência) e SLAs  
* Tipos de dados e latência recomendada:  
  * CRM / Operacional (leads, atividades): sincronização near-real-time; janela configurável 15–30 minutos (recomendado 15 min).  
  * Financeiro (faturamento, pagamentos, inadimplência): atualização diária via ETL noturno (ex.: 02:00 AM).  
  * Acadêmico (matrículas, rematrículas, baixa): atualização diária; eventos críticos (rematrícula, baixa) suportam push near-real-time quando a origem permitir.  
* Metadados:  
  * Cada KPI/visualização deve armazenar last\_synced\_timestamp e origem (system, sheet\_id, api\_endpoint).  
* SLA/Performance:  
  * 95% das visualizações devem responder em \< 3s com cache válido.  
  * Taxa de sucesso da ingestão diária \>= 99% (com alertas em caso de falhas persistentes).  
3. Visualização de Metas  
* Funcionalidade:  
  * Inserção/edição de metas via UI e importação via CSV (template abaixo).  
  * Metas por período (mensal/trimestral/anual), por escola e por vendedor.  
  * Histórico de metas mantido (audit trail).  
* Template CSV de metas (cabeçalho):  
  * period,start\_date,end\_date,school\_id,vendedor\_id,meta\_matriculas,meta\_faturamento  
* Regras:  
  * Importação valida e aplica versão da meta para o período correspondente; conflitos geram versão nova com autor e timestamp.  
4. Alertas Proativos  
* Requisitos:  
  * Regras configuráveis por KPI: tipo de condição (absolute threshold, percent-from-target, rate-of-change), janela de avaliação (diária, 7D, 30D).  
  * Destinatários configuráveis por papel/escopo (vendedor, gerente, diretoria).  
  * Canais: email, push web, webhook (ex.: Slack).  
  * Cooldown: configurar para evitar spam (ex.: 24h para o mesmo alerta).  
  * Ações recomendadas no corpo do alerta (ex.: verificar lista de inadimplentes; acionar plano de recuperação).  
* Exemplos de regras:  
  * “Enviar alerta se inadimplência\_escola \> X% nos últimos 30 dias.”  
  * “Enviar alerta se faturamento\_acumulado\_mes \< Y% da meta no dia 15 do mês.”  
  * “Enviar alerta se taxa\_de\_churn\_academico \> Z% em 30 dias.”  
5. Integração — Fonte: Google Sheets (Google Drive)  
* Escopo:  
  * Google Sheets suportado para metas, cargas manuais de leads, correções e relatórios financeiros/ acadêmicos ad-hoc.  
  * Não recomendado como fonte primária para eventos CRM de alto volume (usar API direta quando houver).  
* Métodos de integração:  
  * Leitura via Google Sheets API v4 (pull) — preferencial para sincronizações periódicas.  
  * Push via Google Apps Script → POST para endpoint de ingestão (near-real-time).  
  * Importação manual via upload/drag\&drop de CSV (fallback).  
* Autenticação e permissões:  
  * Conta de serviço com a(s) planilha(s) compartilhada(s) (recomendado) ou OAuth2 quando necessário.  
  * Armazenar credenciais em Secrets Manager/KeyVault; rotacionar chaves periodicamente.  
  * Scopes mínimos: [https://www.googleapis.com/auth/spreadsheets.readonly](https://www.googleapis.com/auth/spreadsheets.readonly) (e drive.readonly se necessário).  
  * Registrar quem vinculou a planilha, timestamp e permissões.  
* Frequência / Latência:  
  * Configurável por planilha; recomendações: CRM via Sheets: 15–30 min; financeiro/acadêmico: diário (ETL noturno).  
  * Cada ingestão grava last\_synced\_timestamp e sheet\_id.  
* Validação e transformação (ETL):  
  * Validação de esquema/tipos antes da ingestão; linhas inválidas são rejeitadas e logadas.  
  * Campos obrigatórios: record\_id, school\_id, date (ISO 8601), status, amount (quando aplicável).  
  * Mapeamento de colunas da sheet para modelo canônico (UI para salvar mapeamentos reutilizáveis).  
  * Tags de origem: user\_uploaded / sheets\_api / apps\_script.  
* Schema / Template recomendado (exemplo de cabeçalho para feeds de leads/records):  
  * record\_id,timestamp,school\_id,vendedor\_id,lead\_status,student\_id,enrollment\_status,amount,churn\_flag,churn\_reason,source\_system  
  * Exemplos de valores:  
    * lead\_status: novo, contato, visita, proposta, matricula, lost  
    * enrollment\_status: matriculado, rematricula\_ok, rematricula\_nao  
    * churn\_flag: none, churn\_comercial, churn\_academico  
* Regras específicas para churn via Sheets:  
  * Coluna churn\_flag obrigatória quando aplicável; valores padronizados.  
  * Planilha de rematrículas pode marcar enrollment\_status=rematricula\_nao e rematricula\_checked\_date para disparar regra de não rematrícula.  
* Erros, logging e alertas:  
  * Logs de ingestão: linhas importadas, linhas rejeitadas (com razão), duração do job.  
  * Alertas automáticos para falhas persistentes (ex.: 3 falhas consecutivas).  
  * Interface administrativa para reprocessar cargas, visualizar erros e forçar reimports.  
* Performance, caching e quotas:  
  * Cache de agregados configurável para reduzir leituras e quotas da API.  
  * Invalidation de cache quando push via Apps Script notifica ingestão.  
  * Implementar rate limiting e batch reads conforme quotas do Google Sheets API; recomendar splitting de grandes sheets.  
* Segurança / LGPD:  
  * Minimizar PII em sheets; usar IDs ou hashes quando possível.  
  * Criptografia em trânsito (HTTPS) e em repouso.  
  * Controle de acesso por role/escopo (cada gestor só vê dados da(s) sua(s) escola(s)).  
  * Logs de acesso e consentimento / documentação da origem dos dados.\_  
6. Requisitos Não-Funcionais (pequenas atualizações)  
* RNF-1 (Segurança e Acesso): controle por role \+ escopo por school\_id; logging de acesso/alteração para auditoria LGPD.  
* RNF-2 (Desempenho): latências por tipo de dado (CRM 15–30 min; financeiro/acadêmico diário); SLA: 95% das visualizações \< 3s.  
* RNF-4 (Integração): requisitos mínimos das APIs de origem: endpoint para listagem de registros, endpoint para delta since=timestamp, autenticação (OAuth2 / API key), campos obrigatórios (id, school\_id, date, status), webhooks para eventos críticos.  
* RNF-5 (Escalabilidade): arquitetura de ingestão com filas (pub/sub), processamento ETL em lote e streaming para eventos críticos.  
* RNF-6 (Conformidade): conformidade LGPD e retenção mínima/ máxima por tipo de dado.  
7. Exemplos de CSV / Template para copiar  
* Template metas (header e exemplo):  
  * Cabeçalho: period,start\_date,end\_date,school\_id,vendedor\_id,meta\_matriculas,meta\_faturamento  
  * Linha exemplo: 2026-03,2026-03-01,2026-03-31,ESC001,VND045,50,125000.00  
* Template records/leads (header):  
  * record\_id,timestamp,school\_id,vendedor\_id,lead\_status,student\_id,enrollment\_status,amount,churn\_flag,churn\_reason,source\_system  
  * Linha exemplo: R-000123,2026-02-10T08:30:00Z,ESC001,VND045,visita,, , ,none,,google\_sheets  
  *   
8. Checklist de aceitação para integração via Sheets  
* Planilha compartilhada com conta de serviço e permissão correta.  
* Mapeamento de colunas salvo e testado com carga de amostra.  
* Validações (tipos, date format ISO, campos obrigatórios) passadas.  
* last\_synced\_timestamp aparece no dashboard e corresponde ao horário da última ingestão.  
* Alertas configurados para falhas de ingestão (\>=3 falhas).  
* Teste de fluxo push (Apps Script) opcional: ao postar uma linha, o KPI ligado é invalidado/atualizado.  
9. Observações operacionais e recomendações  
* Preferir integração API direta para CRM de alto volume; Google Sheets para casos de baixa frequência, correções manuais e metas.  
* Tornar parâmetros chave (lead\_conversion\_window\_days, rematricula\_grace\_period\_days, thresholds de alerta) configuráveis via UI para gestores.  
* Documentar quotas e instruir usuários sobre como estruturar sheets grandes (split by range / use CSV export).

User Stories

## **1\. Usuários podem autenticar-se e ter controle de acesso por papel**

* Como visitante, quero criar conta para acessar o dashboard.  
* Como usuário, quero autenticar-me para acessar minha vista autorizada.  
* Como administrador, quero gerir papéis e permissões para controlar acesso.  
* Como usuário, quero recuperar senha para retomar acesso.

## **2\. Sistema conecta e sincroniza dados de fontes externas (CRM/Financeiro/Acadêmico)**

* Como integrador, quero conectar uma API externa para trazer dados.  
* Como integrador, quero mapear campos para alinhar fontes ao modelo.  
* Como integrador, quero agendar sincronizações para atualizações regulares.  
* Como analista, quero ver histórico de ingestão para auditoria.

## **3\. Plataforma calcula e fornece KPIs padronizados e metas**

* Como gerente, quero ver faturamento vs meta calculado automaticamente.  
* Como gerente, quero ver taxa de inadimplência por período.  
* Como executivo, quero ver CAC, LTV e relação LTV/CAC.  
* Como analista, quero rastrear origem dos dados para cada KPI.

## **4\. Usuários acessam Dashboard Operacional por vendedor/escola**

* Como vendedor, quero ver meu progresso de meta diário.  
* Como vendedor, quero ver meu pipeline de leads por estágio.  
* Como vendedor, quero acessar detalhes e histórico de um lead.  
* Como vendedor, quero ver minhas atividades recentes e próximas ações.

## **5\. Usuários acessam Dashboard Administrativo por escola**

* Como gerente, quero ver faturamento e ocupação da escola.  
* Como gerente, quero ranking da equipe por matrículas e conversão.  
* Como gerente, quero ver NPS e desempenho acadêmico consolidado.  
* Como gerente, quero filtrar por série/turma e período.

## **6\. Usuários acessam Dashboard Executivo consolidado da rede**

* Como diretor, quero visão consolidada de faturamento vs meta da rede.  
* Como diretor, quero comparar KPIs entre as seis escolas.  
* Como diretor, quero ver tendência histórica de churn e evasão.  
* Como diretor, quero métricas de rentabilidade (EBITDA/margem).

## **7\. Usuários aplicam filtros, drilldowns e navegação entre níveis**

* Como usuário, quero filtrar por período para ajustar a janela analítica.  
* Como gerente, quero filtrar por vendedor/ turma/ série para investigar causas.  
* Como executivo, quero clicar em uma escola para abrir dashboard da escola.

## **8\. Usuários exportam e agendam relatórios (PDF/CSV)**

* Como gerente, quero exportar visão atual em CSV para análise offline.  
* Como diretor, quero agendar envio semanal de relatório consolidado por email.

# **User Journeys**

\[cenários de happy path para cada user story\]

## **Feature 1 — Autenticação e Controle de Acesso**

### **Como visitante, quero criar conta para acessar o dashboard.**

GIVEN um visitante na página de cadastro WHEN ele preenche nome, email, senha e envia o formulário THEN a conta é criada AND ele recebe email de confirmação

### **Como usuário, quero autenticar-me para acessar minha vista autorizada.**

GIVEN um usuário registrado na página de login WHEN ele insere credenciais válidas e submete THEN ele é autenticado AND é redirecionado para seu dashboard com vistas apropriadas ao papel

### **Como administrador, quero gerir papéis e permissões para controlar acesso.**

GIVEN um administrador autenticado na área de gestão WHEN ele edita o papel de um usuário e salva THEN as permissões do usuário são atualizadas imediatamente

### **Como usuário, quero recuperar senha para retomar acesso.**

GIVEN um usuário na tela de login que clicou em "Esqueci senha" WHEN ele solicita recuperação e segue o link enviado por email para definir nova senha THEN ele consegue acessar com a nova senha

## **Feature 2 — Integração de Dados**

### **Como integrador, quero conectar uma API externa para trazer dados.**

GIVEN um integrador autenticado na seção de integrações WHEN ele fornece endpoint, credenciais e testa conexão com sucesso THEN a fonte aparece como conectada e pronta para mapeamento

### **Como integrador, quero mapear campos para alinhar fontes ao modelo.**

GIVEN uma fonte conectada com dados brutos WHEN o integrador mapeia campos obrigatórios para o modelo de dados e salva o mapeamento THEN os dados serão transformados conforme o mapeamento em próximas sincronizações

### **Como integrador, quero agendar sincronizações para atualizações regulares.**

GIVEN uma integração com mapeamento salvo WHEN o integrador configura agendamento (ex.: a cada 15 minutos) e salva THEN o sistema executa sincronizações conforme cronograma e atualiza dados

### **Como analista, quero ver histórico de ingestão para auditoria.**

GIVEN um analista na página de logs de ingestão WHEN ele seleciona um período e visualiza entradas THEN ele vê registros de execuções, status e possíveis erros.

Integração — Fonte: Google Sheets (Google Drive)

Escopo de uso

Google Sheets será suportado como uma fonte de dados para: metas importadas, planilhas de leads/manuais, relatórios financeiros / consolidações manuais e cargas ad-hoc (ex.: planilha de correções).

Não recomendado como fonte primária para eventos em tempo real de CRM de alto volume; para isso preferir integração direta via API do CRM quando disponível.

Métodos de integração:

Leitura via Google Sheets API v4:

Método preferencial para sincronizações periódicas (pull).

Autenticação: conta de serviço com a(s) planilha(s) compartilhada(s) ou OAuth2 (quando necessário acesso em nome de usuário).

Push via Apps Script / Webhook:

Para casos que exigem near-real-time a partir de uma planilha controlada, adicionar um trigger do Google Apps Script que POSTe alterações para um endpoint de ingestão.

Importação manual:

Upload/drag\&drop de CSV exportado do Google Sheets via interface do dashboard (fallback).

Autenticação e permissões

Usar conta de serviço (recomendado) e compartilhar planilha com o e-mail da conta de serviço.

Armazenar credenciais em Secrets Manager/KeyVault; rotacionar chaves periodicamente.

Escopos mínimos: https://www.googleapis.com/auth/spreadsheets.readonly (ou readonly \+ drive.readonly se necessário).

Registro de auditoria: quem vinculou a planilha, timestamp e permissões concedidas.

Frequência / Latência e SLA

Configurável por fonte/planilha:

CRM-operacional (se alimentado por Sheets): recomendação técnica — não menor que 15 minutos; ideal 15–30 min se usar Apps Script push/cron.

Financeiro / Acadêmico (feeds manuais): atualização diária (ETL noturno).

Cada ingestão deve salvar last\_synced\_timestamp e origem (sheet id, range).

SLA: 95% das consultas derivadas dessas fontes devem responder em \<3s assumindo cache válido.

Validação e Transformação (ETL)

Validar esquema e tipos antes de ingestão; rejeitar/alertar em linhas com dados inválidos.

Regras comuns: campos obrigatórios (id, school\_id, date, status), formatos de data (ISO), campos numéricos sem separadores locais.

Mapear colunas da planilha para o modelo canônico do dashboard (configuração de mapeamento reutilizável).

Marcar origem da linha (user\_uploaded, sheets\_api, apps\_script) e manter histórico/versão da carga.

Schema/Template recomendado (exemplo de cabeçalho de sheet)

sheet\_meta: sheet\_id, sheet\_name, owner\_email

records (colunas):

record\_id (string) — identificador único

timestamp (ISO 8601\) — última atualização da linha

school\_id (string)

vendedor\_id (string | opcional)

lead\_status (enum: novo, contato, visita, proposta, matricula, lost)

student\_id (string | opcional)

enrollment\_status (enum: matriculado, rematricula\_ok, rematricula\_nao)

amount (decimal | opcional) — valores financeiros

churn\_flag (enum: none, churn\_comercial, churn\_academico) — para contabilizar churn

churn\_reason (string | opcional)

source\_system (string) — ex: google\_sheets

Template CSV de metas: period,start\_date,end\_date,school\_id,vendedor\_id,meta\_matriculas,meta\_faturamento

Regras específicas para Churn via Sheets

Coluna churn\_flag obrigatória quando aplicável; valores padronizados (churn\_comercial, churn\_academico).

Para não rematrícula: planilha de rematrículas pode marcar enrollment\_status=rematricula\_nao e preencher rematricula\_checked\_date.

Ingestão deve aplicar as mesmas janelas/configurações paramétricas do PRD (ex.: rematricula\_grace\_period\_days) para uniformidade.

Erros, logging e alertas

Logs de ingestão com número de linhas importadas, linhas rejeitadas (com motivos), e duração.

Alertas automáticos para falhas persistentes (ex.: 3 falhas consecutivas) via email/webhook.

Interface administrativa para reprocessar cargas ou forçar reimportação.

Performance e caching

Cache de resultados agregados por X minutos (configurável) para evitar leituras repetidas e reduzir quotas da API.

Estratégia de invalidation quando existe push via Apps Script (invalida cache relevante).

Limites e quotas

Documentar quotas do Google Sheets API (reads/sec e requests/day) e projetar batches/rate limiting.

Recomendar dividir grandes planilhas em ranges ou usar export CSV para cargas grandes.

Segurança e LGPD

Minimizar PII: somente colunas estritamente necessárias (usar hashes ou IDs quando possível).

Criptografia em trânsito (HTTPS) e em repouso para dados sensíveis.

Controle de acesso por role/escopo (cada gestor só vê dados da(s) sua(s) escola(s)).

Logs de acesso e consentimento/documentação de origem dos dados.

## **Feature 3 — Cálculo de KPIs e Metas**

### **Como gerente, quero ver faturamento vs meta calculado automaticamente.**

GIVEN dados financeiros sincronizados e metas definidas WHEN o gerente abre o dashboard relevante THEN o cartão "Faturamento vs Meta" exibe valor realizado, meta e variação percentual

### **Como gerente, quero ver taxa de inadimplência por período.**

GIVEN dados de cobrança sincronizados WHEN o gerente seleciona período de 6 meses THEN o gráfico de inadimplência mostra evolução mensal com valores percentuais

### **Como executivo, quero ver CAC, LTV e relação LTV/CAC.**

GIVEN dados de marketing, vendas e receita disponíveis WHEN o diretor abre a visão executiva THEN CAC, LTV e LTV/CAC são calculados e exibidos com datas e metodologia visível

### **Como analista, quero rastrear origem dos dados para cada KPI.**

GIVEN um KPI exibido no dashboard WHEN o usuário clica em "Ver origem" no cartão do KPI THEN aparece uma janela com fontes, transformações e última atualização

## **Feature 4 — Dashboard Operacional (Vendedor)**

### **Como vendedor, quero ver meu progresso de meta diário.**

GIVEN um vendedor autenticado com alvo definido WHEN ele abre sua vista operacional THEN o gráfico de progresso mostra realizado vs meta atualizados

### **Como vendedor, quero ver meu pipeline de leads por estágio.**

GIVEN leads atribuídos ao vendedor WHEN ele acessa o painel de pipeline THEN vê os leads agrupados por estágio com contagens e valores previstos

### **Como vendedor, quero acessar detalhes e histórico de um lead.**

GIVEN o vendedor vê um lead na lista de pipeline WHEN ele clica no lead THEN abre modal com contato, histórico de interações e status

### **Como vendedor, quero ver minhas atividades recentes e próximas ações.**

GIVEN atividades sincronizadas do CRM WHEN o vendedor abre "Atividades recentes" THEN aparece lista cronológica de contatos, visitas e tarefas futuras

## **Feature 5 — Dashboard Administrativo (Gerente de Escola)**

### **Como gerente, quero ver faturamento e ocupação da escola.**

GIVEN dados da escola sincronizados WHEN o gerente abre o dashboard da escola THEN vê cartões de faturamento vs meta e ocupação por série com percentuais

### **Como gerente, quero ranking da equipe por matrículas e conversão.**

GIVEN dados de desempenho da equipe disponíveis WHEN o gerente abre a seção de performance da equipe THEN é exibido ranking ordenado por matrículas e taxa de conversão

### **Como gerente, quero ver NPS e desempenho acadêmico consolidado.**

GIVEN resultados de NPS e médias acadêmicas importados WHEN o gerente abre aba "Qualidade" THEN NPS e médias por série são mostradas com comparativo histórico

### **Como gerente, quero filtrar por série/turma e período.**

GIVEN o gerente na vista da escola WHEN ele aplica filtros de série e mês e confirma THEN todas as visualizações são atualizadas conforme filtros selecionados

## **Feature 6 — Dashboard Executivo (Diretoria da Rede)**

### **Como diretor, quero visão consolidada de faturamento vs meta da rede.**

GIVEN dados consolidados das seis escolas WHEN o diretor abre a visão executiva THEN o painel mostra faturamento agregado, meta total e variação

### **Como diretor, quero comparar KPIs entre as seis escolas.**

GIVEN métricas por escola calculadas WHEN o diretor seleciona "Comparar Escolas" THEN surge tabela/gráfico comparativo com indicadores selecionados por escola

### **Como diretor, quero ver tendência histórica de churn e evasão.**

GIVEN dados de matrículas e cancelamentos WHEN o diretor consulta o relatório de churn THEN gráficos mostram evolução temporal e taxa de evasão por período

### **Como diretor, quero métricas de rentabilidade (EBITDA/margem).**

GIVEN dados de receita e despesas consolidados WHEN o diretor abre "Rentabilidade" THEN EBITDA e margem são calculados e exibidos com detalhe de componentes

## **Feature 7 — Filtros, Drilldowns e Navegação**

### **Como usuário, quero filtrar por período para ajustar a janela analítica.**

GIVEN o usuário em qualquer dashboard WHEN ele seleciona intervalo (dia/semana/mês/ano) e aplica THEN todas visualizações respeitam o período escolhido

### **Como gerente, quero filtrar por vendedor/ turma/ série para investigar causas.**

GIVEN o gerente no dashboard da escola WHEN ele seleciona um vendedor e uma turma e aplica filtros THEN gráficos e tabelas exibem dados apenas do contexto filtrado

### **Como executivo, quero clicar em uma escola para abrir dashboard da escola.**

GIVEN o diretor visualizando painel consolidado WHEN ele clica no cartão de uma escola THEN é aberto o dashboard daquela escola no nível administrativo

## **Feature 8 — Exportação e Agendamento de Relatórios**

### **Como gerente, quero exportar visão atual em CSV para análise offline.**

GIVEN o gerente visualizando uma tabela ou visão filtrada WHEN ele clica "Exportar CSV" e confirma THEN um arquivo CSV com dados visíveis é gerado para download

### **Como diretor, quero agendar envio semanal de relatório consolidado por email.**

GIVEN o diretor na área de relatórios agendados WHEN ele cria agendamento semanal com lista de destinatários e salva THEN o sistema envia o PDF/CSV consolidado por email conforme cronograma

