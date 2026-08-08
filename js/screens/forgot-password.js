// Controller for Forgot Password screen
window.init_forgot_password = async function(params) {
    const requestContainer = document.getElementById('request-reset-container');
    const updateContainer = document.getElementById('update-password-container');

    let session = null;
    if (window.supabaseClient) {
        const { data } = await window.supabaseClient.auth.getSession();
        session = data.session;
    }

    // Determine if we are in recovery mode
    const isRecovery = session || window.location.hash.includes('recovery') || window.location.hash.includes('access_token');

    if (isRecovery && updateContainer && requestContainer) {
        requestContainer.classList.add('hidden');
        updateContainer.classList.remove('hidden');
    }

    // Handle Send Email Form
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.onsubmit = async function(e) {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const submitBtn = forgotForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Sending...';

            try {
                const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + window.location.pathname + '#forgot-password?type=recovery'
                });

                if (error) throw error;

                alert(`A password reset link has been successfully sent to ${email}!`);
                window.location.hash = 'login';
            } catch (err) {
                console.error(err);
                alert(`Request Failed: ${err.message}`);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        };
    }

    // Handle Set New Password Form
    const newPasswordForm = document.getElementById('new-password-form');
    if (newPasswordForm) {
        newPasswordForm.onsubmit = async function(e) {
            e.preventDefault();
            const newPassword = document.getElementById('new-password-input').value;
            const submitBtn = newPasswordForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Updating...';

            try {
                const { error } = await window.supabaseClient.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;

                alert('Your password has been updated successfully! Directing you to your dashboard.');
                window.location.hash = 'dashboard';
            } catch (err) {
                console.error(err);
                alert(`Update Failed: ${err.message}`);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        };
    }
};
