const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { detectBrowserPaths, getDefaultBrowser } = require('./browser-detector');

// Browser instance cache for reuse
let browserInstance = null;
let browserSettings = null;

async function getBrowser(settings) {
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

    // Reuse browser if settings match
    if (browserInstance && browserSettings === executablePath) {
        try {
            // Check if browser is still connected
            if (browserInstance.isConnected()) {
                return browserInstance;
            }
        } catch (e) {
            // Browser disconnected, will create new one
        }
    }

    // Close old browser if exists
    if (browserInstance) {
        try {
            await browserInstance.close();
        } catch (e) {}
    }

    // Launch new browser
    browserInstance = await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-cache',
            '--disk-cache-size=0',
            '--media-cache-size=0',
            '--disable-features=OpaqueResponseBlockingV02',
            '--disable-web-security',
            '--allow-running-insecure-content'
        ]
    });
    browserSettings = executablePath;
    return browserInstance;
}

async function closeBrowser() {
    if (browserInstance) {
        try {
            await browserInstance.close();
        } catch (e) {}
        browserInstance = null;
        browserSettings = null;
    }
}

async function captureScreenshot(url, settings) {
    const browser = await getBrowser(settings);
    const page = await browser.newPage();

    try {

        // Set realistic User-Agent to avoid CDN blocking
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set extra HTTP headers to appear as a real browser
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        });

        // Disable cache to ensure fresh content
        await page.setCacheEnabled(false);

        // Intercept requests to add proper headers for CDN images
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const url = request.url();
            // For media CDN requests, ensure proper headers
            if (url.includes('media.') && (url.includes('.jpg') || url.includes('.png') || url.includes('.webp'))) {
                const headers = {
                    ...request.headers(),
                    'Referer': new URL(url).origin + '/',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'cross-site'
                };
                request.continue({ headers });
            } else {
                request.continue();
            }
        });

        // Set viewport with device scale factor to ensure proper rendering
        await page.setViewport({
            width: settings.resolution.width,
            height: settings.resolution.height,
            deviceScaleFactor: 1
        });

        // Navigate to URL with configurable timeout and waitUntil
        await page.goto(url, {
            waitUntil: settings.waitUntil || 'networkidle2',
            timeout: settings.navigationTimeout || 30000
        });

        // Wait for additional time if specified (fixed waitForTimeout issue)
        await new Promise(resolve => setTimeout(resolve, settings.waitTime));

        // Force page to use the full viewport width
        await page.evaluate((width) => {
            // Ensure the body uses the full width
            document.body.style.minWidth = width + 'px';
            // Force a reflow to ensure layout is updated
            document.body.offsetHeight;
        }, settings.resolution.width);

        // Inject global CSS to force ALL lazy images visible
        await page.evaluate(() => {
            const style = document.createElement('style');
            style.id = 'force-lazy-visible';
            style.textContent = `
                /* Force visibility on ALL lazy loading patterns */
                .lazyload, .lazyloading, [data-src], [data-lazy-src],
                img.lazyload, img[data-src], img[data-lazy-src],
                .td-animation-stack img, .td-lazy-img {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                .entry-thumb, .td-thumb-css, .td-image-wrap,
                [data-img-url], [data-bg], [data-background],
                .td-module-thumb, .td-image-container {
                    opacity: 1 !important;
                    visibility: visible !important;
                    background-size: cover !important;
                }
                /* Disable transitions that might delay rendering */
                img, .entry-thumb, [data-img-url] {
                    transition: none !important;
                    animation: none !important;
                }
            `;
            document.head.appendChild(style);
        });

        // Handle lazy loading if enabled
        if (settings.lazyLoadScroll) {
            await autoScroll(page, settings.scrollDistance, settings.scrollWaitTime || 1000, settings.scrollInterval || 800, settings.waitForImageLoad || 5000);
        }

        // ALWAYS force load images with data-img-url (Newspaper theme and similar)
        const forceLoadResult = await page.evaluate(() => {
            let fixed = 0;

            // Force background-image from data-img-url attribute
            document.querySelectorAll('[data-img-url]').forEach(el => {
                const imgUrl = el.getAttribute('data-img-url');
                if (imgUrl) {
                    const currentBg = getComputedStyle(el).backgroundImage;
                    if (currentBg === 'none' || !currentBg.includes('url(')) {
                        el.style.setProperty('background-image', `url("${imgUrl}")`, 'important');
                        fixed++;
                    }
                }
            });

            // Force background-image from data-back attribute (alternative lazy loading)
            document.querySelectorAll('[data-back]').forEach(el => {
                const imgUrl = el.getAttribute('data-back');
                if (imgUrl) {
                    const currentBg = getComputedStyle(el).backgroundImage;
                    if (currentBg === 'none' || !currentBg.includes('http')) {
                        el.style.setProperty('background-image', `url("${imgUrl}")`, 'important');
                        fixed++;
                    }
                }
            });

            // Also check for elements with inline style that might have been missed
            document.querySelectorAll('.entry-thumb, .td-thumb-css').forEach(el => {
                const imgUrl = el.getAttribute('data-img-url') || el.getAttribute('data-back');
                if (imgUrl) {
                    const currentBg = getComputedStyle(el).backgroundImage;
                    if (currentBg === 'none') {
                        el.style.setProperty('background-image', `url("${imgUrl}")`, 'important');
                        fixed++;
                    }
                }
            });

            // Force img elements with data-src
            document.querySelectorAll('img[data-src], img[data-lazy-src]').forEach(img => {
                const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                if (dataSrc && (!img.src || img.src === '' || img.src.includes('data:') || img.src.includes('placeholder'))) {
                    img.src = dataSrc;
                    fixed++;
                }
            });

            // Remove lazyload classes and force visibility
            document.querySelectorAll('.lazyload, .lazyloading').forEach(el => {
                el.classList.remove('lazyload', 'lazyloading');
                el.classList.add('lazyloaded');
                // Force opacity to 1 (some lazy loaders hide with opacity: 0)
                el.style.setProperty('opacity', '1', 'important');
            });

            // Force visibility on all entry-thumb elements
            document.querySelectorAll('.entry-thumb, .td-thumb-css').forEach(el => {
                el.style.setProperty('opacity', '1', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
            });

            // Count remaining images without background
            const thumbsWithoutBg = Array.from(document.querySelectorAll('.entry-thumb, .td-thumb-css')).filter(el =>
                getComputedStyle(el).backgroundImage === 'none'
            ).length;

            return { fixed, thumbsWithoutBg, total: document.querySelectorAll('.entry-thumb, .td-thumb-css').length };
        });

        console.log('Force load images result:', forceLoadResult);

        // Brief wait to ensure images are rendered (reduced from 4000ms)
        await new Promise(resolve => setTimeout(resolve, 1000));

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
        await page.close();
    }
}

async function autoScroll(page, scrollDistance, scrollWaitTime = 1000, scrollInterval = 800, waitForImageLoadTime = 5000) {
    await page.evaluate(async (scrollDistance, scrollWaitTime, scrollInterval, waitForImageLoadTime) => {
        // Function to force load all images with various lazy loading patterns
        function forceLoadAllImages() {
            // Handle standard img elements
            document.querySelectorAll('img').forEach(img => {
                // Copy data attributes to src
                const dataSrc = img.dataset.src || img.dataset.lazySrc ||
                               img.dataset.original || img.dataset.lazy ||
                               img.dataset.image || img.dataset.lazyload ||
                               img.dataset.imgUrl || img.dataset.bgUrl;
                if (dataSrc && (!img.src || img.src.includes('placeholder') || img.src.includes('data:') || img.src === '')) {
                    img.src = dataSrc;
                }

                // Force srcset
                if (img.dataset.srcset) {
                    img.srcset = img.dataset.srcset;
                }

                // Remove lazyload class that might hide the image
                img.classList.remove('lazyload', 'lazyloading', 'td-lazy-img');
                img.classList.add('lazyloaded');

                // Force display if hidden
                if (getComputedStyle(img).display === 'none') {
                    img.style.setProperty('display', 'block', 'important');
                    img.offsetHeight; // Force reflow
                }
            });

            // Handle picture elements
            document.querySelectorAll('picture source[data-srcset]').forEach(source => {
                source.srcset = source.dataset.srcset;
            });

            // Handle Newspaper theme background images (entry-thumb, td-module-thumb, etc.)
            const bgSelectors = [
                '.entry-thumb',
                '.td-module-thumb',
                '.td-image-wrap',
                '.td-backgrund-link',
                '[data-img-url]',
                '[data-bg]',
                '[data-background]',
                '[data-td-src-property]'
            ];

            document.querySelectorAll(bgSelectors.join(', ')).forEach(el => {
                // Get background image URL from data attributes
                const bgUrl = el.dataset.imgUrl || el.dataset.bg ||
                             el.dataset.background || el.dataset.tdSrcProperty ||
                             el.getAttribute('data-img-url') || el.getAttribute('data-bg');

                if (bgUrl) {
                    el.style.setProperty('background-image', `url("${bgUrl}")`, 'important');
                    console.log('Set background-image for element:', bgUrl);
                }

                // If element has a span.entry-thumb-link with data attributes
                const innerSpan = el.querySelector('span[data-img-url], a[data-img-url]');
                if (innerSpan) {
                    const innerUrl = innerSpan.dataset.imgUrl || innerSpan.getAttribute('data-img-url');
                    if (innerUrl) {
                        innerSpan.style.setProperty('background-image', `url("${innerUrl}")`, 'important');
                    }
                }
            });

            // Handle Newspaper theme lazy images with specific structure
            document.querySelectorAll('.td_module_wrap, .td-block-span').forEach(module => {
                const thumb = module.querySelector('.entry-thumb, .td-thumb-css');
                if (thumb) {
                    const imgUrl = thumb.dataset.imgUrl || thumb.getAttribute('data-img-url') ||
                                  thumb.style.backgroundImage;

                    // Check if there's already a bg image in data attribute
                    if (thumb.dataset.imgUrl && !thumb.style.backgroundImage.includes(thumb.dataset.imgUrl)) {
                        thumb.style.setProperty('background-image', `url("${thumb.dataset.imgUrl}")`, 'important');
                    }
                }
            });

            // Force visibility of any hidden lazy elements
            document.querySelectorAll('.lazyload, .lazyloading, [data-src]').forEach(el => {
                el.classList.remove('lazyload', 'lazyloading');
                el.classList.add('lazyloaded');
                if (getComputedStyle(el).display === 'none') {
                    el.style.setProperty('display', 'block', 'important');
                }
                if (getComputedStyle(el).visibility === 'hidden') {
                    el.style.setProperty('visibility', 'visible', 'important');
                }
                if (parseFloat(getComputedStyle(el).opacity) === 0) {
                    el.style.setProperty('opacity', '1', 'important');
                }
            });
        }

        // Function to disable Newspaper theme animation stack (prevents images from hiding)
        function disableAnimationStack() {
            // Remove animation classes that might hide images
            document.querySelectorAll('.td-animation-stack').forEach(el => {
                el.classList.remove('td-animation-stack');
            });

            // Force all images to be visible regardless of animation state
            const style = document.createElement('style');
            style.textContent = `
                .td-animation-stack img,
                .td-animation-stack .entry-thumb,
                .lazyload[data-src],
                .lazyload,
                .td-lazy-img {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                .entry-thumb,
                .td-module-thumb,
                .td-thumb-css {
                    background-size: cover !important;
                    background-position: center !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Function to wait for images to actually load
        async function waitForImageLoad(maxWait = waitForImageLoadTime) {
            const startTime = Date.now();

            return new Promise(resolve => {
                const checkImages = () => {
                    // Check <img> elements
                    const images = Array.from(document.querySelectorAll('img'));
                    const pendingImgs = images.filter(img =>
                        img.src && !img.complete && img.naturalHeight === 0
                    );

                    // Check background-image elements
                    const bgElements = document.querySelectorAll('.entry-thumb, .td-thumb-css, [data-img-url]');
                    const pendingBgs = Array.from(bgElements).filter(el => {
                        const bg = getComputedStyle(el).backgroundImage;
                        return el.dataset.imgUrl && (bg === 'none' || !bg.includes('url'));
                    });

                    if ((pendingImgs.length === 0 && pendingBgs.length === 0) || Date.now() - startTime > maxWait) {
                        resolve();
                    } else {
                        setTimeout(checkImages, 300);
                    }
                };
                checkImages();
            });
        }

        // Function to trigger events that may activate lazy loaders
        function triggerLazyLoadEvents() {
            window.dispatchEvent(new Event('scroll'));
            window.dispatchEvent(new Event('resize'));
            document.dispatchEvent(new Event('lazyload'));

            // Try to trigger Newspaper theme's lazy load
            if (typeof window.td_animation_stack !== 'undefined') {
                try {
                    window.td_animation_stack.check_for_new_items();
                } catch (e) {}
            }

            // Try to trigger common lazy load libraries
            if (typeof window.lazySizes !== 'undefined') {
                try {
                    window.lazySizes.autoSizer.checkElems();
                } catch (e) {}
            }
        }

        // Disable animation stack at the start
        disableAnimationStack();

        await new Promise((resolve) => {
            // First, scroll down to trigger lazy loading
            let totalHeight = 0;
            const distance = scrollDistance;
            const scrollHeight = document.body.scrollHeight;

            console.log('Starting scroll down, total height:', scrollHeight);

            const scrollDown = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;

                // Trigger events that may activate lazy loaders
                triggerLazyLoadEvents();

                // Force load images in current viewport
                forceLoadAllImages();

                if (totalHeight >= scrollHeight - 100) {
                    clearInterval(scrollDown);
                    console.log('Reached bottom, forcing image load');

                    // Force load all images at the bottom
                    forceLoadAllImages();
                    triggerLazyLoadEvents();

                    // Wait at bottom for images to start loading
                    setTimeout(async () => {
                        // Force load again to catch any stragglers
                        forceLoadAllImages();

                        // Wait for images to actually load
                        console.log('Waiting for images to load...');
                        await waitForImageLoad(Math.max(scrollWaitTime, waitForImageLoadTime));

                        // Scroll back to top (single jump, no gradual scroll)
                        window.scrollTo(0, 0);
                        console.log('Scrolled to top');

                        // Final force load and wait
                        forceLoadAllImages();
                        triggerLazyLoadEvents();

                        await waitForImageLoad(2000);
                        console.log('Image loading complete');

                        resolve();
                    }, 500);
                }
            }, scrollInterval); // Configurable scroll interval for Intersection Observers
        });
    }, scrollDistance, scrollWaitTime, scrollInterval, waitForImageLoadTime);
}

module.exports = {
    captureScreenshot,
    closeBrowser
};