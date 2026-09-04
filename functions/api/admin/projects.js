import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);
    const { results } = await env.DB.prepare(
        'SELECT id, name, floorplan_url, walls_json, wall_count, is_active, is_open, open_at, close_at, pref_count, max_combo_size, drive_url, created_at FROM projects ORDER BY created_at DESC'
    ).all();
    return json({ projects: results });
}

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { name, floorplan_url, floorplan_data, floorplan_mime, walls, open_at, close_at, pref_count, max_combo_size, is_open, drive_url } = body;
    if (!name?.trim()) return json({ error: '請輸入專案名稱' }, 400);
    if (!walls || Object.keys(walls).length === 0) return json({ error: '請標記至少一個展牆位置' }, 400);

    const now = Math.floor(Date.now() / 1000);
    const pc = Math.max(1, Math.min(10, parseInt(pref_count) || 5));
    const mcs = Math.max(1, Math.min(10, parseInt(max_combo_size) || 1));
    const driveVal = drive_url?.trim() || null;
    const result = await env.DB.prepare(
        'INSERT INTO projects (name, floorplan_url, floorplan_data, floorplan_mime, walls_json, wall_count, open_at, close_at, pref_count, max_combo_size, is_open, is_active, drive_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?)'
    ).bind(name.trim(), floorplan_url || '/floorplan.jpg', floorplan_data || null, floorplan_mime || null, JSON.stringify(walls), Object.keys(walls).length, open_at || null, close_at || null, pc, mcs, is_open ? 1 : 0, driveVal, now).run();

    const newId = result.meta.last_row_id;
    // 若有上傳圖片，自動將 floorplan_url 指向 DB 圖片 endpoint
    if (floorplan_data) {
        await env.DB.prepare('UPDATE projects SET floorplan_url=? WHERE id=?')
            .bind(`/api/project-image/${newId}`, newId).run();
    }

    return json({ ok: true, id: newId });
}
