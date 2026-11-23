import type { HelpGuideSource } from "../guide";

const es: HelpGuideSource = {
  "start": {
    "label": "Primeros pasos",
    "summary": "Cómo piensa el sistema, el orden de configuración recomendado y dónde está cada cosa en el menú.",
    "sections": [
      {
        "title": "El sistema en pocas líneas",
        "blocks": [
          {
            "type": "p",
            "unless": "orders",
            "text": "Tu tienda es un escaparate: los visitantes exploran tus productos y categorías en el sitio web y preguntan por ellos por **WhatsApp**; no se pide ni se paga nada en línea. El panel es donde mantienes actualizados el catálogo y el sitio web."
          },
          {
            "type": "list",
            "unless": "orders",
            "title": "Conviene saber desde el primer día",
            "items": [
              "Un producto aparece en el sitio web solo mientras está **Activo**. Desactívalo para ocultarlo sin eliminarlo.",
              "Cada producto tiene un botón de **WhatsApp**, así que mantén actualizado el número de WhatsApp en **Ajustes → General**: es como te contactan los visitantes.",
              "Para mostrar los productos sin precios, desactiva **Mostrar precios** en **Ajustes → General**.",
              "Los pedidos en línea, el stock y la contabilidad no forman parte de tu plan. Contáctanos si quieres añadirlos."
            ]
          },
          {
            "type": "p",
            "requires": [
              "orders"
            ],
            "unless": "finance",
            "text": "Tu tienda recibe pedidos en línea: los clientes piden y pagan en el sitio web, y tú sigues cada pedido desde el panel hasta que se entrega. El stock, las compras, los mensajeros y la contabilidad no forman parte de tu plan, por lo que el sistema no cuenta el stock ni lleva la contabilidad: eso lo llevas fuera de él."
          },
          {
            "type": "list",
            "requires": [
              "orders"
            ],
            "unless": "finance",
            "title": "Conviene saber desde el primer día",
            "items": [
              "Los productos **nunca se agotan** en el sitio web: no se cuenta nada, así que un producto se vende mientras esté **Activo**. Desactívalo cuando no puedas suministrarlo.",
              "Los ingresos de la página de inicio cuentan los pedidos **el día en que se entregan**. Los pedidos que aún no se han entregado todavía no son ingresos.",
              "El cobro de pagos, los reembolsos y el efectivo de los mensajeros se gestionan fuera del sistema; el pedido solo registra cómo eligió pagar el cliente."
            ]
          },
          {
            "type": "p",
            "requires": [
              "finance"
            ],
            "text": "El panel no es solo una lista de pedidos: lleva una contabilidad completa. Cada movimiento de dinero o mercancía (un cobro, reembolso, compra, gasto, liquidación de mensajero o transferencia) se contabiliza automáticamente y aparece al instante en los saldos de **Cuentas de dinero** y en **Informes**."
          },
          {
            "type": "list",
            "requires": [
              "orders",
              "finance"
            ],
            "title": "Reglas que conviene conocer desde el primer día",
            "items": [
              "Los registros de dinero **nunca se editan** una vez guardados. Un error se corrige con **Anular** o **Revertir**, que contabiliza un nuevo asiento que cancela el anterior; el original permanece registrado con tu motivo.",
              "Los ingresos se cuentan **el día en que se entrega un pedido**, no el día en que se hizo. Un pedido que aún no se ha entregado todavía no es un ingreso.",
              "Los pedidos entregados antes de que **comenzara la contabilidad** no están en las cuentas: su pago aparece como **Sin seguimiento** y no se pueden reembolsar en el sistema.",
              "Los días cerrados en la página **Contabilidad y cierre** no admiten nuevos registros."
            ]
          }
        ]
      },
      {
        "title": "Orden de configuración recomendado",
        "blocks": [
          {
            "type": "steps",
            "unless": "orders",
            "items": [
              "**Ajustes → General**: datos de la tienda, logotipo y colores, y tus números de teléfono y **WhatsApp**. Decide aquí si quieres **Mostrar precios**.",
              "**Ajustes → Correo electrónico**: para que los mensajes del formulario de contacto del sitio web te lleguen.",
              "**Productos y categorías**: crea primero las categorías y luego añade los productos a mano o impórtalos todos a la vez desde un archivo CSV (consulta la pestaña Importar).",
              "**Contenido del sitio web**: banners, secciones de la página de inicio y páginas como Sobre nosotros."
            ]
          },
          {
            "type": "steps",
            "requires": [
              "orders"
            ],
            "unless": "finance",
            "items": [
              "**Ajustes → General**: datos de la tienda, moneda y el **Plazo de devolución (días)**.",
              "**Ajustes → Correo electrónico**: para que los clientes reciban los correos de pedidos y los enlaces de restablecimiento de contraseña.",
              "**Envíos → Lista de precios**: un precio para cada provincia o zona (0 = envío gratuito).",
              "**Productos**: añade los productos a mano o impórtalos todos a la vez desde un archivo CSV (consulta la pestaña Importar).",
              "**Ventas → Cupones**: códigos de descuento opcionales para tus clientes."
            ]
          },
          {
            "type": "steps",
            "requires": [
              "orders",
              "inventory",
              "finance"
            ],
            "items": [
              "**Ajustes → General**: datos de la tienda, moneda y el **Plazo de devolución (días)**.",
              "**Ajustes → Correo electrónico**: para que los clientes reciban los correos de pedidos y los enlaces de restablecimiento de contraseña.",
              "**Envíos → Lista de precios**: un precio para cada provincia o zona (0 = envío gratuito).",
              "**Envíos → Mensajeros**: añade tus propios mensajeros o empresas de reparto.",
              "**Finanzas → Cuentas de dinero**: crea tu caja de efectivo, tu cuenta bancaria y tus monederos, y elige la predeterminada.",
              "**Productos**: añade los productos a mano o impórtalos todos a la vez desde un archivo CSV (consulta la pestaña Importar).",
              "**Inventario**: define el coste del stock que ya tenías antes de empezar (**Definir coste**).",
              "**Stock y compras → Proveedores**: añade proveedores y registra todo el stock nuevo como una **Compra**."
            ]
          }
        ]
      },
      {
        "title": "El menú lateral: ¿dónde está cada cosa?",
        "blocks": [
          {
            "type": "list",
            "unless": "orders",
            "items": [
              "**Productos y categorías**: productos (incluida la importación y exportación CSV), categorías y subcategorías.",
              "**Clientes y mensajes**: reseñas, mensajes de contacto y suscriptores.",
              "**Contenido del sitio web**: páginas, banners y secciones.",
              "**Ajustes**: general, correo electrónico y el **Registro de actividad** (cada cambio hecho en el panel y quién lo hizo, conservado durante un año)."
            ]
          },
          {
            "type": "list",
            "requires": [
              "orders"
            ],
            "unless": "finance",
            "items": [
              "**Ventas**: pedidos, devoluciones y cupones.",
              "**Productos y categorías**: productos (incluida la importación y exportación CSV), categorías y subcategorías.",
              "**Envíos**: la lista de precios de envío.",
              "**Clientes y mensajes**: clientes, reseñas, mensajes de contacto y suscriptores.",
              "**Contenido del sitio web**: páginas, banners y secciones.",
              "**Ajustes**: general, correo electrónico y el **Registro de actividad** (cada cambio hecho en el panel y quién lo hizo, conservado durante un año)."
            ]
          },
          {
            "type": "list",
            "requires": [
              "orders",
              "inventory",
              "finance"
            ],
            "items": [
              "**Ventas**: pedidos, devoluciones, reembolsos y cupones.",
              "**Productos y categorías**: productos (incluida la importación y exportación CSV), categorías y subcategorías.",
              "**Stock y compras**: inventario y sus movimientos, compras a proveedores y proveedores.",
              "**Envíos**: mensajeros (incluida la liquidación del efectivo con ellos) y la lista de precios de envío.",
              "**Clientes y mensajes**: clientes, reseñas, mensajes de contacto y suscriptores.",
              "**Finanzas**: informes, cuentas de dinero, gastos, y contabilidad y cierre.",
              "**Contenido del sitio web**: páginas, banners y secciones.",
              "**Ajustes**: general, correo electrónico y el **Registro de actividad** (cada cambio hecho en el panel y quién lo hizo, conservado durante un año)."
            ]
          },
          {
            "type": "tip",
            "text": "En la parte superior de cada página, junto a la ruta de la página, hay un icono de **signo de interrogación (?)**. Si algo de la página en la que estás no está claro, haz clic en él para ir directamente a la parte de esta guía que lo explica."
          }
        ]
      }
    ]
  },
  "orders": {
    "requires": [
      "orders"
    ],
    "label": "Pedidos y cobros",
    "summary": "El recorrido de un pedido desde que se realiza hasta que su efectivo está en caja.",
    "sections": [
      {
        "title": "El recorrido de un pedido",
        "path": "/admin/orders",
        "blocks": [
          {
            "type": "flow",
            "items": [
              "Pendiente",
              "Confirmado",
              "Enviado",
              "Entregado"
            ]
          },
          {
            "type": "steps",
            "items": [
              "Abre el pedido desde **Ventas → Pedidos**.",
              "Revisa los artículos y la dirección y haz clic en **Confirmar pedido**.",
              "Cuando salga con el mensajero, haz clic en **Marcar como enviado**: la nota puede incluir el nombre del mensajero o el número de seguimiento.",
              {
                "text": "Cuando el cliente lo reciba, haz clic en **Marcar como entregado**. A partir de ese momento el pedido cuenta como **ingreso** y se abre la sección **Pago** para registrar el cobro.",
                "requires": [
                  "finance"
                ]
              },
              {
                "text": "Cuando el cliente lo reciba, haz clic en **Marcar como entregado**. A partir de ese momento el pedido cuenta como **ingreso** en la página de inicio.",
                "unless": "finance"
              }
            ]
          },
          {
            "type": "warning",
            "requires": [
              "inventory"
            ],
            "text": "Cancelar un pedido (antes de la entrega) devuelve sus artículos al stock automáticamente. Después de la entrega ya no se puede cancelar: lo que vuelve es una **Devolución**."
          },
          {
            "type": "warning",
            "unless": "inventory",
            "text": "Un pedido solo se puede cancelar antes de que se entregue. Después de la entrega ya no se puede cancelar: lo que vuelve es una **Devolución**."
          }
        ]
      },
      {
        "title": "Registrar un cobro (pago contra reembolso)",
        "requires": [
          "finance"
        ],
        "path": "/admin/orders",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "Abre un pedido **Entregado** y desplázate hasta **Pago**.",
              "Introduce el **Importe cobrado**, todo o una parte.",
              "Elige **Cobrado por**: **Personal de la tienda** si el efectivo llegó realmente a la tienda y elige la cuenta de dinero en la que entró; o **Mensajero (pendiente de entregar)** si el mensajero aún tiene el efectivo y elige al mensajero.",
              "Haz clic en **Registrar cobro**."
            ]
          },
          {
            "type": "tip",
            "text": "Cuando cobra el mensajero, el efectivo aún no llega a tu caja: se registra como efectivo **en poder del mensajero** hasta que lo **Liquides** con él en la página de Mensajeros (consulta la pestaña Cuentas)."
          }
        ]
      },
      {
        "title": "Estados de pago",
        "requires": [
          "finance"
        ],
        "blocks": [
          {
            "type": "list",
            "items": [
              "**Sin pagar**: entregado, aún sin cobrar nada.",
              "**Pagado parcialmente**: se cobró una parte; el resto aparece en **Pendiente de pago**.",
              "**Pagado**: cobrado por completo.",
              "**Reembolsado parcialmente / Reembolsado**: una parte o todo el dinero se devolvió al cliente.",
              "**Dado de baja**: el resto se contabilizó como incobrable.",
              "**Sin seguimiento**: entregado antes de que comenzara la contabilidad, por lo que no está en las cuentas."
            ]
          }
        ]
      },
      {
        "title": "Corregir un cobro erróneo o dar de baja un saldo",
        "requires": [
          "finance"
        ],
        "blocks": [
          {
            "type": "p",
            "text": "Si un cobro tiene un importe o una cuenta incorrectos, haz clic en **Anular** junto a él e indica un motivo. El importe vuelve a figurar como deuda del cliente y el cobro permanece registrado marcado como **Anulado**. Después registra el correcto."
          },
          {
            "type": "p",
            "text": "Si el cliente nunca pagará el resto (se negó o desapareció), usa **Dar de baja el saldo**. El importe se contabiliza como incobrable y aparece entre los gastos en la Cuenta de resultados."
          },
          {
            "type": "warning",
            "text": "Da de baja solo cuando estés seguro de que el dinero no llegará: no sustituye al registro de un cobro."
          }
        ]
      }
    ]
  },
  "returns": {
    "requires": [
      "orders"
    ],
    "label": "Devoluciones y reembolsos",
    "summary": "Cómo gestionar una devolución, devolver la mercancía al stock y devolver el dinero correctamente.",
    "sections": [
      {
        "title": "Devoluciones sin contabilidad",
        "path": "/admin/returns",
        "unless": "finance",
        "blocks": [
          {
            "type": "p",
            "text": "Una **devolución** es mercancía que vuelve del cliente (Ventas → Devoluciones). Tu plan no incluye contabilidad ni stock, por lo que reembolsar al cliente y devolver la mercancía a la estantería se hace fuera del sistema: la devolución registra qué volvió y por qué."
          },
          {
            "type": "list",
            "title": "De dónde vienen las devoluciones",
            "items": [
              "**El cliente**: desde su cuenta en el sitio web, dentro del **Plazo de devolución** definido en **Ajustes → General** (0 desactiva las solicitudes de clientes). Recibes un aviso por correo si está activado.",
              "**La tienda**: para una devolución gestionada por teléfono o en tienda, abre el pedido (debe estar **Entregado**) y haz clic en **Crear devolución** en su sección Devoluciones. Estas empiezan **Aprobadas**."
            ]
          },
          {
            "type": "steps",
            "title": "Cómo gestionar una devolución",
            "items": [
              "Abre **Ventas → Devoluciones** y haz clic en una devolución con estado **Solicitada**.",
              "Revisa los artículos, las cantidades, el **Motivo** y la nota del cliente.",
              "Haz clic en **Aprobar** (opcionalmente con una nota para el cliente) o en **Rechazar** si no se acepta.",
              "Reembolsa al cliente y repón la mercancía como sueles hacerlo, fuera del sistema."
            ]
          }
        ]
      },
      {
        "title": "Devolución frente a reembolso",
        "requires": [
          "finance"
        ],
        "blocks": [
          {
            "type": "list",
            "items": [
              "Una **devolución** es mercancía que vuelve del cliente (Ventas → Devoluciones).",
              "Un **reembolso** es dinero que vuelve al cliente (Ventas → Reembolsos).",
              "A una devolución suele seguirle un reembolso. Pero también puedes **reembolsar sin devolución**, como compensación por una entrega tardía o un gesto comercial, sin que vuelva mercancía."
            ]
          },
          {
            "type": "warning",
            "text": "La mercancía solo vuelve **al stock**, y el dinero solo llega **a la contabilidad**, cuando el reembolso se **Paga**. Aprobar una devolución por sí solo no mueve nada."
          }
        ]
      },
      {
        "title": "De dónde vienen las devoluciones",
        "requires": [
          "finance"
        ],
        "blocks": [
          {
            "type": "list",
            "items": [
              "**El cliente**: desde su cuenta en el sitio web, dentro del **Plazo de devolución** definido en **Ajustes → General** (0 desactiva las solicitudes de clientes). Recibes un aviso por correo si está activado.",
              "**La tienda**: para una devolución gestionada por teléfono o en tienda, abre el pedido (debe estar **Entregado**) y haz clic en **Crear devolución** en su sección Devoluciones. Estas empiezan **Aprobadas**."
            ]
          },
          {
            "type": "flow",
            "title": "Estados de la devolución",
            "items": [
              "Solicitada",
              "Aprobada",
              "Reembolsada"
            ]
          },
          {
            "type": "p",
            "text": "Puede ser **Rechazada** en cualquier momento antes de que se reembolse."
          }
        ]
      },
      {
        "title": "Cómo gestionar una devolución, de principio a fin",
        "requires": [
          "finance"
        ],
        "path": "/admin/returns",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "Abre **Ventas → Devoluciones** y haz clic en una devolución con estado **Solicitada**.",
              "Revisa los artículos, las cantidades, el **Motivo** y la nota del cliente.",
              "Haz clic en **Aprobar** (opcionalmente con una nota para el cliente) o en **Rechazar** si no se acepta.",
              "Haz clic en **Solicitar reembolso**.",
              "Elige el **Motivo** y, en **Devolver al stock**, marca solo los artículos vendibles. Desmarca lo que esté dañado para que no se cuente en el stock (con el motivo “Dañado” empiezan desmarcados).",
              "Revisa el **Reembolso del producto**: la sugerencia es el precio de los artículos menos su parte del descuento del pedido y no puede superar el máximo indicado debajo.",
              "Revisa el **Reembolso del coste de envío**: la sugerencia sigue la política de la tienda (indicada debajo del campo).",
              "Elige cómo se **Devuelve** (consulta la sección siguiente).",
              "Haz clic en **Solicitar reembolso**. Dentro del límite automático se aprueba al instante; si no, espera a un aprobador.",
              "Una vez aprobado, haz clic en **Pagar**, desde la tarjeta del reembolso en la misma página de la devolución o desde la página **Reembolsos**. Solo entonces sale el dinero, la mercancía vuelve al stock y la devolución pasa a **Reembolsada**."
            ]
          },
          {
            "type": "flow",
            "title": "Estados del reembolso",
            "items": [
              "Pendiente de aprobación",
              "Aprobado",
              "Pagado"
            ]
          }
        ]
      },
      {
        "title": "Formas de devolver el dinero",
        "requires": [
          "finance"
        ],
        "blocks": [
          {
            "type": "list",
            "items": [
              "**Efectivo de la tienda**: se paga desde la cuenta de dinero que elijas en **Pagado desde**. Como máximo lo que se cobró realmente al cliente, menos lo ya reembolsado.",
              "**Efectivo a través del mensajero**: el mensajero paga al cliente con el efectivo que tiene, por lo que se descuenta de lo que entregue en la liquidación.",
              "**Abono contra lo adeudado**: si el cliente no ha pagado todo el pedido, reduce lo que debe en lugar de entregar efectivo. Como máximo lo que aún debe."
            ]
          },
          {
            "type": "tip",
            "text": "Cada método de la lista muestra lo máximo que puede devolver; un método sin saldo restante aparece desactivado."
          },
          {
            "type": "example",
            "title": "Ejemplo",
            "lines": [
              "Un pedido de 900 + 50 de envío = 950, todo pagado al mensajero.",
              "Un artículo de 300 vuelve por ser el artículo equivocado; el pedido tenía un 10 % de descuento.",
              "Reembolso de producto sugerido = 300 − 30 = 270.",
              "Envío: la política es “cuando todo se devuelve y el error fue de la tienda”; no volvió todo, así que 0.",
              "El total de 270 supera el límite automático (200 por defecto), así que espera a un aprobador. Una vez aprobado, Pagar."
            ]
          }
        ]
      },
      {
        "title": "Reglas de aprobación y política del coste de envío",
        "requires": [
          "finance"
        ],
        "path": "/admin/settings",
        "blocks": [
          {
            "type": "p",
            "text": "En **Ajustes → General → Reglas de reembolso** (solo el superadministrador de la tienda puede cambiarlas y cada cambio queda registrado):"
          },
          {
            "type": "list",
            "items": [
              "**Aprobar automáticamente hasta**: los reembolsos inferiores a este importe se aprueban en cuanto se solicitan (200 por defecto).",
              "**Basta con un aprobador hasta**: por encima, debe aprobar **alguien distinto de quien lo solicitó** (2000 por defecto).",
              "**El coste de envío se reembolsa**: nunca, siempre que todo se devuelva, cuando todo se devuelve y el error fue de la tienda (por defecto) o cuando lo decide quien aprueba."
            ]
          },
          {
            "type": "warning",
            "text": "Devolver más coste de envío del que permite la política envía el reembolso a un aprobador y requiere una **Nota** que explique el motivo."
          }
        ]
      },
      {
        "title": "Reembolso sin devolución",
        "requires": [
          "finance"
        ],
        "path": "/admin/orders",
        "blocks": [
          {
            "type": "p",
            "text": "Abre el pedido y haz clic en **Reembolsar** en su tarjeta **Reembolsos**. Elige el motivo (gesto comercial, entrega tardía, …) y el importe. No vuelve mercancía al stock. La aprobación y el pago funcionan igual."
          }
        ]
      },
      {
        "title": "¿Te has equivocado? Revertir un reembolso",
        "requires": [
          "finance"
        ],
        "path": "/admin/refunds",
        "blocks": [
          {
            "type": "list",
            "items": [
              "Antes de pagarlo: **Recházalo** y solicita uno correcto.",
              "Después de pagarlo: **Revierte** con un motivo. Se contabiliza un asiento de reversión con fecha de hoy y la devolución vuelve a **Aprobada** para que puedas solicitar un nuevo reembolso.",
              "La mercancía que ya volvió al stock **permanece allí** tras una reversión; si no debía estar, corrígela con un **Recuento de stock** en la página de Inventario.",
              "Un reembolso pagado por un mensajero que ya ha sido liquidado **no se puede revertir**."
            ]
          },
          {
            "type": "warning",
            "text": "Los pedidos entregados antes de que comenzara la contabilidad no se pueden reembolsar en el sistema: registra esos reembolsos fuera de él."
          }
        ]
      }
    ]
  },
  "accounts": {
    "requires": [
      "finance"
    ],
    "label": "Cuentas",
    "summary": "Caja de efectivo, banco y monederos, liquidación con mensajeros y gastos.",
    "sections": [
      {
        "title": "Cuentas de dinero",
        "path": "/admin/money-accounts",
        "blocks": [
          {
            "type": "p",
            "text": "Una cuenta de dinero es cualquier lugar donde realmente está el dinero de la tienda. Hay tres tipos: **Caja de efectivo**, **Cuenta bancaria** y **Monedero móvil**. Cada saldo **proviene de la contabilidad**: nunca lo escribes tú; es la suma de todo lo que se movió por esa cuenta."
          },
          {
            "type": "steps",
            "title": "Crear una cuenta",
            "items": [
              "Haz clic en **Nueva cuenta de dinero**.",
              "Introduce un nombre (p. ej., Caja de la tienda, Banco principal, Monedero de la tienda) y elige el tipo. **El tipo no se puede cambiar después.**",
              "Haz clic en **Establecer como predeterminada** en la cuenta donde entra la mayor parte del dinero: se usa automáticamente cuando un registro no indica ninguna cuenta."
            ]
          },
          {
            "type": "tip",
            "text": "Una cuenta por la que ya se ha movido dinero no se puede eliminar: **Desactívala** en su lugar. La cuenta predeterminada no se puede desactivar."
          }
        ]
      },
      {
        "title": "¿Qué mueve dinero de entrada y de salida?",
        "blocks": [
          {
            "type": "list",
            "title": "Entradas de dinero",
            "items": [
              "Un cobro a un cliente por **Personal de la tienda** (en la cuenta que elegiste).",
              "Una **liquidación de mensajero**: el efectivo que entregan (en **Pagado en**).",
              "Una transferencia desde otra cuenta."
            ]
          },
          {
            "type": "list",
            "title": "Salidas de dinero",
            "items": [
              "Un reembolso como **Efectivo de la tienda**.",
              "Un **gasto** (desde **Pagado desde**).",
              "Un **pago a proveedor**.",
              "Una transferencia a otra cuenta."
            ]
          }
        ]
      },
      {
        "title": "Transferir entre cuentas",
        "path": "/admin/money-accounts",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "Haz clic en **Transferir dinero** (necesitas al menos dos cuentas activas).",
              "Elige **Desde** y **Hasta** e introduce el importe, sin superar lo que tiene la cuenta de origen.",
              "Añade una nota (p. ej., ingreso semanal en el banco) y haz clic en **Transferir**."
            ]
          },
          {
            "type": "tip",
            "text": "Una transferencia no es ni un ingreso ni un gasto: el dinero total de la tienda no cambia, solo cambia dónde está."
          }
        ]
      },
      {
        "title": "Liquidar el efectivo con un mensajero",
        "path": "/admin/couriers",
        "blocks": [
          {
            "type": "p",
            "text": "Cada cobro registrado como **Mensajero** suma a lo que ese mensajero tiene. Un reembolso que el mensajero pagó a un cliente con ese efectivo se descuenta. Cuando el mensajero vuelve y entrega el efectivo, **Liquidas**."
          },
          {
            "type": "steps",
            "items": [
              "En **Envíos → Mensajeros**, haz clic en **Liquidar** junto al mensajero.",
              "Verás lo que cobró y de cuántos pedidos, los reembolsos que pagó a clientes y lo que **Retiene** (= cobrado − reembolsos).",
              "Introduce la **Tarifa del mensajero** si se queda su tarifa de ese efectivo: se contabiliza como un coste de envío.",
              "En **Efectivo entregado**, introduce lo que realmente te dio. El importe esperado aparece debajo del campo (= retenido − tarifa).",
              "Elige la cuenta en **Pagado en**.",
              "Si lo que entrega difiere de lo esperado (menos o más), debes indicar un **Motivo**.",
              "Haz clic en **Liquidar**."
            ]
          },
          {
            "type": "example",
            "title": "Ejemplo",
            "lines": [
              "El mensajero cobró 3 pedidos por valor de 1650.",
              "Pagó a un cliente un reembolso de 200 → retiene 1450.",
              "Su tarifa es 150 → debe entregar 1300.",
              "Entrega 1300 → entra en la caja de efectivo y los 150 se contabilizan como coste de envío."
            ]
          },
          {
            "type": "warning",
            "text": "Si la tarifa del mensajero es superior al efectivo que retiene, la liquidación no se completará. Introduce una tarifa hasta lo que retiene y registra el resto como un **Gasto** en “Costes de envío y mensajería”."
          }
        ]
      },
      {
        "title": "Gastos",
        "path": "/admin/expenses",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "Haz clic en **Nuevo gasto**.",
              "Elige la **Categoría**: costes de envío, alquiler, sueldos, marketing, embalaje, comisiones bancarias, suministros u otros gastos de explotación.",
              "Introduce el importe, la fecha y la descripción, además del número de recibo o factura si lo hay.",
              "Elige **Pagado desde** (la cuenta de la que salió el dinero) y haz clic en **Guardar**."
            ]
          },
          {
            "type": "p",
            "text": "Los gastos **nunca se editan**. Si uno es incorrecto, haz clic en **Revertir** e indica un motivo: un asiento de reversión con fecha de hoy lo cancela y el original permanece en su periodo marcado como **Revertido**. Después registra el correcto."
          },
          {
            "type": "tip",
            "text": "Encima de la tabla verás el total de cada categoría en el periodo elegido, útil para ver adónde va el dinero."
          }
        ]
      }
    ]
  },
  "purchases": {
    "requires": [
      "inventory",
      "finance"
    ],
    "label": "Compras y proveedores",
    "summary": "Incorporar stock nuevo de un proveedor a su coste, pagarle y devolverle mercancía.",
    "sections": [
      {
        "title": "¿Por qué registrar el stock como una compra?",
        "blocks": [
          {
            "type": "p",
            "text": "Una compra es la forma correcta de incorporar stock nuevo. Registrar una hace tres cosas a la vez: añade las unidades al stock, calcula el **Coste unitario** (una media ponderada) y registra lo que debes al proveedor. Sin ese coste, los informes de beneficios no serán precisos."
          }
        ]
      },
      {
        "title": "Añadir un proveedor",
        "path": "/admin/suppliers",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "En **Stock y compras → Proveedores**, haz clic en **Nuevo proveedor**.",
              "Introduce el nombre, el teléfono, el número fiscal (opcional) y las notas que quieras.",
              "La columna **Adeudado** muestra lo que debes a cada proveedor ahora mismo."
            ]
          }
        ]
      },
      {
        "title": "Registrar una compra",
        "path": "/admin/purchases",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "En **Compras**, haz clic en **Nueva compra**.",
              "Elige el proveedor e introduce el **N.º de factura del proveedor** y la fecha de **Recibido el**.",
              "Para cada producto, haz clic en **Añadir línea**: elige el producto (o su talla/color), la cantidad y el **Coste unitario**. Los productos que no controlan stock no se pueden elegir.",
              "En **Flete y otros costes**, introduce el transporte, la aduana y similares. Se reparte entre las líneas según su valor, de modo que pasa a formar parte de lo que costó el stock.",
              "Haz clic en **Guardar borrador**. Un borrador **no mueve nada**: edítalo cuanto quieras.",
              "Cuando la mercancía llegue de verdad, abre la compra y haz clic en **Contabilizar: mercancía recibida**."
            ]
          },
          {
            "type": "flow",
            "items": [
              "Borrador",
              "Contabilizada"
            ]
          },
          {
            "type": "warning",
            "text": "Una vez contabilizada, la mercancía entra en el stock a su coste y el importe se debe al proveedor desde la fecha de recepción, y la compra **no se puede editar ni cancelar**. Las correcciones se hacen con **Devolver al proveedor**."
          },
          {
            "type": "example",
            "title": "Cómo se reparte el flete",
            "lines": [
              "Línea 1: 10 unidades × 100 = 1000 — Línea 2: 5 unidades × 200 = 1000.",
              "Flete 200 → cada línea es la mitad del valor, así que cada una asume 100.",
              "Coste unitario real: línea 1 = 110, línea 2 = 220."
            ]
          }
        ]
      },
      {
        "title": "Pagar a un proveedor",
        "path": "/admin/suppliers",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "En **Proveedores** (o en la página de una compra), haz clic en **Pagar**.",
              "Se muestra el importe adeudado ahora. Introduce lo que pagas; una parte también vale.",
              "Elige la cuenta de la que salió el dinero y guarda."
            ]
          },
          {
            "type": "tip",
            "text": "Un pago liquida **primero las compras más antiguas**, automáticamente."
          }
        ]
      },
      {
        "title": "Devolver mercancía a un proveedor",
        "path": "/admin/purchases",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "Abre una compra contabilizada y haz clic en **Devolver al proveedor**.",
              "Para cada línea, introduce cuántas unidades se devuelven (el máximo aparece junto a ella).",
              "Confirma."
            ]
          },
          {
            "type": "p",
            "text": "Las unidades salen del stock al precio al que se compraron y eso se descuenta de lo que debes al proveedor. Solo se pueden devolver las unidades que aún están en la estantería."
          }
        ]
      }
    ]
  },
  "inventory": {
    "requires": [
      "inventory"
    ],
    "label": "Inventario",
    "summary": "Cantidades y costes, recuentos de stock y ajustes manuales.",
    "sections": [
      {
        "title": "Cómo leer la página de Inventario",
        "path": "/admin/inventory",
        "blocks": [
          {
            "type": "list",
            "items": [
              "**Artículos controlados / Unidades totales**: cuántos productos controlan el stock y cuántas unidades hay en total.",
              "**Valor del stock al coste**: cantidad × coste unitario, el dinero inmovilizado en stock.",
              "**Valor del stock al precio de venta**: lo que aportaría todo a los precios actuales.",
              "**Artículos sin coste**: stock que tenías antes de que comenzara la contabilidad y aún sin coste definido; queda fuera del valor.",
              "**Stock bajo / Agotado**: productos que alcanzaron tu umbral o se agotaron."
            ]
          }
        ]
      },
      {
        "title": "Definir el coste inicial",
        "path": "/admin/inventory",
        "blocks": [
          {
            "type": "p",
            "text": "El stock que estaba en la estantería antes de que comenzara la contabilidad no tiene coste. Esos productos muestran un botón **Definir coste**: introduce lo que te costó realmente una unidad. Se define **una sola vez**; después, los costes provienen de las compras. Aún más fácil: introduce el **Coste por unidad** junto al stock inicial al añadir el producto. Si un coste se escribió mal, un icono de lápiz junto a él te permite corregirlo, mientras no se haya vendido, comprado ni ajustado nada de ese artículo."
          },
          {
            "type": "warning",
            "text": "Vender un producto antes de definir su coste deja su margen incompleto en Ventas por producto."
          }
        ]
      },
      {
        "title": "Ajustar el stock a mano",
        "path": "/admin/inventory",
        "blocks": [
          {
            "type": "p",
            "text": "Haz clic en el icono **Ajustar stock** junto a un producto. Hay dos formas:"
          },
          {
            "type": "list",
            "items": [
              "**Registrar movimiento**: elige el **Tipo de movimiento** (daño, ajuste para añadir, ajuste para retirar…) e introduce la cantidad como número positivo: el tipo decide la dirección. Añade una referencia y un motivo.",
              "**Recuento de stock**: introduce la **Cantidad contada** que realmente contaste; el sistema calcula y registra la diferencia."
            ]
          },
          {
            "type": "tip",
            "text": "No uses “Ajuste (añadir)” para el stock de un proveedor: regístralo como una **Compra** para que se registren su coste y lo que debes."
          }
        ]
      },
      {
        "title": "Historial de movimientos",
        "path": "/admin/inventory/movements",
        "blocks": [
          {
            "type": "p",
            "text": "El icono **Transacciones** junto a un producto, o el botón **Movimientos de stock** de la parte superior, muestra cada movimiento: venta, pedido cancelado, devolución, compra, devuelto al proveedor, recuento de stock, daño, con el saldo posterior a cada uno y quién lo hizo."
          }
        ]
      },
      {
        "title": "Ajustes de stock en un producto",
        "path": "/admin/products",
        "blocks": [
          {
            "type": "list",
            "items": [
              "**Controlar stock**: desactívalo para productos que nunca se agotan (hechos bajo pedido, servicios).",
              "**Stock inicial**: la cantidad al crear el producto. Los cambios posteriores se hacen en la página de Inventario.",
              "**Stock bajo a partir de**: el producto aparece como de stock bajo cuando su cantidad alcanza este número.",
              "**Permitir pedidos pendientes**: los clientes pueden seguir pidiendo con stock 0.",
              "Un producto con tallas o colores tiene el stock definido por separado para cada variante."
            ]
          }
        ]
      }
    ]
  },
  "import": {
    "label": "Importar",
    "summary": "Importar y actualizar productos desde un archivo CSV.",
    "sections": [
      {
        "title": "Importar productos desde CSV",
        "path": "/admin/products",
        "blocks": [
          {
            "type": "p",
            "text": "Añade muchos productos a la vez, o cambia los datos y precios de los existentes, desde un archivo de Excel o Google Sheets en lugar de abrir cada producto."
          },
          {
            "type": "steps",
            "items": [
              "En **Productos**, haz clic primero en **Exportar CSV**: te da un archivo con las columnas correctas, con tus productos actuales.",
              {
                "text": "Ábrelo en Excel o Google Sheets y edítalo: cambia precios o cantidades, o añade filas para productos nuevos.",
                "requires": [
                  "inventory"
                ]
              },
              {
                "text": "Ábrelo en Excel o Google Sheets y edítalo: cambia nombres o precios, o añade filas para productos nuevos.",
                "unless": "inventory"
              },
              "Guárdalo como **CSV UTF-8** (para que el texto en árabe y los acentos se conserven).",
              "De vuelta en Productos, haz clic en **Importar CSV** y luego en **Elegir archivo CSV**.",
              "Aparece una **vista previa**: cada fila se marca como **Nuevo**, **Actualizar**, **Sin cambios** o **Error** con su número de línea. En este punto **aún no se ha cambiado nada**.",
              "Si no hay errores, haz clic en **Aplicar cambios**."
            ]
          }
        ]
      },
      {
        "title": "Cómo se lee el archivo",
        "blocks": [
          {
            "type": "list",
            "items": [
              "Cada fila se asocia a un producto existente primero por **product_id** y luego por **slug**. Una fila que no coincide con nada **crea un producto nuevo**.",
              "**Una celda vacía deja ese campo como está**: para cambiar solo el precio, deja vacías las demás columnas.",
              {
                "text": "Los cambios de cantidad se registran en los movimientos de stock como un **Recuento de stock**, para que puedas rastrearlos después.",
                "requires": [
                  "inventory"
                ]
              }
            ]
          },
          {
            "type": "warning",
            "text": "No cambies el nombre de los encabezados de las columnas (primera fila) ni borres **product_id** de los productos existentes; de lo contrario, se crean de nuevo como productos nuevos en lugar de actualizarse."
          }
        ]
      },
      {
        "title": "Si hay errores",
        "blocks": [
          {
            "type": "faq",
            "items": [
              {
                "q": "La vista previa tiene filas con “Error”.",
                "a": "Corrígelos en el archivo (cada error muestra su número de línea) y súbelo de nuevo. No se ha cambiado nada."
              },
              {
                "q": "Un mensaje dice que la importación se detuvo a medias.",
                "a": "Los productos anteriores al marcado con el error se guardaron; el resto no. Corrige el error y súbelo de nuevo: las filas guardadas aparecerán como Sin cambios."
              },
              {
                "q": "Un mensaje dice que nada difiere.",
                "a": "El archivo coincide exactamente con tu catálogo; no hay nada que cambiar."
              }
            ]
          },
          {
            "type": "tip",
            "requires": [
              "inventory",
              "finance"
            ],
            "text": "El CSV es ideal para añadir productos, cambiar precios y hacer recuentos de stock. Pero el stock que llega de un proveedor debe registrarse como una **Compra**, para que se registren su coste y lo que debes."
          }
        ]
      }
    ]
  },
  "reports": {
    "requires": [
      "finance"
    ],
    "label": "Informes y cierre",
    "summary": "Cómo leer tus cifras y cómo cerrar el mes.",
    "sections": [
      {
        "title": "Informes disponibles",
        "path": "/admin/reports",
        "blocks": [
          {
            "type": "list",
            "items": [
              "**Cuenta de resultados**: ventas (al entregarse) menos coste de ventas = beneficio bruto, menos gastos = beneficio neto. Se compara con el mismo número de días inmediatamente anteriores.",
              "**Flujo de caja**: todo el dinero que entra y sale en el periodo, por causa. Las transferencias entre cuentas suman cero.",
              "**Cuentas por cobrar de clientes**: lo que los clientes aún deben de pedidos entregados, clasificado por antigüedad desde la entrega.",
              "**Cuentas por pagar a proveedores**: lo que debes a los proveedores, clasificado por antigüedad desde la recepción de la mercancía.",
              "**Valoración del inventario**: el stock actual a su coste.",
              "**Balance de comprobación**: el saldo inicial de cada cuenta contable, los débitos y créditos del periodo elegido y su saldo final; los débitos deben igualar a los créditos en cada par.",
              "**Ventas por producto**: unidades vendidas, ventas netas, coste y margen por producto."
            ]
          },
          {
            "type": "tip",
            "text": "Todos los informes se pueden descargar para Excel con **Descargar CSV**."
          }
        ]
      },
      {
        "title": "¿Por qué los ingresos de la página de inicio difieren del número de pedidos?",
        "path": "/admin",
        "blocks": [
          {
            "type": "p",
            "text": "Los **Ingresos netos** de la página de inicio cuentan los pedidos **entregados** en el periodo, netos de descuentos y reembolsos. Los pedidos realizados pero aún no entregados cuentan para el número de pedidos, no para los ingresos."
          }
        ]
      },
      {
        "title": "Contabilidad y cierre",
        "path": "/admin/books",
        "blocks": [
          {
            "type": "p",
            "text": "La **Conciliación** compara cada cifra con dos registros independientes (p. ej., el saldo de un mensajero con sus cobros). Cuando todo cuadra verás **Todas las comprobaciones se cumplen**; si no, la comprobación que falla enumera los documentos que hay detrás."
          },
          {
            "type": "steps",
            "title": "Cerrar un periodo (solo superadministrador)",
            "items": [
              "Asegúrate de que todas las comprobaciones se cumplen (haz clic en **Ejecutar de nuevo** si hace falta).",
              "Elige una fecha en **Cerrar hasta**: no se puede cerrar hoy.",
              "Haz clic en **Cerrar periodo**. Todos los días hasta esa fecha quedan congelados y no admiten nuevos registros."
            ]
          },
          {
            "type": "p",
            "text": "Para corregir algo en un periodo cerrado, haz clic en **Reabrir** e indica un motivo (puedes mantener parte cerrada). La reapertura queda en el historial."
          }
        ]
      },
      {
        "title": "Rutina recomendada de fin de mes",
        "blocks": [
          {
            "type": "steps",
            "items": [
              "**Liquida** con todos los mensajeros.",
              "Asegúrate de que todos los pedidos entregados tienen su cobro registrado.",
              "Registra todos los **gastos** (alquiler, sueldos, publicidad…).",
              "Contabiliza las **compras** en borrador cuya mercancía haya llegado.",
              "Revisa las **Cuentas por cobrar de clientes** y las **Cuentas por pagar a proveedores**.",
              "Compara el saldo de cada **cuenta de dinero** con lo que realmente hay en caja y en el banco.",
              "Ejecuta la **Conciliación** y, si todo va bien, **cierra el mes**."
            ]
          }
        ]
      }
    ]
  }
};

export default es;
