# Prisciane

Plataforma por assinatura para afiliados da Shopee: escolher produtos com pouca concorrência, ver referências do que funciona e criar o vídeo com IA.

## Rodar na sua máquina

Precisa de **Node 24** (veja `.nvmrc`) e do **Docker** (para o Postgres local).

```bash
npm install
npm run local
```

O `npm run local` cria o `.env`, sobe o banco, aplica as migrações, cria a conta de demonstração e abre o app em http://localhost:3210.

A conta de demonstração fica no `.env`, nas variáveis `SEED_DEMO_EMAIL` e `SEED_DEMO_PASSWORD`. Também dá para criar uma conta nova pela tela.

A conta de demonstração tem o plano Pro e é admin (`ADMIN_EMAIL` no `.env`). Para ver as ferramentas fechadas, crie outra conta pela tela: conta nova começa sem plano.

Nas próximas vezes, basta `npm run dev`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | App em modo de desenvolvimento |
| `npm run ci` | Todas as checagens: formato, lint, tipos, testes unitários, build e audit |
| `npm run test:integration` | Testes com o banco de teste (`prisciane_test`) |
| `npm run test:e2e` | Testes de clicar (computador e celular), também com o banco de teste |
| `npm run db:generate` | Gera uma migração depois de mudar o schema em `src/db` |
| `npm run db:migrate` | Aplica as migrações no banco do `.env` |
| `npm run db:seed` | Cria os dados de demonstração (conta e produtos fictícios) |
| `npm run collect` | Atualiza os produtos pela fonte de dados (hoje, a fictícia) |
| `npm run collect:ads` | Atualiza os anúncios automáticos pela fonte (hoje, a de exemplo) |

## Publicar (Coolify)

- Build pelo `Dockerfile`. O container aplica as migrações ao subir e responde em `/api/health`.
- Cada ambiente (demonstração e produção) tem app, banco Postgres e variáveis próprios.
- As variáveis estão no `.env.example`. Em produção, gere um `BETTER_AUTH_SECRET` novo e aponte o `BETTER_AUTH_URL` para o endereço público.
- Admin: depois de criar a conta pela tela, coloque o e-mail dela em `ADMIN_EMAIL` e reinicie o app. A área `/admin` muda o plano de cada pessoa, bloqueia contas e cadastra os anúncios da tela Anúncios (curadoria manual pela biblioteca de anúncios da Meta). O link de "Falar com o suporte" vem de `SUPPORT_URL`.
- Coletas diárias de produtos e de anúncios: defina `CRON_SECRET` e crie duas tarefas agendadas no Coolify, uma vez por dia cada:

```bash
wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3210/api/cron/collect-products
```

```bash
wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3210/api/cron/collect-ads
```

- Fila do Studio: uma tarefa a cada minuto (`* * * * *`), que retoma vídeos interrompidos por um deploy e tira da biblioteca os vídeos com mais de 15 dias:

```bash
wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3210/api/cron/generate-videos
```

As decisões técnicas estão em `docs/DECISOES.md`.
