// 抽籤機率預估：用精確組合數學（窮舉小群組內所有排列），不是模擬估計。
// 這是「展示 / 預估用」的輔助工具，不是正式抽籤依據——正式抽籤結果一律以
// 後台抽籤紀錄與 verify-lottery.html 的雜湊/簽章驗證為準。
// 目前被 example.html（匿名展示版）與 admin.html（真實姓名、抽籤前預估）共用，
// 修改這裡的邏輯會同時影響兩處。

function groupsOverlap(a, b) {
    return a.some(w => b.includes(w));
}

// 用一組固定順序，完整跑一次多輪分配（跟正式 computeAllocation 語意一致）
function computeFinalResults(people, order) {
    const taken = {};
    const assigned = {};
    const maxRank = Math.max(...people.map(p => p.prefGroups.length));
    for (let rank = 0; rank < maxRank; rank++) {
        for (const name of order) {
            if (assigned[name]) continue;
            const person = people.find(p => p.name === name);
            const combo = person.prefGroups[rank];
            if (combo && combo.length && combo.every(w => !taken[w])) {
                combo.forEach(w => { taken[w] = name; });
                assigned[name] = { walls: combo, rank: rank + 1 };
            }
        }
    }
    return assigned;
}

function permute(arr, k, callback) {
    if (k === arr.length) { callback(); return; }
    for (let i = k; i < arr.length; i++) {
        [arr[k], arr[i]] = [arr[i], arr[k]];
        permute(arr, k + 1, callback);
        [arr[k], arr[i]] = [arr[i], arr[k]];
    }
}

// 群組大小上限：9! = 362,880，避免極端情況下排列數爆炸卡住瀏覽器
const PROB_COMPONENT_SIZE_CAP = 9;

// 計算每人抽中第幾志願（或落空）的精確機率。
// 做法：用每個人「所有志願排名」（不只第一志願）判斷是否跟別人搶位置，
// 建立衝突圖後找連通元件；完全不相關的人各自獨立（沒人搶 = 100% 拿到第一志願），
// 有關聯的小群組則窮舉群組內所有排列，精確統計每個人拿到第幾志願、或落空的比例。
function computeChoiceProbabilities(people) {
    const valid = people.filter(p => p.prefGroups && p.prefGroups.length);
    const n = valid.length;
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const overlap = valid[i].prefGroups.some(gi =>
                valid[j].prefGroups.some(gj => groupsOverlap(gi, gj))
            );
            if (overlap) { adj[i].push(j); adj[j].push(i); }
        }
    }

    const visited = new Array(n).fill(false);
    const probs = {};
    for (let i = 0; i < n; i++) {
        if (visited[i]) continue;
        const comp = [];
        const queue = [i];
        visited[i] = true;
        while (queue.length) {
            const cur = queue.shift();
            comp.push(cur);
            for (const nb of adj[cur]) {
                if (!visited[nb]) { visited[nb] = true; queue.push(nb); }
            }
        }
        const members = comp.map(idx => valid[idx]);
        const maxRank = Math.max(...members.map(m => m.prefGroups.length));
        if (members.length === 1) {
            const rankProbs = new Array(maxRank).fill(0);
            rankProbs[0] = 1;
            probs[members[0].name] = { rankProbs, unassignedProb: 0 };
            continue;
        }
        if (members.length > PROB_COMPONENT_SIZE_CAP) {
            members.forEach(m => { probs[m.name] = { rankProbs: null, unassignedProb: null }; });
            continue;
        }
        const counts = {};
        members.forEach(m => { counts[m.name] = { rankCounts: new Array(maxRank).fill(0), unassignedCount: 0 }; });
        const names = members.map(m => m.name);
        let total = 0;
        permute(names, 0, () => {
            total++;
            const assigned = computeFinalResults(members, names);
            members.forEach(m => {
                const a = assigned[m.name];
                if (a) counts[m.name].rankCounts[a.rank - 1]++;
                else counts[m.name].unassignedCount++;
            });
        });
        members.forEach(m => {
            const c = counts[m.name];
            probs[m.name] = {
                rankProbs: c.rankCounts.map(x => x / total),
                unassignedProb: c.unassignedCount / total,
            };
        });
    }
    return probs;
}
