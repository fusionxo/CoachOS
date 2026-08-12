// js/logger.js - Client Log Forwarder to Discord Webhook Serverless Proxy

window.logEvent = function(level, message, details = null) {
    try {
        const userEmail = window.appState && window.appState.user ? window.appState.user.email : null;
        
        fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: level || 'info',
                message: message || '',
                details: details,
                user: userEmail,
                timestamp: new Date().toISOString()
            })
        }).catch(() => {
            // Silence log transport errors silently
        });
    } catch (e) {
        // Silent catch
    }
};
