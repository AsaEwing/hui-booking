import { json, handleOptions, hashPassword, generateToken, getAdminSetting } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const name = (body.name || '').trim();
    const noPassword = body.noPassword === true;
    const password = (body.password || '').trim();
    if (!name) return json({ error: '請輸入姓名' }, 400);
    if (name.length > 20) return json({ error: '姓名過長（最多 20 字）' }, 400);
    if (!noPassword) {
        if (!password) return json({ error: '請輸入姓名和密碼' }, 400);
        if (password.length < 6 || !/[A-Za-z]/.test(password)) return json({ error: '密碼至少 6 個字元，且須包含至少一個英文字母' }, 400);
    }

    const maxStudents = await getAdminSetting(env.DB, 'max_students');
    if (maxStudents) {
        const { count } = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
        if (count >= parseInt(maxStudents)) return json({ error: `系統已達人數上限（${maxStudents} 人），請聯絡管理員` }, 403);
    }

    const hash = noPassword ? '' : await hashPassword(password, name);
    const now = Math.floor(Date.now() / 1000);

    try {
        await env.DB.prepare('INSERT INTO users (name, password_hash, no_password, created_at) VALUES (?, ?, ?, ?)')
            .bind(name, hash, noPassword ? 1 : 0, now).run();
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
