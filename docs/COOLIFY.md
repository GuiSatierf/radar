# Instalar o Prisciane no Coolify

Passo a passo para quem não programa. Feito uma vez só; depois, os deploys saem pelo próprio Coolify (ou pelo MCP, quando o dono pedir).

O app e o banco sobem juntos pelo arquivo `docker-compose.coolify.yml`. O Coolify gera sozinho a senha do banco, o segredo do login e o segredo das coletas: **ninguém digita nem cola senha**.

## 1. Chave só de leitura para o Coolify ler o código

O repositório é privado, então o Coolify precisa de uma chave que só lê este repositório.

1. No Coolify: **Keys & Tokens** → **Private Keys** → **+ Add**.
2. Clique em **Generate new ED25519 SSH Key**. Nome: `prisciane-deploy`. Salve.
3. Copie a **Public Key** que aparece (começa com `ssh-ed25519`).
4. No GitHub: repositório `radar` → **Settings** → **Deploy keys** → **Add deploy key**.
5. Título: `Coolify`. Cole a chave. **Deixe "Allow write access" desmarcado.** Salve.

## 2. Projeto e recurso

1. No Coolify: **Projects** → **+ Add**. Nome: `Prisciane`. Ele cria o ambiente `production` sozinho (aqui ele é o de desenvolvimento hospedado).
2. Dentro do projeto: **+ New** → **Private Repository (with Deploy Key)**.
3. Servidor: `contabo-prod-01`. Chave: `prisciane-deploy`.
4. Repositório: `git@github.com:GuiSatierf/radar.git`. Branch: `main`.
5. **Build Pack:** `Docker Compose`. **Docker Compose Location:** `/docker-compose.coolify.yml`. Continue.

## 3. Endereço

Na tela do recurso, o serviço **app** já vem com um endereço provisório gerado pelo Coolify (termina em `sslip.io`). Use esse endereço até o cliente comprar o domínio, mas sempre com https, para a senha e o login não trafegarem abertos:

1. Menu **Domains** → na linha do **app**, a engrenagem em **Actions**.
2. Em **Protocol**, escolha **https**. Não mexa no **Port** (3210).
3. **Save** e depois **Deploy**. O Coolify pede o certificado sozinho e passa a mandar quem abre com http:// para o https://.

O Coolify avisa que https com `sslip.io` pode falhar, porque o serviço que emite os certificados limita quantos saem por domínio, e o `sslip.io` é usado por muita gente. Se o navegador mostrar "conexão não segura" depois do deploy, volte o Protocol para http e espere o domínio próprio. Trocar o domínio depois é só editar esse mesmo campo e fazer um novo deploy.

## 4. Variáveis

Na aba **Environment Variables**:

- As que começam com `SERVICE_` foram geradas pelo Coolify. **Não mexa.**
  - `SERVICE_BASE64_64_VIDEOKEYS` vira `VIDEO_KEYS_SECRET`, que embaralha as chaves das IAs de vídeo salvas no Admin. Se ela mudar, as chaves salvas deixam de abrir e precisam ser coladas de novo.
- `SUPPORT_URL`: o link do "Falar com o suporte" (por exemplo, um link do WhatsApp que começa com `https://`). Pode ficar vazio.
- `ADMIN_EMAIL`: deixe vazio por enquanto (passo 6).
- `SHOPEE_AFFILIATE_APP_ID` e `SHOPEE_AFFILIATE_SECRET`: o AppID e a senha da API de afiliados da Shopee. Preenchidos, a coleta diária traz os produtos reais; vazios, o Radar fica com o catálogo de exemplo. Preencha os dois ou nenhum.
- `RESEND_API_KEY` e `EMAIL_FROM`: o envio de e-mail de verdade (hoje só o "esqueci minha senha"). Vazios, o e-mail fica desligado e a tela manda falar com o suporte. Para ligar:
  1. Crie a conta no [Resend](https://resend.com) e verifique o domínio do cliente (o Resend mostra os registros de DNS para colar).
  2. Crie uma chave de envio (começa com `re_`) e coloque em `RESEND_API_KEY`.
  3. Em `EMAIL_FROM`, o remetente num endereço desse domínio, por exemplo `Prisciane <nao-responda@dominio.com.br>`.
  4. Clique em **Restart**. Preencha os dois ou nenhum: só um deles faz o app recusar subir, com o nome da variável no log.

## 5. Primeiro deploy

Clique em **Deploy** (ou peça no chat). Leva alguns minutos. Pronto quando o recurso fica **Running (healthy)**.

## 6. Virar admin

1. Abra o endereço do app e crie a sua conta pela tela.
2. No Coolify, coloque esse e-mail em `ADMIN_EMAIL` e clique em **Restart**.
3. Ao subir, o app dá o papel de admin a essa conta. A área **Admin** aparece no menu.

Só funciona para conta que já existe: por isso o e-mail entra depois do cadastro.

## 7. Coletas diárias

Na aba **Scheduled Tasks** do recurso, crie duas tarefas, as duas no container **app**:

| Nome | Frequência | Comando |
|---|---|---|
| Coleta de produtos | `0 9 * * *` (6h em Brasília) | `wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3210/api/cron/collect-products` |
| Coleta de anúncios | `30 9 * * *` (6h30 em Brasília) | `wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3210/api/cron/collect-ads` |

Depois de criar, rode cada uma uma vez (**Execute Now**) para o Radar já ter dados. A de produtos usa a API de afiliados da Shopee quando a chave está nas variáveis; a de anúncios não faz nada enquanto não houver uma fonte automática de verdade (os anúncios vêm só do admin).

Os vídeos que a IA faz ficam no volume `prisciane-videos`, que o próprio deploy cria (está no `docker-compose.coolify.yml`); não precisa configurar nada. Eles passam de um deploy para o outro e saem sozinhos depois de 15 dias.

O Studio tem mais uma tarefa, a cada minuto. O vídeo já começa logo depois do clique; a tarefa pega o que um deploy interrompeu e tira da biblioteca, e do volume, os vídeos com mais de 15 dias:

| Nome | Frequência | Comando |
|---|---|---|
| Fila do Studio | `* * * * *` | `wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3210/api/cron/generate-videos` |

Quando a Hotmart for ligada, entra mais uma tarefa, a de fim de acesso. O passo a passo está em `docs/HOTMART.md`.

## Depois

- **Domínio próprio:** quando existir, aponte o DNS para o IP do servidor e troque o endereço do serviço **app** (passo 3). Se usar o proxy da Cloudflare (nuvem laranja), mude `CLIENT_IP_HEADER` para `cf-connecting-ip`; senão o limite de tentativas de login vale para todo mundo junto.
- **Backup:** o banco está dentro deste recurso. Antes de virar produção de verdade, vale passar para um Postgres separado no Coolify, com backup agendado.
