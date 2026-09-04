import { json, handleOptions, requireUser } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    const s = await requireUser(request, env.DB);
    if (!s) return json({ error: '請先登入' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { prefs, projectId, note } = body;
    const noteVal = (note || '').trim().slice(0, 500);
    if (!projectId) return json({ error: '請選擇專案' }, 400);
    if (!Array.isArray(prefs) || prefs.length === 0) return json({ error: '請填寫志願' }, 400);

    const project = await env.DB.prepare(
        'SELECT id, wall_count, pref_count, max_combo_size, allocation_mode, open_at, close_at, is_open FROM projects WHERE id=?'
    ).bind(projectId).first();

    if (!project) return json({ error: '專案不存在' }, 404);
    if (!project.is_open) return json({ error: '此專案目前不開放報名' }, 403);

    const now = Math.floor(Date.now() / 1000);
    if (project.open_at && now < project.open_at) return json({ error: '志願填寫尚未開放' }, 403);
    if (project.close_at && now > project.close_at) return json({ error: '志願填寫已截止' }, 403);

    if (project.allocation_mode === 'lottery') {
        const drawn = await env.DB.prepare('SELECT id FROM lottery_draws WHERE project_id=?').bind(project.id).first();
        if (drawn) return json({ error: '此專案已完成抽籤，無法再送出或修改志願' }, 403);
    }

    const expectedCount = project.pref_count || 5;
    const maxCombo = project.max_combo_size || 1;
    if (prefs.length !== expectedCount) return json({ error: `請填寫 ${expectedCount} 個志願` }, 400);

    // 正規化為陣列的陣列：每個志願序是一組 1..maxCombo 個位置編號
    let groups;
    if (maxCombo > 1) {
        groups = prefs.map(g => Array.isArray(g) ? g.map(Number) : [Number(g)]);
        for (const g of groups) {
            if (!g.length || g.length > maxCombo) {
                return json({ error: `每個志願至少選 1 個、最多可組合 ${maxCombo} 個位置` }, 400);
            }
            if (g.some(n => !Number.isInteger(n) || n < 1 || n > project.wall_count)) {
                return json({ error: `位置編號需在 1–${project.wall_count} 之間` }, 400);
            }
            if (new Set(g).size !== g.length) return json({ error: '同一志願內不可選重複位置' }, 400);
        }
        // 組合模式允許不同志願序之間出現相同位置編號，由分配時的志願序輪替機制處理先後順序
    } else {
        const nums = prefs.map(Number);
        if (nums.some(n => !Number.isInteger(n) || n < 1 || n > project.wall_count)) {
            return json({ error: `志願編號需在 1–${project.wall_count} 之間` }, 400);
        }
        if (new Set(nums).size !== expectedCount) return json({ error: '志願不可重複' }, 400);
        groups = nums.map(n => [n]);
    }

    // 補齊 pref1..pref5 欄位（保持相容性，僅取每組第一個位置，不足補 0）
    const p = groups.map(g => g[0]);
    while (p.length < 5) p.push(0);

    // 組合模式存巢狀陣列，一般模式維持原本的單層陣列格式
    const prefsToStore = maxCombo > 1 ? groups : groups.map(g => g[0]);

    const existing = await env.DB.prepare(
        'SELECT id FROM submissions WHERE user_id=? AND project_id=?'
    ).bind(s.user_id, project.id).first();

    if (existing) {
        await env.DB.prepare(
            'UPDATE submissions SET pref1=?,pref2=?,pref3=?,pref4=?,pref5=?,prefs_json=?,submitted_at=?,note=? WHERE user_id=? AND project_id=?'
        ).bind(p[0], p[1], p[2], p[3], p[4], JSON.stringify(prefsToStore), now, noteVal, s.user_id, project.id).run();
    } else {
        await env.DB.prepare(
            'INSERT INTO submissions (project_id,user_id,pref1,pref2,pref3,pref4,pref5,prefs_json,submitted_at,note) VALUES (?,?,?,?,?,?,?,?,?,?)'
        ).bind(project.id, s.user_id, p[0], p[1], p[2], p[3], p[4], JSON.stringify(prefsToStore), now, noteVal).run();
    }

    return json({ ok: true });
}
