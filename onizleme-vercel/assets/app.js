/* ============================================================
   europetaxi24: istemci mantigi (app.js)
   - Satir ici JS YOK: sayfa verisi #et-data JSON blogundan okunur.
   - config.js bu dosyadan ONCE yuklenir (ikisi de defer, sirali).
   Iki katmanli mesafe motoru:
     Katman 1: Google Places + Directions (anahtar varsa ve testi gecerse)
     Katman 2: dahili KESIN tablo + haversine x katsayi
   Google calismasa bile site TAM islevsel kalir (kabul kriteri).
   Bolumler: 1 veri, 2 mesafe motoru, 3 Google, 4 form mantigi + 3 adimli sihirbaz,
             5 dogrulama/odeme, 6 sayfa davranisi (baslik, menu)
   ============================================================ */
(function () {
"use strict";

/* ---- Fiyat sabitleri: pay/create.php ile BIREBIR AYNI olmali.
   build.py derlemede esitligi kontrol eder. ---- */
var SABIT = {
  ACILIS: 10.00,        // indi-bindi (EUR)
  KM_UCRET: 1.99,       // km basina (EUR)
  KAPORA_YUZDE: 20,     // on odeme yuzdesi
  YOL_KATSAYI: 1.17,    // haversine -> karayolu katsayisi
  MIN_KM: 1,
  MAX_KM: 800,
  ORT_HIZ: 70           // yedek mod sure tahmini (km/s)
};

/* ---- Sayfa verisi: derlemede #et-data blogu olarak gomulur ---- */
var ET = {};
try { ET = JSON.parse(document.getElementById("et-data").textContent); }
catch (e) { ET = { veri: { yerler: {}, kesin: {} }, soz: {}, dil: "fr", wa: "" }; }
var VERI = ET.veri;      /* {yerler:{anahtar:{a:gorunen ad, l:[lat,lng], h:havalimani, t:[takma adlar]}}, kesin:{"a|b":km}} */
var SOZ = ET.soz;        /* calisma zamani metinleri */
var DIL = ET.dil;
var WA_LINK = ET.wa;

/* ---- yardimcilar ---- */
function $(id){ return document.getElementById(id); }
function paraFormat(n){
  var yerel = DIL === "en" ? "en-GB" : (DIL === "tr" ? "tr-TR" : DIL + "-BE");
  return new Intl.NumberFormat(yerel, {style:"currency", currency:"EUR"}).format(n);
}
function doldur(sablon, degerler){
  return sablon.replace(/\{(\w+)\}/g, function(_, k){
    return (k in degerler) ? degerler[k] : "{" + k + "}";
  });
}
/* Dil tercihi: localStorage SADECE bunun icin kullanilir */
function dilKaydet(d){ try { localStorage.setItem("europa_dil", d); } catch(e){} }
document.querySelectorAll("[data-dil]").forEach(function(a){
  a.addEventListener("click", function(){ dilKaydet(a.getAttribute("data-dil")); });
});
dilKaydet(DIL);

/* ---- hareket tercihi: sistem ayari canli okunur ---- */
var hareketMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
function hareketAzalt(){ return !!(hareketMq && hareketMq.matches); }
function kaydirmaDavranisi(){ return hareketAzalt() ? "auto" : "smooth"; }

/* ============================================================
   2. MESAFE MOTORU
   ============================================================ */
/* metin normallestirme (Python test_adim1.py ile birebir ayni kurallar) */
function normalize(s){
  s = s.toLowerCase().replace(/ı/g,"i").replace(/ß/g,"ss").replace(/œ/g,"oe").replace(/æ/g,"ae");
  s = s.normalize("NFD").replace(/[̀-ͯ]/g,"");
  s = s.replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
  return s;
}

/* eslesme dizini: normalize ad/takma -> yer anahtari */
var ESLESME = {};
Object.keys(VERI.yerler).forEach(function(k){
  VERI.yerler[k].t.forEach(function(t){ ESLESME[t] = k; });
});
function yerBul(girdi){
  var n = normalize(girdi || "");
  if (!n) return null;
  if (ESLESME[n]) return ESLESME[n];
  var hedef = " " + n + " ", enIyi = null, enUzun = 0;
  Object.keys(ESLESME).forEach(function(t){
    if (t.length > enUzun && hedef.indexOf(" " + t + " ") !== -1){ enIyi = ESLESME[t]; enUzun = t.length; }
  });
  return enIyi;
}
function haversineKm(a, b){
  var R = 6371, d2r = Math.PI / 180;
  var dLat = (b[0]-a[0])*d2r, dLng = (b[1]-a[1])*d2r;
  var h = Math.sin(dLat/2)*Math.sin(dLat/2) +
          Math.cos(a[0]*d2r)*Math.cos(b[0]*d2r)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return 2*R*Math.asin(Math.sqrt(h));
}
/* Dahili mesafe: once KESIN tablo, yoksa haversine x katsayi. Bulamazsa null. */
function dahiliMesafe(girdiA, girdiB){
  var ka = yerBul(girdiA), kb = yerBul(girdiB);
  if (!ka || !kb || ka === kb) return null;
  var kesin = VERI.kesin[ka+"|"+kb] || VERI.kesin[kb+"|"+ka];
  if (kesin) return kesin;
  return Math.round(haversineKm(VERI.yerler[ka].l, VERI.yerler[kb].l) * SABIT.YOL_KATSAYI);
}

/* ---- durum ---- */
var durum = {
  mod: "km",              // "km" | "hava"
  km: null,               // hesaplanan mesafe (yoksa fiyat YOK)
  sureDk: null,
  kaynak: null,           // "google" | "dahili"
  arac: "eco",
  googleAktif: false,
  sayac: { yolcu: 1, buyuk: 0, kucuk: 0 }
};
var SAYAC_SINIR = { yolcu: {min:1, max:7}, buyuk: {min:0, max:6}, kucuk: {min:0, max:4} };

/* ---- fiyat paneli guncelle ---- */
var sonToplam = null;        // fiyat degisti mi? (vurgu animasyonu icin)
var vurguErtele = false;     // hizli sekmede kaydirma bitmeden parlama basmasin
function vurgu(){
  var panel = $("fiyat-panel");
  panel.classList.remove("guncel");
  void panel.offsetWidth;    // animasyonu bastan baslat
  panel.classList.add("guncel");
  setTimeout(function(){ panel.classList.remove("guncel"); }, 900);
}
function paneliGuncelle(){
  var panel = $("fiyat-panel");
  var mes = $("p-mesafe"), sur = $("p-sure"), dur = $("p-durum"),
      onlineDetay = $("odeme-online-detay");
  /* data-v="toplam|kapora|kalan": fiyat paneli, adim 2 toplam satiri ve adim 3 ozeti ayni degeri gosterir */
  function degerYaz(ad, metin){
    document.querySelectorAll('[data-v="' + ad + '"]').forEach(function(el){ el.textContent = metin; });
  }
  if (durum.km === null){
    degerYaz("toplam", "—"); degerYaz("kapora", "—"); degerYaz("kalan", "—");
    mes.textContent = "—"; sur.textContent = "—";
    panel.classList.remove("dolu");
    sonToplam = null;
    if (onlineDetay) onlineDetay.textContent = doldur(SOZ.paym_online_d, {deposit:"—", rest:"—"});
    return;
  }
  var toplam = Math.round((SABIT.ACILIS + durum.km * SABIT.KM_UCRET) * 100) / 100;
  var kapora = Math.round(toplam * SABIT.KAPORA_YUZDE) / 100;
  var kalan  = Math.round((toplam - kapora) * 100) / 100;
  degerYaz("toplam", paraFormat(toplam));
  degerYaz("kapora", paraFormat(kapora));
  degerYaz("kalan", paraFormat(kalan));
  mes.textContent = durum.km + " km";
  sur.textContent = durum.sureDk !== null ? ("≈ " + durum.sureDk + " min") : "—";
  if (onlineDetay) onlineDetay.textContent = doldur(SOZ.paym_online_d, {deposit: paraFormat(kapora), rest: paraFormat(kalan)});
  dur.classList.remove("hata");
  dur.textContent = durum.kaynak === "google" ? SOZ.status_google : SOZ.status_fallback;
  panel.classList.add("dolu");
  if (toplam !== sonToplam && !vurguErtele && !hareketAzalt()) vurgu();
  sonToplam = toplam;
}
function fiyatYok(uyari){
  durum.km = null; durum.sureDk = null; durum.kaynak = null;
  paneliGuncelle();
  var dur = $("p-durum");
  if (uyari){ dur.textContent = SOZ.status_unknown; dur.classList.add("hata"); }
  else { dur.textContent = SOZ.status_waiting; dur.classList.remove("hata"); }
}

/* ---- dahili hesap ---- */
function dahiliHesapla(){
  var a = $("f-alis").value, b = $("f-varis").value;
  if (!a.trim() || !b.trim()){ fiyatYok(false); return; }
  var km = dahiliMesafe(a, b);
  if (km === null){ fiyatYok(true); return; }   /* adres taninmadi -> fiyat URETME */
  durum.km = km;
  durum.sureDk = Math.round(km / SABIT.ORT_HIZ * 60);
  durum.kaynak = "dahili";
  paneliGuncelle();
}

/* ============================================================
   3. GOOGLE KATMANI: anahtari haritayi kurmadan ONCE test et
   ============================================================ */
var gSecim = { alis: null, varis: null };   // Autocomplete'ten gelen konumlar
var gServis = null;                          // DirectionsService

function fallbackMode(sebep){
  durum.googleAktif = false;
  gSecim.alis = null; gSecim.varis = null;
  /* Google nesnelerinin enjekte ettigi DOM kalintilarini temizle */
  document.querySelectorAll(".pac-container,.gm-err-container,.gm-style-moc").forEach(function(el){ el.remove(); });
  /* dahili sehir listesini (datalist) geri ac */
  var alis = $("f-alis"), varis = $("f-varis");
  alis.setAttribute("list", "yer-listesi");
  varis.setAttribute("list", "yer-listesi");
  console.warn("Google devre disi: " + sebep);
  dahiliHesapla();
}

function attachGoogle(){
  durum.googleAktif = true;
  $("f-alis").removeAttribute("list");
  $("f-varis").removeAttribute("list");
  gServis = new google.maps.DirectionsService();
  ["alis","varis"].forEach(function(rol){
    var girdi = rol === "alis" ? $("f-alis") : $("f-varis");
    var oto = new google.maps.places.Autocomplete(girdi, {
      fields: ["formatted_address","geometry"],
      componentRestrictions: { country: ["be","de","fr","lu","nl"] }
    });
    oto.addListener("place_changed", function(){
      var yer = oto.getPlace();
      if (yer && yer.geometry && yer.geometry.location){
        if (yer.formatted_address) girdi.value = yer.formatted_address;
        gSecim[rol] = yer.geometry.location;
        googleHesapla();
      } else {
        gSecim[rol] = null;
        hesapla();   /* secim yoksa dahili katman dener */
      }
    });
  });
}

function googleHesapla(){
  if (!gSecim.alis || !gSecim.varis){ hesapla(); return; }
  gServis.route({
    origin: gSecim.alis,
    destination: gSecim.varis,
    travelMode: google.maps.TravelMode.DRIVING
  }, function(sonuc, st){
    if (st === "OK" && sonuc.routes && sonuc.routes[0] && sonuc.routes[0].legs[0]){
      var bacak = sonuc.routes[0].legs[0];
      durum.km = Math.round(bacak.distance.value / 1000);
      durum.sureDk = Math.round(bacak.duration.value / 60);
      durum.kaynak = "google";
      paneliGuncelle();
    } else {
      dahiliHesapla();   /* rota bulunamadi -> dahili tahmin */
    }
  });
}

/* Genel hesap: Google secimleri tamsa Google, degilse dahili */
function hesapla(){
  if (durum.mod !== "km") return;
  if (durum.googleAktif && gSecim.alis && gSecim.varis){ googleHesapla(); return; }
  dahiliHesapla();
}

function initGoogleMaps(){
  if (!(window.google && google.maps && google.maps.places)){ fallbackMode("NO_API"); return; }
  var yanitlandi = false;
  var sayici = setTimeout(function(){
    if (!yanitlandi){ yanitlandi = true; fallbackMode("TIMEOUT"); }
  }, 6000);
  try {
    new google.maps.places.AutocompleteService().getPlacePredictions(
      { input: "Bruxelles", componentRestrictions: { country: ["be"] } },
      function(res, st){
        if (yanitlandi) return;
        yanitlandi = true; clearTimeout(sayici);
        var S = google.maps.places.PlacesServiceStatus;
        (st === S.OK || st === S.ZERO_RESULTS) ? attachGoogle() : fallbackMode(st);
      });
  } catch(e){
    if (!yanitlandi){ yanitlandi = true; clearTimeout(sayici); fallbackMode("EXCEPTION"); }
  }
}
window.initGoogleMaps = initGoogleMaps;
window.gm_authFailure = function(){ fallbackMode("AUTH_FAILURE"); };

/* Anahtar varsa Google betigini yukle; yoksa dogrudan dahili mod */
(function(){
  var cfg = window.EUROPA_CONFIG || {};
  var anahtar = (cfg.googleMapsKey || "").trim();
  if (!anahtar){ fallbackMode("NO_KEY"); return; }
  var b = document.createElement("script");
  b.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(anahtar) +
          "&libraries=places&language=" + DIL + "&callback=initGoogleMaps&loading=async";
  b.async = true;
  b.onerror = function(){ fallbackMode("SCRIPT_ERROR"); };
  document.head.appendChild(b);
})();

/* ============================================================
   4. FORM MANTIGI
   ============================================================ */
/* ---- adres girdileri: yazarak da dahili katman calissin ---- */
var yazmaSayici = null;
["f-alis","f-varis"].forEach(function(id){
  $(id).addEventListener("input", function(){
    var rol = id === "f-alis" ? "alis" : "varis";
    gSecim[rol] = null;   /* elle degisiklik Google secimini gecersiz kilar */
    sekmeTemizle();
    clearTimeout(yazmaSayici);
    yazmaSayici = setTimeout(hesapla, 350);
  });
  $(id).addEventListener("change", hesapla);
});

/* ---- degistir (swap) ---- */
$("btn-swap").addEventListener("click", function(){
  var a = $("f-alis"), b = $("f-varis");
  var t = a.value; a.value = b.value; b.value = t;
  var g = gSecim.alis; gSecim.alis = gSecim.varis; gSecim.varis = g;
  sekmeTemizle();
  hesapla();
});

/* ---- mod secici ---- */
function modAyarla(m){
  durum.mod = m;
  var km = m === "km";
  $("mod-km").setAttribute("aria-pressed", km ? "true" : "false");
  $("mod-hava").setAttribute("aria-pressed", km ? "false" : "true");
  $("fiyat-panel").hidden = !km;
  $("hava-panel").hidden = km;
  $("btn-ileri-1").hidden = !km;
  if (km) hesapla();
}
$("mod-km").addEventListener("click", function(){ modAyarla("km"); });
$("mod-hava").addEventListener("click", function(){ modAyarla("hava"); });

/* Havalimani modu WhatsApp butonu: doldurulan alanlari mesaja ekle */
$("btn-hava-wa").addEventListener("click", function(ev){
  var satirlar = [SOZ.airport_wa_msg];
  var a = $("f-alis").value.trim(), b = $("f-varis").value.trim();
  if (a && b) satirlar.push(doldur(SOZ.wa_route, {from:a, to:b}));
  var t = $("f-tarih").value;
  if (t) satirlar.push(doldur(SOZ.wa_date, {date: tarihYaz(t, $("f-saat").value)}));
  ev.currentTarget.href = WA_LINK + "?text=" + encodeURIComponent(satirlar.join("\n"));
});

/* ---- tarih sinirlari: gecmis tarih secilemesin ---- */
(function(){
  var bugun = new Date();
  var iso = bugun.getFullYear() + "-" +
            String(bugun.getMonth()+1).padStart(2,"0") + "-" +
            String(bugun.getDate()).padStart(2,"0");
  $("f-tarih").min = iso;
  $("f-donus-tarih").min = iso;
  $("f-tarih").addEventListener("change", function(){
    if (this.value) $("f-donus-tarih").min = this.value;
  });
})();
function tarihYaz(tarih, saat){
  if (!tarih) return "";
  var p = tarih.split("-");
  var okunur = p[2] + "." + p[1] + "." + p[0];
  return saat ? doldur(SOZ.dt_join, {date: okunur, time: saat}) : okunur;
}

/* ---- donus alani ---- */
$("f-donus").addEventListener("change", function(){
  $("donus-alani").hidden = !this.checked;
});

/* ---- sayaclar ---- */
function sayacCiz(ad){
  $("s-" + ad).textContent = durum.sayac[ad];
  document.querySelectorAll('[data-sayac="' + ad + '"]').forEach(function(btn){
    var yon = parseInt(btn.getAttribute("data-yon"), 10);
    var yeni = durum.sayac[ad] + yon;
    var s = SAYAC_SINIR[ad];
    btn.classList.toggle("kapali", yeni < s.min || yeni > s.max);
  });
}
document.querySelectorAll("[data-sayac]").forEach(function(btn){
  btn.addEventListener("click", function(){
    var ad = btn.getAttribute("data-sayac");
    var yon = parseInt(btn.getAttribute("data-yon"), 10);
    var s = SAYAC_SINIR[ad];
    var yeni = durum.sayac[ad] + yon;
    if (yeni >= s.min && yeni <= s.max){ durum.sayac[ad] = yeni; sayacCiz(ad); }
  });
});
["yolcu","buyuk","kucuk"].forEach(sayacCiz);

/* ---- arac secimi ---- */
function aracSec(kod){
  durum.arac = kod;
  document.querySelectorAll(".arac-kart").forEach(function(k){
    k.setAttribute("aria-pressed", k.getAttribute("data-arac") === kod ? "true" : "false");
  });
}
document.querySelectorAll(".arac-kart").forEach(function(k){
  k.addEventListener("click", function(){ aracSec(k.getAttribute("data-arac")); });
});
/* Formu ekranda goster: hizli sekmeden geliyorsa ve fiyat zaten gorunuyorsa kaydirma */
function formaKaydir(fiyatGorunuyorsaKalsin){
  var kart = $("rezervasyon"), panel = $("fiyat-panel");
  if (fiyatGorunuyorsaKalsin){
    var r = panel.getBoundingClientRect();
    if (r.top >= 70 && r.bottom <= window.innerHeight - 8) return false;
  }
  kart.scrollIntoView({behavior: kaydirmaDavranisi(), block: "start"});
  return true;
}
/* Filo bolumundeki "Sec ve rezerve et" -> araci sec + forma kaydir */
document.querySelectorAll(".filo-sec").forEach(function(b){
  b.addEventListener("click", function(){
    aracSec(b.getAttribute("data-arac"));
    formaKaydir(false);
  });
});

/* Hero/kapanis CTA ve baslik CTA'si: forma kaydir; imlecli (masaustu) cihazda ilk alana odaklan.
   Dokunmatik cihazda odak vermeyiz (ekran klavyesi ekrani kapatmasin). */
document.querySelectorAll('a[href="#rezervasyon"]:not(.chip)').forEach(function(a){
  a.addEventListener("click", function(ev){
    var kart = $("rezervasyon");
    ev.preventDefault();
    kart.scrollIntoView({behavior: kaydirmaDavranisi(), block: "start"});
    var ince = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (ince) setTimeout(function(){ $("f-alis").focus({preventScroll: true}); }, hareketAzalt() ? 0 : 520);
  });
});

/* ---- rota chip'leri + hizli baslat sekmeleri: rotayi forma yukle ---- */
function sekmeTemizle(){
  document.querySelectorAll(".hizli-sekme[aria-pressed='true']").forEach(function(s){
    s.setAttribute("aria-pressed", "false");
  });
}
document.querySelectorAll(".chip, .hizli-sekme").forEach(function(c){
  c.addEventListener("click", function(ev){
    ev.preventDefault();
    var sekme = c.classList.contains("hizli-sekme");
    var a = c.getAttribute("data-alis"), b = c.getAttribute("data-varis");
    var yuklendi = false;
    if (a && b && VERI.yerler[a] && VERI.yerler[b]){
      gSecim.alis = null; gSecim.varis = null;
      $("f-alis").value = VERI.yerler[a].a;
      $("f-varis").value = VERI.yerler[b].a;
      yuklendi = true;
      sekmeTemizle();
      if (sekme) c.setAttribute("aria-pressed", "true");
      vurguErtele = true;     /* parlama kaydirma bittikten sonra */
      adimGoster(1, false);
      modAyarla("km");
      hesapla();
      vurguErtele = false;
    }
    var kaydi = formaKaydir(sekme);
    if (yuklendi && !hareketAzalt()) setTimeout(vurgu, kaydi ? 480 : 60);
  });
});

/* ============================================================
   5. DOGRULAMA + ODEME
   ============================================================ */
function gecersizTemizle(){
  document.querySelectorAll('#rezervasyon [aria-invalid="true"]').forEach(function(e){ e.removeAttribute("aria-invalid"); });
}
function adimDe(el){
  var a = el && el.closest ? el.closest("[data-adim]") : null;
  return a ? parseInt(a.getAttribute("data-adim"), 10) : adimNo;
}
function hataGoster(mesaj, odak){
  var n = odak ? adimDe(odak) : adimNo;
  if (n !== adimNo) adimGoster(n, false);   /* hatali alan baska adimdaysa oraya don */
  hataTemizle();
  var kutu = document.querySelector('[data-adim-hata="' + n + '"]') || $("hata-kutu");
  kutu.textContent = mesaj;
  void kutu.offsetWidth;          // sarsma animasyonu her hatada yeniden oynasin
  kutu.classList.add("acik");
  if (odak){
    odak.setAttribute("aria-invalid", "true");
    odak.focus({preventScroll: true});
    odak.scrollIntoView({behavior: kaydirmaDavranisi(), block: "center"});
  }
}
function hataTemizle(){
  document.querySelectorAll(".hata-kutu").forEach(function(k){ k.classList.remove("acik"); });
  gecersizTemizle();
}
/* kullanici alani duzeltmeye baslayinca kirmizi vurgu kalkar */
["input", "change"].forEach(function(o){
  $("rezervasyon").addEventListener(o, function(ev){
    if (ev.target && ev.target.removeAttribute) ev.target.removeAttribute("aria-invalid");
  });
});

function epostaGecerli(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
function telefonGecerli(t){ return (t.replace(/\D/g,"").length) >= 8; }

function tarihZaman(tarih, saat){ return new Date(tarih + "T" + saat); }
function adim1Dogrula(){
  if (!$("f-alis").value.trim() || !$("f-varis").value.trim())
    return {mesaj: SOZ.val_route, odak: $("f-alis")};
  if (durum.mod === "km" && durum.km === null)
    return {mesaj: SOZ.val_price, odak: $("f-alis")};
  if (!$("f-tarih").value || !$("f-saat").value)
    return {mesaj: SOZ.val_date, odak: !$("f-tarih").value ? $("f-tarih") : $("f-saat")};
  if (tarihZaman($("f-tarih").value, $("f-saat").value) < new Date())
    return {mesaj: SOZ.val_past, odak: $("f-tarih")};
  if ($("f-donus").checked){
    if (!$("f-donus-tarih").value || !$("f-donus-saat").value)
      return {mesaj: SOZ.val_return, odak: !$("f-donus-tarih").value ? $("f-donus-tarih") : $("f-donus-saat")};
    if (tarihZaman($("f-donus-tarih").value, $("f-donus-saat").value) <= tarihZaman($("f-tarih").value, $("f-saat").value))
      return {mesaj: SOZ.val_return_order, odak: $("f-donus-tarih")};
  }
  return null;
}
function ortakDogrula(){
  var h = adim1Dogrula();
  if (h) return h;
  if (!$("f-iptal").checked)
    return {mesaj: SOZ.val_cancel, odak: $("f-iptal")};
  return null;
}
function iletisimDogrula(){
  if ($("f-ad").value.trim().length < 2) return {mesaj: SOZ.val_name, odak: $("f-ad")};
  if (!epostaGecerli($("f-eposta").value.trim())) return {mesaj: SOZ.val_email, odak: $("f-eposta")};
  if (!telefonGecerli($("f-telefon").value.trim())) return {mesaj: SOZ.val_phone, odak: $("f-telefon")};
  return null;
}

/* ---- 3 adimli sihirbaz: yolculuk -> arac + iletisim -> ozet + odeme ---- */
var adimNo = 1;
function aracAdi(){
  return { eco: SOZ.veh_eco, wagon: SOZ.veh_wagon, vip: SOZ.veh_vip }[durum.arac];
}
function ozetCiz(){
  $("o-alis").textContent = $("f-alis").value.trim() || "—";
  $("o-varis").textContent = $("f-varis").value.trim() || "—";
  $("o-tarih").textContent = tarihYaz($("f-tarih").value, $("f-saat").value) || "—";
  var donus = $("f-donus").checked && $("f-donus-tarih").value;
  $("o-donus-satir").hidden = !donus;
  if (donus) $("o-donus").textContent = tarihYaz($("f-donus-tarih").value, $("f-donus-saat").value);
  $("o-arac").textContent = aracAdi();
  $("o-yolcu").textContent = String(durum.sayac.yolcu);
  var valiz = durum.sayac.buyuk + durum.sayac.kucuk > 0;
  $("o-bag-satir").hidden = !valiz;
  if (valiz) $("o-bag").textContent = durum.sayac.buyuk + " · " + durum.sayac.kucuk;
}
function adimGoster(n, kaydir){
  adimNo = n;
  document.querySelectorAll(".adim").forEach(function(el){
    el.classList.toggle("acik", el.getAttribute("data-adim") === String(n));
  });
  document.querySelectorAll(".adim-cubuk li").forEach(function(li){
    var g = parseInt(li.getAttribute("data-git"), 10);
    li.classList.toggle("on", g === n);
    li.classList.toggle("bitti", g < n);
    if (g === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
  if (n === 3) ozetCiz();
  if (kaydir !== false){
    $("rezervasyon").scrollIntoView({behavior: kaydirmaDavranisi(), block: "start"});
    /* klavye/ekran okuyucu: odak yeni adima tasinsin (dugme gizlenince odak kaybolmasin) */
    var yeni = document.querySelector('.adim[data-adim="' + n + '"]');
    if (yeni){ yeni.setAttribute("tabindex", "-1"); yeni.focus({preventScroll: true}); }
  }
}
$("btn-ileri-1").addEventListener("click", function(){
  hataTemizle();
  var h = adim1Dogrula();
  if (h){ hataGoster(h.mesaj, h.odak); return; }
  adimGoster(2);
});
$("btn-ileri-2").addEventListener("click", function(){ hataTemizle(); adimGoster(3); });
document.querySelectorAll(".btn-geri").forEach(function(b){
  b.addEventListener("click", function(){ hataTemizle(); adimGoster(parseInt(b.getAttribute("data-git"), 10)); });
});
document.querySelectorAll(".adim-cubuk li").forEach(function(li){
  li.addEventListener("click", function(){
    var g = parseInt(li.getAttribute("data-git"), 10);
    if (g < adimNo) adimGoster(g);          /* yalniz geri; ileri gitmek dogrulamadan gecer */
  });
});
/* Enter tusu sayfayi gondermesin; adim 1-2'de "devam" gibi calissin (formda gonder dugmesi yok:
   ortuk gonderme calismaz, bu yuzden Enter dogrudan dinlenir) */
$("rezervasyon").addEventListener("submit", function(ev){ ev.preventDefault(); });
$("rezervasyon").addEventListener("keydown", function(ev){
  if (ev.key !== "Enter" || ev.isComposing) return;
  var hedef = ev.target;
  if (!hedef || hedef.tagName !== "INPUT" || hedef.type === "checkbox") return;
  ev.preventDefault();
  var ileri = $("btn-ileri-" + adimNo);
  if (ileri && !ileri.hidden) ileri.click();
});

/* ---- online ode: POST /pay/create.php (sunucu fiyati YENIDEN hesaplar) ---- */
/* idem: sayfa yuklemesi basina rastgele belirtec; sunucu bunu Mollie'ye Idempotency-Key olarak gonderir,
   boylece cift tiklama/tekrar gonderim ikinci bir odeme yaratmaz. Sunucu 16-64 karakter [A-Za-z0-9-] bekler. */
function yeniIdem(){
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
}
var IDEM = yeniIdem();
var odemeGonderildi = false;
/* Geri tusuyla (bfcache) donuldugunde dugme canli kalsin ve eski belirtec yeni bir denemeye tasinmasin */
window.addEventListener("pageshow", function(ev){
  if (ev.persisted){ odemeGonderildi = false; IDEM = yeniIdem(); }
});
$("btn-online").addEventListener("click", function(){
  if (odemeGonderildi) return;
  hataTemizle();
  var h = ortakDogrula() || iletisimDogrula();   /* iletisim online odemede ZORUNLU */
  if (h){ hataGoster(h.mesaj, h.odak); return; }
  var alanlar = {
    iptal: "1",   /* iptal kosullari onayi (kutu ortakDogrula'da denetlendi); sunucu da ZORUNLU tutar */
    idem: IDEM,
    dil: DIL,
    alis: $("f-alis").value.trim(),
    varis: $("f-varis").value.trim(),
    km: durum.km,
    kaynak: durum.kaynak || "",
    tarih: $("f-tarih").value,
    saat: $("f-saat").value,
    donus_tarih: $("f-donus").checked ? $("f-donus-tarih").value : "",
    donus_saat: $("f-donus").checked ? $("f-donus-saat").value : "",
    yolcu: durum.sayac.yolcu,
    buyuk: durum.sayac.buyuk,
    kucuk: durum.sayac.kucuk,
    arac: durum.arac,
    ad: $("f-ad").value.trim(),
    eposta: $("f-eposta").value.trim(),
    telefon: $("f-telefon").value.trim()
  };
  var f = document.createElement("form");
  f.method = "POST";
  f.action = "/pay/create.php";
  Object.keys(alanlar).forEach(function(k){
    var g = document.createElement("input");
    g.type = "hidden"; g.name = k; g.value = alanlar[k];
    f.appendChild(g);
  });
  document.body.appendChild(f);
  odemeGonderildi = true;
  f.submit();
});

/* ---- WhatsApp ile onayla: bos/yarim satir olmadan mesaj kur ---- */
$("btn-wa").addEventListener("click", function(){
  hataTemizle();
  var h = ortakDogrula();   /* iletisim WhatsApp'ta OPSIYONEL */
  if (h){ hataGoster(h.mesaj, h.odak); return; }
  var aracAd = aracAdi();
  var satirlar = [SOZ.wa_title, ""];
  if (durum.mod === "hava") satirlar.push(SOZ.wa_mode_airport);
  satirlar.push(doldur(SOZ.wa_route, {from: $("f-alis").value.trim(), to: $("f-varis").value.trim()}));
  satirlar.push(doldur(SOZ.wa_date, {date: tarihYaz($("f-tarih").value, $("f-saat").value)}));
  if ($("f-donus").checked && $("f-donus-tarih").value)
    satirlar.push(doldur(SOZ.wa_return, {date: tarihYaz($("f-donus-tarih").value, $("f-donus-saat").value)}));
  satirlar.push(doldur(SOZ.wa_pax, {pax: durum.sayac.yolcu}));
  if (durum.sayac.buyuk > 0 || durum.sayac.kucuk > 0)
    satirlar.push(doldur(SOZ.wa_bags, {big: durum.sayac.buyuk, small: durum.sayac.kucuk}));
  satirlar.push(doldur(SOZ.wa_vehicle, {vehicle: aracAd}));
  if (durum.mod === "km" && durum.km !== null){
    var toplam = Math.round((SABIT.ACILIS + durum.km * SABIT.KM_UCRET) * 100) / 100;
    var kapora = Math.round(toplam * SABIT.KAPORA_YUZDE) / 100;
    satirlar.push(doldur(SOZ.wa_price, {price: paraFormat(toplam)}));
    satirlar.push(doldur(SOZ.wa_deposit, {deposit: paraFormat(kapora)}));
    satirlar.push(doldur(SOZ.wa_rest, {rest: paraFormat(Math.round((toplam-kapora)*100)/100)}));
  }
  var ad = $("f-ad").value.trim(), ep = $("f-eposta").value.trim(), tel = $("f-telefon").value.trim();
  if (ad) satirlar.push(doldur(SOZ.wa_name, {name: ad}));
  if (tel) satirlar.push(doldur(SOZ.wa_phone, {phone: tel}));
  if (ep) satirlar.push(doldur(SOZ.wa_email, {email: ep}));
  /* bos/yarim satir suzgeci: ust uste bos satir birakma */
  var temiz = satirlar.filter(function(s, i){ return !(s === "" && i > 1); });
  window.open(WA_LINK + "?text=" + encodeURIComponent(temiz.join("\n")), "_blank", "noopener");
});

/* baslangic durumu */
paneliGuncelle();

/* ============================================================
   6. SAYFA DAVRANISI: yapiskan baslik, menu, dil menusu
   Hepsi ilerici gelistirme: JS calismazsa <details> ile menu yine acilir/kapanir.
   ============================================================ */
var ust = $("ust");
var menu = $("menu");
function ustOlc(){
  document.documentElement.style.setProperty("--ust-yuk", ust.offsetHeight + "px");
}
ustOlc();
if (window.ResizeObserver) new ResizeObserver(ustOlc).observe(ust);
else window.addEventListener("resize", ustOlc);
function kaydirmaOlayi(){ ust.classList.toggle("kaydi", (window.pageYOffset || 0) > 8); }
window.addEventListener("scroll", kaydirmaOlayi, { passive: true });
kaydirmaOlayi();

function menuKapat(){ if (menu.open){ menu.open = false; } }
menu.addEventListener("toggle", function(){
  document.documentElement.classList.toggle("menu-acik", menu.open);
  menu.querySelector("summary").setAttribute("aria-expanded", menu.open ? "true" : "false");
});
menu.querySelectorAll("a").forEach(function(a){ a.addEventListener("click", menuKapat); });
/* genis ekrana gecilirse acik menu kalmasin (kaydirma kilidi de kalksin) */
if (window.matchMedia){
  var genis = window.matchMedia("(min-width: 1100px)");
  var genisOlay = function(){ if (genis.matches) menuKapat(); };
  if (genis.addEventListener) genis.addEventListener("change", genisOlay); else if (genis.addListener) genis.addListener(genisOlay);
}
document.addEventListener("keydown", function(ev){
  if (ev.key !== "Escape") return;
  var acikMenu = menu.open ? menu : document.querySelector(".dil-menu[open]");
  menuKapat();
  document.querySelectorAll(".dil-menu[open]").forEach(function(d){ d.open = false; });
  if (acikMenu){ var ozet = acikMenu.querySelector("summary"); if (ozet) ozet.focus(); }
});
/* dil menusu: disina tiklaninca kapanir */
document.addEventListener("click", function(ev){
  document.querySelectorAll(".dil-menu[open]").forEach(function(d){ if (!d.contains(ev.target)) d.open = false; });
});

})();
