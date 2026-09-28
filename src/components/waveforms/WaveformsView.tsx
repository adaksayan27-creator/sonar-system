import React, { useState } from 'react';
import type { TelemetryData } from '../../types/sonar';

interface WaveformsViewProps {
  telemetry: TelemetryData;
}

export const WaveformsView: React.FC<WaveformsViewProps> = ({ telemetry }) => {
  const [selectedType, setSelectedType] = useState('LFM Linear Chirp');
  const windowing = 'Tukey (Tapered 12%)';
  const dacRate = '1.0 MSPS';

  const waveforms = [
    {
      name: 'LFM Linear Chirp',
      tag: 'ACTIVE',
      desc: 'Linear Frequency Modulated chirp sweeping 75.0 kHz to 125.0 kHz. Optimum pulse compression and range resolution for high-clutter shallow water.',
      specs: { bw: '50.0 kHz', center: '100.0 kHz', dur: '20 ms', gain: '+24 dB' },
    },
    {
      name: 'CW Continuous Wave Pulse',
      tag: 'STANDBY',
      desc: 'Single-frequency tonal ping at 100.0 kHz. Maximizes Doppler velocity detection and moving target indicator (MTI) sensitivity.',
      specs: { bw: '0.5 kHz', center: '100.0 kHz', dur: '40 ms', gain: '+18 dB' },
    },
    {
      name: 'HFM Hyperbolic Chirp',
      tag: 'READY',
      desc: 'Doppler-invariant hyperbolic frequency modulation. Retains matched filter correlation peak under rapid target motion.',
      specs: { bw: '40.0 kHz', center: '95.0 kHz', dur: '25 ms', gain: '+22 dB' },
    },
    {
      name: 'Costas Frequency-Hopped Array',
      tag: 'READY',
      desc: 'Pseudorandom discrete frequency coded sequence with thumbtack ambiguity function. Zero range-Doppler cross-coupling.',
      specs: { bw: '60.0 kHz', center: '105.0 kHz', dur: '16 ms', gain: '+26 dB' },
    },
  ];

  return (
    <main className="env-main-layout">
      <div className="env-header-row">
        <div>
          <h1 className="env-page-title">Waveform Synthesis & Modulation Engine</h1>
          <p className="env-page-subtitle">
            Software-defined acoustic pulse generation on STM32G474RE 12-bit DAC
          </p>
        </div>
        <div className="env-status-pills">
          <div className="env-pill">
            <i className="fa-solid fa-microchip"></i>
            <span>DAC: <strong style={{ color: '#0284c7' }}>{dacRate}</strong></span>
          </div>
          <div className="env-pill">
            <i className="fa-solid fa-wave-square"></i>
            <span>Active: <strong style={{ color: '#7c3aed' }}>{selectedType}</strong></span>
          </div>
        </div>
      </div>

      {/* Grid of Waveform Types */}
      <div className="env-charts-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <section className="env-chart-panel">
          <div className="env-panel-header">
            <div className="panel-header-left">
              <h2 className="env-panel-title">Waveform Library & Modulation Profiles</h2>
              <span className="env-panel-sub">Select pulse type to program transmitter DMA table</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            {waveforms.map((wf) => (
              <div
                key={wf.name}
                onClick={() => setSelectedType(wf.name)}
                style={{
                  background: selectedType === wf.name ? 'rgba(237, 233, 254, 0.7)' : 'rgba(255, 255, 255, 0.75)',
                  border: selectedType === wf.name ? '1.5px solid #7c3aed' : '1px solid rgba(196, 181, 253, 0.5)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: selectedType === wf.name ? '0 4px 14px rgba(124, 58, 237, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e1b4b' }}>{wf.name}</span>
                  <span
                    className={`badge-status ${wf.tag === 'ACTIVE' ? 'badge-healthy' : 'badge-active'}`}
                    style={{ fontSize: '10px' }}
                  >
                    {wf.tag}
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  {wf.desc}
                </p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: '#4c1d95' }}>
                  <span>BW: <strong>{wf.specs.bw}</strong></span>
                  <span>Center: <strong>{wf.specs.center}</strong></span>
                  <span>Duration: <strong>{wf.specs.dur}</strong></span>
                  <span>Proc. Gain: <strong>{wf.specs.gain}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pulse Synthesis Parameters & Hardware Registers */}
        <section className="env-chart-panel">
          <div className="env-panel-header">
            <div className="panel-header-left">
              <h2 className="env-panel-title">Transmitter Synthesis Parameters</h2>
              <span className="env-panel-sub">Real-time STM32 DMA buffer properties</span>
            </div>
          </div>

          <div className="dash-kv-list" style={{ marginTop: '12px' }}>
            <div className="dash-kv-row">
              <span className="kv-label">Target Carrier</span>
              <span className="kv-val" style={{ color: '#0284c7' }}>{telemetry.center_frequency.toFixed(1)} kHz</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Chirp Bandwidth</span>
              <span className="kv-val" style={{ color: '#0284c7' }}>{telemetry.bandwidth.toFixed(1)} kHz</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Pulse Duration</span>
              <span className="kv-val">{telemetry.pulse_duration} ms</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">DAC Sample Rate</span>
              <span className="kv-val val-green">1.0 MSPS (12-bit)</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Window Envelope</span>
              <span className="kv-val" style={{ color: '#7c3aed' }}>{windowing}</span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Time-Bandwidth Product (TB)</span>
              <span className="kv-val" style={{ color: '#0284c7' }}>
                {(telemetry.bandwidth * telemetry.pulse_duration).toFixed(0)}
              </span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Theoretical Compression Gain</span>
              <span className="kv-val val-green">
                {(10 * Math.log10(Math.max(1, telemetry.bandwidth * telemetry.pulse_duration))).toFixed(1)} dB
              </span>
            </div>
            <div className="dash-kv-row">
              <span className="kv-label">Range Resolution (ΔR)</span>
              <span className="kv-val" style={{ color: '#7c3aed' }}>
                {((telemetry.sound_velocity / (2 * telemetry.bandwidth * 1000)) * 100).toFixed(1)} cm
              </span>
            </div>
          </div>

          <div style={{ marginTop: '24px', padding: '14px', background: 'rgba(245, 243, 255, 0.8)', borderRadius: '8px', border: '1px solid rgba(196, 181, 253, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#7c3aed' }}></i>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2e1065' }}>Adaptive Modulation Hint</span>
            </div>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Current turbidity ({telemetry.turbidity.toFixed(1)} NTU) and depth ({telemetry.depth_proxy.toFixed(1)}m) support full 50 kHz bandwidth with minimal acoustic scattering attenuation.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};
