// ===================================
// Shared Components - Reutilizables en todos los módulos
// ===================================

const SharedComponents = {
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
