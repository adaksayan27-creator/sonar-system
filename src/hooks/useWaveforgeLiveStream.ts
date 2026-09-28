import { useState, useEffect, useRef, useCallback } from 'react';
import type { TelemetryData } from '../types/sonar';
import { parseWavePacket } from '../utils/protocol';

export interface UseWaveforgeLiveStreamReturn {
  isConnected: boolean;
  isStreaming: boolean;
  status: 'connected' | 'connecting' | 'disconnected';
  lastRawPacket: string | null;
  packetCount: number;
  lastPacketTime: string | null;
  serverUrl: string;
  reconnect: () => void;
  sendParams: (params: {
    center_frequency?: number;
    bandwidth?: number;
    pulse_duration?: number;
    amplitude?: number;
  }) => void;
}

export function useWaveforgeLiveStream(
  onTelemetryReceived: (telemetry: TelemetryData) => void,
  serverUrl = 'ws://localhost:8081'
): UseWaveforgeLiveStreamReturn {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [lastRawPacket, setLastRawPacket] = useState<string | null>(null);
  const [packetCount, setPacketCount] = useState<number>(0);
  const [lastPacketTime, setLastPacketTime] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onTelemetryReceivedRef = useRef(onTelemetryReceived);

  useEffect(() => {
    onTelemetryReceivedRef.current = onTelemetryReceived;
  }, [onTelemetryReceived]);

  const connect = useCallback(() => {
    // Clean up existing socket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    setStatus('connecting');

    try {
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        console.log(`[WaveForge Bridge] Connected to live hardware/virtual stream at ${serverUrl}`);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle incoming telemetry stream
          if (message.type === 'TELEMETRY' || message.type === 'HANDSHAKE') {
            const raw = message.rawPacket;
            if (raw) {
              setLastRawPacket(raw.trim());
              setPacketCount((c) => c + 1);
              setLastPacketTime(new Date().toLocaleTimeString());

              // Verify and parse raw packet through standard protocol parser
              const parsed = parseWavePacket(raw);
              if (parsed.valid && parsed.data) {
                const d = parsed.data;
                onTelemetryReceivedRef.current({
                  temperature: d.temperature,
                  turbidity: d.turbidity,
                  depth_proxy: d.depth_proxy,
                  salinity_proxy: d.salinity_proxy,
                  sound_velocity: d.sound_velocity,
                  waveform_type: 'LFM Chirp',
                  center_frequency: d.center_frequency,
                  bandwidth: d.bandwidth,
                  pulse_duration: d.pulse_duration,
                  amplitude: d.amplitude,
                  system_status: {
                    stm32: 'ONLINE',
                    esp32: 'READY',
                    sensors: 'ACTIVE',
                    waveform: 'GENERATING',
                  },
                });
              }
            }
          }
        } catch {
          // If raw string packet arrives directly
          if (typeof event.data === 'string' && event.data.startsWith('$WAVE')) {
            const parsed = parseWavePacket(event.data);
            if (parsed.valid && parsed.data) {
              setLastRawPacket(event.data.trim());
              setPacketCount((c) => c + 1);
              setLastPacketTime(new Date().toLocaleTimeString());
            }
          }
        }
      };

      ws.onerror = () => {
        // Suppress noisy console errors when feeder is not running
        setStatus('disconnected');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        // Auto-reconnect after 3 seconds
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch {
      setStatus('disconnected');
    }
  }, [serverUrl]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendParams = useCallback(
    (params: {
      center_frequency?: number;
      bandwidth?: number;
      pulse_duration?: number;
      amplitude?: number;
    }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'SET_PARAMS',
            ...params,
          })
        );
      }
    },
    []
  );

  return {
    isConnected: status === 'connected',
    isStreaming: status === 'connected',
    status,
    lastRawPacket,
    packetCount,
    lastPacketTime,
    serverUrl,
    reconnect: connect,
    sendParams,
  };
}
