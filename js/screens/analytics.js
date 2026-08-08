// Controller for Analytics (Client Profile) screen
window.init_analytics = function(params) {
    const defaultClientId = window.appState.clients[0] ? window.appState.clients[0].id : '';
    const clientId = (params && params.id) || defaultClientId;
    const client = window.appState.clients.find(c => c.id === clientId) || window.appState.clients[0];

    if (!client) {
        console.error('Client not found:', clientId);
        window.location.hash = 'clients';
        return;
    }

    console.log('Displaying client analytics for:', client.name);

    // 1. Dynamic Client Header Binding
    const nameEl = document.querySelector('section.card-base h2');
    if (nameEl) nameEl.textContent = client.name;

    const breadcrumbNameEl = document.getElementById('analytics-breadcrumb-name');
    if (breadcrumbNameEl) breadcrumbNameEl.textContent = client.name;

    const startEl = document.getElementById('analytics-start-date');
    if (startEl && client.created_at) {
        const dateObj = new Date(client.created_at);
        const options = { month: 'short', day: 'numeric', year: '2-digit' };
        startEl.textContent = dateObj.toLocaleDateString('en-US', options);
    }

    const goalValEl = document.querySelector('section.card-base .grid-cols-2 .data-card:nth-child(1) span:nth-child(2), section.card-base .flex-wrap .data-card:nth-child(1) span:nth-child(2)');
    if (goalValEl) goalValEl.textContent = client.goal;

    const phaseValEl = document.querySelector('section.card-base .grid-cols-2 .data-card:nth-child(2) span:nth-child(2), section.card-base .flex-wrap .data-card:nth-child(2) span:nth-child(2)');
    if (phaseValEl) phaseValEl.textContent = client.phase;

    // Set client status styling
    const statusLabel = document.querySelector('section.card-base .absolute.pointer-events-none + div, section.card-base .relative + div');
    if (statusLabel) {
        statusLabel.className = client.status === 'Inactive'
            ? 'absolute bottom-2 right-2 bg-neutral-800 border border-neutral-700 text-neutral-400 px-2 py-1 rounded-md flex items-center gap-1 font-label-caps text-label-caps backdrop-blur-sm'
            : 'absolute bottom-2 right-2 bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] px-2 py-1 rounded-md flex items-center gap-1 font-label-caps text-label-caps backdrop-blur-sm';
        statusLabel.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${client.status === 'Inactive' ? 'bg-neutral-500' : 'bg-[#22c55e] animate-pulse'}"></span> ${client.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE'}`;
    }

    // Load avatar
    const imgEl = document.querySelector('section.card-base img');
    if (imgEl) {
        if (client.avatar && client.avatar.startsWith('http')) {
            imgEl.src = client.avatar;
            imgEl.style.display = 'block';
            const initialsPlaceholder = imgEl.parentElement.querySelector('.initials-placeholder');
            if (initialsPlaceholder) initialsPlaceholder.remove();
        } else {
            imgEl.style.display = 'none';
            let initialsPlaceholder = imgEl.parentElement.querySelector('.initials-placeholder');
            if (!initialsPlaceholder) {
                initialsPlaceholder = document.createElement('div');
                initialsPlaceholder.className = 'initials-placeholder absolute inset-0 flex items-center justify-center font-bold text-4xl bg-[#1f201a] text-primary rounded-2xl';
                imgEl.parentElement.appendChild(initialsPlaceholder);
            }
            initialsPlaceholder.textContent = client.avatar || client.name.split(' ').map(n => n[0]).join('').toUpperCase();
        }
    }

    // 2. Active Tab Switching
    const tabs = document.querySelectorAll('#profile-tabs button');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.onclick = () => {
            // Remove active classes
            tabs.forEach(t => {
                t.className = 'pb-3 text-on-surface-variant hover:text-primary whitespace-nowrap px-1 transition-colors';
            });
            // Add active classes
            tab.className = 'pb-3 text-primary font-semibold tab-active whitespace-nowrap px-1 transition-colors border-b-2 border-primary';

            // Show target pane
            const targetTab = tab.getAttribute('data-tab');
            panes.forEach(pane => {
                if (pane.id === `tab-pane-${targetTab}`) {
                    pane.classList.remove('hidden');
                } else {
                    pane.classList.add('hidden');
                }
            });
        };
    });

    // 3. Tab Panes Rendering & Logic

    // --- OVERVIEW TAB ---
    function renderOverview() {
        const clientCheckins = window.appState.checkins.filter(c => c.clientId === client.id).sort((a,b) => new Date(a.date) - new Date(b.date));
        
        // Weight Display
        const weightValEl = document.getElementById('overview-weight-val');
        if (weightValEl) {
            weightValEl.innerHTML = `${client.weight} <span class="text-sm text-on-surface-variant font-body-base">kg</span>`;
        }

        // Weight Delta
        const weightDeltaEl = document.getElementById('overview-weight-delta');
        if (weightDeltaEl && clientCheckins.length > 0) {
            const firstW = clientCheckins[0].weight;
            const lastW = parseFloat(client.weight);
            const diff = lastW - firstW;
            if (diff < 0) {
                weightDeltaEl.className = 'text-xs text-[#22c55e] flex items-center justify-end gap-1 font-medium';
                weightDeltaEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">arrow_downward</span> ${diff.toFixed(1)} kg`;
            } else if (diff > 0) {
                weightDeltaEl.className = 'text-xs text-error flex items-center justify-end gap-1 font-medium';
                weightDeltaEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">arrow_upward</span> +${diff.toFixed(1)} kg`;
            } else {
                weightDeltaEl.className = 'text-xs text-on-surface-variant flex items-center justify-end gap-1 font-medium';
                weightDeltaEl.innerHTML = `No change`;
            }
        }

        // SVG Weight Chart
        drawWeightChart(clientCheckins);

        // Adherence Card
        const adherenceValEl = document.getElementById('overview-adherence-val');
        const adherenceBarEl = document.getElementById('overview-adherence-bar');
        if (adherenceValEl) adherenceValEl.textContent = `${client.adherence}%`;
        if (adherenceBarEl) adherenceBarEl.style.width = `${client.adherence}%`;

        // Sleep Card
        const sleepValEl = document.getElementById('overview-sleep-val');
        const sleepStatusEl = document.getElementById('overview-sleep-status');
        if (sleepValEl) sleepValEl.textContent = client.sleep;
        if (sleepStatusEl) {
            const hrs = parseFloat(client.sleep);
            if (hrs < 7) {
                sleepStatusEl.className = 'flex items-center gap-2 text-xs text-[#f87171] font-medium';
                sleepStatusEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">warning</span> Below 7h target`;
            } else {
                sleepStatusEl.className = 'flex items-center gap-2 text-xs text-[#22c55e] font-medium';
                sleepStatusEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">check_circle</span> Target met (7h)`;
            }
        }

        // Steps Card
        const stepsValEl = document.getElementById('overview-steps-val');
        const stepsStatusEl = document.getElementById('overview-steps-status');
        if (stepsValEl) stepsValEl.textContent = client.steps;
        if (stepsStatusEl) {
            const count = parseInt(client.steps.replace(/[^0-9]/g, '')) || 0;
            if (count < 10000) {
                stepsStatusEl.className = 'flex items-center gap-2 text-xs text-[#facc15] font-medium';
                stepsStatusEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">warning</span> Below 10k target`;
            } else {
                stepsStatusEl.className = 'flex items-center gap-2 text-xs text-[#22c55e] font-medium';
                stepsStatusEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">check_circle</span> Target met (10k)`;
            }
        }

        // Photos Comparison Slider Mount
        const photosSlider = document.getElementById('overview-photos-slider');
        if (photosSlider) {
            const clientPhotos = window.appState.progressPhotos.filter(p => p.clientId === client.id);
            if (clientPhotos.length > 0) {
                const earliest = clientPhotos[0];
                const latest = clientPhotos[clientPhotos.length - 1];

                const beforeImg = earliest.front || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcNme_YnSQkYty_V5lL6HrAtsgHdpKdKQ-tuwD-dRPRxEdM6EK98Wklg_C2-TjavYfK-ANi8leJ5CRtTex0ka2YIRLgEqT1hRhcrXB7yy1_atVlJqvlsuWL1_1uO7QZ6WSWWbezaPLePg3aQktN-y5G3He4lI9Tx43WT8QtgHzwx4E2rAyuXQWpkVUJY3W71R57pT2LeW96wYD9CDxcR0J_xEwKS2hCynh_7x3k_pwkZ7X5cfAWq8oyOpqa_UUUsuPuG0tWv1tVIg';
                const afterImg = latest.front || 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3rJlWEZT_wH8Bvk3fZG4EeMVDY7o7bmFYzbsN1yRtEOMs5NsPDp_E-8ut46VjcyUV-rjkpbH8W3aVbPs3WvFnCLm6brnjNV8ciVfdUNKdW3Gk7bgf0QlcFCYAqltMimkx-JjUW1_sYwUyYJoKG5WrEma9tebvNk8nZFYrpvpTzbxZU_WBPrB1ykTGlCiMb21S4eKC7JjxvW9jL5BZqa-5VjCpzcHTKgq7mNuyCIloRQ-UUDOlBcjqt65AdSqlhy_Z6Vdnu1Tui8U';

                photosSlider.innerHTML = `
                    <div class="absolute inset-0 flex">
                        <div class="w-1/2 h-full bg-[#18181b] border-r border-[#d9f99d] flex items-center justify-center relative overflow-hidden">
                            <img alt="Before Photo" class="absolute inset-0 w-[200%] max-w-none h-full object-cover opacity-60 grayscale" src="${beforeImg}">
                            <div class="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-stat-mono z-10 text-white">${earliest.date}</div>
                        </div>
                        <div class="w-1/2 h-full bg-[#12140e] flex items-center justify-center relative overflow-hidden">
                            <img alt="After Photo" class="absolute inset-0 w-[200%] max-w-none h-full object-cover -translate-x-1/2 opacity-90" src="${afterImg}">
                            <div class="absolute bottom-2 right-2 bg-primary-container/80 text-on-primary-container px-2 py-1 rounded text-xs font-stat-mono z-10 font-bold">${latest.date}</div>
                        </div>
                    </div>
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#d9f99d] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(217,249,157,0.5)] z-20">
                        <span class="material-symbols-outlined text-[#09090b] text-[16px]">swap_horiz</span>
                    </div>
                `;
            } else {
                photosSlider.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-center p-6 text-on-surface-variant">
                        <span class="material-symbols-outlined text-[32px] mb-2">image_not_supported</span>
                        <p class="text-xs">No progress photos recorded yet.</p>
                    </div>
                `;
            }
        }

        // Key Measurements Mount
        const measureMount = document.getElementById('overview-measurements-mount');
        if (measureMount) {
            measureMount.innerHTML = '';
            const clientMeasures = window.appState.measurements.filter(m => m.clientId === client.id).sort((a,b) => new Date(a.date) - new Date(b.date));
            if (clientMeasures.length > 0) {
                const latestM = clientMeasures[clientMeasures.length - 1];
                const firstM = clientMeasures[0];
                
                const stats = [
                    { name: 'Waist', key: 'waist', color: '#d9f99d' },
                    { name: 'Chest', key: 'chest', color: '#6366f1' },
                    { name: 'Arms', key: 'arms', color: '#818cf8' },
                    { name: 'Legs', key: 'legs', color: '#a855f7' }
                ];

                stats.forEach(s => {
                    const diff = latestM[s.key] - firstM[s.key];
                    let diffHtml = '';
                    if (diff < 0) diffHtml = `<span class="text-xs text-[#22c55e]">${diff.toFixed(1)} cm</span>`;
                    else if (diff > 0) diffHtml = `<span class="text-xs text-error">+${diff.toFixed(1)} cm</span>`;
                    else diffHtml = `<span class="text-xs text-[#a1a1aa]">No change</span>`;

                    const div = document.createElement('div');
                    div.className = 'data-card p-3 rounded-lg flex items-center justify-between';
                    div.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-1.5 h-8 rounded-full" style="background-color: ${s.color}"></div>
                            <div>
                                <div class="text-sm font-medium text-on-surface-variant">${s.name}</div>
                                <div class="text-xs">${diffHtml}</div>
                            </div>
                        </div>
                        <div class="font-stat-mono text-lg text-primary">${latestM[s.key].toFixed(1)}<span class="text-xs text-on-surface-variant ml-1">cm</span></div>
                    `;
                    measureMount.appendChild(div);
                });
            } else {
                measureMount.innerHTML = `
                    <div class="p-4 text-center text-xs text-on-surface-variant">No measurements logged yet.</div>
                `;
            }
        }
    }

    // Function to draw SVG weight chart
    let chartResizeObserver = null;
    function drawWeightChart(clientCheckins) {
        const container = document.getElementById('weight-chart-container');
        if (!container) return;

        // Disconnect previous observer if any
        if (chartResizeObserver) {
            chartResizeObserver.disconnect();
            chartResizeObserver = null;
        }

        function render() {
            if (clientCheckins.length < 2) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-center text-xs text-on-surface-variant">
                        <span class="material-symbols-outlined text-[24px] mb-1">monitoring</span>
                        <p>Not enough check-in weight data. Log daily weight to view trend chart.</p>
                    </div>
                `;
                return;
            }

            const width = container.clientWidth || 500;
            const height = container.clientHeight || 240;

            const weights = clientCheckins.map(c => parseFloat(c.weight));
            const minW = Math.min(...weights) - 1.0;
            const maxW = Math.max(...weights) + 1.0;
            const range = maxW - minW || 1;

            const padding = { top: 25, right: 20, bottom: 25, left: 40 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;

            const points = clientCheckins.map((c, idx) => {
                const x = padding.left + (idx / (clientCheckins.length - 1)) * chartWidth;
                const y = padding.top + chartHeight - ((parseFloat(c.weight) - minW) / range) * chartHeight;
                return { x, y };
            });

            const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
            const areaD = `${pathD} L ${points[points.length-1].x},${height - padding.bottom} L ${points[0].x},${height - padding.bottom} Z`;

            // Draw Y-axis labels & grid lines
            let gridHtml = '';
            const gridLevels = 3;
            for (let i = 0; i < gridLevels; i++) {
                const ratio = i / (gridLevels - 1);
                const val = maxW - ratio * range;
                const y = padding.top + ratio * chartHeight;
                gridHtml += `
                    <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#27272a" stroke-width="1" stroke-dasharray="3,3" />
                    <text x="${padding.left - 8}" y="${y + 4}" fill="#71717a" font-size="10" font-family="JetBrains Mono, monospace" text-anchor="end">${val.toFixed(1)}</text>
                `;
            }

            // Draw X-axis date labels
            let xLabelsHtml = '';
            const totalPoints = clientCheckins.length;
            const labelInterval = Math.max(1, Math.floor(totalPoints / 4));
            clientCheckins.forEach((c, idx) => {
                if (idx === 0 || idx === totalPoints - 1 || idx % labelInterval === 0) {
                    const p = points[idx];
                    const dateObj = new Date(c.date);
                    const formattedDate = !isNaN(dateObj) ? `${dateObj.getMonth() + 1}/${dateObj.getDate()}` : c.date;
                    xLabelsHtml += `
                        <text x="${p.x}" y="${height - padding.bottom + 16}" fill="#71717a" font-size="10" font-family="JetBrains Mono, monospace" text-anchor="middle">${formattedDate}</text>
                    `;
                }
            });

            container.innerHTML = `
                <svg class="w-full h-full" style="display: block;">
                    <defs>
                        <linearGradient id="lineGrad" x1="0%" x2="100%" y1="0%" y2="0%">
                            <stop offset="0%" stop-color="#6366f1"></stop>
                            <stop offset="100%" stop-color="#d9f99d"></stop>
                        </linearGradient>
                        <linearGradient id="areaGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                            <stop offset="0%" stop-color="#d9f99d" stop-opacity="0.15"></stop>
                            <stop offset="100%" stop-color="#d9f99d" stop-opacity="0"></stop>
                        </linearGradient>
                    </defs>
                    <!-- Grid Lines and Y labels -->
                    ${gridHtml}
                    <!-- X labels -->
                    ${xLabelsHtml}
                    <!-- Area Fill -->
                    <path d="${areaD}" fill="url(#areaGrad)"></path>
                    <!-- Line -->
                    <path d="${pathD}" fill="none" stroke="url(#lineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                    
                    <!-- Latest dot -->
                    <circle cx="${points[points.length-1].x}" cy="${points[points.length-1].y}" r="4" fill="#d9f99d"></circle>
                    <circle cx="${points[points.length-1].x}" cy="${points[points.length-1].y}" r="8" fill="none" stroke="#d9f99d" stroke-width="1" opacity="0.5"></circle>
                </svg>
            `;
        }

        // Render first time
        render();

        // Setup ResizeObserver
        if (window.ResizeObserver) {
            chartResizeObserver = new ResizeObserver(() => {
                render();
            });
            chartResizeObserver.observe(container);
        }
    }

    // --- CHECK-INS TAB ---
    const checkinForm = document.getElementById('checkin-log-form');
    const checkinsTbody = document.getElementById('checkins-history-tbody');

    function renderCheckins() {
        if (!checkinsTbody) return;
        checkinsTbody.innerHTML = '';

        const clientCheckins = window.appState.checkins.filter(c => c.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date));

        if (clientCheckins.length === 0) {
            checkinsTbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-on-surface-variant">No check-ins logged yet.</td></tr>`;
        } else {
            clientCheckins.forEach(c => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-[#27272a]/40 hover:bg-[#1f201a]/20 text-on-surface';
                tr.innerHTML = `
                    <td class="py-3 font-semibold">${c.date}</td>
                    <td class="py-3 font-stat-mono">${c.weight} kg</td>
                    <td class="py-3 font-stat-mono">${c.sleep}h</td>
                    <td class="py-3 font-stat-mono">${c.steps.toLocaleString()}</td>
                    <td class="py-3">${c.calories} kcal / ${c.protein}g</td>
                    <td class="py-3">${c.mood}</td>
                    <td class="py-3 font-stat-mono">${'★'.repeat(c.energy)}${'☆'.repeat(5 - c.energy)}</td>
                `;
                checkinsTbody.appendChild(tr);
            });
        }
    }

    if (checkinForm) {
        // Default check-in inputs
        document.getElementById('checkin-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('checkin-weight').value = client.weight;
        document.getElementById('checkin-sleep').value = 7.5;
        document.getElementById('checkin-steps').value = 10000;
        document.getElementById('checkin-calories').value = 2000;
        document.getElementById('checkin-protein').value = 140;

        checkinForm.onsubmit = function(e) {
            e.preventDefault();
            const date = document.getElementById('checkin-date').value;
            const weight = document.getElementById('checkin-weight').value;
            const sleep = document.getElementById('checkin-sleep').value;
            const steps = document.getElementById('checkin-steps').value;
            const mood = document.getElementById('checkin-mood').value;
            const calories = document.getElementById('checkin-calories').value;
            const protein = document.getElementById('checkin-protein').value;
            const energy = document.getElementById('checkin-energy').value;
            const notes = document.getElementById('checkin-notes').value;

            window.appState.saveCheckIn(client.id, {
                date, weight, sleep, steps, mood, calories, protein, energy, notes
            });

            // Re-render
            renderOverview();
            renderCheckins();
            renderTimeline();
            
            checkinForm.reset();
            document.getElementById('checkin-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('checkin-weight').value = client.weight;
            alert('Daily check-in logged successfully!');
        };
    }

    // --- TRAINING TAB ---
    const workoutsListMount = document.getElementById('analytics-workouts-list');
    const btnAddWorkout = document.getElementById('btn-analytics-add-workout');

    function renderTraining() {
        if (!workoutsListMount) return;
        workoutsListMount.innerHTML = '';

        const clientWorkouts = window.appState.workouts.filter(w => w.clientId === client.id);

        if (clientWorkouts.length === 0) {
            workoutsListMount.innerHTML = `
                <div class="card-bg border border-dashed border-outline-variant rounded-xl p-8 text-center text-on-surface-variant text-sm">
                    <p class="mb-3">No active workout programs assigned.</p>
                </div>
            `;
        } else {
            // Group workouts by Program and Week
            const grouped = {};
            clientWorkouts.forEach(w => {
                const prog = w.programName || '12 Week Fat Loss';
                const wk = w.weekName || 'Week 1';
                if (!grouped[prog]) grouped[prog] = {};
                if (!grouped[prog][wk]) grouped[prog][wk] = [];
                grouped[prog][wk].push(w);
            });

            for (const prog in grouped) {
                const progSection = document.createElement('div');
                progSection.className = 'space-y-4 mb-6';
                progSection.innerHTML = `
                    <div class="flex items-center gap-2 border-b border-[#27272a] pb-2">
                        <span class="material-symbols-outlined text-[#ceee93] text-sm">folder</span>
                        <h4 class="text-sm font-bold text-primary uppercase font-label-caps tracking-wider">${prog}</h4>
                    </div>
                `;

                for (const wk in grouped[prog]) {
                    const wkSection = document.createElement('div');
                    wkSection.className = 'pl-4 space-y-3';
                    const safeProgId = prog.replace(/[^a-zA-Z0-9]/g,'');
                    const safeWkId = wk.replace(/[^a-zA-Z0-9]/g,'');
                    wkSection.innerHTML = `
                        <div class="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                            <span class="material-symbols-outlined text-xs text-[#ceee93]">calendar_view_week</span>
                            <span>${wk}</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="workouts-grid-${safeProgId}-${safeWkId}"></div>
                    `;

                    progSection.appendChild(wkSection);
                    const gridMount = wkSection.querySelector('div.grid');

                    grouped[prog][wk].forEach(w => {
                        const card = document.createElement('div');
                        card.className = 'card-bg border border-base rounded-xl p-unit-md flex flex-col justify-between';
                        
                        card.innerHTML = `
                            <div class="mb-3">
                                <div class="flex justify-between items-start mb-2">
                                    <h5 class="font-body-base text-body-base font-semibold text-primary">${w.name}</h5>
                                    <button class="px-2.5 py-1 rounded border border-base hover:bg-surface-container-high text-[10px] text-on-surface font-semibold transition-colors btn-edit-workout">Edit</button>
                                </div>
                                <p class="text-xs text-on-surface-variant mb-3">${w.notes || 'No general notes.'}</p>
                                <div class="space-y-1.5 text-xs">
                                    ${w.exercises.length === 0 ? '<p class="text-on-surface-variant italic">No exercises added yet.</p>' : ''}
                                    ${w.exercises.sort((a,b) => (a.order||0) - (b.order||0)).map(ex => `
                                        <div class="flex justify-between text-on-surface-variant border-b border-[#27272a]/20 py-1 text-[11px]">
                                            <span>• ${ex.name}</span>
                                            <span class="font-stat-mono text-[10px] text-primary">${ex.sets}x${ex.reps} @ ${ex.weight}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;

                        card.querySelector('.btn-edit-workout').onclick = () => {
                            window.location.hash = `builder/${w.id}`;
                        };

                        gridMount.appendChild(card);
                    });
                }

                workoutsListMount.appendChild(progSection);
            }
        }
    }

    if (btnAddWorkout) {
        btnAddWorkout.onclick = () => {
            const newW = window.appState.addWorkout(client.id, {
                name: 'New Custom Session',
                notes: 'Custom training routine',
                exercises: []
            });
            window.location.hash = `builder/${newW.id}`;
        };
    }

    // --- PROGRESS PHOTOS TAB ---
    const photosForm = document.getElementById('photos-upload-form');
    const photosGalleryMount = document.getElementById('photos-gallery-mount');
    const photosCompareStats = document.getElementById('photos-compare-stats');

    function renderPhotos() {
        if (!photosGalleryMount) return;
        photosGalleryMount.innerHTML = '';

        const clientPhotos = window.appState.progressPhotos.filter(p => p.clientId === client.id).sort((a,b) => new Date(a.date) - new Date(b.date));

        if (clientPhotos.length === 0) {
            photosGalleryMount.innerHTML = `<div class="col-span-2 py-8 text-center text-on-surface-variant text-sm">No progress photos uploaded.</div>`;
            if (photosCompareStats) photosCompareStats.textContent = '';
        } else {
            const earliest = clientPhotos[0];
            const latest = clientPhotos[clientPhotos.length - 1];

            // Render Before
            const beforeCard = document.createElement('div');
            beforeCard.className = 'bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden relative h-64';
            beforeCard.innerHTML = `
                <img alt="Before" class="w-full h-full object-cover" src="${earliest.front || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcNme_YnSQkYty_V5lL6HrAtsgHdpKdKQ-tuwD-dRPRxEdM6EK98Wklg_C2-TjavYfK-ANi8leJ5CRtTex0ka2YIRLgEqT1hRhcrXB7yy1_atVlJqvlsuWL1_1uO7QZ6WSWWbezaPLePg3aQktN-y5G3He4lI9Tx43WT8QtgHzwx4E2rAyuXQWpkVUJY3W71R57pT2LeW96wYD9CDxcR0J_xEwKS2hCynh_7x3k_pwkZ7X5cfAWq8oyOpqa_UUUsuPuG0tWv1tVIg'}">
                <div class="absolute bottom-2 left-2 bg-black/75 text-white px-2 py-0.5 rounded text-xs">Before (${earliest.date})</div>
            `;
            photosGalleryMount.appendChild(beforeCard);

            // Render Current
            const currentCard = document.createElement('div');
            currentCard.className = 'bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden relative h-64';
            currentCard.innerHTML = `
                <img alt="Current" class="w-full h-full object-cover" src="${latest.front || 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3rJlWEZT_wH8Bvk3fZG4EeMVDY7o7bmFYzbsN1yRtEOMs5NsPDp_E-8ut46VjcyUV-rjkpbH8W3aVbPs3WvFnCLm6brnjNV8ciVfdUNKdW3Gk7bgf0QlcFCYAqltMimkx-JjUW1_sYwUyYJoKG5WrEma9tebvNk8nZFYrpvpTzbxZU_WBPrB1ykTGlCiMb21S4eKC7JjxvW9jL5BZqa-5VjCpzcHTKgq7mNuyCIloRQ-UUDOlBcjqt65AdSqlhy_Z6Vdnu1Tui8U'}">
                <div class="absolute bottom-2 left-2 bg-[#d9f99d] text-[#09090b] font-semibold px-2 py-0.5 rounded text-xs">Latest (${latest.date})</div>
            `;
            photosGalleryMount.appendChild(currentCard);

            if (photosCompareStats) {
                const dayDiff = Math.round((new Date(latest.date) - new Date(earliest.date)) / (1000 * 60 * 60 * 24));
                photosCompareStats.textContent = `Time elapsed: ${dayDiff} days • Weight change: ${client.weight} kg (Current)`;
            }
        }
    }

    // Setup file upload enhancement
    const frontInput = document.getElementById('photo-front-url');
    const sideInput = document.getElementById('photo-side-url');
    const backInput = document.getElementById('photo-back-url');

    if (frontInput && sideInput && backInput) {
        [
            { input: frontInput, type: 'front' },
            { input: sideInput, type: 'side' },
            { input: backInput, type: 'back' }
        ].forEach(item => {
            if (item.input.dataset.uploadWired) return;
            item.input.dataset.uploadWired = "true";
            item.input.placeholder = `Click to upload ${item.type} photo...`;
            item.input.readOnly = true;
            item.input.style.cursor = 'pointer';

            const fileEl = document.createElement('input');
            fileEl.type = 'file';
            fileEl.accept = 'image/png, image/jpeg, image/jpg, image/webp';
            fileEl.style.display = 'none';
            item.input.parentNode.appendChild(fileEl);

            item.input.onclick = () => fileEl.click();

            fileEl.onchange = async () => {
                if (fileEl.files.length === 0) return;
                const file = fileEl.files[0];
                const originalPlaceholder = item.input.placeholder;
                item.input.placeholder = "Uploading photo to storage...";
                try {
                    const uploaded = await window.appState.uploadProgressPhoto(client.id, file, item.type);
                    item.input.value = uploaded.storage_path;
                    item.input.placeholder = originalPlaceholder;
                    alert(`${item.type.toUpperCase()} photo uploaded successfully!`);
                } catch (err) {
                    console.error(err);
                    item.input.value = "";
                    item.input.placeholder = originalPlaceholder;
                    alert(`Upload failed: ${err.message}`);
                }
            };
        });
    }

    if (photosForm) {
        photosForm.onsubmit = function(e) {
            e.preventDefault();
            renderOverview();
            renderPhotos();
            renderTimeline();
            photosForm.reset();
            alert('Progress photos saved successfully!');
        };
    }

    // --- MEASUREMENTS TAB ---
    const measureForm = document.getElementById('measurements-log-form');
    const measureTbody = document.getElementById('measurements-history-tbody');

    function renderMeasurements() {
        if (!measureTbody) return;
        measureTbody.innerHTML = '';

        const clientMeasures = window.appState.measurements.filter(m => m.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date));

        if (clientMeasures.length === 0) {
            measureTbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-on-surface-variant">No measurements logged yet.</td></tr>`;
        } else {
            clientMeasures.forEach(m => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-[#27272a]/40 hover:bg-[#1f201a]/20 text-on-surface';
                tr.innerHTML = `
                    <td class="py-3 font-semibold">${m.date}</td>
                    <td class="py-3 font-stat-mono">${m.waist.toFixed(1)} cm</td>
                    <td class="py-3 font-stat-mono">${m.chest.toFixed(1)} cm</td>
                    <td class="py-3 font-stat-mono">${m.arms.toFixed(1)} cm</td>
                    <td class="py-3 font-stat-mono">${m.legs.toFixed(1)} cm</td>
                `;
                measureTbody.appendChild(tr);
            });
        }
    }

    if (measureForm) {
        measureForm.onsubmit = function(e) {
            e.preventDefault();
            const waist = document.getElementById('measure-waist').value;
            const chest = document.getElementById('measure-chest').value;
            const arms = document.getElementById('measure-arms').value;
            const legs = document.getElementById('measure-legs').value;

            window.appState.saveMeasurements(client.id, waist, chest, arms, legs);

            renderOverview();
            renderMeasurements();
            renderTimeline();
            
            measureForm.reset();
            alert('Measurements logged successfully!');
        };
    }

    // --- TIMELINE TAB ---
    const timelineMount = document.getElementById('timeline-mount');

    function renderTimeline() {
        if (!timelineMount) return;
        timelineMount.innerHTML = '';

        const events = [];

        // Add checkin events
        window.appState.checkins.filter(c => c.clientId === client.id).forEach(c => {
            events.push({
                date: c.date,
                title: 'Daily Check-in Logged',
                desc: `Weight: ${c.weight} kg, Sleep: ${c.sleep}h, Steps: ${c.steps.toLocaleString()}. Notes: "${c.notes || 'none'}"`,
                icon: 'check_circle',
                color: 'text-[#22c55e]'
            });
        });

        // Add workout events
        window.appState.workouts.filter(w => w.clientId === client.id).forEach(w => {
            events.push({
                date: new Date().toISOString().split('T')[0], // mock date for assigned workout
                title: 'Routine Assigned',
                desc: `Assigned Workout Session: "${w.name}" containing ${w.exercises.length} exercises.`,
                icon: 'fitness_center',
                color: 'text-[#6366f1]'
            });
        });

        // Add photos events
        window.appState.progressPhotos.filter(p => p.clientId === client.id).forEach(p => {
            events.push({
                date: p.date,
                title: 'Uploaded Progress Photos',
                desc: `Added progress front photo for comparison logs.`,
                icon: 'photo_library',
                color: 'text-[#a855f7]'
            });
        });

        // Add measurement events
        window.appState.measurements.filter(m => m.clientId === client.id).forEach(m => {
            events.push({
                date: m.date,
                title: 'Logged Measurements',
                desc: `Waist: ${m.waist} cm, Chest: ${m.chest} cm, Arms: ${m.arms} cm, Legs: ${m.legs} cm.`,
                icon: 'straighten',
                color: 'text-[#fbbf24]'
            });
        });

        // Sort reverse chronological
        events.sort((a,b) => new Date(b.date) - new Date(a.date));

        if (events.length === 0) {
            timelineMount.innerHTML = `<p class="text-xs text-on-surface-variant text-center py-4">No events found in timeline.</p>`;
        } else {
            events.forEach(ev => {
                const item = document.createElement('div');
                item.className = 'relative pl-8';
                item.innerHTML = `
                    <span class="material-symbols-outlined absolute -left-[13px] top-0.5 bg-[#09090b] ${ev.color} text-[24px]" style="font-variation-settings: 'FILL' 1;">${ev.icon}</span>
                    <div>
                        <div class="flex justify-between items-center">
                            <h4 class="text-xs font-semibold text-primary">${ev.title}</h4>
                            <span class="text-[10px] text-on-surface-variant font-mono">${ev.date}</span>
                        </div>
                        <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">${ev.desc}</p>
                    </div>
                `;
                timelineMount.appendChild(item);
            });
        }
    }

    // --- PRIVATE NOTES TAB ---
    const notesTextarea = document.getElementById('private-notes-textarea');
    const notesStatus = document.getElementById('notes-save-status');
    const btnSaveNotes = document.getElementById('btn-save-notes');
    let saveTimeout = null;

    if (notesTextarea) {
        notesTextarea.value = window.appState.privateNotes[client.id] || '';

        notesTextarea.oninput = () => {
            if (notesStatus) notesStatus.textContent = 'Saving...';
            
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                window.appState.savePrivateNotes(client.id, notesTextarea.value);
                if (notesStatus) notesStatus.textContent = 'Autosaved';
            }, 1000);
        };
    }

    if (btnSaveNotes) {
        btnSaveNotes.onclick = () => {
            window.appState.savePrivateNotes(client.id, notesTextarea.value);
            if (notesStatus) {
                notesStatus.textContent = 'Saved successfully!';
                setTimeout(() => notesStatus.textContent = 'Autosaved', 2000);
            }
        };
    }

    // Bind split slider button on Overview
    const viewPhotosBtn = document.querySelector('.btn-view-photos-tab');
    if (viewPhotosBtn) {
        viewPhotosBtn.onclick = () => {
            const photoTab = document.querySelector('#profile-tabs button[data-tab="photos"]');
            if (photoTab) photoTab.click();
        };
    }

    // Bind profile header action buttons
    const btnMessage = document.getElementById('btn-profile-message');
    if (btnMessage) {
        btnMessage.onclick = () => {
            window.location.hash = `inbox/${client.id}`;
        };
    }

    const btnEditPlan = document.getElementById('btn-profile-edit');
    if (btnEditPlan) {
        btnEditPlan.onclick = () => {
            const w = window.appState.workouts.find(wk => wk.clientId === client.id);
            window.location.hash = w ? `builder/${w.id}` : 'builder';
        };
    }

    const btnGenerateReport = document.getElementById('btn-generate-report');
    if (btnGenerateReport) {
        btnGenerateReport.onclick = () => {
            window.location.hash = `report/${client.id}`;
        };
    }

    // Initial overview render
    renderOverview();
    renderCheckins();
    renderTraining();
    renderPhotos();
    renderMeasurements();
    renderTimeline();
};
