function canonicalStringify(obj) {
    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalStringify).join(',') + ']';
    } else if (obj !== null && typeof obj === 'object') {
        return '{' + Object.keys(obj).sort().map(key =>
            JSON.stringify(key) + ':' + canonicalStringify(obj[key])
        ).join(',') + '}';
    } else {
        return JSON.stringify(obj);
    }
}

// local
// const API_URL_1 = `http://localhost:8081`;
// const API_URL_2 = `http://localhost:8082`;
// const API_URL_3 = `http://localhost:8083`;
// production
const API_URL_1 = `http://18.222.111.89:8081`;
const API_URL_2 = `http://3.15.149.110:8082`;
const API_URL_3 = `http://52.15.151.104:8083`;

const secretKey = "myShardingJHSecretKey";
const PAGE_SIZE = 20;

let members = [];
let currentPage = 1;
let searchKeyword = "";

// 取得會員資料
async function fetchMembers() {
    const endpoints = [
        `/user/getAll`,
        `/user/getAll`,
        `/user/getAll`
    ];
    const urls = [
        `${API_URL_1}${endpoints[0]}`,
        `${API_URL_2}${endpoints[1]}`,
        `${API_URL_3}${endpoints[2]}`
    ];
    let lastError = null;
    for (let i = 0; i < urls.length; i++) {
        try {
            const endpoint = endpoints[i];
            const signature = CryptoJS.HmacSHA256(endpoint, secretKey).toString(CryptoJS.enc.Base64);
            const response = await fetch(urls[i], {
                method: "GET",
                headers: {
                    "X-Signature": signature
                }
            });
            const result = await response.json();
            if (result.code === "0000") {
                members = result.data || [];
                renderTable();
                renderPagination();
                return;
            } else {
                showError("API Error: " + result.message);
                return;
            }
        } catch (error) {
            lastError = error;
            if (i === urls.length - 1) {
                showError("All servers are repairing, try again later");
            }
        }
    }
}

// 渲染會員資料表格
function renderTable() {
    const tbody = document.querySelector("#members-table tbody");
    tbody.innerHTML = "";
    // 過濾會員名稱與ID
    let filteredMembers = members;
    if (searchKeyword.trim() !== "") {
        const keyword = searchKeyword.trim().toLowerCase();
        filteredMembers = members.filter(m =>
            (m.name && m.name.toLowerCase().includes(keyword)) ||
            (m.id && m.id.toLowerCase().includes(keyword))
        );
    }
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageMembers = filteredMembers.slice(start, end);

    for (const member of pageMembers) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                ${member.id}
                <button class="btn btn-sm btn-outline-secondary ms-1 copy-member-id-btn" data-id="${member.id}" title="Copy ID" style="padding:2px 6px;">
                    <i class="bi bi-clipboard" style="font-size:0.9em;"></i>
                </button>
            </td>
            <td>${member.name}</td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editMember('${member.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteMember('${member.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    }

    // 綁定 copy 按鈕事件
    setTimeout(() => {
        document.querySelectorAll('.copy-member-id-btn').forEach(btn => {
            btn.onclick = function() {
                const id = this.getAttribute('data-id');
                // 直接用舊的方式複製
                const textarea = document.createElement("textarea");
                textarea.value = id;
                textarea.style.position = "fixed";
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    document.execCommand('copy');
                    showCopyToast("Copy successfully");
                } catch (err) {
                    alert("Copy failed");
                }
                document.body.removeChild(textarea);

                this.title = "Copied!";
                setTimeout(() => { this.title = "Copy ID"; }, 1000);
            };
        });
    }, 0);

    // Toast 顯示函式
    function showCopyToast(msg) {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = 9999;
            document.body.appendChild(toastContainer);
        }
        const toastId = 'toast-' + Date.now();
        toastContainer.insertAdjacentHTML('beforeend', `
            <div id="${toastId}" class="toast align-items-center text-bg-success border-0 show" role="alert" aria-live="assertive" aria-atomic="true" style="min-width:120px;margin-bottom:8px;">
                <div class="d-flex">
                    <div class="toast-body">${msg}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `);
        const toastEl = document.getElementById(toastId);
        setTimeout(() => {
            if (toastEl) toastEl.classList.remove('show');
            setTimeout(() => { if (toastEl) toastEl.remove(); }, 500);
        }, 1200);
    }

    // 顯示總會員數
    const totalTr = document.createElement("tr");
    totalTr.innerHTML = `
        <td colspan="3" class="text-start text-secondary">
            Total: ${filteredMembers.length} members
        </td>
    `;
    tbody.appendChild(totalTr);
}

// 新增會員
async function showNewMemberModal() {
    const newMemberModalEl = document.getElementById('newMemberModal');
    const newMemberModal = new bootstrap.Modal(newMemberModalEl);
    const newMemberForm = document.getElementById("newMemberForm");
    const newMemberNameInput = document.getElementById("newMemberName");

    // 重設表單
    newMemberForm.reset();

    // 綁定 submit 事件（避免重複綁定，先移除再加）
    newMemberForm.onsubmit = async function(e) {
        e.preventDefault();
        const name = newMemberNameInput.value.trim();
        if (!name) {
            alert("Please enter a name.");
            return;
        }
        const id = crypto.randomUUID();
        const body = { id, name };
        const bodyStr = canonicalStringify(body);
        const signature = CryptoJS.HmacSHA256(bodyStr, secretKey).toString(CryptoJS.enc.Base64);
        const urls = [
            `${API_URL_1}/user/save`,
            `${API_URL_2}/user/save`,
            `${API_URL_3}/user/save`
        ];
        let success = false;
        let lastError = null;
        for (let i = 0; i < urls.length; i++) {
            try {
                const resp = await fetch(urls[i], {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "X-Signature": signature
                    },
                    body: bodyStr
                });
                const result = await resp.json();
                if (result.code === "0000") {
                    alert("Member created successfully!");
                    newMemberModal.hide();
                    fetchMembers();
                    success = true;
                    break;
                } else {
                    lastError = result.message;
                }
            } catch (err) {
                lastError = err;
                if (i === urls.length - 1) {
                    alert("Create failed: " + lastError);
                }
            }
        }
        if (!success && lastError) {
            alert("Create failed: " + lastError);
        }
    };

    newMemberModal.show();
}

// 編輯會員
function editMember(id) {
    editingMember = members.find(m => m.id === id);
    if (!editingMember) return;

    // 填入 modal 欄位
    document.getElementById("editMemberId").value = editingMember.id;
    document.getElementById("editMemberName").value = editingMember.name;

    // 顯示 modal
    const modal = new bootstrap.Modal(document.getElementById('editMemberModal'));
    modal.show();

    // 綁定 Update 按鈕事件（避免重複綁定，先移除再加）
    const updateBtn = document.getElementById("updateMemberBtn");
    updateBtn.onclick = async function () {
        const newId = document.getElementById("editMemberId").value.trim();
        const newName = document.getElementById("editMemberName").value.trim();
        if (!newId || !newName) {
            alert("Please fill in all fields.");
            return;
        }
        const body = { id: newId, name: newName };
        const bodyStr = canonicalStringify(body);
        const signature = CryptoJS.HmacSHA256(bodyStr, secretKey).toString(CryptoJS.enc.Base64);

        try {
            const resp = await fetch(`${API_URL_1}/user/update`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-Signature": signature
                },
                body: bodyStr
            });
            const result = await resp.json();
            if (result.code === "0000") {
                modal.hide();
                location.reload();
            } else {
                alert("Update Failed: " + result.message);
            }
        } catch (err) {
            alert("Update Failed: " + err);
        }
    };
}
function deleteMember(id) {
    if (!confirm(`Are you sure you want to delete member ${id}?`)) return;
    const endpoint = `/user/delete/${id}`;
    const signature = CryptoJS.HmacSHA256(endpoint, secretKey).toString(CryptoJS.enc.Base64);

    fetch(`${API_URL_1}${endpoint}`, {
        method: "DELETE",
        headers: {
            "X-Signature": signature
        }
    })
    .then(resp => resp.json())
    .then(result => {
        if (result.code === "0000") {
            alert("User deleted successfully");
            location.reload(); // 重新載入會員資料
        } else {
            alert("Delete Failed: " + result.message);
        }
    })
    .catch(err => {
        alert("Delete Failed: " + err);
    });
}

// 渲染分頁
function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE)); // 至少顯示一頁
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    // 上一頁
    const prevLi = document.createElement("li");
    prevLi.className = "page-item" + (currentPage === 1 ? " disabled" : "");
    prevLi.innerHTML = `<a class="page-link" href="#">«</a>`;
    prevLi.onclick = (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            renderPagination();
        }
    };
    pagination.appendChild(prevLi);

    // 頁碼顯示邏輯
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement("li");
            li.className = "page-item" + (i === currentPage ? " active" : "");
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.onclick = (e) => {
                e.preventDefault();
                currentPage = i;
                renderTable();
                renderPagination();
            };
            pagination.appendChild(li);
        }
    } else {
        let pages = [];
        if (currentPage <= 3) {
            pages = [1, 2, 3, "...", totalPages - 2, totalPages - 1, totalPages];
        } else if (currentPage >= totalPages - 2) {
            pages = [1, 2, 3, "...", totalPages - 2, totalPages - 1, totalPages];
            if (currentPage === totalPages - 2) pages = [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            if (currentPage === totalPages - 1) pages = [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            if (currentPage === totalPages) pages = [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [currentPage - 1, currentPage, currentPage + 1, "...", totalPages - 2, totalPages - 1, totalPages];
            if (currentPage > 3) pages.unshift(1, "...");
        }

        // 過濾重複與非法頁碼
        let seen = new Set();
        pages = pages.filter(p => {
            if (p === "...") return true;
            if (p < 1 || p > totalPages || seen.has(p)) return false;
            seen.add(p);
            return true;
        });

        pages.forEach(p => {
            if (p === "...") {
                const li = document.createElement("li");
                li.className = "page-item disabled";
                li.innerHTML = `<span class="page-link">...</span>`;
                pagination.appendChild(li);
            } else {
                const li = document.createElement("li");
                li.className = "page-item" + (p === currentPage ? " active" : "");
                li.innerHTML = `<a class="page-link" href="#">${p}</a>`;
                li.onclick = (e) => {
                    e.preventDefault();
                    currentPage = p;
                    renderTable();
                    renderPagination();
                };
                pagination.appendChild(li);
            }
        });
    }

    // 下一頁
    const nextLi = document.createElement("li");
    nextLi.className = "page-item" + (currentPage === totalPages ? " disabled" : "");
    nextLi.innerHTML = `<a class="page-link" href="#">»</a>`;
    nextLi.onclick = (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            renderPagination();
        }
    };
    pagination.appendChild(nextLi);
}

// 顯示錯誤訊息
function showError(msg) {
    const tbody = document.querySelector("#members-table tbody");
    tbody.innerHTML = `<tr><td colspan="2" class="text-primary">${msg}</td></tr>`;
}

function setMemberFilterBtnStyle(active) {
    const btns = [
        { id: "filterAll", key: "All" },
        { id: "filterServer1", key: "Server 1" },
        { id: "filterServer2", key: "Server 2" },
        { id: "filterServer3", key: "Server 3" }
    ];
    btns.forEach(btn => {
        const el = document.getElementById(btn.id);
        if (el) {
            el.classList.remove("btn-primary", "btn-secondary");
            el.classList.add(active === btn.key ? "btn-primary" : "btn-secondary");
        }
    });
}

function showMemberLoadingSpinner() {
    const tbody = document.querySelector("#members-table tbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="3" class="text-center">
                <div class="spinner-border text-primary" role="status" style="width:2rem;height:2rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </td>
        </tr>
    `;
}

document.addEventListener("DOMContentLoaded", () => {
    // 預設 All 為 primary
    setMemberFilterBtnStyle("All");

    fetchMembers();

    // 綁定 All 按鈕事件
    const allBtn = document.getElementById("filterAll");
    if (allBtn) {
        allBtn.addEventListener("click", () => {
            showMemberLoadingSpinner();
            fetchMembers();
            setMemberFilterBtnStyle("All");
        });
    }

    // 綁定 New Member 按鈕事件
    const newMemberBtn = document.getElementById("newMemberBtn");
    if (newMemberBtn) {
        newMemberBtn.addEventListener("click", showNewMemberModal);
    }

    // 綁定搜尋框事件
    const searchInput = document.getElementById("searchMemberInput");
    if (searchInput) {
        searchInput.addEventListener("input", function() {
            searchKeyword = this.value;
            currentPage = 1;
            renderTable();
            renderPagination();
        });
    }

    // 綁定 Server 1 按鈕事件
    const server1Btn = document.getElementById("filterServer1");
    if (server1Btn) {
        server1Btn.addEventListener("click", async () => {
            showMemberLoadingSpinner();
            setMemberFilterBtnStyle("Server 1");
            const endpoint = `/user/getAllLocal`;
            const url = `${API_URL_1}${endpoint}`;
            const signature = CryptoJS.HmacSHA256(endpoint, secretKey).toString(CryptoJS.enc.Base64);

            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "X-Signature": signature
                    }
                });
                const result = await response.json();
                if (Array.isArray(result)) {
                    members = result;
                    currentPage = 1;
                    renderTable();
                    renderPagination();
                } else {
                    showError("API Error: Unexpected response format");
                }
            } catch (error) {
                showError("Server is recovering, please try again later.");
            }
        });
    }

    // 綁定 Server 2 按鈕事件
    const server2Btn = document.getElementById("filterServer2");
    if (server2Btn) {
        server2Btn.addEventListener("click", async () => {
            showMemberLoadingSpinner();
            setMemberFilterBtnStyle("Server 2");
            const endpoint = `/user/getAllLocal`;
            const url = `${API_URL_2}${endpoint}`;
            const signature = CryptoJS.HmacSHA256(endpoint, secretKey).toString(CryptoJS.enc.Base64);

            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "X-Signature": signature
                    }
                });
                const result = await response.json();
                if (Array.isArray(result)) {
                    members = result;
                    currentPage = 1;
                    renderTable();
                    renderPagination();
                } else {
                    showError("API Error: Unexpected response format");
                }
            } catch (error) {
                showError("Server is recovering, please try again later.");
            }
        });
    }

    // 綁定 Server 3 按鈕事件
    const server3Btn = document.getElementById("filterServer3");
    if (server3Btn) {
        server3Btn.addEventListener("click", async () => {
            showMemberLoadingSpinner();
            setMemberFilterBtnStyle("Server 3");
            const endpoint = `/user/getAllLocal`;
            const url = `${API_URL_3}${endpoint}`;
            const signature = CryptoJS.HmacSHA256(endpoint, secretKey).toString(CryptoJS.enc.Base64);

            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "X-Signature": signature
                    }
                });
                const result = await response.json();
                if (Array.isArray(result)) {
                    members = result;
                    currentPage = 1;
                    renderTable();
                    renderPagination();
                } else {
                    showError("API Error: Unexpected response format");
                }
            } catch (error) {
                showError("Server is recovering, please try again later.");
            }
        });
    }

    // 綁定 Update Background Image 按鈕事件
    const updateBgBtn = document.getElementById("updateBgBtn");
    const updateBgModal = new bootstrap.Modal(document.getElementById("updateBgModal"));
    if (updateBgBtn) {
        updateBgBtn.onclick = () => {
            document.getElementById("updateBgForm").reset();
            document.getElementById("bgUploadError").textContent = "";
            updateBgModal.show();
        };
    }

    // 處理背景圖片上傳
    document.getElementById("updateBgForm").onsubmit = async function(e) {
        e.preventDefault();
        const fileInput = document.getElementById("bgImageFile");
        const errorDiv = document.getElementById("bgUploadError");
        const serverSelect = document.getElementById("bgServerSelect");
        errorDiv.textContent = "";

        const file = fileInput.files[0];
        if (!file) {
            errorDiv.textContent = "Please select a file";
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            errorDiv.textContent = "File size limit 10MB";
            return;
        }

        // 根據下拉選單選擇 API URL
        let uploadUrl = "";
        if (serverSelect.value === "1") uploadUrl = `${API_URL_1}/static/upload`;
        else if (serverSelect.value === "2") uploadUrl = `${API_URL_2}/static/upload`;
        else if (serverSelect.value === "3") uploadUrl = `${API_URL_3}/static/upload`;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const resp = await fetch(uploadUrl, {
                method: "POST",
                body: formData
            });
            if (resp.ok) {
                updateBgModal.hide();
                alert("Background image uploaded successfully!");
                // 可在此處理背景圖片更新邏輯
            } else {
                errorDiv.textContent = "Upload failed, please try again";
            }
        } catch (err) {
            errorDiv.textContent = "Upload failed: " + err;
        }
    };
});