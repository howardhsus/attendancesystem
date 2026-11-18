'use strict';

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

(function () {
    // ==================== 1. API Configuration ====================
    const API_CONFIG = {
        MAIN_API: 'https://script.google.com/macros/s/AKfycbxZ3d2bBMjfw1JWTovmV8w3wt9_ZLYHS8m0AnM-cqn29AR-wU4-k_iERc42nRobDc5R0Q/exec',
        UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
    };

    const CONFIG_CACHE_KEY = 't101_venue_config_v2';
    const CONFIG_SYNC_INTERVAL_MS = 15000;
    const DEFAULT_DESCRIPTION = 'Check, clean, or repair needed';

    const DEFAULT_CONFIG = {
        office: {
            name_tw: '辦公大樓',
            name_en: 'Office Tower',
            floors: '1-88',
            locations_tw: ['男生廁所', '女生廁所', '公共走道', '公共電梯', '茶水間', '貨梯廳'],
            locations_en: ["Men's Room", "Ladies' Room", 'Public Corridor', 'Elevator', 'Pantry', 'Freight Elevator']
        },
        shopping: {
            name_tw: '購物中心',
            name_en: 'Shopping Mall',
            floors: 'B1,1,2,3,4,5',
            locations_tw: ['男生廁所', '女生廁所', '哺乳室'],
            locations_en: ["Men's Room", "Ladies' Room", 'Nursing Room']
        },
        observatory: {
            name_tw: '觀景台',
            name_en: 'Observatory',
            floors: '89,91,101',
            locations_tw: ['男生廁所', '女生廁所', '哺乳室', '東面場域', '西區場域'],
            locations_en: ["Men's Room", "Ladies' Room", 'Nursing Room', 'East Area', 'West Area']
        }
    };

    const SERVICE_META = {
        office: { icon: '🏢', desc: 'Office area service' },
        shopping: { icon: '🛍️', desc: 'Shopping area service' },
        observatory: { icon: '🏙️', desc: 'Observatory area service' }
    };

    const LEGACY_LOCATION_ID_MAP = {
        male_toilet: "Men's Room",
        female_toilet: "Ladies' Room",
        public_corridor: 'Public Corridor',
        public_elevator: 'Elevator',
        public_pantry: 'Pantry',
        public_freight_lift: 'Freight Elevator',
        nursing_room: 'Nursing Room',
        east_area: 'East Area',
        west_area: 'West Area'
    };

    // ==================== 2. Dynamic Venue Config & Auto Sync ====================
    let SERVICE_TYPES = {};
    let SERVICES_LIST = [];
    let LOCATIONS_BY_SERVICE = {};
    let FLOOR_CONFIG_BY_SERVICE = {};
    let TW_TO_EN_LOCATIONS = {};
    let lastConfigSignature = '';
    let lastConfigSyncAt = 0;
    let isSyncingConfig = false;

    function parseFloorConfig(floorStr) {
        const raw = String(floorStr || '').trim();
        const rangeMatch = raw.match(/^(\d+)\s*F?\s*[-~～]\s*(\d+)\s*F?$/i);
        if (rangeMatch) {
            const min = parseInt(rangeMatch[1], 10);
            const max = parseInt(rangeMatch[2], 10);
            if (!isNaN(min) && !isNaN(max) && max >= min) {
                return { mode: 'range', min: min, max: max, options: [] };
            }
        }
        const options = raw
            .split(/[,，、]+/)
            .map(function (s) { return s.trim().replace(/F$/i, '').toUpperCase(); })
            .filter(Boolean);

        if (options.length === 0) {
            return { mode: 'range', min: 1, max: 101, options: [] };
        }
        return { mode: 'list', min: 1, max: 101, options: options };
    }

    function applyConfigData(configObj) {
        if (!configObj || typeof configObj !== 'object') return false;
        const codes = Object.keys(configObj);
        if (codes.length === 0) return false;

        const nextServiceTypes = {};
        const nextServicesList = [];
        const nextLocations = {};
        const nextFloorConfigs = {};
        const nextTwToEn = {
            '男生廁所': "Men's Room",
            '女生廁所': "Ladies' Room",
            '公共走道': 'Public Corridor',
            '公共電梯': 'Elevator',
            '茶水間': 'Pantry',
            '貨梯廳': 'Freight Elevator',
            '哺乳室': 'Nursing Room',
            '東面場域': 'East Area',
            '西區場域': 'West Area'
        };

        codes.forEach(function (rawCode) {
            const code = String(rawCode || '').trim().toLowerCase();
            const item = configObj[rawCode];
            if (!code || !item || typeof item !== 'object') return;

            const nameEn = String(item.name_en || item.name_tw || code).trim();
            const meta = SERVICE_META[code] || { icon: '📍', desc: nameEn + ' service' };

            nextServiceTypes[code] = nameEn;
            nextServicesList.push({
                icon: meta.icon,
                title: nameEn,
                desc: meta.desc,
                value: code
            });

            nextFloorConfigs[code] = parseFloorConfig(item.floors);

            const locTw = Array.isArray(item.locations_tw) ? item.locations_tw : [];
            const locEn = Array.isArray(item.locations_en) ? item.locations_en : [];
            const activeLocs = locEn.length > 0 ? locEn : locTw;

            nextLocations[code] = activeLocs
                .map(function (label) { return String(label || '').trim(); })
                .filter(Boolean)
                .map(function (label) { return { id: label, label: label }; });

            for (let i = 0; i < locTw.length; i++) {
                const twVal = String(locTw[i] || '').trim();
                const enVal = String(locEn[i] || '').trim();
                if (twVal && enVal) {
                    nextTwToEn[twVal] = enVal;
                }
            }
        });

        if (nextServicesList.length === 0) return false;

        SERVICE_TYPES = nextServiceTypes;
        SERVICES_LIST = nextServicesList;
        LOCATIONS_BY_SERVICE = nextLocations;
        FLOOR_CONFIG_BY_SERVICE = nextFloorConfigs;
        TW_TO_EN_LOCATIONS = nextTwToEn;
        lastConfigSignature = JSON.stringify(configObj);
        return true;
    }

    function loadCachedConfig() {
        try {
            const raw = localStorage.getItem(CONFIG_CACHE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (applyConfigData(parsed)) return;
            }
        } catch (e) {}
        applyConfigData(DEFAULT_CONFIG);
    }

    function saveCachedConfig(configObj) {
        try {
            localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(configObj));
        } catch (e) {}
    }

    function syncConfigFromBackend(force) {
        if (navigator.onLine === false) return;
        if (isSyncingConfig) return;
        if (!force && lastConfigSyncAt > 0 && (Date.now() - lastConfigSyncAt) < CONFIG_SYNC_INTERVAL_MS) {
            return;
        }

        isSyncingConfig = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(function () { controller.abort(); }, 12000);
        const url = API_CONFIG.MAIN_API + '?action=getConfig&_t=' + Date.now();

        fetch(url, { method: 'GET', signal: controller.signal })
            .then(function (res) {
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                isSyncingConfig = false;
                if (!data || !data.success || !data.config) return;

                lastConfigSyncAt = Date.now();
                const incomingSig = JSON.stringify(data.config);
                if (incomingSig === lastConfigSignature) return;

                if (applyConfigData(data.config)) {
                    saveCachedConfig(data.config);
                    refreshActiveUIWithLatestConfig();
                }
            })
            .catch(function () {
                clearTimeout(timeoutId);
                isSyncingConfig = false;
            });
    }

    function buildFloorFieldHtml(floorCfg) {
        if (floorCfg.mode === 'range') {
            return '<input type="text" class="form-control floor-input-range" ' +
                'placeholder="Enter floor (' + floorCfg.min + '-' + floorCfg.max + ')" ' +
                'inputmode="numeric" pattern="[0-9]*" maxlength="3">';
        }
        const floorText = state.floor ? formatFloorDisplay(state.floor) : 'Select floor';
        return '<button type="button" class="floor-select-btn">' +
            '<div class="floor-display">' +
            '<span class="floor-value">' + escapeHtml(floorText) + '</span>' +
            '<span class="floor-arrow">▼</span>' +
            '</div>' +
            '</button>';
    }

    function refreshActiveUIWithLatestConfig() {
        const serviceContainer = dom.chatContainer.querySelector('[data-step-tag="select_service"] .service-buttons');
        if (serviceContainer) {
            serviceContainer.innerHTML = buildServiceButtonsInnerHtml();
            if (state.service) {
                serviceContainer.querySelectorAll('.service-button').forEach(function (btn) {
                    btn.classList.toggle('selected', btn.getAttribute('data-service') === state.service);
                });
            }
        }

        const formMsg = dom.chatContainer.querySelector('[data-step-tag="input_form"]');
        if (formMsg && state.service && SERVICE_TYPES[state.service]) {
            const floorCfg = getFloorConfig(state.service);
            const floorSlot = formMsg.querySelector('.floor-field-slot');
            if (floorSlot) {
                const existingInput = floorSlot.querySelector('.floor-input-range');
                if (floorCfg.mode === 'range' && existingInput) {
                    existingInput.placeholder = 'Enter floor (' + floorCfg.min + '-' + floorCfg.max + ')';
                } else if (floorCfg.mode === 'range' && !existingInput) {
                    floorSlot.innerHTML = buildFloorFieldHtml(floorCfg);
                    const newInput = floorSlot.querySelector('.floor-input-range');
                    if (newInput && /^\d+$/.test(state.floor)) newInput.value = state.floor;
                } else if (floorCfg.mode === 'list' && existingInput) {
                    floorSlot.innerHTML = buildFloorFieldHtml(floorCfg);
                }
            }
        }

        if (dom.floorModal && dom.floorModal.classList.contains('modal-open')) {
            populateFloorModalOptions();
        }

        if (dom.locationModal && dom.locationModal.classList.contains('modal-open')) {
            const prevInput = document.getElementById('modalCustomLocationInput');
            const typedText = prevInput ? prevInput.value : state.customLocation;
            populateLocationModalOptions(typedText);
        }

        if (state.urlDetected.hasParams && state.step === 'input_form' && !state.floor && !state.locationId) {
            parseUrlParams();
            if (state.urlDetected.service === state.service && (state.urlDetected.floor || state.urlDetected.location)) {
                if (state.urlDetected.floor) state.floor = state.urlDetected.floor;
                if (state.urlDetected.location) {
                    const match = findLocationMatch(state.urlDetected.location, state.service);
                    if (match) state.locationId = match.id;
                    else state.customLocation = state.urlDetected.location;
                }
                renderReportForm(null);
            }
        }
    }

    // ==================== 3. Application State ====================
    const state = {
        step: 'welcome',
        service: '',
        floor: '',
        locationId: '',
        customLocation: '',
        description: '',
        photoDataUrl: null,
        uploadedPhotoId: null,
        pendingUploadPromise: null,
        uploadAbortController: null,
        isSubmitting: false,
        urlDetected: {
            hasParams: false,
            service: '',
            floor: '',
            location: ''
        }
    };

    let dom = {};
    let toastTimer = null;
    let successTimer = null;
    let resetScrollTimer = null;
    let msgCounter = 0;
    let photoProcessToken = 0;

    // ==================== 4. Security & Utility Helpers ====================
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeInput(value, maxLen) {
        if (typeof value !== 'string') return '';
        const trimmed = value.trim();
        return trimmed.length > maxLen ? trimmed.substring(0, maxLen) : trimmed;
    }

    function formatFloorDisplay(floor) {
        if (!floor) return '';
        return String(floor).replace(/F$/i, '') + 'F';
    }

    function getCurrentTime() {
        const now = new Date();
        return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    function getFloorConfig(serviceCode) {
        return FLOOR_CONFIG_BY_SERVICE[serviceCode] || { mode: 'range', min: 1, max: 101, options: [] };
    }

    function reloadToHome() {
        cancelBackgroundUpload();
        closeAllModals();
        if (dom.chatContainer) dom.chatContainer.scrollTop = 0;
        window.scrollTo(0, 0);

        const cleanUrl = window.location.href.split('#')[0].split('?')[0];
        if (window.location.search || window.location.hash) {
            window.location.replace(cleanUrl);
        } else {
            window.location.reload();
        }
    }

    function scrollElementToTop(targetEl) {
        if (!dom.chatContainer || !targetEl) return;
        requestAnimationFrame(function () {
            if (!targetEl.isConnected) return;
            const desiredTop = Math.max(0, targetEl.offsetTop - 10);
            if (typeof dom.chatContainer.scrollTo === 'function') {
                try {
                    dom.chatContainer.scrollTo({ top: desiredTop, behavior: 'smooth' });
                    return;
                } catch (e) {}
            }
            dom.chatContainer.scrollTop = desiredTop;
        });
    }

    function scrollToTopInstant() {
        if (resetScrollTimer) {
            clearTimeout(resetScrollTimer);
            resetScrollTimer = null;
        }
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        const applyZero = function () {
            window.scrollTo(0, 0);
            if (!dom.chatContainer) return;
            if (typeof dom.chatContainer.scrollTo === 'function') {
                try {
                    dom.chatContainer.scrollTo({ top: 0, behavior: 'auto' });
                } catch (e) {}
            }
            dom.chatContainer.scrollTop = 0;
        };

        applyZero();
        requestAnimationFrame(function () {
            applyZero();
            requestAnimationFrame(applyZero);
        });
        resetScrollTimer = setTimeout(applyZero, 80);
    }

    function showToast(message, type) {
        document.querySelectorAll('.toast-message').forEach(function (el) { el.remove(); });
        if (toastTimer) clearTimeout(toastTimer);

        const safeType = (type === 'warning' || type === 'success' || type === 'info') ? type : 'info';
        const toast = document.createElement('div');
        toast.className = 'toast-message toast-' + safeType;
        toast.textContent = message;
        document.body.appendChild(toast);

        toastTimer = setTimeout(function () {
            toast.classList.add('toast-hide');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 260);
        }, 2600);
    }

    function getCurrentLocations() {
        return LOCATIONS_BY_SERVICE[state.service] || [];
    }

    function getResolvedLocationLabel() {
        if (state.locationId) {
            const match = getCurrentLocations().find(function (loc) { return loc.id === state.locationId; });
            return match ? match.label : state.locationId;
        }
        return state.customLocation || '';
    }

    function findLocationMatch(rawText, serviceType) {
        const list = LOCATIONS_BY_SERVICE[serviceType] || [];
        if (!rawText || !list.length) return null;

        const mapped = LEGACY_LOCATION_ID_MAP[rawText] || TW_TO_EN_LOCATIONS[rawText] || rawText;
        const exact = list.find(function (loc) { return loc.label === mapped || loc.id === mapped; });
        if (exact) return exact;

        return list.find(function (loc) {
            return mapped.indexOf(loc.label) !== -1 || loc.label.indexOf(mapped) !== -1;
        }) || null;
    }

    // ==================== 5. URL Parameter Parsing ====================
    function parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const hasParams = params.toString().length > 0;
        state.urlDetected = { hasParams: hasParams, service: '', floor: '', location: '' };
        if (!hasParams) return;

        const svc = (params.get('service') || '').trim().toLowerCase();
        if (SERVICE_TYPES[svc]) {
            state.urlDetected.service = svc;
        }

        const rawFloor = (params.get('floor') || '').trim().toUpperCase();
        if (rawFloor && state.urlDetected.service) {
            const cleanFloor = rawFloor.replace(/F$/i, '');
            const floorCfg = getFloorConfig(state.urlDetected.service);
            if (floorCfg.mode === 'range') {
                if (/^\d+$/.test(cleanFloor)) {
                    const num = parseInt(cleanFloor, 10);
                    if (num >= floorCfg.min && num <= floorCfg.max) {
                        state.urlDetected.floor = String(num);
                    }
                }
            } else if (floorCfg.options.indexOf(cleanFloor) !== -1) {
                state.urlDetected.floor = cleanFloor;
            }
        }

        const rawLoc = sanitizeInput(params.get('location') || '', 100);
        if (rawLoc) {
            state.urlDetected.location = LEGACY_LOCATION_ID_MAP[rawLoc] || TW_TO_EN_LOCATIONS[rawLoc] || rawLoc;
        }
    }

    // ==================== 6. Background Upload Lifecycle ====================
    function cancelBackgroundUpload() {
        if (state.uploadAbortController) {
            try { state.uploadAbortController.abort(); } catch (e) {}
            state.uploadAbortController = null;
        }
        state.pendingUploadPromise = null;
        state.uploadedPhotoId = null;
    }

    function uploadPhotoToDrive(dataUrl) {
        return new Promise(function (resolve, reject) {
            if (!dataUrl || dataUrl.indexOf('data:image/') !== 0) {
                resolve(null);
                return;
            }
            const parts = dataUrl.split(',');
            const rawBase64 = parts.length > 1 ? parts[1] : '';
            if (!rawBase64) {
                resolve(null);
                return;
            }

            const controller = new AbortController();
            state.uploadAbortController = controller;
            const timeoutId = setTimeout(function () { controller.abort(); }, 12000);

            fetch(API_CONFIG.UPLOAD_API, {
                method: 'POST',
                body: JSON.stringify({
                    dataReq: {
                        data: rawBase64,
                        name: 'report.jpg',
                        type: 'image/jpeg'
                    },
                    fname: 'uploadFilesToGoogleDrive'
                }),
                signal: controller.signal
            })
                .then(function (res) {
                    clearTimeout(timeoutId);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(function (data) {
                    if (data && data.id && data.id !== 'none') {
                        if (state.photoDataUrl === dataUrl) {
                            state.uploadedPhotoId = data.id;
                            resolve(data.id);
                        } else {
                            resolve(null);
                        }
                    } else {
                        reject(new Error((data && data.error) ? data.error : 'Upload failed'));
                    }
                })
                .catch(function (err) {
                    clearTimeout(timeoutId);
                    reject(err);
                });
        });
    }

    function startBackgroundUpload() {
        if (!state.photoDataUrl || state.uploadedPhotoId || state.pendingUploadPromise) return;
        const snapshot = state.photoDataUrl;
        state.pendingUploadPromise = uploadPhotoToDrive(snapshot)
            .catch(function () {
                if (state.photoDataUrl === snapshot) {
                    state.pendingUploadPromise = null;
                }
                return null;
            });
    }

    // ==================== 7. Message Rendering ====================
    function addBotMessage(htmlContent, stepTag, isCompact) {
        msgCounter += 1;
        const wrapper = document.createElement('div');
        wrapper.className = isCompact ? 'message bot-message bot-message-compact' : 'message bot-message';
        wrapper.id = 'msg-' + Date.now() + '-' + msgCounter;
        if (stepTag) wrapper.setAttribute('data-step-tag', stepTag);

        wrapper.innerHTML =
            '<div class="avatar bot-avatar"><img src="static/pic/avatar.png" alt="Service"></div>' +
            '<div class="message-content-wrapper">' +
            '<div class="message-content">' + htmlContent + '</div>' +
            '<div class="message-time">' + escapeHtml(getCurrentTime()) + '</div>' +
            '</div>';

        dom.chatContainer.appendChild(wrapper);
        return wrapper;
    }

    function addUserMessage(plainText, stepTag) {
        msgCounter += 1;
        const wrapper = document.createElement('div');
        wrapper.className = 'message user-message';
        wrapper.id = 'msg-' + Date.now() + '-' + msgCounter;
        if (stepTag) wrapper.setAttribute('data-step-tag', stepTag);

        wrapper.innerHTML =
            '<div class="avatar user-avatar"><div class="avatar-placeholder">👤</div></div>' +
            '<div class="message-content-wrapper">' +
            '<div class="message-content"></div>' +
            '<div class="message-time">' + escapeHtml(getCurrentTime()) + '</div>' +
            '</div>';

        wrapper.querySelector('.message-content').textContent = plainText;
        dom.chatContainer.appendChild(wrapper);
        return wrapper;
    }

    function removeMessagesAfterTag(stepTag) {
        const children = Array.from(dom.chatContainer.children);
        let targetIndex = -1;
        for (let i = 0; i < children.length; i++) {
            if (children[i].getAttribute('data-step-tag') === stepTag) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex >= 0) {
            for (let j = children.length - 1; j > targetIndex; j--) {
                children[j].remove();
            }
            return children[targetIndex];
        }
        return null;
    }

    function removeMessagesByTag(stepTag) {
        dom.chatContainer.querySelectorAll('[data-step-tag="' + stepTag + '"]').forEach(function (el) {
            el.remove();
        });
    }

    // ==================== 8. Flow Rendering ====================
    function resetState() {
        if (successTimer) {
            clearTimeout(successTimer);
            successTimer = null;
        }
        photoProcessToken += 1;
        cancelBackgroundUpload();
        state.step = 'welcome';
        state.service = '';
        state.floor = '';
        state.locationId = '';
        state.customLocation = '';
        state.description = '';
        state.photoDataUrl = null;
        state.isSubmitting = false;
        if (dom.cameraFileInput) dom.cameraFileInput.value = '';
        if (dom.galleryFileInput) dom.galleryFileInput.value = '';
    }

    function startApp(useUrlPreset) {
        const shouldUseUrl = (useUrlPreset !== false) && state.urlDetected.hasParams && Boolean(state.urlDetected.service);
        closeAllModals();
        resetState();
        dom.chatContainer.innerHTML = '';

        if (shouldUseUrl) {
            const serviceName = SERVICE_TYPES[state.urlDetected.service];
            addBotMessage(
                '<div class="welcome-message">' +
                '<div class="welcome-title">TAIPEI 101 Service System</div>' +
                '<div class="welcome-subtitle">Welcome to ' + escapeHtml(serviceName) + '</div>' +
                '</div>',
                'welcome'
            );

            state.service = state.urlDetected.service;
            if (state.urlDetected.floor) state.floor = state.urlDetected.floor;
            if (state.urlDetected.location) {
                const match = findLocationMatch(state.urlDetected.location, state.service);
                if (match) state.locationId = match.id;
                else state.customLocation = state.urlDetected.location;
            }
            renderReportForm(null);
        } else {
            addBotMessage(
                '<div class="welcome-message">' +
                '<div class="welcome-title">TAIPEI 101 Service System</div>' +
                '<div class="welcome-subtitle">Select your area to begin</div>' +
                '</div>',
                'welcome'
            );
            renderServiceButtons();
        }

        scrollToTopInstant();
    }

    function buildServiceButtonsInnerHtml() {
        return SERVICES_LIST.map(function (s) {
            return '<button type="button" class="service-button" data-service="' + escapeHtml(s.value) + '">' +
                '<div class="service-button-icon">' + s.icon + '</div>' +
                '<div class="service-button-content">' +
                '<div class="service-button-title">' + escapeHtml(s.title) + '</div>' +
                '<div class="service-button-desc">' + escapeHtml(s.desc) + '</div>' +
                '</div>' +
                '</button>';
        }).join('');
    }

    function renderServiceButtons() {
        state.step = 'select_service';
        removeMessagesByTag('select_service');
        addBotMessage('<div class="service-buttons">' + buildServiceButtonsInnerHtml() + '</div>', 'select_service');
    }

    function handleSelectService(serviceType) {
        if (!SERVICE_TYPES[serviceType]) return;

        dom.chatContainer.querySelectorAll('.service-button').forEach(function (btn) {
            btn.classList.toggle('selected', btn.getAttribute('data-service') === serviceType);
        });

        photoProcessToken += 1;
        cancelBackgroundUpload();
        state.service = serviceType;
        state.floor = '';
        state.locationId = '';
        state.customLocation = '';
        state.description = '';
        state.photoDataUrl = null;

        removeMessagesAfterTag('select_service');
        const userMsg = addUserMessage(SERVICE_TYPES[serviceType], 'selected_service');
        renderReportForm(userMsg);
        syncConfigFromBackend(false);
    }

    function renderReportForm(scrollTargetEl) {
        state.step = 'input_form';
        removeMessagesByTag('input_form');
        removeMessagesByTag('user_form');
        removeMessagesByTag('input_photo');
        removeMessagesByTag('user_photo');
        removeMessagesByTag('confirmation');
        removeMessagesByTag('progress');
        removeMessagesByTag('completed');

        const meta = SERVICE_META[state.service] || { icon: '📍' };
        const serviceName = SERVICE_TYPES[state.service] || 'Service';
        const formTitle = meta.icon + ' ' + serviceName + ' Service';
        const floorCfg = getFloorConfig(state.service);
        const locationLabel = getResolvedLocationLabel() || 'Select location';

        const formHtml =
            '<div class="form-title">' + escapeHtml(formTitle) + '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Floor <span>*</span></label>' +
            '<div class="floor-field-slot">' + buildFloorFieldHtml(floorCfg) + '</div>' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Location <span>*</span></label>' +
            '<button type="button" class="location-select-btn">' +
            '<div class="location-display">' +
            '<span class="location-value">' + escapeHtml(locationLabel) + '</span>' +
            '<span class="location-arrow">▼</span>' +
            '</div>' +
            '</button>' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Details (Optional)</label>' +
            '<textarea class="form-control description-input" rows="3" maxlength="500" ' +
            'placeholder="' + escapeHtml(DEFAULT_DESCRIPTION) + '"></textarea>' +
            '</div>' +
            '<div class="quick-replies">' +
            '<button type="button" class="quick-reply-btn btn-primary confirm-form-btn">Next</button>' +
            '</div>';

        const msgEl = addBotMessage(formHtml, 'input_form');

        const floorInput = msgEl.querySelector('.floor-input-range');
        if (floorInput && state.floor) {
            floorInput.value = state.floor;
        }
        const descInput = msgEl.querySelector('.description-input');
        if (descInput && state.description && state.description !== DEFAULT_DESCRIPTION) {
            descInput.value = state.description;
        }

        if (scrollTargetEl) {
            scrollElementToTop(scrollTargetEl);
        }
    }

    function handleConfirmForm() {
        const formMsg = dom.chatContainer.querySelector('[data-step-tag="input_form"]');
        if (!formMsg) return;

        const floorCfg = getFloorConfig(state.service);
        if (floorCfg.mode === 'range') {
            const floorInput = formMsg.querySelector('.floor-input-range');
            const rawVal = floorInput ? floorInput.value.trim() : '';
            if (!rawVal) {
                showToast('Please enter floor (' + floorCfg.min + '-' + floorCfg.max + ')', 'warning');
                if (floorInput) floorInput.focus();
                return;
            }
            const num = parseInt(rawVal, 10);
            if (isNaN(num) || num < floorCfg.min || num > floorCfg.max) {
                showToast('Enter valid floor (' + floorCfg.min + '-' + floorCfg.max + ')', 'warning');
                if (floorInput) floorInput.focus();
                return;
            }
            state.floor = String(num);
        } else if (!state.floor) {
            showToast('Please select floor', 'warning');
            return;
        }

        if (!state.locationId && !state.customLocation) {
            showToast('Please select or enter location', 'warning');
            return;
        }

        const descInput = formMsg.querySelector('.description-input');
        const rawDesc = descInput ? descInput.value.trim() : '';
        if (rawDesc.length > 500) {
            showToast('Max 500 characters', 'warning');
            return;
        }
        state.description = rawDesc || DEFAULT_DESCRIPTION;

        removeMessagesAfterTag('input_form');
        const userMsg = addUserMessage(state.description, 'user_form');
        renderPhotoStep(userMsg);
    }

    function renderPhotoStep(scrollTargetEl) {
        state.step = 'input_photo';
        removeMessagesByTag('input_photo');
        removeMessagesByTag('user_photo');
        removeMessagesByTag('confirmation');
        removeMessagesByTag('progress');
        removeMessagesByTag('completed');

        const promptMsg = addBotMessage('Add photo for reference? (Optional)', 'input_photo', true);

        let html = '';
        if (state.photoDataUrl) {
            html =
                '<img class="upload-preview preview-image" src="' + state.photoDataUrl + '" alt="Selected photo">' +
                '<div class="quick-replies quick-replies-photo">' +
                '<button type="button" class="quick-reply-btn skip-photo-btn">Remove</button>' +
                '<button type="button" class="quick-reply-btn btn-primary confirm-photo-btn">Next</button>' +
                '</div>';
        } else {
            html =
                '<div class="upload-options-grid">' +
                '<button type="button" class="upload-option-btn upload-camera-btn">' +
                '<div class="upload-icon">📷</div>' +
                '<div class="upload-title-text">Take Photo</div>' +
                '<div class="upload-sub-text">Open Camera</div>' +
                '</button>' +
                '<button type="button" class="upload-option-btn upload-gallery-btn">' +
                '<div class="upload-icon">🖼️</div>' +
                '<div class="upload-title-text">Choose Photo</div>' +
                '<div class="upload-sub-text">From Library</div>' +
                '</button>' +
                '</div>' +
                '<div class="upload-helper-note">JPG, PNG supported (Auto-optimized)</div>' +
                '<div class="quick-replies quick-replies-photo">' +
                '<button type="button" class="quick-reply-btn skip-photo-btn">Skip</button>' +
                '</div>';
        }

        addBotMessage(html, 'input_photo');
        const anchorEl = scrollTargetEl || dom.chatContainer.querySelector('[data-step-tag="user_form"]') || promptMsg;
        scrollElementToTop(anchorEl);
    }

    function handleFileSelected(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;

        if (file.size === 0) {
            showToast('Invalid empty file (0 bytes)', 'warning');
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            showToast('Raw photo exceeds 25MB limit', 'warning');
            return;
        }

        if (file.type && file.type.indexOf('image/') !== 0) {
            showToast('Please select a valid image file', 'warning');
            return;
        }

        showToast('Optimizing photo...', 'info');

        photoProcessToken += 1;
        const currentToken = photoProcessToken;
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = function () {
            URL.revokeObjectURL(objectUrl);
            if (currentToken !== photoProcessToken) return;

            try {
                if (!img.width || !img.height) {
                    showToast('Unable to read image size', 'warning');
                    return;
                }

                const maxDim = 800;
                const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                const targetW = Math.max(1, Math.floor(img.width * scale));
                const targetH = Math.max(1, Math.floor(img.height * scale));

                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.drawImage(img, 0, 0, targetW, targetH);

                const compressed = canvas.toDataURL('image/jpeg', 0.65);
                if (compressed.indexOf('data:image/jpeg;base64,') !== 0) {
                    showToast('Image conversion failed', 'warning');
                    return;
                }

                cancelBackgroundUpload();
                state.photoDataUrl = compressed;
                showToast('Photo ready', 'success');
                renderPhotoStep();
            } catch (e) {
                showToast('Failed to process photo', 'warning');
            }
        };

        img.onerror = function () {
            URL.revokeObjectURL(objectUrl);
            if (currentToken !== photoProcessToken) return;
            showToast('Unsupported or corrupted image', 'warning');
        };

        img.src = objectUrl;
    }

    function handleSkipOrRemovePhoto() {
        if (state.photoDataUrl) {
            photoProcessToken += 1;
            cancelBackgroundUpload();
            state.photoDataUrl = null;
            showToast('Photo removed', 'info');
            renderPhotoStep();
            return;
        }

        removeMessagesByTag('user_photo');
        removeMessagesByTag('confirmation');
        removeMessagesByTag('progress');
        removeMessagesByTag('completed');
        const userMsg = addUserMessage('No photo upload', 'user_photo');
        renderConfirmation(userMsg);
    }

    function handleConfirmPhoto() {
        if (!state.photoDataUrl) return;

        if (navigator.onLine !== false) {
            startBackgroundUpload();
        }

        removeMessagesByTag('user_photo');
        removeMessagesByTag('confirmation');
        removeMessagesByTag('progress');
        removeMessagesByTag('completed');
        const userMsg = addUserMessage('Photo uploaded', 'user_photo');
        renderConfirmation(userMsg);
    }

    function renderConfirmation(scrollTargetEl) {
        state.step = 'confirmation';
        removeMessagesByTag('confirmation');
        removeMessagesByTag('progress');
        removeMessagesByTag('completed');

        const serviceText = SERVICE_TYPES[state.service] || 'Service';
        const floorText = formatFloorDisplay(state.floor);
        const locationText = getResolvedLocationLabel();
        const hasPhoto = Boolean(state.photoDataUrl);
        const photoClass = hasPhoto ? 'has-photo' : 'photo-value';

        const html =
            '<div class="horizontal-case-card">' +
            '<div class="horizontal-details-list">' +
            '<div class="horizontal-detail-row">' +
            '<div class="detail-label-section"><span class="detail-label-text">Type</span></div>' +
            '<div class="detail-value-section"><span class="detail-value-text">' + escapeHtml(serviceText) + '</span></div>' +
            '</div>' +
            '<div class="horizontal-detail-row">' +
            '<div class="detail-label-section"><span class="detail-label-text">Floor</span></div>' +
            '<div class="detail-value-section"><span class="detail-value-text">' + escapeHtml(floorText) + '</span></div>' +
            '</div>' +
            '<div class="horizontal-detail-row">' +
            '<div class="detail-label-section"><span class="detail-label-text">Location</span></div>' +
            '<div class="detail-value-section"><span class="detail-value-text">' + escapeHtml(locationText) + '</span></div>' +
            '</div>' +
            '<div class="horizontal-detail-row">' +
            '<div class="detail-label-section"><span class="detail-label-text">Photo</span></div>' +
            '<div class="detail-value-section ' + photoClass + '"><span class="detail-value-text">' + (hasPhoto ? 'Yes' : 'No') + '</span></div>' +
            '</div>' +
            '</div>' +
            '<div class="description-row">' +
            '<div class="description-label-section"><span class="description-label-text">Details</span></div>' +
            '<div class="description-content-section"><div class="description-content-text"></div></div>' +
            '</div>' +
            '</div>' +
            '<div class="quick-replies">' +
            '<button type="button" class="quick-reply-btn edit-info-btn">✏️ Edit</button>' +
            '<button type="button" class="quick-reply-btn btn-primary submit-report-btn">✓ Submit</button>' +
            '</div>';

        const msgEl = addBotMessage(html, 'confirmation');
        msgEl.querySelector('.description-content-text').textContent = state.description || DEFAULT_DESCRIPTION;

        const anchorEl = scrollTargetEl || dom.chatContainer.querySelector('[data-step-tag="user_photo"]') || msgEl;
        scrollElementToTop(anchorEl);
    }

    function handleEditInfo() {
        const formEl = removeMessagesAfterTag('input_form');
        const userServiceMsg = dom.chatContainer.querySelector('[data-step-tag="selected_service"]');
        if (formEl) {
            state.step = 'input_form';
            scrollElementToTop(userServiceMsg || formEl);
        } else {
            renderReportForm(userServiceMsg || null);
            if (!userServiceMsg) {
                const newFormEl = dom.chatContainer.querySelector('[data-step-tag="input_form"]');
                if (newFormEl) scrollElementToTop(newFormEl);
            }
        }
    }

    // ==================== 9. Report Submission ====================
    function updateProgressUI(progressEl, stepNum, messageText) {
        if (!progressEl || !progressEl.isConnected) return;
        progressEl.querySelectorAll('.progress-step').forEach(function (el) {
            el.classList.toggle('active', Number(el.getAttribute('data-step')) === stepNum);
        });
        const fill = progressEl.querySelector('.progress-fill');
        if (fill) {
            fill.className = 'progress-fill step-' + stepNum;
        }
        const msg = progressEl.querySelector('.progress-message');
        if (msg && messageText) {
            msg.textContent = messageText;
        }
    }

    function sendReportToBackend(payload) {
        const controller = new AbortController();
        const timeoutId = setTimeout(function () { controller.abort(); }, 15000);

        return fetch(API_CONFIG.MAIN_API, {
            method: 'POST',
            body: new URLSearchParams(payload),
            signal: controller.signal
        })
            .then(function (res) {
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && data.success === false) {
                    throw new Error(data.error || 'Submission failed');
                }
                return data;
            })
            .catch(function (err) {
                clearTimeout(timeoutId);
                throw err;
            });
    }

    function handleSubmitReport(submitBtn) {
        if (state.isSubmitting) return;

        if (navigator.onLine === false) {
            showToast('No internet connection. Please check signal.', 'warning');
            return;
        }

        state.isSubmitting = true;
        state.step = 'submitting';
        if (submitBtn) submitBtn.disabled = true;

        removeMessagesByTag('progress');
        removeMessagesByTag('completed');

        const progressHtml =
            '<div class="progress-indicator">' +
            '<div class="progress-title">Processing</div>' +
            '<div class="progress-steps">' +
            '<div class="progress-step active" data-step="1"><div class="step-icon">1</div><div class="step-label">Verify</div></div>' +
            '<div class="progress-step" data-step="2"><div class="step-icon">2</div><div class="step-label">Photo</div></div>' +
            '<div class="progress-step" data-step="3"><div class="step-icon">3</div><div class="step-label">Send</div></div>' +
            '<div class="progress-step" data-step="4"><div class="step-icon">4</div><div class="step-label">Done</div></div>' +
            '</div>' +
            '<div class="progress-bar"><div class="progress-fill step-1"></div></div>' +
            '<div class="progress-message">Validating data...</div>' +
            '</div>';

        const progressMsg = addBotMessage(progressHtml, 'progress');
        scrollElementToTop(progressMsg);

        const payload = {
            action: 'report',
            report_floor: formatFloorDisplay(state.floor),
            report_location: getResolvedLocationLabel(),
            description: state.description || DEFAULT_DESCRIPTION,
            service_type: SERVICE_TYPES[state.service] || 'Service',
            service_code: state.service || '',
            photo_id: ''
        };

        let photoStepPromise;
        if (state.photoDataUrl) {
            updateProgressUI(progressMsg, 2, 'Finalizing photo...');
            if (state.uploadedPhotoId) {
                photoStepPromise = Promise.resolve(state.uploadedPhotoId);
            } else if (state.pendingUploadPromise) {
                photoStepPromise = state.pendingUploadPromise.then(function (id) {
                    if (id) return id;
                    return uploadPhotoToDrive(state.photoDataUrl);
                });
            } else {
                photoStepPromise = uploadPhotoToDrive(state.photoDataUrl);
            }

            photoStepPromise = photoStepPromise.catch(function () {
                showToast('Photo upload failed, sending text report', 'warning');
                return '';
            });
        } else {
            photoStepPromise = Promise.resolve('');
        }

        photoStepPromise
            .then(function (photoId) {
                if (photoId) payload.photo_id = photoId;
                updateProgressUI(progressMsg, 3, 'Sending to management...');
                return sendReportToBackend(payload);
            })
            .then(function () {
                updateProgressUI(progressMsg, 4, 'Complete!');
                state.isSubmitting = false;
                if (submitBtn) submitBtn.disabled = false;
                successTimer = setTimeout(function () {
                    successTimer = null;
                    removeMessagesByTag('progress');
                    renderSuccessPage();
                }, 250);
            })
            .catch(function (err) {
                state.isSubmitting = false;
                state.step = 'confirmation';
                removeMessagesByTag('progress');
                if (submitBtn) submitBtn.disabled = false;

                const errMsg = (err && err.name === 'AbortError')
                    ? 'Request timed out, please tap Submit again'
                    : 'Failed to submit, please try again';
                showToast(errMsg, 'warning');
            });
    }

    function renderSuccessPage() {
        state.step = 'completed';
        removeMessagesByTag('completed');

        const serviceText = SERVICE_TYPES[state.service] || 'Service';
        const html =
            '<div class="success-container">' +
            '<div class="success-icon">✓</div>' +
            '<div class="success-title">' + escapeHtml(serviceText) + ' Submitted</div>' +
            '<div class="success-message">Thank you for your report</div>' +
            '<div class="success-message">We will take care of it shortly</div>' +
            '<div class="success-divider"></div>' +
            '<div class="quick-replies">' +
            '<button type="button" class="quick-reply-btn btn-primary new-report-btn">New Report</button>' +
            '</div>' +
            '</div>';

        const msgEl = addBotMessage(html, 'completed');
        scrollElementToTop(msgEl);
    }

    // ==================== 10. Modal Management ====================
    function openModal(modalEl) {
        if (modalEl) modalEl.classList.add('modal-open');
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('modal-open');
        if (modalEl === dom.imageModal && dom.modalImage) {
            dom.modalImage.removeAttribute('src');
        }
    }

    function closeAllModals() {
        closeModal(dom.imageModal);
        closeModal(dom.floorModal);
        closeModal(dom.locationModal);
    }

    function populateFloorModalOptions() {
        dom.floorModalTitle.textContent = 'Select Floor';

        const floors = getFloorConfig(state.service).options || [];
        dom.floorOptions.innerHTML = floors.map(function (f) {
            const selectedClass = String(state.floor) === String(f) ? ' selected' : '';
            return '<button type="button" class="floor-option-btn' + selectedClass + '" data-floor="' + escapeHtml(f) + '">' +
                escapeHtml(formatFloorDisplay(f)) +
                '</button>';
        }).join('');
    }

    function openFloorModal() {
        populateFloorModalOptions();
        openModal(dom.floorModal);
        syncConfigFromBackend(false);
    }

    function populateLocationModalOptions(initialCustomVal) {
        dom.locationModalTitle.textContent = 'Select Location';

        const locations = getCurrentLocations();
        const buttonsHtml = locations.map(function (loc) {
            const selectedClass = state.locationId === loc.id ? ' selected' : '';
            return '<button type="button" class="location-option-btn' + selectedClass + '" data-location="' + escapeHtml(loc.id) + '">' +
                escapeHtml(loc.label) +
                '</button>';
        }).join('');

        const customHtml =
            '<div class="custom-location-section">' +
            '<div class="custom-location-title">Custom Location</div>' +
            '<div class="custom-location-group">' +
            '<div class="custom-location-icon">📍</div>' +
            '<input type="text" class="custom-location-input" id="modalCustomLocationInput" ' +
            'placeholder="Enter location" maxlength="100">' +
            '</div>' +
            '<button type="button" class="custom-location-confirm-btn">Confirm</button>' +
            '</div>';

        dom.locationOptions.innerHTML = buttonsHtml + customHtml;

        const customInput = document.getElementById('modalCustomLocationInput');
        const valToSet = (initialCustomVal !== undefined) ? initialCustomVal : state.customLocation;
        if (customInput && valToSet) {
            customInput.value = valToSet;
        }
    }

    function openLocationModal() {
        populateLocationModalOptions(state.customLocation);
        openModal(dom.locationModal);
        syncConfigFromBackend(false);
    }

    function handleSelectFloor(floor) {
        if (!floor) return;
        state.floor = String(floor);

        const valueSpan = dom.chatContainer.querySelector('.floor-select-btn .floor-value');
        if (valueSpan) valueSpan.textContent = formatFloorDisplay(state.floor);

        closeModal(dom.floorModal);
        showToast('Selected: ' + formatFloorDisplay(state.floor), 'success');
    }

    function handleSelectLocation(locId) {
        if (!locId) return;
        state.locationId = String(locId);
        state.customLocation = '';

        const label = getResolvedLocationLabel();
        const valueSpan = dom.chatContainer.querySelector('.location-select-btn .location-value');
        if (valueSpan) valueSpan.textContent = label;

        closeModal(dom.locationModal);
        showToast('Selected: ' + label, 'success');
    }

    function handleConfirmCustomLocation() {
        const input = document.getElementById('modalCustomLocationInput');
        const val = sanitizeInput(input ? input.value : '', 100);
        if (!val) {
            showToast('Please enter a location', 'warning');
            if (input) input.focus();
            return;
        }

        state.locationId = '';
        state.customLocation = val;

        const valueSpan = dom.chatContainer.querySelector('.location-select-btn .location-value');
        if (valueSpan) valueSpan.textContent = val;

        closeModal(dom.locationModal);
        showToast('Set: ' + val, 'success');
    }

    function openImagePreviewModal() {
        if (!state.photoDataUrl) return;
        dom.modalImage.src = state.photoDataUrl;
        openModal(dom.imageModal);
    }

    // ==================== 11. Centralized Event Delegation ====================
    function bindGlobalEvents() {
        dom.reloadLogo.addEventListener('click', reloadToHome);

        dom.langSwitchBtn.addEventListener('click', function () {
            window.location.href = 'index.html' + window.location.search;
        });

        dom.cameraFileInput.addEventListener('change', handleFileSelected);
        dom.galleryFileInput.addEventListener('change', handleFileSelected);

        dom.chatContainer.addEventListener('click', function (e) {
            const target = e.target;

            if (state.isSubmitting) return;

            if (target.closest('.new-report-btn')) {
                reloadToHome();
                return;
            }

            const serviceBtn = target.closest('.service-button');
            if (serviceBtn) {
                handleSelectService(serviceBtn.getAttribute('data-service'));
                return;
            }

            if (target.closest('.floor-select-btn')) {
                openFloorModal();
                return;
            }

            if (target.closest('.location-select-btn')) {
                openLocationModal();
                return;
            }

            if (target.closest('.confirm-form-btn')) {
                handleConfirmForm();
                return;
            }

            if (target.closest('.upload-camera-btn')) {
                dom.cameraFileInput.click();
                return;
            }

            if (target.closest('.upload-gallery-btn')) {
                dom.galleryFileInput.click();
                return;
            }

            if (target.closest('.preview-image')) {
                openImagePreviewModal();
                return;
            }

            if (target.closest('.skip-photo-btn')) {
                handleSkipOrRemovePhoto();
                return;
            }

            if (target.closest('.confirm-photo-btn')) {
                handleConfirmPhoto();
                return;
            }

            if (target.closest('.edit-info-btn')) {
                handleEditInfo();
                return;
            }

            const submitBtn = target.closest('.submit-report-btn');
            if (submitBtn) {
                handleSubmitReport(submitBtn);
            }
        });

        dom.chatContainer.addEventListener('input', function (e) {
            if (!e.target.classList.contains('floor-input-range')) return;
            const floorCfg = getFloorConfig(state.service);
            const cleaned = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value !== cleaned) e.target.value = cleaned;
            if (cleaned !== '') {
                const num = parseInt(cleaned, 10);
                if (num > floorCfg.max) {
                    e.target.value = String(floorCfg.max);
                    showToast('Max floor is ' + floorCfg.max + 'F', 'warning');
                }
            }
        });

        dom.chatContainer.addEventListener('blur', function (e) {
            if (!e.target.classList.contains('floor-input-range')) return;
            const floorCfg = getFloorConfig(state.service);
            const val = e.target.value.trim();
            if (!val) return;
            const num = parseInt(val, 10);
            if (isNaN(num) || num < floorCfg.min) {
                e.target.value = String(floorCfg.min);
                showToast('Floor adjusted to ' + floorCfg.min + 'F', 'warning');
            } else if (num > floorCfg.max) {
                e.target.value = String(floorCfg.max);
                showToast('Floor adjusted to ' + floorCfg.max + 'F', 'warning');
            }
        }, true);

        dom.floorOptions.addEventListener('click', function (e) {
            const btn = e.target.closest('.floor-option-btn');
            if (btn) handleSelectFloor(btn.getAttribute('data-floor'));
        });

        dom.locationOptions.addEventListener('click', function (e) {
            const locBtn = e.target.closest('.location-option-btn');
            if (locBtn) {
                handleSelectLocation(locBtn.getAttribute('data-location'));
                return;
            }
            if (e.target.closest('.custom-location-confirm-btn')) {
                handleConfirmCustomLocation();
            }
        });

        dom.locationOptions.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.id === 'modalCustomLocationInput') {
                e.preventDefault();
                handleConfirmCustomLocation();
            }
        });

        dom.closeImageModalBtn.addEventListener('click', function () { closeModal(dom.imageModal); });
        dom.closeFloorModalBtn.addEventListener('click', function () { closeModal(dom.floorModal); });
        dom.closeLocationModalBtn.addEventListener('click', function () { closeModal(dom.locationModal); });

        [dom.imageModal, dom.floorModal, dom.locationModal].forEach(function (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeModal(modal);
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAllModals();
        });

        // Auto-refresh floors & locations when user returns to an already-open tab
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') {
                syncConfigFromBackend(false);
            }
        });

        window.addEventListener('pageshow', function (e) {
            if (e.persisted) {
                scrollToTopInstant();
            }
            syncConfigFromBackend(false);
        });
    }

    // ==================== 12. Bootstrap ====================
    document.addEventListener('DOMContentLoaded', function () {
        dom = {
            reloadLogo: document.getElementById('reloadLogo'),
            langSwitchBtn: document.getElementById('langSwitchBtn'),
            chatContainer: document.getElementById('chatContainer'),
            cameraFileInput: document.getElementById('cameraFileInput'),
            galleryFileInput: document.getElementById('galleryFileInput'),
            imageModal: document.getElementById('imageModal'),
            closeImageModalBtn: document.getElementById('closeImageModalBtn'),
            modalImage: document.getElementById('modalImage'),
            floorModal: document.getElementById('floorModal'),
            floorModalTitle: document.getElementById('floorModalTitle'),
            closeFloorModalBtn: document.getElementById('closeFloorModalBtn'),
            floorOptions: document.getElementById('floorOptions'),
            locationModal: document.getElementById('locationModal'),
            locationModalTitle: document.getElementById('locationModalTitle'),
            closeLocationModalBtn: document.getElementById('closeLocationModalBtn'),
            locationOptions: document.getElementById('locationOptions')
        };

        loadCachedConfig();
        parseUrlParams();
        bindGlobalEvents();
        startApp(true);
        syncConfigFromBackend(true);
    });
})();