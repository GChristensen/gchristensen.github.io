// Star-style overlay scrollbar (styles in css/retro-scrollbar.css).
// The native scrollbar is hidden, wheel/touch/keyboard scrolling stay native.
// scroller: the scrolling element, or document.scrollingElement for the page itself;
// host: a non-scrolling positioned element to draw the bar in (defaults to the scroller's parent).
function retroScrollbar(scroller, host) {
    const isPage = scroller === document.scrollingElement;
    host = host || (isPage ? document.body : scroller.parentElement);

    const bar = document.createElement("div");
    bar.className = "rsb" + (isPage ? " rsb-fixed" : "");
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = '<div class="rsb-rail"><div class="rsb-thumb"><i></i><i></i><i></i></div></div>';
    host.appendChild(bar);

    const rail = bar.firstChild;
    const thumb = rail.firstChild;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let idleTimer = null;

    scroller.classList.add("rsb-native-hidden");
    // the viewport scrollbar takes its style from <html> even when <body> scrolls (quirks mode)
    if (isPage)
        document.documentElement.classList.add("rsb-native-hidden");

    function update() {
        const view = scroller.clientHeight;
        const full = scroller.scrollHeight;

        if (full <= view + 1) {
            bar.hidden = true;
            return;
        }

        bar.hidden = false;
        const railHeight = rail.clientHeight;
        const height = Math.max(24, Math.round(railHeight * view / full));
        const top = Math.round((railHeight - height) * scroller.scrollTop / (full - view));
        thumb.style.height = height + "px";
        thumb.style.transform = `translateY(${top}px)`;
    }

    function wake() {
        bar.classList.add("rsb-active");
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => bar.classList.remove("rsb-active"), 1000);
    }

    (isPage ? window : scroller).addEventListener("scroll", () => {
        update();
        wake();
    }, {passive: true});

    // content height changes (late images, added items) do not resize the scroller itself
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(isPage ? document.body : scroller);
    if (!isPage)
        Array.from(scroller.children).forEach(child => resizeObserver.observe(child));
    window.addEventListener("resize", update);

    thumb.addEventListener("pointerdown", e => {
        if (e.button !== 0) return;
        e.preventDefault();
        thumb.setPointerCapture(e.pointerId);
        bar.classList.add("rsb-drag");

        const startY = e.clientY;
        const startTop = scroller.scrollTop;
        const ratio = (scroller.scrollHeight - scroller.clientHeight)
                    / Math.max(1, rail.clientHeight - thumb.offsetHeight);

        const move = ev => {
            scroller.scrollTop = startTop + (ev.clientY - startY) * ratio;
        };
        const release = () => {
            bar.classList.remove("rsb-drag");
            thumb.removeEventListener("pointermove", move);
            thumb.removeEventListener("pointerup", release);
            thumb.removeEventListener("pointercancel", release);
        };

        thumb.addEventListener("pointermove", move);
        thumb.addEventListener("pointerup", release);
        thumb.addEventListener("pointercancel", release);
    });

    // clicking the track pages toward the click, like the classic scrollbars did
    bar.addEventListener("pointerdown", e => {
        if (e.button !== 0 || thumb.contains(e.target)) return;
        e.preventDefault();
        const direction = e.clientY < thumb.getBoundingClientRect().top ? -1 : 1;
        scroller.scrollBy({
            top: direction * scroller.clientHeight * 0.9,
            behavior: reducedMotion.matches ? "auto" : "smooth"
        });
    });

    update();
    return {update};
}
