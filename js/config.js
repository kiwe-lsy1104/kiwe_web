// config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(
    'https://jztrnwchgxymknjvsbkl.supabase.co',
    'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33'
);

export function getSessionUser() {
    const userStr = localStorage.getItem('kiwe_user');
    return userStr ? JSON.parse(userStr) : null;
}

export function checkAuth() {
    const user = getSessionUser();
    if (!user && !window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}
