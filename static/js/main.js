// ==================== 配置區塊 ====================
const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbwKxZON3tIGAYVJAXqBEBOLEBaQlCdHgWevywV-phUOxED0fU_mmOtgaPlmc-cWGwwZ/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
};

const LINE_CONFIG = {
    OFFICE_OBSERVATORY: 'Cb22705d055e6912d2815313296932347',
    SHOPPING: 'Cb22705d055e6912d2815313296932347'
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

// 地點選項
const OFFICE_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'public_corridor', label: '公共走道' },
    { id: 'public_elevator', label: '公共電梯' },
    { id: 'public_pantry', label: '公共茶水間' },
    { id: 'public_freight_lift', label: '公共貨梯廳' }
];

const MALL_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'nursing_room', label: '哺乳室' }
];

const OBSERVATORY_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'nursing_room', label: '哺乳室' },
    { id: 'east_area', label: '東面場域' },
    { id: 'west_area', label: '西區場域' }
];

// 樓層選項
const SHOPPING_FLOORS = ['B1', '1', '2', '3', '4', '5'];
const OBSERVATORY_FLOORS = ['89', '91'];

// 從URL獲取參數
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    autoDetectedFloor = urlParams.get('floor') || '';
    autoDetectedLocation = urlParams.get('location') || '';
    autoDetectedService = '';

    if (autoDetectedFloor) {
        let floorValue = autoDetectedFloor.replace('F', '').replace('f', '');
        const floorNum = parseInt(floorValue);

        if (SHOPPING_FLOORS.includes(floorValue)) {
            autoDetectedService = 'shopping';
        } else if (OBSERVATORY_FLOORS.includes(floorValue)) {
            autoDetectedService = 'observatory';
        } else if (!isNaN(floorNum) && floorNum >= 1 && floorNum <= 88) {
            autoDetectedService = 'office';
        }

        autoDetectedFloor = floorValue;
    }
}

// 初始化應用
$(document).ready(function () {
    parseUrlParams();

    if (autoDetectedService) {
        initChatWithAutoDetectedService();
    } else {
        initChat();
    }
    setTimeout(scrollToBottom, 100);
});

// 初始化聊天
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
                addBotMessage(`
                    <div style="text-align: center; padding: 5px 0;">
                        <div style="font-size: 18px; font-weight: 600; color: #2d3436; margin-bottom: 8px;">
                            歡迎蒞臨台北101 ${detectedArea}
                        </div>
                        <div style="font-size: 14px; color: #666; line-height: 1.5;">
                            我是智慧小幫手，為您提供快速通報服務
                        </div>
                    </div>
                `);
            } else {
                addBotMessage(`
                    <div style="text-align: center; padding: 5px 0;">
                        <div style="font-size: 18px; font-weight: 600; color: #2d3436; margin-bottom: 8px;">
                            台北101智慧通報系統
                        </div>
                        <div style="font-size: 14px; color: #666; line-height: 1.5;">
                            我是智慧小幫手，請選擇您所在的區域
                        </div>
                    </div>
                `);
            }

            setTimeout(() => {
                selectService(autoDetectedService);
            }, 800);
        } else {
            addBotMessage(`
                <div style="text-align: center; padding: 5px 0;">
                    <div style="font-size: 18px; font-weight: 600; color: #2d3436; margin-bottom: 8px;">
                        台北101智慧通報系統
                    </div>
                    <div style="font-size: 14px; color: #666; line-height: 1.5;">
                        我是智慧小幫手，請選擇您所在的區域開始通報
                    </div>
                </div>
            `);
            showServiceButtons();
        }
    }, 500);
}

// 顯示服務按鈕
function showServiceButtons() {
    currentStep = 'select_service';

    if (autoDetectedService) {
        setTimeout(() => {
            selectService(autoDetectedService);
        }, 100);
        return;
    }

    const services = [
        { icon: '🏢', title: '辦公大樓', desc: '辦公區域通報', value: 'office' },
        { icon: '🛍️', title: '購物中心', desc: '購物區域通報', value: 'shopping' },
        { icon: '🏙️', title: '觀景台', desc: '觀景區域通報', value: 'observatory' }
    ];

    const buttonsHTML = `
        <div class="service-buttons" id="serviceButtons">
            ${services.map(service => `
                <div class="service-button" onclick="selectService('${service.value}')" data-service="${service.value}">
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

    // 自動填入參數
    if (autoDetectedService === serviceType) {
        selectedFloor = autoDetectedFloor;

        let locations = [];
        if (serviceType === 'office') locations = OFFICE_LOCATIONS;
        else if (serviceType === 'shopping') locations = MALL_LOCATIONS;
        else if (serviceType === 'observatory') locations = OBSERVATORY_LOCATIONS;

        const foundLocation = locations.find(loc =>
            loc.label === autoDetectedLocation || loc.id === autoDetectedLocation
        );

        if (foundLocation) {
            selectedLocation = foundLocation.id;
            customLocation = '';
        } else if (autoDetectedLocation) {
            selectedLocation = '';
            customLocation = autoDetectedLocation;
        }
    }

    if ($('#serviceButtons').length) {
        $('#serviceButtons .service-button').removeClass('selected');
        $(`[data-service="${serviceType}"]`).addClass('selected');
    }

    const serviceNames = {
        'office': ' 辦公大樓',
        'shopping': ' 購物中心',
        'observatory': ' 觀景台'
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
                          rows="3" placeholder="請檢查、進行環境清潔"
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
            floorDisplayText = `${selectedFloor}F`;
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
                          rows="3" placeholder="請檢查、進行環境清潔"
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

// 辦公大樓樓層輸入處理
function handleOfficeFloorInput() {
    const floorInput = $('#floorInput');
    let floorValue = floorInput.val().trim();

    if (floorValue === '') return;

    let floorNum = parseInt(floorValue);
    if (isNaN(floorNum)) {
        floorInput.val('');
    } else {
        if (floorNum > 88) {
            floorInput.val('88');
            showToast('樓層已自動調整為88', 'warning');
        } else if (floorNum < 1 && floorValue.length === 1 && floorNum < 1) {
            // 允許暫時小於1
        } else if (floorNum < 1) {
            floorInput.val('1');
            showToast('樓層已自動調整為1', 'warning');
        }
    }
}

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

    if (currentService === 'office' && floorInput && !floorInput.val().trim()) {
        floorInput.addClass('placeholder-active');
        floorInput.val('請輸入樓層數字 (1-88)');
    }

    if (descriptionInput && !descriptionInput.val().trim()) {
        descriptionInput.addClass('placeholder-active');
        descriptionInput.val('請檢查、進行環境清潔');
    }
}

// 處理輸入框事件
function handleFloorFocus() {
    const floorInput = $('#floorInput');
    if (floorInput.hasClass('placeholder-active')) {
        floorInput.removeClass('placeholder-active');
        floorInput.val('');
    }
}

function handleDescriptionFocus() {
    const descriptionInput = $('#descriptionInput');
    if (descriptionInput.hasClass('placeholder-active')) {
        descriptionInput.removeClass('placeholder-active');
        descriptionInput.val('');
    }
}

function handleDescriptionBlur() {
    const descriptionInput = $('#descriptionInput');
    if (!descriptionInput.val().trim()) {
        descriptionInput.addClass('placeholder-active');
        descriptionInput.val('請檢查、進行環境清潔');
    }
}

function handleDescriptionInput() {
    const descriptionInput = $('#descriptionInput');
    if (descriptionInput.val().trim()) {
        descriptionInput.removeClass('placeholder-active');
    }
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

        if (floorValue) {
            const floorNum = parseInt(floorValue);
            if (isNaN(floorNum) || floorNum < 1 || floorNum > 88) {
                showToast('請輸入有效的樓層 (1 ~ 88)', 'warning');
                return;
            }
            selectedFloor = floorNum.toString();
        }
    }

    // 驗證樓層
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
    const displayFloor = currentService === 'office' ? `${selectedFloor}F` : `${selectedFloor}F`;
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

// 詢問照片（簡化流程）
function askForPhoto() {
    currentStep = 'input_photo';

    addBotMessage('是否需要上傳照片輔助說明？（非必要）');

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

    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        uploadedFilePreview = e.target.result;
        $('#previewImage').attr('src', e.target.result).show();
        $('#uploadArea').hide();
        showToast('照片已選擇', 'success');

        const quickReplies = $('.quick-replies').last();
        if (!quickReplies.find('.quick-reply-btn[onclick="confirmPhoto()"]').length) {
            const confirmBtn = $('<button class="quick-reply-btn" onclick="confirmPhoto()" style="background: #4a90e2; color: white;">確認上傳</button>');
            quickReplies.append(confirmBtn);
        }
    };
    reader.readAsDataURL(file);
}

// 跳過照片
function skipPhoto() {
    uploadedFile = null;
    addUserMessage('不上傳照片');

    setTimeout(() => {
        showConfirmation();
    }, 500);
}

// 確認照片
function confirmPhoto() {
    if (uploadedFile) {
        addUserMessage('已上傳照片');

        // 直接顯示確認頁面，跳過額外預覽
        setTimeout(() => {
            showConfirmation();
        }, 300);
    } else {
        showConfirmation();
    }
}

// 顯示確認頁面（使用垂直表格樣式）
function showConfirmation() {
    currentStep = 'confirmation';
    
    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };
    
    // 準備顯示資料
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
    const displayFloor = currentService === 'office' ? `${selectedFloor}F` : `${selectedFloor}F`;
    
    // 處理描述：如果沒有填寫或只有預設值，使用預設描述
    let displayDescription = problemDescription;
    if (!problemDescription || 
        problemDescription === '' || 
        problemDescription === '請檢查、進行環境清潔' ||
        problemDescription.trim() === '') {
        displayDescription = '請檢查、進行環境清潔';
    }
    
    const serviceTypeText = serviceNames[currentService] || '通報';
    const hasPhoto = uploadedFile ? '有' : '無';
    const photoClass = uploadedFile ? 'has-photo' : 'photo-value';
    
    const confirmationHTML = `
        <div class="horizontal-case-card">
            <div class="horizontal-details-list">
                <!-- 服務類型 -->
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <i>🏢</i>
                        <span class="detail-label-text">類型</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${serviceTypeText}</span>
                    </div>
                </div>
                
                <!-- 樓層 -->
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <i>📍</i>
                        <span class="detail-label-text">樓層</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${displayFloor}</span>
                    </div>
                </div>
                
                <!-- 地點 -->
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <i>🚻</i>
                        <span class="detail-label-text">地點</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${locationText}</span>
                    </div>
                </div>
                
                <!-- 照片 -->
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <i>📷</i>
                        <span class="detail-label-text">照片</span>
                    </div>
                    <div class="detail-value-section ${photoClass}">
                        <span class="detail-value-text">${hasPhoto}</span>
                    </div>
                </div>
            </div>
            
            <!-- 描述（獨立區域） -->
            <div class="description-row">
                <div class="description-label-section">
                    <i>📝</i>
                    <span class="description-label-text">描述</span>
                </div>
                <div class="description-content-section">
                    <div class="description-content-text">${displayDescription}</div>
                </div>
            </div>
        </div>
        
        <div class="quick-replies">
            <button class="quick-reply-btn" onclick="editInformation()">
                ✏️ 修改資訊
            </button>
            <button class="quick-reply-btn" onclick="submitReport()"
                    style="background: linear-gradient(135deg, #4a90e2 0%, #357ae8 100%); color: white; font-weight: bold;">
                ✓ 確認提交
            </button>
        </div>
    `;
    
    addBotMessage(confirmationHTML);
}

// 修改資訊
function editInformation() {
    const savedFloor = selectedFloor;
    const savedLocation = selectedLocation;
    const savedCustomLocation = customLocation;
    const savedDescription = problemDescription;
    const savedService = currentService;

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

    showReportForm();
}

// 提交通報
function submitReport() {
    const loadingId = 'loading-' + Date.now();
    addBotMessage(`<div id="${loadingId}" class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`);

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

    floorText = currentService === 'office' ? `${selectedFloor}F` : `${selectedFloor}F`;

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

    const serviceTypeText = serviceNames[currentService] || '未分類';

    // LINE通知訊息
    let lineMessage = `【${serviceTypeText}訊息通知】\n`;
    lineMessage += `樓層： ${floorText}\n`;
    lineMessage += `位置： ${locationText}\n`;

    let lineDescription = problemDescription;
    if (!problemDescription || problemDescription === '' ||
        problemDescription === '請檢查、進行環境清潔' || problemDescription.trim() === '') {
        lineDescription = '請檢查、進行環境清潔';
    }

    lineMessage += `描述： ${lineDescription}`;

    // 準備發送資料
    const formData = {
        report_date: reportDate,
        report_floor: floorText,
        report_location: locationText,
        description: lineDescription,
        service_type: serviceTypeText,
        report_time: reportTime,
        sign_in_time: '',
        sign_in_interval: '',
        sign_in_check: '',
        msg: lineMessage,
        action: 'report'
    };

    // 根據服務類型選擇LINE群組
    let lineGroupId = '';
    if (currentService === 'shopping') {
        lineGroupId = LINE_CONFIG.SHOPPING;
    } else {
        lineGroupId = LINE_CONFIG.OFFICE_OBSERVATORY;
    }

    formData.line_group_id = lineGroupId;

    // 如果有照片，壓縮後上傳
    if (uploadedFile) {
        compressImage(uploadedFile).then(compressedFile => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64Data = e.target.result.split(',')[1];

                fetch(API_CONFIG.UPLOAD_API, {
                    method: 'POST',
                    body: JSON.stringify({
                        dataReq: {
                            data: base64Data,
                            name: compressedFile.name,
                            type: 'image/jpeg'
                        },
                        fname: "uploadFilesToGoogleDrive"
                    })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.id) {
                            formData.photo_id = data.id;
                            sendToGoogleAppsScript(formData);
                        } else {
                            sendToGoogleAppsScript(formData);
                        }
                    })
                    .catch(error => {
                        console.error('照片上傳失敗:', error);
                        sendToGoogleAppsScript(formData);
                    });
            };
            reader.readAsDataURL(compressedFile);
        }).catch(error => {
            console.error('圖片壓縮失敗:', error);
            sendToGoogleAppsScript(formData);
        });
    } else {
        sendToGoogleAppsScript(formData);
    }
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

        reader.onload = function (e) {
            img.src = e.target.result;
        };

        img.onload = function () {
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

            let quality = 0.7;
            if (file.size > 5 * 1024 * 1024) quality = 0.6;
            else if (file.size > 10 * 1024 * 1024) quality = 0.5;

            canvas.toBlob(blob => {
                if (blob) {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                } else {
                    reject(new Error('壓縮失敗'));
                }
            }, 'image/jpeg', quality);
        };

        img.onerror = function () {
            reject(new Error('圖片載入失敗'));
        };

        reader.onerror = function () {
            reject(new Error('檔案讀取失敗'));
        };

        reader.readAsDataURL(file);
    });
}

// 發送到Google Apps Script
function sendToGoogleAppsScript(formData) {
    $('.typing-indicator').last().remove();

    var params = new URLSearchParams();
    for (var key in formData) {
        params.append(key, formData[key]);
    }

    $.ajax({
        url: API_CONFIG.MAIN_API + '?' + params.toString(),
        method: 'GET',
        success: function (response) {
            console.log('通報成功:', response);
            showSuccessPage();
        },
        error: function (xhr, status, error) {
            console.error('通報失敗:', error);
            showSuccessPage();
        }
    });
}

// 顯示成功頁面
function showSuccessPage() {
    currentStep = 'completed';

    const serviceNames = {
        'office': '辦公大樓',
        'shopping': '購物中心',
        'observatory': '觀景台'
    };

    const serviceTypeText = serviceNames[currentService] || '通報';

    const successHTML = `
        <div class="success-container">
            <div style="margin-bottom: 30px;">
                <div style="width: 70px; height: 70px; margin: 0 auto 20px; background: linear-gradient(135deg, #4a90e2 0%, #357ae8 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: bold;">
                    ✓
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <div style="font-size: 22px; font-weight: 700; color: #2d3436; margin-bottom: 15px; letter-spacing: 0.5px;">
                    ${serviceTypeText}通報完成
                </div>
            </div>
            
            <div style="margin-bottom: 35px;">
                <div style="font-size: 16px; color: #4a5568; line-height: 1.6; margin-bottom: 10px; font-weight: 500;">
                    感謝您的通知
                </div>
                <div style="font-size: 16px; color: #4a5568; line-height: 1.6; font-weight: 500;">
                    讓我們做得更好
                </div>
            </div>
            
            <div style="height: 1px; background: #e9ecef; margin: 30px 0;"></div>
            
            <div class="quick-replies">
                <button class="quick-reply-btn" onclick="initChat()"
                        style="background: #4a90e2; color: white; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; border: none; width: 100%; max-width: 200px;">
                    新的通報
                </button>
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
                <div class="message-content">
                    ${content}
                </div>
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
                <div class="message-content">
                    ${content}
                </div>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        </div>
    `;

    $('#chatContainer').append(messageHTML);
    chatMessages.push(messageHTML);
    scrollToBottom();

    return '#' + messageId;
}

// 輔助函數
function scrollToBottom() {
    const container = $('#chatContainer')[0];
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0');
}

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

    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes toastSlideIn {
            from { opacity: 0; transform: translate(-50%, -30px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
    `;

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

// 模態框相關函數（保持原有功能）
function showFloorModal() {
    const modalTitle = currentService === 'shopping' ? '選擇購物中心樓層' : '選擇觀景台樓層';
    $('#floorModalTitle').text(modalTitle);

    let floors = [];
    if (currentService === 'shopping') floors = SHOPPING_FLOORS;
    else if (currentService === 'observatory') floors = OBSERVATORY_FLOORS;

    const floorOptionsHTML = floors.map(floor => {
        const displayFloor = `${floor}F`;
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

function selectFloor(floor) {
    selectedFloor = floor;
    const displayFloor = `${floor}F`;
    $('#floorSelectBtn .floor-value').text(displayFloor);
    closeFloorModal();
    showToast(`已選擇：${displayFloor}`, 'success');
}

function selectLocation(locationId) {
    selectedLocation = locationId;
    customLocation = '';

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

    $('#locationSelectBtn .location-value').text(locationLabel);
    closeLocationModal();
    showToast(`已選擇：${locationLabel}`, 'success');
}

function confirmCustomLocation() {
    const customInput = $('#modalCustomLocationInput');
    const customValue = customInput.val().trim();

    if (!customValue) {
        showToast('請輸入自訂地點', 'warning');
        return;
    }

    selectedLocation = '';
    customLocation = customValue;
    $('#locationSelectBtn .location-value').text(customLocation);
    closeLocationModal();
    showToast(`已設定自訂地點：${customLocation}`, 'success');
}

function closeFloorModal() {
    $('#floorModal').hide();
}

function closeLocationModal() {
    $('#locationModal').hide();
}

function closeImageModal() {
    $('#imageModal').hide();
}

function previewUploadedImage() {
    if (uploadedFilePreview) {
        $('#modalImage').attr('src', uploadedFilePreview);
        $('#imageModal').show();
    }
}

// 防止模態框關閉時關閉整個對話
$('.modal').on('click', function (event) {
    if (event.target === this) {
        $(this).hide();
    }
});