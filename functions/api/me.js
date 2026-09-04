import { json, handleOptions, requireUser, getActiveProject } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    const s = await requireUser(request, env.DB);
    if (!s) return json({ error: '請先登入' }, 401);

    const user = await env.DB.prepare('SELECT id, name FROM users WHERE id=?').bind(s.user_id).first();

    const project = await getActiveProject(env.DB);
    const projectId = project?.id || 1;

    const submission = await env.DB.prepare(
        'SELECT * FROM submissions WHERE user_id=? AND project_id=?'
    ).bind(s.user_id, projectId).first();

    return json({ user, submission: submission || null });
}
