# Mis Gastos – prototipo funcional

Prototipo de una aplicación web para el **control de gastos personales y del hogar**.
Corresponde a la actividad 4 (prototipo funcional) de la asignatura *Proyecto de Software*,
Ingeniería de Desarrollo de Software, Universidad Corporativa Iberoamericana.

**Autor:** Jhoan Sebastian Rocha Martinez

## Qué hace

| Módulo | Funcionalidad |
|---|---|
| 1. Cuentas | Crear cuenta, iniciar y cerrar sesión. Cada usuario ve solo sus datos. |
| 2. Movimientos | Registrar, editar y eliminar ingresos y gastos; filtrar por tipo y categoría. |
| 3. Categorías | Categorías predeterminadas; crear, editar, activar y desactivar las propias. |
| 4. Presupuesto y alertas | Límite mensual por categoría, barra de avance y alerta al 80 % y al 100 %. |
| 5. Panel de resumen | Ingresos, gastos y saldo del mes, gráfico por categoría y comparación con el mes anterior. |

## Requisitos

Un navegador actualizado (Chrome, Edge, Firefox o Safari). No hay que instalar nada ni tener internet.

## Cómo ejecutarlo

**Opción A – doble clic (la más simple)**

1. Descomprime `prototipo-control-gastos.zip`.
2. Abre la carpeta y haz doble clic en `index.html`.

**Opción B – servidor local** (si el navegador bloquea algo al abrir el archivo directamente)

```bash
cd prototipo-control-gastos
python -m http.server 8000
```

Luego abre <http://localhost:8000> en el navegador.

**Opción C – en línea:** el enlace de GitHub Pages está en el documento PDF de entrega.

## Primeros pasos

1. Pulsa **Crear cuenta** e ingresa nombre, correo y una contraseña de al menos 6 caracteres.
2. En el panel vacío pulsa **Cargar datos de ejemplo** para ver la aplicación completa.
3. Usa el botón **+** para registrar un gasto o ingreso.
4. En **Presupuesto** define un límite por categoría y mira cómo cambian las alertas.

## Estructura

```
prototipo-control-gastos/
├── index.html        Estructura de las pantallas
├── css/styles.css    Estilos (adaptable a celular, modo claro y oscuro)
├── js/app.js         Lógica: cuentas, movimientos, categorías, presupuesto y panel
└── README.md
```

## Limitaciones del prototipo

- Los datos se guardan en el **navegador** (`localStorage`); no hay servidor ni base de datos.
  Borrar los datos del sitio borra las cuentas y movimientos.
- Las contraseñas se guardan con hash SHA-256 y sal, pero al no haber servidor es una
  protección de demostración, no un sistema de autenticación de producción.
- No hay conexión con bancos, exportación de datos ni aplicación móvil nativa (fuera de alcance).
