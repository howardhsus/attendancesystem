// ==================== 配置區塊 ====================

const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbwKxZON3tIGAYVJAXqBEBOLEBaQlCdHgWevywV-phUOxED0fU_mmOtgaPlmc-cWGwwZ/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
};

// ==================== 跨平台按鈕狀態管理器 ====================
const ButtonStateManager = {
    // 追蹤所有按鈕組
    buttonGroups: {},

    // 初始化按鈕組
    initButtonGroup(groupId, selector, singleSelect = true) {
        this.buttonGroups[groupId] = {
            selector: selector,
            singleSelect: singleSelect,
            selected: null
        };

        // 綁定事件
        $(document).off('click', selector).on('click', selector, (e) => {
            this.handleButtonClick(groupId, $(e.currentTarget));
        });

        // 初始化樣式 - 移除所有選取樣式
        $(selector).each((index, btn) => {
            $(btn).removeClass('selected active');
        });
    },

    // 處理按鈕點擊 - 移除所有選取樣式
    handleButtonClick(groupId, $button) {
        const group = this.buttonGroups[groupId];
        if (!group) return;

        const buttonId = $button.data('id') || $button.attr('id') || $button.index();

        if (group.singleSelect) {
            // 單選模式：清除所有按鈕的選取樣式
            $(group.selector).removeClass('selected active');

            // 不設置任何選取樣式
            group.selected = buttonId;

            // 立即移除可能存在的 :active 狀態
            $button.blur();
        } else {
            // 多選模式：移除選取樣式切換
            if ($button.hasClass('selected')) {
                $button.removeClass('selected');
                group.selected = null;
            } else {
                // 不設置選取樣式
                group.selected = buttonId;
            }
        }
    },

    // 程式化選擇按鈕 - 移除選取樣式
    selectButton(groupId, buttonId) {
        const group = this.buttonGroups[groupId];
        if (!group) return;

        if (group.singleSelect) {
            $(group.selector).removeClass('selected');
        }

        const $button = $(group.selector).filter(`[data-id="${buttonId}"]`);
        if ($button.length) {
            // 不設置選取樣式
            group.selected = buttonId;
        }
    },

    // 獲取選中的按鈕
    getSelected(groupId) {
        const group = this.buttonGroups[groupId];
        return group ? group.selected : null;
    }
};

// ==================== 穩定的按鈕事件處理 ====================
function setupStableButtonHandlers() {
    // 樓層按鈕
    $(document).off('click', '.floor-option-btn').on('click', '.floor-option-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const floor = $btn.data('floor');

        // 1. 清除所有同類按鈕的狀態 - 只移除可能存在的殘留樣式
        $('.floor-option-btn').removeClass('selected active');

        // 2. 不設置任何選取樣式狀態
        // 移除原有的選取樣式設置

        // 3. 執行業務邏輯
        selectFloor(floor);
    });

    // 地點按鈕
    $(document).off('click', '.location-option-btn').on('click', '.location-option-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const locationId = $btn.data('location');

        // 1. 清除所有同類按鈕的狀態 - 只移除可能存在的殘留樣式
        $('.location-option-btn').removeClass('selected active');

        // 2. 不設置任何選取樣式狀態
        // 移除原有的選取樣式設置

        // 3. 執行業務邏輯
        selectLocation(locationId);
    });

    // 防止快速雙擊
    let lastClickTime = 0;
    $(document).on('click', '.floor-option-btn, .location-option-btn', function (e) {
        const now = Date.now();
        if (now - lastClickTime < 300) { // 300ms 防雙擊
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }
        lastClickTime = now;
    });

    // 初始化按鈕狀態管理器
    ButtonStateManager.initButtonGroup('floor-buttons', '.floor-option-btn', true);
    ButtonStateManager.initButtonGroup('location-buttons', '.location-option-btn', true);
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

// 對話步驟追蹤
let chatSteps = {
    'select_service': -1,
    'input_form': -1,
    'input_photo': -1,
    'confirmation': -1,
    'completed': -1
};

// ==================== 安全處理函數 ====================

function sanitizeInput(input, maxLength = 1000) {
    if (!input || typeof input !== 'string') return '';
    if (input.length > maxLength) return input.substring(0, maxLength);
    return input;
}

function safeText(text) {
    if (!text || typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

    // 獲取原始的地點參數
    const rawLocation = (urlParams.get('location') || '').trim();

    // 如果有地點，嘗試將英文翻譯成中文
    if (rawLocation) {
        // 英文到中文的地點映射
        const englishToChineseMap = {
            // Office locations
            "Men's Room": '男生廁所',
            "Ladies' Room": '女生廁所',
            'Public Corridor': '公共走道',
            'Elevator': '公共電梯',
            'Pantry': '茶水間',
            'Freight Elevator': '貨梯廳',

            // Mall locations
            'Nursing Room': '哺乳室',

            // Observatory locations
            'East Area': '東面場域',
            'West Area': '西區場域'
        };

        // 如果直接匹配英文，使用翻譯
        if (englishToChineseMap[rawLocation]) {
            autoDetectedLocation = englishToChineseMap[rawLocation];
        } else {
            // 否則保留原始值（可能是中文或自訂地點）
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

            // 重置步驟索引 - 這部分是關鍵修復
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
        if (event.target === this) {
            closeModal($(this));
        }
    });

    // 切換到英文版按鈕
    $('.report-label').off('click').on('click', function () {
        const currentParams = window.location.search;
        window.location.href = 'indexEN.html' + currentParams;
    });
    setupStableButtonHandlers();
}

// ==================== 初始化應用 ====================
$(document).ready(function () {
    parseUrlParams();
    bindEvents();

    // 初始化按鈕狀態 - 移除所有選取樣式
    $('.floor-option-btn, .location-option-btn').removeClass('selected active');

    // 如果有預選值，僅更新數據，不設置選取樣式
    if (selectedFloor) {
        // 僅更新數據，不設置樣式
        ButtonStateManager.selectButton('floor-buttons', selectedFloor);
    }

    if (selectedLocation) {
        // 僅更新數據，不設置樣式
        ButtonStateManager.selectButton('location-buttons', selectedLocation);
    }

    if (hasUrlParams && autoDetectedService && SERVICE_TYPES[autoDetectedService]) {
        initChatWithUrlParams();
    } else {
        initChat();
    }
    setTimeout(scrollToBottom, 100);
});

// ==================== 有URL參數的初始化 ====================

function initChatWithUrlParams() {
    resetApp();

    $('#chatContainer').empty();

    setTimeout(() => {
        const serviceName = SERVICE_TYPES[autoDetectedService];

        // 直接顯示通報表單，不顯示服務選擇
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

    // 綁定事件
    setTimeout(() => {
        $(document).off('click', '.service-button').on('click', '.service-button', function () {
            const serviceType = $(this).data('service');
            selectService(serviceType);
        });
    }, 100);
}

// ==================== 選擇服務類型 ====================

function selectService(serviceType) {
    console.log('選擇服務類型:', serviceType);

    // 清除之前的選擇 - 只移除可能存在的殘留樣式
    $('.service-button').removeClass('selected');

    // 更新服務類型 - 完全重置所有狀態
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

        // 直接顯示表單，不透過 setTimeout
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

    // 先嘗試直接匹配中文
    const exactMatch = locations.find(loc =>
        loc.label === locationText ||
        loc.id === locationText
    );

    if (exactMatch) return exactMatch;

    // 如果沒有直接匹配，檢查是否為英文地點，嘗試翻譯匹配
    const englishToChineseMap = {
        // Office locations
        "Men's Room": '男生廁所',
        "Ladies' Room": '女生廁所',
        'Public Corridor': '公共走道',
        'Elevator': '公共電梯',
        'Pantry': '茶水間',
        'Freight Elevator': '貨梯廳',

        // Mall locations
        'Nursing Room': '哺乳室',

        // Observatory locations
        'East Area': '東面場域',
        'West Area': '西區場域'
    };

    // 檢查是否為英文地點
    if (englishToChineseMap[locationText]) {
        const translatedLocation = englishToChineseMap[locationText];
        const translatedMatch = locations.find(loc => loc.label === translatedLocation);
        if (translatedMatch) return translatedMatch;
    }

    // 最後嘗試部分匹配
    const partialMatch = locations.find(loc =>
        locationText.includes(loc.label) ||
        loc.label.includes(locationText)
    );

    if (partialMatch) return partialMatch;

    return null;
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

    // 檢查並移除可能存在的照片詢問訊息
    const existingPhotoMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').text() || '';
        return content.includes('是否需要上傳照片輔助說明');
    });

    if (existingPhotoMessages.length > 0) {
        console.log('發現照片詢問訊息，移除');
        existingPhotoMessages.remove();
    }

    // 檢查並移除可能存在的確認頁面
    const existingConfirmations = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('horizontal-case-card');
    });

    if (existingConfirmations.length > 0) {
        console.log('發現確認頁面，移除');
        existingConfirmations.remove();
    }

    // 檢查並移除可能存在的進度條
    const existingProgress = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('progress-indicator');
    });

    if (existingProgress.length > 0) {
        console.log('發現進度條，移除');
        existingProgress.remove();
    }

    // 檢查並移除可能存在的成功頁面
    const existingSuccess = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('success-container');
    });

    if (existingSuccess.length > 0) {
        console.log('發現成功頁面，移除');
        existingSuccess.remove();
    }

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

        let descriptionValue = '';
        let descriptionClass = 'form-control description-input-office';

        if (problemDescription && problemDescription !== '請檢查、進行環境清潔或設備報修') {
            descriptionValue = problemDescription;
            descriptionClass += ' has-user-input';
        } else {
            descriptionValue = '請檢查、進行環境清潔或設備報修';
            descriptionClass += ' placeholder-active';
        }

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
                <button class="location-select-btn location-select-btn-office">
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

        const formHTML = `
            <div class="form-title">${formTitle}</div>
           
            <div class="form-group">
                <label class="form-label">樓層 <span>*</span></label>
                <button class="floor-select-btn floor-select-btn-dynamic">
                    <div class="floor-display">
                        <span class="floor-value">${floorDisplayText}</span>
                        <span class="floor-arrow">▼</span>
                    </div>
                </button>
            </div>
           
            <div class="form-group">
                <label class="form-label">地點 <span>*</span></label>
                <button class="location-select-btn location-select-btn-dynamic">
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
        $(document).on('click', '.confirm-form-btn-office', confirmForm);
    } else {
        $(document).on('click', '.floor-select-btn-dynamic', showFloorModal);
        $(document).on('click', '.location-select-btn-dynamic', showLocationModal);
        $(document).on('click', '.confirm-form-btn-dynamic', confirmForm);
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

    // 安全獲取 textarea 的值
    let descriptionValue = descriptionInput.val().trim();

    if (descriptionInput.hasClass('placeholder-active') ||
        !descriptionValue ||
        descriptionValue === '請檢查、進行環境清潔或設備報修') {
        problemDescription = '請檢查、進行環境清潔或設備報修';
    } else {
        // 前端基本長度檢查
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

    // 添加新的描述訊息 - 使用 text() 方法安全顯示
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
        // 已經有照片：顯示照片和確認上傳按鈕
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
        // 沒有照片：顯示上傳區域
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
        $(document).off('click', '.skip-photo-btn-dynamic').on('click', '.skip-photo-btn-dynamic', skipPhoto);
        $(document).off('click', '.confirm-photo-btn-dynamic').on('click', '.confirm-photo-btn-dynamic', confirmPhoto);
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

    // 先檢查並移除可能存在的進度條殘留
    const progressMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('progress-indicator') ||
            content.includes('progress-title') ||
            content.includes('progress-steps');
    });

    if (progressMessages.length > 0) {
        console.log('發現進度條殘留，移除數量:', progressMessages.length);
        progressMessages.remove();
    }

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

        // 關鍵修復：找到最後的照片上傳區域訊息
        const $photoAreaMessages = $('.bot-message').filter(function () {
            const content = $(this).find('.message-content').html() || '';
            return content.includes('upload-area-dynamic') ||
                content.includes('upload-preview') ||
                content.includes('skip-photo-btn-dynamic') ||
                content.includes('confirm-photo-btn-dynamic');
        });

        if ($photoAreaMessages.length > 0) {
            // 在照片上傳區域訊息後面添加用戶訊息
            const $lastPhotoAreaMessage = $photoAreaMessages.last();
            const userMessageId = 'msg-' + Date.now();
            const userMessageHTML = `
                <div class="message user-message" id="${userMessageId}">
                    <div class="avatar user-avatar">
                        <div class="avatar-placeholder">👤</div>
                    </div>
                    <div class="message-content-wrapper">
                        <div class="message-content">不上傳照片</div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                </div>
            `;

            $(userMessageHTML).insertAfter($lastPhotoAreaMessage);
            console.log('已添加「不上傳照片」訊息在上傳區域後面，ID:', userMessageId);
        } else {
            // 如果找不到照片訊息，使用原來的 addUserMessage
            addUserMessage('不上傳照片');
        }

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

        // 關鍵修復：找到最後的照片上傳區域訊息
        const $photoAreaMessages = $('.bot-message').filter(function () {
            const content = $(this).find('.message-content').html() || '';
            return content.includes('upload-area-dynamic') ||
                content.includes('upload-preview') ||
                content.includes('skip-photo-btn-dynamic') ||
                content.includes('confirm-photo-btn-dynamic');
        });

        if ($photoAreaMessages.length > 0) {
            // 在照片上傳區域訊息後面添加用戶訊息
            const $lastPhotoAreaMessage = $photoAreaMessages.last();
            const userMessageId = 'msg-' + Date.now();
            const userMessageHTML = `
                <div class="message user-message" id="${userMessageId}">
                    <div class="avatar user-avatar">
                        <div class="avatar-placeholder">👤</div>
                    </div>
                    <div class="message-content-wrapper">
                        <div class="message-content">已上傳照片</div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                </div>
            `;

            $(userMessageHTML).insertAfter($lastPhotoAreaMessage);
            console.log('已添加「已上傳照片」訊息在上傳區域後面，ID:', userMessageId);
        } else {
            // 如果找不到照片訊息，使用原來的 addUserMessage
            addUserMessage('已上傳照片');
        }

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

    // 檢查並移除可能存在的進度條
    const progressMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('progress-indicator') ||
            content.includes('progress-title') ||
            content.includes('progress-steps');
    });

    if (progressMessages.length > 0) {
        console.log('發現進度條，移除數量:', progressMessages.length);
        progressMessages.remove();
    }

    // 檢查並移除可能存在的空白訊息（進度條殘留）
    const emptyMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        // 檢查是否是空內容或只有空白字符
        return content.trim() === '' ||
            content === '<div class="progress-indicator" id="progress-"></div>';
    });

    if (emptyMessages.length > 0) {
        console.log('發現空白訊息，移除數量:', emptyMessages.length);
        emptyMessages.remove();
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

    // 創建確認頁面的 HTML 結構，描述內容留空
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

    // 添加訊息到聊天室
    addBotMessage(confirmationHTML);

    // 找到剛剛添加的描述內容區域，並使用 text() 方法安全設置內容
    const $lastMessage = $('.bot-message').last();
    const $descriptionText = $lastMessage.find('.description-content-text');

    // 使用 text() 方法設置描述內容 - 關鍵修復：只顯示問題描述，不顯示「不上傳照片」
    // 問題描述應該是 problemDescription，而不是用戶的「不上傳照片」訊息
    $descriptionText.text(displayDescription);

    // 綁定事件
    setTimeout(() => {
        $(document).off('click', '.edit-info-btn').on('click', '.edit-info-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('點擊修改資訊按鈕，當前步驟:', currentStep);

            // 先清除所有後續對話
            const $messages = $('.message');
            const formMessageIndex = $messages.filter(function () {
                return $(this).find('.form-title').length > 0;
            }).index();

            if (formMessageIndex >= 0) {
                // 從表單之後開始清除所有訊息
                for (let i = $messages.length - 1; i > formMessageIndex; i--) {
                    $($messages[i]).remove();
                }

                // 重置步驟索引
                chatSteps['input_form'] = formMessageIndex;
                chatSteps['input_photo'] = -1;
                chatSteps['confirmation'] = -1;

                // 重新顯示表單
                currentStep = 'input_form';
                showStep('input_form');
            } else {
                // 如果找不到表單，返回表單步驟
                goBackToStep('input_form');
            }
        });

        $(document).off('click', '.submit-report-btn').on('click', '.submit-report-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();
            submitReport();
        });
    }, 100);
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

    // 顯示進度指示器
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

    // 更新進度條
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

    // 開始處理流程
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

    // 準備要發送的原始資料
    const formData = {
        action: 'report',
        report_date: reportDate,
        report_floor: displayFloor,
        report_location: locationText,
        description: lineDescription, // 傳送原始資料
        service_type: serviceTypeText,
        report_time: reportTime,
        sign_in_time: '',
        sign_in_interval: '',
        sign_in_check: '',
    };

    // 使用 Promise 鏈來處理進度顯示
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
                // 安全移除進度條
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

            // 安全移除進度條
            const $progress = $(`#${progressId}`);
            if ($progress.length > 0) {
                $progress.remove();
            }

            // 返回確認頁面
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

    // 確保當前步驟是 completed
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

    $(document).off('click', '.new-report-btn-dynamic').on('click', '.new-report-btn-dynamic', function () {
        if (hasUrlParams && autoDetectedService) {
            initChatWithUrlParams();
        } else {
            initChat();
        }
    });
}

// ==================== 模態框相關函數 - 修復 iOS 背景閃爍問題 ====================

function showFloorModal() {
    // 修復問題3：防止背景滾動擴展
    preventBackgroundScroll();

    const modalTitle = currentService === 'shopping' ? '選擇購物中心樓層' : '選擇觀景台樓層';
    $('#floorModalTitle').text(modalTitle);

    let floors = [];
    if (currentService === 'shopping') floors = SHOPPING_FLOORS;
    else if (currentService === 'observatory') floors = OBSERVATORY_FLOORS;

    const floorOptionsHTML = floors.map(floor => {
        const displayFloor = `${floor}F`;
        // 移除 selected 類別，不設置任何選取樣式
        return `
            <button class="floor-option-btn floor-option-btn-dynamic"
                    data-floor="${floor}">
                ${displayFloor}
            </button>
        `;
    }).join('');

    $('#floorOptions').html(floorOptionsHTML);

    $(document).off('click', '.floor-option-btn-dynamic').on('click', '.floor-option-btn-dynamic', function () {
        const floor = $(this).data('floor');
        selectFloor(floor);
    });

    $('#floorModal').show();
}

function showLocationModal() {
    // 修復問題3：防止背景滾動擴展
    preventBackgroundScroll();

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
                <input type="text" class="custom-location-input custom-location-input-dynamic ${customLocation ? '' : 'placeholder-active'}"
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
        // 移除 selected 類別，不設置任何選取樣式
        return `
            <button class="location-option-btn location-option-btn-dynamic"
                    data-location="${location.id}">
                ${location.label}
            </button>
        `;
    }).join('');

    $('#locationOptions').html(`
        ${locationOptionsHTML}
        ${customLocationHTML}
    `);

    $(document).off('click', '.location-option-btn-dynamic').on('click', '.location-option-btn-dynamic', function () {
        const locationId = $(this).data('location');
        selectLocation(locationId);
    });

    $(document).off('click', '.custom-location-confirm-btn-dynamic').on('click', '.custom-location-confirm-btn-dynamic', confirmCustomLocation);

    $(document).off('focus blur', '.custom-location-input-dynamic')
        .on('focus', '.custom-location-input-dynamic', function () {
            if ($(this).hasClass('placeholder-active')) {
                $(this).removeClass('placeholder-active');
                $(this).val('');
            }
        })
        .on('blur', '.custom-location-input-dynamic', function () {
            if (!$(this).val().trim()) {
                $(this).addClass('placeholder-active');
                $(this).val('輸入自訂地點');
            }
        });

    $('#locationModal').show();
}

// ==================== 選擇樓層 ====================
function selectFloor(floor) {
    if (!floor) return;

    selectedFloor = floor;
    const displayFloor = `${floor}F`;

    // 更新 UI - 僅更新文字，不設置選取樣式
    if (currentService === 'shopping' || currentService === 'observatory') {
        $('.floor-select-btn-dynamic .floor-value').text(displayFloor);
    }

    // 確保模態框中的按鈕沒有選取樣式
    $('.floor-option-btn').removeClass('selected');

    // 使用按鈕狀態管理器確保狀態一致（但不設置樣式）
    ButtonStateManager.selectButton('floor-buttons', floor);

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

    // 更新 UI - 僅更新文字，不設置選取樣式
    if (currentService === 'office') {
        $('.location-select-btn-office .location-value').text(locationLabel);
    } else {
        $('.location-select-btn-dynamic .location-value').text(locationLabel);
    }

    // 確保模態框中的按鈕沒有選取樣式
    $('.location-option-btn').removeClass('selected');

    // 使用按鈕狀態管理器確保狀態一致（但不設置樣式）
    ButtonStateManager.selectButton('location-buttons', locationId);

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
        $('.location-select-btn-office .location-value').text(customValue);
    } else {
        $('.location-select-btn-dynamic .location-value').text(customValue);
    }

    closeLocationModal();
    showToast(`已設定自訂地點：${customValue}`, 'success');
}

function closeFloorModal() {
    closeModal($('#floorModal'));
}

function closeLocationModal() {
    closeModal($('#locationModal'));
}

function closeImageModal() {
    closeModal($('#imageModal'));
}

// 新增：統一的模態框關閉函數
function closeModal($modal) {
    $modal.hide();
    // 修復問題3：恢復背景滾動
    restoreBackgroundScroll();
}

// 新增：防止背景滾動
function preventBackgroundScroll() {
    // 記錄當前滾動位置 - 使用標準的 scrollY
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    // 將滾動位置設置到 body 上
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    // 添加 padding 來補償滾動條消失的空間
    document.body.style.paddingRight = window.innerWidth - document.documentElement.clientWidth + 'px';
}

// 新增：恢復背景滾動
function restoreBackgroundScroll() {
    // 獲取保存的滾動位置
    const scrollY = Math.abs(parseInt(document.body.style.top || '0'));
    // 恢復 body 樣式
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    // 恢復滾動位置
    if (scrollY) {
        window.scrollTo(0, scrollY);
    }
}

function previewUploadedImage() {
    if (uploadedFilePreview) {
        $('#modalImage').attr('src', uploadedFilePreview);
        $('#imageModal').show();
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

    // 使用 text() 方法安全顯示用戶輸入的內容
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