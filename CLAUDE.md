# Super Screenshot - Development Notes

## Project Overview
Super Screenshot is an Electron application that captures screenshots of multiple URLs and can generate PDFs with the results. It was developed to handle batch processing of web pages with specific focus on WordPress sites.

## Key Features Implemented
- Batch URL processing with automatic extraction from mixed text
- Two capture modes: Images only or PDF generation
- Configurable screenshot resolutions with 1440x1600 as default (includes mobile presets)
- WordPress publish date detection with multiple selector support
- Customizable PDF cover pages with logo support
- Automatic file naming and organization in Downloads folder
- Configuration page with advanced PDF and capture settings
- Smart file naming: YY-MM-DD-titulo-del-articulo.png format for images
- Lazy load scrolling support for dynamic content
- Full-page or viewport-based capture modes
- Browser auto-detection (Chrome, Edge, Brave, Chromium)

## Important Technical Details

### Architecture
- **Main Process**: `main.js` - Handles file operations, window management, IPC
- **Renderer Process**: `renderer.js` - UI logic and user interactions
- **Config Renderer**: `config-renderer.js` - Configuration page logic
- **Screenshot Module**: `screenshot.js` - Puppeteer integration for captures
- **PDF Generator**: `pdf-generator.js` - PDFKit implementation
- **Browser Detector**: `browser-detector.js` - Cross-platform browser detection

### Key Improvements Made During Development
1. **Removed puppeteer for puppeteer-core** to avoid Chromium downloads
2. **Fixed page numbering issues** in PDFs by removing the feature entirely
3. **Implemented FileReader API** for logo uploads due to Electron security
4. **Simplified PDF workflow** to single-click generation
5. **Added URL extraction** from mixed text content

### Configuration Storage
- Settings stored in Electron's userData directory as `config.json`
- Logo files saved in `userData/logos/`
- Uses IPC for config management between processes
- Configuration includes: PDF margins, font sizes, cover page settings, screenshot delays, etc.

### Current File Structure
```
super-screenshot/
├── main.js                 # Electron main process
├── renderer.js             # Main UI renderer
├── config-renderer.js      # Config page renderer
├── screenshot.js           # Puppeteer screenshot logic
├── pdf-generator.js        # PDF generation with PDFKit
├── browser-detector.js     # Cross-platform browser detection
├── index.html              # Main UI
├── config.html             # Configuration page
├── styles.css              # Shared styles
├── package.json            # Dependencies and scripts
└── CLAUDE.md               # This file
```

### Known Limitations
- WordPress date detection may not work on all themes (supports 14+ common selectors)
- Page numbering was removed due to PDFKit positioning issues
- Browser must be installed (Chrome/Edge/Chromium/Brave)
- Security: nodeIntegration enabled and contextIsolation disabled (needs fixing for production)
- No error recovery mechanism for failed captures
- PDF images are stored temporarily and cleaned after generation

## Continuing Development on Another Machine

### Setup Instructions
1. Clone the repository: `git clone https://github.com/zapitz/super-screenshot.git`
2. Install dependencies: `npm install`
3. Run the application: `npm start`

### Required Tools
- Node.js v14+
- npm or yarn
- Chrome, Edge, or Chromium browser

### Testing Checklist
- [ ] URL extraction from mixed text
- [ ] Screenshot capture in both modes
- [ ] PDF generation with cover page
- [ ] Logo upload and display
- [ ] WordPress date detection
- [ ] Configuration persistence

## Common Commands
```bash
npm start          # Run the application
npm test          # Run tests (if implemented)
npm run lint      # Check code style (if configured)
npm run build     # Build for distribution
```

## Production Readiness Roadmap

### Critical (Must-Have for v1.0)
- [ ] **Security hardening**: Enable contextIsolation, disable nodeIntegration, implement preload script
- [ ] **Code signing**: Set up certificates for Windows/macOS to avoid security warnings
- [ ] **Build configuration**: Configure electron-builder with proper icons, package info, and installers
- [ ] **Error handling**: Add retry mechanism and better error reporting
- [ ] **Auto-updater**: Implement electron-updater for seamless updates
- [ ] **License and legal**: Add proper LICENSE file, privacy policy, and terms if needed
- [ ] **Testing**: Basic test suite for core functionality
- [ ] **Documentation**: User manual and troubleshooting guide

### Important (Should-Have for v1.0)
- [ ] **Progress indicators**: Per-URL progress bars
- [ ] **Export/import config**: Backup and restore settings
- [ ] **Better browser detection**: Handle edge cases and provide manual fallback
- [ ] **Crash reporting**: Sentry or similar for production monitoring
- [ ] **Internationalization**: Multi-language support (at least EN/ES)
- [ ] **Performance optimization**: Parallel screenshot capture (configurable concurrency)
- [ ] **File size optimization**: Image compression options

### Nice-to-Have (v1.1+)
- [ ] Support for authenticated sites (login flow)
- [ ] Batch PDF operations (merge, split)
- [ ] Cloud storage integration
- [ ] Scheduled captures
- [ ] API/CLI mode for automation
- [ ] Screenshot comparison tools
- [ ] Custom CSS injection for captures
- [ ] Video capture support

## Debugging Tips
- Use Chrome DevTools: Ctrl+Shift+I (removed by default in production)
- Check console logs for WordPress date detection
- Verify browser detection in main process logs
- Test with various URL formats and WordPress themes