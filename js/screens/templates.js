// Controller for Training Templates screen
window.init_templates = function(params) {
    const appState = window.appState;
    let templates = appState.templates || [];
    let clients = appState.clients || [];

    // Mount points
    const gridMount = document.getElementById('templates-grid-mount');
    const emptyState = document.getElementById('templates-empty-state');
    const searchInput = document.getElementById('template-search-input');
    const filterTabs = document.querySelectorAll('.btn-template-filter');

    // Create/Edit Modal
    const templateModal = document.getElementById('template-modal');
    const templateForm = document.getElementById('template-form');
    const modalTitle = document.getElementById('template-modal-title');
    const btnCreateTemplate = document.getElementById('btn-create-template');
    const btnAddExercise = document.getElementById('btn-template-add-ex');
    const exercisesMount = document.getElementById('template-exercises-mount');

    // Preview Modal
    const previewModal = document.getElementById('template-preview-modal');
    const previewTitle = document.getElementById('preview-title');
    const previewCategory = document.getElementById('preview-category');
    const previewNotes = document.getElementById('preview-notes');
    const previewExercisesList = document.getElementById('preview-exercises-list');
    const btnPreviewAssign = document.getElementById('btn-preview-assign');

    // Assign Modal
    const assignModal = document.getElementById('assign-client-modal');
    const assignForm = document.getElementById('assign-client-form');
    const assignSelect = document.getElementById('assign-client-select');

    let activeFilterCategory = 'all';
    let activeSearchQuery = '';
    let previewingTemplate = null;

    // Close helpers
    function closeModals() {
        if (templateModal) templateModal.classList.add('hidden');
        if (previewModal) previewModal.classList.add('hidden');
        if (assignModal) assignModal.classList.add('hidden');
    }

    document.querySelectorAll('.template-modal-close').forEach(btn => btn.onclick = closeModals);
    document.querySelectorAll('.preview-modal-close').forEach(btn => btn.onclick = closeModals);
    document.querySelectorAll('.assign-modal-close').forEach(btn => btn.onclick = closeModals);

    // Filter tab clicks
    filterTabs.forEach(tab => {
        tab.onclick = () => {
            filterTabs.forEach(t => {
                t.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors btn-template-filter';
            });
            tab.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-container text-on-primary-container btn-template-filter';
            activeFilterCategory = tab.getAttribute('data-category') || 'all';
            renderTemplates();
        };
    });

    // Search input handler
    if (searchInput) {
        searchInput.oninput = (e) => {
            activeSearchQuery = e.target.value.toLowerCase().trim();
            renderTemplates();
        };
    }

    // Dynamic Exercise Row in Create/Edit Modal
    function addExerciseRow(exData = {}) {
        const row = document.createElement('div');
        row.className = 'p-3 bg-[#131418] border border-[#27272a] rounded-xl space-y-2.5 relative group-ex-row transition-all hover:border-outline-variant';
        row.innerHTML = `
            <div class="flex justify-between items-center gap-2">
                <div class="flex-1">
                    <label class="block text-[9px] font-label-caps text-on-surface-variant mb-0.5 uppercase tracking-wider">Exercise Name</label>
                    <input type="text" placeholder="e.g. Barbell Bench Press" class="w-full bg-[#0d0e12] border border-[#27272a] focus:border-primary-container focus:ring-1 focus:ring-primary-container rounded-lg px-2.5 py-1.5 text-xs text-on-surface font-semibold ex-name" value="${exData.name || ''}" required>
                </div>
                <div class="pt-4">
                    <button type="button" class="text-error/80 hover:text-error p-1.5 rounded-lg hover:bg-error/10 transition-colors btn-remove-ex" title="Remove Exercise">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 min-w-0">
                <div class="min-w-0">
                    <label class="block text-[9px] font-label-caps text-on-surface-variant mb-0.5 uppercase tracking-wider">Sets</label>
                    <input type="number" placeholder="4" class="w-full min-w-0 bg-[#0d0e12] border border-[#27272a] rounded-lg px-2 py-1 text-center text-xs text-on-surface ex-sets" value="${exData.sets || 4}">
                </div>
                <div class="min-w-0">
                    <label class="block text-[9px] font-label-caps text-on-surface-variant mb-0.5 uppercase tracking-wider">Reps</label>
                    <input type="text" placeholder="8-10" class="w-full min-w-0 bg-[#0d0e12] border border-[#27272a] rounded-lg px-2 py-1 text-center text-xs text-on-surface ex-reps" value="${exData.reps || '8-10'}">
                </div>
                <div class="min-w-0">
                    <label class="block text-[9px] font-label-caps text-on-surface-variant mb-0.5 uppercase tracking-wider">Weight/RPE</label>
                    <input type="text" placeholder="RPE 8" class="w-full min-w-0 bg-[#0d0e12] border border-[#27272a] rounded-lg px-2 py-1 text-center text-xs text-on-surface ex-weight" value="${exData.weight || 'RPE 8'}">
                </div>
                <div class="min-w-0">
                    <label class="block text-[9px] font-label-caps text-on-surface-variant mb-0.5 uppercase tracking-wider">Rest</label>
                    <input type="text" placeholder="90s" class="w-full min-w-0 bg-[#0d0e12] border border-[#27272a] rounded-lg px-2 py-1 text-center text-xs text-on-surface ex-rest" value="${exData.rest || '90s'}">
                </div>
                <div class="col-span-2 sm:col-span-1 min-w-0">
                    <label class="block text-[9px] font-label-caps text-on-surface-variant mb-0.5 uppercase tracking-wider">Tempo</label>
                    <input type="text" placeholder="2-0-2" class="w-full min-w-0 bg-[#0d0e12] border border-[#27272a] rounded-lg px-2 py-1 text-center text-xs text-on-surface ex-tempo" value="${exData.tempo || '2-0-2'}">
                </div>
            </div>
            <div class="min-w-0">
                <label class="block text-[9px] font-label-caps text-on-surface-variant mb-0.5 uppercase tracking-wider">Coaching Notes</label>
                <input type="text" placeholder="Add cues (e.g. pause at chest, drive legs)..." class="w-full min-w-0 bg-[#0d0e12] border border-[#27272a] rounded-lg px-2.5 py-1 text-xs text-on-surface ex-notes" value="${exData.notes || ''}">
            </div>
        `;
        row.querySelector('.btn-remove-ex').onclick = () => row.remove();
        exercisesMount.appendChild(row);
    }

    // Render Templates Grid
    function renderTemplates() {
        if (!gridMount) return;
        gridMount.innerHTML = '';

        let filtered = templates;

        // Apply Category Filter
        if (activeFilterCategory !== 'all') {
            filtered = filtered.filter(t => (t.category || 'hypertrophy').toLowerCase() === activeFilterCategory);
        }

        // Apply Search Filter
        if (activeSearchQuery) {
            filtered = filtered.filter(t => {
                const matchName = t.name.toLowerCase().includes(activeSearchQuery);
                const matchNotes = (t.notes || '').toLowerCase().includes(activeSearchQuery);
                const matchEx = (t.exercises || []).some(e => e.name.toLowerCase().includes(activeSearchQuery));
                return matchName || matchNotes || matchEx;
            });
        }

        if (filtered.length === 0) {
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.classList.add('flex');
            }
            gridMount.classList.add('hidden');
        } else {
            if (emptyState) {
                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');
            }
            gridMount.classList.remove('hidden');

            filtered.forEach(t => {
                const categoryTag = (t.category || 'Hypertrophy').toUpperCase();
                const totalSets = (t.exercises || []).reduce((acc, e) => acc + (parseInt(e.sets) || 0), 0);

                const card = document.createElement('div');
                card.className = 'card-bg border border-base hover:border-outline rounded-xl p-unit-md flex flex-col justify-between transition-all duration-200 hover:shadow-lg group min-w-0';
                
                card.innerHTML = `
                    <div class="min-w-0">
                        <div class="flex justify-between items-start mb-2 gap-2 min-w-0">
                            <div class="min-w-0 flex-1">
                                <span class="bg-[#27272a] text-[#d9f99d] text-[9px] font-bold px-2 py-0.5 rounded tracking-wider uppercase font-label-caps inline-block">${categoryTag}</span>
                                <h3 class="font-body-base text-sm font-bold text-primary truncate mt-1.5">${t.name}</h3>
                            </div>
                            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                                <button class="p-1 text-on-surface-variant hover:text-primary transition-colors btn-duplicate" title="Duplicate"><span class="material-symbols-outlined text-[16px]">content_copy</span></button>
                                <button class="p-1 text-error/80 hover:text-error transition-colors btn-delete" title="Delete"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                            </div>
                        </div>

                        <p class="text-xs text-on-surface-variant mb-3 line-clamp-2">${t.notes || 'No description provided.'}</p>

                        <!-- Stats Row -->
                        <div class="flex items-center gap-3 text-[10px] text-on-surface-variant font-mono mb-3 bg-[#09090b] px-3 py-1.5 rounded-lg border border-[#27272a]">
                            <span>💪 ${t.exercises.length} Exercises</span>
                            <span>⚡ ${totalSets} Total Sets</span>
                        </div>

                        <!-- Exercises Preview -->
                        <div class="space-y-1.5 mb-4 border-t border-outline-variant/30 pt-3 min-w-0">
                            <span class="font-label-caps text-[9px] text-on-surface-variant uppercase tracking-wider block mb-1">ROUTINE BREAKDOWN</span>
                            ${(t.exercises || []).slice(0, 3).map(e => `
                                <div class="flex justify-between items-center gap-2 text-xs text-on-surface min-w-0">
                                    <span class="truncate flex-1 min-w-0">• ${e.name}</span>
                                    <span class="font-stat-mono text-[10px] text-primary-container font-semibold shrink-0">${e.sets}x${e.reps}</span>
                                </div>
                            `).join('')}
                            ${(t.exercises || []).length > 3 ? `<p class="text-[10px] text-primary-container font-semibold pt-0.5">+ ${(t.exercises || []).length - 3} more exercises</p>` : ''}
                        </div>
                    </div>

                    <!-- Bottom Actions -->
                    <div class="grid grid-cols-3 gap-1.5 sm:gap-2 pt-2 border-t border-outline-variant/10 mt-auto min-w-0">
                        <button class="py-1.5 rounded bg-transparent border border-base text-[#a1a1aa] hover:bg-[#1f201a] hover:text-primary text-[11px] font-medium transition-colors btn-preview">Preview</button>
                        <button class="py-1.5 rounded bg-transparent border border-base text-[#a1a1aa] hover:bg-[#1f201a] hover:text-primary text-[11px] font-medium transition-colors btn-edit">Edit</button>
                        <button class="py-1.5 rounded bg-[#d9f99d] text-[#09090b] font-bold text-[11px] transition-transform active:scale-95 btn-assign flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[14px]">person_add</span> Assign</button>
                    </div>
                `;

                // Wire Card Action Buttons
                card.querySelector('.btn-preview').onclick = () => openPreviewTemplate(t);
                card.querySelector('.btn-edit').onclick = () => openEditTemplate(t);
                card.querySelector('.btn-assign').onclick = () => openAssignTemplate(t.id);
                card.querySelector('.btn-duplicate').onclick = async () => {
                    try {
                        await appState.duplicateTemplate(t.id);
                        renderTemplates();
                        showToast(`Template "${t.name}" duplicated successfully!`, 'success', 'Template Duplicated');
                    } catch (err) {
                        showToast(`Failed to duplicate: ${err.message}`, 'error', 'Duplicate Error');
                    }
                };
                card.querySelector('.btn-delete').onclick = async () => {
                    if (await showConfirm(`Delete template "${t.name}"?`, 'Delete Template', 'Delete', 'Cancel')) {
                        try {
                            await appState.deleteTemplate(t.id);
                            renderTemplates();
                            showToast(`Template "${t.name}" deleted successfully!`, 'success', 'Template Deleted');
                        } catch (err) {
                            showToast(`Failed to delete: ${err.message}`, 'error', 'Delete Error');
                        }
                    }
                };

                gridMount.appendChild(card);
            });
        }
    }

    // Trigger Create Modal
    const triggerCreate = () => {
        document.getElementById('template-id').value = '';
        document.getElementById('template-name').value = '';
        document.getElementById('template-category').value = 'hypertrophy';
        document.getElementById('template-notes').value = '';
        exercisesMount.innerHTML = '';
        if (modalTitle) modalTitle.textContent = 'Create Workout Template';
        
        // Add 2 default exercise rows
        addExerciseRow();
        addExerciseRow();
        if (templateModal) templateModal.classList.remove('hidden');
    };

    if (btnCreateTemplate) btnCreateTemplate.onclick = triggerCreate;
    const btnCreateFirst = document.getElementById('btn-templates-create-first');
    if (btnCreateFirst) btnCreateFirst.onclick = triggerCreate;

    if (btnAddExercise) {
        btnAddExercise.onclick = () => addExerciseRow();
    }

    // Open Edit Template Modal
    function openEditTemplate(template) {
        document.getElementById('template-id').value = template.id;
        document.getElementById('template-name').value = template.name;
        document.getElementById('template-category').value = template.category || 'hypertrophy';
        document.getElementById('template-notes').value = template.notes || '';
        exercisesMount.innerHTML = '';
        if (modalTitle) modalTitle.textContent = 'Edit Workout Template';

        (template.exercises || []).forEach(ex => addExerciseRow(ex));
        if ((template.exercises || []).length === 0) addExerciseRow();

        if (templateModal) templateModal.classList.remove('hidden');
    }

    // Open Preview Template Modal
    function openPreviewTemplate(template) {
        previewingTemplate = template;
        if (previewTitle) previewTitle.textContent = template.name;
        if (previewCategory) previewCategory.textContent = (template.category || 'HYPERTROPHY').toUpperCase();
        if (previewNotes) previewNotes.textContent = template.notes || 'No global notes specified.';

        if (previewExercisesList) {
            previewExercisesList.innerHTML = '';
            (template.exercises || []).forEach((e, idx) => {
                const item = document.createElement('div');
                item.className = 'p-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-xs space-y-1';
                item.innerHTML = `
                    <div class="flex justify-between font-bold text-primary">
                        <span>${idx + 1}. ${e.name}</span>
                        <span class="text-primary-container font-mono">${e.sets} Sets × ${e.reps} Reps</span>
                    </div>
                    <div class="flex gap-3 text-[10px] text-on-surface-variant font-mono">
                        <span>Load: ${e.weight || 'RPE 8'}</span>
                        <span>Rest: ${e.rest || '90s'}</span>
                        ${e.tempo ? `<span>Tempo: ${e.tempo}</span>` : ''}
                    </div>
                    ${e.notes ? `<p class="text-[10px] text-on-surface-variant/80 italic">${e.notes}</p>` : ''}
                `;
                previewExercisesList.appendChild(item);
            });
        }

        if (btnPreviewAssign) {
            btnPreviewAssign.onclick = () => {
                closeModals();
                openAssignTemplate(template.id);
            };
        }

        if (previewModal) previewModal.classList.remove('hidden');
    }

    // Submit Template Form
    if (templateForm) {
        templateForm.onsubmit = async function(e) {
            e.preventDefault();
            const id = document.getElementById('template-id').value || null;
            const name = document.getElementById('template-name').value;
            const category = document.getElementById('template-category').value;
            const notes = document.getElementById('template-notes').value;

            const exercises = [];
            let count = 1;
            document.querySelectorAll('.group-ex-row').forEach(row => {
                const exName = row.querySelector('.ex-name').value;
                if (exName.trim()) {
                    exercises.push({
                        id: 'te-' + Math.random().toString(36).substr(2, 9),
                        name: exName,
                        sets: parseInt(row.querySelector('.ex-sets').value) || 4,
                        reps: row.querySelector('.ex-reps').value || '8-10',
                        weight: row.querySelector('.ex-weight').value || 'RPE 8',
                        rest: row.querySelector('.ex-rest').value || '90s',
                        tempo: row.querySelector('.ex-tempo').value || '2-0-2',
                        notes: row.querySelector('.ex-notes').value || '',
                        order: count++
                    });
                }
            });

            try {
                await appState.saveTemplate({
                    id,
                    name,
                    category,
                    notes,
                    exercises
                });
                closeModals();
                renderTemplates();
                showToast(`Template "${name}" saved successfully!`, 'success', 'Template Saved');
            } catch (err) {
                showToast(`Failed to save template: ${err.message}`, 'error', 'Save Error');
            }
        };
    }

    // Assign Template
    function openAssignTemplate(templateId) {
        document.getElementById('assign-template-id').value = templateId;
        
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
    }

    if (assignForm) {
        assignForm.onsubmit = async function(e) {
            e.preventDefault();
            const templateId = document.getElementById('assign-template-id').value;
            const clientId = assignSelect.value;

            if (templateId && clientId) {
                try {
                    const newWorkout = await appState.assignTemplateToClient(templateId, clientId);
                    closeModals();
                    showToast(`Workout template successfully assigned to client!`, 'success', 'Template Assigned');
                    if (newWorkout) {
                        window.location.hash = `builder/${newWorkout.id}`;
                    } else {
                        window.location.hash = 'builder';
                    }
                } catch (err) {
                    showToast(`Failed to assign template: ${err.message}`, 'error', 'Assign Error');
                }
            }
        };
    }

    // Initial render
    renderTemplates();
};
