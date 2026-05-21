/*
 * 角色 B：貨梯感測器 (BLE Scanner)
 * 功能：連線 Wi-Fi，掃描專屬 UUID，測量距離並印出
 */
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <WiFi.h>

// --- Wi-Fi 設定 ---
#define WIFI_SSID "James-Mi"
#define WIFI_PASS "0955128528"

// --- 目標推車的 UUID (必須跟角色 A 一模一樣) ---
#define TARGET_UUID "12345678-1234-1234-1234-1234567890ab"

int scanTime = 3; // 每次掃描 3 秒
BLEScan* pBLEScan;

// === 藍牙掃描回呼函式 (當掃到任何藍牙裝置時會觸發) ===
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      
      // 判斷這個裝置有沒有帶有我們定義的「專屬 UUID」
      if (advertisedDevice.haveServiceUUID() && advertisedDevice.isAdvertisingService(BLEUUID(TARGET_UUID))) {
        
        Serial.println("=====================================");
        Serial.println("✅ 捕捉到目標推車！");
        // 處理空白名字的優化
        String deviceName = advertisedDevice.getName().c_str();
        if (deviceName == "") {
          Serial.printf("👉 標籤名稱: [未抓取到名稱]\n");
        } else {
          Serial.printf("👉 標籤名稱: %s \n", deviceName.c_str());
        }
        
        Serial.printf("👉 MAC 位址: %s \n", advertisedDevice.getAddress().toString().c_str());
        
        // 👇 新增這一行，把抓到的 UUID 真實印出來！
        Serial.printf("👉 專屬 UUID: %s \n", advertisedDevice.getServiceUUID().toString().c_str());
        
        // 取得訊號強度
        int rssi = advertisedDevice.getRSSI();
        Serial.printf("📶 訊號強度 (RSSI): %d dBm \n", rssi);
        
        // --- 距離粗略判斷邏輯 ---
        if (rssi > -60) {
          Serial.println("📍 狀態：[極近] 推車應該已經在電梯內！");
        } else if (rssi > -80) {
          Serial.println("📍 狀態：[中等] 推車可能在電梯門口或附近。");
        } else {
          Serial.println("📍 狀態：[遙遠] 推車在遠處走廊。");
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

  // 2. 初始化藍牙掃描器
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
  // 開始掃描，設定 false 代表不強制連續掃描
  BLEScanResults foundDevices = pBLEScan->start(scanTime, false);
  
  pBLEScan->clearResults(); // 清除記憶體，避免當機
  delay(2000);              // 休息 2 秒再進行下一輪掃描
}