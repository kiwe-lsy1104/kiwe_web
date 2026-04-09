"""
toxfree.kr 엑셀 일괄 다운로드 및 병합 스크립트 (클릭 방식)
=============================================================
- URL 직접 이동 방식 사용 안 함 (URL이 /products 로 고정되는 SPA 구조)
- 목록 페이지에서 td[onclick^='post'] 를 직접 click() → 상세 페이지 진입
- 엑셀 다운로드 후 driver.back() 으로 목록 복귀
- 이어받기(Resume) / 고유 파일명 / 전체 병합 기능 포함
"""

import sys
import time
import random
import glob
import getpass
import re
import shutil
from pathlib import Path

# ── 의존성 확인 ───────────────────────────────────────────────────────────────
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        TimeoutException, StaleElementReferenceException, WebDriverException, NoSuchElementException
    )
except ImportError:
    print("[ERROR] selenium 미설치: pip install selenium")
    sys.exit(1)

try:
    import pandas as pd
except ImportError:
    print("[ERROR] pandas 미설치: pip install pandas openpyxl")
    sys.exit(1)

# ── 설정 ──────────────────────────────────────────────────────────────────────
BASE_URL        = "https://toxfree.kr"
LIST_URL        = "https://toxfree.kr/workplaces"   # 목록 페이지
DETAIL_URL_FRAG = "/products"                        # 상세 페이지 고정 URL (참고용)
TOTAL_PAGES     = 12           # [요구사항] 전체 12페이지까지만 수집 제한
DOWNLOAD_DIR    = Path(__file__).parent / "msds_files"
MASTER_FILE     = Path(__file__).parent / "통합_MSDS_마스터.xlsx"
BLACKLIST_FILE  = Path(__file__).parent / "failed_posts.txt" # [블랙리스트] 실패/빈 데이터 기록 파일
WAIT_TIMEOUT    = 15           # 일반 대기(초)
BTN_TIMEOUT     = 12           # '엑셀로 받기' 버튼 전용 대기(초)
DOWNLOAD_WAIT   = 15           # 파일 다운로드 완료 대기(초) ↑ 10 → 15
DOWNLOAD_RETRY  = 2            # 다운로드 실패 시 재시도 횟수
SLEEP_MIN       = 2.5          # [요구사항] 클릭과 화면 전환 사이 2.5초 대기
SLEEP_MAX       = 2.5          # [요구사항] 클릭과 화면 전환 사이 2.5초 대기
MAX_EMPTY_PAGES = 3            # 연속 빈 페이지 허용 횟수 (이후 자동 종료)
MAX_RECONNECT   = 3            # 연결 끊김 시 최대 재시도 횟수
# ─────────────────────────────────────────────────────────────────────────────


# ── 유틸리티 ──────────────────────────────────────────────────────────────────

def rand_sleep():
    time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))


def sanitize_filename(name: str, max_len: int = 80) -> str:
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    name = name.strip(". ")
    return name[:max_len]


def already_downloaded(post_id: str) -> bool:
    """post_id 를 포함하는 파일이 이미 존재하면 True"""
    return bool(glob.glob(str(DOWNLOAD_DIR / f"*_{post_id}.*")))


# ── 블랙리스트 (실패 스킵) ──────────────────────────────────────────────────
def is_blacklisted(post_id: str) -> bool:
    if not BLACKLIST_FILE.exists():
        return False
    with open(BLACKLIST_FILE, "r", encoding="utf-8") as f:
        return post_id in f.read().splitlines()

def add_blacklist(post_id: str):
    with open(BLACKLIST_FILE, "a", encoding="utf-8") as f:
        f.write(post_id + "\n")


def wait_for_new_file(before_count: int, timeout: int = 20) -> Path | None:
    """
    msds_files 폴더의 최종 파일 개수가 before_count 보다 늘어날 때까지 대기.
    - .crdownload 제외 실제 파일만 카운트
    - deadline 안에 새 파일 진입 시 해당 Path 반환
    - 최대 timeout 종료 시 None
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(0.5)
        # .crdownload 제외 현재 파일 목록
        current_files = [
            f for f in DOWNLOAD_DIR.glob("*")
            if f.suffix != ".crdownload" and f.is_file()
        ]
        if len(current_files) > before_count:
            # 새로 늘어난 파일 탐색
            current_set  = set(current_files)
            new_files    = [f for f in current_set if f.name not in _snapshot_names]
            target = new_files[0] if new_files else current_files[-1]
            # .crdownload 주시 파일이 유지되는 동안 최대 8초 추가 대기
            finish = time.time() + 8
            while time.time() < finish:
                if not list(DOWNLOAD_DIR.glob("*.crdownload")):
                    break
                time.sleep(0.5)
            if target.exists():
                return target
    return None


# 스냅샷: 다운로드 전 파일명 집합(전역)
_snapshot_names: set[str] = set()


def take_file_snapshot() -> int:
    """
    다운로드 전 폴더 상태를 스냅샷.
    반환: 현재 .crdownload 제외 파일 개수
    """
    global _snapshot_names
    current = [
        f for f in DOWNLOAD_DIR.glob("*")
        if f.suffix != ".crdownload" and f.is_file()
    ]
    _snapshot_names = {f.name for f in current}
    return len(current)


def rename_file(filepath: Path, title: str, post_id: str) -> Path:
    ext = filepath.suffix
    safe = sanitize_filename(title)
    new  = DOWNLOAD_DIR / f"{safe}_{post_id}{ext}"
    c = 1
    while new.exists():
        new = DOWNLOAD_DIR / f"{safe}_{post_id}_{c}{ext}"
        c += 1
    shutil.move(str(filepath), str(new))
    return new


def extract_post_id(onclick_value: str) -> str | None:
    """
    onclick="post('/workplace/move/123')"  →  "123"
    """
    m = re.search(r"post\(['\"].*?/(\d+)/?\s*['\"]\)", onclick_value)
    return m.group(1) if m else None


# ── WebDriver 빌드 ────────────────────────────────────────────────────────────

def build_driver(headless: bool) -> webdriver.Chrome:
    options = Options()
    if headless:
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--lang=ko-KR")
    # 파일 다운로드 관련 설정
    dl_path = str(DOWNLOAD_DIR.resolve())
    prefs = {
        "download.default_directory"           : dl_path,
        "download.prompt_for_download"         : False,
        "download.directory_upgrade"           : True,
        "safebrowsing.enabled"                 : True,
        "safebrowsing.disable_download_protection": True,
        # 자동 다운로드 차단 해제 (1 = 허용, 2 = 차단)
        "profile.default_content_setting_values.automatic_downloads": 1,
        "profile.content_settings.exceptions.automatic_downloads": {
            "[*.]": {"last_modified": "0", "setting": 1}
        },
        # 파일 열기 프롬프트 비활성·4
        "profile.default_content_settings.popups"          : 0,
        "profile.default_content_setting_values.popups"    : 0,
    }
    options.add_experimental_option("prefs", prefs)
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(30)
    return driver


# ── 로그인 ────────────────────────────────────────────────────────────────────

def login(driver: webdriver.Chrome, user_id: str, password: str):
    print("[*] 로그인 중...")
    driver.get(BASE_URL + "/login")
    wait = WebDriverWait(driver, WAIT_TIMEOUT)

    id_input = wait.until(EC.presence_of_element_located(
        (By.CSS_SELECTOR, "input[name='email'], input[name='id'], input[type='email']")
    ))
    id_input.clear()
    id_input.send_keys(user_id)

    pw = driver.find_element(By.CSS_SELECTOR, "input[name='password'], input[type='password']")
    pw.clear()
    pw.send_keys(password)

    driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']").click()
    rand_sleep()

    if "/login" in driver.current_url:
        raise RuntimeError("로그인 실패: ID/PW를 확인하세요.")
    print("[✓] 로그인 성공!")


# ── 목록 페이지 이동 (텍스트 기반 타겟팅) ───────────────────────────────────

def move_to_page(driver: webdriver.Chrome, page: int) -> bool:
    """
    [긴급 수정] 징검다리 함수: 목표 페이지 번호가 보일 때까지 '다음' 버튼을 반복 클릭.
    - 인덱스(dt-idx) 배제, 오직 텍스트 매칭(//a[text()='n'])만 사용.
    """
    target_xpath = f"//a[text()='{page}']"
    next_xpath   = "//a[contains(text(), '다음')]"
    
    for attempt in range(2): # 실패 시 1회 새로고침 후 재발견 시도
        try:
            # 첫 접속 또는 이탈 시 목록 진입
            if "/workplaces" not in driver.current_url:
                driver.get(LIST_URL)
                time.sleep(3)

            # 최대 10세트까지 '다음' 버튼을 누르며 탐색
            for next_click_count in range(10): 
                try:
                    # 1. 목표 숫자가 화면에 있는지 확인
                    page_buttons = driver.find_elements(By.XPATH, target_xpath)
                    if page_buttons and page_buttons[0].is_displayed():
                        driver.execute_script("arguments[0].click();", page_buttons[0])
                        time.sleep(4)
                        
                        # [요구사항] 9페이지 도달 확인 로그
                        if page == 9:
                            print(f"\n★ 성공: 9페이지 진입 완료. 81번 게시물부터 수집 재개")
                        else:
                            print(f"  [→] 페이지 {page} 진입 성공")
                        return True
                except Exception:
                    pass
                
                # 2. 목표 숫자가 안 보이면 '다음(Next)' 클릭
                try:
                    next_btn = driver.find_element(By.XPATH, next_xpath)
                    print(f"  [i] 페이지 {page} 버튼 미발견 -> '다음' 버튼 클릭 (시도 {next_click_count+1})")
                    driver.execute_script("arguments[0].click();", next_btn)
                    time.sleep(3) # 클릭 후 3초 대기 (사용자 요구사항)
                    # 목록 로딩 확인
                    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CSS_SELECTOR, "td[onclick]")))
                except (NoSuchElementException, TimeoutException):
                    print(f"  [!] {page}번 페이지를 찾는 중 '다음' 버튼이 더 이상 없거나 로딩 지연")
                    break
            
            # 실패 시 새로고침(F5) 및 대기 후 재시도
            print(f"  [↺] {attempt+1}차 탐색 실패 -> 새로고침 후 재시도 (5초 대기)")
            driver.refresh()
            time.sleep(5)

        except Exception as e:
            print(f"  [!] 이동 중 오류 발생: {e}")
            time.sleep(3)

    return False



def ensure_on_list_page(driver: webdriver.Chrome, page: int):
    """
    상세 페이지에서 돌아왔을 때 목록 상태를 확인하고, 
    만약 1페이지로 튕겼다면 목표 페이지로 다시 이동시키는 핵심 복구 함수.
    """
    try:
        # 1. 목록 데이터가 로드되었는지 확인
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "td[onclick]"))
        )
        
        # 2. 현재 작업 중인 페이지 번호가 활성화(['active']) 되어 있는지 체크
        try:
            active_page = driver.find_element(By.XPATH, "//li[contains(@class, 'active')]//a")
            if active_page.text.strip() == str(page):
                return # 정상 위치
            else:
                print(f"  [!] 현재 위치({active_page.text})가 목표 페이지({page})와 다름 → 복구 이동")
        except NoSuchElementException:
            print(f"  [!] 현재 위치 확인 불가 → 페이지 {page}로 복구 이동 시작")
        
        move_to_page(driver, page)

    except TimeoutException:
        print(f"  [i] 목록 복귀 실패(타임아웃) → 목록 페이지로 강제 재진입 중...")
        move_to_page(driver, page)


# ── 게시글 목록 수집 (목록 페이지에서만, URL 이동 없음) ─────────────────────

def collect_posts_on_current_page(driver: webdriver.Chrome) -> list[dict]:
    """
    현재 열린 목록 페이지에서 td[onclick^='post'] 요소를 분석해
    post_id / title 목록을 반환. 페이지 이동 없음.
    """
    posts    = []
    seen_ids = set()

    cells = driver.find_elements(By.CSS_SELECTOR, "td[onclick^='post']")
    for cell in cells:
        try:
            onclick_val = cell.get_attribute("onclick") or ""
            post_id     = extract_post_id(onclick_val)
            if not post_id or post_id in seen_ids:
                continue
            seen_ids.add(post_id)

            # 제목 추출: 같은 tr 중 숫자·날짜 아닌 가장 긴 텍스트
            row  = cell.find_element(By.XPATH, "./parent::tr")
            tds  = row.find_elements(By.TAG_NAME, "td")
            cands = [
                td.text.strip() for td in tds
                if td.text.strip() and not re.fullmatch(r"[\d\-./\s]+", td.text.strip())
            ]
            title = max(cands, key=len) if cands else f"post_{post_id}"

            posts.append({"title": title, "id": post_id, "onclick": onclick_val})
        except StaleElementReferenceException:
            continue

    return posts


# ── 엑셀 버튼 탐색 (이중 fallback) ───────────────────────────────────────────

def find_excel_button(driver: webdriver.Chrome):
    """
    상세 페이지에서 '엑셀로 받기' 버튼을 탐색.
    클릭 전 2초 대기 후 이중 fallback 로 탐색.
    1순위: a[href='/download-excel']  (BTN_TIMEOUT 대기)
    2순위: 텍스트에 '엑셀' 포함된 a/button  (3초 추가)
    반환: WebElement 또는 None
    """
    # 페이지 콘텐츠가 완전히 바뀌는 시간 확보
    time.sleep(2)

    # 1순위: href 기반
    try:
        btn = WebDriverWait(driver, BTN_TIMEOUT).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR,
                 "a.navbar-second[href='/download-excel'], a[href='/download-excel']")
            )
        )
        # 추가 검증: 실제 DOM에 attached 되어 있는지
        driver.execute_script("return arguments[0].offsetParent !== null;", btn)
        return btn
    except TimeoutException:
        pass

    # 2순위: 텍스트 fallback
    try:
        btn = WebDriverWait(driver, 3).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//a[contains(.,'엑셀')] | //button[contains(.,'엑셀')]")
            )
        )
        print("  [i] fallback: 텍스트 기반 엑셀 버튼 탐색 성공")
        return btn
    except TimeoutException:
        return None


def find_group_order_button(driver: webdriver.Chrome):
    """
    '엑셀로 받기' 클릭 후 나타나는 보조 선택 화면에서
    '부서 및 공정별로' 버튼을 탐색.
    대상: <a href="/excel/workplace?order=group" class="btn btn-default">부서 및 공정별로</a>

    1순위: href 에 order=group 포함
    2순위: 텍스트에 '부서 및 공정별로' 포함
    최대 5초 대기, 없으면 None 반환.
    """
    # 1순위: href 기반
    try:
        return WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "a[href*='order=group']")
            )
        )
    except TimeoutException:
        pass

    # 2순위: 텍스트 fallback
    try:
        return WebDriverWait(driver, 2).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//a[contains(.,'부서 및 공정별로')] | //button[contains(.,'부서 및 공정별로')]")
            )
        )
    except TimeoutException:
        return None


# ── 핵심: 클릭 → 다운로드 → URL 직접 복귀 ───────────────────────────────────

def click_and_download(driver: webdriver.Chrome, post: dict, page: int) -> bool:
    """
    목록 페이지에서 post_id 에 해당하는 td 를 직접 click() 해서 상세 진입.
    - 엑셀 버튼 JS click 후 driver.back() 으로 목록 복귀
    - 주소 직접 이동 금지 (URL?page=n 사용 안 함)
    - 성공 True / 실패 False
    """
    title    = post["title"]
    post_id  = post["id"]

    # ── 헬퍼: 목록 상태 점검 및 복귀 ─────────────────────────────────────────
    def return_to_list(reason: str = "") -> bool:
        if reason:
            print(f"  [i] {reason} → 목록 복귀 중")
        try:
            driver.back()
            time.sleep(3)
            ensure_on_list_page(driver, page) # 작업 중이던 페이지로 확실 복구
            rand_sleep()
        except Exception:
            pass
        return False

    if already_downloaded(post_id):
        print(f"  [SKIP] {title[:40]} ({post_id})")
        return True

    # ── 1. 목록에서 td 재탐색 ────────────────────────────────────────────────
    try:
        cell = WebDriverWait(driver, WAIT_TIMEOUT).until(
            EC.element_to_be_clickable(
                (By.XPATH, f"//td[contains(@onclick,'/{post_id}')]")
            )
        )
    except TimeoutException:
        return return_to_list(f"td 없음 (post_id={post_id})")

    # ── 2. 스크롤 후 JS 클릭 → 상세 진입 ──────────────────────────────────────
    try:
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", cell)
        time.sleep(0.3)
        driver.execute_script("arguments[0].click();", cell) # [변경] JS 클릭
        print(f"  [→] 클릭: {title[:40]} ({post_id})")
    except Exception as e:
        return return_to_list(f"클릭 실패: {e}")

    # ── 3. 상세 페이지 끝까지 스크롤 후 엑셀 버튼 탐색 ─────────────────────
    try:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(0.5)
    except Exception:
        pass

    excel_btn = find_excel_button(driver)   # 내부에서 2초 추가 대기 포함

    # ── 데이터 없음 케이스: 버튼 미존재 → 로그 후 즉시 목록 복귀 ──────────
    if excel_btn is None:
        print(f"  [⚠] 데이터 없음 (엑셀 버튼 미존재): {title[:40]}")
        return return_to_list()

    # ── 4. 다운로드: JS click + 파일 개수 증가 감시 (최대 20초) ─────────────
    success = False
    for attempt in range(1, DOWNLOAD_RETRY + 1):
        try:
            driver.execute_script(
                "arguments[0].scrollIntoView({block:'center'});", excel_btn
            )
            time.sleep(0.3)

            # 클릭 전 파일 개수 스냅샷
            before_count = take_file_snapshot()

            # ── Step 1: '엑셀로 받기' 클릭 ─────────────────────────────
            driver.execute_script("arguments[0].click();", excel_btn)
            print(f"  [↓] '엑셀로 받기' 클릭 (시도 {attempt}/{DOWNLOAD_RETRY})")

            # ── Step 2: '부서 및 공정별로' 버튼 탐색 후 클릭 ────────────
            group_btn = find_group_order_button(driver)
            if group_btn is None:
                print(f"  [!] '부서 및 공정별로' 버튼 없음 — 이 게시글은 다운로드 불가")
                break  # 재시도 없이 종료

            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", group_btn)
            time.sleep(0.3)

            # 파일 감시는 이 클릭 직전에 스냅샷 (진짜 다운로드 트리거)
            before_count = take_file_snapshot()
            driver.execute_script("arguments[0].click();", group_btn)
            print(f"  [↓] '부서 및 공정별로' 클릭 → 다운로드 시작")

            # ── Step 3: 파일 개수가 늘어날 때까지 최대 20초 대기 ────────
            new_file = wait_for_new_file(before_count, timeout=20)
            if new_file:
                renamed = rename_file(new_file, title, post_id)
                print(f"  [✓] 저장: {renamed.name}")
                success = True
                break
            else:
                print(f"  [!] 파일 미감지 (시도 {attempt}/{DOWNLOAD_RETRY})")
                if attempt < DOWNLOAD_RETRY:
                    excel_btn = find_excel_button(driver)
                    if excel_btn is None:
                        print("  [!] 재시도 중 버튼 소멸")
                        break
        except Exception as e:
            print(f"  [!] 다운로드 오류 (시도 {attempt}): {e}")
            break

    # ── 5. 목록 복귀 및 상태 점검 ──────────────────────────────────────────
    try:
        driver.back()
        time.sleep(3)
        ensure_on_list_page(driver, page) # 작업 중이던 페이지로 확실 복구
        rand_sleep()
    except Exception as e:
        print(f"  [!] 목록 복귀 오류: {e}")

    return success


# ── 파일명 3단 분리 ───────────────────────────────────────────────────────────

def parse_filename_parts(filename: str) -> tuple[str, str, str]:
    """
    파일명(확장자 포함 가능)을 A/B/C 세 컬럼으로 분리.

    파일명 형식 예:
        '임상의학연구센터 317호(소아과학교실)[신정은교수님](+)_19503.xlsx'
        '의과대학 402~208호 (생리학교실)..._19437.xlsx'

    반환: (A.단위작업장소, B.호실번호, C.상세정보)

    예외 처리:
        - 첫 번째 공백 없음  → B열에 전체, A·C 는 빈 문자열
        - '호' 없음          → B열에 공백 이후 전체, C 는 빈 문자열 + 로그 출력
    """
    stem = Path(filename).stem                 # 확장자 제거
    base = re.sub(r'_\d+$', '', stem).strip()  # 끝의 _postid 제거

    # A열: 첫 번째 공백 이전
    space_idx = base.find(' ')
    if space_idx == -1:
        return ('', base, '')

    unit_place = base[:space_idx]
    rest       = base[space_idx + 1:]

    # B열: 첫 번째 '호' 까지 (포함)
    ho_idx = rest.find('호')
    if ho_idx == -1:
        print(f"  [parse] '호' 미발견, B열에 원본 사용: {filename}")
        return (unit_place, rest, '')

    room   = rest[:ho_idx + 1]          # B열
    detail = rest[ho_idx + 1:].strip()  # C열

    return (unit_place, room, detail)


# ── 엑셀 파일 병합 ────────────────────────────────────────────────────────────

def merge_excel_files():
    """
    msds_files/ 내 모든 엑셀 파일을 하나로 병합.
    파일명을 분석해 맨 앞에 A/B/C 세 컬럼 삽입:
        A열 = 단위작업장소
        B열 = 호실번호
        C열 = 상세정보 (교실명 등)
    """
    files = list(DOWNLOAD_DIR.glob("*.xlsx")) + list(DOWNLOAD_DIR.glob("*.xls"))
    if not files:
        print("[!] 병합할 파일 없음")
        return

    print(f"\n[*] 병합 시작 — {len(files)}개 파일")
    dfs, failed = [], []

    for i, f in enumerate(files, 1):
        try:
            df = pd.read_excel(f, sheet_name=0, header=0, dtype=str)
            df.dropna(how="all", inplace=True)

            # ── 파일명 3단 분리 ──────────────────────────────────────────
            unit_place, room, detail = parse_filename_parts(f.name)

            # 맨 앞에 A/B/C 삽입 (기존 컬럼은 뒤로 밀림)
            df.insert(0, 'C.상세정보',       detail)
            df.insert(0, 'B.호실번호',       room)
            df.insert(0, 'A.단위작업장소',   unit_place)

            # 출처 보조열 (맨 뒤)
            df['다운로드원본파일명'] = f.name

            dfs.append(df)
            print(f"  [{i:4d}/{len(files)}] {f.name}")
            print(f"           A={unit_place!r}  B={room!r}  C={detail[:30]!r}  → {len(df)}행")

        except Exception as e:
            print(f"  [!] 읽기 실패: {f.name} — {e}")
            failed.append(f.name)

    if not dfs:
        print("[!] 병합할 데이터 없음")
        return

    master = pd.concat(dfs, ignore_index=True)
    master.to_excel(MASTER_FILE, index=False, engine="openpyxl")
    print(f"\n[✓] 병합 완료 → {MASTER_FILE}")
    print(f"    총 {len(master):,}행 / {len(master.columns)}열")
    print(f"    컬럼 순서: A.단위작업장소 | B.호실번호 | C.상세정보 | ... | 다운로드원본파일명")
    if failed:
        print(f"    실패 파일 {len(failed)}개: {failed}")


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  toxfree.kr 엑셀 일괄 다운로드 (클릭 방식)")
    print("=" * 60)
    print(f"  목록 URL : {LIST_URL}")
    print(f"  동작 방식: td 직접 클릭 → 다운로드 → 뒤로가기")
    print("=" * 60)

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[✓] 다운로드 폴더: {DOWNLOAD_DIR.resolve()}")

    headless = input("\nHeadless(백그라운드) 모드? [y/N]: ").strip().lower() == "y"
    print(f"[*] Headless: {'ON' if headless else 'OFF'}")

    print()
    user_id  = input("toxfree.kr 아이디(이메일): ").strip()
    password = getpass.getpass("비밀번호 (입력 내용 숨김): ")

    start_page_input = input(f"\n시작 페이지 번호 [기본값 1]: ").strip()
    start_page = int(start_page_input) if start_page_input.isdigit() else 1

    print("\n[*] Chrome 드라이버 시작 중...")
    try:
        driver = build_driver(headless)
    except WebDriverException as e:
        print(f"[ERROR] ChromeDriver 초기화 실패: {e}")
        sys.exit(1)

    total_success = 0
    total_skip    = 0
    total_fail    = 0
    reconnect_cnt = 0
    
    # [최종] 기존 수집된 파일 개수를 파악하여 113개 도달 시 종료하도록 설정
    existing_files = list(DOWNLOAD_DIR.glob("*.xlsx")) + list(DOWNLOAD_DIR.glob("*.xls"))
    total_processed_count = len(existing_files)
    
    # 101개 스킵 처리된 것으로 간주 (사용자 보고 기준)
    print(f"  [i] 현재 로컬에 {total_processed_count}개의 파일이 확인됩니다. (목표: 113개)")

    try:
        login(driver, user_id, password)

        empty_streak = 0

        print(f"\n[*] {start_page}페이지부터 12페이지까지 남은 {113 - total_processed_count}개 수집 시작")
        print(f"    종료 조건: 12페이지 완료 또는 전체 113개 게시물 달성\n")

        for page in range(start_page, 13):
            if total_processed_count >= 113:
                break

            print(f"\n{'─'*55}")
            print(f"  📄 페이지 {page}")
            print(f"{'─'*55}")

            try:
                # [변경] 징검다리 함수 move_to_page 호출
                ok = move_to_page(driver, page)
                reconnect_cnt = 0
            except WebDriverException as e:
                print(f"  [!] 연결 오류: {e}")
                if reconnect_cnt >= MAX_RECONNECT:
                    print("  [X] 재연결 초과 → 중단")
                    break
                reconnect_cnt += 1
                print(f"  [↺] {reconnect_cnt}/{MAX_RECONNECT}회 재연결 (30초 대기)...")
                time.sleep(30)
                try:
                    driver.quit()
                except Exception:
                    pass
                driver = build_driver(headless)
                login(driver, user_id, password)
                print(f"  [✓] 재연결 성공 → 페이지 {page} 재시도")
                ok = move_to_page(driver, page)
                if not ok: continue

            if not ok:
                empty_streak += 1
                if empty_streak >= MAX_EMPTY_PAGES:
                    print(f"  [✓] 연속 실패로 인한 종료")
                    break
                continue

            # ── 현재 페이지 게시글 수집 ──────────────────────────────────
            posts = collect_posts_on_current_page(driver)

            if not posts:
                empty_streak += 1
                print(f"  [!] 게시글 없음 (연속 {empty_streak}/{MAX_EMPTY_PAGES})")
                if empty_streak >= MAX_EMPTY_PAGES:
                    print(f"  [✓] 연속 빈 페이지로 인한 종료")
                    break
                continue

            empty_streak = 0
            print(f"  게시글 {len(posts)}개 발견")

            # ── 게시글별 처리 ─────────────────────────────────────────────
            for idx, post in enumerate(posts, 1):
                if total_processed_count >= 113:
                    print("\n  [✓] 수집된 게시글 수가 113개에 도달하여 수집 푸프를 빠져나옵니다.")
                    break
                total_processed_count += 1
                
                title   = post["title"]
                post_id = post["id"]

                print(f"\n  [{idx:2d}/{len(posts)}] {title[:45]}")

                # ── 예외: 1페이지 1번 무조건 스킵 ─────────────────────────
                if page == 1 and idx == 1:
                    print(f"  [SKIP] 강제 예외 지정 (1페이지 1번째 데이터 제외)")
                    total_skip += 1
                    continue

                if already_downloaded(post_id):
                    # [요구사항] 게시글 고유 번호(ID) 기준으로 중복 방지 (이미 폴더에 이 ID가 있으면 스킵)
                    print(f"  [SKIP] 엑셀 이미 존재 (고유 번호 ID: {post_id})")
                    total_skip += 1
                    continue

                if is_blacklisted(post_id):
                    print(f"  [SKIP] 블랙리스트 (이전 실패 기록) ({post_id})")
                    total_skip += 1
                    continue

                try:
                    ensure_on_list_page(driver, page)
                except WebDriverException:
                    # 목록 재이동 실패 시 직접 이동
                    move_to_page(driver, page)

                # 클릭 → 다운로드 → 뒤로가기
                try:
                    success = click_and_download(driver, post, page)
                except WebDriverException as e:
                    print(f"  [!] 연결 오류 (게시글 처리 중): {e}")
                    if reconnect_cnt >= MAX_RECONNECT:
                        print("  [X] 재연결 초과 → 중단")
                        raise
                    reconnect_cnt += 1
                    print(f"  [↺] {reconnect_cnt}/{MAX_RECONNECT}회 재연결 (30초 대기)...")
                    time.sleep(30)
                    try:
                        driver.quit()
                    except Exception:
                        pass
                    driver = build_driver(headless)
                    login(driver, user_id, password)
                    ensure_on_list_page(driver, page)
                    try:
                        success = click_and_download(driver, post, page)
                    except Exception:
                        success = False

                if success:
                    total_success += 1
                else:
                    total_fail += 1
                    # 실패 시 블랙리스트 추가 (다음 실행/순번에 다시 시도 안 함)
                    add_blacklist(post_id)

            if total_processed_count >= 113:
                print("\n  [✓] 총 수집된 게시글 수가 113개에 도달하여 전체 작업을 종료합니다.")
                break

            rand_sleep()

    except KeyboardInterrupt:
        print("\n\n[!] 사용자 중단")
        print(f"    성공: {total_success}, 스킵: {total_skip}, 실패: {total_fail}")
    except Exception as e:
        import traceback
        print(f"\n[ERROR] {e}")
        traceback.print_exc()
    finally:
        try:
            driver.quit()
        except Exception:
            pass
        print("\n[*] 브라우저 종료")

    # ── 최종 요약 ─────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"  다운로드 완료 요약")
    print(f"{'='*60}")
    print(f"  ✓ 성공  : {total_success}개")
    print(f"  → 스킵  : {total_skip}개  (이미 존재)")
    print(f"  ✗ 실패  : {total_fail}개")
    dl_files = list(DOWNLOAD_DIR.glob("*.xlsx")) + list(DOWNLOAD_DIR.glob("*.xls"))
    print(f"  폴더 내 : {len(dl_files)}개")

    if dl_files:
        print("\n[*] 다운로드가 완료되어 모든 엑셀 파일을 즉시 병합합니다.")
        merge_excel_files()
        
        # [최종 결과 보고]
        if len(dl_files) >= 113:
            print(f"\n{'★'*30}")
            print(f"★ 축하합니다! 총 113개 데이터 수집 및 엑셀 병합 완료")
            print(f"★ 최종 파일 경로: {MASTER_FILE.resolve()}")
            print(f"{'★'*30}")
    else:
        print("\n[!] 다운로드된 파일이 없어 병합을 건너뜁니다.")

    print("\n[✓] 모든 작업이 성공적으로 종료되었습니다.")


if __name__ == "__main__":
    main()
