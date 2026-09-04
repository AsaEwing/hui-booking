import { json, handleOptions, requireUser, getActiveProject } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    const s = await requireUser(request, env.DB);
    if (!s) return json({ error: '請先登入' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { prefs } = body;
    if (!Array.isArray(prefs) || prefs.length !== 5) return json({ error: '請填寫 5 個志願' }, 400);

    const project = await getActiveProject(env.DB);
    if (!project) return json({ error: '目前沒有進行中的專案' }, 400);

    const nums = prefs.map(Number);
    if (nums.some(n => !Number.isInteger(n) || n < 1 || n > project.wall_count)) {
        return json({ error: `志願編號需在 1–${project.wall_count} 之間` }, 400);
    }
    if (new Set(nums).size !== 5) return json({ error: '志願不可重複' }, 400);

    const now = Math.floor(Date.now() / 1000);
    const existing = await env.DB.prepare(
        'SELECT id FROM submissions WHERE user_id=? AND project_id=?'
    ).bind(s.user_id, project.id).first();

    if (existing) {
        await env.DB.prepare(
            'UPDATE submissions SET pref1=?,pref2=?,pref3=?,pref4=?,pref5=?,submitted_at=? WHERE user_id=? AND project_id=?'
        ).bind(...nums, now, s.user_id, project.id).run();
    } else {
        await env.DB.prepare(
            'INSERT INTO submissions (project_id,user_id,pref1,pref2,pref3,pref4,pref5,submitted_at) VALUES (?,?,?,?,?,?,?,?)'
        ).bind(project.id, s.user_id, ...nums, now).run();
    }

    return json({ ok: true });
}
