import React, { useRef, useEffect, useState } from 'react';
import type { TelemetryData } from '../../types/sonar';

interface DashboardViewProps {
  telemetry: TelemetryData;
  isLavenderTheme?: boolean;
  onParamChange?: (params: Partial<TelemetryData>) => void;
}

// Medwin Sound Speed Equation: c = 1449.2 + 4.6*T - 0.055*T^2 + 0.00029*T^3 + (1.34 - 0.010*T)*(S - 35) + 0.016*D
const computeMedwinSoundSpeed = (tempC: number) => {
  const S = 33.3; // Salinity proxy baseline
  const D = 30.0; // Depth baseline
  const c =
    1449.2 +
    4.6 * tempC -
    0.055 * Math.pow(tempC, 2) +
    0.00029 * Math.pow(tempC, 3) +
    (1.34 - 0.01 * tempC) * (S - 35) +
    0.016 * D;
  return Math.round(c);
};

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
  const [waveformType, setWaveformType] = useState(telemetry.waveform_type || 'LFM Linear Chirp');

  // Environmental state for in-situ medium interconnection
  const [temperature, setTemperature] = useState(Number((telemetry.temperature || 26.7).toFixed(1)));
  const [turbidity, setTurbidity] = useState(Number((telemetry.turbidity || 12.4).toFixed(1)));
  const [soundSpeed, setSoundSpeed] = useState(Math.round(telemetry.sound_velocity || 1570));

  // Sync state with incoming telemetry so all pages remain interconnected
  useEffect(() => {
    if (telemetry.center_frequency !== undefined) setCenterFreq(telemetry.center_frequency);
    if (telemetry.bandwidth !== undefined) setBandwidth(telemetry.bandwidth);
    if (telemetry.pulse_duration !== undefined) setPulseDur(telemetry.pulse_duration);
    if (telemetry.amplitude !== undefined) setAmplitude(telemetry.amplitude);
    if (telemetry.waveform_type !== undefined) setWaveformType(telemetry.waveform_type);
    if (telemetry.temperature !== undefined) setTemperature(Number(telemetry.temperature.toFixed(1)));
    if (telemetry.turbidity !== undefined) setTurbidity(Number(telemetry.turbidity.toFixed(1)));
    if (telemetry.sound_velocity !== undefined) setSoundSpeed(Math.round(telemetry.sound_velocity));
  }, [
    telemetry.center_frequency,
    telemetry.bandwidth,
    telemetry.pulse_duration,
    telemetry.amplitude,
    telemetry.waveform_type,
    telemetry.temperature,
    telemetry.turbidity,
    telemetry.sound_velocity,
  ]);

  // Checkbox legend
  const [showChirp, setShowChirp] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(true);

  // Uptime
  const [uptimeSecs, setUptimeSecs] = useState(43207); // 12:00:07

  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const specCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Derived acoustic calculations directly interconnected with medium sound velocity
  const sweepStartNum = Math.max(10, centerFreq - bandwidth / 2);
  const sweepEndNum = centerFreq + bandwidth / 2;
  const sweepStart = sweepStartNum.toFixed(1);
  const sweepEnd = sweepEndNum.toFixed(1);
  const wavelengthMm = ((soundSpeed / (centerFreq * 1000)) * 1000).toFixed(2);
  const rangeResCm = ((soundSpeed / (2 * bandwidth * 1000)) * 100).toFixed(1);
  const compressionGain = (10 * Math.log10(Math.max(1, bandwidth * pulseDur))).toFixed(1);

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

  // Oscilloscope Animation (interconnected with waveformType, centerFreq, bandwidth, pulseDur, amplitude)
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

      // Draw Active Waveform
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

          let y = centerY;
          const progress = Math.max(0, Math.min(1, (x - pulseStartX) / pulseWidth));

          if (waveformType.includes('CW') || waveformType.includes('Continuous')) {
            const cwFreq = 0.08 + (centerFreq / 100) * 0.07;
            y = centerY + Math.sin(x * cwFreq + oscPhase) * maxAmplitude * env;
          } else if (waveformType.includes('HFM') || waveformType.includes('Hyperbolic')) {
            const hfmStart = 0.04;
            const hfmEnd = 0.22;
            const tNorm = Math.max(0.01, progress);
            const instFreq = (hfmStart * hfmEnd) / (hfmEnd - (hfmEnd - hfmStart) * tNorm);
            y = centerY + Math.sin(x * instFreq + oscPhase) * maxAmplitude * env;
          } else if (waveformType.includes('Costas')) {
            const hops = [2, 6, 3, 5, 1, 4];
            const hopIndex = Math.min(hops.length - 1, Math.floor(progress * hops.length));
            const hopFreq = 0.05 + hops[hopIndex] * 0.028;
            y = centerY + Math.sin(x * hopFreq + oscPhase) * maxAmplitude * env;
          } else {
            // Default LFM Chirp frequency ramp
            const startRamp = 0.05 + (sweepStartNum / 130) * 0.04;
            const endRamp = 0.12 + (sweepEndNum / 170) * 0.16;
            const instFreq = startRamp + progress * (endRamp - startRamp);
            y = centerY + Math.sin(x * instFreq + oscPhase) * maxAmplitude * env;
          }

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
  }, [pulseDur, amplitude, bandwidth, centerFreq, waveformType, showChirp, showEnvelope, isLavenderTheme, sweepStartNum, sweepEndNum]);

  // Spectrum Drawing (interconnected with waveformType, centerFreq, bandwidth, amplitude)
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
      let amp = 0;
      if (waveformType.includes('CW') || waveformType.includes('Continuous')) {
        const dist = (x - peakX) / (peakWidth * 0.15);
        amp = Math.exp(-0.5 * dist * dist);
      } else if (waveformType.includes('Costas')) {
        const hops = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
        hops.forEach((h) => {
          const hopX = peakX + h * (peakWidth / 3.5);
          const dist = (x - hopX) / (peakWidth * 0.12);
          amp += 0.3 * Math.exp(-0.5 * dist * dist);
        });
      } else {
        const dist = (x - peakX) / (peakWidth * 0.55);
        amp = Math.exp(-0.5 * dist * dist);
      }
      const noise = (Math.sin(x * 0.25) + Math.cos(x * 0.6)) * 1.5;
      const y = height - 8 - amp * (height * 0.78) * (amplitude / 100) + noise;
      ctx.lineTo(x, Math.max(10, y));
    }

    ctx.lineTo(width, height - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [centerFreq, bandwidth, amplitude, waveformType, isLavenderTheme]);

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

        {/* Card 2: Interconnected Waveform & Medium Acoustics */}
        <section className="dash-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 className="dash-card-title" style={{ margin: 0 }}>Acoustic Waveform Engine</h2>
            <span style={{ fontSize: '10px', color: '#0284c7', background: 'rgba(2, 132, 199, 0.08)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>SYNCED</span>
          </div>
          <div className="dash-kv-list">
            <div className="dash-kv-row">
              <span className="kv-label">Waveform Type</span>
              <span className="kv-val val-cyan" id="valWaveformType">{waveformType}</span>
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
              <span className="kv-label">Acoustic Wavelength (λ)</span>
              <span className="kv-val" style={{ color: '#0284c7', fontWeight: 700 }}>{wavelengthMm} mm</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Range Resolution (ΔR)</span>
              <span className="kv-val" style={{ color: '#7c3aed', fontWeight: 700 }}>{rangeResCm} cm</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Compression Gain</span>
              <span className="kv-val val-green">+{compressionGain} dB</span>
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
                Software-defined acoustic waveform generation with live synchronized telemetry
              </p>
            </div>
            <div className="dash-legend">
              <label className="legend-item">
                <input
                  type="checkbox"
                  id="chkLfmChirp"
                  checked={showChirp}
                  onChange={(e) => setShowChirp(e.target.checked)}
                />
                <span className="legend-color-box box-cyan"></span>
                <span>{waveformType}</span>
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
            <div className="pulse-dur-label pulse-dur-top">Pulse: {pulseDur} ms | λ: {wavelengthMm} mm</div>
            <canvas ref={oscCanvasRef} id="oscilloscopeCanvas" width={760} height={240}></canvas>
            <div className="pulse-dur-label pulse-dur-bottom">Pulse Duration ({pulseDur} ms) — Resolution: {rangeResCm} cm</div>
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
            <div className="spectrum-x-axis-title">Frequency (kHz) — {centerFreq.toFixed(1)} kHz Center (Δf = {bandwidth.toFixed(1)} kHz)</div>
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: Environmental Inputs & Operational Controls */}
      <div className="dash-col dash-col-right">
        {/* Card 1: Environmental Inputs (Interconnected with Sound Velocity & Acoustic Resolution) */}
        <section className="dash-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 className="dash-card-title" style={{ margin: 0 }}>Environmental Inputs</h2>
            <span style={{ fontSize: '10px', color: '#7c3aed', background: 'rgba(124, 58, 237, 0.08)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>LIVE IN-SITU</span>
          </div>

          <div className="dash-controls-list">
            {/* Water Temperature */}
            <div className="dash-control-row">
              <div className="control-header">
                <span className="control-name">
                  Water Temperature <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>[REAL]</span>
                </span>
                <span className="control-val" id="valWaterTemp">{temperature.toFixed(1)} °C</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="0.1"
                value={temperature}
                className="cyber-slider"
                id="sliderWaterTemp"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTemperature(val);
                  const computedSpeed = computeMedwinSoundSpeed(val);
                  setSoundSpeed(computedSpeed);
                  onParamChange?.({ temperature: val, sound_velocity: computedSpeed });
                }}
              />
            </div>

            {/* Turbidity */}
            <div className="dash-control-row">
              <div className="control-header">
                <span className="control-name">
                  Turbidity <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>[REAL]</span>
                </span>
                <span className="control-val val-green" id="valTurbidity">{turbidity.toFixed(1)} NTU</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={turbidity}
                className="cyber-slider"
                id="sliderTurbidity"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTurbidity(val);
                  onParamChange?.({ turbidity: val });
                }}
              />
            </div>

            {/* Computed Sound Velocity */}
            <div className="dash-kv-row" style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(226, 232, 240, 0.8)' }}>
              <span className="kv-label">Computed Sound Vel. (c)</span>
              <span className="kv-val val-cyan" id="valSoundVel">
                {Math.round(soundSpeed)} m/s
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

export default DashboardView;
