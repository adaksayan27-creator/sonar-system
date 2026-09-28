import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { WelcomeScreen } from './components/auth/WelcomeScreen';
import { TopNavBar } from './components/layout/TopNavBar';
import { DashboardView } from './components/dashboard/DashboardView';
import { EnvironmentView } from './components/environment/EnvironmentView';
import { WaveformsView } from './components/waveforms/WaveformsView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SystemView } from './components/system/SystemView';
import type { ConsolePage, TelemetryData } from './types/sonar';

import { StatusBar } from './components/layout/StatusBar';
import { useWaveforgeLiveStream } from './hooks/useWaveforgeLiveStream';

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'login' | 'welcome' | 'console'>('login');
  const [activePage, setActivePage] = useState<ConsolePage>('dashboard');
  const [streamSource, setStreamSource] = useState<'AUTO' | 'SIMULATION'>('AUTO');
  const [isMuted, setIsMuted] = useState(false);

  // WaveForge Prototype Telemetry State (Day 1 Contract)
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    temperature: 26.7,
    turbidity: 12.4,
    depth_proxy: 29.93,
    salinity_proxy: 33.3,
    sound_velocity: 1570,
    waveform_type: 'LFM Chirp',
    center_frequency: 100.0,
    bandwidth: 50.0,
    pulse_duration: 20,
    amplitude: 80,
    system_status: {
      stm32: 'ONLINE',
      esp32: 'READY',
      sensors: 'ACTIVE',
      waveform: 'GENERATING',
    },
  });

  // Body class toggling matching original behavior
  useEffect(() => {
    if (viewMode === 'console') {
      document.body.classList.add('dashboard-active');
    } else {
      document.body.classList.remove('dashboard-active');
    }
  }, [viewMode]);

  // Hook up WebSocket live stream from virtual feeder / ESP32 bridge
  const liveStream = useWaveforgeLiveStream((incoming) => {
    if (streamSource === 'AUTO') {
      setTelemetry((prev) => ({
        ...prev,
        ...incoming,
      }));
    }
  });

  // Live Micro-fluctuations Loop (Fallback dummy drift when live stream is offline or in SIMULATION mode)
  useEffect(() => {
    // Only run simulated drift if live stream is not active or explicitly forced to SIMULATION
    if (liveStream.isConnected && streamSource === 'AUTO') {
      return;
    }

    const timer = setInterval(() => {
      setTelemetry((prev) => {
        const depthDrift = (Math.random() - 0.5) * 0.05;
        const tempDrift = (Math.random() - 0.5) * 0.1;
        const turbDrift = (Math.random() - 0.5) * 0.15;
        const soundDrift = (Math.random() - 0.5) * 1.2;

        return {
          ...prev,
          depth_proxy: Math.max(25, Math.min(35, prev.depth_proxy + depthDrift)),
          temperature: Math.max(24, Math.min(29, prev.temperature + tempDrift)),
          turbidity: Math.max(8, Math.min(18, prev.turbidity + turbDrift)),
          salinity_proxy: 33.3,
          sound_velocity: Math.max(1560, Math.min(1580, prev.sound_velocity + soundDrift)),
        };
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [liveStream.isConnected, streamSource]);

  // Web Audio API Synthesizer for Sonar Ping
  const handleTriggerPing = () => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch {
      // AudioContext unavailable or blocked
    }
  };

  // Keyboard shortcut: ESC to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewMode === 'console') setViewMode('welcome');
        else if (viewMode === 'welcome') setViewMode('login');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  const handlePageChange = (page: ConsolePage) => {
    setActivePage(page);
  };

  return (
    <>
      {/* 1. Login View */}
      {viewMode === 'login' && (
        <LoginPage onLoginSuccess={() => setViewMode('welcome')} />
      )}

      {/* 2. Animated Landing Page After Login (Exact YouTube Short Reference Effect) */}
      {viewMode === 'welcome' && (
        <WelcomeScreen
          onEnterConsole={() => setViewMode('console')}
          onBackToLogin={() => setViewMode('login')}
        />
      )}

      {/* 3. Wave Forge Dashboard & All Console Pages in Lavender-White Theme */}
      {viewMode === 'console' && (
        <div className="dashboard-wrapper theme-lavender-white" id="dashboardWrapper">
          <TopNavBar
            activePage={activePage}
            onPageChange={handlePageChange}
            onSignOut={() => setViewMode('login')}
            liveStreamStatus={liveStream.status}
            packetCount={liveStream.packetCount}
            streamSource={streamSource}
            onToggleSource={() => setStreamSource((s) => (s === 'AUTO' ? 'SIMULATION' : 'AUTO'))}
          />

          {activePage === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              isLavenderTheme={true}
              onParamChange={liveStream.sendParams}
            />
          )}

          {activePage === 'environment' && (
            <EnvironmentView telemetry={telemetry} />
          )}

          {activePage === 'waveforms' && (
            <WaveformsView telemetry={telemetry} />
          )}

          {activePage === 'analytics' && (
            <AnalyticsView />
          )}

          {activePage === 'system' && (
            <SystemView />
          )}

          <StatusBar
            isMuted={isMuted}
            onToggleMute={() => setIsMuted((m) => !m)}
            onTriggerPing={handleTriggerPing}
            streamStatus={liveStream.status}
            packetCount={liveStream.packetCount}
            lastRawPacket={liveStream.lastRawPacket}
          />
        </div>
      )}
    </>
  );
};

export default App;
