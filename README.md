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

## 🛡️ ¿Es seguro usar un host público?

**Sí, absolutamente.** BabyWatch utiliza el servidor (ya sea en Render o en tu PC) únicamente para la **señalización** (el "apretón de manos" inicial entre dispositivos). 

Una vez que los dispositivos se encuentran:
1.  Se establece un túnel **P2P (Peer-to-Peer)** directo.
2.  El flujo de vídeo y audio viaja **directamente** de un móvil a otro.
3.  Los datos están **cifrados de extremo a extremo** mediante WebRTC.
4.  **Nada de vídeo pasa por el servidor**, por lo que tu privacidad es total independientemente de dónde esté alojada la web.

---

## 🚀 Despliegue (Uso recomendado)

Para que no tengas que ejecutar comandos cada vez, puedes tener tu propia instancia online gratuita:

### Opción: Render.com (Gratis)
1.  Haz un **Fork** de este repositorio.
2.  En [Render.com](https://render.com), crea un **Web Service** conectado a tu repo.
3.  Configuración:
    -   **Build Command:** `npm install && npm run build`
    -   **Start Command:** `node server.ts`
4.  Usa la URL que te proporcione Render en tus dispositivos.

---

## 🛠️ Instalación Local (Avanzado)

Si prefieres ejecutarlo 100% offline en tu red local:

1.  Clona el repositorio e instala dependencias: `npm install`
2.  Inicia el servidor: `npm run dev`
3.  Accede desde tus dispositivos usando la IP local de tu ordenador (la app te la mostrará en el menú de ayuda).

---

## 📖 Instrucciones de Uso

1. Conecta ambos dispositivos a la misma red Wi-Fi (recomendado para máxima velocidad).
2. Abre la URL de la aplicación en ambos dispositivos.
3. En el dispositivo que estará con el bebé, selecciona **"Cámara"**.
4. En tu dispositivo, selecciona **"Monitor"**.
5. Introduce el mismo **ID de Sala** y **PIN** en ambos.
6. ¡Disfruta de una monitorización segura y privada!

---

Desarrollado con ❤️ por [Manuel Barco](https://github.com/mabarcodev).
