const axios = require('axios');
const cheerio = require('cheerio');
const { extractYear, extractMileage, extractPrice } = require('../alerts/matcher');

async function scrape(watchlist) {
  if (watchlist.type !== 'vehicle') return [];

  const listings = [];
  const keywords = watchlist.keywords.join(' ');

  try {
    const url = `https://www.cars.com/shopping/results/?` +
      `keyword=${encodeURIComponent(keywords)}` +
      `&list_price_max=${watchlist.maxPrice || ''}` +
      `&list_price_min=${watchlist.minPrice || ''}` +
      `&maximum_distance=500&zip=35209` +
      `&year_max=${watchlist.maxYear || ''}` +
      `&year_min=${watchlist.minYear || ''}` +
      `&sort=newest_listed&stock_type=all`;

    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(data);

    $('.vehicle-card, [data-qa="search-results-item"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.vehicle-card-link, h2').text().trim();
      const priceText = $el.find('.primary-price, [class*="price"]').first().text().trim();
      const mileageText = $el.find('.mileage, [class*="mileage"]').text().trim();
      const link = $el.find('a').attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.cars.com${link}`;

      listings.push({
        id: `cc-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'Cars.com',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: 'Cars.com · 500mi',
        year: extractYear(title),
        mileage: extractMileage(mileageText),
        isAuction: false,
      });
    });

    console.log(`  [Cars.com] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [Cars.com] Error: ${err.message}`);
  }

  return listings;
}

module.exports = { scrape };
