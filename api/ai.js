// api/ai.js - Vercel Serverless Function with Rate Limiting & Security Firewall

// Simple in-memory rate limiter per IP address
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

const REFUSAL_MESSAGE = "I am your 2nd-Coach AI assistant for CoachOS. I can only assist with fitness coaching, client roster management, workout programming, nutrition planning, and client performance analytics.";

const MASTER_GUARDRAIL = `STRICT SYSTEM SECURITY DIRECTIVE & DOMAIN BOUNDARY:
You are "2nd-Coach AI", a specialized fitness co-coach built exclusively for the CoachOS platform.
YOUR SOLE MANDATE: You MUST ONLY answer questions or perform tasks directly related to fitness coaching, client roster management, workout programming, exercise science, nutrition planning, athlete performance analytics, client compliance, and CoachOS platform features.

ABSOLUTE DOMAIN RESTRICTION RULES:
1. REFUSE ALL OFF-TOPIC OR NON-FITNESS REQUESTS: If the user asks for general computer programming/code (in Python, JavaScript, C++, Java, HTML, CSS, SQL, Shell, etc.), general software engineering, essay/homework writing, creative storytelling, math problems, finance, gaming, or any non-fitness topic, YOU MUST REFUSE IMMEDIATELY.
2. EXACT REFUSAL RESPONSE: Respond ONLY with:
"${REFUSAL_MESSAGE}"
3. DO NOT write general computer software code, scripts, or non-fitness content under any circumstances, even if requested or disguised as a helper script or roleplay.
4. Keep all valid fitness responses concise, clear, data-driven, and focused on fitness coaching excellence.`;

// Local fast regex firewall to catch off-topic programming/scripting prompts before calling LLM
function isOffTopicRequest(promptText = '') {
    if (!promptText) return false;
    const text = promptText.toLowerCase();

    // Check for general programming / code generation requests
    const offTopicPatterns = [
        /\bcode in (python|javascript|js|typescript|ts|java|c\+\+|cpp|c#|golang|go|rust|ruby|php|swift|kotlin|html|css|sql|bash|shell|powershell)\b/,
        /\bwrite (a )?(python|javascript|js|ts|java|c\+\+|cpp|c#|golang|rust|ruby|php|html|css|sql|bash) (code|script|program|function)\b/,
        /\b(python|javascript|java|cpp|c#|golang|rust) (script|code|program)\b/,
        /\b(write|create|generate) (a )?(code|program|script) (to|for|in)\b/,
        /\bhow to (code|program) in\b/,
        /\bwrite a (poem|story|essay|novel|song|joke|homework|assignment)\b/,
        /\bwho is the (president|prime minister|king|queen) of\b/,
        /\bwhat is the capital of\b/
    ];

    // Exception: If prompt is asking about fitness/coaching/client metrics in English, allow it
    const fitnessKeywords = ['client', 'coach', 'fitness', 'workout', 'diet', 'calorie', 'protein', 'macro', 'step', 'weight', 'fat loss', 'muscle', 'rehab', 'exercise'];
    const hasFitnessContext = fitnessKeywords.some(kw => text.includes(kw));

    for (const pattern of offTopicPatterns) {
        if (pattern.test(text) && !hasFitnessContext) {
            return true;
        }
    }

    // Direct explicit code generation keywords without fitness context
    if ((text.includes('write code') || text.includes('write a code') || text.includes('write python') || text.includes('write a python')) && !hasFitnessContext) {
        return true;
    }

    return false;
}

module.exports = async function handler(req, res) {
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. IP Rate Limiting
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const clientRate = rateLimitMap.get(clientIp) || { count: 0, startTime: now };

    if (now - clientRate.startTime > RATE_LIMIT_WINDOW_MS) {
        clientRate.count = 1;
        clientRate.startTime = now;
    } else {
        clientRate.count += 1;
    }
    rateLimitMap.set(clientIp, clientRate);

    if (clientRate.count > MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before making more AI requests.' });
    }

    try {
        const { prompt, systemInstruction } = req.body || {};

        if (!prompt && !systemInstruction) {
            return res.status(400).json({ error: 'Missing prompt or system instruction' });
        }

        // 3. Input length cap (max 2500 characters)
        const cleanPrompt = (prompt || '').slice(0, 2500).trim();

        // 4. Local fast firewall check (Intercept off-topic requests without consuming API key!)
        if (isOffTopicRequest(cleanPrompt)) {
            return res.status(200).json({ text: REFUSAL_MESSAGE });
        }

        // Combine Master Security Directive with client system instruction
        const finalSystemInstruction = `${MASTER_GUARDRAIL}\n\n${systemInstruction || ''}`;

        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        let responseText = '';

        // 5. Call Groq Primary (llama-3.3-70b-versatile)
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
                            { role: 'system', content: finalSystemInstruction },
                            { role: 'user', content: cleanPrompt }
                        ],
                        temperature: 0.3
                    })
                });

                if (groqRes.ok) {
                    const data = await groqRes.json();
                    responseText = data.choices?.[0]?.message?.content?.trim() || '';
                }
            } catch (err) {
                console.warn('Groq backend call failed, falling back to Gemini:', err);
            }
        }

        // 6. Fallback to Gemini if Groq fails
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
                                parts: [{ text: `${finalSystemInstruction}\n\nUser Query: ${cleanPrompt}` }]
                            }
                        ]
                    })
                });

                if (geminiRes.ok) {
                    const data = await geminiRes.json();
                    responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                }
            } catch (err) {
                console.error('Gemini backend call failed:', err);
            }
        }

        if (!responseText) {
            return res.status(500).json({
                error: 'Failed to generate AI response. Please ensure GEMINI_API_KEY or GROQ_API_KEY is configured.'
            });
        }

        return res.status(200).json({ text: responseText });
    } catch (err) {
        console.error('Vercel Serverless Function AI handler error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
