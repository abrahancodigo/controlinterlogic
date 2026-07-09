const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/js/interlogic.js');
let code = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Read the file as a string - avoid template issues by reading raw
// and using substring matching

// Find the mobile form's Entrega select section
// Look for the entrega select with DALSE/INTERLOGISTIC options
const searchStr1 = 'id="mf-entrega">';
const startIdx1 = code.indexOf(searchStr1);
if (startIdx1 !== -1) {
  // Find where INTERLOGISTIC closes in entrega section
  const entregaSection = code.substring(startIdx1, startIdx1 + 400);
  const interlogisticClose = 'INTERLOGISTIC</option>';
  const closeIdx = entregaSection.indexOf(interlogisticClose);
  if (closeIdx !== -1) {
    const insertPoint = startIdx1 + closeIdx + interlogisticClose.length;
    const xpressOption = '<option value="XPRESS"' + " + (record?.entrega === 'XPRESS' ? ' selected' : '') + " + '>XPRESS</option>';
    code = code.substring(0, insertPoint) + xpressOption + code.substring(insertPoint);
    changes++;
    console.log('OK: Mobile entrega');
  }
}

// Find the mobile form's Cobra select section  
const searchStr2 = 'id="mf-cobra">';
const startIdx2 = code.indexOf(searchStr2);
if (startIdx2 !== -1) {
  const cobraSection = code.substring(startIdx2, startIdx2 + 400);
  const interlogisticClose = 'INTERLOGISTIC</option>';
  const closeIdx = cobraSection.indexOf(interlogisticClose);
  if (closeIdx !== -1) {
    const insertPoint = startIdx2 + closeIdx + interlogisticClose.length;
    const xpressOption = '<option value="XPRESS"' + " + (record?.cobra === 'XPRESS' ? ' selected' : '') + " + '>XPRESS</option>';
    code = code.substring(0, insertPoint) + xpressOption + code.substring(insertPoint);
    changes++;
    console.log('OK: Mobile cobra');
  }
}

// Desktop form - Entrega select
const marker2a = '<option value="DALSE" ${val(\'entrega\') === \'DALSE\' ? \'selected\' : \'\'}>DALSE</option>';
const idx2a = code.indexOf(marker2a);
if (idx2a !== -1) {
  const section2 = code.substring(idx2a, idx2a + 300);
  const closeSelect = '</select>';
  const interlogisticClose = 'INTERLOGISTIC</option>';
  const closeIdx2 = section2.indexOf(interlogisticClose);
  if (closeIdx2 !== -1) {
    const insertPoint = idx2a + closeIdx2 + interlogisticClose.length;
    const xpressOption = '<option value="XPRESS" ${val(\'entrega\') === \'XPRESS\' ? \'selected\' : \'\'}>XPRESS</option>\n                                        ';
    code = code.substring(0, insertPoint) + xpressOption + code.substring(insertPoint);
    changes++;
    console.log('OK: Desktop entrega');
  }
}

// Desktop form - Cobra select
const marker2b = '<option value="DALSE" ${val(\'cobra\') === \'DALSE\' ? \'selected\' : \'\'}>DALSE</option>';
const idx2b = code.indexOf(marker2b);
if (idx2b !== -1) {
  const section2b = code.substring(idx2b, idx2b + 300);
  const interlogisticClose = 'INTERLOGISTIC</option>';
  const closeIdx2b = section2b.indexOf(interlogisticClose);
  if (closeIdx2b !== -1) {
    const insertPoint = idx2b + closeIdx2b + interlogisticClose.length;
    const xpressOption = '<option value="XPRESS" ${val(\'cobra\') === \'XPRESS\' ? \'selected\' : \'\'}>XPRESS</option>\n                                        ';
    code = code.substring(0, insertPoint) + xpressOption + code.substring(insertPoint);
    changes++;
    console.log('OK: Desktop cobra');
  }
}

// toggleCellField
const marker4 = "const next = current === '' ? 'DALSE' :\n                     current === 'DALSE' ? 'INTERLOGISTIC' : '';";
const idx4 = code.indexOf(marker4);
if (idx4 !== -1) {
  const replacement4 = "const next = current === '' ? 'DALSE' :\n                     current === 'DALSE' ? 'INTERLOGISTIC' :\n                     current === 'INTERLOGISTIC' ? 'XPRESS' : '';";
  code = code.substring(0, idx4) + replacement4 + code.substring(idx4 + marker4.length);
  changes++;
  console.log('OK: toggleCellField');
} else {
  console.log('MISS: toggleCellField');
}

// Badge entrega
const marker5 = '<span class="badge ${record.entrega === \'DALSE\' ? \'badge-primary\' : (record.entrega === \'INTERLOGISTIC\' ? \'badge-accent\' : \'badge-ghost\')}">${sanitizeHTML(record.entrega || \'—\')}</span>';
const idx5 = code.indexOf(marker5);
if (idx5 !== -1) {
  const replacement5 = '<span class="badge ${record.entrega === \'DALSE\' ? \'badge-primary\' : (record.entrega === \'INTERLOGISTIC\' ? \'badge-accent\' : (record.entrega === \'XPRESS\' ? \'badge-warning\' : \'badge-ghost\'))}">${sanitizeHTML(record.entrega || \'—\')}</span>';
  code = code.substring(0, idx5) + replacement5 + code.substring(idx5 + marker5.length);
  changes++;
  console.log('OK: Badge entrega');
} else {
  console.log('MISS: Badge entrega');
}

// Badge cobra
const marker6 = '<span class="badge ${record.cobra === \'DALSE\' ? \'badge-primary\' : (record.cobra === \'INTERLOGISTIC\' ? \'badge-accent\' : \'badge-ghost\')}">${sanitizeHTML(record.cobra || \'—\')}</span>';
const idx6 = code.indexOf(marker6);
if (idx6 !== -1) {
  const replacement6 = '<span class="badge ${record.cobra === \'DALSE\' ? \'badge-primary\' : (record.cobra === \'INTERLOGISTIC\' ? \'badge-accent\' : (record.cobra === \'XPRESS\' ? \'badge-warning\' : \'badge-ghost\'))}">${sanitizeHTML(record.cobra || \'—\')}</span>';
  code = code.substring(0, idx6) + replacement6 + code.substring(idx6 + marker6.length);
  changes++;
  console.log('OK: Badge cobra');
} else {
  console.log('MISS: Badge cobra');
}

// Batch assign - XPRESS button
const marker7 = '<button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        🚛 INTERLOGISTIC\n                    </button>\n                </div>';
const idx7 = code.indexOf(marker7);
if (idx7 !== -1) {
  const replacement7 = '<button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        🚛 INTERLOGISTIC\n                    </button>\n                    <button id="ba-xpress" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        📦 XPRESS\n                    </button>\n                </div>';
  code = code.substring(0, idx7) + replacement7 + code.substring(idx7 + marker7.length);
  changes++;
  console.log('OK: Batch button');
} else {
  console.log('MISS: Batch button');
}

// Batch assign - btns array
const marker8 = "['ba-dalse', 'ba-interlogistic', 'ba-clear']";
const idx8 = code.indexOf(marker8);
if (idx8 !== -1) {
  code = code.substring(0, idx8) + "['ba-dalse', 'ba-interlogistic', 'ba-xpress', 'ba-clear']" + code.substring(idx8 + marker8.length);
  changes++;
  console.log('OK: Batch btns');
} else {
  console.log('MISS: Batch btns');
}

// Batch assign - onclick
const marker9 = "document.getElementById('ba-interlogistic').onclick = () => doAssign('INTERLOGISTIC');";
const idx9 = code.indexOf(marker9);
if (idx9 !== -1) {
  code = code.substring(0, idx9) + marker9 + "\n        document.getElementById('ba-xpress').onclick = () => doAssign('XPRESS');" + code.substring(idx9 + marker9.length);
  changes++;
  console.log('OK: Batch onclick');
} else {
  console.log('MISS: Batch onclick');
}

console.log('\nTotal changes: ' + changes);

if (changes > 0) {
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('File saved!');
} else {
  console.log('NO CHANGES MADE');
}
