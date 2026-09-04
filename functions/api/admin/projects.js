import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);
    const { results } = await env.DB.prepare(
        'SELECT id, name, floorplan_url, walls_json, wall_count, is_active, active_until, is_open, open_at, close_at, pref_count, max_combo_size, allocation_mode, lottery_rules_text, drive_url, created_at FROM projects ORDER BY created_at DESC'
    ).all();
    // 附上每個專案是否已有志願提交、是否已抽籤，供前端判斷分配方式能否修改
    const { results: submissionCounts } = await env.DB.prepare(
        'SELECT project_id, COUNT(*) as count FROM submissions GROUP BY project_id'
    ).all();
    const { results: draws } = await env.DB.prepare('SELECT project_id, drawn_at FROM lottery_draws').all();
    const submissionCountMap = Object.fromEntries(submissionCounts.map(r => [r.project_id, r.count]));
    const drawnMap = Object.fromEntries(draws.map(r => [r.project_id, r.drawn_at]));
    const projects = results.map(p => ({
        ...p,
        has_submissions: !!submissionCountMap[p.id],
        drawn_at: drawnMap[p.id] || null,
    }));
    return json({ projects });
}

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { name, floorplan_url, floorplan_data, floorplan_mime, walls, open_at, close_at, active_until, pref_count, max_combo_size, allocation_mode, lottery_rules_text, is_open, drive_url } = body;
    if (!name?.trim()) return json({ error: '請輸入專案名稱' }, 400);
    if (!walls || Object.keys(walls).length === 0) return json({ error: '請標記至少一個展牆位置' }, 400);
    const MIN_ACTIVE_GAP = 3 * 24 * 60 * 60; // 結果自動關閉時間至少要晚於志願截止時間 3 天
    if (active_until && close_at && active_until - close_at < MIN_ACTIVE_GAP) {
        return json({ error: '結果自動關閉時間至少要晚於志願截止時間 3 天' }, 400);
    }
    const mode = allocation_mode === 'lottery' ? 'lottery' : 'time';
    const rulesText = (lottery_rules_text || '').trim();
    if (mode === 'lottery' && !rulesText) return json({ error: '抽籤制專案請填寫抽籤規則說明' }, 400);

    const now = Math.floor(Date.now() / 1000);
    const pc = Math.max(1, Math.min(10, parseInt(pref_count) || 5));
    const mcs = Math.max(1, Math.min(10, parseInt(max_combo_size) || 1));
    const driveVal = drive_url?.trim() || null;
    const result = await env.DB.prepare(
        'INSERT INTO projects (name, floorplan_url, floorplan_data, floorplan_mime, walls_json, wall_count, open_at, close_at, active_until, pref_count, max_combo_size, allocation_mode, lottery_rules_text, is_open, is_active, drive_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)'
    ).bind(name.trim(), floorplan_url || '/floorplan.jpg', floorplan_data || null, floorplan_mime || null, JSON.stringify(walls), Object.keys(walls).length, open_at || null, close_at || null, active_until || null, pc, mcs, mode, mode === 'lottery' ? rulesText : null, is_open ? 1 : 0, driveVal, now).run();

    const newId = result.meta.last_row_id;
    // 若有上傳圖片，自動將 floorplan_url 指向 DB 圖片 endpoint
    if (floorplan_data) {
        await env.DB.prepare('UPDATE projects SET floorplan_url=? WHERE id=?')
            .bind(`/api/project-image/${newId}`, newId).run();
    }

    return json({ ok: true, id: newId });
}
