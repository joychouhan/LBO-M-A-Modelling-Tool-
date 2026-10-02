# LBO & M&A Deal Modeling Tool

I built this project to actually understand how LBO and M&A models work instead of just copying a template and changing numbers. It's a full stack web app that runs a Leveraged Buyout analysis and an M&A Accretion/Dilution analysis on any public company, using live financial data pulled from Yahoo Finance.

## Why I built it this way

I wanted this to be a real resume project for breaking into finance, not another quick dashboard like my earlier projects. So I gave myself about a month, alternated between coding days and Excel practice days, and made myself explain the model out loud while building it. If I couldn't explain why a part of the debt schedule worked the way it did, that meant I hadn't actually learned it yet.

The Excel file in this repo (`excel-model/MA LBO.xlsx`) is the manual version I built first, by hand, before I wrote any backend code. I wanted to prove to myself that I understood the actual mechanics before automating any of it.

## What it does

The LBO side runs a full five year model. It covers entry valuation, sources and uses, the debt schedule, free cash flow, exit valuation, and IRR and MOIC. You can change the Entry Multiple, Debt %, Growth Rate, and Exit Multiple yourself and everything recalculates live. There's also a sensitivity table across exit multiples from 6x to 10x, and a 2D grid that varies Debt % and Exit Multiple together, 25 combinations total, color coded by IRR. There's a debt paydown chart as well.

The M&A side uses the same live data approach and tells you whether a deal would be accretive or dilutive to the acquirer's EPS.

You can also compare a few companies at once and see their IRR and MOIC side by side, with the strongest candidate highlighted.

I added a company name search so I didn't have to remember ticker symbols every time I wanted to test something.

## Tech stack

Backend is FastAPI with yfinance and numpy-financial. Frontend is React built with Vite, using Recharts for the charts. All the data is live, nothing is hardcoded.

## API endpoints

| Endpoint | What it returns |
|---|---|
| `GET /lbo/{ticker}` | Full LBO calculation, valuation, debt, equity, IRR, MOIC |
| `GET /lbo/{ticker}/sensitivity` | IRR and MOIC across exit multiples |
| `GET /lbo/{ticker}/sensitivity2d` | IRR grid across Debt % and Exit Multiple |
| `GET /lbo/compare/{tickers}` | Multi company IRR/MOIC comparison |
| `GET /ma/{acquirer}/{target}` | M&A accretion/dilution analysis |

## Running it locally

```bash
# backend
cd backend
pip install fastapi uvicorn yfinance numpy-financial
uvicorn main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

## About the Excel file

`excel-model/M_A_LBO.xlsx` has both the LBO model and the M&A accretion/dilution model, built by hand before any of the Python code existed. I went back later and cleaned it up properly, labeled the debt schedule, pulled all the hardcoded assumptions into their own cells so they're actually adjustable, added a MOIC sensitivity column, and built a one page dashboard that pulls the key numbers from both sheets. I also ran both models using real company numbers instead of leaving them as placeholders, McDonald's for the LBO side and Microsoft's acquisition of Activision Blizzard for the M&A side.

## Status

The core build is done. LBO engine, M&A module, custom assumptions, debt schedule, both sensitivity views, multi company comparison, charts, and a design pass are all working. I'm taking a short break from this project right now. Next step is deploying it properly, Render for the backend and Vercel for the frontend, so it's actually live instead of just running on my laptop.
