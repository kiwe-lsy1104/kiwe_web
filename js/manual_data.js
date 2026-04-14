/**
 * KiWE 측정관리 매뉴얼 데이터
 * 버전 및 공지사항은 Supabase에서 동적으로 로드됩니다.
 */
const MANUAL_VERSION = '2.1.0';
const MANUAL_UPDATED = '2026-04-14';

const MANUAL_SECTIONS = [
  {
    id: 'section-overview',
    title: '시스템 개요',
    icon: '🏠',
    tags: ['개요', '소개', '시스템', 'KiWE', '작업환경측정'],
    content: `
      <p>KiWE 측정관리 시스템은 <strong>한국작업환경평가원(KiWE)</strong>의 작업환경측정 업무 전반을 디지털화한 웹 기반 플랫폼입니다.</p>
      <p>Supabase 클라우드 DB를 기반으로 실시간 데이터 동기화를 제공하며, PC 및 모바일 환경 모두를 지원합니다.</p>
      <h4>주요 모듈</h4>
      <ul>
        <li>📋 <strong>측정기록 관리</strong> – 보고서 작성 및 조회</li>
        <li>🏢 <strong>사업장 관리</strong> – 사업장 DB 등록/수정</li>
        <li>📅 <strong>측정계획관리</strong> – 차기 측정 일정 수립</li>
        <li>📄 <strong>견적 관리</strong> – 견적서 작성 및 발행</li>
        <li>🧪 <strong>시료대장 작성</strong> – 시료 채취 및 분석 기록</li>
        <li>🗓️ <strong>일정/장비 관리</strong> – 스케줄 및 장비 예약</li>
        <li>📊 <strong>분석결과통보서</strong> – 유기화합물 및 전체 보고서</li>
        <li>📈 <strong>시료통계관리</strong> – 분석 현황 조회 및 인쇄</li>
        <li>🚗 <strong>차량운행일지</strong> – 법인 차량 운행 기록 관리</li>
        <li>⚙️ <strong>평가원 관리 및 설정</strong> – 직원 권한 및 시스템 설정</li>
      </ul>
      <div class="tip-box">💡 처음 사용하신다면 <strong>사업장 관리</strong>에서 사업장을 먼저 등록하신 후, 측정기록을 추가하시기 바랍니다.</div>
    `
  },
  {
    id: 'section-records',
    title: '측정기록 관리',
    icon: '📋',
    tags: ['측정기록', '보고서', '기록', '작성', '조회', '검색', '필터'],
    content: `
      <p>측정기록 관리는 사업장의 작업환경측정 스케줄, 담당자, 공정, 특이사항 등 모든 <strong>메타 데이터 기록 폼</strong>을 생성하고 관리하는 통합 모듈입니다.</p>
      
      <h4>📋 기본 화면 및 검색 필터</h4>
      <ul>
        <li><strong>연도/분기/사업장/담당자 필터</strong>: 상단의 드롭다운 및 검색창을 통해 원하는 조건의 측정기록만 필터링하여 조회할 수 있습니다.</li>
        <li><button class="px-2 py-1 bg-white border border-slate-200 rounded text-xs">↻ 초기화</button> : 설정한 모든 필터 조건을 초기화하고 전체 목록을 다시 불러옵니다.</li>
      </ul>

      <h4>✨ 주요 버튼 기능 안내</h4>
      <ul>
        <li><button class="px-2 py-1 bg-indigo-600 text-white rounded text-xs">+ 새 보고서 추가</button> : 신규 작업환경측정 기록을 생성합니다. 빈 카드가 열려 새로운 측정을 배정할 수 있습니다.</li>
        <li><button class="px-2 py-1 bg-white border border-slate-200 rounded text-xs">📥 엑셀 내보내기</button> : 현재 화면에 필터링된 측정기록 목록을 Excel 파일(.xlsx) 형식으로 즉시 다운로드하여 외장 보고용으로 가공할 수 있습니다.</li>
      </ul>

      <h4>📝 측정기록 카드 상세 입력</h4>
      <p>목록에서 특정 기록을 <code>더블클릭</code>하거나 <strong>새 보고서 추가</strong> 시 우측에 열리는 상세 정보 패널(서랍)입니다.</p>
      <ol>
        <li><strong>사업장 정보 자동 연동</strong>: 스크롤 메뉴에서 <code>사업장명</code>을 선택하면, 해당 사업장의 정보(주소 및 기본 인적사항)가지 기존 DB에서 당겨옵니다.</li>
        <li><strong>진행 상태 (Status) 구분</strong>: 현재 측정의 <code>진행 상태</code>(대기, 측정중, 분석중, 보고서작성, 완료)를 설정하여 담당자간 공정율을 모니터링 관리할 수 있습니다. <code>완료</code> 상태가 되면, 수정이 방지됩니다!</li>
        <li><strong>차기 측정일 (Next Date) 로직</strong>: 방대한 법령에 의거, 입력된 해당 측정일과 <strong>과거 노출 기준 초과 여부</strong>를 확인/계산하여 <strong>소음 측정 다음 주기</strong>와 <strong>유해인자 다음 주기</strong>(통상 6개월, 1년)가 자동으로 계산되어 표출됩니다.</li>
        <li><button class="px-2 py-1 bg-blue-600 text-white rounded text-xs">💾 아이콘</button> : 입력한 텍스트나 날짜 데이터는 화면을 이탈할 시 스마트 로직이 작동하거나 저장 버튼 명시 클릭을 통해 DB에 안전하게 보존합니다.</li>
      </ol>

      <div class="tip-box">💡 <strong>도움말 연동 완료!</strong><br>앱 모듈 상단의 <strong>[?] 아이콘</strong>이나 영역별 도움말 버튼을 누르시면, 지금 보고 계시는 이 매뉴얼 섹션으로 다이렉트 딥링크됩니다! 언제든지 길을 잃으면 눌러보세요.</div>
    `
  },
  {
    id: 'section-companies',
    title: '사업장 관리',
    icon: '🏢',
    tags: ['사업장', '회사', '등록', '수정', '삭제', 'DB', '데이터베이스', '업체'],
    content: `
      <p>사업장 관리에서는 측정을 수행하는 <strong>고객 사업장의 기본 정보</strong>를 등록하고 관리합니다.</p>
      <h4>사업장 등록</h4>
      <ol>
        <li><strong>[사업장 관리]</strong> 메뉴 진입 후 <strong>[신규 등록]</strong> 버튼을 클릭합니다.</li>
        <li>사업장명, 사업자번호, 주소, 담당자 연락처를 입력합니다.</li>
        <li><strong>[저장]</strong> 버튼을 클릭하여 확정합니다.</li>
      </ol>
      <h4>사업장 검색</h4>
      <ul>
        <li>상단 검색창에 사업장명 또는 사업자번호를 입력하면 <strong>실시간 필터링</strong>됩니다.</li>
        <li>지역, 업종, 담당자별 필터를 조합하여 검색할 수 있습니다.</li>
      </ul>
      <h4>위험인자(MSDS) 연결</h4>
      <ul>
        <li>사업장 상세 화면에서 사용 화학물질을 MSDS DB와 연결하면, 측정 계획 시 자동으로 측정 항목이 제안됩니다.</li>
      </ul>
      <div class="warn-box">⚠️ 사업장 삭제 시 연결된 측정기록도 함께 삭제될 수 있습니다. 삭제 전 반드시 확인하세요.</div>
    `
  },
  {
    id: 'section-plan',
    title: '측정계획관리',
    icon: '📅',
    tags: ['측정계획', '일정', '계획', '차기', '예정', '주기', '일정수립'],
    content: `
      <p>측정계획관리는 <strong>차기 측정 예정 사업장</strong>을 자동으로 파악하고, 측정 일정을 수립하는 기능입니다.</p>
      <h4>이달의 측정 예정 건수</h4>
      <ul>
        <li>메인 화면의 <strong>[측정계획관리]</strong> 카드에 이번 달 예정 건수가 표시됩니다.</li>
        <li>소음 및 유해인자 측정 예정일이 당월에 해당하는 사업장 수를 자동 집계합니다.</li>
      </ul>
      <h4>계획 수립</h4>
      <ol>
        <li>측정계획관리 화면에서 이달 또는 다음 달 예정 목록을 확인합니다.</li>
        <li>사업장별 담당자를 지정하고 구체적인 측정 날짜를 설정합니다.</li>
        <li>설정된 계획은 <strong>일정/장비 관리</strong>와 연동되어 스케줄 달력에서도 확인됩니다.</li>
      </ol>
      <div class="tip-box">💡 법정 측정 주기(소음: 6개월/1년, 유해인자: 6개월/1년)에 맞춰 차기 측정일이 자동 계산됩니다.</div>
    `
  },
  {
    id: 'section-quotation',
    title: '견적서 작성 및 관리',
    icon: '📄',
    tags: ['견적', '견적서', '작성', '발행', '관리비', '금액', '배율', '할인', '용역', '장비대여', '출력'],
    content: `
      <p>견적 관리에서는 일반 작업환경측정, 비용지원, 용역, 장비대여 등 <strong>다양한 유형의 견적서를 유연하게 작성하고 PDF로 출력</strong>합니다.</p>
      
      <h4>✨ 견적 편집기 주요 구성 요소</h4>
      
      <h5>1. 기본 정보 및 유형 선택</h5>
      <ul>
        <li><strong>견적 종류 선택</strong>: <code>일반</code>, <code>용역</code>, <code>장비대여</code> 중 선택합니다. 선택한 종류에 따라 견적서 내역 테이블의 양식(인건비, 대여장비 등)과 단가 DB가 자동으로 변경됩니다.</li>
        <li><strong>비용지원 유형</strong>: <code>일반</code>, <code>신규지원(100%)</code>, <code>기존지원(80%)</code> 중 선택하면 자동으로 <strong>공단지원금</strong>과 <strong>사업주부담금</strong>이 분리 계상됩니다.</li>
        <li><strong>결제조건</strong>: 현금, 30일, 60일, 어음 등을 지정할 수 있습니다.</li>
      </ul>

      <h5>2. 세부 내역 및 수수료 입력</h5>
      <p>시료 채취 항목, 분석 방법, 장비 등을 직접 입력할 수 있으며, <code>엑셀 스타일의 키보드 네비게이션(방향키, Tab 이동)</code>을 지원합니다. 또한 엑셀 파일에서 <strong>복사 & 붙여넣기(Ctrl+V)</strong>가 즉시 호환됩니다.</p>
      <ul>
        <li><button class="px-2 py-1 bg-white border border-slate-200 rounded text-xs">+</button> : 각 행의 우측 끝에 위치하며, 클릭 시 <strong>해당 행 바로 아래</strong>에 새로운 빈 행을 삽입합니다. 중간에 누락된 항목을 끼워 넣을 때 유용합니다.</li>
        <li><button class="px-2 py-1 bg-white border border-slate-200 rounded text-xs">휴지통 아이콘</button> : 클릭한 해당 행을 즉시 삭제합니다.</li>
      </ul>

      <h5>3. 금액 합계 및 정책 적용</h5>
      <ul>
        <li><strong>할인액(원) / 할인율(%)</strong>: 시스템 계산 합계금액에서 특정 금액을 임의 할인해주거나(예: 50,000원 할인), 비율(-10%)로 전체 금액을 절감시켜줍니다.</li>
        <li><strong>원단위 절삭</strong>: 최종 합계 금액을 <code>원단위 없음</code>, <code>천원 단위 절삭</code>, <code>만원 단위 절삭</code>으로 일괄 조정하여 깔끔한 결제 금액을 맞출 수 있습니다.</li>
      </ul>

      <h5>4. 저장 방식 및 발행 (중요)</h5>
      <p>엑셀의 '워크시트 저장'과 '매크로 실행' 개념을 도입하여 더욱 안전한 업무 흐름을 제공합니다.</p>
      <ul>
        <li><button class="px-2 py-1 bg-white border border-blue-200 text-blue-600 rounded text-xs">중간저장</button> : 현재 작성 중인 내용을 DB에 보관합니다. <strong>견적번호가 부여되지 않으므로</strong> 번호 중복 걱정 없이 여러 번 저장할 수 있습니다. 훗날 목록에서 언제든 다시 열어 작업을 이어갈 수 있습니다.</li>
        <li><button class="px-2 py-1 bg-blue-600 text-white rounded text-xs">견적서 최종발행</button> : 모든 작성이 끝난 후 클릭하면 비로소 정식 견적번호(<code>KIWE-연도-순번</code>)가 부여되며 직인이 포함된 공식 문서가 완성됩니다.</li>
        <li><button class="px-2 py-1 bg-slate-700 text-white rounded text-xs">변경사항 저장</button> : 이미 번호가 발행된 견적서를 수정할 때 나타나며, 기존 번호는 유지한 채 내용만 업데이트합니다.</li>
      </ul>

      <h5>5. 스마트 그리드 기능 (Excel 호환)</h5>
      <p>분석수수료 입력창은 엑셀과 거의 동일한 사용성을 제공합니다.</p>
      <ul>
        <li><strong>Ctrl+C / Ctrl+V</strong>: 엑셀 파일의 데이터를 다중 행/열 단위로 즉시 붙여넣을 수 있습니다.</li>
        <li><strong>단가 자동 연동</strong>: 엑셀 데이터를 붙여넣는 즉시, 해당 <code>분석방법</code>에 맞는 <strong>최신 단가를 DB에서 자동으로 조회</strong>하여 입력해 줍니다. 일일이 클릭하여 단가를 불러오지 않아도 됩니다.</li>
        <li><strong>작성자 서명</strong>: 작성 완료 시 성함 뒤에 <code>과장, 팀장</code> 등 사용자의 **직책(Position)**이 자동으로 붙어 전문성을 더해줍니다.</li>
      </ul>

      <h5>6. 미리보기 및 출력</h5>
      <ul>
        <li><button class="px-2 py-1 bg-white border border-slate-200 rounded text-xs">미리보기</button> : 현재 작성 중인 견적서가 A4 용지에 어떻게 출력될지 확인합니다.</li>
        <li><strong>여백(mm) 도구</strong>: 미리보기 창 상단에서 상/하/좌/우 여백을 실시간(mm단위)으로 조절할 수 있습니다.</li>
      </ul>
    `
  },
  {
    id: 'section-sampling',
    title: '시료대장 (시료채취기록대장)',
    icon: '🧪',
    tags: ['시료', '채취', '대장', '시료대장', '시료ID', '작업자', '자동부여', '유량', '도구'],
    content: `
      <p>시료대장 작성은 현장에서 포집한 공기/유기화합물 시료 내역을 기록하여 분석 기관에 의뢰하기 전까지 <strong>데이터 정합성과 시료 번호를 관리</strong>하는 가장 중요한 기능입니다.</p>
      
      <h4>✨ 상단 툴바 및 필터 기능</h4>
      <ul>
        <li><strong>시료 분류 필터</strong>: <code>시료(S)</code>, <code>시료(D)</code>, <code>공시료(SB)</code>, <code>공시료(DB)</code> 버튼을 클릭해 원하는 종류만 즉시 필터링합니다.</li>
        <li><strong>정렬 기준</strong>: <code>시료번호순</code>, <code>작업자순</code>으로 그리드를 재정렬합니다.</li>
        <li><button class="px-2 py-1 bg-white border border-slate-200 rounded text-xs">⚙️ 컬럼설정</button> : 사용자 편의에 맞게 화면에 보이는 테이블 열(컬럼)을 숨기거나 순서를 드래그 앤 드롭으로 재배치합니다.</li>
        <li><button class="px-2 py-1 bg-white border border-slate-200 rounded text-xs">🌐 공유 저장</button> : 현재 화면의 컬럼 순서/숨김 상태를 클라우드에 영구 저장하여 다른 PC에서도 동일한 표 환경을 제공합니다.</li>
      </ul>

      <h4>📊 데이터 그리드 조작 및 시료 ID</h4>
      <p>이곳은 엑셀 시트와 거의 동일하게 작동하도록 특수 설계되었습니다.</p>
      <ul>
        <li><strong>시료 ID (Sample ID) 자동 발급</strong>: <code>사업장명</code>과 <code>유해인자</code>가 모두 채워지면 시스템이 <strong>접두어 판별</strong>(일반: S, 중량: D, 공시료: SB/DB)과 날짜를 융합하여 <code>S241-0012</code> 처럼 <strong>시료 번호를 절대 중복없이 자동 부여</strong>합니다.</li>
        <li><button class="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-xs">시료번호 재계산</button> : 정렬을 바꾸거나 중간에 시료가 끼어들어갔을 때, 현재 화면에 <strong>보이는 순서대로</strong> ID를 1번부터 차례대로 재할당해 주는 복구 기능입니다!</li>
        <li><strong>행 추가 / 삭제</strong>: 우클릭 메뉴를 통해 <strong>현재 줄 밑에 10줄 추가</strong> 등을 손쉽게 할 수 있습니다.</li>
      </ul>

      <h4>🖨️ 출력 및 연동 기능</h4>
      <ul>
        <li><button class="px-2 py-1 bg-indigo-600 text-white rounded text-xs">저장버튼</button> : <strong>[저장]</strong>을 누르기 전까지는 DB에 시료가 확정되지 않습니다. 반드시 임시 작성 후 저장 버튼을 클릭하세요!</li>
        <li><strong>🧪 시료채취기록표 출력</strong>: 우상단 녹색 버튼 클릭 시 현장용 '기록표 전용 인쇄 팝업창'이 표시됩니다.</li>
      </ul>
      <div class="tip-box">💡 <strong>꿀팁! 유해인자 팝업</strong><br>유해인자 셀을 <code>더블클릭</code>하면 물질 검색 트리 팝업이 올라옵니다! 약어만 치고 엔터를 쳐도 똑똑하게 Full Name으로 치환됩니다!</div>
    `
  },
  {
    id: 'section-schedule',
    title: '일정 및 장비 관리',
    icon: '🗓️',
    tags: ['일정', '장비', '장비예약', '스케줄', '달력', '예약', '캘린더'],
    content: `
      <p>일정 및 장비 관리는 측정 일정을 <strong>달력 형식으로 시각화</strong>하고, 장비 예약을 통해 중복 사용을 방지합니다.</p>
      <h4>일정 추가</h4>
      <ol>
        <li><strong>[일정/장비 관리]</strong> 진입 후 달력에서 날짜를 클릭합니다.</li>
        <li>사업장, 담당자, 사용 장비, 측정 유형을 선택합니다.</li>
        <li><strong>[저장]</strong>으로 일정을 등록합니다.</li>
      </ol>
      <h4>장비 예약</h4>
      <ul>
        <li>특정 장비를 선택하면 해당 날짜의 <strong>장비 사용 여부</strong>를 달력에서 색상으로 구분할 수 있습니다.</li>
        <li>동일 날짜에 같은 장비를 중복 예약하면 경고가 표시됩니다.</li>
      </ul>
      <h4>주간/월별 보기</h4>
      <ul>
        <li>달력 우상단에서 <strong>[주간 보기]</strong> / <strong>[월별 보기]</strong>를 전환할 수 있습니다.</li>
      </ul>
      <div class="tip-box">💡 측정계획관리에서 수립한 계획이 이 달력에 자동으로 반영됩니다. 오늘의 일정 창에서는 <strong>더 커진 복사/삭제 버튼</strong>을 통해 실수 없는 빠른 관리가 가능합니다.</div>
    `
  },
  {
    id: 'section-analysis',
    title: '분석결과통보서',
    icon: '📊',
    tags: ['분석결과', '통보서', '유기화합물', '보고서', '출력', '결과', '분석'],
    content: `
      <p>분석결과통보서는 분석 기관에서 받은 결과를 입력하고, <strong>법정 서식의 결과 통보서를 생성</strong>하는 기능입니다.</p>
      <h4>결과 입력</h4>
      <ol>
        <li><strong>[분석결과통보서]</strong> 진입 후 해당 사업장·측정일을 선택합니다.</li>
        <li>유해인자별 분석 결과값(TWA, STEL 등)을 입력합니다.</li>
        <li>노출 기준 초과 여부가 자동으로 판정됩니다.</li>
      </ol>
      <h4>보고서 유형</h4>
      <ul>
        <li><strong>유기화합물 보고서</strong>: 유기용제류 측정 결과 전용 서식</li>
        <li><strong>통합 보고서</strong>: 모든 유해인자를 포함한 통합 서식</li>
      </ul>
      <h4>출력</h4>
      <ul>
        <li>PDF 미리보기 후 바로 인쇄하거나 파일로 저장할 수 있습니다.</li>
        <li>사업장별·기간별 결과를 엑셀로 내보낼 수 있습니다.</li>
      </ul>
      <div class="tip-box">💡 노출 기준 초과 항목은 빨간색으로 강조 표시됩니다.</div>
    `
  },
  {
    id: 'section-sampling-manage',
    title: '시료통계관리',
    icon: '📈',
    tags: ['시료통계', '통계', '현황', '분석현황', '조회', '인쇄', '집계'],
    content: `
      <p>시료통계관리는 등록된 시료 데이터를 집계하여 <strong>분석 현황을 한눈에 파악</strong>할 수 있는 통계 기능입니다.</p>
      <h4>통계 조회</h4>
      <ol>
        <li><strong>[시료통계관리]</strong> 진입 후 조회 기간(연도·분기·월)을 설정합니다.</li>
        <li>담당자별 또는 유해인자별 통계를 필터링합니다.</li>
        <li>집계된 데이터가 표와 차트 형태로 표시됩니다.</li>
      </ol>
      <h4>인쇄 및 내보내기</h4>
      <ul>
        <li><strong>[인쇄]</strong> 버튼으로 통계 현황표를 바로 출력합니다.</li>
        <li>엑셀 내보내기 기능으로 상세 데이터를 추출할 수 있습니다.</li>
      </ul>
      <div class="tip-box">💡 분기별 업무량 파악 및 연간 성과 보고에 활용하세요.</div>
    `
  },
  {
    id: 'section-vehicle',
    title: '법인 전기차 운행일지',
    icon: '🚗',
    tags: ['차량', '운행일지', '전기차', '충전', '계기판', '국세청', '운행기록', '주행거리', '모바일'],
    content: `
      <p>법인 차량(특히 전기차)의 <strong>운행 내역을 기록</strong>하고, 국세청 제출용 양식으로 내보내는 맞춤형 차계부 기능입니다.</p>
      
      <!-- 데모 영상 삽입 -->
      <div class="my-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span class="text-xs font-bold text-slate-600">실제 UI 작동 데모 (기록 추가 및 모바일 화면 전환)</span>
        </div>
        <img src="images/vehicle_demo.webp" alt="차량운행일지 작동 데모 영상" class="w-full object-cover max-h-[400px]" />
      </div>

      <h4>🚗 운행 기록 추가</h4>
      <ol>
        <li><strong>[새 운행기록 추가]</strong> 버튼(PC) 또는 모바일 뷰의 상단 파란색 버튼을 클릭합니다.</li>
        <li>시스템이 똑똑하게 가장 최근 기록의 '운행 후 계기판 거리'를 새 기록의 <strong>'운행 전' 거리</strong>로 자동 이월시킵니다.</li>
        <li>현재 날짜와 로그인 사용자 이름이 자동으로 세팅됩니다.</li>
        <li>운행 목적을 선택/수기입력하고, 운행 종료 후 <strong>계기판 숫자</strong>를 입력하면 주행 거리가 자동 계산됩니다.</li>
      </ol>

      <h4>⚡ 충전 기록 추가 (전기차 전용)</h4>
      <ol>
        <li>초록색 <strong>[충전 기록 추가]</strong> 버튼을 클릭합니다.</li>
        <li>운행 목적이 자동으로 <code>충전</code>으로 설정되고, <strong>초록색 강조 테마</strong>로 행이 변경되어 구분을 돕습니다.</li>
        <li>충전 금액과 충전량(kWh)만 입력하면 됩니다.</li>
      </ol>

      <h4>🖨️ 국세청 양식 연동 출력</h4>
      <ul>
        <li><strong>[국세청 양식 다운로드]</strong> 버튼 하나로 해당 연도 전체 기록을 <strong>국세청 법인차량 표준 양식 엑셀 파일</strong>로 변환하여 저장합니다.</li>
        <li>운행 목적에 <code>출/퇴근</code>이 포함된 경우, 엑셀 폼에서 자동으로 '출퇴근 주행거리' 칸으로 정확하게 매핑 분리됩니다.</li>
      </ul>
      
      <div class="tip-box">💡 새 운행기록을 추가할 때마다 이전 기록의 계기판 값이 자동 이월되므로, <strong>시간 순서대로 빠짐없이 입력</strong>하는 것이 중요합니다!</div>
      <div class="warn-box">⚠️ 입력 칸을 채운 뒤 각 행 우측 또는 하단의 <strong>[저장]</strong> 버튼을 꼭 눌러야 데이터베이스에 최종 기록됩니다.</div>
    `
  },
  {
    id: 'section-settings',
    title: '평가원 관리 및 설정',
    icon: '⚙️',
    tags: ['설정', '권한', '관리자', '직원', '평가원', '단가', '기준', '비밀번호'],
    content: `
      <p>평가원 관리 및 설정은 <strong>관리자 전용 메뉴</strong>로, 시스템 전반의 기준 정보와 사용자 권한을 관리합니다.</p>
      <div class="warn-box">⚠️ 이 메뉴는 관리자 권한(이승용, 강경호)에게만 표시됩니다.</div>
      <h4>직원 관리</h4>
      <ul>
        <li>직원 계정 생성, 수정, 비활성화</li>
        <li>역할(관리자/일반) 권한 설정</li>
      </ul>
      <h4>시스템 설정</h4>
      <ul>
        <li><strong>측정 단가 설정</strong>: 유해인자별 측정 기본 단가를 설정합니다.</li>
        <li><strong>관리비 기준</strong>: 일반 및 비용지원 관리비 기준을 설정합니다.</li>
        <li><strong>분석 항목 추가</strong>: 견적 및 측정에서 사용할 분석 항목을 추가/수정합니다.</li>
        <li><strong>보유장비 관리</strong>: 평가원에서 보유한 장비 목록(예: 소음보정기 등)을 업데이트합니다.</li>
      </ul>
      <h4>데이터 관리</h4>
      <ul>
        <li>MSDS(물질안전보건자료) DB 관리</li>
        <li>위험인자 기준치(TWA, STEL) 업데이트</li>
      </ul>
      <div class="tip-box">💡 단가나 관리비 기준을 변경하면 이후 신규 작성되는 견적서에만 반영됩니다. 기존 견적에는 영향을 주지 않습니다.</div>
    `
  },
  {
    id: 'section-faq',
    title: '자주 묻는 질문 (FAQ)',
    icon: '❓',
    tags: ['FAQ', '자주묻는질문', '문제해결', '오류', '도움말', '지원', '로그인'],
    content: `
      <div class="faq-item">
        <h4>Q. 로그인이 안 됩니다.</h4>
        <p>A. 비밀번호 대소문자를 확인하세요. 문제가 지속되면 관리자(이승용 또는 강경호)에게 계정 초기화를 요청하세요.</p>
      </div>
      <div class="faq-item">
        <h4>Q. 데이터가 저장되지 않습니다.</h4>
        <p>A. 인터넷 연결 상태를 확인하세요. Supabase 서버와의 연결이 끊어지면 저장이 실패할 수 있습니다. 페이지를 새로고침(F5) 후 다시 시도하세요.</p>
      </div>
      <div class="faq-item">
        <h4>Q. 모바일에서 접속하면 화면이 다릅니다.</h4>
        <p>A. 모바일 기기에서는 자동으로 모바일 전용 화면(m_schedule.html)으로 이동됩니다. PC 버전은 PC 브라우저에서 사용하세요.</p>
      </div>
      <div class="faq-item">
        <h4>Q. 견적서 번호가 이상하게 나옵니다.</h4>
        <p>A. 견적 번호는 <code>KIWE-연도-순번</code> 형식입니다. 순번이 이상할 경우 관리자에게 DB 점검을 요청하세요.</p>
      </div>
      <div class="faq-item">
        <h4>Q. 시료 ID가 중복됩니다.</h4>
        <p>A. 행 삽입/삭제 후 반드시 <strong>[ID 재정렬]</strong> 기능을 실행하거나 페이지를 새로고침하세요.</p>
      </div>
      <div class="faq-item">
        <h4>Q. PDF 출력 시 레이아웃이 깨집니다.</h4>
        <p>A. 브라우저 인쇄 설정에서 <strong>'배경 그래픽 인쇄'</strong>를 활성화하고, 여백을 '없음' 또는 '최소'로 설정하세요. Chrome 또는 Edge 브라우저를 권장합니다.</p>
      </div>
    `
  }
];

// Export for use in manual.html
if (typeof module !== 'undefined') {
  module.exports = { MANUAL_SECTIONS, MANUAL_VERSION, MANUAL_UPDATED };
}
