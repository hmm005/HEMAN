function matchesWatchlist(listing, watchlist) {
  const title = (listing.title || '').toLowerCase();
  const desc = (listing.description || '').toLowerCase();
  const combined = `${title} ${desc}`;

  // Title must contain check
  if (watchlist.titleMustContain && watchlist.titleMustContain.length > 0) {
    const hasRequired = watchlist.titleMustContain.some(
      (term) => title.includes(term.toLowerCase())
    );
    if (!hasRequired) return false;
  }

  // Price filter
  const price = parseFloat(listing.price) || 0;
  if (price > 0) {
    if (watchlist.minPrice && price < watchlist.minPrice) return false;
    if (watchlist.maxPrice && price > watchlist.maxPrice) return false;
  }

  // Year filter (vehicles)
  if (listing.year) {
    const year = parseInt(listing.year);
    if (watchlist.minYear && year < watchlist.minYear) return false;
    if (watchlist.maxYear && year > watchlist.maxYear) return false;
  }

  // Keyword match — at least one keyword must appear
  if (watchlist.keywords && watchlist.keywords.length > 0) {
    const hasKeyword = watchlist.keywords.some(
      (kw) => combined.includes(kw.toLowerCase())
    );
    if (!hasKeyword) return false;
  }

  return true;
}

function scoreListing(listing, watchlist) {
  let score = 50; // base score

  const title = (listing.title || '').toLowerCase();
  const desc = (listing.description || '').toLowerCase();
  const combined = `${title} ${desc}`;
  const price = parseFloat(listing.price) || 0;

  // Keyword density bonus (up to +20)
  if (watchlist.keywords) {
    const matches = watchlist.keywords.filter((kw) => combined.includes(kw.toLowerCase()));
    score += Math.min(matches.length * 5, 20);
  }

  // Price score: lower price relative to max = higher score (up to +25)
  if (price > 0 && watchlist.maxPrice) {
    const priceRatio = 1 - (price / watchlist.maxPrice);
    score += Math.round(priceRatio * 25);
  }

  // Low mileage bonus for vehicles (up to +15)
  if (listing.mileage) {
    const miles = parseInt(listing.mileage);
    if (miles < 100000) score += 15;
    else if (miles < 150000) score += 10;
    else if (miles < 200000) score += 5;
  }

  // Title must-contain bonus
  if (watchlist.titleMustContain) {
    const titleMatches = watchlist.titleMustContain.filter(
      (term) => title.includes(term.toLowerCase())
    );
    score += titleMatches.length * 5;
  }

  // Auction discount bonus
  if (listing.isAuction) score += 5;

  return Math.max(0, Math.min(100, score));
}

function extractYear(text) {
  const match = (text || '').match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

function extractMileage(text) {
  const patterns = [
    /(\d{1,3}[,.]?\d{3})\s*(mi|miles|k\s*mi)/i,
    /(\d{1,3})[kK]\s*(mi|miles)/i,
    /mileage[:\s]*(\d{1,3}[,.]?\d{3})/i,
  ];
  for (const p of patterns) {
    const m = (text || '').match(p);
    if (m) {
      const num = m[1].replace(/[,\.]/g, '');
      return parseInt(num);
    }
  }
  return null;
}

function extractPrice(text) {
  const m = (text || '').match(/\$\s?([\d,]+)/);
  if (m) return parseFloat(m[1].replace(/,/g, ''));
  return null;
}

module.exports = { matchesWatchlist, scoreListing, extractYear, extractMileage, extractPrice };
