// local
// const API_URL_1 = `http://localhost:8081`;
// const API_URL_2 = `http://localhost:8082`;
// const API_URL_3 = `http://localhost:8083`;
// production
const API_URL_1 = `http://3.147.58.62:8081`;
const API_URL_2 = `http://3.15.149.110:8082`;
const API_URL_3 = `http://52.15.151.104:8083`;

const PAGE_SIZE = 20;

let members = [];
let currentPage = 1;
let searchKeyword = "";

// 取得會員資料
async function fetchMembers() {
    try {
        const FETCH_MEMBER_URL = API_URL_1 + "/user/getAll";
        const response = await fetch(FETCH_MEMBER_URL);
        const result = await response.json();
        if (result.code === "0000") {
            members = result.data || [];
            renderTable();
            renderPagination();
        } else {
            showError("API Error: " + result.message);
        }   
    } catch (error) {
        showError("Can't fetch member data: " + error);
    }
}

// 渲染會員資料表格
function renderTable() {
    const tbody = document.querySelector("#members-table tbody");
    tbody.innerHTML = "";
    // 過濾會員名稱
    let filteredMembers = members;
    if (searchKeyword.trim() !== "") {
        filteredMembers = members.filter(m => m.name && m.name.toLowerCase().includes(searchKeyword.toLowerCase()));
    }
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageMembers = filteredMembers.slice(start, end);

    for (const member of pageMembers) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${member.id}</td>
            <td>${member.name}</td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editMember('${member.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteMember('${member.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
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

// 預留操作函式
let editingMember = null;
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
        try {
            const resp = await fetch(`${API_URL_1}/user/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: newId, name: newName })
            });
            const result = await resp.json();
            if (result.code === "0000") {
                // 關閉 modal
                modal.hide();
                // 重新載入頁面
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
    fetch(`${API_URL_1}/user/delete/${id}`, {
        method: "DELETE"
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
    tbody.innerHTML = `<tr><td colspan="2" class="text-danger">${msg}</td></tr>`;
}

/**
 * 顯示新增會員的 Bootstrap Modal，並處理送出事件
 */
function showNewMemberModal() {
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
        try {
            const resp = await fetch(`${API_URL_1}/user/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            const result = await resp.json();
            if (result.code === "0000") {
                alert("Member created successfully!");
                newMemberModal.hide();
                fetchMembers();
            } else {
                alert("Create failed: " + result.message);
            }
        } catch (err) {
            alert("Create failed: " + err);
        }
    };

    newMemberModal.show();
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
            try {
                const response = await fetch(`${API_URL_1}/user/getAllLocal`);
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
                showError("Can't fetch member data: " + error);
            }
        });
    }

    // 綁定 Server 2 按鈕事件
    const server2Btn = document.getElementById("filterServer2");
    if (server2Btn) {
        server2Btn.addEventListener("click", async () => {
            showMemberLoadingSpinner();
            setMemberFilterBtnStyle("Server 2");
            try {
                const response = await fetch(`${API_URL_2}/user/getAllLocal`);
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
                showError("Can't fetch member data: " + error);
            }
        });
    }

    // 綁定 Server 3 按鈕事件
    const server3Btn = document.getElementById("filterServer3");
    if (server3Btn) {
        server3Btn.addEventListener("click", async () => {
            showMemberLoadingSpinner();
            setMemberFilterBtnStyle("Server 3");
            try {
                const response = await fetch(`${API_URL_3}/user/getAllLocal`);
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
                showError("Can't fetch member data: " + error);
            }
        });
    }
});