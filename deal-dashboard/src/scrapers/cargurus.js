const axios = require('axios');
const cheerio = require('cheerio');
const { extractYear, extractMileage, extractPrice } = require('../alerts/matcher');

async function scrape(watchlist) {
  if (watchlist.type !== 'vehicle') return [];

  const listings = [];
  const keywords = watchlist.keywords.join(' ');

  try {
    const url = `https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?` +
      `zip=35209&showNegotiable=true&sortDir=ASC&sourceContext=carGurusHomePageModel` +
      `&distance=500&sortType=DEAL_SCORE` +
      `&entitySelectingHelper.selectedEntity=${encodeURIComponent(keywords)}`;

    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(data);

    $('[data-cg-ft="car-blade"], .listing-row').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h4, .listing-row__title').text().trim();
      const priceText = $el.find('.listing-price, .cg-dealFinder-priceAndMoPayment').text().trim();
      const mileageText = $el.find('.listing-row__mileage, .cg-listing-mileage').text().trim();
      const link = $el.find('a').attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.cargurus.com${link}`;

      listings.push({
        id: `cg-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'CarGurus',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: 'CarGurus · 500mi',
        year: extractYear(title),
        mileage: extractMileage(mileageText),
        isAuction: false,
      });
    });

    console.log(`  [CarGurus] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [CarGurus] Error: ${err.message}`);
  }

  return listings;
}

module.exports = { scrape };
