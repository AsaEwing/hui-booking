import { json, handleOptions, requireAdmin, getEffectiveResults } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

// 單一手動指派：把某位學生的目前位置改成指定的位置（可以是原本沒分配到位置的人補位，
// 也可以是把已有位置的人移到別的空位）。只能新增紀錄，不會動到原始抽籤/時間排序結果。
export async function onRequestPost({ request, env }) {
    const session = await requireAdmin(request, env.DB);
    if (!session) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId, userName, walls, reason } = body;
    if (!projectId || !userName) return json({ error: '缺少必要欄位' }, 400);
    if (!Array.isArray(walls) || !walls.length || !walls.every(w => Number.isInteger(w))) {
        return json({ error: '位置格式錯誤' }, 400);
    }
    const trimmedReason = (reason || '').trim();
    if (!trimmedReason) return json({ error: '請填寫調整原因' }, 400);

    const project = await env.DB.prepare('SELECT id, walls_json, max_combo_size FROM projects WHERE id=?').bind(projectId).first();
    if (!project) return json({ error: '專案不存在' }, 404);

    const validWallIds = new Set(Object.keys(JSON.parse(project.walls_json || '{}')).map(Number));
    if (!walls.every(w => validWallIds.has(w))) return json({ error: '位置不存在於此專案' }, 400);

    // 跟學生自己填志願時同一條規則：一組最多只能組合到專案設定的上限
    const maxCombo = project.max_combo_size || 1;
    if (walls.length > maxCombo) {
        return json({ error: `最多可指派 ${maxCombo} 個位置（此專案的組合位置上限）` }, 400);
    }
    if (new Set(walls).size !== walls.length) {
        return json({ error: '位置不能重複選取' }, 400);
    }

    const user = await env.DB.prepare('SELECT id FROM users WHERE name=?').bind(userName).first();
    if (!user) return json({ error: '學生不存在' }, 404);

    const effective = await getEffectiveResults(env.DB, projectId);
    if (!effective) return json({ error: '此專案尚無分配結果可供調整（抽籤制須先執行抽籤）' }, 400);

    // 目標位置不能是「別人」目前的位置（自己原本就有的位置沒關係）；真的要跟別人換，
    // 請用交換功能，避免只改一半造成兩人都不完整。
    for (const w of walls) {
        const occupant = effective.taken[w];
        if (occupant && occupant !== userName) {
            return json({ error: `位置 ${w} 目前是「${occupant}」的位置，請改用交換功能，或先處理該位置` }, 409);
        }
    }

    const assignedAt = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
        'INSERT INTO manual_assignments (project_id, user_name, walls_json, assigned_by, assigned_at, reason) VALUES (?,?,?,?,?,?)'
    ).bind(projectId, userName, JSON.stringify(walls), session.role, assignedAt, trimmedReason).run();

    const updated = await getEffectiveResults(env.DB, projectId);
    return json({ ok: true, results: updated.results, taken: updated.taken });
}
