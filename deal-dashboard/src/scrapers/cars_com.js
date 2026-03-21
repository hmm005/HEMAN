const axios = require('axios');
const cheerio = require('cheerio');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function searchCarsDotCom(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const url = `https://www.cars.com/shopping/results/?keyword=${kw}&stock_type=all&list_price_max=${watchlist.maxPrice||''}&list_price_min=${watchlist.minPrice||''}&year_min=${watchlist.minYear||''}&year_max=${watchlist.maxYear||''}&zip=35004&maximum_distance=500&sort=best_match_desc&per_page=20`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      timeout: 15000
    });
    const $ = cheerio.load(data);
    $('cars-listing-card, [data-qa="listing"], .vehicle-card').each((_,el) => {
      const $el = $(el);
      const title = $el.find('[data-qa="car-name"], h2').first().text().trim();
      const price = parseInt(($el.find('[data-qa="price"]').first().text().trim()).replace(/[^0-9]/g,''))||0;
      const href = $el.find('a').first().attr('href');
      const id = href?.match(/\/(\d+)\//)?.[1]||href?.split('/').filter(Boolean).pop();
      if (!id||!title) return;
      results.push({
        id:`carsdotcom-${id}`, source:'Cars.com', watchlistId:watchlist.id, watchlistName:watchlist.name,
        title, price, url:href?.startsWith('http')?href:`https://www.cars.com${href}`,
        location:$el.find('[data-qa="dealer-name"]').text().trim(),
        mileage:$el.find('[data-qa="mileage"]').text().trim(),
        postedAt:new Date().toISOString(), isAuction:false
      });
    });
    await delay(2000);
  } catch(e) { console.error('[Cars.com]', e.message); }
  return results;
}

module.exports = { searchCarsDotCom };
