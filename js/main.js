const bgUrls = [
    "http://3.147.58.62:8081/static/lookup?fileName=bg.jpg",
    "http://3.15.149.110:8082/static/lookup?fileName=bg.jpg",
    "http://52.15.151.104:8083/static/lookup?fileName=bg.jpg"
];

function setBgOverlay(url) {
    let overlay = document.querySelector('.bg-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'bg-overlay';
        document.body.appendChild(overlay);
    }
    overlay.style.backgroundImage = `url('${url}')`;
}

function tryLoadBg(index = 0) {
    if (index >= bgUrls.length) return; // 全部失敗就不設背景
    const img = new Image();
    img.onload = () => setBgOverlay(bgUrls[index]);
    img.onerror = () => tryLoadBg(index + 1);
    img.src = bgUrls[index];
}

// 頁面載入時自動嘗試載入背景
tryLoadBg();