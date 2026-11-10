export function companyInvitationMail({ name, lang = 'pt', base, token }) {
  const english = lang === 'en';
  return {
    lang: english ? 'en' : 'pt',
    subject: english ? `${name}, review your Brazilian Pharma & Health portfolio profile` : `${name}, revise seu perfil no Portfólio Brazilian Pharma & Health`,
    title: english ? 'Your company in the portfolio' : 'Sua empresa no portfólio',
    intro: english
      ? `Hello, ${name}!\n\nWe are pleased to introduce the new online Abiquifi Investment Portfolio platform, developed within the Brazilian Pharma & Health project, in partnership with ApexBrasil.\n\nThe platform was created to make the portfolio more dynamic and accessible. Company information is now available in real time to investors and partners, with simple updates and no need to exchange spreadsheets and documents by email.\n\nWhat your company will have on the platform:\n\n• Public profile management: create, review and update the company information presented to international investors and partners.\n\n• Exclusive private area: a closed, secure space for submitting the data and indicators requested under the agreement with ApexBrasil, visible only to your company and the project team.\n\nConfirm your company details using the button below.`
      : `Olá, ${name}!\n\nTemos a satisfação de apresentar a nova plataforma online do Portfólio de Investimentos Abiquifi, desenvolvida no âmbito do projeto Brazilian Pharma & Health, em parceria com a ApexBrasil.\n\nA plataforma foi criada para tornar o portfólio mais dinâmico e acessível. As informações das empresas passam a estar disponíveis em tempo real para investidores e parceiros, com atualização simples e sem a necessidade de troca de planilhas e documentos por e-mail.\n\nO que sua empresa passa a ter na plataforma:\n\n• Gestão do perfil público: criar, revisar e atualizar as informações institucionais que serão apresentadas a investidores e parceiros internacionais.\n\n• Área restrita exclusiva: espaço fechado e seguro para o envio dos dados e indicadores solicitados no âmbito do convênio com a ApexBrasil, visível apenas para a empresa e para a equipe do projeto.\n\nConfirme os dados da sua empresa pelo botão abaixo.`,
    button: english ? 'Confirm my company details' : 'Confirmar dados da minha empresa',
    url: `${base.replace(/\/$/, '')}/${english ? 'company' : 'empresa'}?invite=${encodeURIComponent(token)}`,
    note: english
      ? 'This invitation is personal, can only be used once and is valid for 7 days.\n\nIf you need help or have any questions, simply reply to this email. Our team is here to help.\n\nKind regards,\nAbiquifi | Brazilian Pharma & Health team\ninvestment@abiquifi.org.br'
      : 'Este convite é individual, pode ser utilizado uma única vez e é válido por 7 dias.\n\nSe precisar de ajuda ou tiver alguma dúvida, basta responder a este e-mail. Nossa equipe está à disposição.\n\nAtenciosamente,\nEquipe Abiquifi | Brazilian Pharma & Health\ninvestment@abiquifi.org.br',
    replyTo: 'investment@abiquifi.org.br',
  };
}
