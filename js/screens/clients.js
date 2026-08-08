// Controller for Clients Management screen
window.init_clients = function(params) {
    const clients = window.appState.clients;
    
    // Mount points
    const gridMount = document.getElementById('clients-grid-mount');
    const emptyState = document.getElementById('clients-empty-state');
    const searchInput = document.getElementById('client-search');
    const filterButtons = document.querySelectorAll('.btn-client-filter');

    // Modals
    const editModal = document.getElementById('edit-client-modal');
    const editForm = document.getElementById('edit-client-form');
    
    let activeFilter = (params && params.id) || 'all';
    let sortByAdherence = false;

    if (activeFilter === 'sort-adherence') {
        activeFilter = 'all';
        sortByAdherence = true;
    }

    let searchQuery = '';

    // Highlight the active filter button on initial load
    filterButtons.forEach(b => {
        if (b.getAttribute('data-filter') === activeFilter) {
            b.className = 'px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant text-primary text-xs font-semibold btn-client-filter active';
        } else {
            b.className = 'px-4 py-2 rounded-lg bg-transparent border border-transparent text-on-surface-variant text-xs font-semibold btn-client-filter';
        }
    });

    // Render helper
    function renderClients() {
        if (!gridMount) return;
        gridMount.innerHTML = '';

        let filtered = clients;

        // Apply tab filter
        if (activeFilter === 'attention') {
            filtered = filtered.filter(c => c.status === 'Critical' || c.status === 'Health Alert' || c.status === 'Warning');
        } else if (activeFilter === 'active') {
            filtered = filtered.filter(c => c.status !== 'Inactive');
        } else if (activeFilter === 'inactive') {
            filtered = filtered.filter(c => c.status === 'Inactive');
        }

        if (sortByAdherence) {
            filtered = [...filtered].sort((a, b) => b.adherence - a.adherence);
        }

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(c => 
                c.name.toLowerCase().includes(query) || 
                c.email.toLowerCase().includes(query) || 
                c.goal.toLowerCase().includes(query)
            );
        }

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            gridMount.classList.add('hidden');

            if (clients.length === 0) {
                emptyState.innerHTML = `
                    <span class="material-symbols-outlined text-[64px] text-primary-container mb-4">group_add</span>
                    <h3 class="font-headline-md text-primary mb-2">No clients yet</h3>
                    <p class="text-sm text-on-surface-variant mb-6">Create your roster by inviting your first athlete client.</p>
                    <a href="#add-client" class="btn-primary px-6 py-2.5 rounded-lg font-body-base text-body-base font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_0_20px_rgba(217,249,157,0.2)]">
                        <span class="material-symbols-outlined text-[20px]">person_add</span>
                        <span>Add your first client</span>
                    </a>
                `;
            } else {
                emptyState.innerHTML = `
                    <span class="material-symbols-outlined text-[64px] text-on-surface-variant mb-4">search_off</span>
                    <h3 class="font-headline-md text-primary mb-2">No Clients Found</h3>
                    <p class="text-sm text-on-surface-variant">Try refining your search query or change the status filter tab.</p>
                `;
            }
        } else {
            emptyState.classList.add('hidden');
            gridMount.classList.remove('hidden');

            filtered.forEach(client => {
                const card = document.createElement('div');
                card.className = 'card-bg border border-base hover:border-[#44483b] rounded-xl p-unit-md transition-colors flex flex-col justify-between';
                
                // Color code status tag
                let statusClass = 'bg-[#1f201a] text-[#a1a1aa] border-outline-variant/30';
                if (client.status === 'Critical') statusClass = 'bg-error-container/20 text-error border border-error/20';
                else if (client.status === 'Health Alert') statusClass = 'bg-[#4f1206]/20 text-[#ffb4a2] border border-[#ffb4a2]/20';
                else if (client.status === 'Warning') statusClass = 'bg-[#facc15]/10 text-[#facc15] border border-[#facc15]/20';
                else if (client.status === 'Healthy') statusClass = 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20';

                const avatarHtml = client.avatar && client.avatar.startsWith('http')
                    ? `<img alt="Client" class="w-full h-full object-cover" src="${client.avatar}">`
                    : `<div class="w-full h-full flex items-center justify-center font-bold text-[#c5c8b7]">${client.avatar || client.name.split(' ').map(n => n[0]).join('').toUpperCase()}</div>`;

                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-full bg-[#1f201a] flex items-center justify-center text-[#c5c8b7] font-stat-mono border border-base overflow-hidden flex-shrink-0">
                                    ${avatarHtml}
                                </div>
                                <div>
                                    <h4 class="font-body-base text-body-base font-semibold text-primary truncate max-w-[140px]">${client.name}</h4>
                                    <p class="text-xs text-on-surface-variant truncate max-w-[140px]">${client.email}</p>
                                </div>
                            </div>
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-stat-mono ${statusClass}">${client.status || 'Active'}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-y-2 gap-x-1 border-t border-b border-outline-variant/30 py-3 mb-4 text-xs font-body-sm text-on-surface-variant">
                            <div>Goal: <strong class="text-on-surface font-medium">${client.goal}</strong></div>
                            <div>Phase: <strong class="text-on-surface font-medium">${client.phase}</strong></div>
                            <div>Weight: <strong class="text-on-surface font-medium">${client.weight} kg</strong></div>
                            <div>Check-in: <strong class="text-on-surface font-medium">${client.lastCheckIn}</strong></div>
                        </div>
                        <div class="mb-4">
                            <div class="flex justify-between text-[10px] font-stat-mono text-on-surface-variant mb-1">
                                <span>Adherence</span>
                                <span class="text-[#facc15]">${client.adherence}%</span>
                            </div>
                            <div class="w-full h-1.5 bg-[#27272a] rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-[#6366f1] to-[#facc15]" style="width: ${client.adherence}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-auto">
                        <button class="py-1.5 rounded bg-transparent border border-base text-[#a1a1aa] hover:bg-[#1f201a] hover:text-primary font-body-sm text-xs transition-colors btn-view">View Profile</button>
                        <button class="py-1.5 rounded bg-transparent border border-base text-[#a1a1aa] hover:bg-[#1f201a] hover:text-primary font-body-sm text-xs transition-colors btn-edit">Edit</button>
                        <button class="py-1.5 rounded bg-transparent border border-base text-[#a1a1aa] hover:bg-[#1f201a] hover:text-primary font-body-sm text-xs transition-colors btn-msg">Message</button>
                        <button class="py-1.5 rounded bg-transparent border border-base text-error/80 hover:bg-error/10 font-body-sm text-xs transition-colors btn-archive">${client.status === 'Inactive' ? 'Activate' : 'Archive'}</button>
                    </div>
                `;

                // Wire up actions
                card.querySelector('.btn-view').onclick = () => {
                    window.location.hash = `analytics/${client.id}`;
                };
                card.querySelector('.btn-edit').onclick = () => {
                    openEditModal(client);
                };
                card.querySelector('.btn-msg').onclick = () => {
                    window.location.hash = `inbox/${client.id}`;
                };
                card.querySelector('.btn-archive').onclick = async () => {
                    if (client.status === 'Inactive') {
                        client.status = 'Healthy';
                    } else {
                        client.status = 'Inactive';
                    }
                    try {
                        await window.appState.save();
                        renderClients();
                    } catch (err) {
                        alert(`Failed to update client archive status: ${err.message}`);
                    }
                };

                gridMount.appendChild(card);
            });
        }
    }

    // Modal helpers
    function openEditModal(client) {
        document.getElementById('edit-client-id').value = client.id;
        document.getElementById('edit-client-name').value = client.name;
        document.getElementById('edit-client-email').value = client.email;
        document.getElementById('edit-client-goal').value = client.goal;
        document.getElementById('edit-client-status').value = client.status || 'Healthy';
        editModal.classList.remove('hidden');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
    }

    // Bind edit modal close triggers
    document.querySelectorAll('#edit-client-modal .modal-close-trigger').forEach(btn => {
        btn.onclick = closeEditModal;
    });

    // Handle Edit form submission
    if (editForm) {
        editForm.onsubmit = async function(e) {
            e.preventDefault();
            const id = document.getElementById('edit-client-id').value;
            const client = clients.find(c => c.id === id);
            if (client) {
                client.name = document.getElementById('edit-client-name').value;
                client.email = document.getElementById('edit-client-email').value;
                client.goal = document.getElementById('edit-client-goal').value;
                client.status = document.getElementById('edit-client-status').value;
                
                try {
                    await window.appState.save();
                    closeEditModal();
                    renderClients();
                } catch (err) {
                    alert(`Failed to save client details: ${err.message}`);
                }
            }
        };
    }

    // Setup search listener
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = function(e) {
            searchQuery = e.target.value;
            renderClients();
        };
    }

    // Setup filter tabs
    filterButtons.forEach(btn => {
        btn.onclick = function() {
            filterButtons.forEach(b => {
                b.className = 'px-4 py-2 rounded-lg bg-transparent border border-transparent text-on-surface-variant text-xs font-semibold btn-client-filter';
            });
            btn.className = 'px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant text-primary text-xs font-semibold btn-client-filter active';
            activeFilter = btn.getAttribute('data-filter');
            sortByAdherence = false; // Reset sorting on manual tab switch
            renderClients();
        };
    });

    // Initial render
    renderClients();
};
