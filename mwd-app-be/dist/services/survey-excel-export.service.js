import ExcelJS from 'exceljs';
const toPlainValue = (value) => {
    if (value === null || value === undefined) {
        return null;
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
    return value;
};
const formatNumber = (value) => {
    const plain = toPlainValue(value);
    if (plain === null)
        return null;
    const num = Number(plain);
    return Number.isFinite(num) ? num : plain;
};
export const buildSurveyExcelExport = async (rows, fileName) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Survey Data');
    // Set column definitions
    worksheet.columns = [
        { header: 'ID', key: 'id', width: 15 },
        { header: 'Session ID', key: 'sessionId', width: 12 },
        { header: 'Station Type', key: 'stationType', width: 15 },
        { header: 'MD (m)', key: 'measuredDepth', width: 12, numFmt: '0.00' },
        {
            header: 'Inclination (°)',
            key: 'inclination',
            width: 15,
            numFmt: '0.00',
        },
        { header: 'Azimuth (°)', key: 'azimuth', width: 12, numFmt: '0.00' },
        { header: 'TVD (m)', key: 'tvd', width: 12, numFmt: '0.00' },
        { header: 'Northing (m)', key: 'northing', width: 15, numFmt: '0.00' },
        { header: 'Easting (m)', key: 'easting', width: 12, numFmt: '0.00' },
        {
            header: 'Vert. Sec. (m)',
            key: 'verticalSection',
            width: 15,
            numFmt: '0.00',
        },
        { header: 'DLS (°/30m)', key: 'doglegSeverity', width: 15, numFmt: '0.00' },
        {
            header: 'Build Rate (°/30m)',
            key: 'buildRate',
            width: 18,
            numFmt: '0.00',
        },
        { header: 'Turn Rate (°/30m)', key: 'turnRate', width: 16, numFmt: '0.00' },
        {
            header: 'Closure Dist. (m)',
            key: 'closureDistance',
            width: 16,
            numFmt: '0.00',
        },
        {
            header: 'Closure Azm. (°)',
            key: 'closureAzimuth',
            width: 16,
            numFmt: '0.00',
        },
        {
            header: 'Course Length (m)',
            key: 'courseLength',
            width: 16,
            numFmt: '0.00',
        },
        {
            header: 'VS Azimuth (°)',
            key: 'verticalSectionAzimuth',
            width: 15,
            numFmt: '0.00',
        },
        { header: 'Source', key: 'source', width: 15 },
        { header: 'Notes', key: 'notes', width: 30 },
        { header: 'Created', key: 'createdAt', width: 20 },
        { header: 'Updated', key: 'updatedAt', width: 20 },
    ];
    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' },
    };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    // Add data rows
    for (const row of rows) {
        worksheet.addRow({
            id: toPlainValue(row.id),
            sessionId: row.sessionId,
            stationType: row.stationType,
            measuredDepth: formatNumber(row.measuredDepth),
            inclination: formatNumber(row.inclination),
            azimuth: formatNumber(row.azimuth),
            tvd: formatNumber(row.tvd),
            northing: formatNumber(row.northing),
            easting: formatNumber(row.easting),
            verticalSection: formatNumber(row.verticalSection),
            doglegSeverity: formatNumber(row.doglegSeverity),
            buildRate: formatNumber(row.buildRate),
            turnRate: formatNumber(row.turnRate),
            closureDistance: formatNumber(row.closureDistance),
            closureAzimuth: formatNumber(row.closureAzimuth),
            courseLength: formatNumber(row.courseLength),
            verticalSectionAzimuth: formatNumber(row.verticalSectionAzimuth),
            source: row.source,
            notes: row.notes,
            createdAt: toPlainValue(row.createdAt),
            updatedAt: toPlainValue(row.updatedAt),
        });
    }
    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return {
        buffer: Buffer.from(buffer),
        fileName,
    };
};
//# sourceMappingURL=survey-excel-export.service.js.map