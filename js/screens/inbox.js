// Controller for Inbox / Chat screen
window.init_inbox = function (params) {
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

    function cleanAiResponse(text) {
        if (!text) return '';
        let cleaned = text;
        // Strip raw UUIDs
        cleaned = cleaned.replace(/\s*\(id:\s*[a-f0-9-]{36}\)/gi, '');
        cleaned = cleaned.replace(/\s*id:\s*[a-f0-9-]{36}/gi, '');
        // Strip markdown hashes ###, ##, #
        cleaned = cleaned.replace(/###+\s*/g, '');
        cleaned = cleaned.replace(/##\s*/g, '');
        cleaned = cleaned.replace(/#\s*/g, '');
        // Strip wrapping quotes
        cleaned = cleaned.replace(/^["']|["']$/g, '');
        return cleaned.trim();
    }

    // Dynamic Live LLM Smart Reply Generator for Inbox (via /api/ai Vercel Proxy)
    async function updateAiSmartReply(client) {
        if (!aiSuggestionBox) return;

        const history = window.appState.inbox[client.id] || window.appState.inbox[client.user_id] || [];
        const lastMsg = history[history.length - 1];

        // Show smart reply whenever last message was sent by the client
        if (!lastMsg || lastMsg.sender !== 'client') {
            aiSuggestionBox.style.display = 'none';
            return;
        }

        aiSuggestionBox.style.display = 'block';
        if (aiSuggestionReason) aiSuggestionReason.textContent = `Analyzing ${client.name}'s latest message: "${lastMsg.text}"...`;
        if (aiSuggestionText) aiSuggestionText.innerHTML = `<span class="text-on-surface-variant font-mono animate-pulse">Generating 2nd-Coach AI suggested reply...</span>`;

        const systemInstruction = `You are CoachOS 2nd-Coach AI, an elite co-coach assisting fitness coaches.
Athlete Profile: ${client.name}, Goal: ${client.goal || 'Fat Loss'}, Daily Targets: ${client.target_calories || 2000} kcal | ${client.target_steps || 10000} steps.
The athlete sent the following message to their coach: "${lastMsg.text}".

Your Job:
Draft a warm, professional, encouraging, and actionable response that the coach can send back to the athlete.
If the athlete reports feeling unwell or sick, recommend prioritizing hydration, light steps/recovery, and resting from intense lifting.
STRICT RULES:
- NEVER use markdown headers like ### or ##.
- NEVER output database IDs or UUIDs.
- Do not wrap the response in quotation marks.
- Keep the reply concise (2-3 sentences), empathetic, and ready to send directly.`;

        let replyText = '';

        try {
            if (typeof window.logEvent === 'function') window.logEvent('info', 'Generating Inbox Smart Reply via AI Proxy');
            const res = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Draft Coach Reply:',
                    systemInstruction: systemInstruction
                })
            });

            if (res.ok) {
                const data = await res.json();
                replyText = data.text || '';
                if (typeof window.logEvent === 'function') window.logEvent('success', 'Smart Reply generated successfully');
            } else {
                console.warn("Vercel AI Proxy returned non-ok status for smart reply:", res.status);
            }
        } catch (e) {
            console.warn("Vercel AI Proxy call failed for smart reply:", e);
        }

        // Fallback text if offline
        if (!replyText) {
            replyText = `Hey ${client.name.split(' ')[0]}! Absolutely, listen to your body today. Focus on hydration, hit light steps if you feel up to it, and prioritize recovery over heavy training. Let me know how you feel tomorrow! 💪`;
        }

        if (aiSuggestionReason) aiSuggestionReason.textContent = `2nd-Coach AI Suggested Reply for ${client.name}:`;
        if (aiSuggestionText) aiSuggestionText.textContent = cleanAiResponse(replyText);
    }

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

    let searchQuery = '';
    const searchInput = document.getElementById('inbox-client-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            renderContacts();
        };
    }

    function renderContacts() {
        if (!contactListContainer) return;
        contactListContainer.innerHTML = '';

        let list = clients;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = clients.filter(c => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)));
        }

        list.forEach(client => {
            const btn = document.createElement('button');
            const isActive = client.id === activeClientId;
            btn.className = `w-full text-left p-unit-md rounded-xl border transition-all flex gap-unit-md items-start ${isActive ? 'bg-surface-container-high border-outline-variant' : 'hover:bg-surface-container-low border-transparent'
                }`;

            const history = window.appState.inbox[client.id] || (client.user_id && window.appState.inbox[client.user_id]) || [];
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

        // Trigger Live AI Smart Reply generation
        updateAiSmartReply(client);

        // Render message history
        if (messageHistoryContainer) {
            messageHistoryContainer.innerHTML = '';

            const history = window.appState.inbox[client.id] || (client.user_id && window.appState.inbox[client.user_id]) || [];
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
                bioEl.textContent = bioParts.join(' • ') || 'Intermediate';
            }
            if (goalEl) goalEl.textContent = client.goal || 'Fat Loss';
            if (adherenceBar) adherenceBar.style.width = `${client.adherence}%`;
            if (adherencePercent) adherencePercent.textContent = `${client.adherence}% to milestone`;
            if (adherenceVal) {
                adherenceVal.textContent = `${client.adherence}%`;
                adherenceVal.className = `font-stat-mono text-headline-md profile-adherence-val ${client.adherence < 75 ? 'text-error' : 'text-[#22c55e]'}`;
            }
            if (weightVal) weightVal.textContent = `${client.weight || client.starting_weight || 75} kg`;

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

    // Audio chime generator using Web Audio API for WhatsApp-like feel
    function playChime(isIncoming = true) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';

            if (isIncoming) {
                osc1.frequency.setValueAtTime(659.25, now);
                osc2.frequency.setValueAtTime(987.77, now + 0.08);
            } else {
                osc1.frequency.setValueAtTime(783.99, now);
                osc2.frequency.setValueAtTime(1046.50, now + 0.05);
            }

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now + 0.08);
            osc1.stop(now + 0.25);
            osc2.stop(now + 0.25);
        } catch (e) { }
    }

    function appendMessageBubble(msg) {
        if (!messageHistoryContainer) return;

        // 1. Exact ID match check
        if (msg.id && messageHistoryContainer.querySelector(`[data-msg-id="${msg.id}"]`)) {
            return;
        }

        // 2. Optimistic temp ID match -> update ID to real DB UUID without adding second bubble
        const existingTemp = Array.from(messageHistoryContainer.children).find(el => {
            const textEl = el.querySelector('p');
            return textEl && textEl.textContent.trim() === msg.text.trim() && el.getAttribute('data-msg-id')?.startsWith('temp-');
        });

        if (existingTemp && msg.id && !msg.id.startsWith('temp-')) {
            existingTemp.setAttribute('data-msg-id', msg.id);
            return;
        }

        // Clear empty state if present
        const emptyMsg = messageHistoryContainer.querySelector('p.text-center');
        if (emptyMsg) emptyMsg.remove();

        const isCoach = msg.sender === 'coach';
        const msgWrapper = document.createElement('div');
        msgWrapper.setAttribute('data-msg-id', msg.id || ('temp-' + Date.now()));
        msgWrapper.className = `flex flex-col gap-1 max-w-[80%] ${isCoach ? 'items-end self-end' : 'items-start'} transition-all animate-fadeIn`;

        msgWrapper.innerHTML = `
            <div class="${isCoach ? 'bg-[#27272a] border border-[#44483b] text-primary' : 'bg-[#18181b] border border-[#27272a] text-on-surface'} p-unit-md rounded-2xl ${isCoach ? 'rounded-tr-sm' : 'rounded-tl-sm'} shadow-md">
                <p class="font-body-sm text-[15px] leading-relaxed">${msg.text}</p>
            </div>
            <span class="font-body-sm text-[11px] text-on-surface-variant ${isCoach ? 'mr-1' : 'ml-1'}">${msg.time}</span>
        `;
        messageHistoryContainer.appendChild(msgWrapper);

        // Smooth scroll to bottom
        messageHistoryContainer.scrollTo({
            top: messageHistoryContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    async function sendMessage() {
        if (!textarea) return;
        const text = textarea.value.trim();
        if (!text) return;

        textarea.value = '';
        textarea.focus();

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const localMsg = {
            id: 'temp-' + Date.now(),
            sender: 'coach',
            text: text,
            time: timeStr
        };

        // Hide AI Smart Reply Box after coach sends a message
        if (aiSuggestionBox) aiSuggestionBox.style.display = 'none';

        // 1. Instant Optimistic UI append (WhatsApp style)
        appendMessageBubble(localMsg);
        playChime(false);
        renderContacts();

        // 2. Persist to appState & Supabase in background
        try {
            await window.appState.sendMessage(activeClientId, 'coach', text);
            renderContacts();
        } catch (err) {
            console.error('Failed to send message:', err);
            showToast(`Message failed to send: ${err.message}`, 'error', 'Message Error');
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

    // 1-Click "Use Reply" (Sends AI Smart Reply directly)
    if (useReplyBtn) {
        useReplyBtn.onclick = () => {
            if (aiSuggestionText) {
                const text = aiSuggestionText.textContent.trim();
                if (text && !text.includes('Generating 2nd-Coach AI')) {
                    if (textarea) textarea.value = text;
                    sendMessage();
                }
            }
        };
    }

    // 1-Click "Edit & Send" (Copies AI Smart Reply into textarea for editing)
    if (editReplyBtn) {
        editReplyBtn.onclick = () => {
            if (aiSuggestionText && textarea) {
                const text = aiSuggestionText.textContent.trim();
                if (text && !text.includes('Generating 2nd-Coach AI')) {
                    textarea.value = text;
                    textarea.focus();
                }
            }
        };
    }

    if (closeReplyBtn && aiSuggestionBox) {
        closeReplyBtn.onclick = () => {
            aiSuggestionBox.style.display = 'none';
        };
    }

    // Global handler for incoming realtime messages on Inbox screen
    window.onRealtimeMessageReceived = (msg) => {
        console.log('⚡ Coach Inbox View Received Realtime Message:', msg);
        if (msg.conversation_id === activeClientId || !msg.conversation_id) {
            appendMessageBubble(msg);
            if (msg.sender === 'client') playChime(true);
        } else {
            if (msg.sender === 'client') playChime(true);
        }
        renderContacts();

        // Re-generate smart reply when client sends a message
        const currentClient = clients.find(c => c.id === activeClientId);
        if (currentClient) updateAiSmartReply(currentClient);
    };

    // Initial load state setting
    if (params && params.id && inboxContainer) {
        inboxContainer.classList.add('mobile-show-chat');
    }

    // Initialize screen components
    renderContacts();
    renderChat();
};
