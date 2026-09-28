import React, { useRef, useEffect, useState } from 'react';
import type { TelemetryData } from '../../types/sonar';

interface DashboardViewProps {
  telemetry: TelemetryData;
  isLavenderTheme?: boolean;
  onParamChange?: (params: {
    center_frequency?: number;
    bandwidth?: number;
    pulse_duration?: number;
    amplitude?: number;
  }) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  telemetry,
  isLavenderTheme = true,
  onParamChange,
}) => {
  // Operational Parameters State matching WaveForge 100 kHz baseline target
  const [centerFreq, setCenterFreq] = useState(telemetry.center_frequency || 100.0);
  const [bandwidth, setBandwidth] = useState(telemetry.bandwidth || 50.0);
  const [pulseDur, setPulseDur] = useState(telemetry.pulse_duration || 20);
  const [amplitude, setAmplitude] = useState(telemetry.amplitude || 80);
  const [pri, setPri] = useState(300);

  // Checkbox legend
  const [showChirp, setShowChirp] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(true);

  // Uptime
  const [uptimeSecs, setUptimeSecs] = useState(43207); // 12:00:07

  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const specCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Uptime counter
  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeSecs((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (total: number) => {
    const hrs = String(Math.floor(total / 3600)).padStart(2, '0');
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const secs = String(total % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  // Oscilloscope Animation (LFM Chirp)
  useEffect(() => {
    const canvas = oscCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let oscPhase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Draw Grid Lines
      ctx.strokeStyle = isLavenderTheme ? 'rgba(167, 139, 250, 0.22)' : 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      const gridSpacingX = width / 14;
      const gridSpacingY = height / 6;

      for (let x = 0; x <= width; x += gridSpacingX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += gridSpacingY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = isLavenderTheme ? 'rgba(139, 92, 246, 0.35)' : 'rgba(56, 189, 248, 0.18)';
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Pulse Envelope Parameters
      const maxAmplitude = (height * 0.38) * (amplitude / 100);
      const pulseWidth = (width * 0.6) * (pulseDur / 25);
      const pulseStartX = (width - pulseWidth) / 2;
      const pulseEndX = pulseStartX + pulseWidth;
      const taperWidth = pulseWidth * 0.12;

      // Draw Envelope if checked
      if (showEnvelope) {
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        // Upper envelope
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(pulseStartX, centerY);
        ctx.lineTo(pulseStartX + taperWidth, centerY - maxAmplitude);
        ctx.lineTo(pulseEndX - taperWidth, centerY - maxAmplitude);
        ctx.lineTo(pulseEndX, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Lower envelope
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(pulseStartX, centerY);
        ctx.lineTo(pulseStartX + taperWidth, centerY + maxAmplitude);
        ctx.lineTo(pulseEndX - taperWidth, centerY + maxAmplitude);
        ctx.lineTo(pulseEndX, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        ctx.setLineDash([]);
      }

      // Draw LFM Chirp Waveform (sweep 75 kHz -> 125 kHz visual representation in original vibrant cyan)
      if (showChirp) {
        ctx.strokeStyle = '#0284c7';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2.2;

        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          let env = 0;
          if (x >= pulseStartX && x <= pulseEndX) {
            if (x < pulseStartX + taperWidth) {
              env = (x - pulseStartX) / taperWidth;
            } else if (x > pulseEndX - taperWidth) {
              env = (pulseEndX - x) / taperWidth;
            } else {
              env = 1;
            }
          }

          // LFM chirp frequency sweep: start low, ramp to high
          const progress = Math.max(0, Math.min(1, (x - pulseStartX) / pulseWidth));
          const instantaneousFreq = 0.09 + progress * (bandwidth / 200);
          const y = centerY + Math.sin(x * instantaneousFreq + oscPhase) * maxAmplitude * env;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      oscPhase += 0.09;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [pulseDur, amplitude, bandwidth, showChirp, showEnvelope]);

  // Spectrum Drawing (Carrier 100 kHz with 50 kHz Bandwidth in original vibrant cyan)
  useEffect(() => {
    const canvas = specCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Spectrum peak center: map 0-200 kHz across the canvas width
    const peakX = width * (centerFreq / 200);
    const peakWidth = width * (bandwidth / 200);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
    grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.28)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(0, height - 8);

    for (let x = 0; x <= width; x += 3) {
      const dist = (x - peakX) / (peakWidth * 0.55);
      const amp = Math.exp(-0.5 * dist * dist);
      const noise = (Math.sin(x * 0.25) + Math.cos(x * 0.6)) * 1.5;
      const y = height - 8 - amp * (height * 0.78) * (amplitude / 100) + noise;
      ctx.lineTo(x, Math.max(10, y));
    }

    ctx.lineTo(width, height - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [centerFreq, bandwidth, amplitude, isLavenderTheme]);

  const sweepStart = (centerFreq - bandwidth / 2).toFixed(1);
  const sweepEnd = (centerFreq + bandwidth / 2).toFixed(1);

  return (
    <main className="dash-grid-layout" id="viewDashboard">
      {/* LEFT COLUMN: Hardware Subsystem Status & Waveform Definition */}
      <div className="dash-col dash-col-left">
        {/* Card 1: System Status (STM32, ESP32, Sensors, Waveform) */}
        <section className="dash-card">
          <h2 className="dash-card-title">System Subsystems</h2>
          <div className="dash-kv-list">
            <div className="dash-kv-row">
              <span className="kv-label">STM32 (G474RE)</span>
              <span className="badge-status badge-healthy">TIMER+DMA ONLINE</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">ESP32 (UART Link)</span>
              <span className="badge-status badge-active">LINK READY</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Sensors (ADC Array)</span>
              <span className="badge-status badge-healthy">4-CH ACTIVE</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Waveform Engine</span>
              <span className="badge-status badge-active">DAC 1 MSPS</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">System Uptime</span>
              <span className="kv-val" id="valUptime">{formatUptime(uptimeSecs)}</span>
            </div>
          </div>
        </section>

        {/* Card 2: Waveform Parameters */}
        <section className="dash-card">
          <h2 className="dash-card-title">LFM Waveform Engine</h2>
          <div className="dash-kv-list">
            <div className="dash-kv-row">
              <span className="kv-label">Waveform Type</span>
              <span className="kv-val val-cyan" id="valWaveformType">LFM Linear Chirp</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Sweep Frequency</span>
              <span className="kv-val val-cyan">{sweepStart} – {sweepEnd} kHz</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Center Frequency</span>
              <span className="kv-val" id="valCenterFreq">{centerFreq.toFixed(1)} kHz</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Bandwidth (Δf)</span>
              <span className="kv-val" id="valBandwidth">{bandwidth.toFixed(1)} kHz</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Pulse Duration</span>
              <span className="kv-val">{pulseDur} ms</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">DAC Sample Rate</span>
              <span className="kv-val val-green">1.0 MSPS (Target)</span>
            </div>
          </div>
        </section>
      </div>

      {/* CENTER COLUMN: Real-time Oscilloscope Visualization */}
      <div className="dash-col dash-col-center">
        <section className="dash-card dash-card-waveform-main">
          <div className="dash-card-header-flex">
            <div>
              <h2 className="dash-card-title">Real-Time Waveform Monitor</h2>
              <p className="dash-card-subtitle">
                STM32 DAC Waveform Engine (LFM Chirp {sweepStart}–{sweepEnd} kHz / 20ms)
              </p>
            </div>
            <div className="waveform-legend">
              <label className="legend-item">
                <input
                  type="checkbox"
                  id="chkLfmChirp"
                  checked={showChirp}
                  onChange={(e) => setShowChirp(e.target.checked)}
                />
                <span className="legend-color-box box-cyan"></span>
                <span>LFM Chirp</span>
              </label>
              <label className="legend-item">
                <input
                  type="checkbox"
                  id="chkEnvelope"
                  checked={showEnvelope}
                  onChange={(e) => setShowEnvelope(e.target.checked)}
                />
                <span className="legend-color-box box-outline"></span>
                <span>Envelope</span>
              </label>
            </div>
          </div>

          {/* Upper Oscilloscope Screen */}
          <div className="oscilloscope-wrapper">
            <div className="pulse-dur-label pulse-dur-top">Pulse: {pulseDur} ms</div>
            <canvas ref={oscCanvasRef} id="oscilloscopeCanvas" width={760} height={240}></canvas>
            <div className="pulse-dur-label pulse-dur-bottom">Pulse Duration ({pulseDur} ms)</div>
          </div>

          {/* Lower Frequency Spectrum Screen */}
          <div className="spectrum-wrapper">
            <div className="spectrum-y-axis-label">Power (dB)</div>
            <canvas ref={specCanvasRef} id="spectrumCanvas" width={760} height={110}></canvas>
            <div className="spectrum-x-axis">
              <span>0 kHz</span>
              <span>50 kHz</span>
              <span>100 kHz</span>
              <span>150 kHz</span>
              <span>200 kHz</span>
            </div>
            <div className="spectrum-x-axis-title">Frequency (kHz) — 100 kHz Center Target</div>
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: Environmental Inputs & Operational Controls */}
      <div className="dash-col dash-col-right">
        {/* Card 1: Environmental Inputs (Strictly labeled per hardware reality) */}
        <section className="dash-card">
          <h2 className="dash-card-title">Environmental Inputs</h2>
          <div className="dash-kv-list">
            <div className="dash-kv-row">
              <span className="kv-label">
                Temperature <span style={{ fontSize: '10px', color: '#34d399' }}>[REAL]</span>
              </span>
              <span className="kv-val" id="valWaterTemp">
                {telemetry.temperature.toFixed(1)} °C
              </span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">
                Turbidity <span style={{ fontSize: '10px', color: '#34d399' }}>[REAL]</span>
              </span>
              <span className="kv-val val-green" id="valTurbidity">
                {telemetry.turbidity.toFixed(1)} NTU
              </span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">
                Depth Proxy <span style={{ fontSize: '10px', color: '#f59e0b' }}>[POT PROXY]</span>
              </span>
              <span className="kv-val" id="valOceanDepth">
                {telemetry.depth_proxy.toFixed(2)} m
              </span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">
                Salinity Proxy <span style={{ fontSize: '10px', color: '#f59e0b' }}>[POT PROXY]</span>
              </span>
              <span className="kv-val" id="valSalinity">
                {telemetry.salinity_proxy.toFixed(1)} PSU
              </span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Computed Sound Vel.</span>
              <span className="kv-val val-cyan" id="valSoundVel">
                {Math.round(telemetry.sound_velocity)} m/s
              </span>
            </div>
          </div>
        </section>

        {/* Card 2: Adaptive Waveform Controls */}
        <section className="dash-card">
          <h2 className="dash-card-title">Adaptive Waveform Parameters</h2>
          <div className="dash-controls-list">
            {/* Slider 1: Center Frequency */}
            <div className="dash-control-row">
              <div className="control-header">
                <span className="control-name">Center Frequency</span>
                <span className="control-val">{centerFreq.toFixed(1)} kHz</span>
              </div>
              <input
                type="range"
                min="70"
                max="130"
                step="1"
                value={centerFreq}
                className="cyber-slider"
                id="sliderCarrierFreq"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCenterFreq(val);
                  onParamChange?.({ center_frequency: val });
                }}
              />
            </div>

            {/* Slider 2: Bandwidth */}
            <div className="dash-control-row">
              <div className="control-header">
                <span className="control-name">Bandwidth (Δf)</span>
                <span className="control-val">{bandwidth.toFixed(1)} kHz</span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                step="1"
                value={bandwidth}
                className="cyber-slider"
                id="sliderBandwidth"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setBandwidth(val);
                  onParamChange?.({ bandwidth: val });
                }}
              />
            </div>

            {/* Slider 3: Pulse Duration */}
            <div className="dash-control-row">
              <div className="control-header">
                <span className="control-name">Pulse Duration</span>
                <span className="control-val">{pulseDur} ms</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={pulseDur}
                className="cyber-slider"
                id="sliderPulseDur"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPulseDur(val);
                  onParamChange?.({ pulse_duration: val });
                }}
              />
            </div>

            {/* Slider 4: Amplitude */}
            <div className="dash-control-row">
              <div className="control-header">
                <span className="control-name">DAC Output Amplitude</span>
                <span className="control-val">{amplitude}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="1"
                value={amplitude}
                className="cyber-slider"
                id="sliderAmplitude"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAmplitude(val);
                  onParamChange?.({ amplitude: val });
                }}
              />
            </div>

            {/* Slider 5: PRI */}
            <div className="dash-control-row">
              <div className="control-header">
                <span className="control-name">Ping Repetition Interval (PRI)</span>
                <span className="control-val">{pri} ms</span>
              </div>
              <input
                type="range"
                min="100"
                max="1000"
                step="10"
                value={pri}
                className="cyber-slider"
                id="sliderPri"
                onChange={(e) => setPri(Number(e.target.value))}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
