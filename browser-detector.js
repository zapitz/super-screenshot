const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function detectBrowserPaths() {
    const platform = process.platform;
    const browsers = [];

    if (platform === 'win32') {
        // Windows paths
        const windowsPaths = [
            { 
                name: 'Google Chrome',
                paths: [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
                    path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
                    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
                ]
            },
            {
                name: 'Microsoft Edge',
                paths: [
                    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                    path.join(process.env.PROGRAMFILES || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
                    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft\\Edge\\Application\\msedge.exe')
                ]
            },
            {
                name: 'Brave',
                paths: [
                    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                    'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                    path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')
                ]
            }
        ];

        for (const browser of windowsPaths) {
            for (const browserPath of browser.paths) {
                if (fs.existsSync(browserPath)) {
                    browsers.push({ name: browser.name, path: browserPath });
                    break;
                }
            }
        }
    } else if (platform === 'darwin') {
        // macOS paths
        const macPaths = [
            {
                name: 'Google Chrome',
                paths: [
                    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                    path.join(process.env.HOME || '', 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
                ]
            },
            {
                name: 'Microsoft Edge',
                paths: [
                    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                    path.join(process.env.HOME || '', 'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
                ]
            },
            {
                name: 'Brave Browser',
                paths: [
                    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
                    path.join(process.env.HOME || '', 'Applications/Brave Browser.app/Contents/MacOS/Brave Browser')
                ]
            },
            {
                name: 'Chromium',
                paths: [
                    '/Applications/Chromium.app/Contents/MacOS/Chromium',
                    path.join(process.env.HOME || '', 'Applications/Chromium.app/Contents/MacOS/Chromium')
                ]
            }
        ];

        for (const browser of macPaths) {
            for (const browserPath of browser.paths) {
                if (fs.existsSync(browserPath)) {
                    browsers.push({ name: browser.name, path: browserPath });
                    break;
                }
            }
        }
    } else {
        // Linux paths
        const linuxCommands = [
            { name: 'Google Chrome', command: 'google-chrome' },
            { name: 'Google Chrome (stable)', command: 'google-chrome-stable' },
            { name: 'Chromium', command: 'chromium' },
            { name: 'Chromium Browser', command: 'chromium-browser' },
            { name: 'Microsoft Edge', command: 'microsoft-edge' },
            { name: 'Microsoft Edge (stable)', command: 'microsoft-edge-stable' },
            { name: 'Brave', command: 'brave-browser' },
            { name: 'Brave', command: 'brave' }
        ];

        for (const browser of linuxCommands) {
            try {
                const whichPath = execSync(`which ${browser.command} 2>/dev/null`).toString().trim();
                if (whichPath) {
                    browsers.push({ name: browser.name, path: whichPath });
                }
            } catch (e) {
                // Command not found, continue
            }
        }
    }

    return browsers;
}

function getDefaultBrowser(browsers) {
    if (browsers.length === 0) return null;
    
    // Prefer Chrome, then Edge, then others
    const preference = ['Google Chrome', 'Microsoft Edge', 'Chromium', 'Brave'];
    
    for (const pref of preference) {
        const found = browsers.find(b => b.name.includes(pref));
        if (found) return found;
    }
    
    return browsers[0];
}

module.exports = {
    detectBrowserPaths,
    getDefaultBrowser
};