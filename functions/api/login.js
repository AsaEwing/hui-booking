import { json, handleOptions, hashPassword, generateToken } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const name = (body.name || '').trim();
    const password = (body.password || '').trim();
    if (!name) return json({ error: '請輸入姓名' }, 400);

    const user = await env.DB.prepare('SELECT id, name, password_hash, no_password FROM users WHERE name = ?')
        .bind(name).first();
    if (!user) return json({ error: '找不到此帳號' }, 401);

    if (!user.no_password) {
        if (!password) return json({ error: '請輸入密碼' }, 400);
        const hash = await hashPassword(password, name);
        if (hash !== user.password_hash) return json({ error: '密碼錯誤' }, 401);
    }

    const token = await generateToken();
    await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
        .bind(token, user.id, Math.floor(Date.now() / 1000)).run();

    return json({ token, name: user.name });
}
