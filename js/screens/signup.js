// Controller for Signup screen
window.init_signup = function(params) {
    const form = document.getElementById('signup-form');
    if (form) {
        form.onsubmit = async function(e) {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Registering...';

            try {
                const { data, error } = await window.supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                            role: 'coach'
                        }
                    }
                });

                if (error) throw error;

                alert('Account registration successful! Directing you to workspace onboarding.');
                
                // Clear cached user role so it loads fresh on onboarding route
                window.userRole = 'coach';

                window.location.hash = 'onboarding';
            } catch (err) {
                console.error('Registration failed:', err.message);
                alert(`Sign Up Failed: ${err.message || 'Error occurred during registration.'}`);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        };
    }
};
