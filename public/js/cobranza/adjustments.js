// ===================================
// Cobranza - Adjustments Module
// ===================================

const CobranzaAdjustments = {
    renderAjustes() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords();

        const allAjustes = [
            ...this.ajustes.map(a => ({ ...a, _source: 'ajuste' })),
            ...this.notasCredito.map(nc => ({
                ...nc,
                _source: 'nc',
                tipo: 'notaCredito',
                monto: -(nc.monto || 0),
                guia: nc.guia || ''
            }))
        ].sort((a, b) => {
            const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
            const db = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
            return db - da;
        });

        container.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem;">
                <button class="btn btn-primary" id="cob-btn-nuevo-ajuste">💡 Nuevo Ajuste</button>
                <button class="btn btn-accent" id="cob-btn-nueva-nc">📄 Nueva Nota de Crédito</button>
            </div>
            <div id="cob-ajustes-list">
                ${allAjustes.length===0 ? '<div class="card"><div class="card-body" style="text-align:center;padding:2rem;color:#8e8e93;">No hay ajustes registrados. Usa esta sección para notas de crédito, descuentos, devoluciones o castigos.</div></div>' :
                `<div class="card"><div class="card-body"><table style="width:100%;font-size:0.85rem;"><thead><tr style="background:#f0f0f0;"><th style="padding:8px;">Fecha</th><th style="padding:8px;">Cliente</th><th style="padding:8px;">Tipo</th><th style="padding:8px;">N° NC</th><th style="padding:8px;">Guía</th><th style="padding:8px;text-align:right;">Monto</th><th style="padding:8px;">Motivo</th></tr></thead><tbody>${allAjustes.map(a => {
                    const isNC = a._source === 'nc';
                    const tipoLabel = isNC ? 'Nota de Crédito' : (a.tipo||'');
                    const badgeClass = isNC ? 'badge-nc' : (a.tipo==='cargoExtra'?'badge-error':'badge-warning');
                    return `<tr><td style="padding:8px;">${a.fecha&&a.fecha.toDate?formatDateShort(a.fecha):''}</td><td style="padding:8px;">${sanitizeHTML(a.cliente||'')}</td><td style="padding:8px;"><span class="badge ${badgeClass}">${tipoLabel}</span></td><td style="padding:8px;">${sanitizeHTML(a.ncNum||'-')}</td><td style="padding:8px;">${sanitizeHTML(a.guia||'')}</td><td style="padding:8px;text-align:right;color:${(a.monto||0)<0?'#22c55e':'#ef4444'};font-weight:700;">${(a.monto||0)<0?'−':''}${formatCurrency(Math.abs(a.monto||0))}</td><td style="padding:8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${sanitizeHTML(a.motivo||'')}</td></tr>`;
                }).join('')}</tbody></table></div></div>`
                }
            </div>
        `;

        document.getElementById('cob-btn-nuevo-ajuste').addEventListener('click', () => this.showAjusteModal(records));
        document.getElementById('cob-btn-nueva-nc').addEventListener('click', () => this.showAjusteModal(records));
    },

    showAjusteModal(records) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="margin-bottom:1rem;">💡 Nuevo Ajuste / Nota de Crédito</h2>
                <form id="ajuste-form">
                    <div class="form-group">
                        <label>Cliente</label>
                        <div class="search-container">
                            <div class="search-box" style="position:relative;">
                                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="aj-cliente-search" class="search-input" placeholder="Escribe para buscar cliente..." autocomplete="off">
                                <input type="hidden" id="aj-cliente" value="">
                            </div>
                            <div id="aj-cliente-dropdown" class="premium-dropdown" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Tipo de Ajuste</label><select id="aj-tipo" style="width:100%;"><option value="notaCredito">Nota de Crédito (reduce deuda)</option><option value="descuento">Descuento</option><option value="devolucion">Devolución</option><option value="cargoExtra">Cargo Extra (aumenta deuda)</option><option value="castigo">Castigo por Incobrable</option></select></div>
                    <div id="aj-nc-num-group" class="form-group" style="margin-top:1rem;"><label>N° Nota de Crédito</label><input type="text" id="aj-nc-num" style="width:100%;" placeholder="Ej: NC-001"></div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Guía Relacionada</label>
                        <div class="search-container">
                            <div class="search-box" style="position:relative;">
                                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="aj-guia-search" class="search-input" placeholder="Buscar guía o dejar vacío para general..." autocomplete="off">
                                <input type="hidden" id="aj-guia" value="">
                            </div>
                            <div id="aj-guia-dropdown" class="premium-dropdown" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Monto ($) — Negativo para reducir deuda</label><input type="number" id="aj-monto" step="0.01" style="width:100%;" placeholder="Ej: -50 para nota de crédito"></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Motivo</label><input type="text" id="aj-motivo" style="width:100%;" placeholder="Razón del ajuste..."></div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-aj-save">💾 Guardar Ajuste</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target===modal) modal.remove(); };

        const tipoSelect = document.getElementById('aj-tipo');
        const ncNumGroup = document.getElementById('aj-nc-num-group');
        const toggleNcNum = () => { ncNumGroup.style.display = tipoSelect.value === 'notaCredito' ? 'block' : 'none'; };
        tipoSelect.addEventListener('change', toggleNcNum);
        toggleNcNum();

        const clienteSearch = document.getElementById('aj-cliente-search');
        const clienteDropdown = document.getElementById('aj-cliente-dropdown');
        const hiddenCliente = document.getElementById('aj-cliente');

        const filterClientes = (query) => {
            const q = query.toLowerCase().trim();
            if (!q || q.length < 1) { clienteDropdown.style.display = 'none'; return; }
            const matches = records.filter(r => {
                const cliente = String(r.cliente || '').toLowerCase();
                const guia = String(r.guia || '').toLowerCase();
                const empresa = String(r.empresa || '').toLowerCase();
                return cliente.includes(q) || guia.includes(q) || empresa.includes(q);
            });
            const unique = [];
            const seen = new Set();
            for (const r of matches) {
                const name = (r.cliente || '').trim();
                if (!name || seen.has(name)) continue;
                seen.add(name);
                unique.push(r);
                if (unique.length >= 20) break;
            }
            if (unique.length === 0) {
                clienteDropdown.innerHTML = '<div class="dropdown-empty"><p style="padding:1rem;color:#8e8e93;">Sin coincidencias</p></div>';
            } else {
                clienteDropdown.innerHTML = unique.map(r => `
                    <div class="dropdown-item" onclick="document.getElementById('aj-cliente-search').value='${sanitizeHTML(r.cliente||'').replace(/'/g,"\\'")}';document.getElementById('aj-cliente').value='${sanitizeHTML(r.cliente||'').replace(/'/g,"\\'")}';document.getElementById('aj-cliente-dropdown').style.display='none';">
                        <div class="dropdown-item-left">
                            <div class="dropdown-item-doc">${sanitizeHTML(r.cliente||'')}</div>
                            <div class="dropdown-item-cliente">Guía: ${sanitizeHTML(r.guia||'N/A')} · ${sanitizeHTML(r.empresa||'')}</div>
                        </div>
                        <div class="dropdown-item-right">
                            <div class="dropdown-item-monto">${formatCurrency(r.venta||0)}</div>
                        </div>
                    </div>
                `).join('');
            }
            clienteDropdown.style.display = 'block';
        };

        clienteSearch.addEventListener('input', (e) => filterClientes(e.target.value));
        clienteSearch.addEventListener('focus', () => { if (clienteSearch.value) filterClientes(clienteSearch.value); });

        const guiaSearch = document.getElementById('aj-guia-search');
        const guiaDropdown = document.getElementById('aj-guia-dropdown');
        const hiddenGuia = document.getElementById('aj-guia');

        const filterGuias = (query) => {
            const q = query.toLowerCase().trim();
            if (!q || q.length < 1) { guiaDropdown.style.display = 'none'; return; }
            const matches = records.filter(r => {
                const guia = String(r.guia || '').toLowerCase();
                const cliente = String(r.cliente || '').toLowerCase();
                const doc = String(r.doc || '').toLowerCase();
                return guia.includes(q) || cliente.includes(q) || doc.includes(q);
            }).slice(0, 20);
            if (matches.length === 0) {
                guiaDropdown.innerHTML = '<div class="dropdown-empty"><p style="padding:1rem;color:#8e8e93;">Sin coincidencias</p></div>';
            } else {
                guiaDropdown.innerHTML = matches.map(r => `
                    <div class="dropdown-item" onclick="document.getElementById('aj-guia-search').value='${sanitizeHTML((r.guia||'N/A')+' - '+ (r.cliente||'')).replace(/'/g,"\\'")}';document.getElementById('aj-guia').value='${sanitizeHTML(r.guia||'').replace(/'/g,"\\'")}';document.getElementById('aj-guia-dropdown').style.display='none';">
                        <div class="dropdown-item-left">
                            <div class="dropdown-item-doc">${sanitizeHTML(r.guia||'N/A')} <span class="dropdown-item-num">${sanitizeHTML(r.doc||'')}</span></div>
                            <div class="dropdown-item-cliente">${sanitizeHTML(r.cliente||'')}</div>
                        </div>
                        <div class="dropdown-item-right">
                            <div class="dropdown-item-monto">${formatCurrency(r.venta||0)}</div>
                        </div>
                    </div>
                `).join('');
            }
            guiaDropdown.style.display = 'block';
        };

        guiaSearch.addEventListener('input', (e) => filterGuias(e.target.value));
        guiaSearch.addEventListener('focus', () => { if (guiaSearch.value) filterGuias(guiaSearch.value); });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#aj-cliente-search') && !e.target.closest('#aj-cliente-dropdown')) {
                clienteDropdown.style.display = 'none';
            }
            if (!e.target.closest('#aj-guia-search') && !e.target.closest('#aj-guia-dropdown')) {
                guiaDropdown.style.display = 'none';
            }
        });

        document.getElementById('ajuste-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-aj-save');
            setButtonLoading(btn, true);
            try {
                const monto = parseFloat(document.getElementById('aj-monto').value) || 0;
                const guiaSel = hiddenGuia.value;
                const clienteVal = hiddenCliente.value || clienteSearch.value.trim();
                const tipo = document.getElementById('aj-tipo').value;
                const motivo = document.getElementById('aj-motivo').value;
                if (monto === 0) { showToast('El monto no puede ser 0','error'); setButtonLoading(btn,false); return; }

                const ajusteData = {
                    cliente: clienteVal,
                    tipo: tipo,
                    guia: guiaSel,
                    monto: monto,
                    motivo: motivo,
                    fecha: firebase.firestore.FieldValue.serverTimestamp(),
                    usuario: firebase.auth().currentUser?.uid || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (guiaSel && tipo !== 'cargoExtra') {
                    const record = records.find(r => r.guia === guiaSel);
                    if (record) {
                        const venta = Number(record.venta || 0);
                        const cobrado = Number(record.montoCobrado || (record.cobrado===true?venta:0));
                        const nuevoCobrado = monto < 0 ? cobrado + Math.abs(monto) : cobrado - monto;
                        const nuevoEstado = nuevoCobrado >= venta ? 'pagado' : nuevoCobrado > 0 ? 'parcial' : 'pendiente';
                        const update = {
                            montoCobrado: Math.max(0, nuevoCobrado),
                            montoPendiente: Math.max(0, venta - nuevoCobrado),
                            estadoCobro: nuevoEstado,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        const batch = firebase.firestore().batch();
                        batch.set(firebase.firestore().collection('ajustes').doc(), ajusteData);

                        if (tipo === 'notaCredito') {
                            var ncNum = document.getElementById('aj-nc-num').value.trim();
                            var ncData = {
                                ncNum: ncNum || '',
                                cliente: clienteVal,
                                monto: Math.abs(monto),
                                motivo: motivo,
                                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                                empresa: record.empresa || '',
                                interlogicId: record.id || '',
                                guia: guiaSel,
                                docRef: (record.doc || '') + ' #' + (record.docNum || guiaSel),
                                afectaSaldo: true,
                                estado: 'activa',
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                createdBy: firebase.auth().currentUser?.uid || ''
                            };
                            batch.set(firebase.firestore().collection('notasCredito').doc(), ncData);
                        }

                        batch.update(firebase.firestore().collection('interlogic').doc(record.id), update);
                        await batch.commit();
                    } else {
                        await firebase.firestore().collection('ajustes').add(ajusteData);
                        if (tipo === 'notaCredito') {
                            var ncNum2 = document.getElementById('aj-nc-num').value.trim();
                            await firebase.firestore().collection('notasCredito').add({
                                ncNum: ncNum2 || '',
                                cliente: clienteVal,
                                monto: Math.abs(monto),
                                motivo: motivo,
                                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                                empresa: '',
                                interlogicId: '',
                                guia: guiaSel,
                                docRef: '',
                                afectaSaldo: false,
                                estado: 'activa',
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                createdBy: firebase.auth().currentUser?.uid || ''
                            });
                        }
                    }
                } else {
                    await firebase.firestore().collection('ajustes').add(ajusteData);
                    if (tipo === 'notaCredito') {
                        var ncNum3 = document.getElementById('aj-nc-num').value.trim();
                        await firebase.firestore().collection('notasCredito').add({
                            ncNum: ncNum3 || '',
                            cliente: clienteVal,
                            monto: Math.abs(monto),
                            motivo: motivo,
                            fecha: firebase.firestore.FieldValue.serverTimestamp(),
                            empresa: '',
                            interlogicId: '',
                            guia: '',
                            docRef: '',
                            afectaSaldo: false,
                            estado: 'activa',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdBy: firebase.auth().currentUser?.uid || ''
                        });
                    }
                }

                modal.remove();
                showToast('✅ Ajuste guardado', 'success');
            } catch(err) { showToast('Error: '+err.message,'error'); setButtonLoading(btn,false); }
        });
    },

    showPaymentModal(recordId) {
        const records = this.getCreditRecords();
        const r = records.find(rec => rec.id === recordId);
        if (!r) { showToast('Registro no encontrado', 'error'); return; }

        const cobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
        const pendiente = Math.max(0, Number(r.venta || 0) - cobrado);
        if (pendiente <= 0) { showToast('Esta factura ya está pagada', 'error'); return; }

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:450px;">
                <h2 style="margin-bottom:1rem;">💰 Registrar Pago</h2>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;margin-bottom:1rem;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;">
                        <div><span style="color:#8e8e93;">Guía:</span> <strong>${sanitizeHTML(r.guia||'N/A')}</strong></div>
                        <div><span style="color:#8e8e93;">Cliente:</span> <strong>${sanitizeHTML(r.cliente||'')}</strong></div>
                        <div><span style="color:#8e8e93;">Venta:</span> <strong>${formatCurrency(r.venta||0)}</strong></div>
                        <div><span style="color:#8e8e93;">Cobrado:</span> <strong style="color:#22c55e;">${formatCurrency(cobrado)}</strong></div>
                        <div style="grid-column:span 2;"><span style="color:#8e8e93;">Pendiente:</span> <strong style="color:#ef4444;font-size:1.1rem;">${formatCurrency(pendiente)}</strong></div>
                    </div>
                    ${(r.planPagos||[]).length > 0 ? `
                    <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px dashed #e2e8f0;">
                        <div style="font-size:0.75rem;color:#7c3aed;font-weight:600;margin-bottom:4px;">📅 Pagos programados:</div>
                        ${r.planPagos.map((pp,i) => `<div style="font-size:0.75rem;color:#555;">${i+1}. ${pp.fecha} — ${formatCurrency(pp.monto)}</div>`).join('')}
                    </div>
                    ` : ''}
                </div>
                <form id="payment-form">
                    <div class="form-group">
                        <label>Monto a cobrar</label>
                        <input type="number" id="pay-monto" step="0.01" min="0.01" max="${pendiente}" value="${pendiente}" style="width:100%;" required>
                    </div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Método de pago</label>
                        <select id="pay-metodo" style="width:100%;">
                            <option value="efectivo">💵 Efectivo</option>
                            <option value="transferencia">🏦 Transferencia</option>
                            <option value="deposito">🏧 Depósito</option>
                            <option value="tarjeta">💳 Tarjeta</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Referencia / No. Operación</label>
                        <input type="text" id="pay-referencia" style="width:100%;" placeholder="Opcional">
                    </div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-pay-save">💾 Registrar Pago</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target===modal) modal.remove(); };

        document.getElementById('payment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-pay-save');
            setButtonLoading(btn, true);
            try {
                const monto = parseFloat(document.getElementById('pay-monto').value) || 0;
                if (monto <= 0) { showToast('Ingresa un monto válido', 'error'); setButtonLoading(btn,false); return; }

                const nuevoCobrado = cobrado + monto;
                const nuevoEstado = nuevoCobrado >= Number(r.venta||0) ? 'pagado' : 'parcial';

                const batch = firebase.firestore().batch();
                batch.set(firebase.firestore().collection('cobros').doc(), {
                    interlogicId: r.id,
                    cliente: r.cliente,
                    guia: r.guia,
                    monto: monto,
                    metodo: document.getElementById('pay-metodo').value,
                    referencia: document.getElementById('pay-referencia').value,
                    fecha: firebase.firestore.FieldValue.serverTimestamp(),
                    usuario: firebase.auth().currentUser?.uid || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                batch.update(firebase.firestore().collection('interlogic').doc(r.id), {
                    montoCobrado: nuevoCobrado,
                    montoPendiente: Math.max(0, Number(r.venta||0) - nuevoCobrado),
                    estadoCobro: nuevoEstado,
                    cobrado: nuevoCobrado >= Number(r.venta||0),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                await batch.commit();

                modal.remove();
                showToast(`✅ Pago de ${formatCurrency(monto)} registrado`, 'success');
            } catch(err) { showToast('Error: '+err.message,'error'); setButtonLoading(btn,false); }
        });
    }
};

window.CobranzaAdjustments = CobranzaAdjustments;
