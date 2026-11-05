import type { LegalEntity } from "./legal-info";

export interface LegalSection {
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly items?: readonly string[];
}

export interface LegalDocument {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

const CONTACT_HINT = "pelo contato no fim desta página";

/** Who answers for the data: the company once the client sends it, the team until then. */
export function describeController(
  entity: LegalEntity,
  appName: string,
): string {
  if (entity.name == null) return `a equipe do ${appName}`;

  if (entity.document == null) return entity.name;

  return `${entity.name}, CNPJ ${entity.document}`;
}

export function buildTerms(appName: string): LegalDocument {
  return {
    title: "Termos de uso",
    intro: `Estas são as regras para usar o ${appName}. Ao criar a conta, você concorda com elas. Se algo não ficar claro, fale com a gente ${CONTACT_HINT}.`,
    sections: [
      {
        title: `O que é o ${appName}`,
        paragraphs: [
          `O ${appName} é um serviço por assinatura para quem divulga produtos da Shopee como afiliada. Ele mostra produtos, quantas pessoas já divulgam cada um e ajuda a criar os vídeos.`,
          `O ${appName} não é da Shopee e não tem ligação com ela. A Shopee tem regras próprias para afiliados, e você também precisa seguir essas regras.`,
        ],
      },
      {
        title: "Sua conta",
        paragraphs: [
          "Para criar conta, você precisa ter 18 anos ou mais e usar dados verdadeiros.",
        ],
        items: [
          "A conta é só sua: não empreste nem divida a senha.",
          "O que for feito com a sua conta é responsabilidade sua.",
          "Se achar que outra pessoa entrou na sua conta, troque a senha e avise a gente.",
        ],
      },
      {
        title: "Acesso e pagamento",
        paragraphs: [
          "O acesso é comprado na Hotmart, que cuida do pagamento. O preço e o que ele inclui aparecem na página de venda.",
          "O acesso é liberado para o e-mail usado na compra. Use o mesmo e-mail para criar a conta aqui.",
        ],
      },
      {
        title: "Cancelamento e reembolso",
        paragraphs: [
          "Você pode cancelar a assinatura na Hotmart quando quiser. Depois de cancelar, o acesso continua até o fim do período que você já pagou.",
          "Nos 7 primeiros dias depois da compra, você pode desistir e pedir o dinheiro de volta pela Hotmart, como garante o Código de Defesa do Consumidor.",
          "Se a compra for reembolsada ou contestada no cartão, o acesso sai da conta na mesma hora.",
        ],
      },
      {
        title: "Os números são estimativas",
        paragraphs: [
          "Quantidade de afiliados, vendas, preço e ganho vêm da Shopee e de outras fontes, e podem estar atrasados ou errados. Use os números para comparar produtos e confira na Shopee antes de decidir.",
          "Não prometemos vendas nem ganho. O resultado depende do produto, do seu vídeo e de muitas coisas que não controlamos.",
        ],
      },
      {
        title: "O que não pode",
        paragraphs: [],
        items: [
          "Dividir, emprestar ou revender o acesso.",
          "Copiar os dados do site em massa, com robôs ou programas.",
          "Tentar passar dos limites do seu acesso ou atacar a segurança do site.",
          "Usar o serviço para enganar compradores ou para desrespeitar as regras da Shopee e das redes sociais.",
        ],
      },
      {
        title: "O que você publica",
        paragraphs: [
          "Os vídeos e textos que você cria e publica são seus, e a responsabilidade por eles também. Isso inclui imagens, músicas e as regras de cada rede social.",
        ],
      },
      {
        title: "Bloqueio da conta",
        paragraphs: [
          "Se você descumprir estes termos, podemos bloquear a conta. Quando for possível, avisamos antes e explicamos o motivo.",
        ],
      },
      {
        title: "Quando o serviço para",
        paragraphs: [
          "Trabalhamos para o site funcionar sempre, mas ele pode parar por manutenção ou por falha de serviços de fora, como a Shopee.",
          "As ferramentas podem mudar com o tempo. Se uma mudança tirar algo importante do seu acesso, avisamos antes.",
        ],
      },
      {
        title: "Mudanças nestes termos",
        paragraphs: [
          "Quando estes termos mudarem, a data no topo desta página muda junto. Se a mudança for importante, avisamos você pelo site ou por e-mail.",
        ],
      },
      {
        title: "Leis",
        paragraphs: [
          "Valem as leis do Brasil. Se houver alguma disputa, ela pode ser resolvida na cidade onde você mora.",
        ],
      },
    ],
  };
}

export function buildPrivacyPolicy(
  appName: string,
  controller: string,
): LegalDocument {
  return {
    title: "Política de privacidade",
    intro: `Aqui explicamos quais dados seus o ${appName} guarda, para quê e o que você pode pedir. Quem cuida dos seus dados é ${controller}.`,
    sections: [
      {
        title: "Quais dados guardamos",
        paragraphs: [],
        items: [
          "Da sua conta: nome, e-mail e senha. A senha fica guardada embaralhada, de um jeito que nem a nossa equipe consegue ler.",
          "Da sua compra: a Hotmart nos avisa o e-mail da compra, o produto e as datas. Não guardamos cartão, documento nem endereço.",
          "Dos seus acessos: o endereço de internet (IP) e o tipo de aparelho e navegador de cada vez que você entra.",
          "Das suas escolhas: o seu perfil de comissão na Shopee e o tema claro ou escuro.",
          "Registros de erro do site, que podem ter o número da sua conta, mas nunca a sua senha.",
        ],
      },
      {
        title: "Para que usamos",
        paragraphs: [
          "Não vendemos os seus dados e não usamos os seus dados para propaganda.",
        ],
        items: [
          "Criar a sua conta e deixar você entrar.",
          "Liberar e encerrar o seu acesso conforme a compra na Hotmart.",
          "Proteger a conta, por exemplo limitando tentativas de senha errada.",
          "Mandar o link para criar uma senha nova quando você pede.",
          "Responder quando você fala com o suporte.",
        ],
      },
      {
        title: "Por que podemos usar",
        paragraphs: [
          "A Lei Geral de Proteção de Dados (Lei 13.709/2018) pede que a gente diga por que pode usar cada dado:",
        ],
        items: [
          "Para prestar o serviço que você assinou: conta, acesso e suporte.",
          "Para cumprir a lei: o Marco Civil da Internet manda guardar os registros de acesso por 6 meses.",
          "Para a segurança de todos: limitar tentativas de senha e investigar acessos estranhos.",
        ],
      },
      {
        title: "Com quem compartilhamos",
        paragraphs: ["Só com quem precisa dos dados para o serviço funcionar:"],
        items: [
          "A Hotmart, que cuida do pagamento.",
          "A empresa que hospeda os nossos servidores. Os servidores podem ficar fora do Brasil.",
          "O serviço que entrega os nossos e-mails, como o de senha nova.",
          "Autoridades, quando a lei ou a Justiça mandar.",
        ],
      },
      {
        title: "Links para a Shopee",
        paragraphs: [
          "Quando você abre um produto na Shopee, sai do nosso site e passam a valer as regras de privacidade da Shopee. Não mandamos os seus dados para a Shopee.",
        ],
      },
      {
        title: "Cookies e dados no aparelho",
        paragraphs: [
          "Usamos um cookie para manter você conectada depois de entrar. Sem ele não dá para usar a conta. A escolha de tema fica guardada no seu aparelho.",
          "Não usamos cookies de propaganda nem de medição de visitas.",
        ],
      },
      {
        title: "Por quanto tempo guardamos",
        paragraphs: [
          "Guardamos os dados enquanto a sua conta existir. Se você pedir para apagar a conta, apagamos os dados, menos o que a lei manda guardar por mais tempo, como os registros de acesso.",
        ],
      },
      {
        title: "Seus direitos",
        paragraphs: [
          `Você pode pedir ${CONTACT_HINT}, e respondemos em até 15 dias:`,
        ],
        items: [
          "Saber se temos dados seus e receber uma cópia.",
          "Corrigir dados errados ou desatualizados.",
          "Apagar a sua conta e os seus dados.",
          "Levar os seus dados para outro serviço.",
          "Saber com quem compartilhamos os seus dados.",
        ],
      },
      {
        title: "Se algo der errado",
        paragraphs: [
          "Se acontecer algum problema de segurança que possa prejudicar você, avisamos você e a Autoridade Nacional de Proteção de Dados.",
          "Se não ficar satisfeita com a nossa resposta, você também pode reclamar direto com essa Autoridade.",
        ],
      },
      {
        title: "Menores de idade",
        paragraphs: [
          "O serviço é só para quem tem 18 anos ou mais. Não guardamos de propósito dados de menores de idade.",
        ],
      },
      {
        title: "Mudanças nesta política",
        paragraphs: [
          "Quando esta política mudar, a data no topo desta página muda junto. Se a mudança for importante, avisamos você pelo site ou por e-mail.",
        ],
      },
    ],
  };
}
