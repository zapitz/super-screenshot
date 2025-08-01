# Super Screenshot - Development Notes

## Project Overview
Super Screenshot is an Electron application that captures screenshots of multiple URLs and can generate PDFs with the results. It was developed to handle batch processing of web pages with specific focus on WordPress sites.

## Key Features Implemented
- Batch URL processing with automatic extraction from mixed text
- Two capture modes: Images only or PDF generation
- Configurable screenshot resolutions with 1440x1600 as default
- WordPress publish date detection
- Customizable PDF cover pages with logo support
- Automatic file naming and organization in Downloads folder

## Important Technical Details

### Architecture
- **Main Process**: `main.js` - Handles file operations, window management, IPC
- **Renderer Process**: `renderer.js` - UI logic and user interactions
- **Screenshot Module**: `screenshot.js` - Puppeteer integration for captures
- **PDF Generator**: `pdf-generator.js` - PDFKit implementation

### Key Improvements Made During Development
1. **Removed puppeteer for puppeteer-core** to avoid Chromium downloads
2. **Fixed page numbering issues** in PDFs by removing the feature entirely
3. **Implemented FileReader API** for logo uploads due to Electron security
4. **Simplified PDF workflow** to single-click generation
5. **Added URL extraction** from mixed text content

### Configuration Storage
- Settings stored in Electron's userData directory
- Logo files saved in `userData/logos/`
- Uses IPC for config management between processes

### Known Limitations
- WordPress date detection may not work on all themes
- Page numbering was removed due to PDFKit positioning issues
- Browser must be installed (Chrome/Edge/Chromium)

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

## Future Enhancements
- Add progress bar for individual URLs
- Implement retry mechanism for failed captures
- Add export/import configuration feature
- Support for authenticated sites
- Batch PDF operations (merge, split)

## Debugging Tips
- Use Chrome DevTools: Ctrl+Shift+I (removed by default in production)
- Check console logs for WordPress date detection
- Verify browser detection in main process logs
- Test with various URL formats and WordPress themes