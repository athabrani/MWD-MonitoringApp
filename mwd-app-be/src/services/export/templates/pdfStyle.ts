export const PDF_STYLE = {
  page: {
    marginLeft: 14,
    marginRight: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  font: {
    regular: "Helvetica",
    bold: "Helvetica-Bold",
    titleSize: 16,
    subtitleSize: 10,
    sectionSize: 8,
    labelSize: 6,
    valueSize: 6,
    tableHeaderSize: 6,
    tableBodySize: 6,
    trackHeaderSize: 5,
    axisSize: 5,
  },
  color: {
    black: "#000000",
    darkGray: "#333333",
    gray: "#777777",
    lightGray: "#D9D9D9",
    veryLightGray: "#EFEFEF",
    tableHeaderBg: "#E8E6D8",
    white: "#FFFFFF",
    red: "#CC3333",
    green: "#228B22",
    blue: "#3366CC",
    orange: "#E69138",
    purple: "#8E44AD",
    cyan: "#00A0A0",
  },
  line: {
    thin: 0.25,
    normal: 0.5,
    bold: 0.9,
    trackSeparator: 1.2,
  },
} as const;

export type PdfFontWeight = "regular" | "bold";
