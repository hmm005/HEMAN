const axios = require('axios');
const cheerio = require('cheerio');
const { extractYear, extractMileage, extractPrice } = require('../alerts/matcher');

async function scrapeCopart(watchlist) {
  if (watchlist.type !== 'vehicle') return [];
  const listings = [];
  const keywords = watchlist.keywords.join(' ');

  try {
    const url = `https://www.copart.com/public/lots/search`;
    const { data } = await axios.post(url, {
      query: keywords,
      filter: {
        YEAR: watchlist.minYear && watchlist.maxYear
          ? [`${watchlist.minYear}`, `${watchlist.maxYear}`]
          : undefined,
      },
      sort: ['auction_date_type desc'],
      page: 0,
      size: 25,
    }, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
      },
    });

    const items = data?.data?.results?.content || [];
    for (const item of items) {
      const title = item.lN || item.mkN + ' ' + item.mN || 'Unknown';
      listings.push({
        id: `copart-${item.ln || item.lotNumberStr || Math.random().toString(36).slice(2)}`,
        source: 'Copart Auction',
        title,
        price: item.dynamicLotDetails?.currentBid || item.cB || null,
        url: `https://www.copart.com/lot/${item.ln || item.lotNumberStr}`,
        location: item.yN || item.facilityName || 'Copart',
        year: item.lcy || extractYear(title),
        mileage: item.orr || null,
        isAuction: true,
        auction_end: item.dynamicLotDetails?.saleDate || null,
      });
    }
    console.log(`  [Copart] Found ${listings.length} listings`);
  } catch (err) {
    // Fallback: scrape search page
    try {
      const searchUrl = `https://www.copart.com/lotSearchResults/?free=true&query=${encodeURIComponent(keywords)}`;
      const { data } = await axios.get(searchUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const $ = cheerio.load(data);
      $('[data-uname="lotsearchLotmodel"]').each((_, el) => {
        const title = $(el).text().trim();
        const link = $(el).find('a').attr('href') || '';
        if (title) {
          listings.push({
            id: `copart-${Buffer.from(link || title).toString('base64').slice(-20)}`,
            source: 'Copart Auction',
            title,
            price: null,
            url: link.startsWith('http') ? link : `https://www.copart.com${link}`,
            location: 'Copart',
            year: extractYear(title),
            mileage: null,
            isAuction: true,
            auction_end: null,
          });
        }
      });
      console.log(`  [Copart/fallback] Found ${listings.length} listings`);
    } catch (err2) {
      console.error(`  [Copart] Error: ${err2.message}`);
    }
  }

  return listings;
}

async function scrapeIAAI(watchlist) {
  if (watchlist.type !== 'vehicle') return [];
  const listings = [];
  const keywords = watchlist.keywords.join(' ');

  try {
    const url = `https://www.iaai.com/Search?Keyword=${encodeURIComponent(keywords)}`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('.table-row, .inventory-item').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.heading-7, .vehicle-title').text().trim();
      const priceText = $el.find('.bid-value, .current-bid').text().trim();
      const link = $el.find('a').attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.iaai.com${link}`;

      listings.push({
        id: `iaai-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'IAAI Auction',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: 'IAAI',
        year: extractYear(title),
        mileage: null,
        isAuction: true,
        auction_end: null,
      });
    });

    console.log(`  [IAAI] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [IAAI] Error: ${err.message}`);
  }

  return listings;
}

async function scrapeGovPlanet(watchlist) {
  if (watchlist.type !== 'vehicle') return [];
  const listings = [];
  const keywords = watchlist.keywords.join(' ');

  try {
    const url = `https://www.govplanet.com/for-sale/search?q=${encodeURIComponent(keywords)}&category=Pickup+Trucks`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('.search-result, .listing-card').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2, .listing-title').text().trim();
      const priceText = $el.find('.current-bid, .price').text().trim();
      const link = $el.find('a').attr('href') || '';
      const loc = $el.find('.location, .listing-location').text().trim();

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.govplanet.com${link}`;

      listings.push({
        id: `gp-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'GovPlanet Auction',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: loc || 'GovPlanet',
        year: extractYear(title),
        mileage: null,
        isAuction: true,
        auction_end: null,
      });
    });

    console.log(`  [GovPlanet] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [GovPlanet] Error: ${err.message}`);
  }

  return listings;
}

async function scrapePublicSurplus(watchlist) {
  if (watchlist.type !== 'vehicle') return [];
  const listings = [];
  const keywords = watchlist.keywords.join(' ');

  try {
    const url = `https://www.publicsurplus.com/sms/browse/search?posting=y&keyword=${encodeURIComponent(keywords)}`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('tr.listrow, .search-result-row').each((_, el) => {
      const $el = $(el);
      const title = $el.find('a').first().text().trim();
      const priceText = $el.find('.price, td:nth-child(3)').text().trim();
      const link = $el.find('a').attr('href') || '';
      const loc = $el.find('.location, td:nth-child(4)').text().trim();

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.publicsurplus.com${link}`;

      listings.push({
        id: `ps-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'PublicSurplus Auction',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: loc || 'PublicSurplus',
        year: extractYear(title),
        mileage: null,
        isAuction: true,
        auction_end: null,
      });
    });

    console.log(`  [PublicSurplus] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [PublicSurplus] Error: ${err.message}`);
  }

  return listings;
}

async function scrape(watchlist) {
  const results = await Promise.allSettled([
    scrapeCopart(watchlist),
    scrapeIAAI(watchlist),
    scrapeGovPlanet(watchlist),
    scrapePublicSurplus(watchlist),
  ]);

  const listings = [];
  for (const r of results) {
    if (r.status === 'fulfilled') listings.push(...r.value);
  }
  return listings;
}

module.exports = { scrape, scrapeCopart, scrapeIAAI, scrapeGovPlanet, scrapePublicSurplus };
