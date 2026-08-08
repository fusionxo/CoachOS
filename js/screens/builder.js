// Controller for Coach Workout Builder screen
window.init_builder = function(params) {
    const appState = window.appState;
    let workouts = appState.workouts || [];
    let clients = appState.clients || [];
    let templates = appState.templates || [];

    let currentWorkoutId = params ? params.id : null;
    let currentWorkout = workouts.find(w => w.id === currentWorkoutId);

    const mainContent = document.getElementById('builder-main-content');
    const emptyState = document.getElementById('builder-empty-state');
    const createFirstBtn = document.getElementById('btn-builder-create-first');

    // Handle Empty State when no workouts exist at all
    if (!currentWorkout && workouts.length === 0) {
        if (mainContent) mainContent.classList.add('hidden');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
        }
        if (createFirstBtn) {
            createFirstBtn.onclick = async () => {
                const defaultClient = clients[0];
                const clientId = defaultClient ? defaultClient.id : 'sandbox-client';
                try {
                    const newW = await appState.addWorkout(clientId, {
                        name: 'Lower Body Power Focus',
                        notes: 'Focus on explosive concentric drive and full depth on squats.',
                        programName: '12-Week Hypertrophy',
                        weekName: 'Week 1',
                        exercises: [
                            { id: 'e-' + Math.random().toString(36).substr(2, 9), name: 'Barbell Back Squat', sets: 4, reps: '5-8', weight: 'RPE 8', rest: '180s', tempo: '3-0-1', notes: 'Deep depth, brace core hard.', order: 1 },
                            { id: 'e-' + Math.random().toString(36).substr(2, 9), name: 'Romanian Deadlift', sets: 3, reps: '8-10', weight: '70% 1RM', rest: '120s', tempo: '2-1-1', notes: 'Maintain neutral spine throughout.', order: 2 }
                        ]
                    });
                    
                    if (emptyState) {
                        emptyState.classList.add('hidden');
                        emptyState.classList.remove('flex');
                    }
                    if (mainContent) mainContent.classList.remove('hidden');
                    
                    if (newW && newW.id) {
                        window.location.hash = `builder/${newW.id}`;
                    } else {
                        window.location.hash = 'builder';
                    }
                } catch (err) {
                    alert(`Failed to create workout: ${err.message}`);
                }
            };
        }
        return;
    } else {
        if (emptyState) {
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
        }
        if (mainContent) mainContent.classList.remove('hidden');

        if (!currentWorkout) {
            currentWorkout = workouts[0];
            currentWorkoutId = currentWorkout.id;
            window.history.replaceState(null, null, `#builder/${currentWorkoutId}`);
        }
    }

    // UI Mount Points
    const clientSelect = document.getElementById('builder-client-select');
    const workoutNameInput = document.getElementById('builder-workout-name');
    const programNameInput = document.getElementById('builder-program-name');
    const weekNameInput = document.getElementById('builder-week-name');
    const globalNotesInput = document.getElementById('builder-global-notes');
    const exerciseListMount = document.getElementById('exercise-list');
    const exerciseCountBadge = document.getElementById('builder-exercise-count-badge');
    const saveStatusText = document.getElementById('builder-save-status');

    // Buttons
    const btnAddExerciseTop = document.getElementById('btn-builder-add-exercise-top');
    const btnImportTemplate = document.getElementById('btn-builder-import-template');
    const btnSaveTemplate = document.querySelector('.btn-save-template');
    const btnAssignClient = document.querySelector('.btn-assign-client');
    const btnSaveWorkout = document.querySelector('.btn-save-workout');

    // Modals
    const assignModal = document.getElementById('builder-assign-modal');
    const assignForm = document.getElementById('builder-assign-form');
    const assignSelect = document.getElementById('builder-assign-select');
    const importModal = document.getElementById('builder-import-modal');
    const importTemplatesList = document.getElementById('builder-import-templates-list');

    // Close helper
    function closeModals() {
        if (assignModal) assignModal.classList.add('hidden');
        if (importModal) importModal.classList.add('hidden');
    }
    document.querySelectorAll('.assign-modal-close').forEach(btn => btn.onclick = closeModals);
    document.querySelectorAll('.import-modal-close').forEach(btn => btn.onclick = closeModals);

    // Populate Client Context Selector
    if (clientSelect) {
        clientSelect.innerHTML = `<option value="sandbox">Global / Sandbox</option>`;
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (currentWorkout.clientId === c.id) opt.selected = true;
            clientSelect.appendChild(opt);
        });

        clientSelect.onchange = (e) => {
            currentWorkout.clientId = e.target.value;
            triggerAutoSave();
        };
    }

    // Header Inputs Sync
    if (workoutNameInput) {
        workoutNameInput.value = currentWorkout.name || '';
        workoutNameInput.oninput = (e) => {
            currentWorkout.name = e.target.value;
            triggerAutoSave();
        };
    }

    if (programNameInput) {
        programNameInput.value = currentWorkout.programName || '12-Week Hypertrophy';
        programNameInput.oninput = (e) => {
            currentWorkout.programName = e.target.value;
            triggerAutoSave();
        };
    }

    if (weekNameInput) {
        weekNameInput.value = currentWorkout.weekName || 'Week 1';
        weekNameInput.oninput = (e) => {
            currentWorkout.weekName = e.target.value;
            triggerAutoSave();
        };
    }

    if (globalNotesInput) {
        globalNotesInput.value = currentWorkout.notes || '';
        globalNotesInput.oninput = (e) => {
            currentWorkout.notes = e.target.value;
            triggerAutoSave();
        };
    }

    // Auto save debounce
    let autoSaveTimer = null;
    function triggerAutoSave() {
        if (saveStatusText) {
            saveStatusText.innerHTML = `<span class="material-symbols-outlined text-yellow-400 text-[18px] animate-spin">progress_activity</span> Saving changes...`;
        }
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
            try {
                if (currentWorkout && currentWorkout.id) {
                    await appState.updateWorkout(currentWorkout.id, {
                        name: currentWorkout.name,
                        notes: currentWorkout.notes,
                        exercises: currentWorkout.exercises
                    });
                }
                if (saveStatusText) {
                    saveStatusText.innerHTML = `<span class="material-symbols-outlined text-primary-container text-[18px]">check_circle</span> Draft Saved`;
                }
            } catch (err) {
                console.error('Auto save error:', err);
                if (saveStatusText) {
                    saveStatusText.innerHTML = `<span class="material-symbols-outlined text-error text-[18px]">error</span> Save error`;
                }
            }
        }, 600);
    }

    // Render Exercise Cards
    function renderExercises() {
        if (!exerciseListMount) return;
        exerciseListMount.innerHTML = '';

        const exercises = (currentWorkout.exercises || []).sort((a, b) => (a.order || 0) - (b.order || 0));

        if (exerciseCountBadge) {
            exerciseCountBadge.textContent = `${exercises.length} Exercise${exercises.length !== 1 ? 's' : ''}`;
        }

        exercises.forEach((ex, idx) => {
            const card = document.createElement('div');
            card.className = 'glass-panel rounded-xl p-0 overflow-hidden flex flex-col md:flex-row group transition-all duration-200 hover:border-outline border border-outline-variant/40';
            card.setAttribute('draggable', 'true');
            card.setAttribute('data-ex-id', ex.id);

            const indexLabel = String.fromCharCode(65 + idx);

            card.innerHTML = `
                <!-- Drag Handle & Visual Identity -->
                <div class="flex md:flex-col items-center justify-between md:justify-center p-3 md:w-14 bg-surface-container-low border-b md:border-b-0 md:border-r border-outline-variant select-none shrink-0">
                    <div class="flex items-center gap-2 md:flex-col">
                        <span class="material-symbols-outlined text-on-surface-variant drag-handle cursor-move hidden md:block text-[18px]">drag_indicator</span>
                        <div class="w-7 h-7 rounded bg-surface-variant flex items-center justify-center font-stat-mono text-xs text-primary border border-outline-variant font-bold">${indexLabel}</div>
                    </div>
                    <div class="flex items-center gap-1 md:hidden">
                        <button class="p-1 text-on-surface-variant btn-mobile-dup" title="Duplicate"><span class="material-symbols-outlined text-xs">content_copy</span></button>
                        <button class="p-1 text-error/80 btn-mobile-del" title="Delete"><span class="material-symbols-outlined text-xs">delete</span></button>
                    </div>
                </div>

                <!-- Main Data Area -->
                <div class="flex-1 p-unit-md flex flex-col gap-3">
                    <div class="flex justify-between items-center gap-2">
                        <input class="data-input border-none bg-transparent p-0 font-headline-md text-base font-bold text-primary w-full max-w-md focus:ring-0 ex-name-input" placeholder="Exercise Name (e.g. Bench Press)" type="text" value="${ex.name || ''}">
                        <div class="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="btn-ghost p-1.5 rounded-lg flex items-center justify-center btn-desktop-dup" title="Duplicate Exercise"><span class="material-symbols-outlined text-[16px]">content_copy</span></button>
                            <button class="btn-ghost p-1.5 rounded-lg flex items-center justify-center text-error hover:bg-error/10 btn-desktop-del" title="Delete Exercise"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                        </div>
                    </div>

                    <!-- Data Grid (Sets, Reps, Weight/RPE, Rest, Tempo) -->
                    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <div class="flex flex-col">
                            <label class="font-label-caps text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider">Sets</label>
                            <input class="data-input rounded-lg px-2.5 py-1.5 text-xs font-stat-mono bg-[#09090b] border border-[#27272a] ex-sets-input" type="number" value="${ex.sets || 3}">
                        </div>
                        <div class="flex flex-col">
                            <label class="font-label-caps text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider">Target Reps</label>
                            <input class="data-input rounded-lg px-2.5 py-1.5 text-xs font-stat-mono bg-[#09090b] border border-[#27272a] ex-reps-input" type="text" value="${ex.reps || '10'}">
                        </div>
                        <div class="flex flex-col">
                            <label class="font-label-caps text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider">Load / RPE</label>
                            <input class="data-input rounded-lg px-2.5 py-1.5 text-xs font-stat-mono bg-[#09090b] border border-[#27272a] ex-weight-input" type="text" value="${ex.weight || 'RPE 8'}">
                        </div>
                        <div class="flex flex-col">
                            <label class="font-label-caps text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider">Rest Timer</label>
                            <input class="data-input rounded-lg px-2.5 py-1.5 text-xs font-stat-mono bg-[#09090b] border border-[#27272a] ex-rest-input" type="text" value="${ex.rest || '90s'}">
                        </div>
                        <div class="flex flex-col col-span-2 sm:col-span-1">
                            <label class="font-label-caps text-[9px] text-on-surface-variant mb-1 uppercase tracking-wider">Tempo</label>
                            <input class="data-input rounded-lg px-2.5 py-1.5 text-xs font-stat-mono bg-[#09090b] border border-[#27272a] ex-tempo-input" placeholder="2-0-2" type="text" value="${ex.tempo || '2-0-2'}">
                        </div>
                    </div>

                    <!-- Coaching Notes -->
                    <div>
                        <input class="data-input w-full rounded-lg px-3 py-1.5 text-xs text-on-surface-variant border-dashed border-[#27272a] focus:border-solid bg-transparent ex-notes-input" placeholder="Add coaching tips & cues (e.g. pause at bottom, explode up)..." type="text" value="${ex.notes || ''}">
                    </div>
                </div>
            `;

            // Input handlers
            card.querySelectorAll('input').forEach(inp => {
                inp.oninput = () => syncExercisesFromDOM();
            });

            // Action triggers
            card.querySelectorAll('.btn-desktop-dup, .btn-mobile-dup').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    duplicateExercise(ex.id);
                };
            });

            card.querySelectorAll('.btn-desktop-del, .btn-mobile-del').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    deleteExercise(ex.id);
                };
            });

            setupDragAndDrop(card);
            exerciseListMount.appendChild(card);
        });

        // Add Exercise Card Button at bottom
        const addBtn = document.createElement('button');
        addBtn.className = 'w-full glass-panel border-dashed border-2 border-outline hover:border-primary/50 text-on-surface-variant hover:text-primary rounded-xl py-4 flex items-center justify-center gap-2 transition-colors mt-2';
        addBtn.innerHTML = `
            <span class="material-symbols-outlined text-[20px]">add_circle</span>
            <span class="font-body-base text-xs font-semibold">Add Exercise Card</span>
        `;
        addBtn.onclick = () => addNewExercise();
        exerciseListMount.appendChild(addBtn);
    }

    function syncExercisesFromDOM() {
        const cards = exerciseListMount.querySelectorAll('div[data-ex-id]');
        const updated = [];
        let count = 1;

        cards.forEach(card => {
            const id = card.getAttribute('data-ex-id');
            const name = card.querySelector('.ex-name-input').value;
            const sets = parseInt(card.querySelector('.ex-sets-input').value) || 3;
            const reps = card.querySelector('.ex-reps-input').value;
            const weight = card.querySelector('.ex-weight-input').value;
            const rest = card.querySelector('.ex-rest-input').value;
            const tempo = card.querySelector('.ex-tempo-input').value;
            const notes = card.querySelector('.ex-notes-input').value;

            updated.push({
                id,
                name,
                sets,
                reps,
                weight,
                rest,
                tempo,
                notes,
                order: count++
            });
        });

        currentWorkout.exercises = updated;
        triggerAutoSave();
    }

    function addNewExercise(exData = null) {
        const newEx = exData || {
            id: 'e-' + Math.random().toString(36).substr(2, 9),
            name: 'New Exercise',
            sets: 3,
            reps: '10',
            weight: 'RPE 8',
            rest: '90s',
            tempo: '2-0-2',
            notes: '',
            order: currentWorkout.exercises.length + 1
        };

        currentWorkout.exercises.push(newEx);
        triggerAutoSave();
        renderExercises();

        // Focus new exercise input
        setTimeout(() => {
            const cards = exerciseListMount.querySelectorAll('div[data-ex-id]');
            if (cards.length > 0) {
                const lastCard = cards[cards.length - 1];
                const input = lastCard.querySelector('.ex-name-input');
                if (input) {
                    input.focus();
                    input.select();
                }
            }
        }, 100);
    }

    if (btnAddExerciseTop) btnAddExerciseTop.onclick = () => addNewExercise();

    function duplicateExercise(exId) {
        const ex = currentWorkout.exercises.find(e => e.id === exId);
        if (!ex) return;

        const copy = {
            ...ex,
            id: 'e-' + Math.random().toString(36).substr(2, 9),
            name: `${ex.name} (Copy)`,
            order: ex.order + 0.5
        };

        currentWorkout.exercises.push(copy);
        currentWorkout.exercises.sort((a, b) => a.order - b.order);
        currentWorkout.exercises.forEach((e, idx) => e.order = idx + 1);

        triggerAutoSave();
        renderExercises();
    }

    function deleteExercise(exId) {
        currentWorkout.exercises = currentWorkout.exercises.filter(e => e.id !== exId);
        currentWorkout.exercises.forEach((e, idx) => e.order = idx + 1);
        triggerAutoSave();
        renderExercises();
    }

    // Drag and drop setup
    let draggedCard = null;
    function setupDragAndDrop(card) {
        card.addEventListener('dragstart', (e) => {
            draggedCard = card;
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('opacity-40');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('opacity-40');
            draggedCard = null;
        });

        card.addEventListener('dragover', (e) => e.preventDefault());

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedCard && draggedCard !== card) {
                const list = exerciseListMount;
                const children = Array.from(list.children).filter(c => c.hasAttribute('data-ex-id'));
                const draggedIdx = children.indexOf(draggedCard);
                const targetIdx = children.indexOf(card);
                
                if (draggedIdx < targetIdx) {
                    list.insertBefore(draggedCard, card.nextSibling);
                } else {
                    list.insertBefore(draggedCard, card);
                }
                
                syncExercisesFromDOM();
                renderExercises();
            }
        });
    }

    // Action bar triggers
    if (btnSaveWorkout) {
        btnSaveWorkout.onclick = () => {
            syncExercisesFromDOM();
            alert(`Workout "${currentWorkout.name}" saved successfully!`);
            const defaultId = clients[0] ? clients[0].id : '';
            window.location.hash = `analytics/${currentWorkout.clientId || defaultId}`;
        };
    }

    if (btnSaveTemplate) {
        btnSaveTemplate.onclick = async () => {
            syncExercisesFromDOM();
            try {
                await appState.saveTemplate({
                    name: currentWorkout.name,
                    notes: currentWorkout.notes,
                    exercises: currentWorkout.exercises.map(e => ({...e, id: 'te-' + Math.random().toString(36).substr(2, 9)}))
                });
                alert(`Workout saved as a reusable Template!`);
                window.location.hash = `templates`;
            } catch (err) {
                alert(`Failed to save template: ${err.message}`);
            }
        };
    }

    if (btnAssignClient) {
        btnAssignClient.onclick = () => {
            syncExercisesFromDOM();
            if (assignSelect) {
                assignSelect.innerHTML = '';
                clients.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = `${c.name} (${c.goal || 'General'})`;
                    assignSelect.appendChild(opt);
                });
            }
            if (assignModal) assignModal.classList.remove('hidden');
        };
    }

    if (assignForm) {
        assignForm.onsubmit = async (e) => {
            e.preventDefault();
            const clientId = assignSelect.value;
            if (clientId) {
                try {
                    await appState.addWorkout(clientId, {
                        name: currentWorkout.name,
                        notes: currentWorkout.notes,
                        programName: currentWorkout.programName,
                        weekName: currentWorkout.weekName,
                        exercises: currentWorkout.exercises.map(e => ({...e, id: 'e-' + Math.random().toString(36).substr(2, 9)}))
                    });
                    closeModals();
                    alert(`Workout successfully assigned to client!`);
                    window.location.hash = `analytics/${clientId}`;
                } catch (err) {
                    alert(`Failed to assign workout: ${err.message}`);
                }
            }
        };
    }

    // Import from Template Logic
    if (btnImportTemplate) {
        btnImportTemplate.onclick = () => {
            if (importTemplatesList) {
                importTemplatesList.innerHTML = '';
                if (templates.length === 0) {
                    importTemplatesList.innerHTML = `<p class="text-xs text-on-surface-variant italic py-4 text-center">No saved templates found. Create one in Templates first!</p>`;
                } else {
                    templates.forEach(t => {
                        const item = document.createElement('div');
                        item.className = 'p-3 bg-[#131418] border border-[#27272a] rounded-xl flex justify-between items-center hover:border-primary-container/60 transition-colors';
                        item.innerHTML = `
                            <div>
                                <h4 class="text-xs font-bold text-primary">${t.name}</h4>
                                <p class="text-[10px] text-on-surface-variant">${t.exercises.length} Exercises • ${t.notes || 'No description'}</p>
                            </div>
                            <button class="px-3 py-1 bg-[#d9f99d] text-[#09090b] text-xs font-bold rounded transition-transform active:scale-95 btn-do-import">Import</button>
                        `;

                        item.querySelector('.btn-do-import').onclick = () => {
                            t.exercises.forEach(e => {
                                addNewExercise({
                                    id: 'e-' + Math.random().toString(36).substr(2, 9),
                                    name: e.name,
                                    sets: e.sets || 3,
                                    reps: e.reps || '10',
                                    weight: e.weight || 'RPE 8',
                                    rest: e.rest || '90s',
                                    tempo: e.tempo || '2-0-2',
                                    notes: e.notes || '',
                                    order: currentWorkout.exercises.length + 1
                                });
                            });
                            closeModals();
                            alert(`Imported ${t.exercises.length} exercises from template "${t.name}"!`);
                        };

                        importTemplatesList.appendChild(item);
                    });
                }
            }
            if (importModal) importModal.classList.remove('hidden');
        };
    }

    // History and Options Menus
    const btnHistory = document.getElementById('btn-builder-history');
    const dropdownHistory = document.getElementById('builder-history-dropdown');
    const historyList = document.getElementById('builder-history-list');

    const btnOptions = document.getElementById('btn-builder-options');
    const dropdownOptions = document.getElementById('builder-options-dropdown');
    const btnOptDuplicate = document.getElementById('btn-opt-duplicate');
    const btnOptDelete = document.getElementById('btn-opt-delete');

    if (btnHistory && dropdownHistory) {
        btnHistory.onclick = (e) => {
            e.stopPropagation();
            if (dropdownOptions) dropdownOptions.classList.add('hidden');
            dropdownHistory.classList.toggle('hidden');
            
            if (historyList) {
                historyList.innerHTML = '';
                const otherWorkouts = appState.workouts.filter(w => w.id !== currentWorkout.id);
                otherWorkouts.forEach(w => {
                    const clientName = clients.find(c => c.id === w.clientId)?.name || 'Sandbox';
                    const btn = document.createElement('button');
                    btn.className = 'w-full text-left px-3 py-2 text-xs text-on-surface hover:bg-[#1f201a] block border-b border-outline-variant/30 last:border-0';
                    btn.innerHTML = `
                        <span class="font-semibold block text-primary truncate">${w.name}</span>
                        <span class="text-[10px] text-on-surface-variant">${clientName} • ${w.programName || 'Custom'}</span>
                    `;
                    btn.onclick = () => {
                        window.location.hash = `builder/${w.id}`;
                        dropdownHistory.classList.add('hidden');
                    };
                    historyList.appendChild(btn);
                });
                if (otherWorkouts.length === 0) {
                    historyList.innerHTML = `<p class="text-xs text-on-surface-variant italic px-3 py-2">No other workouts found.</p>`;
                }
            }
        };
    }

    if (btnOptions && dropdownOptions) {
        btnOptions.onclick = (e) => {
            e.stopPropagation();
            if (dropdownHistory) dropdownHistory.classList.add('hidden');
            dropdownOptions.classList.toggle('hidden');
        };
    }

    if (btnOptDuplicate) {
        btnOptDuplicate.onclick = async () => {
            if (dropdownOptions) dropdownOptions.classList.add('hidden');
            try {
                const newW = await appState.duplicateWorkout(currentWorkout.id);
                alert(`Workout duplicated successfully!`);
                window.location.hash = `builder/${newW.id}`;
            } catch (err) {
                alert(`Failed to duplicate workout: ${err.message}`);
            }
        };
    }

    if (btnOptDelete) {
        btnOptDelete.onclick = async () => {
            if (dropdownOptions) dropdownOptions.classList.add('hidden');
            if (confirm(`Are you sure you want to delete "${currentWorkout.name}"?`)) {
                try {
                    await appState.deleteWorkout(currentWorkout.id);
                    alert(`Workout deleted successfully!`);
                    window.location.hash = 'builder';
                } catch (err) {
                    alert(`Failed to delete workout: ${err.message}`);
                }
            }
        };
    }

    document.addEventListener('click', (e) => {
        if (dropdownHistory && !e.target.closest('#btn-builder-history') && !e.target.closest('#builder-history-dropdown')) {
            dropdownHistory.classList.add('hidden');
        }
        if (dropdownOptions && !e.target.closest('#btn-builder-options') && !e.target.closest('#builder-options-dropdown')) {
            dropdownOptions.classList.add('hidden');
        }
    });

    // Initial Exercises Render
    renderExercises();
};
