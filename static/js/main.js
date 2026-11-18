'use strict';

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

(function () {
    // ==================== 1. API 設定（中英文兩檔指向同一組最新部署網址） ====================
    const API_CONFIG = {
        MAIN_API: 'https://script.google.com/macros/s/AKfycbxZ3d2bBMjfw1JWTovmV8w3wt9_ZLYHS8m0AnM-cqn29AR-wU4-k_iERc42nRobDc5R0Q/exec',
        UPLOAD_API: 'https://script.google.com/macros/s/AKfycbw8CLY-bYy3Q7eH1jRZ9FIfYZnDxNTVwXvvIVrWt46KjP-O_FITcDgUOFxYhCKlTQbYqg/exec'
    };

    // ==================== 2. 靜態場域與文字定義 ====================
    const DEFAULT_DESCRIPTION = '請檢查、進行環境清潔或設備報修';

    const SERVICE_TYPES = {
        office: '辦公大樓',
        shopping: '購物中心',
        observatory: '觀景台'
    };

    const SERVICES_LIST = [
        { icon: '🏢', title: '辦公大樓', desc: '辦公區域通報', value: 'office' },
        { icon: '🛍️', title: '購物中心', desc: '購物區域通報', value: 'shopping' },
        { icon: '🏙️', title: '觀景台', desc: '觀景區域通報', value: 'observatory' }
    ];

    const LOCATIONS_BY_SERVICE = {
        office: [
            { id: 'male_toilet', label: '男生廁所' },
            { id: 'female_toilet', label: '女生廁所' },
            { id: 'public_corridor', label: '公共走道' },
            { id: 'public_elevator', label: '公共電梯' },
            { id: 'public_pantry', label: '茶水間' },
            { id: 'public_freight_lift', label: '貨梯廳' }
        ],
        shopping: [
            { id: 'male_toilet', label: '男生廁所' },
            { id: 'female_toilet', label: '女生廁所' },
            { id: 'nursing_room', label: '哺乳室' }
        ],
        observatory: [
            { id: 'male_toilet', label: '男生廁所' },
            { id: 'female_toilet', label: '女生廁所' },
            { id: 'nursing_room', label: '哺乳室' },
            { id: 'east_area', label: '東面場域' },
            { id: 'west_area', label: '西區場域' }
        ]
    };

    const FLOORS_BY_SERVICE = {
        shopping: ['B1', '1', '2', '3', '4', '5'],
        observatory: ['89', '91', '101']
    };

    const EN_TO_TW_LOCATIONS = {
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

    // ==================== 3. 系統狀態 ====================
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

    // ==================== 4. 安全與通用工具 ====================
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

    // 統一回到最頂端主選單（點擊 Logo 與「新的通報」共用，100% 清空狀態與捲動位置）
    function reloadToHome() {
        cancelBackgroundUpload();
        closeAllModals();
        if (dom.chatContainer) dom.chatContainer.scrollTop = 0;
        window.scrollTo(0, 0);

        if (window.location.search || window.location.hash) {
            window.location.replace(window.location.pathname);
        } else {
            window.location.reload();
        }
    }

    // 將指定元素（以使用者發話為優先）平滑捲動至標題列正下方（10px）
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

        const mapped = EN_TO_TW_LOCATIONS[rawText] || rawText;
        const exact = list.find(function (loc) { return loc.label === mapped || loc.id === mapped; });
        if (exact) return exact;

        return list.find(function (loc) {
            return mapped.indexOf(loc.label) !== -1 || loc.label.indexOf(mapped) !== -1;
        }) || null;
    }

    // ==================== 5. URL 參數解析 ====================
    function parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const hasParams = params.toString().length > 0;
        state.urlDetected = { hasParams: hasParams, service: '', floor: '', location: '' };
        if (!hasParams) return;

        const svc = (params.get('service') || '').trim();
        if (SERVICE_TYPES[svc]) {
            state.urlDetected.service = svc;
        }

        const rawFloor = (params.get('floor') || '').trim().toUpperCase();
        if (rawFloor && state.urlDetected.service) {
            const cleanFloor = rawFloor.replace(/F$/i, '');
            if (state.urlDetected.service === 'office') {
                if (/^[1-9][0-9]?$/.test(cleanFloor)) {
                    const num = parseInt(cleanFloor, 10);
                    if (num >= 1 && num <= 88) state.urlDetected.floor = String(num);
                }
            } else {
                const allowed = FLOORS_BY_SERVICE[state.urlDetected.service] || [];
                if (allowed.indexOf(cleanFloor) !== -1) {
                    state.urlDetected.floor = cleanFloor;
                }
            }
        }

        const rawLoc = sanitizeInput(params.get('location') || '', 100);
        if (rawLoc) {
            state.urlDetected.location = EN_TO_TW_LOCATIONS[rawLoc] || rawLoc;
        }
    }

    // ==================== 6. 背景上傳生命週期 ====================
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
                        // 防止換圖或移除後的競態寫入
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

    // ==================== 7. 訊息渲染核心 ====================
    function addBotMessage(htmlContent, stepTag, isCompact) {
        msgCounter += 1;
        const wrapper = document.createElement('div');
        wrapper.className = isCompact ? 'message bot-message bot-message-compact' : 'message bot-message';
        wrapper.id = 'msg-' + Date.now() + '-' + msgCounter;
        if (stepTag) wrapper.setAttribute('data-step-tag', stepTag);

        wrapper.innerHTML =
            '<div class="avatar bot-avatar"><img src="static/pic/avatar.png" alt="客服人員"></div>' +
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

    // ==================== 8. 流程畫面建構 ====================
    function resetState() {
        if (successTimer) {
            clearTimeout(successTimer);
            successTimer = null;
        }
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
                '<div class="welcome-title">TAIPEI 101 智慧通報系統</div>' +
                '<div class="welcome-subtitle">歡迎蒞臨' + escapeHtml(serviceName) + '</div>' +
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
                '<div class="welcome-title">TAIPEI 101 智慧通報系統</div>' +
                '<div class="welcome-subtitle">請選擇您所在的區域開始通報</div>' +
                '</div>',
                'welcome'
            );
            renderServiceButtons();
        }

        scrollToTopInstant();
    }

    function renderServiceButtons() {
        state.step = 'select_service';
        removeMessagesByTag('select_service');

        const html = '<div class="service-buttons">' +
            SERVICES_LIST.map(function (s) {
                return '<button type="button" class="service-button" data-service="' + escapeHtml(s.value) + '">' +
                    '<div class="service-button-icon">' + s.icon + '</div>' +
                    '<div class="service-button-content">' +
                    '<div class="service-button-title">' + escapeHtml(s.title) + '</div>' +
                    '<div class="service-button-desc">' + escapeHtml(s.desc) + '</div>' +
                    '</div>' +
                    '</button>';
            }).join('') +
            '</div>';

        addBotMessage(html, 'select_service');
    }

    function handleSelectService(serviceType) {
        if (!SERVICE_TYPES[serviceType]) return;

        dom.chatContainer.querySelectorAll('.service-button').forEach(function (btn) {
            btn.classList.toggle('selected', btn.getAttribute('data-service') === serviceType);
        });

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

        const titles = {
            office: '🏢 辦公大樓通報表單',
            shopping: '🛍️ 購物中心通報表單',
            observatory: '🏙️ 觀景台通報表單'
        };

        const locationLabel = getResolvedLocationLabel() || '請選擇地點';
        let floorFieldHtml = '';

        if (state.service === 'office') {
            floorFieldHtml =
                '<input type="number" class="form-control floor-input-office" ' +
                'placeholder="請輸入樓層數字 (1-88)" min="1" max="88" inputmode="numeric">';
        } else {
            const floorText = state.floor ? formatFloorDisplay(state.floor) : '請選擇樓層';
            floorFieldHtml =
                '<button type="button" class="floor-select-btn">' +
                '<div class="floor-display">' +
                '<span class="floor-value">' + escapeHtml(floorText) + '</span>' +
                '<span class="floor-arrow">▼</span>' +
                '</div>' +
                '</button>';
        }

        const formHtml =
            '<div class="form-title">' + escapeHtml(titles[state.service] || '通報表單') + '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">樓層 <span>*</span></label>' +
            floorFieldHtml +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">地點 <span>*</span></label>' +
            '<button type="button" class="location-select-btn">' +
            '<div class="location-display">' +
            '<span class="location-value">' + escapeHtml(locationLabel) + '</span>' +
            '<span class="location-arrow">▼</span>' +
            '</div>' +
            '</button>' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">描述（非必要）</label>' +
            '<textarea class="form-control description-input" rows="3" maxlength="500" ' +
            'placeholder="' + escapeHtml(DEFAULT_DESCRIPTION) + '"></textarea>' +
            '</div>' +
            '<div class="quick-replies">' +
            '<button type="button" class="quick-reply-btn btn-primary confirm-form-btn">確認</button>' +
            '</div>';

        const msgEl = addBotMessage(formHtml, 'input_form');

        const floorInput = msgEl.querySelector('.floor-input-office');
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

        if (state.service === 'office') {
            const floorInput = formMsg.querySelector('.floor-input-office');
            const rawVal = floorInput ? floorInput.value.trim() : '';
            if (!rawVal) {
                showToast('請輸入樓層 (1-88)', 'warning');
                if (floorInput) floorInput.focus();
                return;
            }
            const num = parseInt(rawVal, 10);
            if (isNaN(num) || num < 1 || num > 88) {
                showToast('請輸入有效的樓層 (1 ~ 88)', 'warning');
                if (floorInput) floorInput.focus();
                return;
            }
            state.floor = String(num);
        } else if (!state.floor) {
            showToast('請選擇樓層', 'warning');
            return;
        }

        if (!state.locationId && !state.customLocation) {
            showToast('請選擇或輸入地點', 'warning');
            return;
        }

        const descInput = formMsg.querySelector('.description-input');
        const rawDesc = descInput ? descInput.value.trim() : '';
        if (rawDesc.length > 500) {
            showToast('描述長度超過 500 字限制', 'warning');
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

        const promptMsg = addBotMessage('是否需要上傳照片輔助說明？（非必要）', 'input_photo', true);

        let html = '';
        if (state.photoDataUrl) {
            html =
                '<img class="upload-preview preview-image" src="' + state.photoDataUrl + '" alt="已選取的照片">' +
                '<div class="quick-replies quick-replies-photo">' +
                '<button type="button" class="quick-reply-btn skip-photo-btn">移除照片</button>' +
                '<button type="button" class="quick-reply-btn btn-primary confirm-photo-btn">確認上傳</button>' +
                '</div>';
        } else {
            html =
                '<div class="upload-options-grid">' +
                '<button type="button" class="upload-option-btn upload-camera-btn">' +
                '<div class="upload-icon">📷</div>' +
                '<div class="upload-title-text">現場拍照</div>' +
                '<div class="upload-sub-text">直接開啟相機</div>' +
                '</button>' +
                '<button type="button" class="upload-option-btn upload-gallery-btn">' +
                '<div class="upload-icon">🖼️</div>' +
                '<div class="upload-title-text">選擇照片</div>' +
                '<div class="upload-sub-text">從相簿上傳</div>' +
                '</button>' +
                '</div>' +
                '<div class="upload-helper-note">支援 JPG、PNG（系統自動快速壓縮）</div>' +
                '<div class="quick-replies quick-replies-photo">' +
                '<button type="button" class="quick-reply-btn skip-photo-btn">跳過不上傳</button>' +
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
            showToast('照片檔案異常（0 位元組）', 'warning');
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            showToast('原始照片超過 25MB 上限', 'warning');
            return;
        }

        if (file.type && file.type.indexOf('image/') !== 0) {
            showToast('請選擇圖片格式的檔案', 'warning');
            return;
        }

        showToast('正在最佳化圖片...', 'info');

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = function () {
            URL.revokeObjectURL(objectUrl);
            try {
                if (!img.width || !img.height) {
                    showToast('無法辨識圖片尺寸', 'warning');
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
                    showToast('圖片格式轉換失敗', 'warning');
                    return;
                }

                cancelBackgroundUpload();
                state.photoDataUrl = compressed;
                showToast('照片已就緒', 'success');
                renderPhotoStep();
            } catch (e) {
                showToast('圖片處理失敗，請重新選擇', 'warning');
            }
        };

        img.onerror = function () {
            URL.revokeObjectURL(objectUrl);
            showToast('不支援此圖片格式或檔案已損毀', 'warning');
        };

        img.src = objectUrl;
    }

    function handleSkipOrRemovePhoto() {
        if (state.photoDataUrl) {
            cancelBackgroundUpload();
            state.photoDataUrl = null;
            showToast('照片已移除', 'info');
            renderPhotoStep();
            return;
        }

        removeMessagesByTag('user_photo');
        removeMessagesByTag('confirmation');
        const userMsg = addUserMessage('不上傳照片', 'user_photo');
        renderConfirmation(userMsg);
    }

    function handleConfirmPhoto() {
        if (!state.photoDataUrl) return;

        if (navigator.onLine !== false) {
            startBackgroundUpload();
        }

        removeMessagesByTag('user_photo');
        removeMessagesByTag('confirmation');
        const userMsg = addUserMessage('已上傳照片', 'user_photo');
        renderConfirmation(userMsg);
    }

    function renderConfirmation(scrollTargetEl) {
        state.step = 'confirmation';
        removeMessagesByTag('confirmation');
        removeMessagesByTag('progress');
        removeMessagesByTag('completed');

        const serviceText = SERVICE_TYPES[state.service] || '通報';
        const floorText = formatFloorDisplay(state.floor);
        const locationText = getResolvedLocationLabel();
        const hasPhoto = Boolean(state.photoDataUrl);
        const photoClass = hasPhoto ? 'has-photo' : 'photo-value';

        const html =
            '<div class="horizontal-case-card">' +
            '<div class="horizontal-details-list">' +
            '<div class="horizontal-detail-row">' +
            '<div class="detail-label-section"><span class="detail-label-text">類型</span></div>' +
            '<div class="detail-value-section"><span class="detail-value-text">' + escapeHtml(serviceText) + '</span></div>' +
            '</div>' +
            '<div class="horizontal-detail-row">' +
            '<div class="detail-label-section"><span class="detail-label-text">樓層</span></div>' +
            '<div class="detail-value-section"><span class="detail-value-text">' + escapeHtml(floorText) + '</span></div>' +
            '</div>' +
            '<div class="horizontal-detail-row">' +
            '<div class="detail-label-section"><span class="detail-label-text">地點</span></div>' +
            '<div class="detail-value-section"><span class="detail-value-text">' + escapeHtml(locationText) + '</span></div>' +
            '</div>' +
            '<div class="horizontal-detail-row">' +
            '<div class="detail-label-section"><span class="detail-label-text">照片</span></div>' +
            '<div class="detail-value-section ' + photoClass + '"><span class="detail-value-text">' + (hasPhoto ? '有' : '無') + '</span></div>' +
            '</div>' +
            '</div>' +
            '<div class="description-row">' +
            '<div class="description-label-section"><span class="description-label-text">描述</span></div>' +
            '<div class="description-content-section"><div class="description-content-text"></div></div>' +
            '</div>' +
            '</div>' +
            '<div class="quick-replies">' +
            '<button type="button" class="quick-reply-btn edit-info-btn">✏️ 修改資訊</button>' +
            '<button type="button" class="quick-reply-btn btn-primary submit-report-btn">✓ 確認提交</button>' +
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

    // ==================== 9. 提交通報流程 ====================
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
                    throw new Error(data.error || '通報寫入失敗');
                }
                return data;
            })
            .catch(function (err) {
                clearTimeout(timeoutId);
                throw err;
            });
    }

    function handleSubmitReport(submitBtn) {
        if (state.isSubmitting || state.step === 'completed') return;

        if (navigator.onLine === false) {
            showToast('目前無網路連線，請確認訊號後再試', 'warning');
            return;
        }

        state.isSubmitting = true;
        state.step = 'submitting';
        if (submitBtn) submitBtn.disabled = true;

        const progressHtml =
            '<div class="progress-indicator">' +
            '<div class="progress-title">通報處理中</div>' +
            '<div class="progress-steps">' +
            '<div class="progress-step active" data-step="1"><div class="step-icon">1</div><div class="step-label">驗證</div></div>' +
            '<div class="progress-step" data-step="2"><div class="step-icon">2</div><div class="step-label">照片</div></div>' +
            '<div class="progress-step" data-step="3"><div class="step-icon">3</div><div class="step-label">傳送</div></div>' +
            '<div class="progress-step" data-step="4"><div class="step-icon">4</div><div class="step-label">完成</div></div>' +
            '</div>' +
            '<div class="progress-bar"><div class="progress-fill step-1"></div></div>' +
            '<div class="progress-message">正在驗證通報資料...</div>' +
            '</div>';

        const progressMsg = addBotMessage(progressHtml, 'progress');
        scrollElementToTop(progressMsg);

        const payload = {
            action: 'report',
            report_floor: formatFloorDisplay(state.floor),
            report_location: getResolvedLocationLabel(),
            description: state.description || DEFAULT_DESCRIPTION,
            service_type: SERVICE_TYPES[state.service] || '未分類',
            photo_id: ''
        };

        let photoStepPromise;
        if (state.photoDataUrl) {
            updateProgressUI(progressMsg, 2, '正在完成照片處理...');
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
                showToast('照片上傳異常，將以文字完成通報', 'warning');
                return '';
            });
        } else {
            photoStepPromise = Promise.resolve('');
        }

        photoStepPromise
            .then(function (photoId) {
                if (photoId) payload.photo_id = photoId;
                updateProgressUI(progressMsg, 3, '正在發送通報至管理中心...');
                return sendReportToBackend(payload);
            })
            .then(function () {
                updateProgressUI(progressMsg, 4, '通報完成！');
                state.isSubmitting = false;
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
                    ? '網路回應逾時，請重新點擊提交'
                    : '通報發送失敗，請稍後再試';
                showToast(errMsg, 'warning');
            });
    }

    function renderSuccessPage() {
        state.step = 'completed';
        removeMessagesByTag('completed');

        const serviceText = SERVICE_TYPES[state.service] || '服務';
        const html =
            '<div class="success-container">' +
            '<div class="success-icon">✓</div>' +
            '<div class="success-title">' + escapeHtml(serviceText) + '通報完成</div>' +
            '<div class="success-message">感謝您的通知</div>' +
            '<div class="success-message">讓我們為您做得更好</div>' +
            '<div class="success-divider"></div>' +
            '<div class="quick-replies">' +
            '<button type="button" class="quick-reply-btn btn-primary new-report-btn">新的通報</button>' +
            '</div>' +
            '</div>';

        const msgEl = addBotMessage(html, 'completed');
        scrollElementToTop(msgEl);
    }

    // ==================== 10. 模態框管理 ====================
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

    function openFloorModal() {
        const title = state.service === 'shopping' ? '選擇購物中心樓層' : '選擇觀景台樓層';
        dom.floorModalTitle.textContent = title;

        const floors = FLOORS_BY_SERVICE[state.service] || [];
        dom.floorOptions.innerHTML = floors.map(function (f) {
            const selectedClass = String(state.floor) === String(f) ? ' selected' : '';
            return '<button type="button" class="floor-option-btn' + selectedClass + '" data-floor="' + escapeHtml(f) + '">' +
                escapeHtml(formatFloorDisplay(f)) +
                '</button>';
        }).join('');

        openModal(dom.floorModal);
    }

    function openLocationModal() {
        const titles = {
            office: '選擇辦公大樓地點',
            shopping: '選擇購物中心地點',
            observatory: '選擇觀景台地點'
        };
        dom.locationModalTitle.textContent = titles[state.service] || '選擇地點';

        const locations = getCurrentLocations();
        const buttonsHtml = locations.map(function (loc) {
            const selectedClass = state.locationId === loc.id ? ' selected' : '';
            return '<button type="button" class="location-option-btn' + selectedClass + '" data-location="' + escapeHtml(loc.id) + '">' +
                escapeHtml(loc.label) +
                '</button>';
        }).join('');

        const customHtml =
            '<div class="custom-location-section">' +
            '<div class="custom-location-title">自訂地點</div>' +
            '<div class="custom-location-group">' +
            '<div class="custom-location-icon">📍</div>' +
            '<input type="text" class="custom-location-input" id="modalCustomLocationInput" ' +
            'placeholder="請輸入自訂地點" maxlength="100">' +
            '</div>' +
            '<button type="button" class="custom-location-confirm-btn">確認自訂地點</button>' +
            '</div>';

        dom.locationOptions.innerHTML = buttonsHtml + customHtml;

        const customInput = document.getElementById('modalCustomLocationInput');
        if (customInput && state.customLocation) {
            customInput.value = state.customLocation;
        }

        openModal(dom.locationModal);
    }

    function handleSelectFloor(floor) {
        if (!floor) return;
        state.floor = String(floor);

        const valueSpan = dom.chatContainer.querySelector('.floor-select-btn .floor-value');
        if (valueSpan) valueSpan.textContent = formatFloorDisplay(state.floor);

        closeModal(dom.floorModal);
        showToast('已選擇：' + formatFloorDisplay(state.floor), 'success');
    }

    function handleSelectLocation(locId) {
        if (!locId) return;
        state.locationId = String(locId);
        state.customLocation = '';

        const label = getResolvedLocationLabel();
        const valueSpan = dom.chatContainer.querySelector('.location-select-btn .location-value');
        if (valueSpan) valueSpan.textContent = label;

        closeModal(dom.locationModal);
        showToast('已選擇：' + label, 'success');
    }

    function handleConfirmCustomLocation() {
        const input = document.getElementById('modalCustomLocationInput');
        const val = sanitizeInput(input ? input.value : '', 100);
        if (!val) {
            showToast('請輸入自訂地點', 'warning');
            if (input) input.focus();
            return;
        }

        state.locationId = '';
        state.customLocation = val;

        const valueSpan = dom.chatContainer.querySelector('.location-select-btn .location-value');
        if (valueSpan) valueSpan.textContent = val;

        closeModal(dom.locationModal);
        showToast('已設定自訂地點：' + val, 'success');
    }

    function openImagePreviewModal() {
        if (!state.photoDataUrl) return;
        dom.modalImage.src = state.photoDataUrl;
        openModal(dom.imageModal);
    }

    // ==================== 11. 單一集中事件委託 ====================
    function bindGlobalEvents() {
        dom.reloadLogo.addEventListener('click', reloadToHome);

        dom.langSwitchBtn.addEventListener('click', function () {
            window.location.href = 'indexEN.html' + window.location.search;
        });

        dom.cameraFileInput.addEventListener('change', handleFileSelected);
        dom.galleryFileInput.addEventListener('change', handleFileSelected);

        dom.chatContainer.addEventListener('click', function (e) {
            const target = e.target;

            // 提交通報進行中：鎖定所有對話框點擊，防止狀態錯亂
            if (state.isSubmitting) return;

            // 案子已完成後：僅允許點擊「新的通報」，防止往上滑誤觸造成重複通報
            if (target.closest('.new-report-btn')) {
                reloadToHome();
                return;
            }
            if (state.step === 'completed') return;

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
            if (!e.target.classList.contains('floor-input-office')) return;
            const cleaned = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value !== cleaned) e.target.value = cleaned;
            if (cleaned !== '') {
                const num = parseInt(cleaned, 10);
                if (num > 88) {
                    e.target.value = '88';
                    showToast('辦公大樓最高樓層為 88F', 'warning');
                }
            }
        });

        dom.chatContainer.addEventListener('blur', function (e) {
            if (!e.target.classList.contains('floor-input-office')) return;
            const val = e.target.value.trim();
            if (!val) return;
            const num = parseInt(val, 10);
            if (isNaN(num) || num < 1) {
                e.target.value = '1';
                showToast('樓層已調整為 1F', 'warning');
            } else if (num > 88) {
                e.target.value = '88';
                showToast('樓層已調整為 88F', 'warning');
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

        window.addEventListener('pageshow', function (e) {
            if (e.persisted) {
                scrollToTopInstant();
            }
        });
    }

    // ==================== 12. 啟動入口 ====================
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

        parseUrlParams();
        bindGlobalEvents();
        startApp(true);
    });
})();