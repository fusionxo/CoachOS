// Global Application State & Supabase Database Manager
class AppState {
    constructor() {
        this.clients = [];
        this.inbox = {};
        this.notifications = [];
        this.workouts = [];
        this.templates = [];
        this.checkins = [];
        this.measurements = [];
        this.progressPhotos = [];
        this.privateNotes = {};
        this.settings = {
            name: '',
            role: 'Head Coach',
            businessName: '',
            email: '',
            currency: 'INR',
            thresholdAdherence: 75,
            demoMode: false
        };
    }

    async refresh() {
        if (!window.supabaseClient) return;

        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) {
            if (this.realtimeChannel) {
                window.supabaseClient.removeChannel(this.realtimeChannel);
                this.realtimeChannel = null;
            }
            this.user = null;
            this.profile = null;
            this.workspace = null;
            this.clients = [];
            this.inbox = {};
            this.workouts = [];
            this.templates = [];
            this.checkins = [];
            this.measurements = [];
            this.progressPhotos = [];
            this.privateNotes = {};
            this.settings = {
                name: '',
                role: 'Head Coach',
                businessName: '',
                email: '',
                currency: 'INR',
                thresholdAdherence: 75,
                demoMode: false
            };
            return;
        }

        this.user = user;
        console.log('Auth loaded:', user.id);

        // Fetch profile
        const { data: profile, error: profileErr } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileErr) {
            console.error('Profile fetch failed:', profileErr.message);
        }

        this.profile = profile || { id: user.id, role: 'coach', full_name: user.email };
        window.userRole = this.profile.role;
        console.log('Profile loaded:', this.profile.role, this.profile.full_name);

        if (this.profile.role === 'coach') {
            // Fetch Workspace
            let { data: workspace } = await window.supabaseClient
                .from('workspaces')
                .select('*')
                .eq('owner_id', user.id)
                .maybeSingle();

            // Client-side safety net: auto-create workspace if DB trigger didn't fire
            if (!workspace) {
                console.warn('No workspace found for coach. Creating workspace...');
                const businessName = this.profile.full_name
                    ? `${this.profile.full_name}'s Workspace`
                    : 'My Workspace';
                const { data: newWorkspace, error: wsErr } = await window.supabaseClient
                    .from('workspaces')
                    .insert({
                        owner_id: user.id,
                        business_name: businessName
                    })
                    .select()
                    .single();

                if (wsErr) {
                    console.error('Failed to create workspace:', wsErr.message);
                } else {
                    workspace = newWorkspace;
                    console.log('Workspace created:', workspace.id);

                    // Verify workspace_members row exists (trigger should handle this)
                    const { data: memberCheck } = await window.supabaseClient
                        .from('workspace_members')
                        .select('id')
                        .eq('workspace_id', workspace.id)
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (!memberCheck) {
                        // Safety insert if trigger didn't fire
                        await window.supabaseClient
                            .from('workspace_members')
                            .insert({
                                workspace_id: workspace.id,
                                user_id: user.id,
                                role: 'owner'
                            });
                        console.log('Workspace membership created manually.');
                    }
                }
            }

            this.workspace = workspace;
            console.log('Workspace loaded:', workspace ? workspace.id : 'NONE');

            this.settings = {
                name: this.profile.full_name || '',
                role: this.profile.role,
                businessName: workspace ? workspace.business_name : '',
                email: this.profile.email,
                avatar: this.profile.avatar_url,
                currency: 'INR',
                thresholdAdherence: 75,
                demoMode: false
            };

            if (workspace) {
                // Fetch Clients in workspace
                const { data: clients } = await window.supabaseClient
                    .from('clients')
                    .select('*, profiles:user_id(avatar_url)')
                    .eq('workspace_id', workspace.id);
                const rawClients = clients || [];
                this.clients = [];

                const clientIds = rawClients.map(c => c.id);

                if (clientIds.length > 0) {
                    const { data: checkins } = await window.supabaseClient
                        .from('check_ins')
                        .select('*')
                        .in('client_id', clientIds)
                        .order('created_at', { ascending: false });
                    this.checkins = (checkins || []).map(c => ({
                        id: c.id,
                        clientId: c.client_id,
                        date: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                        createdAt: c.created_at,
                        weight: c.weight,
                        sleep: c.sleep_hours,
                        steps: c.steps,
                        calories: c.calories !== null && c.calories !== undefined ? c.calories : 0,
                        protein: c.protein !== null && c.protein !== undefined ? c.protein : 0,
                        carbs: c.carbs !== null && c.carbs !== undefined ? c.carbs : 0,
                        fats: c.fats !== null && c.fats !== undefined ? c.fats : 0,
                        mood: c.mood,
                        notes: c.notes,
                        energy: 4
                    }));

                    const { data: measurements } = await window.supabaseClient
                        .from('measurements')
                        .select('*')
                        .in('client_id', clientIds);
                    this.measurements = (measurements || []).map(m => ({
                        id: m.id,
                        clientId: m.client_id,
                        date: m.created_at ? m.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                        weight: m.weight,
                        waist: m.waist,
                        chest: m.chest,
                        arms: m.arms,
                        legs: m.legs
                    }));

                    const { data: progressPhotos } = await window.supabaseClient
                        .from('progress_photos')
                        .select('*')
                        .in('client_id', clientIds);
                    const rawPhotos = progressPhotos || [];
                    this.progressPhotos = [];
                    if (rawPhotos.length > 0) {
                        const paths = rawPhotos.map(p => p.storage_path);
                        const signedUrlMap = {};
                        const { data: urls } = await window.supabaseClient.storage
                            .from('progress-photos')
                            .createSignedUrls(paths, 3600);
                        if (urls) {
                            urls.forEach(u => {
                                signedUrlMap[u.path] = u.signedUrl;
                            });
                        }

                        const photosMap = {};
                        rawPhotos.forEach(p => {
                            const dateStr = new Date(p.created_at).toISOString().split('T')[0];
                            const key = `${p.client_id}_${dateStr}`;
                            if (!photosMap[key]) {
                                photosMap[key] = {
                                    id: p.id,
                                    clientId: p.client_id,
                                    date: dateStr,
                                    front: null,
                                    side: null,
                                    back: null,
                                    before: null
                                };
                            }
                            const signedUrl = signedUrlMap[p.storage_path] || '';
                            if (p.pose_type === 'front') photosMap[key].front = signedUrl;
                            else if (p.pose_type === 'side') photosMap[key].side = signedUrl;
                            else if (p.pose_type === 'back') photosMap[key].back = signedUrl;
                            else if (p.pose_type === 'before') photosMap[key].before = signedUrl;
                        });
                        this.progressPhotos = Object.values(photosMap);
                    }

                    // Fetch coach notes
                    const { data: notes } = await window.supabaseClient
                        .from('coach_notes')
                        .select('*')
                        .eq('coach_id', user.id);
                    this.privateNotes = {};
                    if (notes) {
                        notes.forEach(n => {
                            this.privateNotes[n.client_id] = n.content;
                        });
                    }
                } else {
                    this.checkins = [];
                    this.measurements = [];
                    this.progressPhotos = [];
                    this.privateNotes = {};
                }

                // Fetch workouts
                const { data: programs } = await window.supabaseClient
                    .from('programs')
                    .select('*, program_weeks(*, workouts(*, exercises(*)))')
                    .eq('coach_id', user.id);
                
                this.workouts = [];
                let localCompleted = [];
                try {
                    localCompleted = JSON.parse(localStorage.getItem('coachos_completed_workouts') || '[]');
                } catch(e) {}

                if (programs) {
                    programs.forEach(p => {
                        if (p.program_weeks) {
                            p.program_weeks.forEach(w => {
                                if (w.workouts) {
                                    w.workouts.forEach(wk => {
                                        const isCompletedLocally = localCompleted.includes(wk.id);
                                        let sessionLogs = wk.session_logs || null;
                                        if (!sessionLogs) {
                                            try {
                                                const rawLogs = localStorage.getItem('coachos_workout_logs_' + wk.id);
                                                if (rawLogs) sessionLogs = JSON.parse(rawLogs);
                                            } catch(e) {}
                                        }

                                        this.workouts.push({
                                            id: wk.id,
                                            clientId: p.client_id,
                                            programId: p.id,
                                            weekId: w.id,
                                            weekNumber: w.week_number,
                                            name: wk.name,
                                            status: (isCompletedLocally || wk.status === 'Completed' || (sessionLogs && Object.keys(sessionLogs).length > 0)) ? 'Completed' : (wk.status || 'Scheduled'),
                                            notes: wk.instructions,
                                            programName: p.name,
                                            weekName: `Week ${w.week_number}`,
                                            sessionLogs: sessionLogs,
                                            loggedAt: wk.completed_at || null,
                                            exercises: wk.exercises ? wk.exercises.map(e => ({
                                                id: e.id,
                                                name: e.name,
                                                sets: e.sets,
                                                reps: e.reps,
                                                weight: e.load_target,
                                                rest: e.rest_time,
                                                notes: e.notes,
                                                tempo: e.tempo || '2-0-2',
                                                order: e.order_index
                                            })).sort((a,b) => a.order - b.order) : []
                                        });
                                    });
                                }
                            });
                        }
                    });
                }

                this.clients = rawClients.map(client => {
                    const clientCheckins = this.checkins.filter(ch => ch.clientId === client.id);
                    const clientPrograms = programs ? programs.filter(p => p.client_id === client.id) : [];
                    
                    const daysSinceCreation = Math.max(1, Math.ceil((Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24)));
                    const checkinsCount = clientCheckins.length;
                    const adherence = Math.min(100, Math.round((checkinsCount / Math.min(14, daysSinceCreation)) * 100));

                    const latestCheckin = [...clientCheckins].sort((a,b) => new Date(b.date) - new Date(a.date))[0];
                    let lastCheckInStr = 'Never';
                    if (latestCheckin) {
                        const diffTime = Math.abs(Date.now() - new Date(latestCheckin.date));
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays === 0) lastCheckInStr = 'Today';
                        else if (diffDays === 1) lastCheckInStr = 'Yesterday';
                        else lastCheckInStr = `${diffDays} days ago`;
                    }

                    return {
                        ...client,
                        // Targets read directly from clients table columns
                        target_calories: parseInt(client.target_calories) || 2000,
                        target_protein: parseInt(client.target_protein) || 150,
                        target_carbs: parseInt(client.target_carbs) || 200,
                        target_fats: parseInt(client.target_fats) || 60,
                        target_steps: parseInt(client.target_steps) || 10000,
                        avatar: client.profiles?.avatar_url || null,
                        adherence: adherence || 100,
                        phase: clientPrograms.length > 0 ? clientPrograms[0].name : 'Phase 1',
                        lastCheckIn: lastCheckInStr,
                        weight: latestCheckin ? latestCheckin.weight : (client.starting_weight || '75')
                    };
                });

                // Fetch templates
                const { data: templates } = await window.supabaseClient
                    .from('workout_templates')
                    .select('*')
                    .eq('coach_id', user.id);
                
                this.templates = [];
                if (templates) {
                    templates.forEach(t => {
                        this.templates.push({
                            id: t.id,
                            name: t.name,
                            notes: t.notes || '',
                            exercises: Array.isArray(t.exercises) ? t.exercises.map((e, idx) => ({
                                id: e.id || `e-${idx}`,
                                name: e.name,
                                sets: e.sets,
                                reps: e.reps,
                                weight: e.weight || e.load_target,
                                rest: e.rest || e.rest_time,
                                notes: e.notes,
                                order: e.order || e.order_index || (idx + 1)
                            })).sort((a,b) => a.order - b.order) : []
                        });
                    });
                }

                // Fetch messages
                const { data: msgs } = await window.supabaseClient
                    .from('messages')
                    .select('*')
                    .order('created_at', { ascending: true });
                
                this.inbox = {};
                if (msgs) {
                    msgs.forEach(m => {
                        const conversationId = m.conversation_id;
                        if (!this.inbox[conversationId]) {
                            this.inbox[conversationId] = [];
                        }
                        const isCoach = m.sender_id === this.user.id;
                        this.inbox[conversationId].push({
                            id: m.id,
                            sender: isCoach ? 'coach' : 'client',
                            sender_id: m.sender_id,
                            text: m.content,
                            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            created_at: m.created_at
                        });
                    });
                }
            } else {
                this.clients = [];
                this.checkins = [];
                this.measurements = [];
                this.progressPhotos = [];
                this.privateNotes = {};
                this.workouts = [];
                this.templates = [];
                this.inbox = {};
            }
        } else {
            // Client mode
            const { data: clientRec } = await window.supabaseClient
                .from('clients')
                .select('*, profiles:user_id(avatar_url)')
                .eq('user_id', user.id)
                .maybeSingle();

            if (clientRec) {
                const clientVal = clientRec;

                const { data: checkins } = await window.supabaseClient
                    .from('check_ins')
                    .select('*')
                    .eq('client_id', clientVal.id)
                    .order('created_at', { ascending: false });
                this.checkins = (checkins || []).map(c => ({
                    id: c.id,
                    clientId: c.client_id,
                    date: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                    createdAt: c.created_at,
                    weight: c.weight,
                    sleep: c.sleep_hours,
                    steps: c.steps,
                    calories: c.calories,
                    protein: c.protein,
                    carbs: c.carbs,
                    fats: c.fats,
                    mood: c.mood,
                    notes: c.notes,
                    energy: 4
                }));

                const { data: measurements } = await window.supabaseClient
                    .from('measurements')
                    .select('*')
                    .eq('client_id', clientVal.id);
                this.measurements = (measurements || []).map(m => ({
                    id: m.id,
                    clientId: m.client_id,
                    date: m.created_at ? m.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                    weight: m.weight,
                    waist: m.waist,
                    chest: m.chest,
                    arms: m.arms,
                    legs: m.legs
                }));

                const { data: progressPhotos } = await window.supabaseClient
                    .from('progress_photos')
                    .select('*')
                    .eq('client_id', clientVal.id);
                const rawPhotos = progressPhotos || [];
                this.progressPhotos = [];
                if (rawPhotos.length > 0) {
                    const paths = rawPhotos.map(p => p.storage_path);
                    const signedUrlMap = {};
                    const { data: urls } = await window.supabaseClient.storage
                        .from('progress-photos')
                        .createSignedUrls(paths, 3600);
                    if (urls) {
                        urls.forEach(u => {
                            signedUrlMap[u.path] = u.signedUrl;
                        });
                    }

                    const photosMap = {};
                    rawPhotos.forEach(p => {
                        const dateStr = new Date(p.created_at).toISOString().split('T')[0];
                        const key = `${p.client_id}_${dateStr}`;
                        if (!photosMap[key]) {
                            photosMap[key] = {
                                id: p.id,
                                clientId: p.client_id,
                                date: dateStr,
                                front: null,
                                side: null,
                                back: null,
                                before: null
                            };
                        }
                        const signedUrl = signedUrlMap[p.storage_path] || '';
                        if (p.pose_type === 'front') photosMap[key].front = signedUrl;
                        else if (p.pose_type === 'side') photosMap[key].side = signedUrl;
                        else if (p.pose_type === 'back') photosMap[key].back = signedUrl;
                        else if (p.pose_type === 'before') photosMap[key].before = signedUrl;
                    });
                    this.progressPhotos = Object.values(photosMap);
                }

                // Merge localStorage cached photos for all clients
                try {
                    clientIds.forEach(cId => {
                        const localPhotos = JSON.parse(localStorage.getItem(`coachos_photos_${cId}`) || '[]');
                        localPhotos.forEach(lp => {
                            let rec = this.progressPhotos.find(p => p.clientId === lp.clientId && p.date === lp.date);
                            if (!rec) {
                                rec = { id: 'photo-local-' + Date.now(), clientId: lp.clientId, date: lp.date, front: null, side: null, back: null, before: null };
                                this.progressPhotos.push(rec);
                            }
                            if (lp.poseType === 'front' && !rec.front) rec.front = lp.dataUrl;
                            else if (lp.poseType === 'before' && !rec.before) rec.before = lp.dataUrl;
                        });
                    });
                } catch(e) {}

                // Merge localStorage cached photos
                try {
                    const localPhotos = JSON.parse(localStorage.getItem(`coachos_photos_${clientVal.id}`) || '[]');
                    localPhotos.forEach(lp => {
                        let rec = this.progressPhotos.find(p => p.clientId === lp.clientId && p.date === lp.date);
                        if (!rec) {
                            rec = { id: 'photo-local-' + Date.now(), clientId: lp.clientId, date: lp.date, front: null, side: null, back: null, before: null };
                            this.progressPhotos.push(rec);
                        }
                        if (lp.poseType === 'front' && !rec.front) rec.front = lp.dataUrl;
                        else if (lp.poseType === 'before' && !rec.before) rec.before = lp.dataUrl;
                    });
                } catch(e) {}

                // Fetch client workouts
                const { data: programs } = await window.supabaseClient
                    .from('programs')
                    .select('*, program_weeks(*, workouts(*, exercises(*)))')
                    .eq('client_id', clientVal.id);
                
                this.workouts = [];
                let localCompleted = [];
                try {
                    localCompleted = JSON.parse(localStorage.getItem('coachos_completed_workouts') || '[]');
                } catch(e) {}

                if (programs) {
                    programs.forEach(p => {
                        if (p.program_weeks) {
                            p.program_weeks.forEach(w => {
                                if (w.workouts) {
                                    w.workouts.forEach(wk => {
                                        const isCompletedLocally = localCompleted.includes(wk.id);
                                        this.workouts.push({
                                            id: wk.id,
                                            clientId: clientVal.id,
                                            programId: p.id,
                                            weekId: w.id,
                                            weekNumber: w.week_number,
                                            name: wk.name,
                                            status: (isCompletedLocally || wk.status === 'Completed') ? 'Completed' : (wk.status || 'Scheduled'),
                                            notes: wk.instructions,
                                            programName: p.name,
                                            weekName: `Week ${w.week_number}`,
                                            exercises: wk.exercises ? wk.exercises.map(e => ({
                                                id: e.id,
                                                name: e.name,
                                                sets: e.sets,
                                                reps: e.reps,
                                                weight: e.load_target,
                                                rest: e.rest_time,
                                                notes: e.notes,
                                                tempo: e.tempo || '2-0-2',
                                                order: e.order_index
                                            })).sort((a,b) => a.order - b.order) : []
                                        });
                                    });
                                }
                            });
                        }
                    });
                }

                // Fetch messages
                const { data: msgs } = await window.supabaseClient
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', clientVal.id)
                    .order('created_at', { ascending: true });

                this.inbox = {};
                this.inbox[clientVal.id] = [];
                if (msgs) {
                    msgs.forEach(m => {
                        const isClient = m.sender_id === this.user.id;
                        this.inbox[clientVal.id].push({
                            id: m.id,
                            sender: isClient ? 'client' : 'coach',
                            sender_id: m.sender_id,
                            text: m.content,
                            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            created_at: m.created_at
                        });
                    });
                }

                // Augment clientVal
                const clientCheckins = this.checkins;
                const clientPrograms = programs || [];
                const daysSinceCreation = Math.max(1, Math.ceil((Date.now() - new Date(clientVal.created_at).getTime()) / (1000 * 60 * 60 * 24)));
                const checkinsCount = clientCheckins.length;
                const adherence = Math.min(100, Math.round((checkinsCount / Math.min(14, daysSinceCreation)) * 100));

                const latestCheckin = [...clientCheckins].sort((a,b) => new Date(b.date) - new Date(a.date))[0];
                let lastCheckInStr = 'Never';
                if (latestCheckin) {
                    const diffTime = Math.abs(Date.now() - new Date(latestCheckin.date));
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays === 0) lastCheckInStr = 'Today';
                    else if (diffDays === 1) lastCheckInStr = 'Yesterday';
                    else lastCheckInStr = `${diffDays} days ago`;
                }

                this.clients = [{
                    ...clientVal,
                    // Targets come directly from clients table columns (set by coach via saveClientTargets)
                    target_calories: parseInt(clientVal.target_calories) || 2000,
                    target_protein: parseInt(clientVal.target_protein) || 150,
                    target_carbs: parseInt(clientVal.target_carbs) || 200,
                    target_fats: parseInt(clientVal.target_fats) || 60,
                    target_steps: parseInt(clientVal.target_steps) || 10000,
                    avatar: clientVal.profiles?.avatar_url || null,
                    adherence: adherence || 100,
                    phase: clientPrograms.length > 0 ? clientPrograms[0].name : 'Phase 1',
                    lastCheckIn: lastCheckInStr,
                    weight: latestCheckin ? latestCheckin.weight : (clientVal.starting_weight || '75')
                }];
            } else {
                this.clients = [];
                this.checkins = [];
                this.measurements = [];
                this.progressPhotos = [];
                this.workouts = [];
                this.inbox = {};
            }
        }
        
        // Setup realtime subscription
        this.setupRealtimeSubscription();
    }

    async addClient(name, email, goal, startingWeight = '75') {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        if (!this.workspace) {
            throw new Error("No workspace loaded for active coach.");
        }

        const { data: client, error } = await window.supabaseClient
            .from('clients')
            .insert({
                workspace_id: this.workspace.id,
                coach_id: this.user.id,
                name,
                email,
                starting_weight: startingWeight,
                goal: goal === 'fat_loss' ? 'Fat Loss' : goal === 'muscle_gain' ? 'Muscle Gain' : goal === 'strength' ? 'Strength' : 'Performance',
                experience_level: 'Intermediate (1-3 yrs)',
                status: 'Healthy'
            })
            .select()
            .single();

        if (error || !client) throw error || new Error('Client creation failed or was blocked by RLS policies.');

        // Insert initial check-in log
        await window.supabaseClient
            .from('check_ins')
            .insert({
                client_id: client.id,
                weight: parseFloat(startingWeight),
                sleep_hours: 8.0,
                steps: 10000,
                mood: '🙂',
                notes: 'Initial weight recorded upon registration.'
            });

        // Insert initial message
        await window.supabaseClient
            .from('messages')
            .insert({
                conversation_id: client.id,
                sender_id: this.user.id,
                content: `Welcome to CoachOS, ${name}! Looking forward to working together towards your goal.`
            });

        // Generate secure random token (12 characters)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 12; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

        const { error: inviteError } = await window.supabaseClient
            .from('client_invites')
            .insert({
                client_id: client.id,
                workspace_id: this.workspace.id,
                email: email,
                token: token,
                expires_at: expiresAt.toISOString()
            });

        if (inviteError) throw inviteError;

        await this.refresh();
        return { client, token };
    }

    async saveCheckIn(clientId, checkin) {
        const todayStr = checkin.date || new Date().toISOString().split('T')[0];

        // 1. Update in-memory state immediately for responsive local updates
        let existingLocal = this.checkins.find(c => c.clientId === clientId && c.date === todayStr);
        if (existingLocal) {
            if (checkin.weight !== undefined) existingLocal.weight = parseFloat(checkin.weight);
            if (checkin.sleep !== undefined) existingLocal.sleep = parseFloat(checkin.sleep);
            if (checkin.steps !== undefined) existingLocal.steps = parseInt(checkin.steps);
            if (checkin.calories !== undefined) existingLocal.calories = parseInt(checkin.calories);
            if (checkin.protein !== undefined) existingLocal.protein = parseInt(checkin.protein);
            if (checkin.carbs !== undefined) existingLocal.carbs = parseInt(checkin.carbs);
            if (checkin.fats !== undefined) existingLocal.fats = parseInt(checkin.fats);
            if (checkin.mood) existingLocal.mood = checkin.mood;
            if (checkin.energy !== undefined) existingLocal.energy = parseInt(checkin.energy);
            if (checkin.notes) existingLocal.notes = checkin.notes;
        } else {
            existingLocal = {
                id: 'ci-' + Date.now(),
                clientId: clientId,
                date: todayStr,
                createdAt: new Date().toISOString(),
                weight: parseFloat(checkin.weight) || 75.0,
                sleep: parseFloat(checkin.sleep) || 7.0,
                steps: parseInt(checkin.steps) || 10000,
                calories: checkin.calories !== undefined && checkin.calories !== null ? parseInt(checkin.calories) : 0,
                protein: checkin.protein !== undefined && checkin.protein !== null ? parseInt(checkin.protein) : 0,
                carbs: checkin.carbs !== undefined && checkin.carbs !== null ? parseInt(checkin.carbs) : 0,
                fats: checkin.fats !== undefined && checkin.fats !== null ? parseInt(checkin.fats) : 0,
                mood: checkin.mood || '🙂',
                energy: checkin.energy !== undefined ? parseInt(checkin.energy) : 4,
                notes: checkin.notes || ''
            };
            this.checkins.push(existingLocal);
        }

        const client = this.clients.find(c => c.id === clientId);
        if (client && checkin.weight) {
            client.weight = checkin.weight.toString();
        }

        // 2. Persist to Supabase if authenticated
        if (this.user && this.user.id && window.supabaseClient) {
            try {
                const { data: existingCheckins } = await window.supabaseClient
                    .from('check_ins')
                    .select('*')
                    .eq('client_id', clientId)
                    .order('created_at', { ascending: false });

                const existingToday = (existingCheckins || []).find(c => {
                    const dateStr = c.created_at ? c.created_at.split('T')[0] : '';
                    return dateStr === todayStr;
                });

                const payload = {
                    client_id: clientId,
                    weight: parseFloat(checkin.weight),
                    sleep_hours: parseFloat(checkin.sleep),
                    steps: parseInt(checkin.steps),
                    calories: checkin.calories !== undefined && checkin.calories !== null ? parseInt(checkin.calories) : null,
                    protein: checkin.protein !== undefined && checkin.protein !== null ? parseInt(checkin.protein) : null,
                    carbs: checkin.carbs !== undefined && checkin.carbs !== null ? parseInt(checkin.carbs) : null,
                    fats: checkin.fats !== undefined && checkin.fats !== null ? parseInt(checkin.fats) : null,
                    mood: checkin.mood || '🙂',
                    notes: checkin.notes || ''
                };

                if (existingToday) {
                    await window.supabaseClient
                        .from('check_ins')
                        .update(payload)
                        .eq('id', existingToday.id);
                } else {
                    await window.supabaseClient
                        .from('check_ins')
                        .insert(payload);
                }

                await window.supabaseClient
                    .from('clients')
                    .update({
                        starting_weight: checkin.weight ? checkin.weight.toString() : undefined,
                        status: 'Healthy'
                    })
                    .eq('id', clientId);
            } catch (err) {
                console.warn('Supabase checkin sync warning:', err.message);
            }
        }
    }

    async saveClientTargets(clientId, targets) {
        const parsedTargets = {
            target_calories: parseInt(targets.target_calories) || 2000,
            target_protein: parseInt(targets.target_protein) || 150,
            target_carbs: parseInt(targets.target_carbs) || 200,
            target_fats: parseInt(targets.target_fats) || 60,
            target_steps: parseInt(targets.target_steps) || 10000
        };

        // 1. Local Storage cache (for instant read on same browser)
        try {
            localStorage.setItem('coachos_targets_' + clientId, JSON.stringify(parsedTargets));
        } catch(e) {}

        // 2. In-Memory AppState Update
        const client = this.clients.find(c => c.id === clientId);
        if (client) {
            Object.assign(client, parsedTargets);
        }

        // 3. Persist to clients table directly — readable by client via RLS
        if (this.user && this.user.id && window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('clients')
                .update(parsedTargets)
                .eq('id', clientId);
            if (error) throw error;
        }
    }


    async saveMeasurements(clientId, waist, chest, arms, legs) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        const client = this.clients.find(c => c.id === clientId);
        const { error } = await window.supabaseClient
            .from('measurements')
            .insert({
                client_id: clientId,
                weight: client ? parseFloat(client.starting_weight) : null,
                waist: parseFloat(waist),
                chest: parseFloat(chest),
                arms: parseFloat(arms),
                legs: parseFloat(legs)
            });

        if (error) throw error;
        await this.refresh();
    }

    async addWorkout(clientId, workout) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        // Find or create default Program
        const { data: program, error: progErr } = await window.supabaseClient
            .from('programs')
            .insert({
                coach_id: this.user.id,
                client_id: clientId,
                name: workout.programName || 'Training Program',
                description: 'Custom training routine.'
            })
            .select()
            .single();

        if (progErr || !program) throw progErr || new Error('Failed to create program.');

        const { data: week, error: weekErr } = await window.supabaseClient
            .from('program_weeks')
            .insert({
                program_id: program.id,
                week_number: 1
            })
            .select()
            .single();

        if (weekErr || !week) throw weekErr || new Error('Failed to create program week.');

        const { data: wk, error: wkErr } = await window.supabaseClient
            .from('workouts')
            .insert({
                week_id: week.id,
                name: workout.name || 'Untitled Session',
                instructions: workout.notes || ''
            })
            .select()
            .single();

        if (wkErr || !wk) throw wkErr || new Error('Failed to create workout.');

        if (workout.exercises && workout.exercises.length > 0) {
            const exercisesToInsert = workout.exercises.map((e, idx) => ({
                workout_id: wk.id,
                name: e.name,
                sets: parseInt(e.sets) || 3,
                reps: e.reps || '10',
                load_target: e.weight || 'RPE 8',
                rest_time: e.rest || '90s',
                notes: e.notes || '',
                order_index: idx + 1
            }));

            const { error: exErr } = await window.supabaseClient
                .from('exercises')
                .insert(exercisesToInsert);
            if (exErr) throw exErr;
        }

        await this.refresh();
        return wk;
    }

    async updateWorkout(workoutId, updatedData) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        // Fetch workout week and program metadata
        const { data: wk } = await window.supabaseClient
            .from('workouts')
            .select('*, program_weeks(*)')
            .eq('id', workoutId)
            .single();

        if (wk) {
            const updatePayload = {
                name: updatedData.name,
                instructions: updatedData.notes
            };
            if (updatedData.status !== undefined) {
                updatePayload.status = updatedData.status;
            }
            await window.supabaseClient
                .from('workouts')
                .update(updatePayload)
                .eq('id', workoutId);

            if (updatedData.exercises) {
                // Delete old exercises
                await window.supabaseClient
                    .from('exercises')
                    .delete()
                    .eq('workout_id', workoutId);

                // Insert updated exercises
                const exercisesToInsert = updatedData.exercises.map((e, idx) => ({
                    workout_id: workoutId,
                    name: e.name,
                    sets: parseInt(e.sets) || 3,
                    reps: e.reps || '10',
                    load_target: e.weight || 'RPE 8',
                    rest_time: e.rest || '90s',
                    notes: e.notes || '',
                    order_index: idx + 1
                }));

                await window.supabaseClient
                    .from('exercises')
                    .insert(exercisesToInsert);
            }
        }

        await this.refresh();
    }

    async logCompletedWorkout(workoutId, sessionLogs = {}) {
        const actualLogs = (sessionLogs && sessionLogs.sessionLogs) ? sessionLogs.sessionLogs : sessionLogs;
        const nowIso = new Date().toISOString();

        // 1. Persist to localStorage FIRST (always works regardless of Supabase)
        try {
            const completedKey = 'coachos_completed_workouts';
            const existing = JSON.parse(localStorage.getItem(completedKey) || '[]');
            if (!existing.includes(workoutId)) {
                existing.push(workoutId);
                localStorage.setItem(completedKey, JSON.stringify(existing));
            }
            if (actualLogs && Object.keys(actualLogs).length > 0) {
                localStorage.setItem('coachos_workout_logs_' + workoutId, JSON.stringify(actualLogs));
            }
        } catch(e) {}

        // 2. Update local in-memory state immediately
        const targetW = this.workouts.find(w => w.id === workoutId);
        if (targetW) {
            targetW.status = 'Completed';
            targetW.loggedAt = nowIso;
            targetW.sessionLogs = actualLogs;
        }

        // 3. Persist to Supabase if possible
        if (this.user && this.user.id && window.supabaseClient) {
            try {
                await window.supabaseClient
                    .from('workouts')
                    .update({
                        status: 'Completed',
                        session_logs: actualLogs,
                        completed_at: nowIso
                    })
                    .eq('id', workoutId);
            } catch (err) {
                console.warn('Supabase workout completion sync warning:', err.message);
                // Local + localStorage fallback is already set above
            }
        }
    }

    async deleteWorkout(workoutId) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        await window.supabaseClient
            .from('workouts')
            .delete()
            .eq('id', workoutId);
        await this.refresh();
    }

    async deleteProgram(programId) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        // Deleting program cascades to program_weeks -> workouts -> exercises
        const { error } = await window.supabaseClient
            .from('programs')
            .delete()
            .eq('id', programId);
        if (error) throw error;
        await this.refresh();
    }

    async saveTemplate(template) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        let templateId = template.id;
        
        // Format the exercises array as expected by database JSONB and by frontend
        const formattedExercises = (template.exercises || []).map((e, idx) => ({
            name: e.name,
            sets: parseInt(e.sets) || 3,
            reps: e.reps || '10',
            weight: e.weight || '70%',
            rest: e.rest || '90s',
            notes: e.notes || '',
            order: idx + 1
        }));

        if (templateId) {
            // Update existing template
            const { error: updateErr } = await window.supabaseClient
                .from('workout_templates')
                .update({
                    name: template.name,
                    notes: template.notes || '',
                    exercises: formattedExercises
                })
                .eq('id', templateId);
            if (updateErr) throw updateErr;
        } else {
            // Create new template
            const { data: createdTemplate, error: insertErr } = await window.supabaseClient
                .from('workout_templates')
                .insert({
                    coach_id: this.user.id,
                    name: template.name || 'Workout Template',
                    notes: template.notes || '',
                    exercises: formattedExercises
                })
                .select()
                .single();
            if (insertErr || !createdTemplate) throw insertErr || new Error('Failed to create workout template.');
            templateId = createdTemplate.id;
        }

        await this.refresh();
        return {
            id: templateId,
            name: template.name,
            notes: template.notes,
            exercises: formattedExercises
        };
    }

    async deleteTemplate(templateId) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        const { error } = await window.supabaseClient
            .from('workout_templates')
            .delete()
            .eq('id', templateId);
        if (error) throw error;
        await this.refresh();
    }

    async duplicateTemplate(templateId) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        const { data: template, error: fetchErr } = await window.supabaseClient
            .from('workout_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (fetchErr || !template) throw fetchErr || new Error('Template not found.');

        const { data: dupTemplate, error: insertErr } = await window.supabaseClient
            .from('workout_templates')
            .insert({
                coach_id: this.user.id,
                name: `${template.name} (Copy)`,
                notes: template.notes,
                exercises: template.exercises
            })
            .select()
            .single();
        if (insertErr || !dupTemplate) throw insertErr || new Error('Failed to create duplicate template.');

        await this.refresh();
    }

    async assignTemplateToClient(templateId, clientId) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        const { data: template, error: fetchErr } = await window.supabaseClient
            .from('workout_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (fetchErr || !template) throw fetchErr || new Error('Template not found.');

        // Programs should only exist after assigning a template to a client
        const { data: prog, error: progErr } = await window.supabaseClient
            .from('programs')
            .insert({
                coach_id: this.user.id,
                client_id: clientId,
                name: template.name,
                description: template.notes
            })
            .select()
            .single();
        if (progErr || !prog) throw progErr || new Error('Failed to assign program template.');

        const { data: week, error: weekErr } = await window.supabaseClient
            .from('program_weeks')
            .insert({
                program_id: prog.id,
                week_number: 1
            })
            .select()
            .single();
        if (weekErr || !week) throw weekErr || new Error('Failed to create assigned week.');

        const { data: createdWk, error: wkErr } = await window.supabaseClient
            .from('workouts')
            .insert({
                week_id: week.id,
                name: template.name,
                instructions: template.notes
            })
            .select()
            .single();

        if (wkErr || !createdWk) throw wkErr || new Error('Failed to create assigned workout.');

        const exercises = Array.isArray(template.exercises) ? template.exercises : [];
        if (exercises.length > 0) {
            const exercisesToInsert = exercises.map((e, idx) => ({
                workout_id: createdWk.id,
                name: e.name,
                sets: parseInt(e.sets) || 3,
                reps: e.reps || '10',
                load_target: e.weight || e.load_target || '70%',
                rest_time: e.rest || e.rest_time || '90s',
                notes: e.notes || '',
                order_index: idx + 1
            }));
            const { error: insErr } = await window.supabaseClient.from('exercises').insert(exercisesToInsert);
            if (insErr) throw insErr;
        }

        await this.refresh();
        return createdWk;
    }

    async sendMessage(clientId, sender, text) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        const conversationId = clientId;
        const targetClient = (this.clients && this.clients.find(c => c.id === clientId || c.user_id === clientId)) || (this.clients && this.clients[0]);
        const senderId = sender === 'coach' 
            ? this.user.id 
            : (targetClient && targetClient.user_id ? targetClient.user_id : this.user.id);
        
        if (!senderId) {
            console.error('Sender ID cannot be determined.');
            return null;
        }

        const nowIso = new Date().toISOString();
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const tempMsgObj = {
            id: 'msg-' + Date.now(),
            sender,
            text,
            time: timeStr,
            conversation_id: conversationId,
            created_at: nowIso
        };

        // Optimistically append message to in-memory state
        if (!this.inbox[clientId]) {
            this.inbox[clientId] = [];
        }
        this.inbox[clientId].push(tempMsgObj);

        // Update local client status
        const client = this.clients.find(c => c.id === clientId);
        if (client) client.status = 'Healthy';

        try {
            const { data, error } = await window.supabaseClient
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content: text
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                tempMsgObj.id = data.id;
                tempMsgObj.created_at = data.created_at;
            }

            await window.supabaseClient
                .from('clients')
                .update({ status: 'Healthy' })
                .eq('id', clientId);

        } catch(err) {
            console.warn('Supabase message sync warning:', err.message);
        }

        return tempMsgObj;
    }

    async uploadProgressPhoto(clientId, file, poseType) {
        // Create DataURL fallback for local instant rendering
        const readFileAsDataUrl = (f) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(f);
        });
        const dataUrl = await readFileAsDataUrl(file);

        // Store in localStorage cache
        const dateStr = new Date().toISOString().split('T')[0];
        try {
            const localPhotosKey = `coachos_photos_${clientId}`;
            const existing = JSON.parse(localStorage.getItem(localPhotosKey) || '[]');
            existing.push({ clientId, date: dateStr, poseType, dataUrl });
            localStorage.setItem(localPhotosKey, JSON.stringify(existing));
        } catch(e) {}

        // Update local in-memory progressPhotos state
        let key = `${clientId}_${dateStr}`;
        let photoRecord = this.progressPhotos.find(p => p.clientId === clientId && p.date === dateStr);
        if (!photoRecord) {
            photoRecord = { id: 'photo-' + Date.now(), clientId, date: dateStr, front: null, side: null, back: null, before: null };
            this.progressPhotos.push(photoRecord);
        }
        if (poseType === 'front') photoRecord.front = dataUrl;
        else if (poseType === 'before') photoRecord.before = dataUrl;

        if (!this.user || !this.user.id || !window.supabaseClient) {
            return photoRecord;
        }

        // Validate file type
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        const fileExt = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
            throw new Error('Only JPG, JPEG, PNG, and WEBP files are allowed.');
        }

        try {
            // Compress image client-side to limit quality/size (max 1080px resolution, 0.78 JPEG quality)
            const compressedFile = typeof window.compressImage === 'function' 
                ? await window.compressImage(file, { maxWidth: 1080, maxHeight: 1080, quality: 0.78 })
                : file;

            // Validate workspace
            let workspaceId = this.workspace ? this.workspace.id : null;
            if (!workspaceId) {
                const { data: cl } = await window.supabaseClient.from('clients').select('workspace_id').eq('id', clientId).single();
                if (cl) workspaceId = cl.workspace_id;
            }

            if (workspaceId) {
                const fileName = `${poseType}_${Date.now()}.jpg`;
                const filePath = `${workspaceId}/${clientId}/${fileName}`;

                const { error: uploadErr } = await window.supabaseClient.storage
                    .from('progress-photos')
                    .upload(filePath, compressedFile, { upsert: true });

                if (!uploadErr) {
                    await window.supabaseClient
                        .from('progress_photos')
                        .insert({
                            client_id: clientId,
                            storage_path: filePath,
                            pose_type: poseType
                        });
                }
            }
        } catch(err) {
            console.warn('Supabase photo upload sync notice (using local image):', err.message);
        }

        return photoRecord;
    }

    async savePrivateNotes(clientId, notes) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }

        // Fetch existing note to preserve __TARGETS__ line if present
        const { data: existingNote } = await window.supabaseClient
            .from('coach_notes')
            .select('content')
            .eq('coach_id', this.user.id)
            .eq('client_id', clientId)
            .maybeSingle();

        let targetsLine = '';
        if (existingNote && existingNote.content) {
            const match = existingNote.content.match(/^__TARGETS__:.*$/m);
            if (match) targetsLine = match[0];
        }

        // Re-attach targets line at the top, followed by the coach's free-text notes
        const mergedContent = targetsLine ? `${targetsLine}\n${notes}` : notes;

        const { error } = await window.supabaseClient
            .from('coach_notes')
            .upsert({
                coach_id: this.user.id,
                client_id: clientId,
                content: mergedContent
            }, {
                onConflict: 'coach_id,client_id'
            });

        if (error) {
            // fallback if upsert constraint fails
            await window.supabaseClient
                .from('coach_notes')
                .delete()
                .eq('coach_id', this.user.id)
                .eq('client_id', clientId);
            await window.supabaseClient
                .from('coach_notes')
                .insert({
                    coach_id: this.user.id,
                    client_id: clientId,
                    content: mergedContent
                });
        }
        await this.refresh();
    }

    async saveSettings(settingsData) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        const { error: profileErr } = await window.supabaseClient
            .from('profiles')
            .update({
                full_name: settingsData.name,
                avatar_url: settingsData.avatar
            })
            .eq('id', this.user.id);

        if (profileErr) throw profileErr;

        if (this.workspace) {
            const { error: workspaceErr } = await window.supabaseClient
                .from('workspaces')
                .update({
                    business_name: settingsData.businessName
                })
                .eq('id', this.workspace.id);
            if (workspaceErr) throw workspaceErr;
        } else {
            const { error: workspaceErr } = await window.supabaseClient
                .from('workspaces')
                .insert({
                    owner_id: this.user.id,
                    business_name: settingsData.businessName
                });
            if (workspaceErr) throw workspaceErr;
        }

        await this.refresh();
    }

    async updateClientTargets(clientId, targets) {
        if (!this.user || !this.user.id) throw new Error("Authentication not initialized");
        
        const client = this.clients.find(c => c.id === clientId);
        if (client) {
            if (targets.target_steps !== undefined) client.target_steps = targets.target_steps;
            if (targets.target_calories !== undefined) client.target_calories = targets.target_calories;
            if (targets.target_protein !== undefined) client.target_protein = targets.target_protein;
            if (targets.target_carbs !== undefined) client.target_carbs = targets.target_carbs;
            if (targets.target_fats !== undefined) client.target_fats = targets.target_fats;
        }

        const updateData = {};
        if (targets.target_steps !== undefined) updateData.target_steps = targets.target_steps;
        if (targets.target_calories !== undefined) updateData.target_calories = targets.target_calories;
        if (targets.target_protein !== undefined) updateData.target_protein = targets.target_protein;
        if (targets.target_carbs !== undefined) updateData.target_carbs = targets.target_carbs;
        if (targets.target_fats !== undefined) updateData.target_fats = targets.target_fats;

        if (window.supabaseClient) {
            await window.supabaseClient
                .from('clients')
                .update(updateData)
                .eq('id', clientId);
        }
    }

    async updateClientDetails(clientId, updates) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }

        const client = this.clients.find(c => c.id === clientId);
        if (client) {
            if (updates.name) client.name = updates.name;
            if (updates.email) client.email = updates.email;
            if (updates.goal) client.goal = updates.goal;
            if (updates.status) client.status = updates.status;
        }

        const updatePayload = {};
        if (updates.name) updatePayload.name = updates.name;
        if (updates.email) updatePayload.email = updates.email;
        if (updates.goal) updatePayload.goal = updates.goal;
        if (updates.status) updatePayload.status = updates.status;

        if (window.supabaseClient) {
            const { error: clientErr } = await window.supabaseClient
                .from('clients')
                .update(updatePayload)
                .eq('id', clientId);

            if (clientErr) throw clientErr;

            if (updates.email) {
                try {
                    await window.supabaseClient
                        .from('client_invites')
                        .update({ email: updates.email })
                        .eq('client_id', clientId);
                } catch (invErr) {
                    console.warn('client_invites email sync notice:', invErr.message);
                }
            }
        }

        await this.refresh();
    }

    async resolveClientAlert(clientId, status = 'Healthy') {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        const { error } = await window.supabaseClient
            .from('clients')
            .update({
                status: status
            })
            .eq('id', clientId);
        if (error) throw error;
        await this.refresh();
    }

    async save() {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        try {
            for (const client of this.clients) {
                const { error } = await window.supabaseClient
                    .from('clients')
                    .update({
                        name: client.name,
                        email: client.email,
                        goal: client.goal,
                        status: client.status,
                        starting_weight: client.starting_weight
                    })
                    .eq('id', client.id);
                if (error) throw error;
            }
            await this.refresh();
        } catch (e) {
            console.error("Error saving state:", e);
            throw e;
        }
    }

    setupRealtimeSubscription() {
        if (this.realtimeChannel) return;
        if (!window.supabaseClient || !this.user) return;

        if (typeof window.logEvent === 'function') window.logEvent('info', 'Realtime subscription initialized');
        this.realtimeChannel = window.supabaseClient.channel('global-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                // Direct high-performance handling for incoming chat messages
                if (payload.table === 'messages' && payload.eventType === 'INSERT') {
                    const m = payload.new;
                    const convId = m.conversation_id;
                    const isCoachMode = this.profile && this.profile.role === 'coach';
                    const isSenderCurrentUser = m.sender_id === this.user.id;
                    const sender = isCoachMode 
                        ? (isSenderCurrentUser ? 'coach' : 'client')
                        : (isSenderCurrentUser ? 'client' : 'coach');

                    const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    if (!this.inbox[convId]) this.inbox[convId] = [];
                    
                    const existingMsg = this.inbox[convId].find(existing => existing.id === m.id || (existing.text === m.content && existing.sender === sender && Math.abs(new Date(existing.created_at || 0) - new Date(m.created_at)) < 5000));
                    
                    const newMsg = {
                        id: m.id,
                        sender: sender,
                        text: m.content,
                        time: timeStr,
                        conversation_id: convId,
                        created_at: m.created_at
                    };

                    if (!existingMsg) {
                        this.inbox[convId].push(newMsg);
                    } else {
                        existingMsg.id = m.id;
                    }

                    // Dispatch to active screen handler
                    if (typeof window.onRealtimeMessageReceived === 'function') {
                        window.onRealtimeMessageReceived(newMsg);
                    }
                    return;
                }

                // Background sync for non-message table changes without blocking UI
                this.refresh().then(() => {
                    if (window.router && typeof window.router.refreshActiveScreen === 'function') {
                        const hash = window.location.hash.slice(1);
                        if (!hash.startsWith('inbox') && !hash.startsWith('client-mobile')) {
                            window.router.refreshActiveScreen();
                        }
                    }
                });
            })
            .subscribe();
    }

    async duplicateWorkout(workoutId) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        // Fetch workout details along with exercises
        const { data: wk, error: wkErr } = await window.supabaseClient
            .from('workouts')
            .select('*, program_weeks(*, programs(*)), exercises(*)')
            .eq('id', workoutId)
            .single();
        if (wkErr || !wk) throw wkErr || new Error('Workout not found.');

        const program = wk.program_weeks?.programs;
        if (!program) throw new Error('Program not found.');

        // Insert new workout in the same program week
        const { data: newWk, error: newWkErr } = await window.supabaseClient
            .from('workouts')
            .insert({
                week_id: wk.week_id,
                name: `${wk.name} (Copy)`,
                instructions: wk.instructions
            })
            .select()
            .single();

        if (newWkErr || !newWk) throw newWkErr || new Error('Failed to duplicate workout.');

        if (wk.exercises && wk.exercises.length > 0) {
            const exercisesToInsert = wk.exercises.map(e => ({
                workout_id: newWk.id,
                name: e.name,
                sets: e.sets,
                reps: e.reps,
                load_target: e.load_target,
                rest_time: e.rest_time,
                notes: e.notes,
                order_index: e.order_index
            }));

            const { error: exErr } = await window.supabaseClient
                .from('exercises')
                .insert(exercisesToInsert);
            if (exErr) throw exErr;
        }

        await this.refresh();
        return newWk;
    }

    async toggleDemoMode(enable) {
        if (!this.user || !this.user.id) {
            throw new Error("Authentication not initialized");
        }
        // Demo Mode database loader
        if (enable) {
            // Optional: Insert mock DB records into Supabase for development simulation
            console.log('Demo mode simulation requested.');
        } else {
            // Wipe out current user's workspace database tables via RLS deletions
            if (this.workspace) {
                await window.supabaseClient.from('clients').delete().eq('workspace_id', this.workspace.id);
                await window.supabaseClient.from('programs').delete().eq('coach_id', this.user.id);
            }
        }
        await this.refresh();
    }
}

// Instantiate globally
window.appState = new AppState();
if (typeof window.logEvent === 'function') window.logEvent('info', 'AppState initialized');
