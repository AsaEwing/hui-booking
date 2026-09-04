import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

// 只新增位置，絕不覆蓋或刪除既有位置：以資料庫現有 walls_json 為準，
// 僅附加新標記在最大既有編號之後，整個更新單一 SQL 陳述式，要嘛全部成功要嘛全部失敗。
export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId, newMarkers } = body;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);
    if (!Array.isArray(newMarkers) || !newMarkers.length) return json({ error: '請至少新增一個位置' }, 400);
    for (const m of newMarkers) {
        if (typeof m?.x !== 'number' || typeof m?.y !== 'number' || m.x < 0 || m.x > 100 || m.y < 0 || m.y > 100) {
            return json({ error: '新增的位置座標格式錯誤' }, 400);
        }
    }

    const project = await env.DB.prepare('SELECT walls_json FROM projects WHERE id=?').bind(projectId).first();
    if (!project) return json({ error: '找不到此專案' }, 404);

    const walls = project.walls_json ? JSON.parse(project.walls_json) : {};
    const existingIds = Object.keys(walls).map(Number).filter(n => Number.isFinite(n));
    let nextId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;

    for (const m of newMarkers) {
        walls[nextId] = { x: m.x, y: m.y };
        nextId++;
    }

    await env.DB.prepare('UPDATE projects SET walls_json=?, wall_count=? WHERE id=?')
        .bind(JSON.stringify(walls), Object.keys(walls).length, projectId).run();

    return json({ ok: true, addedCount: newMarkers.length, wallCount: Object.keys(walls).length });
}
