import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import numpy_financial as npf
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FMP_API_KEY = os.environ.get("FMP_API_KEY")
FMP_BASE = "https://financialmodelingprep.com/stable"


def get_ebitda(ticker):
    url = f"{FMP_BASE}/income-statement"
    params = {"symbol": ticker, "apikey": FMP_API_KEY}
    response = requests.get(url, params=params)
    data = response.json()
    if not data or not isinstance(data, list):
        return None
    return data[0].get("ebitda")


def entry_valuation(ebitda, multiple):
    return ebitda * multiple


def sources_and_uses(entry_val, debt_percent):
    debt = entry_val * debt_percent
    equity = entry_val * (1 - debt_percent)
    return {"debt_amount": debt, "equity_amount": equity}


def operating_model(ebitda, growth_rate, years=5):
    projections = []
    current_ebitda = ebitda
    for year in range(1, years + 1):
        current_ebitda = current_ebitda * (1 + growth_rate)
        projections.append({"year": year, "ebitda": round(current_ebitda, 2)})
    return projections


def debt_schedule(initial_debt, interest_rate, ebitda_projections, fcf_percent_to_debt):
    schedule = []
    remaining_debt = initial_debt
    for proj in ebitda_projections:
        beginning_debt = remaining_debt
        interest_payment = remaining_debt * interest_rate
        cash_available = proj["ebitda"] * fcf_percent_to_debt
        principal_payment = min(cash_available, remaining_debt)
        remaining_debt = remaining_debt - principal_payment
        schedule.append({
            "year": proj["year"],
            "beginning_debt": round(beginning_debt, 2),
            "interest_payment": round(interest_payment, 2),
            "principal_payment": round(principal_payment, 2),
            "ending_debt": round(remaining_debt, 2)
        })
    return schedule


def calculate_returns(equity_invested, ending_ebitda, ending_debt, years, exit_multiple):
    exit_ev = ending_ebitda * exit_multiple
    exit_equity_value = exit_ev - ending_debt
    cash_flows = [-equity_invested] + [0] * (years - 1) + [exit_equity_value]
    irr = npf.irr(cash_flows)
    moic = exit_equity_value / equity_invested
    return {"irr": round(irr * 100, 2), "moic": round(moic, 2)}


def get_company_data(ticker):
    income_url = f"{FMP_BASE}/income-statement"
    income_params = {"symbol": ticker, "apikey": FMP_API_KEY}
    income_response = requests.get(income_url, params=income_params)
    income_data = income_response.json()

    quote_url = f"{FMP_BASE}/quote"
    quote_params = {"symbol": ticker, "apikey": FMP_API_KEY}
    quote_response = requests.get(quote_url, params=quote_params)
    quote_data = quote_response.json()

    if not income_data or not isinstance(income_data, list) or not quote_data or not isinstance(quote_data, list):
        return {"net_income": None, "shares": None, "price": None}

    latest_income = income_data[0]
    latest_quote = quote_data[0]

    return {
        "net_income": latest_income.get("netIncome"),
        "shares": latest_income.get("weightedAverageShsOutDil") or latest_income.get("weightedAverageShsOut"),
        "price": latest_quote.get("price")
    }


# FMP's search only matches on a company's official registered name, not
# the brand/product name people actually type (e.g. "Google" instead of
# "Alphabet"). This small alias list catches the most common mismatches
# and puts the right ticker at the top of the results.
COMPANY_ALIASES = {
    "google": ("GOOGL", "Alphabet Inc. (Google)"),
    "alphabet": ("GOOGL", "Alphabet Inc."),
    "facebook": ("META", "Meta Platforms Inc. (Facebook)"),
    "meta": ("META", "Meta Platforms Inc."),
    "apple": ("AAPL", "Apple Inc."),
    "microsoft": ("MSFT", "Microsoft Corporation"),
    "amazon": ("AMZN", "Amazon.com Inc."),
    "netflix": ("NFLX", "Netflix Inc."),
    "tesla": ("TSLA", "Tesla Inc."),
    "intel": ("INTC", "Intel Corporation"),
    "nvidia": ("NVDA", "NVIDIA Corporation"),
    "twitter": ("X", "X Corp. (Twitter)"),
    "disney": ("DIS", "The Walt Disney Company"),
    "walmart": ("WMT", "Walmart Inc."),
    "coca cola": ("KO", "The Coca-Cola Company"),
    "coke": ("KO", "The Coca-Cola Company"),
    "mcdonalds": ("MCD", "McDonald's Corporation"),
    "starbucks": ("SBUX", "Starbucks Corporation"),
    "nike": ("NKE", "Nike Inc."),
    "visa": ("V", "Visa Inc."),
    "mastercard": ("MA", "Mastercard Inc."),
    "paypal": ("PYPL", "PayPal Holdings Inc."),
    "uber": ("UBER", "Uber Technologies Inc."),
    "airbnb": ("ABNB", "Airbnb Inc."),
    "boeing": ("BA", "The Boeing Company"),
    "jpmorgan": ("JPM", "JPMorgan Chase & Co."),
    "goldman sachs": ("GS", "The Goldman Sachs Group Inc."),
    "berkshire": ("BRK-B", "Berkshire Hathaway Inc."),
}


def search_ticker(query):
    results = []
    query_lower = query.lower().strip()

    for alias, (symbol, name) in COMPANY_ALIASES.items():
        if alias in query_lower or query_lower in alias:
            results.append({"symbol": symbol, "name": name})
            break

    url = f"{FMP_BASE}/search-name"
    params = {"query": query, "apikey": FMP_API_KEY}
    response = requests.get(url, params=params)
    data = response.json()

    if isinstance(data, list):
        for item in data[:6]:
            symbol = item.get("symbol")
            name = item.get("name")
            if symbol and name and not any(r["symbol"] == symbol for r in results):
                results.append({"symbol": symbol, "name": name})

    return results[:6]


def run_lbo_calculation(ticker, multiple, debt_percent, growth_rate, exit_multiple):
    ebitda = get_ebitda(ticker)
    if ebitda is None:
        return None

    entry_val = entry_valuation(ebitda, multiple)
    su_result = sources_and_uses(entry_val, debt_percent)
    projections = operating_model(ebitda, growth_rate)
    debt_result = debt_schedule(su_result["debt_amount"], 0.08, projections, 0.20)

    final_year_ebitda = projections[-1]["ebitda"]
    final_year_debt = debt_result[-1]["ending_debt"]

    returns = calculate_returns(su_result["equity_amount"], final_year_ebitda, final_year_debt, 5, exit_multiple)

    return {
        "ticker": ticker,
        "ebitda": ebitda,
        "entry_valuation": entry_val,
        "debt_amount": su_result["debt_amount"],
        "equity_amount": su_result["equity_amount"],
        "irr": returns["irr"],
        "moic": returns["moic"],
        "debt_schedule": debt_result
    }


@app.get("/")
def home():
    return {"message": "LBO API is running"}


@app.get("/search/{query}")
def search_company(query: str):
    results = search_ticker(query)
    return {"results": results}


@app.get("/lbo/{ticker}")
def run_lbo(ticker: str, multiple: float = 8, debt_percent: float = 0.65, growth_rate: float = 0.08, exit_multiple: float = 8):
    result = run_lbo_calculation(ticker, multiple, debt_percent, growth_rate, exit_multiple)
    if result is None:
        return {"error": "EBITDA data not found for this ticker"}
    return result


@app.get("/lbo/{ticker}/sensitivity")
def run_sensitivity(ticker: str, multiple: float = 8, debt_percent: float = 0.65, growth_rate: float = 0.08):
    ebitda = get_ebitda(ticker)

    if ebitda is None:
        return {"error": "EBITDA data not found for this ticker"}

    entry_val = entry_valuation(ebitda, multiple)
    su_result = sources_and_uses(entry_val, debt_percent)
    projections = operating_model(ebitda, growth_rate)
    debt_result = debt_schedule(su_result["debt_amount"], 0.08, projections, 0.20)

    final_year_ebitda = projections[-1]["ebitda"]
    final_year_debt = debt_result[-1]["ending_debt"]

    exit_multiples = [6, 7, 8, 9, 10]
    results = []
    for exit_mult in exit_multiples:
        returns = calculate_returns(su_result["equity_amount"], final_year_ebitda, final_year_debt, 5, exit_mult)
        results.append({"exit_multiple": exit_mult, "irr": returns["irr"], "moic": returns["moic"]})

    return {"ticker": ticker, "sensitivity": results}


@app.get("/lbo/{ticker}/sensitivity2d")
def run_sensitivity_2d(ticker: str, multiple: float = 8, growth_rate: float = 0.08):
    ebitda = get_ebitda(ticker)

    if ebitda is None:
        return {"error": "EBITDA data not found for this ticker"}

    entry_val = entry_valuation(ebitda, multiple)
    projections = operating_model(ebitda, growth_rate)
    final_year_ebitda = projections[-1]["ebitda"]

    exit_multiples = [6, 7, 8, 9, 10]
    debt_percents = [0.45, 0.55, 0.65, 0.75, 0.85]

    grid = []
    for debt_pct in debt_percents:
        su_result = sources_and_uses(entry_val, debt_pct)
        debt_result = debt_schedule(su_result["debt_amount"], 0.08, projections, 0.20)
        final_year_debt = debt_result[-1]["ending_debt"]

        row = {"debt_percent": debt_pct, "irr_values": []}
        for exit_mult in exit_multiples:
            returns = calculate_returns(su_result["equity_amount"], final_year_ebitda, final_year_debt, 5, exit_mult)
            row["irr_values"].append({"exit_multiple": exit_mult, "irr": returns["irr"]})
        grid.append(row)

    return {"ticker": ticker, "exit_multiples": exit_multiples, "grid": grid}


@app.get("/lbo/compare/{tickers}")
def compare_companies(tickers: str, multiple: float = 8, debt_percent: float = 0.65, growth_rate: float = 0.08, exit_multiple: float = 8):
    ticker_list = tickers.split(",")
    results = []

    for t in ticker_list:
        t = t.strip()
        if not t:
            continue
        result = run_lbo_calculation(t, multiple, debt_percent, growth_rate, exit_multiple)
        if result is not None:
            results.append({
                "ticker": result["ticker"],
                "ebitda": result["ebitda"],
                "entry_valuation": result["entry_valuation"],
                "irr": result["irr"],
                "moic": result["moic"]
            })

    if len(results) == 0:
        return {"error": "No valid data found for the given tickers"}

    results.sort(key=lambda x: x["irr"], reverse=True)
    best_candidate = results[0]["ticker"]

    return {"comparison": results, "best_candidate": best_candidate}


@app.get("/ma/{acquirer_ticker}/{target_ticker}")
def run_ma_analysis(acquirer_ticker: str, target_ticker: str, premium_percent: float = 0.20):
    acquirer = get_company_data(acquirer_ticker)
    target = get_company_data(target_ticker)

    if acquirer["net_income"] is None or target["net_income"] is None:
        return {"error": "Data not found for one of the tickers"}

    acquirer_eps = acquirer["net_income"] / acquirer["shares"]
    target_market_cap = target["price"] * target["shares"]
    purchase_price = target_market_cap * (1 + premium_percent)

    new_shares_issued = purchase_price / acquirer["price"]

    pro_forma_net_income = acquirer["net_income"] + target["net_income"]
    pro_forma_shares = acquirer["shares"] + new_shares_issued
    pro_forma_eps = pro_forma_net_income / pro_forma_shares

    result = "Accretive" if pro_forma_eps > acquirer_eps else "Dilutive"

    return {
        "acquirer": acquirer_ticker,
        "target": target_ticker,
        "acquirer_eps": round(acquirer_eps, 2),
        "pro_forma_eps": round(pro_forma_eps, 2),
        "purchase_price": round(purchase_price, 2),
        "new_shares_issued": round(new_shares_issued, 2),
        "result": result
    }
