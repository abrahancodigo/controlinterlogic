const UxRedesign = {
_init:false,
init() {
if (this._init) return;
this._init = true;
this._injectTopbar();
this._labelNavItems();
this._groupNavItems();
this._syncTopbar();
this._bindGlobal();
},
_moduleName(key) {
const names = { dashboard:'Resumen', interlogic:'Control Interlogic', problemas:'Problemas', clientes:'Clientes', flota:'Flota y Mantenimiento', liquidacion:'Liquidación', deliveries:'Entrega de Muebles', kpi:'Evaluación KPI', asistencia:'Asistencia', tarimas:'Tarimas Walmart', settings:'Configuraciones', users:'Gestión de Usuarios' };
return names[key] || key;
},
_injectTopbar() {
if (document.querySelector('.ux-topbar')) return;
const main = document.querySelector('.main-content');
if (!main) return;
const bar = document.createElement('div');
bar.className = 'ux-topbar';
bar.innerHTML = '<nav class="ux-crumbs" aria-label="Ubicación"><span>Dalse</span><span aria-hidden="true">/</span><strong id="ux-crumb-module">Resumen</strong></nav>'
+ '<label class="ux-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="ux-global-search" type="text" placeholder="Buscar módulo…" aria-label="Buscar módulo" autocomplete="off"><button type="button" class="ux-search-clear" id="ux-search-clear" aria-label="Limpiar búsqueda" tabindex="-1">×</button><kbd>Ctrl K</kbd></label>'
+ '<div class="ux-top-actions"><span class="ux-today" id="ux-today"></span><button class="ux-icon-btn" id="ux-density-btn" title="Alternar densidad de tablas" aria-label="Alternar densidad de tablas"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button><button class="ux-icon-btn" id="ux-theme-btn" title="Cambiar tema" aria-label="Cambiar tema"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></button></div>';
document.getElementById('app').insertBefore(bar, main);
const today = document.getElementById('ux-today');
if (today) today.textContent = new Date().toLocaleDateString('es-SV', { weekday:'short', day:'2-digit', month:'short' });
try { if (localStorage.getItem('ux-compact') === '1') document.body.classList.add('ux-compact'); } catch (e) {}
},
_labelNavItems() {
document.querySelectorAll('.nav-item[data-module]').forEach(a => {
const t = a.querySelector('.nav-text');
if (t && !a.getAttribute('data-ux-label')) a.setAttribute('data-ux-label', t.textContent.trim());
});
},
_groupNavItems() {
const groups = [['interlogic','Operación'],['clientes','Gestión'],['kpi','Indicadores']];
groups.forEach(g => {
const item = document.querySelector('.nav-item[data-module="' + g[0] + '"]');
if (!item) return;
const prev = item.previousElementSibling;
if (prev && prev.classList.contains('nav-group-label')) return;
const label = document.createElement('div');
label.className = 'nav-group-label';
label.textContent = g[1];
item.parentNode.insertBefore(label, item);
});
},
_syncTopbar() {
const crumb = document.getElementById('ux-crumb-module');
const apply = () => {
const mod = (window.App && window.App.currentModule) || 'dashboard';
if (crumb) crumb.textContent = this._moduleName(mod);
const bar = document.querySelector('.ux-topbar');
const sb = document.getElementById('sidebar');
if (bar && sb) bar.classList.toggle('ux-wide', sb.classList.contains('collapsed'));
};
apply();
new MutationObserver(apply).observe(document.getElementById('content-area'), { childList:true });
const sb = document.getElementById('sidebar');
if (sb) new MutationObserver(apply).observe(sb, { attributes:true, attributeFilter:['class'] });
},
_bindGlobal() {
document.addEventListener('keydown', (e) => {
if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
e.preventDefault();
const i = document.getElementById('ux-global-search');
if (i) i.focus();
}
if (e.key === 'Escape') {
const i = document.getElementById('ux-global-search');
if (document.activeElement === i) i.blur();
}
});
document.addEventListener('input', (e) => {
if (e.target && e.target.id === 'ux-global-search') {
this._filterNav(e.target.value);
const clear = document.getElementById('ux-search-clear');
if (clear) clear.classList.toggle('visible', !!e.target.value);
}
});
document.addEventListener('keydown', (e) => {
if (e.target && e.target.id === 'ux-global-search' && e.key === 'Enter') {
const first = document.querySelector('.nav-item[data-module]:not([style*="none"])');
if (first && window.App) first.click();
}
});
document.addEventListener('click', (e) => {
if (e.target.closest('#ux-search-clear')) {
const i = document.getElementById('ux-global-search');
if (i) {
i.value = '';
i.focus();
this._filterNav('');
const clear = document.getElementById('ux-search-clear');
if (clear) clear.classList.remove('visible');
}
return;
}
if (e.target.closest('#ux-density-btn')) {
const on = document.body.classList.toggle('ux-compact');
try { localStorage.setItem('ux-compact', on ? '1' : '0'); } catch (err) {}
return;
}
if (e.target.closest('#ux-theme-btn') && window.ThemeManager) {
window.ThemeManager.set(window.ThemeManager.effective === 'dark' ? 'light' : 'dark');
}
});
document.addEventListener('focusin', (e) => {
const card = e.target.closest && e.target.closest('.dash-kpi-card');
if (card && !card.hasAttribute('tabindex')) card.setAttribute('tabindex','0');
});
},
_filterNav(q) {
q = (q || '').toLowerCase().trim();
document.querySelectorAll('.nav-item[data-module]').forEach(a => {
const label = (a.getAttribute('data-ux-label') || a.textContent || '').toLowerCase();
const restricted = !window.AccessControl?.canView(a.dataset.module);
a.style.display = !restricted && (!q || label.includes(q)) ? '' : 'none';
});
document.querySelectorAll('.nav-group-label').forEach(l => {
l.style.display = q ? 'none' : '';
});
}
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => UxRedesign.init());
else UxRedesign.init();
window.UxRedesign = UxRedesign;
