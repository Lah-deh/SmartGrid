# SafeGrid - IoT Hardware Layer

This folder contains the ESP32 firmware for SafeGrid's sensor network - the
hardware component described in the Stage 2 System Architecture submission.

## What's here

- `safegrid_flood_sensor.ino` -firmware for a flood-monitoring node using an
  HC-SR04 ultrasonic distance sensor. This is the reference implementation;
  the smoke, traffic and power node types follow the same pattern with a
  different sensor read function and threshold comparison.

## How it fits into the system

```
ESP32 + sensor  --(WiFi, every 30s)-->  HTTP POST  --> Backend endpoint
                                                          |
                                                          v
                                          Validates X-API-Key against
                                          the `sensors` table
                                                          |
                                                          v
                                          Updates sensor's last_reading
                                          If threshold crossed:
                                            auto-inserts a row into
                                            `incidents` with source =
                                            'iot_sensor', status = 'open'
                                                          |
                                                          v
                                          Responder dashboard updates
                                          live via Supabase Realtime
```

## Hardware list (per node)

| Component | Purpose | Approx. cost |
|---|---|---|
| ESP32 DevKit v1 | WiFi-enabled microcontroller | ₦8,000 |
| HC-SR04 ultrasonic sensor | Distance / water level sensing | ₦1,500 |
| Voltage divider (2x resistors) | Steps ECHO pin down from 5V to 3.3V | ₦200 |
| Weatherproof enclosure | Outdoor deployment | ₦3,000 |
| 5V power supply / solar + battery | Power | ₦5,000-15,000 |

## Wiring (flood sensor variant)

```
HC-SR04          ESP32
--------         --------
VCC      ------> 5V
GND      ------> GND
TRIG     ------> GPIO 5
ECHO --[R1]--+--[R2]--GND   (voltage divider midpoint --> GPIO 18)
```

## Before flashing

1. Install the **ESP32 board package** in Arduino IDE
   (File → Preferences → Additional Board URLs →
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`)
2. Install the **HTTPClient** library (usually bundled with the ESP32 core)
3. Edit the top of `safegrid_flood_sensor.ino`:
   - `WIFI_SSID` / `WIFI_PASSWORD`
   - `API_ENDPOINT` — your deployed Supabase Edge Function URL
   - `SENSOR_API_KEY` / `SENSOR_ID` — must match a row in the `sensors` table
4. Select **Board: ESP32 Dev Module**, correct COM port, then Upload

## Demo-day note

Physical hardware deployment was not required for Stage 2 — the **IoT
Sensors tab** in the responder dashboard includes a "Simulate threshold
breach" action that reproduces this exact flow (reading → threshold check →
auto-filed incident) without needing a physical device on stage. This
firmware is included to demonstrate the real embedded implementation behind
that simulation.