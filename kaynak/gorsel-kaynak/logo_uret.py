# -*- coding: utf-8 -*-
"""europetaxi24 logosu: assets/logo.svg + logo-ic.svg (sablona gomulen, currentColor) uretir.
Yazi, Archivo (wght 800) govde cizgilerinden SVG yoluna cevrilir: yazi tipi olmadan da ayni gorunur.
Calistir: python3 kaynak/gorsel-kaynak/logo_uret.py"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

KAYNAK = Path(__file__).resolve().parent.parent
AMBER, INK = "#F7B32B", "#121110"

f = TTFont(KAYNAK / "assets" / "fonts" / "archivo-latin.woff2")
f = instantiateVariableFont(f, {"wght": 800})
gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
upm = f["head"].unitsPerEm
cap = f["OS/2"].sCapHeight or 0.7 * upm


def yaz(metin, x0, taban, yukseklik, aralik=0.015):
    """metni (x0, taban) noktasindan baslayarak yola cevirir; (yol, bitis_x) doner."""
    olcek = yukseklik / cap
    x, parcalar = x0, []
    for ch in metin:
        ad = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (olcek, 0, 0, -olcek, x, taban))
        gs[ad].draw(tp)
        parcalar.append(pen.getCommands())
        x += hmtx[ad][0] * olcek + aralik * upm * olcek
    return " ".join(p for p in parcalar if p), x


def yer(metin, yukseklik, aralik=0.015):
    return yaz(metin, 0, 0, yukseklik, aralik)[1]


# ---- isaret (100x100): amber kare + tavan lambasi + 'E' seritleri
def isaret(x=0, y=0, boy=100):
    s = boy / 100
    t = f'transform="translate({x} {y}) scale({s})"'
    return (f'<g {t}><rect width="100" height="100" rx="26" fill="{AMBER}"/>'
            f'<rect x="39" y="20" width="22" height="18" rx="5" fill="{INK}"/>'
            f'<path d="M31.5 33h38a5.5 5.5 0 0 1 0 11H42.5v6.5h19a5.5 5.5 0 0 1 0 11h-19V67h27a5.5 5.5 0 0 1 0 11h-38a5.5 5.5 0 0 1-5.5-5.5v-34a5.5 5.5 0 0 1 5.5-5.5Z" fill="{INK}"/></g>')


H = 44            # buyuk harf yuksekligi
G, CH, PAD = 118, 62, 16   # metin baslangici, "24" rozet yuksekligi, rozet ic bosluk
yol_ana, x_son = yaz("EUROPETAXI", G, 70, H)
w24 = yer("24", H)
cx = x_son + 14
yol_24, _ = yaz("24", cx + PAD, 70, H)
cw = w24 + 2 * PAD
genislik = cx + cw + 4


def kilit(renk_metin, cls="", etiket="europetaxi24"):
    return (f'<svg {cls}xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {genislik:.0f} 100" role="img" aria-label="{etiket}">'
            f'{isaret(0, 0, 100)}'
            f'<path d="{yol_ana}" fill="{renk_metin}"/>'
            f'<rect x="{cx:.1f}" y="{70 - H / 2 - CH / 2 + 1:.1f}" width="{cw:.1f}" height="{CH}" rx="16" fill="{AMBER}"/>'
            f'<path d="{yol_24}" fill="{INK}"/></svg>')


(KAYNAK / "assets" / "logo.svg").write_text(kilit(INK) + "\n", encoding="utf-8")
# sablona gomulen sembol: sayfada BIR kez tanimlanir, baslikta ve altbilgide <use> ile cagrilir (currentColor)
_sembol = kilit("currentColor").replace('<svg xmlns="http://www.w3.org/2000/svg" ', '<symbol id="et-logo" ', 1).replace("</svg>", "</symbol>")
(KAYNAK / "logo-ic.svg").write_text('<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' + _sembol + "</svg>\n", encoding="utf-8")
# tek isaret (favicon): kare, dolgulu
(KAYNAK / "assets" / "favicon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + isaret()[len(f'<g transform="translate(0 0) scale(1.0)">'):-4] + '</svg>\n'
    if False else
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="26" fill="%s"/>'
    '<rect x="39" y="20" width="22" height="18" rx="5" fill="%s"/>'
    '<path d="M31.5 33h38a5.5 5.5 0 0 1 0 11H42.5v6.5h19a5.5 5.5 0 0 1 0 11h-19V67h27a5.5 5.5 0 0 1 0 11h-38a5.5 5.5 0 0 1-5.5-5.5v-34a5.5 5.5 0 0 1 5.5-5.5Z" fill="%s"/></svg>\n' % (AMBER, INK, INK),
    encoding="utf-8")
print("logo hazir:", round(genislik), "x 100")
