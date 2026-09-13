import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

// 設定學生在平面圖標記上顯示的「正式名稱」，覆蓋原本的帳號姓名（學生註冊時不強制
// 用本名）。留空字串代表清除覆蓋，改回顯示原本的帳號姓名。
export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { userId, displayName } = body;
    if (!userId) return json({ error: '缺少必要欄位' }, 400);

    const user = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(userId).first();
    if (!user) return json({ error: '找不到此學生' }, 404);

    const trimmed = (displayName || '').trim();
    await env.DB.prepare('UPDATE users SET display_name=? WHERE id=?').bind(trimmed || null, userId).run();

    return json({ ok: true, displayName: trimmed || null });
}
