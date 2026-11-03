import { t } from "../i18n";
import type { CameraFrameId, NodeId, PacketColor } from "../types/protocol";

const COS_30 = Math.cos(Math.PI / 6);
const SIN_30 = 0.5;
const STROKE_COLOR = "var(--k-line-1b3fae)";

export type Point2D = [number, number];
export type IsoProjector = (x: number, y: number, z?: number) => Point2D;
export type FaceProjector = (u: number, v: number) => Point2D;

export function createIsoProjector(originX: number, originY: number): IsoProjector {
  return (x: number, y: number, z = 0): Point2D => [
    originX + (x - y) * COS_30,
    originY + (x + y) * SIN_30 - z,
  ];
}

const formatPoint = ([x, y]: Point2D): string => `${x.toFixed(2)},${y.toFixed(2)}`;

const isoPolygon = (points: Point2D[], attrs = ""): string =>
  `<polygon points="${points.map(formatPoint).join(" ")}" ${attrs}/>`;

const isoPolyline = (points: Point2D[], attrs = ""): string =>
  `<polyline points="${points.map(formatPoint).join(" ")}" fill="none" ${attrs}/>`;

function createBoxFaceProjectors(
  project: IsoProjector,
  x: number,
  y: number,
  z: number,
  widthX: number,
  depthY: number,
  heightZ: number,
): {
  top: FaceProjector;
  left: FaceProjector;
  right: FaceProjector;
} {
  return {
    top: (u, v) => project(x + u, y + v, z + heightZ),
    left: (u, v) => project(x + u, y + depthY, z + v),
    right: (u, v) => project(x + widthX, y + depthY - u, z + v),
  };
}

const isoRect = (
  face: FaceProjector,
  u: number,
  v: number,
  w: number,
  h: number,
  attrs = "",
): string =>
  isoPolygon([face(u, v), face(u + w, v), face(u + w, v + h), face(u, v + h)], attrs);

function isoCircle(
  face: FaceProjector,
  cx: number,
  cy: number,
  radius: number,
  attrs = "",
): string {
  const pts: Point2D[] = [];
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    pts.push(face(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)));
  }
  return isoPolygon(pts, attrs);
}

interface IsoBoxStyle {
  top?: string;
  left?: string;
  right?: string;
  stroke?: string;
  sw?: number;
}

function isoBox(
  project: IsoProjector,
  x: number,
  y: number,
  z: number,
  widthX: number,
  depthY: number,
  heightZ: number,
  style: IsoBoxStyle = {},
): string {
  const {
    top = "var(--k-fill-f4f7fe)",
    left = "var(--k-fill-e5edfc)",
    right = "var(--k-fill-d0def8)",
    stroke = STROKE_COLOR,
    sw = 1.7,
  } = style;
  const strokeAttrs = `stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`;
  return [
    isoPolygon(
      [
        project(x, y, z + heightZ),
        project(x + widthX, y, z + heightZ),
        project(x + widthX, y + depthY, z + heightZ),
        project(x, y + depthY, z + heightZ),
      ],
      `fill="${top}" ${strokeAttrs}`,
    ),
    isoPolygon(
      [
        project(x, y + depthY, z),
        project(x + widthX, y + depthY, z),
        project(x + widthX, y + depthY, z + heightZ),
        project(x, y + depthY, z + heightZ),
      ],
      `fill="${left}" ${strokeAttrs}`,
    ),
    isoPolygon(
      [
        project(x + widthX, y + depthY, z),
        project(x + widthX, y, z),
        project(x + widthX, y, z + heightZ),
        project(x + widthX, y + depthY, z + heightZ),
      ],
      `fill="${right}" ${strokeAttrs}`,
    ),
  ].join("");
}

function isoGridLines(
  face: FaceProjector,
  u: number,
  v: number,
  w: number,
  h: number,
  step: number,
  attrs: string,
): string {
  let out = "";
  for (let du = step; du < w; du += step) {
    out += isoPolyline([face(u + du, v), face(u + du, v + h)], attrs);
  }
  for (let dv = step; dv < h; dv += step) {
    out += isoPolyline([face(u, v + dv), face(u + w, v + dv)], attrs);
  }
  return out;
}

const STROKE_ATTR = `stroke="${STROKE_COLOR}"`;
const THIN_STROKE_ATTR = `${STROKE_ATTR} stroke-width="1.3" stroke-linejoin="round"`;
const GRADIENT_FACES = {
  top: "url(#face-top)",
  left: "url(#face-left)",
  right: "url(#face-right)",
};

const isoShadow = (
  project: IsoProjector,
  x: number,
  y: number,
  widthX: number,
  depthY: number,
  shadowLen: number,
): string =>
  isoPolygon(
    [
      project(x + widthX, y),
      project(x + widthX + shadowLen, y),
      project(x + widthX + shadowLen, y + depthY),
      project(x + widthX, y + depthY),
    ],
    'class="iso-shadow"',
  );

export function renderRouterSvg(originX: number, originY: number): string {
  const project = createIsoProjector(originX, originY);
  const w = 70;
  const d = 70;
  const h = 33;
  const faces = createBoxFaceProjectors(project, 0, 0, 0, w, d, h);

  let svg = isoShadow(project, 0, 0, w, d, 34);
  svg += isoBox(project, 0, 0, 0, w, d, h, { ...GRADIENT_FACES, sw: 2.2 });

  const topLeds: Array<[number, number]> = [
    [9, 7],
    [19.5, 5],
    [28, 7],
    [39, 5],
  ];
  for (const [u, len] of topLeds) {
    svg += isoRect(
      faces.top,
      u,
      30.5,
      len,
      5,
      `fill="var(--k-fill-a9c0ee)" ${STROKE_ATTR} stroke-width="1.5"`,
    );
  }
  svg += isoRect(faces.top, 30, 32, 3, 2, `fill="${STROKE_COLOR}" stroke="none"`);

  const left = faces.left;
  svg += isoCircle(left, 9.5, 17, 5, `fill="none" ${STROKE_ATTR} stroke-width="2.6"`);
  svg += isoRect(left, 17, 13, 3.6, 8, `fill="${STROKE_COLOR}" stroke="none"`);
  svg += isoRect(left, 15.5, 20, 6.6, 2, `fill="${STROKE_COLOR}" stroke="none"`);
  svg += isoRect(left, 15.5, 11.5, 6.6, 2, `fill="${STROKE_COLOR}" stroke="none"`);
  svg += isoRect(
    left,
    30,
    8,
    13,
    11,
    `fill="var(--k-fill-f4f7fe)" ${STROKE_ATTR} stroke-width="2"`,
  );

  const right = faces.right;
  svg += isoRect(
    right,
    9,
    9,
    52,
    15,
    `fill="var(--k-fill-e8effd)" ${STROKE_ATTR} stroke-width="2"`,
  );
  svg += isoRect(right, 13, 12, 44, 9, `fill="var(--k-fill-c4d5f6)" ${THIN_STROKE_ATTR}`);
  for (let row = 0; row < 3; row++) {
    svg += isoPolyline(
      [right(16, 14 + row * 2.6), right(54, 14 + row * 2.6)],
      'stroke="var(--k-line-8ea9e2)" stroke-width="0.9"',
    );
  }

  const [antX, antY] = faces.top(16, 8);
  svg += `<ellipse cx="${antX}" cy="${antY}" rx="5.2" ry="2.8" fill="var(--k-fill-c9d8f6)" ${STROKE_ATTR} stroke-width="1.5"/>`;
  svg += `<path d="M${antX - 3.2},${antY} L${antX - 1.4},${antY - 40} L${antX + 1.4},${antY - 40} L${antX + 3.2},${antY} Z" fill="var(--k-fill-c9d8f6)" ${STROKE_ATTR} stroke-width="1.6" stroke-linejoin="round"/>`;
  svg += `<circle cx="${antX}" cy="${antY - 43.5}" r="4" fill="var(--k-fill-f4f7fe)" ${STROKE_ATTR} stroke-width="1.8"/>`;

  return `<g class="device router">${svg}</g>`;
}

export function renderDnsServerSvg(originX: number, originY: number): string {
  const project = createIsoProjector(originX, originY);
  const w = 40.5;
  const d = 40.5;
  const unitH = 13.6;
  const gap = 2.9;

  let svg = isoShadow(project, 0, 0, w, d, 30);
  svg += isoBox(project, 1.5, 1.5, 0, w - 3, d - 3, unitH * 3 + gap * 2, {
    top: "var(--k-fill-2f55c2)",
    left: "var(--k-fill-2f55c2)",
    right: "var(--k-fill-24479f)",
  });

  for (let tier = 0; tier < 3; tier++) {
    const z = tier * (unitH + gap);
    const faces = createBoxFaceProjectors(project, 0, 0, z, w, d, unitH);
    svg += isoBox(project, 0, 0, z, w, d, unitH, { ...GRADIENT_FACES, sw: 1.9 });

    if (tier === 0) {
      svg += isoRect(faces.left, 4, 3.8, 7, 5.6, `fill="var(--k-fill-5ed6ea)" ${THIN_STROKE_ATTR}`);
      svg += isoRect(
        faces.left,
        13,
        3.8,
        9,
        5.6,
        `fill="var(--k-fill-d7e3fa)" ${THIN_STROKE_ATTR}`,
      );
      svg += isoRect(
        faces.left,
        24,
        3.8,
        6,
        5.6,
        `fill="var(--k-fill-5ed6ea)" ${THIN_STROKE_ATTR}`,
      );
    } else {
      svg += isoRect(
        faces.left,
        4,
        3.8,
        27,
        5.6,
        `fill="var(--k-fill-5ed6ea)" ${THIN_STROKE_ATTR}`,
      );
      svg += isoRect(faces.left, 4, 3.8, 9, 5.6, 'fill="var(--k-fill-a6eef6)" stroke="none"');
    }

    svg += isoRect(faces.right, 4, 3.8, 32, 5.6, `fill="var(--k-fill-9fbcf0)" ${THIN_STROKE_ATTR}`);

    if (tier === 2) {
      svg += isoRect(
        faces.top,
        8.5,
        8.5,
        23.5,
        23.5,
        `fill="var(--k-fill-dfe8fb)" ${STROKE_ATTR} stroke-width="1.6"`,
      );
      svg += isoGridLines(
        faces.top,
        8.5,
        8.5,
        23.5,
        23.5,
        2.6,
        'stroke="var(--k-line-7d9be0)" stroke-width="0.6"',
      );
    }
  }

  return `<g class="device dns">${svg}</g>`;
}

export function renderTowerServerSvg(originX: number, originY: number): string {
  const project = createIsoProjector(originX, originY);
  const w = 56.6;
  const d = 56.6;
  const h = 70;
  const faces = createBoxFaceProjectors(project, 0, 0, 0, w, d, h);

  let svg = isoShadow(project, 0, 0, w, d, 40);
  svg += isoBox(project, 0, 0, 0, w, d, h, {
    top: "url(#face-top)",
    left: "var(--k-fill-f4f8ff)",
    right: "url(#face-right)",
    sw: 2.3,
  });
  svg += isoRect(
    faces.top,
    10,
    10,
    37,
    37,
    `fill="var(--k-fill-c9d8f4)" ${STROKE_ATTR} stroke-width="1.2"`,
  );

  for (let offset = 2.2; offset < 37; offset += 2.2) {
    svg += isoPolyline(
      [faces.top(10 + offset, 10), faces.top(10 + offset, 47)],
      'stroke="var(--k-line-9db5e6)" stroke-width="0.7"',
    );
  }

  const left = faces.left;
  for (let bay = 0; bay < 3; bay++) {
    const zBase = 6 + bay * 20.5;
    svg += isoRect(
      left,
      4.5,
      zBase,
      47.5,
      17,
      `fill="var(--k-fill-f5f8ff)" ${STROKE_ATTR} stroke-width="2"`,
    );
    svg += isoRect(
      left,
      7.5,
      zBase + 3,
      41.5,
      11,
      `fill="var(--k-fill-e3ebfc)" ${THIN_STROKE_ATTR}`,
    );

    const baySlots: Array<[number, number]> = [
      [10, 5],
      [16, 3],
      [21, 3],
      [36, 3.4],
    ];
    for (const [u, slotW] of baySlots) {
      svg += isoRect(left, u, zBase + 5, slotW, 7, 'fill="var(--k-fill-3d63c9)" stroke="none"');
    }
    svg += isoRect(left, 26, zBase + 6, 7, 5, 'fill="var(--k-fill-a7bff0)" stroke="none"');
  }

  const right = faces.right;
  const traceAttrs = `fill="none" ${STROKE_ATTR} stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"`;
  svg += isoRect(right, 8, 34, 40, 27, `fill="var(--k-fill-c7d8f7)" ${traceAttrs}`);
  svg += isoPolyline([right(8, 52), right(30, 52), right(30, 46), right(48, 46)], traceAttrs);
  svg += isoPolyline([right(14, 40), right(26, 40), right(26, 34)], traceAttrs);
  svg += isoPolyline([right(36, 61), right(36, 54), right(44, 54)], traceAttrs);
  svg += isoRect(right, 8, 9, 16, 15, `fill="var(--k-fill-c7d8f7)" ${traceAttrs}`);
  svg += isoRect(right, 30, 9, 16, 15, `fill="var(--k-fill-c7d8f7)" ${traceAttrs}`);
  svg += isoPolyline([right(30, 19), right(36, 19), right(36, 24)], traceAttrs);
  svg += `<circle cx="${right(47, 1)[0]}" cy="${right(47, 1)[1]}" r="2.6" fill="${STROKE_COLOR}"/>`;

  return `<g class="device web">${svg}</g>`;
}

export function renderLaptopSvg(originX: number, originY: number): string {
  const project = createIsoProjector(originX, originY);
  const w = 56;
  const d = 86;
  const h = 5;
  const faces = createBoxFaceProjectors(project, 0, 0, 0, w, d, h);

  let svg = isoShadow(project, -4, 0, w + 4, d, 30);
  svg += isoPolygon(
    [project(-4, d), project(w, d), project(w + 10, d + 8), project(-4, d + 8)],
    'class="iso-shadow"',
  );

  const screenH = 64;
  const tilt = 3;
  const marginY = 3;
  const screenW = 82;
  const createScreenPlane = (xOffset: number): FaceProjector => (u, v) =>
    project(xOffset - (tilt * v) / screenH, marginY + screenW - u, h + v);
  const backPlane = createScreenPlane(-7);
  const frontPlane = createScreenPlane(0);
  const quadPoints = (plane: FaceProjector, u: number, v: number, qw: number, qh: number) => [
    plane(u, v),
    plane(u + qw, v),
    plane(u + qw, v + qh),
    plane(u, v + qh),
  ];

  svg += isoPolygon(
    quadPoints(backPlane, 0, 0, screenW, screenH),
    `fill="var(--k-fill-e2ebfc)" ${STROKE_ATTR} stroke-width="2" stroke-linejoin="round"`,
  );
  svg += isoPolygon(
    [backPlane(0, 0), frontPlane(0, 0), frontPlane(0, screenH), backPlane(0, screenH)],
    `fill="var(--k-fill-cddcf8)" ${STROKE_ATTR} stroke-width="1.6" stroke-linejoin="round"`,
  );
  svg += isoPolygon(
    [
      backPlane(0, screenH),
      frontPlane(0, screenH),
      frontPlane(screenW, screenH),
      backPlane(screenW, screenH),
    ],
    `fill="var(--k-fill-cddcf8)" ${STROKE_ATTR} stroke-width="1.6" stroke-linejoin="round"`,
  );
  svg += isoPolygon(
    quadPoints(frontPlane, 0, 0, screenW, screenH),
    `fill="var(--k-fill-f4f7fe)" ${STROKE_ATTR} stroke-width="2" stroke-linejoin="round"`,
  );
  svg += isoPolygon(
    quadPoints(frontPlane, 4.5, 5, screenW - 9, screenH - 9.5),
    `fill="var(--k-fill-dce6fb)" ${STROKE_ATTR} stroke-width="1.5" stroke-linejoin="round"`,
  );
  svg += isoPolygon(
    quadPoints(frontPlane, 4.5, screenH - 14, screenW - 9, 9.5),
    `fill="var(--k-fill-f2f6fe)" ${STROKE_ATTR} stroke-width="1.2" stroke-linejoin="round"`,
  );
  svg += isoPolyline(
    [frontPlane(9, screenH - 9.3), frontPlane(24, screenH - 9.3)],
    'stroke="var(--k-line-9db5e8)" stroke-width="2.2" stroke-linecap="round"',
  );

  svg += '<g class="screen-content">';
  svg += isoPolygon(
    quadPoints(frontPlane, 10, 13, 22, 24),
    'fill="var(--k-fill-a9c0ec)" stroke="none"',
  );
  for (let lineIdx = 0; lineIdx < 4; lineIdx++) {
    svg += isoPolyline(
      [frontPlane(38, 33 - lineIdx * 6), frontPlane(68, 33 - lineIdx * 6)],
      'stroke="var(--k-line-a9c0ec)" stroke-width="3.2" stroke-linecap="round" pathLength="1"',
    );
  }
  svg += "</g>";

  svg += isoBox(project, 0, 0, 0, w, d, h, {
    top: "var(--k-fill-f5f8ff)",
    left: "var(--k-fill-dfe8fc)",
    right: "var(--k-fill-cddcf8)",
    sw: 2.1,
  });

  const top = faces.top;
  svg += isoRect(
    top,
    6,
    9,
    27,
    68,
    `fill="var(--k-fill-dce7fb)" ${STROKE_ATTR} stroke-width="1.6"`,
  );
  for (let u = 6 + 5.4; u < 33; u += 5.4) {
    svg += isoPolyline([top(u, 9), top(u, 77)], `stroke="${STROKE_COLOR}" stroke-width="0.9"`);
  }
  for (let v = 9 + 4.85; v < 77; v += 4.85) {
    svg += isoPolyline([top(6, v), top(33, v)], `stroke="${STROKE_COLOR}" stroke-width="0.9"`);
  }
  svg += isoRect(top, 38, 28, 13, 30, `fill="var(--k-fill-c3d4f5)" ${THIN_STROKE_ATTR}`);

  return `<g class="device laptop">${svg}</g>`;
}

export function renderInternetCloudSvg(originX: number, originY: number): string {
  const puffs: Array<[number, number, number]> = [
    [-60, 10, 21],
    [-32, -16, 20],
    [-6, -36, 17],
    [22, -36, 26],
    [46, -16, 20],
    [58, 3, 22],
    [40, 22, 24],
    [-24, 24, 24],
    [8, 2, 32],
    [-20, 6, 26],
  ];
  const renderPuffs = (attrs: string, dx = 0, dy = 0) =>
    puffs
      .map(
        ([px, py, r]) =>
          `<circle cx="${originX + px + dx}" cy="${originY + py + dy}" r="${r}" ${attrs}/>`,
      )
      .join("");
  const globeX = originX + 20;
  const globeY = originY;
  const globeR = 19.5;

  return `<g class="device cloud">
    <clipPath id="cloud-clip">${renderPuffs("")}</clipPath>
    <ellipse cx="${originX + 12}" cy="${originY + 44}" rx="80" ry="10" class="iso-shadow round"/>
    ${renderPuffs(`fill="var(--k-fill-fdfdff)" ${STROKE_ATTR} stroke-width="4.6"`)}
    <g clip-path="url(#cloud-clip)">
      ${renderPuffs('fill="var(--k-fill-e3eaf8)"')}
      ${renderPuffs('fill="var(--k-fill-fdfdff)"', 3, -4)}
    </g>
    <g fill="none" ${STROKE_ATTR} stroke-width="2.4" stroke-linecap="round">
      <circle cx="${globeX}" cy="${globeY}" r="${globeR}" fill="var(--k-fill-fdfdff)"/>
      <ellipse cx="${globeX}" cy="${globeY}" rx="8.5" ry="${globeR}"/>
      <line x1="${globeX}" y1="${globeY - globeR}" x2="${globeX}" y2="${globeY + globeR}"/>
      <path d="M${globeX - globeR},${globeY} H${globeX + globeR}"/>
      <path d="M${globeX - 16},${globeY - 10} Q${globeX},${globeY - 5} ${globeX + 16},${globeY - 10} M${globeX - 16},${globeY + 10} Q${globeX},${globeY + 15} ${globeX + 16},${globeY + 10}"/>
    </g>
  </g>`;
}

export const DEFAULT_VIEWBOX: [number, number, number, number] = [45, 66, 810, 490];
const VIGNETTE_CENTER: [number, number] = [450, 311];
const BG_RECT_ATTRS = 'x="-500" y="-500" width="1900" height="1500"';

export const LANE_COLORS: Record<"idle" | PacketColor, string> = {
  idle: "var(--k-line-bccae6)",
  navy: "#0b3aa8",
  blue: "#1f6fe8",
  green: "#12a56b",
  amber: "#f2ac0a",
  violet: "#7656e0",
  teal: "#0e95a3",
  slate: "#5d6f95",
};

function createBidirectionalLanes(
  nodeA: NodeId,
  nodeB: NodeId,
  [x1, y1]: Point2D,
  [x2, y2]: Point2D,
  offset = 5.5,
): Record<string, [number, number, number, number]> {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * offset;
  const ny = ((x2 - x1) / len) * offset;
  return {
    [`${nodeA}>${nodeB}`]: [x1 + nx, y1 + ny, x2 + nx, y2 + ny],
    [`${nodeB}>${nodeA}`]: [x2 - nx, y2 - ny, x1 - nx, y1 - ny],
  };
}

export const LANE_COORDS: Record<string, [number, number, number, number]> = {
  "client>router": [262, 430, 371, 383],
  "router>client": [376, 355, 268, 403],
  "router>internet": [508.4, 357.1, 668.4, 434.8],
  "internet>router": [663.6, 444.6, 503.6, 366.9],
  "internet>dns": [690, 418, 690, 231],
  "dns>internet": [712, 229, 712, 404],
  "internet>web": [776, 418, 776, 254],
  "web>internet": [797, 264, 797, 438],
  ...createBidirectionalLanes("internet", "root", [799, 432], [928, 316]),
  ...createBidirectionalLanes("internet", "tld", [812, 457], [968, 440]),
  ...createBidirectionalLanes("internet", "auth", [796, 492], [925, 580]),
  ...createBidirectionalLanes("internet", "mx", [812, 455], [956, 395]),
};

export const ROUTE_LANES: Record<string, string[]> = {
  "client>dns": ["client>router", "router>internet", "internet>dns"],
  "dns>client": ["dns>internet", "internet>router", "router>client"],
  "client>web": ["client>router", "router>internet", "internet>web"],
  "web>client": ["web>internet", "internet>router", "router>client"],
  "dns>root": ["dns>internet", "internet>root"],
  "root>dns": ["root>internet", "internet>dns"],
  "dns>tld": ["dns>internet", "internet>tld"],
  "tld>dns": ["tld>internet", "internet>dns"],
  "dns>auth": ["dns>internet", "internet>auth"],
  "auth>dns": ["auth>internet", "internet>dns"],
  "client>router": ["client>router"],
  "router>client": ["router>client"],
  "client>internet": ["client>router", "router>internet"],
  "internet>client": ["internet>router", "router>client"],
  "router>web": ["router>internet", "internet>web"],
  "web>router": ["web>internet", "internet>router"],
  "web>dns": ["web>internet", "internet>dns"],
  "dns>web": ["dns>internet", "internet>web"],
  "web>mx": ["web>internet", "internet>mx"],
  "mx>web": ["mx>internet", "internet>web"],
};

export const DEFAULT_NODE_LABELS: Record<NodeId, [string, string]> = {
  internet: ["Internet", ""],
  client: ["Client", "192.168.1.10"],
  router: ["Router", "192.168.1.1"],
  dns: ["DNS Resolver", "8.8.8.8"],
  web: ["Web Server", "203.0.113.10"],
  root: ["Root Server", "198.41.0.4"],
  tld: [".com TLD Server", "192.5.6.30"],
  auth: ["Authoritative Server", "198.51.100.53"],
  mx: ["Mail Server", "198.51.100.25"],
};

export const SHORT_NODE_NAMES: Record<NodeId, string> = {
  client: "Client",
  router: "Router",
  dns: "DNS Resolver",
  internet: "Internet",
  web: "Web Server",
  root: "Root Server",
  tld: ".com Server",
  auth: "Authoritative",
  mx: "Mail Server",
};

const INTERNET_POS: Point2D = [728, 460];
const DNS_POS: Point2D = [701, 185];
const WEB_POS: Point2D = [812, 203];
const ROOT_POS: Point2D = [960, 300];
const TLD_POS: Point2D = [1005, 430];
const AUTH_POS: Point2D = [960, 575];
const MX_POS: Point2D = [1010, 380];

export const NODE_PULSE_CENTERS: Record<NodeId, Point2D> = {
  client: [214, 446],
  dns: [701, 180],
  router: [440, 360],
  internet: [732, 458],
  web: [812, 206],
  root: [960, 296],
  tld: [1005, 426],
  auth: [960, 571],
  mx: [1010, 378],
};

export const NODE_NOTE_ANCHORS: Partial<
  Record<NodeId, { x: number; y: number; side: "top" | "left" }>
> = {
  client: { x: 205, y: 372, side: "top" },
  router: { x: 440, y: 290, side: "top" },
  web: { x: 758, y: 200, side: "left" },
  dns: { x: 662, y: 212, side: "left" },
  internet: { x: 732, y: 396, side: "top" },
  mx: { x: 955, y: 345, side: "left" },
};

export const CAMERA_FRAME_NODES: Record<CameraFrameId, NodeId[]> = {
  client: ["client"],
  local: ["client", "router"],
  lookup: ["client", "router", "internet", "dns"],
  root: ["client", "router", "internet", "dns", "root"],
  tld: ["client", "router", "internet", "dns", "root", "tld"],
  path: ["client", "router", "internet", "web"],
  mailhost: ["client", "router", "internet", "dns", "web"],
  servers: ["internet", "dns", "web", "mx"],
  full: ["client", "router", "dns", "internet", "web", "root", "tld", "auth", "mx"],
};

const renderNodeLabel = (
  x: number,
  y: number,
  name: string,
  ip: string,
  anchor = "start",
  origin = "left-bottom",
): string =>
  `<g class="node-label" data-origin="${origin}"><text class="node-name" x="${x}" y="${y}" text-anchor="${anchor}">${t(name)}</text>` +
  (ip ? `<text class="node-ip" x="${x}" y="${y + 18}" text-anchor="${anchor}">${ip}</text>` : "") +
  "</g>";

function renderNetworkDefs(): string {
  const renderArrowMarker = (colorKey: string) =>
    `<marker id="head-${colorKey}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.2" markerHeight="6.2" orient="auto-start-reverse">
       <path d="M0,0.6 L10,5 L0,9.4 Z" fill="${LANE_COLORS[colorKey as keyof typeof LANE_COLORS]}"/></marker>`;

  return `<defs>
    ${Object.keys(LANE_COLORS).map(renderArrowMarker).join("")}
    <pattern id="iso-grid" width="62.354" height="36" patternUnits="userSpaceOnUse" x="9" y="4">
      <path d="M0,0 L62.354,36 M62.354,0 L0,36" stroke="var(--k-line-e4eaf5)" stroke-width="1"/>
    </pattern>
    <!-- the grid fades into the panel towards the edges -->
    <radialGradient id="grid-vignette" gradientUnits="userSpaceOnUse" cx="${VIGNETTE_CENTER[0]}" cy="${VIGNETTE_CENTER[1]}" r="560">
      <stop offset="0" stop-color="var(--k-fill-fefeff)" stop-opacity="0"/>
      <stop offset="0.6" stop-color="var(--k-fill-fefeff)" stop-opacity="0.4"/>
      <stop offset="1" stop-color="var(--k-fill-fefeff)" stop-opacity="1"/>
    </radialGradient>
    <!-- soft ground shadows, darkest against the device -->
    <linearGradient id="shadow-fade" x1="0" y1="0.25" x2="1" y2="0.75">
      <stop offset="0" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0.3"/>
      <stop offset="1" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="shadow-round">
      <stop offset="0" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0.26"/>
      <stop offset="1" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="face-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-f8fbff)"/><stop offset="1" stop-color="var(--k-fill-e6eefc)"/>
    </linearGradient>
    <linearGradient id="face-left" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-eff5ff)"/><stop offset="1" stop-color="var(--k-fill-dae5fb)"/>
    </linearGradient>
    <linearGradient id="face-right" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-e0eafc)"/><stop offset="1" stop-color="var(--k-fill-c7d7f6)"/>
    </linearGradient>
  </defs>`;
}

const URL_BAR_SVG = `
  <g class="url-holder" transform="translate(60 334)"><g class="url-bar">
    <path d="M128 26 L140 58" class="url-leader"/>
    <rect class="url-box" width="168" height="26" rx="3"/>
    <g class="url-globe" transform="translate(9 6)">
      <circle cx="7" cy="7" r="6"/><ellipse cx="7" cy="7" rx="2.6" ry="6"/><path d="M1.4 5h11.2M1.4 9h11.2"/>
    </g>
    <g class="url-lock" transform="translate(10 5)">
      <path d="M3 7 V4.6 a3.5 3.5 0 0 1 7 0 V7"/><rect x="1" y="7" width="11" height="8" rx="1.6"/>
    </g>
    <text class="url-text" x="29" y="17.5"></text>
    <rect class="url-caret" x="29" y="6.5" width="1.6" height="13"/>
    <path class="url-check" d="M0 13.5 l3.5 3.5 l6.5 -7" pathLength="1"/>
  </g></g>`;

const wrapNodeGroup = (nodeId: NodeId, innerSvg: string): string =>
  `<g class="node" data-node="${nodeId}">${innerSvg}</g>`;

export function renderNetworkTopologySvg(): string {
  const lanesSvg = Object.entries(LANE_COORDS)
    .map(([laneId, coords]) => {
      const [x1, y1, x2, y2] = coords.map((n) => n.toFixed(1));
      return `<path class="lane" data-lane="${laneId}" d="M${x1},${y1} L${x2},${y2}" marker-end="url(#head-idle)"/>`;
    })
    .join("");

  return `
  <svg class="network is-booting" viewBox="${DEFAULT_VIEWBOX.join(" ")}" preserveAspectRatio="xMidYMid meet" data-t-label="Network diagram" aria-label="${t("Network diagram")}">
    ${renderNetworkDefs()}
    <rect ${BG_RECT_ATTRS} fill="url(#iso-grid)"/>
    <rect ${BG_RECT_ATTRS} fill="url(#grid-vignette)"/>
    <g class="lanes">${lanesSvg}</g>
    <g class="pulse-layer"></g>
    ${wrapNodeGroup("internet", renderInternetCloudSvg(...INTERNET_POS) + renderNodeLabel(INTERNET_POS[0] - 2, 524, ...DEFAULT_NODE_LABELS.internet, "start", "center-top"))}
    ${wrapNodeGroup("client", renderLaptopSvg(240, 446) + renderNodeLabel(73, 494, ...DEFAULT_NODE_LABELS.client, "start", "right-top") + URL_BAR_SVG)}
    ${wrapNodeGroup("router", renderRouterSvg(440, 339) + renderNodeLabel(407, 426, ...DEFAULT_NODE_LABELS.router, "start", "left-top"))}
    ${wrapNodeGroup("dns", renderDnsServerSvg(...DNS_POS) + renderNodeLabel(654, 160, ...DEFAULT_NODE_LABELS.dns, "end", "right-bottom"))}
    ${wrapNodeGroup("web", renderTowerServerSvg(...WEB_POS) + renderNodeLabel(773, 106, ...DEFAULT_NODE_LABELS.web))}
    ${wrapNodeGroup("root", renderDnsServerSvg(...ROOT_POS) + renderNodeLabel(925, 228, ...DEFAULT_NODE_LABELS.root))}
    ${wrapNodeGroup("tld", renderDnsServerSvg(...TLD_POS) + renderNodeLabel(970, 360, ...DEFAULT_NODE_LABELS.tld))}
    ${wrapNodeGroup("auth", renderDnsServerSvg(...AUTH_POS) + renderNodeLabel(925, 505, ...DEFAULT_NODE_LABELS.auth))}
    ${wrapNodeGroup("mx", renderTowerServerSvg(...MX_POS) + renderNodeLabel(968, 286, ...DEFAULT_NODE_LABELS.mx))}
    <g class="packet-layer"></g>
    <g class="note-layer"></g>
  </svg>`;
}
