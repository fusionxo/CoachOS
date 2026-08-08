const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'screens');
const viewsDir = path.join(__dirname, 'views');
const jsDir = path.join(__dirname, 'js');
const jsScreensDir = path.join(jsDir, 'screens');
const cssDir = path.join(__dirname, 'css');

// Ensure directories exist
[viewsDir, jsDir, jsScreensDir, cssDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Mapping of file basenames to target view name
const fileMapping = {
  'coach-dashboard-refined.html': 'dashboard',
  'client-profile-analytics.html': 'analytics',
  'ai-coach-assistant.html': 'assistant',
  'coach-intelligence-dashboard.html': 'intelligence',
  'professional-workout-builder.html': 'builder',
  'coach-inbox.html': 'inbox',
  'workout-logger-mobile.html': 'workout-logger',
  'client-mobile-app.html': 'client-mobile',
  'client-invitation-page.html': 'invitation',
  'coach-onboarding.html': 'onboarding',
  'transformation-comparison.html': 'comparison',
  'add-new-client.html': 'add-client',
  'coachos-platform-flow.html': 'platform-flow',
  'coachos-landing-page.html': 'landing',
  'coachos-prd.txt': 'prd'
};

let globalStyles = `
/* Global Styles consolidated from CoachOS screens */
body {
    background-color: #09090b;
    color: #e3e3d9;
    font-family: 'Inter', sans-serif;
}
.glass-panel {
    background-color: rgba(24, 24, 27, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid #27272a;
}
.card-bg, .card-surface, .card-base {
    background-color: #18181b;
    border: 1px solid #27272a;
}
.border-base {
    border-color: #27272a;
}
/* Custom Scrollbars */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
::-webkit-scrollbar-track {
    background: transparent;
}
::-webkit-scrollbar-thumb {
    background-color: #27272a;
    border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
    background-color: #44483b;
}
`;

function extractContent(filename, targetKey) {
  const filePath = path.join(srcDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing file: ${filename}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // If it's a plain text document (PRD)
  if (filename.endsWith('.txt')) {
    const htmlPrd = `<div class="max-w-3xl mx-auto py-12 px-6 card-surface rounded-xl border p-8 mt-8"><pre class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-on-surface-variant">${content}</pre></div>`;
    fs.writeFileSync(path.join(viewsDir, `${targetKey}.html`), htmlPrd, 'utf8');
    return;
  }

  // 1. Extract Styles
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(content)) !== null) {
    const css = styleMatch[1].trim();
    if (css) {
      globalStyles += `\n/* Styles from ${targetKey} */\n${css}\n`;
    }
  }

  // 2. Extract Scripts (excluding tailwind config)
  const scriptRegex = /<script(?![^>]*id="tailwind-config"|\s*src="https:\/\/cdn.tailwindcss.com)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let scriptContent = '';
  while ((scriptMatch = scriptRegex.exec(content)) !== null) {
    const js = scriptMatch[1].trim();
    if (js) {
      scriptContent += js + '\n';
    }
  }

  if (scriptContent) {
    fs.writeFileSync(path.join(jsScreensDir, `${targetKey}.js`), scriptContent, 'utf8');
    console.log(`Extracted JS: js/screens/${targetKey}.js`);
  }

  // 3. Extract Main content HTML
  // We want to pull out either:
  // - The contents inside <main>...</main> (excluding mobile header/footer if they are duplicate layout items)
  // - Or the direct child body contents for standalone views like Landing and Onboarding.
  let innerHtml = '';
  
  if (content.includes('<main')) {
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
      innerHtml = mainMatch[1];
      // If the main contains a header and bottom nav in the monolithic code, we can clean it up or let the router render it inside the slot.
      // E.g., we want to remove the mobile top header and bottom nav if it's already rendered by index.html shell
      // E.g. <header class="md:hidden... hover:opacity-70">...</header>
      innerHtml = innerHtml.replace(/<header class="md:hidden[^>]*>[\s\S]*?<\/header>/i, '');
      innerHtml = innerHtml.replace(/<nav class="md:hidden[^>]*>[\s\S]*?<\/nav>/i, '');
      
      // Also, if the main contains the inner dashboard content (like the scrollable container), let's make sure it fits the screen height nicely.
    }
  } else {
    // If no <main>, extract from <body>
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      innerHtml = bodyMatch[1];
      // Clean up nav and footer from body if present
      // (For landing, onboarding we might want to keep the local headers if they are unique, let's keep them)
    }
  }

  if (!innerHtml) {
    // Fallback: use entire content
    innerHtml = content;
  }

  // Clean up references to scripts and styling tags so it's a pure template partial
  innerHtml = innerHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  innerHtml = innerHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  fs.writeFileSync(path.join(viewsDir, `${targetKey}.html`), innerHtml.trim(), 'utf8');
  console.log(`Extracted View: views/${targetKey}.html`);
}

// Extract all screens
Object.entries(fileMapping).forEach(([file, key]) => {
  extractContent(file, key);
});

// Save global app.css
fs.writeFileSync(path.join(cssDir, 'app.css'), globalStyles.trim(), 'utf8');
console.log('Saved consolidated stylesheet: css/app.css');
