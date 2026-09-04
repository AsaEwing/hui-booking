import { json, handleOptions, requireAdmin, computeAllocation, generateLotterySeed } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

// 執行抽籤：只能執行一次。伺服器端當下才產生亂數種子（管理員本人也無法事先預測或喬結果），
// 立即算出完整分配結果並連同種子、名單快照一起寫進 lottery_draws，永久保存、不可從介面刪改。
export async function onRequestPost({ request, env }) {
    const session = await requireAdmin(request, env.DB);
    if (!session) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId } = body;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    const project = await env.DB.prepare('SELECT id, allocation_mode FROM projects WHERE id=?').bind(projectId).first();
    if (!project) return json({ error: '專案不存在' }, 404);
    if (project.allocation_mode !== 'lottery') return json({ error: '此專案不是抽籤制' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM lottery_draws WHERE project_id=?').bind(projectId).first();
    if (existing) return json({ error: '此專案已執行過抽籤，無法重複抽籤' }, 409);

    const { results: subs } = await env.DB.prepare(`
        SELECT u.name, s.pref1, s.pref2, s.pref3, s.pref4, s.pref5, s.prefs_json, s.submitted_at, s.note
        FROM submissions s JOIN users u ON u.id = s.user_id
        WHERE s.project_id = ?
    `).bind(projectId).all();

    const seed = generateLotterySeed();
    const drawnAt = Math.floor(Date.now() / 1000);
    const { taken, results } = computeAllocation(subs, seed);

    await env.DB.prepare(
        'INSERT INTO lottery_draws (project_id, seed, drawn_at, drawn_by_role, submissions_snapshot, results_snapshot) VALUES (?,?,?,?,?,?)'
    ).bind(projectId, seed, drawnAt, session.role, JSON.stringify(subs), JSON.stringify(results)).run();

    return json({ ok: true, seed, drawnAt, drawnByRole: session.role, taken, results, submissions: subs });
}
