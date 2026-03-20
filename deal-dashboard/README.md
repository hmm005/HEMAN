# Deal Alert Dashboard

**Heman McCray | Elevate Home Solutions**

A local deal-alert system that monitors 15+ sources across car sites, auction platforms, and business-for-sale marketplaces. Sends Twilio SMS alerts the moment a new match hits. Includes a live web dashboard.

## Quick Start

```bash
cd deal-dashboard
npm install
cp .env.example .env
# Edit .env with your Twilio + eBay credentials
npm start
```

Open http://localhost:3000

## Sources Monitored

**Vehicles:** Craigslist (15 cities), eBay Motors, AutoTrader, CarGurus, Cars.com, CarsForSale.com, Hemmings, TruckPaper, CarsDirect, Copart, IAAI, GovPlanet, PublicSurplus

**Business:** BizBuySell, BizQuest, Craigslist

## Commands

```bash
npm start          # Dashboard + scheduler
npm run scan       # Single scan then exit
npm run dashboard  # Dashboard only
npm run dev        # Dev mode (nodemon)
```

## Pre-Configured Watchlists

1. **2006-2007 LBZ Duramax Diesel** — $8k-$45k across all vehicle sources
2. **Laundromat for Sale** — Up to $350k on business marketplaces
