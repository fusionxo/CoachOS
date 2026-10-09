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
            { id: 'ex-1', name: 'Barbell Back Squat', sets: 4, reps: '5-8', weight: '', rest: '180s', notes: 'Maintain neutral spine, drive hard off hips.' },
            { id: 'ex-2', name: 'Romanian Deadlift', sets: 3, reps: '8-10', weight: '', rest: '120s', notes: 'Hinge at hips, keep bar close to shins.' },
            { id: 'ex-3', name: 'Bulgarian Split Squat', sets: 3, reps: '10-12', weight: '', rest: '90s', notes: 'Keep torso upright, drive through front heel.' }
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
                    coachId: program?.coach_id,
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
    let exercises = (workout.exercises && workout.exercises.length > 0) ? [...workout.exercises] : [
        { id: 'ex-1', name: 'Barbell Back Squat', sets: 4, reps: '5-8', weight: '', rest: '180s', notes: 'Deep depth, brace core hard.' }
    ];

    // Default Set tracking memory: No 75kg or 10 reps pre-filled! Empty so client logs real data.
    function createDefaultSessionLogs() {
        const logs = {};
        exercises.forEach(ex => {
            const numSets = parseInt(ex.sets) || 3;
            logs[ex.id] = [];
            for (let i = 1; i <= numSets; i++) {
                logs[ex.id].push({
                    setNum: i,
                    weight: '',
                    reps: '',
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
            const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
            const now = Date.now();
            const startTime = draft.startedAt || draft.updatedAt || 0;

            // Check if draft has at least 1 set entered with data or completed
            let hasLoggedSet = false;
            const dLogs = draft.sessionLogs || {};
            for (const exId of Object.keys(dLogs)) {
                if (Array.isArray(dLogs[exId])) {
                    for (const s of dLogs[exId]) {
                        if (s && (s.completed || (s.weight !== '' && s.weight !== null && parseFloat(s.weight) > 0) || (s.reps !== '' && s.reps !== null && parseInt(s.reps) > 0))) {
                            hasLoggedSet = true;
                            break;
                        }
                    }
                }
                if (hasLoggedSet) break;
            }

            if (startTime > 0 && (now - startTime) >= FOUR_HOURS_MS && hasLoggedSet) {
                // Auto-complete and log the workout because 4+ hours have passed!
                console.log(`Auto-finalizing workout ${workout.name} as 4+ hours have elapsed.`);
                await appState.logCompletedWorkout(workout.id, {
                    sessionLogs: draft.sessionLogs,
                    exercises: draft.exercises || exercises,
                    durationSeconds: draft.elapsedSeconds || 3600,
                    completedAt: new Date(draft.updatedAt || draft.startedAt || now).toISOString(),
                    clientNotes: 'Auto-completed (exceeded 4 hours without manual completion)'
                });
                localStorage.removeItem(draftKey);
                showToast(`Previous workout "${workout.name}" was automatically logged after 4 hours!`, 'success', 'Workout Auto-Logged');
                const user = appState.user;
                window.location.hash = user ? `client-mobile/${user.id}` : 'client-mobile';
                return;
            }

            if (draft && draft.sessionLogs && Object.keys(draft.sessionLogs).length > 0) {
                sessionLogs = draft.sessionLogs;
                if (Array.isArray(draft.exercises) && draft.exercises.length > 0) {
                    exercises = draft.exercises;
                }
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
            let existingStartedAt = Date.now();
            const existingRaw = localStorage.getItem(draftKey);
            if (existingRaw) {
                try {
                    const parsed = JSON.parse(existingRaw);
                    if (parsed.startedAt) existingStartedAt = parsed.startedAt;
                } catch(e) {}
            }

            localStorage.setItem(draftKey, JSON.stringify({
                workoutId: workout.id,
                workoutName: workout.name,
                programName: workout.programName,
                weekName: workout.weekName,
                clientId: workout.clientId,
                coachId: workout.coachId,
                activeExerciseIndex,
                exercises,
                sessionLogs,
                elapsedSeconds,
                startedAt: existingStartedAt,
                updatedAt: Date.now()
            }));
        } catch(e) {}
    }

    // Fetch client past session logs for Mike Israetel / RP Hypertrophy comparison
    let pastSessionLogs = [];
    const clientTargetId = workout.clientId || (appState.user?.role === 'client' ? (appState.client?.id || appState.user?.id) : null);

    if (window.supabaseClient && clientTargetId) {
        try {
            const { data: dbLogs } = await window.supabaseClient
                .from('workout_session_logs')
                .select('*')
                .eq('client_id', clientTargetId)
                .order('completed_at', { ascending: false });
            if (dbLogs && dbLogs.length > 0) {
                pastSessionLogs = dbLogs;
            }
        } catch(e) {
            console.warn('Could not fetch past workout_session_logs:', e);
        }
    }

    // Also include any in-memory workouts or local storage completed workouts with session logs
    (appState.workouts || []).forEach(w => {
        if (w.status === 'Completed' && w.sessionLogs && Object.keys(w.sessionLogs).length > 0) {
            if (!pastSessionLogs.some(p => p.workout_id === w.id || p.id === w.id)) {
                pastSessionLogs.push({
                    workout_id: w.id,
                    workout_name: w.name,
                    program_name: w.programName,
                    week_name: w.weekName,
                    exercises: w.exercises || [],
                    session_logs: w.sessionLogs,
                    completed_at: w.loggedAt || new Date().toISOString()
                });
            }
        }
    });

    // Sort newest first
    pastSessionLogs.sort((a,b) => new Date(b.completed_at) - new Date(a.completed_at));

    // Helper to find previous performance on an exercise (matching by name or id)
    function getPreviousExercisePerformance(exercise) {
        if (!exercise || !exercise.name) return null;
        const targetName = exercise.name.toLowerCase().trim();

        for (const ps of pastSessionLogs) {
            // Skip comparing against current uncompleted session
            if (ps.workout_id === workout.id && workout.status !== 'Completed') continue;

            const psLogs = ps.session_logs || {};
            // 1. Check if exercise ID matches directly
            if (psLogs[exercise.id] && Array.isArray(psLogs[exercise.id])) {
                const validSets = psLogs[exercise.id].filter(s => s && (parseFloat(s.weight) > 0 || parseInt(s.reps) > 0));
                if (validSets.length > 0) {
                    return {
                        workoutName: ps.workout_name,
                        programName: ps.program_name,
                        completedAt: ps.completed_at,
                        sets: validSets
                    };
                }
            }

            // 2. Check if any exercise in ps.exercises has matching name
            if (Array.isArray(ps.exercises)) {
                const matchedEx = ps.exercises.find(e => e.name && e.name.toLowerCase().trim() === targetName);
                if (matchedEx && psLogs[matchedEx.id] && Array.isArray(psLogs[matchedEx.id])) {
                    const validSets = psLogs[matchedEx.id].filter(s => s && (parseFloat(s.weight) > 0 || parseInt(s.reps) > 0));
                    if (validSets.length > 0) {
                        return {
                            workoutName: ps.workout_name,
                            programName: ps.program_name,
                            completedAt: ps.completed_at,
                            sets: validSets
                        };
                    }
                }
            }

            // 3. Check keys of session_logs if name was stored as key
            for (const key of Object.keys(psLogs)) {
                if (key.toLowerCase().trim() === targetName && Array.isArray(psLogs[key])) {
                    const validSets = psLogs[key].filter(s => s && (parseFloat(s.weight) > 0 || parseInt(s.reps) > 0));
                    if (validSets.length > 0) {
                        return {
                            workoutName: ps.workout_name,
                            programName: ps.program_name,
                            completedAt: ps.completed_at,
                            sets: validSets
                        };
                    }
                }
            }
        }

        return null;
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

    // Exercise Toolbar Buttons
    const btnAddExercise = document.getElementById('btn-logger-add-exercise');
    const btnRemoveExercise = document.getElementById('btn-logger-remove-exercise');

    // Previous Session Card Mounts
    const prevSessionCard = document.getElementById('logger-prev-session-card');
    const prevSessionTitle = document.getElementById('logger-prev-session-title');
    const prevSessionDate = document.getElementById('logger-prev-session-date');
    const prevSessionSets = document.getElementById('logger-prev-session-sets');
    const prevSessionTargetHint = document.getElementById('logger-prev-session-target-hint');

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
            exercises = (workout.exercises && workout.exercises.length > 0) ? [...workout.exercises] : [
                { id: 'ex-1', name: 'Barbell Back Squat', sets: 4, reps: '5-8', weight: '', rest: '180s', notes: 'Deep depth, brace core hard.' }
            ];
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
        if (activeExerciseIndex >= exercises.length) {
            activeExerciseIndex = Math.max(0, exercises.length - 1);
        }

        renderExerciseTabs();

        const currentEx = exercises[activeExerciseIndex];
        if (!currentEx) return;

        if (exCounterEl) exCounterEl.textContent = `Exercise ${activeExerciseIndex + 1} of ${exercises.length}`;
        if (exNameEl) exNameEl.textContent = currentEx.name;
        if (exTargetBadge) exTargetBadge.textContent = `${currentEx.sets || 3} Sets • ${currentEx.reps || '8-10'} Reps`;
        if (exLoadEl) exLoadEl.textContent = currentEx.weight || 'RPE 8';
        if (exRestEl) exRestEl.textContent = currentEx.rest || '90s';

        if (currentEx.notes) {
            if (exNotesContainer) exNotesContainer.classList.remove('hidden');
            if (exNotesEl) exNotesEl.textContent = currentEx.notes;
        } else {
            if (exNotesContainer) exNotesContainer.classList.add('hidden');
        }

        // Fetch previous performance on this exercise (Mike Israetel / RP Hypertrophy style)
        const prevPerf = getPreviousExercisePerformance(currentEx);
        if (prevSessionCard) {
            if (prevPerf && prevPerf.sets && prevPerf.sets.length > 0) {
                prevSessionCard.classList.remove('hidden');
                
                // Format relative or calendar date
                let dateLabel = 'Last Session';
                try {
                    const d = new Date(prevPerf.completedAt);
                    const now = new Date();
                    const diffDays = Math.round((now - d) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 1) dateLabel = 'Yesterday';
                    else if (diffDays < 7) dateLabel = `${diffDays} days ago`;
                    else dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch(e) {}

                if (prevSessionTitle) prevSessionTitle.textContent = `PREVIOUS SESSION PERFORMANCE`;
                if (prevSessionDate) prevSessionDate.textContent = `${dateLabel} (${prevPerf.workoutName || 'Previous Workout'})`;

                if (prevSessionSets) {
                    prevSessionSets.innerHTML = prevPerf.sets.map((s, idx) => {
                        const setWeight = s.weight !== undefined && s.weight !== null && s.weight !== '' ? `${s.weight}kg` : 'BW';
                        const setReps = s.reps !== undefined && s.reps !== null && s.reps !== '' ? `${s.reps} reps` : '—';
                        return `
                            <span class="bg-[#09090b] border border-[#27272a] px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                                <span class="text-on-surface-variant font-bold text-[10px]">Set ${s.setNum || idx + 1}:</span>
                                <strong class="text-primary">${setWeight}</strong>
                                <span class="text-on-surface-variant text-[10px]">×</span>
                                <strong class="text-[#d9f99d]">${setReps}</strong>
                            </span>
                        `;
                    }).join('');
                }

                // Progressive Overload Recommendation
                if (prevSessionTargetHint) {
                    const firstSet = prevPerf.sets[0];
                    if (firstSet && firstSet.weight && firstSet.reps) {
                        const targetReps = parseInt(firstSet.reps) + 1;
                        prevSessionTargetHint.textContent = `RP Target: Beat ${firstSet.weight}kg × ${firstSet.reps} reps with ${targetReps} reps, or add +1-2.5kg!`;
                    } else {
                        prevSessionTargetHint.textContent = `Target: Beat previous session volume for progressive overload!`;
                    }
                }
            } else {
                prevSessionCard.classList.add('hidden');
            }
        }

        renderSetsTable(currentEx, prevPerf);
    }

    // Render Sets Table for Exercise
    function renderSetsTable(currentEx, prevPerf) {
        if (!setsListMount) return;
        setsListMount.innerHTML = '';

        if (!sessionLogs[currentEx.id]) {
            sessionLogs[currentEx.id] = [];
            const numSets = parseInt(currentEx.sets) || 3;
            for (let i = 1; i <= numSets; i++) {
                sessionLogs[currentEx.id].push({
                    setNum: i,
                    weight: '',
                    reps: '',
                    completed: false
                });
            }
        }

        const setRecords = sessionLogs[currentEx.id] || [];
        const completedCount = setRecords.filter(s => s.completed).length;

        if (setsSummaryEl) {
            setsSummaryEl.textContent = `${completedCount} / ${setRecords.length} Sets Completed`;
        }

        if (setRecords.length === 0) {
            setsListMount.innerHTML = `
                <div class="p-4 text-center text-xs text-on-surface-variant italic bg-[#09090b] border border-dashed border-[#27272a] rounded-xl">
                    All sets removed. Tap "Add Extra Set" below to add a set.
                </div>
            `;
            return;
        }

        setRecords.forEach((setRec, idx) => {
            const setRow = document.createElement('div');
            const isCompleted = setRec.completed;
            const prevSet = (prevPerf && prevPerf.sets && prevPerf.sets[idx]) ? prevPerf.sets[idx] : null;

            setRow.className = `p-2.5 sm:p-3 rounded-xl border transition-all ${
                isCompleted ? 'bg-[#18181b]/60 border-[#22c55e]/40 opacity-90' : 'bg-[#18181b] border-[#27272a]'
            }`;

            // Clean weight and reps values (empty string if blank, no 75kg default!)
            const weightVal = (setRec.weight !== '' && setRec.weight !== null && setRec.weight !== undefined) ? setRec.weight : '';
            const repsVal = (setRec.reps !== '' && setRec.reps !== null && setRec.reps !== undefined) ? setRec.reps : '';

            setRow.innerHTML = `
                <div class="grid grid-cols-12 gap-1.5 sm:gap-2 items-center w-full min-w-0">
                    <!-- Col 1-4: Set info + Previous Session Hint -->
                    <div class="col-span-4 flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-stat-mono text-xs font-bold shrink-0 ${
                            isCompleted ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#27272a] text-primary'
                        }">${setRec.setNum}</span>
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-primary truncate">Set ${setRec.setNum}</p>
                            ${prevSet ? `
                                <div class="flex items-center gap-1 truncate" title="Last session: ${prevSet.weight}kg × ${prevSet.reps} reps">
                                    <span class="text-[9px] text-[#ceee93] font-mono font-bold bg-[#ceee93]/10 px-1 py-0.2 rounded border border-[#ceee93]/20">
                                        Prev: ${prevSet.weight}k×${prevSet.reps}
                                    </span>
                                </div>
                            ` : `
                                <p class="text-[10px] text-on-surface-variant font-mono truncate">${currentEx.reps || '10'} reps target</p>
                            `}
                        </div>
                    </div>

                    <!-- Col 5-7: Weight input (Blank by default, no 75kg placeholder) -->
                    <div class="col-span-3 flex items-center gap-0.5 bg-[#09090b] border border-[#27272a] rounded-lg p-1 min-w-0">
                        <button class="w-5 h-5 rounded bg-[#18181b] text-on-surface hover:text-primary flex items-center justify-center font-bold text-xs shrink-0 btn-weight-minus">-</button>
                        <input type="number" step="0.5" class="w-full min-w-0 bg-transparent border-none text-center font-mono text-xs font-bold text-primary p-0 focus:ring-0 input-weight" placeholder="—" value="${weightVal}">
                        <span class="text-[9px] text-on-surface-variant font-mono pr-0.5 shrink-0 hidden sm:inline">kg</span>
                        <button class="w-5 h-5 rounded bg-[#18181b] text-on-surface hover:text-primary flex items-center justify-center font-bold text-xs shrink-0 btn-weight-plus">+</button>
                    </div>

                    <!-- Col 8-10: Reps input (Blank by default) -->
                    <div class="col-span-3 flex items-center gap-0.5 bg-[#09090b] border border-[#27272a] rounded-lg p-1 min-w-0">
                        <button class="w-5 h-5 rounded bg-[#18181b] text-on-surface hover:text-primary flex items-center justify-center font-bold text-xs shrink-0 btn-reps-minus">-</button>
                        <input type="number" class="w-full min-w-0 bg-transparent border-none text-center font-mono text-xs font-bold text-primary p-0 focus:ring-0 input-reps" placeholder="—" value="${repsVal}">
                        <span class="text-[9px] text-on-surface-variant font-mono pr-0.5 shrink-0 hidden sm:inline">reps</span>
                        <button class="w-5 h-5 rounded bg-[#18181b] text-on-surface hover:text-primary flex items-center justify-center font-bold text-xs shrink-0 btn-reps-plus">+</button>
                    </div>

                    <!-- Col 11-12: Actions (Complete Toggle + Delete Set) -->
                    <div class="col-span-2 flex items-center justify-end gap-1">
                        <button class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                            isCompleted ? 'bg-[#22c55e] text-[#09090b] shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'bg-[#27272a] text-on-surface-variant hover:text-primary'
                        } btn-toggle-complete" title="${isCompleted ? 'Mark as incomplete' : 'Complete set'}">
                            <span class="material-symbols-outlined text-[16px] sm:text-[18px]">${isCompleted ? 'check_circle' : 'radio_button_unchecked'}</span>
                        </button>
                        <button class="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-colors btn-remove-set shrink-0" title="Remove this set">
                            <span class="material-symbols-outlined text-[15px]">close</span>
                        </button>
                    </div>
                </div>
            `;

            // Weight Adjusters
            const weightInput = setRow.querySelector('.input-weight');
            setRow.querySelector('.btn-weight-minus').onclick = () => {
                let current = parseFloat(weightInput.value);
                if (isNaN(current)) current = 0;
                else current = Math.max(0, parseFloat((current - 2.5).toFixed(1)));
                setRec.weight = current === 0 ? '' : current;
                weightInput.value = setRec.weight;
                persistDraft();
            };
            setRow.querySelector('.btn-weight-plus').onclick = () => {
                let current = parseFloat(weightInput.value);
                if (isNaN(current)) current = 2.5;
                else current = parseFloat((current + 2.5).toFixed(1));
                setRec.weight = current;
                weightInput.value = setRec.weight;
                persistDraft();
            };
            weightInput.oninput = (e) => {
                const val = e.target.value.trim();
                setRec.weight = val === '' ? '' : parseFloat(val);
                persistDraft();
            };

            // Reps Adjusters
            const repsInput = setRow.querySelector('.input-reps');
            setRow.querySelector('.btn-reps-minus').onclick = () => {
                let current = parseInt(repsInput.value);
                if (isNaN(current)) current = 0;
                else current = Math.max(0, current - 1);
                setRec.reps = current === 0 ? '' : current;
                repsInput.value = setRec.reps;
                persistDraft();
            };
            setRow.querySelector('.btn-reps-plus').onclick = () => {
                let current = parseInt(repsInput.value);
                if (isNaN(current)) current = 1;
                else current = current + 1;
                setRec.reps = current;
                repsInput.value = setRec.reps;
                persistDraft();
            };
            repsInput.oninput = (e) => {
                const val = e.target.value.trim();
                setRec.reps = val === '' ? '' : parseInt(val);
                persistDraft();
            };

            // Toggle Complete Action
            setRow.querySelector('.btn-toggle-complete').onclick = () => {
                setRec.completed = !setRec.completed;
                // If marked complete with empty inputs, ensure values are recorded
                if (setRec.completed) {
                    if (setRec.weight === '') setRec.weight = parseFloat(weightInput.value) || 0;
                    if (setRec.reps === '') setRec.reps = parseInt(repsInput.value) || 0;
                    const parsedRest = parseInt(currentEx.rest) || 90;
                    startRestTimer(parsedRest);
                }
                persistDraft();
                renderActiveExercise();
            };

            // Remove Set Action
            setRow.querySelector('.btn-remove-set').onclick = () => {
                setRecords.splice(idx, 1);
                // Re-number remaining sets
                setRecords.forEach((s, i) => {
                    s.setNum = i + 1;
                });
                persistDraft();
                renderActiveExercise();
                showToast(`Set ${setRec.setNum} removed`, 'info');
            };

            setsListMount.appendChild(setRow);
        });
    }

    // Add Extra Set Button (No 75kg default!)
    if (btnAddSet) {
        btnAddSet.onclick = () => {
            const currentEx = exercises[activeExerciseIndex];
            if (!currentEx) return;
            const setRecords = sessionLogs[currentEx.id] || [];
            const lastSet = setRecords[setRecords.length - 1];
            setRecords.push({
                setNum: setRecords.length + 1,
                weight: lastSet ? (lastSet.weight || '') : '',
                reps: lastSet ? (lastSet.reps || '') : '',
                completed: false
            });
            persistDraft();
            renderActiveExercise();
        };
    }

    // Remove Movement / Exercise Action (Short on time / client leaving gym)
    if (btnRemoveExercise) {
        btnRemoveExercise.onclick = async () => {
            const currentEx = exercises[activeExerciseIndex];
            if (!currentEx) return;

            if (exercises.length <= 1) {
                showToast('Cannot remove the only exercise. You can finish and log workout now.', 'info', 'Workout Session');
                return;
            }

            const confirmed = await (window.showConfirm 
                ? showConfirm(`Remove "${currentEx.name}" from today's workout? You can log your remaining exercises now.`, 'Remove Exercise', 'Remove', 'Keep')
                : Promise.resolve(confirm(`Remove "${currentEx.name}" from today's workout?`)));

            if (confirmed) {
                exercises.splice(activeExerciseIndex, 1);
                delete sessionLogs[currentEx.id];

                if (activeExerciseIndex >= exercises.length) {
                    activeExerciseIndex = Math.max(0, exercises.length - 1);
                }

                persistDraft();
                renderActiveExercise();
                showToast(`Removed "${currentEx.name}" from session`, 'info', 'Exercise Removed');
            }
        };
    }

    // Add Exercise Modal Handlers
    const addExModal = document.getElementById('logger-add-ex-modal');
    const btnCloseAddEx = document.getElementById('btn-close-add-ex-modal');
    const btnCancelAddEx = document.getElementById('btn-cancel-add-ex-modal');
    const btnConfirmAddEx = document.getElementById('btn-confirm-add-ex-modal');
    const addExNameInput = document.getElementById('add-ex-name-input');
    const addExSetsInput = document.getElementById('add-ex-sets-input');
    const addExRepsInput = document.getElementById('add-ex-reps-input');
    const addExLoadInput = document.getElementById('add-ex-load-input');
    const addExRestInput = document.getElementById('add-ex-rest-input');

    function openAddExerciseModal() {
        if (!addExModal) return;
        if (addExNameInput) addExNameInput.value = '';
        if (addExSetsInput) addExSetsInput.value = '3';
        if (addExRepsInput) addExRepsInput.value = '10';
        if (addExLoadInput) addExLoadInput.value = '';
        if (addExRestInput) addExRestInput.value = '90s';
        addExModal.classList.remove('hidden');
        if (addExNameInput) addExNameInput.focus();
    }

    function closeAddExerciseModal() {
        if (addExModal) addExModal.classList.add('hidden');
    }

    if (btnAddExercise) btnAddExercise.onclick = openAddExerciseModal;
    if (btnCloseAddEx) btnCloseAddEx.onclick = closeAddExerciseModal;
    if (btnCancelAddEx) btnCancelAddEx.onclick = closeAddExerciseModal;

    if (btnConfirmAddEx) {
        btnConfirmAddEx.onclick = () => {
            const exName = addExNameInput ? addExNameInput.value.trim() : '';
            if (!exName) {
                showToast('Please enter an exercise name', 'error', 'Name Required');
                return;
            }

            const numSets = parseInt(addExSetsInput ? addExSetsInput.value : '3') || 3;
            const targetReps = (addExRepsInput ? addExRepsInput.value.trim() : '') || '10';
            const targetLoad = addExLoadInput ? addExLoadInput.value.trim() : '';
            const restPeriod = (addExRestInput ? addExRestInput.value.trim() : '') || '90s';

            const newExId = `cust-ex-${Date.now()}`;
            const newEx = {
                id: newExId,
                name: exName,
                sets: numSets,
                reps: targetReps,
                weight: targetLoad,
                rest: restPeriod,
                notes: 'Custom exercise added to session',
                order: exercises.length + 1
            };

            exercises.push(newEx);
            sessionLogs[newExId] = [];
            for (let i = 1; i <= numSets; i++) {
                sessionLogs[newExId].push({
                    setNum: i,
                    weight: '',
                    reps: '',
                    completed: false
                });
            }

            activeExerciseIndex = exercises.length - 1;
            persistDraft();
            closeAddExerciseModal();
            renderActiveExercise();
            showToast(`Added "${newEx.name}" to session`, 'success', 'Movement Added');
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
            let totalSets = 0;
            let completedSets = 0;

            exercises.forEach(ex => {
                const sets = sessionLogs[ex.id] || [];
                totalSets += sets.length;
                completedSets += sets.filter(s => s.completed).length;
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

            // Clean session logs: ensure values are normalized
            const cleanedLogs = {};
            exercises.forEach(ex => {
                const sets = sessionLogs[ex.id] || [];
                cleanedLogs[ex.id] = sets.map(s => ({
                    setNum: s.setNum,
                    weight: (s.weight !== '' && s.weight !== null && s.weight !== undefined) ? parseFloat(s.weight) : 0,
                    reps: (s.reps !== '' && s.reps !== null && s.reps !== undefined) ? parseInt(s.reps) : 0,
                    completed: s.completed
                }));
            });

            const finalPayload = {
                sessionLogs: cleanedLogs,
                exercises: exercises,
                clientNotes: feedbackNote,
                durationSeconds: elapsedSeconds,
                completedAt: new Date().toISOString()
            };

            try {
                await appState.logCompletedWorkout(workout.id, finalPayload);
                try {
                    localStorage.removeItem(draftKey);
                } catch(e) {}

                showToast(`🎉 Great workout! "${workout.name}" logged successfully!`, 'success', 'Session Logged');
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
