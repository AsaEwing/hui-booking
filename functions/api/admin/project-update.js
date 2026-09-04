import { json, handleOptions, requireAdmin } from '../../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestPost({ request, env }) {
    if (!await requireAdmin(request, env.DB)) return json({ error: '未授權' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }

    const { projectId, name, floorplan_url, floorplan_data, floorplan_mime, walls, open_at, close_at, active_until, pref_count, max_combo_size, allocation_mode, lottery_rules_text, is_open, drive_url } = body;
    const driveVal = drive_url?.trim() || null;
    if (!projectId) return json({ error: '缺少 projectId' }, 400);

    const MIN_ACTIVE_GAP = 3 * 24 * 60 * 60; // 結果自動關閉時間至少要晚於志願截止時間 3 天
    if (active_until && close_at && active_until - close_at < MIN_ACTIVE_GAP) {
        return json({ error: '結果自動關閉時間至少要晚於志願截止時間 3 天' }, 400);
    }

    const existingProject = await env.DB.prepare('SELECT allocation_mode FROM projects WHERE id=?').bind(projectId).first();
    if (!existingProject) return json({ error: '專案不存在' }, 404);
    const mode = allocation_mode === 'lottery' ? 'lottery' : 'time';
    const rulesText = (lottery_rules_text || '').trim();
    if (mode === 'lottery' && !rulesText) return json({ error: '抽籤制專案請填寫抽籤規則說明' }, 400);
    if (mode !== existingProject.allocation_mode) {
        const { count } = await env.DB.prepare('SELECT COUNT(*) as count FROM submissions WHERE project_id=?').bind(projectId).first();
        if (count > 0) return json({ error: '已有學生送出志願，無法變更分配方式' }, 400);
    }

    const finalUrl = floorplan_data
        ? `/api/project-image/${projectId}`
        : (floorplan_url || '/floorplan.jpg');

    const pc = Math.max(1, Math.min(10, parseInt(pref_count) || 5));
    const mcs = Math.max(1, Math.min(10, parseInt(max_combo_size) || 1));
    const openFlag = is_open ? 1 : 0;
    const activeUntilVal = active_until || null;
    const rulesTextVal = mode === 'lottery' ? rulesText : null;

    // 若沒有傳入 walls（管理員只更新設定未重新標記），保留 DB 現有的 walls
    const hasWalls = walls && Object.keys(walls).length > 0;

    if (floorplan_data) {
        if (hasWalls) {
            await env.DB.prepare(
                'UPDATE projects SET name=?, floorplan_url=?, floorplan_data=?, floorplan_mime=?, walls_json=?, wall_count=?, open_at=?, close_at=?, active_until=?, pref_count=?, max_combo_size=?, allocation_mode=?, lottery_rules_text=?, is_open=?, drive_url=? WHERE id=?'
            ).bind(name?.trim() || 'Untitled', finalUrl, floorplan_data, floorplan_mime || 'image/jpeg', JSON.stringify(walls), Object.keys(walls).length, open_at || null, close_at || null, activeUntilVal, pc, mcs, mode, rulesTextVal, openFlag, driveVal, projectId).run();
        } else {
            await env.DB.prepare(
                'UPDATE projects SET name=?, floorplan_url=?, floorplan_data=?, floorplan_mime=?, open_at=?, close_at=?, active_until=?, pref_count=?, max_combo_size=?, allocation_mode=?, lottery_rules_text=?, is_open=?, drive_url=? WHERE id=?'
            ).bind(name?.trim() || 'Untitled', finalUrl, floorplan_data, floorplan_mime || 'image/jpeg', open_at || null, close_at || null, activeUntilVal, pc, mcs, mode, rulesTextVal, openFlag, driveVal, projectId).run();
        }
    } else {
        if (hasWalls) {
            await env.DB.prepare(
                'UPDATE projects SET name=?, floorplan_url=?, walls_json=?, wall_count=?, open_at=?, close_at=?, active_until=?, pref_count=?, max_combo_size=?, allocation_mode=?, lottery_rules_text=?, is_open=?, drive_url=? WHERE id=?'
            ).bind(name?.trim() || 'Untitled', finalUrl, JSON.stringify(walls), Object.keys(walls).length, open_at || null, close_at || null, activeUntilVal, pc, mcs, mode, rulesTextVal, openFlag, driveVal, projectId).run();
        } else {
            await env.DB.prepare(
                'UPDATE projects SET name=?, floorplan_url=?, open_at=?, close_at=?, active_until=?, pref_count=?, max_combo_size=?, allocation_mode=?, lottery_rules_text=?, is_open=?, drive_url=? WHERE id=?'
            ).bind(name?.trim() || 'Untitled', finalUrl, open_at || null, close_at || null, activeUntilVal, pc, mcs, mode, rulesTextVal, openFlag, driveVal, projectId).run();
        }
    }

    return json({ ok: true });
}
