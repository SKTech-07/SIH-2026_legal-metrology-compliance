import os
import json
import csv
import uuid
import datetime
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from app.config import settings


def generate_pdf_report(
    inspection_code: str,
    store_info: Dict[str, Any],
    inspector_name: str,
    products_data: List[Dict[str, Any]],
    violations_data: List[Dict[str, Any]]
) -> str:
    """Generate an official Legal Metrology Compliance Report PDF using ReportLab."""
    filename = f"report_{inspection_code.replace('-', '_')}_{uuid.uuid4().hex[:8]}.pdf"
    file_path = os.path.join(settings.REPORT_DIR, filename)

    doc = SimpleDocTemplate(file_path, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=12
    )
    subtitle_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#475569'),
        spaceAfter=8
    )

    story = []
    story.append(Paragraph("GOVERNMENT OF INDIA - LEGAL METROLOGY COMPLIANCE REPORT", title_style))
    story.append(Paragraph(f"Inspection Reference: <b>{inspection_code}</b> | Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}", subtitle_style))
    story.append(Spacer(1, 10))

    # Store & Inspector Metadata Table
    meta_data = [
        ["Store Name:", store_info.get("name", "N/A"), "Inspector:", inspector_name],
        ["License No:", store_info.get("license_number", "N/A"), "Location:", f"{store_info.get('city', '')}, {store_info.get('state', '')}"],
    ]
    meta_table = Table(meta_data, colWidths=[100, 200, 100, 140])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0F172A')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))

    # Products Summary Section
    story.append(Paragraph("Selected Inspection Products", styles['Heading2']))
    prod_table_data = [["Product Name", "Category", "Barcode", "Status"]]
    for p in products_data:
        prod_table_data.append([
            p.get("name", ""),
            p.get("category", ""),
            p.get("barcode") or "N/A",
            p.get("status", "NOT_STARTED")
        ])
    
    prod_table = Table(prod_table_data, colWidths=[200, 120, 120, 100])
    prod_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(prod_table)
    story.append(Spacer(1, 15))

    # Violations Section
    story.append(Paragraph("Legal Metrology Compliance & Violation Findings", styles['Heading2']))
    if not violations_data:
        story.append(Paragraph("✓ No legal metrology violations detected for selected products.", styles['Normal']))
    else:
        viol_table_data = [["Product", "Rule Code", "Type", "Severity", "Status", "Description"]]
        for v in violations_data:
            viol_table_data.append([
                v.get("product_name", ""),
                v.get("rule_code", ""),
                v.get("violation_type", ""),
                v.get("severity", ""),
                v.get("status", ""),
                Paragraph(v.get("description", ""), styles['Normal'])
            ])
        viol_table = Table(viol_table_data, colWidths=[100, 70, 90, 60, 60, 160])
        viol_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#991B1B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#FECACA')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(viol_table)

    doc.build(story)
    return f"/api/v1/reports/file/{filename}"


def generate_json_report(
    inspection_code: str,
    store_info: Dict[str, Any],
    inspector_name: str,
    products_data: List[Dict[str, Any]],
    violations_data: List[Dict[str, Any]]
) -> str:
    filename = f"report_{inspection_code.replace('-', '_')}_{uuid.uuid4().hex[:8]}.json"
    file_path = os.path.join(settings.REPORT_DIR, filename)

    report_payload = {
        "inspection_code": inspection_code,
        "generated_at": datetime.datetime.utcnow().isoformat(),
        "inspector": inspector_name,
        "store": store_info,
        "products": products_data,
        "violations": violations_data
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)

    return f"/api/v1/reports/file/{filename}"


def generate_csv_report(
    inspection_code: str,
    store_info: Dict[str, Any],
    inspector_name: str,
    products_data: List[Dict[str, Any]],
    violations_data: List[Dict[str, Any]]
) -> str:
    filename = f"report_{inspection_code.replace('-', '_')}_{uuid.uuid4().hex[:8]}.csv"
    file_path = os.path.join(settings.REPORT_DIR, filename)

    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Inspection Code", inspection_code])
        writer.writerow(["Inspector", inspector_name])
        writer.writerow(["Store Name", store_info.get("name")])
        writer.writerow([])
        writer.writerow(["PRODUCT ID", "PRODUCT NAME", "CATEGORY", "STATUS"])
        for p in products_data:
            writer.writerow([p.get("id"), p.get("name"), p.get("category"), p.get("status")])
        writer.writerow([])
        writer.writerow(["VIOLATION ID", "PRODUCT", "TYPE", "SEVERITY", "STATUS", "DESCRIPTION"])
        for v in violations_data:
            writer.writerow([v.get("id"), v.get("product_name"), v.get("violation_type"), v.get("severity"), v.get("status"), v.get("description")])

    return f"/api/v1/reports/file/{filename}"
