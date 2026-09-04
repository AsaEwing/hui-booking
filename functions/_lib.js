export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

export function handleOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function hashPassword(password, name) {
    const data = new TextEncoder().encode(`${name}:${password}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_TTL = 3600; // 1 小時

export async function requireUser(request, db) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const now = Math.floor(Date.now() / 1000);
    const session = await db.prepare(
        'SELECT * FROM sessions WHERE token=? AND created_at > ?'
    ).bind(token, now - SESSION_TTL).first();
    if (!session || session.user_id === 0) return null;
    return session;
}

export async function requireAdmin(request, db) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const now = Math.floor(Date.now() / 1000);
    const session = await db.prepare(
        'SELECT * FROM sessions WHERE token=? AND created_at > ?'
    ).bind(token, now - SESSION_TTL).first();
    if (!session || session.user_id !== 0) return null;
    return session; // session.role = 'admin' | 'superadmin'
}

export async function requireSuperAdmin(request, db) {
    const session = await requireAdmin(request, db);
    if (!session || session.role !== 'superadmin') return null;
    return session;
}

// 讀取 admin_settings，沒有時回傳 fallback
export async function getAdminSetting(db, key, fallback = null) {
    const row = await db.prepare('SELECT value FROM admin_settings WHERE key=?').bind(key).first();
    return row?.value ?? fallback;
}

export function computeAllocation(submissions) {
    // 依提交時間排序（同志願衝突時早提交者優先）
    const sorted = [...submissions].sort((a, b) => a.submitted_at - b.submitted_at);
    const taken = {};
    const assignedMap = {}; // name -> { walls, rank }

    // 每個志願序正規化為一組位置陣列（單選時是長度 1 的陣列，組合位置則可能有多個）
    const getPrefGroups = sub => {
        const raw = sub.prefs_json
            ? JSON.parse(sub.prefs_json)
            : [sub.pref1, sub.pref2, sub.pref3, sub.pref4, sub.pref5].filter(Boolean);
        return raw.map(entry => Array.isArray(entry) ? entry : [entry]);
    };

    const maxRank = Math.max(...submissions.map(s => getPrefGroups(s).length), 5);

    // 每輪處理同一志願序，確保所有人的第1志願都先競爭
    for (let rank = 0; rank < maxRank; rank++) {
        for (const sub of sorted) {
            if (assignedMap[sub.name]) continue;
            const combo = getPrefGroups(sub)[rank];
            // 整組位置必須同時都還沒被搶，才能整組指派；只要有一個已被佔用，這個志願序就算落空
            if (combo && combo.length && combo.every(w => !taken[w])) {
                combo.forEach(w => { taken[w] = sub.name; });
                assignedMap[sub.name] = { walls: combo, rank: rank + 1 };
            }
        }
    }

    const results = {};
    for (const sub of submissions) {
        const prefGroups = getPrefGroups(sub);
        const a = assignedMap[sub.name];
        results[sub.name] = { walls: a?.walls || [], rank: a?.rank || null, prefGroups, submitted_at: sub.submitted_at, note: sub.note || '' };
    }

    return { taken, results };
}

export async function getActiveProject(db) {
    return db.prepare(
        'SELECT id, name, floorplan_url, walls_json, wall_count FROM projects WHERE is_active=1 LIMIT 1'
    ).first();
}
