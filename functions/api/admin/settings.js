import { json, handleOptions, requireAdmin, requireSuperAdmin, getAdminSetting, hashPassword } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    const session = await requireAdmin(request, env.DB);
    if (!session) return json({ error: '未授權' }, 401);

    const adminEmail = await getAdminSetting(env.DB, 'admin_email', '');
    const superEmail = await getAdminSetting(env.DB, 'super_email', '');
    const adminHasCustomPw = !!(await getAdminSetting(env.DB, 'admin_password_hash'));
    const superHasCustomPw = !!(await getAdminSetting(env.DB, 'super_password_hash'));

    return json({ adminEmail, superEmail, adminHasCustomPw, superHasCustomPw, role: session.role });
}

export async function onRequestPost({ request, env }) {
    const session = await requireAdmin(request, env.DB);
    if (!session) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { action, currentPassword, newPassword, email, targetRole } = body;
    const myRole = session.role; // 'admin' | 'superadmin'

    // 只有 superadmin 可以修改 admin 的設定
    if (targetRole && targetRole !== myRole && myRole !== 'superadmin') {
        return json({ error: '無權限修改其他角色設定' }, 403);
    }
    const role = targetRole || myRole;
    const hashKey = role === 'superadmin' ? 'super_password_hash' : 'admin_password_hash';
    const emailKey = role === 'superadmin' ? 'super_email' : 'admin_email';
    const envPw = role === 'superadmin' ? env.SUPER_PASSWORD : env.ADMIN_PASSWORD;

    if (action === 'change_password') {
        if (!newPassword) return json({ error: '請輸入新密碼' }, 400);
        if (newPassword.length < 6 || !/[A-Za-z]/.test(newPassword)) return json({ error: '密碼至少 6 個字元，且須包含至少一個英文字母' }, 400);

        // superadmin 可以直接覆寫 admin 密碼，不需舊密碼
        const isSuperOverride = myRole === 'superadmin' && role === 'admin';
        if (!isSuperOverride) {
            if (!currentPassword) return json({ error: '請填寫目前密碼' }, 400);
            const storedHash = await getAdminSetting(env.DB, hashKey);
            let ok = false;
            if (storedHash) {
                ok = (await hashPassword(currentPassword, role)) === storedHash;
            } else {
                ok = currentPassword === envPw;
            }
            if (!ok) return json({ error: '目前密碼錯誤' }, 401);
        }

        const newHash = await hashPassword(newPassword, role);
        await env.DB.prepare(
            'INSERT INTO admin_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
        ).bind(hashKey, newHash).run();
        return json({ ok: true });
    }

    if (action === 'change_email') {
        if (!email?.includes('@')) return json({ error: '請輸入有效信箱' }, 400);
        await env.DB.prepare(
            'INSERT INTO admin_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
        ).bind(emailKey, email.trim()).run();
        return json({ ok: true });
    }

    return json({ error: '未知操作' }, 400);
}
