const fs = require('fs');
const path = require('path');

async function main() {
  const listFile = 'C:\\Users\\kumar\\.gemini\\antigravity-ide\\brain\\ae6e0d19-2520-4c5e-b94e-5cb18a5222e5\\.system_generated\\steps\\23\\output.txt';
  if (!fs.existsSync(listFile)) {
    console.error('List file does not exist:', listFile);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  const screens = data.screens;
  console.log(`Found ${screens.length} screens/files to import.`);

  const screensDir = path.join(__dirname, 'screens');
  if (!fs.existsSync(screensDir)) {
    fs.mkdirSync(screensDir);
  }

  const indexList = [];

  for (const screen of screens) {
    if (!screen.htmlCode || !screen.htmlCode.downloadUrl) {
      console.log(`Skipping screen without downloadUrl: ${screen.title}`);
      continue;
    }

    const title = screen.title;
    const downloadUrl = screen.htmlCode.downloadUrl;
    const isText = screen.htmlCode.mimeType === 'text/plain';
    const ext = isText ? '.txt' : '.html';
    
    // Create safe filename
    const filename = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + ext;

    const destPath = path.join(screensDir, filename);

    console.log(`Fetching: ${title} -> ${filename}...`);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const text = await res.text();
      fs.writeFileSync(destPath, text, 'utf8');
      console.log(`Saved: ${filename}`);

      indexList.push({
        title,
        filename: `screens/${filename}`,
        deviceType: screen.deviceType || 'DESKTOP',
        width: screen.width,
        height: screen.height,
        isText
      });
    } catch (err) {
      console.error(`Failed to download ${title}:`, err.message);
    }
  }

  // Write a JSON of the metadata so index.html can load it or we can generate a static index.html
  fs.writeFileSync(path.join(__dirname, 'imported_screens.json'), JSON.stringify(indexList, null, 2), 'utf8');
  console.log('Import complete! Metadata saved to imported_screens.json');
}

main().catch(err => {
  console.error('Error running import:', err);
});
