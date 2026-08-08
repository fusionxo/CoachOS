// Controller for Coach Settings screen
window.init_settings = function(params) {
    const settings = window.appState.settings;
    const form = document.getElementById('settings-form');
    const successMsg = document.getElementById('settings-save-success');
    const demoModeCheckbox = document.getElementById('settings-demo-mode');
    const clearDbBtn = document.getElementById('btn-clear-db');

    // Populate form values
    if (form) {
        document.getElementById('settings-coach-name').value = settings.name || '';
        document.getElementById('settings-coach-role').value = settings.role || 'Head Coach';
        document.getElementById('settings-business-name').value = settings.businessName || '';
        document.getElementById('settings-email').value = settings.email || '';
        document.getElementById('settings-currency').value = settings.currency || 'INR';
        document.getElementById('settings-threshold').value = settings.thresholdAdherence || 75;
        
        // New fields
        const avatarInput = document.getElementById('settings-avatar');
        if (avatarInput) avatarInput.value = settings.avatar || '';
        
        const timezoneInput = document.getElementById('settings-timezone');
        if (timezoneInput) timezoneInput.value = settings.timezone || 'Asia/Kolkata';
        
        const notifyEmailInput = document.getElementById('settings-notify-email');
        if (notifyEmailInput) notifyEmailInput.checked = settings.notifyEmail !== false;
        
        const notifyAdherenceInput = document.getElementById('settings-notify-adherence');
        if (notifyAdherenceInput) notifyAdherenceInput.checked = settings.notifyAdherence !== false;

        if (demoModeCheckbox) {
            demoModeCheckbox.checked = settings.demoMode || false;
        }

        // Form submit
        form.onsubmit = async function(e) {
            e.preventDefault();

            const name = document.getElementById('settings-coach-name').value;
            const role = document.getElementById('settings-coach-role').value;
            const businessName = document.getElementById('settings-business-name').value;
            const email = document.getElementById('settings-email').value;
            const currency = document.getElementById('settings-currency').value;
            const thresholdAdherence = parseInt(document.getElementById('settings-threshold').value);
            
            const avatar = document.getElementById('settings-avatar') ? document.getElementById('settings-avatar').value : '';
            const timezone = document.getElementById('settings-timezone') ? document.getElementById('settings-timezone').value : 'Asia/Kolkata';
            const notifyEmail = document.getElementById('settings-notify-email') ? document.getElementById('settings-notify-email').checked : true;
            const notifyAdherence = document.getElementById('settings-notify-adherence') ? document.getElementById('settings-notify-adherence').checked : true;

            // Check if demoMode changed
            const demoModeChecked = demoModeCheckbox ? demoModeCheckbox.checked : false;
            const demoModeChanged = demoModeChecked !== (settings.demoMode || false);

            const saveBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = saveBtn ? saveBtn.innerHTML : '';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Saving...';
            }

            try {
                if (demoModeChanged) {
                    await window.appState.toggleDemoMode(demoModeChecked);
                } else {
                    await window.appState.saveSettings({
                        name,
                        role,
                        businessName,
                        email,
                        currency,
                        thresholdAdherence,
                        avatar,
                        timezone,
                        notifyEmail,
                        notifyAdherence,
                        demoMode: settings.demoMode || false
                    });
                }

                // Update UI Sidebar Header immediately
                if (window.router && typeof window.router.updateCoachHeaderDetails === 'function') {
                    window.router.updateCoachHeaderDetails();
                }

                // Re-populate settings in case demoMode toggled mock values
                document.getElementById('settings-coach-name').value = window.appState.settings.name || '';
                document.getElementById('settings-business-name').value = window.appState.settings.businessName || '';
                document.getElementById('settings-email').value = window.appState.settings.email || '';
                if (document.getElementById('settings-avatar')) {
                    document.getElementById('settings-avatar').value = window.appState.settings.avatar || '';
                }

                // Show success alert
                if (successMsg) {
                    successMsg.classList.remove('hidden');
                    successMsg.classList.add('inline-flex');
                    setTimeout(() => {
                        successMsg.classList.add('hidden');
                        successMsg.classList.remove('inline-flex');
                    }, 3000);
                }
            } catch (err) {
                alert(`Failed to save settings: ${err.message}`);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalBtnText;
                }
            }
        };
    }

    if (clearDbBtn) {
        clearDbBtn.onclick = async function() {
            if (confirm('Are you sure you want to completely wipe all coach workspace data? This cannot be undone.')) {
                try {
                    await window.appState.toggleDemoMode(false);
                    if (window.router && typeof window.router.updateCoachHeaderDetails === 'function') {
                        window.router.updateCoachHeaderDetails();
                    }
                    alert('Database successfully reset to clean production mode!');
                    location.reload();
                } catch (err) {
                    alert(`Failed to reset: ${err.message}`);
                }
            }
        };
    }

    // Export JSON handler
    const exportDbBtn = document.getElementById('btn-export-db');
    if (exportDbBtn) {
        exportDbBtn.onclick = function() {
            const backup = {
                clients: window.appState.clients,
                checkins: window.appState.checkins,
                measurements: window.appState.measurements,
                workouts: window.appState.workouts,
                templates: window.appState.templates,
                settings: window.appState.settings,
                privateNotes: window.appState.privateNotes
            };
            const dbData = JSON.stringify(backup, null, 2);
            const blob = new Blob([dbData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `coachos_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
    }
};
