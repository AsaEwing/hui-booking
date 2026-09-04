import { json, handleOptions, requireUser } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    const s = await requireUser(request, env.DB);
    if (!s) return json({ error: '請先登入' }, 401);

    const user = await env.DB.prepare('SELECT id, name FROM users WHERE id=?').bind(s.user_id).first();

    // 回傳所有開放專案的提交記錄，key 為 project_id
    const { results: subs } = await env.DB.prepare(`
        SELECT s.*, p.is_open FROM submissions s
        JOIN projects p ON p.id = s.project_id
        WHERE s.user_id=? AND p.is_open=1
    `).bind(s.user_id).all();

    const submissions = {};
    for (const sub of subs) {
        submissions[sub.project_id] = sub;
    }

    return json({ user, submissions });
}
