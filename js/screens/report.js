// Controller for Client Progress Report screen
window.init_report = function (params) {
    const defaultClientId = window.appState.clients[0] ? window.appState.clients[0].id : '';
    const clientId = (params && params.id) || defaultClientId;
    const client = window.appState.clients.find(c => c.id === clientId) || window.appState.clients[0];

    if (!client) {
        console.error('Client not found:', clientId);
        window.location.hash = 'clients';
        return;
    }

    console.log('Generating report preview for:', client.name);

    // Update back button
    const backBtn = document.getElementById('btn-report-back');
    if (backBtn) {
        backBtn.href = `#analytics/${client.id}`;
    }

    // Set Print details
    const printDate = document.getElementById('print-date');
    if (printDate) {
        printDate.textContent = `Generated on: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }

    const printBiz = document.getElementById('print-coach-business');
    const printCoach = document.getElementById('print-coach-name');
    if (window.appState.settings) {
        if (printBiz) printBiz.textContent = window.appState.settings.businessName || 'CoachOS';
        if (printCoach) printCoach.textContent = `Coach: ${window.appState.settings.name || 'Head Coach'}`;
    }

    // Bind basic info
    document.getElementById('report-client-name').textContent = client.name;
    document.getElementById('report-client-email').textContent = client.email;
    document.getElementById('report-client-goal').textContent = client.goal;
    document.getElementById('report-client-phase').textContent = client.phase;

    // Filter data for this client
    const clientCheckins = window.appState.checkins
        .filter(c => c.clientId === client.id)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const clientMeasures = window.appState.measurements
        .filter(m => m.clientId === client.id)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const clientPhotos = window.appState.progressPhotos
        .filter(p => p.clientId === client.id)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const clientWorkouts = window.appState.workouts
        .filter(w => w.clientId === client.id);

    // 1. Weight Metrics
    const deltaEl = document.getElementById('report-weight-delta');
    const spanEl = document.getElementById('report-weight-span');
    if (clientCheckins.length > 0) {
        const startW = clientCheckins[0].weight;
        const currentW = parseFloat(client.weight) || clientCheckins[clientCheckins.length - 1].weight;
        const diff = currentW - startW;

        if (deltaEl) {
            deltaEl.className = `font-stat-mono text-3xl font-bold mt-2 ${diff < 0 ? 'text-[#22c55e] print:text-emerald-600' : diff > 0 ? 'text-error print:text-rose-600' : 'text-on-surface-variant print:text-zinc-500'}`;
            deltaEl.textContent = diff < 0 ? `${diff.toFixed(1)} kg` : diff > 0 ? `+${diff.toFixed(1)} kg` : '0.0 kg';
        }
        if (spanEl) {
            spanEl.textContent = `${startW.toFixed(1)} kg starting to ${currentW.toFixed(1)} kg current`;
        }
    } else {
        if (deltaEl) deltaEl.textContent = '-- kg';
        if (spanEl) spanEl.textContent = 'No check-in weights logged';
    }

    // 2. Adherence, Sleep & Steps averages
    const adherenceEl = document.getElementById('report-adherence-val');
    if (adherenceEl) {
        adherenceEl.textContent = `${client.adherence}%`;
    }

    // Calculate Averages from Checkins
    const sleepEl = document.getElementById('report-sleep-val');
    const stepsEl = document.getElementById('report-steps-val');
    const stepsSpan = document.getElementById('report-steps-span');

    if (clientCheckins.length > 0) {
        const totalSleep = clientCheckins.reduce((sum, c) => sum + (c.sleep || 0), 0);
        const avgSleep = totalSleep / clientCheckins.length;
        if (sleepEl) sleepEl.textContent = `${avgSleep.toFixed(1)} hrs`;

        const totalSteps = clientCheckins.reduce((sum, c) => sum + (c.steps || 0), 0);
        const avgSteps = totalSteps / clientCheckins.length;
        if (stepsEl) stepsEl.textContent = Math.round(avgSteps).toLocaleString();
    } else {
        if (sleepEl) sleepEl.textContent = client.sleep || '-- hrs';
        if (stepsEl) stepsEl.textContent = client.steps || '--';
    }

    // 3. Progress Photos
    const beforePhoto = document.getElementById('report-photo-before');
    const afterPhoto = document.getElementById('report-photo-after');
    const beforeDate = document.getElementById('report-photo-before-date');
    const afterDate = document.getElementById('report-photo-after-date');
    const photosGrid = document.getElementById('report-photos-grid');

    if (clientPhotos.length > 0) {
        const firstP = clientPhotos[0];
        const lastP = clientPhotos[clientPhotos.length - 1];

        if (beforePhoto) beforePhoto.src = firstP.front || '';
        if (beforeDate) beforeDate.textContent = `Before: ${firstP.date}`;

        if (afterPhoto) afterPhoto.src = lastP.front || '';
        if (afterDate) afterDate.textContent = `Current: ${lastP.date}`;
    } else {
        if (photosGrid) {
            photosGrid.className = "flex items-center justify-center min-h-[300px] border border-outline-variant/30 rounded-lg p-6 bg-surface-container-lowest text-center";
            photosGrid.innerHTML = `
                <div class="text-on-surface-variant print:text-zinc-500">
                    <span class="material-symbols-outlined text-4xl block mb-2">image_not_supported</span>
                    <p class="text-sm">No progress photos uploaded yet.</p>
                </div>
            `;
        }
    }

    // 4. Measurements Analysis
    const measurementsBody = document.getElementById('report-measurements-body');
    if (measurementsBody) {
        measurementsBody.innerHTML = '';
        if (clientMeasures.length > 0) {
            const startM = clientMeasures[0];
            const latestM = clientMeasures[clientMeasures.length - 1];

            const metrics = [
                { name: 'Waist', key: 'waist', unit: 'cm' },
                { name: 'Chest', key: 'chest', unit: 'cm' },
                { name: 'Arms', key: 'arms', unit: 'cm' },
                { name: 'Legs', key: 'legs', unit: 'cm' }
            ];

            metrics.forEach(m => {
                const startVal = startM[m.key] || 0;
                const latestVal = latestM[m.key] || 0;
                const changeVal = latestVal - startVal;

                const tr = document.createElement('tr');
                tr.className = 'border-b border-[#27272a]/30 print:border-zinc-100 text-on-surface print:text-zinc-800';

                let changeClass = 'text-on-surface-variant print:text-zinc-500';
                let changeSymbol = '';
                if (changeVal < 0) {
                    changeClass = 'text-[#22c55e] font-semibold print:text-emerald-600';
                    changeSymbol = '';
                } else if (changeVal > 0) {
                    changeClass = 'text-error font-semibold print:text-rose-600';
                    changeSymbol = '+';
                }

                tr.innerHTML = `
                    <td class="py-3 font-medium">${m.name}</td>
                    <td class="py-3 text-right font-stat-mono">${startVal.toFixed(1)} ${m.unit}</td>
                    <td class="py-3 text-right font-stat-mono">${latestVal.toFixed(1)} ${m.unit}</td>
                    <td class="py-3 text-right font-stat-mono ${changeClass}">${changeSymbol}${changeVal.toFixed(1)} ${m.unit}</td>
                `;
                measurementsBody.appendChild(tr);
            });
        } else {
            measurementsBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 text-center text-on-surface-variant print:text-zinc-500 font-medium">
                        No measurements logged. Add measurements under client profile to track metrics.
                    </td>
                </tr>
            `;
        }
    }

    // 5. Training Schedule / Consistency
    const workoutsList = document.getElementById('report-workouts-list');
    if (workoutsList) {
        workoutsList.innerHTML = '';
        if (clientWorkouts.length > 0) {
            clientWorkouts.forEach(w => {
                const item = document.createElement('div');
                item.className = 'p-3 bg-surface-container rounded-lg border border-outline-variant/35 flex justify-between items-center print:bg-white print:border-zinc-200';

                const progText = w.programName ? `${w.programName} • ${w.weekName || 'Week 1'}` : 'Custom Workout';

                item.innerHTML = `
                    <div>
                        <h5 class="text-sm font-semibold text-primary print:text-zinc-900">${w.name}</h5>
                        <p class="text-xs text-on-surface-variant mt-0.5 print:text-zinc-500">${progText}</p>
                    </div>
                    <span class="text-xs font-stat-mono text-primary-container px-2 py-0.5 bg-primary-container/10 rounded border border-primary-container/20 print:bg-zinc-100 print:text-zinc-700 print:border-zinc-200">
                        ${w.exercises ? w.exercises.length : 0} Ex.
                    </span>
                `;
                workoutsList.appendChild(item);
            });
        } else {
            workoutsList.innerHTML = `
                <div class="text-xs text-on-surface-variant print:text-zinc-500 py-4 text-center">
                    No workout routines currently scheduled.
                </div>
            `;
        }
    }

    // Last 5 Check-ins list
    const checkinsList = document.getElementById('report-checkins-list');
    if (checkinsList) {
        checkinsList.innerHTML = '';
        const recentCheckins = [...clientCheckins].reverse().slice(0, 5);
        if (recentCheckins.length > 0) {
            recentCheckins.forEach(c => {
                const item = document.createElement('div');
                item.className = 'p-3 bg-surface-container rounded-lg border border-outline-variant/35 flex justify-between items-center print:bg-white print:border-zinc-200';
                item.innerHTML = `
                    <div>
                        <span class="text-xs font-semibold text-primary print:text-zinc-900">${c.date}</span>
                        <div class="flex gap-3 text-[11px] text-on-surface-variant mt-0.5 print:text-zinc-500">
                            <span>Weight: ${c.weight} kg</span>
                            <span>Steps: ${c.steps.toLocaleString()}</span>
                            <span>Sleep: ${c.sleep}h</span>
                        </div>
                    </div>
                    <span class="text-lg">${c.mood || '😐'}</span>
                `;
                checkinsList.appendChild(item);
            });
        } else {
            checkinsList.innerHTML = `
                <div class="text-xs text-on-surface-variant print:text-zinc-500 py-4 text-center">
                    No daily check-in logs submitted yet.
                </div>
            `;
        }
    }

    // Bind Print Trigger Button
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
        printBtn.onclick = () => {
            window.print();
        };
    }
};
