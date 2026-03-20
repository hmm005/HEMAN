const axios = require('axios');
const cheerio = require('cheerio');
const { extractYear, extractMileage, extractPrice } = require('../alerts/matcher');

async function scrape(watchlist) {
  if (watchlist.type !== 'vehicle') return [];

  const listings = [];
  const keywords = watchlist.keywords.join('+');

  try {
    const url = `https://www.autotrader.com/cars-for-sale/all-cars?` +
      `searchRadius=500&zip=35209&keyword=${encodeURIComponent(keywords)}` +
      `&startYear=${watchlist.minYear || ''}&endYear=${watchlist.maxYear || ''}` +
      `&minPrice=${watchlist.minPrice || ''}&maxPrice=${watchlist.maxPrice || ''}` +
      `&sortBy=derivedpriceDESC&numRecords=25`;

    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const $ = cheerio.load(data);

    $('[data-cmp="inventoryListing"], .inventory-listing').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2, .text-bold').first().text().trim();
      const priceText = $el.find('[data-cmp="firstPrice"], .first-price').text().trim();
      const mileageText = $el.find('.item-card-specifications, .text-subdued').text().trim();
      const link = $el.find('a').attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.autotrader.com${link}`;

      listings.push({
        id: `at-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'AutoTrader',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: '500mi from Birmingham',
        year: extractYear(title),
        mileage: extractMileage(mileageText),
        isAuction: false,
      });
    });

    console.log(`  [AutoTrader] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [AutoTrader] Error: ${err.message}`);
  }

  return listings;
}

module.exports = { scrape };
