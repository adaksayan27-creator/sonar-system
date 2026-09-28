import React, { useState, useRef, useEffect } from 'react';
import type { TelemetryData } from '../../types/sonar';

interface WaveformsViewProps {
  telemetry: TelemetryData;
  onParamChange?: (params: Partial<TelemetryData>) => void;
}

type WaveformType =
  | 'LFM Linear Chirp'
  | 'CW Continuous Wave Pulse'
  | 'HFM Hyperbolic Chirp'
  | 'Costas Frequency-Hopped Array';

export const WaveformsView: React.FC<WaveformsViewProps> = ({ telemetry, onParamChange }) => {
  const [selectedType, setSelectedType] = useState<WaveformType>(
    (telemetry.waveform_type as WaveformType) || 'LFM Linear Chirp'
  );

  // Manual adjustable parameters with telemetry defaults
  const [centerFreq, setCenterFreq] = useState<number>(telemetry.center_frequency || 100.0);
  const [bandwidth, setBandwidth] = useState<number>(telemetry.bandwidth || 50.0);
  const [pulseDur, setPulseDur] = useState<number>(telemetry.pulse_duration || 20);
  const [amplitude, setAmplitude] = useState<number>(telemetry.amplitude || 80);
  const [windowEnvelope, setWindowEnvelope] = useState<string>('Tukey (12%)');

  // Canvas display toggles
  const [showEnvelope, setShowEnvelope] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);

  // Synchronize state with telemetry to ensure all pages' graphs and values remain interconnected
  useEffect(() => {
    if (telemetry.center_frequency !== undefined) setCenterFreq(telemetry.center_frequency);
    if (telemetry.bandwidth !== undefined) setBandwidth(telemetry.bandwidth);
    if (telemetry.pulse_duration !== undefined) setPulseDur(telemetry.pulse_duration);
    if (telemetry.amplitude !== undefined) setAmplitude(telemetry.amplitude);
    if (telemetry.waveform_type) setSelectedType(telemetry.waveform_type as WaveformType);
  }, [
    telemetry.center_frequency,
    telemetry.bandwidth,
    telemetry.pulse_duration,
    telemetry.amplitude,
    telemetry.waveform_type,
  ]);

  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const specCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const waveforms: Array<{
    name: WaveformType;
    tag: string;
    desc: string;
    specs: { bw: string; center: string; dur: string; gain: string };
  }> = [
    {
      name: 'LFM Linear Chirp',
      tag: 'ACTIVE',
      desc: 'Linear Frequency Modulated chirp sweeping from start to stop frequency. Optimum pulse compression and range resolution for high-clutter shallow water.',
      specs: {
        bw: `${bandwidth.toFixed(1)} kHz`,
        center: `${centerFreq.toFixed(1)} kHz`,
        dur: `${pulseDur} ms`,
        gain: `+${(10 * Math.log10(Math.max(1, bandwidth * pulseDur))).toFixed(0)} dB`,
      },
    },
    {
      name: 'CW Continuous Wave Pulse',
      tag: 'READY',
      desc: 'Single-frequency tonal pulse at carrier frequency. Maximizes Doppler velocity detection and moving target indicator (MTI) sensitivity.',
      specs: { bw: '0.5 kHz', center: `${centerFreq.toFixed(1)} kHz`, dur: `${pulseDur} ms`, gain: '+18 dB' },
    },
    {
      name: 'HFM Hyperbolic Chirp',
      tag: 'READY',
      desc: 'Doppler-invariant hyperbolic frequency modulation. Retains matched filter correlation peak under rapid target motion and platform velocity.',
      specs: { bw: '40.0 kHz', center: `${(centerFreq * 0.95).toFixed(1)} kHz`, dur: `${pulseDur} ms`, gain: '+22 dB' },
    },
    {
      name: 'Costas Frequency-Hopped Array',
      tag: 'READY',
      desc: 'Pseudorandom discrete frequency coded sequence with thumbtack ambiguity function. Zero range-Doppler cross-coupling.',
      specs: { bw: '60.0 kHz', center: `${centerFreq.toFixed(1)} kHz`, dur: `${pulseDur} ms`, gain: '+26 dB' },
    },
  ];

  // Calculated derived parameters
  const soundSpeed = Math.round(telemetry.sound_velocity || 1570);
  const sweepStart = Math.max(10, centerFreq - bandwidth / 2);
  const sweepEnd = centerFreq + bandwidth / 2;
  const tbProduct = bandwidth * pulseDur;
  const compressionGain = (10 * Math.log10(Math.max(1, tbProduct))).toFixed(1);
  const rangeResCm = ((soundSpeed / (2 * bandwidth * 1000)) * 100).toFixed(1);
  const wavelengthMm = ((soundSpeed / (centerFreq * 1000)) * 1000).toFixed(2);
  const sweepRate = (bandwidth / pulseDur).toFixed(2); // kHz/ms

  // Broadcast parameter changes to App state & WebSocket
  const handleFreqChange = (val: number) => {
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

  const handleSelectWaveform = (type: WaveformType) => {
    setSelectedType(type);
    onParamChange?.({ waveform_type: type });
  };

  // Web Audio ping demonstration
  const handleAuditionPing = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const baseAudioFreq = 750 + ((centerFreq - 70) / 60) * 500;
      const audioBw = (bandwidth / 80) * 1200;

      if (selectedType === 'LFM Linear Chirp') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseAudioFreq - audioBw / 2, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(
          baseAudioFreq + audioBw / 2,
          ctx.currentTime + pulseDur / 1000
        );
      } else if (selectedType === 'CW Continuous Wave Pulse') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseAudioFreq, ctx.currentTime);
      } else if (selectedType === 'HFM Hyperbolic Chirp') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseAudioFreq - audioBw / 2, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          baseAudioFreq + audioBw / 2,
          ctx.currentTime + pulseDur / 1000
        );
      } else {
        // Costas hop tones
        osc.type = 'triangle';
        const hops = [2, 6, 3, 5, 1, 4];
        const hopDuration = (pulseDur / 1000) / hops.length;
        hops.forEach((h, i) => {
          osc.frequency.setValueAtTime(
            baseAudioFreq + (h - 3.5) * 150,
            ctx.currentTime + i * hopDuration
          );
        });
      }

      const ampFactor = (amplitude / 100) * 0.35;
      gain.gain.setValueAtTime(ampFactor, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + pulseDur / 1000 + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + pulseDur / 1000 + 0.2);

      setIsTransmitting(true);
      setTimeout(() => setIsTransmitting(false), Math.max(400, pulseDur * 10));
    } catch {
      // AudioContext unavailable
    }
  };

  // Render Time-Domain Waveform Oscilloscope Canvas
  useEffect(() => {
    const canvas = oscCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // 1. Grid
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

      // Centerline
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Envelope sizing
      const maxAmp = (height * 0.4) * (amplitude / 100);
      const pulseFraction = Math.max(0.2, Math.min(0.85, pulseDur / 45));
      const pulseW = width * pulseFraction;
      const pulseStart = (width - pulseW) / 2;
      const pulseEnd = pulseStart + pulseW;
      const taperW = windowEnvelope.includes('Tukey')
        ? pulseW * 0.12
        : windowEnvelope.includes('Hann')
        ? pulseW * 0.45
        : windowEnvelope.includes('Hamming')
        ? pulseW * 0.35
        : 2;

      // Draw Envelope Boundary
      if (showEnvelope) {
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        // Upper envelope
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(pulseStart, centerY);
        ctx.lineTo(pulseStart + taperW, centerY - maxAmp);
        ctx.lineTo(pulseEnd - taperW, centerY - maxAmp);
        ctx.lineTo(pulseEnd, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Lower envelope
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(pulseStart, centerY);
        ctx.lineTo(pulseStart + taperW, centerY + maxAmp);
        ctx.lineTo(pulseEnd - taperW, centerY + maxAmp);
        ctx.lineTo(pulseEnd, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        ctx.setLineDash([]);
      }

      // Draw Active Waveform
      ctx.strokeStyle = '#0284c7';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 9;
      ctx.lineWidth = 2.2;
      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        let env = 0;
        if (x >= pulseStart && x <= pulseEnd) {
          const relX = x - pulseStart;
          if (relX < taperW) {
            env = relX / taperW;
          } else if (relX > pulseW - taperW) {
            env = (pulseW - relX) / taperW;
          } else {
            env = 1;
          }
        }

        let y = centerY;
        const normPulsePos = Math.max(0, Math.min(1, (x - pulseStart) / pulseW));

        if (selectedType === 'LFM Linear Chirp') {
          // Linear frequency ramp: start low, ramp to high
          const startF = 0.05 + (sweepStart / 130) * 0.04;
          const endF = 0.12 + (sweepEnd / 170) * 0.16;
          const instFreq = startF + normPulsePos * (endF - startF);
          y = centerY + Math.sin(x * instFreq + phase) * maxAmp * env;
        } else if (selectedType === 'CW Continuous Wave Pulse') {
          // Pure sinusoidal tonal carrier
          const cwFreq = 0.08 + (centerFreq / 100) * 0.07;
          y = centerY + Math.sin(x * cwFreq + phase) * maxAmp * env;
        } else if (selectedType === 'HFM Hyperbolic Chirp') {
          // Hyperbolic frequency chirp
          const hfmStart = 0.04;
          const hfmEnd = 0.22;
          const tNorm = Math.max(0.01, normPulsePos);
          const instFreq = (hfmStart * hfmEnd) / (hfmEnd - (hfmEnd - hfmStart) * tNorm);
          y = centerY + Math.sin(x * instFreq + phase) * maxAmp * env;
        } else {
          // Costas array frequency hopping: 6 hops
          const hops = [2, 6, 3, 5, 1, 4];
          const hopIndex = Math.min(hops.length - 1, Math.floor(normPulsePos * hops.length));
          const hopFreq = 0.05 + hops[hopIndex] * 0.028;
          y = centerY + Math.sin(x * hopFreq + phase) * maxAmp * env;
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      // Pulse start/end visual markers
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(pulseStart, 0);
      ctx.lineTo(pulseStart, height);
      ctx.moveTo(pulseEnd, 0);
      ctx.lineTo(pulseEnd, height);
      ctx.stroke();
      ctx.setLineDash([]);

      phase += 0.08;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [
    selectedType,
    centerFreq,
    bandwidth,
    pulseDur,
    amplitude,
    windowEnvelope,
    showEnvelope,
    showGrid,
    sweepStart,
    sweepEnd,
  ]);

  // Render Frequency Spectrum (FFT) Canvas
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

      if (selectedType === 'LFM Linear Chirp') {
        // Flat bandpass spectrum with steep roll-off
        const dist = Math.abs(x - peakX) / (peakWidth * 0.5);
        if (dist <= 1.0) {
          spectralShape = 1.0 - Math.pow(dist, 4) * 0.15;
        } else {
          spectralShape = Math.exp(-Math.pow((dist - 1.0) * 3, 2));
        }
      } else if (selectedType === 'CW Continuous Wave Pulse') {
        // Sharp Dirac delta / sinc tone
        const dist = (x - peakX) / 8;
        spectralShape = Math.exp(-0.5 * dist * dist);
      } else if (selectedType === 'HFM Hyperbolic Chirp') {
        // Slightly tilted bandpass
        const dist = Math.abs(x - peakX) / (peakWidth * 0.5);
        if (dist <= 1.0) {
          spectralShape = 0.95 - (x - peakX) / peakWidth * 0.15;
        } else {
          spectralShape = Math.exp(-Math.pow((dist - 1.0) * 3, 2));
        }
      } else {
        // Costas array: discrete spectral peaks
        const hops = [2, 6, 3, 5, 1, 4];
        let maxHopVal = 0;
        hops.forEach((h) => {
          const hopX = peakX + ((h - 3.5) / 3.5) * (peakWidth * 0.45);
          const d = (x - hopX) / 6;
          maxHopVal = Math.max(maxHopVal, Math.exp(-0.5 * d * d));
        });
        spectralShape = maxHopVal;
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
  }, [selectedType, centerFreq, bandwidth, amplitude]);

  return (
    <main className="env-main-layout" id="viewWaveforms">
      {/* Top Header Row */}
      <div className="env-header-row">
        <div>
          <h1 className="env-page-title">Waveform Synthesis &amp; Modulation Engine</h1>
          <p className="env-page-subtitle">
            Interactive software-defined acoustic pulse generation &amp; real-time oscilloscope monitor
          </p>
        </div>
        <div className="env-status-pills">
          <div className="env-pill">
            <i className="fa-solid fa-microchip text-emerald"></i>
            <span>
              DAC: <strong style={{ color: '#0284c7' }}>1.0 MSPS (12-bit)</strong>
            </span>
          </div>
          <div className="env-pill">
            <i className="fa-solid fa-wave-square text-cyan"></i>
            <span>
              Active: <strong style={{ color: '#7c3aed' }}>{selectedType}</strong>
            </span>
          </div>
          <button
            type="button"
            className="dash-btn-status ping-btn"
            id="btnAuditionPing"
            onClick={handleAuditionPing}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-volume-high"></i>
            <span>{isTransmitting ? 'Transmitting...' : 'Audition Pulse'}</span>
          </button>
        </div>
      </div>

      {/* Primary Layout Grid: Left Profiles + Controls, Right Live Waveform Graph */}
      <div className="env-charts-grid" style={{ gridTemplateColumns: '1fr 1.35fr', gap: '20px' }}>
        {/* LEFT COLUMN: Waveform Profiles & Interactive Parameter Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Card 1: Waveform Library & Selection */}
          <section className="env-chart-panel">
            <div className="env-panel-header">
              <div className="panel-header-left">
                <h2 className="env-panel-title">Waveform Library &amp; Modulation Profiles</h2>
                <span className="env-panel-sub">Click a profile to generate &amp; visualize its waveform</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              {waveforms.map((wf) => {
                const isActive = selectedType === wf.name;
                return (
                  <div
                    key={wf.name}
                    id={`card-${wf.name.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => handleSelectWaveform(wf.name)}
                    style={{
                      background: isActive ? 'rgba(237, 233, 254, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                      border: isActive ? '2px solid #7c3aed' : '1px solid rgba(196, 181, 253, 0.55)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isActive ? '0 6px 18px rgba(124, 58, 237, 0.18)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#1e1b4b' }}>
                        {wf.name}
                      </span>
                      <span
                        className={`badge-status ${isActive ? 'badge-healthy' : 'badge-active'}`}
                        style={{ fontSize: '10px' }}
                      >
                        {isActive ? 'ACTIVE' : 'READY'}
                      </span>
                    </div>
                    <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 8px 0', lineHeight: 1.45 }}>
                      {wf.desc}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: '#4c1d95',
                      }}
                    >
                      <span>
                        BW: <strong>{wf.specs.bw}</strong>
                      </span>
                      <span>
                        Center: <strong>{wf.specs.center}</strong>
                      </span>
                      <span>
                        Duration: <strong>{wf.specs.dur}</strong>
                      </span>
                      <span>
                        Gain: <strong>{wf.specs.gain}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card 2: Interactive Parameter Sliders ("Data we can change manually") */}
          <section className="env-chart-panel">
            <div className="env-panel-header">
              <div className="panel-header-left">
                <h2 className="env-panel-title">Manual Waveform Tuning Controls</h2>
                <span className="env-panel-sub">Change values manually to update the graph in real-time</span>
              </div>
            </div>

            <div className="dash-controls-list" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Slider 1: Carrier / Center Frequency */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name">Carrier Frequency (fc)</span>
                  <span className="control-val" style={{ color: '#0284c7' }}>
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
                  id="sliderCarrierFreqWaveforms"
                  onChange={(e) => handleFreqChange(Number(e.target.value))}
                />
              </div>

              {/* Slider 2: Chirp Bandwidth */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name">Chirp Bandwidth (Δf)</span>
                  <span className="control-val" style={{ color: '#0284c7' }}>
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
                  id="sliderBandwidthWaveforms"
                  onChange={(e) => handleBandwidthChange(Number(e.target.value))}
                />
              </div>

              {/* Slider 3: Pulse Duration */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name">Pulse Duration (τ)</span>
                  <span className="control-val" style={{ color: '#7c3aed' }}>
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
                  id="sliderPulseDurWaveforms"
                  onChange={(e) => handlePulseDurChange(Number(e.target.value))}
                />
              </div>

              {/* Slider 4: Amplitude */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name">DAC Output Amplitude</span>
                  <span className="control-val" style={{ color: '#059669' }}>
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
                  id="sliderAmplitudeWaveforms"
                  onChange={(e) => handleAmplitudeChange(Number(e.target.value))}
                />
              </div>

              {/* Window Envelope Selector */}
              <div className="dash-control-row">
                <div className="control-header">
                  <span className="control-name">Window Taper Envelope</span>
                  <span className="control-val" style={{ color: '#7c3aed' }}>
                    {windowEnvelope}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {['Tukey (12%)', 'Hann', 'Hamming', 'Rectangular'].map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setWindowEnvelope(env)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: windowEnvelope === env ? '1.5px solid #7c3aed' : '1px solid rgba(196, 181, 253, 0.6)',
                        background: windowEnvelope === env ? '#ede9fe' : 'rgba(255, 255, 255, 0.8)',
                        color: windowEnvelope === env ? '#4c1d95' : '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      {env}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: The Waveform Graph & Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Section: Waveform Real-time Monitor (The Canvas Graph) */}
          <section className="env-chart-panel" style={{ padding: '20px' }}>
            <div className="dash-card-header-flex" style={{ marginBottom: '14px' }}>
              <div>
                <h2 className="env-panel-title" style={{ fontSize: '16px' }}>
                  {selectedType} Waveform Monitor
                </h2>
                <p className="env-panel-sub" style={{ fontSize: '12px' }}>
                  Sweep: {sweepStart.toFixed(1)} kHz → {sweepEnd.toFixed(1)} kHz | Duration: {pulseDur} ms | Gain: +{compressionGain} dB
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

            {/* Upper Oscilloscope Time-Domain Screen */}
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
                Pulse: {pulseDur} ms | Envelope: {windowEnvelope}
              </div>
              <canvas
                ref={oscCanvasRef}
                id="waveformOscilloscopeCanvas"
                width={720}
                height={230}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              ></canvas>
              <div className="pulse-dur-label pulse-dur-bottom" style={{ color: '#6d28d9' }}>
                Time-Domain Acoustic Pulse ({pulseDur} ms Window)
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
                id="waveformSpectrumCanvas"
                width={720}
                height={95}
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
                Frequency Spectrum (0–200 kHz) — Center: {centerFreq.toFixed(1)} kHz
              </div>
            </div>
          </section>

          {/* Section: Transmitter Synthesis Parameters Table */}
          <section className="env-chart-panel">
            <div className="env-panel-header">
              <div className="panel-header-left">
                <h2 className="env-panel-title">Transmitter Synthesis Parameters</h2>
                <span className="env-panel-sub">Real-time STM32 DMA buffer &amp; matched filter specs</span>
              </div>
            </div>

            <div className="dash-kv-list" style={{ marginTop: '10px' }}>
              <div className="dash-kv-row">
                <span className="kv-label">Target Carrier (fc)</span>
                <span className="kv-val" style={{ color: '#0284c7' }}>
                  {centerFreq.toFixed(1)} kHz
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Chirp Bandwidth (Δf)</span>
                <span className="kv-val" style={{ color: '#0284c7' }}>
                  {bandwidth.toFixed(1)} kHz
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Sweep Frequency Range</span>
                <span className="kv-val val-cyan">
                  {sweepStart.toFixed(1)} – {sweepEnd.toFixed(1)} kHz
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Chirp Sweep Rate (K)</span>
                <span className="kv-val" style={{ color: '#7c3aed' }}>
                  {sweepRate} kHz/ms
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Pulse Duration (τ)</span>
                <span className="kv-val">{pulseDur} ms</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">DAC Sample Rate</span>
                <span className="kv-val val-green">1.0 MSPS (12-bit)</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Window Envelope</span>
                <span className="kv-val" style={{ color: '#7c3aed' }}>
                  {windowEnvelope}
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Time-Bandwidth Product (TB)</span>
                <span className="kv-val" style={{ color: '#0284c7' }}>
                  {tbProduct.toFixed(0)}
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Theoretical Compression Gain</span>
                <span className="kv-val val-green">+{compressionGain} dB</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Acoustic Wavelength (λ)</span>
                <span className="kv-val" style={{ color: '#0284c7', fontWeight: 700 }}>
                  {wavelengthMm} mm
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Range Resolution (ΔR)</span>
                <span className="kv-val" style={{ color: '#7c3aed', fontWeight: 700 }}>
                  {rangeResCm} cm
                </span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">In-Situ Sound Speed (c)</span>
                <span className="kv-val val-cyan">{soundSpeed} m/s</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Medium Water Temp</span>
                <span className="kv-val" style={{ color: '#059669' }}>{telemetry.temperature.toFixed(1)} °C</span>
              </div>
              <div className="dash-kv-row">
                <span className="kv-label">Medium Turbidity</span>
                <span className="kv-val" style={{ color: '#059669' }}>{telemetry.turbidity.toFixed(1)} NTU</span>
              </div>
            </div>

            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                background: 'rgba(245, 243, 255, 0.85)',
                borderRadius: '8px',
                border: '1px solid rgba(196, 181, 253, 0.55)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <i className="fa-solid fa-circle-info" style={{ color: '#7c3aed' }}></i>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#2e1065' }}>
                  Acoustic Transmission Status (Interconnected)
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                Current sound velocity (<strong>{soundSpeed} m/s</strong> @ {telemetry.temperature.toFixed(1)} °C) and bandwidth (<strong>{bandwidth.toFixed(1)} kHz</strong>) provide an optimal range resolution of <strong>{rangeResCm} cm</strong> with an acoustic wavelength of <strong>{wavelengthMm} mm</strong> and compression gain of <strong>+{compressionGain} dB</strong>.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};
