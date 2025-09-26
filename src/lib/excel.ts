import Excel from "exceljs";

export async function parseExcelFile(file: File) {
  const wb = new Excel.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], headers: [] };

  // Lee encabezados de la primera fila
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers.push(String(cell.value ?? `col_${colNumber}`));
  });

  const rows: Record<string, any>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      obj[h] = cell.value ?? "";
    });
    // descarta filas vacías
    if (Object.values(obj).some((v) => String(v).trim() !== "")) rows.push(obj);
  });

  return { rows, headers };
}
