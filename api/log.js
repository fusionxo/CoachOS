// api/log.js - Vercel Serverless Function for Discord Webhook Logging

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { level = 'info', message = 'App Event', details = null, user = null, timestamp = new Date().toISOString(), webhookUrl = null } = req.body || {};
    const DISCORD_WEBHOOK_URL = webhookUrl || process.env.DISCORD_WEBHOOK_URL;

    // Return clear missing status if webhook URL is not configured anywhere
    if (!DISCORD_WEBHOOK_URL) {
        return res.status(200).json({ status: 'missing_webhook', reason: 'DISCORD_WEBHOOK_URL is not configured in process.env or APP_CONFIG' });
    }

    try {
        let color = 0x3b82f6; // Blue (info)
        if (level === 'warn') color = 0xf59e0b; // Amber (warning)
        if (level === 'error') color = 0xef4444; // Red (error)
        if (level === 'success') color = 0x10b981; // Green (success)

        const fields = [];
        if (user) {
            fields.push({ name: 'User / Coach', value: String(user), inline: true });
        }
        if (details) {
            const detailStr = typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details);
            fields.push({ name: 'Details', value: `\`\`\`json\n${detailStr.slice(0, 950)}\n\`\`\``, inline: false });
        }

        const embed = {
            title: `[CoachOS Log: ${level.toUpperCase()}]`,
            description: message,
            color: color,
            fields: fields,
            footer: { text: `CoachOS Platform • ${timestamp}` }
        };

        const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CoachOS-Logger/1.0 (https://coachosp.vercel.app)'
            },
            body: JSON.stringify({
                username: 'CoachOS Monitor',
                avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0DKFOfi_kNxA1Oe425s2jti5Kzwp0CZ5v1PtRBIEBPUfS0qwRTRpzJI1D1BfVlnkhRNjaPzr1cgIUOpOhJEeIMnQwcefIp121SOid27dl2NiKljMr2rCfGpLbfWPznADe9rG4J4Ze-b0qxqMnYqggw9pJqDFW_q5LzaTUUCRiueCb-XVus0FOsgExLZS6Kfyhjcw8xJvXsuvoiKa09Gqidi6Ov98NrzAihYtTluhAOLcq0WnRsg6qxzRbZARuOF6Z7Nvr-pUh7E0',
                embeds: [embed]
            })
        });

        // Discord returns HTTP 204 No Content or 200 on successful webhook delivery
        if (discordRes.ok || discordRes.status === 204) {
            return res.status(200).json({ status: 'success' });
        } else {
            const errText = await discordRes.text().catch(() => '');
            console.warn(`Discord API error status ${discordRes.status}: ${errText}`);
            return res.status(500).json({ error: `Discord returned status ${discordRes.status}: ${errText}` });
        }
    } catch (err) {
        console.error('Logger handler error:', err);
        return res.status(500).json({ error: err.message || 'Internal Logger Error' });
    }
};
