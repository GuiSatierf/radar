# Prisciane

Plataforma por assinatura para afiliados da Shopee, principalmente quem posta na Shopee Vídeo. Mostra quantas pessoas já divulgam cada produto, para a pessoa escolher os de pouca concorrência, e ajuda a criar o vídeo.

## Quem usa (vale para toda tela e todo texto)

- **Pessoas comuns, iniciantes**, que compraram um curso de como vender na Shopee. Não são técnicas.
- Texto curto, em português do Brasil, sem sigla e sem jargão: nada de "ROAS", "CTR" ou "GMV" na tela. Todo número tem uma frase curta explicando o que significa.
- Celular primeiro: toda tela funciona em 375 px, com área de toque de pelo menos 44 px.
- Visual: componentes do shadcn/ui com o mínimo de personalização. Uma cor de destaque (rosa framboesa, `--primary`), o resto neutro. Barra lateral clara, da cor dos cartões, com ícone e nome de cada área no computador, e menu fixo embaixo no celular e no tablet; o rosa marca só a área aberta. Tema claro por padrão, com escuro nas Configurações.
- Sem cara de IA: nada de degradê, brilho, vidro desfocado, emoji em título, ícone decorativo em todo canto ou frase de efeito.
- O nome do produto vem de `APP_NAME`.

## Stack e comandos

Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui (Base UI), Postgres com Drizzle, Better Auth (e-mail e senha, argon2id), Zod, Biome, Vitest e Playwright. O porquê de cada escolha está em `docs/DECISOES.md`.

| Comando | O que faz |
|---|---|
| `npm run local` | Primeira vez: cria o `.env`, sobe o Postgres local (Docker), cria o banco `_test`, migra, faz o seed e abre o app |
| `npm run setup` | Só a preparação acima, sem abrir o app |
| `npm run dev` | App em http://localhost:3210 |
| `npm run ci` | Lockfile, formato, lint, tipos, testes unitários, build e audit: os mesmos passos da CI do GitHub |
| `npm run test:integration` | Testes que usam o banco `prisciane_test` (fora do `ci`, rodar antes de PR que mexe em banco ou login) |
| `npm run test:e2e` | Playwright no computador e no celular, contra o banco `prisciane_test` (fora do `ci`, rodar antes de PR que mexe em tela) |
| `npm run db:generate` | Gera a migração depois de mudar `src/db/*` |
| `npm run collect` | Atualiza os produtos pela fonte (`src/sources/products`) |
| `npm run collect:ads` | Atualiza os anúncios automáticos pela fonte (`src/sources/ads`) |

## Regras do projeto

- **Formulários com senha** usam `method="post"` e só liberam o botão depois que a página carrega o JavaScript (`useIsClient`). Sem isso, o navegador manda a senha no endereço da página.
- **Dinheiro e porcentagem:** dinheiro em centavos (inteiro), taxa em pontos-base (1% = 100), nota em décimos (4,9 = 49). As contas ficam em `src/features/radar/domain`, cobertas por teste.
- **Fontes externas atrás de uma interface:** Shopee, anúncios, Instagram e geração de vídeo. Cada uma tem uma implementação falsa para desenvolvimento e testes. Nenhum teste chama serviço real. Os anúncios vêm da curadoria no admin e de uma fonte automática (hoje nenhuma: a de exemplo só roda no desenvolvimento, no seed e nos testes, nunca na coleta agendada), na mesma tabela `ad`: a coleta nunca sobrescreve o que o admin escreveu e nunca apaga, só marca como parado.
- **Código com barra invertida** (regex, escape) se escreve com a ferramenta de arquivo, nunca por heredoc no terminal: o Git Bash come as barras.
- **As telas leem só o nosso banco.** A coleta de dados é uma tarefa agendada separada.
- **O servidor decide acesso e limite**, nunca a tela: toda página protegida chama `requireCurrentUser()`, toda página e API de ferramenta chama `checkToolAccess()` e para quando não pode, e toda página e ação do admin confere o papel de novo. O `src/proxy.ts` e o cadeado do menu são só atalhos.
- **Planos** ficam só em `src/features/plans/plans.ts` (provisórios até o cliente decidir).
- **Testes nunca usam o banco de desenvolvimento:** integração e e2e recusam rodar se a URL não terminar em `_test`.
- **Datas** em `timestamptz` (UTC). **Dinheiro** em centavos (inteiro).
- **Variáveis de ambiente:** validadas com Zod em `src/lib/env.ts`. Nada específico de ambiente em `NEXT_PUBLIC_*`. A lista está no `.env.example`.
- **Migração** de banco: conferir o próximo número livre na `main` e nos PRs abertos antes de gerar.
- **Pastas** `src/components/ui` (gerada pelo shadcn) e `drizzle/meta` ficam fora do Biome; não editar à mão sem motivo.

## Ambientes

- **Desenvolvimento:** a máquina de quem programa, com o Postgres do `docker-compose.yml`.
- **Demonstração e produção:** no Coolify. Cada ambiente tem app, banco e variáveis próprios. O `Dockerfile` roda as migrações ao subir e expõe `/api/health` para o healthcheck. Tudo é configurável por variável de ambiente; o passo a passo está em `docs/COOLIFY.md`.

## Git

- Commits em inglês, no formato Conventional Commits, uma mudança lógica por commit.
- Nada vai para a `main` sem PR.
