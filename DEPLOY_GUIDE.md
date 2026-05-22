# 🚀 Guía de Despliegue - Dalse

Esta guía te llevará paso a paso para desplegar el sistema Dalse en Firebase.

## 📋 Requisitos Previos

- Node.js instalado (versión 14 o superior)
- Una cuenta de Google
- Acceso a [Firebase Console](https://console.firebase.google.com)

## 🔧 Paso 1: Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Haz clic en "Agregar proyecto"
3. Nombre del proyecto: `dalse` (o el nombre que prefieras)
4. Desactiva Google Analytics (opcional)
5. Haz clic en "Crear proyecto"

## 🔐 Paso 2: Configurar Authentication

1. En el menú lateral, ve a **Authentication**
2. Haz clic en "Comenzar"
3. En la pestaña "Sign-in method":
   - Haz clic en "Correo electrónico/contraseña"
   - Activa la primera opción (Correo electrónico/contraseña)
   - Guarda los cambios

## 💾 Paso 3: Configurar Firestore Database

1. En el menú lateral, ve a **Firestore Database**
2. Haz clic en "Crear base de datos"
3. Selecciona "Comenzar en modo de producción"
4. Elige una ubicación (recomendado: `us-central` o la más cercana)
5. Haz clic en "Habilitar"

> **Nota**: Las reglas de seguridad se desplegarán automáticamente con Firebase CLI

## 🌐 Paso 4: Obtener Configuración de Firebase

1. En el menú lateral, ve a **Configuración del proyecto** (ícono de engranaje)
2. En la sección "Tus apps", haz clic en el ícono web `</>`
3. Registra la app con el nombre "Dalse Web"
4. **NO** marques "Firebase Hosting"
5. Copia la configuración que aparece (objeto `firebaseConfig`)

## ✏️ Paso 5: Actualizar Configuración en el Código

1. Abre el archivo `public/js/app.js`
2. Busca la sección `firebaseConfig`
3. Reemplaza los valores con los de tu proyecto:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};
```

4. Guarda el archivo

## 📦 Paso 6: Instalar Firebase CLI

Abre una terminal y ejecuta:

```bash
npm install -g firebase-tools
```

## 🔑 Paso 7: Iniciar Sesión en Firebase

En la terminal, ejecuta:

```bash
firebase login
```

Esto abrirá tu navegador para que inicies sesión con tu cuenta de Google.

## 🎯 Paso 8: Configurar Proyecto Local

1. En la terminal, navega a la carpeta del proyecto:

```bash
cd C:\Users\user\OneDrive\Escritorio\antigravity\dalse
```

2. Actualiza el archivo `.firebaserc` con tu ID de proyecto:

Abre `.firebaserc` y reemplaza `dalse-project` con el ID real de tu proyecto Firebase.

## 🚀 Paso 9: Desplegar a Firebase

En la terminal, ejecuta:

```bash
firebase deploy
```

Este comando desplegará:
- ✅ Reglas de Firestore
- ✅ Índices de Firestore
- ✅ Aplicación web en Firebase Hosting

## 🎉 Paso 10: Acceder a tu Aplicación

Una vez completado el despliegue, verás una URL como:

```
https://dalse-project.web.app
```

¡Abre esa URL en tu navegador y comienza a usar Dalse!

## 👤 Primer Usuario (Administrador)

El **primer usuario** que se registre en el sistema será automáticamente asignado como **Administrador**.

Para crear tu cuenta de administrador:

1. Abre la aplicación desplegada
2. Haz clic en "Registrarse"
3. Completa el formulario
4. ¡Listo! Ahora eres el administrador

## 🔄 Actualizaciones Futuras

Para desplegar cambios futuros:

```bash
firebase deploy
```

Para desplegar solo el hosting (más rápido):

```bash
firebase deploy --only hosting
```

Para desplegar solo las reglas de Firestore:

```bash
firebase deploy --only firestore:rules
```

## 🧪 Pruebas Locales

Para probar localmente antes de desplegar:

```bash
firebase serve
```

Esto iniciará un servidor local en `http://localhost:5000`

> **Nota**: Necesitarás configurar Firebase en el código incluso para pruebas locales.

## 🆘 Solución de Problemas

### Error: "Firebase config not found"
- Verifica que hayas actualizado `firebaseConfig` en `app.js`

### Error: "Permission denied"
- Asegúrate de haber desplegado las reglas de Firestore
- Verifica que el usuario esté autenticado

### Error: "Failed to get document"
- Verifica la conexión a internet
- Revisa las reglas de Firestore en Firebase Console

### La aplicación no carga
- Verifica la consola del navegador (F12)
- Asegúrate de que Firebase esté correctamente configurado
- Revisa que todos los archivos se hayan desplegado

## 📞 Soporte

Para problemas o preguntas, revisa:
- [Documentación de Firebase](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com)

## 🔒 Seguridad Adicional

### Configurar Dominio Personalizado (Opcional)

1. En Firebase Console, ve a **Hosting**
2. Haz clic en "Agregar dominio personalizado"
3. Sigue las instrucciones para configurar tu dominio

### Configurar Usuarios Autorizados

Como administrador, puedes:
- Asignar roles a usuarios
- Desactivar usuarios
- Ver todas las entregas del sistema

## ✅ Checklist de Despliegue

- [ ] Proyecto creado en Firebase Console
- [ ] Authentication configurado (Email/Password)
- [ ] Firestore Database creado
- [ ] Configuración de Firebase copiada a `app.js`
- [ ] `.firebaserc` actualizado con el ID del proyecto
- [ ] Firebase CLI instalado
- [ ] Sesión iniciada en Firebase CLI
- [ ] Aplicación desplegada con `firebase deploy`
- [ ] URL de la aplicación accesible
- [ ] Primer usuario (admin) creado

¡Felicidades! Tu sistema Dalse está ahora en producción. 🎉
