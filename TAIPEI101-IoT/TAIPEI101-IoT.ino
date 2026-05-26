/*
 * 角色 A：推車標籤 (BLE Beacon)
 * 功能：不間斷廣播專屬 UUID
 */
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// 這是我們賦予這台推車的「專屬身分證 (UUID)」
#define BEACON_UUID "12345678-1234-1234-1234-1234567890ab"

void setup() {
  Serial.begin(115200);
  Serial.println("啟動 BLE 推車標籤廣播...");

  // 1. 初始化藍牙並設定名稱 (在手機藍牙清單會看到這個名字)
  BLEDevice::init("101_Cart_01"); 
  
  // 2. 設定廣播封包
  BLEServer *pServer = BLEDevice::createServer();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  
  // 3. 把專屬 UUID 塞進廣播裡，這樣掃描器才認得我們
  pAdvertising->addServiceUUID(BEACON_UUID);
  pAdvertising->setScanResponse(true);
  
  // 4. 開始廣播
  BLEDevice::startAdvertising();
  Serial.println("✅ 標籤已上線，正不斷發射 UUID: " + String(BEACON_UUID));
}

void loop() {
  // 標籤只需要在背景廣播，主迴圈什麼都不用做
  delay(1000); 
}



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
        Serial.printf("👉 標籤名稱: %s \n", advertisedDevice.getName().c_str());
        Serial.printf("👉 MAC 位址: %s \n", advertisedDevice.getAddress().toString().c_str());
        
        // 取得訊號強度 (RSSI，負數，越接近 0 越強)
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








#include <ArduinoBLE.h>

const String TARGET_MAC = "51:00:25:05:03:0e";
const String TARGET_NAME = "R25050782";

const int MEASURED_POWER = -59; 
const float N = 2.0;            

unsigned long lastReportTime = 0; 
const unsigned long REPORT_INTERVAL = 1500; 

unsigned long lastScanReset = 0;
const unsigned long SCAN_RESET_INTERVAL = 5000; // 每 5 秒強制重置雷達掃描

// 系統穩定機制：每 12 小時定期重啟 (符合您的需求)
const unsigned long REBOOT_INTERVAL = 12UL * 60 * 60 * 1000; 

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("=====================================");
  Serial.println("🛡️ 啟動防弊系統：專屬 MAC 鎖定雷達 (強制刷新版)...");
  
  if (!BLE.begin()) {
    Serial.println("❌ 啟動藍牙失敗！");
    while (1);
  }
  
  BLE.scan(); 
}

void loop() {
  unsigned long currentTime = millis();

  // 1. 檢查是否達到 12 小時例行性重啟時間
  if (currentTime > REBOOT_INTERVAL) {
    Serial.println("🔄 系統例行性維護：執行 12 小時週期重啟，清理暫存記憶體...");
    delay(1000); 
    ESP.restart(); 
  }

  // 2. 每 5 秒強制重置一次掃描，避免底層快取卡死錯過封包
  if (currentTime - lastScanReset > SCAN_RESET_INTERVAL) {
    BLE.stopScan();
    delay(50); // 給硬體一點喘息時間
    BLE.scan();
    lastScanReset = currentTime;
  }

  // 3. 持續監聽藍牙裝置
  BLEDevice peripheral = BLE.available();

  if (peripheral) {
    String deviceMAC = peripheral.address();
    String deviceName = peripheral.hasLocalName() ? peripheral.localName() : "";

    if (deviceMAC.equalsIgnoreCase(TARGET_MAC) || deviceName == TARGET_NAME) {
      
      if (currentTime - lastReportTime >= REPORT_INTERVAL) {
        lastReportTime = currentTime; 
        
        Serial.println("-------------------------------------");
        Serial.println("🚨 警告：偵測到目標清運推車！");
        
        int rssi = peripheral.rssi();
        Serial.print("📶 訊號強度 (RSSI): ");
        Serial.print(rssi);
        Serial.println(" dBm");

        float distance = pow(10.0, ((float)MEASURED_POWER - rssi) / (10.0 * N));
        Serial.print("📏 估算距離: 約 ");
        Serial.print(distance, 2);
        Serial.println(" 公尺");
      }
    }
  }
}
