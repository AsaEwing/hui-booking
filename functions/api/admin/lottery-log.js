import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    const url = new URL(request.url);
    const projectId = parseInt(url.searchParams.get('projectId'));
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    const project = await env.DB.prepare('SELECT id, name FROM projects WHERE id=?').bind(projectId).first();
    if (!project) return json({ error: '專案不存在' }, 404);

    const draw = await env.DB.prepare(
        'SELECT id, seed, drawn_at, drawn_by_role, submissions_snapshot, results_snapshot FROM lottery_draws WHERE project_id=?'
    ).bind(projectId).first();

    return json({
        project: { id: project.id, name: project.name },
        draw: draw ? {
            id: draw.id,
            seed: draw.seed,
            drawnAt: draw.drawn_at,
            drawnByRole: draw.drawn_by_role,
            submissions: JSON.parse(draw.submissions_snapshot),
            results: JSON.parse(draw.results_snapshot),
        } : null,
    });
}
