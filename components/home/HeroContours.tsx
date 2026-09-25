/**
 * Topographic contours behind the hero. Inline SVG on purpose (docs/04 § Home): teal
 * at 13%, sand at 10%. Colours come from the token classes via currentColor.
 */
export function HeroContours() {
  return (
    <svg
      width="1440"
      height="740"
      viewBox="0 0 1440 740"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1" className="text-teal opacity-[0.13]">
        <path d="M-40 120C180 70 360 190 560 150 760 110 900 10 1120 40 1290 64 1380 120 1480 96" />
        <path d="M-40 190C180 140 360 260 560 220 760 180 900 80 1120 110 1290 134 1380 190 1480 166" />
        <path d="M-40 268C190 214 370 340 566 296 766 252 900 156 1126 188 1296 212 1384 268 1480 244" />
        <path d="M-40 356C196 300 376 428 572 382 772 336 906 240 1132 272 1302 296 1390 352 1480 330" />
        <path d="M-40 452C200 394 382 524 578 476 778 428 912 332 1138 364 1308 388 1396 444 1480 424" />
        <path d="M-40 556C206 496 388 628 584 578 784 528 918 432 1144 464 1314 488 1402 544 1480 526" />
        <path d="M-40 668C212 606 394 740 590 688 790 636 924 540 1150 572 1320 596 1408 652 1480 636" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="1" className="text-sand opacity-10">
        <path d="M-40 306C193 250 373 380 569 336 769 292 903 196 1129 228 1299 252 1387 308 1480 286" />
        <path d="M-40 504C203 444 385 576 581 526 781 476 915 380 1141 412 1311 436 1399 492 1480 474" />
      </g>
    </svg>
  );
}
