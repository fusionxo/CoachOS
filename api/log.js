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

    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    // If webhook URL is not configured, exit silently without error
    if (!DISCORD_WEBHOOK_URL) {
        return res.status(200).json({ status: 'ignored', reason: 'DISCORD_WEBHOOK_URL not configured' });
    }

    try {
        const { level = 'info', message = 'App Event', details = null, user = null, timestamp = new Date().toISOString() } = req.body || {};

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });

        if (discordRes.ok) {
            return res.status(200).json({ status: 'success' });
        } else {
            return res.status(500).json({ error: `Discord returned status ${discordRes.status}` });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Internal Logger Error' });
    }
};
