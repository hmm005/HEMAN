const axios = require('axios');

// Property data lookup - uses RentCast API (50 free calls/month)
// Falls back to basic info if no API key configured

async function lookupProperty(address, city, state, zip) {
  const apiKey = process.env.RENTCAST_API_KEY;

  if (!apiKey) {
    console.log('[PropertyLookup] No RentCast API key configured — skipping lookup');
    return null;
  }

  try {
    const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');

    const { data } = await axios.get('https://api.rentcast.io/v1/properties', {
      params: { address: fullAddress },
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': apiKey
      },
      timeout: 15000
    });

    if (!data || data.length === 0) return null;

    const prop = data[0];
    return {
      beds: prop.bedrooms || null,
      baths: prop.bathrooms || null,
      sqft: prop.squareFootage || null,
      year_built: prop.yearBuilt || null,
      lot_size: prop.lotSize ? `${prop.lotSize} sqft` : null,
      property_type: prop.propertyType || null,
      assessed_value: prop.assessedValue || null,
      estimated_value: prop.price || prop.estimatedValue || null,
      last_sale_price: prop.lastSalePrice || null,
      last_sale_date: prop.lastSaleDate || null,
      owner_name: prop.ownerName || null,
      owner_address: prop.ownerAddress || null,
      source: 'rentcast'
    };
  } catch (err) {
    console.error(`[PropertyLookup] RentCast lookup failed: ${err.message}`);
    return null;
  }
}

module.exports = { lookupProperty };
