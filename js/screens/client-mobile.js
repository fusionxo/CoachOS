// Controller for Athlete Client Mobile simulation portal
window.init_client_mobile = function(params) {
    const appState = window.appState;
    const defaultClientId = appState.clients[0] ? appState.clients[0].id : '';
    const clientId = (params && params.id) || defaultClientId;
    const client = appState.clients.find(c => c.id === clientId) || appState.clients[0];
    const coachSettings = appState.settings || {};

    if (!client) {
        console.error('Client not found for mobile simulation:', clientId);
        return;
    }

    // 1. Navigation Tab Switching
    const tabButtons = document.querySelectorAll('.btn-client-tab');
    const tabPanes = document.querySelectorAll('.client-tab-pane');

    tabButtons.forEach(btn => {
        btn.onclick = () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Update button styles
            tabButtons.forEach(b => {
                b.className = 'flex flex-col items-center justify-center text-on-surface-variant px-1 py-1 flex-1 btn-client-tab';
                const span = b.querySelector('.material-symbols-outlined');
                if (span) span.style.variationSettings = '';
            });

            btn.className = 'flex flex-col items-center justify-center text-[#ceee93] px-1 py-1 flex-1 btn-client-tab';
            const activeSpan = btn.querySelector('.material-symbols-outlined');
            if (activeSpan) activeSpan.style.variationSettings = "'FILL' 1";

            // Update panels visibility
            tabPanes.forEach(pane => {
                if (pane.id === `client-tab-${targetTab}`) {
                    pane.classList.remove('hidden');
                } else {
                    pane.classList.add('hidden');
                }
            });

            // Re-render specific tabs on click
            if (targetTab === 'training') renderTrainingTab();
            else if (targetTab === 'nutrition') renderNutritionTab();
            else if (targetTab === 'progress') renderProgressTab();
            else if (targetTab === 'messages') renderMessagesTab();
        };
    });

    // 2. Home Tab Logic
    function initHomeTab() {
        const welcomeEl = document.getElementById('client-home-welcome');
        if (welcomeEl) welcomeEl.textContent = `Good Morning, ${client.name.split(' ')[0]}`;

        const clientWorkouts = appState.workouts.filter(w => w.clientId === client.id);
        const todayWorkout = clientWorkouts[0];

        const todayNameEl = document.getElementById('mobile-today-workout-name');
        const todayBadgeEl = document.getElementById('mobile-today-workout-badge');
        const todayExCountEl = document.getElementById('mobile-today-ex-count');
        const startWorkoutBtn = document.getElementById('btn-mobile-start-today-workout');

        if (todayWorkout) {
            if (todayNameEl) todayNameEl.textContent = todayWorkout.name;
            if (todayExCountEl) todayExCountEl.textContent = `${todayWorkout.exercises ? todayWorkout.exercises.length : 0} Exercises`;
            if (todayBadgeEl) {
                const isCompleted = todayWorkout.status === 'Completed';
                todayBadgeEl.textContent = isCompleted ? 'Completed' : 'Scheduled';
                todayBadgeEl.className = isCompleted ? 'bg-[#22c55e]/20 text-[#22c55e] text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider' : 'bg-[#ceee93]/20 text-[#ceee93] text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider';
            }
            if (startWorkoutBtn) {
                startWorkoutBtn.onclick = () => {
                    window.location.hash = `workout-logger/${todayWorkout.id}`;
                };
            }
        } else {
            if (todayNameEl) todayNameEl.textContent = 'No Workout Scheduled Today';
            if (todayExCountEl) todayExCountEl.textContent = '0 Exercises';
            if (todayBadgeEl) todayBadgeEl.textContent = 'Rest Day';
            if (startWorkoutBtn) {
                startWorkoutBtn.onclick = () => {
                    alert('No workout programs assigned by your coach yet!');
                };
            }
        }

        // Daily Check-in state
        const todayStr = new Date().toISOString().split('T')[0];
        const clientCheckins = appState.checkins.filter(c => c.clientId === client.id);
        const checkedInToday = clientCheckins.some(c => c.date === todayStr);

        const checkinForm = document.getElementById('client-checkin-form');
        const checkinCompleteMsg = document.getElementById('client-checkin-complete-msg');
        const checkinStatusText = document.getElementById('client-checkin-status');

        if (checkedInToday) {
            if (checkinForm) checkinForm.classList.add('hidden');
            if (checkinCompleteMsg) checkinCompleteMsg.classList.remove('hidden');
            if (checkinStatusText) {
                checkinStatusText.textContent = 'Completed • Well Done!';
                checkinStatusText.className = 'font-body-sm text-[10px] text-[#22c55e] font-semibold';
            }
        } else {
            if (checkinForm) {
                checkinForm.classList.remove('hidden');
                document.getElementById('mobile-checkin-weight').value = client.weight || '75.0';
                document.getElementById('mobile-checkin-sleep').value = '7.5';
                document.getElementById('mobile-checkin-steps').value = '10000';
            }
            if (checkinCompleteMsg) checkinCompleteMsg.classList.add('hidden');
            if (checkinStatusText) {
                checkinStatusText.textContent = 'Pending • Takes 30s';
                checkinStatusText.className = 'font-body-sm text-[10px] text-primary-container';
            }
        }

        // Streak bar
        const streakText = document.getElementById('mobile-checkin-streak-text');
        const streakBar = document.getElementById('mobile-checkin-streak-bar');
        if (streakText && streakBar) {
            const count = Math.min(7, clientCheckins.length);
            streakText.textContent = `${count}/7 Days`;
            streakBar.style.width = `${(count / 7) * 100}%`;
        }

        // Handle checkin submit
        if (checkinForm) {
            checkinForm.onsubmit = async (e) => {
                e.preventDefault();
                const weight = document.getElementById('mobile-checkin-weight').value;
                const sleep = document.getElementById('mobile-checkin-sleep').value;
                const steps = document.getElementById('mobile-checkin-steps').value;
                const mood = document.getElementById('mobile-checkin-mood').value;

                try {
                    await appState.saveCheckIn(client.id, {
                        date: todayStr,
                        weight,
                        sleep,
                        steps,
                        mood,
                        calories: 2200,
                        protein: 160,
                        carbs: 220,
                        fats: 70,
                        energy: 4,
                        notes: 'Logged via Athlete Mobile check-in.'
                    });

                    alert('Daily check-in logged successfully!');
                    initHomeTab();
                } catch (err) {
                    alert(`Failed to save check-in: ${err.message}`);
                }
            };
        }
    }

    // 3. Training Tab Logic (Week Selector & Workout Cards)
    let selectedWeekNumber = 1;
    function renderTrainingTab() {
        const subtitleEl = document.getElementById('mobile-program-subtitle');
        const weekTabsMount = document.getElementById('mobile-training-week-tabs');
        const listMount = document.getElementById('mobile-training-list');

        const clientWorkouts = appState.workouts.filter(w => w.clientId === client.id);
        const programName = clientWorkouts[0] ? clientWorkouts[0].programName : 'Custom Program';

        if (subtitleEl) subtitleEl.textContent = `${programName} • Phase 1`;

        // Render Week Tabs
        if (weekTabsMount) {
            const weekBtns = weekTabsMount.querySelectorAll('.btn-week-tab');
            weekBtns.forEach(btn => {
                const wNum = parseInt(btn.getAttribute('data-week'));
                if (wNum === selectedWeekNumber) {
                    btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-[#d9f99d] text-[#09090b] btn-week-tab';
                } else {
                    btn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-high btn-week-tab';
                }
                btn.onclick = () => {
                    selectedWeekNumber = wNum;
                    renderTrainingTab();
                };
            });
        }

        // Render Day Cards
        if (!listMount) return;
        listMount.innerHTML = '';

        if (clientWorkouts.length === 0) {
            listMount.innerHTML = `
                <div class="card-bg border border-dashed border-[#27272a] rounded-xl p-6 text-center text-on-surface-variant text-xs">
                    No workout programs assigned by your coach yet.
                </div>
            `;
        } else {
            clientWorkouts.forEach((w, idx) => {
                const isCompleted = w.status === 'Completed';
                const totalSets = (w.exercises || []).reduce((acc, e) => acc + (parseInt(e.sets) || 0), 0);

                const item = document.createElement('div');
                item.className = 'card-bg border border-base hover:border-outline-variant/60 rounded-xl p-4 space-y-3 transition-all';
                item.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-[9px] uppercase font-label-caps tracking-wider text-on-surface-variant font-mono">Day ${idx + 1} • Week ${selectedWeekNumber}</span>
                            <h4 class="font-body-base text-primary font-bold text-sm mt-0.5">${w.name}</h4>
                        </div>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase font-mono ${
                            isCompleted ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#ceee93]/20 text-[#ceee93]'
                        }">${isCompleted ? 'Completed' : 'Scheduled'}</span>
                    </div>

                    <div class="flex items-center gap-3 text-xs text-on-surface-variant font-mono bg-[#09090b] px-3 py-1.5 rounded-lg border border-[#27272a]">
                        <span>💪 ${w.exercises ? w.exercises.length : 0} Exercises</span>
                        <span>⚡ ${totalSets} Sets</span>
                    </div>

                    <button class="w-full py-2 bg-[#d9f99d] text-[#09090b] font-bold text-xs rounded transition-transform active:scale-95 btn-log-workout flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-[16px]">${isCompleted ? 'replay' : 'play_circle'}</span>
                        <span>${isCompleted ? 'Review / Re-log Workout' : 'Start Workout Session'}</span>
                    </button>
                `;

                item.querySelector('.btn-log-workout').onclick = () => {
                    window.location.hash = `workout-logger/${w.id}`;
                };

                listMount.appendChild(item);
            });
        }
    }

    // 4. Dedicated Nutrition Tab Logic
    function renderNutritionTab() {
        const clientCheckins = appState.checkins.filter(c => c.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date));
        const latestCheckin = clientCheckins[0] || {};

        const loggedCals = latestCheckin.calories || 1850;
        const targetCals = 2200;

        const loggedProtein = latestCheckin.protein || 140;
        const targetProtein = 160;

        const loggedCarbs = latestCheckin.carbs || 190;
        const targetCarbs = 220;

        const loggedFats = latestCheckin.fats || 55;
        const targetFats = 70;

        // UI Mounts
        const calsValEl = document.getElementById('nutrition-cals-val');
        const calsBarEl = document.getElementById('nutrition-cals-bar');

        const proteinValEl = document.getElementById('nutrition-protein-val');
        const proteinBarEl = document.getElementById('nutrition-protein-bar');

        const carbsValEl = document.getElementById('nutrition-carbs-val');
        const carbsBarEl = document.getElementById('nutrition-carbs-bar');

        const fatsValEl = document.getElementById('nutrition-fats-val');
        const fatsBarEl = document.getElementById('nutrition-fats-bar');

        if (calsValEl) calsValEl.textContent = `${loggedCals.toLocaleString()} / ${targetCals.toLocaleString()} kcal`;
        if (calsBarEl) calsBarEl.style.width = `${Math.min(100, Math.round((loggedCals / targetCals) * 100))}%`;

        if (proteinValEl) proteinValEl.textContent = `${loggedProtein}g / ${targetProtein}g`;
        if (proteinBarEl) proteinBarEl.style.width = `${Math.min(100, Math.round((loggedProtein / targetProtein) * 100))}%`;

        if (carbsValEl) carbsValEl.textContent = `${loggedCarbs}g / ${targetCarbs}g`;
        if (carbsBarEl) carbsBarEl.style.width = `${Math.min(100, Math.round((loggedCarbs / targetCarbs) * 100))}%`;

        if (fatsValEl) fatsValEl.textContent = `${loggedFats}g / ${targetFats}g`;
        if (fatsBarEl) fatsBarEl.style.width = `${Math.min(100, Math.round((loggedFats / targetFats) * 100))}%`;

        // Prepopulate Logger Form
        const nutrCalsInput = document.getElementById('mobile-nutr-calories');
        const nutrProteinInput = document.getElementById('mobile-nutr-protein');
        const nutrCarbsInput = document.getElementById('mobile-nutr-carbs');
        const nutrFatsInput = document.getElementById('mobile-nutr-fats');

        if (nutrCalsInput) nutrCalsInput.value = loggedCals;
        if (nutrProteinInput) nutrProteinInput.value = loggedProtein;
        if (nutrCarbsInput) nutrCarbsInput.value = loggedCarbs;
        if (nutrFatsInput) nutrFatsInput.value = loggedFats;

        // Form Submit
        const nutrForm = document.getElementById('mobile-nutrition-form');
        if (nutrForm) {
            nutrForm.onsubmit = async (e) => {
                e.preventDefault();
                const cals = parseInt(nutrCalsInput.value) || 2000;
                const prot = parseInt(nutrProteinInput.value) || 150;
                const carbs = parseInt(nutrCarbsInput.value) || 200;
                const fats = parseInt(nutrFatsInput.value) || 60;

                try {
                    await appState.saveCheckIn(client.id, {
                        date: new Date().toISOString().split('T')[0],
                        weight: client.weight || 75.0,
                        sleep: 7.5,
                        steps: 10000,
                        mood: '🙂',
                        calories: cals,
                        protein: prot,
                        carbs: carbs,
                        fats: fats,
                        notes: 'Nutrition log update.'
                    });

                    alert('Nutrition log saved successfully!');
                    renderNutritionTab();
                } catch (err) {
                    alert(`Failed to save nutrition log: ${err.message}`);
                }
            };
        }
    }

    // 5. Progress Tab Logic
    function renderProgressTab() {
        const weightLogsMount = document.getElementById('mobile-weight-logs');
        const measurementsLogsMount = document.getElementById('mobile-measurements-logs');
        const photosGalleryMount = document.getElementById('mobile-photos-gallery');

        const clientCheckins = appState.checkins.filter(c => c.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date));
        const clientMeasures = appState.measurements.filter(m => m.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date));
        const clientPhotos = appState.progressPhotos.filter(p => p.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date));

        if (weightLogsMount) {
            weightLogsMount.innerHTML = '';
            if (clientCheckins.length === 0) {
                weightLogsMount.innerHTML = `<p class="text-[10px] text-on-surface-variant italic">No weight logged yet.</p>`;
            } else {
                clientCheckins.forEach(c => {
                    const row = document.createElement('div');
                    row.className = 'flex justify-between text-xs font-mono text-on-surface border-b border-[#27272a]/20 py-1';
                    row.innerHTML = `<span>${c.date}</span> <span class="text-primary font-bold">${c.weight} kg</span>`;
                    weightLogsMount.appendChild(row);
                });
            }
        }

        if (measurementsLogsMount) {
            measurementsLogsMount.innerHTML = '';
            if (clientMeasures.length === 0) {
                measurementsLogsMount.innerHTML = `<p class="text-[10px] text-on-surface-variant italic">No measurements logged yet.</p>`;
            } else {
                clientMeasures.forEach(m => {
                    const row = document.createElement('div');
                    row.className = 'flex flex-col gap-0.5 text-xs text-on-surface border-b border-[#27272a]/20 py-1.5';
                    row.innerHTML = `
                        <div class="flex justify-between font-mono font-semibold">
                            <span>${m.date}</span>
                        </div>
                        <div class="grid grid-cols-4 gap-1 text-[10px] font-mono text-on-surface-variant">
                            <span>W: ${m.waist}cm</span>
                            <span>C: ${m.chest}cm</span>
                            <span>A: ${m.arms}cm</span>
                            <span>L: ${m.legs}cm</span>
                        </div>
                    `;
                    measurementsLogsMount.appendChild(row);
                });
            }
        }

        if (photosGalleryMount) {
            photosGalleryMount.innerHTML = '';
            if (clientPhotos.length === 0) {
                photosGalleryMount.innerHTML = `<p class="col-span-2 text-[10px] text-on-surface-variant italic py-3 text-center">No progress photos recorded.</p>`;
            } else {
                const earliest = clientPhotos[0];
                const latest = clientPhotos[clientPhotos.length - 1];

                const beforeImg = earliest.front || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcNme_YnSQkYty_V5lL6HrAtsgHdpKdKQ-tuwD-dRPRxEdM6EK98Wklg_C2-TjavYfK-ANi8leJ5CRtTex0ka2YIRLgEqT1hRhcrXB7yy1_atVlJqvlsuWL1_1uO7QZ6WSWWbezaPLePg3aQktN-y5G3He4lI9Tx43WT8QtgHzwx4E2rAyuXQWpkVUJY3W71R57pT2LeW96wYD9CDxcR0J_xEwKS2hCynh_7x3k_pwkZ7X5cfAWq8oyOpqa_UUUsuPuG0tWv1tVIg';
                const afterImg = latest.front || 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3rJlWEZT_wH8Bvk3fZG4EeMVDY7o7bmFYzbsN1yRtEOMs5NsPDp_E-8ut46VjcyUV-rjkpbH8W3aVbPs3WvFnCLm6brnjNV8ciVfdUNKdW3Gk7bgf0QlcFCYAqltMimkx-JjUW1_sYwUyYJoKG5WrEma9tebvNk8nZFYrpvpTzbxZU_WBPrB1ykTGlCiMb21S4eKC7JjxvW9jL5BZqa-5VjCpzcHTKgq7mNuyCIloRQ-UUDOlBcjqt65AdSqlhy_Z6Vdnu1Tui8U';

                photosGalleryMount.innerHTML = `
                    <div class="relative rounded overflow-hidden h-32 border border-[#27272a]">
                        <img alt="Before" class="w-full h-full object-cover grayscale opacity-70" src="${beforeImg}">
                        <span class="absolute bottom-1 left-1 bg-black/60 px-1 rounded text-[8px] text-white">Before</span>
                    </div>
                    <div class="relative rounded overflow-hidden h-32 border border-[#27272a]">
                        <img alt="Current" class="w-full h-full object-cover" src="${afterImg}">
                        <span class="absolute bottom-1 right-1 bg-[#d9f99d] px-1 rounded text-[8px] text-[#09090b] font-bold">Latest</span>
                    </div>
                `;
            }

            const photosCard = photosGalleryMount.parentNode;
            let uploadBtn = photosCard.querySelector('.btn-mobile-upload-photo');
            if (!uploadBtn) {
                uploadBtn = document.createElement('button');
                uploadBtn.className = 'w-full py-2 bg-[#d9f99d] text-[#09090b] font-bold text-xs rounded transition-transform active:scale-95 btn-mobile-upload-photo flex items-center justify-center gap-1.5 mt-3';
                uploadBtn.innerHTML = `<span class="material-symbols-outlined text-[14px]">add_a_photo</span> Upload Progress Photo`;
                photosCard.appendChild(uploadBtn);
            }

            uploadBtn.onclick = () => {
                const fileEl = document.createElement('input');
                fileEl.type = 'file';
                fileEl.accept = 'image/png, image/jpeg, image/jpg, image/webp';
                fileEl.style.display = 'none';
                document.body.appendChild(fileEl);

                fileEl.click();

                fileEl.onchange = async () => {
                    if (fileEl.files.length === 0) return;
                    const file = fileEl.files[0];
                    const originalText = uploadBtn.innerHTML;
                    uploadBtn.disabled = true;
                    uploadBtn.innerHTML = `<span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> Uploading...`;
                    try {
                        await appState.uploadProgressPhoto(client.id, file, 'front');
                        alert('Progress photo uploaded successfully!');
                        renderProgressTab();
                    } catch (err) {
                        console.error(err);
                        alert(`Upload failed: ${err.message}`);
                    } finally {
                        uploadBtn.disabled = false;
                        uploadBtn.innerHTML = originalText;
                        fileEl.remove();
                    }
                };
            };
        }
    }

    // 6. Messages Tab Logic
    function renderMessagesTab() {
        const chatHistoryMount = document.getElementById('mobile-chat-history');
        const coachTitleEl = document.getElementById('mobile-coach-title');
        const chatInput = document.getElementById('mobile-chat-input');
        const sendBtn = document.getElementById('btn-mobile-chat-send');

        if (coachTitleEl) coachTitleEl.textContent = `Messaging ${coachSettings.name || 'Head Coach'}`;

        function populateHistory() {
            if (!chatHistoryMount) return;
            chatHistoryMount.innerHTML = '';

            const history = appState.inbox[client.id] || [];

            if (history.length === 0) {
                chatHistoryMount.innerHTML = `<p class="text-center text-[10px] text-on-surface-variant italic py-6">No messages yet. Send a note to your coach!</p>`;
            } else {
                history.forEach(msg => {
                    const isClient = msg.sender === 'client';
                    const wrapper = document.createElement('div');
                    wrapper.className = `flex flex-col gap-0.5 max-w-[85%] ${isClient ? 'self-end items-end ml-auto' : 'items-start mr-auto'}`;

                    wrapper.innerHTML = `
                        <div class="px-3 py-2 text-xs rounded-xl shadow-md border ${
                            isClient ? 'bg-[#27272a] border-[#44483b] text-primary rounded-tr-none' : 'bg-[#18181b] border-[#27272a] text-on-surface rounded-tl-none'
                        }">
                            <p class="leading-relaxed">${msg.text}</p>
                        </div>
                        <span class="text-[9px] text-on-surface-variant font-mono ${isClient ? 'mr-1' : 'ml-1'}">${msg.time}</span>
                    `;
                    chatHistoryMount.appendChild(wrapper);
                });
            }

            setTimeout(() => {
                chatHistoryMount.scrollTop = chatHistoryMount.scrollHeight;
            }, 50);
        }

        async function sendMsg() {
            if (!chatInput) return;
            const text = chatInput.value.trim();
            if (!text) return;

            const originalText = chatInput.value;
            chatInput.value = '';
            chatInput.disabled = true;

            try {
                await appState.sendMessage(client.id, 'client', text);
                populateHistory();
            } catch (err) {
                console.error(err);
                alert(`Failed to send message: ${err.message}`);
                chatInput.value = originalText;
            } finally {
                chatInput.disabled = false;
                chatInput.focus();
            }
        }

        if (sendBtn) sendBtn.onclick = sendMsg;
        if (chatInput) {
            chatInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMsg();
                }
            };
        }

        populateHistory();
    }

    // Initialize Home tab defaults
    initHomeTab();
};
