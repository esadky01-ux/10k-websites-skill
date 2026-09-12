"""Download the Higgsfield-generated source images for the Dogus BV site and
optimize them for the web (max 1600px, WebP quality 78).

Runs in GitHub Actions (see .github/workflows/fetch-images.yml). Output goes to
sites/dogus-bv/images/. Re-running is idempotent: same input, same output."""
import hashlib
import io
import os
import sys
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "images")
BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_2vdZiMOck7w0YKzc7FNo6hzUt1f/hf_20260912_215928_"

# (output name, max width, source job id)
IMAGES = [
    ("hero-aluminium-ramen-rijwoning-antwerpen", 1600, "8a717c77-9cb5-4b31-a0ee-10f86ebae3cb"),
    ("dienst-pvc-ramen-antwerpen", 1000, "4ae1e5e8-85fb-41f5-b779-aba22b32d335"),
    ("dienst-aluminium-voordeur", 1000, "4a4deb73-0353-47f2-8b95-ef3a892492a0"),
    ("dienst-rolluiken", 1000, "12ade377-cc8d-419b-9506-dd7cf151f1e1"),
    ("realisatie-pvc-voordeur-wit", 1200, "81914c0f-b9ae-40c9-86a4-a170b36b85d9"),
    ("realisatie-gevelrenovatie-aluminium-ramen-antraciet", 1200, "24d88e85-310d-4f50-8a66-135c1c650988"),
    ("realisatie-elektrisch-rolluik-antraciet", 1200, "34712dec-95ba-4ad4-85fd-7cc03edcd0d4"),
    ("realisatie-pvc-draaikipraam-binnenzicht", 1200, "532b62bc-d017-40d5-ad8d-fc0ea195a4df"),
    ("realisatie-aluminium-schuifraam-tuin", 1200, "2d71e5ee-2f79-4b01-8d80-63f0db9cf36d"),
    ("realisatie-rolluik-handelszaak", 1200, "70a13d4c-2db0-4a49-b332-c90f54baaf81"),
    ("realisatie-dakkapel-aluminium-ramen", 1200, "fb5d1145-a9e4-4b7e-91e1-10a228ddf947"),
    ("realisatie-nieuwbouw-aluminium-ramen-antraciet", 1200, "51558bef-56c0-410a-adcf-2ed23278fbaa"),
]


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for name, max_w, job in IMAGES:
        url = f"{BASE}{job}.png"
        with urllib.request.urlopen(url, timeout=120) as r:
            data = r.read()
        im = Image.open(io.BytesIO(data)).convert("RGB")
        src_size = im.size
        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
        path = os.path.join(OUT, f"{name}.webp")
        im.save(path, "WEBP", quality=78, method=6)
        with open(path, "rb") as f:
            digest = hashlib.md5(f.read()).hexdigest()
        size = os.path.getsize(path)
        manifest.append(f"{name}.webp {im.width}x{im.height} {size} {digest} (source {src_size[0]}x{src_size[1]})")
        print(manifest[-1], flush=True)
    with open(os.path.join(OUT, "MANIFEST.txt"), "w") as f:
        f.write("\n".join(manifest) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
