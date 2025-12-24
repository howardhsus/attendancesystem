/* ============================================================================
 * IOSSpatialBugShield
 * 專治 iOS Safari / WebView 的螢幕座標記憶 Active Bug
 * ========================================================================== */
window.IOSSpatialBugShield = (function () {
    'use strict';

    // 精確檢測 iOS Safari（包含 WebView）
    const isIOSSafari = (() => {
        const ua = navigator.userAgent;
        const isiOS = /iP(hone|od|ad)/.test(ua);
        const isWebKit = /WebKit/.test(ua);
        const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
        const isWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/.test(ua);

        return (isiOS && isWebKit && !isOtherBrowser) || isWebView;
    })();

    console.log('🛡️ IOSSpatialBugShield loaded, iOS Safari:', isIOSSafari);

    // 強制清掉所有可能的焦點和活動狀態
    function forceBlur() {
        const active = document.activeElement;
        if (active instanceof HTMLElement) {
            active.blur();
            active.classList.remove('is-pressed', 'active');
        }

        // 清除所有殘留的 is-pressed 狀態
        document.querySelectorAll('.is-pressed').forEach(el => {
            el.classList.remove('is-pressed');
        });
    }

    // 核心：打斷 Safari 的「螢幕座標記憶」
    function hardBreakSpatialState() {
        if (!isIOSSafari) return;

        console.log('🛡️ Breaking iOS spatial memory...');

        forceBlur();

        // 創建一個高階層的「斷層」元素
        const breaker = document.createElement('div');
        breaker.setAttribute('aria-hidden', 'true');
        breaker.setAttribute('data-ios-shield', 'breaker');

        // 關鍵：這個元素會強制 Safari 重新計算所有位置
        breaker.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            pointer-events: none;
            z-index: 999999;
            transform: translate3d(0, 0, 9999px);
            will-change: transform;
            opacity: 0.0001;
        `;

        document.body.appendChild(breaker);

        // 強制重排（這是關鍵！）
        const force = breaker.offsetHeight;
        (() => force)(); // 確保不被優化掉

        // 下一個 frame 移除 - 確保狀態被打斷
        requestAnimationFrame(() => {
            breaker.style.opacity = '0';
            setTimeout(() => {
                if (breaker.parentNode) {
                    breaker.remove();
                    console.log('🛡️ iOS spatial memory broken successfully');
                }
            }, 16);
        });
    }

    // 專門用來「安全地開 modal」
    function openModalSafely(openModalFn) {
        if (!isIOSSafari) {
            console.log('🛡️ Non-iOS, opening modal directly');
            openModalFn();
            return;
        }

        console.log('🛡️ Opening modal safely for iOS...');

        // 1. 先打斷狀態記憶
        hardBreakSpatialState();

        // 2. 給 iOS 一個完整的 frame 來清理狀態
        requestAnimationFrame(() => {
            // 3. 再執行開 modal 的邏輯
            setTimeout(() => {
                openModalFn();
                console.log('🛡️ Modal opened safely');
            }, 10);
        });
    }

    // 額外工具：安全關閉 modal
    function closeModalSafely(closeModalFn) {
        if (!isIOSSafari) {
            closeModalFn();
            return;
        }

        forceBlur();

        // 先執行關閉
        closeModalFn();

        // 給 iOS 時間清理
        setTimeout(() => {
            hardBreakSpatialState();
        }, 50);
    }

    return {
        isIOSSafari,
        openModalSafely,
        closeModalSafely,
        hardBreakSpatialState,
        forceBlur
    };
})();

// ==================== 配置區塊 ====================

const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbwKxZON3tIGAYVJAXqBEBOLEBaQlCdHgWevywV-phUOxED0fU_mmOtgaPlmc-cWGwwZ/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
};

// ==================== 跨平台按鈕狀態管理器 ====================
const ButtonStateManager = {
    buttonGroups: {},
    lastClickTime: 0,

    initButtonGroup(groupId, selector, singleSelect = true) {
        this.buttonGroups[groupId] = {
            selector: selector,
            singleSelect: singleSelect,
            selected: null
        };

        // 移除舊的事件綁定
        $(document).off('click touchstart', selector);

        // 綁定新的事件
        $(document).on('click touchstart', selector, (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 防止快速雙擊
            const now = Date.now();
            if (now - this.lastClickTime < 300) return;
            this.lastClickTime = now;

            this.handleButtonClick(groupId, $(e.currentTarget));
        });

        // 初始化樣式
        $(selector).each((index, btn) => {
            $(btn).removeClass('selected active');
        });
    },

    handleButtonClick(groupId, $button) {
        const group = this.buttonGroups[groupId];
        if (!group) return;

        const buttonId = $button.data('id') || $button.attr('id') || $button.index();

        if (group.singleSelect) {
            $(group.selector).removeClass('selected');
            $button.addClass('selected');
            group.selected = buttonId;
        } else {
            // 多選模式：切換狀態
            if ($button.hasClass('selected')) {
                $button.removeClass('selected');
                group.selected = null;
            } else {
                $button.addClass('selected');
                group.selected = buttonId;
            }
        }

        // 清除焦點
        $button.blur();
    },

    selectButton(groupId, buttonId) {
        const group = this.buttonGroups[groupId];
        if (!group) return;

        if (group.singleSelect) {
            $(group.selector).removeClass('selected');
        }

        const $button = $(group.selector).filter(`[data-id="${buttonId}"]`);
        if ($button.length) {
            $button.addClass('selected');
            group.selected = buttonId;
            $button.blur();
        }
    },

    getSelected(groupId) {
        const group = this.buttonGroups[groupId];
        return group ? group.selected : null;
    },

    clearAllStates() {
        Object.keys(this.buttonGroups).forEach(groupId => {
            const group = this.buttonGroups[groupId];
            $(group.selector).removeClass('selected');
            group.selected = null;
        });
    }
};

// ==================== 穩定的按鈕事件處理 ====================
function setupStableButtonHandlers() {
    // 樓層按鈕 - 簡化版
    $(document).off('click', '.floor-option-btn').on('click', '.floor-option-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const floor = $btn.data('floor');

        // 清除所有同類按鈕的狀態
        $('.floor-option-btn').removeClass('selected active');

        // 設置當前按鈕狀態
        $btn.addClass('selected');
        $btn.blur();

        // 執行業務邏輯
        selectFloor(floor);
    });

    // 地點按鈕 - 簡化版
    $(document).off('click', '.location-option-btn').on('click', '.location-option-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const locationId = $btn.data('location');

        // 清除所有同類按鈕的狀態
        $('.location-option-btn').removeClass('selected active');

        // 設置當前按鈕狀態
        $btn.addClass('selected');
        $btn.blur();

        // 執行業務邏輯
        selectLocation(locationId);
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
    currentStep = step;
    const messageCount = $('.message').length;
    chatSteps[step] = messageCount;
    console.log('步驟索引已更新:', step, '=>', messageCount);
    showStep(step);
}

function clearStepsAfter(step) {
    console.log('清除步驟之後的對話，目標步驟:', step, '當前步驟索引:', chatSteps[step]);

    const $chatContainer = $('#chatContainer');
    const $messages = $chatContainer.children('.message');
    const startIndex = chatSteps[step];

    if (startIndex === undefined || startIndex < 0) {
        let lastFormIndex = -1;
        $messages.each(function (index) {
            if ($(this).find('.form-title').length > 0) {
                lastFormIndex = index;
            }
        });

        if (lastFormIndex >= 0) {
            console.log('找到表單訊息索引:', lastFormIndex);
            for (let i = $messages.length - 1; i >= lastFormIndex; i--) {
                console.log('移除訊息索引:', i);
                $($messages[i]).remove();
            }

            chatSteps[step] = lastFormIndex;
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
    for (let i = $messages.length - 1; i >= startIndex; i--) {
        console.log('移除訊息索引:', i);
        $($messages[i]).remove();
    }

    Object.keys(chatSteps).forEach(key => {
        if (chatSteps[key] > startIndex) {
            chatSteps[key] = -1;
        }
    });
}

function goBackToStep(step) {
    console.log('========== 返回步驟 ==========');
    console.log('目標步驟:', step, '當前訊息數:', $('.message').length);

    // 清除所有按鈕狀態
    ButtonStateManager.clearAllStates();
    IOSSpatialBugShield.forceBlur();

    clearStepsAfter(step);
    currentStep = step;
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

    // 清除所有按鈕狀態
    ButtonStateManager.clearAllStates();
    IOSSpatialBugShield.forceBlur();
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

    // 初始化按鈕狀態
    $('.floor-option-btn, .location-option-btn').removeClass('selected active');

    // 如果有預選值，設置對應狀態
    if (selectedFloor) {
        $(`.floor-option-btn[data-floor="${selectedFloor}"]`).addClass('selected');
        ButtonStateManager.selectButton('floor-buttons', selectedFloor);
    }

    if (selectedLocation) {
        $(`.location-option-btn[data-location="${selectedLocation}"]`).addClass('selected');
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

    setTimeout(() => {
        $(document).off('click', '.service-button').on('click', '.service-button', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const serviceType = $(this).data('service');
            selectService(serviceType);
        });
    }, 100);
}

// ==================== 選擇服務類型 ====================

function selectService(serviceType) {
    console.log('選擇服務類型:', serviceType);

    $('.service-button').removeClass('selected');
    $(`.service-button[data-service="${serviceType}"]`).addClass('selected');

    currentService = serviceType;
    selectedFloor = '';
    selectedLocation = '';
    customLocation = '';
    problemDescription = '';
    uploadedFile = null;
    uploadedFilePreview = null;

    const $chatContainer = $('#chatContainer');
    const $messages = $chatContainer.children('.message');

    let serviceSelectIndex = -1;
    $messages.each(function (index) {
        if ($(this).find('.service-buttons').length > 0) {
            serviceSelectIndex = index;
        }
    });

    if (serviceSelectIndex >= 0) {
        console.log('找到服務選擇訊息索引:', serviceSelectIndex);

        for (let i = $messages.length - 1; i > serviceSelectIndex; i--) {
            console.log('移除訊息索引:', i);
            $($messages[i]).remove();
        }

        chatSteps = {
            'select_service': serviceSelectIndex,
            'input_form': -1,
            'input_photo': -1,
            'confirmation': -1,
            'completed': -1
        };

        const serviceName = SERVICE_TYPES[serviceType] || '通報';
        addUserMessage(serviceName);

        currentStep = 'input_form';
        chatSteps['input_form'] = $('.message').length;

        showReportForm();
    } else {
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

    if (partialMatch) return partialMatch;

    return null;
}

// ==================== 顯示通報表單 ====================

function showReportForm() {
    console.log('顯示通報表單，當前服務:', currentService, '當前步驟:', currentStep);

    const existingForms = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('form-title') || content.includes('通報表單');
    });

    if (existingForms.length > 0) {
        console.log('發現重複的表單，移除舊的');
        existingForms.remove();
    }

    const existingPhotoMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').text() || '';
        return content.includes('是否需要上傳照片輔助說明');
    });

    if (existingPhotoMessages.length > 0) {
        console.log('發現照片詢問訊息，移除');
        existingPhotoMessages.remove();
    }

    const existingConfirmations = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('horizontal-case-card');
    });

    if (existingConfirmations.length > 0) {
        console.log('發現確認頁面，移除');
        existingConfirmations.remove();
    }

    const existingProgress = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('progress-indicator');
    });

    if (existingProgress.length > 0) {
        console.log('發現進度條，移除');
        existingProgress.remove();
    }

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

    // 清除按壓狀態
    this.classList.remove('is-pressed');
    this.blur();

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

    const $messages = $('.message');
    const formMessageIndex = $messages.filter(function () {
        return $(this).find('.form-title').length > 0;
    }).index();

    if (formMessageIndex >= 0) {
        console.log('表單訊息索引:', formMessageIndex);

        for (let i = $messages.length - 1; i > formMessageIndex; i--) {
            console.log('移除表單後的訊息，索引:', i);
            $($messages[i]).remove();
        }

        chatSteps['input_form'] = formMessageIndex;
        chatSteps['input_photo'] = -1;
        chatSteps['confirmation'] = -1;
    }

    addUserMessage(userMessageContent);

    setTimeout(() => {
        setStep('input_photo');
    }, 500);
}

// ==================== 詢問照片 ====================

function askForPhoto() {
    console.log('詢問照片，當前狀態:', uploadedFilePreview ? '有照片' : '無照片', '當前步驟:', currentStep, '當前訊息數:', $('.message').length);

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

    setTimeout(() => {
        $(document).off('click', '.upload-area-dynamic').on('click', '.upload-area-dynamic', handleUploadClick);
        $(document).off('click', '.skip-photo-btn-dynamic').on('click', '.skip-photo-btn-dynamic', skipPhoto);
        $(document).off('click', '.confirm-photo-btn-dynamic').on('click', '.confirm-photo-btn-dynamic', confirmPhoto);
        $(document).off('click', '.preview-image-dynamic').on('click', '.preview-image-dynamic', previewUploadedImage);
    }, 100);
}

function handleUploadClick() {
    // 清除按壓狀態
    this.classList.remove('is-pressed');
    this.blur();

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

    // 清除按壓狀態
    this.classList.remove('is-pressed');
    this.blur();

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
        uploadedFile = null;
        uploadedFilePreview = null;
        showToast('照片已移除', 'info');

        goBackToStep('input_photo');
    } else {
        uploadedFile = null;
        uploadedFilePreview = null;

        const $existingSkipMessages = $('.user-message').filter(function () {
            return $(this).find('.message-content').text() === '不上傳照片';
        });

        if ($existingSkipMessages.length > 0) {
            console.log('發現重複的「不上傳照片」訊息，移除數量:', $existingSkipMessages.length);
            $existingSkipMessages.remove();
        }

        const $photoAreaMessages = $('.bot-message').filter(function () {
            const content = $(this).find('.message-content').html() || '';
            return content.includes('upload-area-dynamic') ||
                content.includes('upload-preview') ||
                content.includes('skip-photo-btn-dynamic') ||
                content.includes('confirm-photo-btn-dynamic');
        });

        if ($photoAreaMessages.length > 0) {
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
            addUserMessage('不上傳照片');
        }

        setTimeout(() => {
            setStep('confirmation');
        }, 300);
    }
}

// ==================== 確認照片 ====================

function confirmPhoto() {
    console.log('確認照片，當前步驟:', currentStep);

    // 清除按壓狀態
    this.classList.remove('is-pressed');
    this.blur();

    if (uploadedFilePreview) {
        const $existingConfirmMessages = $('.user-message').filter(function () {
            return $(this).find('.message-content').text() === '已上傳照片';
        });

        if ($existingConfirmMessages.length > 0) {
            console.log('發現重複的「已上傳照片」訊息，移除數量:', $existingConfirmMessages.length);
            $existingConfirmMessages.remove();
        }

        const $photoAreaMessages = $('.bot-message').filter(function () {
            const content = $(this).find('.message-content').html() || '';
            return content.includes('upload-area-dynamic') ||
                content.includes('upload-preview') ||
                content.includes('skip-photo-btn-dynamic') ||
                content.includes('confirm-photo-btn-dynamic');
        });

        if ($photoAreaMessages.length > 0) {
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
            addUserMessage('已上傳照片');
        }

        setTimeout(() => {
            setStep('confirmation');
        }, 300);
    }
}

// ==================== 顯示確認頁面 ====================

function showConfirmation() {
    console.log('顯示確認頁面，當前步驟:', currentStep);

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

    const successMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('success-container') ||
            content.includes('通報完成');
    });

    if (successMessages.length > 0) {
        console.log('發現成功頁面，移除');
        successMessages.remove();
        currentStep = 'confirmation';
    }

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

    const emptyMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
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

    setTimeout(() => {
        $(document).off('click', '.edit-info-btn').on('click', '.edit-info-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('點擊修改資訊按鈕，當前步驟:', currentStep);

            // 清除按壓狀態
            this.classList.remove('is-pressed');
            this.blur();

            const $messages = $('.message');
            const formMessageIndex = $messages.filter(function () {
                return $(this).find('.form-title').length > 0;
            }).index();

            if (formMessageIndex >= 0) {
                for (let i = $messages.length - 1; i > formMessageIndex; i--) {
                    $($messages[i]).remove();
                }

                chatSteps['input_form'] = formMessageIndex;
                chatSteps['input_photo'] = -1;
                chatSteps['confirmation'] = -1;

                currentStep = 'input_form';
                showStep('input_form');
            } else {
                goBackToStep('input_form');
            }
        });

        $(document).off('click', '.submit-report-btn').on('click', '.submit-report-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // 清除按壓狀態
            this.classList.remove('is-pressed');
            this.blur();

            submitReport();
        });
    }, 100);
}

// ==================== 提交通報 ====================

function submitReport() {
    console.log('========== 提交通報 ==========', '當前步驟:', currentStep);

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

    $(document).off('click', '.new-report-btn-dynamic').on('click', '.new-report-btn-dynamic', function () {
        // 清除按壓狀態
        this.classList.remove('is-pressed');
        this.blur();

        if (hasUrlParams && autoDetectedService) {
            initChatWithUrlParams();
        } else {
            initChat();
        }
    });
}

// ==================== 模態框相關函數 - 使用 IOSSpatialBugShield ====================

function showFloorModal() {
    IOSSpatialBugShield.openModalSafely(() => {
        const modalTitle = currentService === 'shopping' ? '選擇購物中心樓層' : '選擇觀景台樓層';
        $('#floorModalTitle').text(modalTitle);

        let floors = [];
        if (currentService === 'shopping') floors = SHOPPING_FLOORS;
        else if (currentService === 'observatory') floors = OBSERVATORY_FLOORS;

        const floorOptionsHTML = floors.map(floor => {
            const displayFloor = `${floor}F`;
            const isSelected = selectedFloor !== '' && selectedFloor.toString() === floor.toString();
            return `
                <button class="floor-option-btn modal-floor-btn ${isSelected ? 'modal-selected' : ''}"
                        data-floor="${floor}">
                    ${displayFloor}
                </button>
            `;
        }).join('');

        $('#floorOptions').html(floorOptionsHTML);

        $(document).off('click', '.modal-floor-btn').on('click', '.modal-floor-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const btn = this;
            const floor = $(btn).data('floor');

            // 立即清除視覺狀態
            btn.classList.remove('is-pressed');
            btn.blur();

            // 狀態完全由 JS 控制
            $('.modal-floor-btn').removeClass('modal-selected');
            btn.classList.add('modal-selected');

            // 先關 Modal（使用安全關閉）
            IOSSpatialBugShield.closeModalSafely(() => {
                $('#floorModal').hide();
            });

            // 下一 frame 再跑實際邏輯
            requestAnimationFrame(() => {
                selectFloor(floor);
            });
        });

        $('#floorModal').show();
    });
}

function showLocationModal() {
    IOSSpatialBugShield.openModalSafely(() => {
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
                <button class="custom-location-confirm-btn modal-custom-location-confirm-btn">
                    確認自訂地點
                </button>
            </div>
        `;

        // Modal 內使用不同的類別
        const locationOptionsHTML = locations.map(location => {
            const isSelected = selectedLocation === location.id;
            return `
                <button class="location-option-btn modal-location-btn ${isSelected ? 'modal-selected' : ''}"
                        data-location="${location.id}">
                    ${location.label}
                </button>
            `;
        }).join('');

        $('#locationOptions').html(`
            ${locationOptionsHTML}
            ${customLocationHTML}
        `);

        // Modal 內的事件處理
        $(document).off('click', '.modal-location-btn').on('click', '.modal-location-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const btn = this;
            const locationId = $(btn).data('location');

            // 立即清除視覺狀態
            btn.classList.remove('is-pressed');
            btn.blur();

            // 狀態完全由 JS 控制
            $('.modal-location-btn').removeClass('modal-selected');
            btn.classList.add('modal-selected');

            // 先關 Modal（使用安全關閉）
            IOSSpatialBugShield.closeModalSafely(() => {
                $('#locationModal').hide();
            });

            // 下一 frame 再跑實際邏輯
            requestAnimationFrame(() => {
                selectLocation(locationId);
            });
        });

        $(document).off('click', '.modal-custom-location-confirm-btn').on('click', '.modal-custom-location-confirm-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const btn = this;
            btn.classList.remove('is-pressed');
            btn.blur();

            confirmCustomLocation();
        });

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
    });
}

// ==================== 選擇樓層 ====================
function selectFloor(floor) {
    if (!floor) return;

    selectedFloor = floor;
    const displayFloor = `${floor}F`;

    if (currentService === 'shopping' || currentService === 'observatory') {
        $('.floor-select-btn-dynamic .floor-value').text(displayFloor);
    }

    $('.floor-option-btn').removeClass('selected');
    const $targetBtn = $(`.floor-option-btn[data-floor="${floor}"]`);
    if ($targetBtn.length) {
        $targetBtn.addClass('selected');
    }

    ButtonStateManager.selectButton('floor-buttons', floor);

    showToast(`已選擇：${displayFloor}`, 'success');
}

// ==================== 選擇地點 ====================
function selectLocation(locationId) {
    if (!locationId) return;

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

    if (currentService === 'office') {
        $('.location-select-btn-office .location-value').text(locationLabel);
    } else {
        $('.location-select-btn-dynamic .location-value').text(locationLabel);
    }

    $('.location-option-btn').removeClass('selected');
    const $targetBtn = $(`.location-option-btn[data-location="${locationId}"]`);
    if ($targetBtn.length) {
        $targetBtn.addClass('selected');
    }

    ButtonStateManager.selectButton('location-buttons', locationId);

    showToast(`已選擇：${locationLabel}`, 'success');
}

function confirmCustomLocation() {
    // 清除按壓狀態
    this.classList.remove('is-pressed');
    this.blur();

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

    IOSSpatialBugShield.closeModalSafely(() => {
        $('#locationModal').hide();
    });

    showToast(`已設定自訂地點：${customValue}`, 'success');
}

function closeFloorModal() {
    IOSSpatialBugShield.closeModalSafely(() => {
        $('#floorModal').hide();
    });
}

function closeLocationModal() {
    IOSSpatialBugShield.closeModalSafely(() => {
        $('#locationModal').hide();
    });
}

function closeImageModal() {
    IOSSpatialBugShield.closeModalSafely(() => {
        $('#imageModal').hide();
    });
}

// 統一的模態框關閉函數
function closeModal($modal) {
    IOSSpatialBugShield.closeModalSafely(() => {
        $modal.hide();
    });
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