# Görsel kaynakları

- `logo_uret.py`: logo (`assets/logo.svg`), favicon ve sayfaya gömülen sembol (`logo-ic.svg`). Yazı Archivo (wght 800) hatlarından
  yola çevrilir; yazı tipi olmadan da aynı görünür. Gerekli: `fonttools` + `brotli`.
- `sahne-hero.html`: `assets/hero-masa.jpg` ve `assets/hero-mobil.jpg` (sıcak gün batımı + bokeh). Tohumlu rastgele: her çalıştırmada
  aynı görüntü. Gerçek fotoğraf geldiğinde aynı dosya adlarıyla `kaynak/assets/` içine koyup `python3 kaynak/build.py` yeterli;
  okunurluk için `.hero-sahne::after` karartması CSS'tedir.
- `sahne-og.html`: `assets/og.jpg` (1200x630).
- PNG ikonlar (`assets/icons/`): favicon.svg'den Playwright ile üretilir (192, 512, 512 maskable, 180 apple-touch).

Yeniden üretmek için (Chromium + Playwright gerekli):

    node -e "
    const {chromium}=require('playwright');
    (async()=>{
      const b=await chromium.launch();
      for (const [ad,w,h,hash] of [['hero-masa',1600,900,''],['hero-mobil',800,1100,'#mobil']]){
        const p=await b.newPage({viewport:{width:w,height:h}});
        await p.goto('file://'+process.cwd()+'/kaynak/gorsel-kaynak/sahne-hero.html'+hash);
        await p.waitForFunction(()=>document.title==='hazir');
        await p.screenshot({path:'kaynak/assets/'+ad+'.jpg',type:'jpeg',quality:70});
      }
      await b.close();
    })();"
