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
