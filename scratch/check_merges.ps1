[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$sheetXml = [xml](Get-Content 'scratch/xlsx_unzip/xl/worksheets/sheet1.xml' -Encoding UTF8)
Write-Host "=== MERGE CELLS ==="
if ($sheetXml.worksheet.mergeCells) {
    foreach ($m in $sheetXml.worksheet.mergeCells.mergeCell) {
        Write-Host $m.ref
    }
} else {
    Write-Host "No mergeCells found in XML"
}
