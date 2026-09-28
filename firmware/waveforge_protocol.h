/**
 * @file waveforge_protocol.h
 * @brief WaveForge UART Telemetry Packet Protocol for STM32G474RE and ESP32.
 * 
 * Packet Format:
 * $WAVE,<temp>,<turb>,<depth_proxy>,<salinity_proxy>,<center_freq>,<bandwidth>,<pulse_dur>,<amplitude>*<CS>\r\n
 * 
 * Example:
 * $WAVE,26.7,12.4,29.93,33.3,100.0,50.0,20,80*4A\r\n
 */

#ifndef WAVEFORGE_PROTOCOL_H
#define WAVEFORGE_PROTOCOL_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>

#define WAVE_PACKET_MAX_LEN 128
#define WAVE_HEADER "$WAVE"

typedef struct {
    float temperature;       /* Real sensor: °C */
    float turbidity;         /* Real sensor: NTU */
    float depth_proxy;       /* Potentiometer: m */
    float salinity_proxy;    /* Potentiometer: PSU */
    float center_frequency;  /* Target: 100.0 kHz */
    float bandwidth;         /* Target: 50.0 kHz */
    uint16_t pulse_duration; /* Target: 20 ms */
    uint8_t amplitude;       /* 0 - 100 % DAC */
} WaveforgeTelemetry_t;

/**
 * @brief Compute NMEA 8-bit XOR checksum over string buffer (excluding '$' and '*')
 */
static inline uint8_t waveforge_checksum(const char *buf, size_t len) {
    uint8_t cs = 0;
    for (size_t i = 0; i < len; i++) {
        cs ^= (uint8_t)buf[i];
    }
    return cs;
}

/**
 * @brief Pack telemetry structure into UART output buffer (for STM32 transmission).
 * @return Number of bytes written, or -1 on error.
 */
static inline int waveforge_pack(const WaveforgeTelemetry_t *data, char *out_buf, size_t max_len) {
    if (!data || !out_buf || max_len < 64) return -1;

    char temp_body[WAVE_PACKET_MAX_LEN];
    int body_len = snprintf(temp_body, sizeof(temp_body),
        "WAVE,%.1f,%.1f,%.2f,%.1f,%.1f,%.1f,%u,%u",
        data->temperature,
        data->turbidity,
        data->depth_proxy,
        data->salinity_proxy,
        data->center_frequency,
        data->bandwidth,
        (unsigned int)data->pulse_duration,
        (unsigned int)data->amplitude
    );

    if (body_len <= 0 || (size_t)body_len >= sizeof(temp_body)) return -1;

    uint8_t cs = waveforge_checksum(temp_body, (size_t)body_len);

    int total_len = snprintf(out_buf, max_len, "$%s*%02X\r\n", temp_body, cs);
    return (total_len > 0 && (size_t)total_len < max_len) ? total_len : -1;
}

/**
 * @brief Parse incoming raw UART buffer and validate checksum (for ESP32 reception).
 * @return true if valid packet unpacked successfully, false otherwise.
 */
static inline bool waveforge_unpack(const char *raw_buf, WaveforgeTelemetry_t *out_data) {
    if (!raw_buf || !out_data) return false;

    // Check header
    if (strncmp(raw_buf, WAVE_HEADER, 5) != 0) return false;

    // Find checksum delimiter '*'
    const char *star = strchr(raw_buf, '*');
    if (!star) return false;

    // Verify Checksum (payload between '$' and '*')
    const char *payload_start = raw_buf + 1; // skip '$'
    size_t payload_len = star - payload_start;
    uint8_t calc_cs = waveforge_checksum(payload_start, payload_len);

    unsigned int recv_cs = 0;
    if (sscanf(star + 1, "%02x", &recv_cs) != 1 && sscanf(star + 1, "%02X", &recv_cs) != 1) {
        return false;
    }

    if (calc_cs != (uint8_t)recv_cs) {
        return false; // Checksum corrupted
    }

    // Parse Fields: $WAVE,temp,turb,depth,sal,freq,bw,pulse,amp
    unsigned int pulse = 0, amp = 0;
    int parsed = sscanf(raw_buf, "$WAVE,%f,%f,%f,%f,%f,%f,%u,%u",
        &out_data->temperature,
        &out_data->turbidity,
        &out_data->depth_proxy,
        &out_data->salinity_proxy,
        &out_data->center_frequency,
        &out_data->bandwidth,
        &pulse,
        &amp
    );

    if (parsed == 8) {
        out_data->pulse_duration = (uint16_t)pulse;
        out_data->amplitude = (uint8_t)amp;
        return true;
    }

    return false;
}

#ifdef __cplusplus
}
#endif

#endif /* WAVEFORGE_PROTOCOL_H */
