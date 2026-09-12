import { json, handleOptions, requireAdmin, getEffectiveResults } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

// 交換兩位學生目前的位置：一次寫入兩筆 manual_assignments 紀錄（用 D1 batch 確保
// 要嘛兩筆都成功、要嘛都不寫入，不會發生只換一半的狀況）。「目前的位置」一律是
// 套用過先前手動調整之後的有效位置，所以可以連續交換（A↔B 之後再 A↔C）而不會出錯。
export async function onRequestPost({ request, env }) {
    const session = await requireAdmin(request, env.DB);
    if (!session) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId, userA, userB, reason } = body;
    if (!projectId || !userA || !userB) return json({ error: '缺少必要欄位' }, 400);
    if (userA === userB) return json({ error: '不能跟自己交換' }, 400);
    const trimmedReason = (reason || '').trim();
    if (!trimmedReason) return json({ error: '請填寫調整原因' }, 400);

    const project = await env.DB.prepare('SELECT id FROM projects WHERE id=?').bind(projectId).first();
    if (!project) return json({ error: '專案不存在' }, 404);

    const { results: users } = await env.DB.prepare('SELECT name FROM users WHERE name IN (?, ?)').bind(userA, userB).all();
    if (users.length !== 2) return json({ error: '學生不存在' }, 404);

    const effective = await getEffectiveResults(env.DB, projectId);
    if (!effective) return json({ error: '此專案尚無分配結果可供調整（抽籤制須先執行抽籤）' }, 400);

    const wallsA = effective.results[userA]?.walls || [];
    const wallsB = effective.results[userB]?.walls || [];
    if (!wallsA.length && !wallsB.length) {
        return json({ error: '兩人目前都沒有位置，無法交換' }, 400);
    }

    const assignedAt = Math.floor(Date.now() / 1000);
    const insertSql = 'INSERT INTO manual_assignments (project_id, user_name, walls_json, assigned_by, assigned_at, reason) VALUES (?,?,?,?,?,?)';
    await env.DB.batch([
        env.DB.prepare(insertSql).bind(projectId, userA, JSON.stringify(wallsB), session.role, assignedAt, trimmedReason),
        env.DB.prepare(insertSql).bind(projectId, userB, JSON.stringify(wallsA), session.role, assignedAt, trimmedReason),
    ]);

    const updated = await getEffectiveResults(env.DB, projectId);
    return json({ ok: true, results: updated.results, taken: updated.taken });
}
