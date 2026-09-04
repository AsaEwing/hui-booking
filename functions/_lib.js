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

export async function requireUser(request, db) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const session = await db.prepare('SELECT * FROM sessions WHERE token=?').bind(token).first();
    if (!session || session.user_id === 0) return null;
    return session;
}

export async function requireAdmin(request, db) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const session = await db.prepare('SELECT * FROM sessions WHERE token=?').bind(token).first();
    if (!session || session.user_id !== 0) return null;
    return session;
}

export function computeAllocation(submissions) {
    const sorted = [...submissions].sort((a, b) => a.submitted_at - b.submitted_at);
    const taken = {};
    const results = {};

    for (const sub of sorted) {
        const prefs = [sub.pref1, sub.pref2, sub.pref3, sub.pref4, sub.pref5];
        let assigned = null;
        let rank = null;
        for (let i = 0; i < prefs.length; i++) {
            if (!taken[prefs[i]]) {
                assigned = prefs[i];
                rank = i + 1;
                break;
            }
        }
        if (assigned) taken[assigned] = sub.name;
        results[sub.name] = { wall: assigned, rank, prefs, submitted_at: sub.submitted_at };
    }

    return { taken, results };
}

export async function getActiveProject(db) {
    return db.prepare(
        'SELECT id, name, floorplan_url, walls_json, wall_count FROM projects WHERE is_active=1 LIMIT 1'
    ).first();
}
