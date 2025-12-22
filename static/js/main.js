// ==================== 配置區塊 ====================

const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbwKxZON3tIGAYVJAXqBEBOLEBaQlCdHgWevywV-phUOxED0fU_mmOtgaPlmc-cWGwwZ/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
};

// ==================== 基本觸控修復 ====================

function applyBasicTouchFixes() {
    console.log('應用基本觸控修復');

    // 1. 為所有按鈕添加標準化觸控處理
    document.addEventListener('touchstart', function (e) {
        if (e.target.closest('button')) {
            const button = e.target.closest('button');
            button.classList.add('touch-active');

            setTimeout(() => {
                button.classList.remove('touch-active');
            }, 300);
        }
    }, { passive: true });

    // 2. 防止快速點擊觸發滾動
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (e) {
        const now = Date.now();
        if (now - lastTouchEnd < 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });

    // 3. 修復 iOS 按鈕狀態問題
    document.addEventListener('touchcancel', function (e) {
        if (e.target.closest('button')) {
            const button = e.target.closest('button');
            button.classList.remove('touch-active', 'selected', 'active');
        }
    }, { passive: true });
}

// ==================== 步驟狀態 ====================

let currentStep = 'welcome';
let currentService = '';
let selectedFloor = '';
let selectedLocation = '';
let customLocation = '';
let problemDescription = '';
let uploadedFile = null;
let uploadedFilePreview = null;
let autoDetectedService = '';
let autoDetectedFloor = '';
let autoDetectedLocation = '';
let hasUrlParams = false;
let isFromQR = false;

// 對話步驟追蹤 - 重要：保留步驟追蹤
let chatSteps = {
    'select_service': -1,
    'input_form': -1,
    'input_photo': -1,
    'confirmation': -1,
    'completed': -1
};

// ==================== 服務類型映射 ====================

const SERVICE_TYPES = {
    'office': '辦公大樓',
    'shopping': '購物中心',
    'observatory': '觀景台'
};

// ==================== 地點選項 ====================

const OFFICE_LOCATIONS = [
    { id: 'male_toilet', label: '男生廁所' },
    { id: 'female_toilet', label: '女生廁所' },
    { id: 'public_corridor', label: '公共走道' },
    { id: 'public_elevator', label: '公共電梯' },
    { id: 'public_pantry', label: '茶水間' },
    { id: 'public_freight_lift', label: '貨梯廳' }
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

// ==================== 樓層選項 ====================

const SHOPPING_FLOORS = ['B1', '1', '2', '3', '4', '5'];
const OBSERVATORY_FLOORS = ['89', '91', '101'];

// ==================== URL參數解析 ====================
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);

    hasUrlParams = urlParams.toString().length > 0;
    isFromQR = hasUrlParams;

    if (!hasUrlParams) {
        autoDetectedService = '';
        autoDetectedFloor = '';
        autoDetectedLocation = '';
        return;
    }

    const serviceParam = urlParams.get('service') || '';
    autoDetectedService = ['office', 'shopping', 'observatory'].includes(serviceParam) ? serviceParam : '';

    const floorParam = urlParams.get('floor') || '';
    if (floorParam) {
        if (floorParam.toUpperCase() === 'B1') {
            autoDetectedFloor = 'B1';
        } else if (/^[1-9][0-9]*$|^[1-9][0-9]*F$/i.test(floorParam)) {
            autoDetectedFloor = floorParam.replace(/F/gi, '');
        }
    }

    const rawLocation = (urlParams.get('location') || '').trim();
    if (rawLocation) {
        const englishToChineseMap = {
            "Men's Room": '男生廁所',
            "Ladies' Room": '女生廁所',
            'Public Corridor': '公共走道',
            'Elevator': '公共電梯',
            'Pantry': '茶水間',
            'Freight Elevator': '貨梯廳',
            'Nursing Room': '哺乳室',
            'East Area': '東面場域',
            'West Area': '西區場域'
        };

        if (englishToChineseMap[rawLocation]) {
            autoDetectedLocation = englishToChineseMap[rawLocation];
        } else {
            autoDetectedLocation = rawLocation;
        }
    } else {
        autoDetectedLocation = '';
    }
}

// ==================== 步驟管理 ====================

function setStep(step) {
    console.log('設置步驟:', step, '當前步驟:', currentStep);

    // 更新當前步驟
    currentStep = step;

    // 標記新步驟的開始位置
    const messageCount = $('.message').length;
    chatSteps[step] = messageCount;

    console.log('步驟索引已更新:', step, '=>', messageCount);

    // 顯示步驟
    showStep(step);
}

function clearStepsAfter(step) {
    console.log('清除步驟之後的對話，目標步驟:', step, '當前步驟索引:', chatSteps[step]);

    const $chatContainer = $('#chatContainer');
    const $messages = $chatContainer.children('.message');

    // 找到該步驟的開始位置
    const startIndex = chatSteps[step];
    if (startIndex === undefined || startIndex < 0) {
        console.log('找不到步驟開始位置，嘗試從最後一個表單開始清除');

        // 嘗試找到最後一個表單訊息
        let lastFormIndex = -1;
        $messages.each(function (index) {
            if ($(this).find('.form-title').length > 0) {
                lastFormIndex = index;
            }
        });

        if (lastFormIndex >= 0) {
            console.log('找到表單訊息索引:', lastFormIndex);
            // 從表單之後開始清除
            for (let i = $messages.length - 1; i >= lastFormIndex; i--) {
                console.log('移除訊息索引:', i);
                $($messages[i]).remove();
            }

            // 重置步驟索引
            chatSteps[step] = lastFormIndex;
            // 清除該步驟之後的所有步驟索引
            Object.keys(chatSteps).forEach(key => {
                if (chatSteps[key] > lastFormIndex) {
                    chatSteps[key] = -1;
                }
            });
        } else {
            console.log('找不到表單，清除所有訊息');
            $chatContainer.empty();
            chatSteps[step] = 0;
        }
        return;
    }

    console.log('從索引開始清除:', startIndex, '總訊息數:', $messages.length);

    // 從後往前清除訊息
    for (let i = $messages.length - 1; i >= startIndex; i--) {
        console.log('移除訊息索引:', i);
        $($messages[i]).remove();
    }

    // 重置該步驟之後的所有步驟索引
    Object.keys(chatSteps).forEach(key => {
        if (chatSteps[key] > startIndex) {
            chatSteps[key] = -1;
        }
    });
}

function goBackToStep(step) {
    console.log('========== 返回步驟 ==========');
    console.log('目標步驟:', step, '當前訊息數:', $('.message').length);

    // 清除該步驟之後的所有對話
    clearStepsAfter(step);

    // 設置當前步驟
    currentStep = step;

    // 重新顯示該步驟
    showStep(step);
}

// ==================== 重置應用 ====================

function resetApp() {
    currentStep = 'welcome';
    currentService = '';
    selectedFloor = '';
    selectedLocation = '';
    customLocation = '';
    problemDescription = '';
    uploadedFile = null;
    uploadedFilePreview = null;

    // 重置步驟追蹤
    chatSteps = {
        'select_service': -1,
        'input_form': -1,
        'input_photo': -1,
        'confirmation': -1,
        'completed': -1
    };

    parseUrlParams();
}

// ==================== 事件綁定 ====================

function bindEvents() {
    $('#reloadLogo').off('click').on('click', function () {
        location.reload();
    });

    $('#closeImageModalBtn').off('click').on('click', closeImageModal);
    $('#closeFloorModalBtn').off('click').on('click', closeFloorModal);
    $('#closeLocationModalBtn').off('click').on('click', closeLocationModal);

    $('.modal').off('click').on('click', function (event) {
        if ($(event.target).closest('.modal-content').length === 0) {
            $(this).hide();
        }
    });

    $(document).off('keydown').on('keydown', function (event) {
        if (event.key === 'Escape') {
            $('.modal').hide();
        }
    });

    $('.report-label').off('click').on('click', function () {
        const currentParams = window.location.search;
        window.location.href = 'indexEN.html' + currentParams;
    });
}

// ==================== 標準按鈕事件處理 ====================

function setupStandardButtonHandlers() {
    // 服務按鈕
    $(document).off('click touchstart', '.service-button').on('click touchstart', '.service-button', function (e) {
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        const $btn = $(this);
        const serviceType = $btn.data('service');
        selectService(serviceType);

        return true;
    });

    // 樓層和地點選項按鈕
    $(document).off('click touchstart', '.floor-option-btn, .location-option-btn').on('click touchstart', '.floor-option-btn, .location-option-btn', function (e) {
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        const $btn = $(this);
        const now = Date.now();

        // 防雙擊保護
        if (now - ($btn.data('lastClick') || 0) < 300) {
            return false;
        }
        $btn.data('lastClick', now);

        if ($btn.hasClass('floor-option-btn')) {
            const floor = $btn.data('floor');
            selectFloor(floor);
        } else if ($btn.hasClass('location-option-btn')) {
            const locationId = $btn.data('location');
            selectLocation(locationId);
        }

        return true;
    });

    // 快速回覆按鈕
    $(document).off('click touchstart', '.quick-reply-btn').on('click touchstart', '.quick-reply-btn', function (e) {
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        const $btn = $(this);

        // 根據按鈕類別處理
        if ($btn.hasClass('confirm-form-btn-office') || $btn.hasClass('confirm-form-btn-dynamic')) {
            confirmForm();
        } else if ($btn.hasClass('skip-photo-btn-dynamic')) {
            skipPhoto();
        } else if ($btn.hasClass('confirm-photo-btn-dynamic')) {
            confirmPhoto();
        } else if ($btn.hasClass('edit-info-btn')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('點擊修改資訊按鈕');

            // 返回表單步驟
            goBackToStep('input_form');
        } else if ($btn.hasClass('submit-report-btn')) {
            e.preventDefault();
            e.stopPropagation();
            submitReport();
        } else if ($btn.hasClass('new-report-btn-dynamic')) {
            if (hasUrlParams && autoDetectedService) {
                initChatWithUrlParams();
            } else {
                initChat();
            }
        }

        return true;
    });
}

// ==================== 初始化應用 ====================
$(document).ready(function () {
    parseUrlParams();
    bindEvents();

    // 應用基本觸控修復
    applyBasicTouchFixes();

    // 延遲初始化
    setTimeout(() => {
        // 重置按鈕狀態
        $('.floor-select-btn, .location-select-btn').each(function () {
            const $btn = $(this);
            $btn.removeClass('selected active touch-active');
            $btn.css({
                'background-color': 'white',
                'border-color': '#ddd'
            });
            updateButtonTextColor($btn);
        });

        if (hasUrlParams && autoDetectedService && SERVICE_TYPES[autoDetectedService]) {
            initChatWithUrlParams();
        } else {
            initChat();
        }

        scrollToBottom();
    }, 300);
});

// ==================== 有URL參數的初始化 ====================

function initChatWithUrlParams() {
    resetApp();
    $('#chatContainer').empty();

    setTimeout(() => {
        const serviceName = SERVICE_TYPES[autoDetectedService];

        addBotMessage(`
            <div class="welcome-message">
                <div class="welcome-title">TAIPEI 101 智慧通報系統</div>
                <div class="welcome-subtitle">歡迎蒞臨${serviceName}</div>
            </div>
        `);

        setTimeout(() => {
            currentService = autoDetectedService;
            if (autoDetectedFloor) selectedFloor = autoDetectedFloor;
            if (autoDetectedLocation) {
                const locationMatch = findLocationMatch(autoDetectedLocation, currentService);
                if (locationMatch) {
                    selectedLocation = locationMatch.id;
                } else {
                    customLocation = autoDetectedLocation;
                }
            }
            setStep('input_form');
        }, 1000);
    }, 500);
}

// ==================== 正常初始化 ====================

function initChat() {
    resetApp();
    $('#chatContainer').empty();

    setTimeout(() => {
        addBotMessage(`
            <div class="welcome-message">
                <div class="welcome-title">TAIPEI 101 智慧通報系統</div>
                <div class="welcome-subtitle">請選擇您所在的區域開始通報</div>
            </div>
        `);
        setStep('select_service');
    }, 500);
}

// ==================== 顯示步驟 ====================

function showStep(step) {
    console.log('顯示步驟:', step);

    switch (step) {
        case 'select_service':
            showServiceButtons();
            break;
        case 'input_form':
            showReportForm();
            break;
        case 'input_photo':
            askForPhoto();
            break;
        case 'confirmation':
            showConfirmation();
            break;
        case 'completed':
            showSuccessPage();
            break;
    }
}

// ==================== 顯示服務按鈕 ====================

function showServiceButtons() {
    // 清除可能存在的舊按鈕
    const existingButtons = document.querySelectorAll('.service-buttons');
    existingButtons.forEach(el => el.remove());

    const services = [
        { icon: '🏢', title: '辦公大樓', desc: '辦公區域通報', value: 'office' },
        { icon: '🛍️', title: '購物中心', desc: '購物區域通報', value: 'shopping' },
        { icon: '🏙️', title: '觀景台', desc: '觀景區域通報', value: 'observatory' }
    ];

    const buttonsHTML = `
        <div class="service-buttons" id="serviceButtons">
            ${services.map(service => `
                <div class="service-button" data-service="${service.value}">
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
    setupStandardButtonHandlers();
}

// ==================== 選擇服務類型 ====================

function selectService(serviceType) {
    console.log('選擇服務類型:', serviceType);

    // 清除之前的選擇
    $('.service-button').removeClass('selected');
    $(`.service-button[data-service="${serviceType}"]`).addClass('selected');

    // 更新服務類型
    currentService = serviceType;
    selectedFloor = '';
    selectedLocation = '';
    customLocation = '';
    problemDescription = '';
    uploadedFile = null;
    uploadedFilePreview = null;

    // 清除所有對話，只保留歡迎訊息和服務選擇
    const $chatContainer = $('#chatContainer');
    const $messages = $chatContainer.children('.message');

    // 找到服務選擇訊息的索引
    let serviceSelectIndex = -1;
    $messages.each(function (index) {
        if ($(this).find('.service-buttons').length > 0) {
            serviceSelectIndex = index;
        }
    });

    if (serviceSelectIndex >= 0) {
        console.log('找到服務選擇訊息索引:', serviceSelectIndex);

        // 從服務選擇之後開始清除所有訊息
        for (let i = $messages.length - 1; i > serviceSelectIndex; i--) {
            console.log('移除訊息索引:', i);
            $($messages[i]).remove();
        }

        // 重置步驟索引
        chatSteps = {
            'select_service': serviceSelectIndex,
            'input_form': -1,
            'input_photo': -1,
            'confirmation': -1,
            'completed': -1
        };

        // 添加用戶選擇的服務訊息
        const serviceName = SERVICE_TYPES[serviceType] || '通報';
        addUserMessage(serviceName);

        // 更新當前步驟
        currentStep = 'input_form';
        chatSteps['input_form'] = $('.message').length;

        // 直接顯示表單
        showReportForm();
    } else {
        // 如果找不到服務選擇，重新初始化
        console.log('找不到服務選擇，重新初始化');
        initChat();
    }
}

// ==================== 獲取當前地點列表 ====================

function getCurrentLocations() {
    if (currentService === 'office') {
        return OFFICE_LOCATIONS;
    } else if (currentService === 'shopping') {
        return MALL_LOCATIONS;
    } else if (currentService === 'observatory') {
        return OBSERVATORY_LOCATIONS;
    }
    return [];
}

// ==================== 地點匹配函數 ====================
function findLocationMatch(locationText, serviceType) {
    let locations = [];

    switch (serviceType) {
        case 'office':
            locations = OFFICE_LOCATIONS;
            break;
        case 'shopping':
            locations = MALL_LOCATIONS;
            break;
        case 'observatory':
            locations = OBSERVATORY_LOCATIONS;
            break;
        default:
            return null;
    }

    const exactMatch = locations.find(loc =>
        loc.label === locationText ||
        loc.id === locationText
    );

    if (exactMatch) return exactMatch;

    const englishToChineseMap = {
        "Men's Room": '男生廁所',
        "Ladies' Room": '女生廁所',
        'Public Corridor': '公共走道',
        'Elevator': '公共電梯',
        'Pantry': '茶水間',
        'Freight Elevator': '貨梯廳',
        'Nursing Room': '哺乳室',
        'East Area': '東面場域',
        'West Area': '西區場域'
    };

    if (englishToChineseMap[locationText]) {
        const translatedLocation = englishToChineseMap[locationText];
        const translatedMatch = locations.find(loc => loc.label === translatedLocation);
        if (translatedMatch) return translatedMatch;
    }

    const partialMatch = locations.find(loc =>
        locationText.includes(loc.label) ||
        loc.label.includes(locationText)
    );

    return partialMatch || null;
}

// ==================== 顯示通報表單 ====================

function showReportForm() {
    console.log('顯示通報表單，當前服務:', currentService, '當前步驟:', currentStep);

    // 檢查是否已經有相同類型的表單
    const existingForms = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('form-title') || content.includes('通報表單');
    });

    if (existingForms.length > 0) {
        console.log('發現重複的表單，移除舊的');
        existingForms.remove();
    }

    const formTitles = {
        'office': '🏢 辦公大樓通報表單',
        'shopping': '🛍️ 購物中心通報表單',
        'observatory': '🏙️ 觀景台通報表單'
    };

    const formTitle = formTitles[currentService] || '通報表單';

    if (currentService === 'office') {
        let floorDisplayText = selectedFloor || '請輸入樓層數字 (1-88)';
        let locationDisplayText = '請選擇地點';

        if (selectedLocation) {
            const location = OFFICE_LOCATIONS.find(loc => loc.id === selectedLocation);
            locationDisplayText = location ? location.label : selectedLocation;
        } else if (customLocation) {
            locationDisplayText = customLocation;
        }

        let descriptionValue = '';
        let descriptionClass = 'form-control description-input-office';

        if (problemDescription && problemDescription !== '請檢查、進行環境清潔或設備報修') {
            descriptionValue = problemDescription;
            descriptionClass += ' has-user-input';
        } else {
            descriptionValue = '請檢查、進行環境清潔或設備報修';
            descriptionClass += ' placeholder-active';
        }

        const locationBtnClass = (selectedLocation || customLocation) ?
            'location-select-btn location-select-btn-office has-selection' :
            'location-select-btn location-select-btn-office';

        const formHTML = `
            <div class="form-title">${formTitle}</div>
           
            <div class="form-group">
                <label class="form-label">樓層 <span>*</span></label>
                <input type="number" class="form-control floor-input-office"
                       value="${selectedFloor || ''}"
                       placeholder="請輸入樓層數字 (1-88)"
                       min="1" max="88">
            </div>
           
            <div class="form-group">
                <label class="form-label">地點 <span>*</span></label>
                <button class="${locationBtnClass}">
                    <div class="location-display">
                        <span class="location-value">${locationDisplayText}</span>
                        <span class="location-arrow">▼</span>
                    </div>
                </button>
            </div>
           
            <div class="form-group">
                <label class="form-label">描述（非必要）</label>
                <textarea class="${descriptionClass}"
                          rows="3">${descriptionValue}</textarea>
            </div>
           
            <div class="quick-replies">
                <button class="quick-reply-btn confirm-form-btn-office">
                    確認
                </button>
            </div>
        `;

        addBotMessage(formHTML);
        bindFormEvents();
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

        let descriptionValue = '';
        let descriptionClass = 'form-control description-input-dynamic';

        if (problemDescription && problemDescription !== '請檢查、進行環境清潔或設備報修') {
            descriptionValue = problemDescription;
            descriptionClass += ' has-user-input';
        } else {
            descriptionValue = '請檢查、進行環境清潔或設備報修';
            descriptionClass += ' placeholder-active';
        }

        const floorBtnClass = selectedFloor ?
            'floor-select-btn floor-select-btn-dynamic has-selection' :
            'floor-select-btn floor-select-btn-dynamic';

        const locationBtnClass = (selectedLocation || customLocation) ?
            'location-select-btn location-select-btn-dynamic has-selection' :
            'location-select-btn location-select-btn-dynamic';

        const formHTML = `
            <div class="form-title">${formTitle}</div>
           
            <div class="form-group">
                <label class="form-label">樓層 <span>*</span></label>
                <button class="${floorBtnClass}">
                    <div class="floor-display">
                        <span class="floor-value">${floorDisplayText}</span>
                        <span class="floor-arrow">▼</span>
                    </div>
                </button>
            </div>
           
            <div class="form-group">
                <label class="form-label">地點 <span>*</span></label>
                <button class="${locationBtnClass}">
                    <div class="location-display">
                        <span class="location-value">${locationDisplayText}</span>
                        <span class="location-arrow">▼</span>
                    </div>
                </button>
            </div>
           
            <div class="form-group">
                <label class="form-label">描述（非必要）</label>
                <textarea class="${descriptionClass}"
                          rows="3">${descriptionValue}</textarea>
            </div>
           
            <div class="quick-replies">
                <button class="quick-reply-btn confirm-form-btn-dynamic">
                    確認
                </button>
            </div>
        `;

        addBotMessage(formHTML);
        bindFormEvents();
    }
}

// ==================== 綁定表單事件 ====================

function bindFormEvents() {
    // 移除所有舊的事件綁定
    $(document).off('focus', '.floor-input-office');
    $(document).off('blur', '.floor-input-office');
    $(document).off('input', '.floor-input-office');
    $(document).off('click', '.location-select-btn-office');
    $(document).off('focus', '.description-input-office');
    $(document).off('blur', '.description-input-office');
    $(document).off('input', '.description-input-office');
    $(document).off('click', '.confirm-form-btn-office');
    $(document).off('click', '.floor-select-btn-dynamic');
    $(document).off('click', '.location-select-btn-dynamic');
    $(document).off('click', '.confirm-form-btn-dynamic');
    $(document).off('focus', '.description-input-dynamic');
    $(document).off('blur', '.description-input-dynamic');
    $(document).off('input', '.description-input-dynamic');

    if (currentService === 'office') {
        $(document).on('focus', '.floor-input-office', handleFloorFocus);
        $(document).on('blur', '.floor-input-office', handleOfficeFloorBlur);
        $(document).on('input', '.floor-input-office', handleOfficeFloorInput);
        $(document).on('click', '.location-select-btn-office', showLocationModal);
        $(document).on('focus', '.description-input-office', handleDescriptionFocus);
        $(document).on('blur', '.description-input-office', handleDescriptionBlur);
        $(document).on('input', '.description-input-office', handleDescriptionInput);
    } else {
        $(document).on('click', '.floor-select-btn-dynamic', showFloorModal);
        $(document).on('click', '.location-select-btn-dynamic', showLocationModal);
        $(document).on('focus', '.description-input-dynamic', handleDescriptionFocus);
        $(document).on('blur', '.description-input-dynamic', handleDescriptionBlur);
        $(document).on('input', '.description-input-dynamic', handleDescriptionInput);
    }
}

// ==================== 樓層輸入處理 ====================

function handleOfficeFloorInput() {
    const floorInput = $(this);
    let floorValue = floorInput.val().trim();

    if (floorValue === '') return;

    let floorNum = parseInt(floorValue);
    if (isNaN(floorNum)) {
        floorInput.val('');
    } else {
        if (floorNum > 88) {
            floorInput.val('88');
            showToast('樓層已自動調整為88', 'warning');
        } else if (floorNum < 1) {
            floorInput.val('1');
            showToast('樓層已自動調整為1', 'warning');
        }
    }
}

function handleOfficeFloorBlur() {
    const floorInput = $(this);
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

// ==================== 處理輸入框事件 ====================

function handleFloorFocus() {
    const floorInput = $(this);
    if (floorInput.hasClass('placeholder-active')) {
        floorInput.removeClass('placeholder-active');
        floorInput.val('');
    }
}

function handleDescriptionFocus() {
    const descriptionInput = $(this);
    if (descriptionInput.hasClass('placeholder-active')) {
        descriptionInput.removeClass('placeholder-active');
        descriptionInput.val('');
    }
}

function handleDescriptionBlur() {
    const descriptionInput = $(this);
    const value = descriptionInput.val().trim();

    if (!value) {
        descriptionInput.addClass('placeholder-active');
        descriptionInput.val('請檢查、進行環境清潔或設備報修');
    }
}

function handleDescriptionInput() {
    const descriptionInput = $(this);
    if (descriptionInput.val().trim()) {
        descriptionInput.removeClass('placeholder-active');
    }
}

// ==================== 確認表單 ====================

function confirmForm() {
    console.log('========== 確認表單 ==========');

    let floorInput, descriptionInput;

    if (currentService === 'office') {
        floorInput = $('.floor-input-office');
        descriptionInput = $('.description-input-office');
    } else {
        descriptionInput = $('.description-input-dynamic');
    }

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
    } else {
        if (!selectedFloor) {
            showToast('請選擇樓層', 'warning');
            return;
        }
    }

    if (!selectedFloor) {
        if (currentService === 'office') {
            showToast('請輸入樓層', 'warning');
        } else {
            showToast('請選擇樓層', 'warning');
        }
        return;
    }

    let descriptionValue = descriptionInput.val().trim();

    if (descriptionInput.hasClass('placeholder-active') ||
        !descriptionValue ||
        descriptionValue === '請檢查、進行環境清潔或設備報修') {
        problemDescription = '請檢查、進行環境清潔或設備報修';
    } else {
        if (descriptionValue.length > 500) {
            showToast('描述長度超過500字限制', 'warning');
            return;
        }

        problemDescription = descriptionValue;
    }

    if (!selectedLocation && !customLocation) {
        showToast('請選擇或輸入地點', 'warning');
        return;
    }

    if (customLocation && customLocation.length > 100) {
        showToast('自訂地點長度超過100字限制', 'warning');
        return;
    }

    let userMessageContent = '';

    if (problemDescription && problemDescription !== '請檢查、進行環境清潔或設備報修') {
        userMessageContent = problemDescription;
    } else {
        userMessageContent = '請檢查、進行環境清潔或設備報修';
    }

    // 移除所有在表單之後的用戶訊息
    const $messages = $('.message');
    const formMessageIndex = $messages.filter(function () {
        return $(this).find('.form-title').length > 0;
    }).index();

    if (formMessageIndex >= 0) {
        console.log('表單訊息索引:', formMessageIndex);

        // 從表單之後開始移除所有訊息（包括Bot和User訊息）
        for (let i = $messages.length - 1; i > formMessageIndex; i--) {
            console.log('移除表單後的訊息，索引:', i);
            $($messages[i]).remove();
        }

        // 更新步驟索引
        chatSteps['input_form'] = formMessageIndex;
        chatSteps['input_photo'] = -1;
        chatSteps['confirmation'] = -1;
    }

    // 添加新的描述訊息
    addUserMessage(userMessageContent);

    setTimeout(() => {
        setStep('input_photo');
    }, 500);
}

// ==================== 詢問照片 ====================

function askForPhoto() {
    console.log('詢問照片，當前狀態:', uploadedFilePreview ? '有照片' : '無照片', '當前步驟:', currentStep, '當前訊息數:', $('.message').length);

    // 清除所有照片相關的舊訊息
    const photoMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('是否需要上傳照片輔助說明') ||
            content.includes('upload-area-dynamic') ||
            content.includes('upload-preview') ||
            content.includes('skip-photo-btn-dynamic');
    });

    if (photoMessages.length > 0) {
        console.log('發現舊的照片相關訊息，移除');
        photoMessages.remove();
    }

    // 添加照片詢問
    addBotMessage('是否需要上傳照片輔助說明？（非必要）');

    let hasPhoto = uploadedFilePreview !== null;
    let photoHTML = '';

    if (hasPhoto) {
        photoHTML = `
            <img class="upload-preview preview-image-dynamic" src="${uploadedFilePreview}" alt="" style="display: block; cursor: pointer; max-width: 100%; max-height: 200px; margin: 20px auto; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
           
            <div class="quick-replies" style="margin-top: 18px;">
                <button class="quick-reply-btn skip-photo-btn-dynamic">
                    移除照片
                </button>
                <button class="quick-reply-btn confirm-photo-btn-dynamic">
                    確認上傳
                </button>
            </div>
        `;
    } else {
        photoHTML = `
            <div class="upload-area upload-area-dynamic">
                <div class="upload-icon">📷</div>
                <div style="font-weight: 600; margin-bottom: 8px; color: #2d3436;">點擊上傳照片</div>
                <div style="font-size: 13px; color: #868e96;">支援 JPG、PNG 格式</div>
            </div>
            <img class="upload-preview preview-image-dynamic" alt="" style="display: none;">
           
            <div class="quick-replies" style="margin-top: 18px;">
                <button class="quick-reply-btn skip-photo-btn-dynamic">
                    跳過不上傳
                </button>
            </div>
        `;
    }

    addBotMessage(photoHTML);

    // 綁定事件
    setTimeout(() => {
        $(document).off('click', '.upload-area-dynamic').on('click', '.upload-area-dynamic', handleUploadClick);
        $(document).off('click', '.preview-image-dynamic').on('click', '.preview-image-dynamic', previewUploadedImage);
    }, 100);
}

function handleUploadClick() {
    const fileInput = $('<input type="file" class="temp-file-input" accept="image/*" style="display: none;">');
    $('body').append(fileInput);

    fileInput.on('change', function (e) {
        handleFileUpload(e);
        fileInput.remove();
    });

    fileInput.click();
}

// ==================== 處理檔案上傳 ====================

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('請選擇 JPG、PNG、GIF 或 WebP 格式的圖片', 'warning');
        return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('檔案大小超過 5MB 限制', 'warning');
        return;
    }

    showToast('正在處理圖片...', 'info');

    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result;
        if (!base64Data.startsWith('data:image/')) {
            showToast('檔案格式無效', 'warning');
            return;
        }

        uploadedFilePreview = base64Data;
        showToast('照片已選擇', 'success');

        // 重新顯示照片步驟
        goBackToStep('input_photo');
    };

    reader.onerror = function () {
        showToast('讀取檔案失敗', 'warning');
    };

    reader.readAsDataURL(file);
}

// ==================== 跳過照片 ====================

function skipPhoto() {
    console.log('跳過照片，當前步驟:', currentStep);

    if (uploadedFilePreview) {
        // 移除照片
        uploadedFile = null;
        uploadedFilePreview = null;
        showToast('照片已移除', 'info');

        // 重新顯示照片步驟
        goBackToStep('input_photo');
    } else {
        // 跳過不上傳
        uploadedFile = null;
        uploadedFilePreview = null;

        // 關鍵修復：檢查是否已經有「不上傳照片」訊息
        const $existingSkipMessages = $('.user-message').filter(function () {
            return $(this).find('.message-content').text() === '不上傳照片';
        });

        // 如果已經有「不上傳照片」訊息，先移除它
        if ($existingSkipMessages.length > 0) {
            console.log('發現重複的「不上傳照片」訊息，移除數量:', $existingSkipMessages.length);
            $existingSkipMessages.remove();
        }

        // 添加用戶訊息
        addUserMessage('不上傳照片');

        // 短暫延遲後顯示確認頁面
        setTimeout(() => {
            setStep('confirmation');
        }, 300);
    }
}

// ==================== 確認照片 ====================

function confirmPhoto() {
    console.log('確認照片，當前步驟:', currentStep);

    if (uploadedFilePreview) {
        // 關鍵修復：檢查是否已經有「已上傳照片」訊息
        const $existingConfirmMessages = $('.user-message').filter(function () {
            return $(this).find('.message-content').text() === '已上傳照片';
        });

        // 如果已經有「已上傳照片」訊息，先移除它
        if ($existingConfirmMessages.length > 0) {
            console.log('發現重複的「已上傳照片」訊息，移除數量:', $existingConfirmMessages.length);
            $existingConfirmMessages.remove();
        }

        // 添加用戶訊息
        addUserMessage('已上傳照片');

        // 短暫延遲後顯示確認頁面
        setTimeout(() => {
            setStep('confirmation');
        }, 300);
    }
}

// ==================== 顯示確認頁面 ====================

function showConfirmation() {
    console.log('顯示確認頁面，當前步驟:', currentStep);

    // 清除所有確認相關的舊訊息
    const confirmationMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('horizontal-case-card') ||
            content.includes('detail-label-text') ||
            content.includes('edit-info-btn');
    });

    if (confirmationMessages.length > 0) {
        console.log('發現舊的確認頁面，移除');
        confirmationMessages.remove();
    }

    // 檢查是否已經有成功頁面，如果有就移除
    const successMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('success-container') ||
            content.includes('通報完成');
    });

    if (successMessages.length > 0) {
        console.log('發現成功頁面，移除');
        successMessages.remove();

        // 重置步驟為 confirmation
        currentStep = 'confirmation';
    }

    const serviceTypeText = SERVICE_TYPES[currentService] || '通報';

    let locationText = '';
    if (selectedLocation) {
        const locations = getCurrentLocations();
        const location = locations.find(loc => loc.id === selectedLocation);
        locationText = location ? location.label : selectedLocation;
    } else if (customLocation) {
        locationText = customLocation;
    }

    const displayFloor = currentService === 'office' ? `${selectedFloor}F` : `${selectedFloor}F`;
    let displayDescription = problemDescription;
    if (!problemDescription ||
        problemDescription === '' ||
        problemDescription === '請檢查、進行環境清潔或設備報修' ||
        problemDescription.trim() === '') {
        displayDescription = '請檢查、進行環境清潔或設備報修';
    }

    const hasPhoto = uploadedFilePreview ? '有' : '無';
    const photoClass = uploadedFilePreview ? 'has-photo' : 'photo-value';

    const confirmationHTML = `
        <div class="horizontal-case-card">
            <div class="horizontal-details-list">
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <span class="detail-label-text">類型</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${serviceTypeText}</span>
                    </div>
                </div>
               
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <span class="detail-label-text">樓層</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${displayFloor}</span>
                    </div>
                </div>
               
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <span class="detail-label-text">地點</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${locationText}</span>
                    </div>
                </div>
               
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <span class="detail-label-text">照片</span>
                    </div>
                    <div class="detail-value-section ${photoClass}">
                        <span class="detail-value-text">${hasPhoto}</span>
                    </div>
                </div>
            </div>
           
            <div class="description-row">
                <div class="description-label-section">
                    <span class="description-label-text">描述</span>
                </div>
                <div class="description-content-section">
                    <div class="description-content-text"></div>
                </div>
            </div>
        </div>
       
        <div class="quick-replies">
            <button class="quick-reply-btn edit-info-btn">
                ✏️ 修改資訊
            </button>
            <button class="quick-reply-btn submit-report-btn" style="background: #4a90e2 !important; color: white !important;">
                ✓ 確認提交
            </button>
        </div>
    `;

    addBotMessage(confirmationHTML);

    const $lastMessage = $('.bot-message').last();
    const $descriptionText = $lastMessage.find('.description-content-text');
    $descriptionText.text(displayDescription);

    setupStandardButtonHandlers();
}

// ==================== 提交通報 ====================

function submitReport() {
    console.log('========== 提交通報 ==========', '當前步驟:', currentStep);

    // 如果已經提交過，避免重複提交
    if (currentStep === 'submitting' || currentStep === 'completed') {
        console.log('已經在提交中或已完成，跳過重複提交');
        return;
    }

    currentStep = 'submitting';

    const progressId = 'progress-' + Date.now();
    const progressHTML = `
        <div class="progress-indicator" id="${progressId}">
            <div class="progress-title">通報處理中</div>
            <div class="progress-steps">
                <div class="progress-step active" data-step="1">
                    <div class="step-icon">1</div>
                    <div class="step-label">資料驗證</div>
                </div>
                <div class="progress-step" data-step="2">
                    <div class="step-icon">2</div>
                    <div class="step-label">照片處理</div>
                </div>
                <div class="progress-step" data-step="3">
                    <div class="step-icon">3</div>
                    <div class="step-label">發送通報</div>
                </div>
                <div class="progress-step" data-step="4">
                    <div class="step-icon">4</div>
                    <div class="step-label">完成</div>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-message">正在處理您的通報，請稍候...</div>
        </div>
    `;

    addBotMessage(progressHTML);

    function updateProgress(step, message) {
        const $progress = $(`#${progressId}`);
        if ($progress.length === 0) {
            console.log('進度條元素不存在，跳過更新');
            return;
        }

        $progress.find('.progress-step').removeClass('active');
        $progress.find(`.progress-step[data-step="${step}"]`).addClass('active');

        const percentage = ((step - 1) / 4) * 100;
        $progress.find('.progress-fill').css('width', `${percentage}%`);

        if (message) {
            $progress.find('.progress-message').text(message);
        }
    }

    updateProgress(1, '正在驗證通報資料...');

    const today = new Date();
    const reportDate = today.getFullYear() + '/' +
        String(today.getMonth() + 1).padStart(2, '0') + '/' +
        String(today.getDate()).padStart(2, '0');
    const reportTime = String(today.getHours()).padStart(2, '0') + ':' +
        String(today.getMinutes()).padStart(2, '0');

    let locationText = '';
    if (selectedLocation) {
        const locations = getCurrentLocations();
        const location = locations.find(loc => loc.id === selectedLocation);
        locationText = location ? location.label : selectedLocation;
    } else if (customLocation) {
        locationText = customLocation;
    }

    const displayFloor = currentService === 'office' ? `${selectedFloor}F` : `${selectedFloor}F`;
    const serviceTypeText = SERVICE_TYPES[currentService] || '未分類';

    let lineDescription = problemDescription;
    if (!lineDescription || lineDescription === '' ||
        lineDescription === '請檢查、進行環境清潔或設備報修' || lineDescription.trim() === '') {
        lineDescription = '請檢查、進行環境清潔或設備報修';
    }

    const formData = {
        action: 'report',
        report_date: reportDate,
        report_floor: displayFloor,
        report_location: locationText,
        description: lineDescription,
        service_type: serviceTypeText,
        report_time: reportTime,
        sign_in_time: '',
        sign_in_interval: '',
        sign_in_check: '',
    };

    let processPromise;

    updateProgress(2, '正在處理照片...');

    if (uploadedFile) {
        processPromise = compressAndUploadImage()
            .then(photoId => {
                if (photoId) {
                    formData.photo_id = photoId;
                }
                return formData;
            });
    } else {
        processPromise = Promise.resolve(formData);
    }

    processPromise
        .then(data => {
            updateProgress(3, '正在發送通報至系統...');
            return sendReportToBackend(data);
        })
        .then(() => {
            updateProgress(4, '通報完成！');
            setTimeout(() => {
                const $progress = $(`#${progressId}`);
                if ($progress.length > 0) {
                    $progress.remove();
                }
                setStep('completed');
            }, 1000);
        })
        .catch(error => {
            console.error('通報失敗:', error);
            showToast('通報過程中發生錯誤，請稍後再試', 'warning');

            const $progress = $(`#${progressId}`);
            if ($progress.length > 0) {
                $progress.remove();
            }

            currentStep = 'confirmation';
            goBackToStep('confirmation');
        });
}

// ==================== 壓縮並上傳圖片 ====================

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

        reader.onerror = function () {
            reject(new Error('讀取檔案失敗'));
        };

        reader.readAsDataURL(uploadedFile);
    });
}

// ==================== 發送通報到後端 ====================

function sendReportToBackend(formData) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: API_CONFIG.MAIN_API,
            method: 'POST',
            data: formData,
            success: function (response) {
                console.log('通報成功:', response);
                resolve(response);
            },
            error: function (xhr, status, error) {
                console.error('通報失敗:', error);
                reject(error);
            }
        });
    });
}

// ==================== 顯示成功頁面 ====================

function showSuccessPage() {
    console.log('顯示成功頁面，當前步驟:', currentStep);

    currentStep = 'completed';

    const serviceTypeText = SERVICE_TYPES[currentService] || '通報';

    const successHTML = `
        <div class="success-container">
            <div class="success-icon">✓</div>
           
            <div style="margin-bottom: 25px;">
                <div class="success-title">${serviceTypeText}通報完成</div>
            </div>
           
            <div style="margin-bottom: 35px;">
                <div class="success-message">感謝您的通知</div>
                <div class="success-message">讓我們做得更好</div>
            </div>
           
            <div style="height: 1px; background: #e9ecef; margin: 30px 0;"></div>
           
            <div class="quick-replies">
                <button class="quick-reply-btn new-report-btn-dynamic">
                    新的通報
                </button>
            </div>
        </div>
    `;

    addBotMessage(successHTML);
    setupStandardButtonHandlers();
}

// ==================== 模態框相關函數 ====================

function showFloorModal() {
    console.log('顯示樓層模態框，當前選擇的樓層:', selectedFloor);

    const modalTitle = currentService === 'shopping' ? '選擇購物中心樓層' : '選擇觀景台樓層';
    $('#floorModalTitle').text(modalTitle);

    let floors = [];
    if (currentService === 'shopping') floors = SHOPPING_FLOORS;
    else if (currentService === 'observatory') floors = OBSERVATORY_FLOORS;

    const floorOptionsHTML = floors.map(floor => {
        const displayFloor = `${floor}F`;
        const isSelected = (floor.toString() === selectedFloor.toString());
        const btnClass = isSelected ?
            'floor-option-btn floor-option-btn-dynamic selected' :
            'floor-option-btn floor-option-btn-dynamic';

        return `
            <button class="${btnClass}"
                    data-floor="${floor}">
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
                <input type="text" class="custom-location-input custom-location-input-dynamic"
                       id="modalCustomLocationInput"
                       placeholder="輸入自訂地點"
                       value="${customLocation || ''}">
            </div>
            <button class="custom-location-confirm-btn custom-location-confirm-btn-dynamic">
                確認自訂地點
            </button>
        </div>
    `;

    const locationOptionsHTML = locations.map(location => {
        const btnClass = (location.id === selectedLocation) ?
            'location-option-btn location-option-btn-dynamic selected' :
            'location-option-btn location-option-btn-dynamic';

        return `
            <button class="${btnClass}"
                    data-location="${location.id}">
                ${location.label}
            </button>
        `;
    }).join('');

    $('#locationOptions').html(`
        ${locationOptionsHTML}
        ${customLocationHTML}
    `);

    $(document).off('click', '.custom-location-confirm-btn-dynamic').on('click', '.custom-location-confirm-btn-dynamic', confirmCustomLocation);

    $('#locationModal').show();
}

// ==================== 選擇樓層 ====================
function selectFloor(floor) {
    console.log('選擇樓層:', floor, '之前選擇的樓層:', selectedFloor);

    if (!floor) return;

    selectedFloor = floor.toString();
    const displayFloor = `${floor}F`;

    console.log('更新後 selectedFloor:', selectedFloor);

    // 更新 UI
    if (currentService === 'shopping' || currentService === 'observatory') {
        const $floorBtn = $('.floor-select-btn-dynamic');
        if ($floorBtn.length) {
            $floorBtn.find('.floor-value').text(displayFloor);
            $floorBtn.addClass('has-selection');
            console.log('已更新表單按鈕文字:', displayFloor);
        }
    }

    // 確保模態框中的按鈕狀態同步
    $('.floor-option-btn').removeClass('selected');
    const $targetBtn = $(`.floor-option-btn[data-floor="${floor}"]`);
    if ($targetBtn.length) {
        $targetBtn.addClass('selected');
        console.log('已為模態框按鈕添加 selected 類別');
    }

    closeFloorModal();
    showToast(`已選擇：${displayFloor}`, 'success');
}

// ==================== 選擇地點 ====================
function selectLocation(locationId) {
    if (!locationId) return;

    selectedLocation = locationId;
    customLocation = '';

    // 查找地點標籤
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

    // 更新 UI
    if (currentService === 'office') {
        const $locationBtn = $('.location-select-btn-office');
        $locationBtn.find('.location-value').text(locationLabel);
        $locationBtn.addClass('has-selection');
    } else {
        const $locationBtn = $('.location-select-btn-dynamic');
        $locationBtn.find('.location-value').text(locationLabel);
        $locationBtn.addClass('has-selection');
    }

    closeLocationModal();
    showToast(`已選擇：${locationLabel}`, 'success');
}

function confirmCustomLocation() {
    const customInput = $('#modalCustomLocationInput');
    let customValue = customInput.val().trim();

    if (!customValue || customValue === '輸入自訂地點') {
        showToast('請輸入自訂地點', 'warning');
        return;
    }

    if (customValue.length > 100) {
        showToast('自訂地點長度超過100字限制', 'warning');
        return;
    }

    selectedLocation = '';
    customLocation = customValue;

    if (currentService === 'office') {
        const $locationBtn = $('.location-select-btn-office');
        $locationBtn.find('.location-value').text(customValue);
        $locationBtn.addClass('has-selection');
    } else {
        const $locationBtn = $('.location-select-btn-dynamic');
        $locationBtn.find('.location-value').text(customValue);
        $locationBtn.addClass('has-selection');
    }

    closeLocationModal();
    showToast(`已設定自訂地點：${customValue}`, 'success');
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

// ==================== 輔助函數 ====================

function updateButtonTextColor($btn) {
    const $value = $btn.find('.floor-value, .location-value');
    if ($value.length) {
        const text = $value.text();
        const isPlaceholder = text.includes('請選擇') || text.includes('Select');
        $value.css('color', isPlaceholder ? '#999' : '#2d3436');
    }
}

// ==================== 聊天訊息功能 ====================

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
    scrollToBottom();

    console.log('添加Bot訊息，ID:', messageId, '內容摘要:', content.substring(0, 50));

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
                <div class="message-content"></div>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        </div>
    `;

    const $message = $(messageHTML);
    $message.find('.message-content').text(content);

    $('#chatContainer').append($message);
    scrollToBottom();

    console.log('添加User訊息，ID:', messageId, '內容:', content);

    return '#' + messageId;
}

// ==================== 輔助函數 ====================

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