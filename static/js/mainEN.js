// ==================== Configuration Block ====================

const API_CONFIG = {
    MAIN_API: 'https://script.google.com/macros/s/AKfycbwKxZON3tIGAYVJAXqBEBOLEBaQlCdHgWevywV-phUOxED0fU_mmOtgaPlmc-cWGwwZ/exec',
    UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
};

// ==================== Stable Button Event Handlers ====================
function setupStableButtonHandlers() {
    // Floor buttons
    $(document).off('click', '.floor-option-btn').on('click', '.floor-option-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const floor = $btn.data('floor');

        // Clear all same type button states
        $('.floor-option-btn').removeClass('selected active');

        // Set current button state
        $btn.addClass('selected');

        // Brief active state (visual feedback)
        $btn.addClass('active');
        setTimeout(() => {
            $btn.removeClass('active');
        }, 150);

        // Execute business logic
        selectFloor(floor);
    });

    // Location buttons
    $(document).off('click', '.location-option-btn').on('click', '.location-option-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const locationId = $btn.data('location');

        // Clear all same type button states
        $('.location-option-btn').removeClass('selected active');

        // Set current button state
        $btn.addClass('selected');

        // Brief active state
        $btn.addClass('active');
        setTimeout(() => {
            $btn.removeClass('active');
        }, 150);

        // Execute business logic
        selectLocation(locationId);
    });

    // Prevent rapid double-click
    let lastClickTime = 0;
    $(document).on('click', '.floor-option-btn, .location-option-btn', function (e) {
        const now = Date.now();
        if (now - lastClickTime < 300) { // 300ms anti-double-click
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }
        lastClickTime = now;
    });
}

// ==================== Step Status ====================

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

// Conversation step tracking
let chatSteps = {
    'select_service': -1,
    'input_form': -1,
    'input_photo': -1,
    'confirmation': -1,
    'completed': -1
};

// ==================== Service Type Mapping ====================

const SERVICE_TYPES = {
    'office': 'Office Tower',
    'shopping': 'Shopping Mall',
    'observatory': 'Observatory'
};

// ==================== Location Options ====================

const OFFICE_LOCATIONS = [
    { id: 'male_toilet', label: "Men's Room" },
    { id: 'female_toilet', label: "Ladies' Room" },
    { id: 'public_corridor', label: 'Public Corridor' },
    { id: 'public_elevator', label: 'Elevator' },
    { id: 'public_pantry', label: 'Pantry' },
    { id: 'public_freight_lift', label: 'Freight Elevator' }
];

const MALL_LOCATIONS = [
    { id: 'male_toilet', label: "Men's Room" },
    { id: 'female_toilet', label: "Ladies' Room" },
    { id: 'nursing_room', label: 'Nursing Room' }
];

const OBSERVATORY_LOCATIONS = [
    { id: 'male_toilet', label: "Men's Room" },
    { id: 'female_toilet', label: "Ladies' Room" },
    { id: 'nursing_room', label: 'Nursing Room' },
    { id: 'east_area', label: 'East Area' },
    { id: 'west_area', label: 'West Area' }
];

// ==================== Floor Options ====================

const SHOPPING_FLOORS = ['B1', '1', '2', '3', '4', '5'];
const OBSERVATORY_FLOORS = ['89', '91', '101'];

// ==================== URL Parameter Parsing ====================

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

    // Get raw location parameter
    const rawLocation = (urlParams.get('location') || '').trim();

    // If there's a location, try to translate Chinese to English
    if (rawLocation) {
        // Chinese to English location mapping
        const chineseToEnglishMap = {
            // Office locations
            '男生廁所': "Men's Room",
            '女生廁所': "Ladies' Room",
            '公共走道': 'Public Corridor',
            '公共電梯': 'Elevator',
            '茶水間': 'Pantry',
            '貨梯廳': 'Freight Elevator',

            // Mall locations
            '哺乳室': 'Nursing Room',

            // Observatory locations
            '東面場域': 'East Area',
            '西區場域': 'West Area'
        };

        // If directly matches Chinese, use translation
        if (chineseToEnglishMap[rawLocation]) {
            autoDetectedLocation = chineseToEnglishMap[rawLocation];
        } else {
            // Otherwise keep original value (might be English or custom location)
            autoDetectedLocation = rawLocation;
        }
    } else {
        autoDetectedLocation = '';
    }
}

// ==================== Step Management ====================

function setStep(step) {
    console.log('Setting step:', step, 'Current step:', currentStep);

    // Update current step
    currentStep = step;

    // Mark the starting position of the new step
    const messageCount = $('.message').length;
    chatSteps[step] = messageCount;

    console.log('Step index updated:', step, '=>', messageCount);

    // Show the step
    showStep(step);
}

function clearStepsAfter(step) {
    console.log('Clearing conversation after step, target step:', step, 'Current step index:', chatSteps[step]);

    const $chatContainer = $('#chatContainer');
    const $messages = $chatContainer.children('.message');

    // Find the starting position of this step
    const startIndex = chatSteps[step];
    if (startIndex === undefined || startIndex < 0) {
        console.log('Could not find step starting position, attempting to clear from last form');

        // Try to find the last form message
        let lastFormIndex = -1;
        $messages.each(function (index) {
            if ($(this).find('.form-title').length > 0) {
                lastFormIndex = index;
            }
        });

        if (lastFormIndex >= 0) {
            console.log('Found form message index:', lastFormIndex);
            // Clear from after the form
            for (let i = $messages.length - 1; i >= lastFormIndex; i--) {
                console.log('Removing message index:', i);
                $($messages[i]).remove();
            }

            // Reset step index
            chatSteps[step] = lastFormIndex;
            // Clear all step indices after this step
            Object.keys(chatSteps).forEach(key => {
                if (chatSteps[key] > lastFormIndex) {
                    chatSteps[key] = -1;
                }
            });
        } else {
            console.log('Could not find form, clearing all messages');
            $chatContainer.empty();
            chatSteps[step] = 0;
        }
        return;
    }

    console.log('Clearing from index:', startIndex, 'Total messages:', $messages.length);

    // Clear messages from the end
    for (let i = $messages.length - 1; i >= startIndex; i--) {
        console.log('Removing message index:', i);
        $($messages[i]).remove();
    }

    // Reset all step indices after this step
    Object.keys(chatSteps).forEach(key => {
        if (chatSteps[key] > startIndex) {
            chatSteps[key] = -1;
        }
    });
}

function goBackToStep(step) {
    console.log('========== Returning to step ==========');
    console.log('Target step:', step, 'Current message count:', $('.message').length);

    // Clear all conversation after this step
    clearStepsAfter(step);

    // Set current step
    currentStep = step;

    // Re-show this step
    showStep(step);
}

// ==================== Reset Application ====================

function resetApp() {
    currentStep = 'welcome';
    currentService = '';
    selectedFloor = '';
    selectedLocation = '';
    customLocation = '';
    problemDescription = '';
    uploadedFile = null;
    uploadedFilePreview = null;

    // Reset step tracking
    chatSteps = {
        'select_service': -1,
        'input_form': -1,
        'input_photo': -1,
        'confirmation': -1,
        'completed': -1
    };

    parseUrlParams();
}

// ==================== Event Binding ====================

function bindEvents() {
    $('#reloadLogo').off('click').on('click', function () {
        location.reload();
    });

    // Bind close button events
    $('#closeImageModalBtn').off('click').on('click', closeImageModal);
    $('#closeFloorModalBtn').off('click').on('click', closeFloorModal);
    $('#closeLocationModalBtn').off('click').on('click', closeLocationModal);

    // Remove old modal click events, use new click-outside-to-close logic
    $('.modal').off('click').on('click', function (event) {
        // Clicking on modal content area won't close it
        if ($(event.target).closest('.modal-content').length === 0) {
            closeModal($(this));
        }
    });

    // Add ESC key to close modals
    $(document).off('keydown').on('keydown', function (event) {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });

    // Switch to Chinese version button
    $('.report-label').off('click').on('click', function () {
        const currentParams = window.location.search;
        window.location.href = 'index.html' + currentParams;
    });

    setupStableButtonHandlers();
}

// ==================== New Helper Functions ====================
function closeModal($modal) {
    $modal.hide();
}

function closeAllModals() {
    $('.modal').hide();
}

// ==================== Application Initialization ====================
$(document).ready(function () {
    parseUrlParams();
    bindEvents();

    // Initialize button state
    $('.floor-option-btn, .location-option-btn').removeClass('selected active');

    if (hasUrlParams && autoDetectedService && SERVICE_TYPES[autoDetectedService]) {
        initChatWithUrlParams();
    } else {
        initChat();
    }
    setTimeout(scrollToBottom, 100);
});

// ==================== Initialization with URL Parameters ====================

function initChatWithUrlParams() {
    resetApp();

    $('#chatContainer').empty();

    setTimeout(() => {
        const serviceName = SERVICE_TYPES[autoDetectedService];

        // Directly show reporting form, no service selection
        addBotMessage(`
            <div class="welcome-message">
                <div class="welcome-title">TAIPEI 101 Service System</div>
                <div class="welcome-subtitle">Welcome to ${serviceName}</div>
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

// ==================== Normal Initialization ====================

function initChat() {
    resetApp();

    $('#chatContainer').empty();

    setTimeout(() => {
        addBotMessage(`
            <div class="welcome-message">
                <div class="welcome-title">TAIPEI 101 Service System</div>
                <div class="welcome-subtitle">Select your area to begin</div>
            </div>
        `);
        setStep('select_service');
    }, 500);
}

// ==================== Show Step ====================

function showStep(step) {
    console.log('Showing step:', step);

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

// ==================== Show Service Buttons ====================

function showServiceButtons() {
    // Clear any existing old buttons
    const existingButtons = document.querySelectorAll('.service-buttons');
    existingButtons.forEach(el => el.remove());

    const services = [
        { icon: '🏢', title: 'Office Tower', desc: 'Office area service', value: 'office' },
        { icon: '🛍️', title: 'Shopping Mall', desc: 'Shopping area service', value: 'shopping' },
        { icon: '🏙️', title: 'Observatory', desc: 'Observatory area service', value: 'observatory' }
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

    // Bind events
    setTimeout(() => {
        $(document).off('click', '.service-button').on('click', '.service-button', function () {
            const serviceType = $(this).data('service');
            selectService(serviceType);
        });
    }, 100);
}

// ==================== Select Service Type ====================

function selectService(serviceType) {
    console.log('Selecting service type:', serviceType);

    // Clear previous selection
    $('.service-button').removeClass('selected');
    $(`.service-button[data-service="${serviceType}"]`).addClass('selected');

    // Update service type - completely reset all status
    currentService = serviceType;
    selectedFloor = '';
    selectedLocation = '';
    customLocation = '';
    problemDescription = '';
    uploadedFile = null;
    uploadedFilePreview = null;

    // Clear all conversation, keep only welcome message and service selection
    const $chatContainer = $('#chatContainer');
    const $messages = $chatContainer.children('.message');

    // Find service selection message index
    let serviceSelectIndex = -1;
    $messages.each(function (index) {
        if ($(this).find('.service-buttons').length > 0) {
            serviceSelectIndex = index;
        }
    });

    if (serviceSelectIndex >= 0) {
        console.log('Found service selection message index:', serviceSelectIndex);

        // Clear all messages after service selection
        for (let i = $messages.length - 1; i > serviceSelectIndex; i--) {
            console.log('Removing message index:', i);
            $($messages[i]).remove();
        }

        // Reset step indices
        chatSteps = {
            'select_service': serviceSelectIndex,
            'input_form': -1,
            'input_photo': -1,
            'confirmation': -1,
            'completed': -1
        };

        // Add user selected service message
        const serviceName = SERVICE_TYPES[serviceType] || 'Service';
        addUserMessage(serviceName);

        // Update current step
        currentStep = 'input_form';
        chatSteps['input_form'] = $('.message').length;

        // Directly show form
        showReportForm();
    } else {
        // If service selection not found, reinitialize
        console.log('Service selection not found, reinitializing');
        initChat();
    }
}

// ==================== Get Current Location List ====================

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

// ==================== Location Matching Function ====================
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

    // First try direct English match
    const exactMatch = locations.find(loc =>
        loc.label === locationText ||
        loc.id === locationText
    );

    if (exactMatch) return exactMatch;

    // If no direct match, check if it's Chinese location, try translation match
    const chineseToEnglishMap = {
        // Office locations
        '男生廁所': "Men's Room",
        '女生廁所': "Ladies' Room",
        '公共走道': 'Public Corridor',
        '公共電梯': 'Elevator',
        '茶水間': 'Pantry',
        '貨梯廳': 'Freight Elevator',

        // Mall locations
        '哺乳室': 'Nursing Room',

        // Observatory locations
        '東面場域': 'East Area',
        '西區場域': 'West Area'
    };

    // Check if it's Chinese location
    if (chineseToEnglishMap[locationText]) {
        const translatedLocation = chineseToEnglishMap[locationText];
        const translatedMatch = locations.find(loc => loc.label === translatedLocation);
        if (translatedMatch) return translatedMatch;
    }

    // Finally try partial match
    const partialMatch = locations.find(loc =>
        locationText.includes(loc.label) ||
        loc.label.includes(locationText)
    );

    if (partialMatch) return partialMatch;

    return null;
}

// ==================== Show Report Form ====================

function showReportForm() {
    console.log('Showing report form, current service:', currentService, 'Current step:', currentStep);

    // Check if there's already a form of the same type
    const existingForms = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('form-title') || content.includes('Service Form');
    });

    if (existingForms.length > 0) {
        console.log('Found duplicate form, removing old one');
        existingForms.remove();
    }

    // Check and remove any existing photo inquiry messages
    const existingPhotoMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').text() || '';
        return content.includes('Add photo for reference');
    });

    if (existingPhotoMessages.length > 0) {
        console.log('Found photo inquiry message, removing');
        existingPhotoMessages.remove();
    }

    // Check and remove any existing confirmation page
    const existingConfirmations = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('horizontal-case-card');
    });

    if (existingConfirmations.length > 0) {
        console.log('Found confirmation page, removing');
        existingConfirmations.remove();
    }

    // Check and remove any existing progress bar
    const existingProgress = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('progress-indicator');
    });

    if (existingProgress.length > 0) {
        console.log('Found progress bar, removing');
        existingProgress.remove();
    }

    // Check and remove any existing success page
    const existingSuccess = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('success-container');
    });

    if (existingSuccess.length > 0) {
        console.log('Found success page, removing');
        existingSuccess.remove();
    }

    const formTitles = {
        'office': '🏢 Office Tower Service',
        'shopping': '🛍️ Shopping Mall Service',
        'observatory': '🏙️ Observatory Service'
    };

    const formTitle = formTitles[currentService] || 'Service Form';

    if (currentService === 'office') {
        let floorDisplayText = selectedFloor || 'Enter floor (1-88)';
        let locationDisplayText = 'Select location';

        if (selectedLocation) {
            const location = OFFICE_LOCATIONS.find(loc => loc.id === selectedLocation);
            locationDisplayText = location ? location.label : selectedLocation;
        } else if (customLocation) {
            locationDisplayText = customLocation;
        }

        let descriptionValue = '';
        let descriptionClass = 'form-control description-input-office';

        if (problemDescription && problemDescription !== 'Check, clean, or repair needed') {
            descriptionValue = problemDescription;
            descriptionClass += ' has-user-input';
        } else {
            descriptionValue = 'Check, clean, or repair needed';
            descriptionClass += ' placeholder-active';
        }

        const formHTML = `
            <div class="form-title">${formTitle}</div>
           
            <div class="form-group">
                <label class="form-label">Floor <span>*</span></label>
                <input type="number" class="form-control floor-input-office"
                       value="${selectedFloor || ''}"
                       placeholder="Enter floor (1-88)"
                       min="1" max="88">
            </div>
           
            <div class="form-group">
                <label class="form-label">Location <span>*</span></label>
                <button class="location-select-btn location-select-btn-office">
                    <div class="location-display">
                        <span class="location-value">${locationDisplayText}</span>
                        <span class="location-arrow">▼</span>
                    </div>
                </button>
            </div>
           
            <div class="form-group">
                <label class="form-label">Details (Optional)</label>
                <textarea class="${descriptionClass}"
                          rows="3">${descriptionValue}</textarea>
            </div>
           
            <div class="quick-replies">
                <button class="quick-reply-btn confirm-form-btn-office">
                    Next
                </button>
            </div>
        `;

        addBotMessage(formHTML);

        bindFormEvents();
    } else {
        let floorDisplayText = 'Select floor';
        if (selectedFloor) {
            floorDisplayText = `${selectedFloor}F`;
        }

        let locationDisplayText = 'Select location';
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

        if (problemDescription && problemDescription !== 'Check, clean, or repair needed') {
            descriptionValue = problemDescription;
            descriptionClass += ' has-user-input';
        } else {
            descriptionValue = 'Check, clean, or repair needed';
            descriptionClass += ' placeholder-active';
        }

        const formHTML = `
            <div class="form-title">${formTitle}</div>
           
            <div class="form-group">
                <label class="form-label">Floor <span>*</span></label>
                <button class="floor-select-btn floor-select-btn-dynamic">
                    <div class="floor-display">
                        <span class="floor-value">${floorDisplayText}</span>
                        <span class="floor-arrow">▼</span>
                    </div>
                </button>
            </div>
           
            <div class="form-group">
                <label class="form-label">Location <span>*</span></label>
                <button class="location-select-btn location-select-btn-dynamic">
                    <div class="location-display">
                        <span class="location-value">${locationDisplayText}</span>
                        <span class="location-arrow">▼</span>
                    </div>
                </button>
            </div>
           
            <div class="form-group">
                <label class="form-label">Details (Optional)</label>
                <textarea class="${descriptionClass}"
                          rows="3">${descriptionValue}</textarea>
            </div>
           
            <div class="quick-replies">
                <button class="quick-reply-btn confirm-form-btn-dynamic">
                    Next
                </button>
            </div>
        `;

        addBotMessage(formHTML);

        bindFormEvents();
    }
}

// ==================== Bind Form Events ====================

function bindFormEvents() {
    // Remove all old event bindings
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

// ==================== Floor Input Handling ====================

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
            showToast('Floor adjusted to 88', 'warning');
        } else if (floorNum < 1) {
            floorInput.val('1');
            showToast('Floor adjusted to 1', 'warning');
        }
    }
}

function handleOfficeFloorBlur() {
    const floorInput = $(this);
    let floorValue = floorInput.val().trim();

    if (!floorValue) {
        floorInput.addClass('placeholder-active');
        floorInput.val('Enter floor (1-88)');
    } else {
        let floorNum = parseInt(floorValue);
        if (isNaN(floorNum)) {
            floorInput.val('');
            showToast('Enter valid number', 'warning');
        } else if (floorNum > 88) {
            floorInput.val('88');
            showToast('Floor adjusted to 88', 'warning');
        } else if (floorNum < 1) {
            floorInput.val('1');
            showToast('Floor adjusted to 1', 'warning');
        }
    }
}

// ==================== Handle Input Box Events ====================

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
        descriptionInput.val('Check, clean, or repair needed');
    }
}

function handleDescriptionInput() {
    const descriptionInput = $(this);
    if (descriptionInput.val().trim()) {
        descriptionInput.removeClass('placeholder-active');
    }
}

// ==================== Confirm Form ====================

function confirmForm() {
    console.log('========== Confirming Form ==========');

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
                showToast('Enter valid floor (1-88)', 'warning');
                return;
            }
            selectedFloor = floorNum.toString();
        }
    } else {
        if (!selectedFloor) {
            showToast('Select floor', 'warning');
            return;
        }
    }

    if (!selectedFloor) {
        if (currentService === 'office') {
            showToast('Enter floor', 'warning');
        } else {
            showToast('Select floor', 'warning');
        }
        return;
    }

    // Safely get textarea value
    let descriptionValue = descriptionInput.val().trim();

    if (descriptionInput.hasClass('placeholder-active') ||
        !descriptionValue ||
        descriptionValue === 'Check, clean, or repair needed') {
        problemDescription = 'Check, clean, or repair needed';
    } else {
        // Frontend basic length check
        if (descriptionValue.length > 500) {
            showToast('Max 500 characters', 'warning');
            return;
        }

        problemDescription = descriptionValue;
    }

    if (!selectedLocation && !customLocation) {
        showToast('Select or enter location', 'warning');
        return;
    }

    if (customLocation && customLocation.length > 100) {
        showToast('Max 100 characters', 'warning');
        return;
    }

    let userMessageContent = '';

    if (problemDescription && problemDescription !== 'Check, clean, or repair needed') {
        userMessageContent = problemDescription;
    } else {
        userMessageContent = 'Check, clean, or repair needed';
    }

    // Remove all user messages after the form
    const $messages = $('.message');
    const formMessageIndex = $messages.filter(function () {
        return $(this).find('.form-title').length > 0;
    }).index();

    if (formMessageIndex >= 0) {
        console.log('Form message index:', formMessageIndex);

        // Remove all messages after the form (including Bot and User messages)
        for (let i = $messages.length - 1; i > formMessageIndex; i--) {
            console.log('Removing messages after form, index:', i);
            $($messages[i]).remove();
        }

        // Update step indices
        chatSteps['input_form'] = formMessageIndex;
        chatSteps['input_photo'] = -1;
        chatSteps['confirmation'] = -1;
    }

    // Add new description message - use text() to safely display
    addUserMessage(userMessageContent);

    setTimeout(() => {
        setStep('input_photo');
    }, 500);
}

// ==================== Ask for Photo ====================

function askForPhoto() {
    console.log('Asking for photo, current status:', uploadedFilePreview ? 'has photo' : 'no photo', 'Current step:', currentStep, 'Current message count:', $('.message').length);

    // Clear all old photo-related messages
    const photoMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('Add photo for reference') ||
            content.includes('upload-area-dynamic') ||
            content.includes('upload-preview') ||
            content.includes('skip-photo-btn-dynamic');
    });

    if (photoMessages.length > 0) {
        console.log('Found old photo-related messages, removing');
        photoMessages.remove();
    }

    // Add photo inquiry
    addBotMessage('Add photo for reference? (Optional)');

    let hasPhoto = uploadedFilePreview !== null;
    let photoHTML = '';

    if (hasPhoto) {
        // Already has photo: show photo and confirm upload button
        photoHTML = `
            <img class="upload-preview preview-image-dynamic" src="${uploadedFilePreview}" alt="" style="display: block; cursor: pointer; max-width: 100%; max-height: 200px; margin: 20px auto; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
           
            <div class="quick-replies" style="margin-top: 18px;">
                <button class="quick-reply-btn skip-photo-btn-dynamic">
                    Remove
                </button>
                <button class="quick-reply-btn confirm-photo-btn-dynamic">
                    Next
                </button>
            </div>
        `;
    } else {
        // No photo: show upload area
        photoHTML = `
            <div class="upload-area upload-area-dynamic">
                <div class="upload-icon">📷</div>
                <div style="font-weight: 600; margin-bottom: 8px; color: #2d3436;">Tap to add photo</div>
                <div style="font-size: 13px; color: #868e96;">JPG, PNG supported</div>
            </div>
            <img class="upload-preview preview-image-dynamic" alt="" style="display: none;">
           
            <div class="quick-replies" style="margin-top: 18px;">
                <button class="quick-reply-btn skip-photo-btn-dynamic">
                    Skip
                </button>
            </div>
        `;
    }

    addBotMessage(photoHTML);

    // Bind events
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

// ==================== Handle File Upload ====================

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('JPG, PNG, GIF or WebP only', 'warning');
        return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('Max 5MB', 'warning');
        return;
    }

    showToast('Processing...', 'info');

    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result;
        if (!base64Data.startsWith('data:image/')) {
            showToast('Invalid format', 'warning');
            return;
        }

        uploadedFilePreview = base64Data;
        showToast('Photo added', 'success');

        // Re-show photo step
        goBackToStep('input_photo');
    };

    reader.onerror = function () {
        showToast('Read failed', 'warning');
    };

    reader.readAsDataURL(file);
}

// ==================== Skip Photo ====================

function skipPhoto() {
    console.log('Skipping photo, current step:', currentStep);

    // First check and remove any possible progress bar remnants
    const progressMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('progress-indicator') ||
            content.includes('progress-title') ||
            content.includes('progress-steps');
    });

    if (progressMessages.length > 0) {
        console.log('Found progress bar remnants, removing count:', progressMessages.length);
        progressMessages.remove();
    }

    if (uploadedFilePreview) {
        // Remove photo
        uploadedFile = null;
        uploadedFilePreview = null;
        showToast('Photo removed', 'info');

        // Re-show photo step
        goBackToStep('input_photo');
    } else {
        // Skip upload
        uploadedFile = null;
        uploadedFilePreview = null;

        // Key fix: Check if there's already a "No photo upload" message
        const $existingSkipMessages = $('.user-message').filter(function () {
            return $(this).find('.message-content').text() === 'No photo upload';
        });

        // If there's already a "No photo upload" message, remove it first
        if ($existingSkipMessages.length > 0) {
            console.log('Found duplicate "No photo upload" message, removing count:', $existingSkipMessages.length);
            $existingSkipMessages.remove();
        }

        // Key fix: Find the last photo upload area message
        const $photoAreaMessages = $('.bot-message').filter(function () {
            const content = $(this).find('.message-content').html() || '';
            return content.includes('upload-area-dynamic') ||
                content.includes('upload-preview') ||
                content.includes('skip-photo-btn-dynamic') ||
                content.includes('confirm-photo-btn-dynamic');
        });

        if ($photoAreaMessages.length > 0) {
            // Add user message after photo upload area message
            const $lastPhotoAreaMessage = $photoAreaMessages.last();
            const userMessageId = 'msg-' + Date.now();
            const userMessageHTML = `
                <div class="message user-message" id="${userMessageId}">
                    <div class="avatar user-avatar">
                        <div class="avatar-placeholder">👤</div>
                    </div>
                    <div class="message-content-wrapper">
                        <div class="message-content">No photo upload</div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                </div>
            `;

            $(userMessageHTML).insertAfter($lastPhotoAreaMessage);
            console.log('Added "No photo upload" message after upload area, ID:', userMessageId);
        } else {
            // If can't find photo message, use original addUserMessage
            addUserMessage('No photo upload');
        }

        // Short delay before showing confirmation page
        setTimeout(() => {
            setStep('confirmation');
        }, 300);
    }
}

// ==================== Confirm Photo ====================

function confirmPhoto() {
    console.log('Confirming photo, current step:', currentStep);

    if (uploadedFilePreview) {
        // Key fix: Check if there's already a "Photo uploaded" message
        const $existingConfirmMessages = $('.user-message').filter(function () {
            return $(this).find('.message-content').text() === 'Photo uploaded';
        });

        // If there's already a "Photo uploaded" message, remove it first
        if ($existingConfirmMessages.length > 0) {
            console.log('Found duplicate "Photo uploaded" message, removing count:', $existingConfirmMessages.length);
            $existingConfirmMessages.remove();
        }

        // Key fix: Find the last photo upload area message
        const $photoAreaMessages = $('.bot-message').filter(function () {
            const content = $(this).find('.message-content').html() || '';
            return content.includes('upload-area-dynamic') ||
                content.includes('upload-preview') ||
                content.includes('skip-photo-btn-dynamic') ||
                content.includes('confirm-photo-btn-dynamic');
        });

        if ($photoAreaMessages.length > 0) {
            // Add user message after photo upload area message
            const $lastPhotoAreaMessage = $photoAreaMessages.last();
            const userMessageId = 'msg-' + Date.now();
            const userMessageHTML = `
                <div class="message user-message" id="${userMessageId}">
                    <div class="avatar user-avatar">
                        <div class="avatar-placeholder">👤</div>
                    </div>
                    <div class="message-content-wrapper">
                        <div class="message-content">Photo uploaded</div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                </div>
            `;

            $(userMessageHTML).insertAfter($lastPhotoAreaMessage);
            console.log('Added "Photo uploaded" message after upload area, ID:', userMessageId);
        } else {
            // If can't find photo message, use original addUserMessage
            addUserMessage('Photo uploaded');
        }

        // Short delay before showing confirmation page
        setTimeout(() => {
            setStep('confirmation');
        }, 300);
    }
}

// ==================== Show Confirmation Page ====================

function showConfirmation() {
    console.log('Showing confirmation page, current step:', currentStep);

    // Clear all old confirmation-related messages
    const confirmationMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('horizontal-case-card') ||
            content.includes('detail-label-text') ||
            content.includes('edit-info-btn');
    });

    if (confirmationMessages.length > 0) {
        console.log('Found old confirmation page, removing');
        confirmationMessages.remove();
    }

    // Check if there's already a success page, remove if exists
    const successMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('success-container') ||
            content.includes('Service Completed');
    });

    if (successMessages.length > 0) {
        console.log('Found success page, removing');
        successMessages.remove();

        // Reset step to confirmation
        currentStep = 'confirmation';
    }

    // Check and remove any existing progress bar
    const progressMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        return content.includes('progress-indicator') ||
            content.includes('progress-title') ||
            content.includes('progress-steps');
    });

    if (progressMessages.length > 0) {
        console.log('Found progress bar, removing count:', progressMessages.length);
        progressMessages.remove();
    }

    // Check and remove any existing empty messages (progress bar remnants)
    const emptyMessages = $('.bot-message').filter(function () {
        const content = $(this).find('.message-content').html() || '';
        // Check if empty content or only whitespace characters
        return content.trim() === '' ||
            content === '<div class="progress-indicator" id="progress-"></div>';
    });

    if (emptyMessages.length > 0) {
        console.log('Found empty messages, removing count:', emptyMessages.length);
        emptyMessages.remove();
    }

    const serviceTypeText = SERVICE_TYPES[currentService] || 'Service';

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
        problemDescription === 'Check, clean, or repair needed' ||
        problemDescription.trim() === '') {
        displayDescription = 'Check, clean, or repair needed';
    }

    const hasPhoto = uploadedFilePreview ? 'Yes' : 'No';
    const photoClass = uploadedFilePreview ? 'has-photo' : 'photo-value';

    // Create confirmation page HTML structure
    const confirmationHTML = `
        <div class="horizontal-case-card">
            <div class="horizontal-details-list">
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <span class="detail-label-text">Type</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${serviceTypeText}</span>
                    </div>
                </div>
               
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <span class="detail-label-text">Floor</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${displayFloor}</span>
                    </div>
                </div>
               
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <span class="detail-label-text">Location</span>
                    </div>
                    <div class="detail-value-section">
                        <span class="detail-value-text">${locationText}</span>
                    </div>
                </div>
               
                <div class="horizontal-detail-row">
                    <div class="detail-label-section">
                        <span class="detail-label-text">Photo</span>
                    </div>
                    <div class="detail-value-section ${photoClass}">
                        <span class="detail-value-text">${hasPhoto}</span>
                    </div>
                </div>
            </div>
           
            <div class="description-row">
                <div class="description-label-section">
                    <span class="description-label-text">Details</span>
                </div>
                <div class="description-content-section">
                    <div class="description-content-text"></div>
                </div>
            </div>
        </div>
       
        <div class="quick-replies">
            <button class="quick-reply-btn edit-info-btn">
                ✏️ Edit
            </button>
            <button class="quick-reply-btn submit-report-btn" style="background: #4a90e2 !important; color: white !important;">
                Submit
            </button>
        </div>
    `;

    // Add message to chat
    addBotMessage(confirmationHTML);

    // Find the just added description content area
    const $lastMessage = $('.bot-message').last();
    const $descriptionText = $lastMessage.find('.description-content-text');

    // Use text() method to set description content
    $descriptionText.text(displayDescription);

    // Bind events
    setTimeout(() => {
        $(document).off('click', '.edit-info-btn').on('click', '.edit-info-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('Clicking edit information button, current step:', currentStep);

            // First clear all subsequent conversation
            const $messages = $('.message');
            const formMessageIndex = $messages.filter(function () {
                return $(this).find('.form-title').length > 0;
            }).index();

            if (formMessageIndex >= 0) {
                // Clear all messages after the form
                for (let i = $messages.length - 1; i > formMessageIndex; i--) {
                    $($messages[i]).remove();
                }

                // Reset step indices
                chatSteps['input_form'] = formMessageIndex;
                chatSteps['input_photo'] = -1;
                chatSteps['confirmation'] = -1;

                // Re-show form
                currentStep = 'input_form';
                showStep('input_form');
            } else {
                // If form not found, return to form step
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

// ==================== Submit Report ====================

function submitReport() {
    console.log('========== Submitting Report ==========', 'Current step:', currentStep);

    // If already submitted, avoid duplicate submission
    if (currentStep === 'submitting' || currentStep === 'completed') {
        console.log('Already submitting or completed, skipping duplicate submission');
        return;
    }

    currentStep = 'submitting';

    // Show progress indicator
    const progressId = 'progress-' + Date.now();
    const progressHTML = `
        <div class="progress-indicator" id="${progressId}">
            <div class="progress-title">Processing</div>
            <div class="progress-steps">
                <div class="progress-step active" data-step="1">
                    <div class="step-icon">1</div>
                    <div class="step-label">Validating</div>
                </div>
                <div class="progress-step" data-step="2">
                    <div class="step-icon">2</div>
                    <div class="step-label">Processing</div>
                </div>
                <div class="progress-step" data-step="3">
                    <div class="step-icon">3</div>
                    <div class="step-label">Sending</div>
                </div>
                <div class="progress-step" data-step="4">
                    <div class="step-icon">4</div>
                    <div class="step-label">Complete</div>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-message">Processing your request...</div>
        </div>
    `;

    addBotMessage(progressHTML);

    // Update progress bar
    function updateProgress(step, message) {
        const $progress = $(`#${progressId}`);
        if ($progress.length === 0) {
            console.log('Progress bar element does not exist, skipping update');
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

    // Start processing flow
    updateProgress(1, 'Validating data...');

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
    const serviceTypeText = SERVICE_TYPES[currentService] || 'Service';

    let lineDescription = problemDescription;
    if (!lineDescription || lineDescription === '' ||
        lineDescription === 'Check, clean, or repair needed' || lineDescription.trim() === '') {
        lineDescription = 'Check, clean, or repair needed';
    }

    // Prepare raw data to send
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

    // Use Promise chain to handle progress display
    let processPromise;

    updateProgress(2, 'Processing photo...');

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
            updateProgress(3, 'Sending to system...');
            return sendReportToBackend(data);
        })
        .then(() => {
            updateProgress(4, 'Complete!');
            setTimeout(() => {
                // Safely remove progress bar
                const $progress = $(`#${progressId}`);
                if ($progress.length > 0) {
                    $progress.remove();
                }
                setStep('completed');
            }, 1000);
        })
        .catch(error => {
            console.error('Report failed:', error);
            showToast('Error, try again', 'warning');

            // Safely remove progress bar
            const $progress = $(`#${progressId}`);
            if ($progress.length > 0) {
                $progress.remove();
            }

            // Return to confirmation page
            currentStep = 'confirmation';
            goBackToStep('confirmation');
        });
}

// ==================== Compress and Upload Image ====================

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
                        reject(new Error('Upload failed'));
                    }
                })
                .catch(error => {
                    reject(error);
                });
        };

        reader.onerror = function () {
            reject(new Error('Read failed'));
        };

        reader.readAsDataURL(uploadedFile);
    });
}

// ==================== Send Report to Backend ====================

function sendReportToBackend(formData) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: API_CONFIG.MAIN_API,
            method: 'POST',
            data: formData,
            success: function (response) {
                console.log('Success:', response);
                resolve(response);
            },
            error: function (xhr, status, error) {
                console.error('Failed:', error);
                reject(error);
            }
        });
    });
}

// ==================== Show Success Page ====================

function showSuccessPage() {
    console.log('Showing success page, current step:', currentStep);

    // Ensure current step is completed
    currentStep = 'completed';

    const serviceTypeText = SERVICE_TYPES[currentService] || 'Service';

    const successHTML = `
        <div class="success-container">
            <div class="success-icon">✓</div>
           
            <div style="margin-bottom: 25px;">
                <div class="success-title">${serviceTypeText} Service Submitted</div>
            </div>
           
            <div style="margin-bottom: 35px;">
                <div class="success-message">Thank you for your report</div>
                <div class="success-message">We'll improve our service</div>
            </div>
           
            <div style="height: 1px; background: #e9ecef; margin: 30px 0;"></div>
           
            <div class="quick-replies">
                <button class="quick-reply-btn new-report-btn-dynamic">
                    New Report
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

// ==================== Modal Related Functions ====================

function showFloorModal() {
    const modalTitle = currentService === 'shopping' ? 'Select Floor' : 'Select Floor';
    $('#floorModalTitle').text(modalTitle);

    let floors = [];
    if (currentService === 'shopping') floors = SHOPPING_FLOORS;
    else if (currentService === 'observatory') floors = OBSERVATORY_FLOORS;

    const floorOptionsHTML = floors.map(floor => {
        const displayFloor = `${floor}F`;
        // Important change: Initialize button state each time modal opens, don't keep previous selection
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
    let locations = [];
    let modalTitle = '';

    if (currentService === 'office') {
        modalTitle = 'Select Location';
        locations = OFFICE_LOCATIONS;
    } else if (currentService === 'shopping') {
        modalTitle = 'Select Location';
        locations = MALL_LOCATIONS;
    } else if (currentService === 'observatory') {
        modalTitle = 'Select Location';
        locations = OBSERVATORY_LOCATIONS;
    }

    $('#locationModalTitle').text(modalTitle);

    const customLocationHTML = `
        <div class="custom-location-section">
            <div class="custom-location-title">Custom Location</div>
            <div class="custom-location-group" id="modalCustomLocationGroup">
                <div class="custom-location-icon">📍</div>
                <input type="text" class="custom-location-input custom-location-input-dynamic"
                       id="modalCustomLocationInput"
                       placeholder="Enter location"
                       value="${customLocation || ''}">
            </div>
            <button class="custom-location-confirm-btn custom-location-confirm-btn-dynamic">
                Confirm
            </button>
        </div>
    `;

    const locationOptionsHTML = locations.map(location => {
        // Important change: Initialize button state each time modal opens, don't keep previous selection
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
            if ($(this).val() === 'Enter location') {
                $(this).val('');
            }
        })
        .on('blur', '.custom-location-input-dynamic', function () {
            if (!$(this).val().trim()) {
                $(this).val('Enter location');
            }
        });

    $('#locationModal').show();
}

// ==================== Select Floor ====================
function selectFloor(floor) {
    if (!floor) return;

    selectedFloor = floor;
    const displayFloor = `${floor}F`;

    // Update UI
    if (currentService === 'shopping' || currentService === 'observatory') {
        $('.floor-select-btn-dynamic .floor-value').text(displayFloor);
    }

    // Ensure button state in modal is synchronized
    $('.floor-option-btn').removeClass('selected');
    const $targetBtn = $(`.floor-option-btn[data-floor="${floor}"]`);
    if ($targetBtn.length) {
        $targetBtn.addClass('selected');
    }

    closeFloorModal();
    showToast(`Selected：${displayFloor}`, 'success');
}

// ==================== Select Location ====================
function selectLocation(locationId) {
    if (!locationId) return;

    selectedLocation = locationId;
    customLocation = '';

    // Find location label
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

    // Update UI
    if (currentService === 'office') {
        $('.location-select-btn-office .location-value').text(locationLabel);
    } else {
        $('.location-select-btn-dynamic .location-value').text(locationLabel);
    }

    // Ensure button state in modal is synchronized
    $('.location-option-btn').removeClass('selected');
    const $targetBtn = $(`.location-option-btn[data-location="${locationId}"]`);
    if ($targetBtn.length) {
        $targetBtn.addClass('selected');
    }

    closeLocationModal();
    showToast(`Selected：${locationLabel}`, 'success');
}

function confirmCustomLocation() {
    const customInput = $('#modalCustomLocationInput');
    let customValue = customInput.val().trim();

    if (!customValue || customValue === 'Enter location') {
        showToast('Enter location', 'warning');
        return;
    }

    if (customValue.length > 100) {
        showToast('Max 100 characters', 'warning');
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
    showToast(`Set: ${customValue}`, 'success');
}

// ==================== Modal Close Functions (Modified) ====================
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

// ==================== Chat Message Functions ====================

function addBotMessage(content) {
    const messageId = 'msg-' + Date.now();
    const messageHTML = `
        <div class="message bot-message" id="${messageId}">
            <div class="avatar bot-avatar">
                <img src="static/pic/avatar.png" alt="Service">
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

    console.log('Added Bot message, ID:', messageId, 'Content summary:', content.substring(0, 50));

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

    // Use text() method to safely display user input content
    $message.find('.message-content').text(content);

    $('#chatContainer').append($message);
    scrollToBottom();

    console.log('Added User message, ID:', messageId, 'Content:', content);

    return '#' + messageId;
}

// ==================== Helper Functions ====================

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