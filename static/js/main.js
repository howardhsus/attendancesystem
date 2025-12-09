// ==================== 配置區塊 ====================
const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbwKxZON3tIGAYVJAXqBEBOLEBaQlCdHgWevywV-phUOxED0fU_mmOtgaPlmc-cWGwwZ/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec',
    QUERY_API: 'https://script.google.com/macros/s/AKfycbxQvp1q7dZK9dQfu-5fUuqqYKBt_4VgFVDTCkcuOh6qePcLCb30hNeUT1Mh6ScDUUuQ/exec',
    SHEET_ID: '13ZSRv_AmB9_9TLgu8GdvpatH9sRo5IqhXA3Xo_qIpmo'
};
// ==================== 配置區塊結束 ====================

// 全域變數
let currentStep = 'welcome';
let currentService = '';
let selectedFloor = '';
let selectedLocation = '';
let customLocation = '';
let problemDescription = '';
let uploadedFile = null;
let uploadedFilePreview = null;
let chatMessages = [];
let autoDetectedFloor = '';
let autoDetectedLocation = '';
let autoDetectedService = '';
let isQuickInputMode = false;
let isInQuickInputProcess = false;
let emailAddress = '';
let submittedCaseNumber = '';
let submittedDateTime = '';
let hasEmailBeenSent = false; // 新增：追蹤email是否已發送

// 辦公大樓地點選項
const OFFICE_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'public_corridor', label: '公共走道' },
    { id: 'public_elevator', label: '公共電梯' },
    { id: 'public_pantry', label: '公共茶水間' },
    { id: 'public_freight_lift', label: '公共貨梯廳' }
];

// 購物中心地點選項
const MALL_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'nursing_room', label: '哺乳室' }
];

// 觀景台地點選項
const OBSERVATORY_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'nursing_room', label: '哺乳室' },
    { id: 'east_area', label: '東面場域' },
    { id: 'west_area', label: '西區場域' }
];

// 購物中心樓層選項
const SHOPPING_FLOORS = ['B1', '1', '2', '3', '4', '5'];

// 觀景台樓層選項
const OBSERVATORY_FLOORS = ['89', '91'];

// 從URL獲取參數並解析服務類型
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    autoDetectedFloor = urlParams.get('floor') || '';
    autoDetectedLocation = urlParams.get('location') || '';
    
    autoDetectedService = '';
    
    if (autoDetectedFloor) {
        let floorValue = autoDetectedFloor.replace('F', '').replace('f', '');
        
        // 判斷服務類型
        const floorNum = parseInt(floorValue);
        
        if (SHOPPING_FLOORS.includes(floorValue)) {
            autoDetectedService = 'shopping';
        } else if (OBSERVATORY_FLOORS.includes(floorValue)) {
            autoDetectedService = 'observatory';
        } else if (!isNaN(floorNum) && floorNum >= 1 && floorNum <= 88) { // 辦公大樓樓層改為1-88
            autoDetectedService = 'office';
        }
        
        autoDetectedFloor = floorValue;
    }
}

// 初始化應用
$(document).ready(function() {
    parseUrlParams();
    
    if (autoDetectedService) {
        initChatWithAutoDetectedService();
    } else {
        initChat();
    }
    
    $('#messageInput').on('input', function() {
        adjustTextareaHeight();
    });
    
    setTimeout(scrollToBottom, 100);
    setupCaseSearchInput();
});

// 帶有自動檢測服務的初始化
function initChatWithAutoDetectedService() {
    chatMessages = [];
    currentStep = 'welcome';
    isQuickInputMode = false;
    isInQuickInputProcess = false;
    
    $('#chatContainer').empty();
    
    setTimeout(() => {
        const serviceDisplayNames = {
            'office': '辦公大樓',
            'shopping': '購物中心', 
            'observatory': '觀景台'
        };
        
        const detectedArea = serviceDisplayNames[autoDetectedService] || '';
        
        if (detectedArea) {
            addBotMessage(`💬 嗨～我是台北101智慧小幫手！🎉歡迎蒞臨${detectedArea}！`);
        } else {
            addBotMessage('💬 嗨～我是台北101智慧小幫手！🎉請選擇您所在的區域！');
        }
        
        setTimeout(() => {
            selectService(autoDetectedService);
        }, 800);
    }, 500);
}

// 初始化聊天
// 修改initChat函數，重置所有變數
function initChat() {
    chatMessages = [];
    currentStep = 'welcome';
    currentService = '';
    selectedFloor = '';
    selectedLocation = '';
    customLocation = '';
    problemDescription = '';
    uploadedFile = null;
    uploadedFilePreview = null;
    isQuickInputMode = false;
    isInQuickInputProcess = false;
    autoDetectedFloor = '';
    autoDetectedLocation = '';
    autoDetectedService = '';
    emailAddress = '';
    submittedCaseNumber = '';
    submittedDateTime = '';
    hasEmailBeenSent = false;
    
    parseUrlParams();
    
    $('#chatContainer').empty();
    
    setTimeout(() => {
        if (autoDetectedService) {
            const serviceDisplayNames = {
                'office': '辦公大樓',
                'shopping': '購物中心',
                'observatory': '觀景台'
            };
            
            const detectedArea = serviceDisplayNames[autoDetectedService] || '';
            
            if (detectedArea) {
                addBotMessage(`💬 嗨～我是台北101智慧小幫手！🎉歡迎蒞臨${detectedArea}！`);
            } else {
                addBotMessage('💬 嗨～我是台北101智慧小幫手！🎉請選擇您所在的區域！');
            }
            
            setTimeout(() => {
                selectService(autoDetectedService);
            }, 800);
        } else {
            addBotMessage('💬 嗨～我是台北101智慧小幫手！🎉請選擇您所在的區域！');
            showServiceButtons();
        }
    }, 500);
}

// 顯示服務按鈕（垂直排列）
function showServiceButtons() {
    currentStep = 'select_service';
    
    if (autoDetectedService) {
        setTimeout(() => {
            selectService(autoDetectedService);
        }, 100);
        return;
    }
    
    const services = [
        {
            icon: '🏢',
            title: '辦公大樓',
            desc: '辦公區域通報',
            value: 'office'
        },
        {
            icon: '🛍️',
            title: '購物中心',
            desc: '購物區域通報',
            value: 'shopping'
        },
        {
            icon: '🏙️',
            title: '觀景台',
            desc: '觀景區域通報',
            value: 'observatory'
        }
    ];
    
    const buttonsHTML = `
        <div class="service-buttons" id="serviceButtons">
            ${services.map(service => `
                <div class="service-button" onclick="selectService('${service.value}')"
                     data-service="${service.value}">
                    <div class="service-button-icon">${service.icon}</div>
                    <div class="service-button-content">
                        <div class="service-button-title">${service.title}</div>
                        <div class="service-button-desc">${service.desc}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    addBotMessage(buttonsHTML);
}

// 選擇服務類型
function selectService(serviceType) {
    if (currentService) {
        const serviceIndex = chatMessages.findIndex(msg => msg.includes('service-buttons'));
        if (serviceIndex > -1) {
            chatMessages = chatMessages.slice(0, serviceIndex + 1);
        } else {
            const welcomeIndex = chatMessages.findIndex(msg => msg.includes('台北101智慧小幫手'));
            if (welcomeIndex > -1) {
                chatMessages = chatMessages.slice(0, welcomeIndex + 1);
            } else {
                chatMessages = [];
            }
        }
        
        $('#chatContainer').empty();
        $('#chatContainer').append(chatMessages.join(''));
        
        if (currentService !== serviceType) {
            selectedFloor = '';
            selectedLocation = '';
            customLocation = '';
            problemDescription = '';
            uploadedFile = null;
            uploadedFilePreview = null;
        }
    }
    
    currentService = serviceType;
    isQuickInputMode = false;
    isInQuickInputProcess = false;
    
    // 如果URL有帶入參數，且服務類型匹配，自動填入樓層和地點
    if (autoDetectedService === serviceType) {
        selectedFloor = autoDetectedFloor;
        
        // 檢查地點是否為預設選項
        let locationFound = false;
        let locations = [];
        
        // 根據服務類型獲取對應的地點列表
        if (serviceType === 'office') {
            locations = OFFICE_LOCATIONS;
        } else if (serviceType === 'shopping') {
            locations = MALL_LOCATIONS;
        } else if (serviceType === 'observatory') {
            locations = OBSERVATORY_LOCATIONS;
        }
        
        const foundLocation = locations.find(loc => 
            loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
        );
        
        if (foundLocation) {
            selectedLocation = foundLocation.id;
            customLocation = '';
            locationFound = true;
        }
        
        // 如果沒有找到預設選項，設為自訂地點
        if (!locationFound && autoDetectedLocation) {
            selectedLocation = '';
            customLocation = autoDetectedLocation;
        }
    }
    
    if ($('#serviceButtons').length) {
        $('#serviceButtons .service-button').removeClass('selected');
        $(`[data-service="${serviceType}"]`).addClass('selected');
    }
    
    const serviceNames = {
        'office': '🏢 辦公大樓',
        'shopping': '🛍️ 購物中心',
        'observatory': '🏙️ 觀景台'
    };
    
    if (!autoDetectedService || autoDetectedService !== serviceType) {
        addUserMessage(serviceNames[serviceType]);
    }
    
    setTimeout(() => {
        showReportForm();
    }, 500);
}

// 顯示通報表單
function showReportForm() {
    currentStep = 'input_form';
    
    const formTitles = {
        'office': '🏢 辦公大樓通報表單',
        'shopping': '🛍️ 購物中心通報表單',
        'observatory': '🏙️ 觀景台通報表單'
    };
    
    const formTitle = formTitles[currentService] || '通報表單';
    
    if (currentService === 'office') {
        // 辦公大樓表單 - 樓層數字輸入 + 地點選擇按鈕
        let floorDisplayText = selectedFloor || '請輸入樓層 (1-88)';
        
        let locationDisplayText = '請選擇地點';
        if (selectedLocation) {
            const location = OFFICE_LOCATIONS.find(loc => loc.id === selectedLocation);
            locationDisplayText = location ? location.label : selectedLocation;
        } else if (customLocation) {
            locationDisplayText = customLocation;
        }
        
        const formHTML = `
            <div class="form-title">${formTitle}</div>
            
            <div class="form-group">
                <label class="form-label">樓層 <span>*</span></label>
                <input type="number" class="form-control" id="floorInput"
                       value="${selectedFloor || ''}"
                       placeholder="請輸入樓層數字 (1-88)"
                       min="1" max="88"
                       onfocus="handleFloorFocus()"
                       onblur="handleOfficeFloorBlur()"
                       oninput="handleOfficeFloorInput()">
            </div>
            
            <div class="form-group">
                <label class="form-label">地點 <span>*</span></label>
                <button class="location-select-btn" onclick="showLocationModal()" id="locationSelectBtn">
                    <div class="location-display">
                        <span class="location-value">${locationDisplayText}</span>
                        <span class="location-arrow">▼</span>
                    </div>
                </button>
            </div>
            
            <div class="form-group">
                <label class="form-label">描述（非必要）</label>
                <textarea class="form-control" id="descriptionInput"
                          rows="3" placeholder="請輸入描述"
                          onfocus="handleDescriptionFocus()"
                          onblur="handleDescriptionBlur()"
                          oninput="handleDescriptionInput()">${problemDescription || ''}</textarea>
            </div>
            
            <button class="quick-reply-btn" onclick="confirmForm()"
                    style="background: #4a90e2; color: white; margin-top: 12px; width: 100%;">
                確認
            </button>
        `;
        addBotMessage(formHTML);
    } else {
        // 購物中心和觀景台表單
        let floorDisplayText = '請選擇樓層';
        if (selectedFloor) {
            if (selectedFloor.startsWith('B')) {
                floorDisplayText = `${selectedFloor}F`;
            } else {
                floorDisplayText = `${selectedFloor}F`;
            }
        }
        
        let locationDisplayText = '請選擇地點';
        if (selectedLocation) {
            let location = null;
            if (currentService === 'shopping') {
                location = MALL_LOCATIONS.find(loc => loc.id === selectedLocation);
            } else if (currentService === 'observatory') {
                location = OBSERVATORY_LOCATIONS.find(loc => loc.id === selectedLocation);
            }
            locationDisplayText = location ? location.label : selectedLocation;
        } else if (customLocation) {
            locationDisplayText = customLocation;
        }
        
        const formHTML = `
            <div class="form-title">${formTitle}</div>
            
            <div class="form-group">
                <label class="form-label">樓層 <span>*</span></label>
                <button class="floor-select-btn" onclick="showFloorModal()" id="floorSelectBtn">
                    <div class="floor-display">
                        <span class="floor-value">${floorDisplayText}</span>
                        <span class="floor-arrow">▼</span>
                    </div>
                </button>
            </div>
            
            <div class="form-group">
                <label class="form-label">地點 <span>*</span></label>
                <button class="location-select-btn" onclick="showLocationModal()" id="locationSelectBtn">
                    <div class="location-display">
                        <span class="location-value">${locationDisplayText}</span>
                        <span class="location-arrow">▼</span>
                    </div>
                </button>
            </div>
            
            <div class="form-group">
                <label class="form-label">描述（非必要）</label>
                <textarea class="form-control" id="descriptionInput"
                          rows="3" placeholder="請輸入描述"
                          onfocus="handleDescriptionFocus()"
                          onblur="handleDescriptionBlur()"
                          oninput="handleDescriptionInput()">${problemDescription || ''}</textarea>
            </div>
            
            <button class="quick-reply-btn" onclick="confirmForm()"
                    style="background: #4a90e2; color: white; margin-top: 12px; width: 100%;">
                確認
            </button>
        `;
        addBotMessage(formHTML);
    }
    
    setTimeout(() => {
        initPlaceholderStates();
    }, 100);
}

// 顯示樓層選擇模態框
function showFloorModal() {
    const modalTitle = currentService === 'shopping' ? '選擇購物中心樓層' : '選擇觀景台樓層';
    $('#floorModalTitle').text(modalTitle);
    
    let floors = [];
    if (currentService === 'shopping') {
        floors = SHOPPING_FLOORS;
    } else if (currentService === 'observatory') {
        floors = OBSERVATORY_FLOORS;
    }
    
    const floorOptionsHTML = floors.map(floor => {
        const displayFloor = floor.startsWith('B') ? `${floor}F` : `${floor}F`;
        const isSelected = selectedFloor === floor;
        return `
            <button class="floor-option-btn ${isSelected ? 'selected' : ''}" 
                    onclick="selectFloor('${floor}')">
                ${displayFloor}
            </button>
        `;
    }).join('');
    
    $('#floorOptions').html(floorOptionsHTML);
    $('#floorModal').show();
}

// 顯示地點選擇模態框 - 修改版本，包含自訂地點
function showLocationModal() {
    let locations = [];
    let modalTitle = '';
    
    if (currentService === 'office') {
        modalTitle = '選擇辦公大樓地點';
        locations = OFFICE_LOCATIONS;
    } else if (currentService === 'shopping') {
        modalTitle = '選擇購物中心地點';
        locations = MALL_LOCATIONS;
    } else if (currentService === 'observatory') {
        modalTitle = '選擇觀景台地點';
        locations = OBSERVATORY_LOCATIONS;
    }
    
    $('#locationModalTitle').text(modalTitle);
    
    // 建立自訂地點輸入區域的HTML
    const customLocationHTML = `
        <div class="custom-location-section">
            <div class="custom-location-title">自訂地點</div>
            <div class="custom-location-group" id="modalCustomLocationGroup">
                <div class="custom-location-icon">📍</div>
                <input type="text" class="custom-location-input ${customLocation ? '' : 'placeholder-active'}" 
                       id="modalCustomLocationInput"
                       placeholder="輸入自訂地點"
                       value="${customLocation || ''}">
            </div>
            <button class="custom-location-confirm-btn" onclick="confirmCustomLocation()">
                確認自訂地點
            </button>
        </div>
    `;
    
    const locationOptionsHTML = locations.map(location => {
        const isSelected = selectedLocation === location.id;
        return `
            <button class="location-option-btn ${isSelected ? 'selected' : ''}" 
                    onclick="selectLocation('${location.id}')">
                ${location.label}
            </button>
        `;
    }).join('');
    
    $('#locationOptions').html(`
        ${locationOptionsHTML}
        ${customLocationHTML}
    `);
    
    $('#locationModal').show();
}

// 確認自訂地點
function confirmCustomLocation() {
    const customInput = $('#modalCustomLocationInput');
    const customValue = customInput.val().trim();
    
    if (!customValue) {
        showToast('請輸入自訂地點', 'warning');
        return;
    }
    
    selectedLocation = '';
    customLocation = customValue;
    
    // 更新地點選擇按鈕顯示
    $('#locationSelectBtn .location-value').text(customLocation);
    
    // 關閉模態框
    closeLocationModal();
    
    showToast(`已設定自訂地點：${customLocation}`, 'success');
}

// 選擇樓層
function selectFloor(floor) {
    selectedFloor = floor;
    
    // 更新樓層選擇按鈕顯示
    const displayFloor = floor.startsWith('B') ? `${floor}F` : `${floor}F`;
    $('#floorSelectBtn .floor-value').text(displayFloor);
    
    // 關閉模態框
    closeFloorModal();
    
    showToast(`已選擇：${displayFloor}`, 'success');
}

// 選擇地點
function selectLocation(locationId) {
    selectedLocation = locationId;
    customLocation = ''; // 清空自訂地點
    
    // 取得地點標籤
    let locationLabel = '';
    let location = null;
    
    if (currentService === 'office') {
        location = OFFICE_LOCATIONS.find(loc => loc.id === locationId);
    } else if (currentService === 'shopping') {
        location = MALL_LOCATIONS.find(loc => loc.id === locationId);
    } else if (currentService === 'observatory') {
        location = OBSERVATORY_LOCATIONS.find(loc => loc.id === locationId);
    }
    
    locationLabel = location ? location.label : locationId;
    
    // 更新地點選擇按鈕顯示
    $('#locationSelectBtn .location-value').text(locationLabel);
    
    // 關閉模態框
    closeLocationModal();
    
    showToast(`已選擇：${locationLabel}`, 'success');
}

// 關閉樓層選擇模態框
function closeFloorModal() {
    $('#floorModal').hide();
}

// 關閉地點選擇模態框
function closeLocationModal() {
    $('#locationModal').hide();
}

// 辦公大樓樓層輸入限制 - 改為1-88
function handleOfficeFloorInput() {
    const floorInput = $('#floorInput');
    let floorValue = floorInput.val().trim();
    
    if (floorValue === '') {
        return;
    }
    
    let floorNum = parseInt(floorValue);
    if (isNaN(floorNum)) {
        floorInput.val('');
    } else {
        // 限制範圍 1-88
        if (floorNum > 88) {
            floorInput.val('88');
            showToast('樓層已自動調整為88', 'warning');
        } else if (floorNum < 1) {
            if (floorValue.length === 1 && floorNum < 1) {
                // 允許暫時小於1，等待用戶繼續輸入
            } else {
                floorInput.val('1');
                showToast('樓層已自動調整為1', 'warning');
            }
        }
    }
}

// 辦公大樓樓層失去焦點處理 - 改為1-88
function handleOfficeFloorBlur() {
    const floorInput = $('#floorInput');
    let floorValue = floorInput.val().trim();
    
    if (!floorValue) {
        floorInput.addClass('placeholder-active');
        floorInput.val('請輸入樓層數字 (1-88)');
    } else {
        let floorNum = parseInt(floorValue);
        if (isNaN(floorNum)) {
            floorInput.val('');
            showToast('請輸入有效的數字', 'warning');
        } else if (floorNum > 88) {
            floorInput.val('88');
            showToast('樓層已自動調整為88', 'warning');
        } else if (floorNum < 1) {
            floorInput.val('1');
            showToast('樓層已自動調整為1', 'warning');
        }
    }
}

// 初始化placeholder狀態
function initPlaceholderStates() {
    const floorInput = $('#floorInput');
    const descriptionInput = $('#descriptionInput');
    
    // 辦公大樓樓層輸入框
    if (currentService === 'office' && floorInput && !floorInput.val().trim()) {
        floorInput.addClass('placeholder-active');
        floorInput.val('請輸入樓層數字 (1-88)');
    }
    
    // 描述輸入框
    if (descriptionInput && !descriptionInput.val().trim()) {
        descriptionInput.addClass('placeholder-active');
        descriptionInput.val('請檢查、進行環境清潔');
        
        setTimeout(() => {
            adjustTextareaHeight(descriptionInput);
        }, 100);
    }
}

// 處理樓層輸入框焦點事件
function handleFloorFocus() {
    const floorInput = $('#floorInput');
    if (floorInput.hasClass('placeholder-active')) {
        floorInput.removeClass('placeholder-active');
        floorInput.val('');
    }
}

// 處理描述輸入框焦點事件
function handleDescriptionFocus() {
    const descriptionInput = $('#descriptionInput');
    if (descriptionInput.hasClass('placeholder-active')) {
        descriptionInput.removeClass('placeholder-active');
        descriptionInput.val('');
    }
}

// 處理描述輸入框失去焦點事件
function handleDescriptionBlur() {
    const descriptionInput = $('#descriptionInput');
    if (!descriptionInput.val().trim()) {
        descriptionInput.addClass('placeholder-active');
        descriptionInput.val('請檢查、進行環境清潔');
    }
}

// 處理描述輸入事件
function handleDescriptionInput() {
    const descriptionInput = $('#descriptionInput');
    if (descriptionInput.val().trim()) {
        descriptionInput.removeClass('placeholder-active');
    }
    
    adjustTextareaHeight(descriptionInput);
}

// 確認表單
function confirmForm() {
    const floorInput = $('#floorInput');
    const descriptionInput = $('#descriptionInput');
    
    // 辦公大樓：獲取樓層值
    if (currentService === 'office') {
        let floorValue = '';
        if (!floorInput.hasClass('placeholder-active') && floorInput.val().trim()) {
            floorValue = floorInput.val().trim();
        }
        
        // 驗證樓層 - 改為1-88
        if (floorValue) {
            const floorNum = parseInt(floorValue);
            if (isNaN(floorNum) || floorNum < 1 || floorNum > 88) {
                showToast('請輸入有效的樓層 (1 ~ 88)', 'warning');
                return;
            }
            selectedFloor = floorNum.toString();
        }
    }
    
    // 驗證樓層是否已選擇
    if (!selectedFloor) {
        if (currentService === 'office') {
            showToast('請輸入樓層', 'warning');
        } else {
            showToast('請選擇樓層', 'warning');
        }
        return;
    }
    
    // 處理描述
    if (descriptionInput.hasClass('placeholder-active') || !descriptionInput.val().trim() || descriptionInput.val().trim() === '請檢查、進行環境清潔') {
        problemDescription = '請檢查、進行環境清潔';
    } else {
        problemDescription = descriptionInput.val().trim();
    }
    
    // 驗證地點
    if (!selectedLocation && !customLocation) {
        showToast('請選擇或輸入地點', 'warning');
        return;
    }
    
    // 顯示摘要
    let summary = '';
    const displayFloor = currentService === 'office' ? `${selectedFloor}F` : 
                        selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
    summary += `📍 ${displayFloor}<br>`;
    
    if (selectedLocation) {
        let locationLabel = '';
        let location = null;
        
        if (currentService === 'office') {
            location = OFFICE_LOCATIONS.find(loc => loc.id === selectedLocation);
        } else if (currentService === 'shopping') {
            location = MALL_LOCATIONS.find(loc => loc.id === selectedLocation);
        } else if (currentService === 'observatory') {
            location = OBSERVATORY_LOCATIONS.find(loc => loc.id === selectedLocation);
        }
        
        locationLabel = location ? location.label : selectedLocation;
        summary += `📍 ${locationLabel}<br>`;
    } else if (customLocation) {
        summary += `📍 ${customLocation}<br>`;
    }
    
    if (problemDescription) {
        summary += `📝 ${problemDescription}`;
    }
    
    addUserMessage(summary);
    
    setTimeout(() => {
        askForPhoto();
    }, 500);
}

// 詢問照片
function askForPhoto() {
    currentStep = 'input_photo';
    
    const shouldShowInputText = isQuickInputMode && 
                               problemDescription && 
                               (autoDetectedFloor || autoDetectedLocation);
    
    let photoMessage = shouldShowInputText 
        ? `您剛才輸入的是：「${problemDescription}」，是否需要上傳照片輔助說明？（非必要）`
        : '📷 是否需要上傳照片輔助說明？（非必要）';
    
    addBotMessage(photoMessage);
    
    const photoHTML = `
        <div class="upload-area" onclick="$('#fileInput').click()" id="uploadArea">
            <div class="upload-icon">📷</div>
            <div style="font-weight: 600; margin-bottom: 8px; color: #2d3436;">點擊上傳照片</div>
            <div style="font-size: 13px; color: #868e96;">支援 JPG、PNG 格式</div>
        </div>
        <input type="file" id="fileInput" accept="image/*" style="display: none;"
               onchange="handleFileUpload(event)">
        <img id="previewImage" class="upload-preview" alt=""
             onclick="previewUploadedImage()" style="cursor: pointer;">
        
        <div class="quick-replies" style="margin-top: 18px;">
            <button class="quick-reply-btn" onclick="skipPhoto()">
                跳過不上傳
            </button>
            ${uploadedFile ? `
                <button class="quick-reply-btn" onclick="confirmPhoto()"
                        style="background: #4a90e2; color: white;">
                    確認上傳
                </button>
            ` : ''}
        </div>
    `;
    
    addBotMessage(photoHTML);
}

// 處理檔案上傳
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showToast('請選擇圖片檔案', 'warning');
        return;
    }
    
    showToast('正在處理圖片...', 'info');
    
    compressImage(file).then(compressedFile => {
        uploadedFile = compressedFile;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedFilePreview = e.target.result;
            $('#previewImage').attr('src', e.target.result).show();
            $('#uploadArea').hide();
            showToast('照片已選擇，點擊圖片可預覽', 'success');
            
            const quickReplies = $('.quick-replies').last();
            if (!quickReplies.find('.quick-reply-btn[onclick="confirmPhoto()"]').length) {
                const confirmBtn = $('<button class="quick-reply-btn" onclick="confirmPhoto()" style="background: #4a90e2; color: white;">確認上傳</button>');
                quickReplies.append(confirmBtn);
            }
        };
        reader.readAsDataURL(compressedFile);
    }).catch(error => {
        console.error('圖片處理失敗:', error);
        uploadedFile = file;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedFilePreview = e.target.result;
            $('#previewImage').attr('src', e.target.result).show();
            $('#uploadArea').hide();
            showToast('照片已選擇，點擊圖片可預覽', 'success');
            
            const quickReplies = $('.quick-replies').last();
            if (!quickReplies.find('.quick-reply-btn[onclick="confirmPhoto()"]').length) {
                const confirmBtn = $('<button class="quick-reply-btn" onclick="confirmPhoto()" style="background: #4a90e2; color: white;">確認上傳</button>');
                quickReplies.append(confirmBtn);
            }
        };
        reader.readAsDataURL(file);
    });
}

// 圖片壓縮函數
function compressImage(file) {
    return new Promise((resolve, reject) => {
        if (file.size < 2 * 1024 * 1024) {
            resolve(file);
            return;
        }
        
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const reader = new FileReader();
        
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        
        img.onload = function() {
            const maxWidth = 1200;
            const maxHeight = 1200;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            let quality = 0.7;
            if (file.size > 5 * 1024 * 1024) {
                quality = 0.6;
            } else if (file.size > 10 * 1024 * 1024) {
                quality = 0.5;
            }
            
            canvas.toBlob(
                blob => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error('壓縮失敗'));
                    }
                },
                'image/jpeg',
                quality
            );
        };
        
        img.onerror = function() {
            reject(new Error('圖片載入失敗'));
        };
        
        reader.onerror = function() {
            reject(new Error('檔案讀取失敗'));
        };
        
        reader.readAsDataURL(file);
    });
}

// 預覽上傳的圖片
function previewUploadedImage() {
    if (uploadedFilePreview) {
        $('#modalImage').attr('src', uploadedFilePreview);
        $('#imageModal').show();
    }
}

// 關閉圖片預覽
function closeImageModal() {
    $('#imageModal').hide();
}

// 跳過照片後直接顯示確認
function skipPhoto() {
    uploadedFile = null;
    addUserMessage('📷 不上傳照片');
    
    setTimeout(() => {
        showConfirmation();
    }, 500);
}

// 確認照片
function confirmPhoto() {
    if (uploadedFile) {
        addUserMessage('📷 已上傳照片');
        
        // 顯示照片預覽訊息
        setTimeout(() => {
            addBotMessage(`
                <div style="text-align: center;">
                    <img src="${uploadedFilePreview}"
                         style="max-width: 200px; border-radius: 10px; cursor: pointer;"
                         onclick="previewUploadedImage()"
                         alt="照片預覽">
                    <div style="font-size: 12px; color: #868e96; margin-top: 8px;">點擊圖片可放大預覽</div>
                </div>
            `);
            
            setTimeout(() => {
                showConfirmation();
            }, 800);
        }, 300);
    } else {
        showConfirmation();
    }
}

// 顯示確認頁面

// 確認Email並更新通報
function confirmEmail() {
    const emailInput = $('#emailInput');
    const email = emailInput.val().trim();
    
    if (!email) {
        showToast('請輸入Email地址', 'warning');
        return;
    }
    
    // 簡單的Email格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('請輸入有效的Email地址', 'warning');
        return;
    }
    
    // 儲存Email地址
    emailAddress = email;
    
    // 關閉模態框
    closeEmailModal();
    
    // 顯示用戶輸入的email作為對話內容
    addUserMessage(`📧 ${email}`);
    
    // 顯示載入中
    const loadingId = 'email-loading-' + Date.now();
    addBotMessage(`<div id="${loadingId}" class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`);
    
    // 重新發送通報資料（包含email）
    setTimeout(() => {
        // 重新準備資料
        const serviceNames = {
            'office': '辦公大樓',
            'shopping': '購物中心',
            'observatory': '觀景台'
        };
        
        let locationText = '';
        let floorText = '';
        
        if (isQuickInputMode) {
            if (autoDetectedFloor && autoDetectedLocation) {
                floorText = autoDetectedFloor;
                locationText = autoDetectedLocation;
            } else {
                locationText = '快速輸入';
                floorText = '快速輸入';
            }
        } else {
            floorText = currentService === 'office' ? `${selectedFloor}F` : 
                       selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
            
            if (selectedLocation) {
                let locationLabel = '';
                let location = null;
                
                if (currentService === 'office') {
                    location = OFFICE_LOCATIONS.find(loc => loc.id === selectedLocation);
                } else if (currentService === 'shopping') {
                    location = MALL_LOCATIONS.find(loc => loc.id === selectedLocation);
                } else if (currentService === 'observatory') {
                    location = OBSERVATORY_LOCATIONS.find(loc => loc.id === selectedLocation);
                }
                
                locationLabel = location ? location.label : selectedLocation;
                locationText = locationLabel;
            } else if (customLocation) {
                locationText = customLocation;
            }
        }
        
        const serviceTypeText = serviceNames[currentService] || '快速輸入';
        
        // LINE通知訊息（包含email）
        let lineMessage = `【${serviceTypeText}通知】\n`;
        if (isQuickInputMode && autoDetectedFloor && autoDetectedLocation) {
            lineMessage += `📍 樓層：${floorText}\n📍 地點：${locationText}\n`;
        } else if (!isQuickInputMode) {
            lineMessage += `📍 樓層：${floorText}\n📍 地點：${locationText}\n`;
        }
        if (problemDescription) {
            lineMessage += `📝 ${problemDescription}\n`;
        }
        lineMessage += `🆔 案號：${submittedCaseNumber}\n📧 Email：${email}`;
        
        const formData = {
            case_number: submittedCaseNumber,
            report_date: submittedDateTime.split(' ')[0],
            report_time: submittedDateTime.split(' ')[1],
            service_type: serviceTypeText,
            floor: floorText || (autoDetectedFloor ? autoDetectedFloor : '快速輸入'),
            location: locationText || (autoDetectedLocation ? autoDetectedLocation : '快速輸入'),
            description: problemDescription || '',
            email: email,
            status: '進行中',
            photo_id: uploadedFile ? '有照片' : '',
            msg: lineMessage
        };
        
        // 發送更新請求（包含email）
        sendToGoogleAppsScript(formData, true);
        
    }, 500);
}

// 跳過Email
function skipEmail() {
    emailAddress = '';
    showFinalPage(null);
}

// 修改顯示確認頁面的部分，直接提交不通問Email
function showConfirmation() {
    currentStep = 'confirmation';
    
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    if (isQuickInputMode) {
        let confirmationHTML = `
            <div class="case-card">
                <div class="case-details">
                    <div class="case-detail-item">
                        <div class="detail-label">通報內容</div>
                        <div class="detail-value">${problemDescription}</div>
                    </div>
                    <div class="case-detail-item">
                        <div class="detail-label">服務類型</div>
                        <div class="detail-value">${serviceNames[currentService] || '快速輸入'}</div>
                    </div>`;
        
        if (autoDetectedFloor && autoDetectedLocation) {
            const displayFloor = autoDetectedFloor.startsWith('B') ? `${autoDetectedFloor}F` : `${autoDetectedFloor}F`;
            const locationText = autoDetectedLocation;
            
            confirmationHTML += `
                    <div class="case-detail-item">
                        <div class="detail-label">樓層</div>
                        <div class="detail-value">${displayFloor}</div>
                    </div>
                    <div class="case-detail-item">
                        <div class="detail-label">地點</div>
                        <div class="detail-value">${locationText}</div>
                    </div>`;
        }
        
        confirmationHTML += `
                    <div class="case-detail-item">
                        <div class="detail-label">照片附件</div>
                        <div class="detail-value">${uploadedFile ? '有' : '無'}</div>
                    </div>
                </div>
            </div>
            
            <div class="quick-replies">
                <button class="quick-reply-btn" onclick="editInformation()">
                    修改資訊
                </button>
                <button class="quick-reply-btn" onclick="submitReport()"
                        style="background: #4a90e2; color: white; font-weight: bold;">
                    ✓ 確認提交
                </button>
            </div>
        `;
        
        addBotMessage(confirmationHTML);
    } else {
        // 正常模式：顯示所有資訊
        let locationText = '';
        if (selectedLocation) {
            let locationLabel = '';
            let location = null;
            
            if (currentService === 'office') {
                location = OFFICE_LOCATIONS.find(loc => loc.id === selectedLocation);
            } else if (currentService === 'shopping') {
                location = MALL_LOCATIONS.find(loc => loc.id === selectedLocation);
            } else if (currentService === 'observatory') {
                location = OBSERVATORY_LOCATIONS.find(loc => loc.id === selectedLocation);
            }
            
            locationLabel = location ? location.label : selectedLocation;
            locationText = locationLabel;
        } else if (customLocation) {
            locationText = customLocation;
        }
        
        // 格式化樓層顯示
        const displayFloor = currentService === 'office' ? `${selectedFloor}F` : 
                            selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
        
        const confirmationHTML = `
            <div class="case-card">
                <div class="case-details">
                    <div class="case-detail-item">
                        <div class="detail-label">服務類型</div>
                        <div class="detail-value">${serviceNames[currentService]}</div>
                    </div>
                    <div class="case-detail-item">
                        <div class="detail-label">樓層</div>
                        <div class="detail-value">${displayFloor}</div>
                    </div>
                    <div class="case-detail-item">
                        <div class="detail-label">地點</div>
                        <div class="detail-value">${locationText}</div>
                    </div>
                    ${problemDescription ? `
                    <div class="case-detail-item">
                        <div class="detail-label">描述</div>
                        <div class="detail-value">${problemDescription}</div>
                    </div>
                    ` : ''}
                    <div class="case-detail-item">
                        <div class="detail-label">照片附件</div>
                        <div class="detail-value">${uploadedFile ? '有' : '無'}</div>
                    </div>
                </div>
            </div>
            
            <div class="quick-replies">
                <button class="quick-reply-btn" onclick="editInformation()">
                    修改資訊
                </button>
                <button class="quick-reply-btn" onclick="submitReport()"
                        style="background: #4a90e2; color: white; font-weight: bold;">
                    ✓ 確認提交
                </button>
            </div>
        `;
        addBotMessage(confirmationHTML);
    }
}

function editInformation() {
    const savedFloor = selectedFloor;
    const savedLocation = selectedLocation;
    const savedCustomLocation = customLocation;
    const savedDescription = problemDescription;
    const savedService = currentService;
    const savedIsQuickInputMode = isQuickInputMode;
    
    const serviceIndex = chatMessages.findIndex(msg => msg.includes('service-buttons') || msg.includes('歡迎蒞臨'));
    if (serviceIndex > -1) {
        chatMessages = chatMessages.slice(0, serviceIndex + 1);
    } else {
        chatMessages = [];
    }
    
    $('#chatContainer').empty().append(chatMessages.join(''));
    
    selectedFloor = savedFloor;
    selectedLocation = savedLocation;
    customLocation = savedCustomLocation;
    problemDescription = savedDescription;
    currentService = savedService;
    isQuickInputMode = savedIsQuickInputMode;
    
    if (isQuickInputMode) {
        initChat();
        return;
    } else {
        showReportForm();
    }
}

// 提交通報 - 修改版本，先不傳送email
// 提交通報
function submitReport() {
    // 顯示載入中
    const loadingId = 'loading-' + Date.now();
    addBotMessage(`<div id="${loadingId}" class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`);
    
    // 生成案件編號
    let caseNumber;
    if (currentService === 'office') {
        caseNumber = 'WD' + (Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000);
    } else if (currentService === 'shopping') {
        caseNumber = 'SC' + (Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000);
    } else {
        caseNumber = 'OB' + (Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000);
    }
    
    const today = new Date();
    const reportDate = today.getFullYear() + '/' +
                       String(today.getMonth() + 1).padStart(2, '0') + '/' +
                       String(today.getDate()).padStart(2, '0');
    const reportTime = String(today.getHours()).padStart(2, '0') + ':' +
                       String(today.getMinutes()).padStart(2, '0');
    
    submittedCaseNumber = caseNumber;
    submittedDateTime = reportDate + ' ' + reportTime;
    hasEmailBeenSent = false; // 重置email發送狀態
    
    // 準備資料
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    let locationText = '';
    let floorText = '';
    
    if (isQuickInputMode) {
        // 快速輸入模式
        if (autoDetectedFloor && autoDetectedLocation) {
            floorText = autoDetectedFloor;
            locationText = autoDetectedLocation;
        } else {
            locationText = '快速輸入';
            floorText = '快速輸入';
        }
    } else {
        // 正常模式
        floorText = currentService === 'office' ? `${selectedFloor}F` : 
                   selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
        
        if (selectedLocation) {
            let locationLabel = '';
            let location = null;
            
            if (currentService === 'office') {
                location = OFFICE_LOCATIONS.find(loc => loc.id === selectedLocation);
            } else if (currentService === 'shopping') {
                location = MALL_LOCATIONS.find(loc => loc.id === selectedLocation);
            } else if (currentService === 'observatory') {
                location = OBSERVATORY_LOCATIONS.find(loc => loc.id === selectedLocation);
            }
            
            locationLabel = location ? location.label : selectedLocation;
            locationText = locationLabel;
        } else if (customLocation) {
            locationText = customLocation;
        }
    }
    
    const serviceTypeText = serviceNames[currentService] || '快速輸入';
    
    // LINE通知訊息（先不包含email）
    let lineMessage = `【${serviceTypeText}通知】\n`;
    if (isQuickInputMode && autoDetectedFloor && autoDetectedLocation) {
        lineMessage += `📍 樓層：${floorText}\n📍 地點：${locationText}\n`;
    } else if (!isQuickInputMode) {
        lineMessage += `📍 樓層：${floorText}\n📍 地點：${locationText}\n`;
    }
    if (problemDescription) {
        lineMessage += `📝 ${problemDescription}\n`;
    }
    lineMessage += `🆔 案號：${caseNumber}`;
    
    // 準備發送到 Google Apps Script 的資料（先不傳email）
    const formData = {
        case_number: caseNumber,
        report_date: reportDate,
        report_time: reportTime,
        service_type: serviceTypeText,
        floor: floorText || (autoDetectedFloor ? autoDetectedFloor : '快速輸入'),
        location: locationText || (autoDetectedLocation ? autoDetectedLocation : '快速輸入'),
        description: problemDescription || '',
        email: '', // 先不傳email，等待用戶選擇
        status: '進行中',
        photo_id: '',
        msg: lineMessage
    };
    
    // 如果有照片，先上傳照片
    if (uploadedFile) {
        compressAndUploadImage().then(imageId => {
            if (imageId) {
                formData.photo_id = imageId;
                formData.msg = `${lineMessage}\n📷 已附照片`;
                sendToGoogleAppsScript(formData, false); // false表示不包含email
            } else {
                sendToGoogleAppsScript(formData, false);
            }
        }).catch(error => {
            console.error('照片上傳失敗:', error);
            sendToGoogleAppsScript(formData, false);
        });
    } else {
        sendToGoogleAppsScript(formData, false);
    }
}

// 壓縮並上傳圖片
function compressAndUploadImage() {
    return new Promise((resolve, reject) => {
        if (!uploadedFile) {
            resolve(null);
            return;
        }
        
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const reader = new FileReader();
        
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        
        img.onload = function() {
            const maxWidth = 1200;
            const maxHeight = 1200;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            const base64Data = canvas.toDataURL('image/jpeg', 0.7);
            const rawData = base64Data.split(',')[1];
            
            fetch(API_CONFIG.UPLOAD_API, {
                method: 'POST',
                body: JSON.stringify({
                    dataReq: {
                        data: rawData,
                        name: uploadedFile.name,
                        type: 'image/jpeg'
                    },
                    fname: "uploadFilesToGoogleDrive"
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.id) {
                    resolve(data.id);
                } else {
                    reject(new Error('圖片上傳失敗'));
                }
            })
            .catch(error => {
                reject(error);
            });
        };
        
        reader.onerror = function() {
            reject(new Error('讀取檔案失敗'));
        };
        
        reader.readAsDataURL(uploadedFile);
    });
}

// 發送到Google Apps Script - 修改版本，支援email更新
function sendToGoogleAppsScript(formData, includeEmail = false) {
    // 移除載入訊息
    $('.typing-indicator').last().remove();
    
    // 如果需要包含email，更新formData
    if (includeEmail && emailAddress && !hasEmailBeenSent) {
        formData.email = emailAddress;
        // 更新LINE訊息包含email
        formData.msg = formData.msg + `\n📧 Email：${emailAddress}`;
        hasEmailBeenSent = true;
    }
    
    // 使用 GET 方式發送
    var params = new URLSearchParams();
    for (var key in formData) {
        params.append(key, formData[key]);
    }
    
    // 使用 GET 方式發送
    $.ajax({
        url: API_CONFIG.MAIN_API + '?' + params.toString(),
        method: 'GET',
        success: function(response) {
            console.log('通報成功:', response);
            if (typeof response === 'string') {
                try {
                    response = JSON.parse(response);
                } catch(e) {
                    console.log('回應不是 JSON 格式');
                }
            }
            
            if (includeEmail) {
                // 如果有傳送email，只顯示email確認訊息
                showEmailConfirmationOnly(response);
            } else {
                // 如果沒有傳送email，顯示完成頁面
                showCompletionPage();
            }
        },
        error: function(xhr, status, error) {
            console.error('通報失敗:', error);
            if (includeEmail) {
                // 即使API錯誤，也顯示email確認訊息
                showEmailConfirmationOnly(null);
            } else {
                // 顯示完成頁面
                showCompletionPage();
            }
        }
    });
}
// 顯示成功頁面
function showSuccessPage(caseNumber, dateTime, apiResponse) {
    currentStep = 'completed';
    
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    // 辦公大樓顯示查詢按鈕和案件編號，購物中心和觀景台不顯示
    const isOffice = currentService === 'office';
    const showCaseNumber = isOffice;
    const showQueryButton = isOffice;
    
    // 檢查是否有Email回饋
    const hasEmail = emailAddress && emailAddress.trim() !== '';
    const emailProvided = apiResponse && apiResponse.email_provided;
    const emailResult = apiResponse ? apiResponse.email_result : '';
    
    // 顯示email發送結果
    let emailStatusHtml = '';
    if (hasEmail || emailProvided) {
        if (emailResult && emailResult.includes('成功')) {
            emailStatusHtml = `
                <div style="background: #d4edda; color: #155724; padding: 12px 16px; border-radius: 10px; margin: 15px 0; text-align: center; border: 1px solid #c3e6cb;">
                    <div style="font-weight: 600; margin-bottom: 5px;">✓ Email確認信已寄出</div>
                    <div style="font-size: 13px;">已寄送至: ${emailAddress}</div>
                </div>
            `;
        } else if (emailResult && emailResult.includes('失敗')) {
            emailStatusHtml = `
                <div style="background: #fff3cd; color: #856404; padding: 12px 16px; border-radius: 10px; margin: 15px 0; text-align: center; border: 1px solid #ffeaa7;">
                    <div style="font-weight: 600; margin-bottom: 5px;">⚠ Email發送失敗</div>
                    <div style="font-size: 13px;">${emailResult}</div>
                </div>
            `;
        }
    }
    
    const successHTML = `
        <div class="success-container">
            <div class="success-icon">
                <img src="static/pic/success.png" alt="成功圖示">
            </div>
            <div class="success-title">${serviceNames[currentService] || '快速輸入'}通報已完成</div>
            <div style="color: #666; margin-bottom: 20px; line-height: 1.6; font-size: 15px;">
                感謝您的通報，我們會盡快處理
            </div>
            
            ${emailStatusHtml}
            
            ${showCaseNumber ? `
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #868e96; margin-bottom: 5px;">您的案件編號</div>
                    <div class="case-number">${caseNumber}</div>
                    <div style="font-size: 14px; color: #868e96; margin-top: 5px;">通報時間：${dateTime}</div>
                </div>
            ` : `
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #868e96; margin-bottom: 5px;">通報時間</div>
                    <div style="font-size: 18px; font-weight: 600; color: #4a90e2; margin: 10px 0;">${dateTime}</div>
                </div>
            `}
            
            <div class="quick-replies">
                <button class="quick-reply-btn" onclick="initChat()"
                        style="background: #4a90e2; color: white;">
                    新的通報
                </button>
                ${showQueryButton ? `
                    <button class="quick-reply-btn" onclick="showHistoryModal()">
                        查詢紀錄
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    addBotMessage(successHTML);
}

// 顯示Email輸入模態框
function showEmailModal() {
    // 先顯示確認頁面，然後詢問是否需要Email回覆
    currentStep = 'email_confirmation';
    
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    const confirmationHTML = `
        <div class="form-title">${serviceNames[currentService]}通報確認</div>
        
        <div style="background: #f8f9fa; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px solid #e9ecef;">
            <div style="font-weight: 600; color: #2d3436; margin-bottom: 12px; font-size: 16px;">通報內容摘要</div>
            ${getCaseSummary()}
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
            <div style="font-size: 15px; color: #2d3436; margin-bottom: 15px; font-weight: 600;">
                是否需要Email回覆確認？
            </div>
            <div style="font-size: 13px; color: #868e96; margin-bottom: 25px; line-height: 1.5;">
                我們將寄送確認信件至您提供的Email地址<br>
                方便您追蹤案件處理進度
            </div>
            
            <div class="quick-replies" style="justify-content: center;">
                <button class="quick-reply-btn" onclick="openEmailInputModal()"
                        style="background: #4a90e2; color: white; min-width: 120px;">
                    輸入Email
                </button>
                <button class="quick-reply-btn" onclick="skipEmailAndSubmit()"
                        style="min-width: 120px;">
                    不需要
                </button>
            </div>
        </div>
    `;
    
    addBotMessage(confirmationHTML);
}

function getCaseSummary() {
    let summary = '';
    
    if (isQuickInputMode) {
        summary = `
            <div style="margin-bottom: 8px;">
                <span style="color: #868e96; font-size: 13px;">通報內容：</span>
                <span style="color: #2d3436; font-weight: 500;">${problemDescription}</span>
            </div>
        `;
    } else {
        const serviceNames = {
            'office': '辦公大樓',
            'shopping': '購物中心',
            'observatory': '觀景台'
        };
        
        const displayFloor = currentService === 'office' ? `${selectedFloor}F` : 
                            selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
        
        let locationText = '';
        if (selectedLocation) {
            let locationLabel = '';
            let location = null;
            
            if (currentService === 'office') {
                location = OFFICE_LOCATIONS.find(loc => loc.id === selectedLocation);
            } else if (currentService === 'shopping') {
                location = MALL_LOCATIONS.find(loc => loc.id === selectedLocation);
            } else if (currentService === 'observatory') {
                location = OBSERVATORY_LOCATIONS.find(loc => loc.id === selectedLocation);
            }
            
            locationLabel = location ? location.label : selectedLocation;
            locationText = locationLabel;
        } else if (customLocation) {
            locationText = customLocation;
        }
        
        summary = `
            <div style="margin-bottom: 8px;">
                <span style="color: #868e96; font-size: 13px;">服務類型：</span>
                <span style="color: #2d3436; font-weight: 500;">${serviceNames[currentService]}</span>
            </div>
            <div style="margin-bottom: 8px;">
                <span style="color: #868e96; font-size: 13px;">樓層：</span>
                <span style="color: #2d3436; font-weight: 500;">${displayFloor}</span>
            </div>
            <div style="margin-bottom: 8px;">
                <span style="color: #868e96; font-size: 13px;">地點：</span>
                <span style="color: #2d3436; font-weight: 500;">${locationText}</span>
            </div>
            ${problemDescription && problemDescription !== '請檢查、進行環境清潔' ? `
            <div style="margin-bottom: 8px;">
                <span style="color: #868e96; font-size: 13px;">描述：</span>
                <span style="color: #2d3436; font-weight: 500;">${problemDescription}</span>
            </div>
            ` : ''}
            <div style="margin-bottom: 8px;">
                <span style="color: #868e96; font-size: 13px;">照片附件：</span>
                <span style="color: #2d3436; font-weight: 500;">${uploadedFile ? '有' : '無'}</span>
            </div>
        `;
    }
    
    return summary;
}

// 顯示Email選擇頁面
function showEmailOptionPage() {
    currentStep = 'email_option';
    
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    // 辦公大樓顯示查詢按鈕和案件編號，購物中心和觀景台不顯示
    const isOffice = currentService === 'office';
    const showCaseNumber = isOffice;
    const showQueryButton = isOffice;
    
    const emailOptionHTML = `
        <div class="success-container">
            <div class="success-icon">
                <img src="static/pic/success.png" alt="成功圖示">
            </div>
            <div style="color: #666; margin-bottom: 20px; line-height: 1.6; font-size: 15px;">
                感謝您的通報，我們會盡快處理
            </div>
            
            ${showCaseNumber ? `
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #868e96; margin-bottom: 5px;">您的案件編號</div>
                    <div class="case-number">${submittedCaseNumber}</div>
                    <div style="font-size: 14px; color: #868e96; margin-top: 5px;">通報時間：${submittedDateTime}</div>
                </div>
            ` : `
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #868e96; margin-bottom: 5px;">通報時間</div>
                    <div style="font-size: 18px; font-weight: 600; color: #4a90e2; margin: 10px 0;">${submittedDateTime}</div>
                </div>
            `}
            
            <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;">
                <div style="font-size: 16px; color: #2d3436; margin-bottom: 12px; font-weight: 600; text-align: center;">
                    是否需要Email回覆確認？
                </div>
                <div style="font-size: 14px; color: #666; margin-bottom: 20px; line-height: 1.6; text-align: center;">
                    我們將寄送確認信件至您提供的Email地址<br>
                    方便您追蹤案件處理進度
                </div>
                
                <div class="quick-replies" style="justify-content: center; margin-top: 15px;">
                    <button class="quick-reply-btn" onclick="openEmailInputModal()"
                            style="background: #4a90e2; color: white; min-width: 120px;">
                        輸入Email
                    </button>
                    <button class="quick-reply-btn" onclick="skipEmail()"
                            style="min-width: 120px;">
                        不需要
                    </button>
                </div>
            </div>
            
            <div class="quick-replies">
                <button class="quick-reply-btn" onclick="initChat()"
                        style="background: #4a90e2; color: white;">
                    新的通報
                </button>
                ${showQueryButton ? `
                    <button class="quick-reply-btn" onclick="showHistoryModal()">
                        查詢紀錄
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    addBotMessage(emailOptionHTML);
}

// 顯示最終完成頁面
function showFinalPage(apiResponse) {
    currentStep = 'completed';
    
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    // 辦公大樓顯示查詢按鈕和案件編號，購物中心和觀景台不顯示
    const isOffice = currentService === 'office';
    const showCaseNumber = isOffice;
    const showQueryButton = isOffice;
    
    // 檢查是否有Email回饋
    const hasEmail = emailAddress && emailAddress.trim() !== '';
    const emailProvided = apiResponse && apiResponse.email_provided;
    const emailResult = apiResponse ? apiResponse.email_result : '';
    
    // 顯示email發送結果
    let emailStatusHtml = '';
    if (hasEmail || emailProvided) {
        if (emailResult && emailResult.includes('成功')) {
            emailStatusHtml = `
                <div style="background: #d4edda; color: #155724; padding: 12px 16px; border-radius: 10px; margin: 15px 0; text-align: center; border: 1px solid #c3e6cb;">
                    <div style="font-weight: 600; margin-bottom: 5px;">✓ Email確認信已寄出</div>
                    <div style="font-size: 13px;">已寄送至: ${emailAddress}</div>
                </div>
            `;
        } else if (emailResult && emailResult.includes('失敗')) {
            emailStatusHtml = `
                <div style="background: #fff3cd; color: #856404; padding: 12px 16px; border-radius: 10px; margin: 15px 0; text-align: center; border: 1px solid #ffeaa7;">
                    <div style="font-weight: 600; margin-bottom: 5px;">⚠ Email發送失敗</div>
                    <div style="font-size: 13px;">${emailResult}</div>
                </div>
            `;
        }
    }
    
    const finalHTML = `
        <div class="success-container">
            <div class="success-icon">
                <img src="static/pic/success.png" alt="成功圖示">
            </div>
            <div style="color: #666; margin-bottom: 20px; line-height: 1.6; font-size: 15px;">
                感謝您的通報，我們會盡快處理
            </div>
            
            ${emailStatusHtml}
            
            ${showCaseNumber ? `
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #868e96; margin-bottom: 5px;">您的案件編號</div>
                    <div class="case-number">${submittedCaseNumber}</div>
                    <div style="font-size: 14px; color: #868e96; margin-top: 5px;">通報時間：${submittedDateTime}</div>
                </div>
            ` : `
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #868e96; margin-bottom: 5px;">通報時間</div>
                    <div style="font-size: 18px; font-weight: 600; color: #4a90e2; margin: 10px 0;">${submittedDateTime}</div>
                </div>
            `}
            
            <div class="quick-replies">
                <button class="quick-reply-btn" onclick="initChat()"
                        style="background: #4a90e2; color: white;">
                    新的通報
                </button>
                ${showQueryButton ? `
                    <button class="quick-reply-btn" onclick="showHistoryModal()">
                        查詢紀錄
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    addBotMessage(finalHTML);
}

// 顯示完成頁面（不含email詢問）
function showCompletionPage() {
    currentStep = 'completion';
    
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    // 辦公大樓顯示查詢按鈕和案件編號，購物中心和觀景台不顯示
    const isOffice = currentService === 'office';
    const showCaseNumber = isOffice;
    const showQueryButton = isOffice;
    
    const completionHTML = `
        <div class="success-container">
            <div class="success-icon">
                <img src="static/pic/success.png" alt="成功圖示">
            </div>
            <div style="color: #666; margin-bottom: 20px; line-height: 1.6; font-size: 15px;">
                感謝您的通報，我們會盡快處理
            </div>
            
            ${showCaseNumber ? `
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #868e96; margin-bottom: 5px;">您的案件編號</div>
                    <div class="case-number">${submittedCaseNumber}</div>
                    <div style="font-size: 14px; color: #868e96; margin-top: 5px;">通報時間：${submittedDateTime}</div>
                </div>
            ` : `
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #868e96; margin-bottom: 5px;">通報時間</div>
                    <div style="font-size: 18px; font-weight: 600; color: #4a90e2; margin: 10px 0;">${submittedDateTime}</div>
                </div>
            `}
            
            <div class="quick-replies" style="justify-content: center; margin-bottom: 20px;">
                <button class="quick-reply-btn" onclick="initChat()"
                        style="background: #4a90e2; color: white; margin: 0 8px;">
                    新的通報
                </button>
                ${showQueryButton ? `
                    <button class="quick-reply-btn" onclick="showHistoryModal()" style="margin: 0 8px;">
                        查詢紀錄
                    </button>
                ` : ''}
            </div>
            
            <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e9ecef;">
                <button class="email-option-btn" onclick="openEmailInputModal()">
                    📧 需要Email回覆確認
                </button>
                <div style="font-size: 12px; color: #868e96; margin-top: 10px; line-height: 1.5;">
                    我們將寄送確認信件至您提供的Email地址<br>
                    方便您追蹤案件處理進度
                </div>
            </div>
        </div>
    `;
    
    addBotMessage(completionHTML);
}

// 只顯示Email確認訊息
function showEmailConfirmationOnly(apiResponse) {
    currentStep = 'email_confirmed';
    
    // 檢查Email發送結果
    const emailResult = apiResponse ? apiResponse.email_result : '';
    let emailStatusHtml = '';
    
    if (emailResult && emailResult.includes('成功')) {
        emailStatusHtml = `
            <div class="success-container" style="padding: 25px 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 48px; color: #4a90e2; margin-bottom: 15px;">✓</div>
                    <div style="font-size: 16px; font-weight: 600; color: #2d3436; margin-bottom: 8px;">
                        Email確認信已寄出
                    </div>
                    <div style="font-size: 14px; color: #666;">
                        已寄送至: ${emailAddress}
                    </div>
                </div>
                
                <div class="quick-replies" style="justify-content: center; margin-top: 20px;">
                    <button class="quick-reply-btn" onclick="initChat()"
                            style="background: #4a90e2; color: white; margin: 0 8px;">
                        新的通報
                    </button>
                    <button class="quick-reply-btn" onclick="showHistoryModal()" style="margin: 0 8px;">
                        查詢紀錄
                    </button>
                </div>
            </div>
        `;
    } else {
        emailStatusHtml = `
            <div class="success-container" style="padding: 25px 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 48px; color: #ff6b6b; margin-bottom: 15px;">⚠</div>
                    <div style="font-size: 16px; font-weight: 600; color: #2d3436; margin-bottom: 8px;">
                        Email發送失敗
                    </div>
                    <div style="font-size: 14px; color: #666;">
                        ${emailResult || '請稍後再試'}
                    </div>
                </div>
                
                <div class="quick-replies" style="justify-content: center; margin-top: 20px;">
                    <button class="quick-reply-btn" onclick="initChat()"
                            style="background: #4a90e2; color: white; margin: 0 8px;">
                        新的通報
                    </button>
                    <button class="quick-reply-btn" onclick="showHistoryModal()" style="margin: 0 8px;">
                        查詢紀錄
                    </button>
                </div>
            </div>
        `;
    }
    
    addBotMessage(emailStatusHtml);
}

// 打開Email輸入模態框
function openEmailInputModal() {
    // 創建Email輸入模態框HTML
    const emailModalHTML = `
        <div class="modal" id="emailModal" style="display: block;">
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header">
                    <div class="modal-title">📧 輸入Email地址</div>
                    <button class="modal-close" onclick="closeEmailModal()">×</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 20px; color: #666; font-size: 14px; line-height: 1.6;">
                        請輸入您的Email地址，我們將寄送通報確認信件<br>
                        方便您追蹤案件處理進度
                    </div>
                    
                    <div class="form-group">
                        <input type="email" class="form-control" id="emailInput"
                               placeholder="請輸入Email地址，例如：name@example.com"
                               value="${emailAddress || ''}">
                    </div>
                    
                    <div style="color: #868e96; font-size: 12px; margin-top: 8px; line-height: 1.5;">
                        <div>📌 請確認Email地址正確無誤</div>
                        <div>📌 信件內容包含案件編號及通報詳情</div>
                        <div>📌 案件處理完成後會另行通知</div>
                    </div>
                    
                    <div class="quick-replies" style="margin-top: 25px; justify-content: space-between;">
                        <button class="quick-reply-btn" onclick="closeEmailModal()" style="flex: 1;">
                            取消
                        </button>
                        <button class="quick-reply-btn" onclick="confirmEmail()"
                                style="flex: 1; background: #4a90e2; color: white;">
                            確認送出
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 添加模態框到body
    if ($('#emailModal').length === 0) {
        $('body').append(emailModalHTML);
    } else {
        $('#emailModal').show();
    }
}

// 關閉Email模態框
function closeEmailModal() {
    $('#emailModal').hide();
}

// 確認Email並提交
function confirmEmailAndSubmit() {
    const emailInput = $('#emailInput');
    const email = emailInput.val().trim();
    
    if (!email) {
        showToast('請輸入Email地址', 'warning');
        return;
    }
    
    // 簡單的Email格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('請輸入有效的Email地址', 'warning');
        return;
    }
    
    // 儲存Email地址
    emailAddress = email;
    
    // 關閉模態框
    closeEmailModal();
    
    // 顯示Email確認訊息
    addUserMessage('📧 需要Email回覆');
    
    // 提交通報
    setTimeout(() => {
        submitReport();
    }, 500);
}

// 跳過Email直接提交
function skipEmailAndSubmit() {
    emailAddress = '';
    addUserMessage('📧 不需要Email回覆');
    
    setTimeout(() => {
        submitReport();
    }, 500);
}

// 開始快速輸入模式
function startQuickInputMode(message) {
    const welcomeIndex = chatMessages.findIndex(msg => msg.includes('台北101智慧小幫手'));
    if (welcomeIndex > -1) {
        chatMessages = chatMessages.slice(0, welcomeIndex + 1);
    } else {
        chatMessages = [];
    }
    
    $('#chatContainer').empty();
    $('#chatContainer').append(chatMessages.join(''));
    
    currentStep = 'quick_input';
    problemDescription = message;
    isQuickInputMode = true;
    isInQuickInputProcess = true;
    
    selectedFloor = '';
    selectedLocation = '';
    customLocation = '';
    uploadedFile = null;
    uploadedFilePreview = null;
    
    addUserMessage(message);
    
    $('#messageInput').val('');
    adjustTextareaHeight();
    
    if (autoDetectedService) {
        currentService = autoDetectedService;
        showQuickInputConfirmation(message, true);
    } else {
        askForServiceType(message);
    }
}

// 詢問服務類型（用於快速輸入模式）
function askForServiceType(message) {
    currentStep = 'ask_service_type';
    
    const questionHTML = `
        <div class="form-title">請選擇通報場域</div>
        <div style="margin-bottom: 20px; color: #666; font-size: 14px; line-height: 1.6;">
            您剛才輸入的是：「${message}」<br>
            請選擇這項通報的服務區域：
        </div>
        <div class="quick-replies" style="flex-direction: column; gap: 10px;">
            <button class="quick-reply-btn" onclick="setQuickInputService('office', '${message}')" 
                    style="width: 100%; text-align: center; justify-content: center;">
                辦公大樓
            </button>
            <button class="quick-reply-btn" onclick="setQuickInputService('shopping', '${message}')" 
                    style="width: 100%; text-align: center; justify-content: center;">
                購物中心
            </button>
            <button class="quick-reply-btn" onclick="setQuickInputService('observatory', '${message}')" 
                    style="width: 100%; text-align: center; justify-content: center;">
                觀景台
            </button>
        </div>
    `;
    
    addBotMessage(questionHTML);
}

// 設置快速輸入的服務類型
function setQuickInputService(serviceType, message) {
    currentService = serviceType;
    
    const serviceNames = {
        'office': '🏢 辦公大樓',
        'shopping': '🛍️ 購物中心',
        'observatory': '🏙️ 觀景台'
    };
    
    addUserMessage(serviceNames[serviceType]);
    
    if (autoDetectedService === serviceType && autoDetectedFloor) {
        selectedFloor = autoDetectedFloor;
        
        if (autoDetectedLocation) {
            let locationFound = false;
            let locations = [];
            
            if (serviceType === 'office') {
                locations = OFFICE_LOCATIONS;
            } else if (serviceType === 'shopping') {
                locations = MALL_LOCATIONS;
            } else if (serviceType === 'observatory') {
                locations = OBSERVATORY_LOCATIONS;
            }
            
            const foundLocation = locations.find(loc => 
                loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
            );
            
            if (foundLocation) {
                selectedLocation = foundLocation.id;
                customLocation = '';
                locationFound = true;
            }
            
            if (!locationFound && autoDetectedLocation) {
                selectedLocation = '';
                customLocation = autoDetectedLocation;
            }
        }
    }
    
    setTimeout(() => {
        askForPhoto();
    }, 500);
}

// 顯示快速輸入確認表單
function showQuickInputConfirmation(message, fromQR = false) {
    currentStep = 'quick_input_confirmation';
    
    if (fromQR && autoDetectedFloor) {
        selectedFloor = autoDetectedFloor;
        
        if (autoDetectedLocation) {
            let locationFound = false;
            let locations = [];
            
            if (currentService === 'office') {
                locations = OFFICE_LOCATIONS;
            } else if (currentService === 'shopping') {
                locations = MALL_LOCATIONS;
            } else if (currentService === 'observatory') {
                locations = OBSERVATORY_LOCATIONS;
            }
            
            const foundLocation = locations.find(loc => 
                loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
            );
            
            if (foundLocation) {
                selectedLocation = foundLocation.id;
                customLocation = '';
                locationFound = true;
            }
            
            if (!locationFound && autoDetectedLocation) {
                selectedLocation = '';
                customLocation = autoDetectedLocation;
            }
        }
    }
    
    setTimeout(() => {
        askForPhoto();
    }, 300);
}

// 聊天訊息功能
function addBotMessage(content) {
    const messageId = 'msg-' + Date.now();
    const messageHTML = `
        <div class="message bot-message" id="${messageId}">
            <div class="avatar bot-avatar">
                <img src="static/pic/avatar.png" alt="客服人員">
            </div>
            <div class="message-content-wrapper">
                <div class="message-content">${content}</div>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        </div>
    `;
    
    $('#chatContainer').append(messageHTML);
    chatMessages.push(messageHTML);
    scrollToBottom();
    
    return '#' + messageId;
}

function addUserMessage(content) {
    const messageId = 'msg-' + Date.now();
    const messageHTML = `
        <div class="message user-message" id="${messageId}">
            <div class="avatar user-avatar">
                <div class="avatar-placeholder">👤</div>
            </div>
            <div class="message-content-wrapper">
                <div class="message-content">${content}</div>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        </div>
    `;
    
    $('#chatContainer').append(messageHTML);
    chatMessages.push(messageHTML);
    scrollToBottom();
    
    return '#' + messageId;
}

// 發送訊息
function sendMessage() {
    const input = $('#messageInput');
    const message = input.val().trim();
    
    if (!message) return;
    
    if (!isInQuickInputProcess) {
        startQuickInputMode(message);
    } else {
        addUserMessage(message);
        input.val('');
        adjustTextareaHeight();
        
        handleUserInput(message);
    }
}

// 處理使用者輸入
function handleUserInput(message) {
    switch(currentStep) {
        case 'input_form':
            $('#descriptionInput').val(message);
            $('#descriptionInput').removeClass('placeholder-active');
            break;
        default:
    }
}

// 按鍵處理
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 調整textarea高度
function adjustTextareaHeight(textarea) {
    const input = textarea || $('#messageInput');
    if (input.length) {
        input.css('height', 'auto');
        const newHeight = Math.max(input[0].scrollHeight, 50);
        input.css('height', newHeight + 'px');
    }
}

// 滾動到底部
function scrollToBottom() {
    const container = $('#chatContainer')[0];
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// 獲取當前時間
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' +
           now.getMinutes().toString().padStart(2, '0');
}

// 查詢功能
// 查詢功能
function showHistoryModal() {
    $('#historyModal').show();
    $('#searchResults').empty();
    $('#caseSearch').val('').focus();
}

function closeModal() {
    $('#historyModal').hide();
    $('#imageModal').hide();
}

function searchCase() {
    const caseId = $('#caseSearch').val().trim();
    
    if (!caseId) {
        showToast('請輸入案件編號', 'warning');
        return;
    }
    
    // 檢查是否為4位數字
    if (!/^\d{4}$/.test(caseId)) {
        showToast('請輸入4位數字的案件編號', 'warning');
        return;
    }
    
    // 檢查數字範圍
    const caseNum = parseInt(caseId);
    if (caseNum < 1 || caseNum > 9999) {
        showToast('案件編號範圍為 0001-9999', 'warning');
        return;
    }
    
    $('#searchResults').html(`
        <div style="display: flex; justify-content: center; padding: 40px 0;">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `);
    
    // 修正查詢參數，使用正確的API格式
    $.ajax({
        url: API_CONFIG.QUERY_API,
        method: 'GET',
        dataType: 'text',
        data: {
            query: caseId  // 只傳送數字部分，如 9999
        },
        success: function(response) {
            console.log('查詢回應:', response);
            
            if (response && response !== 'none' && response !== '請提供案件編號') {
                const results = parseResponse(response, caseId);
                displaySearchResults(results);
            } else {
                showNoResults();
            }
        },
        error: function(xhr, status, error) {
            console.error('查詢失敗:', error, xhr.responseText);
            showNoResults();
        }
    });
}


// 解析API回應 - 修改案號顯示
function parseResponse(response, caseId) {
    try {
        console.log('原始回應:', response);
        
        // 格式：樓層+%+地點+%+描述+%+日期時間+%+狀態
        const parts = response.split('+%+');
        console.log('解析部分:', parts);
        
        if (parts.length >= 5) {
            // 處理日期時間格式
            let timeDisplay = parts[3] || '';
            
            // 如果時間部分為空或無效，只顯示日期
            if (!timeDisplay || timeDisplay.trim() === '') {
                // 嘗試從其他部分提取日期
                const dateMatch = response.match(/\d{4}\/\d{2}\/\d{2}/);
                if (dateMatch) {
                    timeDisplay = dateMatch[0];
                } else {
                    timeDisplay = '未記錄';
                }
            }
            
            // 處理狀態顯示
            let statusText = parts[4] || '進行中';
            if (statusText.includes('已完成') || statusText.includes('已處理')) {
                statusText = '已完成';
            } else {
                statusText = '進行中';
            }
            
            // 判斷完整案號
            let fullCaseId = '';
            const floorPart = parts[0] || '';
            
            // 根據樓層判斷服務類型
            if (floorPart.includes('F')) {
                const floorStr = floorPart.replace('F', '');
                if (floorStr.includes('B') || (parseInt(floorStr) >= 1 && parseInt(floorStr) <= 5)) {
                    fullCaseId = 'SC' + caseId; // 購物中心
                } else if (floorStr === '89' || floorStr === '91') {
                    fullCaseId = 'OB' + caseId; // 觀景台
                } else {
                    fullCaseId = 'WD' + caseId; // 辦公大樓
                }
            } else {
                fullCaseId = 'WD' + caseId; // 預設為辦公大樓
            }
            
            return [{
                id: fullCaseId,
                time: timeDisplay,
                location: parts[1] || '未記錄',
                floor: parts[0] || '未記錄',
                description: parts[2] || '未記錄',
                status: statusText
            }];
        }
        
        // 如果格式不對，嘗試其他解析方式
        if (response.includes('+%+')) {
            // 已有正確分隔符，但部分數不足
            return [{
                id: 'WD' + caseId,
                time: '未記錄',
                location: '未記錄',
                floor: '未記錄',
                description: '未記錄',
                status: '進行中'
            }];
        }
        
        return [];
    } catch (error) {
        console.error('解析回應失敗:', error);
        return [];
    }
}
function setupCaseSearchInput() {
    $('#caseSearch').on('input', function() {
        let value = $(this).val().trim();
        
        value = value.replace(/\D/g, '');
        
        if (value.length > 4) {
            value = value.substring(0, 4);
        }
        
        if (value) {
            const num = parseInt(value);
            if (num > 9999) {
                value = '9999';
            }
        }
        
        $(this).val(value);
    });
}

// 顯示查詢結果
function displaySearchResults(results) {
    if (!results || results.length === 0) {
        showNoResults();
        return;
    }
    
    const resultsHTML = results.map(caseItem => `
        <div class="case-card">
            <div class="case-header">
                <div class="case-id">${caseItem.id}</div>
            </div>
            <div class="case-details">
                <div class="case-detail-item">
                    <div class="detail-label">通報時間</div>
                    <div class="detail-value">${caseItem.time}</div>
                </div>
                <div class="case-detail-item">
                    <div class="detail-label">樓層</div>
                    <div class="detail-value">${caseItem.floor}</div>
                </div>
                <div class="case-detail-item">
                    <div class="detail-label">地點</div>
                    <div class="detail-value">${caseItem.location}</div>
                </div>
                <div class="case-detail-item">
                    <div class="detail-label">問題描述</div>
                    <div class="detail-value">${caseItem.description}</div>
                </div>
                <div class="case-detail-item">
                    <div class="detail-label">處理回復</div>
                    <div class="detail-value">
                        <span class="case-status ${caseItem.status === '已完成' ? 'status-completed' : 'status-processing'}">
                            ${caseItem.status}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    $('#searchResults').html(resultsHTML);
}

// 顯示無結果
function showNoResults() {
    $('#searchResults').html(`
        <div style="text-align: center; padding: 40px 20px; color: #868e96;">
            <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
            <div style="font-size: 16px; margin-bottom: 10px;">找不到相關案件紀錄</div>
            <div style="font-size: 14px;">請確認案件編號是否正確</div>
        </div>
    `);
}

// 顯示提示訊息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    
    const bgColor = type === 'warning' ? '#fff3cd' : 
                    type === 'success' ? '#d4edda' : '#d1ecf1';
    const textColor = type === 'warning' ? '#856404' : 
                     type === 'success' ? '#155724' : '#0c5460';
    
    toast.style.cssText = `
        position: fixed;
        top: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: ${textColor};
        padding: 14px 24px;
        border-radius: 25px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        z-index: 9999;
        font-size: 14px;
        font-weight: 500;
        border: 1px solid ${type === 'warning' ? '#ffeaa7' : type === 'success' ? '#c3e6cb' : '#bee5eb'};
        min-width: 200px;
        max-width: 90%;
        text-align: center;
        animation: toastSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    const keyframes = `
        @keyframes toastSlideIn {
            from { opacity: 0; transform: translate(-50%, -30px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = keyframes;
    document.head.appendChild(styleSheet);
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -30px)';
        setTimeout(() => {
            document.body.removeChild(toast);
            document.head.removeChild(styleSheet);
        }, 300);
    }, 3000);
}

// 防止模態框關閉時關閉整個對話
$('.modal').on('click', function(event) {
    if (event.target === this) {
        $(this).hide();
    }
});