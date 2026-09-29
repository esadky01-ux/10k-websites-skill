# Görsel kaynakları

`sahne-hero.html`, `assets/hero-masa.jpg` ve `assets/hero-mobil.jpg` dosyalarının kaynağıdır:
gece Brüksel bokeh atmosferi + ıslak asfalt yansıması (yalnız ışık; hız çizgileri BİLEREK
görselde yok, onlar sitede saf CSS ile canlanır: `site.css` içindeki `.hiz`, `.iz`, `.kosu`).
Gerçek fotoğraf (gece Brüksel + siyah Tesla) geldiğinde aynı dosya adlarıyla
`kaynak/assets/` içine koyup `python3 kaynak/build.py` çalıştırmak yeterlidir; okunurluk için
sol/alt karartma CSS'te (`.hero-sahne::after`) olduğu için fotoğraf doğrudan kullanılabilir.
Fotoğraf gelince `template.html` içindeki hero `<img alt="">` değerini `alt="{{alt_hero}}"` yapın.

Yeniden üretmek için (Chromium + Playwright gerekli). `sahne-hero.html` tohumlu rastgele sayı
kullanır: her çalıştırmada AYNI görüntü çıkar.

    node -e "
    const {chromium}=require('playwright');
    (async()=>{
      const b=await chromium.launch();
      for (const [ad,w,h,hash] of [['hero-masa',1600,900,''],['hero-mobil',800,1100,'#mobil']]){
        const p=await b.newPage({viewport:{width:w,height:h}});
        await p.goto('file://'+process.cwd()+'/kaynak/gorsel-kaynak/sahne-hero.html'+hash);
        await p.waitForFunction(()=>document.title==='hazir');
        await p.screenshot({path:'kaynak/assets/'+ad+'.jpg',type:'jpeg',quality:72});
      }
      await b.close();
    })();"

`sahne-og.html` (sosyal paylaşım görseli, `og.jpg`) ayrı: `npx playwright screenshot --viewport-size=1200,630 sahne-og.html og.jpg`
