// ==================== 配置區塊 ====================
const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbxZ3d2bBMjfw1JWTovmV8w3wt9_ZLYHS8m0AnM-cqn29AR-wU4-k_iERc42nRobDc5R0Q/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
};

// ==================== 原生 DOM 與效能優化工具 ====================
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

// ==================== 動態狀態與資料 ====================
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

// ==================== URL參數解析 ====================
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
        const englishToChineseMap = { "Men's Room": '男生廁所', "Ladies' Room": '女生廁所', 'Public Corridor': '公共走道', 'Elevator': '公共電梯', 'Pantry': '茶水間', 'Freight Elevator': '貨梯廳', 'Nursing Room': '哺乳室', 'East Area': '東面場域', 'West Area': '西區場域' };
        autoDetectedLocation = englishToChineseMap[rawLocation] || rawLocation;
    }
}

// ==================== 系統初始化與動態載入設定 ====================
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
            if (overlay) {
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
            throw new Error("無法解析設定");
        }
    } catch (err) {
        console.error(err);
        showToast("載入設定失敗，請重新整理頁面", "warning");
        if (DOM.select('.loading-text')) DOM.select('.loading-text').textContent = "載入失敗，請重新整理頁面";
        if (DOM.select('.loading-spinner')) DOM.select('.loading-spinner').style.display = 'none';
    }
}

// ==================== 統一的全局事件綁定 ====================
function bindGlobalEvents() {
    DOM.delegate('click', '.logo', () => { window.location.href = window.location.pathname; });
    DOM.delegate('click', '.report-label', () => { window.location.href = 'indexEN.html' + window.location.search; });

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
        if (!this.value.trim()) { this.classList.add('placeholder-active'); this.value = '輸入自訂地點'; }
    });

    DOM.delegate('input', '.floor-input-dynamic', PerformanceUtils.throttle(function () {
        let val = this.value.trim();
        if (val === '') return;
        let num = parseInt(val);
        let min = parseInt(this.dataset.min) || 1;
        let max = parseInt(this.dataset.max) || 88;
        if (isNaN(num)) { this.value = ''; }
        else if (num > max) { this.value = max; showToast(`最高樓層為${max}`, 'warning'); }
        else if (num < min) { this.value = min; showToast(`最低樓層為${min}`, 'warning'); }
    }, 100));

    DOM.delegate('blur', '.floor-input-dynamic', function () {
        let val = this.value.trim();
        let min = parseInt(this.dataset.min) || 1;
        let max = parseInt(this.dataset.max) || 88;
        if (!val) { this.classList.add('placeholder-active'); this.value = `輸入樓層 (${min}-${max})`; }
        else {
            let num = parseInt(val);
            if (isNaN(num)) { this.value = ''; showToast('請輸入有效的數字', 'warning'); }
            else if (num > max) { this.value = max; showToast(`最高樓層為${max}`, 'warning'); }
            else if (num < min) { this.value = min; showToast(`最低樓層為${min}`, 'warning'); }
        }
    });

    DOM.delegate('focus', '.floor-input-dynamic', function () {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });

    DOM.delegate('focus', '.description-input-dynamic', function () {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });
    DOM.delegate('blur', '.description-input-dynamic', function () {
        if (!this.value.trim()) { this.classList.add('placeholder-active'); this.value = '請檢查、進行環境清潔或設備報修'; }
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
        if (hasUrlParams && autoDetectedService) initChatWithUrlParams(); else initChat();
    });
}

// ==================== 流程控制 ====================
function initChatWithUrlParams() {
    resetApp();
    setTimeout(() => {
        addBotMessage(`
            <div class="welcome-message">
                <div class="welcome-title">TAIPEI 101 智慧通報系統</div>
                <div class="welcome-subtitle">歡迎蒞臨${APP_CONFIG[autoDetectedService].name_tw}</div>
            </div>
        `);
        setTimeout(() => {
            currentService = autoDetectedService;
            if (autoDetectedFloor) selectedFloor = autoDetectedFloor;
            if (autoDetectedLocation) {
                const locs = APP_CONFIG[currentService].locations_tw;
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
                <div class="welcome-title">TAIPEI 101 智慧通報系統</div>
                <div class="welcome-subtitle">請選擇您所在的區域開始通報</div>
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

// ==================== 1. 動態渲染服務按鈕 ====================
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
                    <div class="service-button-title">${config.name_tw}</div>
                    <div class="service-button-desc">${config.name_tw}區域通報</div>
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
        addUserMessage(APP_CONFIG[serviceType].name_tw);
        currentStep = 'input_form';
        chatSteps['input_form'] = DOM.selectAll('.message').length;
        showReportForm();
    } else {
        initChat();
    }
}

// ==================== 2. 動態渲染通報表單 ====================
function showReportForm() {
    DOM.selectAll('.bot-message').forEach(msg => {
        if (msg.querySelector('.form-title') || msg.querySelector('.horizontal-case-card') || msg.querySelector('.take-photo-btn-dynamic') || msg.querySelector('.success-container') || msg.querySelector('.progress-indicator')) {
            msg.remove();
        }
    });

    const config = APP_CONFIG[currentService];
    const title = `📌 ${config.name_tw}通報表單`;

    let locText = '請選擇地點';
    if (selectedLocation) locText = selectedLocation;
    else if (customLocation) locText = customLocation;

    let descVal = (problemDescription && problemDescription !== '請檢查、進行環境清潔或設備報修') ? problemDescription : '請檢查、進行環境清潔或設備報修';
    let descClass = 'form-control description-input-dynamic' + ((problemDescription && problemDescription !== '請檢查、進行環境清潔或設備報修') ? ' has-user-input' : ' placeholder-active');

    let floorHTML = '';
    const isFloorInput = config.floors.includes('-');

    if (isFloorInput) {
        const parts = config.floors.split('-');
        const min = parseInt(parts[0].trim()) || 1;
        const max = parseInt(parts[1].trim()) || 88;
        // 移除了 style="width: 100%;" 等被 CSP 阻擋的內聯樣式，改依賴 form-control
        floorHTML = `<input type="number" class="form-control floor-input-dynamic" data-min="${min}" data-max="${max}" value="${selectedFloor || ''}" placeholder="輸入樓層 (${min}-${max})" min="${min}" max="${max}">`;
    } else {
        let floorText = selectedFloor ? `${selectedFloor}F` : '請選擇樓層';
        // 套用安全的 CSS Class
        floorHTML = `
            <button class="floor-select-btn floor-select-btn-dynamic">
                <div class="floor-display"><span class="floor-value">${floorText}</span><span class="floor-arrow">▼</span></div>
            </button>`;
    }

    let formHTML = `
        <div class="form-title">${title}</div>
        <div class="form-group">
            <label class="form-label">樓層 <span>*</span></label>
            ${floorHTML}
        </div>
        <div class="form-group">
            <label class="form-label">地點 <span>*</span></label>
            <button class="location-select-btn location-select-btn-dynamic">
                <div class="location-display"><span class="location-value">${locText}</span><span class="location-arrow">▼</span></div>
            </button>
        </div>
        <div class="form-group">
            <label class="form-label">描述（非必要）</label>
            <textarea class="${descClass}" rows="3">${descVal}</textarea>
        </div>
        <div class="quick-replies"><button class="quick-reply-btn confirm-form-btn-dynamic">確認</button></div>`;

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
            if (isNaN(num) || num < min || num > max) { showToast(`請輸入有效的樓層 (${min} ~ ${max})`, 'warning'); return; }
            selectedFloor = num.toString();
        } else {
            showToast('請輸入樓層', 'warning'); return;
        }
    } else {
        if (!selectedFloor) { showToast('請選擇樓層', 'warning'); return; }
    }

    const descInput = DOM.select('.description-input-dynamic');
    let descVal = descInput.value.trim();
    if (descInput.classList.contains('placeholder-active') || !descVal || descVal === '請檢查、進行環境清潔或設備報修') {
        problemDescription = '請檢查、進行環境清潔或設備報修';
    } else {
        if (descVal.length > 500) { showToast('描述長度超過500字限制', 'warning'); return; }
        problemDescription = descVal;
    }

    if (!selectedLocation && !customLocation) { showToast('請選擇或輸入地點', 'warning'); return; }
    if (customLocation && customLocation.length > 100) { showToast('自訂地點長度超過100字限制', 'warning'); return; }

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

// ==================== 3. 處理照片上傳 (CSS 安全版) ====================
function askForPhoto() {
    DOM.selectAll('.bot-message').forEach(msg => {
        if (msg.innerHTML.includes('是否需要上傳照片輔助說明') || msg.querySelector('.take-photo-btn-dynamic') || msg.querySelector('.preview-image-dynamic')) msg.remove();
    });

    addBotMessage('是否需要上傳照片輔助說明？（非必要）');
    let html = uploadedFilePreview ? `
        <img class="upload-preview preview-image-dynamic" src="${uploadedFilePreview}" alt="">
        <div class="quick-replies">
            <button class="quick-reply-btn skip-photo-btn-dynamic">移除照片</button>
            <button class="quick-reply-btn confirm-photo-btn-dynamic">確認上傳</button>
        </div>` : `
        <div class="photo-btn-group">
            <div class="upload-area take-photo-btn-dynamic photo-split-btn">
                <div class="upload-icon">📷</div>
                <div class="photo-split-btn-text">直接拍照</div>
            </div>
            <div class="upload-area choose-photo-btn-dynamic photo-split-btn">
                <div class="upload-icon">🖼️</div>
                <div class="photo-split-btn-text">相簿選擇</div>
            </div>
        </div>
        <div class="quick-replies">
            <button class="quick-reply-btn skip-photo-btn-dynamic">跳過不上傳</button>
        </div>`;
    addBotMessage(html);
}

function handleUploadClick(isCamera = false) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = 'temp-file-input';
    fileInput.accept = 'image/*';
    if (isCamera) { fileInput.capture = 'environment'; }

    fileInput.style.display = 'none'; // DOM 操作允許，不受 CSP style-src 影響
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
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) { showToast('請選擇支援的圖片格式', 'warning'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('檔案超過 5MB', 'warning'); return; }

    showToast('正在處理圖片...', 'info');
    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        uploadedFilePreview = e.target.result;
        showToast('照片已選擇', 'success');
        goBackToStep('input_photo');
    };
    reader.onerror = () => showToast('讀取失敗', 'warning');
    reader.readAsDataURL(file);
}

function skipPhoto() {
    DOM.selectAll('.bot-message').forEach(m => { if (m.querySelector('.progress-indicator')) m.remove(); });
    if (uploadedFilePreview) {
        uploadedFile = null; uploadedFilePreview = null; showToast('照片已移除', 'info'); goBackToStep('input_photo');
    } else {
        DOM.selectAll('.user-message').forEach(m => { if (m.textContent.includes('不上傳照片')) m.remove(); });
        addUserMessage('不上傳照片');
        setTimeout(() => setStep('confirmation'), 300);
    }
}

function confirmPhoto() {
    if (uploadedFilePreview) {
        DOM.selectAll('.user-message').forEach(m => { if (m.textContent.includes('已上傳照片')) m.remove(); });
        addUserMessage('已上傳照片');
        setTimeout(() => setStep('confirmation'), 300);
    }
}

function previewUploadedImage() {
    if (uploadedFilePreview) {
        DOM.select('#modalImage').src = uploadedFilePreview;
        DOM.select('#imageModal').style.display = 'flex';
    }
}

// ==================== 4. 確認頁面與提交 ====================
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
                    <div class="detail-label-section"><span class="detail-label-text">類型</span></div>
                    <div class="detail-value-section"><span class="detail-value-text">${APP_CONFIG[currentService].name_tw}</span></div>
                </div>
                <div class="horizontal-detail-row">
                    <div class="detail-label-section"><span class="detail-label-text">樓層</span></div>
                    <div class="detail-value-section"><span class="detail-value-text">${selectedFloor}F</span></div>
                </div>
                <div class="horizontal-detail-row">
                    <div class="detail-label-section"><span class="detail-label-text">地點</span></div>
                    <div class="detail-value-section"><span class="detail-value-text">${locText}</span></div>
                </div>
                <div class="horizontal-detail-row">
                    <div class="detail-label-section"><span class="detail-label-text">照片</span></div>
                    <div class="detail-value-section ${uploadedFilePreview ? 'has-photo' : 'photo-value'}"><span class="detail-value-text">${uploadedFilePreview ? '有' : '無'}</span></div>
                </div>
            </div>
            <div class="description-row">
                <div class="description-label-section"><span class="description-label-text">描述</span></div>
                <div class="description-content-section"><div class="description-content-text">${problemDescription}</div></div>
            </div>
        </div>
        <div class="quick-replies">
            <button class="quick-reply-btn edit-info-btn">✏️ 修改資訊</button>
            <button class="quick-reply-btn submit-report-btn">✓ 確認提交</button>
        </div>`;
    addBotMessage(html);
}

function editInformation(e) {
    e.preventDefault(); e.stopPropagation();
    const messages = Array.from(DOM.selectAll('.message'));
    const formIdx = messages.findIndex(m => m.querySelector('.form-title'));
    if (formIdx >= 0) {
        messages.slice(formIdx + 1).forEach(m => m.remove());
        chatSteps['input_form'] = formIdx; chatSteps['input_photo'] = -1; chatSteps['confirmation'] = -1;
        currentStep = 'input_form';
        messages[formIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else { goBackToStep('input_form'); }
}

function submitReport() {
    if (currentStep === 'submitting' || currentStep === 'completed') return;
    currentStep = 'submitting';

    const progressId = 'progress-' + Date.now();
    addBotMessage(`
        <div class="progress-indicator" id="${progressId}">
            <div class="progress-title">通報處理中</div>
            <div class="progress-steps">
                <div class="progress-step active" data-step="1"><div class="step-icon">1</div><div class="step-label">資料驗證</div></div>
                <div class="progress-step" data-step="2"><div class="step-icon">2</div><div class="step-label">照片處理</div></div>
                <div class="progress-step" data-step="3"><div class="step-icon">3</div><div class="step-label">發送通報</div></div>
                <div class="progress-step" data-step="4"><div class="step-icon">4</div><div class="step-label">完成</div></div>
            </div>
            <div class="progress-bar"><div class="progress-fill"></div></div>
            <div class="progress-message">正在處理您的通報，請稍候...</div>
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

    updateProgress(1, '正在驗證通報資料...');
    const d = new Date();
    const locText = customLocation || selectedLocation;

    const formData = {
        action: 'report',
        report_date: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`,
        report_time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        report_floor: `${selectedFloor}F`, report_location: locText, description: problemDescription,
        service_type: APP_CONFIG[currentService].name_tw, sign_in_time: '', sign_in_interval: '', sign_in_check: ''
    };

    setTimeout(() => updateProgress(2, '正在處理照片...'), 300);

    let photoPromise = uploadedFile ? compressAndUploadImage().then(id => { if (id) formData.photo_id = id; return formData; }).catch(() => formData) : Promise.resolve(formData);

    photoPromise.then(data => {
        updateProgress(3, '正在發送通報至系統...');
        return sendReportToBackend(data);
    }).then(() => {
        updateProgress(4, '通報完成！');
        setTimeout(() => { DOM.select(`#${progressId}`)?.remove(); setStep('completed'); }, 600);
    }).catch(err => {
        showToast('通報失敗，請稍後再試', 'warning');
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
            <div class="success-title">${APP_CONFIG[currentService].name_tw}通報完成</div>
            <div class="success-message">感謝您的通知<br>讓我們做得更好</div>
            <div class="success-divider"></div>
            <div class="quick-replies"><button class="quick-reply-btn new-report-btn-dynamic">新的通報</button></div>
        </div>`);
}

// ==================== 動態模態框控制 ====================
function showFloorModal() {
    document.body.style.overflow = 'hidden';
    DOM.select('#floorModalTitle').textContent = `選擇${APP_CONFIG[currentService].name_tw}樓層`;

    const floors = APP_CONFIG[currentService].floors.split(',').map(s => s.trim()).filter(s => s);
    DOM.select('#floorOptions').innerHTML = floors.map(f => `<button class="floor-option-btn ${selectedFloor.toString() === f.toString() ? 'selected' : ''}" data-floor="${f}">${f}F</button>`).join('');
    DOM.select('#floorModal').style.display = 'flex';
}

function showLocationModal() {
    document.body.style.overflow = 'hidden';
    DOM.select('#locationModalTitle').textContent = `選擇${APP_CONFIG[currentService].name_tw}地點`;

    const locs = APP_CONFIG[currentService].locations_tw;

    const customHTML = `
        <div class="custom-location-section">
            <div class="custom-location-title">自訂地點</div>
            <div class="custom-location-group" id="modalCustomLocationGroup">
                <div class="custom-location-icon">📍</div>
                <input type="text" class="custom-location-input custom-location-input-dynamic ${customLocation ? '' : 'placeholder-active'}" id="modalCustomLocationInput" placeholder="輸入自訂地點" value="${customLocation || ''}">
            </div>
            <button class="custom-location-confirm-btn custom-location-confirm-btn-dynamic">確認自訂地點</button>
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
    showToast(`已選擇：${floor}F`, 'success');
}

function selectLocation(locId, btnTarget) {
    selectedLocation = locId; customLocation = '';
    DOM.select('.location-select-btn-dynamic .location-value').textContent = locId;
    DOM.selectAll('.location-option-btn').forEach(b => b.classList.remove('selected'));
    if (btnTarget) btnTarget.classList.add('selected');
    closeModal(DOM.select('#locationModal'));
    showToast(`已選擇：${locId}`, 'success');
}

function confirmCustomLocation() {
    const val = DOM.select('#modalCustomLocationInput').value.trim();
    if (!val || val === '輸入自訂地點') return showToast('請輸入自訂地點', 'warning');
    if (val.length > 100) return showToast('自訂地點長度超過100字限制', 'warning');
    selectedLocation = ''; customLocation = val;
    DOM.select('.location-select-btn-dynamic .location-value').textContent = val;
    closeModal(DOM.select('#locationModal'));
    showToast(`已設定自訂地點：${val}`, 'success');
}

function closeModal(modal) { if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; } }

function addBotMessage(content) {
    const id = 'msg-' + Date.now();
    DOM.select('#chatContainer').insertAdjacentHTML('beforeend', `
        <div class="message bot-message" id="${id}">
            <div class="avatar bot-avatar"><img src="static/pic/avatar.png" alt="客服人員"></div>
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