# 🔧 Solución: Activar Authentication en Firebase

## ❌ Problema
La aplicación se queda en "Cargando..." porque **Firebase Authentication** no está activado.

## ✅ Solución (2 minutos)

### Paso 1: Ir a Firebase Console
Abre esta URL exacta:
```
https://console.firebase.google.com/project/dalse-e7b96/authentication/users
```

### Paso 2: Activar Authentication
1. Verás un botón que dice **"Comenzar"** o **"Get started"**
2. **Haz clic** en ese botón

### Paso 3: Activar Email/Password
1. En la pestaña **"Sign-in method"** (Método de inicio de sesión)
2. Busca **"Correo electrónico/contraseña"** o **"Email/Password"**
3. **Haz clic** en esa opción
4. **Activa** el primer switch (Email/Password)
5. **Haz clic** en **"Guardar"** o **"Save"**

### Paso 4: Verificar Firestore
También verifica que Firestore esté activo:
```
https://console.firebase.google.com/project/dalse-e7b96/firestore
```

Si ves "Crear base de datos", haz clic y selecciona:
- **Modo producción**
- Ubicación: **us-central** (o la más cercana)
- **Habilitar**

---

## 🔄 Después de Activar

1. **Recarga** la página: https://dalse-e7b96.web.app
2. Deberías ver la pantalla de **Login/Registro**
3. **Regístrate** y listo

---

## 🆘 Si Sigue Sin Funcionar

Abre la consola del navegador (F12) y mira si hay errores. Luego avísame qué dice.

---

## ⚡ Atajo Rápido

**Authentication:**
https://console.firebase.google.com/project/dalse-e7b96/authentication/users

**Firestore:**
https://console.firebase.google.com/project/dalse-e7b96/firestore

Activa ambos y recarga la app.
