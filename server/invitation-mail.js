export function companyInvitationMail({ name, lang = 'pt', base, token }) {
  const english = lang === 'en';
  return {
    lang: english ? 'en' : 'pt',
    subject: english ? `${name}, review your Brazilian Pharma & Health portfolio profile` : `${name}, revise seu perfil no Portfólio Brazilian Pharma & Health`,
    title: english ? 'Your company in the portfolio' : 'Sua empresa no portfólio',
    intro: english
      ? `Hello, ${name} team!\n\nAbiquifi invites your company to join the Brazilian Pharma & Health Investment Opportunities Portfolio, a program held in partnership with ApexBrasil, with curation by Abiquifi and Bio2Health.\n\nThe platform presents Brazilian health, biotechnology and pharmaceutical companies to investors and partners, increasing their visibility and opportunities to connect.\n\nWe have prepared your company profile using information provided to the program team. We now need your participation to review the information and complete any missing details.\n\nUse the button below to create your access password, review the information, update images and submit the profile for Abiquifi review. The profile will only be published after approval.`
      : `Olá, equipe da ${name}!\n\nA Abiquifi convida sua empresa a participar do Portfólio de Oportunidades de Investimento do Brazilian Pharma & Health, programa realizado em parceria com a ApexBrasil, com curadoria da Abiquifi e da Bio2Health.\n\nA plataforma apresenta empresas brasileiras de saúde, biotecnologia e farma a investidores e parceiros, ampliando sua visibilidade e suas oportunidades de conexão.\n\nPreparamos um perfil da sua empresa com base nas informações disponibilizadas à equipe do programa. Agora, precisamos da sua participação para conferir os dados e completar o que estiver pendente.\n\nPelo botão abaixo, você poderá criar sua senha de acesso, revisar as informações, atualizar imagens e enviar o perfil para análise da Abiquifi. O perfil só será publicado após a aprovação.`,
    button: english ? 'Create access and review my company' : 'Criar acesso e revisar minha empresa',
    url: `${base.replace(/\/$/, '')}/${english ? 'company' : 'empresa'}?invite=${encodeURIComponent(token)}`,
    note: english
      ? 'This invitation is personal, can only be used once and is valid for 7 days.\n\nIf you need help or have any questions, simply reply to this email. Our team is here to help.\n\nKind regards,\nAbiquifi | Brazilian Pharma & Health team\ninvestment@abiquifi.org.br'
      : 'Este convite é individual, pode ser utilizado uma única vez e é válido por 7 dias.\n\nSe precisar de ajuda ou tiver alguma dúvida, basta responder a este e-mail. Nossa equipe está à disposição.\n\nAtenciosamente,\nEquipe Abiquifi | Brazilian Pharma & Health\ninvestment@abiquifi.org.br',
    replyTo: 'investment@abiquifi.org.br',
  };
}
