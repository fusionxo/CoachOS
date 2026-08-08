// Controller for AI Coach Assistant screen
window.init_assistant = function(params) {
    const clients = window.appState.clients;
    const mainContent = document.getElementById('assistant-main-content');
    const emptyState = document.getElementById('assistant-empty-state');
    const alertsFeedContainer = document.querySelector('#assistant-main-content > div:first-child');

    if (clients.length === 0) {
        if (mainContent) mainContent.classList.add('hidden');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
        }
        return;
    } else {
        if (emptyState) {
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
        }
        if (mainContent) mainContent.classList.remove('hidden');
    }

    const input = document.querySelector('input[placeholder="Ask AI about your clients..."]');
    // Robustly select send button within its input parent container
    const sendBtn = input ? input.parentElement.querySelector('button') : null;
    const chatContainer = document.querySelector('.flex-1.p-unit-md.overflow-y-auto');

    if (!input || !chatContainer || !sendBtn) return;

    function appendMessage(sender, text) {
        const msgWrapper = document.createElement('div');
        const isUser = sender === 'user';
        
        msgWrapper.className = `flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`;

        const avatarHtml = isUser 
            ? `<div class="w-8 h-8 rounded-full bg-[#27272a] border border-outline-variant flex items-center justify-center shrink-0 font-bold text-xs text-primary">CH</div>`
            : `<div class="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                 <span class="material-symbols-outlined text-on-primary-container text-[16px]" style="font-variation-settings: 'FILL' 1;">psychology</span>
               </div>`;

        msgWrapper.innerHTML = `
            ${avatarHtml}
            <div class="${isUser ? 'bg-[#27272a] border border-[#44483b] max-w-[85%]' : 'bg-surface-container border border-outline-variant max-w-[85%]'} rounded-2xl ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'} p-3">
                <p class="font-body-sm text-body-sm text-on-surface">${text}</p>
            </div>
        `;

        chatContainer.appendChild(msgWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function handleSend() {
        const text = input.value.trim();
        if (!text) return;

        appendMessage('user', text);
        input.value = '';

        // Generate intelligent response based on live state data
        setTimeout(() => {
            const query = text.toLowerCase();
            let response = "I've checked the database. How can I help you customize their targets?";
            
            // Search for client name matches dynamically in the live roster
            let matchedClient = null;
            for (const c of clients) {
                if (query.includes(c.name.toLowerCase()) || (c.id && query.includes(c.id.toLowerCase())) || (c.email && query.includes(c.email.toLowerCase()))) {
                    matchedClient = c;
                    break;
                }
            }

            if (matchedClient) {
                const clientCheckins = window.appState.checkins.filter(ch => ch.clientId === matchedClient.id);
                const clientWorkouts = window.appState.workouts.filter(w => w.clientId === matchedClient.id);
                
                let statusDetails = `Status is <strong>${matchedClient.status || 'Healthy'}</strong> with adherence at <strong>${matchedClient.adherence || 100}%</strong>.`;
                
                if (clientCheckins.length > 0) {
                    const latest = clientCheckins[0];
                    statusDetails += ` Their latest check-in was logged <strong>${matchedClient.lastCheckIn}</strong> with a weight of <strong>${latest.weight || matchedClient.weight}kg</strong>.`;
                    if (latest.sleep) statusDetails += ` Sleep average is ${latest.sleep}h.`;
                    if (latest.steps) statusDetails += ` Steps: ${latest.steps.toLocaleString()}.`;
                } else {
                    statusDetails += ` No daily check-in logs recorded yet. Starting weight is ${matchedClient.starting_weight || '75'}kg.`;
                }

                if (clientWorkouts.length > 0) {
                    statusDetails += ` They have <strong>${clientWorkouts.length}</strong> active workout session(s) assigned in their training program.`;
                } else {
                    statusDetails += ` They do not have any workouts assigned currently.`;
                }

                response = `${matchedClient.name} is working towards <strong>${matchedClient.goal || 'Performance'}</strong>. ${statusDetails}`;
            } else if (query.includes('list') || query.includes('clients') || query.includes('roster')) {
                const list = clients.map(c => `<li>${c.name} (Adherence: ${c.adherence}%, Status: ${c.status})</li>`).join('');
                response = `Here is your current active roster: <ul class="list-disc list-inside mt-2 space-y-1">${list}</ul>`;
            } else if (query.includes('protein') || query.includes('macro') || query.includes('diet') || query.includes('calories')) {
                // Look for clients with status anomalies
                const warningClients = clients.filter(c => c.status === 'Health Alert' || c.status === 'Warning');
                if (warningClients.length > 0) {
                    const names = warningClients.map(c => c.name).join(', ');
                    response = `Looking at macro targets this week: ${names} have alert/warning flags. Please specify a client name to retrieve detailed nutrition logs.`;
                } else {
                    response = `Macro compliance and calorie trends are currently within normal thresholds for all active clients.`;
                }
            } else if (query.includes('hello') || query.includes('hi') || query.includes('help')) {
                response = `Hello Coach! I've loaded your client database. Ask me questions about weight plateaus, missed check-ins, or macro updates.`;
            }

            appendMessage('assistant', response);
        }, 800);
    }

    // Dynamic alerts feed rendering
    function renderAlertsFeed() {
        if (!alertsFeedContainer) return;
        
        const alertClients = clients.filter(c => c.status === 'Critical' || c.status === 'Health Alert' || c.status === 'Warning');
        const alertCount = alertClients.length;
        
        let headerHtml = `
            <div class="flex justify-between items-center mb-2">
                <h2 class="font-headline-md text-headline-md text-on-surface">Priority Alerts</h2>
                <span class="badge-warning font-label-caps text-label-caps px-2 py-1 rounded-full flex items-center gap-1 ${alertCount === 0 ? 'hidden' : ''}">
                    <span class="material-symbols-outlined text-[14px]">warning</span>
                    <span>${alertCount} Action${alertCount > 1 ? 's' : ''} Req</span>
                </span>
            </div>
        `;
        
        let cardsHtml = '';
        if (alertCount === 0) {
            cardsHtml = `
                <div class="flex flex-col items-center justify-center py-16 px-4 bg-surface-container/30 border border-base rounded-xl text-center">
                    <span class="material-symbols-outlined text-[48px] text-[#22c55e] mb-3">task_alt</span>
                    <h3 class="font-headline-md text-primary text-sm font-semibold mb-1">Roster is healthy</h3>
                    <p class="text-xs text-on-surface-variant">No alerts or potential plateau concerns detected today.</p>
                </div>
            `;
        } else {
            alertClients.forEach(c => {
                let evidenceList = '';
                let actionsHtml = '';
                
                if (c.status === 'Critical') {
                    evidenceList = `
                        <li>Adherence dropped to <span class="font-stat-mono text-stat-mono text-error font-semibold">${c.adherence}%</span>.</li>
                        <li>Last check-in was logged <span class="font-stat-mono text-stat-mono text-[#a1a1aa]">${c.lastCheckIn}</span>.</li>
                    `;
                    actionsHtml = `
                        <button class="btn-primary px-4 py-2 rounded-lg font-body-sm text-body-sm transition-transform active:scale-95 btn-alert-msg shadow-[0_0_15px_rgba(217,249,157,0.1)]" data-id="${c.id}">Message ${c.name.split(' ')[0]}</button>
                        <button class="btn-secondary px-4 py-2 rounded-lg font-body-sm text-body-sm transition-transform active:scale-95 btn-alert-resolve" data-id="${c.id}">Mark Healthy</button>
                    `;
                } else if (c.status === 'Health Alert') {
                    const cCheckins = window.appState.checkins.filter(ch => ch.clientId === c.id);
                    const sleepStr = cCheckins.length > 0 ? `${cCheckins[0].sleep}h` : 'low';
                    evidenceList = `
                        <li>Reported poor sleep: average <span class="font-stat-mono text-stat-mono text-error font-semibold">${sleepStr}</span>.</li>
                        <li>High fatigue levels flagged during exercise routines.</li>
                    `;
                    actionsHtml = `
                        <button class="btn-primary px-4 py-2 rounded-lg font-body-sm text-body-sm transition-transform active:scale-95 btn-alert-adjust" data-id="${c.id}">Adjust Calories</button>
                        <button class="btn-secondary px-4 py-2 rounded-lg font-body-sm text-body-sm transition-transform active:scale-95 btn-alert-msg" data-id="${c.id}">Message ${c.name.split(' ')[0]}</button>
                    `;
                } else { // Warning
                    evidenceList = `
                        <li>Weight trend flat or increasing against calorie target.</li>
                        <li>Daily macronutrient targets not matched.</li>
                    `;
                    actionsHtml = `
                        <button class="btn-primary px-4 py-2 rounded-lg font-body-sm text-body-sm transition-transform active:scale-95 btn-alert-adjust" data-id="${c.id}">Adjust Calorie Target</button>
                        <button class="btn-secondary px-4 py-2 rounded-lg font-body-sm text-body-sm transition-transform active:scale-95 btn-alert-msg" data-id="${c.id}">Message ${c.name.split(' ')[0]}</button>
                    `;
                }
                
                cardsHtml += `
                    <div class="card-surface rounded-xl p-unit-lg flex flex-col gap-4">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant">
                                    <span class="material-symbols-outlined text-warning text-yellow-500">${c.status === 'Critical' ? 'trending_down' : (c.status === 'Health Alert' ? 'bed' : 'warning')}</span>
                                </div>
                                <div>
                                    <h3 class="font-headline-md text-headline-md text-on-surface text-[18px]">${c.status} Alert: ${c.name}</h3>
                                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">Goal: ${c.goal}</p>
                                </div>
                            </div>
                            <span class="font-label-caps text-label-caps text-on-surface-variant">TODAY</span>
                        </div>
                        <div class="bg-[#09090b] rounded-lg p-4 border border-[#27272a] flex flex-col gap-2">
                            <h4 class="font-label-caps text-label-caps text-on-surface-variant">EVIDENCE</h4>
                            <ul class="font-body-sm text-body-sm text-on-surface list-disc list-inside space-y-1">
                                ${evidenceList}
                            </ul>
                        </div>
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${actionsHtml}
                        </div>
                    </div>
                `;
            });
        }
        
        alertsFeedContainer.innerHTML = headerHtml + cardsHtml;
        
        // Wire events on new buttons
        alertsFeedContainer.querySelectorAll('.btn-alert-msg').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                window.location.hash = `inbox/${id}`;
            };
        });
        
        alertsFeedContainer.querySelectorAll('.btn-alert-resolve').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                try {
                    await window.appState.resolveClientAlert(id, 'Healthy');
                    renderAlertsFeed();
                } catch (err) {
                    alert(`Failed to resolve alert: ${err.message}`);
                }
            };
        });
        
        alertsFeedContainer.querySelectorAll('.btn-alert-adjust').forEach(btn => {
            btn.onclick = () => {
                window.location.hash = `builder`;
            };
        });
    }

    // Attach input events
    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    });

    // Clear static mock messages and load custom greeting message
    chatContainer.innerHTML = '';
    const alertClients = clients.filter(c => c.status === 'Critical' || c.status === 'Health Alert' || c.status === 'Warning');
    const greetingText = `Good morning, Coach. I've analyzed your roster. You have ${alertClients.length} priority alert(s) today. How can I assist you further?`;
    appendMessage('assistant', greetingText);

    // Initial alert feed rendering
    renderAlertsFeed();
};
