[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$fixedPath = (Resolve-Path "scratch/samhwa_fixed.xls").Path
$wb = $excel.Workbooks.Open($fixedPath)
$ws = $wb.Sheets.Item(1)

Write-Host "=== SAMHWA ROW 1 HEADERS ==="
for ($c = 1; $c -le 40; $c++) {
    $val = $ws.Cells.Item(1, $c).Text
    if ($val) {
        $colLetter = if ($c -le 26) { [char](64 + $c) } else { "A" + [char](64 + $c - 26) }
        Write-Host "$colLetter ($c) : $val"
    }
}

Write-Host "`n=== SAMHWA ROW 2 (FIRST DATA) ==="
for ($c = 1; $c -le 40; $c++) {
    $val = $ws.Cells.Item(2, $c).Text
    if ($val) {
        $colLetter = if ($c -le 26) { [char](64 + $c) } else { "A" + [char](64 + $c - 26) }
        Write-Host "$colLetter ($c) : $val"
    }
}

Write-Host "`n=== SAMHWA ROW 14 (SAMPLE WITH CHEMICAL) ==="
for ($c = 1; $c -le 40; $c++) {
    $val = $ws.Cells.Item(14, $c).Text
    if ($val) {
        $colLetter = if ($c -le 26) { [char](64 + $c) } else { "A" + [char](64 + $c - 26) }
        Write-Host "$colLetter ($c) : $val"
    }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
