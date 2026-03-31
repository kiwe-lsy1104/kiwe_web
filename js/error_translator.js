(function() {
    const originalAlert = window.alert;
    window.alert = function(message) {
        if (typeof message !== 'string') {
            return originalAlert(message);
        }
        
        // Translate common database and network errors
        let translated = message;
        
        // Supabase / PostgreSQL Errors
        if (message.includes('duplicate key value violates unique constraint')) {
            if (message.includes('sample_id')) {
                translated = '저장 실패: 중복된 시료번호가 있습니다. 서로 다른 시료번호인지 연속된 번호인지 확인해주세요.';
            } else {
                translated = '저장 실패: 이미 존재하는 데이터입니다. 중복 여부를 확인해주세요.';
            }
            // Add specific replacement for "kiwe_sampling_2026_1_m_date_com_name_sample_id_key"
            translated = translated.replace(/kiwe_sampling_[a-zA-Z0-9_]+/g, '').trim();
        } else if (message.includes('violates foreign key constraint')) {
            translated = '저장 실패: 연관된 기존 데이터를 찾을 수 없습니다. (참조 오류)';
        } else if (message.includes('violates not-null constraint')) {
            translated = '저장 실패: 필수 입력 항목이 비어 있습니다.';
        } else if (message.includes('invalid input syntax')) {
            translated = '입력 오류: 잘못된 형식의 데이터가 포함되어 있습니다.';
        } else if (message.includes('permission denied')) {
            translated = '권한 오류: 해당 기능(테이블)에 접근할 권한이 없습니다.';
        } else if (message.includes('relationship')) {
            translated = '데이터베이스 구조 오류: 참조 관계를 찾을 수 없습니다.';
        } 
        // Network / Auth Errors
        else if (message.includes('Failed to fetch')) {
            translated = '통신 오류: 서버와 연결할 수 없습니다. 인터넷 상태를 확인해주세요.';
        } else if (message.includes('JWT') || message.includes('token') || message.includes('Auth session')) {
            translated = '인증 오류: 로그인 세션이 만료되었거나 유효하지 않습니다. 창을 새로고침하여 다시 로그인해주세요.';
        }

        // Only swap if it actually translated something or if we want to replace the original error string inside a composite string
        // Eg. "저장 중 오류: duplicate key value..." -> "저장 중 오류: 저장 실패: 중복된 시료번호가 있습니다..."
        if (translated !== message) {
            // If the original message was appended like "저장 실패: duplicate key...", we can just replace the English part
            // But since `message` might contain both Korean and English, let's just use our translated string cleanly.
            // Or replace ONLY the English part if it has Korean prefixes
            if (message.match(/[가-힣]/)) {
                // It has Korean, maybe it's "삭제 실패: duplicate key..."
                // We'll replace the english error substring with our translation
                const englishPartMatch = message.match(/[a-zA-Z0-9_ :"-]+/g);
                if (englishPartMatch) {
                    // This is a bit risky to replace blindly, let's just append or replace the known strings
                    if (message.includes('duplicate key')) translated = message.replace(/duplicate key value violates unique constraint.*/, '이미 존재하는 데이터입니다 (중복).');
                    // We'll fall back to returning our predefined messages which overrides it nicely if it's very specific 
                }
            } 
            
            // Safer robust replacement:
            translated = message;
            translated = translated.replace(/duplicate key value violates unique constraint "[^"]+"/g, '이미 존재하는 데이터입니다 (중복 오류)');
            translated = translated.replace(/duplicate key value violates unique constraint/g, '이미 존재하는 데이터입니다 (중복 오류)');
            translated = translated.replace(/violates foreign key constraint/g, '참조 데이터를 찾을 수 없습니다');
            translated = translated.replace(/violates not-null constraint/g, '필수 항목 누락');
            translated = translated.replace(/invalid input syntax/g, '잘못된 입력 형식');
            translated = translated.replace(/permission denied.*$/g, '접근 권한이 없습니다.');
            translated = translated.replace(/Failed to fetch/g, '서버 응답 없음 (네트워크 연결 확인)');
            translated = translated.replace(/relation "[^"]+" does not exist/g, '데이터베이스 테이블을 찾을 수 없습니다');
            
            // For the specific sample_id key violation mentioned by user
            if (translated.includes('kiwe_sampling_') && translated.includes('sample_id_key')) {
                translated = translated.replace(/이미 존재하는 데이터입니다 \(중복 오류\)/, '이미 동일한 측정일자, 사업장명에 등록된 시료번호가 존재합니다. 시료번호가 중복되지 않도록 확인해주세요.');
                translated = translated.replace(/kiwe_sampling_[a-zA-Z0-9_]+_sample_id_key/g, ''); // Clean up the key name
            }
            
            return originalAlert(translated.replace(/([:：]\s*)$/, '')); // strip trailing colon if any
        }
        
        return originalAlert(message);
    };
})();
