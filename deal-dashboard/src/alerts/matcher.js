function extractYear(title) {
  const m = (title||'').match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0]) : null;
}

function matchesWatchlist(listing, watchlist) {
  const t = (listing.title||'').toLowerCase();
  const price = listing.price||0;
  const year = listing.year || extractYear(listing.title);

  if (watchlist.maxPrice && price > 0 && price > watchlist.maxPrice) return false;
  if (watchlist.minPrice && price > 0 && price < watchlist.minPrice) return false;
  if (year) {
    if (watchlist.minYear && year < watchlist.minYear) return false;
    if (watchlist.maxYear && year > watchlist.maxYear) return false;
  }
  if (watchlist.titleMustContain?.length) {
    if (!watchlist.titleMustContain.every(kw => t.includes(kw.toLowerCase()))) return false;
  }
  if (watchlist.keywords?.length) {
    if (!watchlist.keywords.some(kw => t.includes(kw.toLowerCase()))) return false;
  }
  return true;
}

function scoreListng(listing, watchlist) {
  let score = 0;
  const t = (listing.title||'').toLowerCase();
  for (const kw of (watchlist.keywords||[])) if (t.includes(kw.toLowerCase())) score += 10;
  if (listing.price && watchlist.maxPrice) {
    const pct = listing.price / watchlist.maxPrice;
    if (pct < 0.5) score += 30;
    else if (pct < 0.7) score += 20;
    else if (pct < 0.85) score += 10;
  }
  if (listing.isAuction) score += 5;
  const mi = (listing.mileage||'').match(/(\d[\d,]+)/);
  if (mi) {
    const miles = parseInt(mi[1].replace(/,/g,''));
    if (miles < 100000) score += 15;
    else if (miles < 150000) score += 8;
    else if (miles < 200000) score += 3;
  }
  return score;
}

function filterAndScore(listings, watchlist) {
  return listings
    .filter(l => matchesWatchlist(l, watchlist))
    .map(l => ({ ...l, score: scoreListng(l, watchlist) }))
    .sort((a,b) => b.score - a.score);
}

module.exports = { matchesWatchlist, filterAndScore, extractYear };
