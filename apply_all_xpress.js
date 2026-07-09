const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'public/js/interlogic.js');
let code = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF -> LF for searching, preserve original for writing
const originalCRCount = (code.match(/\r\n/g) || []).length;
code = code.replace(/\r\n/g, '\n');

let totalChanges = 0;

function replaceOnce(oldStr, newStr, label) {
  if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    totalChanges++;
    console.log('✅ ' + label);
  } else {
    console.log('❌ ' + label + ' - NOT FOUND');
  }
}

// ============================================================
// 1. Mobile form - Entrega select: add XPRESS option
// ============================================================
replaceOnce(
  `INTERLOGISTIC</option></select></div><div class="m-form-group"><label>Cobra</label>`,
  `INTERLOGISTIC</option><option value="XPRESS"' + (record?.entrega === 'XPRESS' ? ' selected' : '') + '>XPRESS</option></select></div><div class="m-form-group"><label>Cobra</label>`,
  'Mobile form: entrega XPRESS option'
);

// ============================================================
// 2. Mobile form - Cobra select: add XPRESS option
// ============================================================
replaceOnce(
  `'INTERLOGISTIC</option>`,
  `'INTERLOGISTIC</option><option value="XPRESS"' + (record?.cobra === 'XPRESS' ? ' selected' : '') + '>XPRESS</option>`,
  'Mobile form: cobra XPRESS option'
);

// ============================================================
// 3. Desktop form - Entrega select: add XPRESS option
// ============================================================
replaceOnce(
  `<option value="INTERLOGISTIC" $\{val('entrega') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>\n          </select>`,
  `<option value="INTERLOGISTIC" $\{val('entrega') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>\n          <option value="XPRESS" $\{val('entrega') === 'XPRESS' ? 'selected' : ''}>XPRESS</option>\n          </select>`,
  'Desktop form: entrega XPRESS option'
);

// ============================================================
// 4. Desktop form - Cobra select: add XPRESS option
// ============================================================
replaceOnce(
  `<option value="INTERLOGISTIC" $\{val('cobra') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>\n          </select>`,
  `<option value="INTERLOGISTIC" $\{val('cobra') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>\n          <option value="XPRESS" $\{val('cobra') === 'XPRESS' ? 'selected' : ''}>XPRESS</option>\n          </select>`,
  'Desktop form: cobra XPRESS option'
);

// ============================================================
// 5. toggleCellField cycle
// ============================================================
replaceOnce(
  `const next = current === '' ? 'DALSE' :\n                     current === 'DALSE' ? 'INTERLOGISTIC' : '';`,
  `const next = current === '' ? 'DALSE' :\n                     current === 'DALSE' ? 'INTERLOGISTIC' :\n                     current === 'INTERLOGISTIC' ? 'XPRESS' : '';`,
  'toggleCellField: add XPRESS to cycle'
);

// ============================================================
// 6. Badges - entrega & cobra
// ============================================================
replaceOnce(
  `<span class="badge $\{record.entrega === 'DALSE' ? 'badge-primary' : (record.entrega === 'INTERLOGISTIC' ? 'badge-accent' : 'badge-ghost')}">$\{sanitizeHTML(record.entrega || '\u2014')}</span>\n                </td>\n                <td data-label="Cobra" style="cursor: pointer;" onclick="Interlogic.toggleCellField('$\{record.id}', 'cobra')" title="Clic para cambiar">\n                    <span class="badge $\{record.cobra === 'DALSE' ? 'badge-primary' : (record.cobra === 'INTERLOGISTIC' ? 'badge-accent' : 'badge-ghost')}">`,
  `<span class="badge $\{record.entrega === 'DALSE' ? 'badge-primary' : (record.entrega === 'INTERLOGISTIC' ? 'badge-accent' : (record.entrega === 'XPRESS' ? 'badge-warning' : 'badge-ghost'))}">$\{sanitizeHTML(record.entrega || '\u2014')}</span>\n                </td>\n                <td data-label="Cobra" style="cursor: pointer;" onclick="Interlogic.toggleCellField('$\{record.id}', 'cobra')" title="Clic para cambiar">\n                    <span class="badge $\{record.cobra === 'DALSE' ? 'badge-primary' : (record.cobra === 'INTERLOGISTIC' ? 'badge-accent' : (record.cobra === 'XPRESS' ? 'badge-warning' : 'badge-ghost'))}">`,
  'Badges: add XPRESS variant'
);

// ============================================================
// 7. Batch assign - XPRESS button in modal
// ============================================================
replaceOnce(
  `button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        🚛 INTERLOGISTIC\n                    </button>\n                </div>`,
  `button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        🚛 INTERLOGISTIC\n                    </button>\n                    <button id="ba-xpress" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        📦 XPRESS\n                    </button>\n                </div>`,
  'Batch assign modal: XPRESS button'
);

// ============================================================
// 8. Batch assign - btns array
// ============================================================
replaceOnce(
  `['ba-dalse', 'ba-interlogistic', 'ba-clear']`,
  `['ba-dalse', 'ba-interlogistic', 'ba-xpress', 'ba-clear']`,
  'Batch assign: btns array'
);

// ============================================================
// 9. Batch assign - XPRESS onclick handler
// ============================================================
replaceOnce(
  `document.getElementById('ba-interlogistic').onclick = () => doAssign('INTERLOGISTIC');`,
  `document.getElementById('ba-interlogistic').onclick = () => doAssign('INTERLOGISTIC');\n        document.getElementById('ba-xpress').onclick = () => doAssign('XPRESS');`,
  'Batch assign: XPRESS onclick'
);

// ============================================================
// Save if changes were made
// ============================================================
console.log(`\nTotal: ${totalChanges} changes applied`);

if (totalChanges > 0) {
  // Restore CRLF for consistency
  code = code.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('File saved successfully!');
}
