// ===================================
// Interlogic - Main Index Module
// ===================================

const Interlogic = {
    ...InterlogicCore,
    ...InterlogicRender,
    ...InterlogicFilters,
    ...InterlogicCRUD,
    ...InterlogicExcel,
    ...InterlogicRoutes
};

window.Interlogic = Interlogic;

if (window.ModuleRegistry) {
    ModuleRegistry.register({
        key: 'interlogic',
        label: 'Control Interlogic',
        render: () => Interlogic.render(),
        cleanup: () => {
            if (Interlogic.unsubscribe) { Interlogic.unsubscribe(); Interlogic.unsubscribe = null; }
            Interlogic.selectedRecords.clear();
            if (Interlogic._bulkDocHandler) {
                document.removeEventListener('click', Interlogic._bulkDocHandler);
                Interlogic._bulkDocHandler = null;
            }
            const bulk = document.getElementById('bulk-actions-container');
            if (bulk) bulk.remove();
            document.querySelectorAll('.filter-popup').forEach(el => {
                if (el.parentElement === document.body) el.remove();
            });
        }
    });
}
