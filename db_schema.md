# Supabase Database Schema (KiWE)

본 문서는 KiWE 프로젝트의 소스 코드(HTML/JS) 분석을 통해 추출된 Supabase 데이터베이스 스키마 정보입니다. 각 테이블과 컬럼에 대한 정보는 UI 레이블 및 비즈니스 로직을 기반으로 한글 설명과 실제 사용되는 HTML 파일을 포함하고 있습니다.

---

## 1. 사업장 정보 (kiwe_companies)

| 컬럼명 | 설명 | 연결 HTML | 비고 |
|:---:|:---|:---|:---|
| **com_id** | 사업장 고유 ID (PK) | companies, plan, quotation, sampling | 'K-0001' 형식 |
| **com_reg_no** | 사업장 관리번호 | quotation | 사업자등록번호 등 |
| **com_name** | 사업장명 | m_schedule, plan, quotation, records, sampling | ㈜ 등 정규화 처리됨 |
| **office_name** | 관할 지청 | companies, records | 안산, 경기 등 |
| **ceo_name** | 대표자명 | quotation | |
| **manager_name** | 담당자명 | companies | |
| **manager_contact** | 담당자 연락처 | m_schedule | |
| **post_code** | 우편번호 | companies | |
| **address** | 소재지 (주소) | m_schedule, quotation | |
| **block_address** | 블럭 소재지 | companies | |
| **tel** | 전화번호 | m_schedule, quotation | |
| **fax** | 팩스번호 | quotation | |
| **biz_type** | 업종 | quotation | |
| **main_product** | 주생산품 | quotation | |
| **remarks** | 비고 | companies | |
| **manage_status** | 관리 상태 | plan, quotation | '정상' / '관리중지' |
| **manage_remark** | 관리 중지 사유 | companies | |

---

## 2. 측정기록카드 (kiwe_records)

| 컬럼명 | 설명 | 연결 HTML | 비고 |
|:---:|:---|:---|:---|
| **com_id** | 사업장 관리번호 (FK) | plan | |
| **com_name** | 사업장명 | plan, records | |
| **office_name** | 관할 지청 | records | |
| **target_year** | 대상 연도 | records | |
| **half_year** | 반기 구분 | records | 상반기, 하반기 등 |
| **start_date** | 측정 시작일 | records | |
| **end_date** | 측정 종료일 | accounts, plan, records | |
| **worker_cnt** | 근로자 수 | records | |
| **inspector** | 측정자 | records | |
| **next_noise_date** | 차기 소음 측정 예정일 | main | |
| **next_excl_date** | 차기 소음 외 측정 예정일 | main | |
| **is_funded** | 지원 여부 | records | |
| **actual_amt** | 실금액 | records | |
| **billing_amt** | 사업장 청구금 | records | |
| **subsidy** | 공단 지원금 | records | |
| **report_date** | 전산 보고 일자 | records | |
| **shipping_date** | 실 발송일 | records | |
| **billing_date** | 청구서 발행일 | records | |
| **is_fixed** | 번호 고정 여부 | records | y, n |
| **work_type** | 업무 구분 | records | 측정, 기타용역 등 |

---

## 3. 시료채취 정보 (kiwe_sampling_YYYY_N)
*주: `kiwe_sampling_2026_1` 등의 동적 테이블 기준*

| 컬럼명 | 설명 | 연결 HTML | 비고 |
|:---:|:---|:---|:---|
| **sample_id** | 시료번호 | analysis, sampling, weight | 자동생성 |
| **m_date** | 측정일자 | analysis, sampling, weight | |
| **com_name** | 사업장명 | analysis, sampling, weight | |
| **work_process** | 작업공정 | analysis, sampling, weight | |
| **worker_name** | 근로자명 | analysis, sampling, weight | |
| **common_name** | 유해인자명 | analysis, sampling, weight | |
| **start_time** | 시작시간 | analysis, sampling | |
| **end_time** | 종료시간 | analysis, sampling | |
| **measured_min** | 측정시간(분) | analysis, sampling | |
| **temp** | 온도 | analysis, sampling | |
| **humidity** | 습도 | analysis, sampling | |
| **condition** | 시료상태 | sampling | 예: '양호' |
| **analyst** | 분석자 | analysis, sampling | |
| **measured_by** | 측정자 | analysis, sampling | |
| **instrument_name** | 분석장비명 | sampling | |
| **status** | 진행 상태 | analysis, sampling | |

---

## 4. 유해인자 마스터 (kiwe_hazard)

| 컬럼명 | 설명 | 연결 HTML | 비고 |
|:---:|:---|:---|:---|
| **hazard_id** | 유해인자 고유 ID | search, settings | 'HZ-0001' |
| **common_name** | 유해인자명 | oil_weight, sampling, search, weight | |
| **hazard_category** | 유해인자 구분 | search, weight | |
| **cas_no** | CAS 번호 | search | |
| **legal_name** | 법적 명칭 | search | |
| **twa_ppm**, **twa_mg** | TWA 노출기준 | search, weight, oil_weight | |
| **stel_ppm**, **stel_mg** | STEL 노출기준 | search | |
| **analysis_method** | 분석 방법 | search | |
| **sampling_media** | 채취 매체 | search | |
| **flow_rate** | 유량 (Flow Rate) | search | |
| **sampling** | 채취 방법 | search | |
| **instrument_name** | 분석 장비명 | sampling, search, weight | |
| **is_self** | 자체 분석 여부 | search | |
| **is_permissible** | 허가 대상 여부 | search | |
| **is_cmr_material** | 특별관리(CMR) 여부 | search | |

---

## 5. 견적서 정보 (kiwe_quotation)

| 컬럼명 | 설명 | 연결 HTML | 비고 |
|:---:|:---|:---|:---|
| **quote_no** | 견적 번호 | quotation | |
| **quote_date** | 견적 일자 | quotation | |
| **client_name** | 거래처명 | quotation | |
| **quote_type** | 견적 유형 | quotation | |
| **support_type** | 지원 유형 | quotation | |
| **management_fee** | 기본관리비 단가 | quotation | |
| **sampling_days** | 측정 일수 | quotation | |
| **discount_amount** | 할인 금액 | quotation | |
| **support_amount** | 공단 지원금 | quotation | |
| **actual_amount** | 합계 금액 | quotation | |
| **status** | 상태 | quotation | |

---

## 6. 기타 시스템 정보

### [사용자 - kiwe_users]
- **연결 HTML**: index(로그인), settings(관리), sampling, records 등 전 영역
- **주요 컬럼**: `user_id`, `user_pw`, `user_name`, `role`, `job_title`

### [장비 - kiwe_equipments]
- **연결 HTML**: m_schedule, plan, schedule, settings
- **주요 컬럼**: `eq_name`, `equipment_type`, `limit_count`, `serial_no`

### [일정 - kiwe_schedule]
- **연결 HTML**: m_schedule, plan, schedule
- **주요 컬럼**: `sche_date`, `com_name`, `user_name`

---

> [!NOTE]
> 연결 HTML 정보는 정적 코드 분석 결과로, 실제 런타임에서의 동적 참조를 포함하지 않을 수 있습니다.
