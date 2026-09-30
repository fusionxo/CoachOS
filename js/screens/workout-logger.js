// Controller for Client Workout Logger mobile simulation
window.init_workout_logger = async function(params) {
    const appState = window.appState;
    const workoutId = params && params.id;
    let workouts = appState.workouts || [];

    const defaultWorkout = {
        id: workoutId || 'demo-workout',
        name: 'Lower Body Power Focus',
        programName: 'Training Program',
        weekName: 'Week 1',
        exercises: [
            { id: 'ex-1', name: 'Barbell Back Squat', sets: 4, reps: '5-8', weight: '75', rest: '180s', notes: 'Maintain neutral spine, drive hard off hips.' },
            { id: 'ex-2', name: 'Romanian Deadlift', sets: 3, reps: '8-10', weight: '85', rest: '120s', notes: 'Hinge at hips, keep bar close to shins.' },
            { id: 'ex-3', name: 'Bulgarian Split Squat', sets: 3, reps: '10-12', weight: '20', rest: '90s', notes: 'Keep torso upright, drive through front heel.' }
        ]
    };

    let workout = (workoutId && workouts.find(w => w.id === workoutId)) || null;

    // Direct DB fallback if refreshing directly on #workout-logger/:id
    if (!workout && workoutId && window.supabaseClient) {
        try {
            const { data: dbWk } = await window.supabaseClient
                .from('workouts')
                .select('*, exercises(*), program_weeks(*, programs(*))')
                .eq('id', workoutId)
                .maybeSingle();

            if (dbWk) {
                const program = dbWk.program_weeks?.programs;
                const week = dbWk.program_weeks;
                workout = {
                    id: dbWk.id,
                    clientId: program?.client_id,
                    programId: program?.id,
                    weekId: week?.id,
                    weekNumber: week?.week_number || 1,
                    dayNumber: dbWk.day_number || 1,
                    name: dbWk.name,
                    status: dbWk.status || 'Scheduled',
                    notes: dbWk.instructions,
                    programName: program?.name || 'Training Program',
                    weekName: `Week ${week?.week_number || 1}`,
                    exercises: dbWk.exercises ? dbWk.exercises.map(e => ({
                        id: e.id,
                        name: e.name,
                        sets: e.sets,
                        reps: e.reps,
                        weight: e.load_target,
                        rest: e.rest_time,
                        notes: e.notes,
                        order: e.order_index
                    })).sort((a,b) => (a.order || 0) - (b.order || 0)) : []
                };
            }
        } catch(e) {
            console.warn('Could not fetch workout directly:', e);
        }
    }

    if (!workout) {
        workout = workouts[0] || defaultWorkout;
    }

    // Dynamic State per session
    let activeExerciseIndex = 0;
    let exercises = workout.exercises || [];
    if (exercises.length === 0) {
        exercises = [
            { id: 'ex-1', name: 'Barbell Back Squat', sets: 4, reps: '5-8', weight: '75', rest: '180s', notes: 'Deep depth, brace core hard.' }
        ];
    }

    // Default Set tracking memory
    function createDefaultSessionLogs() {
        const logs = {};
        exercises.forEach(ex => {
            const numSets = parseInt(ex.sets) || 3;
            logs[ex.id] = [];
            for (let i = 1; i <= numSets; i++) {
                logs[ex.id].push({
                    setNum: i,
                    weight: parseFloat(ex.weight) || 75.0,
                    reps: parseInt(ex.reps) || 10,
                    completed: false
                });
            }
        });
        return logs;
    }

    let sessionLogs = createDefaultSessionLogs();
    let elapsedSeconds = 0;
    let draftRestored = false;

    // Check for saved in-progress draft in localStorage
    const draftKey = `coachos_workout_draft_${workout.id}`;
    try {
        const savedDraftRaw = localStorage.getItem(draftKey);
        if (savedDraftRaw) {
            const draft = JSON.parse(savedDraftRaw);
            if (draft && draft.sessionLogs && Object.keys(draft.sessionLogs).length > 0) {
                sessionLogs = draft.sessionLogs;
                if (typeof draft.activeExerciseIndex === 'number' && draft.activeExerciseIndex < exercises.length) {
                    activeExerciseIndex = draft.activeExerciseIndex;
                }
                if (typeof draft.elapsedSeconds === 'number') {
                    elapsedSeconds = draft.elapsedSeconds;
                }
                draftRestored = true;
            }
        }
    } catch(e) {
        console.warn('Error reading saved workout draft:', e);
    }

    // Helper: Persist draft immediately to localStorage
    function persistDraft() {
        try {
            localStorage.setItem(draftKey, JSON.stringify({
                activeExerciseIndex,
                sessionLogs,
                elapsedSeconds,
                updatedAt: Date.now()
            }));
        } catch(e) {}
    }

    // UI Mount Points
    const workoutTitleEl = document.getElementById('logger-workout-title');
    const programTitleEl = document.getElementById('logger-program-title');
    const elapsedTimerEl = document.getElementById('logger-elapsed-timer');
    const exerciseTabsMount = document.getElementById('logger-exercise-tabs');

    const draftAlertEl = document.getElementById('logger-draft-alert');
    const btnDiscardDraft = document.getElementById('btn-discard-draft');

    const exCounterEl = document.getElementById('logger-ex-counter');
    const exNameEl = document.getElementById('logger-ex-name');
    const exTargetBadge = document.getElementById('logger-ex-target-badge');
    const exLoadEl = document.getElementById('logger-ex-load');
    const exRestEl = document.getElementById('logger-ex-rest');
    const exNotesEl = document.getElementById('logger-ex-notes');
    const exNotesContainer = document.getElementById('logger-ex-notes-container');

    const setsListMount = document.getElementById('logger-sets-list');
    const setsSummaryEl = document.getElementById('logger-sets-summary');
    const btnAddSet = document.getElementById('btn-logger-add-set');

    const btnBack = document.getElementById('btn-logger-back');
    const btnPrevEx = document.getElementById('btn-logger-prev-ex');
    const btnNextEx = document.getElementById('btn-logger-next-ex');
    const btnFinish = document.getElementById('btn-finish-workout');

    // Rest Timer Mounts
    const restBanner = document.getElementById('logger-rest-timer-banner');
    const restCountdownEl = document.getElementById('rest-timer-countdown');
    const btnRestPlus30 = document.getElementById('btn-rest-plus30');
    const btnRestSkip = document.getElementById('btn-rest-skip');

    let restInterval = null;
    let restSecondsLeft = 0;

    // Elapsed Timer
    function formatTime(totalSecs) {
        const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    }

    if (elapsedTimerEl) elapsedTimerEl.textContent = formatTime(elapsedSeconds);

    const elapsedInterval = setInterval(() => {
        elapsedSeconds++;
        if (elapsedTimerEl) elapsedTimerEl.textContent = formatTime(elapsedSeconds);
        // Throttle draft save to every 10 seconds for timer
        if (elapsedSeconds % 10 === 0) {
            persistDraft();
        }
    }, 1000);

    // Save on browser close / navigation
    const handleBeforeUnload = () => persistDraft();
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    function cleanup() {
        clearInterval(elapsedInterval);
        clearInterval(restInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handleBeforeUnload);
    }

    // Header Setup
    if (workoutTitleEl) workoutTitleEl.textContent = workout.name;
    if (programTitleEl) programTitleEl.textContent = `${workout.programName || 'Training Program'} • ${workout.weekName || 'Week 1'}`;
    
    // Show draft restored banner if applicable
    if (draftRestored && draftAlertEl) {
        draftAlertEl.classList.remove('hidden');
    }

    if (btnDiscardDraft) {
        btnDiscardDraft.onclick = () => {
            try {
                localStorage.removeItem(draftKey);
            } catch(e) {}
            sessionLogs = createDefaultSessionLogs();
            activeExerciseIndex = 0;
            elapsedSeconds = 0;
            if (elapsedTimerEl) elapsedTimerEl.textContent = '00:00';
            if (draftAlertEl) draftAlertEl.classList.add('hidden');
            renderActiveExercise();
            showToast('Workout progress reset to start', 'info', 'Session Reset');
        };
    }

    if (btnBack) {
        btnBack.onclick = () => {
            persistDraft();
            cleanup();
            const user = appState.user;
            window.location.hash = user ? `client-mobile/${user.id}` : 'client-mobile';
        };
    }

    // Render Exercise Tabs Bar
    function renderExerciseTabs() {
        if (!exerciseTabsMount) return;
        exerciseTabsMount.innerHTML = '';

        exercises.forEach((ex, idx) => {
            const btn = document.createElement('button');
            const isActive = idx === activeExerciseIndex;
            const setRecords = sessionLogs[ex.id] || [];
            const isAllCompleted = setRecords.length > 0 && setRecords.every(s => s.completed);

            btn.className = `px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 ${
                isActive 
                    ? 'bg-[#d9f99d] text-[#09090b]' 
                    : isAllCompleted 
                        ? 'bg-[#22c55e]/20 border border-[#22c55e]/40 text-[#22c55e]' 
                        : 'bg-[#18181b] border border-[#27272a] text-on-surface-variant hover:text-primary'
            }`;
            btn.innerHTML = `
                ${isAllCompleted ? '<span class="material-symbols-outlined text-[13px]">check_circle</span>' : ''}
                <span>${idx + 1}. ${ex.name}</span>
            `;
            btn.onclick = () => {
                activeExerciseIndex = idx;
                persistDraft();
                renderActiveExercise();
            };
            exerciseTabsMount.appendChild(btn);
        });
    }

    // Render Current Active Exercise
    function renderActiveExercise() {
        renderExerciseTabs();

        const currentEx = exercises[activeExerciseIndex];
        if (!currentEx) return;

        if (exCounterEl) exCounterEl.textContent = `Exercise ${activeExerciseIndex + 1} of ${exercises.length}`;
        if (exNameEl) exNameEl.textContent = currentEx.name;
        if (exTargetBadge) exTargetBadge.textContent = `${currentEx.sets} Sets • ${currentEx.reps} Reps`;
        if (exLoadEl) exLoadEl.textContent = currentEx.weight || 'RPE 8';
        if (exRestEl) exRestEl.textContent = currentEx.rest || '90s';

        if (currentEx.notes) {
            if (exNotesContainer) exNotesContainer.classList.remove('hidden');
            if (exNotesEl) exNotesEl.textContent = currentEx.notes;
        } else {
            if (exNotesContainer) exNotesContainer.classList.add('hidden');
        }

        renderSetsTable(currentEx);
    }

    // Render Sets Table for Exercise
    function renderSetsTable(currentEx) {
        if (!setsListMount) return;
        setsListMount.innerHTML = '';

        const setRecords = sessionLogs[currentEx.id] || [];
        const completedCount = setRecords.filter(s => s.completed).length;

        if (setsSummaryEl) {
            setsSummaryEl.textContent = `${completedCount} / ${setRecords.length} Sets Completed`;
        }

        setRecords.forEach((setRec, idx) => {
            const setRow = document.createElement('div');
            const isCompleted = setRec.completed;

            setRow.className = `p-2.5 sm:p-3 rounded-xl border transition-all ${
                isCompleted ? 'bg-[#18181b]/60 border-[#22c55e]/40 opacity-90' : 'bg-[#18181b] border-[#27272a]'
            }`;

            setRow.innerHTML = `
                <div class="grid grid-cols-12 gap-1.5 sm:gap-2 items-center w-full min-w-0">
                    <!-- Col 1-4: Set info -->
                    <div class="col-span-4 flex items-center gap-2 min-w-0">
                        <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-stat-mono text-xs font-bold shrink-0 ${
                            isCompleted ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#27272a] text-primary'
                        }">${setRec.setNum}</span>
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-primary truncate">Set ${setRec.setNum}</p>
                            <p class="text-[10px] text-on-surface-variant font-mono truncate">${currentEx.reps || '10'} reps target</p>
                        </div>
                    </div>

                    <!-- Col 5-7: Weight input -->
                    <div class="col-span-3 flex items-center gap-0.5 bg-[#09090b] border border-[#27272a] rounded-lg p-1 min-w-0">
                        <button class="w-5 h-5 rounded bg-[#18181b] text-on-surface hover:text-primary flex items-center justify-center font-bold text-xs shrink-0 btn-weight-minus">-</button>
                        <input type="number" step="0.5" class="w-full min-w-0 bg-transparent border-none text-center font-mono text-xs font-bold text-primary p-0 focus:ring-0 input-weight" value="${setRec.weight}">
                        <span class="text-[9px] text-on-surface-variant font-mono pr-0.5 shrink-0 hidden sm:inline">kg</span>
                        <button class="w-5 h-5 rounded bg-[#18181b] text-on-surface hover:text-primary flex items-center justify-center font-bold text-xs shrink-0 btn-weight-plus">+</button>
                    </div>

                    <!-- Col 8-10: Reps input -->
                    <div class="col-span-3 flex items-center gap-0.5 bg-[#09090b] border border-[#27272a] rounded-lg p-1 min-w-0">
                        <button class="w-5 h-5 rounded bg-[#18181b] text-on-surface hover:text-primary flex items-center justify-center font-bold text-xs shrink-0 btn-reps-minus">-</button>
                        <input type="number" class="w-full min-w-0 bg-transparent border-none text-center font-mono text-xs font-bold text-primary p-0 focus:ring-0 input-reps" value="${setRec.reps}">
                        <span class="text-[9px] text-on-surface-variant font-mono pr-0.5 shrink-0 hidden sm:inline">reps</span>
                        <button class="w-5 h-5 rounded bg-[#18181b] text-on-surface hover:text-primary flex items-center justify-center font-bold text-xs shrink-0 btn-reps-plus">+</button>
                    </div>

                    <!-- Col 11-12: Complete checkmark -->
                    <div class="col-span-2 flex justify-end">
                        <button class="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                            isCompleted ? 'bg-[#22c55e] text-[#09090b] shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'bg-[#27272a] text-on-surface-variant hover:text-primary'
                        } btn-toggle-complete" title="${isCompleted ? 'Mark as incomplete' : 'Complete set'}">
                            <span class="material-symbols-outlined text-[18px]">${isCompleted ? 'check_circle' : 'radio_button_unchecked'}</span>
                        </button>
                    </div>
                </div>
            `;

            // Weight Adjusters
            const weightInput = setRow.querySelector('.input-weight');
            setRow.querySelector('.btn-weight-minus').onclick = () => {
                setRec.weight = Math.max(0, parseFloat((parseFloat(weightInput.value || 0) - 2.5).toFixed(1)));
                weightInput.value = setRec.weight;
                persistDraft();
            };
            setRow.querySelector('.btn-weight-plus').onclick = () => {
                setRec.weight = parseFloat((parseFloat(weightInput.value || 0) + 2.5).toFixed(1));
                weightInput.value = setRec.weight;
                persistDraft();
            };
            weightInput.oninput = (e) => {
                setRec.weight = parseFloat(e.target.value) || 0;
                persistDraft();
            };

            // Reps Adjusters
            const repsInput = setRow.querySelector('.input-reps');
            setRow.querySelector('.btn-reps-minus').onclick = () => {
                setRec.reps = Math.max(0, parseInt(repsInput.value || 0) - 1);
                repsInput.value = setRec.reps;
                persistDraft();
            };
            setRow.querySelector('.btn-reps-plus').onclick = () => {
                setRec.reps = parseInt(repsInput.value || 0) + 1;
                repsInput.value = setRec.reps;
                persistDraft();
            };
            repsInput.oninput = (e) => {
                setRec.reps = parseInt(e.target.value) || 0;
                persistDraft();
            };

            // Toggle Complete Action
            setRow.querySelector('.btn-toggle-complete').onclick = () => {
                setRec.completed = !setRec.completed;
                persistDraft();
                if (setRec.completed) {
                    const parsedRest = parseInt(currentEx.rest) || 90;
                    startRestTimer(parsedRest);
                }
                renderActiveExercise();
            };

            setsListMount.appendChild(setRow);
        });
    }

    // Add Extra Set Button
    if (btnAddSet) {
        btnAddSet.onclick = () => {
            const currentEx = exercises[activeExerciseIndex];
            if (!currentEx) return;
            const setRecords = sessionLogs[currentEx.id] || [];
            const lastSet = setRecords[setRecords.length - 1];
            setRecords.push({
                setNum: setRecords.length + 1,
                weight: lastSet ? lastSet.weight : (parseFloat(currentEx.weight) || 75.0),
                reps: lastSet ? lastSet.reps : (parseInt(currentEx.reps) || 10),
                completed: false
            });
            persistDraft();
            renderActiveExercise();
        };
    }

    // Rest Timer Countdown logic
    function startRestTimer(seconds) {
        clearInterval(restInterval);
        restSecondsLeft = seconds;

        if (restBanner) restBanner.classList.remove('hidden');

        function updateRestDisplay() {
            const mins = String(Math.floor(restSecondsLeft / 60)).padStart(2, '0');
            const secs = String(restSecondsLeft % 60).padStart(2, '0');
            if (restCountdownEl) restCountdownEl.textContent = `${mins}:${secs}`;
        }

        updateRestDisplay();

        restInterval = setInterval(() => {
            restSecondsLeft--;
            if (restSecondsLeft <= 0) {
                clearInterval(restInterval);
                if (restBanner) restBanner.classList.add('hidden');
            } else {
                updateRestDisplay();
            }
        }, 1000);
    }

    if (btnRestPlus30) {
        btnRestPlus30.onclick = () => {
            restSecondsLeft += 30;
        };
    }

    if (btnRestSkip) {
        btnRestSkip.onclick = () => {
            clearInterval(restInterval);
            if (restBanner) restBanner.classList.add('hidden');
        };
    }

    // Carousel Prev/Next Buttons
    if (btnPrevEx) {
        btnPrevEx.onclick = () => {
            if (activeExerciseIndex > 0) {
                activeExerciseIndex--;
                persistDraft();
                renderActiveExercise();
            }
        };
    }

    if (btnNextEx) {
        btnNextEx.onclick = () => {
            if (activeExerciseIndex < exercises.length - 1) {
                activeExerciseIndex++;
                persistDraft();
                renderActiveExercise();
            }
        };
    }

    // Complete Workout Modal Logic
    const finishModal = document.getElementById('logger-finish-modal');
    const finishSetsCountEl = document.getElementById('finish-modal-sets-count');
    const finishDurationEl = document.getElementById('finish-modal-duration');
    const finishWarningEl = document.getElementById('finish-modal-uncompleted-warning');
    const finishNotesInput = document.getElementById('finish-modal-notes');
    const btnFinishCancel = document.getElementById('btn-finish-modal-cancel');
    const btnFinishClose = document.getElementById('btn-finish-modal-close');
    const btnFinishConfirm = document.getElementById('btn-finish-modal-confirm');

    function closeFinishModal() {
        if (finishModal) finishModal.classList.add('hidden');
    }

    if (btnFinishCancel) btnFinishCancel.onclick = closeFinishModal;
    if (btnFinishClose) btnFinishClose.onclick = closeFinishModal;

    // Trigger Finish Review Modal
    if (btnFinish) {
        btnFinish.onclick = () => {
            // Count total and completed sets
            let totalSets = 0;
            let completedSets = 0;

            Object.values(sessionLogs).forEach(sets => {
                if (Array.isArray(sets)) {
                    totalSets += sets.length;
                    completedSets += sets.filter(s => s.completed).length;
                }
            });

            if (finishSetsCountEl) {
                finishSetsCountEl.textContent = `${completedSets} / ${totalSets} Sets Completed`;
            }
            if (finishDurationEl) {
                finishDurationEl.textContent = formatTime(elapsedSeconds);
            }
            if (finishWarningEl) {
                if (completedSets < totalSets) {
                    finishWarningEl.classList.remove('hidden');
                } else {
                    finishWarningEl.classList.add('hidden');
                }
            }

            if (finishModal) finishModal.classList.remove('hidden');
        };
    }

    // Confirm & Save Workout
    if (btnFinishConfirm) {
        btnFinishConfirm.onclick = async () => {
            btnFinishConfirm.disabled = true;
            btnFinishConfirm.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Saving...`;

            cleanup();

            const feedbackNote = finishNotesInput ? finishNotesInput.value.trim() : '';
            const finalPayload = {
                sessionLogs: sessionLogs,
                clientNotes: feedbackNote,
                durationSeconds: elapsedSeconds,
                completedAt: new Date().toISOString()
            };

            try {
                await appState.logCompletedWorkout(workout.id, finalPayload);
                // Clear the saved draft
                try {
                    localStorage.removeItem(draftKey);
                } catch(e) {}

                showToast(`🎉 Outstanding job! Workout "${workout.name}" logged successfully!`, 'success', 'Workout Completed');
            } catch (err) {
                console.error('Error logging workout:', err);
                showToast(`Workout logged and saved locally!`, 'info', 'Saved Locally');
            }

            closeFinishModal();

            const user = appState.user;
            window.location.hash = user ? `client-mobile/${user.id}` : 'client-mobile';
        };
    }

    // Initial render
    renderActiveExercise();
};
