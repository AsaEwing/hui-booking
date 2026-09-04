import { json, handleOptions, getActiveProject } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ env }) {
    const now = Math.floor(Date.now() / 1000);
    const p = await env.DB.prepare(
        'SELECT id, name, floorplan_url, walls_json, wall_count, open_at, close_at FROM projects WHERE is_active=1 AND (active_until IS NULL OR active_until > ?) LIMIT 1'
    ).bind(now).first();
    if (!p) return json({ error: 'no_active_project' }, 404);
    return json({ ...p, walls: JSON.parse(p.walls_json || '{}') });
}
