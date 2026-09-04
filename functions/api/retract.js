import { json, handleOptions, requireUser } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    const s = await requireUser(request, env.DB);
    if (!s) return json({ error: '請先登入' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId } = body;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    const project = await env.DB.prepare(
        'SELECT id, open_at, close_at, is_open, allocation_mode FROM projects WHERE id=?'
    ).bind(projectId).first();
    if (!project) return json({ error: '專案不存在' }, 404);
    if (!project.is_open) return json({ error: '此專案目前不開放操作' }, 403);

    const now = Math.floor(Date.now() / 1000);
    if (project.close_at && now > project.close_at) return json({ error: '志願填寫已截止，無法撤回' }, 403);

    if (project.allocation_mode === 'lottery') {
        const drawn = await env.DB.prepare('SELECT id FROM lottery_draws WHERE project_id=?').bind(project.id).first();
        if (drawn) return json({ error: '此專案已完成抽籤，無法撤回志願' }, 403);
    }

    await env.DB.prepare(
        'DELETE FROM submissions WHERE user_id=? AND project_id=?'
    ).bind(s.user_id, projectId).run();

    return json({ ok: true });
}
