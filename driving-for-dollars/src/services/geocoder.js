const axios = require('axios');

// Nominatim (OpenStreetMap) - completely free reverse geocoding
// Rate limit: 1 request per second (respect their usage policy)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

let lastRequestTime = 0;

async function rateLimitWait() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(r => setTimeout(r, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
}

async function reverseGeocode(lat, lng) {
  await rateLimitWait();

  try {
    const { data } = await axios.get(`${NOMINATIM_URL}/reverse`, {
      params: {
        format: 'jsonv2',
        lat,
        lon: lng,
        addressdetails: 1,
        zoom: 18
      },
      headers: {
        'User-Agent': 'DrivingForDollars/1.0 (Elevate Home Solutions)'
      },
      timeout: 10000
    });

    if (!data || !data.address) return null;

    const addr = data.address;
    const houseNumber = addr.house_number || '';
    const road = addr.road || '';
    const fullAddress = houseNumber && road ? `${houseNumber} ${road}` : data.display_name?.split(',')[0] || '';

    return {
      address: fullAddress,
      city: addr.city || addr.town || addr.village || addr.hamlet || '',
      state: addr.state || '',
      zip: addr.postcode || '',
      county: addr.county || '',
      fullDisplay: data.display_name || '',
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon)
    };
  } catch (err) {
    console.error(`[Geocoder] Reverse geocode failed: ${err.message}`);
    return null;
  }
}

async function forwardGeocode(address) {
  await rateLimitWait();

  try {
    const { data } = await axios.get(`${NOMINATIM_URL}/search`, {
      params: {
        format: 'jsonv2',
        q: address,
        addressdetails: 1,
        limit: 1,
        countrycodes: 'us'
      },
      headers: {
        'User-Agent': 'DrivingForDollars/1.0 (Elevate Home Solutions)'
      },
      timeout: 10000
    });

    if (!data || data.length === 0) return null;

    const result = data[0];
    const addr = result.address;

    return {
      address: `${addr.house_number || ''} ${addr.road || ''}`.trim(),
      city: addr.city || addr.town || addr.village || '',
      state: addr.state || '',
      zip: addr.postcode || '',
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon)
    };
  } catch (err) {
    console.error(`[Geocoder] Forward geocode failed: ${err.message}`);
    return null;
  }
}

module.exports = { reverseGeocode, forwardGeocode };
