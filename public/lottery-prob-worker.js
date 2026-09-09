// Web Worker：在背景執行緒跑機率計算，避免大群組（精確計算最壞情況要跑
// 1~2 分鐘、蒙地卡羅估計最多跑到 1,000,000 次）卡住整個分頁。
// 由 lottery-prob.js 的 computeChoiceProbabilitiesAsync() 建立與呼叫，
// 分階段用 postMessage 回報進度（{ probs, done: false }），最後一次
// 回傳 { probs, done: true }。
importScripts('/lottery-prob.js');

self.onmessage = (e) => {
    const { people } = e.data;
    runProbabilityComputation(people, (probs, done) => {
        self.postMessage({ probs, done });
    });
};
