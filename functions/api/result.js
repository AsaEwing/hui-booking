import { json, handleOptions, computeAllocation, getActiveProject } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ env }) {
    const project = await getActiveProject(env.DB);
    if (!project) return json({ error: 'no_active_project' }, 404);

    const { results: subs } = await env.DB.prepare(`
        SELECT u.name, s.pref1, s.pref2, s.pref3, s.pref4, s.pref5, s.submitted_at
        FROM submissions s JOIN users u ON u.id = s.user_id
        WHERE s.project_id = ?
    `).bind(project.id).all();

    const { results: allUsersRows } = await env.DB.prepare('SELECT name FROM users ORDER BY created_at').all();

    const { taken, results } = computeAllocation(subs);

    return json({
        taken,
        results,
        allUsers: allUsersRows.map(u => u.name),
        project: {
            id: project.id,
            name: project.name,
            floorplan_url: project.floorplan_url,
            walls: JSON.parse(project.walls_json || '{}'),
            wall_count: project.wall_count,
        },
    });
}
