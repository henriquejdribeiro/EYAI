"""ScrumAImaster — PDF report builders for the team allocator endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import List

from fpdf import FPDF

# EY-ish palette + the allocator's green accent.
EY_BLACK = (46, 46, 56)
EY_YELLOW = (255, 230, 0)
SCRUM_GREEN = (31, 181, 78)
GRAY_500 = (116, 116, 128)
GRAY_300 = (196, 196, 205)
GRAY_50 = (246, 246, 250)


def _clean(text: str) -> str:
    """fpdf2 with built-in Helvetica uses Latin-1. Replace chars outside it."""
    if not text:
        return ""
    # Common Unicode bullets / dashes / quotes -> ASCII fallbacks.
    replacements = {
        "·": "-",
        "•": "-",
        "—": "-",
        "–": "-",
        "‐": "-",
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
        "…": "...",
        "★": "*",
        "→": "->",
        "▸": ">",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    # Drop anything that still can't be encoded in latin-1.
    return text.encode("latin-1", "replace").decode("latin-1")


class ReportPDF(FPDF):
    title_text: str = "ScrumAImaster"

    def header(self) -> None:
        # Yellow accent bar on the left of the header.
        self.set_fill_color(*EY_YELLOW)
        self.rect(10, 10, 4, 16, "F")
        self.set_text_color(*EY_BLACK)
        self.set_font("Helvetica", "B", 14)
        self.set_xy(18, 11)
        self.cell(0, 7, _clean("ScrumAImaster"), ln=True)
        self.set_xy(18, 18)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*GRAY_500)
        self.cell(0, 5, _clean(self.title_text), ln=True)
        # Divider line.
        self.set_draw_color(*GRAY_300)
        self.set_line_width(0.2)
        self.line(10, 30, 200, 30)
        self.ln(8)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GRAY_500)
        self.cell(0, 8, _clean(f"Generated {datetime.now():%Y-%m-%d %H:%M} - EY AI Challenge 2026"), align="L")
        self.cell(0, 8, _clean(f"Page {self.page_no()}"), align="R")

    # ---- helpers ---------------------------------------------------------

    def h2(self, text: str) -> None:
        self.set_text_color(*EY_BLACK)
        self.set_font("Helvetica", "B", 12)
        self.cell(0, 7, _clean(text), ln=True)
        self.set_draw_color(*EY_YELLOW)
        self.set_line_width(0.6)
        y = self.get_y()
        self.line(self.l_margin, y, self.l_margin + 30, y)
        self.ln(3)

    def paragraph(self, text: str, size: int = 10) -> None:
        self.set_text_color(*EY_BLACK)
        self.set_font("Helvetica", "", size)
        self.multi_cell(0, 5, _clean(text))
        self.ln(1)

    def info_row(self, label: str, value: str) -> None:
        # Single-row label + value. Long values are truncated so the cell
        # width math (which would underflow if we used multi_cell after a
        # fixed-width label cell) stays predictable.
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*GRAY_500)
        self.cell(40, 5, _clean(label))
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*EY_BLACK)
        max_chars = 120
        value_clean = value if len(value) <= max_chars else value[: max_chars - 1] + "..."
        self.cell(0, 5, _clean(value_clean), ln=True)


# ---------------------------------------------------------------------------
# Modo 1 — single-project recommendation
# ---------------------------------------------------------------------------


def build_recommend_pdf(
    project_name: str,
    project_text: str,
    ranked: List[dict],
    recommended: List[dict],
    recommended_team_capacity: int,
    project_keywords: List[str],
) -> bytes:
    pdf = ReportPDF()
    pdf.title_text = f"Modo 1 - Team recommendation for {project_name or 'Project'}"
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    pdf.h2("Project")
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*EY_BLACK)
    pdf.cell(0, 7, _clean(project_name or "Unnamed project"), ln=True)
    pdf.ln(2)

    snippet = project_text.strip().replace("\n", " ")
    if len(snippet) > 600:
        snippet = snippet[:600].rsplit(" ", 1)[0] + "..."
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(*GRAY_500)
    pdf.multi_cell(0, 4.5, _clean(snippet))
    pdf.ln(4)

    if project_keywords:
        pdf.info_row("Keywords matched:", ", ".join(project_keywords[:18]))
        pdf.ln(2)

    pdf.h2(f"Recommended team ({len(recommended)} members - {recommended_team_capacity}h/sprint)")
    _draw_recommend_table(pdf, recommended, highlight=True)
    pdf.ln(4)

    pdf.h2("Selection rationale")
    for item in recommended:
        m = item["member"]
        matched = item.get("matched_terms", [])
        score = item["score"]
        reasoning_parts = [f"Score {score:.0f}"]
        if matched:
            reasoning_parts.append(f"Matched skills/role: {', '.join(matched)}")
        else:
            reasoning_parts.append("Selected for team coverage despite no direct skill overlap")
        capacity = m.get("capacity_hours_per_sprint", 60)
        reasoning_parts.append(f"Capacity {capacity}h/sprint")
        seniority = m.get("seniority")
        if seniority:
            reasoning_parts.append(f"Seniority: {seniority}")
        reasoning = ". ".join(reasoning_parts) + "."
        _person_block(pdf, m["name"], m["role"], reasoning)

    # Full ranking appendix
    pdf.add_page()
    pdf.h2("Full ranking (all 15 members)")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*GRAY_500)
    pdf.multi_cell(0, 4.5, _clean(
        "Score = 2 x (skill keywords matched) + 1 x (role/seniority keywords matched). "
        "Tokens come from the project brief; stopwords are stripped."
    ))
    pdf.ln(3)
    _draw_recommend_table(pdf, ranked, highlight=False, recommended_ids={i["member"]["id"] for i in recommended})

    return _to_bytes(pdf)


def _draw_recommend_table(pdf: ReportPDF, rows: List[dict], highlight: bool, recommended_ids: set | None = None) -> None:
    # Header
    pdf.set_fill_color(*EY_BLACK)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(7, 7, "", border=0, fill=True)
    pdf.cell(50, 7, _clean(" Name"), border=0, fill=True)
    pdf.cell(60, 7, _clean(" Role"), border=0, fill=True)
    pdf.cell(15, 7, _clean(" Score"), border=0, fill=True, align="R")
    pdf.cell(58, 7, _clean(" Matched terms"), border=0, fill=True, ln=True)

    pdf.set_font("Helvetica", "", 9)
    for i, item in enumerate(rows):
        m = item["member"]
        matched = item.get("matched_terms", [])
        is_top = recommended_ids and m["id"] in recommended_ids
        if highlight and i < (len(rows)):
            pdf.set_fill_color(*EY_YELLOW)
            pdf.set_text_color(*EY_BLACK)
            fill = True
        elif is_top:
            pdf.set_fill_color(255, 252, 229)
            pdf.set_text_color(*EY_BLACK)
            fill = True
        else:
            pdf.set_fill_color(*GRAY_50 if i % 2 else (255, 255, 255))
            pdf.set_text_color(*EY_BLACK)
            fill = True

        pdf.cell(7, 6, "", border=0, fill=fill)
        pdf.cell(50, 6, _clean(" " + m["name"])[:38], border=0, fill=fill)
        pdf.cell(60, 6, _clean(" " + m["role"])[:48], border=0, fill=fill)
        pdf.cell(15, 6, _clean(f'{item["score"]:.0f} '), border=0, fill=fill, align="R")
        pdf.cell(58, 6, _clean(" " + ", ".join(matched[:4]))[:50], border=0, fill=fill, ln=True)


def _person_block(pdf: ReportPDF, name: str, role: str, reasoning: str) -> None:
    pdf.set_text_color(*EY_BLACK)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5.5, _clean(f"{name}  -  {role}"), ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*GRAY_500)
    pdf.multi_cell(0, 4.5, _clean(reasoning))
    pdf.ln(2)


# ---------------------------------------------------------------------------
# Modo 2 — multi-project allocation
# ---------------------------------------------------------------------------


def build_allocate_pdf(
    assignments: dict,
    total_members: int,
    min_per_project: int,
    algorithm: str,
) -> bytes:
    pdf = ReportPDF()
    pdf.title_text = f"Modo 2 - Allocating {total_members} members across {len(assignments)} projects"
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    pdf.h2("Allocation overview")
    pdf.info_row("Members allocated:", str(total_members))
    pdf.info_row("Projects:", str(len(assignments)))
    pdf.info_row("Min per project:", str(min_per_project))
    pdf.info_row("Algorithm:", algorithm)
    pdf.ln(4)

    # Summary table
    pdf.h2("Per-project summary")
    pdf.set_fill_color(*EY_BLACK)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(70, 7, _clean(" Project"), fill=True)
    pdf.cell(30, 7, _clean(" Members"), fill=True, align="R")
    pdf.cell(40, 7, _clean(" Capacity/sprint"), fill=True, align="R")
    pdf.cell(40, 7, _clean(" Avg fit score"), fill=True, align="R", ln=True)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*EY_BLACK)
    for i, (key, info) in enumerate(assignments.items()):
        pdf.set_fill_color(*GRAY_50 if i % 2 else (255, 255, 255))
        pdf.cell(70, 6, _clean(" " + (info.get("name") or key))[:55], fill=True)
        pdf.cell(30, 6, _clean(f'{len(info["members"])} '), fill=True, align="R")
        pdf.cell(40, 6, _clean(f'{info["total_capacity_hours"]}h '), fill=True, align="R")
        pdf.cell(40, 6, _clean(f'{info["avg_score"]:.1f} '), fill=True, align="R", ln=True)

    pdf.ln(6)

    # Per-project breakdowns
    for key, info in assignments.items():
        if pdf.get_y() > 230:
            pdf.add_page()
        pdf.h2(f"{info.get('name') or key} - {len(info['members'])} members")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*GRAY_500)
        pdf.cell(0, 5, _clean(
            f"Total capacity {info['total_capacity_hours']}h/sprint - average fit score {info['avg_score']:.1f}"
        ), ln=True)
        pdf.ln(2)

        for m_entry in info["members"]:
            m = m_entry["member"]
            score = m_entry["score"]
            matched = m_entry.get("matched_terms", [])
            alternates = m_entry.get("alternates", {})
            alt_str = ", ".join(f"{k}={v:.0f}" for k, v in alternates.items())

            reasoning_parts = [f"Score {score:.0f}"]
            if matched:
                reasoning_parts.append(f"Matched: {', '.join(matched)}")
            else:
                reasoning_parts.append("No direct skill overlap - assigned to balance project size")
            if alt_str:
                reasoning_parts.append(f"Alternate fits: {alt_str}")
            reasoning_parts.append(f"Capacity {m.get('capacity_hours_per_sprint', 60)}h/sprint")
            reasoning = ". ".join(reasoning_parts) + "."

            _person_block(pdf, m["name"], m["role"], reasoning)
        pdf.ln(2)

    return _to_bytes(pdf)


def _to_bytes(pdf: FPDF) -> bytes:
    out = pdf.output()  # fpdf2 returns bytearray
    return bytes(out)
