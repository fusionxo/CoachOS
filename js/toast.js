/**
 * CoachOS App-Side Toast Notification & Confirmation Modal System
 * Replaces native browser alert() and confirm() dialogs with sleek, 
 * glassmorphic, animated, dark-mode in-app notifications.
 */

(function () {
    // Ensure toast container exists
    function getOrCreateToastContainer() {
        let container = document.getElementById('app-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'app-toast-container';
            container.className = 'fixed top-5 right-5 z-[999999] flex flex-col gap-3 max-w-sm sm:max-w-md w-[calc(100vw-2.5rem)] pointer-events-none';
            document.body.appendChild(container);
        }
        return container;
    }

    /**
     * Display an app-side toast notification.
     * @param {string} message - Toast message text
     * @param {string} type - 'success' | 'error' | 'warning' | 'info'
     * @param {string|null} title - Custom title or null for auto-generated
     * @param {number} duration - Auto dismiss time in ms (default 4000)
     */
    window.showToast = function (message, type = 'info', title = null, duration = 4000) {
        if (!message) return;

        // Clean up message string if needed
        const cleanMsg = String(message).trim();
        if (!cleanMsg) return;

        // Infer type if default info was passed but msg looks like success or error
        if (type === 'info') {
            if (/failed|error|invalid|please enter|missing|unable|cannot|denied|wrong/i.test(cleanMsg)) {
                type = 'error';
            } else if (/success|congratulations|saved|created|logged|updated|accepted|imported|sent|added|completed|🎉/i.test(cleanMsg)) {
                type = 'success';
            }
        }

        const container = getOrCreateToastContainer();

        // Icon and styling config based on type
        const config = {
            success: {
                icon: 'check_circle',
                badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                border: 'border-emerald-500/30',
                progressBg: 'bg-emerald-400',
                defaultTitle: 'Success'
            },
            error: {
                icon: 'error',
                badgeBg: 'bg-red-500/20 text-red-400 border-red-500/30',
                border: 'border-red-500/30',
                progressBg: 'bg-red-400',
                defaultTitle: 'Error'
            },
            warning: {
                icon: 'warning',
                badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                border: 'border-amber-500/30',
                progressBg: 'bg-amber-400',
                defaultTitle: 'Warning'
            },
            info: {
                icon: 'info',
                badgeBg: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
                border: 'border-lime-500/30',
                progressBg: 'bg-lime-400',
                defaultTitle: 'Notification'
            }
        }[type] || {
            icon: 'notifications',
            badgeBg: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
            border: 'border-lime-500/30',
            progressBg: 'bg-lime-400',
            defaultTitle: 'Notification'
        };

        const toastTitle = title || config.defaultTitle;

        // Create Toast Card
        const toast = document.createElement('div');
        toast.className = `pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-xl bg-[#18181b]/95 border ${config.border} text-on-surface shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-x-full opacity-0 scale-95 hover:scale-[1.01]`;
        
        toast.innerHTML = `
            <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border ${config.badgeBg}">
                <span class="material-symbols-outlined text-[20px]">${config.icon}</span>
            </div>
            <div class="flex-1 min-w-0 pr-4">
                <h5 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-0.5">${toastTitle}</h5>
                <p class="text-sm font-medium text-on-surface leading-snug break-words">${cleanMsg}</p>
            </div>
            <button type="button" class="flex-shrink-0 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-variant/50 transition-colors" aria-label="Close">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
            <div class="toast-progress-bar absolute bottom-0 left-0 right-0 h-0.5 ${config.progressBg}/70 transition-all ease-linear" style="width: 100%;"></div>
        `;

        container.appendChild(toast);

        // Animate Toast Entry
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0', 'scale-95');
            toast.classList.add('translate-x-0', 'opacity-100', 'scale-100');
        });

        // Close button handler
        const closeBtn = toast.querySelector('button');
        let autoDismissTimer = null;

        const dismiss = () => {
            if (autoDismissTimer) clearTimeout(autoDismissTimer);
            toast.classList.remove('translate-x-0', 'opacity-100', 'scale-100');
            toast.classList.add('translate-x-full', 'opacity-0', 'scale-95');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        };

        closeBtn.addEventListener('click', dismiss);

        // Progress bar animation & Auto Dismiss
        if (duration && duration > 0) {
            const progressBar = toast.querySelector('.toast-progress-bar');
            progressBar.style.transitionDuration = `${duration}ms`;
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });

            autoDismissTimer = setTimeout(dismiss, duration);
        }

        return toast;
    };

    /**
     * App-Side Confirmation Modal System
     * @param {string} message - Prompt text
     * @param {string} title - Modal title
     * @param {string} confirmText - Confirm button text
     * @param {string} cancelText - Cancel button text
     * @returns {Promise<boolean>}
     */
    window.showConfirm = function (message, title = 'Confirm Action', confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-200 opacity-0';

            const modal = document.createElement('div');
            modal.className = 'w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden p-6 transition-all duration-200 transform scale-95 opacity-0';

            modal.innerHTML = `
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                        <span class="material-symbols-outlined text-[22px]">help_outline</span>
                    </div>
                    <div>
                        <h4 class="text-lg font-bold text-on-surface">${title}</h4>
                    </div>
                </div>
                <p class="text-sm text-on-surface-variant mb-6 leading-relaxed">${message}</p>
                <div class="flex items-center justify-end gap-3">
                    <button type="button" id="app-confirm-cancel" class="px-4 py-2.5 rounded-xl border border-[#27272a] text-sm font-semibold text-on-surface hover:bg-surface-variant/50 transition-all">
                        ${cancelText}
                    </button>
                    <button type="button" id="app-confirm-ok" class="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:bg-primary-fixed-dim shadow-lg transition-all">
                        ${confirmText}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.classList.remove('opacity-0');
                overlay.classList.add('opacity-100');
                modal.classList.remove('scale-95', 'opacity-0');
                modal.classList.add('scale-100', 'opacity-100');
            });

            const close = (result) => {
                overlay.classList.remove('opacity-100');
                overlay.classList.add('opacity-0');
                modal.classList.remove('scale-100');
                modal.classList.add('scale-95');
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                    resolve(result);
                }, 200);
            };

            modal.querySelector('#app-confirm-cancel').addEventListener('click', () => close(false));
            modal.querySelector('#app-confirm-ok').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
        });
    };

    // Preserve original native functions
    window.nativeAlert = window.alert;
    window.nativeConfirm = window.confirm;

    // Global override for window.alert
    window.alert = function (msg) {
        if (msg === undefined || msg === null) return;
        window.showToast(String(msg));
    };

})();
