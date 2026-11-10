Colorimetría
Documento de referencia de la paleta de colores del proyecto. Usa estos códigos HEX como fuente principal para mantener la interfaz coherente. No reemplaces estos colores por tonos parecidos sin una razón funcional o una indicación explícita.

-----------------------------------------------------------Paleta oficial
N.º	Código HEX	RGB	Uso sugerido
1	#CF3A78	207, 58, 120	Rosa intenso
2	#B84BA7	184, 75, 167	Magenta / violeta
3	#914169	145, 65, 105	Vino rosado
4	#E32431	227, 36, 49	Rojo
5	#857352	133, 115, 82	Marrón grisáceo
6	#D1AD2A	209, 173, 42	Amarillo mostaza
7	#D14600	209, 70, 0	Naranja quemado
8	#A5451B	165, 69, 27	Terracota
9	#628001	98, 128, 1	Verde oliva
10	#28871B	40, 135, 27	Verde vivo
11	#287522	40, 117, 34	Verde bosque
12	#355833	53, 88, 51	Verde oscuro
13	#738993	115, 137, 147	Gris azulado
14	#1D8096	29, 128, 150	Azul petróleo
15	#007BC7	0, 123, 199	Azul brillante
16	#005387	0, 83, 135	Azul profundo
-----------------------------------------------------------

Instrucciones para el programa  
- Considera los 16 códigos HEX anteriores como la paleta de colores de referencia del proyecto.
- Reutiliza los colores de forma consistente en botones, estados, etiquetas, gráficos, indicadores y elementos destacados, según corresponda al diseño.
- Mantén un contraste suficiente entre el texto y el fondo para facilitar la lectura. No uses texto blanco sobre fondos claros ni texto oscuro sobre fondos oscuros si dificulta la legibilidad.
- No es obligatorio usar todos los colores en cada pantalla. Selecciona los que correspondan y evita saturar la interfaz.
- Si el proyecto ya tiene variables CSS, tokens de diseño o constantes de color, centraliza allí estos valores y reutilízalos en lugar de duplicar códigos.
- No cambies la lógica de negocio ni el comportamiento funcional de la aplicación al aplicar esta paleta.
- Los nombres de uso sugerido son descriptivos; el código HEX es la referencia exacta.
----------------------------------------------------------

Variables CSS de referencia
:root {
  --color-rosa-intenso: #CF3A78;
  --color-magenta: #B84BA7;
  --color-vino-rosado: #914169;
  --color-rojo: #E32431;
  --color-marron-grisaceo: #857352;
  --color-mostaza: #D1AD2A;
  --color-naranja-quemado: #D14600;
  --color-terracota: #A5451B;
  --color-verde-oliva: #628001;
  --color-verde-vivo: #28871B;
  --color-verde-bosque: #287522;
  --color-verde-oscuro: #355833;
  --color-gris-azulado: #738993;
  --color-azul-petroleo: #1D8096;
  --color-azul-brillante: #007BC7;
  --color-azul-profundo: #005387;
}