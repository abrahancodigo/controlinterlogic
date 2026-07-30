// ===================================
// Cobranza - Core Module
// ===================================

const CobranzaCore = {
    records: [],
    clientes: [],
    cobros: [],
    gestiones: [],
    ajustes: [],
    notasCredito: [],
    routes: [],
    currentView: 'dashboard',
    unsubscribeRecords: null,
    unsubscribeCobros: null,
    unsubscribeGestiones: null,
    unsubscribeAjustes: null,
    unsubscribeNC: null,

    async loadData() {
        const db = firebase.firestore();
        return new Promise((resolve) => {
            const loadedCollections = new Set();
            const totalNeeded = 6;
            const checkDone = (name) => {
                if (!loadedCollections.has(name)) {
                    loadedCollections.add(name);
                    if (loadedCollections.size >= totalNeeded) resolve();
                }
            };

            if (window.Interlogic && window.Interlogic.records && window.Interlogic.records.length > 0) {
                this.records = window.Interlogic.records;
                checkDone('records');
            } else {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
                sixMonthsAgo.setHours(0,0,0,0);
                const startTs = firebase.firestore.Timestamp.fromDate(sixMonthsAgo);
                db.collection('interlogic')
                    .where('createdAt', '>=', startTs)
                    .orderBy('createdAt', 'desc')
                    .limit(3000).get().then(snap => {
                    this.records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    checkDone('records');
                }).catch(err => { console.error('Error loading interlogic:', err); checkDone('records'); });
            }

            if (this.unsubscribeCobros) this.unsubscribeCobros();
            this.unsubscribeCobros = db.collection('cobros')
                .orderBy('createdAt', 'desc')
                .onSnapshot(snap => {
                    this.cobros = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (loadedCollections.size >= totalNeeded) this.renderCurrentView();
                    checkDone('cobros');
                }, err => { console.error('Error loading cobros:', err); showToast('Error cargando cobros', 'error'); checkDone('cobros'); });

            db.collection('gestiones').orderBy('createdAt', 'desc').limit(500).get().then(snap => {
                this.gestiones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('gestiones');
            }).catch(err => { console.error('Error loading gestiones:', err); checkDone('gestiones'); });

            db.collection('ajustes').orderBy('createdAt', 'desc').limit(500).get().then(snap => {
                this.ajustes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('ajustes');
            }).catch(err => { console.error('Error loading ajustes:', err); checkDone('ajustes'); });

            db.collection('notasCredito').orderBy('createdAt', 'desc').limit(1000).get().then(snap => {
                this.notasCredito = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('nc');
            }).catch(err => { console.error('Error loading notasCredito:', err); checkDone('nc'); });

            db.collection('rutas').orderBy('fecha', 'desc').limit(100).get().then(snap => {
                this.routes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('rutas');
            }).catch(err => { console.error('Error loading rutas:', err); showToast('Error cargando rutas', 'error'); checkDone('rutas'); });

            if (window.Clientes && window.Clientes.loadRecords) {
                window.Clientes.loadRecords()
                    .then(() => { this.clientes = window.Clientes.getAll(); checkDone('clientes'); })
                    .catch(err => { console.error('Error loading clientes:', err); checkDone('clientes'); });
            } else {
                checkDone('clientes');
            }
        });
    },

    getCreditRecords() {
        return this.records.map(r => {
            const estadoCobro = r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente');
            const montoCobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
            const planPagos = r.planPagos || [];
            const montoProgramado = planPagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
            const pendiente = Math.max(0, Number(r.venta || 0) - montoCobrado - montoProgramado);
            const fechaVenc = r.fechaVencimiento ? (r.fechaVencimiento.toDate ? r.fechaVencimiento.toDate() : new Date(r.fechaVencimiento)) : null;
            let agingDays = 0;
            if (fechaVenc && estadoCobro !== 'pagado') {
                agingDays = Math.floor((new Date() - fechaVenc) / (1000 * 60 * 60 * 24));
            }
            let agingBucket = 'corriente';
            if (agingDays <= 0) agingBucket = 'corriente';
            else if (agingDays <= 30) agingBucket = '1-30';
            else if (agingDays <= 60) agingBucket = '31-60';
            else if (agingDays <= 90) agingBucket = '61-90';
            else agingBucket = '90+';
            return { ...r, estadoCobro, montoCobrado, montoProgramado, planPagos, pendiente, fechaVenc, agingDays, agingBucket };
        });
    },

    calcDSO(records) {
        const pendientes = records.filter(r => r.estadoCobro !== 'pagado');
        const totalCxC = pendientes.reduce((s, r) => s + r.pendiente, 0);
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ventasCreditoMes = records.filter(r => {
            const f = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
            return f && f >= inicioMes;
        }).reduce((s, r) => s + Number(r.venta || 0), 0);
        const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        if (ventasCreditoMes <= 0) return 0;
        return Math.round((totalCxC / ventasCreditoMes) * diasMes);
    },

    calcCEI(records) {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const cobradoMes = this.cobros.filter(c => c.fecha && c.fecha.toDate && c.fecha.toDate() >= inicioMes)
            .reduce((s, c) => s + (Number(c.monto) || 0), 0);
        const ventasMes = records.filter(r => {
            const f = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
            return f && f >= inicioMes;
        }).reduce((s, r) => s + Number(r.venta || 0), 0);
        const saldoInicial = records.filter(r => {
            const f = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
            return f && f < inicioMes && r.estadoCobro !== 'pagado';
        }).reduce((s, r) => s + r.pendiente, 0);
        const denominator = saldoInicial + ventasMes;
        return denominator > 0 ? Math.round((cobradoMes / denominator) * 100) : 0;
    },

    getMonthlyComparison(records) {
        const months = [];
        const hoy = new Date();
        for (let i = 2; i >= 0; i--) {
            const y = hoy.getFullYear();
            const m = hoy.getMonth() - i;
            const date = new Date(y, m, 1);
            const label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            const inicio = new Date(date.getFullYear(), date.getMonth(), 1);
            const fin = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const ventas = records.filter(r => {
                const f = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
                return f && f >= inicio && f <= fin;
            }).reduce((s, r) => s + Number(r.venta || 0), 0);
            const cobrosMes = this.cobros.filter(c => {
                const f = c.fecha && c.fecha.toDate ? c.fecha.toDate() : null;
                return f && f >= inicio && f <= fin;
            }).reduce((s, c) => s + (Number(c.monto) || 0), 0);
            months.push({ label, ventas, cobros: cobrosMes });
        }
        return months;
    },

    getAlertas() {
        const records = this.getCreditRecords().filter(r => r.estadoCobro !== 'pagado');
        const alertas = [];

        records.forEach(r => {
            if (r.agingDays >= 60) alertas.push({ tipo: 'critico', icono: '🔴', mensaje: `${r.cliente||'Sin nombre'}: ${formatCurrency(r.pendiente)} vencido hace ${r.agingDays} días (Guía #${r.guia||'N/A'})` });
        });

        records.forEach(r => {
            if (r.agingDays >= 30 && r.agingDays < 60) alertas.push({ tipo: 'warning', icono: '🟠', mensaje: `${r.cliente||'Sin nombre'}: ${formatCurrency(r.pendiente)} con ${r.agingDays} días de atraso (Guía #${r.guia||'N/A'})` });
        });

        records.forEach(r => {
            if (r.agingDays > 0 && r.agingDays < 30) alertas.push({ tipo: 'aviso', icono: '🟡', mensaje: `${r.cliente||'Sin nombre'}: ${formatCurrency(r.pendiente)} vencido por ${r.agingDays} días (Guía #${r.guia||'N/A'})` });
        });

        const now = new Date();
        records.filter(r => r.agingDays <= 0).forEach(r => {
            if (r.fechaVenc) {
                const diasHasta = Math.abs(r.agingDays);
                if (diasHasta <= 7) alertas.push({ tipo: 'info', icono: '🔵', mensaje: `${r.cliente||'Sin nombre'}: ${formatCurrency(r.pendiente)} vence en ${diasHasta} días (Guía #${r.guia||'N/A'})` });
            }
        });

        return alertas;
    }
};

window.CobranzaCore = CobranzaCore;
