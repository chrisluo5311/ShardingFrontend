const API_URL = "http://3.147.58.62:8080/user/getAll";
const PAGE_SIZE = 20;

let members = [];
let currentPage = 1;

async function fetchMembers() {
    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        if (result.code === "0000") {
            members = result.data || [];
            renderTable();
            renderPagination();
        } else {
            showError("API 回傳錯誤：" + result.message);
        }
    } catch (error) {
        showError("無法取得會員資料：" + error);
    }
}

function renderTable() {
    const tbody = document.querySelector("#members-table tbody");
    tbody.innerHTML = "";
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageMembers = members.slice(start, end);

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
            Total: ${members.length} members
        </td>
    `;
    tbody.appendChild(totalTr);
}

// 預留操作函式
function editMember(id) {
    alert("Edit member: " + id);
}
function deleteMember(id) {
    alert("Delete member: " + id);
}

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

    // 頁碼
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

function showError(msg) {
    const tbody = document.querySelector("#members-table tbody");
    tbody.innerHTML = `<tr><td colspan="2" class="text-danger">${msg}</td></tr>`;
}

document.addEventListener("DOMContentLoaded", fetchMembers);