// js/vehicle.js
// 데이터 처리 로직 및 국세청 양식 변환 헬퍼

const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';
let _supabase = null;
function getSupabase() {
    if (_supabase) return _supabase;
    if (window.supabase) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return _supabase;
    }
    console.error('Supabase library not found on window. Ensure <script> tag is present.');
    return null;
}

// 차량 목록 가져오기
export async function fetchVehicles() {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb
        .from('kiwe_vehicles')
        .select('*')
        .order('id');
    
    if (error) {
        console.error('fetchVehicles error:', error);
        return [];
    }
    return data || [];
}

// 차량 저장/수정
export async function upsertVehicle(vehicle) {
    const sb = getSupabase();
    if (!sb) {
        alert('시스템 오류: 데이터베이스 연결에 실패했습니다.');
        return vehicle;
    }
    const { data, error } = await sb
        .from('kiwe_vehicles')
        .upsert([{
            id: vehicle.id,
            name: vehicle.name,
            type: vehicle.type,
            contract_period_end: vehicle.contract_period_end || null
        }])
        .select()
        .single();
    if (error) { console.error('upsertVehicle error:', error); throw error; }
    return data;
}

// 차량 삭제
export async function deleteVehicle(vehicleId) {
    const sb = getSupabase();
    if (!sb || !vehicleId) return false;
    const { error } = await sb
        .from('kiwe_vehicles')
        .delete()
        .eq('id', vehicleId);
    if (error) { console.error('deleteVehicle error:', error); throw error; }
    return true;
}

// 운행 일지 가져오기 (특정 차량, 특정 월)
export async function fetchLogs(vehicleId, year, month) {
    const sb = getSupabase();
    if (!sb) {
        console.error('fetchLogs: supabase client is null');
        return [];
    }
    
    // yyyy-mm-dd 범위 생성 (그리드 필터 안정성 확보)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    // Debug Alert (Troubleshooting용)
    // console.log(`가져오기 시도: 차량=${vehicleId}, 기간=${startDate}~${endDate}`);

    const { data, error } = await sb
        .from('kiwe_vehicle_logs')
        .select('*')
        .eq('vehicle_id', String(vehicleId).trim())
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('fetchLogs error:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다: ' + error.message);
        return [];
    }

    if (data && data.length === 0) {
        // [진단] 해당 월에 하나라도 데이터가 있는지 확인 (차량번호 매칭 문제 확인용)
        const { count } = await sb
            .from('kiwe_vehicle_logs')
            .select('*', { count: 'exact', head: true })
            .gte('date', startDate)
            .lte('date', endDate);
        
        if (count > 0) {
            alert(`${month}월에 총 ${count}개의 데이터가 있지만, 현재 선택된 차량(${vehicleId})과 일치하는 내역이 없습니다. 차량 번호를 확인해 주세요.`);
        }
    }
    
    return (data || []).map(log => ({
        id: log.id,
        vehicleId: log.vehicle_id,
        date: log.date,
        driver: log.driver,
        beforeDist: log.before_dist,
        afterDist: log.after_dist,
        chargeCost: log.charge_cost,
        chargeKwh: log.charge_kwh,
        tollFee: log.toll_fee,
        purpose: log.purpose,
        remarks: log.remarks
    }));
}

// 운행 일지 저장/수정
export async function upsertLog(log) {
    const sb = getSupabase();
    if (!sb) {
        alert('시스템 오류: 데이터베이스 연결에 실패했습니다. (Supabase Not Found)');
        return log;
    }

    const payload = {
        vehicle_id: log.vehicleId,
        date: log.date,
        driver: log.driver,
        before_dist: Number(log.beforeDist) || 0,
        after_dist: Number(log.afterDist) || 0,
        charge_cost: Number(log.chargeCost) || 0,
        charge_kwh: Number(log.chargeKwh) || 0,
        toll_fee: Number(log.tollFee) || 0,
        purpose: log.purpose,
        remarks: log.remarks
    };

    let resultData;
    try {
        if (!log.id) {
            const { data, error } = await sb
                .from('kiwe_vehicle_logs')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            resultData = data;
        } else {
            const { data, error } = await sb
                .from('kiwe_vehicle_logs')
                .update(payload)
                .eq('id', log.id)
                .select()
                .single();
            if (error) throw error;
            resultData = data;
        }
    } catch (error) {
        console.error('upsertLog err', error);
        alert('저장 중 오류가 발생했습니다: ' + error.message);
        throw error;
    }

    return {
        id: resultData.id,
        vehicleId: resultData.vehicle_id,
        date: resultData.date,
        driver: resultData.driver,
        beforeDist: resultData.before_dist,
        afterDist: resultData.after_dist,
        chargeCost: resultData.charge_cost,
        chargeKwh: resultData.charge_kwh,
        tollFee: resultData.toll_fee,
        purpose: resultData.purpose,
        remarks: resultData.remarks
    };
}

export async function deleteLog(logId) {
    const sb = getSupabase();
    if (!sb || !logId) return false;
    const { error } = await sb
        .from('kiwe_vehicle_logs')
        .delete()
        .eq('id', logId);
    
    if (error) {
        console.error('deleteLog error:', error);
        return false;
    }
    return true;
}

// 거리 및 통계 자동 계산 헬퍼
export function calculateStats(logs) {
    let totalDist = 0;
    let totalCharge = 0;
    let totalToll = 0;
    let totalKwh = 0;

    logs.forEach(log => {
        const dist = (Number(log.afterDist) || 0) - (Number(log.beforeDist) || 0);
        if (dist > 0) totalDist += dist;
        totalCharge += (Number(log.chargeCost) || 0);
        totalToll += (Number(log.tollFee) || 0);
        if (log.chargeKwh) totalKwh += Number(log.chargeKwh);
    });

    const efficiency = totalKwh > 0 ? (totalDist / totalKwh).toFixed(1) : 0; // 전비(km/kWh)

    return { totalDist, totalCharge, totalToll, efficiency };
}

// 국세청 업무용승용차 운행기록부 양식 (엑셀/CSV) 변환
export function exportToExcel(logs, vehicleInfo, year) {
    if (!window.XLSX) {
        alert('Excel 라이브러리가 로드되지 않았습니다.');
        return;
    }

    const wb = XLSX.utils.book_new();
    const data = [];

    // 1. 타이틀 및 기본 정보 행
    data.push(["[업무용승용차 운행기록부]"]);
    data.push([
        "차종", vehicleInfo.name, 
        "차량번호", vehicleInfo.id, 
        "과세기간", `${year}.01.01 ~ ${year}.12.31`
    ]);
    data.push([]); // 빈 줄

    // 2. 헤더 행
    const headers = [
        "사용일자", "사용자(성명)", "주행 전 계기판 거리(km)", "주행 후 계기판 거리(km)", 
        "주행거리(km)", "출·퇴근용(km)", "일반 업무용(km)", "비업무용(km)", 
        "충전비(원)", "통행료(원)", "목적"
    ];
    data.push(headers);

    // 3. 데이터 행 및 합계 계산
    let sumDist = 0, sumCommute = 0, sumGeneral = 0, sumCharge = 0, sumToll = 0;

    logs.forEach(log => {
        const before = Number(log.beforeDist) || 0;
        const after = Number(log.afterDist) || 0;
        let dist = after - before;
        dist = dist > 0 ? Number(dist.toFixed(1)) : 0;
        
        const isCommute = log.purpose && log.purpose.includes('출퇴근');
        const commuteDist = isCommute ? dist : 0;
        const generalDist = !isCommute ? dist : 0;
        const charge = Number(log.chargeCost) || 0;
        const toll = Number(log.tollFee) || 0;

        sumDist += dist;
        sumCommute += commuteDist;
        sumGeneral += generalDist;
        sumCharge += charge;
        sumToll += toll;

        data.push([
            log.date,
            log.driver || '',
            before,
            after,
            dist,
            commuteDist,
            generalDist,
            0, // 비업무용
            charge,
            toll,
            log.purpose || ''
        ]);
    });

    // 4. 합계 행 추가
    data.push([
        "합계", "", "", "", 
        sumDist, sumCommute, sumGeneral, 0, 
        sumCharge, sumToll, ""
    ]);

    // 5. 워크시트 생성 및 설정
    const ws = XLSX.utils.aoa_to_sheet(data);

    // 컬럼 너비 설정 (옵션)
    ws['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, 
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, 
        { wch: 12 }, { wch: 12 }, { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "운행기록부");

    // 6. 파일 다운로드
    XLSX.writeFile(wb, `운행기록부_${vehicleInfo.id}_${year}.xlsx`);
}

// 특정 차량의 마지막 누적 주행거리 가져오기
export async function fetchLastDist(vehicleId) {
    if (!supabase || !vehicleId) return 0;
    try {
        const { data, error } = await supabase
            .from('kiwe_vehicle_logs')
            .select('after_dist')
            .eq('vehicle_id', vehicleId)
            .order('date', { ascending: false })
            .order('after_dist', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        return data && data.length > 0 ? (Number(data[0].after_dist) || 0) : 0;
    } catch (err) {
        console.error('fetchLastDist error:', err);
        return 0;
    }
}
