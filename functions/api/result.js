import { json, handleOptions, computeAllocation, computeRegistrations, getPrefGroups } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');

    let project;
    if (projectId) {
        project = await env.DB.prepare(
            'SELECT id, name, floorplan_url, walls_json, wall_count, pref_count, allocation_mode FROM projects WHERE id=?'
        ).bind(projectId).first();
    } else {
        const now = Math.floor(Date.now() / 1000);
        project = await env.DB.prepare(
            'SELECT id, name, floorplan_url, walls_json, wall_count, pref_count, allocation_mode FROM projects WHERE is_active=1 AND (active_until IS NULL OR active_until > ?) LIMIT 1'
        ).bind(now).first();
    }

    if (!project) return json({ error: 'no_active_project' }, 404);

    const { results: subs } = await env.DB.prepare(`
        SELECT u.name, s.pref1, s.pref2, s.pref3, s.pref4, s.pref5, s.prefs_json, s.submitted_at
        FROM submissions s JOIN users u ON u.id = s.user_id
        WHERE s.project_id = ?
    `).bind(project.id).all();

    const { results: allUsersRows } = await env.DB.prepare('SELECT name FROM users ORDER BY created_at').all();

    // 不論分配方式或是否已抽籤，這份資料一律代表「誰、提交了什麼」，跟分配結果分開
    const submissions = {};
    for (const sub of subs) {
        submissions[sub.name] = { prefGroups: getPrefGroups(sub), submitted_at: sub.submitted_at };
    }

    let taken = {}, results = {}, registrations = null, drawn = false, verification = null;

    if (project.allocation_mode === 'lottery') {
        const draw = await env.DB.prepare(
            'SELECT seed, drawn_at, drawn_by_role, submissions_snapshot, results_snapshot FROM lottery_draws WHERE project_id=?'
        ).bind(project.id).first();
        if (draw) {
            drawn = true;
            results = JSON.parse(draw.results_snapshot);
            for (const [name, r] of Object.entries(results)) {
                (r.walls || []).forEach(w => { taken[w] = name; });
            }
            // 公開的驗證資料：任何人（不需登入）都能下載去 verify-lottery.html 重新驗算
            verification = {
                seed: draw.seed,
                drawnAt: draw.drawn_at,
                drawnByRole: draw.drawn_by_role,
                submissions: JSON.parse(draw.submissions_snapshot),
                results,
            };
        } else {
            // 尚未抽籤：不顯示分配結果，只顯示每個位置目前有哪些人登記
            registrations = computeRegistrations(subs);
        }
    } else {
        ({ taken, results } = computeAllocation(subs));
    }

    return json({
        allocationMode: project.allocation_mode || 'time',
        drawn,
        taken,
        results,
        registrations,
        submissions,
        verification,
        allUsers: allUsersRows.map(u => u.name),
        project: {
            id: project.id,
            name: project.name,
            floorplan_url: project.floorplan_url,
            walls: JSON.parse(project.walls_json || '{}'),
            wall_count: project.wall_count,
            pref_count: project.pref_count || 5,
        },
    });
}
