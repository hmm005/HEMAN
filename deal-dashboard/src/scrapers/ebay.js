const axios = require('axios');

async function scrape(watchlist) {
  const appId = process.env.EBAY_APP_ID;
  if (!appId || appId.startsWith('YourApp')) {
    console.log('  [eBay] No API key configured — skipping');
    return [];
  }

  const listings = [];
  const keywords = watchlist.keywords.join(' ');

  try {
    // eBay Browse API / Finding API
    const params = {
      'OPERATION-NAME': 'findItemsAdvanced',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      'keywords': keywords,
      'categoryId': watchlist.type === 'vehicle' ? '6001' : '11450',
      'paginationInput.entriesPerPage': '50',
      'sortOrder': 'StartTimeNewest',
      'itemFilter(0).name': 'MinPrice',
      'itemFilter(0).value': watchlist.minPrice || 0,
      'itemFilter(1).name': 'MaxPrice',
      'itemFilter(1).value': watchlist.maxPrice || 999999,
      'itemFilter(2).name': 'Condition',
      'itemFilter(2).value': '3000', // Used
    };

    const { data } = await axios.get(
      'https://svcs.ebay.com/services/search/FindingService/v1',
      { params, timeout: 15000 }
    );

    const response = data?.findItemsAdvancedResponse?.[0];
    const items = response?.searchResult?.[0]?.item || [];

    for (const item of items) {
      const title = item.title?.[0] || '';
      const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0);
      const url = item.viewItemURL?.[0] || '';
      const location = item.location?.[0] || '';
      const listingType = item.listingInfo?.[0]?.listingType?.[0] || '';
      const endTime = item.listingInfo?.[0]?.endTime?.[0] || '';
      const imageUrl = item.galleryURL?.[0] || '';
      const itemId = item.itemId?.[0] || '';

      const isAuction = listingType === 'Auction' || listingType === 'AuctionWithBIN';

      listings.push({
        id: `ebay-${itemId}`,
        source: isAuction ? 'eBay Auction' : 'eBay Motors',
        title,
        price,
        url,
        location,
        year: null,
        mileage: null,
        isAuction,
        auction_end: isAuction ? new Date(endTime).toLocaleString() : null,
        image_url: imageUrl,
      });
    }

    console.log(`  [eBay] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [eBay] Error: ${err.message}`);
  }

  return listings;
}

module.exports = { scrape };
