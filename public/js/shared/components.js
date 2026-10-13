// ===================================
// Shared Components - Reutilizables en todos los módulos
// ===================================

const SharedComponents = {
    icons: {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        interlogic: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
        problemas: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        clientes: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        flota: '<path d="M14 8l-3 3-3-3"/><path d="M14 16l-3-3-3 3"/><circle cx="12" cy="12" r="10"/>',
        liquidacion: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
        deliveries: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
        kpi: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
        asistencia: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
        tarimas: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'
    },

    /**
     * Genera HTML para el encabezado unificado de un modulo.
     * @param {Object} config - Configuración
     *   - title: Título del módulo (requerido)
     *   - subtitle: Texto descriptivo (opcional)
     *   - icon: Nombre del icono (clave de SharedComponents.icons) o SVG crudo (opcional)
     *   - actions: HTML de la barra de acciones (opcional)
     *   - actionsStyle: Estilos inline para el contenedor de acciones (opcional)
     * @returns {string} HTML del encabezado
     */
    renderModuleHeader(config = {}) {
        const iconKey = config.icon && this.icons[config.icon] ? this.icons[config.icon] : '';
        const icon = iconKey
            ? `<span class="mh-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconKey}</svg></span>`
            : '';
        const subtitle = config.subtitle ? `<p>${config.subtitle}</p>` : '';
        const actionsStyle = config.actionsStyle ? ` style="${config.actionsStyle}"` : '';
        const actions = config.actions
            ? `<div class="mh-actions"${actionsStyle}>${config.actions}</div>`
            : '';

        return `<div class="module-header">
            <div class="mh-head">
                ${icon}
                <div class="mh-text">
                    <h1>${config.title || ''}</h1>
                    ${subtitle}
                </div>
            </div>
            ${actions}
        </div>`;
    },

    /**
     * Genera HTML para un grid de estadísticas.
     * @param {Array} stats - Array de objetos con { label, id, style?, tag? }
     *   - label: Texto de la etiqueta (ej: "Total Clientes")
     *   - id: ID del elemento <p> donde se actualizará el valor
     *   - style: (opcional) Estilos inline para el <p>
     *   - tag: (opcional) 'small' o 'h3' (default: 'h3')
     * @param {Object} options - Opciones adicionales
     *   - containerId: ID del contenedor
     *   - containerStyle: Estilos inline para el contenedor
     * @returns {string} HTML del grid
     */
    renderStatsGrid(stats, options = {}) {
        const containerId = options.containerId ? ` id="${options.containerId}"` : '';
        const containerStyle = options.containerStyle ? ` style="${options.containerStyle}"` : '';

        const cards = stats.map(stat => {
            const tag = stat.tag || 'h3';
            const style = stat.style ? ` style="${stat.style}"` : '';
            return `
                <div class="stat-card">
                    <${tag}>${stat.label}</${tag}>
                    <p id="${stat.id}"${style}>0</p>
                </div>
            `;
        }).join('');

        return `<div class="stats-grid"${containerStyle}${containerId}>${cards}</div>`;
    },

    /**
     * Genera HTML para una barra de búsqueda.
     * @param {Object} config - Configuración
     *   - id: ID del input
     *   - placeholder: Texto placeholder
     *   - value: Valor inicial (opcional)
     *   - style: Estilos adicionales para el input (opcional)
     *   - containerStyle: Estilos para el contenedor (opcional)
     *   - fullWidth: Si es true, ocupa todo el ancho (default: false)
     * @returns {string} HTML del search bar
     */
    renderSearchBar(config) {
        const id = config.id || 'search-input';
        const placeholder = config.placeholder || '🔍 Buscar...';
        const value = config.value ? ` value="${String(config.value).replace(/"/g, '&quot;')}"` : '';
        const fullWidth = config.fullWidth !== false;
        
        const baseStyle = fullWidth 
            ? 'width: 100%; padding: 0.6rem 1rem; font-size: 0.95rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); font-family: var(--font-family); transition: all 0.25s; background: white;'
            : 'flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 0.9rem; min-width: 200px;';
        
        const style = config.style ? `${baseStyle} ${config.style}` : baseStyle;
        const containerStyle = config.containerStyle ? ` style="${config.containerStyle}"` : '';
        
        return `<div${containerStyle}>
            <input type="text" id="${id}" placeholder="${placeholder}"${value} style="${style}">
        </div>`;
    },

    /**
     * Genera HTML para una card móvil (m-data-card).
     * @param {Object} config - Configuración
     *   - id: ID del dato (opcional, para data-id)
     *   - title: Título de la card
     *   - badge: Texto del badge (opcional)
     *   - badgeType: Tipo de badge: 'success'|'warning'|'primary'|'ghost' (opcional)
     *   - rows: Array de { label, value, style?, onclick? } para las filas
     *   - actions: Array de { icon, onclick, class?, title? } para botones de acción (opcional)
     *   - extraClass: Clases adicionales para la card (opcional)
     *   - extraStyle: Estilos adicionales para la card (opcional)
     *   - onclick: Handler de click en la card (opcional)
     * @returns {string} HTML de la card
     */
    renderMobileCard(config) {
        const idAttr = config.id ? ` data-id="${sanitizeHTML(config.id)}"` : '';
        const extraClass = config.extraClass ? ` ${config.extraClass}` : '';
        const extraStyle = config.extraStyle ? ` style="${config.extraStyle}"` : '';
        const onclick = config.onclick ? ` onclick="${config.onclick}"` : '';

        const badge = config.badge 
            ? `<span class="m-card-badge ${config.badgeType || ''}">${config.badge}</span>` 
            : '';

        const rows = (config.rows || []).map(row => {
            const style = row.style ? ` style="${row.style}"` : '';
            const rowOnclick = row.onclick ? ` onclick="${row.onclick}" style="cursor:pointer;"` : '';
            return `<div class="m-card-row"${rowOnclick}><span class="m-card-label">${row.label}</span><span class="m-card-value"${style}>${row.value}</span></div>`;
        }).join('');

        const actions = (config.actions || []).map(action => {
            const cls = action.class ? ` ${action.class}` : '';
            const title = action.title ? ` title="${action.title}"` : '';
            return `<button class="m-card-action${cls}"${title} ${action.onclick}>${action.icon}</button>`;
        }).join('');

        const actionsHtml = actions 
            ? `<div class="m-card-actions" onclick="event.stopPropagation()">${actions}</div>` 
            : '';

        return `<div class="m-data-card${extraClass}"${idAttr}${extraStyle}${onclick}>
            <div class="m-card-header">
                <span class="m-card-title">${config.title || ''}</span>
                ${badge}
            </div>
            <div class="m-card-rows">${rows}</div>
            ${actionsHtml}
        </div>`;
    }
};

window.SharedComponents = SharedComponents;
