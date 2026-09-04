import { json, handleOptions, requireAdmin, hashPassword } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { userId, newPassword } = body;
    if (!userId || !newPassword) return json({ error: '缺少必要欄位' }, 400);
    if (newPassword.length < 3) return json({ error: '密碼至少 3 個字元' }, 400);

    const user = await env.DB.prepare('SELECT name FROM users WHERE id=?').bind(userId).first();
    if (!user) return json({ error: '找不到此學生' }, 404);

    const hash = await hashPassword(newPassword, user.name);
    await env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(hash, userId).run();
    // 登出該學生的所有 session
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();

    return json({ ok: true });
}
