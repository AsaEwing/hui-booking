import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

// 查看某專案所有手動調整的歷史紀錄（仿照「查看抽籤紀錄」），方便日後釐清某個位置
// 什麼時候、被誰、因為什麼原因調整過。
export async function onRequestGet({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    const url = new URL(request.url);
    const projectId = parseInt(url.searchParams.get('projectId'));
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    const project = await env.DB.prepare('SELECT id, name FROM projects WHERE id=?').bind(projectId).first();
    if (!project) return json({ error: '專案不存在' }, 404);

    const { results: rows } = await env.DB.prepare(
        'SELECT id, user_name, walls_json, assigned_by, assigned_at, reason FROM manual_assignments WHERE project_id=? ORDER BY assigned_at DESC, id DESC'
    ).bind(projectId).all();

    return json({
        project: { id: project.id, name: project.name },
        records: rows.map(r => ({
            id: r.id,
            userName: r.user_name,
            walls: JSON.parse(r.walls_json),
            assignedBy: r.assigned_by,
            assignedAt: r.assigned_at,
            reason: r.reason,
        })),
    });
}
