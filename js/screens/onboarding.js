// Controller for Onboarding screen
window.init_onboarding = function(params) {
    let currentStep = 1;
    const totalSteps = 3;
    
    const btnNext = document.getElementById('btn-next');
    const btnBack = document.getElementById('btn-back');
    const progressBar = document.getElementById('progress-indicator');
    const stepCounter = document.getElementById('step-counter');

    if (!btnNext) return;

    function updateUI() {
        // Update Step Visibility
        for(let i=1; i<=totalSteps; i++) {
            const stepEl = document.getElementById(`step-${i}`);
            if (stepEl) {
                if(i === currentStep) {
                    stepEl.classList.remove('step-hidden');
                    stepEl.classList.add('step-active');
                } else {
                    stepEl.classList.remove('step-active');
                    stepEl.classList.add('step-hidden');
                }
            }
        }

        // Update Progress Bar
        const progressPercentage = (currentStep / totalSteps) * 100;
        if (progressBar) progressBar.style.width = `${progressPercentage}%`;

        // Update Counter
        if (stepCounter) stepCounter.textContent = `STEP ${currentStep} OF ${totalSteps}`;

        // Update Buttons
        if(currentStep === 1) {
            btnBack.classList.add('invisible');
        } else {
            btnBack.classList.remove('invisible');
        }

        if(currentStep === totalSteps) {
            // Populate Step 3 Preview values
            const nameVal = document.getElementById('onboarding-coach-name').value;
            const bizVal = document.getElementById('onboarding-business-name').value;
            const checkedRadio = document.querySelector('input[name="clients"]:checked');
            const sizeVal = checkedRadio ? checkedRadio.value : 'Just starting';

            const previewName = document.getElementById('preview-coach-name');
            const previewBiz = document.getElementById('preview-business-name');
            const previewSize = document.getElementById('preview-business-size');

            if (previewName) previewName.textContent = nameVal || 'Not entered';
            if (previewBiz) previewBiz.textContent = bizVal || 'Not entered';
            if (previewSize) previewSize.textContent = sizeVal;

            btnNext.innerHTML = `
                Create Workspace
                <span class="material-symbols-outlined text-sm">check</span>
            `;
        } else {
            btnNext.innerHTML = `
                Continue
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
            `;
        }
    }

    btnNext.addEventListener('click', () => {
        if (currentStep === 1) {
            const nameInput = document.getElementById('onboarding-coach-name');
            const bizInput = document.getElementById('onboarding-business-name');
            if (!nameInput.value.trim() || !bizInput.value.trim()) {
                alert('Please enter both Coach Name and Business Name to continue.');
                return;
            }
        }

        if(currentStep < totalSteps) {
            currentStep++;
            updateUI();
        } else {
            // Final Action - save details
            const nameVal = document.getElementById('onboarding-coach-name').value;
            const bizVal = document.getElementById('onboarding-business-name').value;
            const checkedRadio = document.querySelector('input[name="clients"]:checked');
            const sizeVal = checkedRadio ? checkedRadio.value : 'Just starting';

            btnNext.disabled = true;
            btnNext.innerHTML = `
                <span class="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Building...
            `;

            (async () => {
                try {
                    if (window.appState) {
                        await window.appState.saveSettings({
                            name: nameVal,
                            businessName: bizVal,
                            businessSize: sizeVal
                        });
                    }

                    // Refresh shell headers
                    if (window.router && typeof window.router.updateCoachHeaderDetails === 'function') {
                        window.router.updateCoachHeaderDetails();
                    }
                    // Redirect to Dashboard
                    window.location.hash = 'dashboard';
                } catch (err) {
                    console.error('Failed to create workspace:', err);
                    alert(`Onboarding Error: ${err.message}`);
                    btnNext.disabled = false;
                    btnNext.innerHTML = `
                        Create Workspace
                        <span class="material-symbols-outlined text-sm">check</span>
                    `;
                }
            })();
        }
    });

    btnBack.addEventListener('click', () => {
        if(currentStep > 1) {
            currentStep--;
            updateUI();
        }
    });
    
    // Allow clicking options to auto-advance on step 2 for a smoother feel
    const radioInputs = document.querySelectorAll('input[type="radio"]');
    radioInputs.forEach(input => {
        input.addEventListener('change', () => {
            if(currentStep === 2) {
                setTimeout(() => {
                    currentStep++;
                    updateUI();
                }, 300); // slight delay for visual feedback
            }
        });
    });

    // Initialize
    updateUI();
};
