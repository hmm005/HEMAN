require('dotenv').config();
let client = null;

function getClient() {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || sid.includes('xxxx')) return null;
    client = require('twilio')(sid, token);
  }
  return client;
}

function formatAlert(listing, watchlist) {
  const emoji = listing.isAuction ? '🔨' : '🚨';
  const tag = listing.isAuction ? `[AUCTION - ${listing.source}]` : `[${listing.source}]`;
  const price = listing.price ? `$${listing.price.toLocaleString()}` : 'Price TBD';
  const parts = [`${emoji} DEAL ALERT - ${watchlist.name}`, tag, listing.title, price];
  if (listing.mileage) parts.push(listing.mileage);
  if (listing.location) parts.push(`📍 ${listing.location}`);
  if (listing.isAuction && listing.auctionEnd) parts.push(`⏰ Ends: ${listing.auctionEnd}`);
  parts.push(listing.url);
  return parts.join('\n');
}

async function sendSMSAlert(listing, watchlist) {
  const msg = formatAlert(listing, watchlist);
  console.log('\n' + '='.repeat(55));
  console.log('📱 ALERT:\n' + msg);
  console.log('='.repeat(55) + '\n');
  const c = getClient();
  if (!c) return { success: false, reason: 'no_credentials' };
  try {
    const r = await c.messages.create({ body: msg, from: process.env.TWILIO_FROM_NUMBER, to: process.env.TWILIO_TO_NUMBER });
    return { success: true, sid: r.sid };
  } catch (e) {
    console.error('[Twilio]', e.message);
    return { success: false, error: e.message };
  }
}

async function sendBatchAlerts(listings, watchlist, max=5) {
  const toSend = listings.slice(0, max);
  for (const l of toSend) {
    await sendSMSAlert(l, watchlist);
    await new Promise(r => setTimeout(r, 500));
  }
  if (listings.length > max) {
    const overflow = `📊 +${listings.length - max} more ${watchlist.name} listings. Check dashboard: http://localhost:${process.env.PORT||3000}`;
    console.log(overflow);
    const c = getClient();
    if (c) await c.messages.create({ body: overflow, from: process.env.TWILIO_FROM_NUMBER, to: process.env.TWILIO_TO_NUMBER }).catch(()=>{});
  }
}

module.exports = { sendSMSAlert, sendBatchAlerts };
