import { json, handleOptions, computeAllocation, computeRegistrations, getPrefGroups } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

// 短時間邊緣快取：同一個 projectId 在快取有效期間內，不管同時有多少人查看，
// 只會真正查一次資料庫，其餘請求直接吃快取，避免多人同時輪詢時重複讀取 D1。
// 回傳內容不論登入與否都完全一樣（遮蔽姓名是前端自己做的），這裡是否帶
// Authorization header 純粹用來決定快取秒數長短，不做任何驗證，沒有安全疑慮：
// 登入者（在意自己結果的人）快取短一點、未登入的一般訪客快取久一點。
const CACHE_TTL_AUTHED = 4;
const CACHE_TTL_ANON = 20;

export async function onRequestGet({ request, env, waitUntil }) {
    const cache = caches.default;
    const hasAuth = !!request.headers.get('Authorization');
    const cacheTtl = hasAuth ? CACHE_TTL_AUTHED : CACHE_TTL_ANON;
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set('_scope', hasAuth ? 'auth' : 'anon');
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');

    let project;
    if (projectId) {
        project = await env.DB.prepare(
            'SELECT id, name, floorplan_url, walls_json, wall_count, pref_count, allocation_mode, open_at, close_at, active_until FROM projects WHERE id=?'
        ).bind(projectId).first();
    } else {
        const now = Math.floor(Date.now() / 1000);
        project = await env.DB.prepare(
            'SELECT id, name, floorplan_url, walls_json, wall_count, pref_count, allocation_mode, open_at, close_at, active_until FROM projects WHERE is_active=1 AND (active_until IS NULL OR active_until > ?) LIMIT 1'
        ).bind(now).first();
    }

    if (!project) return json({ error: 'no_active_project' }, 404);

    const { results: subs } = await env.DB.prepare(`
        SELECT u.name, s.pref1, s.pref2, s.pref3, s.pref4, s.pref5, s.prefs_json, s.submitted_at
        FROM submissions s JOIN users u ON u.id = s.user_id
        WHERE s.project_id = ?
    `).bind(project.id).all();

    const { results: allUsersRows } = await env.DB.prepare('SELECT name FROM users ORDER BY created_at').all();

    // 不論分配方式或是否已抽籤，這份資料一律代表「誰、提交了什麼」，跟分配結果分開
    const submissions = {};
    for (const sub of subs) {
        submissions[sub.name] = { prefGroups: getPrefGroups(sub), submitted_at: sub.submitted_at };
    }

    let taken = {}, results = {}, registrations = null, drawn = false, verification = null;

    if (project.allocation_mode === 'lottery') {
        const draw = await env.DB.prepare(
            'SELECT seed, drawn_at, drawn_by_role, submissions_snapshot, results_snapshot, signature FROM lottery_draws WHERE project_id=?'
        ).bind(project.id).first();
        if (draw) {
            drawn = true;
            results = JSON.parse(draw.results_snapshot);
            for (const [name, r] of Object.entries(results)) {
                (r.walls || []).forEach(w => { taken[w] = name; });
            }
            // 公開的驗證資料：任何人（不需登入）都能下載去 verify-lottery.html 重新驗算
            verification = {
                seed: draw.seed,
                drawnAt: draw.drawn_at,
                drawnByRole: draw.drawn_by_role,
                submissions: JSON.parse(draw.submissions_snapshot),
                results,
                signature: draw.signature || null,
            };
        } else {
            // 尚未抽籤：不顯示分配結果，只顯示每個位置目前有哪些人登記
            registrations = computeRegistrations(subs);
        }
    } else {
        ({ taken, results } = computeAllocation(subs));
    }

    const response = json({
        allocationMode: project.allocation_mode || 'time',
        drawn,
        taken,
        results,
        registrations,
        submissions,
        verification,
        allUsers: allUsersRows.map(u => u.name),
        project: {
            id: project.id,
            name: project.name,
            floorplan_url: project.floorplan_url,
            walls: JSON.parse(project.walls_json || '{}'),
            wall_count: project.wall_count,
            pref_count: project.pref_count || 5,
            open_at: project.open_at,
            close_at: project.close_at,
            active_until: project.active_until,
        },
    });
    response.headers.set('Cache-Control', `public, max-age=${cacheTtl}`);
    waitUntil(cache.put(cacheKey, response.clone()));
    return response;
}
