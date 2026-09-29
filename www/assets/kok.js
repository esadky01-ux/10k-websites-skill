/* Kok yonlendirme: once kayitli tercih, sonra tarayici dili, yoksa /fr/.
   Sunucu tarafi dil algilama YOKTUR (Googlebot icin sart); yalniz tarayici JS'i. */
(function () {
  var diller = ["fr", "nl", "en", "tr"], hedef = null;
  try { hedef = localStorage.getItem("europa_dil"); } catch (e) {}
  if (diller.indexOf(hedef) === -1) {
    hedef = null;
    var tercihler = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < tercihler.length && !hedef; i++) {
      var kod = String(tercihler[i]).slice(0, 2).toLowerCase();
      if (diller.indexOf(kod) !== -1) hedef = kod;
    }
  }
  location.replace("/" + (hedef || "fr") + "/");
})();
