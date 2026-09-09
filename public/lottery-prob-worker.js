// Web Worker：在背景執行緒跑 computeChoiceProbabilities，避免大群組（接近
// PROB_COMPONENT_SIZE_CAP，最壞情況要跑 1~2 分鐘）時卡住整個分頁。
// 由 lottery-prob.js 的 computeChoiceProbabilitiesAsync() 建立與呼叫。
importScripts('/lottery-prob.js');

self.onmessage = (e) => {
    const { people } = e.data;
    const result = computeChoiceProbabilities(people);
    self.postMessage(result);
};
