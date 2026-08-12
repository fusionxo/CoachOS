// Controller for Add Client screen
window.init_add_client = function(params) {
    const formContainer = document.getElementById('invite-form-container');
    const successContainer = document.getElementById('success-container');
    const form = document.getElementById('inviteForm');
    const submitBtn = document.getElementById('submitBtn');
    const copyBtn = document.getElementById('copyBtn');
    const inviteLinkInput = document.getElementById('inviteLinkInput');
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    const newInviteBtn = document.getElementById('newInviteBtn');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Simulate loading state
        const originalBtnContent = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span class="material-symbols-outlined animate-spin" data-icon="sync">sync</span> <span>Generating...</span>`;
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-80');

        const clientName = document.getElementById('clientName').value;
        const clientEmail = document.getElementById('clientEmail').value;
        const clientGoal = document.getElementById('clientGoal').value;

        try {
            // Add client to shared state (returns { client, token })
            let inviteResult = null;
            if (window.appState) {
                inviteResult = await window.appState.addClient(clientName, clientEmail, clientGoal);
            }

            document.getElementById('displayClientName').textContent = clientName;

            // Generate a secure invite link referencing the token
            if (inviteLinkInput && inviteResult) {
                inviteLinkInput.value = `${window.location.origin}/#invitation/${inviteResult.token}`;
            }

            // Transition states
            formContainer.classList.add('hidden');
            formContainer.classList.remove('fade-in');
            
            successContainer.classList.remove('hidden');
            successContainer.classList.add('fade-in');
        } catch (err) {
            console.error('Failed to create invitation:', err);
            showToast(`Failed to create invitation: ${err.message}`, 'error', 'Invite Error');
        } finally {
            // Reset button for next time
            submitBtn.innerHTML = originalBtnContent;
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-80');
        }
    });

    copyBtn.addEventListener('click', () => {
        inviteLinkInput.select();
        document.execCommand('copy');
        
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]" data-icon="check">check</span><span>Copied</span>`;
        copyBtn.classList.add('text-[#22c55e]', 'border-[rgba(34,197,94,0.5)]');
        showToast('Invite link copied to clipboard!', 'success', 'Copied');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('text-[#22c55e]', 'border-[rgba(34,197,94,0.5)]');
        }, 2000);
    });

    sendEmailBtn.addEventListener('click', () => {
         const originalText = sendEmailBtn.innerHTML;
         sendEmailBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]" data-icon="check">check</span><span>Sent!</span>`;
         showToast(`Invitation email dispatched to ${document.getElementById('clientEmail').value || 'client'}!`, 'success', 'Email Sent');
         setTimeout(() => {
            sendEmailBtn.innerHTML = originalText;
         }, 2000);
    });

    newInviteBtn.addEventListener('click', () => {
        form.reset();
        successContainer.classList.add('hidden');
        successContainer.classList.remove('fade-in');
        
        formContainer.classList.remove('hidden');
        formContainer.classList.add('fade-in');
    });
};
