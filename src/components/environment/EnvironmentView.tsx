import React, { useState, useRef, useEffect } from 'react';
import type { TelemetryData, TimeRange, HistoricalLogEntry, RangeDataset } from '../../types/sonar';

interface EnvironmentViewProps {
  telemetry: TelemetryData;
}

const envHistoricalData: Record<TimeRange, RangeDataset> = {
  '1h': {
    times: ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50', '11:00'],
    soundSpeed: [1568, 1569, 1572, 1567, 1570, 1571, 1573],
    temperature: [26.4, 26.5, 26.8, 26.6, 26.7, 26.9, 27.0],
  },
  '6h': {
    times: ['05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00'],
    soundSpeed: [1565, 1567, 1570, 1568, 1569, 1572, 1570],
    temperature: [25.9, 26.1, 26.4, 26.5, 26.6, 26.8, 26.7],
  },
  '24h': {
    times: ['12:00', '16:00', '20:00', '00:00', '04:00', '08:00', '11:00'],
    soundSpeed: [1573, 1571, 1567, 1564, 1563, 1568, 1570],
    temperature: [27.2, 26.9, 26.3, 25.8, 25.6, 26.2, 26.7],
  },
  '7d': {
    times: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    soundSpeed: [1566, 1568, 1573, 1571, 1569, 1572, 1570],
    temperature: [26.0, 26.3, 27.1, 26.8, 26.5, 26.9, 26.7],
  },
};

const initialLogEntries: HistoricalLogEntry[] = [
  { time: '11:00:24', depthProxy: '29.93 m', temp: '26.7 °C', turbidity: '12.4 NTU', salinityProxy: '33.3 PSU', soundVel: '1570 m/s', status: 'LFM 100 kHz Active' },
  { time: '10:30:18', depthProxy: '29.89 m', temp: '26.6 °C', turbidity: '12.2 NTU', salinityProxy: '33.3 PSU', soundVel: '1569 m/s', status: 'LFM 100 kHz Active' },
  { time: '10:00:15', depthProxy: '29.85 m', temp: '26.8 °C', turbidity: '12.5 NTU', salinityProxy: '33.2 PSU', soundVel: '1571 m/s', status: 'LFM 100 kHz Active' },
  { time: '09:30:42', depthProxy: '29.82 m', temp: '26.5 °C', turbidity: '12.1 NTU', salinityProxy: '33.4 PSU', soundVel: '1568 m/s', status: 'LFM 100 kHz Active' },
  { time: '09:00:10', depthProxy: '29.78 m', temp: '26.4 °C', turbidity: '11.9 NTU', salinityProxy: '33.3 PSU', soundVel: '1567 m/s', status: 'LFM 100 kHz Active' },
  { time: '08:30:55', depthProxy: '29.74 m', temp: '26.2 °C', turbidity: '11.8 NTU', salinityProxy: '33.5 PSU', soundVel: '1565 m/s', status: 'LFM 100 kHz Active' },
  { time: '08:00:20', depthProxy: '29.70 m', temp: '26.1 °C', turbidity: '11.7 NTU', salinityProxy: '33.4 PSU', soundVel: '1566 m/s', status: 'LFM 100 kHz Active' },
];

export const EnvironmentView: React.FC<EnvironmentViewProps> = ({ telemetry }) => {
  const [currentRange, setCurrentRange] = useState<TimeRange>('1h');
  const [logEntries, setLogEntries] = useState<HistoricalLogEntry[]>(initialLogEntries);

  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const svpCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw Historical Multi-Line Trend Chart
  useEffect(() => {
    const canvas = trendCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = envHistoricalData[currentRange];

    ctx.clearRect(0, 0, width, height);

    const padLeft = 55;
    const padRight = 35;
    const padTop = 25;
    const padBottom = 35;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Grid lines
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padTop + (plotH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
    }

    const n = data.times.length;
    const stepX = plotW / (n - 1);

    // X-axis timestamps
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    data.times.forEach((t, i) => {
      const x = padLeft + i * stepX;
      ctx.fillText(t, x, height - 12);
    });

    const plotSeries = (
      vals: number[],
      minV: number,
      maxV: number,
      strokeColor: string,
      fillColor: string
    ) => {
      const pts = vals.map((v, i) => {
        const normY = (v - minV) / (maxV - minV);
        return {
          x: padLeft + i * stepX,
          y: padTop + plotH - normY * plotH,
        };
      });

      // Fill area under curve
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
      grad.addColorStop(0, fillColor);
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.02)');

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.lineTo(pts[pts.length - 1].x, padTop + plotH);
      ctx.lineTo(pts[0].x, padTop + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke curve line
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Point markers
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#040810';
        ctx.stroke();
      });
    };

    // Series 1: Sound Velocity (cyan: 1560 to 1576 m/s)
    plotSeries(data.soundSpeed, 1560, 1576, '#38bdf8', 'rgba(56, 189, 248, 0.35)');

    // Series 2: Temperature (green: 24 to 28 °C)
    plotSeries(data.temperature, 24, 28, '#34d399', 'rgba(52, 211, 153, 0.25)');

    // Left Y-axis labels
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'right';
    ctx.fillText('1575m/s', padLeft - 8, padTop + 8);
    ctx.fillText('1560m/s', padLeft - 8, padTop + plotH);
  }, [currentRange]);

  // Draw Sound Velocity Profile (SVP) vs Depth Vertical Curve
  useEffect(() => {
    const canvas = svpCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const padLeft = 45;
    const padRight = 25;
    const padTop = 20;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Depth grid lines
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.22)';
    ctx.lineWidth = 1;
    for (let d = 0; d <= 60; d += 15) {
      const y = padTop + (d / 60) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${d}m`, padLeft - 6, y + 3);
    }

    // X-axis speed labels (1530 to 1580 m/s)
    for (let s = 1530; s <= 1580; s += 25) {
      const x = padLeft + ((s - 1530) / 50) * plotW;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${s}`, x, height - 10);
    }

    // Thermocline curve
    const depths = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
    const speeds = [1572, 1572, 1571, 1569, 1564, 1555, 1546, 1541, 1539, 1538, 1538, 1537, 1537];

    const pts = depths.map((d, i) => {
      const x = padLeft + ((speeds[i] - 1530) / 50) * plotW;
      const y = padTop + (d / 60) * plotH;
      return { x, y };
    });

    // Sound duct layer guide line at 25m
    const ductY = padTop + (25 / 60) * plotH;
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padLeft, ductY);
    ctx.lineTo(width - padRight, ductY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve stroke
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Pulse dot at surface layer
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#34d399';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }, []);

  const handleToggleFilter = () => {
    setLogEntries((prev) => [...prev].reverse());
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'DepthProxy', 'Temperature', 'Turbidity', 'SalinityProxy', 'SoundVelocity', 'Status'];
    const rows = logEntries.map((e) => [e.time, e.depthProxy, e.temp, e.turbidity, e.salinityProxy, e.soundVel, e.status]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'waveforge_prototype_telemetry.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="env-main-layout" id="viewEnvironment">
      {/* View Title & Subtitle */}
      <div className="env-header-row">
        <div>
          <h1 className="env-page-title">Environmental Telemetry &amp; Proxy Inputs</h1>
          <p className="env-page-subtitle">
            WaveForge STM32 ADC Sensor Stream: Temperature &amp; Turbidity (Real Sensors) + Depth &amp; Salinity (Potentiometer Proxies).
          </p>
        </div>
        <div className="env-status-pills">
          <span className="env-pill">
            <i className="fa-solid fa-microchip text-emerald"></i> STM32 ADC: 4-CH Active
          </span>
          <span className="env-pill">
            <i className="fa-solid fa-water text-cyan"></i> Transducer: ~100 kHz Piezo
          </span>
        </div>
      </div>

      {/* Top Row: 5 Environmental Input Cards */}
      <div className="env-metrics-grid">
        {/* Card 1: Temperature (REAL) */}
        <div className="env-metric-card">
          <div className="env-card-top">
            <span className="env-metric-label">Temperature</span>
            <i className="fa-solid fa-temperature-half env-metric-icon text-emerald"></i>
          </div>
          <div className="env-metric-value" id="envWaterTemp">
            {telemetry.temperature.toFixed(1)} <span className="env-unit">°C</span>
          </div>
          <div className="env-metric-foot">
            <span className="trend-up" style={{ color: '#34d399' }}>● Real Sensor (Direct ADC)</span>
          </div>
        </div>

        {/* Card 2: Turbidity (REAL) */}
        <div className="env-metric-card">
          <div className="env-card-top">
            <span className="env-metric-label">Turbidity</span>
            <i className="fa-solid fa-smog env-metric-icon text-emerald"></i>
          </div>
          <div className="env-metric-value val-green" id="envTurbidity">
            {telemetry.turbidity.toFixed(1)} <span className="env-unit">NTU</span>
          </div>
          <div className="env-metric-foot">
            <span className="trend-up" style={{ color: '#34d399' }}>● Real Sensor (Optical)</span>
          </div>
        </div>

        {/* Card 3: Depth Proxy (POTENTIOMETER) */}
        <div className="env-metric-card">
          <div className="env-card-top">
            <span className="env-metric-label">Depth Proxy</span>
            <i className="fa-solid fa-arrows-up-down env-metric-icon" style={{ color: '#f59e0b' }}></i>
          </div>
          <div className="env-metric-value" id="envOceanDepth">
            {telemetry.depth_proxy.toFixed(2)} <span className="env-unit">m</span>
          </div>
          <div className="env-metric-foot">
            <span style={{ color: '#f59e0b' }}>▲ Potentiometer Proxy</span>
          </div>
        </div>

        {/* Card 4: Salinity Proxy (POTENTIOMETER) */}
        <div className="env-metric-card">
          <div className="env-card-top">
            <span className="env-metric-label">Salinity Proxy</span>
            <i className="fa-solid fa-droplet env-metric-icon" style={{ color: '#f59e0b' }}></i>
          </div>
          <div className="env-metric-value" id="envSalinity">
            {telemetry.salinity_proxy.toFixed(1)} <span className="env-unit">PSU</span>
          </div>
          <div className="env-metric-foot">
            <span style={{ color: '#f59e0b' }}>▲ Potentiometer Proxy</span>
          </div>
        </div>

        {/* Card 5: Computed Sound Velocity */}
        <div className="env-metric-card">
          <div className="env-card-top">
            <span className="env-metric-label">Sound Velocity</span>
            <i className="fa-solid fa-wave-square env-metric-icon text-cyan"></i>
          </div>
          <div className="env-metric-value val-cyan" id="envSoundVel">
            {Math.round(telemetry.sound_velocity)} <span className="env-unit">m/s</span>
          </div>
          <div className="env-metric-foot">
            <span className="text-cyan">Mackenzie / Medwin Eq</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Two Interactive Canvas Charts */}
      <div className="env-charts-grid">
        {/* Left Chart: Historical Multi-Line Trend */}
        <div className="env-chart-panel">
          <div className="env-chart-header">
            <div>
              <h2 className="env-chart-title">Historical Environmental Trends</h2>
              <div className="chart-legend-row">
                <span className="legend-indicator">
                  <span className="legend-dot bg-cyan"></span> Sound Velocity (m/s)
                </span>
                <span className="legend-indicator">
                  <span className="legend-dot bg-emerald"></span> Temperature (°C)
                </span>
              </div>
            </div>
            {/* Range Selector */}
            <div className="time-range-group" id="envTimeRangeGroup">
              {(['1h', '6h', '24h', '7d'] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`time-btn ${currentRange === r ? 'active' : ''}`}
                  onClick={() => setCurrentRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="env-canvas-container">
            <canvas ref={trendCanvasRef} id="historicalTrendCanvas" width={680} height={270}></canvas>
          </div>
        </div>

        {/* Right Chart: Sound Velocity Profile (SVP) vs Depth */}
        <div className="env-chart-panel">
          <div className="env-chart-header">
            <div>
              <h2 className="env-chart-title">Sound Velocity Profile (SVP)</h2>
              <div className="chart-legend-row">
                <span className="legend-indicator">
                  <span className="legend-dot bg-cyan"></span> In-situ CTD Cast (0–60m)
                </span>
                <span className="legend-indicator text-muted">
                  <i className="fa-solid fa-arrow-down"></i> Thermocline Layer
                </span>
              </div>
            </div>
            <div className="env-chart-tag">Surface Duct 25m</div>
          </div>
          <div className="env-canvas-container">
            <canvas ref={svpCanvasRef} id="svpDepthCanvas" width={480} height={270}></canvas>
          </div>
        </div>
      </div>

      {/* Bottom Row: Historical Telemetry Log Table */}
      <div className="env-table-panel">
        <div className="env-table-header">
          <div>
            <h2 className="env-chart-title">WaveForge Telemetry Log</h2>
            <span className="table-subtitle">STM32 Multi-Channel Sensor &amp; Proxy Record (Last 7 Cycles)</span>
          </div>
          <div className="table-actions">
            <button
              type="button"
              className="btn-table-action"
              id="btnFilterEnvLog"
              onClick={handleToggleFilter}
            >
              <i className="fa-solid fa-arrow-down-up-across-line"></i>
              <span>Filter / Sort</span>
            </button>
            <button
              type="button"
              className="btn-table-action btn-export"
              id="btnExportEnvLog"
              onClick={handleExportCSV}
            >
              <i className="fa-solid fa-file-arrow-down"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="table-scroll-wrap">
          <table className="env-log-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Depth Proxy</th>
                <th>Temperature</th>
                <th>Turbidity</th>
                <th>Salinity Proxy</th>
                <th>Sound Velocity</th>
                <th>Waveform Engine</th>
              </tr>
            </thead>
            <tbody id="envLogTableBody">
              {logEntries.map((entry, idx) => (
                <tr key={idx}>
                  <td style={{ color: '#94a3b8' }}>{entry.time}</td>
                  <td style={{ color: '#f59e0b', fontWeight: 600 }}>{entry.depthProxy}</td>
                  <td style={{ color: '#34d399', fontWeight: 600 }}>{entry.temp}</td>
                  <td style={{ color: '#34d399', fontWeight: 600 }}>{entry.turbidity}</td>
                  <td style={{ color: '#f59e0b', fontWeight: 600 }}>{entry.salinityProxy}</td>
                  <td style={{ color: '#38bdf8', fontWeight: 700 }}>{entry.soundVel}</td>
                  <td>
                    <span className="badge-status badge-active">{entry.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
