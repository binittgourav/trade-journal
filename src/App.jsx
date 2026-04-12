import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const emptyForm = {
  date: "",
  instrument: "",
  entryTime: "",
  exitTime: "",
  entry: "",
  exit: "",
  quantity: "",
  strategy: "",
  before: "",
  during: "",
  after: "",
  sl: "",
  target: "",
  rating: ""
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value) => safeNumber(value).toFixed(2);

const weekdayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const getWeekdayFromISODate = (value) => {
  if (!value || typeof value !== "string") {
    return "Unknown";
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return "Unknown";
  }

  return weekdayOrder[new Date(year, month - 1, day).getDay()];
};

const toTradeRecord = (form) => ({
  trade_date: form.date,
  instrument: form.instrument.trim(),
  entry_time: form.entryTime,
  exit_time: form.exitTime,
  entry_price: safeNumber(form.entry),
  exit_price: safeNumber(form.exit),
  quantity: safeNumber(form.quantity),
  strategy: form.strategy.trim(),
  emotion_before: form.before.trim(),
  emotion_during: form.during.trim(),
  emotion_after: form.after.trim(),
  stop_loss: form.sl ? safeNumber(form.sl) : null,
  target: form.target ? safeNumber(form.target) : null,
  rating: form.rating.trim() || null
});

const fromTradeRecord = (trade) => ({
  id: trade.id,
  date: trade.trade_date || "",
  instrument: trade.instrument || "",
  entryTime: trade.entry_time || "",
  exitTime: trade.exit_time || "",
  entry: trade.entry_price?.toString?.() ?? "",
  exit: trade.exit_price?.toString?.() ?? "",
  quantity: trade.quantity?.toString?.() ?? "",
  strategy: trade.strategy || "",
  before: trade.emotion_before || "",
  during: trade.emotion_during || "",
  after: trade.emotion_after || "",
  sl: trade.stop_loss?.toString?.() ?? "",
  target: trade.target?.toString?.() ?? "",
  rating: trade.rating || "",
  pnl: safeNumber(trade.quantity) * (safeNumber(trade.exit_price) - safeNumber(trade.entry_price))
});

const getSortedTrades = (trades) =>
  [...trades].sort((a, b) => {
    const left = `${a.date || ""} ${a.entryTime || "00:00"}`;
    const right = `${b.date || ""} ${b.entryTime || "00:00"}`;
    return left.localeCompare(right);
  });

const buildDailyPnl = (trades) => {
  const grouped = trades.reduce((acc, trade) => {
    const date = trade.date || "Unknown";
    acc[date] = (acc[date] || 0) + safeNumber(trade.pnl);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([date, pnl]) => ({ date, pnl }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const buildEquityCurve = (trades) => {
  let cumulative = 0;

  return getSortedTrades(trades).map((trade, index) => {
    cumulative += safeNumber(trade.pnl);
    return {
      label: trade.date || `Trade ${index + 1}`,
      value: cumulative
    };
  });
};

const buildEmotionStats = (trades, key) => {
  const grouped = trades.reduce((acc, trade) => {
    const emotion = (trade[key] || "").trim();

    if (!emotion) {
      return acc;
    }

    if (!acc[emotion]) {
      acc[emotion] = { emotion, count: 0, total: 0 };
    }

    acc[emotion].count += 1;
    acc[emotion].total += safeNumber(trade.pnl);

    return acc;
  }, {});

  return Object.values(grouped)
    .map((item) => ({
      ...item,
      average: item.count ? item.total / item.count : 0
    }))
    .sort((a, b) => b.average - a.average);
};

const buildGroupedPnlStats = (trades, key, fallback = "Unknown") => {
  const grouped = trades.reduce((acc, trade) => {
    const label = (trade[key] || "").trim() || fallback;

    if (!acc[label]) {
      acc[label] = { label, count: 0, total: 0 };
    }

    acc[label].count += 1;
    acc[label].total += safeNumber(trade.pnl);

    return acc;
  }, {});

  return Object.values(grouped)
    .map((item) => ({
      ...item,
      average: item.count ? item.total / item.count : 0
    }))
    .sort((a, b) => b.total - a.total);
};

const buildWeekdayPnlStats = (trades) => {
  const grouped = trades.reduce((acc, trade) => {
    const weekday = getWeekdayFromISODate(trade.date);

    if (!acc[weekday]) {
      acc[weekday] = { label: weekday, count: 0, total: 0 };
    }

    acc[weekday].count += 1;
    acc[weekday].total += safeNumber(trade.pnl);

    return acc;
  }, {});

  return Object.values(grouped)
    .map((item) => ({
      ...item,
      average: item.count ? item.total / item.count : 0
    }))
    .sort((a, b) => {
      const left = weekdayOrder.indexOf(a.label);
      const right = weekdayOrder.indexOf(b.label);
      return (left === -1 ? Number.MAX_SAFE_INTEGER : left) - (right === -1 ? Number.MAX_SAFE_INTEGER : right);
    });
};

const getAnalysisValue = (trade, type) => {
  if (type === "weekday") {
    return getWeekdayFromISODate(trade.date);
  }

  if (type === "emotion") {
    return (trade.before || "").trim() || "No Emotion";
  }

  if (type === "strategy") {
    return (trade.strategy || "").trim() || "No Strategy";
  }

  return "Unknown";
};

const buildCombinedAnalysisRows = (trades, analysisTypes) => {
  const grouped = trades.reduce((acc, trade) => {
    const labels = analysisTypes.map((type) => getAnalysisValue(trade, type));
    const key = labels.join("||");

    if (!acc[key]) {
      acc[key] = { labels, count: 0, total: 0 };
    }

    acc[key].count += 1;
    acc[key].total += safeNumber(trade.pnl);

    return acc;
  }, {});

  return Object.values(grouped)
    .map((item) => ({
      ...item,
      average: item.count ? item.total / item.count : 0
    }))
    .sort((a, b) => b.total - a.total);
};

const tableWrapperStyle = {
  overflowX: "auto",
  border: "1px solid #dbe4f0",
  borderRadius: "18px",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  background: "transparent"
};

const tableHeadRowStyle = {
  background: "linear-gradient(180deg, #f8fbff 0%, #edf5ff 100%)",
  textAlign: "center"
};

const tableHeadCellStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid #dbe4f0",
  color: "#334155",
  fontSize: "12px",
  fontWeight: "700",
  letterSpacing: "0.04em",
  textTransform: "uppercase"
};

const tableBodyCellStyle = {
  padding: "14px 16px",
  textAlign: "center",
  color: "#1f2937",
  fontSize: "14px",
  borderBottom: "1px solid #edf2f7"
};

const mutedCellStyle = {
  ...tableBodyCellStyle,
  color: "#6b7280"
};

const getStripedRowStyle = (index) => ({
  background: index % 2 === 0 ? "rgba(248, 250, 252, 0.72)" : "rgba(255, 255, 255, 0.96)",
  transition: "background 0.2s ease"
});

const getPnlBadgeStyle = (value) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "88px",
  padding: "6px 12px",
  borderRadius: "999px",
  fontWeight: "700",
  fontSize: "13px",
  color: safeNumber(value) >= 0 ? "#166534" : "#991b1b",
  background: safeNumber(value) >= 0 ? "#dcfce7" : "#fee2e2"
});

const tagStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "5px 10px",
  borderRadius: "999px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: "600"
};

function LineChart({ data, height = 260 }) {
  if (!data.length) {
    return <div style={{ color: "#6b7280", fontSize: "14px" }}>Add some trades to see the equity curve.</div>;
  }

  const width = 900;
  const padding = 28;
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
      const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const lastPoint = data[data.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: `${height}px`, display: "block" }}>
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d7dce2" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d7dce2" />
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#eef1f4" strokeDasharray="4 4" />
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={points} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((point, index) => {
          const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
          const y = height - padding - ((point.value - min) / range) * (height - padding * 2);

          return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="4" fill="#2563eb" />;
        })}
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6b7280", marginTop: "8px", gap: "12px" }}>
        <span>{data[0]?.label}</span>
        <span>Latest Equity: {formatNumber(lastPoint.value)}</span>
        <span>{lastPoint.label}</span>
      </div>
    </div>
  );
}

function BarChart({ data, height = 260 }) {
  if (!data.length) {
    return <div style={{ color: "#6b7280", fontSize: "14px" }}>Daily P&amp;L will appear after you save trades on different dates.</div>;
  }

  const width = 900;
  const padding = 28;
  const values = data.map((item) => item.pnl);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const chartHeight = height - padding * 2;
  const zeroY = padding + ((max - 0) / range) * chartHeight;
  const gap = (width - padding * 2) / data.length;
  const barWidth = Math.max(gap * 0.6, 18);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: `${height}px`, display: "block" }}>
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d7dce2" />
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#cbd5e1" />
        {data.map((item, index) => {
          const x = padding + index * gap + (gap - barWidth) / 2;
          const positiveHeight = (Math.abs(item.pnl) / range) * chartHeight;

          return (
            <rect
              key={`${item.date}-${index}`}
              x={x}
              y={item.pnl >= 0 ? zeroY - positiveHeight : zeroY}
              width={barWidth}
              height={positiveHeight}
              rx="6"
              fill={item.pnl >= 0 ? "#22c55e" : "#ef4444"}
            />
          );
        })}
      </svg>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(data.length, 6)}, minmax(0, 1fr))`,
          gap: "8px",
          fontSize: "12px",
          color: "#6b7280",
          marginTop: "8px"
        }}
      >
        {data.slice(Math.max(data.length - 6, 0)).map((item) => (
          <div key={item.date}>{item.date}</div>
        ))}
      </div>
    </div>
  );
}

function SummaryTable({ title, nameLabel, rows, emptyMessage }) {
  return (
    <div
      style={{
        border: "1px solid #dbe4f0",
        borderRadius: "18px",
        overflow: "hidden",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)"
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          background: "linear-gradient(180deg, #f8fbff 0%, #edf5ff 100%)",
          fontWeight: "bold",
          color: "#0f172a"
        }}
      >
        {title}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={tableHeadRowStyle}>
              <th style={tableHeadCellStyle}>{nameLabel}</th>
              <th style={tableHeadCellStyle}>Trades</th>
              <th style={tableHeadCellStyle}>Avg P&amp;L</th>
              <th style={tableHeadCellStyle}>Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ ...mutedCellStyle, padding: "18px 16px" }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.label}-${index}`} style={getStripedRowStyle(index)}>
                  <td style={tableBodyCellStyle}>
                    <span style={tagStyle}>{row.label}</span>
                  </td>
                  <td style={tableBodyCellStyle}>{row.count}</td>
                  <td style={tableBodyCellStyle}>
                    <span style={getPnlBadgeStyle(row.average)}>{formatNumber(row.average)}</span>
                  </td>
                  <td style={tableBodyCellStyle}>
                    <span style={getPnlBadgeStyle(row.total)}>{formatNumber(row.total)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CombinedAnalysisTable({ title, columnLabels, rows, emptyMessage }) {
  return (
    <div
      style={{
        border: "1px solid #dbe4f0",
        borderRadius: "18px",
        overflow: "hidden",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)"
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          background: "linear-gradient(180deg, #f8fbff 0%, #edf5ff 100%)",
          fontWeight: "bold",
          color: "#0f172a"
        }}
      >
        {title}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={tableHeadRowStyle}>
              {columnLabels.map((label) => (
                <th key={label} style={tableHeadCellStyle}>
                  {label}
                </th>
              ))}
              <th style={tableHeadCellStyle}>Trades</th>
              <th style={tableHeadCellStyle}>Avg P&amp;L</th>
              <th style={tableHeadCellStyle}>Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnLabels.length + 3} style={{ ...mutedCellStyle, padding: "18px 16px" }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.labels.join("-")}-${index}`} style={getStripedRowStyle(index)}>
                  {row.labels.map((label, labelIndex) => (
                    <td key={`${label}-${labelIndex}`} style={tableBodyCellStyle}>
                      <span style={tagStyle}>{label}</span>
                    </td>
                  ))}
                  <td style={tableBodyCellStyle}>{row.count}</td>
                  <td style={tableBodyCellStyle}>
                    <span style={getPnlBadgeStyle(row.average)}>{formatNumber(row.average)}</span>
                  </td>
                  <td style={tableBodyCellStyle}>
                    <span style={getPnlBadgeStyle(row.total)}>{formatNumber(row.total)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsPage({ trades, btn, onBack }) {
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    instrument: "",
    strategy: ""
  });
  const [analysisTypes, setAnalysisTypes] = useState(["weekday"]);
  const [analysisDisplayMode, setAnalysisDisplayMode] = useState("combined");
  const [expandedSections, setExpandedSections] = useState([]);

  const instruments = [...new Set(trades.map((trade) => (trade.instrument || "").trim()).filter(Boolean))].sort();
  const strategies = [...new Set(trades.map((trade) => (trade.strategy || "").trim()).filter(Boolean))].sort();

  const filteredTrades = trades.filter((trade) => {
    const matchesStartDate = !filters.startDate || (trade.date && trade.date >= filters.startDate);
    const matchesEndDate = !filters.endDate || (trade.date && trade.date <= filters.endDate);
    const matchesInstrument = !filters.instrument || trade.instrument === filters.instrument;
    const matchesStrategy = !filters.strategy || trade.strategy === filters.strategy;

    return matchesStartDate && matchesEndDate && matchesInstrument && matchesStrategy;
  });

  const dailyPnl = buildDailyPnl(filteredTrades);
  const equityCurve = buildEquityCurve(filteredTrades);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const analysisLabelMap = {
    weekday: "Weekday",
    emotion: "Emotion",
    strategy: "Strategy"
  };
  const combinedAnalysisRows = buildCombinedAnalysisRows(filteredTrades, analysisTypes);
  const combinedAnalysisTitle = `${analysisTypes.map((type) => analysisLabelMap[type]).join(" + ")} P&L`;
  const separateAnalysisConfigs = analysisTypes.map((type) => {
    if (type === "weekday") {
      return {
        key: type,
        title: "Weekday Wise P&L",
        nameLabel: "Weekday",
        rows: buildWeekdayPnlStats(filteredTrades),
        emptyMessage: "No weekday trade data yet."
      };
    }

    if (type === "emotion") {
      return {
        key: type,
        title: "Emotion Wise P&L",
        nameLabel: "Emotion",
        rows: buildEmotionStats(filteredTrades, "before").map((row) => ({
          label: row.emotion,
          count: row.count,
          average: row.average,
          total: row.total
        })),
        emptyMessage: "No emotion data yet."
      };
    }

    return {
      key: type,
      title: "Strategy Wise P&L",
      nameLabel: "Strategy",
      rows: buildGroupedPnlStats(filteredTrades, "strategy", "No Strategy"),
      emptyMessage: "No strategy data yet."
    };
  });

  const card = {
    border: "1px solid #dcdde1",
    borderRadius: "16px",
    padding: "18px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)"
  };

  const sectionTitle = {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "8px"
  };

  const filterCard = {
    ...card,
    marginBottom: "20px",
    padding: "16px 18px"
  };

  const filterLabel = {
    fontSize: "12px",
    fontWeight: "600",
    color: "#475569",
    marginBottom: "6px"
  };

  const filterInput = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #dbe4f0",
    borderRadius: "12px",
    fontSize: "13px",
    background: "#ffffff",
    color: "#0f172a",
    boxSizing: "border-box"
  };

  const toggleButtonStyle = (active) => ({
    padding: "10px 14px",
    borderRadius: "999px",
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#dbeafe" : "#ffffff",
    color: active ? "#1d4ed8" : "#334155",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer"
  });

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "20px auto",
        background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
        padding: "24px",
        borderRadius: "20px",
        fontFamily: "Arial"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Analytics Dashboard</h2>
          <div style={{ marginTop: "6px", color: "#64748b", fontSize: "14px" }}>
            Track performance, daily consistency, account growth, and emotional patterns.
          </div>
        </div>
        <button onClick={onBack} style={{ ...btn, background: "#2e86de", color: "white" }}>
          Go to Trade Journal
        </button>
      </div>

      <div style={filterCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>Filters</div>
            <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
              Narrow the dashboard to the trades you want to analyze.
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({ startDate: "", endDate: "", instrument: "", strategy: "" })}
              style={{ ...btn, background: "#e2e8f0", color: "#1e293b", boxShadow: "none" }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px"
          }}
        >
          <div>
            <div style={filterLabel}>From Date</div>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              style={filterInput}
            />
          </div>
          <div>
            <div style={filterLabel}>To Date</div>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              style={filterInput}
            />
          </div>
          <div>
            <div style={filterLabel}>Instrument</div>
            <select
              value={filters.instrument}
              onChange={(e) => setFilters({ ...filters, instrument: e.target.value })}
              style={filterInput}
            >
              <option value="">All Instruments</option>
              {instruments.map((instrument) => (
                <option key={instrument} value={instrument}>
                  {instrument}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={filterLabel}>Strategy</div>
            <select
              value={filters.strategy}
              onChange={(e) => setFilters({ ...filters, strategy: e.target.value })}
              style={filterInput}
            >
              <option value="">All Strategies</option>
              {strategies.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: "12px", color: "#64748b", fontSize: "13px" }}>
          Showing <strong style={{ color: "#0f172a" }}>{filteredTrades.length}</strong> of <strong style={{ color: "#0f172a" }}>{trades.length}</strong> trades
        </div>
      </div>

      <div style={{ ...card, marginBottom: "24px", padding: "16px 18px" }}>
        <div style={filterLabel}>Extra Sections</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {[
            { key: "dailyPnl", label: "Daily P&L" },
            { key: "equityCurve", label: "Equity Curve" }
          ].map((option) => {
            const isActive = expandedSections.includes(option.key);

            return (
              <button
                key={option.key}
                type="button"
                style={toggleButtonStyle(isActive)}
                onClick={() =>
                  setExpandedSections((current) =>
                    current.includes(option.key) ? current.filter((item) => item !== option.key) : [...current, option.key]
                  )
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {expandedSections.includes("dailyPnl") && (
        <div style={{ ...card, marginBottom: "24px" }}>
          <div style={sectionTitle}>Daily P&amp;L</div>
          <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "14px" }}>
            Each bar shows total profit or loss for that date.
          </div>
          <BarChart data={dailyPnl} />
        </div>
      )}

      {expandedSections.includes("equityCurve") && (
        <div style={{ ...card, marginBottom: "24px" }}>
          <div style={sectionTitle}>Equity Curve</div>
          <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "14px" }}>
            This line shows how your cumulative P&amp;L changes trade by trade.
          </div>
          <LineChart data={equityCurve} />
        </div>
      )}

      <div style={{ marginBottom: "24px" }}>
        <div style={{ ...sectionTitle, marginBottom: "14px" }}>P&amp;L Analysis</div>
        <div style={{ ...card, marginBottom: "16px", padding: "16px 18px" }}>
          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <div style={filterLabel}>Display Mode</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <button
                  type="button"
                  style={toggleButtonStyle(analysisDisplayMode === "combined")}
                  onClick={() => setAnalysisDisplayMode("combined")}
                >
                  One Table
                </button>
                <button
                  type="button"
                  style={toggleButtonStyle(analysisDisplayMode === "separate")}
                  onClick={() => setAnalysisDisplayMode("separate")}
                >
                  Different Tables
                </button>
              </div>
            </div>

            <div>
              <div style={filterLabel}>Analysis Types</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {[
                  { key: "weekday", label: "Weekday Wise" },
                  { key: "emotion", label: "Emotion Wise" },
                  { key: "strategy", label: "Strategy Wise" }
                ].map((option) => {
                  const isActive = analysisTypes.includes(option.key);

                  return (
                    <button
                      key={option.key}
                      type="button"
                      style={toggleButtonStyle(isActive)}
                      onClick={() =>
                        setAnalysisTypes((current) => {
                          if (current.includes(option.key)) {
                            return current.length === 1 ? current : current.filter((type) => type !== option.key);
                          }

                          return [...current, option.key];
                        })
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {analysisDisplayMode === "combined" ? (
          <CombinedAnalysisTable
            title={combinedAnalysisTitle}
            columnLabels={analysisTypes.map((type) => analysisLabelMap[type])}
            rows={combinedAnalysisRows}
            emptyMessage="No grouped trade data matches the current filters."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "16px"
            }}
          >
            {separateAnalysisConfigs.map((analysis) => (
              <SummaryTable
                key={analysis.key}
                title={analysis.title}
                nameLabel={analysis.nameLabel}
                rows={analysis.rows}
                emptyMessage={analysis.emptyMessage}
              />
            ))}
          </div>
        )}
      </div>

      <div style={tableWrapperStyle}>
        <table style={{ ...tableStyle, minWidth: "900px" }}>
          <thead>
            <tr style={tableHeadRowStyle}>
              <th style={tableHeadCellStyle}>Date</th>
              <th style={tableHeadCellStyle}>Instrument</th>
              <th style={tableHeadCellStyle}>Strategy</th>
              <th style={tableHeadCellStyle}>Qty</th>
              <th style={tableHeadCellStyle}>Entry Price</th>
              <th style={tableHeadCellStyle}>Exit Price</th>
              <th style={tableHeadCellStyle}>Rating</th>
              <th style={tableHeadCellStyle}>P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ ...mutedCellStyle, padding: "18px 16px" }}>
                  No trades match the current filters.
                </td>
              </tr>
            ) : (
              getSortedTrades(filteredTrades).map((trade, index) => (
                <tr key={trade.id || index} style={getStripedRowStyle(index)}>
                  <td style={tableBodyCellStyle}>{trade.date}</td>
                  <td style={tableBodyCellStyle}>
                    <span style={tagStyle}>{trade.instrument}</span>
                  </td>
                  <td style={tableBodyCellStyle}>{trade.strategy}</td>
                  <td style={tableBodyCellStyle}>{trade.quantity}</td>
                  <td style={tableBodyCellStyle}>{trade.entry}</td>
                  <td style={tableBodyCellStyle}>{trade.exit}</td>
                  <td style={tableBodyCellStyle}>{trade.rating || "-"}</td>
                  <td style={tableBodyCellStyle}>
                    <span style={getPnlBadgeStyle(trade.pnl)}>{formatNumber(trade.pnl)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JournalPage({
  userEmail,
  form,
  strategies,
  emotions,
  trades,
  editingTradeId,
  showStrategyBox,
  showEmotionBox,
  newStrategy,
  newEmotion,
  handleChange,
  saveTrade,
  cancelEditTrade,
  startEditTrade,
  deleteTrade,
  setShowStrategyBox,
  setShowEmotionBox,
  setNewStrategy,
  setNewEmotion,
  addStrategy,
  addEmotion,
  deleteStrategy,
  deleteEmotion,
  btn,
  input,
  field,
  row,
  onGoToAnalytics,
  onSignOut,
  isSaving,
  errorMessage
}) {
  const pageShell = {
    maxWidth: "1200px",
    margin: "20px auto",
    background: "linear-gradient(180deg, #f7fbff 0%, #ffffff 100%)",
    padding: "24px",
    borderRadius: "24px",
    fontFamily: "Arial",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.07)"
  };

  const heroCard = {
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f0fdf4 100%)",
    border: "1px solid #dbeafe",
    borderRadius: "22px",
    padding: "24px",
    marginBottom: "22px",
    boxShadow: "0 14px 32px rgba(37, 99, 235, 0.08)"
  };

  const formCard = {
    background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
    border: "1px solid #dbe4f0",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)"
  };

  const sectionTitle = {
    fontSize: "13px",
    fontWeight: "700",
    color: "#1d4ed8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "16px"
  };

  const managerBox = {
    marginBottom: "18px",
    border: "1px solid #dbe4f0",
    borderRadius: "18px",
    background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
    padding: "16px"
  };

  const managerRow = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "10px",
    alignItems: "center",
    marginBottom: "12px"
  };

  const chipList = {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px"
  };

  const chip = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1e3a8a",
    fontSize: "13px",
    fontWeight: "600",
    border: "1px solid #dbeafe"
  };

  const chipDelete = {
    border: "none",
    background: "#dbeafe",
    color: "#1d4ed8",
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700"
  };

  const labelStyle = {
    fontSize: "13px",
    fontWeight: "600",
    color: "#475569",
    letterSpacing: "0.01em"
  };

  const actionBtnStyle = {
    border: "none",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer"
  };

  return (
    <div style={pageShell}>
      <div style={heroCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#2563eb", fontSize: "12px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
              Signed in as {userEmail}
            </div>
            <h2 style={{ margin: 0, fontSize: "32px", color: "#0f172a" }}>Trade Journal</h2>
            <p style={{ margin: "8px 0 0", color: "#475569", fontSize: "15px", maxWidth: "720px", lineHeight: 1.6 }}>
              Capture each trade with structure, context, and emotion so your journal becomes a tool for sharper decisions.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={onGoToAnalytics} style={{ ...btn, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white" }}>
              Go to Analytics
            </button>
            <button onClick={onSignOut} style={{ ...btn, background: "#e2e8f0", color: "#1e293b", boxShadow: "none" }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div style={{ marginBottom: "18px", padding: "14px 16px", borderRadius: "16px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          {errorMessage}
        </div>
      )}

      <div style={formCard}>
        <div style={sectionTitle}>Trade Details</div>

        <div style={row}>
          <div style={field}>
            <label style={labelStyle}>Date *</label>
            <input name="date" value={form.date} onChange={handleChange} style={input} type="date" />
          </div>
          <div style={field}>
            <label style={labelStyle}>Instrument *</label>
            <input
              name="instrument"
              value={form.instrument}
              onChange={handleChange}
              style={{ ...input, fontSize: "13px" }}
              placeholder="NIFTY, BANKNIFTY, RELIANCE..."
            />
          </div>
        </div>

        <div style={row}>
          <div style={field}>
            <label style={labelStyle}>Entry Time *</label>
            <input name="entryTime" value={form.entryTime} onChange={handleChange} style={input} type="time" />
          </div>
          <div style={field}>
            <label style={labelStyle}>Exit Time *</label>
            <input name="exitTime" value={form.exitTime} onChange={handleChange} style={input} type="time" />
          </div>
        </div>

        <div style={row}>
          <div style={field}>
            <label style={labelStyle}>Entry Price *</label>
            <input name="entry" value={form.entry} onChange={handleChange} style={input} placeholder="Enter entry price" />
          </div>
          <div style={field}>
            <label style={labelStyle}>Exit Price *</label>
            <input name="exit" value={form.exit} onChange={handleChange} style={input} placeholder="Enter exit price" />
          </div>
        </div>

        <div style={row}>
          <div style={field}>
            <label style={labelStyle}>Quantity *</label>
            <input name="quantity" value={form.quantity} onChange={handleChange} style={input} placeholder="Number of units" />
          </div>
          <div style={field}>
            <label style={labelStyle}>Strategy *</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 48px", gap: "10px" }}>
              <select name="strategy" value={form.strategy} onChange={handleChange} style={input}>
                <option value="">Select strategy</option>
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.name}>
                    {strategy.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                style={{ ...btn, background: "linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)", color: "white", padding: "0" }}
                onClick={() => setShowStrategyBox(!showStrategyBox)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {showStrategyBox && (
          <div style={managerBox}>
            <div style={managerRow}>
              <input value={newStrategy} onChange={(e) => setNewStrategy(e.target.value)} placeholder="Add a new strategy" style={input} />
              <button type="button" onClick={addStrategy} style={{ ...btn, background: "#2563eb", color: "white" }}>
                Add
              </button>
            </div>

            <div style={chipList}>
              {strategies.map((strategy) => (
                <div key={strategy.id} style={chip}>
                  <span>{strategy.name}</span>
                  <button type="button" onClick={() => deleteStrategy(strategy.id)} style={chipDelete}>
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ ...sectionTitle, marginTop: "10px" }}>Mindset Snapshot</div>

        <div style={row}>
          <div style={field}>
            <label style={labelStyle}>Emotion Before Trade</label>
            <select name="before" value={form.before} onChange={handleChange} style={input}>
              <option value="">Select emotion</option>
              {emotions.map((emotion) => (
                <option key={emotion.id} value={emotion.name}>
                  {emotion.name}
                </option>
              ))}
            </select>
          </div>
          <div style={field}>
            <label style={labelStyle}>Emotion During Trade</label>
            <select name="during" value={form.during} onChange={handleChange} style={input}>
              <option value="">Select emotion</option>
              {emotions.map((emotion) => (
                <option key={emotion.id} value={emotion.name}>
                  {emotion.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={row}>
          <div style={field}>
            <label style={labelStyle}>Emotion After Trade</label>
            <select name="after" value={form.after} onChange={handleChange} style={input}>
              <option value="">Select emotion</option>
              {emotions.map((emotion) => (
                <option key={emotion.id} value={emotion.name}>
                  {emotion.name}
                </option>
              ))}
            </select>
          </div>
          <div style={field}>
            <label style={labelStyle}>Emotion Library</label>
            <button
              type="button"
              style={{ ...btn, background: "linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)", color: "white", height: "48px" }}
              onClick={() => setShowEmotionBox(!showEmotionBox)}
            >
              Manage Emotions
            </button>
          </div>
        </div>

        {showEmotionBox && (
          <div style={managerBox}>
            <div style={managerRow}>
              <input value={newEmotion} onChange={(e) => setNewEmotion(e.target.value)} placeholder="Add a new emotion" style={input} />
              <button type="button" onClick={addEmotion} style={{ ...btn, background: "#2563eb", color: "white" }}>
                Add
              </button>
            </div>

            <div style={chipList}>
              {emotions.map((emotion) => (
                <div key={emotion.id} style={chip}>
                  <span>{emotion.name}</span>
                  <button type="button" onClick={() => deleteEmotion(emotion.id)} style={chipDelete}>
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ ...sectionTitle, marginTop: "10px" }}>Risk and Review</div>

        <div style={row}>
          <div style={field}>
            <label style={labelStyle}>Stop Loss</label>
            <input name="sl" value={form.sl} onChange={handleChange} style={input} placeholder="Planned stop loss" />
          </div>
          <div style={field}>
            <label style={labelStyle}>Target</label>
            <input name="target" value={form.target} onChange={handleChange} style={input} placeholder="Planned target" />
          </div>
        </div>

        <div style={row}>
          <div style={field}>
            <label style={labelStyle}>Rating</label>
            <input name="rating" value={form.rating} onChange={handleChange} style={input} placeholder="Rate the trade quality" />
          </div>
        </div>

        <button
          onClick={saveTrade}
          disabled={isSaving}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
            color: "white",
            marginTop: "18px",
            opacity: isSaving ? 0.7 : 1,
            ...btn
          }}
        >
          {isSaving ? "Saving..." : editingTradeId === null ? "Save Trade" : "Update Trade"}
        </button>

        {editingTradeId !== null && (
          <button
            type="button"
            onClick={cancelEditTrade}
            style={{
              width: "100%",
              background: "#e2e8f0",
              color: "#1e293b",
              marginTop: "10px",
              boxShadow: "none",
              ...btn
            }}
          >
            Cancel Edit
          </button>
        )}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ color: "#0f172a", marginBottom: "14px" }}>Saved Trades</h3>

        {trades.length === 0 ? (
          <p style={{ color: "#666", fontSize: "14px" }}>No trades saved yet.</p>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: "1200px" }}>
              <thead>
                <tr style={tableHeadRowStyle}>
                  <th style={tableHeadCellStyle}>Date</th>
                  <th style={tableHeadCellStyle}>Instrument</th>
                  <th style={tableHeadCellStyle}>Entry Time</th>
                  <th style={tableHeadCellStyle}>Exit Time</th>
                  <th style={tableHeadCellStyle}>Entry</th>
                  <th style={tableHeadCellStyle}>Exit</th>
                  <th style={tableHeadCellStyle}>Qty</th>
                  <th style={tableHeadCellStyle}>Strategy</th>
                  <th style={tableHeadCellStyle}>Before</th>
                  <th style={tableHeadCellStyle}>Rating</th>
                  <th style={tableHeadCellStyle}>P&amp;L</th>
                  <th style={tableHeadCellStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {getSortedTrades(trades).map((trade, index) => (
                  <tr key={trade.id} style={getStripedRowStyle(index)}>
                    <td style={tableBodyCellStyle}>{trade.date}</td>
                    <td style={tableBodyCellStyle}>
                      <span style={tagStyle}>{trade.instrument}</span>
                    </td>
                    <td style={tableBodyCellStyle}>{trade.entryTime}</td>
                    <td style={tableBodyCellStyle}>{trade.exitTime}</td>
                    <td style={tableBodyCellStyle}>{trade.entry}</td>
                    <td style={tableBodyCellStyle}>{trade.exit}</td>
                    <td style={tableBodyCellStyle}>{trade.quantity}</td>
                    <td style={tableBodyCellStyle}>{trade.strategy}</td>
                    <td style={tableBodyCellStyle}>{trade.before || "-"}</td>
                    <td style={tableBodyCellStyle}>{trade.rating || "-"}</td>
                    <td style={tableBodyCellStyle}>
                      <span style={getPnlBadgeStyle(trade.pnl)}>{formatNumber(trade.pnl)}</span>
                    </td>
                    <td style={tableBodyCellStyle}>
                      <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => startEditTrade(trade.id)}
                          style={{ ...actionBtnStyle, background: "#dbeafe", color: "#1d4ed8" }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTrade(trade.id)}
                          style={{ ...actionBtnStyle, background: "#fee2e2", color: "#b91c1c" }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthPage({ authMode, setAuthMode, email, setEmail, password, setPassword, onSubmit, isSubmitting, errorMessage }) {
  const card = {
    maxWidth: "460px",
    margin: "80px auto",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid #dbe4f0",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 18px 44px rgba(15, 23, 42, 0.08)",
    fontFamily: "Arial"
  };

  const input = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #dbe4f0",
    background: "#ffffff",
    fontSize: "14px",
    boxSizing: "border-box"
  };

  const primaryButton = {
    width: "100%",
    border: "none",
    borderRadius: "14px",
    padding: "14px 18px",
    background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
    color: "white",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer"
  };

  const ghostButton = {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontWeight: "700",
    cursor: "pointer"
  };

  return (
    <div style={{ minHeight: "100vh", padding: "24px", background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)" }}>
      <div style={card}>
        <div style={{ color: "#2563eb", fontSize: "12px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>
          Public App Login
        </div>
        <h1 style={{ margin: 0, color: "#0f172a" }}>Trade Journal</h1>
        <p style={{ color: "#475569", lineHeight: 1.6, fontSize: "14px", marginTop: "10px" }}>
          {authMode === "signin"
            ? "Sign in to access your personal journal, analytics, and cloud-saved trades."
            : "Create your account so your trades are stored online and available from any device."}
        </p>

        {errorMessage && (
          <div style={{ marginTop: "16px", padding: "12px 14px", borderRadius: "14px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: "grid", gap: "14px", marginTop: "20px" }}>
          <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
          <button type="button" onClick={onSubmit} disabled={isSubmitting} style={{ ...primaryButton, opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? "Please wait..." : authMode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </div>

        <div style={{ marginTop: "18px", fontSize: "14px", color: "#475569" }}>
          {authMode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button type="button" style={ghostButton} onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
            {authMode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupRequiredPage() {
  return (
    <div style={{ minHeight: "100vh", padding: "24px", background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)", fontFamily: "Arial" }}>
      <div
        style={{
          maxWidth: "720px",
          margin: "60px auto",
          background: "white",
          border: "1px solid #dbe4f0",
          borderRadius: "24px",
          padding: "28px",
          boxShadow: "0 18px 44px rgba(15, 23, 42, 0.08)"
        }}
      >
        <h1 style={{ marginTop: 0 }}>Supabase Setup Required</h1>
        <p style={{ color: "#475569", lineHeight: 1.6 }}>
          This app now expects Supabase credentials so users can sign in and store trades online.
        </p>
        <div style={{ background: "#f8fafc", borderRadius: "16px", padding: "16px", border: "1px solid #e2e8f0", color: "#0f172a" }}>
          <div style={{ fontWeight: "700", marginBottom: "8px" }}>Add these variables to your `.env` file:</div>
          <div style={{ fontFamily: "monospace", fontSize: "14px", whiteSpace: "pre-wrap" }}>
            VITE_SUPABASE_URL=your-project-url{"\n"}VITE_SUPABASE_ANON_KEY=your-anon-key
          </div>
        </div>
        <p style={{ color: "#475569", lineHeight: 1.6, marginTop: "16px" }}>
          After adding them, restart the dev server and create the database tables from the SQL file included with this project.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("journal");
  const [session, setSession] = useState(null);
  const [trades, setTrades] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [emotions, setEmotions] = useState([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showStrategyBox, setShowStrategyBox] = useState(false);
  const [showEmotionBox, setShowEmotionBox] = useState(false);
  const [newStrategy, setNewStrategy] = useState("");
  const [newEmotion, setNewEmotion] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingTradeId, setEditingTradeId] = useState(null);

  const row = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    columnGap: "18px",
    rowGap: "20px",
    marginBottom: "18px"
  };

  const field = {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  };

  const input = {
    padding: "14px 16px",
    border: "1px solid #dbe4f0",
    borderRadius: "14px",
    fontSize: "14px",
    color: "#0f172a",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxSizing: "border-box",
    width: "100%"
  };

  const btn = {
    padding: "13px 18px",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "700",
    boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)"
  };

  const fetchAllUserData = async (userId) => {
    if (!supabase || !userId) {
      return;
    }

    setErrorMessage("");

    const [{ data: tradeRows, error: tradesError }, { data: strategyRows, error: strategiesError }, { data: emotionRows, error: emotionsError }] =
      await Promise.all([
        supabase
          .from("trades")
          .select("*")
          .eq("user_id", userId)
          .order("trade_date", { ascending: true })
          .order("entry_time", { ascending: true }),
        supabase.from("strategies").select("id, name").eq("user_id", userId).order("name", { ascending: true }),
        supabase.from("emotions").select("id, name").eq("user_id", userId).order("name", { ascending: true })
      ]);

    if (tradesError || strategiesError || emotionsError) {
      setErrorMessage(tradesError?.message || strategiesError?.message || emotionsError?.message || "Failed to load your account data.");
      return;
    }

    setTrades((tradeRows || []).map(fromTradeRecord));
    setStrategies(strategyRows || []);
    setEmotions(emotionRows || []);
  };

  useEffect(() => {
    if (!supabase) {
      setIsBootstrapping(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
      }

      setSession(data.session ?? null);
      setIsBootstrapping(false);

      if (data.session?.user?.id) {
        fetchAllUserData(data.session.user.id);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setTrades([]);
      setStrategies([]);
      setEmotions([]);
      setForm(emptyForm);
      setEditingTradeId(null);
      setErrorMessage("");

      if (nextSession?.user?.id) {
        fetchAllUserData(nextSession.user.id);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAuth = async () => {
    if (!supabase) {
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Enter your email and password.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const authAction =
      authMode === "signin"
        ? supabase.auth.signInWithPassword({ email: email.trim(), password })
        : supabase.auth.signUp({ email: email.trim(), password });

    const { error } = await authAction;

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (authMode === "signup") {
      setErrorMessage("Account created. Check your email if your Supabase project requires email confirmation.");
    }
  };

  const saveTrade = async () => {
    if (!supabase || !session?.user?.id) {
      return;
    }

    if (
      !form.date ||
      !form.instrument.trim() ||
      !form.entryTime ||
      !form.exitTime ||
      !form.entry ||
      !form.exit ||
      !form.quantity ||
      !form.strategy.trim()
    ) {
      setErrorMessage("Fill all required trade fields.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const payload = {
      user_id: session.user.id,
      ...toTradeRecord(form)
    };

    const query = editingTradeId
      ? supabase.from("trades").update(payload).eq("id", editingTradeId).eq("user_id", session.user.id).select().single()
      : supabase.from("trades").insert(payload).select().single();

    const { data, error } = await query;

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const normalizedTrade = fromTradeRecord(data);

    if (editingTradeId) {
      setTrades((current) => current.map((trade) => (trade.id === editingTradeId ? normalizedTrade : trade)));
      setEditingTradeId(null);
    } else {
      setTrades((current) => [...current, normalizedTrade]);
    }

    setForm(emptyForm);
  };

  const startEditTrade = (tradeId) => {
    const trade = trades.find((item) => item.id === tradeId);

    if (!trade) {
      return;
    }

    setForm({
      date: trade.date,
      instrument: trade.instrument,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
      entry: trade.entry,
      exit: trade.exit,
      quantity: trade.quantity,
      strategy: trade.strategy,
      before: trade.before,
      during: trade.during,
      after: trade.after,
      sl: trade.sl,
      target: trade.target,
      rating: trade.rating
    });
    setEditingTradeId(tradeId);
    setPage("journal");
  };

  const cancelEditTrade = () => {
    setForm(emptyForm);
    setEditingTradeId(null);
  };

  const deleteTrade = async (tradeId) => {
    if (!supabase || !session?.user?.id) {
      return;
    }

    const shouldDelete = window.confirm("Are you sure you want to delete this trade?");

    if (!shouldDelete) {
      return;
    }

    setErrorMessage("");
    const { error } = await supabase.from("trades").delete().eq("id", tradeId).eq("user_id", session.user.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setTrades((current) => current.filter((trade) => trade.id !== tradeId));

    if (editingTradeId === tradeId) {
      setForm(emptyForm);
      setEditingTradeId(null);
    }
  };

  const addStrategy = async () => {
    if (!supabase || !session?.user?.id) {
      return;
    }

    const name = newStrategy.trim();

    if (!name || strategies.some((strategy) => strategy.name.toLowerCase() === name.toLowerCase())) {
      return;
    }

    const { data, error } = await supabase.from("strategies").insert({ user_id: session.user.id, name }).select("id, name").single();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStrategies((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewStrategy("");
  };

  const deleteStrategy = async (strategyId) => {
    if (!supabase || !session?.user?.id) {
      return;
    }

    const { error } = await supabase.from("strategies").delete().eq("id", strategyId).eq("user_id", session.user.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStrategies((current) => current.filter((strategy) => strategy.id !== strategyId));
  };

  const addEmotion = async () => {
    if (!supabase || !session?.user?.id) {
      return;
    }

    const name = newEmotion.trim();

    if (!name || emotions.some((emotion) => emotion.name.toLowerCase() === name.toLowerCase())) {
      return;
    }

    const { data, error } = await supabase.from("emotions").insert({ user_id: session.user.id, name }).select("id, name").single();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEmotions((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewEmotion("");
  };

  const deleteEmotion = async (emotionId) => {
    if (!supabase || !session?.user?.id) {
      return;
    }

    const { error } = await supabase.from("emotions").delete().eq("id", emotionId).eq("user_id", session.user.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEmotions((current) => current.filter((emotion) => emotion.id !== emotionId));
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setPage("journal");
  };

  if (!supabase) {
    return <SetupRequiredPage />;
  }

  if (isBootstrapping) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial", color: "#334155" }}>
        Loading your trade journal...
      </div>
    );
  }

  if (!session) {
    return (
      <AuthPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        onSubmit={handleAuth}
        isSubmitting={isSaving}
        errorMessage={errorMessage}
      />
    );
  }

  if (page === "analytics") {
    return <AnalyticsPage trades={trades} btn={btn} onBack={() => setPage("journal")} />;
  }

  return (
    <JournalPage
      userEmail={session.user.email}
      form={form}
      strategies={strategies}
      emotions={emotions}
      trades={trades}
      editingTradeId={editingTradeId}
      showStrategyBox={showStrategyBox}
      showEmotionBox={showEmotionBox}
      newStrategy={newStrategy}
      newEmotion={newEmotion}
      handleChange={handleChange}
      saveTrade={saveTrade}
      cancelEditTrade={cancelEditTrade}
      startEditTrade={startEditTrade}
      deleteTrade={deleteTrade}
      setShowStrategyBox={setShowStrategyBox}
      setShowEmotionBox={setShowEmotionBox}
      setNewStrategy={setNewStrategy}
      setNewEmotion={setNewEmotion}
      addStrategy={addStrategy}
      addEmotion={addEmotion}
      deleteStrategy={deleteStrategy}
      deleteEmotion={deleteEmotion}
      btn={btn}
      input={input}
      field={field}
      row={row}
      onGoToAnalytics={() => setPage("analytics")}
      onSignOut={signOut}
      isSaving={isSaving}
      errorMessage={errorMessage}
    />
  );
}
