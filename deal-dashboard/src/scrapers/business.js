const axios = require('axios');
const cheerio = require('cheerio');
const { extractPrice } = require('../alerts/matcher');

async function scrapeBizBuySell(watchlist) {
  if (watchlist.type !== 'business') return [];
  const listings = [];
  const keywords = watchlist.keywords.join('+');

  try {
    const url = `https://www.bizbuysell.com/businesses-for-sale/?q=${encodeURIComponent(keywords)}&loc=Alabama`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('.listing, .bfs-listing').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h3, .listing-title, .title').text().trim();
      const priceText = $el.find('.price, .asking-price').text().trim();
      const link = $el.find('a').attr('href') || '';
      const loc = $el.find('.location, .listing-location').text().trim();

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.bizbuysell.com${link}`;
      listings.push({
        id: `bbs-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'BizBuySell',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: loc || 'BizBuySell',
        year: null,
        mileage: null,
        isAuction: false,
      });
    });
    console.log(`  [BizBuySell] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [BizBuySell] Error: ${err.message}`);
  }

  return listings;
}

async function scrapeBizQuest(watchlist) {
  if (watchlist.type !== 'business') return [];
  const listings = [];
  const keywords = watchlist.keywords.join('+');

  try {
    const url = `https://www.bizquest.com/businesses-for-sale/?q=${encodeURIComponent(keywords)}`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('.listing-card, .biz-listing').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h3, .listing-title').text().trim();
      const priceText = $el.find('.price, .asking-price').text().trim();
      const link = $el.find('a').attr('href') || '';
      const loc = $el.find('.location').text().trim();

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.bizquest.com${link}`;
      listings.push({
        id: `bq-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'BizQuest',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: loc || 'BizQuest',
        year: null,
        mileage: null,
        isAuction: false,
      });
    });
    console.log(`  [BizQuest] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [BizQuest] Error: ${err.message}`);
  }

  return listings;
}

async function scrape(watchlist) {
  const results = await Promise.allSettled([
    scrapeBizBuySell(watchlist),
    scrapeBizQuest(watchlist),
  ]);

  const listings = [];
  for (const r of results) {
    if (r.status === 'fulfilled') listings.push(...r.value);
  }
  return listings;
}

module.exports = { scrape };
