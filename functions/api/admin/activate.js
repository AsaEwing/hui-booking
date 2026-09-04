import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId } = body;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    await env.DB.prepare('UPDATE projects SET is_active=0').run();
    await env.DB.prepare('UPDATE projects SET is_active=1 WHERE id=?').bind(projectId).run();

    return json({ ok: true });
}
