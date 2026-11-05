const InterlogicFilters = {
    _excelPending: {},
    _excelQuery: {},
    _excelOpenField: null,
    _excelOutsideHandler: null,
    _excelEscHandler: null,
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
        const openPopups = document.querySelectorAll('.filter-popup.show');
        openPopups.forEach(p => {
            const m = p.id.match(/^filter-popup-(.+)$/);
            if (m) {
                const f = m[1];
                delete this._excelPending[f];
                delete this._excelQuery[f];
            }
        });
        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
        this._restorePopupsToHeaders();
        this._detachPopupScroll();
        this._excelDetachGlobalHandlers();
        if (isShowing) {
            delete this._excelPending[field];
            delete this._excelQuery[field];
            this._excelOpenField = null;
            return;
        }
        this._excelPending[field] = [...(this.filters[field] || [])];
        this._excelQuery[field] = '';
        this._excelOpenField = field;
        const searchInput = popup.querySelector('.filter-popup-search');
        if (searchInput) searchInput.value = '';
        this._portalPopupToBody(popup, headerEl);
        popup.classList.add('show');
        this.populateFilterOptions(field);
        this._positionPopup(headerEl, popup);
        this._excelAttachGlobalHandlers(field);
    },
    _excelAttachGlobalHandlers(field) {
        const self = this;
        setTimeout(() => {
            self._excelOutsideHandler = function(e) {
                const f = self._excelOpenField;
                if (!f) return;
                const pp = document.getElementById(`filter-popup-${f}`);
                if (!pp || !pp.classList.contains('show')) return;
                if (pp.contains(e.target)) return;
                const header = document.querySelector(`.filter-header[onclick*="'${f}'"]`);
                if (header && header.contains(e.target)) return;
                self.cancelExcelFilter(f);
            };
            document.addEventListener('click', self._excelOutsideHandler);
        }, 0);
        self._excelEscHandler = function(e) {
            if (e.key === 'Escape') {
                const f = self._excelOpenField;
                if (f) {
                    e.stopPropagation();
                    self.cancelExcelFilter(f);
                }
            }
        };
        document.addEventListener('keydown', self._excelEscHandler);
    },
    _excelDetachGlobalHandlers() {
        if (this._excelOutsideHandler) {
            document.removeEventListener('click', this._excelOutsideHandler);
            this._excelOutsideHandler = null;
        }
        if (this._excelEscHandler) {
            document.removeEventListener('keydown', this._excelEscHandler);
            this._excelEscHandler = null;
        }
    },
    _excelApply(field) {
        if (this._excelPending[field] !== undefined) {
            this.filters[field] = [...this._excelPending[field]];
        }
        delete this._excelPending[field];
        delete this._excelQuery[field];
        this._excelOpenField = null;
        const popup = document.getElementById(`filter-popup-${field}`);
        if (popup) popup.classList.remove('show');
        this._restorePopupsToHeaders();
        this._detachPopupScroll();
        this._excelDetachGlobalHandlers();
        this.applyFilters();
    },
    cancelExcelFilter(field) {
        const target = field || this._excelOpenField;
        if (target) {
            delete this._excelPending[target];
            delete this._excelQuery[target];
        }
        if (!field && this._excelOpenField) {
            delete this._excelPending[this._excelOpenField];
            delete this._excelQuery[this._excelOpenField];
        }
        this._excelOpenField = null;
        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
        this._restorePopupsToHeaders();
        this._detachPopupScroll();
        this._excelDetachGlobalHandlers();
    },
    _excelUpdateSelectAllState(field) {
        const list = document.getElementById(`filter-options-${field}`);
        const master = document.getElementById(`excel-select-all-${field}`);
        if (!list || !master) return;
        const visibleItems = [...list.querySelectorAll('.filter-option-item')].filter(it => it.style.display !== 'none');
        if (visibleItems.length === 0) {
            master.checked = false;
            master.indeterminate = false;
            return;
        }
        const allChecked = visibleItems.every(it => {
            const cb = it.querySelector('input[type="checkbox"]');
            return cb && cb.checked;
        });
        const someChecked = visibleItems.some(it => {
            const cb = it.querySelector('input[type="checkbox"]');
            return cb && cb.checked;
        });
        master.checked = allChecked;
        master.indeterminate = !allChecked && someChecked;
    },
    _excelUpdateCounter(field) {
        const list = document.getElementById(`filter-options-${field}`);
        const counter = document.getElementById(`excel-counter-${field}`);
        if (!counter || !list) return;
        const pending = this._excelPending[field] !== undefined ? this._excelPending[field] : (this.filters[field] || []);
        const total = [...list.querySelectorAll('.filter-option-item')].length;
        const query = (this._excelQuery[field] || '').trim();
        if (query) {
            const visibleCount = [...list.querySelectorAll('.filter-option-item')].filter(it => it.style.display !== 'none').length;
            counter.textContent = `${visibleCount} coinciden \u00B7 ${pending.length} de ${total} seleccionados`;
        } else {
            counter.textContent = `${pending.length} de ${total} seleccionados`;
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
            const openField = self._excelOpenField;
            if (openField) {
                delete self._excelPending[openField];
                delete self._excelQuery[openField];
                self._excelOpenField = null;
            } else {
                document.querySelectorAll('.filter-popup').forEach(function(p) {
                    const m = p.id.match(/^filter-popup-(.+)$/);
                    if (m) {
                        delete self._excelPending[m[1]];
                        delete self._excelQuery[m[1]];
                    }
                });
            }
            document.querySelectorAll('.filter-popup').forEach(function(p) { p.classList.remove('show'); });
            self._restorePopupsToHeaders();
            self._detachPopupScroll();
            self._excelDetachGlobalHandlers();
        };
        if (tableContainer) tableContainer.addEventListener('scroll', this._popupScrollHandler, { passive: true });
        this._popupWindowScrollHandler = function() {
            const openField = self._excelOpenField;
            if (openField) {
                delete self._excelPending[openField];
                delete self._excelQuery[openField];
                self._excelOpenField = null;
            } else {
                document.querySelectorAll('.filter-popup').forEach(function(p) {
                    const m = p.id.match(/^filter-popup-(.+)$/);
                    if (m) {
                        delete self._excelPending[m[1]];
                        delete self._excelQuery[m[1]];
                    }
                });
            }
            document.querySelectorAll('.filter-popup').forEach(function(p) { p.classList.remove('show'); });
            self._restorePopupsToHeaders();
            self._detachPopupScroll();
            self._excelDetachGlobalHandlers();
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
        this._excelQuery[field] = query || '';
        const list = document.getElementById(`filter-options-${field}`);
        if (!list) return;
        const items = list.querySelectorAll('.filter-option-item');
        const q = (query || '').toLowerCase();
        let visibleCount = 0;
        items.forEach(item => {
            const text = item.dataset.lc || (item.dataset.lc = item.textContent.toLowerCase());
            const show = text.includes(q);
            item.style.display = show ? 'flex' : 'none';
            if (show) visibleCount++;
        });
        const emptyEl = document.getElementById(`excel-empty-${field}`);
        if (emptyEl) emptyEl.style.display = visibleCount === 0 ? 'block' : 'none';
        this._excelUpdateSelectAllState(field);
        this._excelUpdateCounter(field);
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
                    if (field === 'cliente') {
                        const name = String(record[field] || ' (Vacío)');
                        const ok = activeValues.includes(name) || activeValues.includes(record.id) || (record.guia && activeValues.includes(record.guia));
                        if (!ok) return false;
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
        const optionsCacheKey = field + '|' + JSON.stringify(Object.entries(this.filters).filter(([k]) => k !== field));
        let uniqueValues;
        if (this._optionsCache && this._optionsCache.key === optionsCacheKey && this._optionsCache.src === this.records && this._optionsCache.rev === this._recordsRev) {
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
                        const searchFields = ['guia', 'empresa', 'cliente', 'departamento', 'municipio', 'vendedor', 'doc', 'docNum', 'cobrador', 'condicionPago', 'direccion', 'observations', 'entrega', 'cobra', 'encargado'];
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
        this._optionsCache = { key: optionsCacheKey, src: this.records, values: uniqueValues, rev: this._recordsRev || 0 };
        }
        const pending = this._excelPending[field] !== undefined ? this._excelPending[field] : (this.filters[field] || []);
        const total = uniqueValues.length;
        const selectedCount = pending.length;
        const allChecked = total > 0 && uniqueValues.every(v => pending.includes(v));
        const sortAscActive = this.currentSort.field === field && this.currentSort.direction === 'asc' ? 'active' : '';
        const sortDescActive = this.currentSort.field === field && this.currentSort.direction === 'desc' ? 'active' : '';
        const headerHtml = `
            <div class="filter-sort-options">
                <button class="sort-btn ${sortAscActive}" onclick="Interlogic.setSort('${field}', 'asc')">
                    \u2191 A a Z
                </button>
                <button class="sort-btn ${sortDescActive}" onclick="Interlogic.setSort('${field}', 'desc')">
                    \u2193 Z a A
                </button>
            </div>
            <div class="filter-excel-controls" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--gray-100);margin-bottom:6px;">
                <label class="filter-option-item" style="cursor:pointer;flex:1;" onclick="event.stopPropagation()">
                    <input type="checkbox" id="excel-select-all-${field}" ${allChecked ? 'checked' : ''} onchange="Interlogic.toggleAllFilterValues('${field}', this.checked)" onclick="event.stopPropagation()">
                    <span>(Seleccionar todo)</span>
                </label>
                <span id="excel-counter-${field}" style="font-size:0.75rem;color:#6b7280;white-space:nowrap;">${selectedCount} de ${total} seleccionados</span>
            </div>
        `;
        const optionsHtml = field === 'cliente'
            ? this._renderClienteRows(field, pending)
            : uniqueValues.map((val, idx) => {
            const valHtml = sanitizeHTML(val);
            const valJs = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const valAttr = String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            const safeId = `chk-${field}-${idx}`;
            const lc = String(val).toLowerCase().replace(/"/g, '&quot;');
            return `
            <div class="filter-option-item" data-lc="${lc}" onclick="event.stopPropagation()">
                <input type="checkbox" id="${safeId}" data-value="${valAttr}" ${pending.includes(val) ? 'checked' : ''}
                       onchange="Interlogic.updateFilterValue('${field}', '${valJs}', this.checked)" onclick="event.stopPropagation()">
                <label for="${safeId}" style="flex:1;">${valHtml}</label>
            </div>
        `}).join('');
        const emptyHtml = `<div id="excel-empty-${field}" style="display:none;padding:8px;text-align:center;color:#6b7280;font-size:0.85rem;">Sin resultados</div>`;
        const footerHtml = `
            <div class="filter-excel-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:8px 0 0;border-top:1px solid #e5e7eb;margin-top:8px;">
                <button type="button" class="btn btn-secondary" style="font-size:0.8rem;padding:4px 10px;" onclick="Interlogic.cancelExcelFilter('${field}')">Cancelar</button>
                <button type="button" class="btn btn-primary" style="font-size:0.8rem;padding:4px 10px;" onclick="Interlogic._excelApply('${field}')">Aceptar</button>
            </div>
        `;
        list.innerHTML = headerHtml + optionsHtml + emptyHtml + footerHtml;
        if ((this._excelQuery[field] || '').trim()) {
            this.searchInFilter(field, this._excelQuery[field]);
        }
    },
    _renderClienteRows(field, pending) {
        const rows = (this.records || []).slice().sort((a, b) => {
            const na = String(a.cliente || ' (Vacío)').localeCompare(String(b.cliente || ' (Vacío)'), undefined, { numeric: true, sensitivity: 'base' });
            if (na !== 0) return na;
            const fa = a.fecha ? (a.fecha.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha).getTime()) : 0;
            const fb = b.fecha ? (b.fecha.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha).getTime()) : 0;
            return fb - fa;
        });
        let total = 0;
        const html = rows.map((r, idx) => {
            const key = r.id || (r.guia ? 'guia:' + r.guia : String(r.cliente || ''));
            const keyJs = String(key).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const keyAttr = String(key).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            const safeId = `chk-${field}-${idx}`;
            const fecha = r.fecha ? formatDateShort(r.fecha.toDate ? r.fecha.toDate() : r.fecha) : '—';
            const venta = Number(r.venta) || 0;
            total += venta;
            const lc = (String(r.cliente || '') + ' ' + (r.guia || '') + ' ' + fecha + ' ' + formatCurrency(venta)).toLowerCase().replace(/"/g, '&quot;');
            return `
            <div class="filter-option-item" data-lc="${lc}" onclick="event.stopPropagation()" style="align-items:flex-start;">
                <input type="checkbox" id="${safeId}" data-value="${keyAttr}" ${pending.includes(key) ? 'checked' : ''}
                       onchange="Interlogic.updateFilterValue('${field}', '${keyJs}', this.checked)" onclick="event.stopPropagation()" style="margin-top:3px;">
                <label for="${safeId}" style="flex:1;line-height:1.35;"><strong>${sanitizeHTML(r.cliente || ' (Vacío)')}</strong><br><span style="font-size:0.72rem;color:#6b7280;">${sanitizeHTML(r.guia || '')} · ${sanitizeHTML(fecha)}</span></label>
                <span style="font-size:0.75rem;font-weight:700;color:#047857;white-space:nowrap;">${formatCurrency(venta)}</span>
            </div>
        `}).join('');
        return html + `<div style="display:flex;justify-content:flex-end;padding:8px 4px 2px;border-top:1px solid #e5e7eb;margin-top:6px;font-size:0.8rem;font-weight:700;color:#0f172a;">Suma visible: ${formatCurrency(rows.reduce((s, r) => s + (Number(r.venta) || 0), 0))}</div>`;
    },
    toggleAllFilterValues(field, checked) {
        const list = document.getElementById(`filter-options-${field}`);
        if (!list) return;
        if (this._excelPending[field] === undefined) this._excelPending[field] = [...(this.filters[field] || [])];
        const items = list.querySelectorAll('.filter-option-item');
        items.forEach(item => {
            if (item.style.display === 'none') return;
            const cb = item.querySelector('input[type="checkbox"]');
            if (!cb || !cb.dataset.value) return;
            const val = cb.dataset.value;
            cb.checked = checked;
            if (checked) {
                if (!this._excelPending[field].includes(val)) this._excelPending[field].push(val);
            } else {
                this._excelPending[field] = this._excelPending[field].filter(v => v !== val);
            }
        });
        this._excelUpdateSelectAllState(field);
        this._excelUpdateCounter(field);
    },
    updateFilterValue(field, value, checked) {
        if (this._excelPending[field] === undefined) this._excelPending[field] = [...(this.filters[field] || [])];
        if (!Array.isArray(this._excelPending[field])) this._excelPending[field] = [];
        if (checked) {
            if (!this._excelPending[field].includes(value)) this._excelPending[field].push(value);
        } else {
            this._excelPending[field] = this._excelPending[field].filter(v => v !== value);
        }
        this._excelUpdateSelectAllState(field);
        this._excelUpdateCounter(field);
    },
    clearAllFilters() {
        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
        this._restorePopupsToHeaders();
        this._detachPopupScroll();
        this._excelDetachGlobalHandlers();
        this._excelPending = {};
        this._excelQuery = {};
        this._excelOpenField = null;
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
