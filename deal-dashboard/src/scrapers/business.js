const axios = require('axios');
const cheerio = require('cheerio');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function searchBizBuySell(watchlist) {
  const results = [];
  if (watchlist.type !== 'business') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const { data } = await axios.get(`https://www.bizbuysell.com/businesses-for-sale/?q=${kw}&price_to=${watchlist.maxPrice||''}&state=AL`, {
      headers:{ 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml' }, timeout:15000
    });
    const $ = cheerio.load(data);
    $('[class*="listing"],.listing,.result-item').each((_,el) => {
      const $el=$(el);
      const title=$el.find('h3 a,h2 a').first().text().trim();
      const href=$el.find('h3 a,h2 a').first().attr('href');
      const price=parseInt(($el.find('[class*="price"],.asking-price').first().text().trim()).replace(/[^0-9]/g,''))||0;
      const id=href?.match(/\/(\d+)\/?/)?.[1];
      if (!id||!title) return;
      results.push({
        id:`bizbuysell-${id}`, source:'BizBuySell', watchlistId:watchlist.id, watchlistName:watchlist.name,
        title, price, url:href?.startsWith('http')?href:`https://www.bizbuysell.com${href}`,
        location:$el.find('[class*="location"]').text().trim(),
        postedAt:new Date().toISOString(), isAuction:false
      });
    });
    await delay(2000);
  } catch(e) { console.error('[BizBuySell]', e.message); }
  return results;
}

async function searchBizQuest(watchlist) {
  const results = [];
  if (watchlist.type !== 'business') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const { data } = await axios.get(`https://www.bizquest.com/buy-a-business/?SearchTerms=${kw}&MaxPrice=${watchlist.maxPrice||''}&State=AL`, {
      headers:{ 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, timeout:12000
    });
    const $ = cheerio.load(data);
    $('[class*="listing"],.listing-item,article').each((_,el) => {
      const $el=$(el);
      const title=$el.find('h2 a,h3 a').first().text().trim();
      const href=$el.find('h2 a,h3 a').first().attr('href');
      const price=parseInt(($el.find('[class*="price"]').first().text().trim()).replace(/[^0-9]/g,''))||0;
      const id=href?.match(/\/(\d+)\/?/)?.[1];
      if (!id||!title) return;
      results.push({
        id:`bizquest-${id}`, source:'BizQuest', watchlistId:watchlist.id, watchlistName:watchlist.name,
        title, price, url:href?.startsWith('http')?href:`https://www.bizquest.com${href}`,
        location:$el.find('[class*="location"]').text().trim(),
        postedAt:new Date().toISOString(), isAuction:false
      });
    });
    await delay(1500);
  } catch(e) { console.error('[BizQuest]', e.message); }
  return results;
}

module.exports = { searchBizBuySell, searchBizQuest };
