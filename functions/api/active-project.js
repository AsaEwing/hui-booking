import { json, handleOptions, getActiveProject } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ env }) {
    const p = await getActiveProject(env.DB);
    if (!p) return json({ error: 'no_active_project' }, 404);
    return json({ ...p, walls: JSON.parse(p.walls_json || '{}') });
}
