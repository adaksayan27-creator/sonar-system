import React, { useState, useRef, useEffect } from 'react';
import type { TelemetryData } from '../../types/sonar';

interface EnvironmentViewProps {
  telemetry: TelemetryData;
  onParamChange?: (params: Partial<TelemetryData>) => void;
}

interface EnvLogItem {
  time: string;
  temp: string;
  turbidity: string;
  soundVel: string;
  status: string;
}

const initialLogEntries: EnvLogItem[] = [
  { time: '11:00:24', temp: '26.7 °C', turbidity: '12.4 NTU', soundVel: '1570 m/s', status: 'LFM 100 kHz Active' },
  { time: '10:30:18', temp: '26.6 °C', turbidity: '12.2 NTU', soundVel: '1569 m/s', status: 'LFM 100 kHz Active' },
  { time: '10:00:15', temp: '26.8 °C', turbidity: '12.5 NTU', soundVel: '1571 m/s', status: 'LFM 100 kHz Active' },
  { time: '09:30:42', temp: '26.5 °C', turbidity: '12.1 NTU', soundVel: '1568 m/s', status: 'LFM 100 kHz Active' },
  { time: '09:00:10', temp: '26.4 °C', turbidity: '11.9 NTU', soundVel: '1567 m/s', status: 'LFM 100 kHz Active' },
  { time: '08:30:55', temp: '26.2 °C', turbidity: '11.8 NTU', soundVel: '1565 m/s', status: 'LFM 100 kHz Active' },
  { time: '08:00:20', temp: '26.1 °C', turbidity: '11.7 NTU', soundVel: '1566 m/s', status: 'LFM 100 kHz Active' },
];

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

export const EnvironmentView: React.FC<EnvironmentViewProps> = ({ telemetry, onParamChange }) => {
  // Editable top section state (Temperature, Turbidity, Sound Velocity)
  const [temperature, setTemperature] = useState<number>(Number((telemetry.temperature || 26.7).toFixed(1)));
  const [turbidity, setTurbidity] = useState<number>(Number((telemetry.turbidity || 12.4).toFixed(1)));
  const [soundSpeed, setSoundSpeed] = useState<number>(Math.round(telemetry.sound_velocity || 1570));
  const [isSoundSpeedManual, setIsSoundSpeedManual] = useState<boolean>(false);
  const [isEnvEdited, setIsEnvEdited] = useState<boolean>(false);

  // Manual adjustable waveform parameters
  const [centerFreq, setCenterFreq] = useState<number>(telemetry.center_frequency || 100.0);
  const [bandwidth, setBandwidth] = useState<number>(telemetry.bandwidth || 50.0);
  const [pulseDur, setPulseDur] = useState<number>(telemetry.pulse_duration || 20);
  const [amplitude, setAmplitude] = useState<number>(telemetry.amplitude || 80);
  const [waveformType, setWaveformType] = useState<string>(telemetry.waveform_type || 'LFM Linear Chirp');

  // Display toggles
  const [showEnvelope, setShowEnvelope] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Table log
  const [logEntries, setLogEntries] = useState<EnvLogItem[]>(initialLogEntries);

  // Synchronize state with telemetry so all pages remain interconnected
  useEffect(() => {
    if (telemetry.temperature !== undefined) setTemperature(Number(telemetry.temperature.toFixed(1)));
    if (telemetry.turbidity !== undefined) setTurbidity(Number(telemetry.turbidity.toFixed(1)));
    if (telemetry.sound_velocity !== undefined) setSoundSpeed(Math.round(telemetry.sound_velocity));
    if (telemetry.center_frequency !== undefined) setCenterFreq(telemetry.center_frequency);
    if (telemetry.bandwidth !== undefined) setBandwidth(telemetry.bandwidth);
    if (telemetry.pulse_duration !== undefined) setPulseDur(telemetry.pulse_duration);
    if (telemetry.amplitude !== undefined) setAmplitude(telemetry.amplitude);
    if (telemetry.waveform_type) setWaveformType(telemetry.waveform_type);
  }, [
    telemetry.temperature,
    telemetry.turbidity,
    telemetry.sound_velocity,
    telemetry.center_frequency,
    telemetry.bandwidth,
    telemetry.pulse_duration,
    telemetry.amplitude,
    telemetry.waveform_type,
  ]);

  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const specCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real-time calculations based on manual values + in-situ sound velocity
  const roundedSoundSpeed = Math.round(soundSpeed);
  const sweepStart = Math.max(10, centerFreq - bandwidth / 2);
  const sweepEnd = centerFreq + bandwidth / 2;
  const tbProduct = bandwidth * pulseDur;
  const compressionGain = (10 * Math.log10(Math.max(1, tbProduct))).toFixed(1);
  const rangeResCm = ((roundedSoundSpeed / (2 * bandwidth * 1000)) * 100).toFixed(1);
  const sweepRate = (bandwidth / pulseDur).toFixed(2);
  const wavelengthMm = ((roundedSoundSpeed / (centerFreq * 1000)) * 1000).toFixed(2);

  // Handlers for editing top environmental metrics
  const handleTempChange = (newTemp: number) => {
    const clamped = Math.max(0, Math.min(50, Number(newTemp.toFixed(1))));
    setTemperature(clamped);
    setIsEnvEdited(true);

    if (!isSoundSpeedManual) {
      const computedC = computeMedwinSoundSpeed(clamped);
      setSoundSpeed(computedC);
      onParamChange?.({ temperature: clamped, sound_velocity: computedC });
    } else {
      onParamChange?.({ temperature: clamped });
    }
  };

  const handleTurbidityChange = (newTurb: number) => {
    const clamped = Math.max(0, Math.min(100, Number(newTurb.toFixed(1))));
    setTurbidity(clamped);
    setIsEnvEdited(true);
    onParamChange?.({ turbidity: clamped });
  };

  const handleSoundSpeedChange = (newSpeed: number) => {
    const clamped = Math.max(1300, Math.min(1800, Math.round(newSpeed)));
    setSoundSpeed(clamped);
    setIsSoundSpeedManual(true);
    setIsEnvEdited(true);
    onParamChange?.({ sound_velocity: clamped });
  };

  const handleResetEnv = () => {
    const resetTemp = 26.7;
    const resetTurb = 12.4;
    const resetSpeed = computeMedwinSoundSpeed(resetTemp);
    setTemperature(resetTemp);
    setTurbidity(resetTurb);
    setSoundSpeed(resetSpeed);
    setIsSoundSpeedManual(false);
    setIsEnvEdited(false);
    onParamChange?.({
      temperature: resetTemp,
      turbidity: resetTurb,
      sound_velocity: resetSpeed,
    });
  };

  // Waveform manual parameter change handlers
  const handleCenterFreqChange = (val: number) => {
    setCenterFreq(val);
    onParamChange?.({ center_frequency: val });
  };

  const handleBandwidthChange = (val: number) => {
    setBandwidth(val);
    onParamChange?.({ bandwidth: val });
  };

  const handlePulseDurChange = (val: number) => {
    setPulseDur(val);
    onParamChange?.({ pulse_duration: val });
  };

  const handleAmplitudeChange = (val: number) => {
    setAmplitude(val);
    onParamChange?.({ amplitude: val });
  };

  // Render Real-Time LFM Chirp Oscilloscope Canvas
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

      // Grid
      if (showGrid) {
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.22)';
        ctx.lineWidth = 1;
        const gridSpacingX = width / 12;
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
      }

      // Center baseline
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Envelope sizing
      const maxAmplitude = (height * 0.38) * (amplitude / 100);
      const pulseFraction = Math.max(0.2, Math.min(0.85, pulseDur / 45));
      const pulseWidth = width * pulseFraction;
      const pulseStartX = (width - pulseWidth) / 2;
      const pulseEndX = pulseStartX + pulseWidth;
      const taperWidth = pulseWidth * 0.12;

      // Draw Envelope Boundary
      if (showEnvelope) {
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.55)';
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

      // Draw LFM Chirp Waveform (frequency increases from start to end)
      ctx.strokeStyle = '#0284c7';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2.2;
      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        let env = 0;
        if (x >= pulseStartX && x <= pulseEndX) {
          const relX = x - pulseStartX;
          if (relX < taperWidth) {
            env = relX / taperWidth;
          } else if (relX > pulseWidth - taperWidth) {
            env = (pulseWidth - relX) / taperWidth;
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
          // LFM Chirp frequency ramp
          const startRamp = 0.05 + (sweepStart / 130) * 0.04;
          const endRamp = 0.12 + (sweepEnd / 170) * 0.16;
          const instFreq = startRamp + progress * (endRamp - startRamp);
          y = centerY + Math.sin(x * instFreq + oscPhase) * maxAmplitude * env;
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      // Pulse start/end markers
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.45)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(pulseStartX, 0);
      ctx.lineTo(pulseStartX, height);
      ctx.moveTo(pulseEndX, 0);
      ctx.lineTo(pulseEndX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      oscPhase += 0.09;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [centerFreq, bandwidth, pulseDur, amplitude, showEnvelope, showGrid, sweepStart, sweepEnd, waveformType]);

  // Render Frequency Spectrum (FFT) Canvas
  useEffect(() => {
    const canvas = specCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const peakX = width * (centerFreq / 200);
    const peakWidth = width * (bandwidth / 200);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
    grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.25)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(0, height - 6);

    for (let x = 0; x <= width; x += 3) {
      let spectralShape = 0;
      if (waveformType.includes('CW') || waveformType.includes('Continuous')) {
        const dist = Math.abs(x - peakX) / (peakWidth * 0.12);
        spectralShape = Math.exp(-0.5 * dist * dist);
      } else if (waveformType.includes('Costas')) {
        const hops = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
        hops.forEach((h) => {
          const hopX = peakX + h * (peakWidth / 3.5);
          const dist = Math.abs(x - hopX) / (peakWidth * 0.1);
          spectralShape += 0.3 * Math.exp(-0.5 * dist * dist);
        });
      } else {
        const dist = Math.abs(x - peakX) / (peakWidth * 0.5);
        if (dist <= 1.0) {
          spectralShape = 1.0 - Math.pow(dist, 4) * 0.15;
        } else {
          spectralShape = Math.exp(-Math.pow((dist - 1.0) * 3, 2));
        }
      }

      const noise = (Math.sin(x * 0.4) + Math.cos(x * 0.7)) * 1.5;
      const y = height - 6 - spectralShape * (height * 0.8) * (amplitude / 100) + noise;
      ctx.lineTo(x, Math.max(8, y));
    }

    ctx.lineTo(width, height - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [centerFreq, bandwidth, amplitude, waveformType]);

  const handleToggleFilter = () => {
    setLogEntries((prev) => [...prev].reverse());
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Temperature', 'Turbidity', 'SoundVelocity', 'Status'];
    const rows = logEntries.map((e) => [e.time, e.temp, e.turbidity, e.soundVel, e.status]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'waveforge_telemetry_lfm_output.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="env-main-layout" id="viewEnvironment">
      {/* Top Header Row */}
      <div className="env-header-row">
        <div>
          <h1 className="env-page-title">Environmental Telemetry &amp; Medium Acoustics</h1>
          <p className="env-page-subtitle">
            WaveForge Real-Time Telemetry: Directly edit in-situ parameters below to recalculate medium sound speed and adaptive acoustic waveform.
          </p>
        </div>
        <div className="env-status-pills">
          {isEnvEdited && (
            <button
              type="button"
              onClick={handleResetEnv}
              className="dash-btn-status"
              style={{
                background: '#ede9fe',
                borderColor: '#7c3aed',
                color: '#4c1d95',
                padding: '5px 12px',
                borderRadius: '16px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <i className="fa-solid fa-rotate-left"></i>
              <span>Reset Values</span>
            </button>
          )}
          <span className="env-pill">
            <i className="fa-solid fa-microchip text-emerald"></i> STM32 ADC: In-Situ Sensors
          </span>
          <span className="env-pill">
            <i className="fa-solid fa-water text-cyan"></i> Transducer: ~100 kHz Piezo
          </span>
        </div>
      </div>

      {/* Top Row: EDITABLE 3 Environmental Metric Cards ("we can also edit this sec") */}
      <div className="env-metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {/* Card 1: Temperature (EDITABLE) */}
        <div
          className="env-metric-card"
          style={{
            border: isEnvEdited ? '1.5px solid #7c3aed' : '1px solid rgba(196, 181, 253, 0.65)',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.08)',
          }}
        >
          <div className="env-card-top">
            <span className="env-metric-label">Temperature</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10.5px', color: '#7c3aed', fontWeight: 600 }}>
                <i className="fa-solid fa-pen-to-square"></i> Editable
              </span>
              <i className="fa-solid fa-temperature-half env-metric-icon text-emerald"></i>
            </div>
          </div>

          <div
            className="env-metric-value"
            id="envWaterTemp"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              margin: '6px 0 4px 0',
            }}
          >
            <input
              type="number"
              step="0.1"
              min="0"
              max="50"
              value={temperature}
              id="inputEnvTemperature"
              onChange={(e) => handleTempChange(parseFloat(e.target.value) || 0)}
              style={{
                fontFamily: 'inherit',
                fontSize: 'clamp(28px, 2.4vw, 36px)',
                fontWeight: 800,
                color: '#1e1b4b',
                background: 'rgba(237, 233, 254, 0.45)',
                border: '1.5px solid rgba(196, 181, 253, 0.8)',
                borderRadius: '8px',
                padding: '2px 8px',
                width: '120px',
                outline: 'none',
              }}
            />
            <span className="env-unit" style={{ fontSize: '18px' }}>°C</span>

            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => handleTempChange(temperature - 0.5)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd',
                  background: '#ffffff',
                  color: '#4c1d95',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                -
              </button>
              <button
                type="button"
                onClick={() => handleTempChange(temperature + 0.5)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd',
                  background: '#ffffff',
                  color: '#4c1d95',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                +
              </button>
            </div>
          </div>

          <input
            type="range"
            min="15"
            max="35"
            step="0.1"
            value={temperature}
            className="cyber-slider"
            style={{ margin: '4px 0 8px 0' }}
            onChange={(e) => handleTempChange(parseFloat(e.target.value))}
          />

          <div className="env-metric-foot">
            <span className="trend-up" style={{ color: isEnvEdited ? '#7c3aed' : '#34d399' }}>
              {isEnvEdited ? '● User Adjusted Parameter' : '● Real Sensor (Direct ADC)'}
            </span>
          </div>
        </div>

        {/* Card 2: Turbidity (EDITABLE) */}
        <div
          className="env-metric-card"
          style={{
            border: isEnvEdited ? '1.5px solid #7c3aed' : '1px solid rgba(196, 181, 253, 0.65)',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.08)',
          }}
        >
          <div className="env-card-top">
            <span className="env-metric-label">Turbidity</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10.5px', color: '#7c3aed', fontWeight: 600 }}>
                <i className="fa-solid fa-pen-to-square"></i> Editable
              </span>
              <i className="fa-solid fa-smog env-metric-icon text-emerald"></i>
            </div>
          </div>

          <div
            className="env-metric-value val-green"
            id="envTurbidity"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              margin: '6px 0 4px 0',
            }}
          >
            <input
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={turbidity}
              id="inputEnvTurbidity"
              onChange={(e) => handleTurbidityChange(parseFloat(e.target.value) || 0)}
              style={{
                fontFamily: 'inherit',
                fontSize: 'clamp(28px, 2.4vw, 36px)',
                fontWeight: 800,
                color: '#059669',
                background: 'rgba(209, 250, 229, 0.45)',
                border: '1.5px solid rgba(110, 231, 183, 0.8)',
                borderRadius: '8px',
                padding: '2px 8px',
                width: '120px',
                outline: 'none',
              }}
            />
            <span className="env-unit" style={{ fontSize: '18px' }}>NTU</span>

            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => handleTurbidityChange(turbidity - 1)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd',
                  background: '#ffffff',
                  color: '#4c1d95',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                -
              </button>
              <button
                type="button"
                onClick={() => handleTurbidityChange(turbidity + 1)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd',
                  background: '#ffffff',
                  color: '#4c1d95',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                +
              </button>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="30"
            step="0.5"
            value={turbidity}
            className="cyber-slider"
            style={{ margin: '4px 0 8px 0' }}
            onChange={(e) => handleTurbidityChange(parseFloat(e.target.value))}
          />

          <div className="env-metric-foot">
            <span className="trend-up" style={{ color: isEnvEdited ? '#7c3aed' : '#34d399' }}>
              {isEnvEdited ? '● User Adjusted Parameter' : '● Real Sensor (Optical)'}
            </span>
          </div>
        </div>

        {/* Card 3: Computed / Editable Sound Velocity */}
        <div
          className="env-metric-card"
          style={{
            border: isSoundSpeedManual ? '1.5px solid #0284c7' : '1px solid rgba(196, 181, 253, 0.65)',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.08)',
          }}
        >
          <div className="env-card-top">
            <span className="env-metric-label">Sound Velocity</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10.5px', color: isSoundSpeedManual ? '#0284c7' : '#7c3aed', fontWeight: 600 }}>
                {isSoundSpeedManual ? '● Manual c' : '● Auto Medwin'}
              </span>
              <i className="fa-solid fa-wave-square env-metric-icon text-cyan"></i>
            </div>
          </div>

          <div
            className="env-metric-value val-cyan"
            id="envSoundVel"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              margin: '6px 0 4px 0',
            }}
          >
            <input
              type="number"
              step="1"
              min="1400"
              max="1700"
              value={roundedSoundSpeed}
              id="inputEnvSoundSpeed"
              onChange={(e) => handleSoundSpeedChange(parseFloat(e.target.value) || 1570)}
              style={{
                fontFamily: 'inherit',
                fontSize: 'clamp(28px, 2.4vw, 36px)',
                fontWeight: 800,
                color: '#0284c7',
                background: 'rgba(224, 242, 254, 0.45)',
                border: '1.5px solid rgba(125, 211, 252, 0.8)',
                borderRadius: '8px',
                padding: '2px 8px',
                width: '135px',
                outline: 'none',
              }}
            />
            <span className="env-unit" style={{ fontSize: '18px' }}>m/s</span>

            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => handleSoundSpeedChange(soundSpeed - 5)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd',
                  background: '#ffffff',
                  color: '#0284c7',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                -
              </button>
              <button
                type="button"
                onClick={() => handleSoundSpeedChange(soundSpeed + 5)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd',
                  background: '#ffffff',
                  color: '#0284c7',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                +
              </button>
            </div>
          </div>

          <input
            type="range"
            min="1450"
            max="1650"
            step="1"
            value={roundedSoundSpeed}
            className="cyber-slider"
            style={{ margin: '4px 0 8px 0' }}
            onChange={(e) => handleSoundSpeedChange(parseFloat(e.target.value))}
          />

          <div className="env-metric-foot">
            <span className="text-cyan">
              {isSoundSpeedManual
                ? 'Manual Sound Speed Override'
                : 'Mackenzie / Medwin Eq (Linked to Temp)'}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Left LFM Chirp Oscilloscope Graph + Right Output Section & Manual Controls */}
      <div className="env-charts-grid" style={{ gridTemplateColumns: '1.45fr 1fr', gap: '20px', marginTop: '20px' }}>
        {/* LEFT PANEL: LFM Chirp Oscilloscope Graph */}
        <div className="env-chart-panel" style={{ padding: '20px' }}>
          <div className="dash-card-header-flex" style={{ marginBottom: '12px' }}>
            <div>
              <h2 className="env-panel-title" style={{ fontSize: '16.5px' }}>
                Real-Time Waveform Monitor ({waveformType})
              </h2>
              <p className="env-panel-sub" style={{ fontSize: '12px' }}>
                Sweep: {sweepStart.toFixed(1)} kHz → {sweepEnd.toFixed(1)} kHz | Duration: {pulseDur} ms | Medium c: {roundedSoundSpeed} m/s
              </p>
            </div>

            <div className="waveform-legend" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <label className="legend-item" style={{ fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showEnvelope}
                  onChange={(e) => setShowEnvelope(e.target.checked)}
                />
                <span className="legend-color-box box-outline"></span>
                <span>Envelope</span>
              </label>
              <label className="legend-item" style={{ fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                <span className="legend-color-box box-cyan"></span>
                <span>Grid</span>
              </label>
            </div>
          </div>

          {/* Oscilloscope Canvas Screen */}
          <div
            className="oscilloscope-wrapper"
            style={{
              position: 'relative',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(196, 181, 253, 0.65)',
              background: '#ffffff',
              boxShadow: 'inset 0 2px 8px rgba(124, 58, 237, 0.05)',
            }}
          >
            <div className="pulse-dur-label pulse-dur-top" style={{ color: '#0284c7' }}>
              Pulse: {pulseDur} ms | Sweep Rate: {sweepRate} kHz/ms
            </div>
            <canvas
              ref={oscCanvasRef}
              id="envOscilloscopeCanvas"
              width={720}
              height={220}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            ></canvas>
            <div className="pulse-dur-label pulse-dur-bottom" style={{ color: '#6d28d9' }}>
              Time-Domain LFM Chirp Sweep ({sweepStart.toFixed(1)} – {sweepEnd.toFixed(1)} kHz)
            </div>
          </div>

          {/* Lower FFT Power Spectrum Screen */}
          <div
            className="spectrum-wrapper"
            style={{
              position: 'relative',
              marginTop: '14px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(196, 181, 253, 0.65)',
              background: '#ffffff',
              padding: '8px 12px',
            }}
          >
            <div className="spectrum-y-axis-label" style={{ color: '#64748b' }}>
              Power (dB)
            </div>
            <canvas
              ref={specCanvasRef}
              id="envSpectrumCanvas"
              width={720}
              height={90}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            ></canvas>
            <div className="spectrum-x-axis" style={{ color: '#64748b' }}>
              <span>0 kHz</span>
              <span>50 kHz</span>
              <span>100 kHz</span>
              <span>150 kHz</span>
              <span>200 kHz</span>
            </div>
            <div className="spectrum-x-axis-title" style={{ color: '#6d28d9' }}>
              Carrier Frequency Spectrum — Center: {centerFreq.toFixed(1)} kHz | Δf: {bandwidth.toFixed(1)} kHz
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Output Section & Manual Tuning Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Section 1: Output Specifications ("Output Sec") */}
          <section className="env-chart-panel">
            <div className="env-panel-header">
              <div className="panel-header-left">
                <h2 className="env-panel-title" style={{ fontSize: '15.5px' }}>
                  Acoustic Output Section
                </h2>
                <span className="env-panel-sub" style={{ fontSize: '12px', color: '#6d28d9' }}>
                  Real-time synthesized transmitter output &amp; in-situ acoustics
                </span>
              </div>
            </div>

            <div className="dash-kv-list" style={{ marginTop: '6px' }}>
              <div className="dash-kv-row">
                <span className="kv-label">Transmitted Waveform</span>
                <span className="kv-val val-cyan">{waveformType}</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">In-situ Sound Speed (c)</span>
                <span className="kv-val val-cyan">{roundedSoundSpeed} m/s</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Acoustic Wavelength (λ)</span>
                <span className="kv-val" style={{ color: '#7c3aed' }}>{wavelengthMm} mm</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Sweep Frequency Range</span>
                <span className="kv-val val-cyan">
                  {sweepStart.toFixed(1)} – {sweepEnd.toFixed(1)} kHz
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Time-Bandwidth Product (TB)</span>
                <span className="kv-val" style={{ color: '#0284c7' }}>{tbProduct.toFixed(0)}</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Theoretical Compression Gain</span>
                <span className="kv-val val-green">+{compressionGain} dB</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Range Resolution (ΔR)</span>
                <span className="kv-val" style={{ color: '#7c3aed' }}>{rangeResCm} cm</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Chirp Sweep Rate (K)</span>
                <span className="kv-val" style={{ color: '#0284c7' }}>{sweepRate} kHz/ms</span>
              </div>
            </div>
          </section>

          {/* Section 2: Manual Parameter Controls ("Values can be manually changed") */}
          <section className="env-chart-panel">
            <div className="env-panel-header">
              <div className="panel-header-left">
                <h2 className="env-panel-title" style={{ fontSize: '15px' }}>
                  Manual Parameter Controls
                </h2>
                <span className="env-panel-sub" style={{ fontSize: '11.5px', color: '#6d28d9' }}>
                  Drag sliders to update the LFM chirp graph &amp; output values in real-time
                </span>
              </div>
            </div>

            <div className="dash-controls-list" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Slider 1: Center Frequency */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name" style={{ fontSize: '12px' }}>Carrier Frequency (fc)</span>
                  <span className="control-val" style={{ color: '#0284c7', fontSize: '12px' }}>
                    {centerFreq.toFixed(1)} kHz
                  </span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="130"
                  step="1"
                  value={centerFreq}
                  className="cyber-slider"
                  id="sliderEnvCenterFreq"
                  onChange={(e) => handleCenterFreqChange(Number(e.target.value))}
                />
              </div>

              {/* Slider 2: Bandwidth */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name" style={{ fontSize: '12px' }}>Chirp Bandwidth (Δf)</span>
                  <span className="control-val" style={{ color: '#0284c7', fontSize: '12px' }}>
                    {bandwidth.toFixed(1)} kHz
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="1"
                  value={bandwidth}
                  className="cyber-slider"
                  id="sliderEnvBandwidth"
                  onChange={(e) => handleBandwidthChange(Number(e.target.value))}
                />
              </div>

              {/* Slider 3: Pulse Duration */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name" style={{ fontSize: '12px' }}>Pulse Duration (τ)</span>
                  <span className="control-val" style={{ color: '#7c3aed', fontSize: '12px' }}>
                    {pulseDur} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={pulseDur}
                  className="cyber-slider"
                  id="sliderEnvPulseDur"
                  onChange={(e) => handlePulseDurChange(Number(e.target.value))}
                />
              </div>

              {/* Slider 4: Amplitude */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name" style={{ fontSize: '12px' }}>Output Amplitude</span>
                  <span className="control-val" style={{ color: '#059669', fontSize: '12px' }}>
                    {amplitude}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={amplitude}
                  className="cyber-slider"
                  id="sliderEnvAmplitude"
                  onChange={(e) => handleAmplitudeChange(Number(e.target.value))}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Row: Real Sensor Telemetry Log Table */}
      <div className="env-table-panel" style={{ marginTop: '20px' }}>
        <div className="env-table-header">
          <div>
            <h2 className="env-chart-title">WaveForge Telemetry Log</h2>
            <span className="table-subtitle">In-Situ Physical Sensor Readings &amp; Transmitted LFM Acoustic Waveform</span>
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
                <th>Temperature</th>
                <th>Turbidity</th>
                <th>Sound Velocity</th>
                <th>Waveform Engine</th>
              </tr>
            </thead>
            <tbody id="envLogTableBody">
              {logEntries.map((entry, idx) => (
                <tr key={idx}>
                  <td style={{ color: '#94a3b8' }}>{entry.time}</td>
                  <td style={{ color: '#34d399', fontWeight: 600 }}>{entry.temp}</td>
                  <td style={{ color: '#34d399', fontWeight: 600 }}>{entry.turbidity}</td>
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
