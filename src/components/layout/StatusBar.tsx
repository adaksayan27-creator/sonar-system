import React from 'react';

interface StatusBarProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onTriggerPing: () => void;
  streamStatus?: 'connected' | 'connecting' | 'disconnected';
  packetCount?: number;
  lastRawPacket?: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isMuted,
  onToggleMute,
  onTriggerPing,
  streamStatus = 'disconnected',
  packetCount = 0,
  lastRawPacket,
}) => {
  const isLive = streamStatus === 'connected';

  return (
    <footer className="dash-status-bar">
      <div className="status-item">
        <span className={`pulsing-live-dot ${isLive ? 'live-stream-active' : ''}`}></span>
        <span>
          {isLive
            ? `HYDRO-LINK: LIVE HARDWARE STREAM (PORT 8081 | PKT #${packetCount})`
            : 'HYDRO-LINK: SIMULATED TELEMETRY (FEEDER PORT 8081 OFFLINE)'}
        </span>
      </div>

      {lastRawPacket && (
        <div className="status-item" title="Raw NMEA-style packet from STM32/ESP32">
          <span className="raw-packet-ticker">{lastRawPacket}</span>
        </div>
      )}

      <div className="status-item">
        <i className="fa-solid fa-clock-rotate-left"></i>
        <span>LATENCY: {isLive ? '2ms' : '14ms'}</span>
      </div>

      <div className="status-actions">
        <button
          type="button"
          className={`dash-btn-status ${isMuted ? 'muted' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Unmute Sonar Ping' : 'Mute Sonar Ping'}
        >
          <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
          <span>{isMuted ? 'AUDIO MUTED' : 'AUDIO ACTIVE'}</span>
        </button>

        <button
          type="button"
          className="dash-btn-status ping-btn"
          onClick={onTriggerPing}
        >
          <i className="fa-solid fa-bullseye"></i>
          <span>TEST PING</span>
        </button>
      </div>
    </footer>
  );
};
