const axios = require('axios');
const cheerio = require('cheerio');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function searchCarGurus(watchlist) {
  const results = [];
  if (watchlist.type !== 'vehicle') return results;
  try {
    const url = new URL('https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action');
    url.searchParams.set('zip','35004'); url.searchParams.set('distance','500');
    url.searchParams.set('sortDir','DESC'); url.searchParams.set('sortType','PRICE');
    if (watchlist.maxPrice) url.searchParams.set('maxPrice',watchlist.maxPrice);
    if (watchlist.minPrice) url.searchParams.set('minPrice',watchlist.minPrice);
    if (watchlist.minYear) url.searchParams.set('minYear',watchlist.minYear);
    if (watchlist.maxYear) url.searchParams.set('maxYear',watchlist.maxYear);
    url.searchParams.set('trim',watchlist.keywords[0]);

    const { data } = await axios.get(url.toString(), {
      headers: { 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      timeout: 15000
    });
    const $ = cheerio.load(data);

    // Try JSON-LD structured data first
    $('script[type="application/ld+json"]').each((_,el) => {
      try {
        const items = [].concat(JSON.parse($(el).html()));
        for (const item of items) {
          if (!['Car','Vehicle'].includes(item['@type'])) continue;
          const id = item.url?.split('/').pop()||item.identifier; if (!id) continue;
          results.push({
            id:`cargurus-${id}`, source:'CarGurus', watchlistId:watchlist.id, watchlistName:watchlist.name,
            title:`${item.modelDate||''} ${item.brand?.name||''} ${item.model||''}`.trim(),
            price:parseInt(item.offers?.price||0), url:item.url||'',
            location:item.offers?.availableAtOrFrom?.address?.addressLocality||'',
            mileage:item.mileageFromOdometer?.value?`${item.mileageFromOdometer.value} mi`:'',
            postedAt:new Date().toISOString(), isAuction:false
          });
        }
      } catch(_) {}
    });
    await delay(2000);
  } catch(e) { console.error('[CarGurus]', e.message); }
  return results;
}

module.exports = { searchCarGurus };
