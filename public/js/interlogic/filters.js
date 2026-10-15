// ===================================
// Interlogic - Filters Module
// ===================================

const InterlogicFilters = {
    showMobileFilters() {
        document.querySelectorAll('.mf-filter-sheet').forEach(el => el.remove());
        const fields = [
            { key: 'empresa', label: 'Empresa', options: this.getDistinctValues('empresa') },
            { key: 'condicionPago', label: 'Condición', options: this.getDistinctValues('condicionPago') },
            { key: 'departamento', label: 'Departamento', options: this.getDistinctValues('departamento') },
            { key: 'municipio', label: 'Municipio', options: this.getDistinctValues('municipio') },
            { key: 'vendedor', label: 'Vendedor', options: this.getDistinctValues('vendedor') },
            { key: 'cobrador', label: 'Cobrador', options: this.getDistinctValues('cobrador') },
            { key: 'encargado', label: 'Encargado', options: this.getDistinctValues('encargado') },
            { key: 'formaPago', label: 'Forma Pago', options: this.getDistinctValues('formaPago') },
        ];

        let body = '<fieldset class="mf-form-section"><legend>Período</legend><div class="m-form-group"><label for="m-filter-start">Desde</label><input type="date" id="m-filter-start" value="' + sanitizeHTML(this.filters.startDate || '') + '" required></div><div class="m-form-group"><label for="m-filter-end">Hasta</label><input type="date" id="m-filter-end" value="' + sanitizeHTML(this.filters.endDate || '') + '" required></div><p class="mf-field-error" id="m-filter-error" role="alert" hidden></p></fieldset>';
        fields.forEach(f => {
            if (!f.options.length) return;
            body += '<details class="mf-filter-group"><summary>' + f.label + '</summary><div class="m-filter-list">';
            f.options.forEach(v => {
                const isActive = this.filters[f.key]?.includes(String(v));
                body += '<label class="m-filter-item"><input type="checkbox" value="' + sanitizeHTML(v).replace(/"/g, '&quot;') + '" ' + (isActive ? 'checked' : '') + ' data-filter-key="' + f.key + '" data-filter-value="' + sanitizeHTML(String(v)).replace(/"/g, '&quot;') + '"><span>' + sanitizeHTML(v || '(vacío)') + '</span></label>';
            });
            body += '</div></details>';
        });

        const sheet = document.createElement('div');
        sheet.className = 'mf-sheet-root mf-filter-sheet';
        sheet.innerHTML = '<div class="m-sheet-backdrop show" data-m-close></div><div class="m-bottom-sheet show" role="dialog" aria-modal="true" aria-labelledby="m-filter-title"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title" id="m-filter-title">Afinar tu búsqueda</span><button type="button" class="m-sheet-close" data-m-close aria-label="Cerrar filtros">✕</button></div><div class="m-sheet-body"><p class="mf-sheet-intro">Elige el período y los datos que necesitas. Los cambios se aplican al confirmar.</p>' + body + '</div><div class="m-sheet-footer"><button type="button" class="btn" data-m-filter-clear>Limpiar</button><button type="button" class="btn btn-primary" data-m-filter-apply>Aplicar filtros</button></div></div>';
        document.getElementById('content-area').appendChild(sheet);
        sheet.querySelector('.m-sheet-close').focus({ preventScroll: true });
    },

    applyMobileFilterSheet(sheet) {
        const start = sheet.querySelector('#m-filter-start').value;
        const end = sheet.querySelector('#m-filter-end').value;
        const error = sheet.querySelector('#m-filter-error');
        if (!start || !end || start > end) {
            error.textContent = !start || !end ? 'Selecciona ambas fechas.' : 'La fecha inicial debe ser anterior o igual a la final.';
            error.hidden = false;
            sheet.querySelector('#m-filter-start').focus();
            return;
        }
        const changed = start !== this.filters.startDate || end !== this.filters.endDate;
        this.filters.startDate = start;
        this.filters.endDate = end;
        const checks = [...sheet.querySelectorAll('[data-filter-key]')];
        new Set(checks.map(el => el.dataset.filterKey)).forEach(key => { this.filters[key] = []; });
        checks.filter(el => el.checked).forEach(el => this.filters[el.dataset.filterKey].push(el.dataset.filterValue));
        this.closeMobileSheet(sheet);
        this.updateMobileControls();
        if (changed) this.reloadListener(true);
        else this.applyFilters();
    },

    toggleMobileFilter(field, value, checked) {
        if (!this.filters[field]) this.filters[field] = [];
        if (checked) {
            if (!this.filters[field].includes(value)) this.filters[field].push(value);
        } else {
            this.filters[field] = this.filters[field].filter(function(v) { return v !== value; });
        }
        this.applyFilters();
    },

    toggleFilter(event, field) {
        event.stopPropagation();
        const popup = document.getElementById(`filter-popup-${field}`);
        if (!popup) return;
        const isShowing = popup.classList.contains('show');
        const headerEl = event.currentTarget;

        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
        this._restorePopupsToHeaders();
        this._detachPopupScroll();

        if (!isShowing) {
            this._portalPopupToBody(popup, headerEl);
            popup.classList.add('show');
            this.populateFilterOptions(field);
            this._positionPopup(headerEl, popup);
        }
    },

    _portalPopupToBody(popup, headerEl) {
        if (!popup.dataset.originalParentId) {
            popup.dataset.originalParentId = headerEl.id || '';
        }
        if (popup.parentElement !== document.body) {
            popup._originalParent = popup.parentElement;
            popup._originalNextSibling = popup.nextElementSibling;
            document.body.appendChild(popup);
        }
    },

    _restorePopupsToHeaders() {
        document.querySelectorAll('.filter-popup').forEach(p => {
            if (p._originalParent) {
                if (p._originalNextSibling) {
                    p._originalParent.insertBefore(p, p._originalNextSibling);
                } else {
                    p._originalParent.appendChild(p);
                }
                p.style.position = '';
                p.style.top = '';
                p.style.bottom = '';
                p.style.left = '';
                p.style.minWidth = '';
                p.style.maxWidth = '';
                p.style.maxHeight = '';
            }
        });
    },

    _positionPopup(headerEl, popup) {
        var self = this;
        var tableContainer = headerEl.closest('.table-container');

        var rect = headerEl.getBoundingClientRect();
        var spaceBelow = window.innerHeight - rect.bottom;
        var spaceAbove = rect.top;
        var maxH = Math.min(window.innerHeight * 0.7, 400);

        popup.style.position = 'fixed';
        popup.style.left = rect.left + 'px';
        popup.style.minWidth = Math.max(250, rect.width) + 'px';
        popup.style.maxWidth = Math.min(400, window.innerWidth - 16) + 'px';

        if (spaceBelow < 200 && spaceAbove > spaceBelow) {
            popup.style.top = 'auto';
            popup.style.bottom = (window.innerHeight - rect.top) + 'px';
            popup.style.maxHeight = Math.min(maxH, spaceAbove - 16) + 'px';
        } else {
            popup.style.top = rect.bottom + 'px';
            popup.style.bottom = 'auto';
            popup.style.maxHeight = Math.min(maxH, spaceBelow - 16) + 'px';
        }

        this._popupScrollHandler = function() {
            document.querySelectorAll('.filter-popup').forEach(function(p) { p.classList.remove('show'); });
            self._restorePopupsToHeaders();
            self._detachPopupScroll();
        };
        if (tableContainer) tableContainer.addEventListener('scroll', this._popupScrollHandler, { passive: true });

        this._popupWindowScrollHandler = function() {
            document.querySelectorAll('.filter-popup').forEach(function(p) { p.classList.remove('show'); });
            self._restorePopupsToHeaders();
            self._detachPopupScroll();
        };
        window.addEventListener('scroll', this._popupWindowScrollHandler, { passive: true });

        this._popupResizeHandler = function() {
            if (!popup.classList.contains('show')) {
                self._detachPopupScroll();
                return;
            }
            var r = headerEl.getBoundingClientRect();
            var sb = window.innerHeight - r.bottom;
            var sa = r.top;
            var mh = Math.min(window.innerHeight * 0.7, 400);
            popup.style.maxWidth = Math.min(400, window.innerWidth - 16) + 'px';
            popup.style.left = r.left + 'px';
            if (sb < 200 && sa > sb) {
                popup.style.top = 'auto';
                popup.style.bottom = (window.innerHeight - r.top) + 'px';
                popup.style.maxHeight = Math.min(mh, sa - 16) + 'px';
            } else {
                popup.style.top = r.bottom + 'px';
                popup.style.bottom = 'auto';
                popup.style.maxHeight = Math.min(mh, sb - 16) + 'px';
            }
        };
        window.addEventListener('resize', this._popupResizeHandler, { passive: true });
    },

    _detachPopupScroll() {
        if (this._popupScrollHandler) {
            document.querySelectorAll('.table-container').forEach(function(tc) {
                tc.removeEventListener('scroll', this._popupScrollHandler);
            }.bind(this));
            this._popupScrollHandler = null;
        }
        if (this._popupWindowScrollHandler) {
            window.removeEventListener('scroll', this._popupWindowScrollHandler);
            this._popupWindowScrollHandler = null;
        }
        if (this._popupResizeHandler) {
            window.removeEventListener('resize', this._popupResizeHandler);
            this._popupResizeHandler = null;
        }
    },

    searchInFilter(field, query) {
        const list = document.getElementById(`filter-options-${field}`);
        const items = list.querySelectorAll('.filter-option-item');
        const q = query.toLowerCase();

        items.forEach(item => {
            const text = item.dataset.lc || (item.dataset.lc = item.textContent.toLowerCase());
            item.style.display = text.includes(q) ? 'flex' : 'none';
        });
    },

    scheduleApplyFilters() {
        clearTimeout(this._applyFiltersTimer);
        this._applyFiltersTimer = setTimeout(() => this.applyFilters(), 80);
    },

    applyFilters() {
        this.currentPage = 1;
        this.showAll = false;
        this.filteredRecords = this.records.filter(record => {
            if (this.isMobile) {
                const status = this.mobileStatus || 'all';
                if (status === 'pending' && (record.anulado === true || record.entregado === true || record.doc === 'NC')) return false;
                if (status === 'delivered' && (record.anulado === true || record.entregado !== true || record.doc === 'NC')) return false;
                if (status === 'cancelled' && record.anulado !== true) return false;
            }
            for (let field in this.filters) {
                const activeValues = this.filters[field];

                if (field === 'startDate' || field === 'endDate') {
                    const recordDate = record.fecha ? (record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha)) : null;
                    const recordDateStr = recordDate ? toDateKey(recordDate) : '';
                    if (!recordDateStr) continue;
                    if (this.filters.startDate && recordDateStr < this.filters.startDate) return false;
                    if (this.filters.endDate && recordDateStr > this.filters.endDate) return false;
                    continue;
                }

                if (activeValues && (Array.isArray(activeValues) ? activeValues.length > 0 : activeValues)) {
                    if (field === 'search') {
                        const q = activeValues.toLowerCase();
                        const searchFields = ['guia', 'empresa', 'cliente', 'departamento', 'municipio', 'vendedor', 'doc', 'docNum', 'cobrador', 'condicionPago', 'direccion', 'observations', 'entrega', 'cobra', 'encargado'];
                        const match = searchFields.some(f => String(record[f] || '').toLowerCase().includes(q));
                        if (!match) return false;
                        continue;
                    }

                    let recordValue;
                    if (field === 'fecha') {
                        recordValue = record.fecha ? formatDate(record.fecha, false) : ' (Vacío)';
                    } else if (field === 'venta' || field === 'costoEnvio') {
                        recordValue = formatNumber(record[field] || 0, 2);
                    } else if (field === 'costoPorcentaje') {
                        recordValue = formatNumber(record[field] || 0, 2) + '%';
                    } else {
                        recordValue = String(record[field] || ' (Vacío)');
                    }
                    if (Array.isArray(activeValues)) {
                        if (!activeValues.includes(recordValue)) return false;
                    } else if (typeof activeValues === 'string' && activeValues) {
                        if (!recordValue.toLowerCase().includes(activeValues.toLowerCase())) return false;
                    }
                }
            }
            return true;
        });

        this.applySorting();

        this._totals = this._computeTotals();

        const hasActiveFilters = this.currentSort.field || Object.entries(this.filters).some(([k, v]) => {
            const today = getLocalDateString();
            if (k === 'startDate' && v !== today) return true;
            if (k === 'endDate' && v !== today) return true;
            if (k === 'search' && v) return true;
            return Array.isArray(v) && v.length > 0;
        });
        const clearBtn = document.getElementById('btn-clear-all-filters');
        if (clearBtn) clearBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';

        if (this.isMobile) {
            this.renderMobileCards();
        } else {
            this.renderTable();
        }
    },

    applySorting() {
        const { field, direction } = this.currentSort;
        if (!field || !direction) {
            this.filteredRecords.sort((a, b) => {
                const ca = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : 0;
                const cb = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : 0;
                return cb - ca;
            });
            return;
        }

        this.filteredRecords.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    },

    setSort(field, direction) {
        this.currentSort = { field, direction };
        this.applyFilters();
    },

    populateFilterOptions(field) {
        const list = document.getElementById(`filter-options-${field}`);
        if (!list) return;

        const headerHtml = `
            <div class="filter-sort-options">
                <button class="sort-btn ${this.currentSort.field === field && this.currentSort.direction === 'asc' ? 'active' : ''}" 
                        onclick="Interlogic.setSort('${field}', 'asc')">
                    ↑ A a Z
                </button>
                <button class="sort-btn ${this.currentSort.field === field && this.currentSort.direction === 'desc' ? 'active' : ''}" 
                        onclick="Interlogic.setSort('${field}', 'desc')">
                    ↓ Z a A
                </button>
            </div>
            <div class="filter-toggle-all">
                <button class="btn-toggle-filter" onclick="Interlogic.toggleAllFilterValues('${field}', true)">
                    ☑ Seleccionar Todo
                </button>
                <button class="btn-toggle-filter" onclick="Interlogic.toggleAllFilterValues('${field}', false)">
                    ☐ Deseleccionar
                </button>
            </div>
        `;

        const optionsCacheKey = field + '|' + JSON.stringify(Object.entries(this.filters).filter(([k]) => k !== field));
        let uniqueValues;
        if (this._optionsCache && this._optionsCache.key === optionsCacheKey && this._optionsCache.src === this.records) {
            uniqueValues = this._optionsCache.values;
        } else {
        const recordsForOptions = this.records.filter(record => {
            for (let f in this.filters) {
                if (f === field) continue;
                const activeValues = this.filters[f];

                if (f === 'startDate' || f === 'endDate') {
                    const recordDate = record.fecha ? (record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha)) : null;
                    const recordDateStr = recordDate ? toDateKey(recordDate) : '';
                    if (!recordDateStr) continue;
                    if (this.filters.startDate && recordDateStr < this.filters.startDate) return false;
                    if (this.filters.endDate && recordDateStr > this.filters.endDate) return false;
                    continue;
                }

                if (activeValues && (Array.isArray(activeValues) ? activeValues.length > 0 : activeValues)) {
                    if (f === 'search') {
                        const searchFields = ['guia', 'empresa', 'cliente', 'departamento', 'municipio', 'vendedor', 'doc', 'docNum', 'cobrador', 'condicionPago', 'direccion', 'observations', 'encargado'];
                        const match = searchFields.some(sf => String(record[sf] || '').toLowerCase().includes(activeValues.toLowerCase()));
                        if (!match) return false;
                        continue;
                    }

                    let recordValue;
                    if (f === 'fecha') {
                        recordValue = record.fecha ? formatDate(record.fecha, false) : ' (Vacío)';
                    } else if (f === 'venta' || f === 'costoEnvio') {
                        recordValue = formatNumber(record[f] || 0, 2);
                    } else if (f === 'costoPorcentaje') {
                        recordValue = formatNumber(record[f] || 0, 2) + '%';
                    } else {
                        recordValue = String(record[f] || ' (Vacío)');
                    }

                    if (Array.isArray(activeValues)) {
                        if (!activeValues.includes(recordValue)) return false;
                    } else if (typeof activeValues === 'string' && activeValues) {
                        if (!recordValue.toLowerCase().includes(activeValues.toLowerCase())) return false;
                    }
                }
            }
            return true;
        });

        const sourceRecords = recordsForOptions.length > 0 ? recordsForOptions : this.records;
        uniqueValues = [...new Set(sourceRecords.map(r => {
            if (field === 'fecha') return r.fecha ? formatDate(r.fecha, false) : ' (Vacío)';
            if (field === 'venta' || field === 'costoEnvio') return formatNumber(r[field] || 0, 2);
            if (field === 'costoPorcentaje') return formatNumber(r[field] || 0, 2) + '%';
            return String(r[field] || ' (Vacío)');
        }))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        this._optionsCache = { key: optionsCacheKey, src: this.records, values: uniqueValues };
        }

        const activeValues = this.filters[field] || [];

        const optionsHtml = uniqueValues.map((val, idx) => {
            const valHtml = sanitizeHTML(val);
            const valJs = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const valAttr = String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            const safeId = `chk-${field}-${idx}`;
            return `
            <div class="filter-option-item" onclick="event.stopPropagation()">
                <input type="checkbox" id="${safeId}" data-value="${valAttr}" ${Array.isArray(activeValues) && activeValues.includes(val) ? 'checked' : ''} 
                       onchange="Interlogic.updateFilterValue('${field}', '${valJs}', this.checked)">
                <label for="${safeId}">${valHtml}</label>
            </div>
        `}).join('');

        list.innerHTML = headerHtml + optionsHtml;
    },

    toggleAllFilterValues(field, checked) {
        if (!checked) {
            this.filters[field] = [];
        } else {
            const list = document.getElementById(`filter-options-${field}`);
            const checkboxes = list.querySelectorAll('input[type="checkbox"]');
            this.filters[field] = Array.from(checkboxes).map(cb => cb.dataset.value);
        }
        this.scheduleApplyFilters();
        this.populateFilterOptions(field);
    },

    updateFilterValue(field, value, checked) {
        if (!this.filters[field] || !Array.isArray(this.filters[field])) this.filters[field] = [];

        if (checked) {
            if (!this.filters[field].includes(value)) this.filters[field].push(value);
        } else {
            this.filters[field] = this.filters[field].filter(v => v !== value);
        }

        this.scheduleApplyFilters();
    },

    clearAllFilters() {
        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
        this._detachPopupScroll();

        const today = getLocalDateString();
        this.filters = {
            search: '',
            startDate: today,
            endDate: today,
            guia: [],
            empresa: [],
            fecha: [],
            doc: [],
            docNum: [],
            cliente: [],
            departamento: [],
            municipio: [],
            vendedor: [],
            condicionPago: [],
            venta: [],
            cobrador: [],
            bultos: [],
            costoEnvio: [],
            costoPorcentaje: [],
            observations: [],
            entrega: [],
            cobra: [],
            encargado: [],
            formaPago: []
        };
        this.currentSort = { field: '', direction: '' };
        this.mobileStatus = 'all';

        const startInput = document.getElementById('filter-start-date');
        const endInput = document.getElementById('filter-end-date');
        if (startInput) startInput.value = today;
        if (endInput) endInput.value = today;
        const searchInput = document.getElementById('global-search');
        if (searchInput) searchInput.value = '';
        const mobileSearch = document.getElementById('m-global-search');
        if (mobileSearch) mobileSearch.value = '';
        if (this.isMobile) this.updateMobileControls();

        this.applyFilters();
        this.reloadListener(false);
    }
};

window.InterlogicFilters = InterlogicFilters;
