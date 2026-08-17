const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/js/interlogic.js');
let code = fs.readFileSync(filePath, 'utf8');

// Find the corrupted section
const startMarker = '    // Toggle Entrega/Cobra with one click from table cell\n    async toggleCellField(id, field) {\n        if (!window.permissions?.canEdit) {\n            showToast(\'No tienes permisos para editar\', \'error\');\n            return;\n        }\n\n        const record = this.records.find(r => r.id === id);\n        if';
const endMarker = "        document.getElementById('ba-cancel').onclick = () => modal.remove();\n        modal.onclick = (e) => { if (e.target === modal) modal.remove(); }\n    },";

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  // Extract the full corrupted section
  const corruptedSection = code.substring(startIdx, endIdx + endMarker.length);
  console.log('Found corrupted section from', startIdx, 'to', endIdx + endMarker.length);
  console.log('Corrupted section length:', corruptedSection.length);
  console.log('First 100 chars:', corruptedSection.substring(0, 100));
  console.log('Last 100 chars:', corruptedSection.substring(corruptedSection.length - 100));
  
  // Build the correct replacement
  const correctCode = `    // Toggle Entrega/Cobra with one click from table cell
    async toggleCellField(id, field) {
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar', 'error');
            return;
        }

        const record = this.records.find(r => r.id === id);
        if (!record) return;

        const current = record[field] || '';
        const next = current === '' ? 'DALSE' :
                     current === 'DALSE' ? 'INTERLOGISTIC' :
                     current === 'INTERLOGISTIC' ? 'XPRESS' : '';

        // Optimistic UI update
        record[field] = next;
        this.applyFilters();

        try {
            await firebase.firestore().collection('interlogic').doc(id).update({
                [field]: next,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const label = field === 'entrega' ? '\ud83c\udfe2' : '\ud83d\udcb0';
            showToast(\`\${label} \${field === 'entrega' ? 'Entrega' : 'Cobra'}: \${next || 'vac\u00edo'}\`, 'success');
        } catch (error) {
            // Rollback
            record[field] = current;
            this.applyFilters();
            showToast('Error al actualizar: ' + error.message, 'error');
        }
    },

    // Batch assign Entrega/Cobra to all selected records
    batchAssignField(field) {
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar registros', 'error');
            return;
        }
        const count = this.selectedRecords.size;
        if (count === 0) return;

        const label = field === 'entrega' ? '\ud83d\ude9a Entrega' : '\ud83d\udcb0 Cobra';

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = \`
            <div class="modal-content" style="max-width: 380px;">
                <h2 style="margin-bottom: 0.5rem; text-align: center;">\${label}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.2rem; text-align: center;">
                    Asignar a <strong>\${count} registro(s)</strong> seleccionado(s)
                </p>
                <div style="display: flex; gap: 0.8rem; margin-bottom: 0.5rem;">
                    <button id="ba-dalse" class="btn btn-primary" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">
                        \ud83c\udfe2 DALSE
                    </button>
                    <button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">
                        \ud83d\ude9b INTERLOGISTIC
                    </button>
                    <button id="ba-xpress" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">
                        \ud83d\udce6 XPRESS
                    </button>
                </div>
                <button id="ba-clear" class="btn btn-secondary" style="width: 100%; margin-bottom: 0.5rem;">
                    \ud83e\uddf9 Limpiar (vac\u00edo)
                </button>
                <button id="ba-cancel" class="btn btn-ghost" style="width: 100%;">Cancelar</button>
            </div>
        \`;
        document.body.appendChild(modal);

        const self = this;
        const doAssign = async (value) => {
            const btns = ['ba-dalse', 'ba-interlogistic', 'ba-xpress', 'ba-clear'].map(id => document.getElementById(id));
            btns.forEach(b => { if (b) { b.disabled = true; b.style.opacity = '0.6'; } });

            const ids = [...self.selectedRecords];
            try {
                const db = firebase.firestore();
                const batch = db.batch();
                ids.forEach(id => {
                    batch.update(db.collection('interlogic').doc(id), {
                        [field]: value,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();

                // Update local records
                self.records.forEach(r => {
                    if (self.selectedRecords.has(r.id)) r[field] = value;
                });
                self.selectedRecords.clear();
                self.applyFilters();
                modal.remove();
                showToast(\`\u2713 \${label}: "\${value || 'vac\u00edo'}" en \${ids.length} registro(s)\`, 'success');
            } catch (error) {
                showToast('Error al actualizar: ' + error.message, 'error');
                btns.forEach(b => { if (b) { b.disabled = false; b.style.opacity = '1'; } });
            }
        };

        document.getElementById('ba-dalse').onclick = () => doAssign('DALSE');
        document.getElementById('ba-interlogistic').onclick = () => doAssign('INTERLOGISTIC');
        document.getElementById('ba-xpress').onclick = () => doAssign('XPRESS');
        document.getElementById('ba-clear').onclick = () => doAssign('');
        document.getElementById('ba-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); }
    },`;

  code = code.substring(0, startIdx) + correctCode + code.substring(endIdx + endMarker.length);
  
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('✅ Corruption fixed!');
} else {
  console.log('❌ Could not find markers. startIdx:', startIdx, 'endIdx:', endIdx);
}
