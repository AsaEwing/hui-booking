// 抽籤機率預估：小群組用精確組合數學（窮舉排列），大群組改用蒙地卡羅統計抽樣
// （隨機模擬很多次，用出現頻率估算機率，並非窮舉全部可能）。
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

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// 精確計算的人數上限：11! = 39,916,800，最壞情況（群組內每個人志願都完全
// 衝突）大約要跑 1~2 分鐘，這是窮舉排列在瀏覽器裡還能接受的極限。超過這個
// 人數改用蒙地卡羅統計抽樣（見下方），不管人數多少都能在固定時間內跑完，
// 但只是估計值、不是精確值。
const PROB_COMPONENT_SIZE_CAP = 11;

// 蒙地卡羅分階段抽樣次數：先快速給一個粗略值，背景繼續跑到更精確的數字。
// 次數跟誤差的關係是「誤差跟次數的平方根成反比」：
//   10,000 次 → 誤差約 ±1.0%（最壞情況 p=0.5 時，95% 信賴區間）
//   100,000 次 → 誤差約 ±0.3%
//   1,000,000 次 → 誤差約 ±0.1%
const MC_STAGES = [10000, 100000, 1000000];

function marginOfError(trials) {
    return 1.96 * Math.sqrt(0.25 / trials);
}

// 熱路徑用：排列窮舉/隨機模擬時每次都要重新跑一次完整分配，這裡用 Map 查詢
// 姓名、maxRank 只算一次（不用每次呼叫都重算），比每次 people.find() 快很多。
function simulateOrder(byName, order, maxRank) {
    const taken = {};
    const assigned = {};
    for (let rank = 0; rank < maxRank; rank++) {
        for (const name of order) {
            if (assigned[name]) continue;
            const person = byName.get(name);
            const combo = person.prefGroups[rank];
            if (combo && combo.length && combo.every(w => !taken[w])) {
                combo.forEach(w => { taken[w] = name; });
                assigned[name] = { walls: combo, rank: rank + 1 };
            }
        }
    }
    return assigned;
}

// 找出所有連通元件：用每個人「所有志願排名」（不只第一志願）判斷是否跟別人
// 搶位置，完全不相關的人各自獨立，有關聯（含組合志願重疊、跨志願序的間接
// 關聯）的人歸在同一個小群組。
function findComponents(people) {
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
    const components = [];
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
        components.push(comp.map(idx => valid[idx]));
    }
    return components;
}

// 精確計算單一小群組（人數 <= PROB_COMPONENT_SIZE_CAP）：窮舉群組內所有排列。
function computeExactComponent(members) {
    const maxRank = Math.max(...members.map(m => m.prefGroups.length));
    if (members.length === 1) {
        const rankProbs = new Array(maxRank).fill(0);
        rankProbs[0] = 1;
        return { [members[0].name]: { rankProbs, unassignedProb: 0, estimated: false } };
    }
    const counts = {};
    members.forEach(m => { counts[m.name] = { rankCounts: new Array(maxRank).fill(0), unassignedCount: 0 }; });
    const names = members.map(m => m.name);
    const byName = new Map(members.map(m => [m.name, m]));
    let total = 0;
    permute(names, 0, () => {
        total++;
        const assigned = simulateOrder(byName, names, maxRank);
        members.forEach(m => {
            const a = assigned[m.name];
            if (a) counts[m.name].rankCounts[a.rank - 1]++;
            else counts[m.name].unassignedCount++;
        });
    });
    const result = {};
    members.forEach(m => {
        const c = counts[m.name];
        result[m.name] = {
            rankProbs: c.rankCounts.map(x => x / total),
            unassignedProb: c.unassignedCount / total,
            estimated: false,
        };
    });
    return result;
}

// 蒙地卡羅估計單一大群組，跑到累計 targetTrials 次為止。傳入前一階段的
// state（counts/total）可以接續累計，不用每個階段都從頭跑。
function computeMonteCarloComponent(members, targetTrials, prevState) {
    const maxRank = Math.max(...members.map(m => m.prefGroups.length));
    const counts = prevState ? prevState.counts : {};
    if (!prevState) {
        members.forEach(m => { counts[m.name] = { rankCounts: new Array(maxRank).fill(0), unassignedCount: 0 }; });
    }
    const names = members.map(m => m.name);
    const byName = new Map(members.map(m => [m.name, m]));
    let total = prevState ? prevState.total : 0;
    while (total < targetTrials) {
        const order = shuffleArray(names);
        const assigned = simulateOrder(byName, order, maxRank);
        members.forEach(m => {
            const a = assigned[m.name];
            if (a) counts[m.name].rankCounts[a.rank - 1]++;
            else counts[m.name].unassignedCount++;
        });
        total++;
    }
    const moe = marginOfError(total);
    const probs = {};
    members.forEach(m => {
        const c = counts[m.name];
        probs[m.name] = {
            rankProbs: c.rankCounts.map(x => x / total),
            unassignedProb: c.unassignedCount / total,
            estimated: true,
            trials: total,
            marginOfError: moe,
        };
    });
    return { probs, state: { counts, total } };
}

// 計算每人抽中第幾志願（或落空）的機率，人數 <= PROB_COMPONENT_SIZE_CAP 的
// 小群組是精確值，超過的大群組改用蒙地卡羅估計（一次跑到 MC_STAGES 最後一個
// 階段，不回報中間進度）。要看漸進式更新請用下面的 runProbabilityComputation
// （worker 內部使用，一般由 computeChoiceProbabilitiesAsync 呼叫）。
function computeChoiceProbabilities(people) {
    const probs = {};
    for (const members of findComponents(people)) {
        if (members.length <= PROB_COMPONENT_SIZE_CAP) {
            Object.assign(probs, computeExactComponent(members));
        } else {
            const { probs: mcProbs } = computeMonteCarloComponent(members, MC_STAGES[MC_STAGES.length - 1], null);
            Object.assign(probs, mcProbs);
        }
    }
    return probs;
}

// worker 專用：分階段計算並透過 onStage callback 回報進度，讓畫面可以漸進式
// 更新（大群組先顯示粗略估計，背景繼續精算）。
function runProbabilityComputation(people, onStage) {
    const components = findComponents(people);
    const exactProbs = {};
    const mcComponents = [];
    for (const members of components) {
        if (members.length <= PROB_COMPONENT_SIZE_CAP) {
            Object.assign(exactProbs, computeExactComponent(members));
        } else {
            mcComponents.push({ members, state: null });
        }
    }

    if (mcComponents.length === 0) {
        onStage({ ...exactProbs }, true);
        return;
    }

    onStage({ ...exactProbs }, false);
    const combined = { ...exactProbs };
    for (let i = 0; i < MC_STAGES.length; i++) {
        const target = MC_STAGES[i];
        for (const mc of mcComponents) {
            const { probs, state } = computeMonteCarloComponent(mc.members, target, mc.state);
            mc.state = state;
            Object.assign(combined, probs);
        }
        onStage({ ...combined }, i === MC_STAGES.length - 1);
    }
}

// 非同步版本：把運算丟到背景執行緒（Web Worker）跑，避免大群組時卡住整個
// 分頁。onProgress（選填）會在每個蒙地卡羅階段收到目前最新的估計值，最終
// 回傳的 Promise 在全部階段跑完後 resolve 出最終結果。只在主執行緒可用
// （這支檔案同時也會被 lottery-prob-worker.js 用 importScripts 載入，worker
// 裡面沒有 window，不需要也不能再開一個 worker）。
if (typeof window !== 'undefined') {
    window.computeChoiceProbabilitiesAsync = function (people, onProgress) {
        return new Promise((resolve, reject) => {
            const worker = new Worker('/lottery-prob-worker.js');
            worker.onmessage = (e) => {
                const { probs, done } = e.data;
                if (!done && onProgress) onProgress(probs);
                if (done) {
                    worker.terminate();
                    resolve(probs);
                }
            };
            worker.onerror = (err) => {
                worker.terminate();
                reject(err);
            };
            worker.postMessage({ people });
        });
    };
}
