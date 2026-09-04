import { json, handleOptions, getActiveProject } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ env }) {
    const p = await env.DB.prepare(
        'SELECT id, name, floorplan_url, walls_json, wall_count, open_at, close_at FROM projects WHERE is_active=1 LIMIT 1'
    ).first();
    if (!p) return json({ error: 'no_active_project' }, 404);
    return json({ ...p, walls: JSON.parse(p.walls_json || '{}') });
}
