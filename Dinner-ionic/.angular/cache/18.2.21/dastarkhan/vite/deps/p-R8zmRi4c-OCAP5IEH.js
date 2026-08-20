import {
  c,
  l
} from "./chunk-J62N2ZXR.js";
import {
  e
} from "./chunk-6LH6VVTM.js";
import {
  H,
  P
} from "./chunk-FXTYWXV4.js";
import {
  __async
} from "./chunk-WDMUDEB6.js";

// node_modules/@ionic/core/components/p-R8zmRi4c.js
var n = () => {
  const n2 = window;
  n2.addEventListener("statusTap", () => {
    H(() => {
      const o = document.elementFromPoint(n2.innerWidth / 2, n2.innerHeight / 2);
      if (!o) return;
      const m = l(o);
      m && new Promise((o2) => e(m, o2)).then(() => {
        P(() => __async(void 0, null, function* () {
          m.style.setProperty("--overflow", "hidden"), yield c(m, 300), m.style.removeProperty("--overflow");
        }));
      });
    });
  });
};
export {
  n as startStatusTap
};
/*! Bundled license information:

@ionic/core/components/p-R8zmRi4c.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=p-R8zmRi4c-OCAP5IEH.js.map
