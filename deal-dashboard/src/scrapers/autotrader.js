const axios = require('axios');
const cheerio = require('cheerio');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function searchAutoTrader(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const url = new URL('https://www.autotrader.com/cars-for-sale/all-cars');
    url.searchParams.set('searchRadius','500'); url.searchParams.set('zip','35004');
    url.searchParams.set('query',watchlist.keywords[0]);
    if (watchlist.maxPrice) url.searchParams.set('maxPrice',watchlist.maxPrice);
    if (watchlist.minPrice) url.searchParams.set('minPrice',watchlist.minPrice);
    if (watchlist.minYear) url.searchParams.set('startYear',watchlist.minYear);
    if (watchlist.maxYear) url.searchParams.set('endYear',watchlist.maxYear);
    url.searchParams.set('sortBy','relevance'); url.searchParams.set('numRecords','25');

    const { data } = await axios.get(url.toString(), {
      headers: { 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Referer':'https://www.autotrader.com/' },
      timeout: 15000
    });
    const $ = cheerio.load(data);
    $('[data-cmp="listingCard"], .inventory-listing').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2, [data-cmp="heading"]').first().text().trim();
      const price = parseInt(($el.find('[data-cmp="firstPrice"], .price-section').first().text().trim()).replace(/[^0-9]/g,''))||0;
      const href = $el.find('a').first().attr('href');
      const listingId = href?.match(/\/(?:cars-for-sale|car-details)\/[^/]+\/(\d+)/)?.[1]||href?.split('/').filter(Boolean).pop();
      if (!listingId || !title) return;
      results.push({
        id:`autotrader-${listingId}`, source:'AutoTrader', watchlistId:watchlist.id, watchlistName:watchlist.name,
        title, price, url:href?.startsWith('http')?href:`https://www.autotrader.com${href}`,
        location:$el.find('[data-cmp="distance"]').text().trim(),
        mileage:$el.find('[data-cmp="mileage"]').text().trim(),
        postedAt:new Date().toISOString(), isAuction:false
      });
    });
    await delay(2000);
  } catch(e) { console.error('[AutoTrader]', e.message); }
  return results;
}

module.exports = { searchAutoTrader };
