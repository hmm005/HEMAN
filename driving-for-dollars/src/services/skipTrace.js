const axios = require('axios');

// Skip tracing service - generates free lookup links + optional paid API
// Free: TruePeopleSearch, FastPeopleSearch (user clicks through)
// Paid: Tracerfy API ($0.005/call) if API key is configured

function generateFreeLinks(name, address, city, state) {
  const links = [];

  // TruePeopleSearch - completely free, no account needed
  if (name) {
    const nameParam = encodeURIComponent(name);
    const locationParam = city && state ? encodeURIComponent(`${city}, ${state}`) : '';
    links.push({
      source: 'TruePeopleSearch',
      url: `https://www.truepeoplesearch.com/results?name=${nameParam}&citystatezip=${locationParam}`,
      description: 'Free phone, email, and address lookup'
    });
  }

  // FastPeopleSearch
  if (name) {
    const nameParts = name.trim().split(/\s+/);
    const slug = nameParts.join('-').toLowerCase();
    links.push({
      source: 'FastPeopleSearch',
      url: `https://www.fastpeoplesearch.com/name/${slug}`,
      description: 'Free people search with phone numbers'
    });
  }

  // Address-based search on TruePeopleSearch
  if (address) {
    const addrParam = encodeURIComponent(`${address}, ${city || ''} ${state || ''}`);
    links.push({
      source: 'TruePeopleSearch (Address)',
      url: `https://www.truepeoplesearch.com/results?streetaddress=${encodeURIComponent(address)}&citystatezip=${encodeURIComponent(`${city || ''}, ${state || ''}`)}`,
      description: 'Look up who lives at this address'
    });
  }

  // County property records
  if (address && state) {
    links.push({
      source: 'County Records',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${address} ${city} ${state} property owner county assessor`)}`,
      description: 'Search county assessor records'
    });
  }

  return links;
}

async function tracerfyLookup(name, address, city, state, zip) {
  const apiKey = process.env.TRACERFY_API_KEY;
  if (!apiKey) return null;

  try {
    const { data } = await axios.post('https://api.tracerfy.com/v1/skip-trace', {
      first_name: name?.split(' ')[0] || '',
      last_name: name?.split(' ').slice(1).join(' ') || '',
      address: address || '',
      city: city || '',
      state: state || '',
      zip: zip || ''
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    if (!data || !data.results) return null;

    const result = data.results[0];
    return {
      name: result.name || name,
      phones: [result.phone1, result.phone2, result.phone3].filter(Boolean),
      emails: [result.email1, result.email2].filter(Boolean),
      mailing_address: result.mailing_address || null,
      mailing_city: result.mailing_city || null,
      mailing_state: result.mailing_state || null,
      mailing_zip: result.mailing_zip || null,
      source: 'tracerfy'
    };
  } catch (err) {
    console.error(`[SkipTrace] Tracerfy lookup failed: ${err.message}`);
    return null;
  }
}

async function skipTrace({ name, address, city, state, zip }) {
  // Always generate free lookup links
  const freeLinks = generateFreeLinks(name, address, city, state);

  // Try paid API if configured
  let paidResult = null;
  if (process.env.TRACERFY_API_KEY) {
    paidResult = await tracerfyLookup(name, address, city, state, zip);
  }

  return {
    freeLinks,
    paidResult,
    hasPaidApi: !!process.env.TRACERFY_API_KEY
  };
}

module.exports = { skipTrace, generateFreeLinks };
