// js/sample_popup_logic.js
import { supabase } from './config.js';

export function setupHazardSelection(gridRowRef, hotInstance, calculateSampleId, getSamplePrefix) {
    const handleMessage = async (event) => {
        if (event.data?.type === 'HAZARD_SELECT') {
            const h = event.data.data;
            const targetRow = gridRowRef.current;
            const hot = hotInstance.current;

            if (targetRow === null || !hot) return;

            const isSelf = h.is_self;
            let analyst = '';
            let receivedBy = '이초롱';

            if (isSelf === '자체분석') {
                analyst = '이초롱';
            } else if (isSelf === '외부의뢰') {
                analyst = h.agency_name || '';
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

            // sample_id generation AFTER instrument_name and worker_name are set
            if (!hot.getDataAtRowProp(targetRow, 'sample_id')) {
                const sampleId = await calculateSampleId(targetRow);
                if (sampleId) hot.setDataAtRowProp(targetRow, 'sample_id', sampleId);
            }
        }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
}

export function openHazardSearch(row, setRow, rowRef) {
    setRow(row);
    rowRef.current = row;
    window.open('search.html', 'HazardSearch', 'width=1000,height=850,scrollbars=yes');
}
