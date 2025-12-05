// ==================== 配置區塊 ====================
const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbwKxZON3tIGAYVJAXqBEBOLEBaQlCdHgWevywV-phUOxED0fU_mmOtgaPlmc-cWGwwZ/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec',
    QUERY_API: 'https://script.google.com/macros/s/AKfycbxbrEj4dzTsbPlzfY7Swm-e9ob7k-BHOjtXTDIG_zkOLdm_MiKDLdDhILF2dnKf2H3Z/exec',
    SHEET_ID: '13ZSRv_AmB9_9TLgu8GdvpatH9sRo5IqhXA3Xo_qIpmo'
};
// ==================== 配置區塊結束 ====================

// 全域變數
let currentStep = 'welcome';
let currentService = ''; // office, shopping, observatory
let selectedFloor = '';
let selectedLocations = []; // 辦公大樓用，允許多選
let selectedLocation = ''; // 購物中心/觀景台用，單選地點ID
let customLocation = ''; // 購物中心/觀景台用，自訂地點
let problemDescription = '';
let uploadedFile = null;
let uploadedFilePreview = null;
let chatMessages = [];
let autoDetectedFloor = '';
let autoDetectedLocation = '';
let autoDetectedService = ''; // 新增：自動檢測的服務類型

// 辦公大樓地點選項
const OFFICE_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'public_corridor', label: '公共走道' },
    { id: 'public_elevator', label: '公共電梯' },
    { id: 'public_pantry', label: '公共茶水間' },
    { id: 'public_freight_lift', label: '公共貨梯廳' }
];

// 購物中心/觀景台地點選項
const MALL_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'nursing_room', label: '哺乳室' }
];

// 購物中心樓層選項
const SHOPPING_FLOORS = ['B1', '1', '2', '3', '4'];

// 觀景台樓層選項
const OBSERVATORY_FLOORS = ['89', '91'];

// 從URL獲取參數並解析服務類型
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    autoDetectedFloor = urlParams.get('floor') || '';
    autoDetectedLocation = urlParams.get('location') || '';
    
    // 重置服務類型判斷
    autoDetectedService = '';
    
    // 根據樓層判斷服務類型
    if (autoDetectedFloor) {
        // 處理樓層格式（去除可能的F後綴）
        let floorValue = autoDetectedFloor.replace('F', '').replace('f', '');
        
        if (SHOPPING_FLOORS.includes(floorValue)) {
            autoDetectedService = 'shopping';
        } else if (OBSERVATORY_FLOORS.includes(floorValue)) {
            autoDetectedService = 'observatory';
        } else {
            // 檢查是否為辦公大樓樓層（1-91，且不是B1）
            const floorNum = parseInt(floorValue);
            if (!isNaN(floorNum) && floorNum >= 1 && floorNum <= 91 && floorValue !== 'B1') {
                autoDetectedService = 'office';
            }
        }
        
        // 更新樓層值（保持一致性）
        autoDetectedFloor = floorValue;
    }
}

// 初始化應用
$(document).ready(function() {
    // 解析URL參數
    parseUrlParams();
    
    // 如果有自動檢測的服務類型，直接跳轉到該服務
    if (autoDetectedService) {
        initChatWithAutoDetectedService();
    } else {
        initChat();
    }
    
    // 調整textarea高度
    $('#messageInput').on('input', function() {
        adjustTextareaHeight();
    });
    
    // 初始滾動到底部
    setTimeout(scrollToBottom, 100);
});

// 帶有自動檢測服務的初始化
function initChatWithAutoDetectedService() {
    chatMessages = [];
    currentStep = 'welcome';
    
    // 清空聊天區域
    $('#chatContainer').empty();
    
    // 顯示歡迎訊息 - 根據偵測區域顯示不同的歡迎語
    setTimeout(() => {
        const serviceDisplayNames = {
            'office': '辦公大樓',
            'shopping': '購物中心', 
            'observatory': '觀景台'
        };
        
        const detectedArea = serviceDisplayNames[autoDetectedService] || '';
        
        if (detectedArea) {
            // 修改開頭語：💬 嗨～我是台北101智慧小幫手！🎉歡迎蒞臨+偵測區域
            addBotMessage(`💬 嗨～我是台北101智慧小幫手！🎉歡迎蒞臨${detectedArea}！`);
        } else {
            addBotMessage('💬 嗨～我是台北101智慧小幫手！🎉請選擇您所在的區域！');
        }
        
        // 自動選擇檢測到的服務
        setTimeout(() => {
            autoSelectService();
        }, 800);
    }, 500);
}

// 自動選擇服務
function autoSelectService() {
    const serviceNames = {
        'office': '🏢 辦公大樓',
        'shopping': '🛍️ 購物中心',
        'observatory': '🏙️ 觀景台'
    };
    
    if (autoDetectedService && serviceNames[autoDetectedService]) {
        // 不再顯示"系統自動為您選擇："訊息
        // 直接執行選擇服務，會在 selectService 函數中顯示用戶選擇的服務
        selectService(autoDetectedService);
    } else {
        // 如果無法自動選擇，顯示服務選項
        showServiceOptions();
    }
}
// 初始化聊天
// 初始化聊天
function initChat() {
    chatMessages = [];
    currentStep = 'welcome';
    currentService = '';
    selectedFloor = '';
    selectedLocations = [];
    selectedLocation = '';
    customLocation = '';
    problemDescription = '';
    uploadedFile = null;
    uploadedFilePreview = null;
    autoDetectedFloor = '';
    autoDetectedLocation = '';
    autoDetectedService = '';
    
    // 重新解析URL參數
    parseUrlParams();
    
    // 清空聊天區域
    $('#chatContainer').empty();
    
    // 顯示歡迎訊息
    setTimeout(() => {
        // 檢查是否有URL參數
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
            
            // 自動選擇檢測到的服務
            setTimeout(() => {
                selectService(autoDetectedService);
            }, 800);
        } else {
            addBotMessage('💬 嗨～我是台北101智慧小幫手！🎉請選擇您所在的區域！');
            showServiceOptions();
        }
    }, 500);
}
// 顯示服務選項
function showServiceOptions() {
    currentStep = 'select_service';
    
    // 如果有URL參數但未自動選擇（可能是參數不完整），保持當前狀態
    if (autoDetectedService) {
        // 不顯示服務卡片，直接選擇服務
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
    
    const cardsHTML = `
        <div class="service-cards" id="serviceCards">
            ${services.map(service => `
                <div class="service-card" onclick="selectService('${service.value}')"
                     data-service="${service.value}">
                    <div class="service-icon">${service.icon}</div>
                    <div class="service-title">${service.title}</div>
                    <div class="service-desc">${service.desc}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    addBotMessage(cardsHTML);
}

// 選擇服務類型
function selectService(serviceType) {
    // 如果之前已經選擇過服務（無論是否相同），都清除中間對話框
    if (currentService) {
        // 找到服務選擇卡片的位置
        const serviceIndex = chatMessages.findIndex(msg => msg.includes('service-cards'));
        if (serviceIndex > -1) {
            // 保留到服務選擇卡片之前的訊息（通常是歡迎訊息）
            chatMessages = chatMessages.slice(0, serviceIndex + 1);
        } else {
            // 如果找不到服務卡片，只保留歡迎訊息
            const welcomeIndex = chatMessages.findIndex(msg => msg.includes('台北101智慧小幫手'));
            if (welcomeIndex > -1) {
                chatMessages = chatMessages.slice(0, welcomeIndex + 1);
            } else {
                chatMessages = [];
            }
        }
        
        // 清空聊天容器
        $('#chatContainer').empty();
        
        // 重新添加保留的訊息
        $('#chatContainer').append(chatMessages.join(''));
        
        // 重置相關變數（如果切換到不同服務）
        if (currentService !== serviceType) {
            selectedFloor = '';
            selectedLocations = [];
            selectedLocation = '';
            customLocation = '';
            problemDescription = '';
            uploadedFile = null;
            uploadedFilePreview = null;
        }
    }
    
    currentService = serviceType;
    
    // 如果URL有帶入參數，且服務類型匹配，自動填入樓層和地點
    if (autoDetectedService === serviceType) {
        selectedFloor = autoDetectedFloor;
        
        // 購物中心和觀景台：判斷地點是快速選項還是自訂地點
        if (serviceType === 'shopping' || serviceType === 'observatory') {
            // 檢查是否為快速選擇地點
            const mallLocation = MALL_LOCATIONS.find(loc => 
                loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
            );
            
            if (mallLocation) {
                selectedLocation = mallLocation.id;
                customLocation = '';
            } else if (autoDetectedLocation) {
                // 否則作為自訂地點
                selectedLocation = '';
                customLocation = autoDetectedLocation;
            }
        }
        // 辦公大樓：判斷地點
        else if (serviceType === 'office' && autoDetectedLocation) {
            // 辦公大樓可以有多個地點，這裡假設只有一個
            const officeLocation = OFFICE_LOCATIONS.find(loc => 
                loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
            );
            if (officeLocation) {
                selectedLocations = [officeLocation.id];
            }
        }
    }
    
    // 更新卡片選中狀態（只在有服務卡片時）
    if ($('#serviceCards').length) {
        $('#serviceCards .service-card').removeClass('selected');
        $(`[data-service="${serviceType}"]`).addClass('selected');
    }
    
    // 顯示確認訊息
    const serviceNames = {
        'office': '🏢 辦公大樓',
        'shopping': '🛍️ 購物中心',
        'observatory': '🏙️ 觀景台'
    };
    
    // 不顯示"系統自動為您選擇："訊息
    // 只添加用戶選擇的服務
    addUserMessage(serviceNames[serviceType]);
    
    // 下一步：輸入樓層、地點和描述
    setTimeout(() => {
        askForFloorLocationDescription();
    }, 500);
}
// 詢問樓層、地點和描述
function askForFloorLocationDescription() {
    currentStep = 'input_floor_location_description';
    
    // 設定預設描述
    const defaultDescription = '請檢查、進行環境清潔';
    
    addBotMessage('請輸入通報資訊：');
    
    // 辦公大樓的表單（樓層數字輸入 + 複選地點 + 描述）
    if (currentService === 'office') {
        const formHTML = `
            <div class="form-group">
                <label class="form-label">樓層 <span>*</span></label>
                <input type="number" class="form-control" id="floorInput"
                       value="${selectedFloor || ''}"
                       placeholder="請輸入樓層數字 (1-91)"
                       min="1" max="91"
                       onfocus="handleFloorFocus()"
                       onblur="handleFloorBlur()"
                       oninput="handleFloorInput()">
                <div class="floor-limit-note">註：樓層範圍 1 ~ 91</div>
            </div>
            
            <div class="form-group">
                <label class="form-label">地點 <span>*</span></label>
                <div class="location-checkboxes" id="locationCheckboxes">
                    ${OFFICE_LOCATIONS.map(location => {
                        const isSelected = selectedLocations.includes(location.id);
                        return `
                            <div class="checkbox-group ${isSelected ? 'selected' : ''}" onclick="toggleOfficeLocation('${location.id}')">
                                <input type="checkbox" class="checkbox-input" id="cb_${location.id}" ${isSelected ? 'checked' : ''}>
                                <label class="checkbox-label" for="cb_${location.id}">${location.label}</label>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">問題描述</label>
                <textarea class="form-control" id="descriptionInput"
                          rows="3" placeholder="${defaultDescription}"
                          onfocus="handleDescriptionFocus()"
                          onblur="handleDescriptionBlur()"
                          oninput="handleDescriptionInput()">${problemDescription || ''}</textarea>
                <div class="floor-limit-note">如未輸入將使用預設描述</div>
            </div>
            
            <button class="quick-reply-btn" onclick="confirmFloorLocationDescription()"
                    style="background: #4a90e2; color: white; margin-top: 12px; width: 100%;">
                確認通報資訊
            </button>
        `;
        addBotMessage(formHTML);
    }
    // 購物中心和觀景台的表單（樓層選擇按鈕 + 單選地點 + 自訂地點 + 描述）
    else {
        // 顯示已選擇的樓層或提示文字
        let floorDisplayText = '請選擇樓層';
        if (selectedFloor) {
            // 確保樓層顯示格式正確
            if (selectedFloor.startsWith('B')) {
                floorDisplayText = `${selectedFloor}F`;
            } else {
                floorDisplayText = `${selectedFloor}F`;
            }
        }
        
        const formHTML = `
            <div class="form-group">
                <label class="form-label">樓層 <span>*</span></label>
                <button class="floor-select-btn" onclick="showFloorModal()" id="floorSelectBtn">
                    <div class="floor-display">
                        <span class="floor-value">${floorDisplayText}</span>
                        <span class="floor-arrow">▼</span>
                    </div>
                </button>
                <div class="floor-limit-note">
                    ${currentService === 'shopping' ? '購物中心樓層：B1, 1F, 2F, 3F, 4F' : '觀景台樓層：89F, 91F'}
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">地點 <span>*</span></label>
                <!-- 改為先顯示自訂地點輸入 -->
                <div class="form-label" style="margin-bottom: 5px; font-size: 14px;">請輸入地點：</div>
                <div class="custom-location-group ${customLocation ? 'selected' : ''}" 
                     onclick="focusCustomLocation()" id="customLocationGroup">
                    <div class="custom-location-icon">📍</div>
                    <input type="text" class="custom-location-input ${customLocation ? '' : 'placeholder-active'}" 
                           id="customLocationInput"
                           placeholder="請輸入地點"
                           value="${customLocation || ''}"
                           onfocus="handleCustomLocationFocus()"
                           onblur="handleCustomLocationBlur()"
                           oninput="handleCustomLocationInput()">
                </div>
                
                <div class="form-label" style="margin-top: 15px; margin-bottom: 5px; font-size: 14px;">或快速選擇地點：</div>
                <div class="location-checkboxes" id="locationCheckboxes" style="margin-bottom: 15px;">
                    ${MALL_LOCATIONS.map(location => {
                        const isSelected = selectedLocation === location.id;
                        return `
                            <div class="radio-group ${isSelected ? 'selected' : ''}" onclick="selectMallLocation('${location.id}')">
                                <input type="radio" class="radio-input" id="radio_${location.id}" name="mallLocation" ${isSelected ? 'checked' : ''}>
                                <label class="radio-label" for="radio_${location.id}">${location.label}</label>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">問題描述</label>
                <textarea class="form-control" id="descriptionInput"
                          rows="3" placeholder="${defaultDescription}"
                          onfocus="handleDescriptionFocus()"
                          onblur="handleDescriptionBlur()"
                          oninput="handleDescriptionInput()">${problemDescription || ''}</textarea>
                <div class="floor-limit-note">如未輸入將使用預設描述</div>
            </div>
            
            <button class="quick-reply-btn" onclick="confirmFloorLocationDescription()"
                    style="background: #4a90e2; color: white; margin-top: 12px; width: 100%;">
                確認通報資訊
            </button>
        `;
        addBotMessage(formHTML);
        
        // 如果URL有帶入參數，顯示提示訊息
        if (autoDetectedService === currentService && autoDetectedFloor) {
            setTimeout(() => {
                showToast(`已自動填入樓層：${selectedFloor}`, 'success');
                if (customLocation || selectedLocation) {
                    const locationText = customLocation || getLocationLabel(selectedLocation);
                    setTimeout(() => {
                        showToast(`已自動填入地點：${locationText}`, 'success');
                    }, 1000);
                }
            }, 300);
        }
    }
    
    // 初始化placeholder狀態
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

// 關閉樓層選擇模態框
function closeFloorModal() {
    $('#floorModal').hide();
}

// 辦公大樓：切換地點選擇
function toggleOfficeLocation(locationId) {
    const checkbox = $(`#cb_${locationId}`);
    const checkboxGroup = checkbox.closest('.checkbox-group');
    
    if (checkbox.prop('checked')) {
        checkbox.prop('checked', false);
        checkboxGroup.removeClass('selected');
        selectedLocations = selectedLocations.filter(id => id !== locationId);
    } else {
        checkbox.prop('checked', true);
        checkboxGroup.addClass('selected');
        selectedLocations.push(locationId);
    }
}

// 購物中心/觀景台：選擇地點（單選）
function selectMallLocation(locationId) {
    selectedLocation = locationId;
    customLocation = ''; // 清空自訂地點
    
    // 更新單選按鈕狀態
    $('.radio-group').removeClass('selected');
    $(`.radio-group input#radio_${locationId}`).prop('checked', true);
    $(`.radio-group input#radio_${locationId}`).closest('.radio-group').addClass('selected');
    
    // 清空自訂地點輸入框並移除選擇狀態
    $('#customLocationInput').val('');
    $('#customLocationInput').removeClass('placeholder-active');
    $('#customLocationGroup').removeClass('selected');
    
    // 顯示選中的地點
    showToast(`已選擇：${getLocationLabel(locationId)}`, 'success');
}

// 聚焦自訂地點輸入框
function focusCustomLocation() {
    $('#customLocationInput').focus();
}

// 處理自訂地點焦點事件
function handleCustomLocationFocus() {
    const customInput = $('#customLocationInput');
    const customGroup = $('#customLocationGroup');
    
    if (customInput.hasClass('placeholder-active')) {
        customInput.removeClass('placeholder-active');
        customInput.val('');
    }
    
    // 設置自訂地點組為選擇狀態
    customGroup.addClass('selected');
    
    // 清空單選按鈕選擇
    $('.radio-group').removeClass('selected');
    $('.radio-input').prop('checked', false);
    selectedLocation = '';
}

// 處理自訂地點失去焦點事件
function handleCustomLocationBlur() {
    const customInput = $('#customLocationInput');
    const customGroup = $('#customLocationGroup');
    
    if (!customInput.val().trim()) {
        customInput.addClass('placeholder-active');
        customInput.val('請輸入地點'); // 更新文字
        customGroup.removeClass('selected');
    }
}
// 處理自訂地點輸入事件
function handleCustomLocationInput() {
    const customInput = $('#customLocationInput');
    const customGroup = $('#customLocationGroup');
    
    if (customInput.val().trim()) {
        customInput.removeClass('placeholder-active');
        customLocation = customInput.val().trim();
        customGroup.addClass('selected');
        
        // 清空單選按鈕選擇
        $('.radio-group').removeClass('selected');
        $('.radio-input').prop('checked', false);
        selectedLocation = '';
    } else {
        customLocation = '';
        customGroup.removeClass('selected');
    }
}

// 獲取地點標籤
function getLocationLabel(locationId) {
    // 先檢查購物中心/觀景台地點
    const mallLocation = MALL_LOCATIONS.find(loc => loc.id === locationId);
    if (mallLocation) return mallLocation.label;
    
    // 再檢查辦公大樓地點
    const officeLocation = OFFICE_LOCATIONS.find(loc => loc.id === locationId);
    if (officeLocation) return officeLocation.label;
    
    return '未知地點';
}

// 在 initPlaceholderStates 函數中更新自訂地點的 placeholder
function initPlaceholderStates() {
    const floorInput = $('#floorInput');
    const descriptionInput = $('#descriptionInput');
    const customLocationInput = $('#customLocationInput');
    
    // 辦公大樓樓層輸入框
    if (currentService === 'office' && floorInput && !floorInput.val().trim()) {
        floorInput.addClass('placeholder-active');
        floorInput.val('請輸入樓層數字 (1-91)');
    }
    
    // 描述輸入框 - 如果沒有值，設置預設值placeholder
    if (descriptionInput && !descriptionInput.val().trim()) {
        descriptionInput.addClass('placeholder-active');
        descriptionInput.val('請檢查、進行環境清潔');
        
        // 確保描述框高度
        setTimeout(() => {
            adjustTextareaHeight(descriptionInput);
        }, 100);
    }
    
    // 自訂地點輸入框 - 修改 placeholder 文字
    if (currentService !== 'office' && customLocationInput && !customLocationInput.val().trim()) {
        customLocationInput.addClass('placeholder-active');
        customLocationInput.val('請輸入地點');
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

// 處理樓層輸入框失去焦點事件
function handleFloorBlur() {
    const floorInput = $('#floorInput');
    if (!floorInput.val().trim()) {
        floorInput.addClass('placeholder-active');
        floorInput.val('請輸入樓層數字 (1-91)');
    }
}

// 處理樓層輸入事件
function handleFloorInput() {
    const floorInput = $('#floorInput');
    const floorValue = floorInput.val().trim();
    
    if (floorValue && !floorInput.hasClass('placeholder-active')) {
        floorInput.removeClass('placeholder-active');
        
        // 驗證樓層範圍
        if (floorValue) {
            const floorNum = parseInt(floorValue);
            if (floorNum < 1 || floorNum > 91) {
                showToast('樓層範圍為 1 ~ 91', 'warning');
            }
        }
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

// 在 handleDescriptionInput 函數中也調用高度調整
function handleDescriptionInput() {
    const descriptionInput = $('#descriptionInput');
    if (descriptionInput.val().trim()) {
        descriptionInput.removeClass('placeholder-active');
    }
    
    // 調整高度
    adjustTextareaHeight(descriptionInput);
}

// 確認樓層、地點和描述
function confirmFloorLocationDescription() {
    const floorInput = $('#floorInput');
    const descriptionInput = $('#descriptionInput');
    const customLocationInput = $('#customLocationInput');
   
    // 辦公大樓：獲取樓層值
    if (currentService === 'office') {
        let floorValue = '';
        if (!floorInput.hasClass('placeholder-active') && floorInput.val().trim()) {
            floorValue = floorInput.val().trim();
        }
        
        // 驗證樓層
        if (floorValue) {
            const floorNum = parseInt(floorValue);
            if (isNaN(floorNum) || floorNum < 1 || floorNum > 91) {
                showToast('請輸入有效的樓層 (1 ~ 91)', 'warning');
                return;
            }
            selectedFloor = floorNum.toString();
        }
    }
   
    // 驗證樓層是否已選擇（所有服務類型）
    if (!selectedFloor) {
        showToast('請選擇樓層', 'warning');
        return;
    }
   
    // 處理描述：如果用戶沒有輸入，則使用預設值
    if (descriptionInput.hasClass('placeholder-active') || !descriptionInput.val().trim()) {
        problemDescription = '請檢查、進行環境清潔';
    } else {
        problemDescription = descriptionInput.val().trim();
    }
    
    // 處理購物中心/觀景台的自訂地點
    if (currentService !== 'office') {
        if (customLocationInput && !customLocationInput.hasClass('placeholder-active') && customLocationInput.val().trim()) {
            customLocation = customLocationInput.val().trim();
        }
    }
   
    // 驗證必填欄位
    if (currentService === 'office') {
        // 辦公大樓：驗證至少選擇一個地點
        if (selectedLocations.length === 0) {
            showToast('請至少選擇一個地點', 'warning');
            return;
        }
    } else {
        // 購物中心/觀景台：驗證已選擇地點或輸入自訂地點
        if (!selectedLocation && !customLocation) {
            showToast('請選擇或輸入地點', 'warning');
            return;
        }
    }
   
    // 顯示摘要
    let summary = '';
    const displayFloor = selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
    summary += `📍 ${displayFloor}<br>`;
    
    if (currentService === 'office') {
        const locationLabels = selectedLocations.map(id => 
            OFFICE_LOCATIONS.find(loc => loc.id === id)?.label || id
        ).join('、');
        summary += `📍 ${locationLabels}<br>`;
    } else {
        if (selectedLocation) {
            summary += `📍 ${getLocationLabel(selectedLocation)}<br>`;
        } else if (customLocation) {
            summary += `📍 ${customLocation}<br>`;
        }
    }
    
    summary += `📝 ${problemDescription}`;
   
    addUserMessage(summary);
   
    setTimeout(() => {
        askForPhoto();
    }, 500);
}

// 詢問照片
function askForPhoto() {
    currentStep = 'input_photo';
   
    addBotMessage('📷 是否需要上傳照片輔助說明？（非必要）');
   
    const photoHTML = `
        <div class="upload-area" onclick="$('#fileInput').click()" id="uploadArea">
            <div class="upload-icon">📷</div>
            <div style="font-weight: 600; margin-bottom: 8px; color: #2d3436;">點擊上傳照片</div>
            <div style="font-size: 13px; color: #868e96;">支援 JPG、PNG 格式，最大 5MB</div>
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
   
    // 檢查檔案類型
    if (!file.type.match('image.*')) {
        showToast('請選擇圖片檔案', 'warning');
        return;
    }
   
    // 檢查檔案大小
    if (file.size > 5 * 1024 * 1024) {
        showToast('圖片大小不能超過 5MB', 'warning');
        return;
    }
   
    uploadedFile = file;
   
    // 顯示預覽
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedFilePreview = e.target.result;
        $('#previewImage').attr('src', e.target.result).show();
        $('#uploadArea').hide();
        showToast('照片已選擇，點擊圖片可預覽', 'success');
       
        // 動態添加確認上傳按鈕
        const quickReplies = $('.quick-replies').last();
        if (!quickReplies.find('.quick-reply-btn[onclick="confirmPhoto()"]').length) {
            const confirmBtn = $('<button class="quick-reply-btn" onclick="confirmPhoto()" style="background: #4a90e2; color: white;">確認上傳</button>');
            quickReplies.append(confirmBtn);
        }
    };
    reader.readAsDataURL(file);
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

// 跳過照片上傳
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
function showConfirmation() {
    currentStep = 'confirmation';
   
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
   
    addBotMessage('請確認通報資訊：');
   
    let locationsText = '';
    if (currentService === 'office') {
        const locationLabels = selectedLocations.map(id => 
            OFFICE_LOCATIONS.find(loc => loc.id === id)?.label || id
        ).join('、');
        locationsText = locationLabels;
    } else {
        if (selectedLocation) {
            locationsText = getLocationLabel(selectedLocation);
        } else if (customLocation) {
            locationsText = customLocation;
        }
    }
    
    // 格式化樓層顯示
    const displayFloor = selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
   
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
                    <div class="detail-value">${locationsText}</div>
                </div>
                <div class="case-detail-item">
                    <div class="detail-label">問題描述</div>
                    <div class="detail-value">${problemDescription}</div>
                </div>
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

// 修改資訊
function editInformation() {
    // 儲存當前輸入的值，以便重新填入
    const savedFloor = selectedFloor;
    const savedLocations = [...selectedLocations];
    const savedMallLocation = selectedLocation;
    const savedCustomLocation = customLocation;
    const savedDescription = problemDescription;
    const savedService = currentService;
    
    // 清除當前聊天訊息，保留到服務選擇之前
    const serviceIndex = chatMessages.findIndex(msg => msg.includes('service-cards') || msg.includes('歡迎蒞臨'));
    if (serviceIndex > -1) {
        chatMessages = chatMessages.slice(0, serviceIndex + 1);
    } else {
        chatMessages = [];
    }
    
    $('#chatContainer').empty().append(chatMessages.join(''));
    
    // 重新設置全局變數
    selectedFloor = savedFloor;
    selectedLocations = savedLocations;
    selectedLocation = savedMallLocation;
    customLocation = savedCustomLocation;
    problemDescription = savedDescription;
    currentService = savedService;
    
    // 重新顯示表單
    askForFloorLocationDescription();
}

// 提交通報
function submitReport() {
    // 顯示載入中
    const loadingId = 'loading-' + Date.now();
    addBotMessage(`<div id="${loadingId}" class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`);
   
    // 生成案件編號
    let caseNumber;
    if (currentService === 'office') {
        caseNumber = 'WD' + (Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000);
    } else {
        caseNumber = (currentService === 'shopping' ? 'SC' : 'OB') + 
                    (Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000);
    }
    
    const today = new Date();
    const reportDate = today.getFullYear() + '/' +
                       String(today.getMonth() + 1).padStart(2, '0') + '/' +
                       String(today.getDate()).padStart(2, '0');
    const reportTime = String(today.getHours()).padStart(2, '0') + ':' +
                       String(today.getMinutes()).padStart(2, '0');
   
    // 準備LINE訊息
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    let locationText;
    if (currentService === 'office') {
        const locationLabels = selectedLocations.map(id => 
            OFFICE_LOCATIONS.find(loc => loc.id === id)?.label || id
        ).join('、');
        locationText = locationLabels;
    } else {
        if (selectedLocation) {
            locationText = getLocationLabel(selectedLocation);
        } else if (customLocation) {
            locationText = customLocation;
        }
    }
    
    // 格式化樓層顯示
    const displayFloor = selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
   
    const lineMessage = `【${serviceNames[currentService]}通知】\n📍 樓層：${displayFloor}\n📍 地點：${locationText}\n📝 描述：${problemDescription}\n🆔 案號：${caseNumber}`;
   
    // 如果有照片，先上傳照片
    if (uploadedFile) {
        compressAndUploadImage().then(imageId => {
            if (imageId) {
                sendToGoogleAppsScript(lineMessage, imageId, caseNumber, reportDate, reportTime, locationText);
            } else {
                sendToGoogleAppsScript(lineMessage, 'none', caseNumber, reportDate, reportTime, locationText);
            }
        }).catch(error => {
            console.error('照片上傳失敗:', error);
            sendToGoogleAppsScript(lineMessage, 'none', caseNumber, reportDate, reportTime, locationText);
        });
    } else {
        sendToGoogleAppsScript(lineMessage, 'none', caseNumber, reportDate, reportTime, locationText);
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
            const maxWidth = 800;
            const maxHeight = 800;
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
           
            const base64Data = canvas.toDataURL('image/jpeg', 0.8);
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

// 發送到Google Apps Script
function sendToGoogleAppsScript(lineMessage, imageId, caseNumber, reportDate, reportTime, locationText) {
    // 移除載入訊息
    $('.typing-indicator').last().remove();
    
    // 服務類型文字
    const serviceTypeText = currentService === 'office' ? '辦公大樓' : 
                          currentService === 'shopping' ? '購物中心' : '觀景台';
    
    // 格式化樓層數字（去除F）
    const floorNumber = selectedFloor.replace('F', '');
   
    // 1. 發送POST請求（發送LINE通知）
    $.ajax({
        url: API_CONFIG.MAIN_API,
        method: 'POST',
        data: {
            msg: lineMessage,
            pic: imageId || "none"
        },
        success: function(response) {
            console.log('LINE通知發送成功:', response);
        },
        error: function(error) {
            console.error('LINE通知發送失敗:', error);
        },
        complete: function() {
            // 2. 發送GET請求儲存到Google Sheets
            $.ajax({
                url: API_CONFIG.MAIN_API,
                method: 'GET',
                data: {
                    case_number: caseNumber,
                    report_date: reportDate,
                    report_time: reportTime,
                    service_type: serviceTypeText,
                    floor: floorNumber,
                    location: locationText,
                    description: problemDescription,
                    status: '進行中',
                    photo_id: imageId || ''
                },
                success: function(response) {
                    console.log('Google Sheets儲存成功:', response);
                    showSuccessPage(caseNumber, `${reportDate} ${reportTime}`);
                },
                error: function(error) {
                    console.error('Google Sheets儲存失敗:', error);
                    showSuccessPage(caseNumber, `${reportDate} ${reportTime}`);
                }
            });
        }
    });
}

// 顯示成功頁面
function showSuccessPage(caseNumber, dateTime) {
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
   
    const successHTML = `
        <div class="success-container">
            <div class="success-icon">
                <img src="static/pic/success.png" alt="成功圖示">
            </div>
            <div class="success-title">通報成功！</div>
            <div style="color: #666; margin-bottom: 20px; line-height: 1.6; font-size: 15px;">
                感謝您的通報，我們會盡快處理<br>
                ${serviceNames[currentService]}通報已完成
            </div>
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
   
    addUserMessage(message);
    input.val('');
    adjustTextareaHeight();
   
    handleUserInput(message);
}

// 處理使用者輸入
function handleUserInput(message) {
    // 目前僅用於輸入描述
    switch(currentStep) {
        case 'input_floor_location_description':
            $('#descriptionInput').val(message);
            $('#descriptionInput').removeClass('placeholder-active');
            break;
        default:
            setTimeout(() => {
                addBotMessage('請從上方選項中選擇服務類型');
            }, 500);
    }
}

// 按鍵處理
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 專為描述框調整高度的函數
function adjustTextareaHeight(textarea) {
    if (textarea.length) {
        textarea.css('height', 'auto');
        const newHeight = Math.max(textarea[0].scrollHeight, 120);
        textarea.css('height', newHeight + 'px');
    }
}

// 滾動到底部
function scrollToBottom() {
    const container = $('#chatContainer')[0];
    container.scrollTop = container.scrollHeight;
}

// 獲取當前時間
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' +
           now.getMinutes().toString().padStart(2, '0');
}

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
    const caseId = $('#caseSearch').val().trim().toUpperCase();
    
    if (!caseId) {
        showToast('請輸入案件編號', 'warning');
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
    
    $.ajax({
        url: API_CONFIG.QUERY_API,
        method: 'GET',
        data: {
            query: caseId,
            sheetUrl: `https://docs.google.com/spreadsheets/d/${API_CONFIG.SHEET_ID}/edit`,
            sheetTag: '通報紀錄'
        },
        success: function(response) {
            if (response && response !== 'none') {
                const results = parseResponse(response, caseId);
                displaySearchResults(results);
            } else {
                showNoResults();
            }
        },
        error: function(error) {
            console.error('查詢失敗:', error);
            showNoResults();
        }
    });
}

// 解析API回應
function parseResponse(response, caseId) {
    try {
        const parts = response.split('+%+');
       
        if (parts.length >= 5) {
            return [{
                id: caseId,
                time: parts[4] || '未記錄',
                location: parts[0] || '未記錄',
                service: parts[3] || '未分類',
                description: parts[1] || '未記錄',
                status: parts[2] || '進行中'
            }];
        }
        return [];
    } catch (error) {
        console.error('解析回應失敗:', error);
        return [];
    }
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
                <span class="case-status ${caseItem.status === '已完成' ? 'status-completed' : 'status-processing'}">
                    ${caseItem.status}
                </span>
            </div>
            <div class="case-details">
                <div class="case-detail-item">
                    <div class="detail-label">通報時間</div>
                    <div class="detail-value">${caseItem.time}</div>
                </div>
                <div class="case-detail-item">
                    <div class="detail-label">服務類型</div>
                    <div class="detail-value">${caseItem.service}</div>
                </div>
                <div class="case-detail-item">
                    <div class="detail-label">通報地點</div>
                    <div class="detail-value">${caseItem.location}</div>
                </div>
                <div class="case-detail-item">
                    <div class="detail-label">問題描述</div>
                    <div class="detail-value">${caseItem.description}</div>
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
    toast.style.cssText = `
        position: fixed;
        top: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'warning' ? '#fff3cd' : type === 'success' ? '#d4edda' : '#d1ecf1'};
        color: ${type === 'warning' ? '#856404' : type === 'success' ? '#155724' : '#0c5460'};
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
        closeModal();
    }
});