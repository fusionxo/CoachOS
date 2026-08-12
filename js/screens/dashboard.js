// Controller for Dashboard screen
window.init_dashboard = function(params) {
    const clients = window.appState.clients;
    
    // Toggle Empty State
    const mainContent = document.getElementById('dashboard-main-content');
    const emptyState = document.getElementById('dashboard-empty-state');
    if (clients.length === 0) {
        if (mainContent) mainContent.classList.add('hidden');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
        }
        
        // Initialize stats count labels to zero
        const activeClientsCountEl = document.querySelector('#metric-card-active-clients .text-primary');
        if (activeClientsCountEl) activeClientsCountEl.textContent = '0';
        const checkinsCountEl = document.querySelector('#metric-card-checkins-today .text-primary');
        if (checkinsCountEl) checkinsCountEl.textContent = '0';
        const attentionCountEl = document.querySelector('#metric-card-needing-attention .font-display-lg');
        if (attentionCountEl) attentionCountEl.textContent = '0';
        const avgAdherenceEl = document.querySelector('#metric-card-avg-adherence .text-primary');
        if (avgAdherenceEl) avgAdherenceEl.innerHTML = `0<span class="text-headline-md">%</span>`;
        return;
    } else {
        if (mainContent) mainContent.classList.remove('hidden');
        if (emptyState) {
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
        }
    }

    // Mount points
    const attentionContainer = document.getElementById('attention-active-mount');
    const mediumContainer = document.getElementById('monitoring-active-mount');
    const doingGreatContainer = document.getElementById('doing-great-mount');

    // Modals
    const resolveModal = document.getElementById('resolve-alert-modal');
    const adjustModal = document.getElementById('adjust-plan-modal');
    const checkinsModal = document.getElementById('checkins-today-modal');
    const adherenceModal = document.getElementById('adherence-analytics-modal');

    let activeResolveClientId = null;

    // Helper to close modals
    function closeModals() {
        if (resolveModal) resolveModal.classList.add('hidden');
        if (adjustModal) adjustModal.classList.add('hidden');
        if (checkinsModal) checkinsModal.classList.add('hidden');
        if (adherenceModal) adherenceModal.classList.add('hidden');
        activeResolveClientId = null;
    }

    // Bind Close events
    document.querySelectorAll('.modal-close-trigger, .adjust-close-trigger, .checkins-modal-close-trigger, .adherence-modal-close-trigger').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    // 1. Metric Cards Behavior
    const activeClientsCard = document.getElementById('metric-card-active-clients');
    if (activeClientsCard) {
        activeClientsCard.onclick = () => {
            window.location.hash = 'clients/active';
        };
        activeClientsCard.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.hash = 'clients/active';
            }
        };
    }

    const needingAttentionCard = document.getElementById('metric-card-needing-attention');
    if (needingAttentionCard) {
        needingAttentionCard.onclick = () => {
            window.location.hash = 'clients/attention';
        };
        needingAttentionCard.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.hash = 'clients/attention';
            }
        };
    }

    const checkinsTodayCard = document.getElementById('metric-card-checkins-today');
    if (checkinsTodayCard) {
        checkinsTodayCard.onclick = () => {
            populateCheckinsTodayModal();
            if (checkinsModal) checkinsModal.classList.remove('hidden');
        };
        checkinsTodayCard.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                populateCheckinsTodayModal();
                if (checkinsModal) checkinsModal.classList.remove('hidden');
            }
        };
    }

    const avgAdherenceCard = document.getElementById('metric-card-avg-adherence');
    if (avgAdherenceCard) {
        avgAdherenceCard.onclick = () => {
            populateAdherenceAnalyticsModal();
            if (adherenceModal) adherenceModal.classList.remove('hidden');
        };
        avgAdherenceCard.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                populateAdherenceAnalyticsModal();
                if (adherenceModal) adherenceModal.classList.remove('hidden');
            }
        };
    }

    // View All Performers Button
    const performersBtn = document.getElementById('btn-view-all-performers') || document.querySelector('button.border-dashed');
    if (performersBtn) {
        performersBtn.onclick = () => {
            window.location.hash = 'clients/sort-adherence';
        };
    }

    // Data population helpers for modals
    function populateCheckinsTodayModal() {
        const completedList = document.getElementById('completed-today-list');
        const pendingList = document.getElementById('pending-today-list');
        if (!completedList || !pendingList) return;

        completedList.innerHTML = '';
        pendingList.innerHTML = '';

        const todayStr = new Date().toISOString().split('T')[0];
        
        // Find completed checkins today
        const completedCheckins = window.appState.checkins.filter(c => c.date === todayStr);
        const completedIds = completedCheckins.map(c => c.clientId);

        clients.forEach(client => {
            const hasCheckedIn = completedIds.includes(client.id);
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2.5 bg-[#18181b] border border-[#27272a] rounded-lg text-xs';
            
            const avatarHtml = client.avatar && client.avatar.startsWith('http') 
                ? `<img alt="Client" class="w-8 h-8 rounded-full object-cover" src="${client.avatar}">`
                : `<div class="w-8 h-8 rounded-full bg-[#1f201a] flex items-center justify-center font-bold text-[#c5c8b7]">${client.avatar || client.name.split(' ').map(n => n[0]).join('').toUpperCase()}</div>`;

            if (hasCheckedIn) {
                const log = completedCheckins.find(c => c.clientId === client.id);
                item.innerHTML = `
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full overflow-hidden border border-base flex-shrink-0">
                            ${avatarHtml}
                        </div>
                        <div>
                            <span class="font-semibold text-primary block">${client.name}</span>
                            <span class="text-[10px] text-on-surface-variant">Goal: ${client.goal}</span>
                        </div>
                    </div>
                    <div class="text-right font-stat-mono text-[10px] text-on-surface-variant">
                        <span class="text-[#22c55e] font-semibold">${log.weight} kg</span> • ${log.sleep}h sleep • ${log.steps.toLocaleString()} steps
                    </div>
                `;
                completedList.appendChild(item);
            } else {
                item.innerHTML = `
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full overflow-hidden border border-base flex-shrink-0">
                            ${avatarHtml}
                        </div>
                        <div>
                            <span class="font-semibold text-primary block">${client.name}</span>
                            <span class="text-[10px] text-on-surface-variant">Adherence: ${client.adherence}%</span>
                        </div>
                    </div>
                    <button class="px-3 py-1 bg-[#d9f99d] text-[#09090b] font-semibold rounded text-[10px] btn-nudge" data-id="${client.id}">Nudge</button>
                `;
                item.querySelector('.btn-nudge').onclick = () => {
                    showToast(`Nudge notification sent to ${client.name}!`, 'success', 'Nudge Sent');
                };
                pendingList.appendChild(item);
            }
        });

        if (completedList.children.length === 0) {
            completedList.innerHTML = `<p class="text-[11px] text-on-surface-variant italic p-2">No check-ins logged yet today.</p>`;
        }
        if (pendingList.children.length === 0) {
            pendingList.innerHTML = `<p class="text-[11px] text-[#22c55e] italic p-2">All active clients have checked in today!</p>`;
        }
    }

    function populateAdherenceAnalyticsModal() {
        const highCountEl = document.getElementById('high-adherence-count');
        const medCountEl = document.getElementById('med-adherence-count');
        const lowCountEl = document.getElementById('low-adherence-count');
        const highBar = document.getElementById('high-adherence-bar');
        const medBar = document.getElementById('med-adherence-bar');
        const lowBar = document.getElementById('low-adherence-bar');
        
        const bestList = document.getElementById('best-adherence-list');
        const decliningList = document.getElementById('declining-adherence-list');

        if (!highCountEl || !bestList || !decliningList) return;

        const totalClients = clients.length || 1;
        const high = clients.filter(c => c.adherence >= 85);
        const med = clients.filter(c => c.adherence >= 75 && c.adherence < 85);
        const low = clients.filter(c => c.adherence < 75);

        highCountEl.textContent = `${high.length} clients`;
        medCountEl.textContent = `${med.length} clients`;
        lowCountEl.textContent = `${low.length} clients`;

        highBar.style.width = `${(high.length / totalClients) * 100}%`;
        medBar.style.width = `${(med.length / totalClients) * 100}%`;
        lowBar.style.width = `${(low.length / totalClients) * 100}%`;

        // Render best performing (sorted descending)
        bestList.innerHTML = '';
        [...clients].sort((a,b) => b.adherence - a.adherence).slice(0, 3).forEach(client => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between text-xs p-2.5 bg-[#18181b] border border-[#27272a] rounded';
            div.innerHTML = `<span>${client.name}</span> <span class="font-stat-mono text-[#22c55e] font-semibold">${client.adherence}%</span>`;
            bestList.appendChild(div);
        });

        // Render declining/low (sorted ascending)
        decliningList.innerHTML = '';
        [...clients].sort((a,b) => a.adherence - b.adherence).slice(0, 3).forEach(client => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between text-xs p-2.5 bg-[#18181b] border border-[#27272a] rounded';
            div.innerHTML = `<span>${client.name}</span> <span class="font-stat-mono text-error font-semibold">${client.adherence}%</span>`;
            decliningList.appendChild(div);
        });
    }

    // 2. Render Attention Required (Critical / Health Alert)
    if (attentionContainer) {
        attentionContainer.innerHTML = '';
        const attentionClients = clients.filter(c => c.status === 'Critical' || c.status === 'Health Alert');
        
        if (attentionClients.length === 0) {
            attentionContainer.innerHTML = `
                <div class="glass-panel border border-outline-variant/30 rounded-xl p-8 text-center text-on-surface-variant text-sm">
                    <span class="material-symbols-outlined text-[32px] mb-2 text-[#22c55e]">check_circle</span>
                    <p>All clients are doing great. No urgent actions needed today.</p>
                </div>
            `;
        } else {
            attentionClients.forEach(client => {
                const card = document.createElement('div');
                card.className = 'glass-panel border border-[#93000a]/30 rounded-xl p-unit-md flex flex-col gap-unit-md group cursor-pointer hover:border-outline transition-all duration-200';
                
                // Clicking card goes to analytics
                card.addEventListener('click', () => {
                    window.location.hash = `analytics/${client.id}`;
                });

                let problem = 'No recent updates';
                let suggested = 'Check client training logs';
                if (client.status === 'Critical') {
                    problem = `Compliance dropped to ${client.adherence}% • Last checked in: ${client.lastCheckIn}`;
                    suggested = 'Send urgent follow-up message';
                } else if (client.status === 'Health Alert') {
                    problem = 'High stress or poor sleep indicators flagged in check-in';
                    suggested = 'Review daily check-in notes & adjust training load';
                }
                
                const avatarHtml = client.avatar && client.avatar.startsWith('http') 
                    ? `<img alt="Client" class="w-full h-full object-cover grayscale opacity-80" src="${client.avatar}">`
                    : `<div class="w-full h-full flex items-center justify-center font-bold text-[#c5c8b7]">${client.avatar || client.name.split(' ').map(n => n[0]).join('').toUpperCase()}</div>`;

                card.innerHTML = `
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-unit-md">
                        <div class="flex items-center gap-unit-md">
                            <div class="w-12 h-12 rounded-full bg-[#1f201a] flex-shrink-0 overflow-hidden border border-base">
                                ${avatarHtml}
                            </div>
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <h4 class="font-headline-md text-body-base font-semibold text-primary truncate">${client.name}</h4>
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-stat-mono bg-error-container/20 text-error border border-error/20">${client.status}</span>
                                </div>
                                <div class="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant font-body-sm">
                                    <span><strong class="text-on-surface font-medium">Goal:</strong> ${client.goal}</span>
                                    <span><strong class="text-on-surface font-medium">Phase:</strong> ${client.phase}</span>
                                    <span><strong class="text-on-surface font-medium">Last Check-in:</strong> ${client.lastCheckIn}</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col items-start sm:items-end w-full sm:w-auto">
                            <span class="text-xs text-on-surface-variant mb-1 font-body-sm">Adherence</span>
                            <div class="flex items-center gap-2 w-full">
                                <span class="font-stat-mono text-sm text-[#facc15]">${client.adherence}%</span>
                                <div class="w-16 sm:w-20 h-1.5 bg-[#27272a] rounded-full overflow-hidden flex-1 sm:flex-none">
                                    <div class="h-full bg-gradient-to-r from-[#6366f1] to-[#facc15]" style="width: ${client.adherence}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="bg-[#18181b] rounded-lg p-3 border border-base flex flex-col sm:flex-row gap-3 sm:items-center justify-between" onclick="event.stopPropagation()">
                        <div class="min-w-0 flex-1">
                            <p class="font-body-sm text-sm text-error/90 flex items-center gap-1.5 mb-1">
                                <span class="material-symbols-outlined text-[16px]">warning</span>
                                <span class="font-semibold text-error">Problem:</span> <span class="truncate">${problem}</span>
                            </p>
                            <p class="font-body-sm text-sm text-on-surface-variant flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[16px]">lightbulb</span>
                                <span class="font-semibold text-on-surface">Suggested:</span> <span class="truncate">${suggested}</span>
                            </p>
                        </div>
                        <button class="px-6 py-2 rounded-lg bg-[#d9f99d] text-[#09090b] font-body-sm text-sm font-semibold transition-transform active:scale-95 btn-resolve-alert whitespace-nowrap">Resolve</button>
                    </div>
                `;

                // Handle resolve button inside card
                card.querySelector('.btn-resolve-alert').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openResolveModal(client, problem, suggested);
                });

                attentionContainer.appendChild(card);
            });
        }
    }

    // Function to open Resolve Alert modal
    function openResolveModal(client, problem, suggested) {
        activeResolveClientId = client.id;
        
        const clientNameEl = document.getElementById('resolve-client-name');
        const alertDetailsEl = document.getElementById('resolve-alert-details');
        const suggestedEl = document.getElementById('resolve-suggested-action');

        if (clientNameEl) clientNameEl.textContent = client.name;
        if (alertDetailsEl) alertDetailsEl.textContent = problem;
        if (suggestedEl) suggestedEl.textContent = suggested;

        if (resolveModal) resolveModal.classList.remove('hidden');
    }

    // Resolve Actions handlers
    const actionMsgBtn = document.getElementById('resolve-action-message');
    const actionAdjustBtn = document.getElementById('resolve-action-adjust');
    const actionSnoozeBtn = document.getElementById('resolve-action-snooze');
    const actionCompleteBtn = document.getElementById('resolve-action-complete');

    if (actionMsgBtn) {
        actionMsgBtn.onclick = () => {
            if (activeResolveClientId) {
                const clientId = activeResolveClientId;
                closeModals();
                window.location.hash = `inbox/${clientId}`;
            }
        };
    }

    if (actionAdjustBtn) {
        actionAdjustBtn.onclick = () => {
            if (activeResolveClientId) {
                const clientId = activeResolveClientId;
                closeModals();
                
                // Open Adjust Plan modal
                const adjustClientIdField = document.getElementById('adjust-client-id');
                if (adjustClientIdField) adjustClientIdField.value = clientId;

                const client = clients.find(c => c.id === clientId);
                const checkin = window.appState.checkins.filter(c => c.clientId === clientId).slice(-1)[0];
                
                const calField = document.getElementById('adjust-calories');
                const protField = document.getElementById('adjust-protein');
                if (calField && checkin) calField.value = checkin.calories || 2000;
                if (protField && checkin) protField.value = checkin.protein || 150;

                if (adjustModal) adjustModal.classList.remove('hidden');
            }
        };
    }

    // Submit Adjust plan form
    const adjustForm = document.getElementById('adjust-plan-form');
    if (adjustForm) {
        adjustForm.onsubmit = (e) => {
            e.preventDefault();
            const clientId = document.getElementById('adjust-client-id').value;
            const cals = parseInt(document.getElementById('adjust-calories').value);
            const prot = parseInt(document.getElementById('adjust-protein').value);

            // Save adjustments to client notes and resolve alert
            const noteText = `Plan adjusted: target calories set to ${cals} kcal, protein set to ${prot}g.`;
            const currentNotes = window.appState.privateNotes[clientId] || '';
            window.appState.savePrivateNotes(clientId, currentNotes + '\n' + noteText);
            
            // Set client status to healthy
            window.appState.resolveClientAlert(clientId, 'Healthy');
            
            closeModals();
            init_dashboard();
        };
    }

    if (actionSnoozeBtn) {
        actionSnoozeBtn.onclick = () => {
            if (activeResolveClientId) {
                window.appState.resolveClientAlert(activeResolveClientId, 'Healthy');
                closeModals();
                init_dashboard();
            }
        };
    }

    // 2. Render Medium Priority (Warning) & Healthy
    if (mediumContainer) {
        mediumContainer.innerHTML = '';
        const warningOrHealthyClients = clients.filter(c => c.status === 'Warning' || c.status === 'Healthy');
        
        warningOrHealthyClients.forEach(client => {
            const card = document.createElement('div');
            card.className = 'card-bg border border-base hover:border-[#44483b] rounded-xl p-unit-md transition-colors cursor-pointer relative';
            
            card.addEventListener('click', () => {
                window.location.hash = `analytics/${client.id}`;
            });

            const sub = client.status === 'Warning' ? `Adherence is low (${client.adherence}%)` : 'Adherence looks solid';
            const actionText = client.status === 'Warning' ? 'Send Nudge' : 'View Plan';
            
            const avatarHtml = client.avatar && client.avatar.startsWith('http')
                ? `<img alt="Client" class="w-full h-full object-cover" src="${client.avatar}">`
                : `${client.avatar || client.name.split(' ').map(n => n[0]).join('').toUpperCase()}`;

            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-[#1f201a] flex items-center justify-center text-[#c5c8b7] font-stat-mono text-sm border border-base overflow-hidden">
                            ${avatarHtml}
                        </div>
                        <div>
                            <h4 class="font-body-base text-body-base font-medium text-primary">${client.name}</h4>
                            <p class="font-body-sm text-body-sm text-on-surface-variant">${sub}</p>
                        </div>
                    </div>
                    <div class="relative drop-down-wrapper" onclick="event.stopPropagation()">
                        <button class="text-on-surface-variant hover:text-primary btn-more-options"><span class="material-symbols-outlined text-[20px]">more_horiz</span></button>
                        <div class="hidden absolute right-0 top-6 bg-[#09090b] border border-[#27272a] rounded-lg shadow-xl py-1 z-20 w-36 drop-down-menu">
                            <button class="w-full text-left px-3 py-1.5 text-xs text-on-surface hover:bg-[#1f201a] flex items-center gap-1.5 opt-view"><span class="material-symbols-outlined text-[14px]">visibility</span> View Profile</button>
                            <button class="w-full text-left px-3 py-1.5 text-xs text-on-surface hover:bg-[#1f201a] flex items-center gap-1.5 opt-msg"><span class="material-symbols-outlined text-[14px]">chat</span> Message</button>
                            <button class="w-full text-left px-3 py-1.5 text-xs text-on-surface hover:bg-[#1f201a] flex items-center gap-1.5 opt-resolve"><span class="material-symbols-outlined text-[14px]">check</span> Resolve</button>
                        </div>
                    </div>
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
                <button class="w-full py-1.5 rounded bg-transparent border border-base text-[#a1a1aa] hover:bg-[#1f201a] hover:text-primary font-body-sm text-body-sm transition-colors btn-action" onclick="event.stopPropagation()">
                    ${actionText}
                </button>
            `;

            // Setup Dropdown Toggle
            const optBtn = card.querySelector('.btn-more-options');
            const optMenu = card.querySelector('.drop-down-menu');
            if (optBtn && optMenu) {
                optBtn.onclick = () => {
                    document.querySelectorAll('.drop-down-menu').forEach(m => {
                        if (m !== optMenu) m.classList.add('hidden');
                    });
                    optMenu.classList.toggle('hidden');
                };
            }

            // Dropdown option click logic
            card.querySelector('.opt-view').onclick = () => {
                window.location.hash = `analytics/${client.id}`;
            };
            card.querySelector('.opt-msg').onclick = () => {
                window.location.hash = `inbox/${client.id}`;
            };
            card.querySelector('.opt-resolve').onclick = () => {
                window.appState.resolveClientAlert(client.id, 'Healthy');
                init_dashboard();
            };

            // Action button logic
            card.querySelector('.btn-action').addEventListener('click', (e) => {
                e.stopPropagation();
                if (client.status === 'Warning') {
                    window.appState.resolveClientAlert(client.id, 'Healthy');
                    init_dashboard();
                } else {
                    window.location.hash = `analytics/${client.id}`;
                }
            });

            mediumContainer.appendChild(card);
        });
    }

    // Render Doing Great performers dynamically (top 3 by adherence)
    if (doingGreatContainer) {
        doingGreatContainer.innerHTML = '';
        const sortedClients = [...clients].sort((a, b) => b.adherence - a.adherence).slice(0, 3);
        sortedClients.forEach(client => {
            const card = document.createElement('div');
            card.className = 'flex items-center justify-between p-3 rounded-lg hover:bg-[#1f201a] transition-colors border border-transparent hover:border-base group cursor-pointer';
            card.onclick = () => {
                window.location.hash = `analytics/${client.id}`;
            };
            
            const avatarHtml = client.avatar && client.avatar.startsWith('http')
                ? `<img alt="Client" class="w-full h-full object-cover" src="${client.avatar}">`
                : `<div class="w-full h-full flex items-center justify-center font-bold text-sm bg-[#1f201a] text-primary rounded-full">${client.avatar || client.name.split(' ').map(n => n[0]).join('').toUpperCase()}</div>`;
                
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="relative w-10 h-10 rounded-full overflow-hidden border border-base flex-shrink-0">
                        ${avatarHtml}
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#22c55e] border border-[#18181b] flex items-center justify-center">
                            <span class="material-symbols-outlined text-[10px] text-[#09090b]" style="font-variation-settings: 'FILL' 1;">local_fire_department</span>
                        </div>
                    </div>
                    <div>
                        <h4 class="font-body-sm text-body-sm font-medium text-primary">${client.name}</h4>
                        <p class="font-body-sm text-[12px] text-on-surface-variant">Active goal: ${client.goal}</p>
                    </div>
                </div>
                <span class="font-stat-mono text-stat-mono text-[#22c55e] text-sm font-bold">${client.adherence}%</span>
            `;
            doingGreatContainer.appendChild(card);
        });
        
        if (sortedClients.length === 0) {
            doingGreatContainer.innerHTML = `<p class="text-[11px] text-on-surface-variant italic p-2">No performer data available.</p>`;
        }
    }

    // Close options dropdowns on outside clicks
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.drop-down-wrapper')) {
            document.querySelectorAll('.drop-down-menu').forEach(m => m.classList.add('hidden'));
        }
    });

    // 3. Update counter numbers in Stats Bento Grid
    const activeClientsCountEl = document.querySelector('#metric-card-active-clients .text-primary');
    if (activeClientsCountEl) activeClientsCountEl.textContent = clients.length;

    const checkinsCountEl = document.querySelector('#metric-card-checkins-today .text-primary');
    if (checkinsCountEl) {
        const todayStr = new Date().toISOString().split('T')[0];
        const completedCheckins = window.appState.checkins.filter(c => c.date === todayStr).length;
        checkinsCountEl.textContent = completedCheckins;
    }

    const attentionCountEl = document.querySelector('#metric-card-needing-attention .font-display-lg');
    if (attentionCountEl) attentionCountEl.textContent = clients.filter(c => c.status === 'Critical' || c.status === 'Health Alert' || c.status === 'Warning').length;

    const avgAdherenceEl = document.querySelector('#metric-card-avg-adherence .text-primary');
    if (avgAdherenceEl && clients.length > 0) {
        const total = clients.reduce((acc, c) => acc + c.adherence, 0);
        const avg = Math.round(total / clients.length);
        avgAdherenceEl.innerHTML = `${avg}<span class="text-headline-md">%</span>`;
    }
};
