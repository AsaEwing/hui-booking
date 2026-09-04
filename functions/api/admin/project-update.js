import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId, name, floorplan_url, floorplan_data, floorplan_mime, walls } = body;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);
    if (!walls || Object.keys(walls).length === 0) return json({ error: '請標記至少一個展牆位置' }, 400);

    const finalUrl = floorplan_data
        ? `/api/project-image/${projectId}`
        : (floorplan_url || '/floorplan.jpg');

    if (floorplan_data) {
        await env.DB.prepare(
            'UPDATE projects SET name=?, floorplan_url=?, floorplan_data=?, floorplan_mime=?, walls_json=?, wall_count=? WHERE id=?'
        ).bind(name?.trim() || 'Untitled', finalUrl, floorplan_data, floorplan_mime || 'image/jpeg', JSON.stringify(walls), Object.keys(walls).length, projectId).run();
    } else {
        await env.DB.prepare(
            'UPDATE projects SET name=?, floorplan_url=?, walls_json=?, wall_count=? WHERE id=?'
        ).bind(name?.trim() || 'Untitled', finalUrl, JSON.stringify(walls), Object.keys(walls).length, projectId).run();
    }

    return json({ ok: true });
}
