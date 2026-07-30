// ===================================
// Cobranza - Gestiones Module
// ===================================

const CobranzaGestiones = {
    renderGestiones() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords();

        container.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem;">
                <button class="btn btn-primary" id="cob-btn-nueva-gestion">➕ Nueva Gestión</button>
            </div>
            <div id="cob-gestiones-list">
                ${this.gestiones.length===0 ? '<div class="card"><div class="card-body" style="text-align:center;padding:2rem;color:#8e8e93;">No hay gestiones registradas. Usa el botón para registrar una llamada, email, o visita de cobranza.</div></div>' :
                `<div class="card"><div class="card-body"><table style="width:100%;font-size:0.85rem;"><thead><tr style="background:#f0f0f0;"><th style="padding:8px;">Fecha</th><th style="padding:8px;">Cliente</th><th style="padding:8px;">Tipo</th><th style="padding:8px;">Descripción</th><th style="padding:8px;">Resultado</th><th style="padding:8px;">Próx. Acción</th></tr></thead><tbody>${this.gestiones.map(g => `<tr><td style="padding:8px;">${g.fecha&&g.fecha.toDate?formatDateShort(g.fecha):''}</td><td style="padding:8px;">${sanitizeHTML(g.cliente||'')}</td><td style="padding:8px;">${g.tipo||''}</td><td style="padding:8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${sanitizeHTML(g.descripcion||'')}</td><td style="padding:8px;">${sanitizeHTML(g.resultado||'')}</td><td style="padding:8px;">${g.proximaAccion&&g.proximaAccion.toDate?formatDateShort(g.proximaAccion):'-'}</td></tr>`).join('')}</tbody></table></div></div>`
                }
            </div>
        `;

        document.getElementById('cob-btn-nueva-gestion').addEventListener('click', () => this.showGestionModal(records));
    },

    showGestionModal(records) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="margin-bottom:1rem;">📝 Nueva Gestión de Cobranza</h2>
                <form id="gestion-form">
                    <div class="form-group">
                        <label>Cliente</label>
                        <div class="search-container">
                            <div class="search-box" style="position:relative;">
                                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="ges-cliente-search" class="search-input" placeholder="Escribe para buscar cliente..." autocomplete="off">
                                <input type="hidden" id="ges-cliente" value="">
                            </div>
                            <div id="ges-cliente-dropdown" class="premium-dropdown" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Tipo de Gestión</label><select id="ges-tipo" style="width:100%;"><option>llamada</option><option>email</option><option>whatsapp</option><option>visita</option><option>carta</option><option>otro</option></select></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Descripción</label><textarea id="ges-descripcion" rows="3" style="width:100%;" placeholder="Detalle de la gestión..."></textarea></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Resultado / Acuerdo</label><input type="text" id="ges-resultado" style="width:100%;" placeholder="Ej: Prometió pagar el viernes"></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Próxima Acción (fecha)</label><input type="date" id="ges-proxima" style="width:100%;"></div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-ges-save">💾 Guardar Gestión</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target===modal) modal.remove(); };

        const searchInput = document.getElementById('ges-cliente-search');
        const dropdown = document.getElementById('ges-cliente-dropdown');
        const hiddenClient = document.getElementById('ges-cliente');

        const filterClients = (query) => {
            const q = query.toLowerCase().trim();
            if (!q || q.length < 1) { dropdown.style.display = 'none'; return; }
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
                dropdown.innerHTML = '<div class="dropdown-empty"><p style="padding:1rem;color:#8e8e93;">Sin coincidencias</p></div>';
            } else {
                dropdown.innerHTML = unique.map(r => `
                    <div class="dropdown-item" onclick="document.getElementById('ges-cliente-search').value='${sanitizeHTML(r.cliente||'').replace(/'/g,"\\'")}';document.getElementById('ges-cliente').value='${sanitizeHTML(r.cliente||'').replace(/'/g,"\\'")}';document.getElementById('ges-cliente-dropdown').style.display='none';">
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
            dropdown.style.display = 'block';
        };

        searchInput.addEventListener('input', (e) => filterClients(e.target.value));
        searchInput.addEventListener('focus', () => { if (searchInput.value) filterClients(searchInput.value); });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#ges-cliente-search') && !e.target.closest('#ges-cliente-dropdown')) {
                dropdown.style.display = 'none';
            }
        });

        document.getElementById('gestion-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-ges-save');
            const clienteVal = hiddenClient.value || searchInput.value.trim();
            if (!clienteVal) { showToast('Selecciona o escribe un cliente', 'error'); return; }
            setButtonLoading(btn, true);
            try {
                const proxVal = document.getElementById('ges-proxima').value;
                let proxDate = null;
                if (proxVal) { const [y,m,d] = proxVal.split('-').map(Number); proxDate = firebase.firestore.Timestamp.fromDate(new Date(y,m-1,d,12,0,0)); }
                await firebase.firestore().collection('gestiones').add({
                    cliente: clienteVal,
                    tipo: document.getElementById('ges-tipo').value,
                    descripcion: document.getElementById('ges-descripcion').value,
                    resultado: document.getElementById('ges-resultado').value,
                    proximaAccion: proxDate,
                    usuario: firebase.auth().currentUser?.uid || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                modal.remove();
                showToast('✅ Gestión registrada', 'success');
            } catch(err) { showToast('Error: '+err.message,'error'); setButtonLoading(btn,false); }
        });
    }
};

window.CobranzaGestiones = CobranzaGestiones;
