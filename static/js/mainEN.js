// ==================== Configuration Block ====================
const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbxZ3d2bBMjfw1JWTovmV8w3wt9_ZLYHS8m0AnM-cqn29AR-wU4-k_iERc42nRobDc5R0Q/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
};

// ==================== Native DOM & Performance Optimization ====================
const DOM = {
    select: (selector) => document.querySelector(selector),
    selectAll: (selector) => document.querySelectorAll(selector),
    delegate: (eventName, selector, handler) => {
        const actualEvent = (eventName === 'focus') ? 'focusin' : (eventName === 'blur') ? 'focusout' : eventName;
        document.addEventListener(actualEvent, function(e) {
            const target = e.target.closest(selector);
            if (target) { handler.call(target, e, target); }
        });
    }
};

const PerformanceUtils = {
    throttle: (func, limit) => {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    debounce: (func, wait) => {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
};

// ==================== Dynamic Config & Status ====================
let APP_CONFIG = {}; 
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

let chatSteps = {
    'select_service': -1, 'input_form': -1, 'input_photo': -1, 'confirmation': -1, 'completed': -1
};

// ==================== URL Parameter Parsing ====================
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    hasUrlParams = urlParams.toString().length > 0;
    if (!hasUrlParams) return;

    const serviceParam = (urlParams.get('service') || '').toLowerCase();
    autoDetectedService = APP_CONFIG[serviceParam] ? serviceParam : '';

    const floorParam = urlParams.get('floor') || '';
    if (floorParam) {
        if (floorParam.toUpperCase() === 'B1') autoDetectedFloor = 'B1';
        else if (/^[1-9][0-9]*$|^[1-9][0-9]*F$/i.test(floorParam)) autoDetectedFloor = floorParam.replace(/F/gi, '');
    }

    const rawLocation = (urlParams.get('location') || '').trim();
    if (rawLocation) {
        const chineseToEnglishMap = { "男生廁所": "Men's Room", "女生廁所": "Ladies' Room", "公共走道": "Public Corridor", "公共電梯": "Elevator", "茶水間": "Pantry", "貨梯廳": "Freight Elevator", "哺乳室": "Nursing Room", "東面場域": "East Area", "西區場域": "West Area" };
        autoDetectedLocation = chineseToEnglishMap[rawLocation] || rawLocation;
    }
}

// ==================== App Initialization & Dynamic Config ====================
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('touchstart', PerformanceUtils.throttle(function (event) {
        if (event.touches.length > 1) event.preventDefault();
    }, 100), { passive: false });
    document.body.style.overscrollBehavior = 'none';

    fetchConfigAndInit();
});

async function fetchConfigAndInit() {
    try {
        const response = await fetch(API_CONFIG.MAIN_API + "?action=getConfig");
        const data = await response.json();
        
        if (data.success && data.config) {
            APP_CONFIG = data.config;
            
            const overlay = DOM.select('#loadingOverlay');
            if(overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 500);
            }

            parseUrlParams();
            bindGlobalEvents();

            if (hasUrlParams && autoDetectedService && APP_CONFIG[autoDetectedService]) {
                initChatWithUrlParams();
            } else {
                initChat();
            }
        } else {
            throw new Error("Cannot parse config");
        }
    } catch (err) {
        console.error(err);
        showToast("Initialization failed, please refresh.", "warning");
        if (DOM.select('.loading-text')) DOM.select('.loading-text').textContent = "Failed to load. Please refresh.";
        if (DOM.select('.loading-spinner')) DOM.select('.loading-spinner').style.display = 'none';
    }
}

// ==================== Global Event Binding ====================
function bindGlobalEvents() {
    DOM.delegate('click', '.logo', () => { window.location.href = window.location.pathname; });
    DOM.delegate('click', '.report-label', () => { window.location.href = 'index.html' + window.location.search; });

    DOM.delegate('click', '#closeImageModalBtn', () => closeModal(DOM.select('#imageModal')));
    DOM.delegate('click', '#closeFloorModalBtn', () => closeModal(DOM.select('#floorModal')));
    DOM.delegate('click', '#closeLocationModalBtn', () => closeModal(DOM.select('#locationModal')));
    DOM.delegate('click', '.modal', (e, target) => { if (e.target === target) closeModal(target); });

    DOM.delegate('click', '.service-button', (e, target) => selectService(target.dataset.service));

    DOM.delegate('click', '.floor-select-btn-dynamic', showFloorModal);
    DOM.delegate('click', '.location-select-btn-dynamic', showLocationModal);

    DOM.delegate('click', '.floor-option-btn', (e, target) => selectFloor(target.dataset.floor, target));
    DOM.delegate('click', '.location-option-btn', (e, target) => selectLocation(target.dataset.location, target));
    
    DOM.delegate('click', '.custom-location-confirm-btn-dynamic', confirmCustomLocation);
    DOM.delegate('focus', '.custom-location-input-dynamic', function() {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });
    DOM.delegate('blur', '.custom-location-input-dynamic', function() {
        if (!this.value.trim()) { this.classList.add('placeholder-active'); this.value = 'Enter custom location'; }
    });

    DOM.delegate('input', '.floor-input-dynamic', PerformanceUtils.throttle(function() {
        let val = this.value.trim();
        if (val === '') return;
        let num = parseInt(val);
        let min = parseInt(this.dataset.min) || 1;
        let max = parseInt(this.dataset.max) || 88;
        if (isNaN(num)) { this.value = ''; }
        else if (num > max) { this.value = max; showToast(`Max floor is ${max}`, 'warning'); }
        else if (num < min) { this.value = min; showToast(`Min floor is ${min}`, 'warning'); }
    }, 100));
    
    DOM.delegate('blur', '.floor-input-dynamic', function() {
        let val = this.value.trim();
        let min = parseInt(this.dataset.min) || 1;
        let max = parseInt(this.dataset.max) || 88;
        if (!val) { this.classList.add('placeholder-active'); this.value = `Enter floor (${min}-${max})`; }
        else {
            let num = parseInt(val);
            if (isNaN(num)) { this.value = ''; showToast('Please enter a valid number', 'warning'); }
            else if (num > max) { this.value = max; showToast(`Max floor is ${max}`, 'warning'); }
            else if (num < min) { this.value = min; showToast(`Min floor is ${min}`, 'warning'); }
        }
    });
    
    DOM.delegate('focus', '.floor-input-dynamic', function() {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });

    DOM.delegate('focus', '.description-input-dynamic', function() {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });
    DOM.delegate('blur', '.description-input-dynamic', function() {
        if (!this.value.trim()) { this.classList.add('placeholder-active'); this.value = 'Maintenance, cleaning, or repair required'; }
    });
    DOM.delegate('input', '.description-input-dynamic', function() {
        if (this.value.trim()) this.classList.remove('placeholder-active');
    });

    DOM.delegate('click', '.confirm-form-btn-dynamic', confirmForm);

    DOM.delegate('click', '.take-photo-btn-dynamic', () => handleUploadClick(true));  
    DOM.delegate('click', '.choose-photo-btn-dynamic', () => handleUploadClick(false)); 
    
    DOM.delegate('click', '.skip-photo-btn-dynamic', skipPhoto);
    DOM.delegate('click', '.confirm-photo-btn-dynamic', confirmPhoto);
    DOM.delegate('click', '.preview-image-dynamic', previewUploadedImage);

    DOM.delegate('click', '.edit-info-btn', editInformation);
    DOM.delegate('click', '.submit-report-btn', submitReport);
    DOM.delegate('click', '.new-report-btn-dynamic', () => {
        if (hasUrlParams && autoDetectedService) initChatWithUrlParams(); else initChat();
    });
}

// ==================== Chat Flow Control ====================
function initChatWithUrlParams() {
    resetApp();
    setTimeout(() => {
        addBotMessage(`
            <div class="welcome-message">
                <div class="welcome-title">TAIPEI 101 Smart Service System</div>
                <div class="welcome-subtitle">Welcome to ${APP_CONFIG[autoDetectedService].name_en}</div>
            </div>
        `);
        setTimeout(() => {
            currentService = autoDetectedService;
            if (autoDetectedFloor) selectedFloor = autoDetectedFloor;
            if (autoDetectedLocation) {
                const locs = APP_CONFIG[currentService].locations_en;
                const match = locs.find(loc => loc === autoDetectedLocation || loc.includes(autoDetectedLocation));
                if (match) selectedLocation = match; else customLocation = autoDetectedLocation;
            }
            setStep('input_form');
        }, 1000);
    }, 500);
}

function initChat() {
    resetApp();
    setTimeout(() => {
        addBotMessage(`
            <div class="welcome-message">
                <div class="welcome-title">TAIPEI 101 Smart Service System</div>
                <div class="welcome-subtitle">Please select your area to begin</div>
            </div>
        `);
        setStep('select_service');
    }, 500);
}

function resetApp() {
    currentStep = 'welcome'; currentService = ''; selectedFloor = ''; selectedLocation = ''; 
    customLocation = ''; problemDescription = ''; uploadedFile = null; uploadedFilePreview = null;
    chatSteps = { 'select_service': -1, 'input_form': -1, 'input_photo': -1, 'confirmation': -1, 'completed': -1 };
    DOM.select('#chatContainer').innerHTML = '';
}

function setStep(step) {
    currentStep = step;
    chatSteps[step] = DOM.selectAll('#chatContainer .message').length;
    showStep(step);
}

function goBackToStep(step) {
    const container = DOM.select('#chatContainer');
    const messages = Array.from(container.children);
    const startIndex = chatSteps[step];
    
    if (startIndex !== undefined && startIndex >= 0) {
        messages.slice(startIndex).forEach(m => m.remove());
        Object.keys(chatSteps).forEach(key => { if (chatSteps[key] > startIndex) chatSteps[key] = -1; });
    }
    currentStep = step;
    showStep(step);
}

function showStep(step) {
    switch (step) {
        case 'select_service': showServiceButtons(); break;
        case 'input_form': showReportForm(); break;
        case 'input_photo': askForPhoto(); break;
        case 'confirmation': showConfirmation(); break;
        case 'completed': showSuccessPage(); break;
    }
}

// ==================== 1. Select Service ====================
function showServiceButtons() {
    DOM.selectAll('.service-buttons').forEach(el => el.remove());
    
    const ICON_MAP = { 'office': '🏢', 'shopping': '🛍️', 'observatory': '🏙️', 'default': '📌' };
    
    const buttonsHTML = Object.keys(APP_CONFIG).map(key => {
        const config = APP_CONFIG[key];
        const icon = ICON_MAP[key] || ICON_MAP['default'];
        return `
            <div class="service-button" data-service="${key}">
                <div class="service-button-icon">${icon}</div>
                <div class="service-button-content">
                    <div class="service-button-title">${config.name_en}</div>
                    <div class="service-button-desc">${config.name_en} Area Report</div>
                </div>
            </div>
        `;
    }).join('');

    addBotMessage(`<div class="service-buttons" id="serviceButtons">${buttonsHTML}</div>`);
}

function selectService(serviceType) {
    DOM.selectAll('.service-button').forEach(btn => btn.classList.remove('selected'));
    DOM.select(`.service-button[data-service="${serviceType}"]`).classList.add('selected');

    currentService = serviceType;
    selectedFloor = ''; selectedLocation = ''; customLocation = ''; problemDescription = ''; uploadedFile = null; uploadedFilePreview = null;
    
    const container = DOM.select('#chatContainer');
    const messages = Array.from(container.children);
    const idx = messages.findIndex(m => m.querySelector('.service-buttons'));
    
    if (idx >= 0) {
        messages.slice(idx + 1).forEach(m => m.remove());
        chatSteps = { 'select_service': idx, 'input_form': -1, 'input_photo': -1, 'confirmation': -1, 'completed': -1 };
        addUserMessage(APP_CONFIG[serviceType].name_en);
        currentStep = 'input_form';
        chatSteps['input_form'] = DOM.selectAll('.message').length;
        showReportForm();
    } else {
        initChat();
    }
}

// ==================== 2. Report Form ====================
function showReportForm() {
    DOM.selectAll('.bot-message').forEach(msg => {
        if (msg.querySelector('.form-title') || msg.querySelector('.horizontal-case-card') || msg.querySelector('.take-photo-btn-dynamic') || msg.querySelector('.success-container') || msg.querySelector('.progress-indicator')) {
            msg.remove();
        }
    });

    const config = APP_CONFIG[currentService];
    const title = `📌 ${config.name_en} Service Form`;
    
    let locText = 'Select location';
    if (selectedLocation) locText = selectedLocation;
    else if (customLocation) locText = customLocation;

    let descVal = (problemDescription && problemDescription !== 'Maintenance, cleaning, or repair required') ? problemDescription : 'Maintenance, cleaning, or repair required';
    let descClass = 'form-control description-input-dynamic' + ((problemDescription && problemDescription !== 'Maintenance, cleaning, or repair required') ? ' has-user-input' : ' placeholder-active');

    let floorHTML = '';
    const isFloorInput = config.floors.includes('-');

    if (isFloorInput) {
        const parts = config.floors.split('-');
        const min = parseInt(parts[0].trim()) || 1;
        const max = parseInt(parts[1].trim()) || 88;
        floorHTML = `<input type="number" class="form-control floor-input-dynamic" data-min="${min}" data-max="${max}" value="${selectedFloor || ''}" placeholder="Enter floor (${min}-${max})" min="${min}" max="${max}">`;
    } else {
        let floorText = selectedFloor ? `${selectedFloor}F` : 'Select floor';
        floorHTML = `
            <button class="floor-select-btn floor-select-btn-dynamic">
                <div class="floor-display"><span class="floor-value">${floorText}</span><span class="floor-arrow">▼</span></div>
            </button>`;
    }

    let formHTML = `
        <div class="form-title">${title}</div>
        <div class="form-group">
            <label class="form-label">Floor <span>*</span></label>
            ${floorHTML}
        </div>
        <div class="form-group">
            <label class="form-label">Location <span>*</span></label>
            <button class="location-select-btn location-select-btn-dynamic">
                <div class="location-display"><span class="location-value">${locText}</span><span class="location-arrow">▼</span></div>
            </button>
        </div>
        <div class="form-group">