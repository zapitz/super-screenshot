const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { detectBrowserPaths, getDefaultBrowser } = require('./browser-detector');

async function captureScreenshot(url, settings) {
    // Get browser path
    let executablePath = settings.browserPath;
    
    if (!executablePath || executablePath === 'auto') {
        const browsers = detectBrowserPaths();
        const defaultBrowser = getDefaultBrowser(browsers);
        
        if (!defaultBrowser) {
            throw new Error('No se encontró Chrome, Edge o Chromium instalado. Por favor, instala uno de estos navegadores o especifica la ruta manualmente.');
        }
        
        executablePath = defaultBrowser.path;
    }

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({
            width: settings.resolution.width,
            height: settings.resolution.height
        });

        // Navigate to URL with configurable timeout
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: settings.navigationTimeout || 60000
        });

        // Wait for additional time if specified (fixed waitForTimeout issue)
        await new Promise(resolve => setTimeout(resolve, settings.waitTime));

        // Handle lazy loading if enabled
        if (settings.lazyLoadScroll) {
            await autoScroll(page, settings.scrollDistance);
        }

        // Extract page information
        const pageInfo = await page.evaluate(() => {
            const title = document.title || 'Sin título';
            
            // Try to detect WordPress publish date
            let publishDate = null;
            
            // Common WordPress date selectors - ordered by priority
            const dateSelectors = [
                'meta[property="article:published_time"]',
                'meta[property="datePublished"]',
                'time[datetime]',
                'time.published',
                'time.entry-date',
                '.entry-date time',
                '.posted-on time',
                '.entry-meta time',
                '.wp-block-post-date time',
                '.published',
                '.entry-date',
                '.post-date',
                '.date',
                'meta[name="publish_date"]',
                '.wp-block-post-date'
            ];

            for (const selector of dateSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    if (element.getAttribute('datetime')) {
                        publishDate = element.getAttribute('datetime');
                        console.log(`Found date in ${selector} datetime:`, publishDate);
                        break;
                    } else if (element.getAttribute('content')) {
                        publishDate = element.getAttribute('content');
                        console.log(`Found date in ${selector} content:`, publishDate);
                        break;
                    } else if (element.textContent && element.textContent.trim()) {
                        publishDate = element.textContent.trim();
                        console.log(`Found date in ${selector} text:`, publishDate);
                        break;
                    }
                }
            }

            return {
                title,
                publishDate
            };
        });

        // Create temporary directory for screenshots
        const tempDir = path.join(os.tmpdir(), 'super-screenshot');
        await fs.mkdir(tempDir, { recursive: true });

        // Generate filename based on mode
        let screenshotPath;
        
        if (settings.mode === 'images' && settings.outputDir) {
            // Format: YY-MM-DD-titulo-del-wordpress.png
            const date = new Date();
            const yy = date.getFullYear().toString().slice(-2);
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            const dd = date.getDate().toString().padStart(2, '0');
            
            // Clean title for filename
            const cleanTitle = pageInfo.title
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9\s-]/g, '') // Keep only alphanumeric, spaces, and hyphens
                .replace(/\s+/g, '-') // Replace spaces with hyphens
                .replace(/-+/g, '-') // Replace multiple hyphens with single
                .trim()
                .substring(0, 80); // Limit length
            
            const filename = `${yy}-${mm}-${dd}-${cleanTitle || 'sin-titulo'}.png`;
            screenshotPath = path.join(settings.outputDir, filename);
        } else {
            // Default temporary path for PDF mode
            const timestamp = Date.now();
            screenshotPath = path.join(tempDir, `screenshot_${timestamp}.png`);
        }

        // Take screenshot with appropriate settings
        const screenshotOptions = {
            path: screenshotPath,
            fullPage: settings.fullPage
        };
        
        // Apply viewport height limit if specified (resolution mode)
        if (!settings.fullPage && settings.viewportHeightLimit) {
            screenshotOptions.clip = {
                x: 0,
                y: 0,
                width: settings.resolution.width,
                height: Math.min(settings.resolution.height, settings.viewportHeightLimit)
            };
            delete screenshotOptions.fullPage;
        }
        
        await page.screenshot(screenshotOptions);

        return {
            title: pageInfo.title,
            publishDate: settings.detectWordPress ? pageInfo.publishDate : null,
            screenshotPath,
            timestamp: new Date().toISOString()
        };

    } finally {
        await browser.close();
    }
}

async function autoScroll(page, scrollDistance) {
    await page.evaluate(async (scrollDistance) => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = scrollDistance;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    // Scroll back to top
                    window.scrollTo(0, 0);
                    setTimeout(resolve, 1000);
                }
            }, 100);
        });
    }, scrollDistance);
}

module.exports = {
    captureScreenshot
};