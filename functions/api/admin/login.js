import { json, handleOptions, generateToken, hashPassword, getAdminSetting } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { password, role } = body;
    const isSuper = role === 'superadmin';
    const roleKey = isSuper ? 'superadmin' : 'admin';
    const hashKey = isSuper ? 'super_password_hash' : 'admin_password_hash';
    const envKey  = isSuper ? env.SUPER_PASSWORD : env.ADMIN_PASSWORD;

    if (!password) return json({ error: '請輸入密碼' }, 400);

    // 先查 DB，沒設定則 fallback 到 env var（明文比對）
    const storedHash = await getAdminSetting(env.DB, hashKey);
    let ok = false;
    if (storedHash) {
        const inputHash = await hashPassword(password, roleKey);
        ok = inputHash === storedHash;
    } else {
        if (!envKey) return json({ error: '密碼尚未設定，請洽超級管理員' }, 503);
        ok = password === envKey;
    }

    if (!ok) return json({ error: '密碼錯誤' }, 401);

    const token = await generateToken();
    await env.DB.prepare(
        'INSERT INTO sessions (token, user_id, role, created_at) VALUES (?, 0, ?, ?)'
    ).bind(token, roleKey, Math.floor(Date.now() / 1000)).run();

    return json({ token, role: roleKey });
}
