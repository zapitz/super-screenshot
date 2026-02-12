const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

async function generatePDF(results, config = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            // Prepare PDF metadata
            const generalSettings = config.generalSettings || {};
            const metadata = generalSettings.pdfMetadata || {};

            // Determine author
            let author = 'Super Screenshot';
            if (metadata.useSignerAsAuthor && config.showSignerData && config.signerName) {
                author = config.signerName;
            }

            // Determine creation date
            let creationDate = new Date();
            if (metadata.useCoverDateAsCreation && config.showCoverDate) {
                if (config.coverDateAuto === false && config.coverDateManual) {
                    const manualDate = new Date(config.coverDateManual);
                    if (!isNaN(manualDate.getTime())) {
                        creationDate = manualDate;
                    }
                }
            }

            // Create a new PDF document
            const doc = new PDFDocument({
                autoFirstPage: false,
                bufferPages: true,
                size: 'A4',
                info: {
                    Title: config.coverTitle || 'Reporte de Capturas',
                    Author: author,
                    Subject: config.coverDescription || '',
                    Creator: 'Super Screenshot',
                    CreationDate: creationDate
                },
                margins: {
                    top: config.pdfMargin || 40,
                    bottom: config.pdfMargin || 40,
                    left: config.pdfMargin || 40,
                    right: config.pdfMargin || 40
                }
            });

            // Extract branding colors with defaults
            const branding = config.branding || {};
            const colors = {
                primary: branding.primaryColor || '#4fc3f7',
                secondary: branding.secondaryColor || '#1565C0',
                title: branding.titleColor || '#000000',
                line: branding.lineColor || '#333333',
                link: branding.linkColor || '#1565C0'
            };

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
            doc.on('error', (err) => {
                console.error('PDFKit error:', err);
                reject(err);
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
                       .fillColor(colors.primary)
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
                       .fillColor(colors.secondary)
                       .text(config.coverDescription, margin, doc.y, {
                           width: doc.page.width - (margin * 2),
                           align: 'center',
                           lineGap: 8
                       });
                }

                // Add date at bottom of cover page if enabled
                if (config.showCoverDate !== false) {
                    let coverDateText = '';
                    if (config.coverDateAuto !== false) {
                        coverDateText = new Date().toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    } else if (config.coverDateManual) {
                        const manualDate = new Date(config.coverDateManual);
                        if (!isNaN(manualDate.getTime())) {
                            coverDateText = manualDate.toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            });
                        } else {
                            coverDateText = config.coverDateManual;
                        }
                    }

                    if (coverDateText) {
                        doc.fontSize(12)
                           .font('Helvetica')
                           .fillColor('#666666')
                           .text(coverDateText,
                           margin,
                           doc.page.height - 100,
                           {
                               width: doc.page.width - (margin * 2),
                               align: 'center'
                           });
                    }
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
                   .fillColor(colors.title)
                   .text(result.title || 'Sin titulo', margin, margin + 10, {
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
                   .fillColor(colors.link)
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
                    const imgMargin = config.pdfMargin || 40;
                    const pageWidth = doc.page.width - (imgMargin * 2);
                    // Reserve space for signature if enabled (signature area is ~80px from bottom)
                    const signatureSpace = config.showSignatureOnAllPages ? 80 : 0;
                    const pageHeight = doc.page.height - 150 - signatureSpace;

                    // Add image - PDFKit will handle dimensions automatically
                    // fit option will scale the image to fit within the specified dimensions
                    doc.image(result.screenshotPath, imgMargin, doc.y, {
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

                // Add signature line on each page if enabled
                if (config.showSignatureOnAllPages) {
                    const sigMargin = config.pdfMargin || 40;
                    const sigLineWidth = 150;
                    const sigX = doc.page.width - sigMargin - sigLineWidth;
                    // Position higher up to avoid PDFKit auto-pagination
                    // Name needs ~12px, so line at -70, name at -58 (safely above -40 margin)
                    const lineY = doc.page.height - 70;
                    const nameY = lineY + 5;
                    const sigImgHeight = 35;
                    const sigImgWidth = 90;

                    // Add digital signature image if enabled and available
                    let allPagesSignaturePath = null;
                    if (config.showDigitalSignatureOnAllPages) {
                        if (config.allPagesUseLastPageSignature && config.digitalSignaturePath) {
                            allPagesSignaturePath = config.digitalSignaturePath;
                        } else if (!config.allPagesUseLastPageSignature && config.allPagesSignaturePath) {
                            allPagesSignaturePath = config.allPagesSignaturePath;
                        }
                    }

                    if (allPagesSignaturePath && await fs.access(allPagesSignaturePath).then(() => true).catch(() => false)) {
                        try {
                            // Position signature image to overlap the line slightly
                            const sigImgX = sigX + (sigLineWidth - sigImgWidth) / 2;
                            const sigImgY = lineY - sigImgHeight + 5;
                            doc.image(allPagesSignaturePath, sigImgX, sigImgY, {
                                fit: [sigImgWidth, sigImgHeight]
                            });
                        } catch (error) {
                            console.error('Error adding signature image on page:', error);
                        }
                    }

                    // Draw signature line
                    doc.moveTo(sigX, lineY)
                       .lineTo(sigX + sigLineWidth, lineY)
                       .strokeColor(colors.line)
                       .lineWidth(1)
                       .stroke();

                    // Add legal rep name - use save/restore to prevent cursor movement
                    if (config.legalRepName) {
                        doc.save();
                        doc.fontSize(8)
                           .font('Helvetica')
                           .fillColor('#757575');
                        // Calculate text width to center it manually
                        const textWidth = doc.widthOfString(config.legalRepName);
                        const textX = sigX + (sigLineWidth - textWidth) / 2;
                        doc.text(config.legalRepName, textX, nameY, {
                            lineBreak: false,
                            continued: false
                        });
                        doc.restore();
                    }
                }
            }

            // Add last page if enabled
            if (config.showLastPage) {
                doc.addPage({
                    size: 'A4'
                });

                const lastPageMargin = config.pdfMargin || 40;
                const centerX = doc.page.width / 2;
                const pageWidth = doc.page.width - (lastPageMargin * 2);

                // Logo at the top with some margin
                const logoY = 80;
                let afterLogoY = 250; // Default position after logo area

                // Determine which logo to use
                let lastPageLogoPath = null;
                if (config.lastPageUseCoverLogo && config.logoPath) {
                    lastPageLogoPath = config.logoPath;
                } else if (!config.lastPageUseCoverLogo && config.lastPageLogoPath) {
                    lastPageLogoPath = config.lastPageLogoPath;
                }

                // Add logo if available
                if (lastPageLogoPath && await fs.access(lastPageLogoPath).then(() => true).catch(() => false)) {
                    try {
                        doc.image(lastPageLogoPath, centerX - 75, logoY, {
                            width: 150,
                            align: 'center'
                        });
                    } catch (error) {
                        console.error('Error adding last page logo:', error);
                    }
                }

                // Build location + date text (below logo)
                let locationDateText = '';
                let dateText = '';
                if (config.signerDateAuto) {
                    dateText = new Date().toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } else if (config.signerDateManual) {
                    const manualDate = new Date(config.signerDateManual);
                    if (!isNaN(manualDate.getTime())) {
                        dateText = manualDate.toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    } else {
                        dateText = config.signerDateManual;
                    }
                }

                if (config.signerLocation && dateText) {
                    locationDateText = `${config.signerLocation} a ${dateText}`;
                } else if (config.signerLocation) {
                    locationDateText = config.signerLocation;
                } else if (dateText) {
                    locationDateText = dateText;
                }

                // Add location + date below logo
                if (locationDateText) {
                    doc.fontSize(11)
                       .font('Helvetica')
                       .fillColor('#666666')
                       .text(locationDateText, lastPageMargin, afterLogoY, {
                           width: pageWidth,
                           align: 'center'
                       });
                }

                // Add signer data if enabled - positioned in lower portion of page
                if (config.showSignerData) {
                    const lineWidth = 200;
                    const sigImgWidth = 120;
                    const sigImgHeight = 50;

                    // Base Y position for the signature line
                    const signatureLineY = 480;

                    // Add digital signature image if available - positioned to bite into the line
                    if (config.digitalSignaturePath && await fs.access(config.digitalSignaturePath).then(() => true).catch(() => false)) {
                        try {
                            const sigImgX = centerX - sigImgWidth / 2;
                            const sigImgY = signatureLineY - sigImgHeight + 10;
                            doc.image(config.digitalSignaturePath, sigImgX, sigImgY, {
                                width: sigImgWidth,
                                height: sigImgHeight,
                                fit: [sigImgWidth, sigImgHeight]
                            });
                        } catch (error) {
                            console.error('Error adding digital signature:', error);
                        }
                    }

                    // Draw signature line at fixed position
                    doc.moveTo(centerX - lineWidth / 2, signatureLineY)
                       .lineTo(centerX + lineWidth / 2, signatureLineY)
                       .strokeColor(colors.line)
                       .lineWidth(1)
                       .stroke();

                    // Position for text below the line
                    let currentY = signatureLineY + 15;

                    // Signer name (14pt bold, centered)
                    if (config.signerName) {
                        doc.fontSize(14)
                           .font('Helvetica-Bold')
                           .fillColor(colors.title)
                           .text(config.signerName, lastPageMargin, currentY, {
                               width: pageWidth,
                               align: 'center'
                           });
                        currentY += 22;
                    }

                    // Signer position (12pt, centered)
                    if (config.signerPosition) {
                        doc.fontSize(12)
                           .font('Helvetica')
                           .fillColor('#333333')
                           .text(config.signerPosition, lastPageMargin, currentY, {
                               width: pageWidth,
                               align: 'center'
                           });
                        currentY += 18;
                    }

                    // Signer company (12pt, centered)
                    if (config.signerCompany) {
                        doc.fontSize(12)
                           .font('Helvetica')
                           .fillColor('#333333')
                           .text(config.signerCompany, lastPageMargin, currentY, {
                               width: pageWidth,
                               align: 'center'
                           });
                        currentY += 25;
                    }

                    // Contact information if enabled
                    if (config.showSignerContact) {
                        const contactParts = [];
                        if (config.signerEmail) contactParts.push(config.signerEmail);
                        if (config.signerPhone) contactParts.push(config.signerPhone);
                        if (config.signerIdNumber) contactParts.push(`ID: ${config.signerIdNumber}`);

                        if (contactParts.length > 0) {
                            doc.fontSize(10)
                               .font('Helvetica')
                               .fillColor('#757575')
                               .text(contactParts.join(' | '), lastPageMargin, currentY, {
                                   width: pageWidth,
                                   align: 'center'
                               });
                        }
                    }
                }
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