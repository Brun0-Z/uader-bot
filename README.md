# BOT DISCORD DE PASANTÍAS UADER
Este proyecto es un bot de Discord diseñado para gestionar y notificar sobre pasantías en la Universidad Autónoma de Entre Ríos (UADER). El bot se conecta a una base de datos SQLite utilizando Prisma ORM para almacenar información sobre las pasantías, y utiliza el módulo de programación de tareas de NestJS para ejecutar trabajos periódicos que verifican nuevas pasantías y notifican a los usuarios.

## Características
- **Gestión de Pasantías**: El bot puede almacenar y gestionar información sobre pasantías, incluyendo detalles como el título, descripción, fecha de publicación, etc.
- **Notificaciones**: El bot envía notificaciones a los usuarios de Discord cuando se publican nuevas pasantías.
- **Programación de Tareas**: Utiliza el módulo de programación de tareas de NestJS para ejecutar trabajos periódicos que verifican nuevas pasantías en la base de datos.
- **Integración con Discord**: El bot se integra con la API de Discord para enviar mensajes y notificaciones a los canales correspondientes.
- **Configuración Flexible**: La configuración del bot se realiza a través de variables de entorno, lo que facilita su despliegue en diferentes entornos.
- **Uso de Prisma ORM**: Utiliza Prisma ORM para interactuar con la base de datos SQLite, lo que facilita la gestión de datos y la realización de consultas complejas.
- **Estructura Modular**: El proyecto está organizado en módulos, lo que facilita la escalabilidad y el mantenimiento del código.
- **Manejo de Errores**: Implementa manejo de errores para garantizar que el bot funcione de manera robusta y pueda recuperarse de fallos inesperados.
- **Documentación**: El proyecto incluye documentación detallada para facilitar la comprensión y el uso del bot por parte de otros desarrolladores.
- **Código Limpio y Legible**: El código está escrito siguiendo buenas prácticas de programación, lo que facilita su lectura y mantenimiento a largo plazo.

## Planes Futuros
- **Interfaz de Usuario**: Implementar una interfaz de usuario para que los administradores puedan gestionar las pasantías directamente desde Discord.
- **Integración con Otras Plataformas**: Ampliar la funcionalidad del bot para integrarse con otras plataformas de gestión de pasantías o redes sociales, como GoogleJobs.
 