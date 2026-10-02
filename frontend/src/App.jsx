import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './App.css'

function getHeatColor(irr) {
  if (irr < 15) return '#fee2e2'
  if (irr < 20) return '#fed7aa'
  if (irr < 25) return '#fef08a'
  if (irr < 30) return '#bbf7d0'
  return '#86efac'
}

function useCompanySearch(query) {
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/search/${query}`)
        const data = await response.json()
        setSuggestions(data.results || [])
      } catch (err) {
        setSuggestions([])
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  return suggestions
}

function TickerSearchInput({ placeholder, value, onChange, onSelect }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const suggestions = useCompanySearch(value)

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        type="text"
        className="text-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowDropdown(true) }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="dropdown-menu">
          {suggestions.map((item) => (
            <div
              key={item.symbol}
              className="dropdown-item"
              onClick={() => { onSelect(item.symbol); setShowDropdown(false) }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <strong>{item.symbol}</strong> — {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('lbo')

  const [ticker, setTicker] = useState('')
  const [multiple, setMultiple] = useState(8)
  const [debtPercent, setDebtPercent] = useState(0.65)
  const [growthRate, setGrowthRate] = useState(0.08)
  const [exitMultiple, setExitMultiple] = useState(8)
  const [result, setResult] = useState(null)
  const [sensitivity, setSensitivity] = useState(null)
  const [grid2d, setGrid2d] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [acquirerTicker, setAcquirerTicker] = useState('')
  const [targetTicker, setTargetTicker] = useState('')
  const [maResult, setMaResult] = useState(null)
  const [maLoading, setMaLoading] = useState(false)
  const [maError, setMaError] = useState('')

  const [compareInput, setCompareInput] = useState('')
  const [companyList, setCompanyList] = useState([])
  const [comparisonResult, setComparisonResult] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    setSensitivity(null)
    setGrid2d(null)
    try {
      const params = `multiple=${multiple}&debt_percent=${debtPercent}&growth_rate=${growthRate}&exit_multiple=${exitMultiple}`
      const lboResponse = await fetch(`http://127.0.0.1:8000/lbo/${ticker}?${params}`)
      const lboData = await lboResponse.json()
      if (lboData.error) { setError(lboData.error); setLoading(false); return }
      setResult(lboData)
      const sensParams = `multiple=${multiple}&debt_percent=${debtPercent}&growth_rate=${growthRate}`
      const sensResponse = await fetch(`http://127.0.0.1:8000/lbo/${ticker}/sensitivity?${sensParams}`)
      const sensData = await sensResponse.json()
      setSensitivity(sensData.sensitivity)
      const grid2dResponse = await fetch(`http://127.0.0.1:8000/lbo/${ticker}/sensitivity2d?multiple=${multiple}&growth_rate=${growthRate}`)
      const grid2dData = await grid2dResponse.json()
      setGrid2d(grid2dData)
    } catch (err) {
      setError('Could not connect to backend server')
    }
    setLoading(false)
  }

  const handleMaSubmit = async (e) => {
    e.preventDefault()
    setMaLoading(true)
    setMaError('')
    setMaResult(null)
    try {
      const response = await fetch(`http://127.0.0.1:8000/ma/${acquirerTicker}/${targetTicker}`)
      const data = await response.json()
      if (data.error) { setMaError(data.error) } else { setMaResult(data) }
    } catch (err) {
      setMaError('Could not connect to backend server')
    }
    setMaLoading(false)
  }

  const addCompanyToList = (symbol) => {
    if (!companyList.includes(symbol)) { setCompanyList([...companyList, symbol]) }
    setCompareInput('')
  }

  const removeCompanyFromList = (symbol) => {
    setCompanyList(companyList.filter((c) => c !== symbol))
  }

  const handleCompareSubmit = async (e) => {
    e.preventDefault()
    if (companyList.length === 0) { setCompareError('Add at least one company to compare'); return }
    setCompareLoading(true)
    setCompareError('')
    setComparisonResult(null)
    try {
      const tickersParam = companyList.join(',')
      const response = await fetch(`http://127.0.0.1:8000/lbo/compare/${tickersParam}`)
      const data = await response.json()
      if (data.error) { setCompareError(data.error) } else { setComparisonResult(data) }
    } catch (err) {
      setCompareError('Could not connect to backend server')
    }
    setCompareLoading(false)
  }

  const downloadPDF = () => {
    if (!result) return

    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.setFont(undefined, 'bold')
    doc.text('LBO Deal Analysis', 14, 20)

    doc.setFontSize(11)
    doc.setFont(undefined, 'normal')
    doc.text(`Company: ${result.ticker}`, 14, 30)
    doc.text(`Prepared by Joy Chouhan`, 14, 36)

    autoTable(doc, {
      startY: 44,
      head: [['Metric', 'Value']],
      body: [
        ['EBITDA', result.ebitda.toLocaleString()],
        ['Entry Valuation', result.entry_valuation.toLocaleString()],
        ['Debt Amount', result.debt_amount.toLocaleString()],
        ['Equity Amount', result.equity_amount.toLocaleString()],
        ['IRR', `${result.irr}%`],
        ['MOIC', `${result.moic}x`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    })

    if (result.debt_schedule) {
      doc.text('Debt Schedule', 14, doc.lastAutoTable.finalY + 12)
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 16,
        head: [['Year', 'Beginning Debt', 'Interest', 'Principal', 'Ending Debt']],
        body: result.debt_schedule.map((row) => [
          row.year,
          row.beginning_debt.toLocaleString(),
          row.interest_payment.toLocaleString(),
          row.principal_payment.toLocaleString(),
          row.ending_debt.toLocaleString()
        ]),
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      })
    }

    if (sensitivity) {
      doc.text('Sensitivity Analysis', 14, doc.lastAutoTable.finalY + 12)
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 16,
        head: [['Exit Multiple', 'IRR', 'MOIC']],
        body: sensitivity.map((row) => [`${row.exit_multiple}x`, `${row.irr}%`, `${row.moic}x`]),
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      })
    }

    doc.save(`${result.ticker}_LBO_Report.pdf`)
  }

  return (
    <div className="app-container">
      <div className="hero">
        <div className="hero-title">LBO & M&A Modeling Suite</div>
        <div className="hero-subtitle">
          Instantly analyze leveraged buyouts, run sensitivity scenarios, and evaluate M&A deals for any public company.
        </div>
        <div className="hero-author">Built by Joy Chouhan</div>
      </div>

      <div className="tab-bar">
        <button className={`tab-button ${activeTab === 'lbo' ? 'active' : ''}`} onClick={() => setActiveTab('lbo')}>LBO Model</button>
        <button className={`tab-button ${activeTab === 'compare' ? 'active' : ''}`} onClick={() => setActiveTab('compare')}>Company Comparison</button>
        <button className={`tab-button ${activeTab === 'ma' ? 'active' : ''}`} onClick={() => setActiveTab('ma')}>M&A Analysis</button>
      </div>

      {activeTab === 'lbo' && (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <TickerSearchInput placeholder="Type company name (e.g. google)" value={ticker} onChange={setTicker} onSelect={setTicker} />
            <div className="input-row" style={{ marginTop: '20px' }}>
              <label className="field-label"><span>Entry Multiple</span>
                <input type="number" step="0.5" value={multiple} onChange={(e) => setMultiple(e.target.value)} className="number-input" />
              </label>
              <label className="field-label"><span>Debt %</span>
                <input type="number" step="0.05" value={debtPercent} onChange={(e) => setDebtPercent(e.target.value)} className="number-input" />
              </label>
              <label className="field-label"><span>Growth Rate</span>
                <input type="number" step="0.01" value={growthRate} onChange={(e) => setGrowthRate(e.target.value)} className="number-input" />
              </label>
              <label className="field-label"><span>Exit Multiple</span>
                <input type="number" step="0.5" value={exitMultiple} onChange={(e) => setExitMultiple(e.target.value)} className="number-input" />
              </label>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '15px' }}>Calculate</button>
          </form>

          {loading && <p className="loading-text">Loading...</p>}
          {error && <p className="error-text">{error}</p>}

          {result && (
            <>
              <div className="metric-grid">
                <div className="metric-box"><div className="metric-label">Ticker</div><div className="metric-value">{result.ticker}</div></div>
                <div className="metric-box"><div className="metric-label">EBITDA</div><div className="metric-value">{result.ebitda.toLocaleString()}</div></div>
                <div className="metric-box"><div className="metric-label">Entry Valuation</div><div className="metric-value">{result.entry_valuation.toLocaleString()}</div></div>
                <div className="metric-box"><div className="metric-label">Debt Amount</div><div className="metric-value">{result.debt_amount.toLocaleString()}</div></div>
                <div className="metric-box"><div className="metric-label">Equity Amount</div><div className="metric-value">{result.equity_amount.toLocaleString()}</div></div>
                <div className="metric-box"><div className="metric-label">IRR</div><div className="metric-value metric-highlight">{result.irr}%</div></div>
                <div className="metric-box"><div className="metric-label">MOIC</div><div className="metric-value metric-highlight">{result.moic}x</div></div>
              </div>
              <button onClick={downloadPDF} className="btn-primary" style={{ marginTop: '18px' }}>
                Download PDF Report
              </button>
            </>
          )}

          {result && result.debt_schedule && (
            <>
              <div className="subsection-title">Debt Paydown Over Time</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={result.debt_schedule}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                  <YAxis tickFormatter={(value) => `${(value / 1000000000).toFixed(0)}B`} />
                  <Tooltip formatter={(value) => value.toLocaleString()} />
                  <Line type="monotone" dataKey="ending_debt" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>

              <div className="subsection-title">Debt Schedule</div>
              <table className="data-table">
                <thead><tr><th>Year</th><th>Beginning Debt</th><th>Interest</th><th>Principal</th><th>Ending Debt</th></tr></thead>
                <tbody>
                  {result.debt_schedule.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td>{row.beginning_debt.toLocaleString()}</td>
                      <td>{row.interest_payment.toLocaleString()}</td>
                      <td>{row.principal_payment.toLocaleString()}</td>
                      <td>{row.ending_debt.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {sensitivity && (
            <>
              <div className="subsection-title">Sensitivity Analysis</div>
              <table className="data-table">
                <thead><tr><th>Exit Multiple</th><th>IRR</th><th>MOIC</th></tr></thead>
                <tbody>
                  {sensitivity.map((row) => (
                    <tr key={row.exit_multiple}>
                      <td>{row.exit_multiple}x</td>
                      <td style={{ background: getHeatColor(row.irr) }}>{row.irr}%</td>
                      <td style={{ background: getHeatColor(row.irr) }}>{row.moic}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {grid2d && (
            <>
              <div className="subsection-title">2D Sensitivity Grid (IRR %)</div>
              <p className="subsection-note">Rows = Debt %, Columns = Exit Multiple</p>
              <table className="data-table">
                <thead>
                  <tr><th>Debt %</th>{grid2d.exit_multiples.map((m) => <th key={m}>{m}x</th>)}</tr>
                </thead>
                <tbody>
                  {grid2d.grid.map((row) => (
                    <tr key={row.debt_percent}>
                      <td>{(row.debt_percent * 100).toFixed(0)}%</td>
                      {row.irr_values.map((cell) => (
                        <td key={cell.exit_multiple} style={{ background: getHeatColor(cell.irr) }}>{cell.irr}%</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="card">
          <TickerSearchInput placeholder="Search and add a company" value={compareInput} onChange={setCompareInput} onSelect={addCompanyToList} />
          <div className="input-row" style={{ marginTop: '15px' }}>
            {companyList.map((symbol) => (
              <span key={symbol} className="chip">
                {symbol}
                <button onClick={() => removeCompanyFromList(symbol)} className="chip-remove">×</button>
              </span>
            ))}
          </div>
          <button onClick={handleCompareSubmit} className="btn-primary" style={{ marginTop: '10px' }}>Compare</button>

          {compareLoading && <p className="loading-text">Loading...</p>}
          {compareError && <p className="error-text">{compareError}</p>}

          {comparisonResult && (
            <table className="data-table">
              <thead><tr><th>Ticker</th><th>EBITDA</th><th>Entry Valuation</th><th>IRR</th><th>MOIC</th></tr></thead>
              <tbody>
                {comparisonResult.comparison.map((row) => (
                  <tr key={row.ticker} className={row.ticker === comparisonResult.best_candidate ? 'best-row' : ''}>
                    <td>{row.ticker} {row.ticker === comparisonResult.best_candidate && '★'}</td>
                    <td>{row.ebitda.toLocaleString()}</td>
                    <td>{row.entry_valuation.toLocaleString()}</td>
                    <td>{row.irr}%</td>
                    <td>{row.moic}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ma' && (
        <div className="card">
          <form onSubmit={handleMaSubmit}>
            <div className="input-row">
              <TickerSearchInput placeholder="Acquirer (e.g. apple)" value={acquirerTicker} onChange={setAcquirerTicker} onSelect={setAcquirerTicker} />
              <TickerSearchInput placeholder="Target (e.g. intel)" value={targetTicker} onChange={setTargetTicker} onSelect={setTargetTicker} />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '18px' }}>Analyze Deal</button>
          </form>

          {maLoading && <p className="loading-text">Loading...</p>}
          {maError && <p className="error-text">{maError}</p>}

          {maResult && (
            <div className="metric-grid">
              <div className="metric-box"><div className="metric-label">Deal</div><div className="metric-value">{maResult.acquirer} → {maResult.target}</div></div>
              <div className="metric-box"><div className="metric-label">Acquirer EPS (before)</div><div className="metric-value">{maResult.acquirer_eps}</div></div>
              <div className="metric-box"><div className="metric-label">Pro-Forma EPS (after)</div><div className="metric-value">{maResult.pro_forma_eps}</div></div>
              <div className="metric-box"><div className="metric-label">Purchase Price</div><div className="metric-value">{maResult.purchase_price.toLocaleString()}</div></div>
              <div className="metric-box"><div className="metric-label">New Shares Issued</div><div className="metric-value">{maResult.new_shares_issued.toLocaleString()}</div></div>
            </div>
          )}

          {maResult && (
            <div className={`result-badge ${maResult.result === 'Accretive' ? 'badge-accretive' : 'badge-dilutive'}`}>
              {maResult.result}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
