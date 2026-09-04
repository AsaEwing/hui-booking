import { json, handleOptions, generateToken } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    if (!env.ADMIN_PASSWORD) return json({ error: '管理員密碼尚未設定' }, 503);
    if (body.password !== env.ADMIN_PASSWORD) return json({ error: '密碼錯誤' }, 401);

    const token = generateToken();
    await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
        .bind(token, 0, Math.floor(Date.now() / 1000)).run();

    return json({ token });
}
