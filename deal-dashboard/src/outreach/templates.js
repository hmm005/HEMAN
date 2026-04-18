function getEmailTemplate(step, lead) {
  const name = lead.first_name || 'there';
  const address = lead.property_address || 'your property';
  const city = lead.city || 'the area';

  const templates = [
    {
      subject: `Your property at ${address} — quick question`,
      text: [
        `Hi ${name},`,
        '',
        `My name is Heman McCray. I'm a local homebuyer looking for a triplex or quadplex to make my primary residence in the ${city} area.`,
        '',
        `I came across your property at ${address} and wanted to reach out directly to see if you'd ever consider selling. I can work on your timeline, no agents required.`,
        '',
        `Would you be open to a quick conversation?`,
        '',
        'Thanks,',
        'Heman McCray',
        'Elevate Home Solutions',
      ].join('\n'),
    },
    {
      subject: `Following up — ${address}`,
      text: [
        `Hi ${name},`,
        '',
        `Just wanted to follow up on my earlier note about ${address}. Still very interested if you'd consider selling. No rush — just let me know.`,
        '',
        'Thanks,',
        'Heman McCray',
        'Elevate Home Solutions',
      ].join('\n'),
    },
    {
      subject: `Last note from Heman — ${address}`,
      text: [
        `Hi ${name},`,
        '',
        `I'll keep this brief — I'm still looking for a triplex or quadplex in ${city} and your property at ${address} is exactly what I have in mind. If you ever want to talk, I'm easy to reach.`,
        '',
        `Thanks for your time.`,
        '',
        'Heman McCray',
        'Elevate Home Solutions',
      ].join('\n'),
    },
  ];

  return templates[step] || null;
}

module.exports = { getEmailTemplate };
