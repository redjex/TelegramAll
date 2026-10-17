/**
 * The intro of Telegram for Android, ported to WebGL.
 *
 * This is a line-by-line port of the official client's `TMessagesProj/jni/intro/IntroRenderer.c`
 * (the OpenGL ES code that draws the slides behind `IntroActivity`): the same shapes, shaders,
 * matrices, timings and per-page transitions, driven by the same inputs — the current page, the
 * scroll offset between pages, and the time. Matrices are column-major like the original:
 * `m[col * 4 + row]` is `M[col][row]` in the C code.
 */

type Mat = Float32Array;

type Xyz = {x: number, y: number, z: number};

type LayerParams = {anchor: Xyz, position: Xyz, rotation: number, scale: Xyz};

type Params = LayerParams & {
  alpha: number,
  sideLength: number,
  startAngle: number,
  endAngle: number,
  angle: number,
  size: {width: number, height: number},
  radius: number,
  width: number,
  datasize: number, // floats
  roundCount: number,
  mode: number,
  isStar: boolean
};

type Shape = {
  color: number[],
  data: Float32Array,
  buffer: WebGLBuffer,
  numPoints: number,
  params: Params
};

type TexturedShape = {
  texture: WebGLTexture,
  data: Float32Array,
  buffer: WebGLBuffer,
  numPoints: number,
  params: Params
};

enum Timing {Default, EaseIn, EaseOut, EaseInEaseOut, Linear, Sin, EaseOutBounce, Count}
enum Prog {NORMAL, NORMAL_ONE, RED, BLUE, LIGHT_RED, LIGHT_BLUE}

export type IntroTextures = {
  fast_arrow_shadow: TexImageSource,
  fast_arrow: TexImageSource,
  fast_body: TexImageSource,
  fast_spiral: TexImageSource,
  ic_bubble_dot: TexImageSource,
  ic_bubble: TexImageSource,
  ic_cam_lens: TexImageSource,
  ic_cam: TexImageSource,
  ic_pencil: TexImageSource,
  ic_pin: TexImageSource,
  ic_smile_eye: TexImageSource,
  ic_smile: TexImageSource,
  ic_videocam: TexImageSource,
  knot_down: TexImageSource,
  knot_up: TexImageSource,
  powerful_infinity_white: TexImageSource,
  powerful_infinity: TexImageSource,
  powerful_mask: HTMLImageElement,
  powerful_star: TexImageSource,
  private_door: TexImageSource,
  private_screw: TexImageSource,
  telegram_sphere: TexImageSource
};

const STARS_COUNT = 80;
const M_PI = Math.PI;

const deg2rad = (deg: number) => deg * M_PI / 180;
const D2R = deg2rad;
const R2D = (a: number) => a * 180 / M_PI;
const MAXf = Math.max;
const MINf = Math.min;

function frand(from: number, to: number) {
  return Math.random() * (to - from) + from;
}

function irand(from: number, to: number) {
  return Math.floor(Math.random() * (to - from + 1) + from);
}

function signrand() {
  return irand(0, 1) * 2 - 1;
}

/* ----------------------------- matrices ----------------------------- */

const newMat = (): Mat => new Float32Array(16);

function mat4x4_identity(M: Mat) {
  for(let i = 0; i < 4; ++i) {
    for(let j = 0; j < 4; ++j) {
      M[i * 4 + j] = i === j ? 1 : 0;
    }
  }
}

function mat4x4_dup(M: Mat, N: Mat) {
  for(let i = 0; i < 16; ++i) M[i] = N[i];
}

function mat4x4_scale_aniso(M: Mat, a: Mat, x: number, y: number, z: number) {
  for(let r = 0; r < 4; ++r) {
    M[0 * 4 + r] = a[0 * 4 + r] * x;
    M[1 * 4 + r] = a[1 * 4 + r] * y;
    M[2 * 4 + r] = a[2 * 4 + r] * z;
  }
}

function mat4x4_mul(M: Mat, a: Mat, b: Mat) {
  const out = new Float32Array(16);
  for(let c = 0; c < 4; ++c) {
    for(let r = 0; r < 4; ++r) {
      let s = 0;
      for(let k = 0; k < 4; ++k) {
        s += a[k * 4 + r] * b[c * 4 + k];
      }
      out[c * 4 + r] = s;
    }
  }
  M.set(out);
}

function mat4x4_mul_vec4(r: number[], M: Mat, v: number[]) {
  for(let j = 0; j < 4; ++j) {
    r[j] = 0;
    for(let i = 0; i < 4; ++i) {
      r[j] += M[i * 4 + j] * v[i];
    }
  }
}

function mat4x4_translate(T: Mat, x: number, y: number, z: number) {
  mat4x4_identity(T);
  T[3 * 4 + 0] = x;
  T[3 * 4 + 1] = y;
  T[3 * 4 + 2] = z;
}

function mat4x4_rotate_Z2(Q: Mat, M: Mat, angle: number) {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const R = newMat();
  // R[0] = {c, s, 0, 0}; R[1] = {-s, c, 0, 0}; R[2] = {0, 0, 1, 0}; R[3] = {0, 0, 0, 1}
  R[0] = c; R[1] = s;
  R[4] = -s; R[5] = c;
  R[10] = 1;
  R[15] = 1;
  mat4x4_mul(Q, M, R);
}

function mat4x4_rotate_Z(Q: Mat, angle: number) {
  const temp = newMat();
  mat4x4_dup(temp, Q);
  mat4x4_rotate_Z2(Q, temp, angle);
}

function mat4x4_translate_in_place(m: Mat, x: number, y: number, z: number) {
  for(let i = 0; i < 4; ++i) {
    m[3 * 4 + i] += m[0 * 4 + i] * x + m[1 * 4 + i] * y + m[2 * 4 + i] * z;
  }
}

function mat4x4_translate_independed(m: Mat, x: number, y: number, z: number) {
  const tr = newMat();
  mat4x4_identity(tr);
  mat4x4_translate_in_place(tr, x, y, z);
  const mDup = newMat();
  mat4x4_dup(mDup, m);
  mat4x4_mul(m, tr, mDup);
}

function mat4x4_scaled(matrix: Mat, s: number) {
  mat4x4_identity(matrix);
  mat4x4_scale_aniso(matrix, matrix, s, s, s);
}

/* ----------------------------- params ----------------------------- */

const xyz = (x: number, y: number, z: number): Xyz => ({x, y, z});

function defaultLayerParams(): LayerParams {
  return {anchor: xyz(0, 0, 0), position: xyz(0, 0, 0), rotation: 0, scale: xyz(1, 1, 1)};
}

function defaultParams(): Params {
  return {
    ...defaultLayerParams(),
    alpha: 1,
    sideLength: 0,
    startAngle: 0,
    endAngle: 0,
    angle: 0,
    size: {width: 0, height: 0},
    radius: 0,
    width: 0,
    datasize: 0,
    roundCount: 0,
    mode: 0,
    isStar: false
  };
}

/* ----------------------------- the renderer ----------------------------- */

export type IntroRenderer = ReturnType<typeof createIntroRenderer>;

export function createIntroRenderer(gl: WebGLRenderingContext, images: IntroTextures, initialBackground: number[]) {
  /* ---- timing curves (cubic bezier through Newton-Raphson, as in the C code) ---- */
  const coefficientsX: number[][] = [];
  const coefficientsY: number[][] = [];
  {
    const c: number[][] = [];
    c[Timing.Default] = [0.25, 0.1, 0.25, 1.0];
    c[Timing.EaseInEaseOut] = [0.42, 0.0, 0.58, 1.0];
    c[Timing.EaseIn] = [0.42, 0.0, 1.0, 1.0];
    c[Timing.EaseOut] = [0.0, 0.0, 0.58, 1.0];
    c[Timing.EaseOutBounce] = [0.0, 0.0, 0.0, 1.25];
    c[Timing.Linear] = [0.0, 0.0, 1.0, 1.0];
    c[Timing.Sin] = [0, 0, 0, 0];
    const c0x = 0, c0y = 0, c3x = 1, c3y = 1;
    for(let i = 0; i < Timing.Count; i++) {
      const [c1x, c1y, c2x, c2y] = c[i];
      coefficientsX[i] = [c0x, -3 * c0x + 3 * c1x, 3 * c0x - 6 * c1x + 3 * c2x, -c0x + 3 * c1x - 3 * c2x + c3x];
      coefficientsY[i] = [c0y, -3 * c0y + 3 * c1y, 3 * c0y - 6 * c1y + 3 * c2y, -c0y + 3 * c1y - 3 * c2y + c3y];
    }
  }

  const evalAt = (t: number, k: number[]) => k[0] + t * k[1] + t * t * k[2] + t * t * t * k[3];
  const evalDeriv = (t: number, k: number[]) => k[1] + 2 * t * k[2] + 3 * t * t * k[3];

  function timing(x: number, type: Timing) {
    if(x === 0 || x === 1) {
      return x;
    }
    let t = x;
    for(let i = 0; i < 10; i++) {
      const x2 = evalAt(t, coefficientsX[type]) - x;
      const d = evalDeriv(t, coefficientsX[type]);
      t = t - x2 / d;
    }
    return evalAt(t, coefficientsY[type]);
  }

  /* ---- globals of the C file ---- */
  let scale_factor = 1;
  let width = 0, height = 0;
  let y_offset_absolute = 0;
  let y_offset = 0;
  let offset_y = 0;
  let surfaceCreated = false;
  let background_color = initialBackground.slice();

  const r1 = 58.5;
  const r2 = 70;
  let ms0 = 0;
  let date = 0, date0 = 0;
  const duration_const = 0.3;
  let direct = 0;
  let current_page = 0, prev_page = 0;
  let time = 0;
  let time_local = 0;
  const knot_delays = [0, 0, 0, 0];
  let ribbonLength = 86.5;
  let starsFar = 500;
  let scroll_offset = 0;
  let calculated_speedometer_sin = 0;
  let ms0_anim = 0;
  let fps_anim = 0;
  let last_stars_update_fps = 0;
  let count_anim_fps = 0;
  let speedometer_scroll_offset = 0, free_scroll_offset = 0, private_scroll_offset = 0;
  let anim_pencil_start_time = 0, anim_pencil_start_all_time = 0, anim_pencil_start_all_end_time = 0;
  let anim_pencil_stage = 0;
  let anim_bubble_dots_stage = 0;
  let anim_bubble_dots_end_period = 0;
  let anim_videocam_start_time = 0, anim_videocam_next_time = 0, anim_videocam_duration = 0, anim_videocam_angle = 0, anim_videocam_old_angle = 0;
  let anim_cam_start_time = 0, anim_cam_next_time = 0, anim_cam_duration = 0, anim_cam_angle = 0, anim_cam_old_angle = 0;
  let anim_cam_position = {x: 0, y: 0}, anim_cam_old_position = {x: 0, y: 0};
  let qShot = 0;
  let anim_camshot_start_time = 0, anim_camshot_duration = 0;
  let anim_smile_start_time1 = 0, anim_smile_start_time2 = 0, anim_smile_blink_start_time = 0;
  let anim_smile_blink_one = 0;
  let anim_smile_stage = 0;
  let scale = 0;
  let anim_pin_start_time = 0, anim_pin_duration = 0;
  let anim_pencil_period = 0;
  let cloud_scroll_offset = 0;

  const main_matrix = newMat();
  const stars_matrix = newMat();
  const ribbons_layer = newMat();
  const private_matrix = newMat();
  const ic_matrix = newMat();

  /* ---- shaders ---- */
  function compile(type: number, source: string) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('intro shader', gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function buildProgram(vs: string, fs: string) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    return program;
  }

  const VS_COLOR = 'uniform mat4 u_MvpMatrix;attribute vec4 a_Position;void main(){gl_Position = u_MvpMatrix * a_Position;}';
  const FS_COLOR = 'precision lowp float;uniform vec4 u_Color;uniform float u_Alpha;void main() {gl_FragColor = u_Color;gl_FragColor.w*=u_Alpha;}';
  const VS_TEX = 'uniform mat4 u_MvpMatrix;attribute vec4 a_Position;attribute vec2 a_TextureCoordinates;varying vec2 v_TextureCoordinates;void main(){v_TextureCoordinates = a_TextureCoordinates;gl_Position = u_MvpMatrix * a_Position;}';
  const fsTex = (body: string) => 'precision lowp float;uniform sampler2D u_TextureUnit;varying vec2 v_TextureCoordinates;uniform float u_Alpha;void main(){' + body + '}';

  type TexProgram = {program: WebGLProgram, aPos: number, aTex: number, uMvp: WebGLUniformLocation, uTex: WebGLUniformLocation, uAlpha: WebGLUniformLocation};
  const texProgram = (fsBody: string): TexProgram => {
    const program = buildProgram(VS_TEX, fsTex(fsBody));
    return {
      program,
      aPos: gl.getAttribLocation(program, 'a_Position'),
      aTex: gl.getAttribLocation(program, 'a_TextureCoordinates'),
      uMvp: gl.getUniformLocation(program, 'u_MvpMatrix'),
      uTex: gl.getUniformLocation(program, 'u_TextureUnit'),
      uAlpha: gl.getUniformLocation(program, 'u_Alpha')
    };
  };

  const colorProgramId = buildProgram(VS_COLOR, FS_COLOR);
  const color_program = {
    program: colorProgramId,
    aPos: gl.getAttribLocation(colorProgramId, 'a_Position'),
    uMvp: gl.getUniformLocation(colorProgramId, 'u_MvpMatrix'),
    uColor: gl.getUniformLocation(colorProgramId, 'u_Color'),
    uAlpha: gl.getUniformLocation(colorProgramId, 'u_Alpha')
  };

  const programs: TexProgram[] = [];
  programs[Prog.NORMAL] = texProgram('gl_FragColor = texture2D(u_TextureUnit, v_TextureCoordinates);gl_FragColor.w *= u_Alpha;');
  programs[Prog.BLUE] = texProgram('gl_FragColor = texture2D(u_TextureUnit, v_TextureCoordinates);float p = u_Alpha*gl_FragColor.w;gl_FragColor = vec4(0,0.6,0.898,p);');
  programs[Prog.RED] = texProgram('gl_FragColor = texture2D(u_TextureUnit, v_TextureCoordinates);float p = gl_FragColor.w*u_Alpha;gl_FragColor = vec4(210./255.,57./255.,41./255.,p);');
  programs[Prog.LIGHT_RED] = texProgram('gl_FragColor = texture2D(u_TextureUnit, v_TextureCoordinates);float p = u_Alpha*gl_FragColor.w;gl_FragColor = vec4(246./255., 73./255., 55./255., p);');
  programs[Prog.LIGHT_BLUE] = texProgram('gl_FragColor = texture2D(u_TextureUnit, v_TextureCoordinates);float p = u_Alpha*gl_FragColor.w;gl_FragColor = vec4(42./255.,180./255.,247./255.,p);');
  programs[Prog.NORMAL_ONE] = texProgram('gl_FragColor = texture2D(u_TextureUnit, v_TextureCoordinates);gl_FragColor *= u_Alpha;');

  /* ---- buffers & textures ---- */
  function createVbo(data: Float32Array, usage: number) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
  }

  function uploadTexture(source: TexImageSource, texture?: WebGLTexture) {
    texture ||= gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return texture;
  }

  const tex = {} as Record<keyof IntroTextures | 'telegram_mask' | 'powerful_mask', WebGLTexture>;
  (Object.keys(images) as (keyof IntroTextures)[]).forEach((key) => {
    if(key === 'powerful_mask') return;
    tex[key] = uploadTexture(images[key]);
  });

  /** A copy of `source` painted in `color`, keeping only its alpha (PorterDuff SRC_IN). */
  function tintedBitmap(source: HTMLImageElement, color: number[]) {
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth || source.width;
    canvas.height = source.naturalHeight || source.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = cssColor(color);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /** The window colour with a circle cut out of it (a hole that shows the sphere through). */
  function telegramMaskBitmap(color: number[]) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = cssColor(color);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.height / 2, 0, M_PI * 2);
    ctx.fill();
    return canvas;
  }

  const cssColor = (c: number[]) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3]})`;

  tex.powerful_mask = uploadTexture(tintedBitmap(images.powerful_mask, background_color));
  tex.telegram_mask = uploadTexture(telegramMaskBitmap(background_color));

  /* ---- shape generators (the gen_* / create_* / change_* functions) ---- */
  const cpoint = (out: Float32Array, idx: number, x: number, y: number) => {
    out[idx * 2] = x;
    out[idx * 2 + 1] = y;
  };

  function gen_rounded_rectangle(out: Float32Array, size: {width: number, height: number}, radius: number, round_count: number) {
    let offset = 0;
    cpoint(out, offset++, 0, 0);
    const k = M_PI / 2 / (round_count + 1);
    let n = 0;
    let i;
    for(i = (round_count + 2) * n; i <= round_count + 1 + (round_count + 1) * n; i++) {
      cpoint(out, offset++, size.width / 2 - radius + Math.cos(i * k) * radius, size.height / 2 - radius + Math.sin(i * k) * radius);
    }
    n++;
    for(i = (round_count + 1) * n; i <= round_count + 1 + (round_count + 1) * n; i++) {
      cpoint(out, offset++, -size.width / 2 + radius + Math.cos(i * k) * radius, size.height / 2 - radius + Math.sin(i * k) * radius);
    }
    n++;
    for(i = (round_count + 1) * n; i <= round_count + 1 + (round_count + 1) * n; i++) {
      cpoint(out, offset++, -size.width / 2 + radius + Math.cos(i * k) * radius, -size.height / 2 + radius + Math.sin(i * k) * radius);
    }
    n++;
    for(i = (round_count + 1) * n; i <= round_count + 1 + (round_count + 1) * n; i++) {
      cpoint(out, offset++, size.width / 2 - radius + Math.cos(i * k) * radius, -size.height / 2 + radius + Math.sin(i * k) * radius);
    }
    cpoint(out, offset, size.width / 2, size.height / 2 - radius);
  }

  function create_rounded_rectangle(size: {width: number, height: number}, radius: number, round_count: number, color: number[]): Shape {
    const real_vertex_count = 4 * (2 + round_count) + 2;
    const params = defaultParams();
    params.datasize = real_vertex_count * 2 * 2;
    params.roundCount = round_count;
    params.mode = gl.TRIANGLE_FAN;
    params.size = {...size};
    params.radius = radius;
    const data = new Float32Array(params.datasize);
    gen_rounded_rectangle(data, params.size, params.radius, params.roundCount);
    return {color: color.slice(), data, buffer: createVbo(data, gl.DYNAMIC_DRAW), numPoints: real_vertex_count, params};
  }

  function change_rounded_rectangle(shape: Shape, size: {width: number, height: number}, radius: number) {
    const p = shape.params;
    if(p.size.width !== size.width || p.size.height !== size.height || p.radius !== radius) {
      p.size.width = size.width;
      p.size.height = size.height;
      p.radius = radius;
      gen_rounded_rectangle(shape.data, p.size, p.radius, p.roundCount);
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, shape.data);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
  }

  function square_point(angle: number, radius: number) {
    let p = {x: 0, y: 0};
    if(angle <= M_PI / 2 * 0.5 || angle > M_PI / 2 * 3.5) {
      p = {x: radius, y: radius * Math.sin(angle) / Math.cos(angle)};
    } else if(angle <= M_PI / 2 * 1.5) {
      p = {x: radius * Math.cos(angle) / Math.sin(angle), y: radius};
    } else if(angle <= M_PI / 2 * 2.5) {
      p = {x: -radius, y: -radius * Math.sin(angle) / Math.cos(angle)};
    } else if(angle <= M_PI / 2 * 3.5) {
      p = {x: -radius * Math.cos(angle) / Math.sin(angle), y: -radius};
    }
    return p;
  }

  const square_texture_point = (p: {x: number, y: number}, side_length: number) => ({
    x: -p.x / side_length * 0.5 + 0.5,
    y: -p.y / side_length * 0.5 + 0.5
  });

  function gen_segmented_square(out: Float32Array, side_length: number, start_angle: number, end_angle: number) {
    let p;
    const radius = side_length;
    let offset = 0;
    const k = 1;
    const da = D2R(-2.6 * 2) * k;
    const push = (pt: {x: number, y: number}) => {
      cpoint(out, offset++, pt.x, pt.y);
      const t = square_texture_point(pt, side_length);
      cpoint(out, offset++, t.x, t.y);
    };
    p = {x: Math.sin(start_angle + end_angle) * 6 * k, y: -Math.cos(start_angle + end_angle) * 6 * k};
    push(p);
    p = square_point(start_angle + da, radius);
    push(p);
    let q = 0;
    let i: number;
    for(i = Math.trunc(start_angle); i < Math.floor(R2D(start_angle + end_angle + da)); i++) {
      if((i + 45) % 90 === 0) {
        p = square_point(D2R(i), radius);
        push(p);
        q++;
      }
    }
    p = square_point(start_angle + end_angle + da, radius);
    push(p);
    for(i = 0; i < 4 - q; i++) {
      p = square_point(start_angle + end_angle + da, radius);
      push(p);
    }
  }

  function create_segmented_square(side_length: number, start_angle: number, end_angle: number, texture: WebGLTexture): TexturedShape {
    const real_vertex_count = 7;
    const params = defaultParams();
    params.datasize = real_vertex_count * 2 * 2 * 2;
    params.mode = gl.TRIANGLE_FAN;
    const data = new Float32Array(params.datasize);
    gen_segmented_square(data, side_length, start_angle, end_angle);
    return {texture, data, buffer: createVbo(data, gl.DYNAMIC_DRAW), numPoints: real_vertex_count, params};
  }

  function change_segmented_square(shape: TexturedShape, side_length: number, start_angle: number, end_angle: number) {
    const p = shape.params;
    if(p.sideLength !== side_length || p.startAngle !== start_angle || p.endAngle !== end_angle) {
      p.sideLength = side_length;
      p.startAngle = start_angle;
      p.endAngle = end_angle;
      shape.data.fill(0);
      gen_segmented_square(shape.data, side_length, start_angle, end_angle);
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, shape.data);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
  }

  function create_rectangle(size: {width: number, height: number}, color: number[]): Shape {
    const params = defaultParams();
    params.datasize = 4 * 2;
    params.mode = gl.TRIANGLE_STRIP;
    const data = new Float32Array(params.datasize);
    cpoint(data, 0, -size.width / 2, -size.height / 2);
    cpoint(data, 1, size.width / 2, -size.height / 2);
    cpoint(data, 2, -size.width / 2, size.height / 2);
    cpoint(data, 3, size.width / 2, size.height / 2);
    return {color: color.slice(), data, buffer: createVbo(data, gl.DYNAMIC_DRAW), numPoints: 4, params};
  }

  const rectangle_texture_point = (p: {x: number, y: number}, size: {width: number, height: number}) => ({
    x: 1 - (-p.x / size.width + 0.5),
    y: p.y / size.height + 0.5
  });

  function create_textured_rectangle(size: {width: number, height: number}, texture: WebGLTexture): TexturedShape {
    const params = defaultParams();
    params.datasize = 4 * 2 * 2;
    params.mode = gl.TRIANGLE_STRIP;
    const data = new Float32Array(params.datasize);
    const corners = [
      {x: -size.width / 2, y: -size.height / 2},
      {x: size.width / 2, y: -size.height / 2},
      {x: -size.width / 2, y: size.height / 2},
      {x: size.width / 2, y: size.height / 2}
    ];
    corners.forEach((c, i) => {
      cpoint(data, i * 2, c.x, c.y);
      const t = rectangle_texture_point(c, size);
      cpoint(data, i * 2 + 1, t.x, t.y);
    });
    return {texture, data, buffer: createVbo(data, gl.STATIC_DRAW), numPoints: 4, params};
  }

  function gen_ribbon(out: Float32Array, length: number) {
    cpoint(out, 0, -MAXf(length - 5.5, 0), -5.5);
    cpoint(out, 1, 0, -5.5);
    cpoint(out, 2, -MAXf(length, 0), 5.5);
    cpoint(out, 3, 0, 5.5);
  }

  function create_ribbon(length: number, color: number[]): Shape {
    const params = defaultParams();
    params.datasize = 4 * 2;
    params.mode = gl.TRIANGLE_STRIP;
    params.sideLength = length;
    const data = new Float32Array(params.datasize);
    gen_ribbon(data, length);
    return {color: color.slice(), data, buffer: createVbo(data, gl.DYNAMIC_DRAW), numPoints: 4, params};
  }

  function change_ribbon(shape: Shape, length: number) {
    if(shape.params.sideLength !== length) {
      shape.params.sideLength = length;
      gen_ribbon(shape.data, length);
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, shape.data);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
  }

  function create_circle(radius: number, vertex_count: number, color: number[]): Shape {
    const real_vertex_count = vertex_count + 2;
    const params = defaultParams();
    params.datasize = real_vertex_count * 2;
    params.mode = gl.TRIANGLE_FAN;
    params.roundCount = vertex_count;
    const data = new Float32Array(params.datasize);
    let offset = 0;
    cpoint(data, offset++, 0, 0);
    for(let i = 0; i <= vertex_count; i++) {
      cpoint(data, offset++, radius * Math.cos(2 * M_PI * (i / vertex_count)), radius * Math.sin(2 * M_PI * (i / vertex_count)));
    }
    return {color: color.slice(), data, buffer: createVbo(data, gl.STATIC_DRAW), numPoints: real_vertex_count, params};
  }

  function gen_infinity(out: Float32Array, width_: number, angle: number, segment_count: number) {
    const path = [
      {x: 53, y: 23}, {x: 49, y: 31}, {x: 39, y: 47}, {x: 22, y: 47}, {x: 6, y: 47}, {x: 0, y: 31}, {x: 0, y: 23},
      {x: 0, y: 16}, {x: 5, y: 0}, {x: 23, y: 0}, {x: 39, y: 0}, {x: 48, y: 15}, {x: 52, y: 21}
    ];
    let offset = 0;
    for(let seg = 0; seg <= segment_count; seg++) {
      const tt = (seg / segment_count) * angle;
      const q = 4;
      const tstep = 1 / q;
      const n = Math.floor(tt / tstep);
      const a = path[0 + 3 * n];
      const p1 = path[1 + 3 * n];
      const p2 = path[2 + 3 * n];
      const b = path[3 + 3 * n];
      const t = (tt - tstep * n) * q;
      const nt = 1 - t;

      const p = [
        a.x * nt * nt * nt + 3 * p1.x * nt * nt * t + 3 * p2.x * nt * t * t + b.x * t * t * t,
        a.y * nt * nt * nt + 3 * p1.y * nt * nt * t + 3 * p2.y * nt * t * t + b.y * t * t * t
      ];
      const tangent = [
        -3 * a.x * nt * nt + 3 * p1.x * (1 - 4 * t + 3 * t * t) + 3 * p2.x * (2 * t - 3 * t * t) + 3 * b.x * t * t,
        -3 * a.y * nt * nt + 3 * p1.y * (1 - 4 * t + 3 * t * t) + 3 * p2.y * (2 * t - 3 * t * t) + 3 * b.y * t * t
      ];
      const tan_norm = [-tangent[1], tangent[0]];
      const len = Math.sqrt(tan_norm[0] * tan_norm[0] + tan_norm[1] * tan_norm[1]);
      const k = 1 / len;
      const norm = [tan_norm[0] * k, tan_norm[1] * k];

      cpoint(out, offset++, p[0] + norm[0] * (+width_ / 2), p[1] + norm[1] * (+width_ / 2));
      cpoint(out, offset++, p[0] + norm[0] * (-width_ / 2), p[1] + norm[1] * (-width_ / 2));
    }
  }

  function create_infinity(width_: number, angle: number, segment_count: number, color: number[]): Shape {
    const real_vertex_count = (segment_count + 1) * 2;
    const params = defaultParams();
    params.datasize = real_vertex_count * 2;
    params.mode = gl.TRIANGLE_STRIP;
    params.roundCount = segment_count;
    params.width = width_;
    params.angle = angle;
    const data = new Float32Array(params.datasize);
    gen_infinity(data, width_, angle, segment_count);
    return {color: color.slice(), data, buffer: createVbo(data, gl.DYNAMIC_DRAW), numPoints: real_vertex_count, params};
  }

  function change_infinity(shape: Shape, angle: number) {
    if(shape.params.angle !== angle) {
      shape.params.angle = angle;
      gen_infinity(shape.data, shape.params.width, shape.params.angle, shape.params.roundCount);
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, shape.data, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
  }

  function gen_rounded_rectangle_stroked(out: Float32Array, size: {width: number, height: number}, radius: number, stroke_width: number, round_count: number) {
    let offset = 0;
    const k = M_PI / 2 / (round_count + 1);
    const inner_radius = radius - stroke_width;
    let n = 0;
    let i;
    const both = (cx: number, cy: number, ang: number) => {
      cpoint(out, offset++, cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
      cpoint(out, offset++, cx + Math.cos(ang) * inner_radius, cy + Math.sin(ang) * inner_radius);
    };
    for(i = (round_count + 2) * n; i <= round_count + 1 + (round_count + 1) * n; i++) {
      both(size.width / 2 - radius, size.height / 2 - radius, i * k);
    }
    n++;
    for(i = (round_count + 1) * n; i <= round_count + 1 + (round_count + 1) * n; i++) {
      both(-size.width / 2 + radius, size.height / 2 - radius, i * k);
    }
    n++;
    for(i = (round_count + 1) * n; i <= round_count + 1 + (round_count + 1) * n; i++) {
      both(-size.width / 2 + radius, -size.height / 2 + radius, i * k);
    }
    n++;
    for(i = (round_count + 1) * n; i <= round_count + 1 + (round_count + 1) * n; i++) {
      both(size.width / 2 - radius, -size.height / 2 + radius, i * k);
    }
    both(size.width / 2 - radius, size.height / 2 - radius, 0);
  }

  function create_rounded_rectangle_stroked(size: {width: number, height: number}, radius: number, stroke_width: number, round_count: number, color: number[]): Shape {
    const real_vertex_count = 4 * (2 + round_count) * 2 + 2;
    const params = defaultParams();
    params.roundCount = round_count;
    params.datasize = real_vertex_count * 2 * 2;
    params.size = {...size};
    params.radius = radius;
    params.width = stroke_width;
    const data = new Float32Array(params.datasize);
    gen_rounded_rectangle_stroked(data, params.size, params.radius, params.width, params.roundCount);
    params.mode = gl.TRIANGLE_STRIP;
    return {color: color.slice(), data, buffer: createVbo(data, gl.DYNAMIC_DRAW), numPoints: real_vertex_count, params};
  }

  function change_rounded_rectangle_stroked(shape: Shape, size: {width: number, height: number}, radius: number) {
    const p = shape.params;
    if(p.size.width !== size.width || p.size.height !== size.height || p.radius !== radius) {
      p.size.width = size.width;
      p.size.height = size.height;
      p.radius = radius;
      gen_rounded_rectangle_stroked(shape.data, p.size, p.radius, p.width, p.roundCount);
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, shape.data);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
  }

  /* ---- drawing ---- */
  function mvp_matrix(out: Mat, params: Params, view_projection_matrix: Mat) {
    const model_matrix = newMat();
    mat4x4_identity(model_matrix);
    const id = newMat();
    mat4x4_identity(id);
    mat4x4_translate(model_matrix, -params.anchor.x, -params.anchor.y, params.anchor.z);
    const scaled = newMat();
    mat4x4_identity(scaled);
    mat4x4_scale_aniso(scaled, scaled, params.scale.x, -params.scale.y, params.scale.z);
    const tmp = newMat();
    mat4x4_dup(tmp, model_matrix);
    mat4x4_mul(model_matrix, scaled, tmp);
    const rotate = newMat();
    mat4x4_dup(rotate, id);
    mat4x4_rotate_Z2(rotate, id, deg2rad(-params.rotation));
    mat4x4_dup(tmp, model_matrix);
    mat4x4_mul(model_matrix, rotate, tmp);
    mat4x4_translate_independed(model_matrix, params.position.x, -params.position.y, params.position.z);
    const model_matrix3 = newMat();
    mat4x4_identity(model_matrix3);
    const mm = newMat();
    mat4x4_mul(mm, model_matrix3, view_projection_matrix);
    mat4x4_mul(out, mm, model_matrix);
    mat4x4_translate_independed(out, 0, -y_offset / view_projection_matrix[3 * 4 + 3], 0);
  }

  const mvp = newMat();

  function draw_shape(shape: Shape, view_projection_matrix: Mat) {
    const p = shape.params;
    if(p.alpha > 0 && Math.abs(p.scale.x) > 0 && Math.abs(p.scale.y) > 0 && Math.abs(p.scale.z) > 0) {
      mvp_matrix(mvp, p, view_projection_matrix);
      gl.useProgram(color_program.program);
      gl.uniformMatrix4fv(color_program.uMvp, false, mvp);
      if(p.rotation === 10) {
        gl.uniform4fv(color_program.uColor, [0, 1, 0, 1]);
      } else {
        gl.uniform4fv(color_program.uColor, shape.color);
      }
      gl.uniform1f(color_program.uAlpha, p.alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
      gl.vertexAttribPointer(color_program.aPos, 2, gl.FLOAT, false, 8, 0);
      gl.enableVertexAttribArray(color_program.aPos);
      gl.drawArrays(p.mode, 0, shape.numPoints);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
  }

  function draw_textured_shape(shape: TexturedShape, view_projection_matrix: Mat, program_type: Prog) {
    const p = shape.params;
    if(p.alpha > 0 && Math.abs(p.scale.x) > 0 && Math.abs(p.scale.y) > 0 && Math.abs(p.scale.z) > 0) {
      mvp_matrix(mvp, p, view_projection_matrix);
      if(p.isStar) {
        const pos = [0, 0, 0, 0];
        mat4x4_mul_vec4(pos, mvp, [0, 0, 0, 1]);
        const p_NDC = [pos[0] / pos[3], pos[1] / pos[3], pos[2] / pos[3], pos[3] / pos[3]];
        const p_window = [p_NDC[0] * width, -p_NDC[1] * height, 0, 0];
        const d = 160;
        if(Math.abs(p_window[0]) > d || p_window[1] > y_offset_absolute * 2 + d || p_window[1] < y_offset_absolute * 2 - d) {
          return;
        }
      }
      const prog = programs[program_type];
      gl.useProgram(prog.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, shape.texture);
      gl.uniformMatrix4fv(prog.uMvp, false, mvp);
      gl.uniform1i(prog.uTex, 0);
      gl.uniform1f(prog.uAlpha, p.alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
      gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(prog.aTex, 2, gl.FLOAT, false, 16, 8);
      gl.enableVertexAttribArray(prog.aPos);
      gl.enableVertexAttribArray(prog.aTex);
      gl.drawArrays(p.mode, 0, shape.numPoints);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
  }

  /* ---- the animation helpers ---- */
  function t(start_value: number, end_value: number, start_time: number, duration: number, type: Timing) {
    if(time > start_time + duration) {
      return end_value;
    }
    if(type === Timing.Linear) {
      return start_value + (end_value - start_value) * MINf(duration + start_time, MAXf(0, time - start_time)) / duration;
    }
    return start_value + (end_value - start_value) * timing(MINf(duration + start_time, MAXf(0, time - start_time)) / duration, type);
  }

  function t_reversed(end_value: number, start_value: number, start_time: number, duration: number, type: Timing) {
    if(time > start_time + duration) {
      return end_value;
    }
    if(type === Timing.Linear) {
      return start_value + (end_value - start_value) * MINf(duration + start_time, MAXf(0, time - start_time)) / duration;
    }
    return start_value + (end_value - start_value) * timing(MINf(duration + start_time, MAXf(0, time - start_time)) / duration, type);
  }

  function t_local(start_value: number, end_value: number, start_time: number, duration: number, type: Timing) {
    if(type === Timing.Sin) {
      return start_value + (end_value - start_value) * Math.sin(MINf(MAXf((time_local - start_time) / duration * M_PI, 0), M_PI));
    }
    if(time_local > start_time + duration) {
      return end_value;
    }
    if(type === Timing.Linear) {
      return start_value + (end_value - start_value) * MINf(duration + start_time, MAXf(0, time_local - start_time)) / duration;
    }
    return start_value + (end_value - start_value) * timing(MINf(duration + start_time, MAXf(0, time_local - start_time)) / duration, type);
  }

  /* ---- stars ---- */
  function star_create_position(far: number): Xyz {
    starsFar = 1500;
    const minR = 100;
    const maxR = 1000;
    return xyz(signrand() * frand(minR, maxR), signrand() * frand(minR, maxR), far);
  }

  function star_initial_position(randZ: number, forward: number): Xyz {
    starsFar = 1500;
    const minR = 100;
    const maxR = 1000;
    let z = 0;
    if(forward === 1) {
      if(randZ === 0) {
        z = -starsFar;
      } else {
        z = frand(0, -starsFar);
      }
    }
    return xyz(signrand() * frand(minR, maxR), signrand() * frand(minR, maxR), z);
  }

  function mat4x4_plain(M: Mat, w: number, h: number) {
    M.fill(0);
    M[0 * 4 + 0] = 1;
    M[1 * 4 + 1] = w / h;
    M[2 * 4 + 2] = 1;
    M[3 * 4 + 3] = w / 2;
  }

  function mat4x4_stars(m: Mat, w: number, h: number) {
    if(h >= w) {
      const k = w / h;
      const q = 1.4;
      m.fill(0);
      m[0 * 4 + 0] = 1 / q;
      m[1 * 4 + 1] = k / q;
      m[2 * 4 + 2] = 1;
      m[2 * 4 + 3] = -1.25;
      m[3 * 4 + 3] = w * k;
    } else {
      const k = h / w;
      const q = 2;
      m.fill(0);
      m[0 * 4 + 0] = 1 / q;
      m[1 * 4 + 1] = (1 / k) / q;
      m[2 * 4 + 2] = 1;
      m[2 * 4 + 3] = -1.25;
      m[3 * 4 + 3] = h * k;
    }
    mat4x4_translate_independed(m, 0, -2 * y_offset_absolute / h + 4 * scale_factor / h, 0);
  }

  function rglNormalDraw() {
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.colorMask(true, true, true, true);
    gl.depthMask(false);
  }

  function rglMaskDraw() {
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    gl.depthFunc(gl.GREATER);
    gl.clearDepth(0);
    gl.clear(gl.DEPTH_BUFFER_BIT);
  }

  function rglNormalDrawThroughMask() {
    gl.colorMask(true, true, true, true);
    gl.depthFunc(gl.LESS);
    gl.depthMask(false);
  }

  function mat4x4_layer(matrix: Mat, params: LayerParams, s: number, r: number) {
    const a = main_matrix[1 * 4 + 1];
    const model_matrix = newMat();
    mat4x4_identity(model_matrix);
    const id = newMat();
    mat4x4_identity(id);
    const sc = main_matrix[3 * 4 + 3];
    mat4x4_translate(model_matrix, -params.anchor.x / sc, params.anchor.y / sc * a, params.anchor.z / sc);
    const scaled = newMat();
    mat4x4_identity(scaled);
    const f = 1;
    mat4x4_scale_aniso(scaled, scaled, params.scale.x * f, params.scale.y * f, params.scale.z * f);
    const tmp = newMat();
    mat4x4_dup(tmp, model_matrix);
    mat4x4_mul(model_matrix, scaled, tmp);
    const rotate = newMat();
    mat4x4_dup(rotate, id);
    mat4x4_rotate_Z2(rotate, id, -deg2rad(params.rotation));
    mat4x4_dup(tmp, model_matrix);
    mat4x4_mul(model_matrix, rotate, tmp);
    mat4x4_translate_independed(model_matrix, params.position.x / sc, -params.position.y / sc * a, params.position.z / sc);

    const m = newMat();
    mat4x4_mul(m, model_matrix, main_matrix);

    m[0 * 4 + 1] *= a;
    m[1 * 4 + 0] /= a;
    // C: m[1][0] /= a; m[0][1] *= a;  (m[col][row]) -> m[1*4+0] /= a, m[0*4+1] *= a

    const scale_m = newMat();
    mat4x4_scaled(scale_m, s);
    mat4x4_rotate_Z(scale_m, r);
    scale_m[1 * 4 + 0] /= a;
    scale_m[0 * 4 + 1] *= a;
    mat4x4_mul(matrix, scale_m, m);
  }

  /* ---- shapes (created in onSurfaceCreated) ---- */
  const black_color = [0, 0, 0, 1];
  const white_color = [1, 1, 1, 1];

  let ribbonLayer = defaultLayerParams();
  let privateLayer = defaultLayerParams();
  let ic_pin_layer = defaultLayerParams();
  let ic_cam_layer = defaultLayerParams();
  let ic_videocam_layer = defaultLayerParams();
  let ic_smile_layer = defaultLayerParams();
  let ic_bubble_layer = defaultLayerParams();
  let ic_pencil_layer = defaultLayerParams();

  const ang0 = 180;
  const spiral = create_segmented_square(r1, D2R(35 + 1), D2R(35 + 1 - 10 + ang0), tex.fast_spiral);
  const mask1 = create_rounded_rectangle({width: 60, height: 60}, 0, 16, black_color);

  const telegram_sphere = create_textured_rectangle({width: 150, height: 150}, tex.telegram_sphere);
  let telegram_mask = create_textured_rectangle({width: 200, height: 150}, tex.telegram_mask);

  const fast_body = create_textured_rectangle({width: 148, height: 148}, tex.fast_body);
  const fast_arrow_shadow = create_textured_rectangle({width: 164 / 2, height: 44 / 2}, tex.fast_arrow_shadow);
  fast_arrow_shadow.params.position.x = -1;
  fast_arrow_shadow.params.position.y = 2;
  const fast_arrow = create_textured_rectangle({width: 164 / 2, height: 44 / 2}, tex.fast_arrow);
  fast_arrow.params.anchor.x = fast_arrow_shadow.params.anchor.x = -19;

  const free_bg = create_rectangle({width: 160 * 2, height: 160 * 2}, [246 / 255, 73 / 255, 55 / 255, 1]);

  const free_knot1 = create_textured_rectangle({width: 138 / 3, height: 138 / 3}, tex.knot_up);
  free_knot1.params.anchor.x = -23 + 10;
  free_knot1.params.anchor.y = 23 - 10;
  const free_knot2 = create_textured_rectangle({width: 138 / 3, height: 138 / 3}, tex.knot_up);
  free_knot2.params.anchor.x = -23 + 10;
  free_knot2.params.anchor.y = 23 - 10;
  const free_knot3 = create_textured_rectangle({width: 150 / 3, height: 150 / 3}, tex.knot_down);
  free_knot3.params.anchor.x = -100 / 4 + 20 / 2;
  free_knot3.params.anchor.y = -100 / 4 + 20 / 2;

  ribbonLayer = defaultLayerParams();
  const ribbon1 = create_ribbon(ribbonLength, white_color);
  const ribbon2 = create_ribbon(ribbonLength, white_color);
  ribbon2.params.rotation = 90;
  const ribbon3 = create_ribbon(ribbonLength, white_color);
  ribbon3.params.rotation = 180;
  const ribbon4 = create_ribbon(ribbonLength, white_color);
  ribbon4.params.rotation = 270;
  ribbon1.params.position.y = ribbon2.params.position.y = ribbon3.params.position.y = ribbon4.params.position.y = -9;
  // the ribbons' own layer_params are not read by the draw code; the layer matrix is passed explicitly

  const ic_bubble_dot = create_textured_rectangle({width: 18 / 3, height: 18 / 3}, tex.ic_bubble_dot);
  const ic_bubble = create_textured_rectangle({width: 102 / 3, height: 102 / 3}, tex.ic_bubble);
  const ic_cam_lens = create_textured_rectangle({width: 36 / 3, height: 36 / 3}, tex.ic_cam_lens);
  const ic_cam = create_textured_rectangle({width: 108 / 3, height: 96 / 3}, tex.ic_cam);
  const ic_pencil = create_textured_rectangle({width: 86 / 3, height: 86 / 3}, tex.ic_pencil);
  const ic_pin = create_textured_rectangle({width: 90 / 3, height: 120 / 3}, tex.ic_pin);
  const ic_smile_eye = create_textured_rectangle({width: 18 / 3, height: 18 / 3}, tex.ic_smile_eye);
  const ic_smile = create_textured_rectangle({width: 120 / 3, height: 120 / 3}, tex.ic_smile);
  const ic_videocam = create_textured_rectangle({width: 144 / 3, height: 84 / 3}, tex.ic_videocam);

  ic_pin_layer = defaultLayerParams();
  ic_cam_layer = defaultLayerParams();
  ic_videocam_layer = defaultLayerParams();
  ic_smile_layer = defaultLayerParams();
  ic_bubble_layer = defaultLayerParams();
  ic_pencil_layer = defaultLayerParams();
  ic_pin_layer.anchor = xyz(0, 50 / 2, 0);
  ic_pencil_layer.anchor = xyz(-30 / 2, 30 / 2, 0);

  const infinity = create_infinity(11.7, 0, 32, white_color);

  const powerful_bg = create_rectangle({width: 200, height: 200}, [47 / 255, 90 / 255, 131 / 255, 1]);
  let powerful_mask = create_textured_rectangle({width: 200, height: 200}, tex.powerful_mask);
  const powerful_infinity = create_textured_rectangle({width: 366 / 3, height: 180 / 3}, tex.powerful_infinity);
  const powerful_infinity_white = create_textured_rectangle({width: 366 / 3, height: 180 / 3}, tex.powerful_infinity_white);

  const star_radius = 5.25;
  const star = create_textured_rectangle({width: star_radius, height: star_radius}, tex.powerful_star);
  star.params.isStar = true;
  const stars: Params[] = [];
  for(let i = 0; i < STARS_COUNT; i++) {
    stars[i] = defaultParams();
    stars[i].position = star_create_position(-(i * 1500) / STARS_COUNT);
  }

  privateLayer = defaultLayerParams();
  const private_bg = create_rectangle({width: 240, height: 240}, [200 / 255, 207 / 255, 212 / 255, 1]);
  const private_door = create_textured_rectangle({width: 408 / 3, height: 408 / 3}, tex.private_door);
  const private_screw = create_textured_rectangle({width: 30 / 3, height: 30 / 3}, tex.private_screw);
  const private_keyhole_body = create_textured_rectangle({width: 216 / 3, height: 216 / 3}, tex.private_screw);
  const private_stroke = create_rounded_rectangle_stroked({width: 244 / 2, height: 244 / 2}, 21, 9, 16, white_color);

  const cloud_polygons_count = 64;
  const cloud_extra_mask1 = create_circle(1, cloud_polygons_count, black_color);
  const cloud_extra_mask2 = create_circle(1, cloud_polygons_count, black_color);
  const cloud_extra_mask3 = create_circle(1, cloud_polygons_count, black_color);
  const cloud_extra_mask4 = create_circle(1, cloud_polygons_count, black_color);

  let cloud_cover = create_rectangle({width: 240, height: 100}, background_color);
  cloud_cover.params.anchor.y = -50;

  const cloud_bg = create_rectangle({width: 160 * 2, height: 160 * 2}, [42 / 255, 180 / 255, 247 / 255, 1]);

  surfaceCreated = true;

  /* ---- draw_stars / draw_ic / draw_safe ---- */
  function draw_stars() {
    const update = last_stars_update_fps !== fps_anim;
    last_stars_update_fps = fps_anim;

    y_offset = -100 * (width / height) * 0;
    for(let i = 0; i < STARS_COUNT; i++) {
      const stars_scroll_offset = MAXf(0, scroll_offset) * 2;

      let transition_speed;
      if(direct === 1) {
        const s = 5;
        transition_speed = s - t(0, s, 0, duration_const + 1 + 0.8, Timing.Linear);
      } else {
        transition_speed = t(-4, 0, 0, duration_const + 1, Timing.EaseOut);
      }

      const speed = stars_scroll_offset + transition_speed;
      if(update) {
        stars[i].position.z += speed;
      }

      if(stars[i].position.z > 0 && speed > 0) {
        stars[i].position = star_initial_position(0, 1);
      }
      if(stars[i].position.z < -1500 && speed < 0) {
        stars[i].position = star_initial_position(0, 0);
      }

      const inc = scroll_offset * 100;
      stars[i].position.z = stars[i].position.z + inc;

      star.params.position = stars[i].position;
      const s = 1 + (-stars[i].position.z) / starsFar * 5;

      star.params.scale = xyz(s, s, 1);
      const far = starsFar;
      star.params.alpha = (1 - (-stars[i].position.z) / far) * 10;
      star.params.alpha = star.params.alpha * star.params.alpha / 10;

      draw_textured_shape(star, stars_matrix, Prog.NORMAL);

      stars[i].position.z = stars[i].position.z - inc;
    }

    y_offset = offset_y;
  }

  const bubble_dots_sinf = (a: number) => a < M_PI * 2 * anim_bubble_dots_end_period ? Math.sin(a) : 0;

  function reset_ic() {
    anim_smile_start_time1 = time_local;
    anim_pencil_start_time = 0;
    anim_pencil_start_all_end_time = 0;
    anim_cam_next_time = time_local;
    anim_smile_stage = 0;
    anim_smile_blink_one = 0;
    anim_pencil_stage = 0;
    anim_bubble_dots_end_period = 4;
    anim_pencil_period = 1;
  }

  /** The spring that drops each glyph in: `value` is subtracted from the eased fall. */
  const bounceValue = (beginY: number, start: number, phase = 0) => {
    const arg = MAXf(0, time - start) * 50;
    return beginY * Math.pow(2.71, -0.055 * arg * 2) * Math.cos(0.08 * arg - phase) * 0.4;
  };

  function draw_ic(type: number) {
    let rotation: number;
    let beginTimeK: number;
    let commonDelay: number;
    const beginY = 250;
    let bounce: number;
    let COLOR: Prog, LIGHT_COLOR: Prog;
    if(type === 0) {
      beginTimeK = 2;
      commonDelay = duration_const * 0.5;
      bounce = 1;
      rotation = -D2R(free_scroll_offset);
      cloud_scroll_offset = 0;
      COLOR = Prog.RED;
      LIGHT_COLOR = Prog.LIGHT_RED;
    } else {
      rotation = 0;
      beginTimeK = 2.5;
      commonDelay = 0;
      bounce = 1;
      COLOR = Prog.BLUE;
      LIGHT_COLOR = Prog.LIGHT_BLUE;
    }
    let t_y: number;
    let ic_pos: {x: number, y: number};
    let ic_layer_alpha: number;
    if(current_page === 1 && direct === 0) {
      ic_layer_alpha = t(1, 0, 0, duration_const * 0.25, Timing.EaseOut);
    } else {
      ic_layer_alpha = 1;
    }
    ic_pin.params.alpha = ic_layer_alpha;
    ic_cam.params.alpha = ic_layer_alpha;
    ic_cam_lens.params.alpha = ic_layer_alpha;
    ic_smile.params.alpha = ic_layer_alpha;
    ic_smile_eye.params.alpha = ic_layer_alpha;
    ic_videocam.params.alpha = ic_layer_alpha;
    ic_bubble.params.alpha = ic_layer_alpha;
    ic_bubble_dot.params.alpha = ic_layer_alpha;
    ic_pencil.params.alpha = ic_layer_alpha;

    if(type === 0) {
      ic_pos = {x: -106 / 2, y: 61 / 2};
      if(current_page === 1 && direct === 0) {
        t_y = 0;
      } else {
        const s = commonDelay + duration_const * 0.2 * beginTimeK;
        t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
        t_y -= bounceValue(beginY, s) * bounce;
      }
    } else {
      ic_pos = {x: -162 / 2 + 4, y: +26 / 2 + 20};
      const s = commonDelay + duration_const * 0.2 * beginTimeK;
      t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
      t_y -= bounceValue(beginY, s, M_PI / 8) * bounce;
    }

    if(time_local > anim_pin_start_time) {
      if(time_local > anim_pin_start_time + anim_pin_duration) {
        anim_pin_start_time = time_local + duration_const * frand(10, 20) * 2;
        anim_pin_duration = duration_const * frand(10, 20) * 2;
      }
    }
    const pinasin = 0;
    ic_pin_layer.position = xyz(ic_pos.x + Math.cos(time_local * 5) * 3 * pinasin + cloud_scroll_offset, ic_pos.y + Math.sin(time_local * 5) * 1.5 * pinasin + t_y, 0);
    mat4x4_layer(ic_matrix, ic_pin_layer, 1, rotation);
    draw_textured_shape(ic_pin, ic_matrix, COLOR);

    if(type === 1) {
      ic_videocam_layer.rotation = -30 + t_local(anim_videocam_old_angle, anim_videocam_angle, anim_videocam_start_time, anim_videocam_duration, Timing.EaseOut);
      const s = commonDelay + duration_const * 0.45 * beginTimeK;
      t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
      t_y -= bounceValue(beginY, s) * bounce;
      if(t_y <= 1 && time_local > anim_videocam_next_time) {
        anim_videocam_duration = duration_const * frand(1, 1.5) * 1.5;
        anim_videocam_old_angle = anim_videocam_angle;
        anim_videocam_angle = 15 * irand(-1, 1);
        anim_videocam_start_time = time_local;
        anim_videocam_next_time = time_local + 1000000 + duration_const * frand(5, 8);
      }
      ic_videocam_layer.position = xyz(-68 / 2 + cloud_scroll_offset, +80 / 2 + t_y, 0);
      mat4x4_layer(ic_matrix, ic_videocam_layer, 1, rotation);
      draw_textured_shape(ic_videocam, ic_matrix, COLOR);
    }

    if(type === 0) {
      ic_pos = {x: 107 / 2, y: 78 / 2};
      if(current_page === 1 && direct === 0) {
        t_y = 0;
      } else {
        const s = commonDelay + duration_const * 0.3 * beginTimeK;
        t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
        t_y -= bounceValue(beginY, s) * bounce;
      }
    } else {
      ic_pos = {x: -28 / 2, y: -20 / 2 + 2};
      const s = commonDelay + duration_const * 0.15 * beginTimeK;
      t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
      t_y -= bounceValue(beginY, s) * bounce;
    }

    if(t_y <= 1 && time_local > anim_cam_next_time) {
      anim_cam_duration = duration_const * frand(1, 1.5);
      anim_cam_old_angle = anim_cam_angle;
      anim_cam_old_position = anim_cam_position;
      anim_cam_start_time = time_local;
      anim_cam_next_time = time_local + 10000000;
      const r = irand(0, 1);
      if(r === 0) {
        anim_cam_position = {x: -8 + 4, y: 0};
        anim_cam_angle = signrand() * 10;
      } else if(r === 1) {
        anim_cam_position = {x: 4, y: -5};
        anim_cam_angle = signrand() * 10;
      }
      qShot = irand(1, 2);
      anim_camshot_start_time = time_local + duration_const * 0.5;
      anim_camshot_duration = duration_const * 0.4;
    }

    ic_cam_layer.rotation = 15 + t_local(anim_cam_old_angle, anim_cam_angle, anim_cam_start_time, anim_cam_duration, Timing.EaseOut);
    ic_cam_layer.position = xyz(
      ic_pos.x + 0 * t_local(anim_cam_old_position.x, anim_cam_position.x, anim_cam_start_time, anim_cam_duration, Timing.EaseOut) + cloud_scroll_offset,
      ic_pos.y + 0 * t_local(anim_cam_old_position.y, anim_cam_position.y, anim_cam_start_time, anim_cam_duration, Timing.EaseOut) + t_y,
      0
    );

    mat4x4_layer(ic_matrix, ic_cam_layer, 1, rotation);
    draw_textured_shape(ic_cam, ic_matrix, COLOR);

    let lens_scale = 1;
    if(qShot >= 0 && time_local > anim_camshot_start_time) {
      lens_scale = t_local(1, 0, anim_camshot_start_time, anim_camshot_duration, Timing.Sin);
      if(time_local > anim_camshot_start_time + anim_camshot_duration) {
        qShot--;
        anim_camshot_start_time = time_local + anim_camshot_duration;
      }
    }
    ic_cam_lens.params.scale = xyz(lens_scale, lens_scale, 1);
    ic_cam_lens.params.position = xyz(0, 1.7, 0);
    draw_textured_shape(ic_cam_lens, ic_matrix, COLOR);

    if(type === 0) {
      ic_pos = {x: 70 / 2, y: -116 / 2};
      if(current_page === 1 && direct === 0) {
        t_y = 0;
      } else {
        const s = commonDelay + duration_const * 0 * beginTimeK;
        t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
        t_y -= bounceValue(beginY, s) * bounce;
      }
    } else {
      ic_pos = {x: +60 / 2, y: 50 / 2};
      const s = commonDelay + duration_const * 0.25 * beginTimeK;
      t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
      t_y -= bounceValue(beginY, s, M_PI / 8) * bounce;
    }
    let smile_laught = 0;
    const anim_smile_fade_duration = duration_const * 2;
    const anim_smile_duration = duration_const * 2;
    if(anim_smile_stage === 0) {
      smile_laught = t_local(0, 1, anim_smile_start_time1, anim_smile_fade_duration, Timing.Linear);
      if(time_local > anim_smile_duration * 3 + anim_smile_start_time1) {
        anim_smile_stage = 1;
        anim_smile_start_time2 = time_local;
      }
    }

    if(anim_smile_stage === 1) {
      smile_laught = t_local(1, 0, anim_smile_start_time2, anim_smile_fade_duration, Timing.Linear);
      if(time_local > anim_smile_duration + anim_smile_start_time2) {
        smile_laught = 0;
        anim_smile_stage = 2;
        anim_smile_blink_one = 1;
        anim_smile_blink_start_time = time_local + duration_const;
      }
    }

    let y = 0;
    if(anim_smile_stage < 2) {
      y = Math.sin(time_local * M_PI * 10) * 1.5 * smile_laught;
    }

    ic_smile_layer.position = xyz(ic_pos.x + cloud_scroll_offset, y + ic_pos.y + t_y, 0);
    mat4x4_layer(ic_matrix, ic_smile_layer, 1, rotation);
    draw_textured_shape(ic_smile, ic_matrix, COLOR);

    if(time_local > anim_smile_blink_start_time + 0.1) {
      let blink_pause = frand(3, 6);
      if(irand(0, 3) === 0) {
        blink_pause = 0.3;
      }
      if(anim_smile_blink_one === 1) {
        blink_pause = frand(3, 6);
      }
      anim_smile_blink_start_time = time_local + blink_pause;
      anim_smile_blink_one = 0;
    }

    const stop_time = 5;
    const eye_scale = t_local(1, 0, anim_smile_blink_start_time, 0.1, Timing.Sin);
    ic_smile_eye.params.scale = xyz(1, eye_scale, 1);
    if(time > stop_time) ic_smile_eye.params.scale = xyz(1, 1, 1);

    ic_smile_eye.params.position = xyz(-7, -4.5, 0);
    draw_textured_shape(ic_smile_eye, ic_matrix, COLOR);

    if(anim_smile_blink_one === 1) ic_smile_eye.params.scale = xyz(1, 1, 1);
    if(time > stop_time) ic_smile_eye.params.scale = xyz(1, 1, 1);
    ic_smile_eye.params.position = xyz(7, -4.5, 0);
    draw_textured_shape(ic_smile_eye, ic_matrix, COLOR);

    if(type === 0) {
      ic_pos = {x: -60 / 2, y: 110 / 2};
      if(current_page === 1 && direct === 0) {
        t_y = 0;
      } else {
        const s = commonDelay + duration_const * 0.45 * beginTimeK;
        t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
        t_y -= bounceValue(beginY, s) * bounce;
      }
    } else {
      ic_pos = {x: 72 / 2, y: -74 / 2};
      const s = commonDelay + duration_const * 0 * beginTimeK;
      t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
      t_y -= bounceValue(beginY, s) * bounce;
    }
    ic_bubble_layer.position = xyz(ic_pos.x + cloud_scroll_offset, ic_pos.y + t_y, 0);
    mat4x4_layer(ic_matrix, ic_bubble_layer, 1, rotation);
    draw_textured_shape(ic_bubble, ic_matrix, COLOR);

    let sc = 0.7 + 0.2 * bubble_dots_sinf(time * 10);
    ic_bubble_dot.params.scale = xyz(sc, sc, sc);
    ic_bubble_dot.params.position = xyz(0 - 80.5, -9 / 2, 0);
    draw_textured_shape(ic_bubble_dot, ic_matrix, LIGHT_COLOR);

    sc = 0.7 + 0.2 * bubble_dots_sinf(-M_PI * 2 / 3 + time * 10);
    if(anim_bubble_dots_stage === 0) sc = MAXf(0.7, sc);
    ic_bubble_dot.params.scale = xyz(sc, sc, sc);
    ic_bubble_dot.params.position = xyz(0, -9 / 2, 0);
    draw_textured_shape(ic_bubble_dot, ic_matrix, LIGHT_COLOR);

    sc = 0.7 + 0.2 * bubble_dots_sinf(-M_PI * 2 / 3 * 2 + time * 10);
    if(anim_bubble_dots_stage === 0) sc = MAXf(0.7, sc);
    ic_bubble_dot.params.scale = xyz(sc, sc, sc);
    ic_bubble_dot.params.position = xyz(0 + 80.5, -9 / 2, 0);
    draw_textured_shape(ic_bubble_dot, ic_matrix, LIGHT_COLOR);

    if(type === 0) {
      ic_pos = {x: -88 / 2 - 15, y: -100 / 2 + 13};
      if(current_page === 1 && direct === 0) {
        t_y = 0;
      } else {
        const s = commonDelay + duration_const * 0.1 * beginTimeK;
        t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
        t_y -= bounceValue(beginY, s) * bounce;
      }
    } else {
      ic_pos = {x: +152 / 2 - 17, y: +66 / 2 + 14};
      const s = commonDelay + duration_const * 0.35 * beginTimeK;
      t_y = t(beginY, 0, s, duration_const, Timing.EaseOut);
      t_y -= bounceValue(beginY, s) * bounce;
    }

    let pencil_x = 0;
    if(anim_pencil_stage === 0) {
      ic_pencil_layer.rotation = t_local(0, -5, anim_pencil_start_all_time, duration_const * 0.5, Timing.EaseOut);

      pencil_x = t_local(0, 14, anim_pencil_start_time, 1.5 * 0.85, Timing.Linear);
      if(time_local > anim_pencil_start_time + 1.5 * 0.85) {
        anim_pencil_start_time = time_local;
        anim_pencil_stage = 1;
      }
    } else if(anim_pencil_stage === 1) {
      pencil_x = t_local(14, 0, anim_pencil_start_time, 1.5 * 0.15, Timing.Linear);
      if(time_local > anim_pencil_start_time + 1.5 * 0.15) {
        if(anim_pencil_period === 0) {
          anim_pencil_start_all_end_time = time_local;
          anim_pencil_start_time = time_local + duration_const * 1;
          anim_pencil_stage = 2;
        } else {
          anim_pencil_period--;
          anim_pencil_start_time = time_local;
          anim_pencil_stage = 0;
        }
      }
    } else if(anim_pencil_stage === 2) {
      ic_pencil_layer.rotation = t_local(-5, 0, anim_pencil_start_all_end_time, duration_const * 0.5, Timing.EaseOut);
      if(time_local > anim_pencil_start_time) {
        anim_pencil_start_all_time = time_local;
        anim_pencil_start_time = time_local;
        anim_pencil_stage = 3;
      }
    }

    const pencil_v = anim_pencil_stage < 2 ? Math.sin(time_local * 2 * M_PI * 4) * 0.8 : 0;
    ic_pencil_layer.position = xyz(pencil_x + ic_pos.x + cloud_scroll_offset, pencil_v + ic_pos.y + t_y, 0);
    mat4x4_layer(ic_matrix, ic_pencil_layer, 1, rotation);
    draw_textured_shape(ic_pencil, ic_matrix, COLOR);
  }

  function draw_safe(_type: number, alpha: number, screw_alpha: number) {
    const screw_distance = 53;
    private_screw.params.alpha = alpha * screw_alpha;
    scale = 1;
    const corners: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    corners.forEach(([sx, sy]) => {
      private_screw.params.scale = xyz(scale, scale, 1);
      private_screw.params.position = xyz(sx * screw_distance, sy * screw_distance, 0);
      draw_textured_shape(private_screw, private_matrix, Prog.NORMAL_ONE);
    });
  }

  /* ---- the public API (the JNI entry points) ---- */
  function setBackgroundColor(r: number, g: number, b: number, a: number) {
    background_color = [r, g, b, a];
    cloud_cover = create_rectangle({width: 240, height: 100}, background_color);
    cloud_cover.params.anchor.y = -50;

    const was_mask = powerful_mask;
    uploadTexture(tintedBitmap(images.powerful_mask, background_color), tex.powerful_mask);
    powerful_mask = create_textured_rectangle({width: 200, height: 200}, tex.powerful_mask);
    powerful_mask.params = was_mask.params;

    uploadTexture(telegramMaskBitmap(background_color), tex.telegram_mask);
    telegram_mask = create_textured_rectangle({width: 200, height: 150}, tex.telegram_mask);
  }

  function setPage(page: number) {
    if(current_page === page) {
      return;
    }
    prev_page = current_page;
    current_page = page;
    direct = current_page > prev_page ? 1 : 0;
    date0 = date;
    time = 0;
  }

  function onSurfaceChanged(a_width_px: number, a_height_px: number, a_scale_factor: number, a1: number) {
    gl.viewport(0, 0, a_width_px, a_height_px);
    width = Math.trunc(a_width_px / a_scale_factor);
    height = Math.trunc(a_height_px / a_scale_factor);
    scale_factor = a_scale_factor;
    mat4x4_plain(main_matrix, Math.trunc(a_width_px / a_scale_factor), Math.trunc(a_height_px / a_scale_factor));
    offset_y = a1 * main_matrix[1 * 4 + 1];
    y_offset = offset_y;
    y_offset_absolute = a1;
    mat4x4_stars(stars_matrix, Math.trunc(a_width_px / a_scale_factor), Math.trunc(a_height_px / a_scale_factor));
  }

  // onSurfaceCreated: the initial values of the globals
  date = 1;
  ribbonLength = 86.5;
  starsFar = 500;

  function onDrawFrame(deltaMs: number) {
    if(!surfaceCreated) {
      gl.clearColor(background_color[0], background_color[1], background_color[2], background_color[3]);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    time_local += deltaMs / 1000;

    if(current_page !== prev_page) {
      reset_ic();
      ms0_anim = date;
      fps_anim = 0;
      count_anim_fps = 1;
    }

    const knotDelayStep = 0.075;
    if(prev_page !== current_page) {
      for(let i = 0; i < 4; i++) {
        knot_delays[i] = (0.65 + knotDelayStep * i) * duration_const;
      }

      for(let i = 0; i < 10; i++) {
        const j1 = irand(0, 3);
        const j2 = irand(0, 3);
        const temp = knot_delays[j1];
        knot_delays[j1] = knot_delays[j2];
        knot_delays[j2] = temp;
      }

      if(current_page === 2) {
        ic_pin_layer.rotation = -15;
        ic_cam_layer.rotation = 15;
        ic_smile_layer.rotation = -15;
        ic_bubble_layer.rotation = -15;
      }

      if(current_page === 5) {
        ic_pin_layer.rotation = -15;
        ic_videocam_layer.rotation = -30;
        ic_cam_layer.rotation = 15;
        ic_smile_layer.rotation = -15;
        ic_bubble_layer.rotation = -15;
      }
    }

    // Normalize if FPS is greater than 60
    fps_anim = Math.trunc(time_local / 0.016);
    if(count_anim_fps === 1 && date - ms0_anim >= duration_const) {
      count_anim_fps = 0;
    }

    if(date - ms0 >= 1) {
      ms0 = date;
    }

    time = date - date0;

    const private_back_k = 0.8;

    gl.clearColor(background_color[0], background_color[1], background_color[2], background_color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if(current_page === 0) {
      rglNormalDraw();

      telegram_sphere.params.alpha = 1;

      scale = 1;

      let alpha = 1;
      if(direct === 0) {
        alpha = t(0, 1, 0, duration_const, Timing.Linear);

        fast_body.params.alpha = 1;
        fast_body.params.scale = xyz(scale, scale, 1);
        draw_textured_shape(fast_body, main_matrix, Prog.NORMAL);
      }

      telegram_sphere.params.alpha = alpha;
      telegram_sphere.params.scale = xyz(scale, scale, 1);

      // the plane texture of the official app is an empty bitmap, so only its blend state matters
      const tt = MINf(0, -M_PI * 125 / 180 + time * M_PI * 2 * 1.5);
      if(tt < D2R(125)) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
    } else if(current_page === 1) {
      rglNormalDraw();
      if(direct === 1) {
        fast_body.params.scale = xyz(1, 1, 1);
        fast_body.params.alpha = 1;
        draw_textured_shape(fast_body, main_matrix, Prog.NORMAL);
      } else {
        fast_body.params.alpha = t(0, 1, 0, duration_const, Timing.Linear);
        const sc = t(0.95, 1, 0, duration_const, Timing.EaseInEaseOut);
        fast_body.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(fast_body, main_matrix, Prog.NORMAL);
      }
    } else if(current_page === 2) {
      rglNormalDraw();
      if(direct === 1) {
        fast_body.params.alpha = t(1, 0, 0, duration_const, Timing.Linear);
        const sc = t(1, 0.95, 0, duration_const, Timing.EaseInEaseOut);
        fast_body.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(fast_body, main_matrix, Prog.NORMAL);
      }
    } else if(current_page === 4) {
      if(direct === 1) {
        privateLayer.rotation = private_scroll_offset + t(-90, 0, 0, duration_const, Timing.EaseOut);
      } else {
        privateLayer.rotation = private_scroll_offset + t(90, 0, 0, duration_const * private_back_k, Timing.EaseOut);
      }
      mat4x4_layer(private_matrix, privateLayer, 1, 0);
    }

    rglMaskDraw();
    mask1.params.position.z = cloud_extra_mask1.params.position.z = cloud_extra_mask2.params.position.z = cloud_extra_mask3.params.position.z = cloud_extra_mask4.params.position.z = 1;

    if(current_page === 0) {
      if(direct === 0) {
        change_rounded_rectangle(mask1, {width: r1 * 2, height: r1 * 2}, r1);
        mask1.params.rotation = 0;
      }
    } else if(current_page === 1) {
      if(direct === 1) {
        change_rounded_rectangle(mask1, {width: r1 * 2, height: r1 * 2}, r1);
        mask1.params.rotation = 0;
      } else {
        const size = t(r2 * 2, r1 * 2, 0, duration_const, Timing.EaseInEaseOut);
        const round = t(30, r1, 0, duration_const, Timing.EaseInEaseOut);
        change_rounded_rectangle(mask1, {width: size, height: size}, round);
        free_scroll_offset = 0;
        mask1.params.rotation = t(180, 0, 0, duration_const, Timing.EaseInEaseOut) + free_scroll_offset;
      }
    } else if(current_page === 2) {
      if(direct === 1) {
        const size = t(r1 * 2, r2 * 2, 0, duration_const, Timing.EaseInEaseOut);
        const round = t(r1, 30, 0, duration_const, Timing.EaseInEaseOut);
        change_rounded_rectangle(mask1, {width: size, height: size}, round);
        free_scroll_offset = scroll_offset * 5;
        mask1.params.rotation = t(0, 180, 0, duration_const, Timing.EaseInEaseOut) + free_scroll_offset;
      } else {
        free_scroll_offset = scroll_offset * 5;
        const r = 316 / 4;
        const size = t_reversed(r2 * 2, r * 2, 0, duration_const, Timing.EaseInEaseOut);
        const round = t_reversed(30, 20, 0, duration_const, Timing.EaseInEaseOut);
        change_rounded_rectangle(mask1, {width: size, height: size}, round);
        mask1.params.rotation = t_reversed(180 + free_scroll_offset, 180 + 90, 0, duration_const, Timing.EaseInEaseOut);
      }
    } else if(current_page === 3) {
      if(direct === 1) {
        const r = 316 / 4;
        const size = t(r2 * 2, r * 2, 0, duration_const, Timing.EaseInEaseOut);
        const round = t(30, 20, 0, duration_const, Timing.EaseInEaseOut);
        change_rounded_rectangle(mask1, {width: size, height: size}, round);
        mask1.params.rotation = t(180 + free_scroll_offset, 180 + 90, 0, duration_const, Timing.EaseInEaseOut);
      } else {
        const r = 316 / 4;
        const size = t_reversed(r * 2, r2 * 2, 0, duration_const, Timing.EaseOut);
        const round = t_reversed(20, 30, 0, duration_const, Timing.EaseOut);
        change_rounded_rectangle(mask1, {width: size, height: size}, round);
        mask1.params.rotation = t_reversed(180 + 90, 180 + 90 + 90, 0, duration_const, Timing.EaseOut);
        mask1.params.position = xyz(0, 0, mask1.params.position.z);
      }
    } else if(current_page === 4) {
      if(direct === 1) {
        const r = 316 / 4;
        const size = t(r * 2, r2 * 2, 0, duration_const, Timing.EaseOut);
        const round = t(20, 30, 0, duration_const, Timing.EaseOut);
        change_rounded_rectangle(mask1, {width: size, height: size}, round);
        mask1.params.rotation = private_scroll_offset + t(180 + 90, 180 + 90 + 90, 0, duration_const, Timing.EaseOut);
        mask1.params.position = xyz(0, 0, mask1.params.position.z);
      } else {
        let k = private_back_k;
        const sc = t_reversed(r2 * 2, 100, 0, duration_const * k, Timing.EaseOut);
        change_rounded_rectangle(mask1, {width: sc, height: sc}, t_reversed(30, 50, 0, duration_const * k, Timing.EaseOut));
        mask1.params.position = xyz(t_reversed(0, 29 / 2, 0, duration_const * k, Timing.EaseOut), t_reversed(0, -19 / 2, 0, duration_const * k, Timing.EaseOut), mask1.params.position.z);
        mask1.params.rotation = private_scroll_offset + t_reversed(180 + 90 + 90, 180 + 90 + 90 + 90, 0, duration_const * k, Timing.EaseOut);

        k = private_back_k;
        const sublayer2_radius = 33;
        cloud_extra_mask1.params.position = xyz(t_reversed(0, -122 / 2, 0, duration_const * k, Timing.EaseOut), t_reversed(0, 54 / 2 - 1, 0, duration_const * k, Timing.EaseOut), cloud_extra_mask1.params.position.z);
        let s = t_reversed(0, sublayer2_radius, 0, duration_const * k, Timing.EaseOut);
        cloud_extra_mask1.params.scale = xyz(s, s, 1);
        draw_shape(cloud_extra_mask1, main_matrix);

        k = 1.15 * private_back_k;
        const sublayer3_radius = 94 / 4;
        cloud_extra_mask2.params.position = xyz(t_reversed(0, -84 / 2, 0, duration_const * k, Timing.EaseOut), t_reversed(0, -29 / 2, 0, duration_const * k, Timing.EaseOut), cloud_extra_mask2.params.position.z);
        s = t_reversed(0, sublayer3_radius, 0, duration_const * k, Timing.EaseOut);
        cloud_extra_mask2.params.scale = xyz(s, s, 1);
        draw_shape(cloud_extra_mask2, main_matrix);

        k = 1.3 * private_back_k;
        const sublayer4_radius = 124 / 4;
        cloud_extra_mask3.params.position = xyz(t_reversed(0, 128 / 2, 0, duration_const * k, Timing.EaseOut), t_reversed(0, 56 / 2, 0, duration_const * k, Timing.EaseOut), cloud_extra_mask3.params.position.z);
        s = t_reversed(0, sublayer4_radius, 0, duration_const * k, Timing.EaseOut);
        cloud_extra_mask3.params.scale = xyz(s, s, 1);
        draw_shape(cloud_extra_mask3, main_matrix);

        k = 1.5 * private_back_k;
        const sublayer5_radius = 64;
        cloud_extra_mask4.params.position = xyz(t_reversed(0, 0, 0, duration_const * k, Timing.EaseOut), t_reversed(0, 50, 0, duration_const * k, Timing.EaseOut), cloud_extra_mask4.params.position.z);
        s = t_reversed(0, sublayer5_radius, 0, duration_const * k, Timing.EaseOut);
        cloud_extra_mask4.params.scale = xyz(s, s, 1);
        draw_shape(cloud_extra_mask4, main_matrix);
      }
    } else if(current_page === 5) {
      let k = 0.8;
      const sc = t(r2 * 2, 100, 0, duration_const * k, Timing.EaseOut);
      change_rounded_rectangle(mask1, {width: sc, height: sc}, t(30, 50, 0, duration_const * k, Timing.EaseOut));
      mask1.params.position = xyz(t(0, 29 / 2, 0, duration_const * k, Timing.EaseOut), t(0, -19 / 2, 0, duration_const * k, Timing.EaseOut), mask1.params.position.z);
      mask1.params.rotation = t(180 + 90 + 90, 180 + 90 + 90 + 90, 0, duration_const * k, Timing.EaseOut);

      k = 1;
      const sublayer2_radius = 33;
      cloud_extra_mask1.params.position = xyz(t(0, -122 / 2, 0, duration_const * k, Timing.EaseOut), t(0, 54 / 2 - 1, 0, duration_const * k, Timing.EaseOut), cloud_extra_mask1.params.position.z);
      let s = t(0, sublayer2_radius, 0, duration_const * k, Timing.EaseOut);
      cloud_extra_mask1.params.scale = xyz(s, s, 1);
      draw_shape(cloud_extra_mask1, main_matrix);

      k = 1.15;
      const sublayer3_radius = 94 / 4;
      cloud_extra_mask2.params.position = xyz(t(0, -84 / 2, 0, duration_const * k, Timing.EaseOut), t(0, -29 / 2, 0, duration_const * k, Timing.EaseOut), cloud_extra_mask2.params.position.z);
      s = t(0, sublayer3_radius, 0, duration_const * k, Timing.EaseOut);
      cloud_extra_mask2.params.scale = xyz(s, s, 1);
      draw_shape(cloud_extra_mask2, main_matrix);

      k = 1.3;
      const sublayer4_radius = 124 / 4;
      cloud_extra_mask3.params.position = xyz(t(0, 128 / 2, 0, duration_const * k, Timing.EaseOut), t(0, 56 / 2, 0, duration_const * k, Timing.EaseOut), cloud_extra_mask3.params.position.z);
      s = t(0, sublayer4_radius, 0, duration_const * k, Timing.EaseOut);
      cloud_extra_mask3.params.scale = xyz(s, s, 1);
      draw_shape(cloud_extra_mask3, main_matrix);

      k = 1.5;
      const sublayer5_radius = 64;
      cloud_extra_mask4.params.position = xyz(t(0, 0, 0, duration_const * k, Timing.EaseOut), t(0, 50, 0, duration_const * k, Timing.EaseOut), cloud_extra_mask4.params.position.z);
      s = t(0, sublayer5_radius, 0, duration_const * k, Timing.EaseOut);
      cloud_extra_mask4.params.scale = xyz(s, s, 1);
      draw_shape(cloud_extra_mask4, main_matrix);
    }
    draw_shape(mask1, main_matrix);

    const rr = 30;
    const seg = 15;
    const ang = 180;
    rglNormalDrawThroughMask();
    if(current_page === 0) {
      if(direct === 0) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        change_segmented_square(spiral, r1, D2R(rr + seg), D2R(speedometer_scroll_offset + calculated_speedometer_sin + t(-seg + ang, 0, 0, duration_const, Timing.EaseOut)));

        spiral.params.scale = xyz(1, 1, 1);
        spiral.params.rotation = t(180, 0, 0, duration_const, Timing.EaseOut);
        spiral.params.alpha = t(1, 0, 0, duration_const, Timing.Linear);
        draw_textured_shape(spiral, main_matrix, Prog.NORMAL_ONE);

        fast_arrow.params.alpha = fast_arrow_shadow.params.alpha = t(1, 0, 0, duration_const, Timing.Linear);
        fast_arrow.params.rotation = fast_arrow_shadow.params.rotation = t(rr, rr - 180 - 160, 0, duration_const, Timing.EaseOut) + speedometer_scroll_offset + calculated_speedometer_sin;
        draw_textured_shape(fast_arrow_shadow, main_matrix, Prog.NORMAL_ONE);
        draw_textured_shape(fast_arrow, main_matrix, Prog.NORMAL_ONE);
      }
    } else if(current_page === 1) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      speedometer_scroll_offset = scroll_offset * 25;
      calculated_speedometer_sin = 0;

      if(direct === 1) {
        const e = 2.71;
        const arg = time * 50;
        const value = 180 - 180 * Math.pow(e, -0.055 * arg * 2) * Math.cos(0.08 * arg * 3);
        const ta = t(0, 180, 0, duration_const, Timing.EaseOut);

        change_segmented_square(spiral, r1, D2R(rr + seg), D2R(-seg + value + speedometer_scroll_offset));

        spiral.params.scale = xyz(1, 1, 1);
        spiral.params.rotation = ta;
        spiral.params.alpha = t(0, 1, 0, duration_const, Timing.Linear);
        draw_textured_shape(spiral, main_matrix, Prog.NORMAL_ONE);

        fast_arrow.params.alpha = fast_arrow_shadow.params.alpha = t(0, 1, 0, duration_const, Timing.Linear);
        fast_arrow.params.rotation = fast_arrow_shadow.params.rotation = -330 + value + ta + speedometer_scroll_offset;
        draw_textured_shape(fast_arrow_shadow, main_matrix, Prog.NORMAL_ONE);
        draw_textured_shape(fast_arrow, main_matrix, Prog.NORMAL_ONE);
      } else {
        spiral.params.alpha = fast_arrow.params.alpha = fast_arrow_shadow.params.alpha = 1;

        const e = 2.71;
        const arg = time * 50;
        const dangle = 90;
        let value = 180 - 90 - (180 - 90) * Math.pow(e, -0.055 * arg * 2) * Math.cos(0.08 * arg * 3);
        value *= -1;

        change_segmented_square(spiral, r1, D2R(rr + seg), D2R(speedometer_scroll_offset + value + calculated_speedometer_sin + t(360, 360 - dangle - seg, 0, duration_const, Timing.EaseInEaseOut)));

        const sc = t(1.18, 1, 0, duration_const, Timing.EaseInEaseOut);
        spiral.params.scale = xyz(sc, sc, 1);
        spiral.params.rotation = t(360, 180, 0, duration_const, Timing.EaseInEaseOut);
        draw_textured_shape(spiral, main_matrix, Prog.NORMAL);

        fast_arrow.params.rotation = fast_arrow_shadow.params.rotation = speedometer_scroll_offset + value + calculated_speedometer_sin + t(rr + 360 + 6, rr + 360 - 180 - dangle, 0, duration_const, Timing.EaseInEaseOut);
        draw_textured_shape(fast_arrow_shadow, main_matrix, Prog.NORMAL);
        draw_textured_shape(fast_arrow, main_matrix, Prog.NORMAL);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        free_bg.params.alpha = t(1, 0, 0, duration_const, Timing.Linear);
        draw_shape(free_bg, main_matrix);

        draw_ic(0);
      }
    } else if(current_page === 2) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      if(direct === 1) {
        spiral.params.alpha = fast_arrow.params.alpha = fast_arrow_shadow.params.alpha = 1;

        change_segmented_square(spiral, r1, D2R(rr + seg + speedometer_scroll_offset), D2R(t(-seg + ang, 360, 0, duration_const, Timing.EaseInEaseOut)));

        const sc = t(1, 1.18, 0, duration_const, Timing.EaseInEaseOut);
        spiral.params.scale = xyz(sc, sc, 1);
        spiral.params.rotation = t(180, 360, 0, duration_const, Timing.EaseInEaseOut);
        draw_textured_shape(spiral, main_matrix, Prog.NORMAL);

        fast_arrow.params.rotation = fast_arrow_shadow.params.rotation = speedometer_scroll_offset + t(rr, rr + 360 + 6, 0, duration_const, Timing.EaseInEaseOut);
        draw_textured_shape(fast_arrow_shadow, main_matrix, Prog.NORMAL);
        draw_textured_shape(fast_arrow, main_matrix, Prog.NORMAL);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        free_bg.params.alpha = t(0, 1, 0, duration_const, Timing.Linear);
        draw_shape(free_bg, main_matrix);

        draw_ic(0);
      } else {
        gl.disable(gl.BLEND);
        free_bg.params.alpha = 1;
        draw_shape(free_bg, main_matrix);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        draw_ic(0);

        powerful_bg.params.alpha = t_reversed(0, 1, 0, duration_const, Timing.Linear);
        draw_shape(powerful_bg, main_matrix);
      }
      ribbon1.params.rotation = 0;
      ribbon2.params.rotation = 90;
      ribbon3.params.rotation = 180;
      ribbon4.params.rotation = 270;
    } else if(current_page === 3) {
      if(direct === 1) {
        gl.disable(gl.BLEND);
        free_bg.params.alpha = 1;
        draw_shape(free_bg, main_matrix);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        powerful_bg.params.alpha = t(0, 1, 0, duration_const, Timing.Linear);
        draw_shape(powerful_bg, main_matrix);

        draw_stars();
      } else {
        gl.disable(gl.BLEND);
        private_bg.params.alpha = 1;
        draw_shape(private_bg, main_matrix);

        const a = t(0, 1, 0, duration_const, Timing.EaseOut);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        powerful_bg.params.rotation = 0;
        powerful_bg.params.alpha = a;
        draw_shape(powerful_bg, main_matrix);

        draw_stars();
      }
    } else if(current_page === 4) {
      if(direct === 1) {
        gl.disable(gl.BLEND);
        powerful_bg.params.alpha = 1;
        draw_shape(powerful_bg, main_matrix);

        const a = t(0, 1, 0, duration_const, Timing.EaseOut);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        private_bg.params.rotation = t(45, 0, 0, duration_const, Timing.EaseOut);
        private_bg.params.alpha = a;
        draw_shape(private_bg, main_matrix);
      } else {
        gl.disable(gl.BLEND);
        cloud_bg.params.alpha = 1;
        draw_shape(cloud_bg, main_matrix);

        const a = t(0, 1, 0, duration_const * private_back_k, Timing.EaseOut);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        private_bg.params.alpha = a;
        draw_shape(private_bg, main_matrix);
      }
    } else if(current_page === 5) {
      gl.disable(gl.BLEND);
      private_bg.params.alpha = 1;
      draw_shape(private_bg, main_matrix);
      const a = t(0, 1, 0, duration_const, Timing.EaseOut);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      cloud_bg.params.alpha = a;
      draw_shape(cloud_bg, main_matrix);
      if(scroll_offset > 0) {
        cloud_scroll_offset = -scroll_offset * 40;
      } else {
        cloud_scroll_offset = -scroll_offset * 15;
      }
      draw_ic(1);
    }

    if(current_page === 0) {
      rglNormalDraw();
      if(direct === 0) {
        telegram_sphere.params.alpha = t(0, 1, 0, duration_const * 0.8, Timing.Linear);
        scale = 1;

        telegram_sphere.params.scale = xyz(scale, scale, 1);
        draw_textured_shape(telegram_sphere, main_matrix, Prog.NORMAL);

        const tt = MINf(0, -M_PI * 125 / 180 + time * M_PI * 2 * 1.5);
        if(tt < D2R(125)) {
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          draw_textured_shape(telegram_mask, main_matrix, Prog.NORMAL);
        }
      }
    } else if(current_page === 1) {
      rglNormalDraw();
      if(direct === 1) {
        telegram_sphere.params.alpha = t(1, 0, 0, duration_const, Timing.Linear);
        draw_textured_shape(telegram_sphere, main_matrix, Prog.NORMAL);

        const tt = time * M_PI * 2 * 1.5;
        if(tt < D2R(125)) {
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          draw_textured_shape(telegram_mask, main_matrix, Prog.NORMAL);
        }
      }
    } else if(current_page === 2) {
      rglNormalDraw();

      const dribbon = 87;

      if(direct === 1) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        ribbonLayer.rotation = scroll_offset * 5 + t(180, 360, 0, duration_const, Timing.EaseInEaseOut);
        mat4x4_layer(ribbons_layer, ribbonLayer, 1, 0);

        let sc: number;
        const dur = duration_const * 0.5;

        free_knot1.params.position = xyz(5, -5 - 9, 0);
        sc = t(0, 1, knot_delays[0], dur, Timing.EaseOut);
        free_knot1.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(free_knot1, ribbons_layer, Prog.NORMAL_ONE);

        free_knot2.params.position = xyz(-5, -5 - 9, 0);
        sc = t(0, 1, knot_delays[1], dur, Timing.EaseOut);
        free_knot2.params.scale = xyz(-sc, sc, 1);
        draw_textured_shape(free_knot2, ribbons_layer, Prog.NORMAL_ONE);

        free_knot3.params.position = xyz(-5, 5 - 9, 0);
        sc = t(0, 1, knot_delays[2], dur, Timing.EaseOut);
        free_knot3.params.scale = xyz(-sc, sc, 1);
        draw_textured_shape(free_knot3, ribbons_layer, Prog.NORMAL_ONE);

        free_knot3.params.position = xyz(5, 5 - 9, 0);
        sc = t(0, 1, knot_delays[3], dur, Timing.EaseOut);
        free_knot3.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(free_knot3, ribbons_layer, Prog.NORMAL_ONE);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        ribbon1.params.alpha = ribbon2.params.alpha = ribbon3.params.alpha = ribbon4.params.alpha = t(0, 1, 0, dur, Timing.EaseInEaseOut);

        const ribbon_k = time > duration_const ? 1 : 0;

        change_ribbon(ribbon1, ribbonLength - 8 * ribbon_k - free_scroll_offset / 5 * (30 - 8 * ribbon_k));
        ribbon1.params.position.x = scroll_offset * 30 * 0 + t(-dribbon, 0, 0, duration_const, Timing.EaseInEaseOut);
        draw_shape(ribbon1, ribbons_layer);

        change_ribbon(ribbon2, ribbonLength - 10 * ribbon_k - free_scroll_offset / 5 * (22 - 10 * ribbon_k));
        ribbon2.params.position.y = scroll_offset * 15 + t(-9 - dribbon, -9, 0, duration_const, Timing.EaseInEaseOut);
        draw_shape(ribbon2, ribbons_layer);

        ribbon3.params.position.x = t(dribbon, 0, 0, duration_const, Timing.EaseInEaseOut);
        draw_shape(ribbon3, ribbons_layer);

        ribbon4.params.position.y = t(-9 + dribbon, -9, 0, duration_const, Timing.EaseInEaseOut);
        draw_shape(ribbon4, ribbons_layer);

        ribbonLayer.anchor.y = 0;
        ribbonLayer.position.y = 0;

        change_ribbon(ribbon1, ribbonLength);
        change_ribbon(ribbon2, ribbonLength);
        change_ribbon(ribbon3, ribbonLength);
        change_ribbon(ribbon4, ribbonLength);
      } else {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        let sc = t(1, 2, 0, duration_const, Timing.EaseIn);
        powerful_mask.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(powerful_mask, main_matrix, Prog.NORMAL_ONE);

        ribbonLayer.rotation = free_scroll_offset + t_reversed(360, 360 + (45 + 30), 0, duration_const, Timing.EaseOut);
        ribbonLayer.position.y = t_reversed(0, -8, 0, duration_const * 0.8, Timing.EaseOut);
        ribbonLayer.anchor.y = t_reversed(0, -9, 0, duration_const * 0.8, Timing.EaseOut);
        mat4x4_layer(ribbons_layer, ribbonLayer, 1, 0);

        const dur = duration_const * 0.5;

        free_knot1.params.position = xyz(11 / 2, -11 / 2 - 9, 0);
        sc = t(0, 1, knot_delays[0], dur, Timing.EaseOut);
        free_knot1.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(free_knot1, ribbons_layer, Prog.NORMAL_ONE);

        free_knot2.params.position = xyz(-11 / 2, -11 / 2 - 9, 0);
        sc = t(0, 1, knot_delays[1], dur, Timing.EaseOut);
        free_knot2.params.scale = xyz(-sc, sc, 1);
        draw_textured_shape(free_knot2, ribbons_layer, Prog.NORMAL_ONE);

        free_knot3.params.position = xyz(-11 / 2, 11 / 2 - 9, 0);
        sc = t(0, 1, knot_delays[2], dur, Timing.EaseOut);
        free_knot3.params.scale = xyz(-sc, sc, 1);
        draw_textured_shape(free_knot3, ribbons_layer, Prog.NORMAL_ONE);

        free_knot3.params.position = xyz(11 / 2, 11 / 2 - 9, 0);
        sc = t(0, 1, knot_delays[3], dur, Timing.EaseOut);
        free_knot3.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(free_knot3, ribbons_layer, Prog.NORMAL_ONE);

        const a1 = -25;
        ribbon1.params.rotation = t_reversed(0, a1, 0, duration_const, Timing.EaseOut);
        ribbon3.params.rotation = t_reversed(180, 180 + a1, 0, duration_const, Timing.EaseOut);

        const a2 = 0;
        ribbon2.params.rotation = t_reversed(90, 90 + a2, 0, duration_const, Timing.EaseOut);
        ribbon4.params.rotation = t_reversed(270, 270 + a2, 0, duration_const, Timing.EaseOut);

        const k = 0.9;
        ribbon2.params.alpha = ribbon4.params.alpha = t_reversed(1, 0, duration_const * 0.5, duration_const * 0.1, Timing.Linear);

        const ribbon_k = 0;
        change_ribbon(ribbon1, t_reversed(ribbonLength - 8 * ribbon_k, 0, 0, duration_const * 0.9, Timing.Linear) - free_scroll_offset / 5 * (30 - 8 * ribbon_k));
        ribbon1.params.position.x = 0;
        draw_shape(ribbon1, ribbons_layer);

        change_ribbon(ribbon2, t_reversed(ribbonLength - 10 * ribbon_k, 0, 0, duration_const * k, Timing.Linear) - free_scroll_offset / 5 * (22 - 10 * ribbon_k));
        ribbon2.params.position.y = scroll_offset * 15 + -9;
        draw_shape(ribbon2, ribbons_layer);

        change_ribbon(ribbon3, t_reversed(ribbonLength, 0, 0, duration_const * 0.9, Timing.Linear));
        draw_shape(ribbon3, ribbons_layer);

        change_ribbon(ribbon4, t_reversed(ribbonLength, 0, duration_const * 0.6 * 0, duration_const * k, Timing.Linear));
        draw_shape(ribbon4, ribbons_layer);

        const infinityDurK = 1.3;

        rglMaskDraw();

        change_infinity(infinity, t_reversed(0, 0.99, 0, duration_const * infinityDurK, Timing.EaseOut));

        const rot1 = t(0, -50, duration_const * 0.5, duration_const * 0.8, Timing.EaseOut);
        const rot2 = t(0, -30, duration_const * 0.8, duration_const, Timing.EaseOut);
        infinity.params.rotation = rot1;

        infinity.params.position.z = 1;
        infinity.params.position.y = -6;
        infinity.params.anchor = xyz(52.75, 23.5, 0);

        const infinity_scale = 1.025;
        infinity.params.scale = xyz(infinity_scale, infinity_scale, 1);
        draw_shape(infinity, main_matrix);
        infinity.params.scale = xyz(-infinity_scale, -infinity_scale, 1);
        draw_shape(infinity, main_matrix);
        rglNormalDrawThroughMask();
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        powerful_infinity_white.params.rotation = rot1 + rot2;
        powerful_infinity_white.params.alpha = 1;
        powerful_infinity_white.params.position.y = -6;
        draw_textured_shape(powerful_infinity_white, main_matrix, Prog.NORMAL_ONE);
      }
    } else if(current_page === 3) {
      if(direct === 1) {
        ribbon1.params.position.x = 0;
        ribbon2.params.position.y = -9;
        ribbon3.params.position.x = 0;
        ribbon4.params.position.y = -9;
        rglNormalDraw();
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const sc = t(2, 1, 0, duration_const, Timing.EaseOut);
        powerful_mask.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(powerful_mask, main_matrix, Prog.NORMAL_ONE);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        ribbonLayer.rotation = free_scroll_offset + t(360, 360 + (45 + 30), 0, duration_const * 0.8, Timing.EaseOut);
        ribbonLayer.position.y = t(0, -8, 0, duration_const * 0.8, Timing.EaseOut);
        ribbonLayer.anchor.y = t(0, -9, 0, duration_const * 0.8, Timing.EaseOut);
        mat4x4_layer(ribbons_layer, ribbonLayer, 1, 0);

        const a1 = -25;
        ribbon1.params.rotation = t(0, a1, 0, duration_const, Timing.EaseOut);
        ribbon3.params.rotation = t(180, 180 + a1, 0, duration_const, Timing.EaseOut);

        const a2 = 0;
        ribbon2.params.rotation = t(90, 90 + a2, 0, duration_const, Timing.EaseOut);
        ribbon4.params.rotation = t(270, 270 + a2, 0, duration_const, Timing.EaseOut);

        const k = 0.5;
        ribbon2.params.alpha = ribbon4.params.alpha = t(1, 0, duration_const * k * 0.5, duration_const * k * 0.1, Timing.Linear);

        const ribbon_k = time > duration_const ? 1 : 0;

        change_ribbon(ribbon1, t(ribbonLength - 8 * ribbon_k - free_scroll_offset / 5 * (30 - 8 * ribbon_k), 0, 0, duration_const * 0.9, Timing.Linear));
        draw_shape(ribbon1, ribbons_layer);

        change_ribbon(ribbon2, t(ribbonLength - 10 * ribbon_k - free_scroll_offset / 5 * (22 - 10 * ribbon_k), 0, 0, duration_const * k, Timing.Linear));
        draw_shape(ribbon2, ribbons_layer);

        change_ribbon(ribbon3, t(ribbonLength, 0, 0, duration_const * 0.9, Timing.Linear));
        draw_shape(ribbon3, ribbons_layer);

        change_ribbon(ribbon4, t(ribbonLength, 0, 0, duration_const * k, Timing.Linear));
        draw_shape(ribbon4, ribbons_layer);

        const infinityDurK = 1.1;
        if(time < duration_const * infinityDurK - 0.025) {
          rglMaskDraw();

          change_infinity(infinity, t(0, 0.99, 0, duration_const * infinityDurK, Timing.Linear));

          infinity.params.rotation = 0;

          infinity.params.position.z = 1;
          infinity.params.position.y = -6;
          infinity.params.anchor = xyz(52.75, 23.5, 0);

          const infinity_scale = 1.025;
          infinity.params.scale = xyz(infinity_scale, infinity_scale, 1);
          draw_shape(infinity, main_matrix);

          infinity.params.scale = xyz(-infinity_scale, -infinity_scale, 1);
          draw_shape(infinity, main_matrix);

          rglNormalDrawThroughMask();
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

          powerful_infinity_white.params.rotation = 0;
          powerful_infinity_white.params.alpha = 1;
          powerful_infinity_white.params.position.y = -6;

          draw_textured_shape(powerful_infinity_white, main_matrix, Prog.NORMAL_ONE);
        } else {
          rglNormalDraw();

          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          powerful_infinity.params.position.y = -6;
          powerful_infinity.params.alpha = 1;
          draw_textured_shape(powerful_infinity, main_matrix, Prog.NORMAL_ONE);
        }
      } else {
        rglNormalDraw();
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        let sc = t(2, 1, 0, duration_const, Timing.EaseOut);
        powerful_mask.params.scale = xyz(sc, sc, 1);
        draw_textured_shape(powerful_mask, main_matrix, Prog.NORMAL_ONE);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        sc = t(1, 2, 0, duration_const, Timing.EaseOut);
        private_stroke.params.scale = xyz(sc, sc, 1);
        private_stroke.params.rotation = t(0, -90, 0, duration_const, Timing.EaseOut);
        private_stroke.params.alpha = t(1, 0, 0, duration_const, Timing.Linear);
        private_stroke.params.position = xyz(0, t(0, -6, 0, duration_const, Timing.EaseOut), 0);
        sc = t_reversed(63 * 2, 63 * 2, 0, duration_const, Timing.EaseOut);
        change_rounded_rectangle_stroked(private_stroke, {width: sc, height: sc}, sc / 2);
        draw_shape(private_stroke, main_matrix);

        const infinityDurK = 1.1;
        if(time < duration_const * infinityDurK - 0.025) {
          rglMaskDraw();

          change_infinity(infinity, t(0, 0.99, 0, duration_const * infinityDurK, Timing.Linear));

          infinity.params.rotation = 0;

          infinity.params.position.z = 1;
          infinity.params.position.y = -6;
          infinity.params.anchor = xyz(52.75, 23.5, 0);

          const infinity_scale = 1.025;
          infinity.params.scale = xyz(infinity_scale, infinity_scale, 1);
          draw_shape(infinity, main_matrix);

          infinity.params.scale = xyz(-infinity_scale, -infinity_scale, 1);
          draw_shape(infinity, main_matrix);

          rglNormalDrawThroughMask();
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

          powerful_infinity_white.params.rotation = 0;
          powerful_infinity_white.params.alpha = 1;
          powerful_infinity_white.params.position.y = -6;

          draw_textured_shape(powerful_infinity_white, main_matrix, Prog.NORMAL_ONE);
        } else {
          rglNormalDraw();

          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          powerful_infinity.params.position.y = -6;
          powerful_infinity.params.alpha = 1;
          draw_textured_shape(powerful_infinity, main_matrix, Prog.NORMAL_ONE);
        }
      }
    } else if(current_page === 4) {
      private_stroke.params.scale = xyz(1, 1, 1);

      private_scroll_offset = scroll_offset * 5;

      rglNormalDraw();
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      scale = t(1, 2, 0, duration_const, Timing.EaseOut);
      if(scale < 1.5) {
        powerful_mask.params.scale = xyz(scale, scale, 1);
      }

      if(direct === 1) {
        privateLayer.rotation = private_scroll_offset + t(-90, 0, 0, duration_const, Timing.EaseOut);
      } else {
        privateLayer.rotation = private_scroll_offset + t(90, 0, 0, duration_const * private_back_k, Timing.EaseOut);
      }

      mat4x4_layer(private_matrix, privateLayer, 1, 0);

      if(direct === 1) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        powerful_infinity.params.position.y = -6;
        powerful_infinity.params.alpha = t(1, 0, 0, duration_const * 0.25, Timing.EaseIn);
        draw_textured_shape(powerful_infinity, main_matrix, Prog.NORMAL_ONE);
      }

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      if(direct === 1) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        scale = t(0.5, 1, 0, duration_const, Timing.EaseOut);
        private_door.params.scale = xyz(scale, scale, 1);
        private_door.params.alpha = t(0, 1, 0, duration_const, Timing.EaseOut);
        draw_textured_shape(private_door, main_matrix, Prog.NORMAL_ONE);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        private_stroke.params.rotation = private_scroll_offset;
        private_stroke.params.alpha = 1;
        private_stroke.params.position = xyz(0, 0, 0);
        scale = t(63, 63 * 2, 0, duration_const, Timing.EaseOut);
        change_rounded_rectangle_stroked(private_stroke, {width: scale, height: scale}, scale / 2);
        draw_shape(private_stroke, main_matrix);

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const k = 0;
        scale = t(0.5, 1, duration_const * k, duration_const, Timing.EaseOut);
        private_keyhole_body.params.rotation = private_scroll_offset;
        private_keyhole_body.params.scale = xyz(scale, scale, 1);
        private_keyhole_body.params.alpha = t(0, 1, duration_const * k, duration_const, Timing.EaseOut);
        draw_safe(0, 1, t(0, 1, 0, duration_const, Timing.Linear));
      } else {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        scale = t(0.5, 1, 0, duration_const * private_back_k, Timing.EaseOut);
        private_door.params.scale = xyz(scale, scale, 1);
        private_door.params.alpha = t(0, 1, 0, duration_const * private_back_k, Timing.EaseOut);
        draw_textured_shape(private_door, main_matrix, Prog.NORMAL_ONE);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        private_stroke.params.rotation = private_scroll_offset;
        private_stroke.params.alpha = t(0, 1, 0, duration_const * 0.25, Timing.Linear);
        private_stroke.params.position = xyz(0, 0, 0);
        scale = t(63, 63 * 2, 0, duration_const * private_back_k, Timing.EaseOut);
        change_rounded_rectangle_stroked(private_stroke, {width: scale, height: scale}, scale / 2);
        draw_shape(private_stroke, main_matrix);

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        scale = t(0.5, 1, 0, duration_const * private_back_k, Timing.EaseOut);
        private_keyhole_body.params.rotation = private_scroll_offset;
        private_keyhole_body.params.scale = xyz(scale, scale, 1);
        private_keyhole_body.params.alpha = t(0, 1, 0, duration_const * private_back_k, Timing.EaseOut);

        if(time < duration_const * 0.4) {
          cloud_cover.params.position.y = t_reversed(118 / 2 + 50, 118 / 2, duration_const * 0.8 * private_back_k, duration_const * private_back_k, Timing.EaseOut);
          draw_shape(cloud_cover, main_matrix);
        }

        draw_safe(0, t(0, 1, duration_const * private_back_k * 0, duration_const * private_back_k, Timing.Linear), t(0, 1, 0, duration_const, Timing.Linear));
      }
    } else if(current_page === 5) {
      const private_fade_k = 0.5;

      rglNormalDraw();

      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      scale = 1;
      private_door.params.scale = xyz(scale, scale, 1);
      private_door.params.alpha = t(1, 0, 0, duration_const * private_fade_k * 0.5, Timing.EaseOut);
      draw_textured_shape(private_door, main_matrix, Prog.NORMAL_ONE);

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      private_stroke.params.rotation = private_scroll_offset;
      private_stroke.params.alpha = t(1, 0, 0, duration_const * private_fade_k * 0.5, Timing.EaseOut);
      scale = t(244 / 2, r2 * 2, 0, duration_const, Timing.EaseOut);
      change_rounded_rectangle_stroked(private_stroke, {width: scale, height: scale}, scale / 2);
      draw_shape(private_stroke, main_matrix);

      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      scale = 1;
      private_keyhole_body.params.rotation = private_scroll_offset;
      private_keyhole_body.params.scale = xyz(scale, scale, 1);
      private_keyhole_body.params.alpha = t(1, 0, 0, duration_const * private_fade_k * 0.5, Timing.EaseOut);
      privateLayer.rotation = private_scroll_offset;
      mat4x4_layer(private_matrix, privateLayer, t(1, 0.9, 0, duration_const * private_fade_k, Timing.EaseOut), 0);
      cloud_cover.params.position.y = t(118 / 2 + 50, 118 / 2, 0, duration_const, Timing.EaseOut);
      draw_shape(cloud_cover, main_matrix);
    }

    prev_page = current_page;
  }

  function reset() {
    current_page = 0;
    prev_page = 0;
    direct = 0;
    time = 0;
    time_local = 0;
    date0 = 0;
    scroll_offset = 0;
  }

  return {
    setPage,
    setScrollOffset: (offset: number) => {
      scroll_offset = offset;
    },
    setDate: (a: number) => {
      date = a;
    },
    setBackgroundColor,
    onSurfaceChanged,
    onDrawFrame,
    reset
  };
}
