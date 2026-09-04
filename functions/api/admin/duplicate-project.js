import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId } = body;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    const proj = await env.DB.prepare(
        'SELECT name, floorplan_url, floorplan_data, floorplan_mime, walls_json, wall_count, pref_count, max_combo_size, drive_url FROM projects WHERE id=?'
    ).bind(projectId).first();
    if (!proj) return json({ error: '專案不存在' }, 404);

    const newName = proj.name.endsWith('（複製）') ? proj.name : `${proj.name}（複製）`;
    const now = Math.floor(Date.now() / 1000);

    const result = await env.DB.prepare(
        'INSERT INTO projects (name, floorplan_url, floorplan_data, floorplan_mime, walls_json, wall_count, pref_count, max_combo_size, drive_url, is_open, is_active, open_at, close_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,0,0,NULL,NULL,?)'
    ).bind(newName, proj.floorplan_url, proj.floorplan_data || null, proj.floorplan_mime || null, proj.walls_json, proj.wall_count, proj.pref_count || 5, proj.max_combo_size || 1, proj.drive_url || null, now).run();

    const newId = result.meta.last_row_id;
    if (proj.floorplan_data) {
        await env.DB.prepare('UPDATE projects SET floorplan_url=? WHERE id=?')
            .bind(`/api/project-image/${newId}`, newId).run();
    }

    return json({ ok: true, id: newId });
}
