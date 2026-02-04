# 📸 Super Screenshot

Aplicación de escritorio para captura masiva de screenshots de URLs con generación automática de PDFs.

## ✨ Características

- **Captura por lotes**: Procesa múltiples URLs simultáneamente
- **Extracción automática de URLs**: Pega cualquier texto y extrae las URLs automáticamente
- **Dos modos de salida**:
  - 📷 **Imágenes PNG** individuales con nombres inteligentes (YY-MM-DD-titulo.png)
  - 📄 **PDF único** con todas las capturas y portada personalizable
- **Detección de fechas WordPress**: Identifica automáticamente la fecha de publicación
- **Configuración avanzada**: Resoluciones personalizadas, lazy loading, timeouts, y más
- **Portadas personalizables**: Agrega logo, título y descripción a tus PDFs
- **Reintentos automáticos**: Sistema inteligente de reintentos para capturas fallidas (3 intentos)
- **Cross-platform**: Compatible con Windows, macOS y Linux
- **100% Privado**: Todo el procesamiento es local, sin telemetría

## 🚀 Instalación

### Para Usuarios

**Próximamente**: Descarga el instalador para tu sistema operativo desde la [página de releases](https://github.com/zapitz/super-screenshot/releases).

### Para Desarrolladores

**Requisitos previos:**
- Node.js v14 o superior
- Chrome, Edge, Brave o Chromium instalado
- npm o yarn

**Setup:**
```bash
# Clonar el repositorio
git clone https://github.com/zapitz/super-screenshot.git
cd super-screenshot

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm start
```

## 📖 Uso

### Inicio Rápido

1. **Selecciona el modo de captura**:
   - 📷 Solo Imágenes (guarda PNGs en carpeta)
   - 📄 Generar PDF (crea un PDF con todas las capturas)

2. **Pega tus URLs**:
   - Una por línea, o
   - Pega cualquier texto y las URLs se extraerán automáticamente

3. **Configura opciones** (opcional):
   - Resolución de pantalla (default: 1440x1600)
   - Lazy loading para contenido dinámico
   - Modo de captura (viewport o sitio completo)
   - WordPress date detection

4. **Haz clic en "Iniciar Capturas"** o "Generar PDF"

5. **Accede a los resultados**: Botón "Ir a carpeta de destino"

### Configuración Avanzada

Haz clic en ⚙️ para acceder a:

- **PDF**: Márgenes, tamaños de fuente, calidad de imagen
- **Portada**: Logo, título, descripción, fecha
- **Capturas**: Delays adicionales, espera de imágenes, bloqueo de anuncios

## 🎯 Casos de Uso

- **Documentación web**: Crea PDFs de múltiples páginas de documentación
- **Portfolio**: Captura versiones finales de sitios web
- **Reportes**: Genera reportes visuales de sitios competidores
- **Archivado**: Guarda versiones estáticas de contenido web
- **QA/Testing**: Comparación visual de diferentes versiones
- **Marketing**: Crea presentaciones con capturas de campañas

## ⚙️ Requisitos del Sistema

- **Sistema Operativo**: Windows 10+, macOS 10.13+, o Linux
- **Navegador**: Chrome, Edge, Brave, o Chromium instalado
- **RAM**: Mínimo 4GB recomendado
- **Espacio**: ~500MB para la aplicación + espacio para capturas

## 🛠️ Comandos para Desarrolladores

```bash
# Ejecutar aplicación
npm start

# Ejecutar en modo desarrollo
npm run dev

# Construir para tu plataforma
npm run build

# Construir para plataformas específicas
npm run build:mac
npm run build:win
npm run build:linux
```

## 📝 Formato de Archivos

### Modo Imágenes
Los archivos se guardan con el formato: `YY-MM-DD-titulo-del-articulo.png`

Ejemplo: `25-01-15-guia-completa-de-javascript.png`

### Modo PDF
- Nombre personalizable o automático con timestamp
- Incluye portada opcional con logo
- Cada captura en una página separada
- URLs clicables en el PDF

## 🐛 Solución de Problemas

### La aplicación no detecta mi navegador
- **Solución**: La app detecta automáticamente Chrome, Edge, Brave y Chromium. Si no encuentra ninguno, instala uno de estos navegadores.

### Error "Navigation timeout"
- **Causa**: La página tarda demasiado en cargar
- **Solución**: Aumenta el timeout en configuración o verifica tu conexión
- **Nota**: El sistema reintenta automáticamente 3 veces antes de fallar

### Las imágenes no cargan completamente
- **Solución**: Activa "Lazy loading scroll" en configuración

### El PDF está vacío o tiene errores
- **Causa**: Capturas fallidas
- **Solución**: Revisa la consola de procesos para ver qué URLs fallaron

## 🔒 Seguridad y Privacidad

- ✅ Todo el procesamiento es **local** en tu máquina
- ✅ **No se envían datos** a servidores externos
- ✅ **No hay telemetría** ni tracking
- ✅ Código fuente **100% abierto** y auditable
- ✅ **contextIsolation habilitado** para seguridad de Electron

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si quieres mejorar Super Screenshot:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🙏 Créditos

Desarrollado con:
- [Electron](https://www.electronjs.org/) - Framework de aplicaciones de escritorio
- [Puppeteer](https://pptr.dev/) - Control de navegador headless
- [PDFKit](https://pdfkit.org/) - Generación de PDFs

## 📧 Soporte

¿Tienes preguntas o problemas?

- 🐛 [Reporta un bug](https://github.com/zapitz/super-screenshot/issues)
- 💡 [Solicita una feature](https://github.com/zapitz/super-screenshot/issues)
- 📖 [Lee la documentación completa](https://github.com/zapitz/super-screenshot/wiki)

---

**Super Screenshot** - Hecho con ❤️ para simplificar las capturas de pantalla masivas