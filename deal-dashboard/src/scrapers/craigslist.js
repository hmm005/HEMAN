const axios = require('axios');
const cheerio = require('cheerio');
const { extractYear, extractMileage, extractPrice } = require('../alerts/matcher');

const BASE_URL = (city) => `https://${city}.craigslist.org`;

function buildSearchUrl(city, watchlist) {
  const section = watchlist.type === 'business' ? 'bfs' : 'cta';
  const keywords = watchlist.keywords.join(' | ');
  const params = new URLSearchParams({
    query: keywords,
    sort: 'date',
    bundleDuplicates: '1',
  });

  if (watchlist.minPrice) params.set('min_price', watchlist.minPrice);
  if (watchlist.maxPrice) params.set('max_price', watchlist.maxPrice);
  if (watchlist.minYear) params.set('auto_make_model', '');
  if (watchlist.minYear) params.set('min_auto_year', watchlist.minYear);
  if (watchlist.maxYear) params.set('max_auto_year', watchlist.maxYear);

  return `${BASE_URL(city)}/search/${section}?${params.toString()}`;
}

async function scrapeCity(city, watchlist) {
  const url = buildSearchUrl(city, watchlist);
  const listings = [];

  try {
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(data);

    $('li.cl-static-search-result, .result-row').each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find('.titlestring, a.posting-title, .result-title');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href') || $el.find('a').attr('href') || '';
      const priceText = $el.find('.priceinfo, .result-price').text().trim();
      const location = $el.find('.meta .location, .result-hood').text().trim() || city;

      if (!title) return;

      const fullUrl = href.startsWith('http') ? href : `${BASE_URL(city)}${href}`;
      const price = extractPrice(priceText) || extractPrice(title);
      const year = extractYear(title);
      const mileage = extractMileage(title);

      listings.push({
        id: `cl-${city}-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: `Craigslist`,
        title,
        price,
        url: fullUrl,
        location: `${city} CL` + (location ? ` · ${location}` : ''),
        year,
        mileage,
        isAuction: false,
      });
    });

    console.log(`  [CL/${city}] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [CL/${city}] Error: ${err.message}`);
  }

  return listings;
}

async function scrape(watchlist) {
  const cities = watchlist.craigslistCities || ['birmingham'];
  const results = [];

  // Process cities in batches of 3 to avoid rate limiting
  for (let i = 0; i < cities.length; i += 3) {
    const batch = cities.slice(i, i + 3);
    const batchResults = await Promise.allSettled(
      batch.map((city) => scrapeCity(city, watchlist))
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }

    if (i + 3 < cities.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return results;
}

module.exports = { scrape };
