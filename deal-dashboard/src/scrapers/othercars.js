const axios = require('axios');
const cheerio = require('cheerio');
const { extractYear, extractMileage, extractPrice } = require('../alerts/matcher');

async function scrapeCarsForSale(watchlist) {
  if (watchlist.type !== 'vehicle') return [];
  const listings = [];
  const keywords = watchlist.keywords.join('+');

  try {
    const url = `https://www.carsforsale.com/search?keyword=${encodeURIComponent(keywords)}&zip=35209&radius=500&priceMin=${watchlist.minPrice || ''}&priceMax=${watchlist.maxPrice || ''}`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('.vehicle-card, .listing-row').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2, .vehicle-title').text().trim();
      const priceText = $el.find('.price, .vehicle-price').text().trim();
      const mileageText = $el.find('.mileage').text().trim();
      const link = $el.find('a').attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.carsforsale.com${link}`;
      listings.push({
        id: `cfs-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'CarsForSale',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: 'CarsForSale · 500mi',
        year: extractYear(title),
        mileage: extractMileage(mileageText),
        isAuction: false,
      });
    });
    console.log(`  [CarsForSale] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [CarsForSale] Error: ${err.message}`);
  }

  return listings;
}

async function scrapeHemmings(watchlist) {
  if (watchlist.type !== 'vehicle') return [];
  const listings = [];
  const keywords = watchlist.keywords.join('+');

  try {
    const url = `https://www.hemmings.com/classifieds/cars-for-sale?q=${encodeURIComponent(keywords)}`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('.listing-card, .search-result-item').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h3, .listing-title').text().trim();
      const priceText = $el.find('.price, .listing-price').text().trim();
      const link = $el.find('a').attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.hemmings.com${link}`;
      listings.push({
        id: `hem-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'Hemmings',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: 'Hemmings',
        year: extractYear(title),
        mileage: null,
        isAuction: false,
      });
    });
    console.log(`  [Hemmings] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [Hemmings] Error: ${err.message}`);
  }

  return listings;
}

async function scrapeTruckPaper(watchlist) {
  if (watchlist.type !== 'vehicle') return [];
  const listings = [];
  const keywords = watchlist.keywords.join('+');

  try {
    const url = `https://www.truckpaper.com/listings/trucks/for-sale/list?Keyword=${encodeURIComponent(keywords)}`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('[data-listing-id], .listing-row').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2, .listing-title').text().trim();
      const priceText = $el.find('.price, .listing-price').text().trim();
      const link = $el.find('a').attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.truckpaper.com${link}`;
      listings.push({
        id: `tp-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'TruckPaper',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: 'TruckPaper',
        year: extractYear(title),
        mileage: null,
        isAuction: false,
      });
    });
    console.log(`  [TruckPaper] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [TruckPaper] Error: ${err.message}`);
  }

  return listings;
}

async function scrapeCarsDirect(watchlist) {
  if (watchlist.type !== 'vehicle') return [];
  const listings = [];
  const keywords = watchlist.keywords.join('+');

  try {
    const url = `https://www.carsdirect.com/used_cars/listings?keyword=${encodeURIComponent(keywords)}&zip=35209&radius=500`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const $ = cheerio.load(data);
    $('.listing-card, .vehicle-card').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2, .vehicle-title').text().trim();
      const priceText = $el.find('.price').text().trim();
      const link = $el.find('a').attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.carsdirect.com${link}`;
      listings.push({
        id: `cd-${Buffer.from(fullUrl).toString('base64').slice(-20)}`,
        source: 'CarsDirect',
        title,
        price: extractPrice(priceText),
        url: fullUrl,
        location: 'CarsDirect',
        year: extractYear(title),
        mileage: null,
        isAuction: false,
      });
    });
    console.log(`  [CarsDirect] Found ${listings.length} listings`);
  } catch (err) {
    console.error(`  [CarsDirect] Error: ${err.message}`);
  }

  return listings;
}

async function scrape(watchlist) {
  const results = await Promise.allSettled([
    scrapeCarsForSale(watchlist),
    scrapeHemmings(watchlist),
    scrapeTruckPaper(watchlist),
    scrapeCarsDirect(watchlist),
  ]);

  const listings = [];
  for (const r of results) {
    if (r.status === 'fulfilled') listings.push(...r.value);
  }
  return listings;
}

module.exports = { scrape };
