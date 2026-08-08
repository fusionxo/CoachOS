// SPA Router for CoachOS
const routes = {
    'landing': { view: 'landing', layout: 'public' },
    'onboarding': { view: 'onboarding', layout: 'public' },
    'invitation': { view: 'invitation', layout: 'public' },
    'login': { view: 'login', layout: 'public' },
    'signup': { view: 'signup', layout: 'public' },
    'forgot-password': { view: 'forgot-password', layout: 'public' },
    'dashboard': { view: 'dashboard', layout: 'coach' },
    'intelligence': { view: 'intelligence', layout: 'coach' },
    'clients': { view: 'clients', layout: 'coach' },
    'analytics': { view: 'analytics', layout: 'coach' },
    'assistant': { view: 'assistant', layout: 'coach' },
    'builder': { view: 'builder', layout: 'coach' },
    'templates': { view: 'templates', layout: 'coach' },
    'inbox': { view: 'inbox', layout: 'coach' },
    'add-client': { view: 'add-client', layout: 'coach' },
    'comparison': { view: 'comparison', layout: 'coach' },
    'platform-flow': { view: 'platform-flow', layout: 'coach' },
    'client-mobile': { view: 'client-mobile', layout: 'mobile' },
    'client': { view: 'client-mobile', layout: 'mobile' },
    'workout-logger': { view: 'workout-logger', layout: 'mobile' },
    'settings': { view: 'settings', layout: 'coach' },
    'more': { view: 'more', layout: 'coach' },
    'report': { view: 'report', layout: 'coach' },
    'prd': { view: 'prd', layout: 'coach' }
};

class Router {
    constructor() {
        this.appContainer = document.getElementById('app-mount');
        window.addEventListener('hashchange', () => this.handleRoute());
        // Initialize
        setTimeout(() => this.handleRoute(), 100);
    }

    async handleRoute() {
        let hash = window.location.hash.slice(1) || 'landing';
        let routeKey = hash;
        let params = {};

        // Parse path parameters (e.g. #analytics/rahul-sharma, #builder/w1)
        if (hash.includes('/')) {
            const parts = hash.split('/');
            routeKey = parts[0];
            params.id = parts[1];
        }

        const route = routes[routeKey];
        if (!route) {
            console.error('Route not found:', hash);
            window.location.hash = 'landing';
            return;
        }

        // Authenticated Session Checking
        let user = null;
        if (window.supabaseClient) {
            try {
                const { data } = await window.supabaseClient.auth.getUser();
                user = data.user;
                
                if (user && window.appState) {
                    window.appState.user = user;
                    await window.appState.refresh();
                }
            } catch (err) {
                console.error('Error fetching authenticated user:', err);
            }
        }

        const publicRoutes = ['landing', 'login', 'signup', 'forgot-password', 'invitation', 'onboarding'];

        if (!user && !publicRoutes.includes(routeKey)) {
            console.log('Unauthenticated access blocked. Redirecting to login.');
            window.location.hash = 'login';
            return;
        }

        if (user) {
            if (window.appState && window.appState.profile) {
                window.userRole = window.appState.profile.role;
            }
            const role = window.userRole || 'coach';

            // Redirect authenticated users away from login/signup pages only
            // Allow onboarding, landing, and invitation even when authenticated
            const authRedirectRoutes = ['login', 'signup', 'forgot-password'];
            if (authRedirectRoutes.includes(routeKey)) {
                if (role === 'client') {
                    window.location.hash = `client-mobile/${user.id}`;
                } else {
                    window.location.hash = 'dashboard';
                }
                return;
            }

            // Role-based view containment: block clients from coach management screens only
            if (role === 'client') {
                const clientRoutes = ['client-mobile', 'client', 'workout-logger', 'invitation', 'landing', 'onboarding'];
                if (!clientRoutes.includes(routeKey)) {
                    console.log('Client blocked from coach views. Redirecting to portal.');
                    window.location.hash = `client-mobile/${user.id}`;
                    return;
                }
            }
        }

        console.log(`Routing to: #${hash} | Layout: ${route.layout} | View: ${route.view}`);

        // Update layouts
        this.renderLayout(route.layout, routeKey);

        // Fetch and inject HTML
        const container = document.getElementById('view-content-mount');
        if (container) {
            // Render Loading state
            container.innerHTML = `
                <div class="flex items-center justify-center min-h-[400px]">
                    <div class="flex flex-col items-center gap-4">
                        <span class="material-symbols-outlined text-[48px] text-primary-container animate-spin">progress_activity</span>
                        <p class="text-sm font-mono text-on-surface-variant">Loading view...</p>
                    </div>
                </div>
            `;

            try {
                const res = await fetch(`views/${route.view}.html`);
                if (!res.ok) throw new Error(`Fetch view failed: ${res.statusText}`);
                const html = await res.text();
                
                // Mount html
                container.innerHTML = html;

                // Load screen controller script
                this.loadScreenScript(route.view, params);
            } catch (err) {
                console.error(err);
                container.innerHTML = `
                    <div class="flex items-center justify-center min-h-[400px]">
                        <div class="card-bg border border-error-container/30 rounded-xl p-8 max-w-md text-center">
                            <span class="material-symbols-outlined text-[48px] text-error mb-2">error</span>
                            <h3 class="font-headline-md text-primary mb-2">Error Loading Page</h3>
                            <p class="text-sm text-on-surface-variant">${err.message}</p>
                            <button class="mt-4 px-4 py-2 rounded-lg bg-[#d9f99d] text-[#09090b] text-sm font-semibold" onclick="location.reload()">Retry</button>
                        </div>
                    </div>
                `;
            }
        }
    }

    renderLayout(layoutType, activeRoute) {
        document.body.className = "font-body-base bg-background text-on-background antialiased";

        if (layoutType === 'coach') {
            // Check if coach shell is active
            if (!document.getElementById('coach-layout-shell')) {
                this.appContainer.innerHTML = `
                    <div id="coach-layout-shell" class="flex min-h-screen">
                        <!-- Desktop SideNavBar -->
                        <aside class="hidden md:flex flex-col h-screen py-unit-lg px-unit-md w-[280px] sticky top-0 left-0 border-r border-outline-variant bg-surface shrink-0">
                            <div class="flex items-center gap-unit-md mb-unit-xl px-unit-md">
                                <div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center overflow-hidden">
                                    <img alt="Coach Profile Picture" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0DKFOfi_kNxA1Oe425s2jti5Kzwp0CZ5v1PtRBIEBPUfS0qwRTRpzJI1D1BfVlnkhRNjaPzr1cgIUOpOhJEeIMnQwcefIp121SOid27dl2NiKljMr2rCfGpLbfWPznADe9rG4J4Ze-b0qxqMnYqggw9pJqDFW_q5LzaTUUCRiueCb-XVus0FOsgExLZS6Kfyhjcw8xJvXsuvoiKa09Gqidi6Ov98NrzAihYtTluhAOLcq0WnRsg6qxzRbZARuOF6Z7Nvr-pUh7E0">
                                </div>
                                <div>
                                    <h1 class="font-display-lg text-headline-md font-bold text-primary leading-tight" id="coach-display-name">CoachOS</h1>
                                    <p class="font-body-sm text-body-sm text-on-surface-variant leading-tight" id="coach-display-business">Client Management</p>
                                </div>
                            </div>
                            <nav class="flex-1 space-y-unit-sm flex flex-col">
                                <a id="nav-dashboard" class="flex items-center gap-unit-md px-unit-md py-unit-sm rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-high transition-all" href="#dashboard">
                                    <span class="material-symbols-outlined">dashboard</span> Dashboard
                                </a>
                                <a id="nav-clients" class="flex items-center gap-unit-md px-unit-md py-unit-sm rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-high transition-all" href="#clients">
                                    <span class="material-symbols-outlined">group</span> Clients
                                </a>
                                <a id="nav-inbox" class="flex items-center gap-unit-md px-unit-md py-unit-sm rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-high transition-all" href="#inbox">
                                    <span class="material-symbols-outlined">inbox</span> Inbox
                                </a>
                                <a id="nav-builder" class="flex items-center gap-unit-md px-unit-md py-unit-sm rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-high transition-all" href="#builder">
                                    <span class="material-symbols-outlined">fitness_center</span> Training
                                </a>
                                <a id="nav-templates" class="flex items-center gap-unit-md px-unit-md py-unit-sm rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-high transition-all" href="#templates">
                                    <span class="material-symbols-outlined">edit_note</span> Templates
                                </a>
                                <a id="nav-assistant" class="flex items-center gap-unit-md px-unit-md py-unit-sm rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-high transition-all" href="#assistant">
                                    <span class="material-symbols-outlined">psychology</span> Assistant
                                </a>
                                <a id="nav-settings" class="flex items-center gap-unit-md px-unit-md py-unit-sm rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-high transition-all" href="#settings">
                                    <span class="material-symbols-outlined">settings</span> Settings
                                </a>
                            </nav>
                        </aside>
                        <!-- Main Content Area -->
                        <main class="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 h-screen overflow-y-auto">
                            <!-- Mobile Header -->
                            <header class="md:hidden sticky top-0 w-full z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-margin-mobile h-16 shrink-0">
                                <h1 class="font-display-lg-mobile text-display-lg-mobile font-black text-primary">CoachOS</h1>
                                <button class="text-on-surface-variant hover:text-primary transition-colors">
                                    <span class="material-symbols-outlined">notifications</span>
                                </button>
                            </header>
                            <!-- Content Slot -->
                            <div id="view-content-mount" class="flex-1 flex flex-col"></div>
                        </main>
                        <!-- Mobile Navigation -->
                        <nav class="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center bg-surface/90 backdrop-blur-xl border-t border-outline-variant shadow-[0_-8px_32px_0_rgba(0,0,0,0.5)] rounded-t-xl py-2 shrink-0">
                            <a id="mobile-nav-dashboard" class="flex flex-col items-center justify-center text-on-surface-variant active:opacity-80 transition-all duration-200 px-2 py-1 flex-1" href="#dashboard">
                                <span class="material-symbols-outlined text-[20px]">dashboard</span>
                                <span class="text-[9px] mt-0.5 font-medium leading-none">Dashboard</span>
                            </a>
                            <a id="mobile-nav-clients" class="flex flex-col items-center justify-center text-on-surface-variant active:opacity-80 transition-all duration-200 px-2 py-1 flex-1" href="#clients">
                                <span class="material-symbols-outlined text-[20px]">group</span>
                                <span class="text-[9px] mt-0.5 font-medium leading-none">Clients</span>
                            </a>
                            <a id="mobile-nav-inbox" class="flex flex-col items-center justify-center text-on-surface-variant active:opacity-80 transition-all duration-200 px-2 py-1 flex-1" href="#inbox">
                                <span class="material-symbols-outlined text-[20px]">chat</span>
                                <span class="text-[9px] mt-0.5 font-medium leading-none">Inbox</span>
                            </a>
                            <a id="mobile-nav-builder" class="flex flex-col items-center justify-center text-on-surface-variant active:opacity-80 transition-all duration-200 px-2 py-1 flex-1" href="#builder">
                                <span class="material-symbols-outlined text-[20px]">fitness_center</span>
                                <span class="text-[9px] mt-0.5 font-medium leading-none">Training</span>
                            </a>
                            <a id="mobile-nav-more" class="flex flex-col items-center justify-center text-on-surface-variant active:opacity-80 transition-all duration-200 px-2 py-1 flex-1" href="#more">
                                <span class="material-symbols-outlined text-[20px]">more_horiz</span>
                                <span class="text-[9px] mt-0.5 font-medium leading-none">More</span>
                            </a>
                        </nav>
                    </div>
                `;
                this.updateCoachHeaderDetails();
            }

            // Update active menu link
            document.querySelectorAll('aside nav a').forEach(el => el.className = el.className.replace('text-primary font-bold border-r-4 border-primary bg-surface-container-high', 'text-on-surface-variant font-medium').replace('bg-surface-container-high', ''));
            const activeLink = document.getElementById(`nav-${activeRoute}`);
            if (activeLink) {
                activeLink.className = "flex items-center gap-unit-md px-unit-md py-unit-sm rounded-lg text-primary font-bold border-r-4 border-primary bg-surface-container-high transition-all";
            }

            // Update mobile active link
            document.querySelectorAll('body nav a').forEach(el => el.classList.remove('bg-primary-container', 'text-on-primary-container', 'rounded-xl', 'px-3', 'py-1'));
            
            let mobileActiveRoute = activeRoute;
            if (activeRoute === 'templates' || activeRoute === 'assistant' || activeRoute === 'settings' || activeRoute === 'more') {
                mobileActiveRoute = 'more';
            }
            
            const activeMobileLink = document.getElementById(`mobile-nav-${mobileActiveRoute}`);
            if (activeMobileLink) {
                activeMobileLink.classList.add('bg-primary-container', 'text-on-primary-container', 'rounded-xl', 'px-3', 'py-1');
            }

            // Update main element scrollbars (prevent page scroll in inbox view)
            const mainEl = document.querySelector('#coach-layout-shell main');
            if (mainEl) {
                if (activeRoute === 'inbox') {
                    mainEl.classList.remove('overflow-y-auto');
                    mainEl.classList.add('overflow-hidden');
                } else {
                    mainEl.classList.remove('overflow-hidden');
                    mainEl.classList.add('overflow-y-auto');
                }
            }
        } else if (layoutType === 'mobile') {
            // Render naturally as a full-viewport responsive layout without the phone frame wrapper
            this.appContainer.innerHTML = `<div id="view-content-mount" class="min-h-screen flex flex-col bg-[#09090b]"></div>`;
        } else {
            // Public/Basic layout (Landing, Onboarding, Invitation)
            this.appContainer.innerHTML = `<div id="view-content-mount" class="min-h-screen flex flex-col"></div>`;
        }
    }

    updateCoachHeaderDetails() {
        if (window.appState && window.appState.settings) {
            const nameEl = document.getElementById('coach-display-name');
            const bizEl = document.getElementById('coach-display-business');
            if (nameEl) nameEl.textContent = window.appState.settings.name || 'CoachOS';
            if (bizEl) bizEl.textContent = window.appState.settings.businessName || 'Client Management';
        }
    }

    refreshActiveScreen() {
        let hash = window.location.hash.slice(1) || 'landing';
        let routeKey = hash;
        let params = {};

        if (hash.includes('/')) {
            const parts = hash.split('/');
            routeKey = parts[0];
            params.id = parts[1];
        }

        const initFuncName = `init_${routeKey.replace(/-/g, '_')}`;
        if (typeof window[initFuncName] === 'function') {
            console.log(`Realtime refresh: Re-initializing ${initFuncName}`);
            window[initFuncName](params);
        }
    }

    loadScreenScript(viewName, params) {
        // Remove old scripts
        const oldScript = document.getElementById('screen-controller-script');
        if (oldScript) oldScript.remove();

        const scriptUrl = `js/screens/${viewName}.js`;
        
        // Load dynamically via script tag insertion
        const script = document.createElement('script');
        script.id = 'screen-controller-script';
        script.src = scriptUrl;
        script.onerror = () => console.log(`No screen logic script module loaded for ${viewName}`);
        script.onload = () => {
            const initFuncName = `init_${viewName.replace(/-/g, '_')}`;
            if (typeof window[initFuncName] === 'function') {
                window[initFuncName](params);
            }
        };
        document.body.appendChild(script);
    }
}

// Instantiate globally
window.router = new Router();
