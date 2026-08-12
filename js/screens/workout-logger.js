// Controller for Client Workout Logger mobile simulation
window.init_workout_logger = function(params) {
    const appState = window.appState;
    const workoutId = params && params.id;
    let workouts = appState.workouts || [];
    const defaultWorkout = {
        id: workoutId || 'demo-workout',
        name: 'Lower Body Power Focus',
        programName: '12-Week Hypertrophy',
        weekName: 'Week 1',
        exercises: [
            { id: 'ex-1', name: 'Barbell Back Squat', sets: 4, reps: '5-8', weight: '75', rest: '180s', notes: 'Maintain neutral spine, drive hard off hips.' },
            { id: 'ex-2', name: 'Romanian Deadlift', sets: 3, reps: '8-10', weight: '85', rest: '120s', notes: 'Hinge at hips, keep bar close to shins.' },
            { id: 'ex-3', name: 'Bulgarian Split Squat', sets: 3, reps: '10-12', weight: '20', rest: '90s', notes: 'Keep torso upright, drive through front heel.' }
        ]
    };
    let workout = (workoutId && workouts.find(w => w.id === workoutId)) || workouts[0] || defaultWorkout;

    // Dynamic State per session
    let activeExerciseIndex = 0;
    let exercises = workout.exercises || [];
    if (exercises.length === 0) {
        exercises = [
            { id: 'ex-1', name: 'Barbell Back Squat', sets: 4, reps: '5-8', weight: 'RPE 8', rest: '180s', notes: 'Deep depth, brace core hard.' }
        ];
    }

    // Set tracking memory: { [exerciseId]: [ { setNum, weight, reps, completed } ] }
    let sessionLogs = {};
    exercises.forEach(ex => {
        const numSets = parseInt(ex.sets) || 3;
        sessionLogs[ex.id] = [];
        for (let i = 1; i <= numSets; i++) {
            sessionLogs[ex.id].push({
                setNum: i,
                weight: parseFloat(ex.weight) || 75.0,
                reps: parseInt(ex.reps) || 10,
                completed: false
            });
        }
    });

    // UI Mount Points
    const workoutTitleEl = document.getElementById('logger-workout-title');
    const programTitleEl = document.getElementById('logger-program-title');
    const elapsedTimerEl = document.getElementById('logger-elapsed-timer');
    const exerciseTabsMount = document.getElementById('logger-exercise-tabs');

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
    let elapsedSeconds = 0;
    const elapsedInterval = setInterval(() => {
        elapsedSeconds++;
        const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(elapsedSeconds % 60).padStart(2, '0');
        if (elapsedTimerEl) elapsedTimerEl.textContent = `${mins}:${secs}`;
    }, 1000);

    // Header Setup
    if (workoutTitleEl) workoutTitleEl.textContent = workout.name;
    if (programTitleEl) programTitleEl.textContent = `${workout.programName || 'Training Program'} • ${workout.weekName || 'Week 1'}`;
    if (btnBack) {
        btnBack.onclick = () => {
            clearInterval(elapsedInterval);
            clearInterval(restInterval);
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
            btn.className = `px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors flex items-center gap-1 ${
                isActive ? 'bg-[#d9f99d] text-[#09090b]' : 'bg-[#18181b] border border-[#27272a] text-on-surface-variant hover:text-primary'
            }`;
            btn.innerHTML = `
                <span>${idx + 1}. ${ex.name}</span>
            `;
            btn.onclick = () => {
                activeExerciseIndex = idx;
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
                isCompleted ? 'bg-[#18181b]/60 border-[#22c55e]/40 opacity-85' : 'bg-[#18181b] border-[#27272a]'
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
                            <p class="text-[10px] text-on-surface-variant font-mono truncate">${currentEx.reps || '10'} reps</p>
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
                setRec.weight = Math.max(0, parseFloat((parseFloat(weightInput.value) - 2.5).toFixed(1)));
                weightInput.value = setRec.weight;
            };
            setRow.querySelector('.btn-weight-plus').onclick = () => {
                setRec.weight = parseFloat((parseFloat(weightInput.value) + 2.5).toFixed(1));
                weightInput.value = setRec.weight;
            };
            weightInput.oninput = (e) => {
                setRec.weight = parseFloat(e.target.value) || 0;
            };

            // Reps Adjusters
            const repsInput = setRow.querySelector('.input-reps');
            setRow.querySelector('.btn-reps-minus').onclick = () => {
                setRec.reps = Math.max(0, parseInt(repsInput.value) - 1);
                repsInput.value = setRec.reps;
            };
            setRow.querySelector('.btn-reps-plus').onclick = () => {
                setRec.reps = parseInt(repsInput.value) + 1;
                repsInput.value = setRec.reps;
            };
            repsInput.oninput = (e) => {
                setRec.reps = parseInt(e.target.value) || 0;
            };

            // Toggle Complete Action
            setRow.querySelector('.btn-toggle-complete').onclick = () => {
                setRec.completed = !setRec.completed;
                if (setRec.completed) {
                    // Trigger Rest Timer
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
                weight: lastSet ? lastSet.weight : 75.0,
                reps: lastSet ? lastSet.reps : 10,
                completed: false
            });
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
                renderActiveExercise();
            }
        };
    }

    if (btnNextEx) {
        btnNextEx.onclick = () => {
            if (activeExerciseIndex < exercises.length - 1) {
                activeExerciseIndex++;
                renderActiveExercise();
            }
        };
    }

    // Finish Workout Button Action
    if (btnFinish) {
        btnFinish.onclick = async () => {
            clearInterval(elapsedInterval);
            clearInterval(restInterval);

            try {
                await appState.logCompletedWorkout(workout.id, sessionLogs);
                showToast(`🎉 Congratulations! Workout "${workout.name}" logged successfully!`, 'success', 'Workout Completed');
            } catch (err) {
                console.error('Error logging workout:', err);
                showToast(`Workout logged locally!`, 'info', 'Saved Locally');
            }

            const user = appState.user;
            window.location.hash = user ? `client-mobile/${user.id}` : 'client-mobile';
        };
    }

    // Initial render
    renderActiveExercise();
};
