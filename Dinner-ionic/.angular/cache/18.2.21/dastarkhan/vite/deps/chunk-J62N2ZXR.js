import {
  e
} from "./chunk-6LH6VVTM.js";
import {
  a
} from "./chunk-FXTYWXV4.js";
import {
  __async
} from "./chunk-WDMUDEB6.js";

// node_modules/@ionic/core/components/p-D7uN07a3.js
var r = "ion-content";
var e2 = ".ion-content-scroll-host";
var t = `${r}, ${e2}`;
var n = (o) => "ION-CONTENT" === o.tagName;
var a2 = (s) => __async(void 0, null, function* () {
  return n(s) ? (yield new Promise((r2) => e(s, r2)), s.getScrollElement()) : s;
});
var i = (o) => o.querySelector(e2) || o.querySelector(t);
var l = (o) => o.closest(t);
var f = (o) => o.querySelector(e2);
var u = (o) => {
  if (n(o)) return o.querySelector("ion-refresher");
  const s = o.closest(r);
  if (null === s) return null;
  const e3 = f(s);
  return null !== e3 && e3.contains(o) ? s.querySelector("ion-refresher") : null;
};
var c = (o, s) => n(o) ? o.scrollToTop(s) : Promise.resolve(o.scrollTo({
  top: 0,
  left: 0,
  behavior: "smooth"
}));
var h = (o, s, r2, e3) => n(o) ? o.scrollByPoint(s, r2, e3) : Promise.resolve(o.scrollBy({
  top: r2,
  left: s,
  behavior: e3 > 0 ? "smooth" : "auto"
}));
var m = (o) => a(o, r);
var p = (o) => {
  if (n(o)) {
    const s = o.scrollY;
    return o.scrollY = false, s;
  }
  return o.style.setProperty("overflow", "hidden"), true;
};
var v = (o, s) => {
  n(o) ? o.scrollY = s : o.style.removeProperty("overflow");
};

export {
  r,
  e2 as e,
  n,
  a2 as a,
  i,
  l,
  f,
  u,
  c,
  h,
  m,
  p,
  v
};
/*! Bundled license information:

@ionic/core/components/p-D7uN07a3.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=chunk-J62N2ZXR.js.map
