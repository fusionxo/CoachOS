// Controller for Client Invitation onboarding screen
window.init_invitation = function(params) {
    const token = params && params.id;
    
    let client = null;
    let inviteDetails = null;

    const nameInput = document.getElementById('invitation-name');
    const heightInput = document.getElementById('invitation-height');
    const weightInput = document.getElementById('invitation-weight');
    const goalSelect = document.getElementById('invitation-goal');
    const experienceSelect = document.getElementById('invitation-experience');
    const passwordInput = document.getElementById('invitation-password');
    const acceptBtn = document.querySelector('button.btn-primary');

    function showError(message) {
        const card = document.querySelector('.glass-panel');
        if (card) {
            card.innerHTML = `
                <div class="flex flex-col items-center text-center p-unit-lg gap-unit-md fade-in">
                    <span class="material-symbols-outlined text-[64px] text-error mb-2">error</span>
                    <h2 class="font-headline-md text-headline-md text-primary text-xl font-bold">${message}</h2>
                    <p class="text-sm text-on-surface-variant max-w-sm mt-2">Please contact your coach to generate a new invitation link.</p>
                    <a href="#login" class="btn-secondary px-6 py-2.5 rounded-lg text-xs font-semibold mt-6 block">Go to Login</a>
                </div>
            `;
        }
    }

    async function loadInvitationDetails() {
        if (!window.supabaseClient) return;

        if (!token) {
            showError("This invitation is invalid");
            return;
        }

        try {
            // Read client invite details using RPC helper (avoids RLS recursion and public table reads)
            const { data, error } = await window.supabaseClient
                .rpc('get_invitation_details', { p_token: token })
                .maybeSingle();

            if (error) {
                showError("This invitation is invalid");
                return;
            }

            if (!data) {
                showError("This invitation is invalid");
                return;
            }

            if (data.accepted_at) {
                showError("This invitation was already used");
                return;
            }

            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                showError("This invitation expired");
                return;
            }

            // Map data to the structure expected by the rest of the file
            const invite = {
                id: data.invite_id,
                email: data.email,
                expires_at: data.expires_at,
                accepted_at: data.accepted_at,
                client_id: data.client_id,
                workspaces: {
                    id: data.workspace_id,
                    business_name: data.business_name,
                    profiles: {
                        full_name: data.coach_name
                    }
                },
                clients: {
                    id: data.client_id,
                    name: data.client_name,
                    starting_weight: data.client_starting_weight,
                    height: data.client_height,
                    goal: data.client_goal,
                    experience_level: data.client_experience_level
                }
            };

            inviteDetails = invite;
            client = invite.clients;

            // Dynamically update coach details from DB settings
            const coachNameEl = document.querySelector('.flex-col.items-center.text-center span.text-primary.font-medium');
            const bizNameEl = document.querySelector('.flex-col.items-center.text-center p.font-label-caps');
            
            if (coachNameEl && invite.workspaces && invite.workspaces.profiles) {
                coachNameEl.textContent = invite.workspaces.profiles.full_name;
            }
            if (bizNameEl && invite.workspaces) {
                bizNameEl.textContent = invite.workspaces.business_name;
            }

            // Prepopulate inputs
            if (nameInput && client) nameInput.value = client.name || '';
            if (weightInput && client) weightInput.value = client.starting_weight || '75';
            if (heightInput && client) heightInput.value = client.height || '178';
            if (goalSelect && client && client.goal) {
                goalSelect.value = client.goal;
            }
            if (experienceSelect && client && client.experience_level) {
                experienceSelect.value = client.experience_level;
            }
        } catch (err) {
            console.error('Failed to load invitation client details:', err);
            showError("This invitation is invalid");
        }
    }

    if (acceptBtn) {
        acceptBtn.onclick = async () => {
            if (!nameInput.value.trim()) {
                showToast('Please enter your Name.', 'error', 'Validation Error');
                return;
            }
            if (!passwordInput || !passwordInput.value.trim()) {
                showToast('Please choose a password.', 'error', 'Validation Error');
                return;
            }

            if (!client || !inviteDetails) {
                showToast('Onboarding data not loaded.', 'error', 'Invitation Error');
                return;
            }

            const originalBtnText = acceptBtn.innerHTML;
            acceptBtn.disabled = true;
            acceptBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Joining...';

            try {
                // 1. Sign up the client in Supabase Auth
                const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                    email: inviteDetails.email,
                    password: passwordInput.value,
                    options: {
                        data: {
                            full_name: nameInput.value,
                            role: 'client'
                        }
                    }
                });

                if (authError) throw authError;

                // 2. Call RPC to update the clients record and attach the user_id securely
                const { error: rpcError } = await window.supabaseClient.rpc('accept_client_invitation', {
                    p_token: token,
                    p_name: nameInput.value,
                    p_height: heightInput.value,
                    p_weight: weightInput.value,
                    p_goal: goalSelect.value,
                    p_experience: experienceSelect.value
                });

                if (rpcError) throw rpcError;

                // Success
                showToast('Invitation accepted successfully! Redirecting you to the athlete portal.', 'success', 'Invitation Accepted');
                window.userRole = 'client';
                window.location.hash = `client-mobile/${client.id}`;
            } catch (err) {
                console.error('Failed to complete onboarding:', err);
                showToast(`Onboarding Failed: ${err.message}`, 'error', 'Onboarding Error');
                acceptBtn.disabled = false;
                acceptBtn.innerHTML = originalBtnText;
            }
        };
    }

    // Load initial values
    loadInvitationDetails();
};
