import { json, handleOptions, requireSuperAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireSuperAdmin(request, env.DB)) return json({ error: '僅超級管理員可執行' }, 403);

    // 依序刪除：submissions → sessions（學生）→ users
    await env.DB.prepare('DELETE FROM submissions').run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id != 0').run();
    await env.DB.prepare('DELETE FROM users').run();

    return json({ ok: true });
}
