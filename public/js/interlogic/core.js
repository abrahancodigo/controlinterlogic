// ===================================
// Interlogic - Core Module (State & Properties)
// ===================================

function getLocalDateString() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const toCents = v => Math.round((parseFloat(v) || 0) * 100);
const fromCents = c => (c / 100).toFixed(2);

const InterlogicCore = {
    records: [],
    filteredRecords: [],
    loading: false,
    selectedRecords: new Set(),
    filters: {
        search: '',
        startDate: getLocalDateString(),
        endDate: getLocalDateString(),
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
    },
    currentSort: {
        field: '',
        direction: ''
    },
    unsubscribe: null,
    columnDefs: [
        { key: 'guia', label: 'Guía' },
        { key: 'empresa', label: 'Empresa' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'doc', label: 'Doc' },
        { key: 'docNum', label: 'Doc #' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'departamento', label: 'Departamento' },
        { key: 'municipio', label: 'Municipio' },
        { key: 'vendedor', label: 'Vendedor' },
        { key: 'condicionPago', label: 'Condición' },
        { key: 'venta', label: 'Venta' },
        { key: 'bultos', label: 'Bultos' },
        { key: 'cobrador', label: 'Cajas' },
        { key: 'costoEnvio', label: 'Envío' },
        { key: 'costoPorcentaje', label: '% Costo' },
        { key: 'observations', label: 'Observaciones' },
        { key: 'entrega', label: 'Entrega' },
        { key: 'cobra', label: 'Cobra' },
        { key: 'encargado', label: 'Encargado' },
        { key: 'formaPago', label: 'Forma Pago' },
        { key: 'acciones', label: 'Acciones' }
    ],
    hiddenColumns: (() => {
        try { return JSON.parse(localStorage.getItem('il_hidden_cols') || '[]'); } catch (e) { return []; }
    })(),

    _clientSearchCache: null,

    _invalidateClientCache() {
        this._clientSearchCache = null;
    },

    getDistinctValues(field) {
        var valuesSet = {};
        this.records.forEach(function(r) {
            var v = r[field];
            if (v !== undefined && v !== null && v !== '') valuesSet[String(v)] = true;
        });
        return Object.keys(valuesSet).sort();
    },

    _dateToTs(dateStr) {
        if (!dateStr) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        return firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
    }
};

window.InterlogicCore = InterlogicCore;
