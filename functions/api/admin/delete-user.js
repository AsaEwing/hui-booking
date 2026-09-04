import { json, handleOptions, requireSuperAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireSuperAdmin(request, env.DB)) return json({ error: '需要超級管理員權限' }, 403);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { userId } = body;
    if (!userId) return json({ error: '缺少 userId' }, 400);

    await env.DB.prepare('DELETE FROM submissions WHERE user_id=?').bind(userId).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();
    await env.DB.prepare('DELETE FROM users WHERE id=?').bind(userId).run();

    return json({ ok: true });
}
