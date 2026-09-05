import { json, handleOptions, requireSuperAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireSuperAdmin(request, env.DB)) return json({ error: '需要超級管理員權限' }, 403);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId } = body;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    await env.DB.prepare('DELETE FROM submissions WHERE project_id=?').bind(projectId).run();
    await env.DB.prepare('DELETE FROM lottery_draws WHERE project_id=?').bind(projectId).run();
    await env.DB.prepare('DELETE FROM projects WHERE id=?').bind(projectId).run();

    return json({ ok: true });
}
