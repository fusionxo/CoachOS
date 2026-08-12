// api/ai.js - Vercel Serverless Function for Secure AI API Proxying

module.exports = async function handler(req, res) {
    // 1. Enable CORS headers for browser requests
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, systemInstruction } = req.body || {};

        if (!prompt && !systemInstruction) {
            return res.status(400).json({ error: 'Missing prompt or system instruction' });
        }

        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        let responseText = '';

        // 2. Try Groq Primary (llama-3.3-70b-versatile)
        if (GROQ_API_KEY) {
            try {
                const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GROQ_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: 'system', content: systemInstruction || '' },
                            { role: 'user', content: prompt || '' }
                        ],
                        temperature: 0.5
                    })
                });

                if (groqRes.ok) {
                    const data = await groqRes.json();
                    responseText = data.choices?.[0]?.message?.content?.trim() || '';
                } else {
                    console.warn(`Groq API returned status ${groqRes.status}`);
                }
            } catch (err) {
                console.warn('Groq backend call failed, falling back to Gemini:', err);
            }
        }

        // 3. Fallback to Gemini if Groq fails or key is missing
        if (!responseText && GEMINI_API_KEY) {
            try {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
                const geminiRes = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: `${systemInstruction || ''}\n\nUser Query: ${prompt || ''}` }]
                            }
                        ]
                    })
                });

                if (geminiRes.ok) {
                    const data = await geminiRes.json();
                    responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                } else {
                    console.warn(`Gemini API returned status ${geminiRes.status}`);
                }
            } catch (err) {
                console.error('Gemini backend call failed:', err);
            }
        }

        if (!responseText) {
            return res.status(500).json({
                error: 'Failed to generate AI response. Please ensure GEMINI_API_KEY or GROQ_API_KEY is configured in Vercel environment variables.'
            });
        }

        return res.status(200).json({ text: responseText });
    } catch (err) {
        console.error('Vercel Serverless Function AI handler error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
