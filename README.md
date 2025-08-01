# Super Screenshot

A powerful Electron application for batch URL screenshot capture with PDF generation capabilities.

## Features

- 📸 **Batch Screenshot Capture**: Process multiple URLs at once
- 📄 **PDF Generation**: Create professional PDFs with custom cover pages
- 🎯 **Smart URL Extraction**: Paste mixed content and automatically extract URLs
- 🖼️ **Multiple Capture Modes**: 
  - Resolution-based height (captures exactly what fits in the specified resolution)
  - Full site capture (captures entire page including footer)
- 🎨 **Customizable Settings**:
  - Multiple preset resolutions (1440x1600 default)
  - Custom resolution support
  - Lazy loading scroll support
  - WordPress publish date detection
- 📁 **Organized Output**: 
  - Images saved to Downloads/YYYYMMDD-HHMM/
  - PDFs saved directly to Downloads with custom names

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/zapitz/super-screenshot.git

# Navigate to the project directory
cd super-screenshot

# Install dependencies
npm install

# Start the application
npm start
```

## Usage

1. **Select Capture Mode**: Choose between "Solo Imágenes" (Images Only) or "Generar PDF"
2. **Paste URLs**: Paste your URLs in the text area (one per line or mixed in text)
3. **Configure Settings**: 
   - Select resolution (default: 1440x1600)
   - Choose capture mode (resolution height or full site)
   - Enable/disable WordPress date detection
   - Set wait times and scroll options
4. **Start Capture**: Click "Iniciar Capturas" or "Generar PDF"
5. **Access Results**: Click "Ir a carpeta de destino" to open the output folder

## Configuration

Access the configuration menu (⚙️) to customize:
- PDF font size, margins, and quality
- Cover page settings (title, description, logo)
- Screenshot capture delays
- Show/hide publication dates
- Show/hide generation date on cover

## Development

### Project Structure
```
super-screenshot/
├── main.js              # Electron main process
├── renderer.js          # Renderer process logic
├── screenshot.js        # Puppeteer screenshot module
├── pdf-generator.js     # PDF generation module
├── browser-detector.js  # Browser detection utility
├── config.html         # Configuration page
├── config-renderer.js  # Configuration page logic
├── index.html          # Main application UI
├── styles.css          # Application styles
└── package.json        # Project dependencies
```

### Building for Distribution
```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:win
npm run build:mac
npm run build:linux
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

**zapitz**

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Screenshot capture powered by [Puppeteer](https://pptr.dev/)
- PDF generation using [PDFKit](https://pdfkit.org/)