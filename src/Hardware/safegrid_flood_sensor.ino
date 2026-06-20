/*
  ============================================================
  SAFEGRID - ESP32 SENSOR NODE FIRMWARE
  ============================================================
  Project:   SafeGrid Urban Incident Management System
  Hackathon: Kingdom Hack 3.0 - Track 0D (Incident Management)
  Author:    Success Boluwatife Asokere

  This firmware runs on an ESP32 module wired to an ultrasonic
  distance sensor (HC-SR04). It is configured here as a FLOOD
  sensor node, deployed at a drainage point. The same pattern
  (read sensor -> compare threshold -> POST to backend) applies
  to the smoke, traffic, and power sensor node types described
  in the SafeGrid system architecture document -only the sensor
  read function and category mapping change.

  FLOW:
  1. Connect to WiFi
  2. Every READ_INTERVAL_MS, read the ultrasonic sensor
  3. Convert distance reading into a "fill %" value
  4. POST the reading to the SafeGrid backend, authenticated
     with this node's pre-issued API key
  5. Backend (Supabase Edge Function) decides whether the
     threshold was crossed and auto-files an incident

  HARDWARE:
  - ESP32 DevKit v1 (or similar)
  - HC-SR04 ultrasonic distance sensor
    TRIG -> GPIO 5
    ECHO -> GPIO 18 (use a voltage divider - ECHO is 5V, ESP32 is 3.3V)
  - Optional: status LED on GPIO 2 (most dev boards have one built in)
  ============================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>

// ---------- WiFi credentials ----------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ---------- Backend configuration ----------
// Supabase Edge Function endpoint that accepts sensor readings.
// (See README.md in this folder for how to deploy this function.)
const char* API_ENDPOINT = "https://YOUR_PROJECT_REF.functions.supabase.co/sensor-reading";

// Pre-issued API key for THIS specific sensor node - matches the
// `api_key` column for this row in the `sensors` table.
const char* SENSOR_API_KEY = "demo-key-flood-01";
const char* SENSOR_ID      = "FLOOD-OTTO-01";

// ---------- Sensor pins ----------
const int TRIG_PIN   = 5;
const int ECHO_PIN   = 18;
const int STATUS_LED = 2;

// ---------- Sensor calibration ----------
// Distance (cm) from sensor mount to the BOTTOM of the drain when empty.
// Used to convert raw distance into a 0-100% "fill level".
const float DRAIN_EMPTY_CM = 120.0;
const float DRAIN_FULL_CM  = 20.0;

// Threshold (%) at which this node considers the drain critically full
// -matches the `threshold` column for this sensor in Supabase.
const float FLOOD_THRESHOLD_PERCENT = 80.0;

// ---------- Timing ----------
const unsigned long READ_INTERVAL_MS = 30000; // read every 30 seconds
unsigned long lastReadTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(STATUS_LED, OUTPUT);

  connectToWiFi();
}

void loop() {
  unsigned long now = millis();

  if (now - lastReadTime >= READ_INTERVAL_MS) {
    lastReadTime = now;

    float distanceCM = readUltrasonicDistance();
    float fillPercent = distanceToFillPercent(distanceCM);

    Serial.print("Distance: ");
    Serial.print(distanceCM);
    Serial.print(" cm  |  Fill level: ");
    Serial.print(fillPercent);
    Serial.println(" %");

    bool thresholdCrossed = fillPercent >= FLOOD_THRESHOLD_PERCENT;
    digitalWrite(STATUS_LED, thresholdCrossed ? HIGH : LOW);

    sendReading(fillPercent, thresholdCrossed);
  }

  // Reconnect WiFi if the connection drops
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
}

// ============================================================
// WiFi connection
// ============================================================
void connectToWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected.");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed - will retry next loop.");
  }
}

// ============================================================
// Read raw distance from HC-SR04 ultrasonic sensor
// ============================================================
float readUltrasonicDistance() {
  // Send a 10us pulse to trigger the sensor
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Measure how long the echo pin stays HIGH (round-trip time)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout

  if (duration == 0) {
    // No echo received - sensor may be disconnected or out of range
    return DRAIN_EMPTY_CM;
  }

  // Speed of sound = 0.0343 cm/microsecond. Divide by 2 for round trip.
  float distanceCM = (duration * 0.0343) / 2.0;
  return distanceCM;
}

// ============================================================
// Convert raw distance reading into a 0-100% fill level
// ============================================================
float distanceToFillPercent(float distanceCM) {
  float clamped = constrain(distanceCM, DRAIN_FULL_CM, DRAIN_EMPTY_CM);
  float percent = (DRAIN_EMPTY_CM - clamped) / (DRAIN_EMPTY_CM - DRAIN_FULL_CM) * 100.0;
  return round(percent * 10) / 10.0; // round to 1 decimal place
}

// ============================================================
// POST the reading to the SafeGrid backend
// ============================================================
void sendReading(float value, bool alertTriggered) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Skipping send - WiFi not connected.");
    return;
  }

  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", SENSOR_API_KEY);

  String payload = "{";
  payload += "\"sensor_id\":\"" + String(SENSOR_ID) + "\",";
  payload += "\"value\":" + String(value) + ",";
  payload += "\"alert_triggered\":" + String(alertTriggered ? "true" : "false") + ",";
  payload += "\"timestamp\":\"" + getISOTimestamp() + "\"";
  payload += "}";

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.print("Server responded: ");
    Serial.println(httpCode);
    String response = http.getString();
    Serial.println(response);
  } else {
    Serial.print("POST failed, error: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// ============================================================
// Build a timestamp marker.
// Note: ESP32 has no RTC by default - for production, sync time
// via NTP (configTime()) before calling this. Kept simple here
// for hackathon demo purposes; the backend also stamps server-side
// received_at, so this is supplementary, not the source of truth.
// ============================================================
String getISOTimestamp() {
  unsigned long uptimeSeconds = millis() / 1000;
  return "uptime+" + String(uptimeSeconds) + "s";
}