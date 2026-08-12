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
        // Avatar preview & upload handling
        const avatarInput = document.getElementById('settings-avatar');
        const avatarFileInput = document.getElementById('settings-avatar-file');
        const avatarPreview = document.getElementById('settings-avatar-preview');
        const avatarPlaceholder = document.getElementById('settings-avatar-placeholder');
        const avatarStatus = document.getElementById('settings-avatar-upload-status');

        function updateAvatarPreview(url) {
            if (url && avatarPreview) {
                avatarPreview.src = url;
                avatarPreview.classList.remove('hidden');
                if (avatarPlaceholder) avatarPlaceholder.classList.add('hidden');
            } else if (avatarPreview) {
                avatarPreview.classList.add('hidden');
                if (avatarPlaceholder) avatarPlaceholder.classList.remove('hidden');
            }
        }

        if (avatarInput) {
            avatarInput.value = settings.avatar || '';
            updateAvatarPreview(settings.avatar);

            avatarInput.oninput = function() {
                updateAvatarPreview(this.value.trim());
            };
        }

        if (avatarFileInput) {
            avatarFileInput.onchange = async function(e) {
                const file = e.target.files[0];
                if (!file) return;

                if (avatarStatus) avatarStatus.textContent = 'Compressing image (max 1080px)...';

                try {
                    // 1. Client-side Canvas Image Compression
                    const compressedFile = typeof window.compressImage === 'function'
                        ? await window.compressImage(file, { maxWidth: 1080, maxHeight: 1080, quality: 0.78 })
                        : file;

                    if (avatarStatus) avatarStatus.textContent = 'Uploading to storage...';

                    // 2. Upload to Supabase Storage or convert to data URL fallback
                    let avatarUrl = '';
                    if (window.supabaseClient && window.appState.user) {
                        const fileExt = compressedFile.name.split('.').pop() || 'jpg';
                        const filePath = `avatars/${window.appState.user.id}_${Date.now()}.${fileExt}`;

                        const { error: uploadErr } = await window.supabaseClient.storage
                            .from('progress-photos')
                            .upload(filePath, compressedFile, { upsert: true });

                        if (!uploadErr) {
                            const { data: pubUrlData } = window.supabaseClient.storage
                                .from('progress-photos')
                                .getPublicUrl(filePath);
                            avatarUrl = pubUrlData?.publicUrl || '';
                        }
                    }

                    // Fallback to data URL if storage upload not configured
                    if (!avatarUrl) {
                        avatarUrl = await new Promise((res) => {
                            const r = new FileReader();
                            r.onload = (evt) => res(evt.target.result);
                            r.readAsDataURL(compressedFile);
                        });
                    }

                    if (avatarInput) avatarInput.value = avatarUrl;
                    updateAvatarPreview(avatarUrl);
                    if (avatarStatus) avatarStatus.textContent = '✅ Compressed & Uploaded!';
                    showToast('Avatar photo uploaded successfully!', 'success', 'Photo Uploaded');
                } catch (err) {
                    if (avatarStatus) avatarStatus.textContent = 'Upload failed';
                    showToast(`Avatar upload failed: ${err.message}`, 'error', 'Upload Error');
                }
            };
        }

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
                showToast('Settings saved successfully!', 'success', 'Settings Saved');
                if (successMsg) {
                    successMsg.classList.remove('hidden');
                    successMsg.classList.add('inline-flex');
                    setTimeout(() => {
                        successMsg.classList.add('hidden');
                        successMsg.classList.remove('inline-flex');
                    }, 3000);
                }
            } catch (err) {
                showToast(`Failed to save settings: ${err.message}`, 'error', 'Save Error');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalBtnText;
                }
            }
        };
    }

    // Log Out Button Handler
    const logoutBtn = document.getElementById('btn-settings-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async function() {
            if (await showConfirm('Are you sure you want to sign out of CoachOS?', 'Log Out', 'Sign Out', 'Cancel')) {
                try {
                    if (window.supabaseClient) {
                        await window.supabaseClient.auth.signOut();
                    }
                    if (window.appState) {
                        window.appState.user = null;
                        window.appState.profile = null;
                        window.appState.workspace = null;
                    }
                    showToast('Successfully logged out.', 'info', 'Logged Out');
                    window.location.hash = 'login';
                } catch (err) {
                    showToast(`Logout error: ${err.message}`, 'error', 'Error');
                }
            }
        };
    }

    if (clearDbBtn) {
        clearDbBtn.onclick = async function() {
            if (await showConfirm('Are you sure you want to completely wipe all coach workspace data? This cannot be undone.', 'Wipe Workspace Data', 'Wipe Data', 'Cancel')) {
                try {
                    await window.appState.toggleDemoMode(false);
                    if (window.router && typeof window.router.updateCoachHeaderDetails === 'function') {
                        window.router.updateCoachHeaderDetails();
                    }
                    showToast('Database successfully reset to clean production mode!', 'success', 'Database Reset');
                    setTimeout(() => location.reload(), 1000);
                } catch (err) {
                    showToast(`Failed to reset: ${err.message}`, 'error', 'Reset Error');
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
