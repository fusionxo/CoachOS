// Controller for Inbox / Chat screen
window.init_inbox = function(params) {
    const clients = window.appState.clients;
    const defaultClientId = clients[0] ? clients[0].id : '';
    let activeClientId = (params && params.id) || defaultClientId;
    
    const emptyState = document.getElementById('inbox-empty-state');
    const listPane = document.querySelector('.inbox-list-pane');
    const chatPane = document.querySelector('.inbox-chat-pane');
    const desktopProfile = document.getElementById('desktop-client-profile');

    if (clients.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('flex');
        if (listPane) listPane.classList.add('hidden');
        if (chatPane) chatPane.classList.add('hidden');
        if (desktopProfile) desktopProfile.classList.add('hidden');
        return;
    } else {
        // Fallback activeClientId to first client if not found in live clients list
        if (!clients.find(c => c.id === activeClientId)) {
            activeClientId = clients[0].id;
        }

        if (emptyState) emptyState.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('flex');
        if (listPane) listPane.classList.remove('hidden');
        if (chatPane) chatPane.classList.remove('hidden');
        if (desktopProfile) {
            // Only show desktop profile on desktop layouts if not hidden in layout
            desktopProfile.classList.remove('hidden');
        }
    }
    
    // Select containers
    const inboxContainer = document.querySelector('.inbox-container');
    const contactListContainer = document.querySelector('.inbox-list-pane .flex-grow');
    const chatHeaderTitle = document.querySelector('section header h2');
    const chatHeaderStatus = document.querySelector('section header p');
    const messageHistoryContainer = document.querySelector('.messages-flow');
    const textarea = document.querySelector('section textarea');
    const sendBtn = document.querySelector('.btn-send-message');
    
    // AI Suggestion Box elements
    const aiSuggestionBox = document.getElementById('ai-suggestion-box');
    const aiSuggestionReason = document.getElementById('ai-suggestion-reason');
    const aiSuggestionText = document.getElementById('ai-suggestion-text');
    const useReplyBtn = document.getElementById('btn-use-ai-reply');
    const editReplyBtn = document.querySelector('.btn-edit-ai-reply');
    const closeReplyBtn = document.querySelector('.btn-close-ai-reply');

    // Mobile specific triggers
    const backBtn = document.querySelector('.btn-inbox-back');
    const infoBtn = document.querySelector('.btn-inbox-info');
    const profileDrawer = document.getElementById('inbox-profile-drawer');

    // Setup back button
    if (backBtn && inboxContainer) {
        backBtn.addEventListener('click', () => {
            inboxContainer.classList.remove('mobile-show-chat');
        });
    }

    // Setup profile drawer toggles
    if (infoBtn && profileDrawer) {
        infoBtn.addEventListener('click', () => {
            profileDrawer.classList.remove('hidden');
            // Force reflow
            profileDrawer.offsetHeight;
            profileDrawer.classList.add('drawer-open');
        });
    }

    if (profileDrawer) {
        profileDrawer.querySelectorAll('.drawer-close-trigger').forEach(el => {
            el.addEventListener('click', () => {
                profileDrawer.classList.remove('drawer-open');
                setTimeout(() => {
                    profileDrawer.classList.add('hidden');
                }, 300);
            });
        });
    }

    function renderContacts() {
        if (!contactListContainer) return;
        contactListContainer.innerHTML = '';

        clients.forEach(client => {
            const btn = document.createElement('button');
            const isActive = client.id === activeClientId;
            btn.className = `w-full text-left p-unit-md rounded-xl border transition-all flex gap-unit-md items-start ${
                isActive ? 'bg-surface-container-high border-outline-variant' : 'hover:bg-surface-container-low border-transparent'
            }`;

            const history = window.appState.inbox[client.id] || [];
            const lastMessage = history.length > 0 
                ? history[history.length - 1].text 
                : 'No messages yet';

            const badgeHtml = client.status !== 'Healthy' 
                ? `<div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container/30 border border-error-container text-error text-[10px] font-semibold uppercase tracking-wider mt-2">
                     <span class="material-symbols-outlined text-[12px]">warning</span> ${client.status}
                   </div>`
                : '';

            const avatarHtml = client.avatar && client.avatar.startsWith('http')
                ? `<img alt="Avatar" class="w-12 h-12 rounded-full object-cover border border-[#27272a]" src="${client.avatar}">`
                : `<div class="w-12 h-12 rounded-full bg-[#1f201a] border border-[#27272a] flex items-center justify-center font-bold text-[#c5c8b7]">${client.avatar || client.name.split(' ').map(n => n[0]).join('').toUpperCase()}</div>`;

            btn.innerHTML = `
                <div class="relative shrink-0">
                    ${avatarHtml}
                    <span class="absolute bottom-0 right-0 w-3 h-3 ${client.status === 'Critical' || client.status === 'Health Alert' ? 'bg-error' : (client.status === 'Warning' ? 'bg-[#facc15]' : 'bg-[#22c55e]')} rounded-full border-2 border-surface-container-high"></span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline mb-1">
                        <h3 class="font-body-base ${isActive ? 'text-primary font-bold' : 'text-on-surface'} font-medium truncate">${client.name}</h3>
                        <span class="font-body-sm text-[11px] text-on-surface-variant shrink-0">10:42 AM</span>
                    </div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${lastMessage}</p>
                    ${badgeHtml}
                </div>
            `;

            btn.addEventListener('click', () => {
                activeClientId = client.id;
                renderContacts();
                renderChat();
                
                // Show chat pane on mobile
                if (inboxContainer) {
                    inboxContainer.classList.add('mobile-show-chat');
                }
            });

            contactListContainer.appendChild(btn);
        });
    }

    function renderChat() {
        const client = clients.find(c => c.id === activeClientId) || clients[0];
        if (!client) return;

        // Set textarea placeholder
        if (textarea) textarea.placeholder = `Message ${client.name}...`;

        // Update header details
        if (chatHeaderTitle) {
            chatHeaderTitle.innerHTML = `
                ${client.name}
                <span class="w-2 h-2 rounded-full ${client.status === 'Critical' || client.status === 'Health Alert' ? 'bg-error' : (client.status === 'Warning' ? 'bg-[#facc15]' : 'bg-[#22c55e]')} animate-pulse"></span>
            `;
        }
        if (chatHeaderStatus) {
            chatHeaderStatus.innerHTML = `
                <span class="material-symbols-outlined text-[14px]">schedule</span>
                Last active: ${client.lastCheckIn}
            `;
        }

        // Show/hide AI suggestion box dynamically
        if (aiSuggestionBox) {
            if (client.status === 'Critical' || client.status === 'Health Alert' || client.status === 'Warning') {
                aiSuggestionBox.style.display = 'block';
                
                // Calculate dynamic reasoning/suggestion
                let suggestion = { reason: '', text: '' };
                if (client.status === 'Critical') {
                    suggestion = {
                        reason: `${client.name} has missed check-ins (Last check-in: ${client.lastCheckIn}). Churn risk is high.`,
                        text: `"Hey ${client.name.split(' ')[0]}, noticed you haven't checked in recently and completely understand that life gets busy! Don't sweat the missed days—let's focus on what we can control. Want to jump on a quick 5-min call to adjust this week's plan?"`
                    };
                } else if (client.status === 'Health Alert') {
                    suggestion = {
                        reason: `${client.name} reported sleep issues (Avg: ${client.sleep}) and low energy. HRV is declining.`,
                        text: `"Hey ${client.name.split(' ')[0]}, I looked over your check-ins and noticed sleep has been tough lately. Let's pull back training volume by 20% this week to prioritize recovery. Sleep is where the gains happen!"`
                    };
                } else {
                    suggestion = {
                        reason: `${client.name} has macro compliance below target. Weight trend is flat.`,
                        text: `"Hey ${client.name.split(' ')[0]}, let's review your macros. Are you having trouble hitting the protein target, or is meal prep getting in the way? Let's troubleshoot together!"`
                    };
                }

                if (aiSuggestionReason) aiSuggestionReason.textContent = suggestion.reason;
                if (aiSuggestionText) aiSuggestionText.textContent = suggestion.text;
            } else {
                aiSuggestionBox.style.display = 'none';
            }
        }

        // Render message history
        if (messageHistoryContainer) {
            messageHistoryContainer.innerHTML = '';

            const history = window.appState.inbox[client.id] || [];
            if (history.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.className = 'text-center text-xs text-on-surface-variant italic py-8';
                emptyMsg.textContent = `No messages with ${client.name} yet. Send a message to start the conversation!`;
                messageHistoryContainer.appendChild(emptyMsg);
            } else {
                history.forEach(msg => {
                    const isCoach = msg.sender === 'coach';
                    const msgWrapper = document.createElement('div');
                    msgWrapper.className = `flex flex-col gap-1 max-w-[80%] ${isCoach ? 'items-end self-end' : 'items-start'}`;

                    msgWrapper.innerHTML = `
                        <div class="${isCoach ? 'bg-[#27272a] border border-[#44483b] text-primary' : 'bg-[#18181b] border border-[#27272a] text-on-surface'} p-unit-md rounded-2xl ${isCoach ? 'rounded-tr-sm' : 'rounded-tl-sm'} shadow-md">
                            <p class="font-body-sm text-[15px] leading-relaxed">${msg.text}</p>
                        </div>
                        <span class="font-body-sm text-[11px] text-on-surface-variant ${isCoach ? 'mr-1' : 'ml-1'}">${msg.time}</span>
                    `;
                    messageHistoryContainer.appendChild(msgWrapper);
                });
            }

            // Scroll to bottom
            setTimeout(() => {
                messageHistoryContainer.scrollTop = messageHistoryContainer.scrollHeight;
            }, 50);
        }

        // Update profile cards in both desktop panel and mobile drawer
        const profilePanels = [
            document.getElementById('desktop-client-profile'),
            document.getElementById('inbox-profile-drawer')
        ];

        profilePanels.forEach(panel => {
            if (!panel) return;

            const nameEl = panel.querySelector('.profile-name');
            const bioEl = panel.querySelector('.profile-bio');
            const goalEl = panel.querySelector('.profile-goal');
            const avatarImg = panel.querySelector('.profile-avatar');
            const adherenceBar = panel.querySelector('.profile-adherence-bar');
            const adherencePercent = panel.querySelector('.profile-adherence-percent');
            const adherenceVal = panel.querySelector('.profile-adherence-val');
            const weightVal = panel.querySelector('.profile-weight-val');
            const scheduleBtn = panel.querySelector('.btn-profile-schedule');
            const metricsBtn = panel.querySelector('.btn-profile-metrics');

            if (nameEl) nameEl.textContent = client.name;
            if (bioEl) {
                const heightStr = client.height ? `${client.height}cm` : '';
                const weightStr = client.starting_weight ? `${client.starting_weight}kg` : '';
                const expStr = client.experience_level || '';
                const bioParts = [heightStr, weightStr, expStr].filter(p => p !== '');
                bioEl.textContent = bioParts.join(' • ') || 'Client';
            }
            if (goalEl) goalEl.textContent = client.goal;
            if (adherenceBar) adherenceBar.style.width = `${client.adherence}%`;
            if (adherencePercent) adherencePercent.textContent = `${client.adherence}% to milestone`;
            if (adherenceVal) {
                adherenceVal.textContent = `${client.adherence}%`;
                adherenceVal.className = `font-stat-mono text-headline-md profile-adherence-val ${client.adherence < 75 ? 'text-error' : 'text-[#22c55e]'}`;
            }
            if (weightVal) weightVal.textContent = client.weight;

            if (avatarImg) {
                if (client.avatar && client.avatar.startsWith('http')) {
                    avatarImg.src = client.avatar;
                    avatarImg.style.display = 'block';
                    const placeholder = avatarImg.parentElement.querySelector('.initials-placeholder');
                    if (placeholder) placeholder.remove();
                } else {
                    avatarImg.style.display = 'none';
                    let placeholder = avatarImg.parentElement.querySelector('.initials-placeholder');
                    if (!placeholder) {
                        placeholder = document.createElement('div');
                        placeholder.className = 'initials-placeholder w-full h-full bg-[#1f201a] border-2 border-[#27272a] flex items-center justify-center font-bold text-3xl text-primary rounded-full absolute inset-0';
                        avatarImg.parentElement.appendChild(placeholder);
                    }
                    placeholder.textContent = client.avatar || client.name.split(' ').map(n => n[0]).join('').toUpperCase();
                }
            }

            if (scheduleBtn) {
                scheduleBtn.onclick = () => window.location.hash = `analytics/${client.id}`;
            }
            if (metricsBtn) {
                metricsBtn.onclick = () => window.location.hash = `analytics/${client.id}`;
            }
        });
    }

    async function sendMessage() {
        if (!textarea) return;
        const text = textarea.value.trim();
        if (!text) return;

        const originalText = textarea.value;
        textarea.value = '';
        textarea.disabled = true;

        try {
            await window.appState.sendMessage(activeClientId, 'coach', text);
            renderContacts();
            renderChat();
        } catch (err) {
            console.error('Failed to send message:', err);
            alert(`Message failed to send: ${err.message}`);
            textarea.value = originalText;
        } finally {
            textarea.disabled = false;
            textarea.focus();
        }
    }

    // Attach sending events
    if (sendBtn) {
        sendBtn.onclick = sendMessage;
    }

    if (textarea) {
        textarea.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
    }

    // Use AI suggestion Reply
    if (useReplyBtn) {
        useReplyBtn.onclick = () => {
            if (aiSuggestionText && textarea) {
                textarea.value = aiSuggestionText.innerText.replace(/"/g, '').trim();
                textarea.focus();
            }
        };
    }

    if (editReplyBtn) {
        editReplyBtn.onclick = () => {
            if (aiSuggestionText && textarea) {
                textarea.value = aiSuggestionText.innerText.replace(/"/g, '').trim();
                textarea.focus();
            }
        };
    }

    if (closeReplyBtn && aiSuggestionBox) {
        closeReplyBtn.onclick = () => {
            aiSuggestionBox.style.display = 'none';
        };
    }

    // Realtime message subscription
    if (window.activeMessageChannel) {
        if (window.supabaseClient) {
            window.supabaseClient.removeChannel(window.activeMessageChannel);
        }
        window.activeMessageChannel = null;
    }

    if (window.supabaseClient) {
        window.activeMessageChannel = window.supabaseClient.channel('realtime:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
                console.log('Realtime message received:', payload);
                await window.appState.refresh();
                renderContacts();
                renderChat();
            })
            .subscribe();
    }

    // Initial load state setting
    if (params && params.id && inboxContainer) {
        inboxContainer.classList.add('mobile-show-chat');
    }

    // Initialize screen components
    renderContacts();
    renderChat();
};
