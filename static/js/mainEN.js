// ==================== Configuration Block ====================
const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbwKxZON3tIGAYVJAXqBEBOLEBaQlCdHgWevywV-phUOxED0fU_mmOtgaPlmc-cWGwwZ/exec',
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
            if (target) {
                handler.call(target, e, target);
            }
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

// ==================== Step Status & Data ====================
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

const SERVICE_TYPES = { 'office': 'Office Tower', 'shopping': 'Shopping Mall', 'observatory': 'Observatory' };

const OFFICE_LOCATIONS = [
    { id: 'male_toilet', label: "Men's Room" }, { id: 'female_toilet', label: "Ladies' Room" },
    { id: 'public_corridor', label: 'Public Corridor' }, { id: 'public_elevator', label: 'Elevator' },
    { id: 'public_pantry', label: 'Pantry' }, { id: 'public_freight_lift', label: 'Freight Elevator' }
];
const MALL_LOCATIONS = [
    { id: 'male_toilet', label: "Men's Room" }, { id: 'female_toilet', label: "Ladies' Room" }, { id: 'nursing_room', label: 'Nursing Room' }
];
const OBSERVATORY_LOCATIONS = [
    { id: 'male_toilet', label: "Men's Room" }, { id: 'female_toilet', label: "Ladies' Room" },
    { id: 'nursing_room', label: 'Nursing Room' }, { id: 'east_area', label: 'East Area' }, { id: 'west_area', label: 'West Area' }
];

const SHOPPING_FLOORS = ['B1', '1', '2', '3', '4', '5'];
const OBSERVATORY_FLOORS = ['89', '91', '101'];

// ==================== URL Parameter Parsing ====================
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    hasUrlParams = urlParams.toString().length > 0;
    if (!hasUrlParams) return;

    const serviceParam = (urlParams.get('service') || '').toLowerCase();
    autoDetectedService = ['office', 'shopping', 'observatory'].includes(serviceParam) ? serviceParam : '';

    const floorParam = urlParams.get('floor') || '';
    if (floorParam) {
        if (floorParam.toUpperCase() === 'B1') autoDetectedFloor = 'B1';
        else if (/^[1-9][0-9]*$|^[1-9][0-9]*F$/i.test(floorParam)) autoDetectedFloor = floorParam.replace(/F/gi, '');
    }

    const rawLocation = (urlParams.get('location') || '').trim();
    if (rawLocation) {
        const chineseToEnglishMap = {
            '男生廁所': "Men's Room", '女生廁所': "Ladies' Room", '公共走道': 'Public Corridor',
            '公共電梯': 'Elevator', '茶水間': 'Pantry', '貨梯廳': 'Freight Elevator',
            '哺乳室': 'Nursing Room', '東面場域': 'East Area', '西區場域': 'West Area'
        };
        autoDetectedLocation = chineseToEnglishMap[rawLocation] || rawLocation;
    }
}

// ==================== App Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('touchstart', PerformanceUtils.throttle(function (event) {
        if (event.touches.length > 1) event.preventDefault();
    }, 100), { passive: false });
    document.body.style.overscrollBehavior = 'none';

    parseUrlParams();
    bindGlobalEvents();

    if (hasUrlParams && autoDetectedService && SERVICE_TYPES[autoDetectedService]) {
        initChatWithUrlParams();
    } else {
        initChat();
    }
});

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
    DOM.delegate('click', '.location-select-btn-dynamic, .location-select-btn-office', showLocationModal);

    DOM.delegate('click', '.floor-option-btn', (e, target) => selectFloor(target.dataset.floor, target));
    DOM.delegate('click', '.location-option-btn', (e, target) => selectLocation(target.dataset.location, target));
    
    DOM.delegate('click', '.custom-location-confirm-btn-dynamic', confirmCustomLocation);
    DOM.delegate('focus', '.custom-location-input-dynamic', function() {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });
    DOM.delegate('blur', '.custom-location-input-dynamic', function() {
        if (!this.value.trim()) { this.classList.add('placeholder-active'); this.value = 'Enter custom location'; }
    });

    // Floor input with 1-88 limit for Office Tower
    DOM.delegate('input', '.floor-input-office', PerformanceUtils.throttle(function() {
        let val = this.value.trim();
        if (val === '') return;
        let num = parseInt(val);
        if (isNaN(num)) { this.value = ''; }
        else if (num > 88) { this.value = '88'; showToast('Floor adjusted to 88', 'warning'); }
        else if (num < 1) { this.value = '1'; showToast('Floor adjusted to 1', 'warning'); }
    }, 100));
    
    DOM.delegate('blur', '.floor-input-office', function() {
        let val = this.value.trim();
        if (!val) { this.classList.add('placeholder-active'); this.value = 'Enter floor (1-88)'; }
        else {
            let num = parseInt(val);
            if (isNaN(num)) { this.value = ''; showToast('Please enter a valid number', 'warning'); }
            else if (num > 88) { this.value = '88'; showToast('Floor adjusted to 88', 'warning'); }
            else if (num < 1) { this.value = '1'; showToast('Floor adjusted to 1', 'warning'); }
        }
    });
    
    DOM.delegate('focus', '.floor-input-office', function() {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });

    // Description input focus/blur logic
    DOM.delegate('focus', '.description-input-office, .description-input-dynamic', function() {
        if (this.classList.contains('placeholder-active')) { this.classList.remove('placeholder-active'); this.value = ''; }
    });
    DOM.delegate('blur', '.description-input-office, .description-input-dynamic', function() {
        if (!this.value.trim()) { this.classList.add('placeholder-active'); this.value = 'Maintenance, cleaning, or repair required'; }
    });
    DOM.delegate('input', '.description-input-office, .description-input-dynamic', function() {
        if (this.value.trim()) this.classList.remove('placeholder-active');
    });

    DOM.delegate('click', '.confirm-form-btn-office, .confirm-form-btn-dynamic', confirmForm);

    // Dual-button Photo Upload Events
    DOM.delegate('click', '.take-photo-btn-dynamic', () => handleUploadClick(true));  // Open Camera
    DOM.delegate('click', '.choose-photo-btn-dynamic', () => handleUploadClick(false)); // Open Gallery
    
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
                <div class="welcome-subtitle">Welcome to ${SERVICE_TYPES[autoDetectedService]}</div>
            </div>
        `);
        setTimeout(() => {
            currentService = autoDetectedService;
            if (autoDetectedFloor) selectedFloor = autoDetectedFloor;
            if (autoDetectedLocation) {
                const match = findLocationMatch(autoDetectedLocation, currentService);
                if (match) selectedLocation = match.id; else customLocation = autoDetectedLocation;
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
    const services = [
        { icon: '🏢', title: 'Office Tower', desc: 'Office area service', value: 'office' },
        { icon: '🛍️', title: 'Shopping Mall', desc: 'Shopping area service', value: 'shopping' },
        { icon: '🏙️', title: 'Observatory', desc: 'Observatory area service', value: 'observatory' }
    ];
    addBotMessage(`
        <div class="service-buttons" id="serviceButtons">
            ${services.map(s => `
                <div class="service-button" data-service="${s.value}">
                    <div class="service-button-icon">${s.icon}</div>
                    <div class="service-button-content">
                        <div class="service-button-title">${s.title}</div>
                        <div class="service-button-desc">${s.desc}</div>
                    </div>
                </div>`).join('')}
        </div>
    `);
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
        addUserMessage(SERVICE_TYPES[serviceType] || 'Service');
        currentStep = 'input_form';
        chatSteps['input_form'] = DOM.selectAll('.message').length;
        showReportForm();
    } else {
        initChat();
    }
}

function findLocationMatch(locationText, serviceType) {
    let locations = serviceType === 'office' ? OFFICE_LOCATIONS : (serviceType === 'shopping' ? MALL_LOCATIONS : OBSERVATORY_LOCATIONS);
    const exact = locations.find(loc => loc.label === locationText || loc.id === locationText);
    if (exact) return exact;

    const map = { '男生廁所': "Men's Room", '女生廁所': "Ladies' Room", '公共走道': 'Public Corridor', '公共電梯': 'Elevator', '茶水間': 'Pantry', '貨梯廳': 'Freight Elevator', '哺乳室': 'Nursing Room', '東面場域': 'East Area', '西區場域': 'West Area' };
    if (map[locationText]) return locations.find(loc => loc.label === map[locationText]);
    return locations.find(loc => locationText.includes(loc.label) || loc.label.includes(locationText)) || null;
}

// ==================== 2. Report Form ====================
function showReportForm() {
    DOM.selectAll('.bot-message').forEach(msg => {
        if (msg.querySelector('.form-title') || msg.querySelector('.horizontal-case-card') || msg.querySelector('.take-photo-btn-dynamic') || msg.querySelector('.success-container') || msg.querySelector('.progress-indicator')) {
            msg.remove();
        }
    });

    const formTitles = { 'office': '🏢 Office Tower Service Form', 'shopping': '🛍️ Shopping Mall Service Form', 'observatory': '🏙️ Observatory Service Form' };
    const title = formTitles[currentService] || 'Service Form';
    
    let locText = 'Select location';
    if (selectedLocation) {
        const locations = currentService === 'office' ? OFFICE_LOCATIONS : (currentService === 'shopping' ? MALL_LOCATIONS : OBSERVATORY_LOCATIONS);
        locText = locations.find(l => l.id === selectedLocation)?.label || selectedLocation;
    } else if (customLocation) {
        locText = customLocation;
    }

    let descVal = (problemDescription && problemDescription !== 'Maintenance, cleaning, or repair required') ? problemDescription : 'Maintenance, cleaning, or repair required';
    let descClass = 'form-control ' + (currentService === 'office' ? 'description-input-office' : 'description-input-dynamic') + ((problemDescription && problemDescription !== 'Maintenance, cleaning, or repair required') ? ' has-user-input' : ' placeholder-active');

    let formHTML = '';
    if (currentService === 'office') {
        formHTML = `
            <div class="form-title">${title}</div>
            <div class="form-group">
                <label class="form-label">Floor <span>*</span></label>
                <input type="number" class="form-control floor-input-office" value="${selectedFloor || ''}" placeholder="Enter floor (1-88)" min="1" max="88">
            </div>
            <div class="form-group">
                <label class="form-label">Location <span>*</span></label>
                <button class="location-select-btn location-select-btn-office">
                    <div class="location-display"><span class="location-value">${locText}</span><span class="location-arrow">▼</span></div>
                </button>
            </div>
            <div class="form-group">
                <label class="form-label">Details (Optional)</label>
                <textarea class="${descClass}" rows="3">${descVal}</textarea>
            </div>
            <div class="quick-replies"><button class="quick-reply-btn confirm-form-btn-office">Next</button></div>`;
    } else {
        let floorText = selectedFloor ? `${selectedFloor}F` : 'Select floor';
        formHTML = `
            <div class="form-title">${title}</div>
            <div class="form-group">
                <label class="form-label">Floor <span>*</span></label>
                <button class="floor-select-btn floor-select-btn-dynamic">
                    <div class="floor-display"><span class="floor-value">${floorText}</span><span class="floor-arrow">▼</span></div>
                </button>
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
    }
    addBotMessage(formHTML);
}

function confirmForm() {
    let descInput;
    if (currentService === 'office') {
        const floorInput = DOM.select('.floor-input-office');
        descInput = DOM.select('.description-input-office');
        let val = floorInput.value.trim();
        if (val) {
            const num = parseInt(val);
            if (isNaN(num) || num < 1 || num > 88) { showToast('Please enter a valid floor (1-88)', 'warning'); return; }
            selectedFloor = num.toString();
        }
    } else {
        descInput = DOM.select('.description-input-dynamic');
    }

    if (!selectedFloor) { showToast(currentService === 'office' ? 'Please enter floor' : 'Please select floor', 'warning'); return; }
    
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

// ==================== 3. Photo Upload (Dual-Button UI) ====================
function askForPhoto() {
    DOM.selectAll('.bot-message').forEach(msg => {
        if (msg.innerHTML.includes('Add photo for reference?') || msg.querySelector('.take-photo-btn-dynamic') || msg.querySelector('.preview-image-dynamic')) msg.remove();
    });

    addBotMessage('Add photo for reference? (Optional)');
    let html = uploadedFilePreview ? `
        <img class="upload-preview preview-image-dynamic" src="${uploadedFilePreview}" alt="" style="display: block; cursor: pointer; max-width: 100%; max-height: 200px; margin: 20px auto; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div class="quick-replies" style="margin-top: 18px;">
            <button class="quick-reply-btn skip-photo-btn-dynamic">Remove Photo</button>
            <button class="quick-reply-btn confirm-photo-btn-dynamic">Confirm</button>
        </div>` : `
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <div class="upload-area take-photo-btn-dynamic" style="flex: 1; margin: 0; padding: 15px 5px; cursor: pointer;">
                <div class="upload-icon" style="font-size: 24px; margin-bottom: 5px;">📷</div>
                <div style="font-weight: 600; font-size: 14px; color: #2d3436;">Take Photo</div>
            </div>
            <div class="upload-area choose-photo-btn-dynamic" style="flex: 1; margin: 0; padding: 15px 5px; cursor: pointer;">
                <div class="upload-icon" style="font-size: 24px; margin-bottom: 5px;">🖼️</div>
                <div style="font-weight: 600; font-size: 14px; color: #2d3436;">Gallery</div>
            </div>
        </div>
        <div class="quick-replies" style="margin-top: 10px;">
            <button class="quick-reply-btn skip-photo-btn-dynamic">Skip</button>
        </div>`;
    addBotMessage(html);
}

// Depending on the button clicked, add 'capture' attribute for Camera
function handleUploadClick(isCamera = false) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = 'temp-file-input';
    fileInput.accept = 'image/*';
    
    // Force camera hardware opening if Take Photo is clicked
    if (isCamera) {
        fileInput.capture = 'environment';
    }

    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    fileInput.addEventListener('change', function(e) {
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
    reader.onload = function(e) {
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

    let locText = customLocation || (OFFICE_LOCATIONS.concat(MALL_LOCATIONS, OBSERVATORY_LOCATIONS).find(l => l.id === selectedLocation)?.label || selectedLocation);
    const html = `
        <div class="horizontal-case-card">
            <div class="horizontal-details-list">
                <div class="horizontal-detail-row">
                    <div class="detail-label-section"><span class="detail-label-text">Type</span></div>
                    <div class="detail-value-section"><span class="detail-value-text">${SERVICE_TYPES[currentService]}</span></div>
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
            <button class="quick-reply-btn submit-report-btn" style="background: #4a90e2 !important; color: white !important;">✓ Submit Report</button>
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
    const locText = customLocation || (OFFICE_LOCATIONS.concat(MALL_LOCATIONS, OBSERVATORY_LOCATIONS).find(l => l.id === selectedLocation)?.label || selectedLocation);
    
    const formData = {
        action: 'report',
        report_date: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`,
        report_time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
        report_floor: `${selectedFloor}F`, report_location: locText, description: problemDescription,
        service_type: SERVICE_TYPES[currentService], sign_in_time: '', sign_in_interval: '', sign_in_check: ''
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
            <div style="margin-bottom: 25px;"><div class="success-title">${SERVICE_TYPES[currentService]} Submitted</div></div>
            <div style="margin-bottom: 35px;"><div class="success-message">Thank you for your report.</div><div class="success-message">We will process it shortly.</div></div>
            <div style="height: 1px; background: #e9ecef; margin: 30px 0;"></div>
            <div class="quick-replies"><button class="quick-reply-btn new-report-btn-dynamic">New Report</button></div>
        </div>`);
}

// ==================== Modals & UI Controls ====================
function showFloorModal() {
    document.body.style.overflow = 'hidden';
    DOM.select('#floorModalTitle').textContent = 'Select Floor';
    const floors = currentService === 'shopping' ? SHOPPING_FLOORS : OBSERVATORY_FLOORS;
    DOM.select('#floorOptions').innerHTML = floors.map(f => `<button class="floor-option-btn ${selectedFloor.toString() === f.toString() ? 'selected' : ''}" data-floor="${f}">${f}F</button>`).join('');
    DOM.select('#floorModal').style.display = 'flex';
}

function showLocationModal() {
    document.body.style.overflow = 'hidden';
    DOM.select('#locationModalTitle').textContent = 'Select Location';
    const locs = currentService === 'office' ? OFFICE_LOCATIONS : (currentService === 'shopping' ? MALL_LOCATIONS : OBSERVATORY_LOCATIONS);
    
    const customHTML = `
        <div class="custom-location-section">
            <div class="custom-location-title">Custom Location</div>
            <div class="custom-location-group" id="modalCustomLocationGroup">
                <div class="custom-location-icon">📍</div>
                <input type="text" class="custom-location-input custom-location-input-dynamic ${customLocation ? '' : 'placeholder-active'}" id="modalCustomLocationInput" placeholder="Enter custom location" value="${customLocation || ''}">
            </div>
            <button class="custom-location-confirm-btn custom-location-confirm-btn-dynamic">Confirm</button>
        </div>`;
    DOM.select('#locationOptions').innerHTML = locs.map(l => `<button class="location-option-btn ${selectedLocation === l.id ? 'selected' : ''}" data-location="${l.id}">${l.label}</button>`).join('') + customHTML;
    DOM.select('#locationModal').style.display = 'flex';
}

function selectFloor(floor, btnTarget) {
    selectedFloor = floor;
    if (currentService !== 'office') DOM.select('.floor-select-btn-dynamic .floor-value').textContent = floor + 'F';
    DOM.selectAll('.floor-option-btn').forEach(b => b.classList.remove('selected'));
    if (btnTarget) btnTarget.classList.add('selected');
    closeModal(DOM.select('#floorModal'));
    showToast(`Selected: ${floor}F`, 'success');
}

function selectLocation(locId, btnTarget) {
    selectedLocation = locId; customLocation = '';
    const locs = currentService === 'office' ? OFFICE_LOCATIONS : (currentService === 'shopping' ? MALL_LOCATIONS : OBSERVATORY_LOCATIONS);
    const label = locs.find(l => l.id === locId)?.label || locId;
    DOM.select(currentService === 'office' ? '.location-select-btn-office .location-value' : '.location-select-btn-dynamic .location-value').textContent = label;
    DOM.selectAll('.location-option-btn').forEach(b => b.classList.remove('selected'));
    if (btnTarget) btnTarget.classList.add('selected');
    closeModal(DOM.select('#locationModal'));
    showToast(`Selected: ${label}`, 'success');
}

function confirmCustomLocation() {
    const val = DOM.select('#modalCustomLocationInput').value.trim();
    if (!val || val === 'Enter custom location') return showToast('Please enter a location', 'warning');
    if (val.length > 100) return showToast('Location name exceeds 100 characters', 'warning');
    selectedLocation = ''; customLocation = val;
    DOM.select(currentService === 'office' ? '.location-select-btn-office .location-value' : '.location-select-btn-dynamic .location-value').textContent = val;
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
        if (c) {
            c.scrollTo({
                top: c.scrollHeight,
                behavior: 'smooth'
            });
        }
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