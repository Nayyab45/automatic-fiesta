#!/usr/bin/env python3
"""
Subset the Material Symbols Outlined variable font down to just the icons this
app actually references.

The upstream font from the `material-symbols` package carries all ~6,600 Google
icons (3.96 MB). This app uses ~120 of them, so shipping the whole file wastes
nearly 4 MB on every web/PWA load and inside the Android bundle. Subsetting
brings it to ~140 KB.

Icon names are read straight out of the source so this stays correct as screens
change:

    npm run build:icons     regenerate the subset
    npm run verify:icons    fail if the source uses an icon the subset lacks
                            (wired into `npm run build`)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
UPSTREAM = ROOT / "node_modules" / "material-symbols" / "material-symbols-outlined.woff2"
OUT = SRC / "theme" / "fonts" / "material-symbols-outlined-subset.woff2"
# woff2 compression strips glyph names, so --check compares against this
# manifest of what went in rather than reading the font back.
MANIFEST = OUT.with_suffix(".json")

# <span class="material-symbols-outlined ...">icon_name</span>
ICON_RE = re.compile(r"material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*<")

# Not every icon is literal in the markup: some are supplied as data and bound
# with {{ item.icon }} -- nav items, what's-new entries, error states. Those are
# invisible to ICON_RE, so `icon: 'name'` properties are scanned for as well.
# Missing one here means the glyph is dropped from the subset and the icon
# silently renders as its own name in text, which is how `manage_accounts`
# escaped the first version of this script.
ICON_PROP_RE = re.compile(r"""\bicon\s*:\s*['"]([a-z0-9_]+)['"]""")


def used_icons():
    found = set()
    for path in list(SRC.rglob("*.html")) + list(SRC.rglob("*.ts")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        found |= set(ICON_RE.findall(text))
        found |= set(ICON_PROP_RE.findall(text))
    return found


def shaping_selftest(subset_path, icons):
    """
    Confirm each icon name still collapses into a single real glyph.

    Subsetting an icon font is easy to get silently wrong: keeping the icon
    glyphs but dropping the letter glyphs the `liga` rules consume yields a
    valid font in which every icon renders blank. Nothing but shaping catches
    that, so shape every name and demand exactly one non-.notdef glyph.
    """
    try:
        import uharfbuzz as hb
    except ImportError:
        print("NOTE: uharfbuzz not installed, skipping shaping self-test "
              "(pip install uharfbuzz to enable).", file=sys.stderr)
        return True

    from fontTools.ttLib import TTFont
    tmp = subset_path.with_name("_shapecheck.ttf")
    f = TTFont(subset_path)
    f.flavor = None
    f.save(tmp)
    try:
        font = hb.Font(hb.Face(hb.Blob.from_file_path(tmp)))
        bad = []
        for name in icons:
            buf = hb.Buffer()
            buf.add_str(name)
            buf.guess_segment_properties()
            hb.shape(font, buf, {"liga": True})
            gids = [g.codepoint for g in buf.glyph_infos]
            if len(gids) != 1 or gids[0] == 0:
                bad.append(name)
    finally:
        tmp.unlink(missing_ok=True)

    if bad:
        print(f"ERROR: {len(bad)} icon(s) do not shape to a glyph and would "
              f"render blank: {', '.join(bad[:10])}", file=sys.stderr)
        return False
    print(f"shaping self-test: all {len(icons)} icons resolve to a single glyph.")
    return True


def main():
    from fontTools.ttLib import TTFont

    icons = used_icons()
    if not icons:
        print("ERROR: no icon names found -- has the markup changed?", file=sys.stderr)
        return 1

    available = set(TTFont(UPSTREAM).getGlyphOrder())
    missing = sorted(i for i in icons if i not in available)
    if missing:
        # Usually a legacy Material *Icons* name (bookmark_border, location_on).
        # Material Symbols dropped the _border/_outline/_none suffixes; the
        # unfilled look is the FILL axis instead. These render blank if left.
        print(f"WARNING: {len(missing)} icon name(s) are not in the font and will "
              f"render blank: {', '.join(missing)}", file=sys.stderr)

    keep_icons = sorted(i for i in icons if i in available)

    if "--check" in sys.argv:
        if not (OUT.exists() and MANIFEST.exists()):
            print("ERROR: subset font missing -- run: npm run build:icons", file=sys.stderr)
            return 1
        built = set(json.loads(MANIFEST.read_text(encoding="utf-8"))["icons"])
        absent = sorted(set(keep_icons) - built)
        if absent:
            print(f"ERROR: {len(absent)} icon(s) used in the source are missing from "
                  f"the subset font: {', '.join(absent[:10])}", file=sys.stderr)
            print("Run: npm run build:icons", file=sys.stderr)
            return 1
        print(f"OK: subset font covers all {len(keep_icons)} icons in use.")
        return 0

    # `.fill` alternates back the `.filled` helper class in global.scss.
    keep = keep_icons + [f"{i}.fill" for i in keep_icons if f"{i}.fill" in available]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(UPSTREAM),
            "--glyphs=" + ",".join(keep),
            # The icon glyphs alone are not enough. An icon renders because the
            # literal text "restaurant_menu" gets substituted by a `liga` rule,
            # so the LETTER glyphs that rule consumes must survive too -- drop
            # them and every icon silently renders blank.
            "--text=abcdefghijklmnopqrstuvwxyz0123456789_",
            "--layout-features+=liga",
            # ...but without closure, or the subsetter follows those same liga
            # lookups from the letters and drags all 6,600 icons back in.
            "--no-layout-closure",
            # FILL/GRAD/opsz/wght axes stay: global.scss drives them via
            # font-variation-settings.
            "--flavor=woff2",
            "--output-file=" + str(OUT),
        ],
        check=True,
    )
    MANIFEST.write_text(json.dumps({"icons": keep_icons}, indent=2) + "\n", encoding="utf-8")

    if not shaping_selftest(OUT, keep_icons):
        return 1

    before, after = UPSTREAM.stat().st_size, OUT.stat().st_size
    print(f"{len(keep_icons)} icons -> {len(keep)} glyphs kept")
    print(f"{before / 1e6:.2f} MB -> {after / 1024:.1f} KB "
          f"({100 * (1 - after / before):.1f}% smaller)  {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
