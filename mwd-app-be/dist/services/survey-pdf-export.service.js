import PDFDocument from 'pdfkit';
import { Readable } from 'node:stream';
const toPlainValue = (value) => {
    if (value === null || value === undefined) {
        return '—';
    }
    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'object' && value !== null && 'toString' in value) {
        return String(value);
    }
    return String(value);
};
const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined) {
        return '—';
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return String(toPlainValue(value));
    }
    return num.toFixed(decimals);
};
const getPageHeight = (doc) => {
    return doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
};
const getPageWidth = (doc) => {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
};
const addTableHeader = (doc, headers, columnWidths, startX, startY) => {
    doc.fontSize(9).font('Helvetica-Bold');
    let currentX = startX;
    const cellHeight = 25;
    const cellPadding = 5;
    // Background
    doc
        .fillColor('#366092')
        .rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), cellHeight)
        .fill();
    // Text
    doc.fillColor('#FFFFFF');
    for (let i = 0; i < headers.length; i += 1) {
        const width = columnWidths[i] ?? 50;
        const header = headers[i] ?? '';
        doc.text(header, currentX + cellPadding, startY + cellPadding, {
            width: width - cellPadding * 2,
            height: cellHeight - cellPadding * 2,
            align: 'left',
        });
        currentX += width;
    }
    return startY + cellHeight;
};
const addTableRow = (doc, values, columnWidths, startX, startY, alternateRow) => {
    doc.fontSize(8).font('Helvetica');
    let currentX = startX;
    const cellHeight = 20;
    const cellPadding = 3;
    const rowHeight = cellHeight;
    // Background
    if (alternateRow) {
        doc
            .fillColor('#F5F5F5')
            .rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
            .fill();
    }
    else {
        doc
            .fillColor('#FFFFFF')
            .rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
            .fill();
    }
    // Border
    doc.strokeColor('#CCCCCC').lineWidth(0.5);
    doc
        .rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
        .stroke();
    // Text
    doc.fillColor('#000000');
    for (let i = 0; i < values.length; i += 1) {
        const width = columnWidths[i] ?? 50;
        const value = values[i] ?? '';
        doc.text(value, currentX + cellPadding, startY + cellPadding, {
            width: width - cellPadding * 2,
            height: rowHeight - cellPadding * 2,
            align: i === 0 ? 'center' : 'left',
        });
        currentX += width;
    }
    return startY + rowHeight;
};
export const buildSurveyPdfExport = async (rows, fileName, sessionInfo) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            layout: 'landscape',
            info: {
                Title: 'Survey Data Export',
                Subject: 'Well Survey Station Data',
            },
        });
        const chunks = [];
        doc.on('data', (chunk) => {
            chunks.push(chunk);
        });
        doc.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({ buffer, fileName });
        });
        doc.on('error', (error) => {
            reject(error);
        });
        try {
            const pageWidth = getPageWidth(doc);
            const columnWidths = [
                50, 50, 60, 55, 65, 55, 55, 70, 60, 75, 75, 80, 75, 80, 80, 80, 80, 60,
                100,
            ];
            const headers = [
                'ID',
                'Session',
                'Type',
                'MD (m)',
                'Inc (°)',
                'Azi (°)',
                'TVD (m)',
                'North (m)',
                'East (m)',
                'V.Sec (m)',
                'DLS (°/30m)',
                'Build (°/30m)',
                'Turn (°/30m)',
                'Clos.D (m)',
                'Clos.A (°)',
                'Course (m)',
                'VS.Az (°)',
                'Source',
                'Notes',
            ];
            // Title
            doc
                .fontSize(16)
                .font('Helvetica-Bold')
                .text('Survey Station Data Export', { align: 'center' });
            if (sessionInfo?.wellName || sessionInfo?.rigName) {
                let infoText = '';
                if (sessionInfo.wellName)
                    infoText += `Well: ${sessionInfo.wellName}`;
                if (sessionInfo.rigName)
                    infoText += (infoText ? ' | ' : '') + `Rig: ${sessionInfo.rigName}`;
                doc.fontSize(10).font('Helvetica').text(infoText, { align: 'center' });
            }
            doc
                .fontSize(9)
                .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
            doc.moveDown(0.5);
            let currentY = doc.y;
            const startX = 40;
            let rowIndex = 0;
            // Add table header
            currentY = addTableHeader(doc, headers, columnWidths, startX, currentY);
            // Add rows with pagination
            for (const row of rows) {
                // Check if we need a new page
                if (currentY + 30 > doc.page.height - 40) {
                    doc.addPage({ layout: 'landscape' });
                    currentY = doc.page.margins.top;
                    currentY = addTableHeader(doc, headers, columnWidths, startX, currentY);
                }
                const rowData = [
                    String(toPlainValue(row.id)).substring(0, 8),
                    String(row.sessionId),
                    String(row.stationType).substring(0, 12),
                    formatNumber(row.measuredDepth),
                    formatNumber(row.inclination),
                    formatNumber(row.azimuth),
                    formatNumber(row.tvd),
                    formatNumber(row.northing),
                    formatNumber(row.easting),
                    formatNumber(row.verticalSection),
                    formatNumber(row.doglegSeverity),
                    formatNumber(row.buildRate),
                    formatNumber(row.turnRate),
                    formatNumber(row.closureDistance),
                    formatNumber(row.closureAzimuth),
                    formatNumber(row.courseLength),
                    formatNumber(row.verticalSectionAzimuth),
                    String(toPlainValue(row.source)),
                    String(row.notes || '').substring(0, 50),
                ];
                currentY = addTableRow(doc, rowData, columnWidths, startX, currentY, rowIndex % 2 === 0);
                rowIndex += 1;
            }
            // Add footer
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i += 1) {
                doc.switchToPage(i);
                doc.fontSize(8).font('Helvetica').fillColor('#666666');
                doc.text(`Page ${i + 1} of ${pageCount}`, doc.page.margins.left, doc.page.height - 20, {
                    width: pageWidth,
                    align: 'center',
                });
            }
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
};
//# sourceMappingURL=survey-pdf-export.service.js.map