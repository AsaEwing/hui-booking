import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId, name, floorplan_url, floorplan_data, floorplan_mime, walls, open_at, close_at, active_until, pref_count, max_combo_size, is_open, drive_url } = body;
    const driveVal = drive_url?.trim() || null;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    const MIN_ACTIVE_GAP = 3 * 24 * 60 * 60; // 結果自動關閉時間至少要晚於志願截止時間 3 天
    if (active_until && close_at && active_until - close_at < MIN_ACTIVE_GAP) {
        return json({ error: '結果自動關閉時間至少要晚於志願截止時間 3 天' }, 400);
    }

    const finalUrl = floorplan_data
        ? `/api/project-image/${projectId}`
        : (floorplan_url || '/floorplan.jpg');

    const pc = Math.max(1, Math.min(10, parseInt(pref_count) || 5));
    const mcs = Math.max(1, Math.min(10, parseInt(max_combo_size) || 1));
    const openFlag = is_open ? 1 : 0;
    const activeUntilVal = active_until || null;

    // 若沒有傳入 walls（管理員只更新設定未重新標記），保留 DB 現有的 walls
    const hasWalls = walls && Object.keys(walls).length > 0;

    if (floorplan_data) {
        if (hasWalls) {
            await env.DB.prepare(
                'UPDATE projects SET name=?, floorplan_url=?, floorplan_data=?, floorplan_mime=?, walls_json=?, wall_count=?, open_at=?, close_at=?, active_until=?, pref_count=?, max_combo_size=?, is_open=?, drive_url=? WHERE id=?'
            ).bind(name?.trim() || 'Untitled', finalUrl, floorplan_data, floorplan_mime || 'image/jpeg', JSON.stringify(walls), Object.keys(walls).length, open_at || null, close_at || null, activeUntilVal, pc, mcs, openFlag, driveVal, projectId).run();
        } else {
            await env.DB.prepare(
                'UPDATE projects SET name=?, floorplan_url=?, floorplan_data=?, floorplan_mime=?, open_at=?, close_at=?, active_until=?, pref_count=?, max_combo_size=?, is_open=?, drive_url=? WHERE id=?'
            ).bind(name?.trim() || 'Untitled', finalUrl, floorplan_data, floorplan_mime || 'image/jpeg', open_at || null, close_at || null, activeUntilVal, pc, mcs, openFlag, driveVal, projectId).run();
        }
    } else {
        if (hasWalls) {
            await env.DB.prepare(
                'UPDATE projects SET name=?, floorplan_url=?, walls_json=?, wall_count=?, open_at=?, close_at=?, active_until=?, pref_count=?, max_combo_size=?, is_open=?, drive_url=? WHERE id=?'
            ).bind(name?.trim() || 'Untitled', finalUrl, JSON.stringify(walls), Object.keys(walls).length, open_at || null, close_at || null, activeUntilVal, pc, mcs, openFlag, driveVal, projectId).run();
        } else {
            await env.DB.prepare(
                'UPDATE projects SET name=?, floorplan_url=?, open_at=?, close_at=?, active_until=?, pref_count=?, max_combo_size=?, is_open=?, drive_url=? WHERE id=?'
            ).bind(name?.trim() || 'Untitled', finalUrl, open_at || null, close_at || null, activeUntilVal, pc, mcs, openFlag, driveVal, projectId).run();
        }
    }

    return json({ ok: true });
}
