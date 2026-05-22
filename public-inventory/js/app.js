
// Initial data from SQLite (migrated)
const initialData = {
    products: [{"id":6,"name":"Vaso estampado para cafe","code":"1101","category":"Insumos","description":"","min_stock":300,"price":0.01,"current_stock":100,"image_url":"/uploads/1767391545985.jpg"}],
    movements: [{"id":5,"type":"IN","product_id":6,"quantity":100,"date":"2026-01-02","ref_number":"ccf 1500","observations":"Trajo Rosita"}],
    settings: {"company_name":"Churrr","logo_url":"/uploads/1767392677388.jpg"},
    users: [{"id":1,"username":"admin","role":"admin"},{"id":2,"username":"Abrahan","role":"admin"},{"id":3,"username":"Rosita","role":"readonly"}]
};

// State
const state = {
    user: JSON.parse(localStorage.getItem('user')) || null,
    products: JSON.parse(localStorage.getItem('products')) || initialData.products,
    movements: JSON.parse(localStorage.getItem('movements')) || initialData.movements,
    settings: JSON.parse(localStorage.getItem('settings')) || initialData.settings
};

// Apply initial settings on load
if (state.settings.company_name || state.settings.logo_url) {
    applySettings(state.settings);
}

// DOM Elements
const views = {
    login: document.getElementById('login-view'),
    dashboard: document.getElementById('dashboard-view')
};
const panels = {
    home: document.getElementById('home-panel'),
    products: document.getElementById('products-panel'),
    movements: document.getElementById('movements-panel'),
    reports: document.getElementById('reports-panel'),
    config: document.getElementById('config-panel')
};

// --- Auth ---
function initAuth() {
    if (state.user) {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    views.login.classList.remove('hidden');
    views.dashboard.classList.add('hidden');
}

function showDashboard() {
    views.login.classList.add('hidden');
    views.dashboard.classList.remove('hidden');
    document.getElementById('display-username').textContent = state.user.username;

    const isAdmin = state.user.role === 'admin';
    document.getElementById('nav-config').classList.toggle('hidden', !isAdmin);

    const btnAddProd = document.getElementById('btn-add-product');
    const btnAddMov = document.getElementById('btn-new-movement');
    if (btnAddProd) btnAddProd.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnAddMov) btnAddMov.style.display = isAdmin ? 'inline-flex' : 'none';

    loadDashboardData();
    loadSettings();
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    // Login with migrated users or demo
    const validUsers = [
        { username: 'admin', password: 'admin', role: 'admin' },
        { username: 'Abrahan', password: 'admin', role: 'admin' },
        { username: 'Rosita', password: 'admin', role: 'readonly' }
    ];
    
    const user = validUsers.find(u => u.username === username && u.password === password);
    if (user) {
        state.user = { username: user.username, role: user.role };
        localStorage.setItem('user', JSON.stringify(state.user));
        showDashboard();
    } else {
        alert('Credenciales inválidas');
    }
});

document.getElementById('logout-btn').addEventListener('click', logout);

function logout() {
    state.user = null;
    localStorage.removeItem('user');
    showLogin();
}

// --- Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.values(panels).forEach(p => p.classList.add('hidden'));
        const targetId = btn.dataset.target;
        const targetPanel = document.getElementById(targetId);
        targetPanel.classList.remove('hidden');

        if (targetId === 'home-panel') loadDashboardData();
        if (targetId === 'products-panel') loadProducts();
        if (targetId === 'movements-panel') loadMovements();
        if (targetId === 'reports-panel') loadReportsInitial();
        if (targetId === 'config-panel') loadConfigPanel();
    });
});

// --- Dashboard Logic ---
function loadDashboardData() {
    const products = state.products;
    const totalProducts = products.length;
    const totalValue = products.reduce((acc, p) => acc + (p.price * p.current_stock), 0);
    const lowStock = products.filter(p => p.current_stock <= p.min_stock).length;

    document.getElementById('stat-total-products').textContent = totalProducts;
    document.getElementById('stat-total-value').textContent = `$${totalValue.toFixed(2)}`;
    document.getElementById('stat-low-stock').textContent = lowStock;

    renderDashboardChart(products);
}

let dashboardChartInstance = null;

function renderDashboardChart(products) {
    const ctx = document.getElementById('dashboard-chart').getContext('2d');
    const categoryCounts = {};
    products.forEach(p => {
        const cat = p.category || 'Sin Categoría';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const labels = Object.keys(categoryCounts);
    const data = Object.values(categoryCounts);

    if (dashboardChartInstance) {
        dashboardChartInstance.destroy();
    }

    dashboardChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Productos por Categoría',
                data: data,
                backgroundColor: ['#8b5cf6', '#06b6d4', '#f472b6', '#10b981', '#f59e0b'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

// --- Products Logic ---
function loadProducts() {
    renderProductsTable(state.products);
}

function renderProductsTable(products) {
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '';
    products.forEach(p => {
        const tr = document.createElement('tr');
        const isLowStock = p.current_stock <= p.min_stock;
        if (isLowStock) tr.classList.add('low-stock-row');

        const imgHtml = p.image_url
            ? `<img src="${p.image_url}" alt="Foto" onclick="openImageModal('${p.image_url}')" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;">`
            : `<div style="width: 40px; height: 40px; background: rgba(139,92,246,0.2); border-radius: 4px;"></div>`;

        const nameHtml = isLowStock
            ? `<i class="ph ph-warning-circle low-stock-alert-icon"></i>${p.name}`
            : p.name;

        tr.innerHTML = `
            <td>${imgHtml}</td>
            <td>${p.code || '-'}</td>
            <td>${nameHtml}</td>
            <td>${p.category || '-'}</td>
            <td>${p.current_stock}</td>
            <td>$${p.price || 0}</td>
            <td class="actions-cell">
                ${state.user.role === 'admin' ? `
                <button class="btn-icon btn-edit" onclick="editProduct(${p.id})"><i class="ph ph-pencil"></i></button>
                <button class="btn-icon btn-delete" onclick="deleteProduct(${p.id})"><i class="ph ph-trash"></i></button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');

document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());

function openProductModal(product = null) {
    productForm.reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('product-modal-title').textContent = 'Nuevo Producto';
    document.getElementById('prod-image-preview').style.display = 'none';

    if (product) {
        document.getElementById('product-modal-title').textContent = 'Editar Producto';
        document.getElementById('prod-id').value = product.id;
        document.getElementById('prod-name').value = product.name;
        document.getElementById('prod-code').value = product.code;
        document.getElementById('prod-category').value = product.category;
        document.getElementById('prod-price').value = product.price;
        document.getElementById('prod-min-stock').value = product.min_stock;
        document.getElementById('prod-description').value = product.description || '';
        if (product.image_url) {
            const preview = document.getElementById('prod-image-preview');
            preview.src = product.image_url;
            preview.style.display = 'block';
        }
    }
    productModal.classList.remove('hidden');
}

window.editProduct = (id) => {
    const product = state.products.find(p => p.id === id);
    if (product) openProductModal(product);
};

window.deleteProduct = (id) => {
    if (!confirm('¿Eliminar producto?')) return;
    state.products = state.products.filter(p => p.id !== id);
    localStorage.setItem('products', JSON.stringify(state.products));
    loadProducts();
    loadDashboardData();
};

productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const fileInput = document.getElementById('prod-image');
    let imageUrl = null;

    if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            saveProduct(id, ev.target.result);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        const existing = id ? state.products.find(p => p.id == id) : null;
        saveProduct(id, existing?.image_url || null);
    }
});

function saveProduct(id, imageUrl) {
    const product = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('prod-name').value,
        code: document.getElementById('prod-code').value,
        category: document.getElementById('prod-category').value,
        price: parseFloat(document.getElementById('prod-price').value) || 0,
        min_stock: parseInt(document.getElementById('prod-min-stock').value) || 0,
        description: document.getElementById('prod-description').value,
        image_url: imageUrl,
        current_stock: id ? state.products.find(p => p.id == id)?.current_stock || 0 : 0
    };

    if (id) {
        const idx = state.products.findIndex(p => p.id == id);
        if (idx >= 0) state.products[idx] = product;
    } else {
        state.products.push(product);
    }

    localStorage.setItem('products', JSON.stringify(state.products));
    productModal.classList.add('hidden');
    loadProducts();
    loadDashboardData();
}

// --- Movements Logic ---
function loadMovements() {
    renderMovementsTable(state.movements, '#movements-table tbody');
}

function renderMovementsTable(movements, selector) {
    const tbody = document.querySelector(selector);
    tbody.innerHTML = '';
    const sorted = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(m => {
        const tr = document.createElement('tr');
        const typeBadge = m.type === 'IN'
            ? '<span style="color:var(--success); font-weight:bold">ENTRADA</span>'
            : '<span style="color:var(--danger); font-weight:bold">SALIDA</span>';

        const isAdmin = state.user.role === 'admin';
        const actions = (selector === '#movements-table tbody' && isAdmin)
            ? `<td class="actions-cell">
                 <button class="btn-icon btn-edit" onclick='openMovementModal(${JSON.stringify(m)})'><i class="ph ph-pencil"></i></button>
                 <button class="btn-icon btn-delete" onclick="deleteMovement(${m.id})"><i class="ph ph-trash"></i></button>
               </td>`
            : '';

        const product = state.products.find(p => p.id === m.product_id);
        tr.innerHTML = `
            <td>${m.date}</td>
            <td>${typeBadge}</td>
            <td>${m.ref_number || '-'}</td>
            <td>${product?.name || 'Desconocido'}</td>
            <td>${m.quantity}</td>
            <td>${m.observations || '-'}</td>
            ${selector === '#movements-table tbody' ? actions : ''}
        `;
        tbody.appendChild(tr);
    });
}

window.deleteMovement = (id) => {
    if (!confirm('¿Eliminar movimiento? El stock se revertirá.')) return;
    const mov = state.movements.find(m => m.id === id);
    if (mov) {
        const product = state.products.find(p => p.id === mov.product_id);
        if (product) {
            const change = mov.type === 'IN' ? -mov.quantity : mov.quantity;
            product.current_stock += change;
            localStorage.setItem('products', JSON.stringify(state.products));
        }
    }
    state.movements = state.movements.filter(m => m.id !== id);
    localStorage.setItem('movements', JSON.stringify(state.movements));
    loadMovements();
    loadProducts();
};

window.openImageModal = (url) => {
    const modal = document.getElementById('image-modal');
    document.getElementById('preview-image').src = url;
    modal.classList.remove('hidden');
};

const movementModal = document.getElementById('movement-modal');
const movementForm = document.getElementById('movement-form');

document.getElementById('btn-new-movement').addEventListener('click', () => openMovementModal());

function openMovementModal(movement = null) {
    const select = document.getElementById('mov-product');
    select.innerHTML = '';
    state.products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.code ? p.code + ' - ' : ''}${p.name} (Stock: ${p.current_stock})`;
        select.appendChild(option);
    });

    movementForm.reset();
    document.getElementById('mov-id').value = '';
    document.getElementById('mov-date').valueAsDate = new Date();

    document.querySelector('#movement-modal h3').textContent = movement ? 'Editar Movimiento' : 'Registrar Movimiento';

    if (movement) {
        document.getElementById('mov-id').value = movement.id;
        document.querySelector(`input[name="mov-type"][value="${movement.type}"]`).checked = true;
        document.getElementById('mov-product').value = movement.product_id;
        document.getElementById('mov-quantity').value = movement.quantity;
        document.getElementById('mov-date').value = movement.date;
        document.getElementById('mov-ref').value = movement.ref_number;
        document.getElementById('mov-obs').value = movement.observations;
    }

    movementModal.classList.remove('hidden');
}

movementForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('mov-id').value;
    const data = {
        type: document.querySelector('input[name="mov-type"]:checked').value,
        product_id: parseInt(document.getElementById('mov-product').value),
        quantity: parseInt(document.getElementById('mov-quantity').value),
        date: document.getElementById('mov-date').value,
        ref_number: document.getElementById('mov-ref').value,
        observations: document.getElementById('mov-obs').value
    };

    const product = state.products.find(p => p.id === data.product_id);
    if (!product) {
        alert('Selecciona un producto');
        return;
    }

    if (id) {
        const idx = state.movements.findIndex(m => m.id == id);
        if (idx >= 0) {
            const oldMov = state.movements[idx];
            const oldProduct = state.products.find(p => p.id === oldMov.product_id);
            if (oldProduct) {
                const revert = oldMov.type === 'IN' ? -oldMov.quantity : oldMov.quantity;
                oldProduct.current_stock += revert;
            }
            const newChange = data.type === 'IN' ? data.quantity : -data.quantity;
            product.current_stock += newChange;
            state.movements[idx] = { ...data, id: parseInt(id), product_name: product.name };
        }
    } else {
        const change = data.type === 'IN' ? data.quantity : -data.quantity;
        product.current_stock += change;
        state.movements.push({ ...data, id: Date.now(), product_name: product.name });
    }

    localStorage.setItem('products', JSON.stringify(state.products));
    localStorage.setItem('movements', JSON.stringify(state.movements));
    movementModal.classList.add('hidden');
    loadMovements();
    loadProducts();
});

// --- Reports Logic ---
function loadReportsInitial() {
    const select = document.getElementById('filter-product');
    select.innerHTML = '<option value="">Todos los productos</option>';
    state.products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
    });
    filterReports();
}

function filterReports() {
    let filtered = state.movements;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    const prodId = document.getElementById('filter-product').value;
    const ref = document.getElementById('filter-ref').value.toLowerCase();

    if (dateFrom) filtered = filtered.filter(m => m.date >= dateFrom);
    if (dateTo) filtered = filtered.filter(m => m.date <= dateTo);
    if (prodId) filtered = filtered.filter(m => m.product_id == prodId);
    if (ref) filtered = filtered.filter(m => (m.ref_number || '').toLowerCase().includes(ref));

    renderMovementsTable(filtered, '#reports-table tbody');

    const rangeText = (dateFrom || dateTo)
        ? `Desde: ${dateFrom || 'Inicio'} - Hasta: ${dateTo || 'Hoy'}`
        : 'Histórico Completo';
    document.getElementById('report-date-range').textContent = rangeText;
}

document.getElementById('filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    filterReports();
});

document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-form').reset();
    filterReports();
});

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
    });
});

// --- Settings ---
function loadSettings() {
    applySettings(state.settings);
}

function applySettings(settings) {
    if (settings.company_name) {
        document.getElementById('brand-name').textContent = settings.company_name;
    }
    if (settings.logo_url) {
        const logo = document.getElementById('brand-logo');
        logo.src = settings.logo_url;
        logo.style.display = 'block';
        document.querySelector('#brand-name i')?.classList.add('hidden');
        const printLogo = document.getElementById('print-logo');
        if (printLogo) {
            printLogo.src = settings.logo_url;
            printLogo.style.display = 'block';
        }
    }
}

function loadConfigPanel() {
    if (state.settings.company_name) document.getElementById('set-company-name').value = state.settings.company_name;
    if (state.settings.logo_url) document.getElementById('set-logo-preview').src = state.settings.logo_url;
}

document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const companyName = document.getElementById('set-company-name').value;
    const file = document.getElementById('set-logo').files[0];

    if (companyName) {
        state.settings.company_name = companyName;
    }

    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            state.settings.logo_url = ev.target.result;
            localStorage.setItem('settings', JSON.stringify(state.settings));
            alert('Configuración guardada');
            loadSettings();
        };
        reader.readAsDataURL(file);
    } else {
        localStorage.setItem('settings', JSON.stringify(state.settings));
        alert('Configuración guardada');
        loadSettings();
    }
});

// --- Export Utils ---
function exportToCSV(data, filename) {
    if (!data || !data.length) {
        alert('No hay datos para exportar');
        return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(';')];
    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(';'));
    }
    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

window.exportProducts = () => {
    const data = state.products.map(p => ({
        Codigo: p.code || '',
        Nombre: p.name,
        Categoria: p.category || '',
        Precio: p.price,
        Stock: p.current_stock,
        StockMin: p.min_stock,
        Descripcion: p.description || ''
    }));
    exportToCSV(data, `Productos_${new Date().toISOString().split('T')[0]}.csv`);
};

window.exportMovements = () => {
    const data = state.movements.map(m => ({
        Fecha: m.date,
        Tipo: m.type,
        Producto: state.products.find(p => p.id === m.product_id)?.name || '',
        Cantidad: m.quantity,
        Referencia: m.ref_number || '',
        Observaciones: m.observations || ''
    }));
    exportToCSV(data, `Movimientos_${new Date().toISOString().split('T')[0]}.csv`);
};

window.exportReport = () => {
    let filtered = state.movements;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    const prodId = document.getElementById('filter-product').value;
    const ref = document.getElementById('filter-ref').value.toLowerCase();

    if (dateFrom) filtered = filtered.filter(m => m.date >= dateFrom);
    if (dateTo) filtered = filtered.filter(m => m.date <= dateTo);
    if (prodId) filtered = filtered.filter(m => m.product_id == prodId);
    if (ref) filtered = filtered.filter(m => (m.ref_number || '').toLowerCase().includes(ref));

    const data = filtered.map(m => ({
        Fecha: m.date,
        Tipo: m.type,
        Producto: state.products.find(p => p.id === m.product_id)?.name || '',
        Cantidad: m.quantity,
        Referencia: m.ref_number || '',
        Observaciones: m.observations || ''
    }));
    exportToCSV(data, `Reporte_${new Date().toISOString().split('T')[0]}.csv`);
};

// Init
initAuth();
