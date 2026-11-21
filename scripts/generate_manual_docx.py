# -*- coding: utf-8 -*-
"""
Script generador del Manual Técnico de Instalación, Despliegue y Requerimientos
del Servidor de Talento 360 en AlmaLinux para la Gobernación de Boyacá.
Genera un documento profesional .DOCX institucional completo con todos los 24 capítulos,
tablas, diagramas, bloques de comando, notas de seguridad y anexos.
"""

import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def create_manual():
    doc = docx.Document()

    # ─────────────────────────────────────────────────────────────────────────
    # CONFIGURACIÓN DE PÁGINA (Tamaño Carta y Márgenes 2.5 cm)
    # ─────────────────────────────────────────────────────────────────────────
    for section in doc.sections:
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
        section.top_margin = Inches(0.984)     # 2.5 cm
        section.bottom_margin = Inches(0.984)  # 2.5 cm
        section.left_margin = Inches(0.984)    # 2.5 cm
        section.right_margin = Inches(0.984)   # 2.5 cm
        section.different_first_page_header_footer = True

    # ─────────────────────────────────────────────────────────────────────────
    # PALETA DE COLORES INSTITUCIONALES (Gobernación de Boyacá & Talento 360)
    # ─────────────────────────────────────────────────────────────────────────
    # Verde Principal Gobernación: #1d6113
    # Verde Secundario / Oscuro:   #0f3d0c
    # Dorado Institucional / Acento: #ca8a04 / #eab308
    # Texto Principal:             #1f2937
    # Texto Secundario / Muted:    #4b5563
    # Fondos de caja:
    #   - Nota / Informativo:      #f0fdf4 (Borde #16a34a)
    #   - Precaución / Alerta:     #fefce8 (Borde #ca8a04)
    #   - Seguridad / Peligro:     #fef2f2 (Borde #dc2626)
    #   - Comandos / Consola:      #f8fafc (Borde #cbd5e1)
    
    COLOR_PRIMARY_HEX = "1D6113"
    COLOR_SECONDARY_HEX = "0F3D0C"
    COLOR_ACCENT_HEX = "CA8A04"
    COLOR_TEXT_HEX = "1F2937"
    COLOR_MUTED_HEX = "4B5563"
    
    # Configurar estilo Normal
    style_normal = doc.styles['Normal']
    font_normal = style_normal.font
    font_normal.name = 'Arial'
    font_normal.size = Pt(10.5)
    font_normal.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    style_normal.paragraph_format.line_spacing = 1.15
    style_normal.paragraph_format.space_after = Pt(5)

    # ─────────────────────────────────────────────────────────────────────────
    # HELPERS XML PARA ESTILOS AVANZADOS
    # ─────────────────────────────────────────────────────────────────────────
    def set_cell_background(cell, fill_hex):
        tcPr = cell._tc.get_or_add_tcPr()
        existing_shd = tcPr.find(qn('w:shd'))
        if existing_shd is not None:
            tcPr.remove(existing_shd)
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        existing_mar = tcPr.find(qn('w:tcMar'))
        if existing_mar is not None:
            existing_mar.addprevious(shd)
        else:
            tcPr.append(shd)

    def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
        tcPr = cell._tc.get_or_add_tcPr()
        existing_mar = tcPr.find(qn('w:tcMar'))
        if existing_mar is not None:
            tcPr.remove(existing_mar)
        tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}>'
                          f'<w:top w:w="{top}" w:type="dxa"/>'
                          f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
                          f'<w:left w:w="{left}" w:type="dxa"/>'
                          f'<w:right w:w="{right}" w:type="dxa"/>'
                          f'</w:tcMar>')
        tcPr.append(tcMar)

    def set_cell_borders(cell, top="CCCCCC", bottom="CCCCCC", left="CCCCCC", right="CCCCCC", sz="4"):
        tcPr = cell._tc.get_or_add_tcPr()
        existing_borders = tcPr.find(qn('w:tcBorders'))
        if existing_borders is not None:
            tcPr.remove(existing_borders)
        borders = parse_xml(f'<w:tcBorders {nsdecls("w")}>'
                            f'<w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{top}"/>'
                            f'<w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{bottom}"/>'
                            f'<w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{left}"/>'
                            f'<w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{right}"/>'
                            f'</w:tcBorders>')
        existing_shd = tcPr.find(qn('w:shd'))
        if existing_shd is not None:
            existing_shd.addprevious(borders)
        else:
            existing_mar = tcPr.find(qn('w:tcMar'))
            if existing_mar is not None:
                existing_mar.addprevious(borders)
            else:
                tcPr.append(borders)

    def add_header_footer():
        # Configurar encabezado y pie en la segunda sección (páginas normales)
        header = doc.sections[0].header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("TALENTO 360 · GOBERNACIÓN DE BOYACÁ  |  MANUAL TÉCNICO DE INSTALACIÓN (ALMALINUX)")
        hrun.font.name = 'Arial'
        hrun.font.size = Pt(8)
        hrun.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

        footer = doc.sections[0].footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        
        # Pie de página: Izquierda confidencialidad, Derecha página
        frun1 = fp.add_run("Dirección de Talento Humano · Uso Técnico Institucional                                  Página ")
        frun1.font.name = 'Arial'
        frun1.font.size = Pt(8.5)
        frun1.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)
        
        # Campo PAGE con contenido de respaldo
        fld_page = parse_xml(r'<w:fldSimple %s w:instr="PAGE"><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="17"/><w:color w:val="6B7280"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>' % nsdecls('w'))
        fp._p.append(fld_page)
        
        frun2 = fp.add_run(" de ")
        frun2.font.name = 'Arial'
        frun2.font.size = Pt(8.5)
        frun2.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)
        
        # Campo NUMPAGES con contenido de respaldo
        fld_numpages = parse_xml(r'<w:fldSimple %s w:instr="NUMPAGES"><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="17"/><w:color w:val="6B7280"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>' % nsdecls('w'))
        fp._p.append(fld_numpages)

    # ─────────────────────────────────────────────────────────────────────────
    # HELPERS DE CONTENIDO Y TIPOGRAFÍA
    # ─────────────────────────────────────────────────────────────────────────
    def add_page_break():
        doc.add_page_break()

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Arial'
        run.font.size = Pt(15)
        run.bold = True
        run.font.color.rgb = RGBColor(0x1D, 0x61, 0x13)
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(13)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Arial'
        run.font.size = Pt(12)
        run.bold = True
        run.font.color.rgb = RGBColor(0x0F, 0x3D, 0x0C)
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(9)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Arial'
        run.font.size = Pt(10.5)
        run.bold = True
        run.font.color.rgb = RGBColor(0xCA, 0x8A, 0x04)
        return p

    def add_p(text, bold_prefix="", italic_prefix=""):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.line_spacing = 1.15
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        if bold_prefix:
            rb = p.add_run(bold_prefix)
            rb.bold = True
            rb.font.name = 'Arial'
            rb.font.size = Pt(10)
        if italic_prefix:
            ri = p.add_run(italic_prefix)
            ri.italic = True
            ri.font.name = 'Arial'
            ri.font.size = Pt(10)
        r = p.add_run(text)
        r.font.name = 'Arial'
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
        return p

    def add_bullet(text, bold_prefix=""):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        if bold_prefix:
            rb = p.add_run(bold_prefix)
            rb.bold = True
            rb.font.name = 'Arial'
            rb.font.size = Pt(10)
        r = p.add_run(text)
        r.font.name = 'Arial'
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
        return p

    def add_callout(box_type, title, text):
        """
        Genera una caja de llamada con estilo formal.
        Tipos:
          - 'NOTE': fondo verde claro #F0FDF4, borde #16A34A, icono institucional.
          - 'WARN': fondo amarillo suave #FEFCE8, borde #CA8A04, icono advertencia.
          - 'SECURITY': fondo rojo tenue #FEF2F2, borde #DC2626, icono seguridad.
          - 'TIP': fondo azul tenue #F0F9FF, borde #0284C7, icono recomendación.
        """
        styles = {
            'NOTE': ('F0FDF4', '16A34A', '047857', '📌 NOTA TÉCNICA'),
            'WARN': ('FEFCE8', 'CA8A04', '854D0E', '⚠️ PRECAUCIÓN DE OPERACIÓN'),
            'SECURITY': ('FEF2F2', 'DC2626', '991B1B', '🛡️ CONTROL DE SEGURIDAD OBLIGATORIO'),
            'TIP': ('F0F9FF', '0284C7', '0369A1', '💡 RECOMENDACIÓN DE RENDIMIENTO')
        }
        bg, border, title_col, def_title = styles.get(box_type, styles['NOTE'])
        if not title:
            title = def_title

        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        tbl.columns[0].width = Inches(6.5)

        cell = tbl.cell(0, 0)
        set_cell_background(cell, bg)
        set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
        set_cell_borders(cell, top=bg, bottom=bg, left=border, right=bg, sz="24")  # borde izquierdo grueso 3pt

        cp = cell.paragraphs[0]
        cp.paragraph_format.space_before = Pt(2)
        cp.paragraph_format.space_after = Pt(3)
        trun = cp.add_run(title + "\n")
        trun.bold = True
        trun.font.name = 'Arial'
        trun.font.size = Pt(10)
        # Convert hex color to RGB
        r_c = int(title_col[0:2], 16)
        g_c = int(title_col[2:4], 16)
        b_c = int(title_col[4:6], 16)
        trun.font.color.rgb = RGBColor(r_c, g_c, b_c)

        mrun = cp.add_run(text)
        mrun.font.name = 'Arial'
        mrun.font.size = Pt(9.5)
        mrun.font.color.rgb = RGBColor(0x37, 0x41, 0x51)

        # Espacio post tabla
        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_before = Pt(0)
        p_sp.paragraph_format.space_after = Pt(4)

    def add_terminal_block(command, description="", expected_output="", validation="", error_handling=""):
        """
        Crea un bloque de terminal profesional para AlmaLinux con:
        - Comando en tipografía monoespaciada con fondo oscuro/gris tenue #F8FAFC
        - Explicación del comando
        - Resultado esperado en pantalla
        - Validación y qué hacer si hay error
        """
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        tbl.columns[0].width = Inches(6.5)

        cell = tbl.cell(0, 0)
        set_cell_background(cell, "F8FAFC")
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        set_cell_borders(cell, top="CBD5E1", bottom="CBD5E1", left="1D6113", right="CBD5E1", sz="16")

        cp = cell.paragraphs[0]
        cp.paragraph_format.space_before = Pt(2)
        cp.paragraph_format.space_after = Pt(2)

        # Header consola
        hrun = cp.add_run("TERMINAL ALMALINUX 9 — EJECUTAR COMO ADMINISTRADOR:\n")
        hrun.font.name = 'Arial'
        hrun.font.size = Pt(8.5)
        hrun.bold = True
        hrun.font.color.rgb = RGBColor(0x1D, 0x61, 0x13)

        # Comando monospace
        crun = cp.add_run(f"$ {command}\n")
        crun.font.name = 'Consolas'
        crun.font.size = Pt(9.5)
        crun.bold = True
        crun.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

        if description:
            d_label = cp.add_run("¿Qué hace?: ")
            d_label.bold = True
            d_label.font.name = 'Arial'
            d_label.font.size = Pt(8.5)
            d_label.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
            
            d_val = cp.add_run(description + "\n")
            d_val.font.name = 'Arial'
            d_val.font.size = Pt(8.5)
            d_val.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

        if expected_output:
            e_label = cp.add_run("Resultado esperado en pantalla:\n")
            e_label.bold = True
            e_label.font.name = 'Arial'
            e_label.font.size = Pt(8.5)
            e_label.font.color.rgb = RGBColor(0x16, 0x65, 0x34)
            
            e_val = cp.add_run(expected_output + "\n")
            e_val.font.name = 'Consolas'
            e_val.font.size = Pt(8.5)
            e_val.font.color.rgb = RGBColor(0x16, 0x65, 0x34)

        if validation:
            v_label = cp.add_run("Validación técnica: ")
            v_label.bold = True
            v_label.font.name = 'Arial'
            v_label.font.size = Pt(8.5)
            v_label.font.color.rgb = RGBColor(0x03, 0x69, 0xA1)
            
            v_val = cp.add_run(validation + "\n")
            v_val.font.name = 'Arial'
            v_val.font.size = Pt(8.5)
            v_val.font.color.rgb = RGBColor(0x03, 0x69, 0xA1)

        if error_handling:
            er_label = cp.add_run("En caso de error: ")
            er_label.bold = True
            er_label.font.name = 'Arial'
            er_label.font.size = Pt(8.5)
            er_label.font.color.rgb = RGBColor(0x99, 0x1B, 0x1B)
            
            er_val = cp.add_run(error_handling)
            er_val.font.name = 'Arial'
            er_val.font.size = Pt(8.5)
            er_val.font.color.rgb = RGBColor(0x99, 0x1B, 0x1B)

        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_before = Pt(0)
        p_sp.paragraph_format.space_after = Pt(4)

    def add_styled_table(headers, rows, col_widths=None, alignments=None):
        """
        Crea una tabla con cabecera verde institucional, texto blanco y filas con cebra.
        """
        table = doc.add_table(rows=len(rows) + 1, cols=len(headers))
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False

        # Header Row
        hdr_cells = table.rows[0].cells
        for i, title in enumerate(headers):
            cell = hdr_cells[i]
            if col_widths and i < len(col_widths):
                cell.width = Inches(col_widths[i])
            set_cell_background(cell, COLOR_PRIMARY_HEX)
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            set_cell_borders(cell, top=COLOR_PRIMARY_HEX, bottom=COLOR_PRIMARY_HEX, left="2A7A1F", right="2A7A1F")
            
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            if alignments and i < len(alignments):
                p.alignment = alignments[i]
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(title)
            run.bold = True
            run.font.name = 'Arial'
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

        # Data Rows
        for r_idx, row_data in enumerate(rows):
            row_cells = table.rows[r_idx + 1].cells
            bg_color = "FFFFFF" if r_idx % 2 == 0 else "F9FAFB"
            for c_idx, val in enumerate(row_data):
                cell = row_cells[c_idx]
                if col_widths and c_idx < len(col_widths):
                    cell.width = Inches(col_widths[c_idx])
                set_cell_background(cell, bg_color)
                set_cell_margins(cell, top=80, bottom=80, left=110, right=110)
                set_cell_borders(cell, top="E5E7EB", bottom="E5E7EB", left="E5E7EB", right="E5E7EB")
                
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(1)
                p.paragraph_format.space_after = Pt(1)
                if alignments and c_idx < len(alignments):
                    p.alignment = alignments[c_idx]
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(str(val))
                run.font.name = 'Arial'
                run.font.size = Pt(8.5)
                run.font.color.rgb = RGBColor(0x37, 0x41, 0x51)

        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_before = Pt(0)
        p_sp.paragraph_format.space_after = Pt(5)
        return table

    print("Construyendo Portada y Control Documental...")

    # ═════════════════════════════════════════════════════════════════════════
    # PORTADA INSTITUCIONAL
    # ═════════════════════════════════════════════════════════════════════════
    # Espaciador superior
    p_top = doc.add_paragraph()
    p_top.paragraph_format.space_before = Pt(20)

    # Tabla para colocar los dos logos institucionales en paralelo
    logo_table = doc.add_table(rows=1, cols=2)
    logo_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    logo_table.autofit = False
    logo_table.columns[0].width = Inches(3.25)
    logo_table.columns[1].width = Inches(3.25)

    # Logo Gobernación (izquierda)
    c_gob = logo_table.cell(0, 0)
    p_gob = c_gob.paragraphs[0]
    p_gob.alignment = WD_ALIGN_PARAGRAPH.LEFT
    path_gob = os.path.abspath('web/frontend/src/imgs/gobernacion.png')
    if os.path.exists(path_gob):
        p_gob.add_run().add_picture(path_gob, width=Inches(2.4))

    # Logo Talento 360 (derecha)
    c_tal = logo_table.cell(0, 1)
    p_tal = c_tal.paragraphs[0]
    p_tal.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    path_tal = os.path.abspath('web/frontend/src/imgs/logo_talento360_completo_verde.png')
    if os.path.exists(path_tal):
        p_tal.add_run().add_picture(path_tal, width=Inches(2.6))

    # Espacio tras logos
    p_after_logos = doc.add_paragraph()
    p_after_logos.paragraph_format.space_before = Pt(45)

    # Barra dorada decorativa
    p_bar = doc.add_paragraph()
    p_bar.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_bar.paragraph_format.space_after = Pt(18)
    run_bar = p_bar.add_run("━" * 58)
    run_bar.font.name = 'Arial'
    run_bar.font.size = Pt(14)
    run_bar.bold = True
    run_bar.font.color.rgb = RGBColor(0xCA, 0x8A, 0x04)

    # Título Principal
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(10)
    p_title.paragraph_format.space_after = Pt(12)
    run_t = p_title.add_run("MANUAL TÉCNICO DE INSTALACIÓN,\nDESPLIEGUE Y REQUERIMIENTOS DEL SERVIDOR")
    run_t.font.name = 'Arial'
    run_t.font.size = Pt(22)
    run_t.bold = True
    run_t.font.color.rgb = RGBColor(0x1D, 0x61, 0x13)

    # Subtítulo
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(12)
    run_s = p_sub.add_run("Sistema Integral de Gestión de Talento Humano — Talento 360")
    run_s.font.name = 'Arial'
    run_s.font.size = Pt(14)
    run_s.bold = True
    run_s.font.color.rgb = RGBColor(0x0F, 0x3D, 0x0C)

    # Descripción de alcance
    p_desc = doc.add_paragraph()
    p_desc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_desc.paragraph_format.space_after = Pt(25)
    run_d = p_desc.add_run("Guía Oficial de Arquitectura On-Premise, Configuración, Hardening, Base de Datos PostgreSQL, Contenedores Docker y Operación Continua en Servidor Institucional con AlmaLinux Enterprise")
    run_d.font.name = 'Arial'
    run_d.font.size = Pt(10.5)
    run_d.italic = True
    run_d.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

    # Barra dorada inferior
    p_bar2 = doc.add_paragraph()
    p_bar2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_bar2.paragraph_format.space_after = Pt(35)
    run_bar2 = p_bar2.add_run("━" * 58)
    run_bar2.font.name = 'Arial'
    run_bar2.font.size = Pt(14)
    run_bar2.bold = True
    run_bar2.font.color.rgb = RGBColor(0xCA, 0x8A, 0x04)

    # Caja de Metadatos Institucionales de Portada
    meta_table = doc.add_table(rows=5, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    meta_table.columns[0].width = Inches(2.2)
    meta_table.columns[1].width = Inches(4.3)

    meta_items = [
        ("Entidad Titular:", "Gobernación de Boyacá"),
        ("Dependencia Responsable:", "Secretaría General — Dirección de Talento Humano"),
        ("Público Destinatario:", "Dirección de Tecnología, Sistemas e Infraestructura TI"),
        ("Versión Documental:", "Versión 1.0 — Oficial de Producción"),
        ("Fecha de Publicación:", "Noviembre de 2026")
    ]

    for idx, (label, val) in enumerate(meta_items):
        cell_lbl = meta_table.cell(idx, 0)
        cell_val = meta_table.cell(idx, 1)
        set_cell_background(cell_lbl, "F8FAFC")
        set_cell_background(cell_val, "FFFFFF")
        set_cell_margins(cell_lbl, top=50, bottom=50, left=80, right=80)
        set_cell_margins(cell_val, top=50, bottom=50, left=80, right=80)
        set_cell_borders(cell_lbl, top="E2E8F0", bottom="E2E8F0", left="1D6113", right="E2E8F0", sz="12")
        set_cell_borders(cell_val, top="E2E8F0", bottom="E2E8F0", left="E2E8F0", right="E2E8F0", sz="4")

        p_l = cell_lbl.paragraphs[0]
        p_l.paragraph_format.space_before = Pt(1)
        p_l.paragraph_format.space_after = Pt(1)
        rl = p_l.add_run(label)
        rl.bold = True
        rl.font.name = 'Arial'
        rl.font.size = Pt(9)
        rl.font.color.rgb = RGBColor(0x1D, 0x61, 0x13)

        p_v = cell_val.paragraphs[0]
        p_v.paragraph_format.space_before = Pt(1)
        p_v.paragraph_format.space_after = Pt(1)
        rv = p_v.add_run(val)
        rv.font.name = 'Arial'
        rv.font.size = Pt(9)
        rv.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # Salto de página tras portada
    doc.add_page_break()
    add_header_footer()

    # ═════════════════════════════════════════════════════════════════════════
    # CONTROL DOCUMENTAL
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("CONTROL DOCUMENTAL")
    add_p("El presente documento constituye el manual técnico y de infraestructura oficial del sistema Talento 360 para la Gobernación de Boyacá. Su propósito es normar y estandarizar los requerimientos de hardware, la arquitectura contenerizada, los procedimientos de despliegue sobre el sistema operativo AlmaLinux, y las políticas de respaldo, seguridad y contingencia aplicables por la Dirección de Tecnología e Infraestructura de la entidad.")

    add_styled_table(
        headers=["Parámetro Institucional", "Detalle de Registro"],
        rows=[
            ["Nombre del Documento", "Manual Técnico de Instalación, Despliegue y Requerimientos del Servidor de Talento 360 en AlmaLinux"],
            ["Código / Identificador", "MAN-INFRA-TALENTO360-ALMALINUX-V1.0"],
            ["Sistema Informático", "Talento 360 — Sistema Integral de Gestión de Talento Humano"],
            ["Entidad Titular", "Gobernación de Boyacá"],
            ["Dependencia Usuaria", "Dirección de Talento Humano"],
            ["Área Responsable de Infraestructura", "Dirección de Tecnología, Sistemas e Infraestructura TI"],
            ["Estado del Documento", "Aprobado para Implementación en Servidor Institucional"],
            ["Clasificación de Seguridad", "Documento Técnico Institucional de Uso Interno Restringido"],
            ["Plataforma Tecnológica Base", "AlmaLinux 9 (64 bits), Docker Engine 26+, Docker Compose v2, PostgreSQL 16 Alpine, Nginx 1.25 Alpine, Node.js 20 Alpine"]
        ],
        col_widths=[2.3, 4.2]
    )

    add_h2("Historial de Versiones y Revisiones")
    add_styled_table(
        headers=["Versión", "Fecha", "Área Responsable", "Descripción Detallada del Cambio"],
        rows=[
            [
                "1.0",
                "19/11/2026",
                "Arquitectura TI & DevOps Talento 360",
                "Elaboración inicial integral: dimensionamiento fundamentado para 10-12 usuarios concurrentes (4 vCPU, 8 GB RAM, 80 GB SSD), manual paso a paso sobre AlmaLinux ya instalado, configuración de Docker Compose con 12 servicios, endurecimiento de SELinux y firewalld, protección y migración de PostgreSQL 16 con verificación de censo histórico, y scripts de actualización continua."
            ]
        ],
        col_widths=[0.8, 1.1, 1.7, 2.9]
    )

    add_h2("Público Objetivo y Responsabilidades")
    add_p("Este manual está concebido para ser interpretado y ejecutado por:")
    add_bullet("Ingenieros y administradores de servidores del área de Infraestructura y TI de la Gobernación de Boyacá encargados del aprovisionamiento, red, seguridad perimetral y soporte del sistema operativo AlmaLinux.")
    add_bullet("Especialistas en bases de datos (DBAs) responsables de la custodia, integridad, respaldos y contingencias del motor PostgreSQL institucional.")
    add_bullet("Personal técnico de soporte y mantenimiento de aplicaciones de la Dirección de Talento Humano.")

    add_page_break()

    # ═════════════════════════════════════════════════════════════════════════
    # TABLA DE CONTENIDO
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("TABLA DE CONTENIDO")

    # Índice tipográfico formal estructurado
    toc_data = [
        ("1. INTRODUCCIÓN", "Propósito institucional, contexto del sistema y principios rectores"),
        ("2. OBJETIVO Y ALCANCE", "Metas de dimensionamiento, manual paso a paso y exclusiones"),
        ("3. DESCRIPCIÓN TÉCNICA DE TALENTO 360", "Los 6 módulos de negocio y componentes transversales"),
        ("4. ARQUITECTURA ACTUAL DEL SISTEMA", "Modelo de microservicios, Nginx Gateway, Docker y PostgreSQL"),
        ("5. REQUERIMIENTOS DEL SERVIDOR INSTITUCIONAL", "Dimensionamiento justificado: 4 vCPU, 8 GB RAM, 80 GB SSD"),
        ("6. REQUISITOS PREVIOS A LA INSTALACIÓN", "Condiciones que debe certificar TI en el servidor AlmaLinux"),
        ("7. PREPARACIÓN DEL SERVIDOR ALMALINUX", "Verificación, DNF upgrade, utilitarios, zona horaria y NTP"),
        ("8. INSTALACIÓN DE DOCKER ENGINE", "Descarte de Podman, repositorio oficial DNF y servicio systemd"),
        ("9. INSTALACIÓN Y VERIFICACIÓN DE DOCKER COMPOSE", "Plugin oficial Compose v2 y rotación de logs en daemon.json"),
        ("10. PREPARACIÓN Y OBTENCIÓN DEL PROYECTO", "Estructura en /opt/talento360, git clone y verificación de hash"),
        ("11. CONFIGURACIÓN DE VARIABLES DE ENTORNO", "Archivo .env seguro, permisos 600 y diccionario de variables"),
        ("12. CONFIGURACIÓN DE POSTGRESQL", "Motor PostgreSQL 16 Alpine, volúmenes y comprobación de salud"),
        ("13. PROTECCIÓN Y MIGRACIÓN DE DATOS EXISTENTES", "Prohibición de borrado, pg_dump, restauración y validación de censo"),
        ("14. DESPLIEGUE DE LOS SERVICIOS CON DOCKER COMPOSE", "Construcción, arranque desatendido y unidad systemd de autoarranque"),
        ("15. CONFIGURACIÓN DE NGINX Y FRONTEND", "API Gateway, seguridad OWASP, rate limiting y enrutamiento SPA"),
        ("16. RED, PUERTOS Y ACCESO INSTITUCIONAL", "Matriz de puertos, configuración firewalld, DNS interno y VPN"),
        ("17. CONFIGURACIÓN DE SEGURIDAD (HARDENING)", "SELinux Enforcing, seguridad de Docker, JWT, RBAC y HTTPS"),
        ("18. COPIAS DE SEGURIDAD Y RESTAURACIÓN", "Política 3-2-1, script automatizado, cron diario y simulacro DRP"),
        ("19. VERIFICACIÓN Y PUESTA EN FUNCIONAMIENTO", "Batería de pruebas de humo (Smoke Tests) y validación funcional"),
        ("20. ACTUALIZACIÓN Y MANTENIMIENTO", "Actualización segura sin downtime ni pérdida de BD, y rollback"),
        ("21. SOLUCIÓN DE PROBLEMAS FRECUENTES", "Matriz de 12 fallas comunes con diagnóstico y solución paso a paso"),
        ("22. RESPONSABILIDADES OPERATIVAS", "Matriz RACI entre Infraestructura TI y Equipo Técnico del aplicativo"),
        ("23. LISTA DE COMPROBACIÓN FINAL (CHECKLIST)", "Formato de chequeo previo a la firma de entrega a producción"),
        ("24. REFERENCIAS TÉCNICAS", "Normatividad, estándares oficiales y documentación de fabricantes"),
        ("ANEXO A: HOJA DE REFERENCIA RÁPIDA DE COMANDOS", "Guía ejecutiva de comandos para el administrador de AlmaLinux"),
        ("ANEXO B: MATRIZ INTEGRAL DE PUERTOS Y FLUJOS DE RED", "Flujograma y puertos de comunicación internos y externos"),
        ("ANEXO C: DICCIONARIO COMPLETO DE VARIABLES DE ENTORNO", "Tabla de referencia para configuración de producción"),
        ("ANEXO D: DIAGRAMA DE ARQUITECTURA DE CONTENEDORES", "Esquema de componentes contenerizados y volúmenes"),
        ("ANEXO E: PLAN DE RECUPERACIÓN ANTE DESASTRES (DRP)", "Procedimiento de contingencia y restauración total en servidor nuevo")
    ]

    add_styled_table(
        headers=["Capítulo / Sección", "Contenido Técnico"],
        rows=toc_data,
        col_widths=[2.4, 4.1]
    )

    add_page_break()

    print("Escribiendo Capítulos 1 a 6...")

    # ═════════════════════════════════════════════════════════════════════════
    # 1. INTRODUCCIÓN
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("1. INTRODUCCIÓN")
    add_p("La Gobernación de Boyacá, en cumplimiento de sus planes de desarrollo institucional y modernización de la gestión pública, ha diseñado e implementado Talento 360 como la plataforma tecnológica estratégica y centralizada para la administración integral del talento humano. El sistema articula la información de los servidores públicos de la planta central, resoluciones administrativas, comisiones de viáticos, esquemas especiales de jornada laboral y el sistema de gestión de seguridad y salud en el trabajo.")
    add_p("En observancia de los lineamientos de soberanía de datos, seguridad informática institucional y gobernanza tecnológica, la Dirección de Talento Humano y la Secretaría General han dispuesto el alojamiento de Talento 360 en servidores locales (on-premise) pertenecientes a la infraestructura tecnológica de la Gobernación de Boyacá, operando bajo la distribución empresarial AlmaLinux.")
    add_p("Este manual proporciona todas las directrices técnicas, instrucciones detalladas paso a paso, especificaciones de hardware y procedimientos de operación para que los administradores del área de Tecnología e Infraestructura desplieguen, aseguren, respalden y mantengan el aplicativo con total independencia técnica, garantizando en todo momento la integridad inalterable de la información institucional.")

    # ═════════════════════════════════════════════════════════════════════════
    # 2. OBJETIVO Y ALCANCE
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("2. OBJETIVO Y ALCANCE")
    
    add_h2("2.1. Objetivos del Documento")
    add_p("El documento persigue dos objetivos fundamentales y complementarios:")
    add_bullet("Establecer con rigor técnico las especificaciones de hardware, memoria, procesador, almacenamiento y conectividad que requiere el servidor institucional para operar Talento 360 de forma fluida, ágil y estable para una concurrencia estimada de 10 a 12 usuarios de oficina, evitando la solicitud de infraestructura exagerada, costosa o sobredimensionada.", bold_prefix="Objetivo 1 (Requerimientos del Servidor): ")
    add_bullet("Proveer una guía técnica exhaustiva, ordenada cronológicamente y verificable comando por comando, que describa cómo preparar el servidor AlmaLinux, instalar Docker y Docker Compose, configurar variables de entorno, asegurar PostgreSQL 16, restaurar los datos históricos institucionales, desplegar los contenedores y verificar la operación de Talento 360 sin requerir la intervención de los desarrolladores originales.", bold_prefix="Objetivo 2 (Manual de Instalación y Despliegue): ")

    add_h2("2.2. Alcance y Límites del Documento")
    add_p("El alcance del presente manual está estrictamente delimitado para optimizar su utilidad técnica en la Gobernación:")
    add_bullet("El procedimiento parte de un servidor que ya cuenta con AlmaLinux instalado, en red y con usuario administrativo habilitado por el equipo de TI.")
    add_bullet("No abarca quemado de imágenes ISO, creación de memorias USB de arranque, particionado inicial de discos durante el asistente Anaconda de AlmaLinux ni configuración gráfica del sistema operativo.")
    add_bullet("No es una guía de usuario final ni un manual de navegación para funcionarios; su alcance es estrictamente de administración de sistemas, infraestructura, bases de datos y DevOps.")

    # ═════════════════════════════════════════════════════════════════════════
    # 3. DESCRIPCIÓN TÉCNICA DE TALENTO 360
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("3. DESCRIPCIÓN TÉCNICA DE TALENTO 360")
    add_p("Talento 360 es una solución integral desarrollada específicamente para satisfacer las necesidades operativas, censales y normativas de la Dirección de Talento Humano de la Gobernación de Boyacá. La plataforma consolida seis módulos funcionales de misión crítica y tres subsistemas transversales de soporte:")

    add_h2("3.1. Módulos Funcionales de Misión Crítica")
    add_bullet("Administra el censo oficial de funcionarios, cargos, dependencias orgánicas, historias laborales, grados, salarios, cómputo dinámico de antigüedad laboral y categorización en planta (Carrera Administrativa, Libre Nombramiento, Provisionalidad, Encargos y Plazas Vacantes). Incluye el motor de importación masiva desde archivos Excel institucionales con cotejo automático y diagnóstico de inconsistencias.", bold_prefix="1. Módulo de Servidores Públicos: ")
    add_bullet("Gestiona el ciclo de vida de peticiones de funcionarios para el disfrute de vacaciones individuales, permisos remunerados y licencias ordinarias, con bandeja de aprobación para jefes de área y coordinadores de talento humano.", bold_prefix="2. Módulo de Solicitudes Administrativas: ")
    add_bullet("Controla el registro, radicación y validación de incapacidades médicas de origen común y laboral, vinculando soportes documentales en PDF y realizando el cómputo de prórrogas y alertas a EPS / ARL.", bold_prefix="3. Módulo de Incapacidades Médicas: ")
    add_bullet("Registra y liquida actos administrativos y resoluciones de comisiones de servicios dentro y fuera del departamento. Incorpora el catálogo municipal DIVIPOLA oficial de Boyacá y el catálogo nacional, normalización de duraciones, topes salariales por escala de decretos y carga masiva por paquetes presupuestales anuales.", bold_prefix="4. Módulo de Viáticos y Comisiones: ")
    add_bullet("Administra los acuerdos laborales de teletrabajo, trabajo en casa y jornadas laborales flexibles conforme a la legislación nacional, validando solapamientos temporales, vigencias activas y dependencias asignadas.", bold_prefix="5. Módulo de Horarios Especiales: ")
    add_bullet("Centraliza los registros de Seguridad y Salud en el Trabajo: Evaluaciones Médicas Ocupacionales (EMO de ingreso, periódicas y de egreso), dotación y entrega de Elementos de Protección Personal (EPP), matriz de riesgos y caracterización sociodemográfica.", bold_prefix="6. Módulo de Seguridad y Salud en el Trabajo (SST): ")

    add_h2("3.2. Subsistemas Transversales de Soporte")
    add_bullet("Servicio autónomo que gestiona el repositorio físico y persistente de documentos en disco, bandejas de entrada para digitalización y enrutamiento hacia trámites institucionales.", bold_prefix="Gestión Documental: ")
    add_bullet("Motor de consolidación analítica que produce tableros de mando ejecutivos en tiempo real y exporta reportes vectoriales en PDF de alta fidelidad con tipografía, escudos y colorimetría oficial de la Gobernación.", bold_prefix="Informes y Automatización: ")
    add_bullet("Consola técnica restringida para administradores que registra trazas de fallos, auditoría de eventos y bitácora de copias de seguridad generadas.", bold_prefix="Monitoreo de Errores y Respaldos: ")

    # ═════════════════════════════════════════════════════════════════════════
    # 4. ARQUITECTURA ACTUAL DEL SISTEMA
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("4. ARQUITECTURA ACTUAL DEL SISTEMA")
    add_p("La arquitectura técnica de Talento 360 se fundamenta en un modelo de microservicios desacoplados y contenerizados mediante Docker, comunicados internamente en una red privada virtual de tipo puente (bridge) denominada talento360_net. La capa de presentación está desacoplada de la lógica de negocio y se sirve a través de un servidor web Nginx que actúa simultáneamente como API Gateway y escudo de seguridad perimetral.")

    add_h2("4.1. Flujo de una Petición Institucional")
    add_p("El recorrido de cualquier solicitud efectuada por un usuario institucional sigue la siguiente trayectoria controlada:")
    add_p("1. Usuario en la Red de la Gobernación: Abre su navegador web (Chrome, Edge o Firefox) e ingresa la dirección IP local o nombre DNS interno del servidor (ej. http://10.0.1.50 o http://talento360.boyaca.gov.co).")
    add_p("2. Filtro Perimetral del Servidor AlmaLinux: El firewall del sistema operativo (firewalld) valida que la petición provenga de una interfaz de red autorizada y la encamina al puerto 80 (o 443 en HTTPS).")
    add_p("3. Gateway Nginx (Contenedor talento360_frontend): Recibe la conexión, aplica directivas de seguridad OWASP, valida límites de peticiones (rate limiting) y determina el destino:")
    add_bullet("Si la solicitud pide archivos estáticos (HTML, CSS, JS, imágenes institucionales), Nginx los entrega directamente desde memoria con tiempos de respuesta menores a 50 ms.")
    add_bullet("Si la solicitud es una llamada API (ej. /api/employees, /api/auth, /api/viaticos), Nginx actúa como proxy inverso y la enruta por la red interna Docker hacia el microservicio correspondiente en su puerto privado.")
    add_p("4. Capa de Microservicios Node.js: El microservicio específico autentica la petición mediante token criptográfico JWT, procesa la regla de negocio y ejecuta consultas parametrizadas contra la base de datos.")
    add_p("5. Capa de Datos (Contenedor talento360_db): PostgreSQL 16 procesa la consulta de forma transaccional sobre el volumen de almacenamiento persistente postgres_data y retorna los datos.")

    add_h2("4.2. Matriz de Componentes del Sistema en Producción")
    add_styled_table(
        headers=["Componente / Servicio", "Nombre del Contenedor", "Puerto Interno", "Tecnología Base", "Función Principal"],
        rows=[
            ["Frontend & Gateway", "talento360_frontend", "80 (Host: 80)", "Nginx 1.25 Alpine", "Punto único de entrada HTTP, entrega de SPA Vanilla JS y enrutador proxy inverso a microservicios."],
            ["Base de Datos", "talento360_db", "5432 (Aislado)", "PostgreSQL 16 Alpine", "Motor transaccional relacional con volumen persistente postgres_data y catálogo inicial database/."],
            ["Servicio de Autenticación", "talento360_auth", "3001 (Aislado)", "Node.js 20 Alpine / Express", "Control de sesiones, tokens JWT, hashing bcrypt y flujo de restablecimiento de contraseña."],
            ["Servicio de Empleados", "talento360_employees", "3002 (Aislado)", "Node.js 20 Alpine / Express", "Gestión censal de servidores públicos, importación masiva Excel y planta de cargos."],
            ["Servicio de Solicitudes", "talento360_requests", "3003 (Aislado)", "Node.js 20 Alpine / Express", "Recepción y seguimiento de solicitudes individuales de funcionarios."],
            ["Servicio de Trámites Admin", "talento360_admin_requests", "3004 (Aislado)", "Node.js 20 Alpine / Express", "Bandeja de aprobación administrativa de solicitudes, permisos e incapacidades."],
            ["Servicio de Viáticos", "talento360_viaticos", "3005 (Aislado)", "Node.js 20 Alpine / Express", "Liquidación de comisiones, paquetes presupuestales y catálogo DIVIPOLA."],
            ["Servicio de Dashboard", "talento360_dashboard", "3006 (Aislado)", "Node.js 20 Alpine / Express", "Consolidación de KPIs ejecutivos, reportes PDF vectoriales y consola de errores."],
            ["Servicio de Horarios", "talento360_horarios", "3007 (Aislado)", "Node.js 20 Alpine / Express", "Gestión de teletrabajo, trabajo en casa y jornadas laborales flexibles."],
            ["Servicio de SST", "talento360_sst", "3008 (Aislado)", "Node.js 20 Alpine / Express", "Exámenes médicos ocupacionales (EMO), entrega de EPP y caracterización de riesgos."],
            ["Servicio de Documentos", "talento360_documents", "3009 (Aislado)", "Node.js 20 Alpine / Express", "Custodia física de archivos adjuntos, radicación y almacenamiento en volúmenes."],
            ["Servicio de Informes", "talento360_reports", "3010 (Aislado)", "Node.js 20 Alpine / Express", "Automatización analítica, exportaciones avanzadas y reportes programados."]
        ],
        col_widths=[1.5, 1.4, 0.9, 1.3, 2.4]
    )

    add_callout(
        box_type="SECURITY",
        title="REGLA DE AISLAMIENTO DE CONTENEDORES EN RED",
        text="Obsérvese con rigor técnico que únicamente el contenedor 'talento360_frontend' (Nginx) publica su puerto hacia el exterior (puerto 80 del servidor). La base de datos PostgreSQL (5432) y los diez microservicios backend (3001 a 3010) NO deben publicarse en las interfaces de red del servidor; permanecen exclusivamente accesibles dentro de la red privada virtual Docker 'talento360_net'. Esto previene ataques directos contra el motor de datos o microservicios individuales."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 5. REQUERIMIENTOS DEL SERVIDOR (DIMENSIONAMIENTO JUSTIFICADO)
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("5. REQUERIMIENTOS DEL SERVIDOR INSTITUCIONAL")
    add_p("Uno de los objetivos esenciales de este documento es fijar un dimensionamiento de servidor técnicamente justificado, realista y costo-eficiente. Talento 360 atiende a la Dirección de Talento Humano de la Gobernación de Boyacá, cuya operación ordinaria involucra entre 10 y 12 funcionarios concurrentes utilizando el sistema de forma simultánea durante la jornada laboral.")
    add_p("Por tratarse de una arquitectura ligera basada en contenedores Alpine Linux y un frontend nativo sin frameworks pesados en cliente, el consumo basal del aplicativo es muy moderado. No se requiere infraestructura de cómputo de alta gama ni asignaciones desproporcionadas de almacenamiento.")

    add_h2("5.1. Cuadro Comparativo de Requerimientos de Hardware")
    add_styled_table(
        headers=["Recurso de Hardware", "Requisito Mínimo Absoluto", "Requisito Recomendado (TI)", "Justificación Técnica Institucional"],
        rows=[
            [
                "Procesador (CPU)",
                "2 vCPU (64 bits, x86_64)\nFrecuencia: >= 2.0 GHz",
                "4 vCPU (64 bits, x86_64)\nFrecuencia: >= 2.4 GHz",
                "Permite distribuir los 12 microservicios en hilos independientes. Con 4 vCPU, la generación de PDFs vectoriales e importaciones masivas de 700 servidores se procesa en segundo plano sin ralentizar la interfaz web."
            ],
            [
                "Memoria RAM",
                "4 GB RAM\n(DDR4 / ECC en servidor)",
                "8 GB RAM\n(DDR4 o DDR5 ECC)",
                "En reposo, los 12 contenedores consumen ~2.1 GB de RAM. 8 GB ofrece 5.9 GB de margen libre para caché de consultas de PostgreSQL (shared_buffers), carga de buffers de Excel y buffers del kernel de AlmaLinux."
            ],
            [
                "Almacenamiento en Disco",
                "40 GB SSD SATA",
                "80 GB SSD NVMe\n(o SSD Enterprise SATA)",
                "Proporciona velocidades de lectura/escritura > 2.000 MB/s para transacciones PostgreSQL. Espacio suficiente para SO, imágenes Docker, base de datos a 5 años, 15 GB de adjuntos y 20 GB de margen de seguridad."
            ],
            [
                "Arquitectura del CPU",
                "x86_64 (64 bits obligatorio)",
                "x86_64 (Intel Xeon / AMD EPYC)",
                "Las imágenes oficiales de PostgreSQL 16 y Node 20 para AlmaLinux están compiladas exclusivamente para arquitecturas de 64 bits."
            ],
            [
                "Conectividad de Red",
                "1 Interfaz de red Gigabit Ethernet (1 Gbps) cableada",
                "1 Gbps conectado a switch institucional con IP fija LAN",
                "El tráfico institucional es liviano (<15 MB/s). La conexión cableada previene desconexiones y caídas de sesión inherentes al Wi-Fi."
            ],
            [
                "Sistema Operativo",
                "AlmaLinux 8.9 / 8.10 (64 bits)",
                "AlmaLinux 9.4 / 9.5 (64 bits)\nKernel Enterprise 5.14+",
                "Distribución empresarial 1:1 binaria compatible con RHEL, con ciclo de soporte oficial hasta 2032, estabilidad demostrada y SELinux activo."
            ]
        ],
        col_widths=[1.5, 1.5, 1.5, 2.0]
    )

    add_h2("5.2. Desglose Detallado del Almacenamiento (80 GB Recomendados)")
    add_p("A continuación se demuestra técnicamente la distribución del espacio en disco solicitado para erradicar cualquier arbitrariedad:")
    add_styled_table(
        headers=["Rubro / Componente de Disco", "Espacio Inicial", "Proyección a 3 Años", "Descripción y Criterio de Conservación"],
        rows=[
            ["Sistema Operativo AlmaLinux 9", "6.5 GB", "10.0 GB", "Instalación mínima base, kernel Linux, paquetes DNF y librerías del sistema."],
            ["Imágenes Docker (12 servicios)", "3.2 GB", "5.0 GB", "Capas base de Alpine Linux, Node.js 20, PostgreSQL 16 y Nginx 1.25."],
            ["Contenedores y Capas de Escritura", "1.0 GB", "2.0 GB", "Metadatos de contenedores Docker y capas diferenciales de ejecución."],
            ["Base de Datos PostgreSQL (Datos)", "0.8 GB", "3.5 GB", "Censo de servidores, 7.000 viáticos históricos, horarios e índices B-tree optimizados."],
            ["Repositorio de Documentos Adjuntos", "3.0 GB", "15.0 GB", "Soportes de solicitudes, incapacidades médicas escaneadas y actas en PDF."],
            ["Archivos de Registro (Logs del Sistema)", "1.5 GB", "4.0 GB", "Logs de Nginx y contenedores con política de rotación automática estricta (max 20 MB)."],
            ["Espacio Temporal de Mantenimiento", "4.0 GB", "8.0 GB", "Directorio /tmp para generación transitoria de volcados pg_dump y respaldos locales."],
            ["Margen de Seguridad Operativa (Headroom)", "20.0 GB", "32.5 GB", "Reserva libre indispensable (>25%) para prevenir bloqueos de escritura en PostgreSQL."],
            ["TOTAL CONSOLIDADO", "40.0 GB", "80.0 GB", "Capacidad equilibrada que satisface el ciclo de vida sin sobrecostos en la Gobernación."]
        ],
        col_widths=[1.8, 1.0, 1.1, 2.6]
    )

    add_callout(
        box_type="WARN",
        title="DISTINCIÓN CRÍTICA ENTRE DISCO DEL SERVIDOR Y DISCO DE RESPALDOS",
        text="Los 80 GB solicitados corresponden al almacenamiento local del servidor productivo. Las copias de seguridad de largo plazo NO deben almacenarse en este mismo disco duro; deben transferirse automáticamente a un almacenamiento secundario externo (NAS institucional, servidor de almacenamiento de TI o almacenamiento seguro en nube de la Gobernación) bajo la política 3-2-1."
    )

    add_h2("5.3. Elementos Expresamente NO Requeridos")
    add_p("Para proteger el presupuesto público de la Gobernación de Boyacá y evitar adquisiciones injustificadas, se hace constar que Talento 360:")
    add_bullet("NO requiere tarjetas aceleradoras de video (GPU) dedicadas (NVIDIA / AMD), ya que no ejecuta tareas de renderizado 3D ni redes neuronales pesadas.", bold_prefix="Sin Tarjeta Gráfica (GPU): ")
    add_bullet("NO requiere modelos de lenguaje masivos (LLMs) locales ni servidores de inferencia de IA en el servidor institucional.", bold_prefix="Sin Infraestructura de Inteligencia Artificial Local: ")
    add_bullet("NO requiere almacenamiento inicial masivo (SAN o cabinas de discos de 500 GB o 1 TB); los 80 GB cubren plenamente la operación.", bold_prefix="Sin Cabinas de Almacenamiento Masivo: ")
    add_bullet("NO requiere licencias comerciales de software de virtualización ni de sistemas operativos propietarios (funciona 100% sobre software libre y de código abierto: AlmaLinux, Docker, PostgreSQL, Nginx).", bold_prefix="Cero Costo de Licenciamiento: ")

    add_h2("5.4. Capacidad de Crecimiento y Escalabilidad Futura")
    add_p("Si en el futuro la Gobernación decide incorporar más dependencias o habilitar el acceso a los 3.000 funcionarios del departamento para autoconsulta de desprendibles y certificaciones:")
    add_bullet("Escalamiento Vertical de RAM: Se podrá incrementar la memoria de 8 GB a 16 GB simplemente agregando un módulo físico o ampliando la asignación en la máquina virtual (hipervisor VMware / Proxmox / Hyper-V de la Gobernación).")
    add_bullet("Escalamiento de Almacenamiento de Documentos: El volumen Docker 'documents_data' podrá montarse sobre un punto de red NFS institucional de alta capacidad sin alterar el código de la aplicación.")
    add_bullet("Escalamiento de CPU: Se podrán asignar núcleos adicionales en el hipervisor sin necesidad de reinstalar AlmaLinux ni Docker.")

    # ═════════════════════════════════════════════════════════════════════════
    # 6. REQUISITOS PREVIOS A LA INSTALACIÓN
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("6. REQUISITOS PREVIOS A LA INSTALACIÓN")
    add_p("Antes de que el personal técnico proceda con la ejecución de los comandos descritos en este manual, la Dirección de Tecnología, Sistemas e Infraestructura de la Gobernación de Boyacá debe suministrar formalmente el servidor con las siguientes condiciones certificadas:")

    add_styled_table(
        headers=["Requisito Previo", "Estado Esperado", "Responsable de Entrega", "Método de Validación"],
        rows=[
            ["Servidor con AlmaLinux 9", "Instalado y booteable en modo texto (multi-user.target)", "Infraestructura TI", "cat /etc/almalinux-release"],
            ["Acceso Administrativo", "Usuario ordinario institucional con privilegios sudo habilitados (ej: sysadmin)", "Infraestructura TI", "sudo -v (validar clave sin error)"],
            ["Conectividad de Red LAN", "Tarjeta de red Ethernet conectada con cable categoría 6 al switch corporativo", "Redes y Telecomunicaciones", "ping -c 3 8.8.8.8 o gateway"],
            ["Dirección IP Fija", "IP estática reservada en el servidor DHCP o asignada estáticamente en /etc/NetworkManager", "Redes TI", "ip addr show"],
            ["Acceso a Internet Temporal", "Salida HTTP/HTTPS permitida durante la ventana de mantenimiento para descargar paquetes", "Seguridad Perimetral TI", "curl -I https://download.docker.com"],
            ["Servicio SSH Activo", "Daemon OpenSSH escuchando en puerto 22 (o puerto asignado por política de TI)", "Infraestructura TI", "systemctl status sshd"],
            ["Terminal de Gestión", "Computador del administrador con cliente SSH (PowerShell, PuTTY o Terminal Linux)", "Administrador Ejecutor", "ssh usuario@<IP_SERVIDOR>"]
        ],
        col_widths=[1.5, 1.9, 1.4, 1.7]
    )

    add_page_break()

    print("Escribiendo Capítulos 7 a 12...")

    # ═════════════════════════════════════════════════════════════════════════
    # 7. PREPARACIÓN DEL SERVIDOR ALMALINUX
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("7. PREPARACIÓN DEL SERVIDOR ALMALINUX")
    add_p("En este capítulo se describe la secuencia estricta de comandos que debe ejecutar el administrador tras conectarse por primera vez al servidor institucional para preparar el entorno de ejecución.")

    add_h2("7.1. Verificación del Entorno y Recursos de Hardware")
    add_p("Compruebe que el servidor cumple con las especificaciones mínimas de sistema operativo, procesador, memoria y almacenamiento:")

    add_terminal_block(
        command="cat /etc/os-release && uname -m",
        description="Verifica la distribución oficial de AlmaLinux y confirma que la arquitectura del procesador sea de 64 bits (x86_64).",
        expected_output="NAME=\"AlmaLinux\"\nVERSION=\"9.4 (Seafoam Ocelot)\"\nID=\"almalinux\"\nID_LIKE=\"rhel centos fedora\"\nx86_64",
        validation="La arquitectura DEBE ser estrictamente 'x86_64'. Si aparece 'i686' o procesador de 32 bits, el servidor debe ser reemplazado.",
        error_handling="Si la distribución es distinta a AlmaLinux 8 o 9, consulte a TI antes de continuar."
    )

    add_terminal_block(
        command=r"lscpu | grep -E 'Model name|CPU\(s\):'",
        description="Muestra el número de núcleos de CPU disponibles en el equipo.",
        expected_output="CPU(s):                           4\nModel name:                       Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz",
        validation="Confirme que el valor de CPU(s) sea al menos 2 (recomendado 4).",
        error_handling="Si tiene 1 sola vCPU, solicite ampliación de núcleos a TI en la máquina virtual."
    )

    add_terminal_block(
        command="free -h",
        description="Evalúa la memoria RAM física instalada y disponible en el sistema.",
        expected_output="               total        used        free      shared  buff/cache   available\nMem:           7.6Gi       650Mi       6.1Gi        12Mi       850Mi       6.9Gi\nSwap:          4.0Gi          0B       4.0Gi",
        validation="El campo 'total' de 'Mem' debe registrar al menos 3.8Gi (para 4 GB) o 7.5Gi (para 8 GB).",
        error_handling="Si la memoria es menor a 4 GB, la base de datos y microservicios colapsarán por OOM (Out Of Memory)."
    )

    add_terminal_block(
        command="df -h /",
        description="Verifica el espacio disponible en la partición raíz donde se alojará el aplicativo y Docker.",
        expected_output="Filesystem             Size  Used Avail Use% Mounted on\n/dev/mapper/alma-root   75G  4.2G   71G   6% /",
        validation="El campo 'Avail' debe ser superior a 35 GB (idealmente >= 70 GB en disco de 80 GB).",
        error_handling="Si el espacio libre es menor a 25 GB, libere particiones o solicite redimensionamiento del volumen LVM a TI."
    )

    add_h2("7.2. Actualización del Sistema Operativo con DNF")
    add_p("Aplique las últimas actualizaciones de seguridad y corrección de errores del repositorio oficial de AlmaLinux:")

    add_terminal_block(
        command="sudo dnf check-update ; sudo dnf upgrade -y",
        description="Sincroniza los metadatos de los repositorios de AlmaLinux y actualiza todos los paquetes del sistema a la última versión estable sin intervención interactiva.",
        expected_output="Upgraded: ...\nComplete!",
        validation="El comando debe finalizar con el mensaje 'Complete!' y código de salida 0.",
        error_handling="Si se actualizó el kernel de Linux (paquete 'kernel'), se recomienda reiniciar el equipo mediante 'sudo reboot' antes de continuar."
    )

    add_h2("7.3. Instalación de Herramientas Utilitarias y Diagnóstico")
    add_terminal_block(
        command="sudo dnf install -y curl wget git tar gzip bzip2 vim bash-completion policycoreutils-python-utils util-linux htop net-tools",
        description="Instala utilitarios indispensables para gestión de repositorios Git, manejo de archivos comprimidos, utilidades SELinux y monitoreo de procesos.",
        expected_output="Complete!",
        validation="Ejecute 'git --version' para comprobar que Git se instaló satisfactoriamente (versión 2.39+ o 2.43+).",
        error_handling="Si falla por problemas de red, verifique la configuración de proxy institucional o DNS en /etc/resolv.conf."
    )

    add_h2("7.4. Configuración de Zona Horaria Oficial y Sincronización NTP")
    add_p("Para que los sellos de tiempo de auditoría, las resoluciones de viáticos y los acuerdos de horarios coincidan con la hora legal de Colombia:")

    add_terminal_block(
        command="sudo timedatectl set-timezone America/Bogota && sudo systemctl enable --now chronyd",
        description="Establece la zona horaria 'America/Bogota' (UTC-5) y asegura que el daemon chrony mantenga la sincronización de reloj con servidores NTP.",
        expected_output="Time zone: America/Bogota (COT, -0500)\nNTP service: active",
        validation="Ejecute 'timedatectl' y verifique que 'Time zone' sea 'America/Bogota' y 'System clock synchronized' sea 'yes'.",
        error_handling="Si NTP está bloqueado, verifique con TI que el puerto UDP 123 esté permitido en la red institucional."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 8. INSTALACIÓN DE DOCKER ENGINE EN ALMALINUX
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("8. INSTALACIÓN DE DOCKER ENGINE")
    add_p("Docker Engine es el motor de contenerización que ejecuta Talento 360 de forma aislada e inmutable. En las distribuciones de la familia Enterprise Linux (como AlmaLinux 9), el gestor de paquetes DNF puede incluir por defecto la herramienta Podman. Es imperativo seguir el procedimiento oficial para habilitar el repositorio de Docker CE.")

    add_h2("8.1. Verificación y Descarte de Conflictos Previos")
    add_terminal_block(
        command="sudo dnf remove -y podman buildah runc 2>/dev/null || true",
        description="Retira paquetes de Podman o versiones antiguas de runc que puedan causar conflictos de dependencias o colisiones de socket con Docker CE.",
        expected_output="Complete! (o mensaje indicando que no estaban instalados)",
        validation="Ejecute 'which podman 2>/dev/null' y verifique que no retorne binarios activos.",
        error_handling="Si el servidor ya utilizaba Podman para otros sistemas de la Gobernación, NO ejecute este comando; consulte a TI."
    )

    add_h2("8.2. Adición del Repositorio Oficial de Docker CE")
    add_terminal_block(
        command="sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo",
        description="Registra la fuente de paquetes oficial de Docker Engine mantenida para distribuciones compatibles con RHEL/CentOS/AlmaLinux 9.",
        expected_output="Adding repo from: https://download.docker.com/linux/centos/docker-ce.repo",
        validation="Compruebe la existencia del archivo '/etc/yum.repos.d/docker-ce.repo'.",
        error_handling="Si falla la descarga por HTTPS, verifique la conectividad con el sitio download.docker.com."
    )

    add_h2("8.3. Instalación de Docker CE, CLI y Containerd")
    add_terminal_block(
        command="sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
        description="Descarga e instala el daemon de Docker, la interfaz de línea de comandos, el runtime containerd y los plugins modernos de compilación y Compose v2.",
        expected_output="Installed: docker-ce... docker-compose-plugin...\nComplete!",
        validation="Ejecute 'rpm -qa | grep docker' y verifique los 5 paquetes instalados.",
        error_handling="Si DNF reporta 'package conflict', use la bandera '--allowerasing': 'sudo dnf install -y --allowerasing docker-ce...'."
    )

    add_h2("8.4. Habilitación y Puesta en Marcha del Servicio Docker")
    add_terminal_block(
        command="sudo systemctl enable --now docker",
        description="Inicia inmediatamente el daemon de Docker y crea los enlaces simbólicos de systemd para que arranque automáticamente en cada reinicio del servidor.",
        expected_output="Created symlink /etc/systemd/system/multi-user.target.wants/docker.service -> /usr/lib/systemd/system/docker.service.",
        validation="Ejecute 'sudo systemctl is-active docker' (debe responder 'active') y 'sudo systemctl is-enabled docker' (debe responder 'enabled').",
        error_handling="Si el servicio falla en iniciar, examine los logs con 'sudo journalctl -u docker.service -n 50'."
    )

    add_h2("8.5. Verificación de Versiones y Diagnóstico Operativo")
    add_terminal_block(
        command="sudo docker --version && sudo docker info | grep -E 'Server Version|Storage Driver'",
        description="Comprueba que el motor de Docker esté plenamente operativo con el almacenamiento overlay2 nativo de AlmaLinux.",
        expected_output="Docker version 26.1.x, build ...\n Server Version: 26.1.x\n Storage Driver: overlay2",
        validation="El Storage Driver DEBE ser 'overlay2'.",
        error_handling="Si no aparece overlay2, revise la configuración de módulos de kernel en AlmaLinux."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 9. INSTALACIÓN DE DOCKER COMPOSE
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("9. INSTALACIÓN Y VERIFICACIÓN DE DOCKER COMPOSE")
    add_p("Docker Compose v2 se instaló como un plugin binario oficial de Docker ('docker compose') en el paso anterior. En la arquitectura actual de Talento 360, no se utiliza el script obsoleto en Python ('docker-compose v1').")

    add_terminal_block(
        command="docker compose version",
        description="Verifica que el comando Compose v2 esté accesible globalmente.",
        expected_output="Docker Compose version v2.27.x (o superior)",
        validation="El comando debe retornar versión 2.x o superior. Todo comando del manual debe escribirse con espacio: 'docker compose', NUNCA con guión.",
        error_handling="Si el sistema indica 'compose is not a docker command', reinstale: 'sudo dnf install -y docker-compose-plugin'."
    )

    add_h2("9.1. Configuración de Rotación de Logs de Contenedores en /etc/docker/daemon.json")
    add_p("Por defecto, Docker almacena los logs de salida estándar (stdout/stderr) de los contenedores indefinidamente, lo cual puede llenar el disco duro con el transcurso de los meses. Configure una política de rotación automática institucional creando el archivo de configuración:")

    add_terminal_block(
        command="sudo tee /etc/docker/daemon.json << 'EOF'\n{\n  \"log-driver\": \"json-file\",\n  \"log-opts\": {\n    \"max-size\": \"20m\",\n    \"max-file\": \"3\"\n  },\n  \"live-restore\": true\n}\nEOF\nsudo systemctl reload docker",
        description="Limita el tamaño máximo de archivo de log a 20 MB con un histórico de 3 archivos rotados por contenedor (máximo 60 MB por servicio). Habilita 'live-restore' para mantener contenedores activos durante reinicios del daemon.",
        expected_output="Archivos generados y daemon recargado exitosamente.",
        validation="Verifique con 'sudo docker info | grep -i logging'. Debe mostrar 'Logging Driver: json-file'.",
        error_handling="Asegúrese de respetar el formato JSON estricto; comas sobrantes impedirán el reinicio del daemon."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 10. PREPARACIÓN Y OBTENCIÓN DEL PROYECTO
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("10. PREPARACIÓN Y OBTENCIÓN DEL PROYECTO")
    add_p("Para mantener el orden conforme a los estándares de la Filesystem Hierarchy Standard (FHS) de Linux y las directrices de seguridad de la Gobernación, todo el código y archivos operativos de Talento 360 se alojarán bajo la ruta institucional estándar /opt/talento360.")

    add_h2("10.1. Creación del Directorio de Instalación con Permisos Restringidos")
    add_terminal_block(
        command="sudo mkdir -p /opt/talento360 && sudo chown -R $USER:$USER /opt/talento360 && cd /opt/talento360",
        description="Crea la carpeta /opt/talento360 y asigna la propiedad al usuario administrador actual para operar sin necesidad de usar root de forma indiscriminada.",
        expected_output="(Directorio creado sin mensajes de error)",
        validation="Ejecute 'pwd' y confirme encontrarse en '/opt/talento360'.",
        error_handling="Si recibe 'Permission denied', verifique que su usuario tenga permisos en sudoers."
    )

    add_h2("10.2. Descarga del Código Fuente Oficial desde el Repositorio Institucional")
    add_terminal_block(
        command="git clone https://github.com/JuanEstebanSilva/talentoHumano360.git /opt/talento360",
        description="Clona el repositorio Git con el árbol completo de servicios, frontend, migraciones SQL de base de datos y scripts de despliegue.",
        expected_output="Cloning into '/opt/talento360'...\nResolving deltas: 100% ... done.",
        validation="Ejecute 'ls -la /opt/talento360' y confirme la presencia de las carpetas 'database', 'web', 'deploy' y 'docs'.",
        error_handling="Si el comando falla por autenticación en repositorios privados, utilice un Personal Access Token (PAT) o despliegue con clave SSH."
    )

    add_h2("10.3. Selección de la Rama Estable y Verificación del Commit")
    add_terminal_block(
        command="cd /opt/talento360 && git checkout main && git log -1 --format=\"Commit: %H%nFecha:  %cd%nAutor:  %an%nMensaje: %s\"",
        description="Se sitúa en la rama oficial de producción 'main' y comprueba el último commit desplegado para auditoría institucional.",
        expected_output="Commit: <HASH_COMMIT_OFICIAL>\nFecha:  ...\nMensaje: ...",
        validation="Registre en el acta de instalación de TI el código hash de 40 caracteres del commit desplegado.",
        error_handling="Asegúrese de encontrarse en la rama 'main' sin cambios locales pendientes ('git status')."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 11. CONFIGURACIÓN DE VARIABLES DE ENTORNO
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("11. CONFIGURACIÓN DE VARIABLES DE ENTORNO")
    add_p("Las variables de entorno gobiernan la conexión a la base de datos PostgreSQL, la clave criptográfica de firma JWT, las credenciales SMTP de correo electrónico y las rutas de almacenamiento de documentos. El archivo se ubica estrictamente en /opt/talento360/web/.env y NUNCA debe incluirse en el control de versiones de Git ni exponerse públicamente.")

    add_h2("11.1. Creación y Blindaje de Permisos del Archivo .env")
    add_terminal_block(
        command="cd /opt/talento360/web\ncp .env.example .env 2>/dev/null || touch .env\nchmod 600 .env",
        description="Genera el archivo .env de producción a partir de la plantilla y asigna permisos 600 (solo lectura y escritura para el usuario propietario; prohibido para los demás usuarios del sistema).",
        expected_output="(Permisos aplicados sin errores)",
        validation="Ejecute 'ls -la .env' y valide que los permisos sean exactamente '-rw-------'.",
        error_handling="Si el archivo tiene permisos 777 o 644, la seguridad de la base de datos estará comprometida."
    )

    add_h2("11.2. Diccionario de Variables de Entorno de Producción")
    add_p("El personal de TI debe editar el archivo '.env' con 'nano' o 'vim' y reemplazar los marcadores de ejemplo con los valores institucionales acordados:")

    add_styled_table(
        headers=["Variable de Entorno", "Componente Afectado", "Obligatoria", "Ejemplo de Formato Seguro / Valor Recomendado", "Propósito y Descripción"],
        rows=[
            ["POSTGRES_DB", "PostgreSQL y Microservicios", "SÍ", "talento360", "Nombre de la base de datos relacional de Talento Humano."],
            ["POSTGRES_USER", "PostgreSQL y Microservicios", "SÍ", "postgres", "Usuario de acceso al motor de base de datos."],
            ["POSTGRES_PASSWORD", "PostgreSQL y Microservicios", "SÍ", "<CLAVE_SEGURA_GENERADA_TI_POSTGRES>", "Contraseña alfanumérica robusta de al menos 20 caracteres."],
            ["POSTGRES_PORT", "PostgreSQL y Host", "SÍ", "5432:5432 (o interno)", "Mapeo de puerto del motor de datos."],
            ["JWT_SECRET", "auth-service y Gateways", "SÍ", "<SECRETO_CRIPTOGRAFICO_HEX_64_CHARS>", "Clave criptográfica para firmar y validar tokens JWT institucionales."],
            ["JWT_EXPIRES_IN", "auth-service", "SÍ", "8h", "Tiempo de vigencia de la sesión del usuario (8 horas laborales)."],
            ["NODE_ENV", "Todos los Microservicios", "SÍ", "production", "Habilita optimizaciones de rendimiento y oculta trazas de error técnicas."],
            ["SMTP_HOST", "auth y admin-requests", "NO", "smtp.gmail.com (o mail.boyaca.gov.co)", "Servidor de correo institucional para notificaciones automáticas."],
            ["SMTP_PORT", "auth y admin-requests", "NO", "587 (TLS) o 465 (SSL)", "Puerto de comunicación del servidor de correo."],
            ["SMTP_USER", "auth y admin-requests", "NO", "talento360.notificaciones@gmail.com", "Cuenta de correo institucional emisora."],
            ["SMTP_PASS", "auth y admin-requests", "NO", "<APP_PASSWORD_GENERADA_TI>", "Clave de aplicación o contraseña de servicio de correo."],
            ["MAIL_FROM", "auth y admin-requests", "NO", "Talento 360 <notificaciones@boyaca.gov.co>", "Encabezado del remitente mostrado en el buzón del funcionario."],
            ["DOCUMENTS_STORAGE_DIR", "documents-service", "SÍ", "/data/documentos", "Ruta interna dentro del contenedor para almacenamiento de adjuntos."],
            ["DOCUMENTS_INBOX_DIR", "documents-service", "SÍ", "/data/bandeja", "Ruta interna para recepción y procesamiento de archivos."],
            ["ALLOWED_ORIGINS", "server.js / Nginx", "SÍ", "http://10.0.1.50,http://talento360.boyaca.gov.co", "Orígenes permitidos para consumo de API y control CORS."],
            ["APP_PUBLIC_URL", "admin-requests-service", "SÍ", "http://talento360.boyaca.gov.co (o IP local)", "URL base utilizada en correos electrónicos para enlaces de trámites."]
        ],
        col_widths=[1.5, 1.2, 0.7, 1.8, 1.3]
    )

    add_callout(
        box_type="SECURITY",
        title="GENERACIÓN SEGURA DE CONTRASEÑAS Y SECRETO JWT",
        text="Para generar una contraseña de base de datos y un JWT_SECRET criptográficamente seguros en la misma terminal de AlmaLinux, ejecute:\n$ openssl rand -hex 32\nCopie el valor de 64 caracteres generado y asígnelo a JWT_SECRET y POSTGRES_PASSWORD en el archivo .env."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 12. CONFIGURACIÓN DE POSTGRESQL
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("12. CONFIGURACIÓN DE POSTGRESQL")
    add_p("El motor de base de datos oficial de Talento 360 es PostgreSQL 16 Alpine ejecutado en el contenedor denominado talento360_db. La arquitectura asegura la persistencia total de los registros a través de un volumen administrado por Docker llamado postgres_data, el cual reside físicamente en /var/lib/docker/volumes/postgres_data/_data.")

    add_h2("12.1. Aislamiento y Política de Reinicio")
    add_p("El contenedor se define con la directiva 'restart: unless-stopped', garantizando que el motor de base de datos se mantenga siempre encendido y sobreviva a reinicios accidentales del hardware o del servicio Docker.")
    add_p("Asimismo, el contenedor cuenta con un mecanismo de comprobación de salud interno (Healthcheck) que ejecuta cada 10 segundos el binario 'pg_isready -U postgres'. Ningún microservicio intentará conectarse a la base de datos hasta que el contenedor alcance el estado 'healthy'.")

    add_h2("12.2. Inicialización Automática de Esquemas")
    add_p("En el archivo 'web/docker-compose.yml', el directorio '../database' está montado como solo lectura en '/docker-entrypoint-initdb.d:ro'. Cuando la base de datos arranca por primera vez sobre un volumen vacío, PostgreSQL ejecuta automáticamente todos los scripts SQL de inicialización en orden alfabético estricto (01_schema.sql hasta 44_clean_servidores_publicos_deploy_v3.sql).")

    add_page_break()

    print("Escribiendo Capítulos 13 a 18...")

    # ═════════════════════════════════════════════════════════════════════════
    # 13. PROTECCIÓN Y MIGRACIÓN DE DATOS EXISTENTES
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("13. PROTECCIÓN Y MIGRACIÓN DE DATOS EXISTENTES")
    add_p("Este apartado reviste la máxima prioridad institucional. Talento 360 ya cuenta con información histórica, registros laborales, viáticos liquidados y cuentas de usuario en producción. Está terminantemente prohibido tratar la instalación en el servidor institucional como una autorización para borrar o reinicializar datos.")

    add_h2("13.1. Escenario A: Instalación Inicial Limpia (Solo si TI lo autoriza)")
    add_p("Aplica única y exclusivamente cuando la Gobernación de Boyacá autoriza de forma expresa comenzar con una base de datos virgen para pruebas de homologación. En este caso, el arranque estándar de Docker Compose crea las tablas base sin registros previos.")

    add_h2("13.2. Escenario B: Traslado y Migración de la Base de Datos Existente")
    add_p("Es el procedimiento obligatorio para poner en marcha el servidor institucional conservando la totalidad de la historia laboral de la Gobernación. Siga estrictamente los siguientes pasos:")

    add_h3("Paso 1: Generación del Volcado Binario Seguro en el Servidor de Origen")
    add_terminal_block(
        command="pg_dump -h <HOST_ORIGEN> -U postgres -d talento360 -Fc -v -f /tmp/talento360_respaldo_origen_$(date +%Y%m%d_%H%M%S).dump",
        description="Genera un respaldo binario completo con compresión personalizada (-Fc), preservando esquemas, tablas, índices, secuencias, funciones y datos.",
        expected_output="pg_dump: saving database definition...\npg_dump: complete!",
        validation="Valide el tamaño del archivo con 'ls -lh /tmp/*.dump'. Debe tener un tamaño superior a 5 MB.",
        error_handling="Si falla por conexión, valide la IP del servidor origen y las credenciales en pg_hba.conf."
    )

    add_h3("Paso 2: Comprobación de Integridad y Lectura del Respaldo")
    add_terminal_block(
        command="pg_restore -l /tmp/talento360_respaldo_origen_*.dump | head -n 30",
        description="Lista la tabla de contenido interna del archivo de volcado para verificar que no esté truncado o corrupto antes de moverlo.",
        expected_output="; Archive created at ...\n;     Database: talento360\n; ... TOC Entries ...",
        validation="Debe listar las tablas 'personas', 'rel_principal', 'viaticos', 'horarios', etc.",
        error_handling="Si arroja 'archiver: not a valid archive', vuelva a generar el volcado de origen."
    )

    add_h3("Paso 3: Transferencia Segura del Archivo hacia el Servidor AlmaLinux")
    add_terminal_block(
        command="scp /tmp/talento360_respaldo_origen_*.dump admin-talento@<IP_ALMALINUX>:/tmp/",
        description="Transfiere el archivo mediante canal SSH cifrado hacia el directorio /tmp del nuevo servidor institucional.",
        expected_output="talento360_respaldo_... 100% 8.5MB 15.2MB/s 00:00",
        validation="Verifique en el servidor AlmaLinux con 'ls -la /tmp/*.dump'.",
        error_handling="Verifique que el firewall de AlmaLinux permita conexiones SSH entrantes."
    )

    add_h3("Paso 4: Restauración Controlada dentro del Contenedor PostgreSQL")
    add_terminal_block(
        command="cd /opt/talento360/web\ncat /tmp/talento360_respaldo_origen_*.dump | docker compose exec -T postgres pg_restore -U postgres -d talento360 -v --clean --if-exists",
        description="Introduce el flujo binario dentro del contenedor 'talento360_db' y restaura la estructura y registros garantizando consistencia transaccional.",
        expected_output="pg_restore: processing data for table ...\npg_restore: processing foreign keys ...",
        validation="El comando finaliza sin errores fatales de violación de esquema.",
        error_handling="Asegúrese de que el contenedor 'postgres' esté encendido y en estado 'healthy' antes de ejecutar el comando."
    )

    add_h2("13.3. Tabla de Control de Auditoría del Censo Institucional")
    add_p("Una vez finalizada la restauración, ejecute las consultas SQL de control para comprobar que las cantidades de registros coinciden de forma exacta con el censo histórico oficial de la Gobernación de Boyacá:")

    add_styled_table(
        headers=["Entidad / Tabla Institucional", "Cifra de Auditoría de Origen", "Cantidad Obtenida en Destino", "Estado de Validación"],
        rows=[
            ["Servidores Públicos Activos / Censo", "708 servidores", "708 servidores", "CONFORME (100% Integridad)"],
            ["Cargos Institucionales de Planta", "73 cargos oficiales", "73 cargos oficiales", "CONFORME (100% Integridad)"],
            ["Dependencias Orgánicas de Gobernación", "107 dependencias", "107 dependencias", "CONFORME (100% Integridad)"],
            ["Estados Administrativos y Clasificaciones", "1.868 registros", "1.868 registros", "CONFORME (100% Integridad)"],
            ["Acuerdos Laborales de Jornada (Horarios)", "135 acuerdos", "135 acuerdos", "CONFORME (100% Integridad)"],
            ["Historial de Acuerdos de Horarios", "135 registros", "135 registros", "CONFORME (100% Integridad)"],
            ["Viáticos y Comisiones Liquidadas", "6.799 comisiones", "6.799 comisiones", "CONFORME (100% Integridad)"],
            ["Historial de Trazabilidad de Viáticos", "6.799 registros", "6.799 registros", "CONFORME (100% Integridad)"],
            ["Paquetes Presupuestales Anuales", "7 paquetes (2022-2025)", "7 paquetes (2022-2025)", "CONFORME (100% Integridad)"],
            ["Cuentas de Usuario y Roles RBAC", "14 usuarios", "14 usuarios", "CONFORME (100% Integridad)"],
            ["Catálogo Territorial DIVIPOLA Boyacá", "1.122 registros", "1.122 registros", "CONFORME (100% Integridad)"]
        ],
        col_widths=[2.4, 1.4, 1.4, 1.3]
    )

    add_terminal_block(
        command="docker compose -f /opt/talento360/web/docker-compose.yml exec -T postgres psql -U postgres -d talento360 -c \"SELECT 'personas' as tabla, count(*) FROM personas UNION ALL SELECT 'cargos', count(*) FROM cargos UNION ALL SELECT 'dependencias', count(*) FROM dependencias UNION ALL SELECT 'horarios', count(*) FROM horarios UNION ALL SELECT 'viaticos', count(*) FROM viaticos;\"",
        description="Consulta SQL directa de auditoría para verificar los totales restaurados en las tablas maestras.",
        expected_output="    tabla     | count \n--------------+-------\n personas     |   708\n cargos       |    73\n dependencias |   107\n horarios     |   135\n viaticos     |  6799",
        validation="Los valores retornados deben coincidir con la tabla anterior.",
        error_handling="Si alguna tabla presenta valor 0, la restauración falló; repita el Paso 4 con el volcado binario."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 14. DESPLIEGUE DE LOS SERVICIOS CON DOCKER COMPOSE
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("14. DESPLIEGUE DE LOS SERVICIOS")
    add_p("Con las variables de entorno configuradas y la base de datos lista, se procede al levantamiento coordinado de los 12 contenedores que componen Talento 360.")

    add_h2("14.1. Procedimiento de Construcción y Puesta en Marcha")
    add_terminal_block(
        command="cd /opt/talento360/web && docker compose config",
        description="Valida sintácticamente el archivo docker-compose.yml y la sustitución de variables del archivo .env.",
        expected_output="(Muestra la configuración YAML consolidada sin advertencias ni errores de sintaxis)",
        validation="El comando debe finalizar con código de salida 0 sin advertencias de variables no declaradas.",
        error_handling="Si reporta error en una variable, revise que el archivo .env no contenga saltos de línea incorrectos."
    )

    add_terminal_block(
        command="cd /opt/talento360/web && docker compose build",
        description="Compila las imágenes locales de los microservicios y del frontend Nginx a partir de sus respectivos Dockerfiles en Alpine Linux.",
        expected_output="[+] Building ... FINISHED\n => => naming to docker.io/library/web-frontend ... done",
        validation="Ejecute 'docker images | grep talento360' y valide la presencia de las imágenes compiladas.",
        error_handling="Si falla la instalación de paquetes npm, compruebe que el servidor tenga acceso a registry.npmjs.org."
    )

    add_terminal_block(
        command="cd /opt/talento360/web && docker compose up -d",
        description="Crea la red virtual talento360_net, monta los volúmenes persistentes y levanta los 12 contenedores en segundo plano respetando las dependencias de arranque.",
        expected_output="[+] Running 13/13\n ✔ Network web_talento360_net       Created\n ✔ Container talento360_db          Healthy\n ✔ Container talento360_auth        Started\n ...\n ✔ Container talento360_frontend    Started",
        validation="Ejecute 'docker compose ps' y confirme que los 12 contenedores figuren con estado 'Up'.",
        error_handling="Si un contenedor queda en 'Restarting', inspeccione sus logs con 'docker compose logs <nombre_servicio>'."
    )

    add_h2("14.2. Configuración de Inicio Automático del Sistema con Systemd")
    add_p("Para garantizar que la plataforma Talento 360 arranque de forma autónoma cada vez que el servidor físico o virtual se encienda o reinicie, configure una unidad de servicio systemd institucional:")

    add_terminal_block(
        command="sudo tee /etc/systemd/system/talento360.service << 'EOF'\n[Unit]\nDescription=Servicio Integral Talento 360 (Gobernacion de Boyaca)\nAfter=docker.service network-online.target\nRequires=docker.service\n\n[Service]\nType=oneshot\nRemainAfterExit=yes\nWorkingDirectory=/opt/talento360/web\nExecStart=/usr/bin/docker compose up -d\nExecStop=/usr/bin/docker compose stop\nTimeoutStartSec=300\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsudo systemctl daemon-reload && sudo systemctl enable talento360.service",
        description="Crea el servicio del sistema 'talento360.service' en systemd y lo habilita para el arranque automático tras el inicio del daemon Docker.",
        expected_output="Created symlink /etc/systemd/system/multi-user.target.wants/talento360.service ...",
        validation="Verifique con 'sudo systemctl is-enabled talento360.service'. Debe responder 'enabled'.",
        error_handling="Asegúrese de que la ruta /usr/bin/docker sea la correcta en AlmaLinux (compruebe con 'which docker')."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 15. CONFIGURACIÓN DE NGINX Y FRONTEND
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("15. CONFIGURACIÓN DE NGINX Y FRONTEND")
    add_p("El contenedor 'talento360_frontend' utiliza Nginx 1.25 Alpine y cumple dos roles simultáneos de vital importancia:")
    add_bullet("Servidor Web Estático: Aloja la Single Page Application (SPA) construida en HTML5, CSS3 institucional y JavaScript nativo ubicada en 'web/frontend/src'. No requiere Node.js en cliente ni transpiladores pesados.")
    add_bullet("API Gateway y Reverse Proxy: Intercepta todas las peticiones con prefijo '/api/' y las redirige hacia el microservicio backend respectivo a través de la directiva 'proxy_pass http://<nombre_servicio>:<puerto>'.")

    add_h2("15.1. Cabeceras HTTP de Seguridad Implementadas")
    add_p("El archivo 'web/frontend/nginx.conf' ya cuenta con endurecimiento perimetral alineado con el estándar OWASP ASVS:")
    add_bullet("X-Frame-Options \"SAMEORIGIN\": Previene ataques de Clickjacking impidiendo que la aplicación sea embebida en iframes externos.", bold_prefix="Protección de Marcos: ")
    add_bullet("X-Content-Type-Options \"nosniff\": Bloquea ataques de confusión de tipo MIME en el navegador.", bold_prefix="Detección de Tipos MIME: ")
    add_bullet("Referrer-Policy \"strict-origin-when-cross-origin\": Protege la privacidad de las rutas institucionales.", bold_prefix="Política de Referencia: ")
    add_bullet("Content-Security-Policy (CSP): Restringe la carga de scripts, fuentes e imágenes a fuentes confiables.", bold_prefix="Política de Contenido: ")
    add_bullet("Rate Limiting: Zona 'auth_limit' a 120 req/min para prevenir ataques de fuerza bruta en el login y 'api_general' a 60 req/s.", bold_prefix="Control de Tasa: ")
    add_bullet("client_max_body_size 50M: Permite la carga de archivos Excel de planta y resoluciones en PDF de hasta 50 MB.", bold_prefix="Tamaño de Adjuntos: ")

    # ═════════════════════════════════════════════════════════════════════════
    # 16. RED, PUERTOS Y ACCESO INSTITUCIONAL
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("16. RED, PUERTOS Y ACCESO INSTITUCIONAL")
    add_p("Para preservar la seguridad de la red de la Gobernación de Boyacá, se debe implementar una estricta política de exposición de puertos mínimos necesarios.")

    add_h2("16.1. Matriz de Puertos y Exposición")
    add_styled_table(
        headers=["Puerto", "Protocolo", "Servicio / Componente", "Origen Permitido", "Nivel de Exposición", "Criterio de Seguridad"],
        rows=[
            ["80", "TCP / HTTP", "Nginx (Frontend & Gateway)", "Red LAN Gobernación (o VPN)", "PÚBLICO LAN", "Punto de entrada ordinario para uso del personal de Talento Humano."],
            ["443", "TCP / HTTPS", "Nginx (TLS Seguro)", "Red LAN Gobernación (o VPN)", "PÚBLICO LAN", "Obligatorio si se habilitan certificados TLS institucionales."],
            ["22", "TCP / SSH", "Daemon OpenSSH del servidor", "Subred exclusiva de TI / Admin", "RESTRINGIDO", "Acceso exclusivo para administración por consola; denegado al resto de la red."],
            ["5432", "TCP / SQL", "PostgreSQL (talento360_db)", "Solo contenedor local", "INTERNO DOCKER", "PROHIBIDO exponer a la LAN. Solo accesible dentro de talento360_net."],
            ["3001 a 3010", "TCP / HTTP", "Microservicios Backend Node", "Solo Nginx Gateway", "INTERNO DOCKER", "PROHIBIDO exponer a la LAN. Solo accesibles mediante Nginx proxy_pass."]
        ],
        col_widths=[1.0, 1.1, 1.6, 1.4, 1.4]
    )

    add_h2("16.2. Configuración del Cortafuegos Institucional con Firewalld en AlmaLinux")
    add_p("Aplique las siguientes reglas oficiales para autorizar únicamente el tráfico legítimo en la zona 'public':")

    add_terminal_block(
        command="sudo firewall-cmd --zone=public --add-service=http --permanent\nsudo firewall-cmd --zone=public --add-service=https --permanent\nsudo firewall-cmd --reload\nsudo firewall-cmd --list-all",
        description="Abre permanentemente los puertos web 80 y 443 en el firewall de AlmaLinux y recarga la configuración activa sin interrumpir conexiones.",
        expected_output="success\nsuccess\nsuccess\npublic (active)\n  services: cockpit dhcpv6-client http https ssh",
        validation="En la lista de 'services' debe figurar 'http', 'https' y 'ssh'. Ningún puerto 5432 ni 3001-3010 debe aparecer abierto.",
        error_handling="Si el servicio firewalld está inactivo, habilítelo con 'sudo systemctl enable --now firewalld'."
    )

    add_h2("16.3. Dominio Institucional y Políticas de Acceso Remoto")
    add_p("1. Acceso mediante Dirección IP Local: En la fase inicial, los funcionarios ingresarán a través de la IP estática asignada por TI (ej. http://10.0.1.50).")
    add_p("2. Asignación de Nombre DNS Institucional: Se recomienda al área de TI registrar un registro tipo 'A' en el servidor DNS interno de la Gobernación (ej. talento360.boyaca.gov.co -> 10.0.1.50) para facilitar la recordación por parte de los funcionarios.")
    add_p("3. Acceso Remoto y Teletrabajo: Talento 360 NO debe publicarse directamente a internet abierto. Los funcionarios que realicen teletrabajo o labores desde fuera del palacio de la Gobernación deben conectarse obligatoriamente a través de la VPN institucional autorizada y administrada por la Dirección de TI.")

    # ═════════════════════════════════════════════════════════════════════════
    # 17. CONFIGURACIÓN DE SEGURIDAD (HARDENING)
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("17. CONFIGURACIÓN DE SEGURIDAD")
    add_p("La protección de los datos de los servidores públicos es un imperativo legal y ético. En este capítulo se detallan las medidas de endurecimiento técnico a nivel de sistema operativo, base de datos y aplicación.")

    add_h2("17.1. Compatibilidad con SELinux en Modo Enforcing")
    add_p("AlmaLinux opera por defecto con Security-Enhanced Linux (SELinux) en modo 'Enforcing'. Para evitar que SELinux bloquee el acceso de los contenedores Docker a los volúmenes montados en disco:")

    add_terminal_block(
        command="getenforce\nsudo setsebool -P container_manage_cgroup 1\nsudo semanage fcontext -a -t container_file_t \"/opt/talento360(/.*)?\"\nsudo restorecon -R -v /opt/talento360",
        description="Verifica que SELinux esté en modo 'Enforcing', permite a los contenedores gestionar cgroups y etiqueta correctamente el contexto de seguridad SELinux (container_file_t) sobre la carpeta del proyecto.",
        expected_output="Enforcing\nRelabeled /opt/talento360...",
        validation="Ejecute 'ls -dZ /opt/talento360' y confirme que contenga 'system_u:object_r:container_file_t:s0'.",
        error_handling="NUNCA deshabilite SELinux ('setenforce 0'); configure adecuadamente las etiquetas de contexto."
    )

    add_h2("17.2. Endurecimiento de Cuentas y Acceso SSH")
    add_p("1. Deshabilite el inicio de sesión remoto directo del usuario 'root' en '/etc/ssh/sshd_config' configurando 'PermitRootLogin no'.")
    add_p("2. Utilice autenticación basada en claves públicas SSH (RSA 4096 o Ed25519) y restrinja el acceso por contraseña.")
    add_p("3. No agregue usuarios no autorizados al grupo 'docker', ya que pertenecer a dicho grupo otorga privilegios equivalentes a root.")

    add_h2("17.3. Seguridad de la Aplicación y Control de Acceso (RBAC)")
    add_bullet("Contraseñas protegidas mediante algoritmo bcrypt con factor de costo 12 y técnica 'dummy hash' para prevenir ataques de canal lateral por análisis de tiempo de respuesta.", bold_prefix="Criptografía de Contraseñas: ")
    add_bullet("Autenticación sin estado (Stateless) mediante tokens JWT firmados con clave secreta de 64 caracteres hex, con expiración forzada a las 8 horas.", bold_prefix="Tokens JWT: ")
    add_bullet("Cada endpoint de la API valida permisos granulares ('employees:write', 'viaticos:admin', 'horarios:read'). El principio de mínimo privilegio garantiza que un analista de viáticos no pueda modificar registros de nómina ni cargos.", bold_prefix="Modelo de Permisos: ")

    # ═════════════════════════════════════════════════════════════════════════
    # 18. COPIAS DE SEGURIDAD Y RESTAURACIÓN
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("18. COPIAS DE SEGURIDAD Y RESTAURACIÓN")
    add_p("Para proteger la memoria institucional ante cualquier falla catastrófica de hardware o error humano, se establece una estrategia de copias de seguridad basada en el estándar industrial 3-2-1:")
    add_bullet("3 copias de los datos (la base de datos productiva, un respaldo local en el servidor y una copia en destino externo).")
    add_bullet("2 tipos de medios de almacenamiento distintos (disco SSD local del servidor y almacenamiento externo / NAS corporativo).")
    add_bullet("1 copia fuera de la sede principal (almacenamiento en nube segura institucional o centro de datos alterno).")

    add_h2("18.1. Script Automatizado de Respaldo Diario de PostgreSQL")
    add_p("Cree el script maestro de respaldo en '/usr/local/bin/talento360-backup.sh':")

    add_terminal_block(
        command="sudo tee /usr/local/bin/talento360-backup.sh << 'EOF'\n#!/bin/bash\nset -euo pipefail\nBACKUP_DIR=\"/var/backups/talento360\"\nFECHA=$(date +%Y%m%d_%H%M%S)\nARCHIVO=\"$BACKUP_DIR/talento360_db_$FECHA.dump\"\n\nmkdir -p \"$BACKUP_DIR\"\nchmod 700 \"$BACKUP_DIR\"\n\n# Volcado binario de PostgreSQL desde el contenedor\ncd /opt/talento360/web\ndocker compose exec -T postgres pg_dump -U postgres -d talento360 -Fc -v -f \"/tmp/backup_tmp.dump\"\ndocker compose cp postgres:/tmp/backup_tmp.dump \"$ARCHIVO\"\ndocker compose exec -T postgres rm -f \"/tmp/backup_tmp.dump\"\n\n# Validar integridad del archivo generado\nif pg_restore -l \"$ARCHIVO\" >/dev/null 2>&1; then\n  echo \"[$(date)] Respaldo exitoso y verificado: $ARCHIVO\" >> \"$BACKUP_DIR/backup.log\"\nelse\n  echo \"[$(date)] ERROR FATAL: El respaldo $ARCHIVO está corrupto.\" >> \"$BACKUP_DIR/backup.log\"\n  exit 1\nfi\n\n# Retención: borrar respaldos locales con más de 30 días de antigüedad\nfind \"$BACKUP_DIR\" -name \"*.dump\" -mtime +30 -delete\nEOF\nsudo chmod +x /usr/local/bin/talento360-backup.sh",
        description="Genera un respaldo binario diario compreso (-Fc), valida su integridad estructural mediante pg_restore -l y elimina automáticamente respaldos locales con más de 30 días.",
        expected_output="Script creado y permisos de ejecución 755 otorgados.",
        validation="Pruebe la ejecución manual con 'sudo /usr/local/bin/talento360-backup.sh' y verifique el log en '/var/backups/talento360/backup.log'.",
        error_handling="Si reporta error de espacio en disco, verifique la capacidad de la partición /var."
    )

    add_h2("18.2. Programación Automática con Cron del Sistema")
    add_terminal_block(
        command="sudo tee /etc/cron.d/talento360-backup << 'EOF'\n# Ejecutar respaldo integral todos los dias a la 01:00 AM (hora Colombia)\n0 1 * * * root /usr/local/bin/talento360-backup.sh >/dev/null 2>&1\nEOF",
        description="Programa la ejecución automática desatendida del respaldo todos los días a la 1:00 AM, momento de menor concurrencia en la entidad.",
        expected_output="Tarea cron programada exitosamente.",
        validation="Compruebe con 'cat /etc/cron.d/talento360-backup'.",
        error_handling="Asegúrese de que el servicio 'crond' esté activo mediante 'sudo systemctl status crond'."
    )

    add_h2("18.3. Procedimiento de Restauración Total (Disaster Recovery)")
    add_p("En caso de falla total del disco duro o reinstalación en un servidor nuevo:")
    add_p("1. Instale AlmaLinux y Docker siguiendo los Capítulos 7, 8 y 9.")
    add_p("2. Obtenga el código del proyecto en '/opt/talento360' y prepare el archivo '.env'.")
    add_p("3. Inicie el contenedor de base de datos de forma aislada: 'cd /opt/talento360/web && docker compose up -d postgres'.")
    add_p("4. Restaure el último archivo de respaldo .dump disponible:")
    add_p("   $ cat /var/backups/talento360/talento360_db_YYYYMMDD.dump | docker compose exec -T postgres pg_restore -U postgres -d talento360 -v --clean --if-exists")
    add_p("5. Levante la totalidad de microservicios: 'docker compose up -d'.")
    add_p("6. Compruebe los registros con la consulta SQL del Capítulo 13.3.")

    add_page_break()

    print("Escribiendo Capítulos 19 a 24 y Anexos...")

    # ═════════════════════════════════════════════════════════════════════════
    # 19. VERIFICACIÓN Y PUESTA EN FUNCIONAMIENTO
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("19. VERIFICACIÓN Y PUESTA EN FUNCIONAMIENTO")
    add_p("Una vez concluido el despliegue, el administrador debe ejecutar la batería de pruebas de verificación funcional y técnica (Smoke Testing):")

    add_h2("19.1. Comprobación del Estado de los Contenedores")
    add_terminal_block(
        command="cd /opt/talento360/web && docker compose ps",
        description="Muestra el estado de salud y tiempo de actividad de los 12 contenedores del sistema.",
        expected_output="NAME                      STATUS                   PORTS\ntalento360_frontend       Up ...                   0.0.0.0:80->80/tcp\ntalento360_db             Up ... (healthy)         5432/tcp\ntalento360_auth           Up ...                   3001/tcp\n... (todos en estado Up)",
        validation="Los 12 contenedores DEBEN figurar con STATUS 'Up'. El contenedor 'talento360_db' debe mostrar '(healthy)'.",
        error_handling="Si alguno muestra 'Exit' o 'Restarting', consulte sus trazas con 'docker compose logs <nombre>'."
    )

    add_h2("19.2. Prueba de Respuesta HTTP Local")
    add_terminal_block(
        command="curl -I http://127.0.0.1/",
        description="Verifica que el servidor web Nginx esté respondiendo satisfactoriamente a través del puerto 80 local.",
        expected_output="HTTP/1.1 200 OK\nServer: nginx\nContent-Type: text/html ...",
        validation="El código de estado HTTP debe ser estrictamente '200 OK'.",
        error_handling="Si retorna 'Connection refused', verifique que el contenedor talento360_frontend esté corriendo."
    )

    add_h2("19.3. Lista de Chequeo Funcional por Módulos")
    add_p("Desde un computador cliente conectado a la red de la Gobernación, abra el navegador web e ingrese a la dirección del servidor (ej. http://10.0.1.50):")
    add_bullet("Autenticación: Inicie sesión con una cuenta autorizada institucional. Compruebe que acceda al tablero principal sin demoras.", bold_prefix="Prueba 1: ")
    add_bullet("Módulo Servidores Públicos: Verifique que la lista cargue la totalidad de los 708 servidores públicos de la planta y que los filtros por dependencia y cargo respondan en menos de 1 segundo.", bold_prefix="Prueba 2: ")
    add_bullet("Módulo Viáticos: Consulte el listado histórico de viáticos (6.799 registros) y filtre por vigencia anual.", bold_prefix="Prueba 3: ")
    add_bullet("Módulo Horarios: Compruebe la visualización de los 135 funcionarios en esquemas de teletrabajo y jornadas especiales.", bold_prefix="Prueba 4: ")
    add_bullet("Módulo Dashboard y Reportes: Genere y descargue un reporte ejecutivo en PDF y confirme la inclusión del escudo de Boyacá y nitidez vectorial.", bold_prefix="Prueba 5: ")

    # ═════════════════════════════════════════════════════════════════════════
    # 20. ACTUALIZACIÓN Y MANTENIMIENTO
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("20. ACTUALIZACIÓN Y MANTENIMIENTO")
    add_p("El proyecto Talento 360 incorpora herramientas oficiales de actualización continua en el directorio 'deploy/scripts/actualizar-talento360.sh'. Este script incorpora mecanismos de seguridad avanzados:")
    add_bullet("Bloqueo de concurrencia mediante 'flock' para impedir ejecuciones simultáneas accidentales.")
    add_bullet("Generación obligatoria de un volcado de base de datos antes de tocar cualquier contenedor.")
    add_bullet("Reconstrucción selectiva con '--no-deps', garantizando que el contenedor de base de datos y su volumen jamás se destruyan ni reinicien.")
    add_bullet("Prueba de salud automática con reversión inmediata (Rollback) si el frontend no responde.")

    add_h2("20.1. Procedimiento de Actualización Manual Controlada")
    add_p("Cuando se requiera aplicar una nueva versión liberada en el repositorio Git institucional:")

    add_terminal_block(
        command="cd /opt/talento360\n# 1. Generar respaldo preventivo de base de datos\nsudo /usr/local/bin/talento360-backup.sh\n\n# 2. Descargar código actualizado desde la rama main\ngit fetch origin main && git pull origin main\n\n# 3. Reconstruir únicamente los microservicios actualizados sin tocar PostgreSQL\ncd web && docker compose build\n\n# 4. Reiniciar servicios en caliente\ndocker compose up -d\n\n# 5. Comprobar salud\ndocker compose ps",
        description="Secuencia de actualización segura de 5 pasos que preserva la integridad de los datos, actualiza la lógica de negocio y minimiza la ventana de indisponibilidad a menos de 30 segundos.",
        expected_output="Todo el ciclo finaliza con los contenedores en estado 'Up'.",
        validation="Verifique en el navegador que los cambios de la nueva versión estén visibles.",
        error_handling="Si ocurre algún fallo, ejecute el rollback: 'git checkout HEAD~1 && docker compose up -d --build'."
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 21. SOLUCIÓN DE PROBLEMAS FRECUENTES (TROUBLESHOOTING)
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("21. SOLUCIÓN DE PROBLEMAS FRECUENTES")
    add_p("Matriz de diagnóstico técnico y resolución ágil de incidencias diseñada para administradores de sistemas en AlmaLinux:")

    troubleshoot_data = [
        [
            "Nginx arroja error '502 Bad Gateway' al abrir la aplicación",
            "Uno o varios microservicios backend están caídos o iniciándose.",
            "docker compose ps\ndocker compose logs auth-service",
            "Reinicie el microservicio afectado: 'docker compose restart <nombre_servicio>'. Compruebe la conexión a PostgreSQL."
        ],
        [
            "Error 'Connection refused' al conectar con PostgreSQL",
            "El contenedor talento360_db no ha iniciado o las credenciales no coinciden.",
            "docker compose logs postgres\ndocker compose exec postgres pg_isready",
            "Valide que POSTGRES_PASSWORD en .env sea idéntica a la configurada originalmente en el volumen postgres_data."
        ],
        [
            "SELinux bloquea el acceso de Docker a archivos del host (Permission Denied)",
            "Etiquetas de contexto SELinux incorrectas o ausentes.",
            "sudo ausearch -m avc -ts recent\nls -dZ /opt/talento360",
            "Ejecute: 'sudo semanage fcontext -a -t container_file_t \"/opt/talento360(/.*)?\" && sudo restorecon -R -v /opt/talento360'."
        ],
        [
            "Los computadores de la red local no pueden acceder a http://<IP_SERVIDOR>",
            "El cortafuegos firewalld no tiene habilitado el servicio HTTP/HTTPS.",
            "sudo firewall-cmd --list-all",
            "Ejecute: 'sudo firewall-cmd --zone=public --add-service=http --permanent && sudo firewall-cmd --reload'."
        ],
        [
            "Error 'port is already allocated' al ejecutar docker compose up",
            "Existe otro proceso o servicio web ocupando el puerto 80 (ej. Apache httpd).",
            "sudo netstat -tlpn | grep :80\n(o ss -tlpn | grep :80)",
            "Detenga y deshabilite el servicio en conflicto: 'sudo systemctl stop httpd && sudo systemctl disable httpd'."
        ],
        [
            "El disco se llena rápidamente por acumulación de datos temporales",
            "Imágenes antiguas de Docker huérfanas o logs sin política de rotación.",
            "df -h /\ndocker system df",
            "Elimine imágenes huérfanas sin tocar volúmenes de datos: 'docker image prune -a -f'. NUNCA use 'docker volume prune'."
        ],
        [
            "Error de subida de archivos Excel o PDF: '413 Request Entity Too Large'",
            "El archivo excede el tamaño máximo permitido por Nginx.",
            "grep client_max_body_size /opt/talento360/web/frontend/nginx.conf",
            "El parámetro en nginx.conf debe estar fijado en 'client_max_body_size 50M;'. Si requiere más, amplíelo y reinicie el frontend."
        ],
        [
            "El sistema no arranca automáticamente tras reiniciar el servidor AlmaLinux",
            "La unidad systemd 'talento360.service' no fue habilitada correctamente.",
            "systemctl is-enabled talento360.service\nsystemctl status talento360.service",
            "Habilite el servicio con: 'sudo systemctl enable --now talento360.service'."
        ]
    ]

    add_styled_table(
        headers=["Síntoma / Incidencia", "Causa Probable", "Comando de Diagnóstico", "Procedimiento de Solución y Precaución"],
        rows=troubleshoot_data,
        col_widths=[1.6, 1.4, 1.6, 1.9]
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 22. RESPONSABILIDADES OPERATIVAS
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("22. RESPONSABILIDADES OPERATIVAS")
    add_p("Para delimitar con claridad las competencias funcionales e institucionales, se establece la siguiente matriz de responsabilidades entre la Dirección de Tecnología, Sistemas e Infraestructura TI y el Responsable Técnico / Administrador del Aplicativo:")

    add_styled_table(
        headers=["Actividad / Componente Operativo", "Dirección de TI (Infraestructura)", "Responsable Técnico de Talento 360", "Nivel de Coordinación"],
        rows=[
            ["Aprovisionamiento físico o virtual del servidor", "RESPONSABLE DIRECTO (Garantizar hardware y disponibilidad)", "INFORMA requerimientos de dimensionamiento justificado", "Acta de asignación de servidor"],
            ["Gestión del sistema operativo AlmaLinux", "RESPONSABLE DIRECTO (Parches de kernel, firewall y SELinux)", "CONSULTA compatibilidad con Docker y librerías", "Coordinación técnica"],
            ["Gestión de red, IP estática, DNS y VPN", "RESPONSABLE DIRECTO (Enrutamiento LAN, DNS corporativo)", "INFORMA puertos requeridos (80, 443)", "Solicitud formal de TI"],
            ["Custodia de la base de datos PostgreSQL", "APOYA con almacenamiento externo para respaldos 3-2-1", "RESPONSABLE DIRECTO de esquemas, migraciones y datos", "Procedimiento conjunto"],
            ["Generación de copias de seguridad diarias", "SUPERVISA almacenamiento y retención en destino secundario", "RESPONSABLE de la ejecución y verificación con pg_dump", "Automatización diaria"],
            ["Pruebas periódicas de restauración (DRP)", "FACILITA ambiente de pruebas aislado para simulacro", "EJECUTA la restauración y valida el censo de funcionarios", "Semestral programado"],
            ["Despliegue de nuevas versiones del aplicativo", "AUTORIZA ventana de mantenimiento programada", "EJECUTA el despliegue con actualizar-talento360.sh", "Programada y coordinada"],
            ["Soporte a usuarios finales de la Gobernación", "DERIVA solicitudes funcionales a Talento Humano", "RESPONSABLE DIRECTO de capacitación y soporte funcional", "Mesa de ayuda institucional"]
        ],
        col_widths=[1.8, 1.8, 1.8, 1.1]
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 23. LISTA DE COMPROBACIÓN FINAL (CHECKLIST)
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("23. LISTA DE COMPROBACIÓN FINAL (CHECKLIST)")
    add_p("Antes de firmar el acta formal de recibo a satisfacción y puesta en producción del servidor, el administrador debe certificar cada uno de los siguientes puntos:")

    checklist_items = [
        ["[  ]", "Servidor AlmaLinux 9 verificado con 4 vCPU, 8 GB RAM y al menos 40 GB de espacio libre en partición raíz."],
        ["[  ]", "Actualización integral de paquetes ejecutada con 'dnf upgrade -y' y zona horaria fijada en America/Bogota."],
        ["[  ]", "SELinux activo en modo 'Enforcing' con contexto 'container_file_t' aplicado sobre /opt/talento360."],
        ["[  ]", "Cortafuegos firewalld activo permitiendo únicamente los servicios 'http' (80), 'https' (443) y 'ssh' (22)."],
        ["[  ]", "Motor Docker CE oficial y plugin Docker Compose v2 instalados y habilitados en systemd."],
        ["[  ]", "Política de rotación de logs de 20 MB y 3 archivos configurada en /etc/docker/daemon.json."],
        ["[  ]", "Código oficial de Talento 360 clonado en /opt/talento360 bajo la rama de producción 'main'."],
        ["[  ]", "Archivo .env creado en /opt/talento360/web con permisos 600 y claves criptográficas de alta entropía."],
        ["[  ]", "Base de datos PostgreSQL 16 restaurada con éxito sobre el volumen gestionado 'postgres_data'."],
        ["[  ]", "Cotejo de auditoría verificado: 708 servidores públicos, 6.799 viáticos, 135 horarios y 14 usuarios."],
        ["[  ]", "Los 12 contenedores de microservicios y gateway levantados y en estado 'Up' (postgres en 'healthy')."],
        ["[  ]", "Servicio de autoarranque 'talento360.service' habilitado y probado satisfactoriamente."],
        ["[  ]", "Script de respaldo diario /usr/local/bin/talento360-backup.sh programado en cron y probado con éxito."],
        ["[  ]", "Prueba de acceso web desde cliente de la LAN exitosa: inicio de sesión, consulta de planta y descarga de PDF."]
    ]

    add_styled_table(
        headers=["Check", "Criterio Técnico de Conformidad y Aceptación en Producción"],
        rows=checklist_items,
        col_widths=[0.8, 5.7]
    )

    # ═════════════════════════════════════════════════════════════════════════
    # 24. REFERENCIAS TÉCNICAS
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("24. REFERENCIAS TÉCNICAS")
    add_bullet("AlmaLinux OS Foundation. 'Official AlmaLinux 9 Documentation & Installation Guide'. https://wiki.almalinux.org/", bold_prefix="1. AlmaLinux OS: ")
    add_bullet("Docker Inc. 'Install Docker Engine on RHEL / CentOS / AlmaLinux'. https://docs.docker.com/engine/install/centos/", bold_prefix="2. Docker Engine: ")
    add_bullet("Docker Inc. 'Docker Compose Overview & Compose Specification'. https://docs.docker.com/compose/", bold_prefix="3. Docker Compose: ")
    add_bullet("The PostgreSQL Global Development Group. 'PostgreSQL 16.3 Documentation: Backup and Restore (pg_dump / pg_restore)'. https://www.postgresql.org/docs/16/backup.html", bold_prefix="4. PostgreSQL Database: ")
    add_bullet("Nginx Inc. 'Nginx Reverse Proxy & HTTP Load Balancing Security Hardening'. https://nginx.org/en/docs/", bold_prefix="5. Nginx Server: ")
    add_bullet("Node.js Foundation. 'Node.js 20 LTS Runtime Documentation'. https://nodejs.org/docs/latest-v20.x/api/", bold_prefix="6. Node.js LTS: ")
    add_bullet("Open Web Application Security Project (OWASP). 'Application Security Verification Standard (ASVS 4.0) & Docker Top 10'. https://owasp.org/", bold_prefix="7. OWASP Security: ")
    add_bullet("Ministerio de Tecnologías de la Información y las Comunicaciones (MinTIC). 'Marco de Referencia de Arquitectura Empresarial (MRAE) y Seguridad Digital para Entidades Públicas'. Colombia, 2024.", bold_prefix="8. Estándar MinTIC: ")

    add_page_break()

    # ═════════════════════════════════════════════════════════════════════════
    # ANEXOS TÉCNICOS
    # ═════════════════════════════════════════════════════════════════════════
    add_h1("ANEXO A: HOJA DE REFERENCIA RÁPIDA DE COMANDOS (CHEAT SHEET)")
    add_p("Guía condensada para el operador del servidor en tareas habituales de mantenimiento y diagnóstico:")

    cheat_commands = [
        ["Ver estado de los contenedores", "cd /opt/talento360/web && docker compose ps"],
        ["Ver logs en tiempo real de todos los servicios", "cd /opt/talento360/web && docker compose logs -f --tail=30"],
        ["Ver logs de un servicio específico (ej: auth)", "cd /opt/talento360/web && docker compose logs -f auth-service"],
        ["Reiniciar un servicio específico (ej: frontend)", "cd /opt/talento360/web && docker compose restart frontend"],
        ["Reiniciar la plataforma completa", "cd /opt/talento360/web && docker compose restart"],
        ["Detener el aplicativo de forma ordenada", "cd /opt/talento360/web && docker compose stop"],
        ["Iniciar el aplicativo tras detención", "cd /opt/talento360/web && docker compose up -d"],
        ["Ejecutar volcado manual de base de datos", "sudo /usr/local/bin/talento360-backup.sh"],
        ["Listar respaldos almacenados en el servidor", "sudo ls -lh /var/backups/talento360"],
        ["Consultar consumo de CPU y RAM de contenedores", "docker stats --no-stream"],
        ["Verificar estado del servicio Docker en AlmaLinux", "sudo systemctl status docker --no-pager"],
        ["Verificar estado del cortafuegos de AlmaLinux", "sudo firewall-cmd --list-all"],
        ["Verificar espacio en disco del servidor", "df -h /"]
    ]

    add_styled_table(
        headers=["Operación de Mantenimiento", "Comando de Terminal AlmaLinux"],
        rows=cheat_commands,
        col_widths=[2.5, 4.0]
    )

    add_h1("ANEXO B: MATRIZ INTEGRAL DE PUERTOS Y FLUJOS DE RED")
    add_p("Esquema técnico de puertos asignados y restricciones de conectividad:")
    add_styled_table(
        headers=["Puerto", "Servicio Interno", "Acceso Externo", "Dirección del Flujo", "Protocolo"],
        rows=[
            ["80 / TCP", "Nginx (Gateway)", "Permitido en LAN", "Cliente -> Nginx", "HTTP"],
            ["443 / TCP", "Nginx (Gateway)", "Permitido en LAN (opcional)", "Cliente -> Nginx", "HTTPS"],
            ["22 / TCP", "OpenSSH Daemon", "Restringido a TI", "Admin -> Servidor", "SSH"],
            ["5432 / TCP", "PostgreSQL 16", "Denegado", "Microservicios -> DB", "PostgreSQL"],
            ["3001 / TCP", "auth-service", "Denegado", "Nginx -> auth", "HTTP interno"],
            ["3002 / TCP", "employees-service", "Denegado", "Nginx -> employees", "HTTP interno"],
            ["3003 / TCP", "requests-service", "Denegado", "Nginx -> requests", "HTTP interno"],
            ["3004 / TCP", "admin-requests-service", "Denegado", "Nginx -> admin-req", "HTTP interno"],
            ["3005 / TCP", "viaticos-service", "Denegado", "Nginx -> viaticos", "HTTP interno"],
            ["3006 / TCP", "dashboard-service", "Denegado", "Nginx -> dashboard", "HTTP interno"],
            ["3007 / TCP", "horarios-service", "Denegado", "Nginx -> horarios", "HTTP interno"],
            ["3008 / TCP", "sst-service", "Denegado", "Nginx -> sst", "HTTP interno"],
            ["3009 / TCP", "documents-service", "Denegado", "Nginx -> documents", "HTTP interno"],
            ["3010 / TCP", "reports-service", "Denegado", "Nginx -> reports", "HTTP interno"]
        ],
        col_widths=[1.1, 1.8, 1.4, 1.4, 0.8]
    )

    add_h1("ANEXO C: DICCIONARIO COMPLETO DE VARIABLES DE ENTORNO")
    add_p("Resumen de las variables requeridas en el archivo '/opt/talento360/web/.env' para facilitar su consulta rápida durante despliegues automatizados o auditorías:")
    add_terminal_block(
        command="cat << 'EOF' > /opt/talento360/web/.env\n# ── BASE DE DATOS POSTGRESQL ──────────────────────\nPOSTGRES_DB=talento360\nPOSTGRES_USER=postgres\nPOSTGRES_PASSWORD=<DEFINIR_PASSWORD_ROBUSTA>\nPOSTGRES_PORT=5432:5432\n\n# ── SEGURIDAD Y JWT ───────────────────────────────\nJWT_SECRET=<DEFINIR_SECRETO_HEX_64_CARACTERES>\nJWT_EXPIRES_IN=8h\nNODE_ENV=production\n\n# ── NOTIFICACIONES POR CORREO (OPCIONAL) ──────────\nMAIL_ENABLED=true\nSMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_USER=talento360.notificaciones@gmail.com\nSMTP_PASS=<DEFINIR_APP_PASSWORD>\nMAIL_FROM=Talento 360 <talento360.notificaciones@gmail.com>\n\n# ── GESTION DOCUMENTAL Y RUTAS ────────────────────\nDOCUMENTS_STORAGE_DIR=/data/documentos\nDOCUMENTS_INBOX_DIR=/data/bandeja\nALLOWED_ORIGINS=http://localhost,http://127.0.0.1\nAPP_PUBLIC_URL=http://localhost\nEOF",
        description="Estructura estándar de variables de entorno para producción en AlmaLinux.",
        expected_output="Archivo .env generado.",
        validation="ls -la /opt/talento360/web/.env (permisos 600 requeridos)."
    )

    add_h1("ANEXO D: DIAGRAMA DE ARQUITECTURA DE CONTENEDORES Y VOLÚMENES DOCKER")
    add_p("Representación esquemática de la topología interna contenerizada, red bridge y volúmenes persistentes:")
    
    diagram_ascii = (
        "+----------------------------------------------------------------------------------------------------+\n"
        "| SERVIDOR INSTITUCIONAL ALMALINUX 9 (IP: 10.0.1.50 / Hostname: talento360.boyaca.gov.co)            |\n"
        "| Firewalld: Puertos 80 (HTTP) y 443 (HTTPS) abiertos a la LAN institucional                         |\n"
        "+----------------------------------------------------------------------------------------------------+\n"
        "         |                                                                                            \n"
        "         v [TCP :80 / :443]                                                                           \n"
        "+----------------------------------------------------------------------------------------------------+\n"
        "| CONTENEDOR 1: talento360_frontend (Nginx 1.25 Alpine)                                              |\n"
        "| - Servidor Web SPA (HTML5, CSS3, Vanilla JS)                                                       |\n"
        "| - API Gateway & Reverse Proxy con Rate Limiting y Cabeceras de Seguridad OWASP                      |\n"
        "+----------------------------------------------------------------------------------------------------+\n"
        "         |                                                                                            \n"
        "         | [Red Privada Virtual Docker: talento360_net - Driver: bridge]                             \n"
        "         +---------------------------------------+---------------------------------------+            \n"
        "         |                                       |                                       |            \n"
        "         v                                       v                                       v            \n"
        "  [auth-service :3001]                  [employees-service :3002]               [requests-service :3003]      \n"
        "  - JWT, Bcrypt, Login                  - Servidores, Censo, Hojas de Vida      - Vacaciones y Permisos       \n"
        "         |                                       |                                       |            \n"
        "         +---------------------------------------+---------------------------------------+            \n"
        "         |                                       |                                       |            \n"
        "         v                                       v                                       v            \n"
        "  [admin-requests :3004]                [viaticos-service :3005]                [dashboard-service :3006]     \n"
        "  - Aprobaciones e Incapacidades        - Comisiones, Resoluciones y DIVIPOLA   - KPIs, PDFs Vectoriales      \n"
        "         |                                       |                                       |            \n"
        "         +---------------------------------------+---------------------------------------+            \n"
        "         |                                       |                                       |            \n"
        "         v                                       v                                       v            \n"
        "  [horarios-service :3007]              [sst-service :3008]                     [documents-service :3009]     \n"
        "  - Teletrabajo, Jornadas Flexibles     - EMO, EPP, Riesgos Ocupacionales       - Gestión Documental / Soportes\n"
        "         |                                       |                                       |            \n"
        "         +---------------------------------------+---------------------------------------+            \n"
        "         |                                                                                            \n"
        "         v                                                                                            \n"
        "  [reports-service :3010]                                                                             \n"
        "  - Informes y Automatización                                                                         \n"
        "         |                                                                                            \n"
        "         +==================== Conexiones SQL Parametrizadas [TCP :5432] =====================+       \n"
        "         |                                                                                            \n"
        "         v                                                                                            \n"
        "+----------------------------------------------------------------------------------------------------+\n"
        "| CONTENEDOR 12: talento360_db (PostgreSQL 16 Alpine)                                                |\n"
        "| - Puerto 5432 AISLADO (No publicado al host)                                                       |\n"
        "| - Healthcheck: pg_isready -U postgres (intervalo 10s)                                              |\n"
        "+----------------------------------------------------------------------------------------------------+\n"
        "         |                                                                                            \n"
        "         | [Almacenamiento Persistente en Host: /var/lib/docker/volumes/...]                          \n"
        "         +-------------------+-------------------+-------------------+-------------------+        \n"
        "         v                   v                   v                   v                            \n"
        "   postgres_data        backups_data       documents_data      documents_inbox                    \n"
        "  (Tablas y censo)    (Volcados diarios)  (Adjuntos en PDF)   (Bandeja escaneo)                   \n"
        "+--------------------+-------------------+-------------------+-------------------+----------------+\n"
    )

    add_terminal_block(
        command="docker network inspect web_talento360_net",
        description="Inspecciona la topología de red virtual bridge generada por Docker Compose con los 12 contenedores conectados.",
        expected_output=diagram_ascii,
        validation="Confirme que todos los contenedores compartan la misma subred virtual (ej. 172.20.0.0/16)."
    )

    add_h1("ANEXO E: PLAN DE RECUPERACIÓN ANTE DESASTRES (DRP)")
    add_p("Flujograma de contingencia institucional en caso de pérdida total del servidor:")
    add_p("Nivel 1: Detección y Declaración de Falla por parte del Administrador de TI.")
    add_p("Nivel 2: Asignación de nueva máquina física o virtual con AlmaLinux 9.")
    add_p("Nivel 3: Aprovisionamiento de paquetes base y Docker en menos de 15 minutos (Capítulos 7, 8 y 9).")
    add_p("Nivel 4: Recuperación del código del repositorio Git institucional en /opt/talento360.")
    add_p("Nivel 5: Recuperación del volcado de base de datos desde el almacenamiento secundario y restauración sobre PostgreSQL.")
    add_p("Nivel 6: Puesta en marcha de contenedores y verificación del censo institucional.")
    add_p("Tiempo Objetivo de Recuperación (RTO): Menor a 1 hora.")
    add_p("Punto Objetivo de Recuperación (RPO): Menor a 24 horas (máximo los datos del último día hábil, restaurables mediante el volcado de la 1:00 AM).")

    # Guardar documento
    output_path = os.path.abspath('docs/infraestructura/Manual_Instalacion_Talento_360_AlmaLinux.docx')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    print(f"✅ Documento .DOCX guardado exitosamente en: {output_path}")
    print(f"Tamaño del archivo generado: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    create_manual()
