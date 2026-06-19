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
        document.addEventListener(actualEvent, function (e) {
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

// ==================== Dynamic Config & Status (加入樂觀渲染骨架) ====================
let APP_CONFIG = {
    'office': { name_en: 'Office Tower', floors: '1-88', locations_en: [] },
    'shopping': { name_en: 'Shopping Mall', floors: 'B1,1,2,3,4,5', locations_en: [] },
    'observatory': { name_en: 'Observatory', floors: '89,91,101', locations_en: [] }
};
let isConfigLoaded = false;
let configFetchPromise = null;

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

    const validServices = ['office', 'shopping', 'observatory'];
    const serviceParam = (urlParams.get('service') || '').toLowerCase();
    autoDetectedService = validServices.includes(serviceParam) ? serviceParam : '';

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

// ==================== UI Loading Control ====================
function showLoadingOverlay(text) {
    const overlay = DOM.select('#loadingOverlay');
    if (overlay) {
        if (text) {
            const textEl = overlay.querySelector('.loading-text');
            if (textEl) textEl.textContent = text;
        }
        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.style.opacity = '1';
    }
}

function hideLoadingOverlay() {
    const overlay = DOM.select('#loadingOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (overlay.style.opacity === '0') {
                overlay.style.display = 'none';
            }
        }, 300);
    }
}

// ==================== App Initialization (0秒秒開機制) ====================
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('touchstart', PerformanceUtils.throttle(function (event) {
        if (event.touches.length > 1) event.preventDefault();
    }, 100), { passive: false });
    document.body.style.overscrollBehavior = 'none';

    fetchConfigAndInit();
});

function fetchConfigAndInit() {
    parseUrlParams();
    bindGlobalEvents();

    configFetchPromise = fetch(API_CONFIG.MAIN_API + "?action=getConfig")
        .then(res => res.json())
        .then(data => {
            if (data.success && data.config) {
                APP_CONFIG = data.config;
                isConfigLoaded = true;
            } else {
                throw new Error("Cannot parse config");
            }
        })
        .catch(err => {
            console.error("Background sync failed:", err);
        });

    hideLoadingOverlay();

    if (hasUrlParams && autoDetectedService) {
        initChatWithUrlParams();
    } else {
        initChat();
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
    DOM.delegate('focus', '.custom-location-input-dynamic', function () {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });
    DOM.delegate('blur', '.custom-location-input-dynamic', function () {
        if (!this.value.trim()) { this.classList.add('placeholder-active'); this.value = 'Enter custom location'; }
    });

    DOM.delegate('input', '.floor-input-dynamic', PerformanceUtils.throttle(function () {
        let val = this.value.trim();
        if (val === '') return;
        let num = parseInt(val);
        let min = parseInt(this.dataset.min) || 1;
        let max = parseInt(this.dataset.max) || 88;
        if (isNaN(num)) { this.value = ''; }
        else if (num > max) { this.value = max; showToast(`Max floor is ${max}`, 'warning'); }
        else if (num < min) { this.value = min; showToast(`Min floor is ${min}`, 'warning'); }
    }, 100));

    DOM.delegate('blur', '.floor-input-dynamic', function () {
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

    DOM.delegate('focus', '.floor-input-dynamic', function () {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });

    DOM.delegate('focus', '.description-input-dynamic', function () {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });
    DOM.delegate('blur', '.description-input-dynamic', function () {
        if (!this.value.trim()) { this.classList.add('placeholder-active'); this.value = 'Maintenance, cleaning, or repair required'; }
    });
    DOM.delegate('input', '.description-input-dynamic', function () {
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
        window.location.href = window.location.pathname;
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
                // 完美修復：比對是否為骨架中預設按鈕，否則放入自訂地點
                const locs = APP_CONFIG[currentService].locations_en;
                const match = locs.find(loc => loc === autoDetectedLocation || loc.includes(autoDetectedLocation));
                if (match) {
                    selectedLocation = match;
                    customLocation = '';
                } else {
                    selectedLocation = '';
                    customLocation = autoDetectedLocation;
                }
            }
            setStep('input_form');
        }, 800);
    }, 300);
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
            <label class="form-label">Details (Optional)</label>
            <textarea class="${descClass}" rows="3">${descVal}</textarea>
        </div>
        <div class="quick-replies"><button class="quick-reply-btn confirm-form-btn-dynamic">Next</button></div>`;

    addBotMessage(formHTML);
}

function confirmForm() {
    const config = APP_CONFIG[currentService];
    const isFloorInput = config.floors.includes('-');

    if (isFloorInput) {
        const floorInput = DOM.select('.floor-input-dynamic');
        let val = floorInput.value.trim();
        if (!floorInput.classList.contains('placeholder-active') && val) {
            let num = parseInt(val);
            let min = parseInt(floorInput.dataset.min) || 1;
            let max = parseInt(floorInput.dataset.max) || 88;
            if (isNaN(num) || num < min || num > max) { showToast(`Please enter a valid floor (${min}-${max})`, 'warning'); return; }
            selectedFloor = num.toString();
        } else {
            showToast('Please enter floor', 'warning'); return;
        }
    } else {
        if (!selectedFloor) { showToast('Please select floor', 'warning'); return; }
    }

    const descInput = DOM.select('.description-input-dynamic');
    let descVal = descInput.value.trim();
    if (descInput.classList.contains('placeholder-active') || !descVal || descVal === 'Maintenance, cleaning, or repair required') {
        problemDescription = 'Maintenance, cleaning, or repair required';
    } else {
        if (descVal.length > 500) { showToast('Maximum 500 characters allowed', 'warning'); return; }
        problemDescription = descVal;
    }

    if (!selectedLocation && !customLocation) { showToast('Please select or enter location', 'warning'); return; }
    if (customLocation && customLocation.length > 100) { showToast('Location name exceeds 100 characters', 'warning'); return; }

    const messages = Array.from(DOM.selectAll('.message'));
    const idx = messages.findIndex(m => m.querySelector('.form-title'));

    if (idx >= 0) {
        messages.slice(idx + 1).forEach(m => m.remove());
        chatSteps['input_form'] = idx;
        chatSteps['input_photo'] = -1; chatSteps['confirmation'] = -1;
    }

    addUserMessage(problemDescription);
    setTimeout(() => setStep('input_photo'), 500);
}

// ==================== 3. Photo Upload ====================
function askForPhoto() {
    DOM.selectAll('.bot-message').forEach(msg => {
        if (msg.innerHTML.includes('Add photo for reference?') || msg.querySelector('.take-photo-btn-dynamic') || msg.querySelector('.preview-image-dynamic')) msg.remove();
    });

    addBotMessage('Add photo for reference? (Optional)');
    let html = uploadedFilePreview ? `
        <img class="upload-preview preview-image-dynamic" src="${uploadedFilePreview}" alt="">
        <div class="quick-replies">
            <button class="quick-reply-btn skip-photo-btn-dynamic">Remove Photo</button>
            <button class="quick-reply-btn confirm-photo-btn-dynamic">Confirm</button>
        </div>` : `
        <div class="photo-btn-group">
            <div class="upload-area take-photo-btn-dynamic photo-split-btn">
                <div class="upload-icon">📷</div>
                <div class="photo-split-btn-text">Take Photo</div>
            </div>
            <div class="upload-area choose-photo-btn-dynamic photo-split-btn">
                <div class="upload-icon">🖼️</div>
                <div class="photo-split-btn-text">Gallery</div>
            </div>
        </div>
        <div class="quick-replies">
            <button class="quick-reply-btn skip-photo-btn-dynamic">Skip</button>
        </div>`;
    addBotMessage(html);
}

function handleUploadClick(isCamera = false) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = 'temp-file-input';
    fileInput.accept = 'image/*';
    if (isCamera) { fileInput.capture = 'environment'; }

    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', function (e) {
        handleFileUpload(e);
        fileInput.remove();
    });
    fileInput.click();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) { showToast('Only JPG/PNG/GIF formats are supported', 'warning'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('File size exceeds 5MB limit', 'warning'); return; }

    showToast('Processing image...', 'info');
    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        uploadedFilePreview = e.target.result;
        showToast('Photo added', 'success');
        goBackToStep('input_photo');
    };
    reader.onerror = () => showToast('Failed to read file', 'warning');
    reader.readAsDataURL(file);
}

function skipPhoto() {
    DOM.selectAll('.bot-message').forEach(m => { if (m.querySelector('.progress-indicator')) m.remove(); });
    if (uploadedFilePreview) {
        uploadedFile = null; uploadedFilePreview = null; showToast('Photo removed', 'info'); goBackToStep('input_photo');
    } else {
        DOM.selectAll('.user-message').forEach(m => { if (m.textContent.includes('No photo upload')) m.remove(); });
        addUserMessage('No photo upload');
        setTimeout(() => setStep('confirmation'), 300);
    }
}

function confirmPhoto() {
    if (uploadedFilePreview) {
        DOM.selectAll('.user-message').forEach(m => { if (m.textContent.includes('Photo added')) m.remove(); });
        addUserMessage('Photo added');
        setTimeout(() => setStep('confirmation'), 300);
    }
}

function previewUploadedImage() {
    if (uploadedFilePreview) {
        DOM.select('#modalImage').src = uploadedFilePreview;
        DOM.select('#imageModal').style.display = 'flex';
    }
}

// ==================== 4. Confirmation & Submission ====================
function showConfirmation() {
    DOM.selectAll('.bot-message').forEach(msg => {
        if (msg.querySelector('.horizontal-case-card') || msg.querySelector('.success-container') || msg.querySelector('.progress-indicator')) msg.remove();
        if (msg.textContent.trim() === '' && msg.innerHTML.trim() === '') msg.remove();
    });

    let locText = customLocation || selectedLocation;
    const html = `
        <div class="horizontal-case-card">
            <div class="horizontal-details-list">
                <div class="horizontal-detail-row">
                    <div class="detail-label-section"><span class="detail-label-text">Type</span></div>
                    <div class="detail-value-section"><span class="detail-value-text">${APP_CONFIG[currentService].name_en}</span></div>
                </div>
                <div class="horizontal-detail-row">
                    <div class="detail-label-section"><span class="detail-label-text">Floor</span></div>
                    <div class="detail-value-section"><span class="detail-value-text">${selectedFloor}F</span></div>
                </div>
                <div class="horizontal-detail-row">
                    <div class="detail-label-section"><span class="detail-label-text">Location</span></div>
                    <div class="detail-value-section"><span class="detail-value-text">${locText}</span></div>
                </div>
                <div class="horizontal-detail-row">
                    <div class="detail-label-section"><span class="detail-label-text">Photo</span></div>
                    <div class="detail-value-section ${uploadedFilePreview ? 'has-photo' : 'photo-value'}"><span class="detail-value-text">${uploadedFilePreview ? 'Yes' : 'No'}</span></div>
                </div>
            </div>
            <div class="description-row">
                <div class="description-label-section"><span class="description-label-text">Details</span></div>
                <div class="description-content-section"><div class="description-content-text">${problemDescription}</div></div>
            </div>
        </div>
        <div class="quick-replies">
            <button class="quick-reply-btn edit-info-btn">✏️ Edit Info</button>
            <button class="quick-reply-btn submit-report-btn">✓ Submit Report</button>
        </div>`;
    addBotMessage(html);
}

// 【修復】使用 scrollToBottom() 解決畫面留白回彈問題
function editInformation(e) {
    e.preventDefault(); e.stopPropagation();
    const messages = Array.from(DOM.selectAll('.message'));
    const formIdx = messages.findIndex(m => m.querySelector('.form-title'));
    if (formIdx >= 0) {
        messages.slice(formIdx + 1).forEach(m => m.remove());
        chatSteps['input_form'] = formIdx; chatSteps['input_photo'] = -1; chatSteps['confirmation'] = -1;
        currentStep = 'input_form';
        scrollToBottom();
    } else { goBackToStep('input_form'); }
}

function submitReport() {
    if (currentStep === 'submitting' || currentStep === 'completed') return;
    currentStep = 'submitting';

    const progressId = 'progress-' + Date.now();
    addBotMessage(`
        <div class="progress-indicator" id="${progressId}">
            <div class="progress-title">Processing</div>
            <div class="progress-steps">
                <div class="progress-step active" data-step="1"><div class="step-icon">1</div><div class="step-label">Validating</div></div>
                <div class="progress-step" data-step="2"><div class="step-icon">2</div><div class="step-label">Processing</div></div>
                <div class="progress-step" data-step="3"><div class="step-icon">3</div><div class="step-label">Sending</div></div>
                <div class="progress-step" data-step="4"><div class="step-icon">4</div><div class="step-label">Complete</div></div>
            </div>
            <div class="progress-bar"><div class="progress-fill"></div></div>
            <div class="progress-message">Processing your report...</div>
        </div>`);
    setTimeout(() => executeSubmitProcess(progressId), 50);
}

function executeSubmitProcess(progressId) {
    const updateProgress = (step, msg) => {
        const el = DOM.select(`#${progressId}`); if (!el) return;
        el.querySelectorAll('.progress-step').forEach(s => s.classList.remove('active'));
        el.querySelector(`.progress-step[data-step="${step}"]`).classList.add('active');
        el.querySelector('.progress-fill').style.width = `${((step - 1) / 3) * 100}%`;
        if (msg) el.querySelector('.progress-message').textContent = msg;
    };

    updateProgress(1, 'Validating data...');
    const d = new Date();
    const locText = customLocation || selectedLocation;

    const formData = {
        action: 'report',
        report_date: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`,
        report_time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        report_floor: `${selectedFloor}F`, report_location: locText, description: problemDescription,
        service_type: APP_CONFIG[currentService].name_en, sign_in_time: '', sign_in_interval: '', sign_in_check: ''
    };

    setTimeout(() => updateProgress(2, 'Processing photo...'), 300);

    let photoPromise = uploadedFile ? compressAndUploadImage().then(id => { if (id) formData.photo_id = id; return formData; }).catch(() => formData) : Promise.resolve(formData);

    photoPromise.then(data => {
        updateProgress(3, 'Sending report to system...');
        return sendReportToBackend(data);
    }).then(() => {
        updateProgress(4, 'Complete!');
        setTimeout(() => { DOM.select(`#${progressId}`)?.remove(); setStep('completed'); }, 600);
    }).catch(err => {
        showToast('Submission failed, please try again', 'warning');
        DOM.select(`#${progressId}`)?.remove(); goBackToStep('confirmation');
    });
}

function compressAndUploadImage() {
    return new Promise((resolve, reject) => {
        if (!uploadedFile) return resolve(null);
        const img = new Image(), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), reader = new FileReader();
        reader.onload = e => { img.src = e.target.result; };
        img.onload = () => {
            let width = img.width, height = img.height;
            const scale = Math.min(800 / width, 800 / height, 1);
            if (scale < 1) { width = Math.floor(width * scale); height = Math.floor(height * scale); }
            canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);

            const rawData = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
            fetch(API_CONFIG.UPLOAD_API, {
                method: 'POST',
                body: JSON.stringify({ dataReq: { data: rawData, name: uploadedFile.name, type: 'image/jpeg' }, fname: "uploadFilesToGoogleDrive" })
            }).then(res => res.json()).then(data => data && data.id ? resolve(data.id) : reject()).catch(reject);
        };
        reader.readAsDataURL(uploadedFile);
    });
}

function sendReportToBackend(formData) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams();
        for (const key in formData) params.append(key, formData[key]);
        fetch(API_CONFIG.MAIN_API, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
            .then(res => res.json().catch(() => res.text()))
            .then(resolve).catch(reject);
    });
}

function showSuccessPage() {
    addBotMessage(`
        <div class="success-container">
            <div class="success-icon">✓</div>
            <div class="success-title">${APP_CONFIG[currentService].name_en} Submitted</div>
            <div class="success-message">Thank you for your report.<br>We will process it shortly.</div>
            <div class="success-divider"></div>
            <div class="quick-replies"><button class="quick-reply-btn new-report-btn-dynamic">New Report</button></div>
        </div>`);
}

// ==================== 動態模態框控制 (防手速極快的 await 防護) ====================
async function showFloorModal() {
    // 【防護網】極限手速或網路過慢時，顯示全螢幕半透明遮罩並強制等待 1.2 秒防閃現
    if (!isConfigLoaded) {
        showLoadingOverlay("Loading latest floor data...");
        await Promise.all([
            configFetchPromise,
            new Promise(resolve => setTimeout(resolve, 1200))
        ]);
        hideLoadingOverlay();
    }
    if (!isConfigLoaded) return showToast("Failed to load data, please try again", "warning");

    document.body.style.overflow = 'hidden';
    DOM.select('#floorModalTitle').textContent = `Select ${APP_CONFIG[currentService].name_en} Floor`;

    const floors = APP_CONFIG[currentService].floors.split(',').map(s => s.trim()).filter(s => s);
    DOM.select('#floorOptions').innerHTML = floors.map(f => `<button class="floor-option-btn ${selectedFloor.toString() === f.toString() ? 'selected' : ''}" data-floor="${f}">${f}F</button>`).join('');
    DOM.select('#floorModal').style.display = 'flex';
}

async function showLocationModal() {
    // 【防護網】極限手速或網路過慢時，顯示全螢幕半透明遮罩並強制等待 1.2 秒防閃現
    if (!isConfigLoaded) {
        showLoadingOverlay("Loading latest location data...");
        await Promise.all([
            configFetchPromise,
            new Promise(resolve => setTimeout(resolve, 1200))
        ]);
        hideLoadingOverlay();
    }
    if (!isConfigLoaded) return showToast("Failed to load data, please try again", "warning");

    document.body.style.overflow = 'hidden';
    DOM.select('#locationModalTitle').textContent = `Select ${APP_CONFIG[currentService].name_en} Location`;

    const locs = APP_CONFIG[currentService].locations_en;

    const customHTML = `
        <div class="custom-location-section">
            <div class="custom-location-title">Custom Location</div>
            <div class="custom-location-group" id="modalCustomLocationGroup">
                <div class="custom-location-icon">📍</div>
                <input type="text" class="custom-location-input custom-location-input-dynamic ${customLocation ? '' : 'placeholder-active'}" id="modalCustomLocationInput" placeholder="Enter custom location" value="${customLocation || ''}">
            </div>
            <button class="custom-location-confirm-btn custom-location-confirm-btn-dynamic">Confirm</button>
        </div>`;
    DOM.select('#locationOptions').innerHTML = locs.map(l => `<button class="location-option-btn ${selectedLocation === l ? 'selected' : ''}" data-location="${l}">${l}</button>`).join('') + customHTML;
    DOM.select('#locationModal').style.display = 'flex';
}

function selectFloor(floor, btnTarget) {
    selectedFloor = floor;
    DOM.select('.floor-select-btn-dynamic .floor-value').textContent = floor + 'F';
    DOM.selectAll('.floor-option-btn').forEach(b => b.classList.remove('selected'));
    if (btnTarget) btnTarget.classList.add('selected');
    closeModal(DOM.select('#floorModal'));
    showToast(`Selected: ${floor}F`, 'success');
}

function selectLocation(locId, btnTarget) {
    selectedLocation = locId; customLocation = '';
    DOM.select('.location-select-btn-dynamic .location-value').textContent = locId;
    DOM.selectAll('.location-option-btn').forEach(b => b.classList.remove('selected'));
    if (btnTarget) btnTarget.classList.add('selected');
    closeModal(DOM.select('#locationModal'));
    showToast(`Selected: ${locId}`, 'success');
}

function confirmCustomLocation() {
    const val = DOM.select('#modalCustomLocationInput').value.trim();
    if (!val || val === 'Enter custom location') return showToast('Please enter a location', 'warning');
    if (val.length > 100) return showToast('Location name exceeds 100 characters', 'warning');
    selectedLocation = ''; customLocation = val;
    DOM.select('.location-select-btn-dynamic .location-value').textContent = val;
    closeModal(DOM.select('#locationModal'));
    showToast(`Set: ${val}`, 'success');
}

function closeModal(modal) { if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; } }

function addBotMessage(content) {
    const id = 'msg-' + Date.now();
    DOM.select('#chatContainer').insertAdjacentHTML('beforeend', `
        <div class="message bot-message" id="${id}">
            <div class="avatar bot-avatar"><img src="static/pic/avatar.png" alt="Service"></div>
            <div class="message-content-wrapper"><div class="message-content">${content}</div><div class="message-time">${getCurrentTime()}</div></div>
        </div>`);
    scrollToBottom(); return '#' + id;
}

function addUserMessage(content) {
    const id = 'msg-' + Date.now();
    const div = document.createElement('div');
    div.className = 'message user-message'; div.id = id;
    div.innerHTML = `<div class="avatar user-avatar"><div class="avatar-placeholder">👤</div></div><div class="message-content-wrapper"><div class="message-content"></div><div class="message-time">${getCurrentTime()}</div></div>`;
    div.querySelector('.message-content').textContent = content;
    DOM.select('#chatContainer').appendChild(div);
    scrollToBottom(); return '#' + id;
}

function scrollToBottom() {
    setTimeout(() => {
        const c = DOM.select('#chatContainer');
        if (c) { c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }); }
    }, 50);
}

function getCurrentTime() {
    const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

const showToast = PerformanceUtils.debounce((msg, type = 'info') => {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed; top:90px; left:50%; transform:translateX(-50%); padding:14px 24px; border-radius:25px; box-shadow:0 8px 25px rgba(0,0,0,0.2); z-index:9999; font-size:14px; font-weight:500; min-width:200px; max-width:90%; text-align:center; transition:opacity 0.3s;`;
    toast.style.background = type === 'warning' ? '#fff3cd' : (type === 'success' ? '#d4edda' : '#d1ecf1');
    toast.style.color = type === 'warning' ? '#856404' : (type === 'success' ? '#155724' : '#0c5460');
    toast.style.border = `1px solid ${type === 'warning' ? '#ffeaa7' : (type === 'success' ? '#c3e6cb' : '#bee5eb')}`;
    toast.textContent = msg; document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}, 100);