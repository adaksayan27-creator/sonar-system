
/**
 * WaveForge UART Packet Protocol
 * Format: $WAVE,<temp>,<turb>,<depth_proxy>,<salinity_proxy>,<center_freq>,<bandwidth>,<pulse_dur>,<amplitude>*<CHECKSUM>\r\n
 * Example: $WAVE,26.7,12.4,29.93,33.3,100.0,50.0,20,80*4A\r\n
 */

export const PACKET_HEADER = '$WAVE';

/**
 * Calculates 8-bit XOR checksum (NMEA style) of the packet body between '$' and '*'
 */
export function calculateChecksum(payload: string): string {
  let checksum = 0;
  for (let i = 0; i < payload.length; i++) {
    checksum ^= payload.charCodeAt(i);
  }
  return checksum.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Serializes TelemetryData into the standard WaveForge UART packet
 */
export function serializeWavePacket(data: {
  temperature: number;
  turbidity: number;
  depth_proxy: number;
  salinity_proxy: number;
  center_frequency: number;
  bandwidth: number;
  pulse_duration: number;
  amplitude: number;
}): string {
  const body = `${PACKET_HEADER},${data.temperature.toFixed(1)},${data.turbidity.toFixed(1)},${data.depth_proxy.toFixed(2)},${data.salinity_proxy.toFixed(1)},${data.center_frequency.toFixed(1)},${data.bandwidth.toFixed(1)},${Math.round(data.pulse_duration)},${Math.round(data.amplitude)}`;
  // Checksum is calculated on payload excluding '$'
  const payloadToHash = body.substring(1);
  const cs = calculateChecksum(payloadToHash);
  return `${body}*${cs}\r\n`;
}

export interface ParsedWavePacket {
  valid: boolean;
  error?: string;
  data?: {
    temperature: number;
    turbidity: number;
    depth_proxy: number;
    salinity_proxy: number;
    center_frequency: number;
    bandwidth: number;
    pulse_duration: number;
    amplitude: number;
    sound_velocity: number;
  };
}

/**
 * Computes Mackenzie Sound Velocity (m/s) from depth, temp, and salinity
 */
export function computeSoundVelocity(temp: number, sal: number, depth: number): number {
  // Mackenzie (1981) formula simplified
  return (
    1448.96 +
    4.591 * temp -
    0.05304 * temp * temp +
    0.0002374 * temp * temp * temp +
    1.34 * (sal - 35) +
    0.0163 * depth
  );
}

/**
 * Parses and verifies an incoming UART telemetry string
 */
export function parseWavePacket(rawPacket: string): ParsedWavePacket {
  const cleaned = rawPacket.trim();

  if (!cleaned.startsWith(PACKET_HEADER)) {
    return { valid: false, error: 'Invalid packet header' };
  }

  const starIndex = cleaned.indexOf('*');
  if (starIndex === -1) {
    return { valid: false, error: 'Missing checksum delimiter (*)' };
  }

  const body = cleaned.substring(0, starIndex);
  const receivedChecksum = cleaned.substring(starIndex + 1).trim();

  // Validate Checksum (body excluding '$')
  const payloadToHash = body.substring(1);
  const expectedChecksum = calculateChecksum(payloadToHash);

  if (receivedChecksum.toUpperCase() !== expectedChecksum) {
    return {
      valid: false,
      error: `Checksum mismatch (expected ${expectedChecksum}, got ${receivedChecksum})`,
    };
  }

  // Parse comma-separated fields
  const tokens = body.split(',');
  if (tokens.length < 9) {
    return { valid: false, error: `Incomplete packet: expected 9 fields, got ${tokens.length}` };
  }

  const temp = parseFloat(tokens[1]);
  const turb = parseFloat(tokens[2]);
  const depth = parseFloat(tokens[3]);
  const sal = parseFloat(tokens[4]);
  const freq = parseFloat(tokens[5]);
  const bw = parseFloat(tokens[6]);
  const pulse = parseFloat(tokens[7]);
  const amp = parseFloat(tokens[8]);

  if (isNaN(temp) || isNaN(turb) || isNaN(depth) || isNaN(sal)) {
    return { valid: false, error: 'Packet contains non-numeric sensor data' };
  }

  const soundVel = computeSoundVelocity(temp, sal, depth);

  return {
    valid: true,
    data: {
      temperature: temp,
      turbidity: turb,
      depth_proxy: depth,
      salinity_proxy: sal,
      center_frequency: freq,
      bandwidth: bw,
      pulse_duration: pulse,
      amplitude: amp,
      sound_velocity: soundVel,
    },
  };
}
