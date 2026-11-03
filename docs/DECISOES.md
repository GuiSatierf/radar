# Decisões

Uma linha por decisão: data, o que foi decidido, por quê, o que foi descartado. Postmortems curtos no fim, quando houver.

## Produto e dados

- **20/10/2026 · Fontes de dados:** toda fonte externa (Shopee, anúncios, Instagram, vídeo) fica atrás de uma interface própria, com implementação falsa para desenvolvimento e testes. Nenhum teste chama serviço real. O que usar de verdade (API oficial ou fornecedor pago) é decisão do cliente, e a troca não mexe nas telas.
- **20/10/2026 · As telas leem só o nosso banco:** uma coleta agendada busca as fontes e grava no Postgres, e a tela nunca consulta a Shopee na hora do clique. Por quê: é rápido, não estoura o limite das APIs e mostra a data da última atualização. Descartado: consulta ao vivo.
- **20/10/2026 · Código da API de afiliados Shopee pronto antes da chave:** o cliente ainda não tem acesso. O cliente da API é escrito e testado contra respostas falsas; o formato da assinatura vem de fontes de terceiros e será conferido quando a chave chegar.
- **20/10/2026 · Vídeo só por API oficial e paga, com créditos por plano:** nada de intermediário não oficial nem de "ilimitado". Por quê: custo e estabilidade.

## Radar (Etapa 2)

- **21/10/2026 · Nota de oportunidade (0 a 100):** 50% concorrência + 30% ganho por venda + 20% vendas do mês.
  - **Concorrência:** `1 − log(afiliados+1)/log(1001)`. Mil afiliados ou mais vale 0.
  - **Ganho:** ganho por venda no perfil de 3%, dividido por R$ 15. A partir de R$ 15 vale o máximo.
  - **Vendas:** `log(vendas+1)/log(5001)`.
  - Código e testes em `src/features/radar/domain/opportunity-score.ts`.
  - **Descartados:** usar só a concorrência invertida e pesos iguais (dariam peso demais às vendas, que já indicam muita concorrência).
  - **Limite conhecido:** produto sem venda chega a 80. Por isso a frase da nota não promete que ele vende.
- **21/10/2026 · "10+ afiliados" (contagem mínima da Shopee) conta como concorrência incerta:**
  - a tela mostra "10+ afiliados · pode ter mais", sem cor de nível;
  - esses produtos ficam fora dos filtros "baixa" e "média";
  - na nota, a parte da concorrência vale a metade (0,5).
  - Por quê: o número real pode ser centenas. Achado na revisão do PR da Etapa 2.
  - Descartado: tratar como exatamente 10, o que punha produtos lotados no topo.
- **21/10/2026 · A coleta não apaga produtos quando a fonte traz menos da metade do catálogo atual:** uma resposta parcial (por exemplo, uma página que falhou) nunca esvazia o Radar. Os produtos que vieram são atualizados e um aviso vai para o log. A gravação é em lote, de 500 em 500.
- **21/10/2026 · Cliente da API de afiliados Shopee pronto, ainda sem ligar na coleta (Etapa 2b):**
  - Código em `src/sources/products/shopee-affiliate/`: assinatura SHA256, consulta `productOfferV2` paginada (50 por página), validação com Zod e valores convertidos por texto (sem passar por float).
  - Retentativa com espera crescente (1 s, 2 s) só para rede, tempo esgotado, limite (10030) e erros 429/5xx. Erro de assinatura ou de dado nunca se repete.
  - Ainda não está na coleta porque a API não traz número de afiliados nem vídeos, e o Radar precisa dos dois; como juntar isso é decisão do cliente (fornecedor ou curadoria).
  - O formato da assinatura e os campos vêm de fontes de terceiros; conferir com a documentação oficial quando a chave chegar.
  - Descartado: biblioteca de GraphQL (é só um POST com JSON).
- **22/10/2026 · Produtos reais da Shopee no Radar antes da contagem de afiliados:**
  - Com a chave de afiliado no ambiente, a coleta usa a API (`selectProductSource`); sem a chave, segue o catálogo fictício. Meia chave dá erro.
  - Busca os 100 mais vendidos de cada uma das 28 categorias principais (2 páginas de 50): cerca de 2.800 produtos em menos de 1 minuto. Uma categoria que falha derruba a coleta inteira, para não apagar as outras do Radar.
  - A API não traz número de afiliados, quantidade de avaliações, estoque, amostra grátis nem vídeos. Esses campos ficam vazios, nunca inventados. O número de afiliados passou a aceitar vazio (migração 0005).
  - Sem contagem, a tela mostra "Ainda não contamos", os filtros de concorrência somem, o produto vai para o fim da ordem "Menos concorrência", a parte da concorrência na nota vale a metade (como o "10+") e a frase da nota não fala de concorrência.
  - A API não tem lista de categorias. Os nomes foram tirados dos produtos de cada código em 22/10/2026 (`categories.ts`); o código 100642 ficou de fora (só tem anúncios de frete e garantia).
  - O link guardado é o da página do produto, nunca o link de afiliado da API, que paga quem tem a chave e não a assinante.
  - A assinatura e os campos que tinham vindo de fontes de terceiros foram confirmados com a chave real.
  - A confirmar: se `sales` é venda do último mês (fontes de terceiros dizem que sim; a tela mostra "vendas/mês").
  - Descartado: esperar a contagem de afiliados, o que deixaria o Radar com produtos fictícios.
- **21/10/2026 · Níveis de concorrência:** baixa até 50 afiliados, média de 51 a 300, alta acima de 300. São valores iniciais; o cliente pode ajustar.
- **21/10/2026 · A nota é calculada na coleta e guardada no banco, com o perfil padrão de 3%:** todo mundo vê a mesma ordem, e a lista ordena no SQL sem refazer contas. O ganho em R$ de cada pessoa é calculado na hora, com o perfil dela. Descartado: calcular a nota por pessoa, que exigiria fórmulas logarítmicas no SQL.
- **21/10/2026 · Perfil de comissão (3%, 4% ou 8%) uma vez só, nas Configurações, salvo no usuário:** menos coisa na tela para quem está começando. Descartado: seletor em toda tela.
- **21/10/2026 · Filtros na URL lidos com Zod no servidor e alterados com `router.push`:** cobre tudo de que o Radar precisa. Descartado: nuqs, a dependência que estava prevista; entra se aparecer filtro com estado mais complexo.
- **21/10/2026 · Coleta pela interface `ProductSource`:**
  - A fonte devolve dados como `unknown`, e a coleta valida cada produto com Zod. Um item inválido é pulado, e uma fonte vazia não apaga nada.
  - Hoje só existe a fonte falsa, com 40 produtos fictícios e determinísticos. A API de afiliados da Shopee entra na Etapa 2b, sem mexer nas telas.
  - A coleta roda por `npm run collect` (local e seed) e por `POST /api/cron/collect-products` com `CRON_SECRET`, chamado pela tarefa agendada do Coolify. Sem `CRON_SECRET`, a rota não existe.

## Pagamento pela Hotmart

- **23/10/2026 · Plano liberado pelo webhook da Hotmart (versão 2.0.0), sem acesso à conta da Hotmart:** quem cuida da Hotmart cola a URL do app e passa o hottok e o mapa de planos (desde 26/10/2026, pela aba Admin → Hotmart); o guia é `docs/HOTMART.md`.
  - **Pelo e-mail da compra, não pela conta:** a compra fica em `hotmart_access` (migração 0007), por e-mail e produto. Quem compra antes de se cadastrar ganha o plano quando confirma o e-mail (desde 01/11/2026, ver abaixo).
  - **Eventos:** compra aprovada ou completa e troca de plano liberam. Reembolso, chargeback, compra cancelada ou expirada tiram na hora. Cancelamento de assinatura mantém até `date_next_charge`, o fim do período pago, como a documentação da Hotmart recomenda, e uma tarefa diária (`/api/cron/expire-access`) tira depois. Boleto gerado, atraso e pedido de reembolso não mudam nada: o evento final vem depois.
  - **Segurança e repetição:** o cabeçalho `X-HOTMART-HOTTOK` é comparado em tempo constante. Sem o hottok configurado, a rota não existe. Cada evento é aplicado uma vez só (`hotmart_event`), e um evento mais antigo que o último aplicado àquela compra é descartado, porque a Hotmart pode entregar fora de ordem. Um reembolso que chega antes da aprovação vence quando a aprovação chegar.
  - **Plano manual do admin:** o próximo evento da Hotmart daquela pessoa passa por cima. A tarefa diária só aplica cada fim de acesso uma vez, para não desfazer todo dia um plano dado à mão depois.
  - **Descartados:** pedir acesso à conta da Hotmart (não é a Prisciane que cuida dela) e consultar a API de vendas da Hotmart em vez do webhook (exige credenciais da conta e não avisa na hora).
- **26/10/2026 · Hotmart configurada pelo Admin, não pelo Coolify:** porque a configuração esperava o cliente mandar os dados. A aba **Admin → Hotmart** mostra o endereço para copiar, recebe o hottok e a tabela produto ou assinatura → plano (migração 0008). `HOTMART_HOTTOK` e `HOTMART_PLANS` saíram do código.
- **01/11/2026 · Plano da Hotmart ou liberado pelo admin só depois de confirmar o e-mail:** qualquer um podia se cadastrar com o e-mail de uma compradora e levar o plano dela.
  - O cadastro manda um link de confirmação (`emailVerification` do Better Auth, vale 24 horas). `syncAccountPlan` só sobe o plano de conta com e-mail confirmado (baixar vale para todas, para tirar o plano de contas de antes da confirmação), e a confirmação aplica o plano que estava esperando (`applyWaitingPlan`), só para subir: um plano que o admin deu à mão antes da confirmação não é apagado.
  - Entrar no app não exige confirmação: quem não confirmou entra, vê um aviso com "Reenviar e-mail" (no máximo 3 por minuto) e fica sem o plano até confirmar. O aviso aparece para todo mundo que não confirmou, não só para quem tem plano esperando, para não revelar que aquele e-mail tem uma compra.
  - O plano que o admin escolhe direto na conta continua valendo na hora. A conta de demonstração nasce confirmada, porque o e-mail dela não recebe nada.
- **02/11/2026 · O link de confirmação só confirma dentro da conta:** quem se cadastra primeiro com o e-mail de outra pessoa sabe a senha. Se a dona do e-mail abrisse o link em qualquer lugar, a conta ganhava o plano e continuava nas mãos de quem a criou.
  - O link só confirma num navegador que já está na conta daquele e-mail (`beforeEmailVerification`). Aberto em outro lugar ou dentro de outra conta, ele leva para `/entrar?email=confirmar`, que pede para entrar e abrir o link de novo. Sem conta aberta, o link não entra mais na conta sozinho (`autoSignInAfterVerification` saiu).
  - Criar uma senha nova pelo link do e-mail também confirma o e-mail e aplica o plano que estava esperando (`onPasswordReset`): o link prova o e-mail, a senha nova é de quem o abriu, e todos os outros aparelhos saem da conta.
  - Custo: quem abre o link num navegador em que não está na conta precisa entrar nele uma vez. Descartado: pedir senha nova a todo comprador, que faria quem é honesto criar a senha duas vezes.
  - Descartado: pedir o código da transação da Hotmart no cadastro (a pessoa precisaria achar o código, e o plano liberado pelo admin não tem código).
  - **O hottok fica só como SHA-256** (`hotmart_settings`): o banco nunca guarda o código, e a comparação continua em tempo constante, entre os dois resumos. Sem o código salvo, a rota responde 404, como antes sem a variável.
  - **A liberação automática dos planos é uma chave do Admin** (`hotmart_settings.unlocks_plans_at`, migração 0011; antes era uma constante no código). Nasce desligada: os avisos ficam registrados como "Registrado" e nada muda nas contas. Só liga com o código e pelo menos um produto salvos, guarda quando ligou e só um admin muda, conferido de novo no servidor. Descartado: variável de ambiente (só quem cuida do Coolify mudaria, e cada troca exigiria reiniciar o app).
  - **Descartados:** guardar o hottok cifrado (exigiria uma chave a mais, e o app nunca precisa ler o código de volta) e deixar as variáveis como alternativa ao Admin (duas fontes para o mesmo dado).

## Rankings

- **23/10/2026 · Três listas, todas com os dados que já temos:** "Mais vendidos", "Maior ganho" (com a comissão da pessoa) e "Em alta", as 30 primeiras do catálogo inteiro ou de uma categoria. Cada linha abre o produto no Radar.
- **23/10/2026 · "Em alta" pelo histórico de vendas por dia (`product_sales_day`, migração 0006):** cada coleta grava as vendas do dia de cada produto (dia do Brasil) e apaga o que tem mais de 35 dias. A lista compara hoje com o primeiro dia gravado entre 3 e 7 dias atrás e ordena pelo aumento em vendas. Fica vazia, com uma explicação, até existirem 3 dias de coleta. Sem chave estrangeira, para um produto que sai do catálogo por um dia não perder o histórico. Descartados: crescimento em porcentagem (produto com 2 vendas que vai para 10 apareceria no topo) e buscas em alta (a API de afiliados não traz buscas).

## Planos e admin (Etapa 3)

- **21/10/2026 · Planos provisórios num arquivo só (`src/features/plans/plans.ts`):** Sem plano (conta nova), Radar (Radar, Rankings e Anúncios), Completo (tudo, 12 vídeos por mês) e Pro (tudo, 30 vídeos por mês). Nomes, preços e pagamento esperam o cliente. Descartado: tabela de planos no banco, que só faz sentido quando houver pagamento.
- **21/10/2026 · O acesso é conferido dentro de cada página de ferramenta (`checkToolAccess`), não no layout:** o Next renderiza layout e página separadamente, então um bloqueio só no layout deixaria a página buscar os dados. O cadeado do menu é só aviso. Descartado: `forbidden()` do Next, que ainda é experimental na 16.4.
- **21/10/2026 · Admin pelo plugin `admin` do Better Auth:** papéis, bloqueio (que encerra as sessões na hora) e recusa das rotas `/api/auth/admin/*` para quem não é admin. A página `/admin` responde "não encontrada" para quem não é admin. O plano é mudado por ação nossa, validada com Zod, e o próprio usuário não consegue mudá-lo (`input: false`).
- **21/10/2026 · Primeiro admin pelo e-mail em `ADMIN_EMAIL`, concedido ao subir o container (`scripts/start.mjs`):** ninguém vira admin pelo app. Só vale para conta que já existe: a pessoa se cadastra primeiro e depois o e-mail entra na variável. Risco aceito: se a variável for definida antes do cadastro, quem se cadastrar primeiro com aquele e-mail vira admin no próximo deploy (não há confirmação de e-mail). Descartado: tela para promover admin.
- **21/10/2026 · Cada coleta fica registrada em `collection_run` (quando, deu certo ou não, quantos produtos):** é o que o admin mostra. A mensagem de erro guarda só o tipo e o texto técnico, sem dado pessoal.

## Anúncios (Etapa 4)

- **21/10/2026 · Anúncios por curadoria manual, feita no admin:** a API oficial da Meta não devolve anúncio comercial do Brasil, e os termos proíbem coleta automática. Descartados por agora: coleta automática da biblioteca da Meta e fornecedor pago (os dois esbarram nos termos); a decisão é do cliente.
- **21/10/2026 · Guardamos só o número do anúncio, nunca o vídeo ou a imagem:** o link mostrado é montado a partir do número (`libraryUrlFor`), então nenhum link colado aponta para outro site. A foto do cartão é a do produto do nosso catálogo. Descartado: baixar e hospedar o criativo, pelo risco de direito autoral e de termos.
- **21/10/2026 · Dias no ar = da data de início até a última conferência (`last_seen_on`):** o anúncio some da biblioteca quando para de rodar, então quem faz a curadoria marca "Conferi hoje". As datas são dias de calendário no fuso de Brasília. Descartado: contar até hoje, que inflaria anúncios já parados.
- **21/10/2026 · A tela lê só a tabela `ad`:** se o cliente escolher uma fonte automática depois, um coletor preenche a mesma tabela, como o Radar faz com os produtos, e as telas não mudam. Hoje não há interface de fonte para anúncios porque não há fonte externa; os dados de exemplo vêm de `src/sources/ads/demo-ads.ts`.
- **21/10/2026 · Anúncios automáticos junto com os manuais (Etapa 4b):** a fonte fica atrás da interface `AdSource`, como os produtos, e hoje só existe a de exemplo; uma fonte automática ou um fornecedor entra depois, quando o cliente decidir. Regras:
  - o mesmo anúncio (número da Meta) vira um registro só, e a origem fica em `source`;
  - a coleta só atualiza o conteúdo de anúncios não curados (`is_curated`); o que o admin escreveu fica, e só a data em que foi visto e a situação mudam;
  - anúncio que a fonte não traz mais vira "parou" (`is_active`), nunca é apagado, e uma resposta com menos da metade dos anúncios no ar não para nenhum;
  - o admin esconde anúncio automático (`is_hidden`) em vez de apagar, porque a próxima coleta o traria de volta.

  Descartados: apagar o que sumiu da fonte (perde o histórico de dias no ar) e deixar a coleta sobrescrever a curadoria.

## Studio

- **30/10/2026 · Studio, fatia 1, com um gerador de exemplo:** o caminho todo (escolher produto e formato, fila, cota do mês, biblioteca, baixar) funciona antes de escolher a API paga de vídeo. O gerador fica atrás da interface `VideoGenerator` (`src/sources/video`), e o de exemplo devolve sempre o mesmo vídeo vertical de 8 segundos (`public/studio/video-de-exemplo.mp4`). A tela avisa que é fase de teste.
  - **Cota:** conta os vídeos criados no mês de Brasília (do dia 1 à meia-noite), menos os que falharam. Vídeo vencido continua contando: a linha fica no banco, só o link sai.
  - **Um vídeo por vez por pessoa:** índice único parcial no banco (`queued` ou `generating`), que segura até dois cliques ao mesmo tempo.
  - **Fila:** o trabalho começa logo depois do clique (`after` do Next) e a tarefa agendada de cada minuto pega o que sobrou. As duas pegam vídeos com `FOR UPDATE SKIP LOCKED`, então nunca fazem o mesmo vídeo duas vezes. Vídeo parado em "gerando" por mais de 15 minutos vira falha, sem gastar da conta. Descartado: só a tarefa agendada, que faria o vídeo esperar até um minuto e não funcionaria no ambiente de demonstração sem configurar a tarefa.
  - **Biblioteca:** o vídeo pronto fica 15 dias; o que falhou fica 1 dia, para a pessoa ver que não gastou, e depois é apagado (virar "vencido" faria ele passar a contar no mês). A tela abre o vídeo no player do próprio aparelho em vez de um player na página.

## Stack

- **20/10/2026 · Next.js 16.4 (App Router) + React 19.3 + TypeScript 5.9:** Next no mínimo 16.4.1, por causa de correções de segurança críticas. Descartado: TypeScript 7, que ainda não funciona com o plugin do Next nem com as ferramentas de lint.
- **20/10/2026 · Node 24 LTS** (`.nvmrc`). Descartado: Node 26, que só vira LTS em 28/10/2026.
- **22/10/2026 · Imagem de produção fixa no patch do Node (`node:24.22.1-alpine`):** com a tag solta (`node:24-alpine`), o servidor podia continuar usando uma imagem antiga em cache, e não dava para saber qual Node estava no ar. A 24.22.1 é o patch de segurança de 21/10/2026. Custo: a cada aviso de segurança do Node, alguém troca o número. Descartado: tag solta com rebuild forçado, que não garante puxar a imagem nova.
- **20/10/2026 · Tailwind 4 + shadcn/ui (CLI v4) + lucide-react:** componentes maduros com o mínimo de personalização. Descartado: componentes feitos do zero.
- **20/10/2026 · Tema claro por padrão, com escuro nas configurações, via next-themes:** é o que o shadcn recomenda.
- **20/10/2026 · Postgres + Drizzle ORM 0.45 + driver `pg`:** só TypeScript, sem etapa de geração, e é o que o Better Auth aceita. Um driver só para tudo. Descartado: Prisma (etapa de geração, e a tag `latest` aponta para uma versão RC) e postgres.js (seria um segundo driver).
- **20/10/2026 · Better Auth 1.7 (mínimo 1.7.7, por segurança), com e-mail e senha e hash argon2id (`@node-rs/argon2`):** a regra global pede argon2 ou bcrypt, e o padrão do Better Auth é scrypt. Descartados: scrypt (fora da regra) e Auth.js.
- **20/10/2026 · Zod 4 para validar tudo que entra:** formulários, variáveis de ambiente, respostas das APIs externas. O Better Auth já depende dele.
- **20/10/2026 · nuqs para os filtros na URL:** busca, filtros e ordenação ficam no link e podem ser compartilhados. Descartado: estado na mão com `useSearchParams`. **Substituída em 21/10/2026** (ver Radar): os filtros ficaram simples o bastante sem a dependência.
- **20/10/2026 · Tabelas com o `Table` do shadcn, e filtro e ordenação no SQL:** no celular a lista vira cartões. Descartado: TanStack Table (excesso para o MVP).
- **20/10/2026 · Gráficos com o `chart` do shadcn (Recharts 3).** Descartado: Chart.js.
- **20/10/2026 · Biome para lint e formatação:** uma dependência só. Descartado: ESLint + Prettier (o ESLint 9 saiu de suporte, e os plugins ainda não suportam o 10).
- **20/10/2026 · Vitest para lógica pura, Playwright para fluxos (com 375 px) e Postgres local com banco `*_test` para integração.** Descartado: Jest e Testcontainers (exige Docker).
- **20/10/2026 · pino para logs JSON no stdout, com `redact` de dados sensíveis.** Descartado: winston.
- **20/10/2026 · `fetch` nativo + `node:crypto` para a API GraphQL da Shopee.** Descartado: clientes GraphQL.

## Infraestrutura

- **20/10/2026 · Cache Components do Next desligado:** vem ligado no template da 16.4, mas com login em toda tela só acrescenta regras de `Suspense` e cache. As páginas são dinâmicas por padrão. Descartado: ligar agora; reavaliar quando houver página pública.
- **20/10/2026 · Postgres local por Docker Compose (um serviço só) e `npm run local`:** é o "clona e roda com um comando". Os testes de integração e de ponta a ponta usam o banco `prisciane_test` e recusam rodar em outro. Descartados: Postgres instalado na máquina e Testcontainers.
- **21/10/2026 · Instalação no Coolify pelo build pack "Docker Compose" (`docker-compose.coolify.yml`), com o app e o Postgres juntos:** o Coolify gera a senha do banco, o segredo do login e o segredo das coletas pelas variáveis mágicas (`SERVICE_*`), então ninguém digita nem cola segredo. O código vem do GitHub por uma deploy key só de leitura. Passo a passo em `docs/COOLIFY.md`. Descartado: Dockerfile puro com Postgres separado (exige criar e colar as senhas à mão). Antes de virar produção, avaliar um Postgres separado com backup agendado.
- **20/10/2026 · Migrações aplicadas pelo próprio container ao subir (`scripts/start.mjs`):** não depende de configurar um comando extra no Coolify. Descartado: pre-deploy command do Coolify.
- **20/10/2026 · Hospedagem no Coolify:** o projeto fica configurável por variáveis de ambiente, e a configuração é feita no painel do Coolify. Build por Dockerfile com `output: "standalone"`, rota `/api/health` para o healthcheck e Postgres 18 como recurso do Coolify, com backup agendado. Descartado: Nixpacks (em modo de manutenção).
- **20/10/2026 · Dois ambientes no Coolify (demonstração e produção), cada um com app, banco e variáveis próprios.** Nada específico de ambiente em `NEXT_PUBLIC_*`, que é gravado no build.
- **20/10/2026 · Coleta diária pelas "Scheduled Tasks" do Coolify:** o comando roda dentro do container. Descartado: `node-cron` dentro do app, que roda em dobro durante o deploy.
- **20/10/2026 · Fila do Studio numa tabela do Postgres (`FOR UPDATE SKIP LOCKED`) com um worker por tarefa agendada.** Descartados: pg-boss, BullMQ e Redis, até precisarmos de retentativas com espera.
- **31/10/2026 · Repositório `radar` no GitHub `GuiSatierf`, público e sem licença:** o código fica à vista, mas todos os direitos continuam reservados.
- **20/10/2026 · Porta 3210 (desenvolvimento e container) e 3211 (testes de ponta a ponta):** a 3000 já é usada por outros projetos na máquina de desenvolvimento, e `localhost` caía no app errado. Descartado: a porta padrão 3000.
- **20/10/2026 · shadcn/ui com Base UI (o padrão do CLI v4 desde 07/2026):** menos personalização. Descartado: Radix, que segue suportado, mas não é mais o padrão.
- **20/10/2026 · Limite de tentativas de login pelo IP do cabeçalho `x-real-ip` (variável `CLIENT_IP_HEADER`):** o proxy sobrescreve esse cabeçalho, e o cliente não consegue forjá-lo. Descartado: `x-forwarded-for`, que o cliente pode preencher e que permitiria burlar o limite.
- **20/10/2026 · Validação do cadastro também no servidor (hook do Better Auth com o mesmo schema Zod da tela):** a regra é nunca confiar no cliente.
- **23/10/2026 · "Esqueci minha senha" pelo fluxo do Better Auth, com o envio de e-mail atrás de uma interface (`src/sources/email`):**
  - O link vale 1 hora e uma vez só, e trocar a senha encerra as sessões abertas (`revokeSessionsOnPasswordReset`).
  - A resposta é a mesma com ou sem conta, e o e-mail sai sem esperar, para não revelar quem tem conta.
  - Hoje só existe a caixa de saída local (`EMAIL_OUTBOX_DIR`, um arquivo `emails.jsonl`), usada no desenvolvimento e nos testes.
  - Sem ela, que é o caso da demonstração e da produção enquanto não houver um serviço de e-mail, a tela manda falar com o suporte em vez de prometer um e-mail que não chega.
  - O serviço de e-mail real (Resend ou outro) entra pela mesma interface quando o cliente escolher.
  - 23/10/2026: o Resend entrou por essa interface, desligado enquanto `RESEND_API_KEY` e `EMAIL_FROM` estiverem vazios. A chamada é direta à API HTTP do Resend (com tempo limite), sem a biblioteca deles, para não somar dependência por um único POST. A caixa de saída local tem prioridade, para o desenvolvimento e os testes nunca mandarem e-mail de verdade.
  - Descartado: mandar o link pelo log do servidor, que guardaria um acesso à conta em texto.
