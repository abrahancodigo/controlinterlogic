const fs = require('fs');
const p = 'public/css/styles.css';
let c = fs.readFileSync(p, 'utf8');

// Normalize CRLF -> LF for searching
c = c.replace(/\r\n/g, '\n');

// Add badge-warning after badge-ghost (light mode)
const lightOld = `.badge-ghost {
    background: var(--gray-100);
    color: var(--gray-500);
}

.badge-editor`;

const lightNew = `.badge-ghost {
    background: var(--gray-100);
    color: var(--gray-500);
}

.badge-warning {
    background: #fef3c7;
    color: #92400e;
}

.badge-editor`;

if (!c.includes(lightOld)) {
  console.log('ERROR: light pattern not found');
  process.exit(1);
}
c = c.replace(lightOld, lightNew);
console.log('✅ Light badge-warning added');

// Add dark mode badge-warning after dark mode badge-ghost
const darkOld = `[data-theme="dark"] .badge-ghost {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
}

/* ===================================`;

const darkNew = `[data-theme="dark"] .badge-ghost {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
}

[data-theme="dark"] .badge-warning {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
}

/* ===================================`;

if (!c.includes(darkOld)) {
  console.log('ERROR: dark pattern not found');
  process.exit(1);
}
c = c.replace(darkOld, darkNew);
console.log('✅ Dark badge-warning added');

// Restore CRLF
c = c.replace(/\n/g, '\r\n');
fs.writeFileSync(p, c, 'utf8');
console.log('✅ File saved!');
