#!/usr/bin/env python3
"""Generate a tailored PDF one-pager for a prospect.
Usage: python3 generate-onepager.py '{"company":"Emil Frey","country":"Switzerland",...}' /tmp/output.pdf
"""
import json, sys, os
from weasyprint import HTML

def generate(prospect: dict, output_path: str):
    company = prospect.get("company", "Prospect")
    country = prospect.get("country", "")
    brands = prospect.get("brands", [])
    locations = prospect.get("locations", "")
    notes = prospect.get("notes", "")

    brands_html = ""
    if brands:
        brands_html = '<div class="brands">' + " ".join(f'<span class="brand">{b}</span>' for b in brands[:8]) + '</div>'

    # Multilingual context by country
    lang_map = {
        "Switzerland": "German, French, Italian, and English",
        "Belgium": "Dutch, French, and English",
        "Netherlands": "Dutch, English, and German",
        "Luxembourg": "French, German, and English",
        "France": "French, English, and Arabic",
        "Germany": "German, English, and Turkish",
        "Austria": "German and English",
        "UK": "English, Polish, and Arabic",
    }
    languages = lang_map.get(country, "multiple languages")

    challenge_text = ""
    if locations:
        challenge_text = f"With {locations} locations"
        if country:
            challenge_text += f" across {country}"
        challenge_text += f", {company} needs customer engagement in {languages} — the same multilingual challenge NAGHI solved at scale."
    else:
        challenge_text = f"{company} serves customers in {languages}. Salesteq AI delivers instant, native-quality engagement in every language — the same way NAGHI Motors scaled across Arabic and English."

    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><style>
@page {{ size: A4; margin: 0; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fff; }}

.page {{ width: 210mm; min-height: 297mm; padding: 40px 48px; position: relative; }}

.header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 36px; padding-bottom: 20px; border-bottom: 2px solid #e8720c; }}
.logo {{ font-size: 24px; font-weight: 700; color: #e8720c; letter-spacing: -0.5px; }}
.logo-sub {{ font-size: 10px; color: #888; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }}
.for {{ text-align: right; font-size: 12px; color: #888; }}
.for strong {{ display: block; font-size: 16px; color: #1a1a1a; margin-top: 2px; }}

.hero {{ margin-bottom: 32px; }}
.hero h1 {{ font-size: 26px; font-weight: 700; color: #1a1a1a; line-height: 1.3; letter-spacing: -0.5px; margin-bottom: 8px; }}
.hero p {{ font-size: 14px; color: #555; line-height: 1.6; }}

.brands {{ margin: 16px 0 24px; display: flex; flex-wrap: wrap; gap: 6px; }}
.brand {{ background: #f5f5f5; color: #555; font-size: 11px; padding: 4px 12px; border-radius: 100px; }}

.case-study {{ background: #faf5f0; border-left: 3px solid #e8720c; padding: 24px 28px; margin-bottom: 28px; border-radius: 0 8px 8px 0; }}
.case-study h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #e8720c; margin-bottom: 12px; }}
.case-study .stats {{ display: flex; gap: 32px; margin-bottom: 12px; }}
.stat {{ text-align: center; }}
.stat-num {{ font-size: 28px; font-weight: 700; color: #1a1a1a; }}
.stat-label {{ font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }}
.case-study p {{ font-size: 13px; color: #555; line-height: 1.6; }}

.products {{ margin-bottom: 28px; }}
.products h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 16px; }}
.product-grid {{ display: flex; flex-wrap: wrap; gap: 12px; }}
.product {{ flex: 1; min-width: 140px; background: #fafafa; border-radius: 8px; padding: 16px; }}
.product h3 {{ font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }}
.product p {{ font-size: 11px; color: #777; line-height: 1.5; }}

.why {{ margin-bottom: 28px; }}
.why h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 12px; }}
.why-text {{ font-size: 13px; color: #555; line-height: 1.7; }}

.cta {{ background: #1a1a1a; color: #fff; padding: 28px 32px; border-radius: 10px; text-align: center; margin-top: 20px; }}
.cta h2 {{ font-size: 18px; font-weight: 600; margin-bottom: 8px; }}
.cta p {{ font-size: 13px; color: #aaa; margin-bottom: 4px; }}
.cta a {{ color: #e8720c; text-decoration: none; font-weight: 600; }}

.footer {{ position: absolute; bottom: 30px; left: 48px; right: 48px; display: flex; justify-content: space-between; font-size: 10px; color: #bbb; }}
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">Salesteq</div>
      <div class="logo-sub">AI Commercial Operations</div>
    </div>
    <div class="for">Prepared for<strong>{company}</strong></div>
  </div>

  <div class="hero">
    <h1>One platform replaces your sales, marketing, and service teams with AI agents.</h1>
    <p>{challenge_text}</p>
  </div>

  {brands_html}

  <div class="case-study">
    <h2>Case Study: NAGHI Motors</h2>
    <div class="stats">
      <div class="stat"><div class="stat-num">11+</div><div class="stat-label">Brands</div></div>
      <div class="stat"><div class="stat-num">250K</div><div class="stat-label">Vehicles/Year</div></div>
      <div class="stat"><div class="stat-num">24/7</div><div class="stat-label">Multilingual AI</div></div>
    </div>
    <p>NAGHI Motors is the exclusive BMW dealer in Saudi Arabia. They manage 11+ brands including BMW, MINI, Rolls-Royce, Geely, Jetour, GAC, and Bestune. Salesteq AI handles multilingual customer engagement (Arabic/English), automated service booking, and intelligent lead qualification &mdash; reducing response time from hours to seconds.</p>
  </div>

  <div class="products">
    <h2>The Platform</h2>
    <div class="product-grid">
      <div class="product"><h3>Badger</h3><p>AI agents that execute sales, marketing, and service tasks autonomously.</p></div>
      <div class="product"><h3>Index</h3><p>Commercial intelligence. 6.8M+ companies, 14M+ contacts, sub-100ms search.</p></div>
      <div class="product"><h3>Kol</h3><p>Voice + chat in any language. Calls, WhatsApp, web chat. Arabic, German, French, English &mdash; native quality.</p></div>
      <div class="product"><h3>Yeda</h3><p>Self-building knowledge base. Agents learn from every interaction.</p></div>
    </div>
  </div>

  <div class="why">
    <h2>Why {company}</h2>
    <div class="why-text">{notes if notes else f"{company} operates at a scale where AI-driven commercial operations deliver immediate ROI: faster customer response, automated service scheduling, and consistent engagement across every location and brand."}</div>
  </div>

  <div class="cta">
    <h2>See it live in 20 minutes.</h2>
    <p>Book a demo &mdash; <a href="https://automotive.salesteq.com">automotive.salesteq.com</a></p>
    <p style="margin-top:4px">Viktor Andreas &middot; <a href="mailto:viktor@salesteq.com">viktor@salesteq.com</a></p>
  </div>

  <div class="footer">
    <span>Salesteq &middot; Elyon GmbH &middot; Zug, Switzerland</span>
    <span>salesteq.com</span>
  </div>
</div>
</body></html>"""

    HTML(string=html).write_pdf(output_path)
    print(f"Generated: {output_path}")

if __name__ == "__main__":
    prospect = json.loads(sys.argv[1])
    output = sys.argv[2] if len(sys.argv) > 2 else "/tmp/onepager.pdf"
    generate(prospect, output)
