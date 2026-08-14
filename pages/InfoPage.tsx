import React from "react";
import { useNavigate, useParams } from "react-router-dom";

interface InfoPageContent {
  title: string;
  intro?: string;
  sections: { heading?: string; paragraphs: string[] }[];
}

const CONTACT_EMAIL = "contato@pointpoint.com";
const CONTACT_WHATSAPP = "16 99773-5290";
const CONTACT_ADDRESS = "Rua Ângelo Marquezi, 59";

const INFO_PAGES: Record<string, InfoPageContent> = {
  "quem-somos": {
    title: "Quem Somos",
    intro:
      "A POIT&POIT nasceu da vontade de transformar momentos simples em lembranças afetivas, através de pelúcias feitas para abraçar, presentear e encantar gente de todas as idades.",
    sections: [
      {
        paragraphs: [
          "Trabalhamos com um catálogo pensado para agradar de crianças a colecionadores, sempre com foco em qualidade dos materiais, acabamento cuidadoso e um atendimento próximo do nosso cliente.",
          "Cada pelúcia que sai da POIT&POIT passa por um cuidado especial, pensado para durar muitos abraços e virar companhia por anos.",
          `Estamos na ${CONTACT_ADDRESS}, além de atender online para todo o Brasil.`,
        ],
      },
    ],
  },
  "nossa-historia": {
    title: "Nossa História",
    sections: [
      {
        paragraphs: [
          "A POIT&POIT começou com um propósito simples: oferecer pelúcias de qualidade que fossem além do brinquedo comum, criando uma conexão real com quem recebe.",
          "Com o tempo, fomos ampliando nosso catálogo, sempre ouvindo o que nossos clientes procuravam.",
          "Hoje seguimos crescendo com o mesmo cuidado do início: cada pelúcia é escolhida pensando em quem vai abraçá-la.",
        ],
      },
    ],
  },
  "politica-de-qualidade": {
    title: "Política de Qualidade",
    intro: "Levamos a sério cada detalhe das pelúcias que chegam até você.",
    sections: [
      {
        heading: "Materiais e acabamento",
        paragraphs: [
          "Selecionamos fornecedores e materiais com base em critérios de segurança, maciez e durabilidade, priorizando tecidos antialérgicos sempre que possível.",
        ],
      },
      {
        heading: "Controle antes do envio",
        paragraphs: [
          "Nossos produtos passam por conferência visual antes de serem enviados, verificando costura, enchimento e acabamentos como olhos, laços e etiquetas.",
        ],
      },
      {
        heading: "Algo saiu diferente do esperado?",
        paragraphs: [
          `Se um produto chegar com defeito de fabricação, fale com a gente pelo WhatsApp (${CONTACT_WHATSAPP}) ou e-mail (${CONTACT_EMAIL}) que vamos resolver.`,
        ],
      },
    ],
  },
  "trabalhe-conosco": {
    title: "Trabalhe Conosco",
    intro: "A POIT&POIT está sempre de olho em gente boa pra somar com a gente.",
    sections: [
      {
        paragraphs: [
          "Ainda não temos vagas abertas publicadas, mas adoramos conhecer gente que se identifica com o nosso jeito de cuidar de cada pelúcia e de cada cliente.",
          `Quer deixar seu currículo com a gente? Envie para ${CONTACT_EMAIL} contando um pouco sobre você — assim que surgir uma oportunidade compatível, entramos em contato.`,
        ],
      },
    ],
  },
  "central-de-ajuda": {
    title: "Central de Ajuda",
    intro: "Separamos as dúvidas mais comuns para te ajudar mais rápido.",
    sections: [
      {
        heading: "Como acompanho meu pedido?",
        paragraphs: [
          'Depois de finalizar a compra, você pode acompanhar o status do seu pedido na área "Meus Pedidos", dentro da sua conta.',
        ],
      },
      {
        heading: "Quais formas de pagamento vocês aceitam?",
        paragraphs: [
          "Trabalhamos com Pix, boleto e cartão de crédito/débito, processados com segurança pelo Mercado Pago.",
        ],
      },
      {
        heading: "Não encontrou o que precisava?",
        paragraphs: [
          `Fale direto com a gente pelo WhatsApp (${CONTACT_WHATSAPP}) ou e-mail (${CONTACT_EMAIL}) — respondemos o mais rápido possível.`,
        ],
      },
    ],
  },
  "entrega-e-prazos": {
    title: "Entrega e Prazos",
    sections: [
      {
        heading: "Prazo de processamento",
        paragraphs: [
          "Depois da confirmação do pagamento, seu pedido é separado e embalado com cuidado antes de seguir para envio.",
        ],
      },
      {
        heading: "Prazo de entrega",
        paragraphs: [
          "O prazo de entrega varia de acordo com o seu endereço e a transportadora responsável pela sua região, e é informado no fechamento da compra.",
        ],
      },
      {
        heading: "Produtos sob encomenda",
        paragraphs: [
          "Alguns itens ficam temporariamente sob encomenda: nesse caso o prazo mínimo de espera aparece direto no produto, antes de você finalizar a compra.",
        ],
      },
      {
        heading: "Dúvidas sobre um pedido específico",
        paragraphs: [
          `Para consultar o andamento da entrega do seu pedido, fale com a gente pelo WhatsApp (${CONTACT_WHATSAPP}) informando o número do pedido.`,
        ],
      },
    ],
  },
  "politica-de-privacidade": {
    title: "Política de Privacidade",
    intro:
      "Sua privacidade importa para a gente. Esta página explica quais dados coletamos e como usamos essas informações, em linha com a Lei Geral de Proteção de Dados (LGPD).",
    sections: [
      {
        heading: "Quais dados coletamos",
        paragraphs: [
          "Coletamos dados como nome, CPF, e-mail, telefone e endereço quando você cria uma conta ou finaliza uma compra, além do histórico de pedidos realizados na loja.",
        ],
      },
      {
        heading: "Como usamos seus dados",
        paragraphs: [
          "Usamos essas informações para processar pedidos, entrar em contato sobre o andamento da sua compra e, quando autorizado, enviar novidades e promoções.",
          "Os dados de pagamento são processados diretamente pelo Mercado Pago; a POIT&POIT não armazena números de cartão.",
        ],
      },
      {
        heading: "Compartilhamento",
        paragraphs: [
          "Compartilhamos dados apenas com parceiros necessários para a operação da loja, como o processador de pagamento e transportadoras, e nunca vendemos suas informações a terceiros.",
        ],
      },
      {
        heading: "Seus direitos",
        paragraphs: [
          `Você pode solicitar a qualquer momento a atualização ou exclusão dos seus dados, entrando em contato pelo e-mail ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  "termos-de-uso": {
    title: "Termos de Uso",
    intro:
      "Ao usar o site e realizar compras na POIT&POIT, você concorda com os termos abaixo.",
    sections: [
      {
        heading: "Sobre os produtos",
        paragraphs: [
          "Fazemos o possível para que fotos, descrições e preços estejam sempre corretos, mas pequenas variações de cor ou textura podem ocorrer entre a imagem e o produto físico.",
        ],
      },
      {
        heading: "Pedidos e pagamento",
        paragraphs: [
          "Um pedido é considerado confirmado somente após a aprovação do pagamento pelo Mercado Pago. Em caso de indisponibilidade de estoque após a compra, entraremos em contato para resolver da melhor forma.",
        ],
      },
      {
        heading: "Propriedade intelectual",
        paragraphs: [
          "Marcas, logotipos e conteúdo deste site pertencem à POIT&POIT, sendo proibida a reprodução sem autorização.",
        ],
      },
      {
        heading: "Dúvidas",
        paragraphs: [
          `Qualquer dúvida sobre estes termos pode ser esclarecida pelo e-mail ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
};

const InfoPage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const content = INFO_PAGES[slug];

  return (
    <div className="info-page max-w-3xl mx-auto px-4 py-8 md:py-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="info-page-back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 18l-6-6 6-6"
          />
        </svg>
        Voltar
      </button>

      {content ? (
        <>
          <h1 className="info-page-title">{content.title}</h1>
          {content.intro && <p className="info-page-intro">{content.intro}</p>}
          {content.sections.map((section, index) => (
            <section key={index} className="info-page-section">
              {section.heading && <h2>{section.heading}</h2>}
              {section.paragraphs.map((paragraph, pIndex) => (
                <p key={pIndex}>{paragraph}</p>
              ))}
            </section>
          ))}
        </>
      ) : (
        <>
          <h1 className="info-page-title">Página não encontrada</h1>
          <p className="info-page-intro">
            Essa página não existe ou foi movida.
          </p>
        </>
      )}
    </div>
  );
};

export default InfoPage;
