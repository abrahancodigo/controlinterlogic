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
            if (Interlogic._desktopAbortController) {
                Interlogic._desktopAbortController.abort();
                Interlogic._desktopAbortController = null;
            }
            if (Interlogic._contentAbortController) {
                Interlogic._contentAbortController.abort();
                Interlogic._contentAbortController = null;
            }
            if (typeof Interlogic._detachPopupScroll === 'function') Interlogic._detachPopupScroll();
            if (typeof Interlogic._excelDetachGlobalHandlers === 'function') Interlogic._excelDetachGlobalHandlers();
            Interlogic.eventDelegationSetup = false;
            Interlogic._mobileDelegationSetup = false;
            Interlogic._previewMode = false;
            const bulk = document.getElementById('bulk-actions-container');
            if (bulk) bulk.remove();
            document.querySelectorAll('.filter-popup').forEach(el => {
                if (el.parentElement === document.body) el.remove();
            });
        }
    });
}
