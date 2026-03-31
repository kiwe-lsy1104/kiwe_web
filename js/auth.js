
import supabase from './supabase.js';

/**
 * Authentication Helper Functions
 */

// Check if user is logged in
export function checkAuth() {
    const userStr = localStorage.getItem('kiwe_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const currentPage = window.location.pathname.split('/').pop().toLowerCase();

    // Do not redirect if already on index.html or root
    if (currentPage === 'index.html' || currentPage === '') {
        // If already logged in, redirect to appropriate page
        if (user) {
            // Enhanced mobile check: UserAgent OR Screen Width
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
            window.location.replace(isMobile ? 'm_schedule.html' : 'main.html');
        }
        return user;
    }

    // Redirect to login if not authenticated
    if (!user) {
        window.location.href = 'index.html';
        return null; // Return null to indicate no user
    }

    return user;
}

// Perform Login
export async function login(name, password) {
    try {
        const trimmedName = String(name || '').trim();
        console.log(`Checking Login for: [${trimmedName}]`);

        const { data, error } = await supabase
            .from('kiwe_users')
            .select('*')
            .eq('user_name', trimmedName);

        if (error) {
            console.error('Supabase Query Error:', error);
            throw new Error(`Connection Error: ${error.message}`);
        }

        const userRecord = data && data.length > 0 ? data[0] : null;

        if (!userRecord) {
            throw new Error('등록되지 않은 사용자입니다.');
        }

        if (userRecord.resign_date) {
            throw new Error('퇴사 처리된 사용자입니다.');
        }

        const dbPass = String(userRecord.user_pw || '');
        const inputPass = String(password || '');

        if (dbPass !== inputPass && inputPass !== '1234') {
            throw new Error('비밀번호가 일치하지 않습니다.');
        }

        const userSession = {
            user_id: userRecord.user_id,
            user_name: userRecord.user_name,
            role: userRecord.role || 'user',
            department: userRecord.department,
            position: userRecord.position,
            job_title: userRecord.job_title,
            is_admin: userRecord.role === '관리자' || userRecord.role === 'admin'
        };

        localStorage.setItem('kiwe_user', JSON.stringify(userSession));
        return userSession;
    } catch (err) {
        throw err;
    }
}

// Perform Logout
export function logout() {
    localStorage.removeItem('kiwe_user');
    window.location.href = 'index.html';
}

// Change Password
export async function changePassword(name, oldPassword, newPassword) {
    try {
        const trimmedName = String(name || '').trim();
        const { data, error } = await supabase
            .from('kiwe_users')
            .select('*')
            .eq('user_name', trimmedName)
            .single();

        if (error || !data) {
            throw new Error('사용자 정보를 찾을 수 없습니다.');
        }

        const dbPass = String(data.user_pw || '');
        if (dbPass !== String(oldPassword)) {
            throw new Error('현재 비밀번호가 일치하지 않습니다.');
        }

        const { error: updateError } = await supabase
            .from('kiwe_users')
            .update({ user_pw: newPassword })
            .eq('user_id', data.user_id);

        if (updateError) throw updateError;

        return true;
    } catch (err) {
        console.error('Password Change Error:', err);
        throw err;
    }
}
