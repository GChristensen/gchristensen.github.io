// Draws the overview cover: a desk scene modelled in 3D and projected without
// perspective, so every flat surface is an affine image of its 2D artwork.
// The artwork for the screens lives in html/overview.html (the hidden <svg> in .cover).
//
// To try other angles open html/overview.html?tune for sliders, or pass the
// values directly: html/overview.html?yaw=30&pitch=15. Then copy them to VIEW.
(function () {
    "use strict";

    const VIEW = {
        yaw: 22,      // degrees; positive looks from the right, negative from the left
        pitch: 20,    // degrees above the horizon
        spread: 14,   // how far the side monitors turn inward
        explode: 1    // scales how far the panes float in front of the screens
    };

    const SITE = "https://gchristensen.github.io/#";
    const RAD = Math.PI / 180;
    const ACCENT = "oklch(80% 0.04 245)";
    // one colour per program: its callout, and its pane if it has one
    const TINT = {
        tabs: "oklch(74% 0.13 250)", torrent: "oklch(76% 0.15 155)", enso: "oklch(86% 0.14 125)",
        retreat: "oklch(78% 0.12 355)", emacs: "oklch(74% 0.13 305)", server: "oklch(86% 0.14 95)",
        bench: "oklch(76% 0.11 205)", scrapyard: "oklch(74% 0.15 55)", ishell: "oklch(80% 0.11 180)",
        news: "oklch(80% 0.13 75)", silent: "oklch(72% 0.13 280)", slideshow: "oklch(74% 0.16 335)",
        sunlight: "oklch(90% 0.06 215)", scarlett: "oklch(68% 0.19 25)"
    };

    const query = new URLSearchParams(location.search);
    for (const key of Object.keys(VIEW))
        if (query.has(key) && !isNaN(parseFloat(query.get(key))))
            VIEW[key] = parseFloat(query.get(key));

    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
    const n1 = x => +x.toFixed(1);
    const LIGHT = norm([-0.35, 0.8, 0.5]);
    const TOPY = 300;   // height of the table top

    let cy, sy, cp, sp, cam, bb, defs, uid;

    function track(x, y) {
        if (x < bb.x0) bb.x0 = x;
        if (x > bb.x1) bb.x1 = x;
        if (y < bb.y0) bb.y0 = y;
        if (y > bb.y1) bb.y1 = y;
    }

    // world: x right, y up, z toward the viewer
    function raw(p) {
        const z1 = p[0] * sy + p[2] * cy;
        return [p[0] * cy - p[2] * sy, -(p[1] * cp - z1 * sp)];
    }

    function P(p) {
        const s = raw(p);
        track(s[0], s[1]);
        return s;
    }

    const depth = p => dot(p, cam);
    const pts = (list, proj) => list.map(p => { const s = (proj || P)(p); return n1(s[0]) + "," + n1(s[1]); }).join(" ");

    // a local frame turned around the vertical axis
    function frame(ox, oy, oz, angle) {
        const c = Math.cos((angle || 0) * RAD), s = Math.sin((angle || 0) * RAD);
        const f = (x, y, z) => [ox + x * c + z * s, oy + y, oz - x * s + z * c];
        f.dir = (x, y, z) => [x * c + z * s, y, -x * s + z * c];
        return f;
    }

    function sub(f, dx, dy, dz) {
        const g = (x, y, z) => f(x + dx, y + dy, z + dz);
        g.dir = f.dir;
        return g;
    }

    const col = (m, k) => `oklch(${n1(Math.min(96, m.l * k))}% ${m.c === undefined ? 0.006 : m.c} ${m.h || 265})`;

    // the visible faces of a box, shaded by their normals
    function box(f, a, b, m) {
        const [x0, y0, z0] = a, [x1, y1, z1] = b;
        const faces = [
            [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
            [[0, 0, -1], [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]],
            [[1, 0, 0], [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]],
            [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
            [[0, 1, 0], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]],
            [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]]
        ];
        let s = "";
        for (const [n, corners] of faces) {
            const wn = f.dir(...n);
            if (dot(wn, cam) <= 0.001) continue;
            const k = 0.62 + 0.5 * Math.max(0, dot(wn, LIGHT));
            s += `<polygon points="${pts(corners.map(q => f(...q)))}" fill="${col(m, k)}" stroke="${col(m, k + 0.14)}" stroke-width=".7" stroke-linejoin="round"/>`;
        }
        return s;
    }

    // matrix that maps plane-local 2D coordinates (origin o, axes u and v) to the picture
    function mat(o, u, v) {
        const s = P(o), a = raw(u), b = raw(v);
        const r = x => +x.toFixed(4);
        return `matrix(${r(a[0])} ${r(a[1])} ${r(b[0])} ${r(b[1])} ${n1(s[0])} ${n1(s[1])})`;
    }

    const plane = (o, u, v, inner) => `<g transform="${mat(o, u, v)}">${inner}</g>`;

    // an upright cylinder standing on c
    function cyl(c, r, h, m) {
        const b = P(c), t = P([c[0], c[1] + h, c[2]]), ry = r * sp;
        track(b[0] - r, b[1] + ry);
        track(t[0] + r, t[1] - ry);
        const id = "cv-g" + (uid++);
        defs += `<linearGradient id="${id}"><stop offset="0" stop-color="${col(m, 0.6)}"/><stop offset=".35" stop-color="${col(m, 1.08)}"/><stop offset="1" stop-color="${col(m, 0.55)}"/></linearGradient>`;
        const op = m.o ? ` fill-opacity="${m.o}"` : "";
        return `<path d="M${n1(b[0] - r)} ${n1(b[1])}L${n1(t[0] - r)} ${n1(t[1])}A${r} ${n1(ry)} 0 0 1 ${n1(t[0] + r)} ${n1(t[1])}L${n1(b[0] + r)} ${n1(b[1])}A${r} ${n1(ry)} 0 0 1 ${n1(b[0] - r)} ${n1(b[1])}z" fill="url(#${id})"${op}/>` +
            `<ellipse cx="${n1(t[0])}" cy="${n1(t[1])}" rx="${r}" ry="${n1(ry)}" fill="${col(m, 0.95)}" stroke="${col(m, 1.25)}" stroke-width=".8"${op}/>`;
    }

    function art(id) {
        const g = document.getElementById(id);
        return `<g transform="${g.getAttribute("transform") || ""}">${g.innerHTML}</g>`;
    }

    const shadow = (list, blur, fill, opacity) =>
        `<polygon points="${pts(list, raw)}" fill="${fill || "#000"}" opacity="${opacity}" filter="url(#cv-blur${blur})"/>`;

    const tieLines = (pairs, c) => {
        const d = pairs.map(([a, b]) => `M${n1(a[0])} ${n1(a[1])}L${n1(b[0])} ${n1(b[1])}`).join("");
        return `<path class="tie case" d="${d}"/><path class="tie" style="stroke: ${c}" d="${d}"/>`;
    };

    // Each layered program is pulled off its screen and floats upright far in front of it, every pane at
    // its own distance so that they overlap as little as possible. A tinted outline stays on the screen
    // where the item belongs, and dashed lines tie its corners to the pane.
    // panes: [{c, r: [x, y, w, h] the place on the screen, d: distance, dx: sideways shift, s: scale,
    //          ghost: false leaves no outline on the screen,
    //          lead: [[x, y] on the screen, [x, y] on the pane] draws one solid leader instead of the ties, html}]
    function monitor(f, artId, panes) {
        const u = f.dir(1, 0, 0), v = f.dir(0, -1, 0);
        const at = (x, y) => P(f(-150 + x, 263 - y, 8.3));
        let layer = "", ghosts = "", low = -1e9;
        const far = panes.map(p => {
            const [rx, ry, rw, rh] = p.r, s = p.s || 1, w = rw * s, h = rh * s;
            const x0 = -150 + rx + rw / 2 - w / 2 + (p.dx || 0), y0 = 263 - ry - rh / 2 + h / 2;
            const corner = (x, y) => f(x0 + x, y0 - y, 8.3 + p.d * VIEW.explode);
            if (p.ghost !== false) ghosts += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${p.c}" fill-opacity=".12" stroke="${p.c}" stroke-width="1.300"/>`;
            const ties = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => [at(rx + i * rw, ry + j * rh), P(corner(i * w, j * h))]);
            low = Math.max(low, ties[2][1][1], ties[3][1][1]);
            let lead = "";
            if (p.lead) {   // one solid leader from a spot on the screen to a spot on the pane instead of the corner ties
                const a = at(...p.lead[0]), b = P(corner((p.lead[1][0] - rx) * s, (p.lead[1][1] - ry) * s));
                const d = `M${n1(a[0])} ${n1(a[1])}L${n1(b[0])} ${n1(b[1])}`;
                lead = `<g class="link lead" style="--c: ${p.c}"><path class="case" d="${d}"/><path d="${d}"/>` +
                    `<circle cx="${n1(a[0])}" cy="${n1(a[1])}" r="2.600"/><circle cx="${n1(b[0])}" cy="${n1(b[1])}" r="2.600"/></g>`;
            }
            layer += (p.lead ? "" : tieLines(ties, p.c)) +
                `<g transform="${mat(corner(0, 0), u.map(q => q * s), v.map(q => q * s))}">` +
                `<rect width="${rw}" height="${rh}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="${n1(3.4 / s)}"/>` +
                `<rect width="${rw}" height="${rh}" fill="${p.c}" fill-opacity=".1" stroke="${p.c}" stroke-width="${n1(1.4 / s)}"/>` +
                `<g transform="translate(${-rx} ${-ry})">${p.html}</g></g>` + lead;
            return (x, y) => P(corner((x - rx) * s, (y - ry) * s));
        });
        return {
            d: depth(f(0, 160, 0)),
            at, far, low,
            under: shadow([f(-64, 0.2, -50), f(68, 0.2, -50), f(68, 0.2, 46), f(-64, 0.2, 46)], 4, "#000", 0.5) +
                shadow([f(-150, 0.2, 14), f(150, 0.2, 14), f(175, 0.2, 150), f(-175, 0.2, 150)], 14, ACCENT, 0.09),
            s: box(f, [-60, 0, -45], [60, 8, 45], {l: 27}) +
                box(f, [-16, 8, -17], [16, 120, -5], {l: 25}) +
                box(f, [-156, 62, -5], [156, 269, 8], {l: 19}) +
                plane(f(-150, 263, 8.3), u, v,
                    `${art(artId)}${ghosts}<rect width="300" height="195" fill="url(#cv-glare)"/>` +
                    `<circle cx="292" cy="198.500" r="1.200" fill="${ACCENT}"/>`),
            layer
        };
    }

    // Enso Retreat: pastel stars all over the screen and the break timer
    function retreatStars() {
        let seed = 11;
        const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
        const colors = ["#7fb2f0", "#f08a9a", "#f5d04e", "#7fd08a", "#b79af0", "#f0a860"];
        let s = `<text x="8" y="21" fill="#f0453a" style="font: 700 16px var(--sans)">00:50</text>`;
        for (let i = 0; i < 46; i++) {
            const x = 8 + rnd() * 284, y = 8 + rnd() * 179, r = 0.45 + rnd() * 0.75, turn = Math.round(rnd() * 72);
            s += `<use href="#cv-star5" transform="translate(${n1(x)} ${n1(y)}) rotate(${turn}) scale(${n1(r)})" fill="${colors[i % 6]}" fill-opacity=".85"/>`;
        }
        return s + `<use href="#cv-star5" transform="translate(117 150) scale(1.200)" fill="#f08a9a" fill-opacity=".9"/>`;
    }

    // a beam-forming bar: a row of capsules behind a grille, turned toward the seat
    function micArray(x, z) {
        const y = TOPY, f = frame(x, y, z, -16), ux = f.dir(1, 0, 0), up = f.dir(0, -1, 0);
        return {
            d: depth([x, y + 50, z]),
            target: P(f(0, 72, 10.3)),
            under: shadow([[x - 26, y + 0.2, z - 24], [x + 32, y + 0.2, z - 24], [x + 32, y + 0.2, z + 22], [x - 26, y + 0.2, z + 22]], 4, "#000", 0.5),
            s: cyl([x, y, z], 26, 5, {l: 26}) + cyl([x, y + 5, z], 3.5, 58, {l: 42}) +
                box(f, [-50, 62, -10], [50, 82, 10], {l: 24}) +
                plane(f(-50, 82, 10.3), ux, up,
                    `<path d="M6 5h82M6 10h82M6 15h82" stroke="oklch(58% 0.008 265)" stroke-width="2.400" stroke-dasharray="1.200 2.600"/>` +
                    `<circle cx="94" cy="10" r="1.500" fill="${ACCENT}"/>`)
        };
    }

    const FAN = (cx, cy, r) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="oklch(14% 0.006 265)" stroke="oklch(60% 0.008 265)" stroke-width="1.5"/>` +
        `<path d="M${cx} ${cy - r}v${2 * r}M${cx - r} ${cy}h${2 * r}M${cx - r * 0.7} ${cy - r * 0.7}l${r * 1.4} ${r * 1.4}M${cx + r * 0.7} ${cy - r * 0.7}l${-r * 1.4} ${r * 1.4}" stroke="oklch(55% 0.008 265)" fill="none"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="oklch(40% 0.008 265)"/>`;

    // Feedxcavator: the bucket wheel of a rotary excavator with a stub of its boom, in a 104 x 104 box
    function bucketWheel() {
        const c = 52, at = (r, a) => n1(c + r * Math.cos(a)) + " " + n1(c + r * Math.sin(a));
        let teeth = "", lines = "";
        for (let i = 0; i < 14; i++) {
            const a = i * Math.PI / 7;
            teeth += `M${at(38, a)}Q${at(45, a + 0.08)} ${at(48, a + 0.36)}L${at(38, a + 0.3)}z`;
        }
        for (let i = 0; i < 36; i++) lines += `M${at(31, i * 10 * RAD)}L${at(37, i * 10 * RAD)}`;
        for (let i = 0; i < 12; i++)
            lines += `M${at(9, i * 30 * RAD)}L${at(19, i * 30 * RAD)}M${at(21, (i * 30 + 15) * RAD)}L${at(29, (i * 30 + 15) * RAD)}`;
        return `<g class="xcv" opacity=".85"><circle cx="52" cy="52" r="38" fill="oklch(78% 0.12 75 / 0.08)"/>` +
            `<path d="${teeth}" fill="oklch(78% 0.12 75 / 0.3)" stroke-width="1.200"/>` +
            `<circle cx="52" cy="52" r="30"/><circle cx="52" cy="52" r="20"/><circle cx="52" cy="52" r="8"/>` +
            `<path d="${lines}" stroke-width="1"/>` +
            `<path d="M47 45L3 24M42 60L3 46M3 24V46M13 29L17 51L27 36L31 55L41 42" stroke-width="1.400"/></g>`;
    }

    // the stand with the switch, the server and the laptop; returns its picture and the callout targets
    function stand() {
        const H = 340, BASE = 74;   // height of the stand, and of the shelf the server stands on
        const S = frame(-110, 0, -20), V = sub(S, -96, BASE, -85);
        const ux = S.dir(1, 0, 0), up = S.dir(0, -1, 0), uz = S.dir(0, 0, 1);
        const post = (x, z) => box(S, [x, 0, z], [x + 10, H, z + 10], {l: 40});
        const shelf = y => box(S, [-120, y - 8, -110], [120, y, 110], {l: 31});
        let s = post(-120, -110) + post(110, -110) + shelf(28);

        // network switch on the lowest shelf
        let ports = "";
        for (let i = 0; i < 16; i++) {
            const x = 34 + i * 9.5 + (i > 7 ? 5 : 0);
            ports += `<rect x="${x}" y="6" width="7.500" height="8" fill="oklch(10% 0.006 265)" stroke="oklch(48% 0.008 265)" stroke-width=".6"/>` +
                `<circle cx="${x + 1.5}" cy="17" r="1" fill="oklch(80% 0.17 ${i % 5 === 3 ? 80 : 145})"${i % 7 === 5 ? ' opacity=".25"' : ""}/>`;
        }
        s += box(S, [-100, 28, -40], [100, 50, 96], {l: 27}) +
            plane(S(-100, 50, 96.2), ux, up,
                `<path class="b dim" d="M8 8h14M8 14h9" stroke-width="2"/>${ports}` +
                `<rect x="176" y="5" width="16" height="6" fill="oklch(10% 0.006 265)" stroke="oklch(48% 0.008 265)" stroke-width=".6"/>`) +
            shelf(BASE);

        // open frame case: the three edges behind everything first, the rest last
        const corner = i => V(i & 1 ? 192 : 0, i & 2 ? 232 : 0, i & 4 ? 170 : 0);
        let far = 0;
        for (let i = 1; i < 8; i++) if (depth(corner(i)) < depth(corner(far))) far = i;
        let back = "", front = "";
        for (let i = 0; i < 8; i++)
            for (const bit of [1, 2, 4]) {
                if (i & bit) continue;
                const a = P(corner(i)), b = P(corner(i | bit));
                const hidden = i === far || (i | bit) === far;
                const line = `<line x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}" stroke="oklch(${hidden ? 38 : 60}% 0.008 265)" stroke-width="4" stroke-linecap="round"/>`;
                if (hidden) back += line; else front += line;
            }
        s += back;

        // bottom row: power supply at the left, two drives at the right
        s += box(V, [8, 0, 24], [92, 56, 134], {l: 22}) +
            plane(V(8, 56, 134.2), ux, up, FAN(28, 28, 22) +
                `<path d="M58 14h18M58 20h18M58 26h18" stroke="oklch(55% 0.008 265)"/>` +
                `<rect x="60" y="36" width="14" height="10" fill="oklch(10% 0.006 265)" stroke="oklch(50% 0.008 265)" stroke-width=".8"/>`);
        for (const y of [4, 30])
            s += box(V, [104, y, 30], [184, y + 20, 130], {l: 38}) +
                plane(V(104, y + 20, 130.2), ux, up,
                    `<circle cx="7" cy="10" r="1.800" fill="oklch(80% 0.17 145)"/><path class="b dim" d="M18 10h40" stroke-width="2"/>`);

        // motherboard: fills the back wall above them
        s += box(V, [8, 64, 16], [184, 226, 20], {l: 30, c: 0.05, h: 165});
        s += plane(V(8, 226, 20.2), ux, up,
            `<path d="M26 44h30M26 50h30M26 56h30M26 96h126M26 102h90M158 20v70M164 20v70" stroke="oklch(46% 0.07 165)" fill="none"/>` +
            `<path d="M28 146h112M28 154h112" stroke="oklch(70% 0.008 265)" stroke-width="3"/>` +
            `<path d="M160 26h10v44h-10zM30 66h14v14h-14zM50 70h8v8h-8zM148 142h18v14h-18zM4 150h8v8h-8zM112 4h8v8h-8z" fill="oklch(50% 0.04 165)"/>`);
        s += box(V, [8, 152, 20], [28, 224, 46], {l: 45}) + box(V, [36, 196, 20], [62, 222, 34], {l: 36});

        // graphics card
        s += box(V, [8, 86, 20], [172, 112, 122], {l: 25});
        s += plane(V(8, 112.2, 20), ux, uz, FAN(44, 51, 34) + FAN(120, 51, 34));
        s += plane(V(8, 112, 122.2), ux, up,
            `<path d="M10 8h64" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round"/><path class="b dim" d="M10 19h40M116 19h38" stroke-width="2"/>`);

        // cooler and memory: whichever is farther from the camera first
        const parts = [
            [94, box(V, [70, 150, 20], [118, 206, 70], {l: 31}) + plane(V(70, 206, 70.2), ux, up, FAN(24, 28, 21))],
            [143, [0, 1, 2, 3].map(i => box(V, [126 + 9 * i, 140, 20], [130 + 9 * i, 214, 38], {l: 50})).join("")]
        ];
        parts.sort((a, b) => sy >= 0 ? a[0] - b[0] : b[0] - a[0]);
        s += parts.map(p => p[1]).join("") + front;

        s += shelf(H) + post(-120, 100) + post(110, 100);

        // laptop
        const t = 16 * RAD, ct = Math.cos(t), st = Math.sin(t), lid = 118;
        s += box(S, [-90, H, -55], [90, H + 7, 67], {l: 31});
        s += plane(S(-90, H + 7.2, -55), ux, uz,
            `<path d="M12 14H168M12 27H168M12 40H168M12 53H168" stroke="oklch(15% 0.006 265)" stroke-width="9" stroke-dasharray="10 2.500"/>` +
            `<path d="M12 66H168" stroke="oklch(15% 0.006 265)" stroke-width="9" stroke-dasharray="10 2.500 10 2.500 10 2.500 68 2.500 10 2.500 10 2.500 10 2.500"/>` +
            `<rect x="62" y="80" width="56" height="34" rx="3" fill="oklch(27% 0.006 265)" stroke="oklch(42% 0.008 265)"/>`);
        const lidAt = (x, y) => S(-90 + x, H + 7 + (lid - y) * ct, -55 - (lid - y) * st);
        P(lidAt(180, 0));
        s += plane(lidAt(0, 0), ux, S.dir(0, -ct, st),
            `<rect width="180" height="${lid}" rx="4" fill="oklch(19% 0.006 265)" stroke="oklch(46% 0.008 265)"/>` +
            `<g transform="translate(10 8)">${art("cv-bench")}<rect width="160" height="98" fill="url(#cv-glare)"/></g>`);

        // what runs on the server floats in front of the stand, tied to an outline of the server's front
        const E = 170 + 78 * VIEW.explode, c = TINT.server, PH = 232, PY = 0;   // pane height and how high it floats
        const near = [V(0, 232, 170), V(192, 232, 170), V(0, 0, 170), V(192, 0, 170)].map(P);
        const away = [V(0, PY + PH, E), V(192, PY + PH, E), V(0, PY, E), V(192, PY, E)].map(P);
        let layer = `<polygon points="${pts([V(0, 0, 170), V(192, 0, 170), V(192, 232, 170), V(0, 232, 170)])}" fill="${c}" fill-opacity=".06" stroke="${c}" stroke-width="1.300"/>` +
            tieLines(near.map((p, i) => [p, away[i]]), c) +
            plane(V(0, PY + PH, E), ux, up,
                `<rect width="192" height="${PH}" fill="${c}" fill-opacity=".1" stroke="${c}" stroke-opacity=".85" stroke-width="1.200"/>` +
                `<g transform="translate(2 56)">${bucketWheel()}</g>`);
        for (let i = 0; i < 3; i++) layer += cyl(V(150, 88 + i * 21, E), 27, 17, {l: 62, c: 0.07, h: 245, o: 0.6});

        return {
            d: depth(S(0, 170, 0)), s, layer,
            db: P(V(150, 90, E + 27)), dbTop: P(V(150, 147, E)), xcv: P(V(54, 84, E)), bench: P(lidAt(145, 21)),
            y1: Math.max(P(S(-120, 0, 110))[1], P(S(120, 0, 110))[1], away[2][1], away[3][1]),
            under: shadow([S(-110, 0, -140), S(160, 0, -140), S(160, 0, 100), S(-110, 0, 100)], 14, "#000", 0.5)
        };
    }

    // puts the callouts of one band into rows so that neither labels nor leaders collide
    function layout(items, baseY, step, sides, blocks) {
        const placed = [];
        const overlap = (a, b) => a.x0 < b.x1 + 18 && b.x0 < a.x1 + 18;
        // does the leader of one label cross the text of another?
        const crosses = (lead, label) => {
            const lo = Math.min(lead.y, lead.ty), hi = Math.max(lead.y, lead.ty);
            const ya = Math.max(lo, label.y - 26), yb = Math.min(hi, label.y + 30);
            if (ya > yb) return false;
            const xAt = y => lead.ax + (lead.tx - lead.ax) * (y - lead.y) / (lead.ty - lead.y);
            return Math.min(xAt(ya), xAt(yb)) - 8 < label.x1 && label.x0 < Math.max(xAt(ya), xAt(yb)) + 8;
        };
        const blocked = c => (blocks || []).some(b => c.x0 < b.x1 + 14 && b.x0 < c.x1 + 14 && c.y - 26 < b.y1 && b.y0 < c.y + 30);
        const clash = c => blocked(c) || placed.some(q => q.r === c.r ? overlap(q, c) : crosses(c, q) || crosses(q, c));
        let out = "";
        items.sort((a, b) => a.t[0] - b.t[0]);
        for (const it of items) {
            const w = Math.max(it.act.length * 8.8, it.name.length * 9.6) + 16;
            let c = null;
            for (let r = 0; r < 8 && !c; r++)
                for (const gap of [26, 70, 120, 180, 240, 300])
                    for (const side of sides) {
                        if (c) break;
                        const x0 = side < 0 ? it.t[0] - gap - w : it.t[0] + gap;
                        const cand = {x0, x1: x0 + w, r, side, ax: side < 0 ? x0 + w : x0, y: baseY + step * r, tx: it.t[0], ty: it.t[1]};
                        if (r === 7 || !clash(cand)) c = cand;
                    }
            placed.push(c);
            const y = baseY + step * c.r, tx = n1(c.side < 0 ? c.x0 : c.x0 + 14);
            track(c.x0, y - 24);
            track(c.x1, y + 28);
            out += `<a href="${SITE}${it.hash}"><g class="co"${it.c ? ` style="--c: ${it.c}"` : ""}>` +
                `<path class="case" d="M${n1(c.ax)} ${n1(y)}L${n1(it.t[0])} ${n1(it.t[1])}"/>` +
                `<path d="M${n1(c.x0)} ${n1(y)}H${n1(c.x1)}M${n1(c.ax)} ${n1(y)}L${n1(it.t[0])} ${n1(it.t[1])}"/>` +
                `<circle cx="${n1(it.t[0])}" cy="${n1(it.t[1])}" r="3.200"/>` +
                `<text class="act" x="${tx}" y="${n1(y - 8)}">${it.act}</text><text class="nm" x="${tx}" y="${n1(y + 20)}">${it.name}</text></g></a>`;
        }
        return out;
    }

    function render() {
        cy = Math.cos(VIEW.yaw * RAD); sy = Math.sin(VIEW.yaw * RAD);
        cp = Math.cos(VIEW.pitch * RAD); sp = Math.sin(VIEW.pitch * RAD);
        cam = [sy * cp, sp, cy * cp];
        bb = {x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9};
        uid = 0;
        let star = "";
        for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 4.4 : 10, a = (i * 36 - 90) * RAD;
            star += (i ? "L" : "M") + n1(r * Math.cos(a)) + " " + n1(r * Math.sin(a));
        }
        defs = `<path id="cv-star5" d="${star}z"/><filter id="cv-blur4" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>` +
            `<filter id="cv-blur14" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>` +
            `<linearGradient id="cv-glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".11"/>` +
            `<stop offset=".38" stop-color="#fff" stop-opacity=".02"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
            `<radialGradient id="cv-floor"><stop offset="0" stop-color="#fff" stop-opacity=".075"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;

        // table
        const T = frame(0, 0, 0), X0 = 70, X1 = 1200, Z = 170, TOP = TOPY;
        const legs = [];
        for (const x of [X0 + 14, X1 - 32])
            for (const z of [-Z + 14, Z - 32])
                legs.push({d: depth([x, 165, z]), s: box(T, [x, 0, z], [x + 18, TOP - 16, z + 18], {l: 33})});
        legs.push({d: depth([635, 315, -Z + 20]), s: box(T, [X0 + 32, TOP - 44, -Z + 18], [X1 - 32, TOP - 16, -Z + 28], {l: 30})});
        // the PC: a tower under the right end of the table
        const TX = 1004, TW = 90, TH = 215, TZ0 = -112, TZ1 = 95;
        let tower = shadow([[TX + 6, 0, TZ0 - 14], [TX + TW + 26, 0, TZ0 - 14], [TX + TW + 26, 0, TZ1 - 4], [TX + 6, 0, TZ1 - 4]], 4, "#000", 0.55) +
            box(T, [TX, 0, TZ0], [TX + TW, TH, TZ1], {l: 28}) +
            plane([TX, TH, TZ1 + 0.2], [1, 0, 0], [0, -1, 0],
                `<circle cx="45" cy="13" r="4.500" fill="oklch(12% 0.006 265)" stroke="${ACCENT}" stroke-width="1.200"/>` +
                `<path d="M14 10h8v6h-8zM26 10h8v6h-8zM60 11h5v4h-5zM68 11h5v4h-5z" fill="oklch(10% 0.006 265)" stroke="oklch(48% 0.008 265)" stroke-width=".6"/>` +
                `<rect x="9" y="28" width="72" height="158" rx="3" fill="oklch(11% 0.006 265)" stroke="oklch(38% 0.008 265)"/>` +
                FAN(45, 58, 22) + FAN(45, 107, 22) + FAN(45, 156, 22) +
                `<path d="M12 33H78M12 39H78M12 45H78M12 51H78M12 57H78M12 63H78M12 69H78M12 75H78M12 81H78M12 87H78M12 93H78M12 99H78M12 105H78M12 111H78M12 117H78M12 123H78M12 129H78M12 135H78M12 141H78M12 147H78M12 153H78M12 159H78M12 165H78M12 171H78M12 177H78M12 183H78" stroke="oklch(30% 0.008 265)" stroke-width="2.400" stroke-dasharray="2.400 3.600"/>` +
                `<path class="b dim" d="M30 201h30" stroke-width="2"/>`);
        if (sy > 0.02)   // the glass side panel faces the camera only when looking from the right
            tower += plane([TX + TW + 0.2, TH, TZ1], [0, 0, -1], [0, -1, 0],
                `<rect x="10" y="12" width="${TZ1 - TZ0 - 20}" height="180" rx="2" fill="oklch(12% 0.012 265)" stroke="oklch(42% 0.008 265)"/>` +
                `<path d="M24 96h110" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round" stroke-opacity=".7"/>` +
                `<rect x="24" y="102" width="130" height="22" fill="oklch(19% 0.008 265)"/>` +
                `<rect x="150" y="30" width="34" height="56" fill="oklch(17% 0.008 265)"/>` +
                `<path d="M10 12L70 192" stroke="#fff" stroke-opacity=".05" stroke-width="26"/>`);
        // the part of the picture the tower takes up below the table, so that no label lands on it
        const towerBox = {x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9};
        for (const x of [TX, TX + TW]) for (const y of [0, TH]) for (const z of [TZ0, TZ1]) {
            const q = P([x, y, z]);
            towerBox.x0 = Math.min(towerBox.x0, q[0]); towerBox.x1 = Math.max(towerBox.x1, q[0]);
            towerBox.y0 = Math.min(towerBox.y0, q[1]); towerBox.y1 = Math.max(towerBox.y1, q[1]);
        }
        legs.push({d: depth([TX + TW / 2, TH / 2, 0]),
            s: tower});
        legs.sort((a, b) => a.d - b.d);

        const a = VIEW.spread, cx = 600, edge = 158;
        const things = [
            monitor(frame(cx - edge - 156 * Math.cos(a * RAD), TOP, -80 + 156 * Math.sin(a * RAD), a), "cv-browser",
                [{c: TINT.tabs, r: [0, 12, 114, 100], d: 560, s: 1.25, ghost: false, lead: [[9, 20.5], [9, 12]], html: art("cv-tabs")},
                    {c: TINT.torrent, r: [144, 80, 150, 110], d: 400, ghost: false, lead: [[256, 20.5], [256, 80]], html: art("cv-torrent")}]),
            monitor(frame(cx, TOP, -80, 0), "cv-news", [{c: TINT.enso, r: [0, 0, 198, 70], d: 45, ghost: false, html: art("cv-enso")}]),
            monitor(frame(cx + edge + 156 * Math.cos(a * RAD), TOP, -80 + 156 * Math.sin(a * RAD), -a), "cv-desktop", 
                [{c: TINT.retreat, r: [0, 0, 300, 195], d: 45, ghost: false, html: retreatStars()}]),
            micArray(1132, 40)
        ];
        const [m1, m2, m3, mic] = things;

        let table = shadow([[X0 + 20, 0, -Z - 40], [X1 + 50, 0, -Z - 40], [X1 + 50, 0, Z - 10], [X0 + 20, 0, Z - 10]], 14, "#000", 0.5) +
            legs.map(l => l.s).join("") +
            box(T, [X0, TOP - 16, -Z], [X1, TOP, Z], {l: 50, c: 0.004}) +
            things.map(t => t.under).join("") +
            things.slice().sort((p, q) => p.d - q.d).map(t => t.s).join("");
        const tableDepth = depth([635, 170, 0]);
        const frontY = Math.max(P([X0, TOP - 16, Z])[1], P([X1, TOP - 16, Z])[1]);

        const st = stand();
        const floor = `<g transform="matrix(${raw([1, 0, 0]).concat(raw([0, 0, 1]), raw([-700, 0, -520])).map(x => +x.toFixed(4)).join(" ")})">` +
            `<rect width="2300" height="1040" fill="url(#cv-floor)"/></g>`;

        // the bookmark tree in the browser and the storage on the server are the same Scrapyard
        const tree = m1.at(46, 134), mid = [(tree[0] + st.dbTop[0]) / 2, (tree[1] + st.dbTop[1]) / 2 + 46];
        const link = `M${n1(tree[0])} ${n1(tree[1])}Q${n1(mid[0])} ${n1(mid[1])} ${n1(st.dbTop[0])} ${n1(st.dbTop[1])}`;
        const linked = `<g class="link" style="--c: ${TINT.scrapyard}"><path class="case" d="${link}"/><path d="${link}"/>` +
            `<circle cx="${n1(tree[0])}" cy="${n1(tree[1])}" r="3"/><circle cx="${n1(st.dbTop[0])}" cy="${n1(st.dbTop[1])}" r="3"/></g>`;
        let body = floor + st.under + (st.d < tableDepth ? st.s + table : table + st.s) + st.layer + linked + m1.layer + m2.layer + m3.layer;

        const scene = {y0: bb.y0};
        body += layout([
            {t: st.bench, c: TINT.bench, act: "GENERATE IMAGES", name: "Image Bench", hash: "image-bench"},
            {t: m1.at(66, 38), c: TINT.scrapyard, act: "MANAGE BOOKMARKS", name: "Scrapyard", hash: "scrapyard"},
            {t: m1.at(196, 41), c: TINT.ishell, act: "COMMAND YOUR BROWSER", name: "iShell", hash: "ishell"},
            {t: m2.at(212, 126), c: TINT.news, act: "READ RSS FEEDS", name: "NewsBlurMod", hash: "NewsBlurMod"},
            {t: m2.far[0](146, 34), c: TINT.emacs, act: "USE ORG MODE", name: "&#961;Emacs", hash: "rho"},
            {t: m3.at(85, 100), c: TINT.silent, act: "PLAY MUSIC FROM FS", name: "Silent Night V6 Mod", hash: "silentnight"},
            {t: m3.at(262, 14), c: TINT.slideshow, act: "WATCH PHOTOS", name: "Large Slideshow Gadget", hash: "slideshow"}
        ], scene.y0 - 40, -66, [-1, 1]);
        body += layout([
            {t: m1.far[0](56, 108), c: TINT.tabs, act: "SWITCH TAB GROUPS", name: "Lightning Tab Groups", hash: "lightning-tab-groups"},
            {t: m1.far[1](190, 148), c: TINT.torrent, act: "SEND TORRENTS", name: "Add Torrent To", hash: "torrent-add"},
            {t: m2.far[0](34, 58), c: TINT.enso, act: "COMMAND YOUR PC", name: "Enso Open-Source", hash: "enso"},
            {t: m3.far[0](117, 162), c: TINT.retreat, act: "TAKE A BREAK", name: "Enso Retreat", hash: "retreat"},
            {t: m3.at(278, 146), c: TINT.sunlight, act: "TRACK DAYLIGHT", name: "Sunlight World Map", hash: "sunlight"},
            {t: mic.target, c: TINT.scarlett, act: "COMMAND BY VOICE", name: "Scarlett", hash: "scarlett"}
        ], Math.max(frontY + 62, m1.low + 46, m2.low + 46, m3.low + 46), 66, [1, -1], [towerBox]);
        body += layout([
            {t: st.xcv, c: TINT.server, act: "EXTRACT RSS FEEDS", name: "Feedxcavator", hash: "feedxcavator"},
            {t: st.db, c: TINT.scrapyard, act: "STORE BOOKMARKS", name: "Scrapyard", hash: "scrapyard"}
        ], st.y1 + 46, 66, [-1, 1]);

        const PAD = 80;
        const box4 = [bb.x0 - PAD, bb.y0 - 12, bb.x1 - bb.x0 + 2 * PAD, bb.y1 - bb.y0 + 24].map(n1).join(" ");
        view.innerHTML = `<svg viewBox="${box4}" xmlns="http://www.w3.org/2000/svg" role="img" ` +
            `aria-label="A desk with three monitors, a microphone array, a laptop and a home server, with callouts naming the software running on each">` +
            `<defs>${defs}</defs>${body}</svg>`;
    }

    const view = document.getElementById("cover-view");
    if (!view) return;
    render();

    // ?tune: sliders for finding an angle
    if (query.has("tune")) {
        const panel = document.createElement("div");
        panel.style.cssText = "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:10;display:flex;gap:14px;" +
            "padding:8px 14px;background:#000c;border:1px solid #fff3;font:12px monospace;color:#ccc";
        const ranges = {yaw: [-60, 60], pitch: [0, 60], spread: [0, 35], explode: [0.2, 2]};
        for (const key of Object.keys(ranges)) {
            const label = document.createElement("label"), input = document.createElement("input"), value = document.createElement("span");
            input.type = "range";
            input.step = key === "explode" ? 0.05 : 1;
            [input.min, input.max] = ranges[key];
            input.value = VIEW[key];
            value.textContent = " " + VIEW[key];
            input.addEventListener("input", () => {
                VIEW[key] = +input.value;
                value.textContent = " " + VIEW[key];
                render();
            });
            label.append(key + " ", input, value);
            panel.append(label);
        }
        document.body.append(panel);
    }
})();
