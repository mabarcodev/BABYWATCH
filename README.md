# BabyWatch P2P Secure 👶🛡️

**BabyWatch** es una aplicación web de monitorización de bebés diseñada con un enfoque radical en la **privacidad** y la **seguridad**. A diferencia de otras soluciones comerciales, BabyWatch utiliza tecnología **P2P (Peer-to-Peer)** directa, lo que significa que el vídeo y el audio de tu bebé nunca pasan por servidores externos ni se almacenan en la nube.

Desarrollado por **[Manuel Barco](https://github.com/mabarcodev)**.

## ✨ Características Principales

- **🔒 Privacidad Total:** Conexión directa WebRTC cifrada de extremo a extremo.
- **🚀 Sin Instalación:** Funciona directamente en el navegador de cualquier móvil, tablet u ordenador.
- **🌙 Modo Visión Nocturna:** Filtros digitales para mejorar la visibilidad en condiciones de poca luz.
- **📊 Visualizador de Audio:** Monitorización visual del sonido en tiempo real.
- **🔋 Monitor de Batería:** Controla el nivel de batería del dispositivo de la cámara desde el monitor.
- **📱 PWA Ready:** Instálalo en tu pantalla de inicio para una experiencia de app nativa.
- **📡 Indicador de Señal:** Conoce la calidad de la conexión P2P en todo momento.
- **🚫 Bloqueo de Sala:** Sistema de seguridad que limita la sala a solo 2 dispositivos autorizados.

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React + Vite + Tailwind CSS
- **Animaciones:** Framer Motion
- **Comunicación:** Socket.io (Señalización) + WebRTC (Streaming P2P)
- **Iconos:** Lucide React
- **Backend:** Node.js + Express

## 🚀 Cómo empezar

### Requisitos
- Node.js instalado en tu equipo.

### Instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/mabarcodev/babywatch-p2p.git
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## 📖 Instrucciones de Uso

1. Conecta ambos dispositivos a la misma red Wi-Fi (recomendado para máxima velocidad).
2. Abre la URL de la aplicación en ambos dispositivos.
3. En el dispositivo que estará con el bebé, selecciona **"Cámara"**.
4. En tu dispositivo, selecciona **"Monitor"**.
5. Introduce el mismo **ID de Sala** y **PIN** en ambos.
6. ¡Disfruta de una monitorización segura y privada!

---

Desarrollado con ❤️ por [Manuel Barco](https://github.com/mabarcodev).
