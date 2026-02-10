#!/usr/bin/env node
/**
 * Script to generate DMG background images
 * Uses puppeteer to render HTML to PNG
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { detectBrowserPaths } = require('../browser-detector');

async function generateDmgBackground() {
    const buildDir = path.join(__dirname, '..', 'build');

    // Ensure build directory exists
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
    }

    // Detect browser
    const browsers = detectBrowserPaths();
    if (!browsers || browsers.length === 0) {
        console.error('No browser found. Please install Chrome, Edge, or Brave.');
        process.exit(1);
    }

    const browserInfo = browsers[0];
    console.log(`Using browser: ${browserInfo.name}`);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                width: 540px;
                height: 380px;
                background: linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%);
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
                padding: 30px 40px;
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
            }
            .title {
                color: #ffffff;
                font-size: 28px;
                font-weight: 600;
                text-align: center;
                letter-spacing: 0.5px;
            }
            .subtitle {
                color: #4fc3f7;
                font-size: 14px;
                font-weight: 400;
                margin-top: 5px;
            }
            .spacer {
                flex: 1;
            }
            .instructions {
                color: rgba(255, 255, 255, 0.7);
                font-size: 15px;
                text-align: center;
                margin-bottom: 10px;
            }
            .arrow {
                color: #4fc3f7;
                font-size: 20px;
            }
        </style>
    </head>
    <body>
        <div>
            <div class="title">Super Screenshot</div>
            <div class="subtitle">v1.2.0</div>
        </div>
        <div class="spacer"></div>
        <div class="instructions">
            Arrastra a Aplicaciones <span class="arrow">→</span>
        </div>
    </body>
    </html>
    `;

    const browser = await puppeteer.launch({
        executablePath: browserInfo.path,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Generate 1x version (540x380)
        await page.setViewport({ width: 540, height: 380, deviceScaleFactor: 1 });
        await page.setContent(html);
        await page.screenshot({
            path: path.join(buildDir, 'dmg-background.png'),
            type: 'png'
        });
        console.log('Created: build/dmg-background.png (540x380)');

        // Generate 2x version (1080x760)
        await page.setViewport({ width: 540, height: 380, deviceScaleFactor: 2 });
        await page.setContent(html);
        await page.screenshot({
            path: path.join(buildDir, 'dmg-background@2x.png'),
            type: 'png'
        });
        console.log('Created: build/dmg-background@2x.png (1080x760)');

        console.log('DMG backgrounds generated successfully!');
    } finally {
        await browser.close();
    }
}

generateDmgBackground().catch(err => {
    console.error('Error generating DMG background:', err);
    process.exit(1);
});
