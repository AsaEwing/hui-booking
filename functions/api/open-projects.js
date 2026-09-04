import { json, handleOptions } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ env }) {
    const { results } = await env.DB.prepare(
        'SELECT id, name, floorplan_url, wall_count, pref_count, max_combo_size, open_at, close_at, drive_url FROM projects WHERE is_open=1 ORDER BY created_at DESC'
    ).all();
    return json({ projects: results });
}
