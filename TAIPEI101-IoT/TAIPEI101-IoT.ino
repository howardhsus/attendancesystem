/*
 */
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <WiFi.h>

#define WIFI_SSID "James-Mi"
#define WIFI_PASS "0955128528"

#define TARGET_UUID "12345678-1234-1234-1234-1234567890ab"

int scanTime = 3; 
BLEScan* pBLEScan;

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {

      if (advertisedDevice.haveServiceUUID() && advertisedDevice.isAdvertisingService(BLEUUID(TARGET_UUID))) {
        
        Serial.println("=====================================");
        Serial.println("✅ 捕捉目標！");
        String deviceName = advertisedDevice.getName().c_str();
        if (deviceName == "") {
          Serial.printf("👉 標籤名稱: [未抓取到名稱]\n");
        } else {
          Serial.printf("👉 標籤名稱: %s \n", deviceName.c_str());
        }
        
        Serial.printf("👉 MAC 位址: %s \n", advertisedDevice.getAddress().toString().c_str());
        
        Serial.printf("👉 專屬 UUID: %s \n", advertisedDevice.getServiceUUID().toString().c_str());
        
        // 取得訊號強度
        int rssi = advertisedDevice.getRSSI();
        Serial.printf("📶 訊號強度 (RSSI): %d dBm \n", rssi);
        
        // --- 距離粗略判斷邏輯 ---
        if (rssi > -60) {
          Serial.println("📍 狀態：[極近] ！");
        } else if (rssi > -80) {
          Serial.println("📍 狀態：[中等] 。");
        } else {
          Serial.println("📍 狀態：[遙遠] 。");
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  
  // 1. 連線 Wi-Fi
  Serial.print("連線 Wi-Fi 中");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ Wi-Fi 連線成功！");

  Serial.println("初始化 BLE 雷達掃描器...");
  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan(); 
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true); // 主動掃描，抓取更多資訊
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);  
}

void loop() {
  Serial.println("\n🔍 啟動雷達掃描 (3秒)...");
  BLEScanResults foundDevices = pBLEScan->start(scanTime, false);
  
  pBLEScan->clearResults(); // 清除記憶體，避免當機
  delay(2000);              // 休息 2 秒再進行下一輪掃描
}
