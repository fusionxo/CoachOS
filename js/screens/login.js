// Controller for Login screen
window.init_login = function(params) {
    const form = document.getElementById('login-form');
    if (form) {
        form.onsubmit = async function(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Authenticating...';

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                console.log('Login successful:', data.user.email);
                
                // Clear cached user role so it loads fresh on redirect
                window.userRole = null;

                // Retrieve profile role to redirect correctly
                const { data: profile, error: profileErr } = await window.supabaseClient
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                if (profileErr) throw profileErr;

                window.userRole = profile.role;

                if (profile.role === 'client') {
                    window.location.hash = `client-mobile/${data.user.id}`;
                } else {
                    window.location.hash = 'dashboard';
                }
            } catch (err) {
                console.error('Authentication failed:', err.message);
                alert(`Login Failed: ${err.message || 'Invalid email or password.'}`);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        };
    }
};
