// js/sample_popup_logic.js
import { supabase } from './config.js';

export function setupHazardSelection(gridRowRef, hotInstance, calculateSampleId, getSamplePrefix) {
    const handleMessage = async (event) => {
        if (event.data?.type === 'HAZARD_SELECT') {
            const h = event.data.data;
            const targetRow = gridRowRef.current;
            const hot = hotInstance.current;

            if (targetRow === null || !hot) return;

            const isSelf = h.is_self || '';
            let analyst = '';
            let receivedBy = '';

            try {
                const { data, error } = await supabase.from('kiwe_users').select('user_name').eq('job_title', '분석책임자').maybeSingle();
                if (!error && data?.user_name) {
                    receivedBy = data.user_name;
                }
            } catch (err) {
                console.warn("분석책임자 조회 실패:", err);
            }
            if (!receivedBy) receivedBy = '이초롱';

            if (!isSelf || isSelf === '자체분석') {
                analyst = receivedBy;
            } else {
                analyst = isSelf;
            }

            const updates = [
                [targetRow, 'common_name', h.common_name],
                [targetRow, 'worker_name', h.worker_name || hotInstance.current.getDataAtRowProp(targetRow, 'worker_name')],
                [targetRow, 'work_process', h.process || hotInstance.current.getDataAtRowProp(targetRow, 'work_process')],
                [targetRow, 'hazard_category', h.hazard_category],
                [targetRow, 'sampling', h.sampling],
                [targetRow, 'instrument_name', h.instrument_name],
                [targetRow, 'storage', h.storage],
                [targetRow, 'sampling_media', h.sampling_media],
                [targetRow, 'is_self', isSelf],
                [targetRow, 'analyst', analyst],
                [targetRow, 'received_by', receivedBy]
            ];

            hot.setDataAtRowProp(updates);

            // ★ 유해인자 선택 후 시료번호 재계산 (is_self 변경으로 S↔R 접두어가 바뀔 수 있으므로 항상 재계산)
            const sampleId = await calculateSampleId(targetRow);
            if (sampleId) hot.setDataAtRowProp(targetRow, 'sample_id', sampleId);
        }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
}

export function openHazardSearch(row, setRow, rowRef) {
    setRow(row);
    rowRef.current = row;
    window.open('search.html', 'HazardSearch', 'width=1200,height=850,scrollbars=yes');
}
