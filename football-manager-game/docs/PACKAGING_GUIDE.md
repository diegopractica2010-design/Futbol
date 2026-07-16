# Guía de Empaquetado — Football Manager Chile

## Opciones disponibles

### 1. Jugar en navegador (más simple)
```bash
npm run dev
# Abrir http://localhost:3000
```

### 2. Desktop (Windows / Mac / Linux)
```bash
npm run desktop:install   # instala electron (una vez)
npm run desktop           # ejecuta la app de escritorio
npm run desktop:dist      # genera instalador .exe/.dmg/.AppImage
```
El instalador queda en `dist-desktop/`.

### 3. APK para Android / Lenovo M11

#### Requisitos previos
- [Android Studio](https://developer.android.com/studio) instalado
- Java 17+
- `npx cap` (viene con `@capacitor/core`)

#### Pasos
```bash
# Instalar Capacitor (una vez)
npm install @capacitor/core @capacitor/cli @capacitor/android

# Inicializar proyecto Android (una vez)
npm run android:init

# Cada vez que hagas cambios en el juego:
npm run android:sync

# Abrir en Android Studio para compilar APK
npm run android:open
```

En Android Studio:
1. `Build > Generate Signed APK` para APK firmado
2. O `Run` con la tablet Lenovo M11 conectada por USB (debug mode)

#### Configuración recomendada para Lenovo M11
- Orientación: Landscape (ya configurada en manifest.json)
- Target API: 33+ (Android 13)
- Minimum API: 26 (Android 8)

### 4. PWA (instalable desde Chrome/Edge)

El juego ya funciona como PWA completa:
1. Abre el juego en Chrome en la tablet
2. Menú → "Añadir a pantalla de inicio" o "Instalar aplicación"
3. Se instala como app nativa con ícono, sin barra del navegador
4. **Funciona offline** gracias al service worker

### 5. APK alternativo vía PWA2APK (sin Android Studio)

Servicios web gratuitos que convierten PWA → APK:
- [PWABuilder.com](https://www.pwabuilder.com) → pega la URL → descarga APK
- [AppsGeyser](https://appsgeyser.com)

Estos generan un APK que simplemente envuelve el PWA.

---

## Compatibilidad Lenovo M11

| Característica | Estado |
|---------------|--------|
| Touch tap mínimo 48px | ✅ |
| Layout landscape 1200×800 | ✅ |
| Layout portrait 800×1200 | ✅ |
| Scroll táctil suave | ✅ |
| Sin zoom accidental | ✅ |
| Safe area (notch) | ✅ |
| Orientación bloqueada landscape | ✅ |
| Service Worker offline | ✅ |
| PWA instalable | ✅ |
