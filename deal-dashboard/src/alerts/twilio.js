const dotenv = require('dotenv');
dotenv.config();

let twilioClient = null;

function getClient() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token || sid.startsWith('ACxx')) {
      console.log('[Twilio] No valid credentials configured — SMS alerts disabled');
      return null;
    }
    const twilio = require('twilio');
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

function formatAlert(listing, watchlist) {
  const isAuction = listing.isAuction || listing.source?.includes('auction') ||
    ['copart', 'iaai', 'govplanet', 'publicsurplus'].includes(listing.source?.toLowerCase());

  const icon = isAuction ? '🔨' : '🚨';
  const prefix = isAuction ? `${icon} DEAL ALERT` : `${icon} DEAL ALERT`;

  let msg = `${prefix} - ${watchlist.name}\n`;
  msg += `[${listing.source}] ${listing.title}\n`;

  if (listing.price) msg += `$${Number(listing.price).toLocaleString()}\n`;
  if (listing.mileage) msg += `${Number(listing.mileage).toLocaleString()} mi\n`;
  if (listing.location) msg += `📍 ${listing.location}\n`;
  if (listing.auction_end) msg += `⏰ Ends: ${listing.auction_end}\n`;
  if (listing.url) msg += `${listing.url}`;

  return msg;
}

async function sendAlert(listing, watchlist) {
  const client = getClient();
  if (!client) {
    console.log(`[Twilio] Would send alert: ${listing.title} ($${listing.price})`);
    return false;
  }

  const body = formatAlert(listing, watchlist);

  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to: process.env.TWILIO_TO_NUMBER,
    });
    console.log(`[Twilio] SMS sent: ${listing.title}`);
    return true;
  } catch (err) {
    console.error(`[Twilio] SMS failed: ${err.message}`);
    return false;
  }
}

async function sendBatchAlerts(listings, watchlist, maxAlerts = 5) {
  const toSend = listings.slice(0, maxAlerts);
  let sent = 0;

  for (const listing of toSend) {
    const ok = await sendAlert(listing, watchlist);
    if (ok) sent++;
    // Small delay between messages
    if (toSend.length > 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (listings.length > maxAlerts) {
    const client = getClient();
    if (client) {
      try {
        await client.messages.create({
          body: `📊 ${listings.length - maxAlerts} more deals found for "${watchlist.name}". Check dashboard at http://localhost:${process.env.PORT || 3000}`,
          from: process.env.TWILIO_FROM_NUMBER,
          to: process.env.TWILIO_TO_NUMBER,
        });
      } catch (_) {}
    }
  }

  return sent;
}

module.exports = { sendAlert, sendBatchAlerts, formatAlert };
