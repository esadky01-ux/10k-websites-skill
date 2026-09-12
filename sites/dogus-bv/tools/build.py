"""Build the deliverables for the Dogus BV site from index.html + images/:
  dogus-bv-preview.html  single file with every image embedded (for previewing)
  dogus-bv-website.zip   index.html + images/ (upload to hosting)
Run: python3 sites/dogus-bv/tools/build.py"""
import base64
import os
import re
import zipfile

SITE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
MIMES = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon"}


def data_uri(rel: str) -> str:
    path = os.path.join(SITE, rel)
    ext = os.path.splitext(path)[1].lower()
    with open(path, "rb") as f:
        return f"data:{MIMES[ext]};base64," + base64.b64encode(f.read()).decode()


def main() -> None:
    with open(os.path.join(SITE, "index.html"), encoding="utf-8") as f:
        src = f.read()
    preview = re.sub(r'<link rel="preload"[^>]*>\n', "", src)
    preview = re.sub(r'(src|href)="(images/[^"]+)"', lambda m: f'{m.group(1)}="{data_uri(m.group(2))}"', preview)
    preview = preview.replace("| Dogus BV</title>", "| Dogus BV (preview)</title>", 1)
    with open(os.path.join(SITE, "dogus-bv-preview.html"), "w", encoding="utf-8") as f:
        f.write(preview)

    zip_path = os.path.join(SITE, "dogus-bv-website.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(SITE, "index.html"), "index.html")
        for name in sorted(os.listdir(os.path.join(SITE, "images"))):
            if name != "MANIFEST.txt":
                z.write(os.path.join(SITE, "images", name), f"images/{name}")
    for name in ("dogus-bv-preview.html", "dogus-bv-website.zip"):
        print(name, os.path.getsize(os.path.join(SITE, name)), "bytes")


if __name__ == "__main__":
    main()
