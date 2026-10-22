[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$filePath = (Resolve-Path "삼화정밀_2026_하반기.xls").Path
Write-Host "Opening: $filePath"
$wb = $excel.Workbooks.Open($filePath)
$ws = $wb.Sheets.Item(1)

Write-Host "Sheet Name: $($ws.Name)"
$usedRange = $ws.UsedRange
$rows = $usedRange.Rows.Count
$cols = $usedRange.Columns.Count
Write-Host "Rows: $rows, Cols: $cols"

for ($r = 1; $r -le [Math]::Min($rows, 35); $r++) {
    $vals = @()
    for ($c = 1; $c -le [Math]::Min($cols, 40); $c++) {
        $val = $ws.Cells.Item($r, $c).Text
        if ($val -ne "") {
            $colLetter = if ($c -le 26) { [char](64 + $c) } else { "A" + [char](64 + $c - 26) }
            $vals += "$($colLetter):$val"
        }
    }
    Write-Host "Row $r -> $($vals -join ' | ')"
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
