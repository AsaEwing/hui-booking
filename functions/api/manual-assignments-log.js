import { json, handleOptions } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

// 公開版的手動調整紀錄查詢（給 result.html 用），不需要登入。
// 跟後台版 /api/admin/manual-assignments-log 的差別：不回傳 assignedBy（操作者角色）
// 這種後台內部資訊，只回傳學生、位置、原因、時間，供同學核對自己/他人的位置調整原因。
export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const projectId = parseInt(url.searchParams.get('projectId'));
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    const project = await env.DB.prepare('SELECT id, name FROM projects WHERE id=?').bind(projectId).first();
    if (!project) return json({ error: '專案不存在' }, 404);

    const { results: rows } = await env.DB.prepare(
        'SELECT user_name, walls_json, assigned_at, reason FROM manual_assignments WHERE project_id=? ORDER BY assigned_at DESC, id DESC'
    ).bind(projectId).all();

    return json({
        records: rows.map(r => ({
            userName: r.user_name,
            walls: JSON.parse(r.walls_json),
            assignedAt: r.assigned_at,
            reason: r.reason,
        })),
    });
}
