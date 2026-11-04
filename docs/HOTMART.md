# Ligar a Hotmart

Com isto, quem compra na Hotmart já entra com o acesso liberado, e quem pede reembolso ou cancela perde o acesso sozinho. Ninguém precisa dar acesso à conta da Hotmart: quem cuida dela faz tudo entre a Hotmart e a aba **Admin → Hotmart** do app.

> A liberação automática nasce **desligada**: os avisos da Hotmart chegam e ficam registrados, mas nenhum acesso muda até um admin ligar o passo 4 da aba. Dá para deixar tudo configurado e testado antes. Uma compra que chegar com ela desligada não é aplicada depois, nem quando ela ligar (o aviso já foi recebido e a Hotmart não manda de novo): o admin libera esse acesso à mão em **Admin → Contas**.

## 1. Criar o webhook na Hotmart

1. Na Hotmart, abra **Ferramentas** → **Webhook (API e notificações)** → **Cadastrar Webhook**.
2. **Nome:** `Prisciane`.
3. **URL de envio:** copie da aba **Admin → Hotmart** do app (passo 1 da tela, botão **Copiar**).
4. **Versão:** `2.0.0`.
5. **Produto:** o produto (ou os produtos) da assinatura.
6. **Eventos:** marque estes:
   - Compra aprovada
   - Compra completa
   - Compra reembolsada
   - Chargeback
   - Compra cancelada
   - Compra expirada
   - Cancelamento de assinatura
   - Troca de plano
7. Salve.

## 2. Colar o código de segurança (hottok) no app

Na mesma tela de Webhook, a Hotmart mostra o **hottok**: um código que prova que o aviso veio dela.

- Cole na aba **Admin → Hotmart**, passo 2, e clique em **Salvar**.
- Depois de salvo ele não aparece de novo, nem para o admin: o app guarda só uma "impressão digital" do código. Para trocar, é só colar o novo.
- **Não mande por WhatsApp nem e-mail.** Quem tiver esse código consegue mandar avisos falsos para o app.

## 3. Dizer quais produtos liberam o acesso

Na aba **Admin → Hotmart**, passo 3, adicione uma linha para cada plano de assinatura (ou produto) vendido na Hotmart. Todos liberam o mesmo acesso, a todas as ferramentas:

- **Assinatura:** o código do plano de assinatura. Na Hotmart, em **Produtos** → o produto → **Planos**.
- **Produto:** o código do produto. Aparece no endereço da página do produto na Hotmart.
Adicionar de novo o mesmo código não cria outra linha.

## 4. Tarefa de fim de acesso (no Coolify, uma vez)

Quem cuida do Coolify cria, na aba **Scheduled Tasks** do recurso do app, a tarefa que tira o acesso de quem cancelou quando o período pago acaba:

| Nome | Frequência | Container | Comando |
|---|---|---|---|
| Fim de acesso | `0 10 * * *` | app | `wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3210/api/cron/expire-access` |

## 5. Ligar a liberação automática

Na aba **Admin → Hotmart**, passo 4, toque na chave **Liberar o acesso sozinho**. Ela só liga depois que o código do passo 2 e pelo menos um produto do passo 3 estão salvos. A tela mostra desde quando está ligada; desligar volta a só registrar os avisos.

Só quem é admin vê a aba e consegue mudar a chave: o servidor confere de novo a cada mudança.

## 6. Testar

Na tela de Webhook da Hotmart, use **Enviar teste** para a URL do passo 1. Na aba **Histórico** da Hotmart, a resposta deve ser `200`, e o aviso aparece na lista da aba **Admin → Hotmart**.

- `404`: o código do passo 2 ainda não foi salvo no app.
- `401`: o código salvo no app está diferente do que a Hotmart mostra. Cole de novo.

## Como funciona

| Acontece na Hotmart | No app |
|---|---|
| Compra aprovada ou completa, renovação | Libera o acesso (na conta ou no cadastro, se a pessoa ainda não tem conta) |
| Troca de plano | Mantém o acesso, se o plano novo estiver no passo 3 |
| Reembolso, chargeback, compra cancelada ou expirada | Tira o acesso na hora |
| Cancelamento de assinatura | Mantém até o fim do período já pago e tira no dia seguinte a ele |
| Outros eventos (boleto gerado, pagamento atrasado, pedido de reembolso) | Nada: a Hotmart manda o evento final depois |

- A conta é ligada pelo **e-mail da compra**. Se a pessoa criar a conta com outro e-mail, o acesso não chega: o admin libera na mão.
- Um aviso repetido pela Hotmart é aplicado uma vez só.
- Se o admin liberar ou tirar o acesso de alguém na mão, o próximo aviso da Hotmart para aquela pessoa passa por cima.
