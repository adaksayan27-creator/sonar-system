export type ConsolePage = 'dashboard' | 'environment' | 'waveforms' | 'analytics' | 'system';

export type TimeRange = '1h' | '6h' | '24h' | '7d';

export interface SystemStatusState {
  stm32: 'ONLINE' | 'STANDBY' | 'ERROR';
  esp32: 'READY' | 'STANDBY' | 'DISCONNECTED';
  sensors: 'ACTIVE' | 'CALIBRATING' | 'ERROR';
  waveform: 'GENERATING' | 'IDLE';
}

export interface TelemetryData {
  temperature: number;      // °C (Real Sensor)
  turbidity: number;        // NTU (Real Sensor)
  depth_proxy: number;      // m (Potentiometer Proxy)
  salinity_proxy: number;   // PSU / % (Potentiometer Proxy)
  sound_velocity: number;   // m/s (Computed Mackenzie/Medwin)
  waveform_type: string;    // 'LFM Chirp' | 'CW Tone' | 'Frequency Sweep'
  center_frequency: number; // kHz (Baseline: 100 kHz)
  bandwidth: number;        // kHz (Baseline: 50 kHz, 75-125 kHz sweep)
  pulse_duration: number;   // ms (Baseline: 20 ms)
  amplitude: number;        // % (0-100% DAC amplitude)
  system_status: SystemStatusState;
}

export interface SonarContact {
  id: string;
  bearing: string;
  range: string;
  doppler: string;
  threat: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface HistoricalLogEntry {
  time: string;
  depthProxy: string;
  temp: string;
  turbidity: string;
  salinityProxy: string;
  soundVel: string;
  status: string;
}

export interface RangeDataset {
  times: string[];
  soundSpeed: number[];
  temperature: number[];
  turbidity?: number[];
}
