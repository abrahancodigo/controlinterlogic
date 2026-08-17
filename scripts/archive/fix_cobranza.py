import re

with open('public/js/cobranza.js', 'r', encoding='utf-8') as f:
    js = f.read()

lines_before = len(js.split('\n'))
print(f'Lines before: {lines_before}')

# FIX 1: Replace interlogic onSnapshot with one-time .get()
# Find the block pattern
pattern1 = r'if \(this\.unsubscribeRecords\) this\.unsubscribeRecords\(\);\s*this\.unsubscribeRecords = db\.collection\(\'interlogic\'\)\s*\.orderBy\(\'createdAt\', \'desc\'\)\s*\.limit\(5000\)\s*\.onSnapshot\(snap => \{[^}]+\}, err => \{[^}]+\}\);'
replacement1 = """if (window.Interlogic && window.Interlogic.records && window.Interlogic.records.length > 0) {
                this.records = window.Interlogic.records;
                checkDone('records');
            } else {
                db.collection('interlogic').orderBy('createdAt', 'desc').limit(5000).get().then(snap => {
                    this.records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    checkDone('records');
                }).catch(err => { console.error('Error loading interlogic:', err); checkDone('records'); });
            }"""

if re.search(pattern1, js):
    js = re.sub(pattern1, replacement1, js)
    print('FIX 1: Interlogic -> one-time get: DONE')
else:
    print('FIX 1: Pattern not found')

# FIX 2: Convert gestiones onSnapshot to .get()
pattern2 = r'if \(this\.unsubscribeGestiones\) this\.unsubscribeGestiones\(\);\s*this\.unsubscribeGestiones = db\.collection\(\'gestiones\'\)\s*\.orderBy\(\'createdAt\', \'desc\'\)\s*\.limit\(500\)\s*\.onSnapshot\([^)]+\);'
replacement2 = """db.collection('gestiones').orderBy('createdAt', 'desc').limit(500).get().then(snap => {
                this.gestiones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('gestiones');
            }).catch(err => { console.error('Error loading gestiones:', err); checkDone('gestiones'); });"""

if re.search(pattern2, js):
    js = re.sub(pattern2, replacement2, js)
    print('FIX 2: Gestiones -> one-time get: DONE')
else:
    print('FIX 2: Pattern not found')

# FIX 3: Convert ajustes onSnapshot to .get()
pattern3 = r'if \(this\.unsubscribeAjustes\) this\.unsubscribeAjustes\(\);\s*this\.unsubscribeAjustes = db\.collection\(\'ajustes\'\)\s*\.orderBy\(\'createdAt\', \'desc\'\)\s*\.limit\(500\)\s*\.onSnapshot\([^)]+\);'
replacement3 = """db.collection('ajustes').orderBy('createdAt', 'desc').limit(500).get().then(snap => {
                this.ajustes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('ajustes');
            }).catch(err => { console.error('Error loading ajustes:', err); checkDone('ajustes'); });"""

if re.search(pattern3, js):
    js = re.sub(pattern3, replacement3, js)
    print('FIX 3: Ajustes -> one-time get: DONE')
else:
    print('FIX 3: Pattern not found')

# FIX 4: Convert notasCredito onSnapshot to .get()
pattern4 = r'if \(this\.unsubscribeNC\) this\.unsubscribeNC\(\);\s*this\.unsubscribeNC = db\.collection\(\'notasCredito\'\)\s*\.orderBy\(\'createdAt\', \'desc\'\)\s*\.limit\(1000\)\s*\.onSnapshot\([^)]+\);'
replacement4 = """db.collection('notasCredito').orderBy('createdAt', 'desc').limit(1000).get().then(snap => {
                this.notasCredito = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('nc');
            }).catch(err => { console.error('Error loading notasCredito:', err); checkDone('nc'); });"""

if re.search(pattern4, js):
    js = re.sub(pattern4, replacement4, js)
    print('FIX 4: NotasCredito -> one-time get: DONE')
else:
    print('FIX 4: Pattern not found')

lines_after = len(js.split('\n'))
print(f'\nLines after: {lines_after}')
print(f'Lines changed: {lines_before - lines_after}')

with open('public/js/cobranza.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('\ncobranza.js saved successfully')
