import {
  i,
  t
} from "./chunk-KTL35EQL.js";
import {
  a,
  h,
  l as l2
} from "./chunk-J62N2ZXR.js";
import {
  d,
  o
} from "./chunk-JRRVO33B.js";
import {
  e,
  l,
  u
} from "./chunk-6LH6VVTM.js";
import "./chunk-FXTYWXV4.js";
import {
  __async
} from "./chunk-WDMUDEB6.js";

// node_modules/@ionic/core/components/p-Cp4GRDqq.js
var l3 = /* @__PURE__ */ new WeakMap();
var u2 = (o2, n, t2, i2 = 0, a2 = false) => {
  l3.has(o2) !== t2 && (t2 ? f(o2, n, i2, a2) : w(o2, n));
};
var f = (o2, n, t2, i2 = false) => {
  const a2 = n.parentNode, r = n.cloneNode(false);
  r.classList.add("cloned-input"), r.tabIndex = -1, i2 && (r.disabled = true);
  const e2 = "rtl" === o2.ownerDocument.dir;
  r.style.insetInlineStart = e2 ? a2.offsetWidth - n.offsetLeft - n.offsetWidth + "px" : `${n.offsetLeft}px`, a2.appendChild(r), l3.set(o2, r);
  const s = e2 ? 9999 : -9999;
  o2.style.pointerEvents = "none", n.style.transform = `translate3d(${s}px,${t2}px,0) scale(0)`;
};
var w = (o2, n) => {
  const t2 = l3.get(o2);
  t2 && (l3.delete(o2), t2.remove()), o2.style.pointerEvents = "", n.style.transform = "";
};
var p = "input, textarea, [no-blur], [contenteditable]";
var m = "$ionPaddingTimer";
var h2 = (o2, n, t2) => {
  const i2 = o2[m];
  i2 && clearTimeout(i2), n > 0 ? o2.style.setProperty("--keyboard-offset", `${n}px`) : o2[m] = setTimeout(() => {
    o2.style.setProperty("--keyboard-offset", "0px"), t2 && t2();
  }, 120);
};
var b = (o2, n, t2) => {
  o2.addEventListener("focusout", () => {
    n && h2(n, 0, t2);
  }, {
    once: true
  });
};
var y = 0;
var S = "data-ionic-skip-scroll-assist";
var D = (o2) => {
  var n;
  if (document.activeElement === o2) return;
  const t2 = o2.getAttribute("id"), i2 = o2.closest(`label[for="${t2}"]`), a2 = null === (n = document.activeElement) || void 0 === n ? void 0 : n.closest(`label[for="${t2}"]`);
  null !== i2 && i2 === a2 || (o2.setAttribute(S, "true"), o2.focus());
};
var v = (o2, n, a2, r, e2, s, d2 = false, c = 0, l4 = true) => __async(void 0, null, function* () {
  if (!a2 && !r) return;
  const f2 = ((o3, n2, t2, i2) => {
    var a3;
    return ((o4, n3, t3, i3) => {
      const a4 = o4.top, r2 = o4.bottom, e3 = n3.top, s2 = e3 + 15, d3 = Math.min(n3.bottom, i3 - t3) - 50 - r2, c2 = s2 - a4, l5 = Math.round(d3 < 0 ? -d3 : c2 > 0 ? -c2 : 0), u3 = Math.min(l5, a4 - e3), f3 = Math.abs(u3);
      return {
        scrollAmount: u3,
        scrollDuration: Math.min(400, Math.max(150, f3 / 0.3)),
        scrollPadding: t3,
        inputSafeY: 4 - (a4 - s2)
      };
    })((null !== (a3 = o3.closest("ion-item,[ion-item]")) && void 0 !== a3 ? a3 : o3).getBoundingClientRect(), n2.getBoundingClientRect(), t2, i2);
  })(o2, a2 || r, e2, c);
  if (a2 && Math.abs(f2.scrollAmount) < 4) return D(n), void (s && null !== a2 && (h2(a2, y), b(n, a2, () => y = 0)));
  if (u2(o2, n, true, f2.inputSafeY, d2), D(n), s && a2 && (y = f2.scrollPadding, h2(a2, y)), "undefined" != typeof window) {
    let r2;
    const e3 = () => __async(void 0, null, function* () {
      void 0 !== r2 && clearTimeout(r2), window.removeEventListener("ionKeyboardDidShow", d3), window.removeEventListener("ionKeyboardDidShow", e3), a2 && (yield h(a2, 0, f2.scrollAmount, f2.scrollDuration)), u2(o2, n, false, f2.inputSafeY), document.activeElement === n && D(n), s && b(n, a2, () => y = 0);
    }), d3 = () => {
      window.removeEventListener("ionKeyboardDidShow", d3), window.addEventListener("ionKeyboardDidShow", e3);
    };
    if (a2) {
      const o3 = yield a(a2);
      if (l4 && f2.scrollAmount > o3.scrollHeight - o3.clientHeight - o3.scrollTop) return "password" === n.type ? (f2.scrollAmount += 50, window.addEventListener("ionKeyboardDidShow", d3)) : window.addEventListener("ionKeyboardDidShow", e3), void (r2 = setTimeout(e3, 1e3));
    }
    e3();
  }
});
var x = (t2, i2) => __async(void 0, null, function* () {
  if (void 0 === o) return;
  const l4 = "ios" === i2, f2 = "android" === i2, w2 = t2.getNumber("keyboardHeight", 290), m2 = t2.getBoolean("scrollAssist", true), h3 = t2.getBoolean("hideCaretOnScroll", l4), b2 = t2.getBoolean("inputBlurring", false), y2 = t2.getBoolean("scrollPadding", true), D2 = Array.from(o.querySelectorAll("ion-input, ion-textarea")), x2 = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakMap(), M = yield t.getResizeMode(), k = (n) => __async(void 0, null, function* () {
    yield new Promise((o2) => e(n, o2));
    const t3 = n.shadowRoot || n, i3 = t3.querySelector("input") || t3.querySelector("textarea"), c = l2(n), l5 = c ? null : n.closest("ion-footer");
    if (i3) {
      if (c && h3 && !x2.has(n)) {
        const o2 = ((o3, n2, t4) => {
          if (!t4 || !n2) return () => {
          };
          const i4 = (t5) => {
            var i5;
            (i5 = n2) === i5.getRootNode().activeElement && u2(o3, n2, t5);
          }, a2 = () => u2(o3, n2, false), s = () => i4(true), d2 = () => i4(false);
          return l(t4, "ionScrollStart", s), l(t4, "ionScrollEnd", d2), n2.addEventListener("blur", a2), () => {
            u(t4, "ionScrollStart", s), u(t4, "ionScrollEnd", d2), n2.removeEventListener("blur", a2);
          };
        })(n, i3, c);
        x2.set(n, o2);
      }
      if ("date" !== i3.type && "datetime-local" !== i3.type && (c || l5) && m2 && !K.has(n)) {
        const t4 = ((n2, t5, i4, a2, r, e2, s, c2 = false) => {
          const l6 = e2 && (void 0 === s || s.mode === i.None);
          let u3 = false;
          const f3 = void 0 !== d ? d.innerHeight : 0, w3 = (o2) => {
            false !== u3 ? v(n2, t5, i4, a2, o2.detail.keyboardHeight, l6, c2, f3, false) : u3 = true;
          }, p2 = () => {
            u3 = false, null == d || d.removeEventListener("ionKeyboardDidShow", w3), n2.removeEventListener("focusout", p2);
          }, m3 = () => __async(void 0, null, function* () {
            t5.hasAttribute(S) ? t5.removeAttribute(S) : (v(n2, t5, i4, a2, r, l6, c2, f3), null == d || d.addEventListener("ionKeyboardDidShow", w3), n2.addEventListener("focusout", p2));
          });
          return n2.addEventListener("focusin", m3), () => {
            n2.removeEventListener("focusin", m3), null == d || d.removeEventListener("ionKeyboardDidShow", w3), n2.removeEventListener("focusout", p2);
          };
        })(n, i3, c, l5, w2, y2, M, f2);
        K.set(n, t4);
      }
    }
  });
  b2 && (() => {
    let o2 = true, n = false;
    const t3 = document;
    l(t3, "ionScrollStart", () => {
      n = true;
    }), t3.addEventListener("focusin", () => {
      o2 = true;
    }, true), t3.addEventListener("touchend", (i3) => {
      if (n) return void (n = false);
      const a2 = t3.activeElement;
      if (!a2) return;
      if (a2.matches(p)) return;
      const r = i3.target;
      r !== a2 && (r.matches(p) || r.closest(p) || (o2 = false, setTimeout(() => {
        o2 || a2.blur();
      }, 50)));
    }, false);
  })();
  for (const o2 of D2) k(o2);
  o.addEventListener("ionInputDidLoad", (o2) => {
    k(o2.detail);
  }), o.addEventListener("ionInputDidUnload", (o2) => {
    ((o3) => {
      if (h3) {
        const n = x2.get(o3);
        n && n(), x2.delete(o3);
      }
      if (m2) {
        const n = K.get(o3);
        n && n(), K.delete(o3);
      }
    })(o2.detail);
  });
});
export {
  x as startInputShims
};
/*! Bundled license information:

@ionic/core/components/p-Cp4GRDqq.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=p-Cp4GRDqq-SN47ETSC.js.map
