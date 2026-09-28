/**
 * @file esp32_waveforge_bridge.ino
 * @brief WaveForge ESP32 UART Receiver & Web Gateway
 * 
 * Hardware Connections:
 * STM32 TX (e.g. PA2 / USART2)  -->  ESP32 RX2 (GPIO 16)
 * STM32 RX (e.g. PA3 / USART2)  <--  ESP32 TX2 (GPIO 17)
 * STM32 GND                      ---  ESP32 GND (Shared Common Ground)
 * 
 * Responsibilities:
 * 1. Read UART stream from STM32 at 115200 baud.
 * 2. Validate NMEA-style XOR checksum.
 * 3. Extract sensor data (Temp, Turbidity, Depth Proxy, Salinity Proxy) and LFM parameters.
 * 4. Output JSON over USB Serial (for PC testing) and Wi-Fi / Firebase.
 */

#include "waveforge_protocol.h"

// Hardware Serial 2 pins on ESP32
#define STM32_RX_PIN 16
#define STM32_TX_PIN 17
#define UART_BAUD    115200

// Packet reception buffer
static char rx_line[WAVE_PACKET_MAX_LEN];
static uint8_t rx_idx = 0;

WaveforgeTelemetry_t telemetry;

void setup() {
  // Debug USB Serial to PC
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==========================================");
  Serial.println("  WaveForge ESP32 Telemetry Bridge Online  ");
  Serial.println("==========================================");

  // Hardware Serial 2 connected to STM32 UART
  Serial2.begin(UART_BAUD, SERIAL_8N1, STM32_RX_PIN, STM32_TX_PIN);
  Serial.println("[ESP32] Listening on UART2 (RX2: Pin 16, 115200 baud)...");
}

void loop() {
  // Read incoming characters from STM32
  while (Serial2.available() > 0) {
    char c = (char)Serial2.read();

    // End of line reached
    if (c == '\n' || c == '\r') {
      if (rx_idx > 0) {
        rx_line[rx_idx] = '\0';
        process_incoming_packet(rx_line);
        rx_idx = 0; // Reset buffer for next packet
      }
    } else {
      // Prevent buffer overflow
      if (rx_idx < WAVE_PACKET_MAX_LEN - 1) {
        rx_line[rx_idx++] = c;
      } else {
        rx_idx = 0; // Discard corrupted oversized line
      }
    }
  }

  // Future Day 2/3 Task: Wi-Fi Reconnect & Firebase Sync Heartbeat
}

/**
 * @brief Parses and validates incoming STM32 packet
 */
void process_incoming_packet(const char *packet_str) {
  // Check if packet matches protocol and checksum validates
  if (waveforge_unpack(packet_str, &telemetry)) {
    // Valid packet received!
    Serial.print("[VALID PACKET] ");
    Serial.println(packet_str);

    // Format as JSON for Firebase / Dashboard
    print_telemetry_json(&telemetry);
  } else {
    // Corrupted or unrecognized noise on serial line
    Serial.print("[DROPPED / CS_ERR] ");
    Serial.println(packet_str);
  }
}

/**
 * @brief Outputs standardized JSON to Serial / Firebase
 */
void print_telemetry_json(const WaveforgeTelemetry_t *t) {
  Serial.print("JSON: {");
  Serial.print("\"temp\":"); Serial.print(t->temperature, 1);
  Serial.print(",\"turb\":"); Serial.print(t->turbidity, 1);
  Serial.print(",\"depth_proxy\":"); Serial.print(t->depth_proxy, 2);
  Serial.print(",\"salinity_proxy\":"); Serial.print(t->salinity_proxy, 1);
  Serial.print(",\"freq\":"); Serial.print(t->center_frequency, 1);
  Serial.print(",\"bw\":"); Serial.print(t->bandwidth, 1);
  Serial.print(",\"pulse\":"); Serial.print(t->pulse_duration);
  Serial.print(",\"amp\":"); Serial.print(t->amplitude);
  Serial.println("}");
}
