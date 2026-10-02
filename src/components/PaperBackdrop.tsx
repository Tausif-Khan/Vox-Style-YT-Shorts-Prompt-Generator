import { useEffect, useRef } from "react";

/**
 * Papercut Studio backdrop — the layered paper-cut world the prompts create:
 * a scalloped gold paper sun, drifting torn-paper clouds, floating confetti
 * cutouts, and stacked torn-paper hills with drop shadows between layers.
 * The whole scene is interactive: layers shift with the mouse (parallax),
 * clouds drift and confetti bobs on gentle CSS loops.
 */
export default function PaperBackdrop() {
  const cloudsRef = useRef<SVGGElement>(null);
  const confettiRef = useRef<SVGGElement>(null);
  const hillsRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1 … 1
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        if (cloudsRef.current)
          cloudsRef.current.style.transform = `translate(${(-x * 16).toFixed(1)}px, ${(-y * 9).toFixed(1)}px)`;
        if (confettiRef.current)
          confettiRef.current.style.transform = `translate(${(-x * 9).toFixed(1)}px, ${(-y * 6).toFixed(1)}px)`;
        if (hillsRef.current)
          hillsRef.current.style.transform = `translate(${(x * 6).toFixed(1)}px, ${(y * 3).toFixed(1)}px)`;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>{`
          .pb-cloud-a { animation: pb-drift 28s ease-in-out infinite alternate; }
          .pb-cloud-b { animation: pb-drift 38s ease-in-out infinite alternate-reverse; }
          .pb-conf { animation: pb-bob 6.5s ease-in-out infinite alternate; }
          .pb-ring { transform-box: fill-box; transform-origin: center; animation: pb-spin 90s linear infinite; }
          @keyframes pb-drift { from { transform: translateX(0); } to { transform: translateX(36px); } }
          @keyframes pb-bob { from { transform: translateY(0); } to { transform: translateY(-13px); } }
          @keyframes pb-spin { to { transform: rotate(360deg); } }
          @media (prefers-reduced-motion: reduce) {
            .pb-cloud-a, .pb-cloud-b, .pb-conf, .pb-ring { animation: none; }
          }
        `}</style>

        <defs>
          <linearGradient id="pb-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6c76a" />
            <stop offset="1" stopColor="#e8a33d" />
          </linearGradient>
          {/* Front sheet lifts off the sheet behind it — shadow falls upward. */}
          <filter id="pb-lift" x="-5%" y="-30%" width="110%" height="180%">
            <feDropShadow dx="0" dy="-7" stdDeviation="8" floodColor="#000000" floodOpacity="0.42" />
          </filter>
        </defs>

        {/* ── Paper sun, top right: solid disc + scalloped dot ring ── */}
        <g opacity="0.9">
          <circle
            className="pb-ring"
            cx="1245"
            cy="132"
            r="86"
            fill="none"
            stroke="#e8a33d"
            strokeWidth="13"
            strokeDasharray="9 16"
            strokeLinecap="round"
            opacity="0.5"
          />
          <circle cx="1245" cy="132" r="62" fill="url(#pb-sun)" />
          <circle cx="1245" cy="132" r="34" fill="#f2e7d3" opacity="0.35" />
        </g>

        {/* ── Torn-paper clouds ── */}
        <g ref={cloudsRef}>
          <g className="pb-cloud-a" fill="#f2e7d3" opacity="0.16">
            <ellipse cx="205" cy="152" rx="58" ry="23" />
            <ellipse cx="262" cy="142" rx="48" ry="27" />
            <ellipse cx="310" cy="155" rx="42" ry="20" />
            <rect x="160" y="152" width="190" height="24" rx="12" />
          </g>
          <g className="pb-cloud-b" fill="#f2e7d3" opacity="0.11">
            <ellipse cx="880" cy="108" rx="46" ry="19" />
            <ellipse cx="930" cy="100" rx="38" ry="22" />
            <ellipse cx="968" cy="110" rx="32" ry="16" />
            <rect x="848" y="108" width="148" height="20" rx="10" />
          </g>
          <g className="pb-cloud-a" style={{ animationDelay: "4s" }} fill="#6b93c9" opacity="0.14">
            <ellipse cx="560" cy="235" rx="40" ry="16" />
            <ellipse cx="602" cy="228" rx="33" ry="19" />
            <rect x="530" y="235" width="128" height="18" rx="9" />
          </g>
        </g>

        {/* ── Confetti cutouts ── */}
        <g ref={confettiRef}>
          <path className="pb-conf" style={{ animationDelay: "0.4s" }} d="M120 330 L146 336 L130 358 Z" fill="#e0644f" opacity="0.42" />
          <circle className="pb-conf" style={{ animationDelay: "1.6s" }} cx="248" cy="430" r="8" fill="#e8a33d" opacity="0.4" />
          <rect className="pb-conf" style={{ animationDelay: "2.4s" }} x="72" y="520" width="17" height="17" rx="4" fill="#6b93c9" opacity="0.38" transform="rotate(18 80 528)" />
          <path className="pb-conf" style={{ animationDelay: "3.1s" }} d="M1330 300 L1356 306 L1340 328 Z" fill="#f2e7d3" opacity="0.34" />
          <circle className="pb-conf" style={{ animationDelay: "0.9s" }} cx="1268" cy="405" r="9" fill="#e0644f" opacity="0.42" />
          <rect className="pb-conf" style={{ animationDelay: "2.0s" }} x="1372" y="470" width="16" height="16" rx="4" fill="#e8a33d" opacity="0.38" transform="rotate(-14 1380 478)" />
          <circle className="pb-conf" style={{ animationDelay: "3.6s" }} cx="1180" cy="230" r="6" fill="#f2e7d3" opacity="0.35" />
          <path className="pb-conf" style={{ animationDelay: "1.2s" }} d="M390 190 L410 196 L397 214 Z" fill="#e8a33d" opacity="0.3" />
          <rect className="pb-conf" style={{ animationDelay: "2.8s" }} x="1050" y="540" width="14" height="14" rx="3" fill="#6b93c9" opacity="0.3" transform="rotate(22 1057 547)" />
        </g>

        {/* ── Stacked torn-paper hills, back → front ── */}
        <g ref={hillsRef}>
          <g filter="url(#pb-lift)">
            <path
              d="M0 580 C120 545 260 600 400 570 C540 540 660 595 800 565 C940 535 1080 590 1220 560 C1320 540 1390 565 1440 555 L1440 900 L0 900 Z"
              fill="#2c2345"
            />
            <path
              d="M0 580 C120 545 260 600 400 570 C540 540 660 595 800 565 C940 535 1080 590 1220 560 C1320 540 1390 565 1440 555"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.07"
              strokeWidth="2"
            />
          </g>
          <g filter="url(#pb-lift)">
            <path
              d="M0 652 C140 622 300 672 460 645 C620 618 760 668 920 640 C1080 612 1240 662 1440 634 L1440 900 L0 900 Z"
              fill="#33476b"
            />
            <path
              d="M0 652 C140 622 300 672 460 645 C620 618 760 668 920 640 C1080 612 1240 662 1440 634"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.08"
              strokeWidth="2"
            />
          </g>
          <g filter="url(#pb-lift)">
            <path
              d="M0 726 C160 696 320 746 500 718 C680 690 820 742 1000 714 C1160 690 1300 736 1440 712 L1440 900 L0 900 Z"
              fill="#8c4a44"
            />
            <path
              d="M0 726 C160 696 320 746 500 718 C680 690 820 742 1000 714 C1160 690 1300 736 1440 712"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.1"
              strokeWidth="2"
            />
          </g>
          <g filter="url(#pb-lift)">
            <path
              d="M0 806 C180 780 360 826 560 800 C760 774 940 822 1140 796 C1280 778 1370 806 1440 794 L1440 900 L0 900 Z"
              fill="#221a2e"
            />
            <path
              d="M0 806 C180 780 360 826 560 800 C760 774 940 822 1140 796 C1280 778 1370 806 1440 794"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.08"
              strokeWidth="2"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
