# Deal Alert Dashboard

**Heman McCray | Elevate Home Solutions**

A local deal-alert system that monitors 15+ sources across car sites, auction platforms, and business-for-sale marketplaces. Sends Twilio SMS alerts the moment a new match hits. Also includes a property-owner email outreach module (Leads Pipeline tab). Live web dashboard.

## Windows Quickstart (PowerShell)

```powershell
git clone https://github.com/hmm005/HEMAN.git
cd HEMAN\deal-dashboard
git checkout claude/property-owner-email-bot-vWbWR
.\scripts\setup.ps1        # one-time interactive setup
```

`setup.ps1` installs deps, asks for your email credentials (password hidden — safe with `$` or other special characters), writes `.env`, verifies SMTP, starts the app via pm2, and enables auto-start on boot.

**If you get "running scripts is disabled"**, run PowerShell once as admin and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Day-to-day commands:
```powershell
.\scripts\verify.ps1         # health check (pm2, HTTP, SMTP, DB)
pm2 status
pm2 logs deal-dashboard      # live logs
pm2 restart deal-dashboard
```

> **Password tip:** Don't paste passwords with `$` directly into PowerShell — it treats `$foo` as a variable reference and silently drops it. The setup script uses a secure prompt that avoids this. If you ever edit `.env` by hand, open it in Notepad instead.

## Mac / Linux Quickstart

```bash
cd deal-dashboard
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

Open http://localhost:3000

## Sources Monitored

**Vehicles:** Craigslist (15 cities), eBay Motors, AutoTrader, CarGurus, Cars.com, CarsForSale.com, Hemmings, TruckPaper, CarsDirect, Copart, IAAI, GovPlanet, PublicSurplus

**Business:** BizBuySell, BizQuest, Craigslist

## Commands

```bash
npm start           # Dashboard + scheduler + outreach scheduler
npm run scan        # Single deal scan then exit
npm run dashboard   # Dashboard only
npm run dev         # Dev mode (nodemon)
npm run import <csv>    # Import Deal Machine CSV of property leads
npm run campaign:dry    # Preview today's outreach sends (no emails sent)
npm run campaign        # Run outreach for today (requires OUTREACH_ENABLED=true)
```

## Pre-Configured Watchlists

1. **2006-2007 LBZ Duramax Diesel** — $8k-$45k across all vehicle sources
2. **Laundromat for Sale** — Up to $350k on business marketplaces

## Property Owner Outreach

Import property owner leads from a Deal Machine CSV export, then a multi-step email drip runs automatically each morning at 7 AM:

- Day 0: Initial email
- Day 7: Follow-up (if no reply)
- Day 21: Final follow-up (if no reply)
- Day 25: **Call reminder card** appears in the Leads Pipeline tab with the owner's phone number

Email warmup limits (5 / 15 / 30 / 50 per day over 7 weeks) are auto-enforced — config in `config/outreach.json`. Set `OUTREACH_ENABLED=true` in `.env` to start sending live.
