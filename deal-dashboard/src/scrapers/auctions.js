const axios = require('axios');
const cheerio = require('cheerio');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function searchCopart(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const { data } = await axios.post('https://api.copart.com/public/lots/search', {
      query:{ query:watchlist.keywords[0], bool:{} }, size:25, from:0,
      sort:[{_score:'desc'}], aggs:{},
      post_filter:{ bool:{ must:[{ match:{ lotDescription:watchlist.keywords[0] } }] } }
    }, { headers:{ 'Content-Type':'application/json','User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }, timeout:12000 });

    for (const lot of (data?.data?.results?.content||[])) {
      const price = lot.currentBid||lot.buyNowPrice||0;
      if (watchlist.maxPrice && price > watchlist.maxPrice) continue;
      const year = parseInt(lot.year)||null;
      if (watchlist.minYear && year && year < watchlist.minYear) continue;
      if (watchlist.maxYear && year && year > watchlist.maxYear) continue;
      results.push({
        id:`copart-${lot.lotNumberStr||lot.lotNumber}`, source:'Copart Auction',
        watchlistId:watchlist.id, watchlistName:watchlist.name,
        title:`${lot.year||''} ${lot.make||''} ${lot.model||''} ${lot.series||''}`.trim(),
        price, url:`https://www.copart.com/lot/${lot.lotNumberStr||lot.lotNumber}`,
        location:`${lot.yard?.city||''}, ${lot.yard?.stateCode||''}`.trim().replace(/^,\s*/,''),
        year, mileage:lot.odometerReadingReceived?`${lot.odometerReadingReceived.toLocaleString()} mi`:'',
        postedAt:new Date().toISOString(), isAuction:true, auctionEnd:lot.saleDate||null
      });
    }
    await delay(1500);
  } catch(e) { console.error('[Copart]', e.message); }
  return results;
}

async function searchIAAI(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const { data } = await axios.get(`https://www.iaai.com/Search?SearchTerm=${kw}&IncludeSalvage=true&SortBy=SaleDate&SortOrder=ASC`, {
      headers:{ 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, timeout:15000
    });
    const $ = cheerio.load(data);
    $('.vehicle-card, [data-testid="vehicle-card"]').each((_,el) => {
      const $el=$(el);
      const title=$el.find('h2,[data-testid="vehicle-title"]').first().text().trim();
      const price=parseInt(($el.find('.bid-price,.current-bid').text().trim()).replace(/[^0-9]/g,''))||0;
      const href=$el.find('a').first().attr('href');
      const id=href?.match(/\/(\d+)/)?.[1];
      if (!id||!title) return;
      results.push({
        id:`iaai-${id}`, source:'IAAI Auction', watchlistId:watchlist.id, watchlistName:watchlist.name,
        title, price, url:href?.startsWith('http')?href:`https://www.iaai.com${href}`,
        location:$el.find('.location,.branch-name').text().trim(),
        mileage:$el.find('.odometer,.mileage').text().trim(),
        postedAt:new Date().toISOString(), isAuction:true,
        auctionEnd:$el.find('.sale-date').text().trim()||null
      });
    });
    await delay(2000);
  } catch(e) { console.error('[IAAI]', e.message); }
  return results;
}

async function searchGovPlanet(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const { data } = await axios.get(`https://www.govplanet.com/for-sale/search?q=${kw}&sold=0`, {
      headers:{ 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, timeout:12000
    });
    const $ = cheerio.load(data);
    $('.item-card,.lot-card').each((_,el) => {
      const $el=$(el);
      const title=$el.find('h3,h4,.title').first().text().trim();
      const price=parseInt(($el.find('.price,.current-price').first().text().trim()).replace(/[^0-9]/g,''))||0;
      const href=$el.find('a').first().attr('href');
      const id=href?.match(/item\/(\d+)/)?.[1]||href?.split('/').filter(Boolean).pop();
      if (!id||!title) return;
      results.push({
        id:`govplanet-${id}`, source:'GovPlanet', watchlistId:watchlist.id, watchlistName:watchlist.name,
        title, price, url:href?.startsWith('http')?href:`https://www.govplanet.com${href}`,
        location:$el.find('.location,.item-location').text().trim(),
        postedAt:new Date().toISOString(), isAuction:true,
        auctionEnd:$el.find('.ends,.auction-end').text().trim()||null
      });
    });
    await delay(1500);
  } catch(e) { console.error('[GovPlanet]', e.message); }
  return results;
}

async function searchPublicSurplus(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const kw = encodeURIComponent(watchlist.keywords[0]);
    const { data } = await axios.get(`https://www.publicsurplus.com/sms/browse/home?catid=0&search=${kw}`, {
      headers:{ 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, timeout:12000
    });
    const $ = cheerio.load(data);
    $('table.auctiontbl tbody tr').each((_,el) => {
      const $el=$(el);
      const title=$el.find('td:nth-child(2) a').first().text().trim();
      const href=$el.find('td:nth-child(2) a').attr('href');
      const price=parseInt(($el.find('td:nth-child(4)').text().trim()).replace(/[^0-9]/g,''))||0;
      const id=href?.match(/auc=(\d+)/)?.[1];
      if (!id||!title) return;
      results.push({
        id:`pubsurplus-${id}`, source:'PublicSurplus', watchlistId:watchlist.id, watchlistName:watchlist.name,
        title, price, url:href?.startsWith('http')?href:`https://www.publicsurplus.com${href}`,
        location:$el.find('td:nth-child(3)').text().trim(),
        postedAt:new Date().toISOString(), isAuction:true,
        auctionEnd:$el.find('td:nth-child(5)').text().trim()||null
      });
    });
    await delay(1500);
  } catch(e) { console.error('[PublicSurplus]', e.message); }
  return results;
}

module.exports = { searchCopart, searchIAAI, searchGovPlanet, searchPublicSurplus };
