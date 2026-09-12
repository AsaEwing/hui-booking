import { json, handleOptions, requireAdmin, computeAllocation, computeRegistrations, getPrefGroups, getActiveProject, applyManualAssignments } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    const url = new URL(request.url);
    const qProjectId = parseInt(url.searchParams.get('projectId'));

    let project;
    if (qProjectId) {
        // 明確列出欄位、排除 floorplan_data/floorplan_mime：前端只會用 floorplan_url 顯示圖片，
        // 這裡不需要圖片內容本身，SELECT * 會白白撈出大型 base64 資料
        const row = await env.DB.prepare(
            `SELECT id, name, floorplan_url, walls_json, wall_count, is_active, active_until,
                    max_combo_size, allocation_mode, lottery_rules_text, drive_url,
                    pref_count, is_open, open_at, close_at, created_at
             FROM projects WHERE id=?`
        ).bind(qProjectId).first();
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
            ({ results: allocationResults, taken } = await applyManualAssignments(env.DB, projectId, allocationResults));
        } else {
            registrations = computeRegistrations(subs);
        }
    } else {
        ({ taken, results: allocationResults } = computeAllocation(subs));
        ({ results: allocationResults, taken } = await applyManualAssignments(env.DB, projectId, allocationResults));
    }

    return json({ users, submissions, taken, allocationResults, registrations, drawn, projectId, project });
}
