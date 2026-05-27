// ===================================
// KPI Evaluation Module
// ===================================

const KpiEvaluation = {
    records: [],
    filteredRecords: [],
    unsubscribe: null,
    filters: {
        startDate: new Date().toISOString().split('T')[0].slice(0, 7) + '-01', // First day of current month
        endDate: new Date().toISOString().split('T')[0]
    },

    kpiAspects: [
        { key: 'asistencia', label: 'Asistencia', icon: '📅' },
        { key: 'puntualidad', label: 'Puntualidad', icon: '⏰' },
        { key: 'productividad', label: 'Productividad', icon: '📈' },
        { key: 'calidad', label: 'Calidad', icon: '⭐' },
        { key: 'conocimiento', label: 'Conocimiento', icon: '📚' },
        { key: 'proactivo', label: 'Proactivo', icon: '💡' },
        { key: 'trabajoEquipo', label: 'Trabajo en Equipo', icon: '🤝' },
        { key: 'liderazgo', label: 'Liderazgo', icon: '🏆' }
    ],

    async render() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }

        const canCreate = window.permissions?.canCreate;
        const canDelete = window.permissions?.canDelete;

        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>📋 Evaluación KPI</h1>
                    <p>Evaluación de desempeño del personal</p>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <label for="kpi-filter-start" style="margin-bottom: 0; white-space: nowrap; font-size: 0.85rem;">📅 Desde:</label>
                        <input type="date" id="kpi-filter-start" value="${this.filters.startDate}" style="padding: 0.5rem; font-size: 1rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); min-height: 44px;">
                        <label for="kpi-filter-end" style="margin-bottom: 0; white-space: nowrap; font-size: 0.85rem;">Hasta:</label>
                        <input type="date" id="kpi-filter-end" value="${this.filters.endDate}" style="padding: 0.5rem; font-size: 1rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); min-height: 44px;">
                    </div>
                    <button id="btn-export-kpi" class="btn btn-secondary">
                        📥 Exportar Excel
                    </button>
                    <button id="btn-add-kpi" class="btn btn-primary ${!canCreate ? 'btn-disabled' : ''}" ${!canCreate ? 'disabled' : ''}>
                        ➕ Nueva Evaluación
                    </button>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="stats-grid" style="margin-bottom: 1.5rem;">
                <div class="stat-card">
                    <small>EVALUACIONES</small>
                    <p id="kpi-stat-total">0</p>
                </div>
                <div class="stat-card">
                    <small>PROMEDIO GENERAL</small>
                    <p id="kpi-stat-avg">0.00</p>
                </div>
                <div class="stat-card">
                    <small>MEJOR ASPECTO</small>
                    <p id="kpi-stat-best" style="font-size: 0.9rem;">-</p>
                </div>
                <div class="stat-card">
                    <small>ASPECTO A MEJORAR</small>
                    <p id="kpi-stat-worst" style="font-size: 0.9rem;">-</p>
                </div>
            </div>

            <div class="card">
                <div class="table-container" style="overflow-x: auto;">
                    <table class="data-table" id="kpi-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Empleado</th>
                                <th>Cargo</th>
                                ${this.kpiAspects.map(a => `<th style="text-align: center;">${a.icon}<br><span style="font-size: 0.7rem;">${a.label}</span></th>`).join('')}
                                <th style="text-align: center;">Promedio</th>
                                <th>Observaciones</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="kpi-table-body">
                            <tr>
                                <td colspan="${3 + this.kpiAspects.length + 3}" style="text-align: center; padding: 2rem;">Cargando evaluaciones...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('kpi-filter-start').addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            this.applyFilters();
        });
        document.getElementById('kpi-filter-end').addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            this.applyFilters();
        });
        document.getElementById('btn-add-kpi').addEventListener('click', () => {
            if (canCreate) this.showForm();
        });
        document.getElementById('btn-export-kpi').addEventListener('click', () => this.exportToExcel());

        // Load records
        await this.loadRecords();
    },

    async loadRecords() {
        try {
            const db = firebase.firestore();

            // Unsubscribe from previous listener
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
            }

            this.unsubscribe = db.collection('kpiEvaluations')
                .orderBy('fecha', 'desc')
                .onSnapshot(snapshot => {
                    this.records = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    this.applyFilters();
                }, error => {
                    console.error('Error loading KPI records:', error);
                    showToast('Error al cargar evaluaciones', 'error');
                });
        } catch (error) {
            console.error('Error setting up KPI listener:', error);
            showToast('Error al conectar con la base de datos', 'error');
        }
    },

    applyFilters() {
        this.filteredRecords = this.records.filter(r => {
            if (!r.fecha) return true;
            const recordDate = r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha);
            const dateStr = recordDate.toISOString().split('T')[0];

            if (this.filters.startDate && dateStr < this.filters.startDate) return false;
            if (this.filters.endDate && dateStr > this.filters.endDate) return false;
            return true;
        });

        if (this.isMobile) {
            this.renderMobileCards();
        } else {
            this.updateTable();
            this.updateStats();
        }
    },

    updateTable() {
        const tableBody = document.getElementById('kpi-table-body');
        if (!tableBody) return;

        const canEdit = window.permissions?.canEdit;
        const canDelete = window.permissions?.canDelete;

        if (this.filteredRecords.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${3 + this.kpiAspects.length + 3}" style="text-align: center; padding: 2rem;">No hay evaluaciones para el período seleccionado.</td>
                </tr>
            `;
            return;
        }

        // Calculate averages and sort by them (Highest to Lowest)
        const sortedRecords = this.filteredRecords.map(r => {
            const scores = this.kpiAspects.map(a => Number(r[a.key] || 0));
            const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
            return { ...r, _avg: avg, _scores: scores };
        }).sort((a, b) => b._avg - a._avg);

        tableBody.innerHTML = sortedRecords.map((record, index) => {
            const scores = record._scores;
            const avg = record._avg;

            // New Vibrant Palette
            const getColor = (val) => {
                if (val >= 8) return { main: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }; // Emerald 500
                if (val >= 6) return { main: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }; // Amber 500
                return { main: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' }; // Rose 500
            };

            const avgColors = getColor(avg);

            return `
                <tr>
                    <td style="white-space: nowrap; font-size: 0.85rem;">${record.fecha ? formatDate(record.fecha, false) : ''}</td>
                    <td><strong style="color: #1a1a1a; font-size: 0.95rem;">${index + 1}. ${sanitizeHTML(record.empleado || '')}</strong></td>
                    <td style="font-size: 0.8rem; color: #555; font-weight: 500;">${sanitizeHTML(record.cargo || '')}</td>
                    ${scores.map(score => {
                const colors = getColor(score);
                return `
                        <td style="text-align: center; background: ${colors.bg}; padding: 0.6rem 0.3rem; border-right: 1px solid rgba(0,0,0,0.05);">
                            <div style="font-weight: 900; color: ${colors.main}; font-size: 1.05rem; line-height: 1;">${score}</div>
                            <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; margin-top: 4px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05);">
                                <div style="width: ${score * 10}%; height: 100%; background: ${colors.main};"></div>
                            </div>
                        </td>`;
            }).join('')}
                    <td style="text-align: center; font-weight: 900; min-width: 130px; background: #f8fafc; border-left: 2px solid #e2e8f0;">
                        <div style="color: ${avgColors.main}; font-size: 1.3rem; margin-bottom: 5px; font-family: 'Inter', sans-serif;">${avg.toFixed(1)}</div>
                        <div style="width: 90%; margin: 0 auto; height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1);">
                            <div style="width: ${avg * 10}%; height: 100%; background: ${avgColors.main}; box-shadow: inset 0 1px 2px rgba(255,255,255,0.3);"></div>
                        </div>
                    </td>
                    <td style="max-width: 250px; white-space: normal; font-size: 0.85rem; color: #1a1a1a; line-height: 1.5; padding: 0.75rem;">${sanitizeHTML(record.observaciones || '')}</td>
                    <td class="actions-cell" style="background: #fff;">
                        <div style="display: flex; gap: 0.4rem; justify-content: center;">
                            <button class="btn-icon btn-secondary btn-edit-kpi ${!canEdit ? 'btn-disabled' : ''}" 
                                    data-id="${record.id}" ${!canEdit ? 'disabled' : ''} title="Editar">✏️</button>
                            <button class="btn-icon btn-danger btn-delete-kpi ${!canDelete ? 'btn-disabled' : ''}" 
                                    data-id="${record.id}" ${!canDelete ? 'disabled' : ''} title="Eliminar">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Single delegated listener
        if (!this._tableListenerAdded) {
            tableBody.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.btn-edit-kpi');
                if (editBtn && !editBtn.disabled) {
                    this.showForm(editBtn.dataset.id);
                    return;
                }
                const deleteBtn = e.target.closest('.btn-delete-kpi');
                if (deleteBtn && !deleteBtn.disabled) {
                    this.deleteRecord(deleteBtn.dataset.id);
                    return;
                }
            });
            this._tableListenerAdded = true;
        }
    },

    updateStats() {
        const total = this.filteredRecords.length;
        document.getElementById('kpi-stat-total').textContent = total;

        if (total === 0) {
            document.getElementById('kpi-stat-avg').textContent = '0.00';
            document.getElementById('kpi-stat-best').textContent = '-';
            document.getElementById('kpi-stat-worst').textContent = '-';
            return;
        }

        // Calculate averages per aspect
        const aspectAvgs = this.kpiAspects.map(a => {
            const sum = this.filteredRecords.reduce((s, r) => s + Number(r[a.key] || 0), 0);
            return { label: a.label, icon: a.icon, avg: sum / total };
        });

        const generalAvg = aspectAvgs.reduce((s, a) => s + a.avg, 0) / aspectAvgs.length;
        const best = aspectAvgs.reduce((a, b) => a.avg > b.avg ? a : b);
        const worst = aspectAvgs.reduce((a, b) => a.avg < b.avg ? a : b);

        const avgEl = document.getElementById('kpi-stat-avg');
        avgEl.textContent = generalAvg.toFixed(2);
        avgEl.style.color = generalAvg >= 8 ? '#10b981' : generalAvg >= 6 ? '#f59e0b' : '#f43f5e';

        const bestEl = document.getElementById('kpi-stat-best');
        bestEl.textContent = `${best.icon} ${best.label} (${best.avg.toFixed(1)})`;
        bestEl.style.color = '#10b981';
        bestEl.style.fontWeight = '700';

        const worstEl = document.getElementById('kpi-stat-worst');
        worstEl.textContent = `${worst.icon} ${worst.label} (${worst.avg.toFixed(1)})`;
        worstEl.style.color = '#f43f5e';
        worstEl.style.fontWeight = '700';
    },

    showForm(recordId = null) {
        const record = recordId ? this.records.find(r => r.id === recordId) : null;
        const isEdit = !!record;

        let dateValue = '';
        if (record && record.fecha) {
            const d = record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha);
            dateValue = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
        }
        if (!dateValue) {
            dateValue = new Date().toISOString().split('T')[0];
        }

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>${isEdit ? '✏️ Editar' : '➕ Nueva'} Evaluación KPI</h2>
                    <button class="btn-icon btn-close-modal" title="Cerrar">✕</button>
                </div>
                <form id="kpi-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label>📅 Fecha</label>
                            <input type="date" id="kpi-fecha" value="${dateValue}" required>
                        </div>
                        <div class="form-group">
                            <label>👤 Empleado</label>
                            <input type="text" id="kpi-empleado" value="${record ? sanitizeHTML(record.empleado || '') : ''}" required placeholder="Nombre del empleado">
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 1rem;">
                        <label>💼 Cargo / Puesto</label>
                        <input type="text" id="kpi-cargo" value="${record ? sanitizeHTML(record.cargo || '') : ''}" placeholder="Cargo del empleado">
                    </div>

                    <div style="margin-top: 1.5rem; padding: 1rem; background: var(--gray-50); border-radius: var(--radius-lg);">
                        <h3 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-secondary);">Puntuación (1 al 10)</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                            ${this.kpiAspects.map(a => `
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.85rem;">${a.icon} ${a.label}</label>
                                    <input type="number" id="kpi-${a.key}" min="1" max="10" value="${record ? (record[a.key] || '') : ''}" placeholder="1-10" style="text-align: center; font-weight: 700;">
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 1rem;">
                        <label>📝 Observaciones</label>
                        <textarea id="kpi-observaciones" rows="3" placeholder="Comentarios sobre el desempeño del empleado...">${record ? sanitizeHTML(record.observaciones || '') : ''}</textarea>
                    </div>

                    <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
                        <button type="button" class="btn btn-secondary btn-close-modal">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-kpi-save">
                            ${isEdit ? '💾 Actualizar' : '✅ Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('show'));

        // Close handlers
        modal.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Form submit
        document.getElementById('kpi-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('btn-kpi-save');
            setButtonLoading(saveBtn, true);

            try {
                const dateVal = document.getElementById('kpi-fecha').value;
                let firebaseDate = null;
                if (dateVal) {
                    const [y, m, d] = dateVal.split('-').map(Number);
                    const localDate = new Date(y, m - 1, d, 12, 0, 0);
                    firebaseDate = firebase.firestore.Timestamp.fromDate(localDate);
                }

                const data = {
                    fecha: firebaseDate,
                    empleado: document.getElementById('kpi-empleado').value.trim(),
                    cargo: document.getElementById('kpi-cargo').value.trim(),
                    observaciones: document.getElementById('kpi-observaciones').value.trim(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                // Collect scores
                this.kpiAspects.forEach(a => {
                    const val = Number(document.getElementById(`kpi-${a.key}`).value) || 0;
                    data[a.key] = Math.min(10, Math.max(0, val));
                });

                const db = firebase.firestore();
                if (recordId) {
                    await db.collection('kpiEvaluations').doc(recordId).update(data);
                    showToast('✓ Evaluación actualizada', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = firebase.auth().currentUser.uid;
                    await db.collection('kpiEvaluations').add(data);
                    showToast('✓ Evaluación creada', 'success');
                }

                modal.remove();
            } catch (error) {
                console.error('Error saving KPI:', error);
                showToast('Error al guardar: ' + error.message, 'error');
                setButtonLoading(saveBtn, false);
            }
        });
    },

    async deleteRecord(recordId) {
        if (!window.showCenteredConfirm) {
            if (!confirm('¿Eliminar esta evaluación?')) return;
        } else {
            const confirmed = await window.showCenteredConfirm(
                '¿Eliminar evaluación?',
                'Esta acción no se puede deshacer.',
                'Eliminar',
                'Cancelar'
            );
            if (!confirmed) return;
        }

        try {
            await firebase.firestore().collection('kpiEvaluations').doc(recordId).delete();
            showToast('✓ Evaluación eliminada', 'success');
        } catch (error) {
            console.error('Error deleting KPI:', error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    exportToExcel() {
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos para exportar.', 'warning');
            return;
        }

        const headers = [
            'Ranking', 'Fecha', 'Empleado', 'Cargo',
            ...this.kpiAspects.map(a => a.label),
            'Promedio', 'Observaciones'
        ];

        // Sort records by average score (Highest to Lowest)
        const sortedForExport = this.filteredRecords.map(r => {
            const scores = this.kpiAspects.map(a => Number(r[a.key] || 0));
            const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
            return { ...r, _avg: avg, _scores: scores };
        }).sort((a, b) => b._avg - a._avg);

        const rows = sortedForExport.map((r, index) => {
            return [
                index + 1,
                r.fecha ? formatDate(r.fecha, false) : '',
                r.empleado || '',
                r.cargo || '',
                ...r._scores,
                Math.round(r._avg * 10) / 10,
                r.observaciones || ''
            ];
        });

        const finalAOA = [
            ['EVALUACIÓN KPI - RANKING DE DESEMPEÑO'],
            [`Período: ${this.filters.startDate || '(Inicio)'} al ${this.filters.endDate || '(Fin)'}`],
            [],
            headers,
            ...rows
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(finalAOA);
        worksheet['!cols'] = [
            { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
            ...this.kpiAspects.map(() => ({ wch: 14 })),
            { wch: 10 }, { wch: 40 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'KPI');

        const dateNow = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Evaluacion_KPI_${dateNow}.xlsx`);
        showToast('Reporte KPI exportado.');
    },
    // ============= MOBILE RENDER =============
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        this.isMobile = true;
        const canCreate = window.permissions?.canCreate;

        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;color:var(--m-text);">📋 Evaluación KPI</h1>
                <p style="font-size:0.78rem;color:var(--m-text-secondary);">Desempeño del personal</p>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
                <input type="date" id="mkpi-start" value="${this.filters.startDate}" style="flex:1;padding:10px;border:1px solid #e5e5ea;border-radius:12px;font-size:0.85rem;background:white;min-height:42px;font-family:var(--font-family);">
                <input type="date" id="mkpi-end" value="${this.filters.endDate}" style="flex:1;padding:10px;border:1px solid #e5e5ea;border-radius:12px;font-size:0.85rem;background:white;min-height:42px;font-family:var(--font-family);">
            </div>
            <div class="m-stats-row" id="mkpi-stats">
                <div class="m-stat-chip"><div class="m-stat-chip-label">Evaluaciones</div><div class="m-stat-chip-value" id="mkpi-total">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Promedio</div><div class="m-stat-chip-value" id="mkpi-avg">0.0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Mejor Aspecto</div><div class="m-stat-chip-value" id="mkpi-best" style="font-size:0.85rem;">-</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">A Mejorar</div><div class="m-stat-chip-value" id="mkpi-worst" style="font-size:0.85rem;">-</div></div>
            </div>
            <div class="m-actions-bar">
                <button class="btn btn-primary" id="mkpi-btn-add" style="border-radius:20px;">➕ Nueva Evaluación</button>
                <button class="btn" id="mkpi-btn-export" style="border-radius:20px;">📥 Excel</button>
            </div>
            <div class="m-data-list" id="mkpi-data-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando evaluaciones...</div>
            </div>
        `;

        document.getElementById('mkpi-start').addEventListener('change', e => { this.filters.startDate = e.target.value; this.applyFilters(); });
        document.getElementById('mkpi-end').addEventListener('change', e => { this.filters.endDate = e.target.value; this.applyFilters(); });
        document.getElementById('mkpi-btn-add').addEventListener('click', () => { if (canCreate) this.showForm(); });
        document.getElementById('mkpi-btn-export').addEventListener('click', () => this.exportToExcel());

        await this.loadRecords();
    },

    renderMobileCards() {
        var list = document.getElementById('mkpi-data-list');
        if (!list) return;

        var canEdit = window.permissions?.canEdit;
        var canDelete = window.permissions?.canDelete;

        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📊</div><div class="m-empty-title">Sin evaluaciones</div><div class="m-empty-text">No hay evaluaciones para este período.</div></div>';
        } else {
            var sorted = this.filteredRecords.map(function(r) {
                var scores = this.kpiAspects.map(function(a) { return Number(r[a.key] || 0); });
                var avg = scores.reduce(function(s, v) { return s + v; }, 0) / scores.length;
                return { ...r, _avg: avg, _scores: scores };
            }, this).sort(function(a, b) { return b._avg - a._avg; });

            list.innerHTML = sorted.map(function(record, index) {
                var avgColor = record._avg >= 8 ? '#10b981' : record._avg >= 6 ? '#f59e0b' : '#f43f5e';
                var scoresHtml = '';
                this.kpiAspects.forEach(function(a, i) {
                    var score = record._scores[i];
                    var sc = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#f43f5e';
                    scoresHtml += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;background:' + sc + '15;font-size:0.72rem;font-weight:600;color:' + sc + ';">' + a.icon + ' ' + score + '</span>';
                });

                return '<div class="m-data-card">' +
                    '<div class="m-card-header"><span class="m-card-title">#' + (index + 1) + ' ' + sanitizeHTML(record.empleado || '') + '</span>' +
                    '<span class="m-card-badge" style="background:' + avgColor + '15;color:' + avgColor + ';">' + record._avg.toFixed(1) + '</span></div>' +
                    '<div style="margin-bottom:10px;font-size:0.75rem;color:#8e8e93;">' + sanitizeHTML(record.cargo || '') + '</div>' +
                    '<div class="m-card-rows"><div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">' + (record.fecha ? formatDateShort(record.fecha) : '-') + '</span></div></div>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">' + scoresHtml + '</div>' +
                    (record.observaciones ? '<div style="font-size:0.78rem;color:#555;margin-bottom:8px;padding:8px 10px;background:#f9f9fb;border-radius:10px;">' + sanitizeHTML(record.observaciones) + '</div>' : '') +
                    ((canEdit || canDelete) ? '<div class="m-card-actions">' +
                        (canEdit ? '<button class="m-card-action btn-edit-mkpi" data-id="' + sanitizeHTML(record.id) + '" title="Editar">✏️</button>' : '') +
                        (canDelete ? '<button class="m-card-action delete btn-delete-mkpi" data-id="' + sanitizeHTML(record.id) + '" title="Eliminar">🗑️</button>' : '') +
                    '</div>' : '') +
                '</div>';
            }, this).join('');
        }

        if (!this._mobileCardsListenerAdded) {
            list.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.btn-edit-mkpi');
                const deleteBtn = e.target.closest('.btn-delete-mkpi');
                if (editBtn) { this.showForm(editBtn.dataset.id); return; }
                if (deleteBtn) { this.deleteRecord(deleteBtn.dataset.id); return; }
            });
            this._mobileCardsListenerAdded = true;
        }

        // Update stats
        var total = this.filteredRecords.length;
        var set = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
        set('mkpi-total', total);

        if (total > 0) {
            var aspectAvgs = this.kpiAspects.map(function(a) {
                var sum = this.filteredRecords.reduce(function(s, r) { return s + Number(r[a.key] || 0); }, 0);
                return { label: a.label, icon: a.icon, avg: sum / total };
            }, this);
            var generalAvg = aspectAvgs.reduce(function(s, a) { return s + a.avg; }, 0) / aspectAvgs.length;
            var best = aspectAvgs.reduce(function(a, b) { return a.avg > b.avg ? a : b; });
            var worst = aspectAvgs.reduce(function(a, b) { return a.avg < b.avg ? a : b; });

            var avgEl = document.getElementById('mkpi-avg');
            if (avgEl) { avgEl.textContent = generalAvg.toFixed(1); avgEl.style.color = generalAvg >= 8 ? '#10b981' : generalAvg >= 6 ? '#f59e0b' : '#f43f5e'; }
            set('mkpi-best', best.icon + ' ' + best.label + ' (' + best.avg.toFixed(1) + ')');
            set('mkpi-worst', worst.icon + ' ' + worst.label + ' (' + worst.avg.toFixed(1) + ')');
        } else {
            set('mkpi-avg', '0.0');
            set('mkpi-best', '-');
            set('mkpi-worst', '-');
        }
    }
};

window.KpiEvaluation = KpiEvaluation;
