// local
// const ORDER_URL_1 = `http://localhost:8081`;
// const ORDER_URL_2 = `http://localhost:8082`;
// const ORDER_URL_3 = `http://localhost:8083`;
// production
const ORDER_URL_1 = `http://18.222.111.89:8081`;
const ORDER_URL_2 = `http://3.15.149.110:8082`;
const ORDER_URL_3 = `http://52.15.151.104:8083`;
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
async function fetchOrders(startDate = "2023-01-01", endDate = '2025-12-31') {
    const urls = [
        `${ORDER_URL_1}/order/findRange?startDate=${startDate}&endDate=${endDate}`,
        `${ORDER_URL_2}/order/findRange?startDate=${startDate}&endDate=${endDate}`,
        `${ORDER_URL_3}/order/findRange?startDate=${startDate}&endDate=${endDate}`
    ];
    let lastError = null;
    for (let i = 0; i < urls.length; i++) {
        try {
            const response = await fetch(urls[i]);
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
                return;
            } else {
                ordersData = [];
                renderOrdersTable([], "API Error: " + result.message);
                renderOrdersPagination();
                return;
            }
        } catch (error) {
            lastError = error;
            // 如果是最後一個才顯示錯誤
            if (i === urls.length - 1) {
                ordersData = [];
                renderOrdersTable([], "All servers are down, please try again later.");
                renderOrdersPagination();
            }
            // 否則繼續嘗試下一個 URL
        }
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

    // 分頁
    const start = (ordersCurrentPage - 1) * ORDER_PAGE_SIZE;
    const end = start + ORDER_PAGE_SIZE;
    const pageOrders = filteredOrders.slice(start, end);

    // 渲染 tbody
    if (errorMsg) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-primary">${errorMsg}</td></tr>`;
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
            <td>$${order.price}</td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editOrder('${order.id.orderId}', ${order.id.version})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteOrder('${order.id.orderId}', ${order.id.version})">Delete</button>
            </td>
        </tr>
    `).join('');

    // 新增總筆數 row
    const totalRow = document.createElement("tr");
    totalRow.innerHTML = `
        <td colspan="5" class="text-start text-secondary">
            Total: ${filteredOrders.length} orders
        </td>
    `;
    tbody.appendChild(totalRow);

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
        const resp = await fetch(`${ORDER_URL_1}/order/history?orderId=${encodeURIComponent(orderId)}&createTime=${encodeURIComponent(dateOnly)}`);
        const result = await resp.json();
        if (result.code === "0000" && Array.isArray(result.data) && result.data.length > 0) {
            body.innerHTML = `
                <table class="table table-bordered table-striped">
                    <thead>
                        <tr>
                            <th>Version</th>
                            <th>Create Time</th>
                            <th>Is Paid</th>
                            <th>Price</th>
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
                                <td>$${order.price}</td>
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
    document.getElementById("editOrderPrice").value = order.price || 1;

    // 綁定價格增減按鈕事件
    const priceInput = document.getElementById("editOrderPrice");
    const minusBtn = document.getElementById("editOrderPriceMinus");
    const plusBtn = document.getElementById("editOrderPricePlus");

    // 先移除舊的事件（避免重複綁定）
    minusBtn.onclick = null;
    plusBtn.onclick = null;

    minusBtn.onclick = function() {
        let value = parseInt(priceInput.value) || 1;
        value = Math.max(1, value - 10);
        priceInput.value = value;
    };
    plusBtn.onclick = function() {
        let value = parseInt(priceInput.value) || 1;
        value = Math.min(1000, value + 10);
        priceInput.value = value;
    };

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
            renderOrdersTable(data);
            renderOrdersPagination(data);
        }
    };
    pagination.appendChild(prevLi);

    // 頁碼顯示邏輯
    // 若總頁數 <= 5，全部顯示
    // 若總頁數 > 5，顯示 3 個開頭、3 個結尾，中間用 "..."，點擊時動態調整
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement("li");
            li.className = "page-item" + (i === ordersCurrentPage ? " active" : "");
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.onclick = (e) => {
                e.preventDefault();
                ordersCurrentPage = i;
                renderOrdersTable(data);
                renderOrdersPagination(data);
            };
            pagination.appendChild(li);
        }
    } else {
        let pages = [];
        if (ordersCurrentPage <= 3) {
            pages = [1, 2, 3, "...", totalPages - 2, totalPages - 1, totalPages];
        } else if (ordersCurrentPage >= totalPages - 2) {
            pages = [1, 2, 3, "...", totalPages - 2, totalPages - 1, totalPages];
            // 讓 active 在最後三頁時顯示正確
            if (ordersCurrentPage === totalPages - 2) pages = [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            if (ordersCurrentPage === totalPages - 1) pages = [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            if (ordersCurrentPage === totalPages) pages = [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [ordersCurrentPage - 1, ordersCurrentPage, ordersCurrentPage + 1, "...", totalPages - 2, totalPages - 1, totalPages];
            if (ordersCurrentPage > 3) pages.unshift(1, "...");
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
                li.className = "page-item" + (p === ordersCurrentPage ? " active" : "");
                li.innerHTML = `<a class="page-link" href="#">${p}</a>`;
                li.onclick = (e) => {
                    e.preventDefault();
                    ordersCurrentPage = p;
                    renderOrdersTable(data);
                    renderOrdersPagination(data);
                };
                pagination.appendChild(li);
            }
        });
    }

    // 下一頁
    const nextLi = document.createElement("li");
    nextLi.className = "page-item" + (ordersCurrentPage === totalPages ? " disabled" : "");
    nextLi.innerHTML = `<a class="page-link" href="#">»</a>`;
    nextLi.onclick = (e) => {
        e.preventDefault();
        if (ordersCurrentPage < totalPages) {
            ordersCurrentPage++;
            renderOrdersTable(data);
            renderOrdersPagination(data);
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
    fetch(`${ORDER_URL_1}/order/delete`, {
        method: "POST",
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
                isDeleted: editingOrder.isDeleted,
                price: parseInt(document.getElementById("editOrderPrice").value, 10) // 新增 price 欄位
            };

            try {
                const resp = await fetch(`${ORDER_URL_1}/order/update`, {
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
        fetchOrders(); // 重新取得所有 server 的訂單
    };
    document.getElementById("orderFilterServer1").onclick = async function () {
        orderServerFilter = "Server 1";
        ordersCurrentPage = 1;
        setOrderFilterBtnStyle();

        // 顯示 loading spinner
        const tbody = document.querySelector("#orders-table tbody");
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="spinner-border text-primary" role="status" style="width:2rem;height:2rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const resp = await fetch(`${ORDER_URL_1}/order/findRangeLocal?startDate=2023-01-01&endDate=2025-12-31`);
            const result = await resp.json();
            if (Array.isArray(result)) {
                const sorted = result.sort((a, b) => {
                    const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
                    const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
                    return tb - ta;
                });
                renderOrdersTable(sorted);
                renderOrdersPagination(sorted);
            } else {
                renderOrdersTable([], "API Error: Unexpected response format");
                renderOrdersPagination([]);
            }
        } catch (error) {
            renderOrdersTable([], "Server is recovering, please try again later.");
            renderOrdersPagination([]);
        }
    };
    document.getElementById("orderFilterServer2").onclick = async function () {
        orderServerFilter = "Server 2";
        ordersCurrentPage = 1;
        setOrderFilterBtnStyle();

        // 顯示 loading spinner
        const tbody = document.querySelector("#orders-table tbody");
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="spinner-border text-primary" role="status" style="width:2rem;height:2rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const resp = await fetch(`${ORDER_URL_2}/order/findRangeLocal?startDate=2023-01-01&endDate=2025-12-31`);
            const result = await resp.json();
            if (Array.isArray(result)) {
                const sorted = result.sort((a, b) => {
                    const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
                    const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
                    return tb - ta;
                });
                renderOrdersTable(sorted);
                renderOrdersPagination(sorted);
            } else {
                renderOrdersTable([], "API Error: Unexpected response format");
                renderOrdersPagination([]);
            }
        } catch (error) {
            renderOrdersTable([], "Server is recovering, please try again later.");
            renderOrdersPagination([]);
        }
    };
    document.getElementById("orderFilterServer3").onclick = async function () {
        orderServerFilter = "Server 3";
        ordersCurrentPage = 1;
        setOrderFilterBtnStyle();

        // 顯示 loading spinner
        const tbody = document.querySelector("#orders-table tbody");
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="spinner-border text-primary" role="status" style="width:2rem;height:2rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const resp = await fetch(`${ORDER_URL_3}/order/findRangeLocal?startDate=2023-01-01&endDate=2025-12-31`);
            const result = await resp.json();
            if (Array.isArray(result)) {
                const sorted = result.sort((a, b) => {
                    const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
                    const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
                    return tb - ta;
                });
                renderOrdersTable(sorted);
                renderOrdersPagination(sorted);
            } else {
                renderOrdersTable([], "API Error: Unexpected response format");
                renderOrdersPagination([]);
            }
        } catch (error) {
            renderOrdersTable([], "Server is recovering, please try again later.");
            renderOrdersPagination([]);
        }
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
            const price = parseInt(document.getElementById("newOrderPrice").value, 10); // 取得 price 欄位
            if (!memberId) {
                alert("Please enter member ID.");
                return;
            }
            if (isNaN(price) || price < 1 || price > 1000) {
                alert("Price 必須介於 1~1000 之間");
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
            console.log("createTime:", createTime);
            console.log("New Order:", JSON.stringify({
                        createTime,
                        isPaid,
                        memberId,
                        price // 新增 price 欄位
                    }))

            try {
                const resp = await fetch(`${ORDER_URL_1}/order/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        createTime,
                        isPaid,
                        memberId,
                        price // 新增 price 欄位
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
                        <div><strong>Price:</strong> ${order.price}</div>
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