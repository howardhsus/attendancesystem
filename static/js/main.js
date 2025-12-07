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
let currentService = '';
let selectedFloor = '';
let selectedLocations = [];
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
    
    autoDetectedService = '';
    
    if (autoDetectedFloor) {
        let floorValue = autoDetectedFloor.replace('F', '').replace('f', '');
        
        if (SHOPPING_FLOORS.includes(floorValue)) {
            autoDetectedService = 'shopping';
        } else if (OBSERVATORY_FLOORS.includes(floorValue)) {
            autoDetectedService = 'observatory';
        } else {
            const floorNum = parseInt(floorValue);
            if (!isNaN(floorNum) && floorNum >= 1 && floorNum <= 91 && floorValue !== 'B1') {
                autoDetectedService = 'office';
            }
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
    isQuickInputMode = false;
    isInQuickInputProcess = false;
    autoDetectedFloor = '';
    autoDetectedLocation = '';
    autoDetectedService = '';
    
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
            selectedLocations = [];
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
    // 修改：移除自動填入的提示訊息
    if (autoDetectedService === serviceType) {
        selectedFloor = autoDetectedFloor;
        
        if (serviceType === 'shopping' || serviceType === 'observatory') {
            const mallLocation = MALL_LOCATIONS.find(loc => 
                loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
            );
            
            if (mallLocation) {
                selectedLocation = mallLocation.id;
                customLocation = '';
            } else if (autoDetectedLocation) {
                selectedLocation = '';
                customLocation = autoDetectedLocation;
            }
        } else if (serviceType === 'office' && autoDetectedLocation) {
            const officeLocation = OFFICE_LOCATIONS.find(loc => 
                loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
            );
            if (officeLocation) {
                selectedLocations = [officeLocation.id];
            }
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
        const formHTML = `
            <div class="form-title">${formTitle}</div>
            
            <div class="form-group">
                <label class="form-label">樓層 <span>*</span></label>
                <input type="number" class="form-control" id="floorInput"
                       value="${selectedFloor || ''}"
                       placeholder="請輸入樓層數字"
                       min="1" max="91"
                       onfocus="handleFloorFocus()"
                       onblur="handleOfficeFloorBlur()"
                       oninput="handleOfficeFloorInput()">
            </div>
            
            <div class="form-group">
                <label class="form-label">地點 <span>*</span></label>
                <div class="location-checkboxes" id="locationCheckboxes">
                    ${OFFICE_LOCATIONS.map(location => {
                        const isSelected = Array.isArray(selectedLocations) && 
                                          selectedLocations.includes(location.id);
                        return `
                            <div class="checkbox-group">
                                <input type="checkbox" class="checkbox-input" 
                                       id="cb_${location.id}" 
                                       ${isSelected ? 'checked' : ''}
                                       onclick="toggleOfficeLocation('${location.id}', event)">
                                <label class="checkbox-label" for="cb_${location.id}">
                                    ${location.label}
                                </label>
                            </div>
                        `;
                    }).join('')}
                </div>
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
        let floorDisplayText = '請選擇樓層';
        if (selectedFloor) {
            if (selectedFloor.startsWith('B')) {
                floorDisplayText = `${selectedFloor}F`;
            } else {
                floorDisplayText = `${selectedFloor}F`;
            }
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
                <!-- 自訂地點輸入 -->
                <div class="custom-location-group ${customLocation ? 'selected' : ''}" 
                     onclick="focusCustomLocation()" id="customLocationGroup">
                    <div class="custom-location-icon">📍</div>
                    <input type="text" class="custom-location-input ${customLocation ? '' : 'placeholder-active'}" 
                           id="customLocationInput"
                           placeholder="輸入地點"
                           value="${customLocation || ''}"
                           onfocus="handleCustomLocationFocus()"
                           onblur="handleCustomLocationBlur()"
                           oninput="handleCustomLocationInput()">
                </div>
                
                <div style="margin-top: 10px; margin-bottom: 5px; font-size: 14px; color: #666;">快速選擇：</div>
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
        
        // 修改：移除自動填入提示訊息
        // 原本的提示訊息程式碼已移除
    }
    
    setTimeout(() => {
        initPlaceholderStates();
    }, 100);
}
// 辦公大樓樓層輸入限制
function handleOfficeFloorInput() {
    const floorInput = $('#floorInput');
    let floorValue = floorInput.val().trim();
    
    if (floorValue) {
        let floorNum = parseInt(floorValue);
        if (isNaN(floorNum)) {
            floorInput.val('');
        } else if (floorNum > 91) {
            floorInput.val('91');
            showToast('樓層已自動調整為91', 'warning');
        } else if (floorNum < 1) {
            floorInput.val('1');
            showToast('樓層已自動調整為1', 'warning');
        }
    }
}

// 辦公大樓樓層失去焦點處理
function handleOfficeFloorBlur() {
    const floorInput = $('#floorInput');
    let floorValue = floorInput.val().trim();
    
    if (!floorValue) {
        floorInput.addClass('placeholder-active');
        floorInput.val('請輸入樓層數字');
    } else {
        let floorNum = parseInt(floorValue);
        if (floorNum > 91) {
            floorInput.val('91');
            showToast('樓層已自動調整為91', 'warning');
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
    const customLocationInput = $('#customLocationInput');
    
    // 辦公大樓樓層輸入框
    if (currentService === 'office' && floorInput && !floorInput.val().trim()) {
        floorInput.addClass('placeholder-active');
        floorInput.val('請輸入樓層數字');
    }
    
    // 描述輸入框 - 如果沒有值，設置預設值
    if (descriptionInput && !descriptionInput.val().trim()) {
        descriptionInput.addClass('placeholder-active');
        descriptionInput.val('請檢查、進行環境清潔'); // 改回預設值
        
        // 確保描述框高度
        setTimeout(() => {
            adjustTextareaHeight(descriptionInput);
        }, 100);
    }
    
    // 自訂地點輸入框
    if (currentService !== 'office' && customLocationInput && !customLocationInput.val().trim()) {
        customLocationInput.addClass('placeholder-active');
        customLocationInput.val('輸入地點');
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
        descriptionInput.val(''); // 清空以便用戶輸入
    }
}

// 處理描述輸入框失去焦點事件
function handleDescriptionBlur() {
    const descriptionInput = $('#descriptionInput');
    if (!descriptionInput.val().trim()) {
        descriptionInput.addClass('placeholder-active');
        descriptionInput.val('請檢查、進行環境清潔'); // 改回預設值
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

// 辦公大樓：切換地點選擇 - 修正版本
function toggleOfficeLocation(locationId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const checkbox = $(`#cb_${locationId}`);
    const isChecked = checkbox.prop('checked');
    const checkboxGroup = checkbox.closest('.checkbox-group');
    
    // 更新樣式
    if (isChecked) {
        checkboxGroup.addClass('selected');
        if (!selectedLocations.includes(locationId)) {
            selectedLocations.push(locationId);
        }
    } else {
        checkboxGroup.removeClass('selected');
        selectedLocations = selectedLocations.filter(id => id !== locationId);
    }
    
    // 確保陣列沒有重複
    selectedLocations = [...new Set(selectedLocations)];
}

// 購物中心/觀景台：選擇地點（單選）
function selectMallLocation(locationId) {
    selectedLocation = locationId;
    customLocation = '';
    
    $('.radio-group').removeClass('selected');
    $(`.radio-group input#radio_${locationId}`).prop('checked', true);
    $(`.radio-group input#radio_${locationId}`).closest('.radio-group').addClass('selected');
    
    $('#customLocationInput').val('');
    $('#customLocationInput').removeClass('placeholder-active');
    $('#customLocationGroup').removeClass('selected');
    
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
        customInput.val('輸入地點');
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

// 確認表單 - 修正地點顯示
function confirmForm() {
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
    
    // 處理描述：如果用戶沒有輸入或刪除輸入內容，則使用預設值
    if (descriptionInput.hasClass('placeholder-active') || !descriptionInput.val().trim() || descriptionInput.val().trim() === '請檢查、進行環境清潔') {
        problemDescription = '請檢查、進行環境清潔'; // 使用預設值
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
        
        // 移除重複的地點（安全檢查）
        selectedLocations = [...new Set(selectedLocations)];
    } else {
        // 購物中心/觀景台：驗證已選擇地點或輸入自訂地點
        if (!selectedLocation && !customLocation) {
            showToast('請選擇或輸入地點', 'warning');
            return;
        }
    }
    
    // 顯示摘要 - 修正地點顯示
    let summary = '';
    const displayFloor = selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
    summary += `📍 ${displayFloor}<br>`;
    
    if (currentService === 'office') {
        // 過濾重複的地點並轉換為標籤
        const uniqueLocations = [...new Set(selectedLocations)];
        const locationLabels = uniqueLocations.map(id => 
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
    
    // 修改：根據是否為快速輸入模式顯示不同訊息
    let photoMessage = '';
    if (isQuickInputMode && problemDescription) {
        photoMessage = `您剛才輸入的是：「${problemDescription}」<br>是否需要上傳照片輔助說明？（非必要）`;
    } else {
        photoMessage = '📷 是否需要上傳照片輔助說明？（非必要）';
    }
    
    addBotMessage(photoMessage);
    
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
    
    // 顯示載入中
    showToast('正在處理圖片...', 'info');
    
    // 使用 Canvas 進行圖片壓縮
    compressImage(file).then(compressedFile => {
        uploadedFile = compressedFile;
        
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
        reader.readAsDataURL(compressedFile);
    }).catch(error => {
        console.error('圖片壓縮失敗:', error);
        showToast('圖片處理失敗，請重試', 'warning');
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

// 跳過照片上傳
function skipPhoto() {
    uploadedFile = null;
    addUserMessage('📷 不上傳照片');
    
    setTimeout(() => {
        showConfirmation();
    }, 500);
}
function compressImage(file) {
    return new Promise((resolve, reject) => {
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
            
            // 計算壓縮比例
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
            
            // 填充白色背景（避免透明背景問題）
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            
            // 繪製圖片
            ctx.drawImage(img, 0, 0, width, height);
            
            // 根據檔案大小決定壓縮品質
            let quality = 0.8; // 預設品質
            if (file.size > 2 * 1024 * 1024) { // 大於2MB
                quality = 0.7;
            } else if (file.size > 1 * 1024 * 1024) { // 1-2MB
                quality = 0.75;
            } else if (file.size < 100 * 1024) { // 小於100KB
                quality = 0.9; // 小檔案不需過度壓縮
            }
            
            // 轉換為 Blob
            canvas.toBlob(
                blob => {
                    if (blob) {
                        // 創建新的 File 物件
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
    
    // 快速輸入模式
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
        
        // 如果有QR URL帶入的地點和樓層，則顯示這些資訊
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

// 修改資訊
function editInformation() {
    // 儲存當前輸入的值，以便重新填入
    const savedFloor = selectedFloor;
    const savedLocations = [...selectedLocations];
    const savedMallLocation = selectedLocation;
    const savedCustomLocation = customLocation;
    const savedDescription = problemDescription;
    const savedService = currentService;
    const savedIsQuickInputMode = isQuickInputMode;
    
    // 清除當前聊天訊息，保留到服務選擇之前
    const serviceIndex = chatMessages.findIndex(msg => msg.includes('service-buttons') || msg.includes('歡迎蒞臨'));
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
    isQuickInputMode = savedIsQuickInputMode;
    
    // 根據模式重新顯示表單
    if (isQuickInputMode) {
        initChat();
        return;
    } else {
        // 正常模式：重新顯示通報表單
        showReportForm();
    }
}

// 提交通報
// 提交通報 - 修正版本
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
    
    // 準備資料
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
        
        floorText = selectedFloor.startsWith('B') ? `${selectedFloor}F` : `${selectedFloor}F`;
    }
    
    const serviceTypeText = serviceNames[currentService] || '快速輸入';
    
    // LINE通知訊息
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
    
    // 準備發送到 Google Apps Script 的資料
    const formData = {
        case_number: caseNumber,
        report_date: reportDate,
        report_time: reportTime,
        service_type: serviceTypeText,
        floor: floorText || (autoDetectedFloor ? autoDetectedFloor : '快速輸入'),
        location: locationText || (autoDetectedLocation ? autoDetectedLocation : '快速輸入'),
        description: problemDescription || '',
        status: '進行中',
        photo_id: '',
        msg: lineMessage  // 新增：LINE 訊息內容
    };
    
    // 如果有照片，先上傳照片
    if (uploadedFile) {
        compressAndUploadImage().then(imageId => {
            if (imageId) {
                formData.photo_id = imageId;
                formData.msg = `${lineMessage}\n📷 已附照片`;
                sendToGoogleAppsScript(formData);
            } else {
                sendToGoogleAppsScript(formData);
            }
        }).catch(error => {
            console.error('照片上傳失敗:', error);
            sendToGoogleAppsScript(formData);
        });
    } else {
        sendToGoogleAppsScript(formData);
    }
}

// 發送到Google Apps Script - 修正版本
function sendToGoogleAppsScript(formData) {
    // 移除載入訊息
    $('.typing-indicator').last().remove();
    
    // 使用 POST 方式發送單一請求
    $.ajax({
        url: API_CONFIG.MAIN_API,
        method: 'POST',
        data: JSON.stringify(formData),
        contentType: 'application/json',
        success: function(response) {
            console.log('通報成功:', response);
            showSuccessPage(formData.case_number, `${formData.report_date} ${formData.report_time}`);
        },
        error: function(error) {
            console.error('通報失敗:', error);
            // 即使失敗也顯示成功頁面（可能只是通知沒發送）
            showSuccessPage(formData.case_number, `${formData.report_date} ${formData.report_time}`);
        }
    });
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

// 發送到Google Apps Script - 使用 GET 方式（Google Apps Script 最穩定）
function sendToGoogleAppsScript(formData) {
    // 移除載入訊息
    $('.typing-indicator').last().remove();
    
    // 構建 URL 參數（使用 GET 方式最穩定）
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
            
            // 檢查是否有 case_number
            var caseNumber = (response && response.case_number) ? response.case_number : formData.case_number;
            var dateTime = formData.report_date + ' ' + formData.report_time;
            
            showSuccessPage(caseNumber, dateTime);
        },
        error: function(xhr, status, error) {
            console.error('通報失敗:', error);
            // 即使 API 錯誤，也顯示成功頁面（可能只是通知沒發送）
            showSuccessPage(formData.case_number, `${formData.report_date} ${formData.report_time}`);
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
                ${serviceNames[currentService] || '快速輸入'}通報已完成
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

// 發送訊息（任何時候都可以觸發快速輸入模式）
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
    selectedLocations = [];
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

// 詢問服務類型（用於快速輸入模式）- 使用不同的按鈕樣式
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
    
    // 顯示選擇的服務
    const serviceNames = {
        'office': '🏢 辦公大樓',
        'shopping': '🛍️ 購物中心',
        'observatory': '🏙️ 觀景台'
    };
    
    addUserMessage(serviceNames[serviceType]);
    
    // 如果從QR URL有地點和樓層，設置相應變數
    if (autoDetectedService === serviceType && autoDetectedFloor) {
        selectedFloor = autoDetectedFloor;
        
        // 處理地點
        if (autoDetectedLocation) {
            // 檢查是否為快速選擇地點
            const mallLocation = MALL_LOCATIONS.find(loc => 
                loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
            );
            
            if (mallLocation) {
                selectedLocation = mallLocation.id;
                customLocation = '';
            } else {
                // 作為自訂地點
                selectedLocation = '';
                customLocation = autoDetectedLocation;
            }
        }
    }
    
    // 直接進入照片上傳步驟
    setTimeout(() => {
        askForPhoto();
    }, 500);
}

// 顯示快速輸入確認表單（直接跳過，進入照片上傳）
function showQuickInputConfirmation(message, fromQR = false) {
    currentStep = 'quick_input_confirmation';
    
    // 如果從QR URL有地點和樓層，設置相應變數
    if (fromQR && autoDetectedFloor) {
        selectedFloor = autoDetectedFloor;
        
        // 處理地點
        if (autoDetectedLocation) {
            // 檢查是否為快速選擇地點
            const mallLocation = MALL_LOCATIONS.find(loc => 
                loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
            );
            
            if (mallLocation) {
                selectedLocation = mallLocation.id;
                customLocation = '';
            } else {
                // 作為自訂地點
                selectedLocation = '';
                customLocation = autoDetectedLocation;
            }
        }
    }
    
    // 直接進入照片上傳步驟
    setTimeout(() => {
        askForPhoto();
    }, 300);
}

// 處理使用者輸入
function handleUserInput(message) {
    // 目前僅用於輸入描述
    switch(currentStep) {
        case 'input_form':
            $('#descriptionInput').val(message);
            $('#descriptionInput').removeClass('placeholder-active');
            break;
        default:
            // 不做任何處理
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
        closeModal();
    }
});