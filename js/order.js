// const ORDER_API_URL = "http://localhost:8080";
const ORDER_API_URL = "http://3.147.58.62:8081";
const ORDER_PAGE_SIZE = 20;
let ordersData = [];
let ordersCurrentPage = 1;
let editingOrder = null;
let orderSearchKeyword = "";
let orderServerFilter = "All";

// 取得今日日期（yyyy-mm-dd）
function getTodayStr() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// 取得訂單資料
async function fetchOrders(startDate = "2023-01-01", endDate = getTodayStr()) {
    try {
        const url = `${ORDER_API_URL}/order/findRange?startDate=${startDate}&endDate=${endDate}`;
        const response = await fetch(url);
        const result = await response.json();
        if (result.code === "0000") {
            // 依 createTime 由新到舊排序
            ordersData = (result.data || []).sort((a, b) => {
                const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
                const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
                return tb - ta;
            });
            ordersCurrentPage = 1;
            renderOrdersTable();
            renderOrdersPagination();
        } else {
            ordersData = [];
            renderOrdersTable([], "API Error: " + result.message);
            renderOrdersPagination();
        }
    } catch (error) {
        ordersData = [];
        renderOrdersTable([], "Can't fetch order data: " + error);
        renderOrdersPagination();
    }
}

// 在 renderOrdersTable 前加上按鈕與搜尋框
function renderOrdersTable(orders = ordersData, errorMsg = "") {
    const tbody = document.querySelector("#orders-table tbody");
    if (!tbody) return;

    // 過濾搜尋與 server
    let filteredOrders = orders;
    if (orderSearchKeyword.trim() !== "") {
        filteredOrders = filteredOrders.filter(o =>
            o.id.orderId && o.id.orderId.toLowerCase().includes(orderSearchKeyword.toLowerCase())
        );
    }
    if (orderServerFilter !== "All") {
        filteredOrders = filteredOrders.filter(o => o.server === orderServerFilter);
    }

    // 分頁
    const start = (ordersCurrentPage - 1) * ORDER_PAGE_SIZE;
    const end = start + ORDER_PAGE_SIZE;
    const pageOrders = filteredOrders.slice(start, end);

    // 渲染 tbody
    if (errorMsg) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${errorMsg}</td></tr>`;
        return;
    }
    if (!pageOrders.length) {
        tbody.innerHTML = `<tr><td colspan="5">No orders found.</td></tr>`;
        return;
    }
    tbody.innerHTML = pageOrders.map(order => `
        <tr>
            <td>
                <a href="#" class="order-id-link" data-order-id="${order.id.orderId}" data-create-time="${order.createTime}">
                    ${order.id.orderId}
                </a>
            </td>
            <td>${order.memberId}</td>
            <td>${order.createTime ? order.createTime.replace('T', ' ') : ''}</td>
            <td class="text-center">${order.isPaid ? "✅" : "❌"}</td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editOrder('${order.id.orderId}', ${order.id.version})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteOrder('${order.id.orderId}', ${order.id.version})">Delete</button>
            </td>
        </tr>
    `).join('');

    // 綁定 Order ID 點擊事件
    Array.from(tbody.querySelectorAll('.order-id-link')).forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            const orderId = this.getAttribute('data-order-id');
            const createTime = this.getAttribute('data-create-time');
            await showOrderHistoryModal(orderId, createTime);
        });
    });

    renderOrdersPagination(filteredOrders);
}

// 顯示訂單版本歷史的 modal
async function showOrderHistoryModal(orderId, createTime) {
    const modal = new bootstrap.Modal(document.getElementById('orderHistoryModal'));
    const body = document.getElementById('orderHistoryModalBody');
    body.innerHTML = `<div class="text-secondary">Loading...</div>`;

    // 只保留年月日
    const dateOnly = createTime ? createTime.substring(0, 10) : "";

    try {
        const resp = await fetch(`${ORDER_API_URL}/order/history?orderId=${encodeURIComponent(orderId)}&createTime=${encodeURIComponent(dateOnly)}`);
        const result = await resp.json();
        if (result.code === "0000" && Array.isArray(result.data) && result.data.length > 0) {
            body.innerHTML = `
                <table class="table table-bordered table-striped">
                    <thead>
                        <tr>
                            <th>Version</th>
                            <th>Create Time</th>
                            <th>Is Paid</th>
                            <th>Member ID</th>
                            <th>Expired At</th>
                            <th>Is Deleted</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${result.data.map(order => `
                            <tr>
                                <td>${order.id.version}</td>
                                <td>${order.createTime ? order.createTime.replace('T', ' ') : ''}</td>
                                <td>${order.isPaid ? "Yes" : "No"}</td>
                                <td>${order.memberId}</td>
                                <td>
                                    ${order.expiredAt
                                        ? order.expiredAt.replace('T', ' ')
                                        : `<span class="text-success fw-bold">Current</span>`
                                    }
                                </td>
                                <td>${order.isDeleted ? "Yes" : "No"}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            body.innerHTML = `<div class="text-danger">No history found.</div>`;
        }
    } catch (err) {
        body.innerHTML = `<div class="text-danger">Failed to load history: ${err}</div>`;
    }
    modal.show();
}

function editOrder(orderId, version) {
    // 找到該訂單
    const order = ordersData.find(
        o => o.id.orderId === orderId && o.id.version === version
    );
    if (!order) {
        alert("Order not found!");
        return;
    }
    editingOrder = order;

    // 填入表單
    document.getElementById("editOrderId").value = order.id.orderId;
    document.getElementById("editOrderVersion").value = order.id.version;
    document.getElementById("editOrderMemberId").value = order.memberId;
    document.getElementById("editOrderCreateTime").value = order.createTime ? order.createTime.replace('T', ' ') : '';
    document.getElementById("editOrderIsPaid").value = order.isPaid;
    document.getElementById("editOrderIsDeleted").value = order.isDeleted;

    // 顯示 modal
    const modal = new bootstrap.Modal(document.getElementById('editOrderModal'));
    modal.show();
}

function renderOrdersPagination(filteredOrders = null) {
    const data = filteredOrders || ordersData;
    const totalPages = Math.max(1, Math.ceil(data.length / ORDER_PAGE_SIZE));
    const pagination = document.getElementById("orders-pagination");
    if (!pagination) return;
    pagination.innerHTML = "";

    // 上一頁
    const prevLi = document.createElement("li");
    prevLi.className = "page-item" + (ordersCurrentPage === 1 ? " disabled" : "");
    prevLi.innerHTML = `<a class="page-link" href="#">«</a>`;
    prevLi.onclick = (e) => {
        e.preventDefault();
        if (ordersCurrentPage > 1) {
            ordersCurrentPage--;
            renderOrdersTable();
        }
    };
    pagination.appendChild(prevLi);

    // 頁碼
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement("li");
        li.className = "page-item" + (i === ordersCurrentPage ? " active" : "");
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.onclick = (e) => {
            e.preventDefault();
            ordersCurrentPage = i;
            renderOrdersTable();
        };
        pagination.appendChild(li);
    }

    // 下一頁
    const nextLi = document.createElement("li");
    nextLi.className = "page-item" + (ordersCurrentPage === totalPages ? " disabled" : "");
    nextLi.innerHTML = `<a class="page-link" href="#">»</a>`;
    nextLi.onclick = (e) => {
        e.preventDefault();
        if (ordersCurrentPage < totalPages) {
            ordersCurrentPage++;
            renderOrdersTable();
        }
    };
    pagination.appendChild(nextLi);
}

function deleteOrder(orderId, version) {
    const order = ordersData.find(
        o => o.id.orderId === orderId && o.id.version === version
    );
    if (!order) {
        alert("Order not found!");
        return;
    }
    if (!confirm(`Are you sure you want to delete order ${orderId} ?`)) {
        return;
    }
    fetch(`${ORDER_API_URL}/order/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order)
    })
    .then(resp => resp.json())
    .then(result => {
        if (result.code === "0000") {
            alert("Order deleted successfully!");
            localStorage.setItem("activeTab", "chart");
            window.location.reload();
        } else {
            alert("Delete failed: " + result.message);
        }
    })
    .catch(err => {
        alert("Delete failed: " + err);
    });
}

// 綁定表單送出事件
document.addEventListener("DOMContentLoaded", () => {
    const editOrderForm = document.getElementById("editOrderForm");
    if (editOrderForm) {
        editOrderForm.onsubmit = async function(e) {
            e.preventDefault();
            if (!editingOrder) return;

            // 準備要送出的資料
            const updatedOrder = {
                id: {
                    orderId: document.getElementById("editOrderId").value,
                    version: parseInt(document.getElementById("editOrderVersion").value, 10)
                },
                createTime: editingOrder.createTime,
                isPaid: parseInt(document.getElementById("editOrderIsPaid").value, 10),
                memberId: editingOrder.memberId,
                expiredAt: editingOrder.expiredAt,
                isDeleted: editingOrder.isDeleted
            };

            try {
                const resp = await fetch(`${ORDER_API_URL}/order/update`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedOrder)
                });
                const result = await resp.json();
                if (result.code === "0000") {
                    alert("Order updated successfully!");
                    // 讓頁面 reload 後仍停留在 Orders tab
                    localStorage.setItem("activeTab", "chart");
                    window.location.reload();
                } else {
                    alert("Update failed: " + result.message);
                }
            } catch (err) {
                alert("Update failed: " + err);
            }
        };
    }

    // 綁定 Orders tab 切換事件
    const chartTab = document.getElementById("chart-tab");
    if (chartTab) {
        chartTab.addEventListener("shown.bs.tab", function () {
            fetchOrders();
        });
    }

    // 保持在 Orders tab
    const activeTab = localStorage.getItem("activeTab");
    if (activeTab === "chart") {
        const chartTab = document.getElementById("chart-tab");
        if (chartTab) {
            // Bootstrap 5 tab API
            const tab = new bootstrap.Tab(chartTab);
            tab.show();
        }
        localStorage.removeItem("activeTab");
    }

    // 綁定搜尋與 filter 按鈕事件
    document.getElementById("searchOrderInput").addEventListener("input", function () {
        orderSearchKeyword = this.value;
        ordersCurrentPage = 1;
        renderOrdersTable();
    });

    document.getElementById("orderFilterAll").onclick = function () {
        orderServerFilter = "All";
        ordersCurrentPage = 1;
        setOrderFilterBtnStyle();
        renderOrdersTable();
    };
    document.getElementById("orderFilterServer1").onclick = function () {
        orderServerFilter = "Server 1";
        ordersCurrentPage = 1;
        setOrderFilterBtnStyle();
        renderOrdersTable();
    };
    document.getElementById("orderFilterServer2").onclick = function () {
        orderServerFilter = "Server 2";
        ordersCurrentPage = 1;
        setOrderFilterBtnStyle();
        renderOrdersTable();
    };
    document.getElementById("orderFilterServer3").onclick = function () {
        orderServerFilter = "Server 3";
        ordersCurrentPage = 1;
        setOrderFilterBtnStyle();
        renderOrdersTable();
    };

    // 設定按鈕樣式
    function setOrderFilterBtnStyle() {
        ["All", "Server1", "Server2", "Server3"].forEach((s, i) => {
            const btn = document.getElementById(`orderFilter${s.replace(" ", "")}`);
            if (btn) {
                btn.className = "btn " + (orderServerFilter === (s === "All" ? "All" : `Server ${i}`) ? "btn-primary" : "btn-secondary");
            }
        });
    }

    // 綁定 New Order 按鈕事件
    const newOrderBtn = document.getElementById("newOrderBtn");
    if (newOrderBtn) {
        const newOrderModal = new bootstrap.Modal(document.getElementById('newOrderModal'));
        const orderCreatedModal = new bootstrap.Modal(document.getElementById('orderCreatedModal'));
        newOrderBtn.addEventListener("click", () => {
            document.getElementById("newOrderForm").reset();
            newOrderModal.show();
        });

        // 綁定表單送出事件
        document.getElementById("newOrderForm").onsubmit = async function(e) {
            e.preventDefault();
            const isPaid = document.getElementById("newOrderIsPaid").checked ? 1 : 0;
            const memberId = document.getElementById("newOrderMemberId").value.trim();
            if (!memberId) {
                alert("Please enter member ID.");
                return;
            }
            // 取得本地現在時間（yyyy-MM-ddTHH:mm:ss）
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const createTime = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;

            try {
                const resp = await fetch(`${ORDER_API_URL}/order/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        createTime,
                        isPaid,
                        memberId
                    })
                });
                const result = await resp.json();
                if (result.code === "0000") {
                    newOrderModal.hide();
                    const order = result.data;
                    const body = document.getElementById("orderCreatedModalBody");
                    body.innerHTML = `
                        <div><strong>Order ID:</strong> ${order.id.orderId}</div>
                        <div><strong>Member ID:</strong> ${order.memberId}</div>
                        <div><strong>Create Time:</strong> ${order.createTime ? order.createTime.replace('T', ' ') : ''}</div>
                        <div><strong>Is Paid:</strong> ${order.isPaid ? "Yes" : "No"}</div>
                    `;
                    // 等 newOrderModal 關閉後再開 orderCreatedModal
                    document.getElementById('newOrderModal').addEventListener('hidden.bs.modal', function handler() {
                        orderCreatedModal.show();
                        document.getElementById('newOrderModal').removeEventListener('hidden.bs.modal', handler);
                    });
                    // 關閉 orderCreatedModal 後 reload
                    const closeBtn = document.getElementById("closeOrderCreatedBtn");
                    closeBtn.onclick = function() {
                        localStorage.setItem("activeTab", "chart");
                        window.location.reload();
                    };
                    document.getElementById('orderCreatedModal').addEventListener('hidden.bs.modal', function handler() {
                        localStorage.setItem("activeTab", "chart");
                        window.location.reload();
                        document.getElementById('orderCreatedModal').removeEventListener('hidden.bs.modal', handler);
                    });
                } else {
                    alert("Create failed: " + result.message);
                }
            } catch (err) {
                alert("Create failed: " + err);
            }
        };
    }
});