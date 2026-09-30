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

            // Refresh data each time tab is activated
            if (targetTab === 'training') {
                renderTraining();
            } else if (targetTab === 'checkins') {
                renderCheckins();
            } else if (targetTab === 'overview') {
                renderOverview();
            } else if (targetTab === 'photos') {
                renderPhotos();
            } else if (targetTab === 'measurements') {
                renderMeasurements();
            } else if (targetTab === 'timeline') {
                renderTimeline();
            }
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

        // Sleep & Steps Card Metrics from checkins
        const latestCheckin = clientCheckins.length > 0 ? clientCheckins[clientCheckins.length - 1] : null;
        const avgSleepVal = clientCheckins.length > 0
            ? (clientCheckins.reduce((acc, c) => acc + (parseFloat(c.sleep) || 7.0), 0) / clientCheckins.length).toFixed(1)
            : '7.0';
        const latestStepsVal = latestCheckin && latestCheckin.steps ? latestCheckin.steps : 10000;

        // Sleep Card
        const sleepValEl = document.getElementById('overview-sleep-val');
        const sleepStatusEl = document.getElementById('overview-sleep-status');
        if (sleepValEl) sleepValEl.textContent = `${avgSleepVal}h`;
        if (sleepStatusEl) {
            const hrs = parseFloat(avgSleepVal);
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
        if (stepsValEl) stepsValEl.textContent = typeof latestStepsVal === 'number' ? latestStepsVal.toLocaleString() : latestStepsVal;
        if (stepsStatusEl) {
            const count = typeof latestStepsVal === 'number' ? latestStepsVal : parseInt(String(latestStepsVal).replace(/[^0-9]/g, '')) || 0;
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
            const clientPhotos = window.appState.progressPhotos.filter(p => p.clientId === client.id).sort((a,b) => new Date(a.date) - new Date(b.date));
            if (clientPhotos.length > 0) {
                const beforePhoto = clientPhotos.find(p => p.before) || clientPhotos[0];
                const latestPhoto = [...clientPhotos].sort((a,b) => new Date(b.date) - new Date(a.date)).find(p => p.front) || clientPhotos[clientPhotos.length - 1];

                const beforeImg = beforePhoto.before || beforePhoto.front || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop';
                const afterImg = latestPhoto.front || 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=400&auto=format&fit=crop';

                photosSlider.innerHTML = `
                    <div class="absolute inset-0 flex">
                        <div class="w-1/2 h-full bg-[#18181b] border-r border-[#d9f99d] flex items-center justify-center relative overflow-hidden">
                            <img alt="Before Photo" class="w-full h-full object-cover opacity-80 grayscale" src="${beforeImg}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop';">
                            <div class="absolute bottom-2 left-2 bg-black/75 px-2 py-1 rounded text-xs font-stat-mono z-10 text-white font-bold">Before (${beforePhoto.date})</div>
                        </div>
                        <div class="w-1/2 h-full bg-[#12140e] flex items-center justify-center relative overflow-hidden">
                            <img alt="Current Photo" class="w-full h-full object-cover" src="${afterImg}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=400&auto=format&fit=crop';">
                            <div class="absolute bottom-2 right-2 bg-[#d9f99d] text-[#09090b] px-2 py-1 rounded text-xs font-stat-mono z-10 font-bold">Current (${latestPhoto.date})</div>
                        </div>
                    </div>
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#d9f99d] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(217,249,157,0.5)] z-20">
                        <span class="material-symbols-outlined text-[#09090b] text-[16px]">swap_horiz</span>
                    </div>
                `;
            } else {
                photosSlider.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-center p-6 text-on-surface-variant">
                        <span class="material-symbols-outlined text-[32px] mb-2 text-primary-container">image_not_supported</span>
                        <p class="text-xs font-semibold text-primary">No progress photos recorded yet.</p>
                        <p class="text-[10px] text-on-surface-variant mt-1">Client can upload Before & Current photos in their mobile app.</p>
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

                const hasNutr = c.calories !== null && c.calories !== undefined && c.calories > 0;
                const nutrDisplay = hasNutr 
                    ? `<div><strong class="text-primary font-mono text-xs">${c.calories.toLocaleString()} kcal</strong> <div class="text-[10px] text-on-surface-variant font-mono mt-0.5">P: ${c.protein || 0}g • C: ${c.carbs || 0}g • F: ${c.fats || 0}g</div></div>`
                    : `<span class="text-on-surface-variant italic text-[11px]">Not Logged</span>`;

                tr.innerHTML = `
                    <td class="py-3 font-semibold">${c.date}</td>
                    <td class="py-3 font-stat-mono">${c.weight} kg</td>
                    <td class="py-3 font-stat-mono">${c.sleep}h</td>
                    <td class="py-3 font-stat-mono">${(c.steps || 0).toLocaleString()}</td>
                    <td class="py-3">${nutrDisplay}</td>
                    <td class="py-3">${c.mood || '🙂'}</td>
                    <td class="py-3 font-stat-mono text-[#facc15]">${'★'.repeat(c.energy || 4)}${'☆'.repeat(5 - (c.energy || 4))}</td>
                `;
                checkinsTbody.appendChild(tr);
            });
        }
    }

    const targetsForm = document.getElementById('coach-targets-form');
    if (targetsForm) {
        document.getElementById('target-calories').value = client.target_calories || 2000;
        document.getElementById('target-protein').value = client.target_protein || 150;
        document.getElementById('target-carbs').value = client.target_carbs || 200;
        document.getElementById('target-fats').value = client.target_fats || 60;
        document.getElementById('target-steps').value = client.target_steps || 10000;

        targetsForm.onsubmit = async function(e) {
            e.preventDefault();
            const target_calories = document.getElementById('target-calories').value;
            const target_protein = document.getElementById('target-protein').value;
            const target_carbs = document.getElementById('target-carbs').value;
            const target_fats = document.getElementById('target-fats').value;
            const target_steps = document.getElementById('target-steps').value;

            try {
                await window.appState.saveClientTargets(client.id, {
                    target_calories, target_protein, target_carbs, target_fats, target_steps
                });
                showToast(`Daily goals updated for ${client.name}!`, 'success', 'Goals Updated');
            } catch (err) {
                showToast(`Failed to update targets: ${err.message}`, 'error', 'Error');
            }
        };
    }

    // --- TRAINING TAB ---
    const workoutsListMount = document.getElementById('analytics-workouts-list');
    const btnAddWorkout = document.getElementById('btn-analytics-add-workout');

    async function renderTraining() {
        if (!workoutsListMount) return;
        workoutsListMount.innerHTML = `<div class="flex items-center justify-center py-8"><span class="material-symbols-outlined text-[24px] text-primary-container animate-spin">progress_activity</span></div>`;

        // Fetch directly from DB to avoid stale in-memory cache
        const { data: programs, error } = await window.supabaseClient
            .from('programs')
            .select('*, program_weeks(*, workouts(*, exercises(*)))')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false });

        if (error) {
            workoutsListMount.innerHTML = `<div class="text-sm text-error p-4">Error loading programs: ${error.message}</div>`;
            return;
        }

        workoutsListMount.innerHTML = '';

        if (!programs || programs.length === 0) {
            workoutsListMount.innerHTML = `
                <div class="card-bg border border-dashed border-outline-variant rounded-xl p-8 text-center text-on-surface-variant text-sm">
                    <span class="material-symbols-outlined text-[36px] text-primary-container mb-2">fitness_center</span>
                    <p class="font-bold text-primary mb-1">No active training program assigned yet</p>
                    <p class="text-xs text-on-surface-variant mb-4">Assign a program template or create custom workouts for Week 1 and Week 2.</p>
                    <button id="btn-analytics-create-first-workout" class="px-4 py-2 bg-[#d9f99d] text-[#09090b] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-[0_0_15px_rgba(217,249,157,0.2)]">
                        <span class="material-symbols-outlined text-[16px]">add_circle</span> Add First Workout
                    </button>
                </div>
            `;
            const btnCreateFirst = document.getElementById('btn-analytics-create-first-workout');
            if (btnCreateFirst) btnCreateFirst.onclick = () => openAddWorkoutModal(1);
            return;
        }

        programs.forEach(p => {
            const progSection = document.createElement('div');
            progSection.className = 'space-y-5 mb-8 card-bg border border-base rounded-2xl p-5';
            progSection.innerHTML = `
                <div class="flex items-center justify-between border-b border-[#27272a] pb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-[#ceee93]/10 border border-[#ceee93]/20 flex items-center justify-center">
                            <span class="material-symbols-outlined text-[#ceee93] text-[18px]">folder</span>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-primary uppercase font-label-caps tracking-wider">${p.name}</h4>
                            <p class="text-[10px] text-on-surface-variant font-mono">Assigned Program</p>
                        </div>
                    </div>
                    <button class="px-3 py-1.5 rounded-lg border border-error/30 text-error hover:bg-error/10 text-[11px] font-semibold transition-colors btn-delete-program flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">delete</span>
                        Delete Program
                    </button>
                </div>
                <div class="program-weeks-container space-y-6"></div>
            `;

            progSection.querySelector('.btn-delete-program').onclick = async () => {
                if (await showConfirm(`Delete entire program "${p.name}" and all its workouts? Note: Templates in your library remain safe and untouched.`, 'Delete Program', 'Delete', 'Cancel')) {
                    try {
                        await window.appState.deleteProgram(p.id);
                        showToast(`Program "${p.name}" deleted successfully!`, 'success', 'Program Deleted');
                        renderTraining();
                    } catch (err) {
                        showToast(`Failed to delete program: ${err.message}`, 'error', 'Delete Error');
                    }
                }
            };

            const weeksContainer = progSection.querySelector('.program-weeks-container');

            // Build map of weeks, ensuring Week 1 and Week 2 exist in view
            const weekMap = new Map();
            if (p.program_weeks) {
                p.program_weeks.forEach(pw => weekMap.set(pw.week_number, pw));
            }

            // Always display Week 1 and Week 2
            const weekNumbers = Array.from(new Set([1, 2, ...Array.from(weekMap.keys())])).sort((a, b) => a - b);

            weekNumbers.forEach(wNum => {
                const pw = weekMap.get(wNum) || { week_number: wNum, workouts: [] };
                const wkWs = (pw.workouts || []).sort((a, b) => (a.day_number || 1) - (b.day_number || 1));
                const wkSection = document.createElement('div');
                wkSection.className = 'bg-[#0d0f09] border border-[#27272a] rounded-xl p-4 space-y-3';
                
                const hasWorkouts = wkWs.length > 0;
                const canCopyWeek1 = wNum === 2 && !hasWorkouts && (weekMap.get(1)?.workouts?.length > 0);

                wkSection.innerHTML = `
                    <div class="flex items-center justify-between border-b border-[#27272a]/60 pb-2.5">
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded bg-[#ceee93]/15 text-[#ceee93] border border-[#ceee93]/30 font-mono text-xs font-bold">Week ${wNum}</span>
                            <span class="text-xs text-on-surface-variant font-mono">(${wkWs.length} Workout${wkWs.length === 1 ? '' : 's'})</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${canCopyWeek1 ? `
                                <button class="px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#34352f] text-[11px] font-semibold text-primary transition-colors btn-copy-week1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[13px]">content_copy</span> Copy Week 1
                                </button>
                            ` : ''}
                            <button class="px-3 py-1 rounded bg-[#d9f99d] text-[#09090b] text-[11px] font-bold hover:opacity-90 transition-opacity btn-add-workout-to-week flex items-center gap-1">
                                <span class="material-symbols-outlined text-[13px]">add</span> Add Workout
                            </button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 workouts-grid"></div>
                `;

                // Copy Week 1 button
                const btnCopyW1 = wkSection.querySelector('.btn-copy-week1');
                if (btnCopyW1) {
                    btnCopyW1.onclick = async () => {
                        try {
                            btnCopyW1.disabled = true;
                            btnCopyW1.innerHTML = `<span class="material-symbols-outlined text-[13px] animate-spin">progress_activity</span> Copying...`;
                            await window.appState.duplicateWeek(client.id, p.id, 1, 2);
                            showToast('Copied Week 1 workouts into Week 2!', 'success', 'Week Duplicated');
                            renderTraining();
                        } catch (err) {
                            showToast(`Failed to copy week: ${err.message}`, 'error', 'Copy Error');
                            btnCopyW1.disabled = false;
                            btnCopyW1.innerHTML = `<span class="material-symbols-outlined text-[13px]">content_copy</span> Copy Week 1`;
                        }
                    };
                }

                // Add workout to this week
                wkSection.querySelector('.btn-add-workout-to-week').onclick = () => {
                    openAddWorkoutModal(wNum);
                };

                const gridMount = wkSection.querySelector('.workouts-grid');

                if (!hasWorkouts) {
                    gridMount.innerHTML = `
                        <div class="col-span-full py-4 text-center text-xs text-on-surface-variant italic">
                            No workouts in Week ${wNum} yet. Click "+ Add Workout" to schedule Day 1, Day 2, etc.
                        </div>
                    `;
                } else {
                    wkWs.forEach((wk, idx) => {
                        const exs = wk.exercises || [];
                        const card = document.createElement('div');
                        card.className = 'card-bg border border-base hover:border-outline rounded-xl p-3.5 flex flex-col justify-between transition-all group min-w-0';
                        const dayLabel = wk.day_number ? `Day ${wk.day_number}` : `Day ${idx + 1}`;

                        card.innerHTML = `
                            <div class="mb-3 min-w-0">
                                <div class="flex justify-between items-start mb-1.5 gap-2">
                                    <div class="min-w-0 flex-1">
                                        <span class="bg-[#27272a] text-[#ceee93] text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">${dayLabel}</span>
                                        <h5 class="font-body-base text-xs sm:text-sm font-bold text-primary truncate mt-1">${wk.name}</h5>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <button class="p-1 text-on-surface-variant hover:text-primary transition-colors btn-edit-workout" title="Edit in Builder">
                                            <span class="material-symbols-outlined text-[16px]">edit</span>
                                        </button>
                                        <button class="p-1 text-error/70 hover:text-error transition-colors btn-delete-workout" title="Delete Workout from Client Schedule">
                                            <span class="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                                <p class="text-[11px] text-on-surface-variant mb-2.5 line-clamp-1">${wk.instructions || 'No instructions specified.'}</p>
                                <div class="space-y-1 text-xs">
                                    ${exs.length === 0 ? '<p class="text-on-surface-variant text-[11px] italic">No exercises added.</p>' : ''}
                                    ${exs.slice(0, 3).map(ex => `
                                        <div class="flex justify-between items-center text-on-surface-variant py-0.5 text-[11px] border-b border-[#27272a]/20">
                                            <span class="truncate flex-1">• ${ex.name}</span>
                                            <span class="font-mono text-[10px] text-primary shrink-0 pl-2">${ex.sets}x${ex.reps}</span>
                                        </div>
                                    `).join('')}
                                    ${exs.length > 3 ? `<p class="text-[10px] text-primary-container font-semibold pt-0.5">+ ${exs.length - 3} more exercises</p>` : ''}
                                </div>
                            </div>
                            <div class="pt-2 border-t border-[#27272a]/40 flex justify-between items-center text-[10px] font-mono text-on-surface-variant">
                                <span>💪 ${exs.length} Exercises</span>
                                <button class="text-primary hover:underline font-semibold btn-edit-workout">Edit Routine →</button>
                            </div>
                        `;

                        // Edit button
                        card.querySelectorAll('.btn-edit-workout').forEach(b => {
                            b.onclick = () => {
                                window.location.hash = `builder/${wk.id}`;
                            };
                        });

                        // Delete button: ONLY deletes this workout from workouts table
                        card.querySelector('.btn-delete-workout').onclick = async () => {
                            if (await showConfirm(`Remove "${wk.name}" (${dayLabel} • Week ${wNum}) from ${client.name}'s schedule? Note: Templates in your library remain safe and untouched.`, 'Delete Workout', 'Delete', 'Cancel')) {
                                try {
                                    await window.appState.deleteWorkout(wk.id);
                                    showToast(`Workout "${wk.name}" removed from client training.`, 'success', 'Workout Deleted');
                                    renderTraining();
                                } catch (err) {
                                    showToast(`Failed to delete workout: ${err.message}`, 'error', 'Delete Error');
                                }
                            }
                        };

                        gridMount.appendChild(card);
                    });
                }

                weeksContainer.appendChild(wkSection);
            });

            workoutsListMount.appendChild(progSection);
        });

        // Render Completed Workout Session Logs for Coach Inspection
        const sessionLogsMount = document.getElementById('analytics-session-logs-mount');
        const countBadgeEl = document.getElementById('completed-session-count-badge');

        if (sessionLogsMount) {
            sessionLogsMount.innerHTML = '';
            
            // Extract all workouts from DB programs fetched above
            const allWorkoutsMap = new Map();
            let localCompleted = [];
            try {
                localCompleted = JSON.parse(localStorage.getItem('coachos_completed_workouts') || '[]');
            } catch(e) {}

            if (programs) {
                programs.forEach(p => {
                    if (p.program_weeks) {
                        p.program_weeks.forEach(pw => {
                            if (pw.workouts) {
                                pw.workouts.forEach(wk => {
                                    const isLocallyDone = localCompleted.includes(wk.id);
                                    let sessionData = wk.session_logs || null;
                                    if (!sessionData) {
                                        try {
                                            const raw = localStorage.getItem('coachos_workout_logs_' + wk.id);
                                            if (raw) sessionData = JSON.parse(raw);
                                        } catch(e) {}
                                    }
                                    if (sessionData && sessionData.sessionLogs) {
                                        sessionData = sessionData.sessionLogs;
                                    }

                                    const isDone = wk.status === 'Completed' || isLocallyDone || (sessionData && Object.keys(sessionData).length > 0);

                                    allWorkoutsMap.set(wk.id, {
                                        id: wk.id,
                                        clientId: p.client_id,
                                        name: wk.name,
                                        status: isDone ? 'Completed' : (wk.status || 'Scheduled'),
                                        programName: p.name,
                                        weekName: `Week ${pw.week_number}`,
                                        sessionLogs: sessionData,
                                        loggedAt: wk.completed_at || null,
                                        exercises: wk.exercises || []
                                    });
                                });
                            }
                        });
                    }
                });
            }

            // Also check appState.workouts for any workouts or session logs
            (window.appState.workouts || []).forEach(w => {
                if (w.clientId && w.clientId !== client.id) return;
                
                if (!allWorkoutsMap.has(w.id)) {
                    allWorkoutsMap.set(w.id, w);
                } else {
                    const existing = allWorkoutsMap.get(w.id);
                    if (w.sessionLogs && (!existing.sessionLogs || Object.keys(existing.sessionLogs).length === 0)) {
                        existing.sessionLogs = w.sessionLogs;
                    }
                    if (w.status === 'Completed') {
                        existing.status = 'Completed';
                    }
                }
            });

            const allClientWorkouts = Array.from(allWorkoutsMap.values());

            let completedWorkouts = allClientWorkouts.filter(w => {
                const isLocallyDone = localCompleted.includes(w.id);
                const hasLocalLogs = !!localStorage.getItem('coachos_workout_logs_' + w.id);
                const hasSessionLogs = w.sessionLogs && Object.keys(w.sessionLogs).length > 0;
                return w.status === 'Completed' || isLocallyDone || hasLocalLogs || hasSessionLogs;
            });

            // Fallback: If localCompleted has IDs not yet in completedWorkouts, include them
            if (localCompleted.length > 0) {
                localCompleted.forEach(doneId => {
                    if (!completedWorkouts.some(w => w.id === doneId)) {
                        const fallbackW = (window.appState.workouts || []).find(w => w.id === doneId) || {
                            id: doneId,
                            clientId: client.id,
                            name: 'Completed Workout Session',
                            status: 'Completed',
                            programName: 'Training Program',
                            weekName: 'Week 1',
                            exercises: []
                        };
                        let rawLogs = null;
                        try {
                            const raw = localStorage.getItem('coachos_workout_logs_' + doneId);
                            if (raw) rawLogs = JSON.parse(raw);
                        } catch(e) {}
                        fallbackW.sessionLogs = fallbackW.sessionLogs || rawLogs;
                        completedWorkouts.push(fallbackW);
                    }
                });
            }

            if (countBadgeEl) {
                countBadgeEl.textContent = `${completedWorkouts.length} Completed Session${completedWorkouts.length === 1 ? '' : 's'}`;
            }

            if (completedWorkouts.length === 0) {
                sessionLogsMount.innerHTML = `
                    <div class="p-6 text-center text-xs text-on-surface-variant italic card-bg border border-dashed border-[#27272a] rounded-lg">
                        No completed workout sessions logged by client yet. When client finishes a session on mobile, their set-by-set weight and rep records will appear here.
                    </div>
                `;
            } else {
                completedWorkouts.forEach(w => {
                    let sessionData = w.sessionLogs;
                    if (!sessionData) {
                        try {
                            const raw = localStorage.getItem('coachos_workout_logs_' + w.id);
                            if (raw) sessionData = JSON.parse(raw);
                        } catch(e) {}
                    }
                    if (sessionData && sessionData.sessionLogs) {
                        sessionData = sessionData.sessionLogs;
                    }

                    const card = document.createElement('div');
                    card.className = 'card-bg border border-[#ceee93]/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-[#ceee93]/60 transition-all';
                    
                    const exCount = (w.exercises && w.exercises.length > 0) ? w.exercises.length : (sessionData ? Object.keys(sessionData).length : 0);
                    card.innerHTML = `
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-[#22c55e] text-base">check_circle</span>
                                <h5 class="font-body-base text-primary font-bold text-sm">${w.name}</h5>
                                <span class="bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 px-2 py-0.5 rounded text-[9px] font-bold font-mono">COMPLETED</span>
                            </div>
                            <p class="text-xs text-on-surface-variant font-mono mt-1">
                                ${w.programName || 'Training Program'} • ${w.weekName || 'Week 1'} • ${exCount} Exercises Logged
                            </p>
                        </div>
                        <button class="px-3.5 py-2 rounded-lg bg-[#d9f99d] text-[#09090b] text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0 btn-inspect-session">
                            <span class="material-symbols-outlined text-[16px]">visibility</span>
                            Inspect Session Log
                        </button>
                    `;

                    card.querySelector('.btn-inspect-session').onclick = () => {
                        openSessionLogModal(w, sessionData);
                    };

                    sessionLogsMount.appendChild(card);
                });
            }
        }
    }

    function openSessionLogModal(workout, sessionData) {
        const modal = document.getElementById('workout-session-modal');
        const titleEl = document.getElementById('modal-session-title');
        const subtitleEl = document.getElementById('modal-session-subtitle');
        const bodyEl = document.getElementById('modal-session-body');
        const btnClose = document.getElementById('btn-close-session-modal');
        const btnDismiss = document.getElementById('btn-dismiss-session-modal');

        if (!modal || !bodyEl) return;

        if (titleEl) titleEl.textContent = workout.name;
        if (subtitleEl) subtitleEl.textContent = `${workout.programName || 'Training Program'} • ${workout.weekName || 'Week 1'}`;

        bodyEl.innerHTML = '';

        let exercises = workout.exercises || [];
        if (exercises.length === 0 && sessionData && Object.keys(sessionData).length > 0) {
            exercises = Object.keys(sessionData).map((k, i) => ({
                id: k,
                name: `Exercise ${i + 1}`,
                sets: Array.isArray(sessionData[k]) ? sessionData[k].length : 3,
                reps: '10',
                weight: '75',
                rest: '90s'
            }));
        }

        if (exercises.length === 0) {
            bodyEl.innerHTML = `<p class="text-xs text-on-surface-variant italic py-4 text-center">No exercise details recorded for this session.</p>`;
        } else {
            exercises.forEach((ex, idx) => {
                const exCard = document.createElement('div');
                exCard.className = 'bg-[#09090b] border border-[#27272a] rounded-lg p-3.5 space-y-2';

                const setLogs = (sessionData && (sessionData[ex.id] || sessionData[`ex-${idx+1}`] || sessionData[ex.name])) 
                    ? (sessionData[ex.id] || sessionData[`ex-${idx+1}`] || sessionData[ex.name]) 
                    : (sessionData && Object.values(sessionData)[idx] && Array.isArray(Object.values(sessionData)[idx]) ? Object.values(sessionData)[idx] : []);
                
                const defaultNumSets = parseInt(ex.sets) || 3;
                const defaultWeight = parseFloat(ex.weight) || 75.0;
                const defaultReps = parseInt(ex.reps) || 10;

                let setsHtml = '';
                if (setLogs.length > 0) {
                    setsHtml = setLogs.map(s => `
                        <div class="flex items-center justify-between text-xs font-mono py-1 border-b border-[#27272a]/30">
                            <span class="text-on-surface-variant font-semibold">Set ${s.setNum || s.set || 1}</span>
                            <span class="text-primary font-bold">${s.weight !== undefined ? s.weight : defaultWeight} kg</span>
                            <span class="text-primary-container font-bold">${s.reps !== undefined ? s.reps : defaultReps} reps</span>
                            <span class="text-[#22c55e] flex items-center gap-0.5 text-[11px]"><span class="material-symbols-outlined text-[13px]">check_circle</span> ${s.completed !== false ? 'Completed' : 'Logged'}</span>
                        </div>
                    `).join('');
                } else {
                    for (let i = 1; i <= defaultNumSets; i++) {
                        setsHtml += `
                            <div class="flex items-center justify-between text-xs font-mono py-1 border-b border-[#27272a]/30">
                                <span class="text-on-surface-variant font-semibold">Set ${i}</span>
                                <span class="text-[#d9f99d] font-bold">${defaultWeight} kg</span>
                                <span class="text-[#ceee93] font-bold">${defaultReps} reps</span>
                                <span class="text-[#22c55e] flex items-center gap-0.5 text-[11px]"><span class="material-symbols-outlined text-[13px]">check_circle</span> Completed</span>
                            </div>
                        `;
                    }
                }

                exCard.innerHTML = `
                    <div class="flex justify-between items-center border-b border-[#27272a] pb-1.5">
                        <h5 class="text-xs font-bold text-primary flex items-center gap-1.5">
                            <span class="w-5 h-5 rounded bg-[#ceee93]/20 text-[#ceee93] flex items-center justify-center font-mono text-[10px]">${idx + 1}</span>
                            ${ex.name}
                        </h5>
                        <span class="text-[10px] font-mono text-on-surface-variant">${ex.sets} Sets Target • Rest ${ex.rest || '90s'}</span>
                    </div>
                    <div class="space-y-1 pt-1">
                        ${setsHtml}
                    </div>
                    ${ex.notes ? `<p class="text-[10px] text-on-surface-variant italic pt-1">Notes: "${ex.notes}"</p>` : ''}
                `;

                bodyEl.appendChild(exCard);
            });
        }

        modal.classList.remove('hidden');

        if (btnClose) btnClose.onclick = () => modal.classList.add('hidden');
        if (btnDismiss) btnDismiss.onclick = () => modal.classList.add('hidden');
    }

    // --- ADD WORKOUT MODAL (Custom Builder or Template Picker) ---
    async function openAddWorkoutModal(preselectedWeek = 1) {
        const modal = document.getElementById('modal-add-client-workout');
        if (!modal) return;

        const weekSelect = document.getElementById('custom-workout-week');
        const templateWeekSelect = document.getElementById('select-template-target-week');
        const daySelect = document.getElementById('custom-workout-day');
        const nameInput = document.getElementById('custom-workout-name');
        const notesInput = document.getElementById('custom-workout-notes');
        const templateSelect = document.getElementById('select-existing-template');

        if (weekSelect) weekSelect.value = String(preselectedWeek || 1);
        if (templateWeekSelect) templateWeekSelect.value = String(preselectedWeek || 1);
        if (daySelect) daySelect.value = "1";
        if (nameInput) nameInput.value = `Week ${preselectedWeek || 1} Day 1 - Workout`;
        if (notesInput) notesInput.value = "";

        // Populate templates select
        if (templateSelect) {
            templateSelect.innerHTML = '<option value="">Loading templates...</option>';
            let tmpls = window.appState.templates || [];
            if (tmpls.length === 0 && window.supabaseClient) {
                const { data } = await window.supabaseClient
                    .from('workout_templates')
                    .select('*, template_exercises(*)')
                    .order('name');
                if (data) tmpls = data;
            }
            if (tmpls.length === 0) {
                templateSelect.innerHTML = '<option value="">No templates available in library</option>';
            } else {
                templateSelect.innerHTML = tmpls.map(t => 
                    `<option value="${t.id}">${t.name} (${t.category || 'Hypertrophy'} • ${t.template_exercises?.length || t.exercises?.length || 0} exercises)</option>`
                ).join('');
            }
        }

        // Reset to first tab
        switchAddWorkoutTab('blank');
        modal.classList.remove('hidden');
    }

    function switchAddWorkoutTab(tab) {
        const tabBlank = document.getElementById('tab-btn-add-blank');
        const tabTmpl = document.getElementById('tab-btn-add-template');
        const formBlank = document.getElementById('form-create-custom-workout');
        const formTmpl = document.getElementById('form-assign-existing-template');

        if (tab === 'blank') {
            if (tabBlank) {
                tabBlank.className = 'py-2 text-xs font-bold rounded-lg bg-[#d9f99d] text-[#09090b] transition-all';
            }
            if (tabTmpl) {
                tabTmpl.className = 'py-2 text-xs font-semibold text-on-surface-variant hover:text-primary rounded-lg transition-all';
            }
            if (formBlank) formBlank.classList.remove('hidden');
            if (formTmpl) formTmpl.classList.add('hidden');
        } else {
            if (tabBlank) {
                tabBlank.className = 'py-2 text-xs font-semibold text-on-surface-variant hover:text-primary rounded-lg transition-all';
            }
            if (tabTmpl) {
                tabTmpl.className = 'py-2 text-xs font-bold rounded-lg bg-[#d9f99d] text-[#09090b] transition-all';
            }
            if (formBlank) formBlank.classList.add('hidden');
            if (formTmpl) formTmpl.classList.remove('hidden');
        }
    }

    // Modal tabs & close wiring
    const modalAddWorkout = document.getElementById('modal-add-client-workout');
    const tabBtnBlank = document.getElementById('tab-btn-add-blank');
    const tabBtnTmpl = document.getElementById('tab-btn-add-template');
    const btnCloseAddModal = document.getElementById('btn-close-add-workout-modal');
    const btnCancelAddBtns = document.querySelectorAll('.btn-cancel-add-workout');
    const btnGotoTemplates = document.getElementById('btn-goto-templates');
    const formCreateCustom = document.getElementById('form-create-custom-workout');
    const formAssignTmpl = document.getElementById('form-assign-existing-template');

    if (tabBtnBlank) tabBtnBlank.onclick = () => switchAddWorkoutTab('blank');
    if (tabBtnTmpl) tabBtnTmpl.onclick = () => switchAddWorkoutTab('template');
    if (btnCloseAddModal) btnCloseAddModal.onclick = () => modalAddWorkout?.classList.add('hidden');
    btnCancelAddBtns.forEach(b => b.onclick = () => modalAddWorkout?.classList.add('hidden'));

    if (btnGotoTemplates) {
        btnGotoTemplates.onclick = () => {
            modalAddWorkout?.classList.add('hidden');
            window.location.hash = 'templates';
        };
    }

    if (formCreateCustom) {
        formCreateCustom.onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('custom-workout-name')?.value.trim() || 'Custom Workout';
            const week = document.getElementById('custom-workout-week')?.value || '1';
            const day = document.getElementById('custom-workout-day')?.value || '1';
            const notes = document.getElementById('custom-workout-notes')?.value.trim() || '';

            modalAddWorkout?.classList.add('hidden');
            window.location.hash = `builder?new=true&clientId=${client.id}&week=${week}&day=${day}&name=${encodeURIComponent(name)}&instructions=${encodeURIComponent(notes)}`;
        };
    }

    if (formAssignTmpl) {
        formAssignTmpl.onsubmit = async (e) => {
            e.preventDefault();
            const templateId = document.getElementById('select-existing-template')?.value;
            const targetWeek = parseInt(document.getElementById('select-template-target-week')?.value) || 1;
            const btnSubmit = document.getElementById('btn-submit-assign-template');

            if (!templateId) {
                showToast('Please select a template to assign', 'error', 'No Template Selected');
                return;
            }

            try {
                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Assigning...`;
                }
                await window.appState.assignTemplateToClient(templateId, client.id, targetWeek);
                showToast(`Assigned template to Week ${targetWeek}!`, 'success', 'Template Assigned');
                modalAddWorkout?.classList.add('hidden');
                renderTraining();
            } catch (err) {
                showToast(`Failed to assign template: ${err.message}`, 'error', 'Assignment Error');
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = `<span class="material-symbols-outlined text-[16px]">person_add</span> Assign Template`;
                }
            }
        };
    }

    if (btnAddWorkout) {
        btnAddWorkout.onclick = () => {
            openAddWorkoutModal(1);
        };
    }

    // --- PROGRESS PHOTOS TAB ---
    const photosGalleryMount = document.getElementById('photos-gallery-mount');
    const photosCompareStats = document.getElementById('photos-compare-stats');

    function renderPhotos() {
        if (!photosGalleryMount) return;
        photosGalleryMount.innerHTML = '';

        const clientPhotos = window.appState.progressPhotos.filter(p => p.clientId === client.id).sort((a,b) => new Date(a.date) - new Date(b.date));

        if (clientPhotos.length === 0) {
            photosGalleryMount.innerHTML = `<div class="col-span-2 py-8 text-center text-on-surface-variant text-sm">No progress photos submitted by client yet.</div>`;
            if (photosCompareStats) photosCompareStats.textContent = '';
        } else {
            // Use 'before' tagged photo if available, else earliest front
            const beforePhoto = clientPhotos.find(p => p.before) || clientPhotos[0];
            const latestPhoto = [...clientPhotos].sort((a,b) => new Date(b.date) - new Date(a.date)).find(p => p.front) || clientPhotos[clientPhotos.length - 1];

            // Render Before
            const beforeCard = document.createElement('div');
            beforeCard.className = 'bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden relative h-64 flex items-center justify-center';
            const beforeImgSrc = beforePhoto.before || beforePhoto.front;
            beforeCard.innerHTML = beforeImgSrc
                ? `<img alt="Before" class="w-full h-full object-cover grayscale" src="${beforeImgSrc}"><div class="absolute bottom-2 left-2 bg-black/75 text-white px-2 py-0.5 rounded text-xs">Before (${beforePhoto.date})</div>`
                : `<span class="text-xs text-on-surface-variant italic">No before photo submitted</span>`;
            photosGalleryMount.appendChild(beforeCard);

            // Render Current
            const currentCard = document.createElement('div');
            currentCard.className = 'bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden relative h-64 flex items-center justify-center';
            currentCard.innerHTML = latestPhoto.front
                ? `<img alt="Current" class="w-full h-full object-cover" src="${latestPhoto.front}"><div class="absolute bottom-2 left-2 bg-[#d9f99d] text-[#09090b] font-semibold px-2 py-0.5 rounded text-xs">Current (${latestPhoto.date})</div>`
                : `<span class="text-xs text-on-surface-variant italic">No latest photo submitted</span>`;
            photosGalleryMount.appendChild(currentCard);

            if (photosCompareStats) {
                const dayDiff = Math.round((new Date(latestPhoto.date) - new Date(beforePhoto.date)) / (1000 * 60 * 60 * 24));
                photosCompareStats.textContent = `Time elapsed: ${dayDiff} days • Weight: ${client.weight} kg`;
            }
        }
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

    if (measureTbody) {
        // Render latest measurements summary in info panel
        const summaryMount = document.getElementById('measurements-latest-summary');
        if (summaryMount) {
            const clientMeasuresAll = window.appState.measurements.filter(m => m.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date));
            if (clientMeasuresAll.length > 0) {
                const latestM = clientMeasuresAll[0];
                summaryMount.innerHTML = `
                    <h4 class="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Latest Submission</h4>
                    <div class="grid grid-cols-2 gap-2">
                        ${[{l:'Waist',k:'waist'},{l:'Chest',k:'chest'},{l:'Arms',k:'arms'},{l:'Legs',k:'legs'}].map(s => `
                            <div class="bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-center">
                                <div class="text-[9px] text-on-surface-variant font-label-caps uppercase">${s.l}</div>
                                <div class="font-stat-mono text-sm text-primary font-bold">${latestM[s.k]?.toFixed(1) || '--'}<span class="text-[9px] text-on-surface-variant ml-0.5">cm</span></div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="text-[10px] text-on-surface-variant mt-2 text-right font-mono">Logged: ${latestM.date}</div>
                `;
            } else {
                summaryMount.innerHTML = `<p class="text-xs text-on-surface-variant italic">No measurements logged yet.</p>`;
            }
        }
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
        const rawNotes = window.appState.privateNotes[client.id] || '';
        // Strip the hidden __TARGETS__: line — it's stored in the same field but not a user-facing note
        notesTextarea.value = rawNotes.replace(/^__TARGETS__:.*\n?/m, '').trimStart();

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
        btnEditPlan.onclick = async () => {
            const { data: progs } = await window.supabaseClient
                .from('programs')
                .select('program_weeks(workouts(id))')
                .eq('client_id', client.id)
                .limit(1)
                .maybeSingle();
            const wkId = progs?.program_weeks?.[0]?.workouts?.[0]?.id;
            window.location.hash = wkId ? `builder/${wkId}` : 'builder';
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
