/**
 * WaveForge Hardware Simulation Feeder
 * 
 * Emulates the STM32G474RE -> ESP32 UART bridge transmitting real-time NMEA-style packets:
 * $WAVE,<temp>,<turb>,<depth_proxy>,<salinity_proxy>,<center_freq>,<bandwidth>,<pulse_dur>,<amplitude>*<CS>\r\n
 * 
 * Serves a WebSocket server at ws://localhost:8081 and an HTTP status endpoint at http://localhost:8081
 * Requires NO physical hardware and NO Firebase setup.
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = 8081;
const BROADCAST_INTERVAL_MS = 1500;

// State representation matching hardware STM32 + sensor probes
const state = {
  temperature: 26.7,       // [REAL] DS18B20 / PT100 probe
  turbidity: 12.4,         // [REAL] Optical turbidity sensor
  depth_proxy: 29.93,      // [POT PROXY] 10k Potentiometer proxy
  salinity_proxy: 33.3,    // [POT PROXY] 10k Potentiometer proxy
  center_frequency: 100.0, // 100 kHz baseline target
  bandwidth: 50.0,         // 50 kHz BW (75-125 kHz sweep)
  pulse_duration: 20,      // 20 ms pulse
  amplitude: 80,           // 80% DAC output
  packetsSent: 0,
};

// Calculate 8-bit XOR checksum (NMEA standard matching firmware/waveforge_protocol.h)
function calculateChecksum(payload) {
  let checksum = 0;
  for (let i = 0; i < payload.length; i++) {
    checksum ^= payload.charCodeAt(i);
  }
  return checksum.toString(16).toUpperCase().padStart(2, '0');
}

// Format packet string
function generatePacket() {
  const body = `WAVE,${state.temperature.toFixed(1)},${state.turbidity.toFixed(1)},${state.depth_proxy.toFixed(2)},${state.salinity_proxy.toFixed(1)},${state.center_frequency.toFixed(1)},${state.bandwidth.toFixed(1)},${Math.round(state.pulse_duration)},${Math.round(state.amplitude)}`;
  const cs = calculateChecksum(body);
  return `$${body}*${cs}\r\n`;
}

// Compute Mackenzie sound velocity (m/s)
function computeMackenzieSoundVelocity(t, s, d) {
  return (
    1448.96 +
    4.591 * t -
    0.05304 * t * t +
    0.0002374 * t * t * t +
    1.34 * (s - 35) +
    0.0163 * d
  );
}

// Create HTTP server for health check and WebSocket upgrade
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/' || req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'WaveForge Virtual Hardware Feeder',
      status: 'ONLINE',
      port: PORT,
      clientsConnected: wss.clients.size,
      packetsSent: state.packetsSent,
      currentState: state,
      latestPacket: generatePacket().trim(),
    }, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('WaveForge Feeder Endpoint: Use ws://localhost:8081 for WebSocket or http://localhost:8081/status for JSON status.');
  }
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WAVEFORGE-FEEDER] [CONNECT] Dashboard connected from ${clientIp} (Total clients: ${wss.clients.size})`);

  // Send an immediate handshake packet
  const initialPacket = generatePacket();
  ws.send(JSON.stringify({
    type: 'HANDSHAKE',
    source: 'STM32-ESP32-VIRTUAL-BRIDGE',
    protocol: 'WAVEFORGE-NMEA-v1.0',
    rawPacket: initialPacket,
    parsed: {
      ...state,
      sound_velocity: computeMackenzieSoundVelocity(state.temperature, state.salinity_proxy, state.depth_proxy),
    },
    timestamp: Date.now(),
  }));

  // Handle incoming control messages from dashboard
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`[WAVEFORGE-FEEDER] [COMMAND RECEIVED]`, data);

      if (data.type === 'SET_PARAMS') {
        if (data.center_frequency !== undefined) state.center_frequency = Number(data.center_frequency);
        if (data.bandwidth !== undefined) state.bandwidth = Number(data.bandwidth);
        if (data.pulse_duration !== undefined) state.pulse_duration = Number(data.pulse_duration);
        if (data.amplitude !== undefined) state.amplitude = Number(data.amplitude);

        // Broadcast parameter update acknowledgement
        const ackPacket = generatePacket();
        ws.send(JSON.stringify({
          type: 'ACK',
          message: 'Transmitter parameters updated on STM32 virtual register',
          rawPacket: ackPacket,
          state,
        }));
      }
    } catch {
      // Non-JSON message, ignore
    }
  });

  ws.on('close', () => {
    console.log(`[WAVEFORGE-FEEDER] [DISCONNECT] Dashboard disconnected (Remaining clients: ${wss.clients.size})`);
  });
});

// Periodic physics simulation loop & packet broadcast
setInterval(() => {
  // Simulate natural physical hydro-acoustic micro-fluctuations
  state.temperature = Math.max(24.0, Math.min(29.0, state.temperature + (Math.random() - 0.5) * 0.08));
  state.turbidity = Math.max(8.0, Math.min(18.0, state.turbidity + (Math.random() - 0.5) * 0.12));
  state.depth_proxy = Math.max(25.0, Math.min(35.0, state.depth_proxy + (Math.random() - 0.5) * 0.04));
  state.salinity_proxy = 33.3 + (Math.random() - 0.5) * 0.02;

  const rawPacket = generatePacket();
  state.packetsSent++;

  const soundVel = computeMackenzieSoundVelocity(state.temperature, state.salinity_proxy, state.depth_proxy);

  const payload = JSON.stringify({
    type: 'TELEMETRY',
    rawPacket: rawPacket,
    packetNumber: state.packetsSent,
    parsed: {
      temperature: Number(state.temperature.toFixed(1)),
      turbidity: Number(state.turbidity.toFixed(1)),
      depth_proxy: Number(state.depth_proxy.toFixed(2)),
      salinity_proxy: Number(state.salinity_proxy.toFixed(1)),
      center_frequency: Number(state.center_frequency.toFixed(1)),
      bandwidth: Number(state.bandwidth.toFixed(1)),
      pulse_duration: state.pulse_duration,
      amplitude: state.amplitude,
      sound_velocity: Number(soundVel.toFixed(1)),
    },
    system_status: {
      stm32: 'ONLINE',
      esp32: 'STREAMING',
      sensors: 'ACTIVE',
      waveform: 'GENERATING',
    },
    timestamp: Date.now(),
  });

  // Broadcast to all active clients
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }

  // Console output
  if (state.packetsSent % 4 === 0 || wss.clients.size > 0) {
    process.stdout.write(`\r[TX #${state.packetsSent}] ${rawPacket.trim()} -> (Clients: ${wss.clients.size}) `);
  }
}, BROADCAST_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`  WaveForge Virtual Hardware Feeder (STM32 + ESP32 Bridge)   `);
  console.log(`=============================================================`);
  console.log(`* WebSocket Streaming at : ws://localhost:${PORT}`);
  console.log(`* HTTP Status Check at    : http://localhost:${PORT}/status`);
  console.log(`* Packet Protocol        : $WAVE,<temp>,<turb>,<depth>,<sal>,<freq>,<bw>,<pulse>,<amp>*<CS>`);
  console.log(`* No physical hardware or Firebase account required.\n`);
  console.log(`Broadcasting virtual sensor packets...`);
});
