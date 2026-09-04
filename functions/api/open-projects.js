import { json, handleOptions } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ env }) {
    const { results } = await env.DB.prepare(
        'SELECT id, name, floorplan_url, wall_count, pref_count, max_combo_size, allocation_mode, lottery_rules_text, open_at, close_at, drive_url FROM projects WHERE is_open=1 ORDER BY created_at DESC'
    ).all();
    const { results: draws } = await env.DB.prepare('SELECT project_id, drawn_at FROM lottery_draws').all();
    const drawnMap = Object.fromEntries(draws.map(r => [r.project_id, r.drawn_at]));
    const projects = results.map(p => ({ ...p, drawn_at: drawnMap[p.id] || null }));
    return json({ projects });
}
