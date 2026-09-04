import { json, handleOptions, hashPassword, generateToken } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const name = (body.name || '').trim();
    const password = (body.password || '').trim();
    if (!name || !password) return json({ error: '請輸入姓名和密碼' }, 400);
    if (name.length > 20) return json({ error: '姓名過長（最多 20 字）' }, 400);
    if (password.length < 3) return json({ error: '密碼至少 3 個字元' }, 400);

    const hash = await hashPassword(password, name);
    const now = Math.floor(Date.now() / 1000);

    try {
        await env.DB.prepare('INSERT INTO users (name, password_hash, created_at) VALUES (?, ?, ?)')
            .bind(name, hash, now).run();
    } catch (e) {
        if (e.message?.includes('UNIQUE')) return json({ error: '此姓名已被使用' }, 409);
        return json({ error: '伺服器錯誤' }, 500);
    }

    const user = await env.DB.prepare('SELECT id FROM users WHERE name = ?').bind(name).first();
    const token = await generateToken();
    await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
        .bind(token, user.id, now).run();

    return json({ token, name });
}
