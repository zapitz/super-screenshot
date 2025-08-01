const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

async function generatePDF(results, config = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            // Create a new PDF document
            const doc = new PDFDocument({
                autoFirstPage: false,
                bufferPages: true,
                size: 'A4',
                margins: {
                    top: config.pdfMargin || 40,
                    bottom: config.pdfMargin || 40,
                    left: config.pdfMargin || 40,
                    right: config.pdfMargin || 40
                }
            });

            // Buffer to store PDF
            const chunks = [];
            const imagesToClean = []; // Track images to delete later
            
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', async () => {
                // Clean up temporary images after PDF is generated
                for (const imagePath of imagesToClean) {
                    try {
                        await fs.unlink(imagePath);
                    } catch (err) {
                        console.error(`Error deleting temp file ${imagePath}:`, err);
                    }
                }
                resolve(Buffer.concat(chunks));
            });

            // Add cover page if enabled
            if (config.showCoverPage) {
                doc.addPage({
                    size: 'A4'
                });

                const margin = config.pdfMargin || 40;

                // Add space at top
                doc.moveDown(10);
                
                // Add cover title if provided
                if (config.coverTitle) {
                    doc.fontSize(24)
                       .font('Helvetica-Bold')
                       .fillColor('#000000')
                       .text(config.coverTitle, margin, doc.y, {
                           width: doc.page.width - (margin * 2),
                           align: 'center',
                           lineGap: 5
                       });
                    doc.moveDown(2);
                }
                
                // Add logo if provided
                if (config.logoPath && await fs.access(config.logoPath).then(() => true).catch(() => false)) {
                    try {
                        const currentY = doc.y;
                        doc.image(config.logoPath, doc.page.width / 2 - 75, currentY, {
                            width: 150,
                            align: 'center'
                        });
                        doc.moveDown(8);
                    } catch (error) {
                        console.error('Error adding logo:', error);
                    }
                }
                
                // Add cover description if provided
                if (config.coverDescription) {
                    doc.fontSize(16)
                       .font('Helvetica')
                       .fillColor('#333333')
                       .text(config.coverDescription, margin, doc.y, {
                           width: doc.page.width - (margin * 2),
                           align: 'center',
                           lineGap: 8
                       });
                }

                // Add date at bottom of cover page if enabled
                if (config.showCoverDate !== false) {
                    doc.fontSize(12)
                       .font('Helvetica')
                       .fillColor('#666666')
                       .text(new Date().toLocaleDateString('es-ES', { 
                           year: 'numeric', 
                           month: 'long', 
                           day: 'numeric' 
                       }), 
                       margin, 
                       doc.page.height - 100, 
                       {
                           width: doc.page.width - (margin * 2),
                           align: 'center'
                       });
                }
            }

            // Process each result
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                
                // Add a new page for each screenshot
                doc.addPage({
                    size: 'A4'
                });

                // Centered header design
                const margin = config.pdfMargin || 40;
                const titleSize = config.pdfFontSize || 14;
                
                // Add centered title
                doc.fontSize(titleSize)
                   .font('Helvetica-Bold')
                   .fillColor('#000000')
                   .text(result.title || 'Sin título', margin, margin + 10, {
                       width: doc.page.width - (margin * 2),
                       align: 'center',
                       lineGap: 2
                   });

                // Add publish date below title, aligned right (if enabled)
                if (result.publishDate && config.showPublishDate !== false) {
                    doc.fontSize(10)
                       .fillColor('#666666')
                       .font('Helvetica')
                       .text(formatDate(result.publishDate), margin, doc.y + 5, {
                           width: doc.page.width - (margin * 2),
                           align: 'right'
                       });
                }

                doc.moveDown(0.5);

                // Add URL below in smaller text, centered and clickable
                doc.fontSize(10)
                   .font('Helvetica')
                   .fillColor('#1565C0')
                   .text(result.url, {
                       link: result.url,
                       underline: true,
                       width: doc.page.width - (margin * 2),
                       align: 'center'
                   });

                doc.moveDown(0.8);

                // Add screenshot
                try {
                    // First check if file exists
                    await fs.access(result.screenshotPath);
                    
                    // Calculate available space on page
                    const margin = config.pdfMargin || 40;
                    const pageWidth = doc.page.width - (margin * 2);
                    const pageHeight = doc.page.height - 150; // Less space needed for compact header
                    
                    // Add image - PDFKit will handle dimensions automatically
                    // fit option will scale the image to fit within the specified dimensions
                    doc.image(result.screenshotPath, margin, doc.y, {
                        fit: [pageWidth, pageHeight],
                        align: 'center',
                        valign: 'top'
                    });

                    // Add to cleanup list (only for PDF mode)
                    imagesToClean.push(result.screenshotPath);
                    
                } catch (error) {
                    console.error('Error adding image:', error);
                    console.error('Image path:', result.screenshotPath);
                    doc.fillColor('#ff0000')
                       .fontSize(12)
                       .text('Error al cargar la imagen', {
                           align: 'center'
                       });
                    doc.moveDown(0.5);
                    doc.fontSize(10)
                       .fillColor('#666666')
                       .text(error.code === 'ENOENT' ? 'Archivo no encontrado' : error.message, {
                           align: 'center'
                       });
                }

                // Page numbering removed to avoid layout issues
            }

            // Finalize the PDF
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

function formatDate(dateString) {
    try {
        // Clean the date string
        let cleanDate = dateString.trim();
        
        // Try to parse the date
        const date = new Date(cleanDate);
        if (isNaN(date.getTime())) {
            // Try some common date formats
            const patterns = [
                /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i, // Spanish format
                /(\w+)\s+(\d{1,2}),\s+(\d{4})/i, // English format
                /(\d{4})-(\d{2})-(\d{2})/ // ISO format
            ];
            
            for (const pattern of patterns) {
                const match = cleanDate.match(pattern);
                if (match) {
                    // Try to reconstruct the date
                    const reconstructed = new Date(cleanDate);
                    if (!isNaN(reconstructed.getTime())) {
                        const options = {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        };
                        return reconstructed.toLocaleDateString('es-ES', options);
                    }
                }
            }
            
            return cleanDate; // Return original if can't parse
        }
        
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        return date.toLocaleDateString('es-ES', options);
    } catch (error) {
        return dateString;
    }
}

module.exports = {
    generatePDF
};