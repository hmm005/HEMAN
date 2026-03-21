# Deal Alert Dashboard

**Heman McCray | Elevate Home Solutions**

A Node.js deal-alert dashboard that scrapes 15+ car listing sites, public auction platforms, and business-for-sale marketplaces. Matches listings against keyword/price/year watchlists, sends Twilio SMS alerts for new matches, and serves a live web dashboard.

## Quick Start

```bash
cd deal-dashboard
npm install
cp .env.example .env    # Fill in Twilio + eBay creds
npm start
```

Open **http://localhost:3000**

Click **SCAN NOW** or wait 30 minutes for the first auto-scan.

## API Keys

- **eBay API key**: Free at [developer.ebay.com](https://developer.ebay.com) (App ID / Client ID)
- **Twilio**: Already configured on TINO — reuse same creds

## Commands

```bash
npm start          # Dashboard + scheduler (full system)
npm run scan       # Single scan then exit
npm run dev        # Dev mode with auto-reload (nodemon)
```

## Sources Monitored

**Vehicles (13 sources):**
Craigslist (15 cities), eBay Motors, AutoTrader, CarGurus, Cars.com, CarsForSale, Hemmings, TruckPaper, CarsDirect, Copart, IAAI, GovPlanet, PublicSurplus

**Business (3 sources):**
BizBuySell, BizQuest, Craigslist

## Pre-Configured Watchlists

1. **2006-2007 LBZ Duramax Diesel** — $8k-$45k across all vehicle sources
2. **Laundromat for Sale** — Up to $350k on business marketplaces

## Always-On (Raspberry Pi / TINO)

```bash
npm install -g pm2
pm2 start src/index.js --name deal-dashboard
pm2 save && pm2 startup
```

## Architecture

- **SQLite** database for zero-duplicate alerts (`data/deals.db`)
- **p-limit** concurrency (3 scrapers at a time)
- **node-cron** for configurable scan intervals (default: 30 min)
- **Express** dashboard with real-time stats + listing cards
- **Twilio** SMS alerts (max 5 per scan, overflow notification)
