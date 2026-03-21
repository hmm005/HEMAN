const axios = require('axios');
const cheerio = require('cheerio');
const delay = ms => new Promise(r => setTimeout(r, ms));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseCard($el, idPrefix, baseUrl, watchlist) {
  const title = $el.find('h2,h3,[class*="title"]').first().text().trim();
  const price = parseInt(($el.find('[class*="price"]').first().text().trim()).replace(/[^0-9]/g,''))||0;
  const href = $el.find('a').first().attr('href');
  const id = href?.split('/').filter(Boolean).pop()?.split('?')[0];
  if (!id || !title) return null;
  return {
    id:`${idPrefix}-${id}`, source:idPrefix, watchlistId:watchlist.id, watchlistName:watchlist.name,
    title, price, url:href?.startsWith('http')?href:`${baseUrl}${href}`,
    location:$el.find('[class*="location"],[class*="dealer"]').text().trim(),
    mileage:$el.find('[class*="mileage"],[class*="miles"]').text().trim(),
    postedAt:new Date().toISOString(), isAuction:false
  };
}

async function searchCarsForSale(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const url = `https://www.carsforsale.com/search?keywords=${kw}&yearmin=${watchlist.minYear||''}&yearmax=${watchlist.maxYear||''}&pricemin=${watchlist.minPrice||''}&pricemax=${watchlist.maxPrice||''}&zip=35004&distance=500`;
    const { data } = await axios.get(url, { headers:{ 'User-Agent':UA }, timeout:15000 });
    const $ = cheerio.load(data);
    $('[class*="vehicle-card"],[class*="listing-card"]').each((_,el) => {
      const card = parseCard($(el), 'CarsForSale', 'https://www.carsforsale.com', watchlist);
      if (card) results.push(card);
    });
    await delay(2000);
  } catch(e) { console.error('[CarsForSale]', e.message); }
  return results;
}

async function searchHemmings(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const url = `https://www.hemmings.com/classifieds/search/?keyword=${kw}&price_max=${watchlist.maxPrice||''}&year_min=${watchlist.minYear||''}&year_max=${watchlist.maxYear||''}`;
    const { data } = await axios.get(url, { headers:{ 'User-Agent':UA }, timeout:12000 });
    const $ = cheerio.load(data);
    $('[class*="ClassifiedCard"],article').each((_,el) => {
      const $el=$(el);
      const title=$el.find('h2,h3').first().text().trim();
      const price=parseInt(($el.find('[class*="price"]').first().text().trim()).replace(/[^0-9]/g,''))||0;
      const href=$el.find('a').first().attr('href');
      const id=href?.match(/\/(\d+)\/?$/)?.[1];
      if (!id||!title) return;
      results.push({ id:`hemmings-${id}`, source:'Hemmings', watchlistId:watchlist.id, watchlistName:watchlist.name, title, price, url:href?.startsWith('http')?href:`https://www.hemmings.com${href}`, location:$el.find('[class*="location"]').text().trim(), postedAt:new Date().toISOString(), isAuction:false });
    });
    await delay(1500);
  } catch(e) { console.error('[Hemmings]', e.message); }
  return results;
}

async function searchTruckPaper(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const url = `https://www.truckpaper.com/listings/trucks/for-sale/list?keywords=${kw}&priceMax=${watchlist.maxPrice||''}&yearMin=${watchlist.minYear||''}&yearMax=${watchlist.maxYear||''}`;
    const { data } = await axios.get(url, { headers:{ 'User-Agent':UA }, timeout:12000 });
    const $ = cheerio.load(data);
    $('[class*="listing"],.classified-listing').each((_,el) => {
      const card = parseCard($(el), 'TruckPaper', 'https://www.truckpaper.com', watchlist);
      if (card) results.push(card);
    });
    await delay(1500);
  } catch(e) { console.error('[TruckPaper]', e.message); }
  return results;
}

async function searchCarsDirect(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const url = `https://www.carsdirect.com/cars-for-sale?q=${kw}&zipCode=35004&radius=500&priceMax=${watchlist.maxPrice||''}&yearMin=${watchlist.minYear||''}&yearMax=${watchlist.maxYear||''}`;
    const { data } = await axios.get(url, { headers:{ 'User-Agent':UA }, timeout:12000 });
    const $ = cheerio.load(data);
    $('[class*="vehicle"],[class*="listing"]').each((_,el) => {
      const card = parseCard($(el), 'CarsDirect', 'https://www.carsdirect.com', watchlist);
      if (card) results.push(card);
    });
    await delay(1500);
  } catch(e) { console.error('[CarsDirect]', e.message); }
  return results;
}

module.exports = { searchCarsForSale, searchHemmings, searchTruckPaper, searchCarsDirect };
