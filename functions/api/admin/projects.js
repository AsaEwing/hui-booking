import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);
    const { results } = await env.DB.prepare(
        'SELECT id, name, floorplan_url, walls_json, wall_count, is_active, created_at FROM projects ORDER BY created_at DESC'
    ).all();
    return json({ projects: results });
}

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { name, floorplan_url, walls } = body;
    if (!name?.trim()) return json({ error: '請輸入專案名稱' }, 400);
    if (!walls || Object.keys(walls).length === 0) return json({ error: '請標記至少一個展牆位置' }, 400);

    const now = Math.floor(Date.now() / 1000);
    const result = await env.DB.prepare(
        'INSERT INTO projects (name, floorplan_url, walls_json, wall_count, is_active, created_at) VALUES (?,?,?,?,0,?)'
    ).bind(name.trim(), floorplan_url || '/floorplan.jpg', JSON.stringify(walls), Object.keys(walls).length, now).run();

    return json({ ok: true, id: result.meta.last_row_id });
}
