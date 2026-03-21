const axios = require('axios');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function searchEbay(watchlist) {
  const results = [];
  const appId = process.env.EBAY_APP_ID;
  if (!appId || appId.includes('YourApp')) { console.log('[eBay] No API key. Get free one at developer.ebay.com'); return results; }

  const params = new URLSearchParams({
    'OPERATION-NAME':'findItemsByKeywords','SERVICE-VERSION':'1.0.0',
    'SECURITY-APPNAME':appId,'RESPONSE-DATA-FORMAT':'JSON',
    'keywords':watchlist.keywords.slice(0,3).join(' '),'categoryId':'6001',
    'sortOrder':'StartTimeNewest','paginationInput.entriesPerPage':'25',
  });
  if (watchlist.maxPrice) { params.append('itemFilter(0).name','MaxPrice'); params.append('itemFilter(0).value',watchlist.maxPrice); params.append('itemFilter(0).paramName','Currency'); params.append('itemFilter(0).paramValue','USD'); }
  if (watchlist.minPrice) { params.append('itemFilter(1).name','MinPrice'); params.append('itemFilter(1).value',watchlist.minPrice); params.append('itemFilter(1).paramName','Currency'); params.append('itemFilter(1).paramValue','USD'); }

  try {
    const { data } = await axios.get(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`, { timeout: 10000 });
    const items = data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];
    for (const item of items) {
      const price = parseFloat(item?.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__']||0);
      const itemId = item?.itemId?.[0]; if (!itemId) continue;
      const isAuction = item?.listingInfo?.[0]?.listingType?.[0]==='Auction';
      results.push({
        id:`ebay-${itemId}`, source:'eBay Motors', watchlistId:watchlist.id, watchlistName:watchlist.name,
        title:item?.title?.[0]||'', price, url:item?.viewItemURL?.[0]||`https://www.ebay.com/itm/${itemId}`,
        location:item?.location?.[0]||'', imageUrl:item?.galleryURL?.[0]||'',
        postedAt:item?.listingInfo?.[0]?.startTime?.[0]||new Date().toISOString(),
        isAuction, auctionEnd:isAuction?item?.listingInfo?.[0]?.endTime?.[0]:null
      });
    }
    await delay(500);
  } catch(e) { console.error('[eBay]', e.message); }
  return results;
}

module.exports = { searchEbay };
