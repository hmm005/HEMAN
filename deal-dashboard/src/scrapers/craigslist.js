const axios = require('axios');
const cheerio = require('cheerio');

const CITIES = {
  birmingham:'https://birmingham.craigslist.org', huntsville:'https://huntsville.craigslist.org',
  atlanta:'https://atlanta.craigslist.org', nashville:'https://nashville.craigslist.org',
  memphis:'https://memphis.craigslist.org', chattanooga:'https://chattanooga.craigslist.org',
  knoxville:'https://knoxville.craigslist.org', montgomery:'https://montgomery.craigslist.org',
  jackson_ms:'https://jackson.craigslist.org', gadsden:'https://gadsden.craigslist.org',
  anniston:'https://anniston.craigslist.org', tuscaloosa:'https://tuscaloosa.craigslist.org',
  columbus_ga:'https://columbus.craigslist.org', dothan:'https://dothan.craigslist.org',
  florence_al:'https://shoals.craigslist.org'
};

const delay = ms => new Promise(r => setTimeout(r, ms));

async function searchCraigslist(watchlist) {
  const results = [];
  const cities = watchlist.craigslistCities || ['birmingham'];
  const isVehicle = watchlist.type === 'vehicle';
  const categories = isVehicle ? ['cto','ctd'] : ['bfs'];

  for (const city of cities) {
    const base = CITIES[city]; if (!base) continue;
    for (const cat of categories) {
      try {
        const q = encodeURIComponent(watchlist.keywords[0]);
        let url = `${base}/search/${cat}?query=${q}&sort=date`;
        if (watchlist.maxPrice) url += `&max_price=${watchlist.maxPrice}`;
        if (watchlist.minPrice) url += `&min_price=${watchlist.minPrice}`;
        if (isVehicle && watchlist.minYear) url += `&min_auto_year=${watchlist.minYear}`;
        if (isVehicle && watchlist.maxYear) url += `&max_auto_year=${watchlist.maxYear}`;

        const { data } = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          timeout: 12000
        });
        const $ = cheerio.load(data);
        $('li.cl-static-search-result, div.result-info').each((_, el) => {
          const $el = $(el);
          const title = $el.find('.title, a.result-title').text().trim();
          const price = parseInt(($el.find('.price').text().trim()).replace(/[^0-9]/g,'')) || 0;
          const href = $el.find('a').first().attr('href');
          const pid = href?.match(/\/(\d+)\.html/)?.[1];
          if (!pid || !title) return;
          results.push({
            id: `cl-${pid}`, source: 'Craigslist', watchlistId: watchlist.id, watchlistName: watchlist.name,
            title, price, url: href?.startsWith('http') ? href : `${base}${href}`,
            location: `${city.replace('_',' ')} CL`, postedAt: new Date().toISOString(), isAuction: false
          });
        });
        await delay(1200 + Math.random()*800);
      } catch(e) { console.error(`[CL] ${city}/${cat}:`, e.message); }
    }
  }
  return results;
}

module.exports = { searchCraigslist };
