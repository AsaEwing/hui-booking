import { json, handleOptions, requireAdmin, computeAllocation, computeRegistrations, getPrefGroups, getActiveProject } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    const url = new URL(request.url);
    const qProjectId = parseInt(url.searchParams.get('projectId'));

    let project;
    if (qProjectId) {
        const row = await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(qProjectId).first();
        project = row;
    } else {
        project = await getActiveProject(env.DB);
    }
    const projectId = project?.id || 1;

    const { results: users } = await env.DB.prepare(
        'SELECT id, name, created_at, no_password FROM users ORDER BY created_at'
    ).all();

    const { results: subs } = await env.DB.prepare(`
        SELECT u.name, s.pref1, s.pref2, s.pref3, s.pref4, s.pref5, s.prefs_json, s.submitted_at, s.user_id, s.note
        FROM submissions s JOIN users u ON u.id = s.user_id
        WHERE s.project_id = ?
    `).bind(projectId).all();

    // 不論分配方式或是否已抽籤，這份資料一律代表「誰、提交了什麼」，跟分配結果分開
    const submissions = {};
    for (const sub of subs) {
        submissions[sub.name] = { prefGroups: getPrefGroups(sub), submitted_at: sub.submitted_at, note: sub.note || '' };
    }

    let taken = {}, allocationResults = {}, registrations = null, drawn = false;

    if (project?.allocation_mode === 'lottery') {
        const draw = await env.DB.prepare('SELECT results_snapshot FROM lottery_draws WHERE project_id=?').bind(projectId).first();
        if (draw) {
            drawn = true;
            allocationResults = JSON.parse(draw.results_snapshot);
            for (const [name, r] of Object.entries(allocationResults)) {
                (r.walls || []).forEach(w => { taken[w] = name; });
            }
        } else {
            registrations = computeRegistrations(subs);
        }
    } else {
        ({ taken, results: allocationResults } = computeAllocation(subs));
    }

    return json({ users, submissions, taken, allocationResults, registrations, drawn, projectId, project });
}
