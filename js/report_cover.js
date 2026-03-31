export function openReportCover(record, companies) {
    if (!record) return;

    // Find company details if not fully present in record
    // (Assuming record might have com_id but missing address etc, though usually we pass enriched record)
    // Actually, in records.js, we were looking up the company before passing.
    // Let's assume 'record' passed here is already enriched or we assume we rely on what's in it.
    // The previous inline code in records.js was:
    // const company = companies.find(c => c.com_id === rec.com_id);
    // const recWithDetail = { ...rec, address: company?.address ... };

    // We will do this enrichment inside records.js before calling this, OR
    // we can accept companies list here. records.js has 'companies' state.
    // Let's stick to the pattern: `openReportCover(record)` where record is prepared.

    // Save to localStorage for report_cover.html to read
    const keys = [
        'com_name', 'address', 'manager_name', 'tel', 'fax',
        'start_date', 'end_date', 'measure_type', 'inspector',
        'harmful_factors', 'measure_count', 'exam_result',
        'opinion', 'is_prevent', 'prevent_plan', 'prevent_eval',
        'noise_cycle', 'noise_next', 'special_cycle', 'special_next',
        'office_name' // Needed for footer?
    ];

    // Simply save the whole record seems easier, as report_cover.html parses it.
    // Let's check report_cover.html's expectation. 
    // Usually it reads 'kiwe_report_data' or 'print_record'.
    localStorage.setItem('print_record', JSON.stringify(record));

    // Open window
    window.open('report_cover.html', '_blank', 'width=850,height=1000');
}
