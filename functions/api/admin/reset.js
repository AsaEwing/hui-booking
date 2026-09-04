import { json, handleOptions, requireAdmin, getActiveProject } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { userId } = body;
    if (!userId) return json({ error: '缺少 userId' }, 400);

    const project = await getActiveProject(env.DB);
    const projectId = project?.id || 1;

    await env.DB.prepare(
        'DELETE FROM submissions WHERE user_id=? AND project_id=?'
    ).bind(userId, projectId).run();

    return json({ ok: true });
}
