#!/usr/bin/env node
// @bun
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/consola/dist/chunks/prompt.mjs
var exports_prompt = {};
__export(exports_prompt, {
  prompt: () => prompt,
  kCancel: () => kCancel
});
import g, { stdin, stdout } from "node:process";
import f from "node:readline";
import { WriteStream } from "node:tty";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function requireSrc() {
  if (hasRequiredSrc)
    return src;
  hasRequiredSrc = 1;
  const ESC = "\x1B";
  const CSI = `${ESC}[`;
  const beep = "\x07";
  const cursor = {
    to(x, y) {
      if (!y)
        return `${CSI}${x + 1}G`;
      return `${CSI}${y + 1};${x + 1}H`;
    },
    move(x, y) {
      let ret = "";
      if (x < 0)
        ret += `${CSI}${-x}D`;
      else if (x > 0)
        ret += `${CSI}${x}C`;
      if (y < 0)
        ret += `${CSI}${-y}A`;
      else if (y > 0)
        ret += `${CSI}${y}B`;
      return ret;
    },
    up: (count = 1) => `${CSI}${count}A`,
    down: (count = 1) => `${CSI}${count}B`,
    forward: (count = 1) => `${CSI}${count}C`,
    backward: (count = 1) => `${CSI}${count}D`,
    nextLine: (count = 1) => `${CSI}E`.repeat(count),
    prevLine: (count = 1) => `${CSI}F`.repeat(count),
    left: `${CSI}G`,
    hide: `${CSI}?25l`,
    show: `${CSI}?25h`,
    save: `${ESC}7`,
    restore: `${ESC}8`
  };
  const scroll = {
    up: (count = 1) => `${CSI}S`.repeat(count),
    down: (count = 1) => `${CSI}T`.repeat(count)
  };
  const erase = {
    screen: `${CSI}2J`,
    up: (count = 1) => `${CSI}1J`.repeat(count),
    down: (count = 1) => `${CSI}J`.repeat(count),
    line: `${CSI}2K`,
    lineEnd: `${CSI}K`,
    lineStart: `${CSI}1K`,
    lines(count) {
      let clear = "";
      for (let i = 0;i < count; i++)
        clear += this.line + (i < count - 1 ? cursor.up() : "");
      if (count)
        clear += cursor.left;
      return clear;
    }
  };
  src = { cursor, scroll, erase, beep };
  return src;
}
function requirePicocolors() {
  if (hasRequiredPicocolors)
    return picocolors.exports;
  hasRequiredPicocolors = 1;
  let p = process || {}, argv2 = p.argv || [], env2 = p.env || {};
  let isColorSupported2 = !(!!env2.NO_COLOR || argv2.includes("--no-color")) && (!!env2.FORCE_COLOR || argv2.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env2.TERM !== "dumb" || !!env2.CI);
  let formatter = (open, close, replace = open) => (input) => {
    let string = "" + input, index = string.indexOf(close, open.length);
    return ~index ? open + replaceClose2(string, close, replace, index) + close : open + string + close;
  };
  let replaceClose2 = (string, close, replace, index) => {
    let result = "", cursor = 0;
    do {
      result += string.substring(cursor, index) + replace;
      cursor = index + close.length;
      index = string.indexOf(close, cursor);
    } while (~index);
    return result + string.substring(cursor);
  };
  let createColors2 = (enabled = isColorSupported2) => {
    let f2 = enabled ? formatter : () => String;
    return {
      isColorSupported: enabled,
      reset: f2("\x1B[0m", "\x1B[0m"),
      bold: f2("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: f2("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: f2("\x1B[3m", "\x1B[23m"),
      underline: f2("\x1B[4m", "\x1B[24m"),
      inverse: f2("\x1B[7m", "\x1B[27m"),
      hidden: f2("\x1B[8m", "\x1B[28m"),
      strikethrough: f2("\x1B[9m", "\x1B[29m"),
      black: f2("\x1B[30m", "\x1B[39m"),
      red: f2("\x1B[31m", "\x1B[39m"),
      green: f2("\x1B[32m", "\x1B[39m"),
      yellow: f2("\x1B[33m", "\x1B[39m"),
      blue: f2("\x1B[34m", "\x1B[39m"),
      magenta: f2("\x1B[35m", "\x1B[39m"),
      cyan: f2("\x1B[36m", "\x1B[39m"),
      white: f2("\x1B[37m", "\x1B[39m"),
      gray: f2("\x1B[90m", "\x1B[39m"),
      bgBlack: f2("\x1B[40m", "\x1B[49m"),
      bgRed: f2("\x1B[41m", "\x1B[49m"),
      bgGreen: f2("\x1B[42m", "\x1B[49m"),
      bgYellow: f2("\x1B[43m", "\x1B[49m"),
      bgBlue: f2("\x1B[44m", "\x1B[49m"),
      bgMagenta: f2("\x1B[45m", "\x1B[49m"),
      bgCyan: f2("\x1B[46m", "\x1B[49m"),
      bgWhite: f2("\x1B[47m", "\x1B[49m"),
      blackBright: f2("\x1B[90m", "\x1B[39m"),
      redBright: f2("\x1B[91m", "\x1B[39m"),
      greenBright: f2("\x1B[92m", "\x1B[39m"),
      yellowBright: f2("\x1B[93m", "\x1B[39m"),
      blueBright: f2("\x1B[94m", "\x1B[39m"),
      magentaBright: f2("\x1B[95m", "\x1B[39m"),
      cyanBright: f2("\x1B[96m", "\x1B[39m"),
      whiteBright: f2("\x1B[97m", "\x1B[39m"),
      bgBlackBright: f2("\x1B[100m", "\x1B[49m"),
      bgRedBright: f2("\x1B[101m", "\x1B[49m"),
      bgGreenBright: f2("\x1B[102m", "\x1B[49m"),
      bgYellowBright: f2("\x1B[103m", "\x1B[49m"),
      bgBlueBright: f2("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: f2("\x1B[105m", "\x1B[49m"),
      bgCyanBright: f2("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: f2("\x1B[107m", "\x1B[49m")
    };
  };
  picocolors.exports = createColors2();
  picocolors.exports.createColors = createColors2;
  return picocolors.exports;
}
function J({ onlyFirst: t = false } = {}) {
  const F = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?(?:\\u0007|\\u001B\\u005C|\\u009C))", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"].join("|");
  return new RegExp(F, t ? undefined : "g");
}
function T$1(t) {
  if (typeof t != "string")
    throw new TypeError(`Expected a \`string\`, got \`${typeof t}\``);
  return t.replace(Q, "");
}
function O(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
function A$1(t, u = {}) {
  if (typeof t != "string" || t.length === 0 || (u = { ambiguousIsNarrow: true, ...u }, t = T$1(t), t.length === 0))
    return 0;
  t = t.replace(FD(), "  ");
  const F = u.ambiguousIsNarrow ? 1 : 2;
  let e2 = 0;
  for (const s of t) {
    const i = s.codePointAt(0);
    if (i <= 31 || i >= 127 && i <= 159 || i >= 768 && i <= 879)
      continue;
    switch (DD.eastAsianWidth(s)) {
      case "F":
      case "W":
        e2 += 2;
        break;
      case "A":
        e2 += F;
        break;
      default:
        e2 += 1;
    }
  }
  return e2;
}
function sD() {
  const t = new Map;
  for (const [u, F] of Object.entries(r)) {
    for (const [e2, s] of Object.entries(F))
      r[e2] = { open: `\x1B[${s[0]}m`, close: `\x1B[${s[1]}m` }, F[e2] = r[e2], t.set(s[0], s[1]);
    Object.defineProperty(r, u, { value: F, enumerable: false });
  }
  return Object.defineProperty(r, "codes", { value: t, enumerable: false }), r.color.close = "\x1B[39m", r.bgColor.close = "\x1B[49m", r.color.ansi = L$1(), r.color.ansi256 = N(), r.color.ansi16m = I(), r.bgColor.ansi = L$1(m), r.bgColor.ansi256 = N(m), r.bgColor.ansi16m = I(m), Object.defineProperties(r, { rgbToAnsi256: { value: (u, F, e2) => u === F && F === e2 ? u < 8 ? 16 : u > 248 ? 231 : Math.round((u - 8) / 247 * 24) + 232 : 16 + 36 * Math.round(u / 255 * 5) + 6 * Math.round(F / 255 * 5) + Math.round(e2 / 255 * 5), enumerable: false }, hexToRgb: { value: (u) => {
    const F = /[a-f\d]{6}|[a-f\d]{3}/i.exec(u.toString(16));
    if (!F)
      return [0, 0, 0];
    let [e2] = F;
    e2.length === 3 && (e2 = [...e2].map((i) => i + i).join(""));
    const s = Number.parseInt(e2, 16);
    return [s >> 16 & 255, s >> 8 & 255, s & 255];
  }, enumerable: false }, hexToAnsi256: { value: (u) => r.rgbToAnsi256(...r.hexToRgb(u)), enumerable: false }, ansi256ToAnsi: { value: (u) => {
    if (u < 8)
      return 30 + u;
    if (u < 16)
      return 90 + (u - 8);
    let F, e2, s;
    if (u >= 232)
      F = ((u - 232) * 10 + 8) / 255, e2 = F, s = F;
    else {
      u -= 16;
      const C = u % 36;
      F = Math.floor(u / 36) / 5, e2 = Math.floor(C / 6) / 5, s = C % 6 / 5;
    }
    const i = Math.max(F, e2, s) * 2;
    if (i === 0)
      return 30;
    let D = 30 + (Math.round(s) << 2 | Math.round(e2) << 1 | Math.round(F));
    return i === 2 && (D += 60), D;
  }, enumerable: false }, rgbToAnsi: { value: (u, F, e2) => r.ansi256ToAnsi(r.rgbToAnsi256(u, F, e2)), enumerable: false }, hexToAnsi: { value: (u) => r.ansi256ToAnsi(r.hexToAnsi256(u)), enumerable: false } }), r;
}
function G(t, u, F) {
  return String(t).normalize().replace(/\r\n/g, `
`).split(`
`).map((e2) => oD(e2, u, F)).join(`
`);
}
function k$1(t, u) {
  if (typeof t == "string")
    return c.aliases.get(t) === u;
  for (const F of t)
    if (F !== undefined && k$1(F, u))
      return true;
  return false;
}
function lD(t, u) {
  if (t === u)
    return;
  const F = t.split(`
`), e2 = u.split(`
`), s = [];
  for (let i = 0;i < Math.max(F.length, e2.length); i++)
    F[i] !== e2[i] && s.push(i);
  return s;
}
function d$1(t, u) {
  const F = t;
  F.isTTY && F.setRawMode(u);
}

class x {
  constructor(u, F = true) {
    h(this, "input"), h(this, "output"), h(this, "_abortSignal"), h(this, "rl"), h(this, "opts"), h(this, "_render"), h(this, "_track", false), h(this, "_prevFrame", ""), h(this, "_subscribers", new Map), h(this, "_cursor", 0), h(this, "state", "initial"), h(this, "error", ""), h(this, "value");
    const { input: e2 = stdin, output: s = stdout, render: i, signal: D, ...C } = u;
    this.opts = C, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = i.bind(this), this._track = F, this._abortSignal = D, this.input = e2, this.output = s;
  }
  unsubscribe() {
    this._subscribers.clear();
  }
  setSubscriber(u, F) {
    const e2 = this._subscribers.get(u) ?? [];
    e2.push(F), this._subscribers.set(u, e2);
  }
  on(u, F) {
    this.setSubscriber(u, { cb: F });
  }
  once(u, F) {
    this.setSubscriber(u, { cb: F, once: true });
  }
  emit(u, ...F) {
    const e2 = this._subscribers.get(u) ?? [], s = [];
    for (const i of e2)
      i.cb(...F), i.once && s.push(() => e2.splice(e2.indexOf(i), 1));
    for (const i of s)
      i();
  }
  prompt() {
    return new Promise((u, F) => {
      if (this._abortSignal) {
        if (this._abortSignal.aborted)
          return this.state = "cancel", this.close(), u(S);
        this._abortSignal.addEventListener("abort", () => {
          this.state = "cancel", this.close();
        }, { once: true });
      }
      const e2 = new WriteStream(0);
      e2._write = (s, i, D) => {
        this._track && (this.value = this.rl?.line.replace(/\t/g, ""), this._cursor = this.rl?.cursor ?? 0, this.emit("value", this.value)), D();
      }, this.input.pipe(e2), this.rl = f.createInterface({ input: this.input, output: e2, tabSize: 2, prompt: "", escapeCodeTimeout: 50 }), f.emitKeypressEvents(this.input, this.rl), this.rl.prompt(), this.opts.initialValue !== undefined && this._track && this.rl.write(this.opts.initialValue), this.input.on("keypress", this.onKeypress), d$1(this.input, true), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
        this.output.write(srcExports.cursor.show), this.output.off("resize", this.render), d$1(this.input, false), u(this.value);
      }), this.once("cancel", () => {
        this.output.write(srcExports.cursor.show), this.output.off("resize", this.render), d$1(this.input, false), u(S);
      });
    });
  }
  onKeypress(u, F) {
    if (this.state === "error" && (this.state = "active"), F?.name && (!this._track && c.aliases.has(F.name) && this.emit("cursor", c.aliases.get(F.name)), c.actions.has(F.name) && this.emit("cursor", F.name)), u && (u.toLowerCase() === "y" || u.toLowerCase() === "n") && this.emit("confirm", u.toLowerCase() === "y"), u === "\t" && this.opts.placeholder && (this.value || (this.rl?.write(this.opts.placeholder), this.emit("value", this.opts.placeholder))), u && this.emit("key", u.toLowerCase()), F?.name === "return") {
      if (this.opts.validate) {
        const e2 = this.opts.validate(this.value);
        e2 && (this.error = e2 instanceof Error ? e2.message : e2, this.state = "error", this.rl?.write(this.value));
      }
      this.state !== "error" && (this.state = "submit");
    }
    k$1([u, F?.name, F?.sequence], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
  }
  close() {
    this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), d$1(this.input, false), this.rl?.close(), this.rl = undefined, this.emit(`${this.state}`, this.value), this.unsubscribe();
  }
  restoreCursor() {
    const u = G(this._prevFrame, process.stdout.columns, { hard: true }).split(`
`).length - 1;
    this.output.write(srcExports.cursor.move(-999, u * -1));
  }
  render() {
    const u = G(this._render(this) ?? "", process.stdout.columns, { hard: true });
    if (u !== this._prevFrame) {
      if (this.state === "initial")
        this.output.write(srcExports.cursor.hide);
      else {
        const F = lD(this._prevFrame, u);
        if (this.restoreCursor(), F && F?.length === 1) {
          const e2 = F[0];
          this.output.write(srcExports.cursor.move(0, e2)), this.output.write(srcExports.erase.lines(1));
          const s = u.split(`
`);
          this.output.write(s[e2]), this._prevFrame = u, this.output.write(srcExports.cursor.move(0, s.length - e2 - 1));
          return;
        }
        if (F && F?.length > 1) {
          const e2 = F[0];
          this.output.write(srcExports.cursor.move(0, e2)), this.output.write(srcExports.erase.down());
          const s = u.split(`
`).slice(e2);
          this.output.write(s.join(`
`)), this._prevFrame = u;
          return;
        }
        this.output.write(srcExports.erase.down());
      }
      this.output.write(u), this.state === "initial" && (this.state = "active"), this._prevFrame = u;
    }
  }
}
function ce() {
  return g.platform !== "win32" ? g.env.TERM !== "linux" : !!g.env.CI || !!g.env.WT_SESSION || !!g.env.TERMINUS_SUBLIME || g.env.ConEmuTask === "{cmd::Cmder}" || g.env.TERM_PROGRAM === "Terminus-Sublime" || g.env.TERM_PROGRAM === "vscode" || g.env.TERM === "xterm-256color" || g.env.TERM === "alacritty" || g.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
async function prompt(message, opts = {}) {
  const handleCancel = (value) => {
    if (typeof value !== "symbol" || value.toString() !== "Symbol(clack:cancel)") {
      return value;
    }
    switch (opts.cancel) {
      case "reject": {
        const error = new Error("Prompt cancelled.");
        error.name = "ConsolaPromptCancelledError";
        if (Error.captureStackTrace) {
          Error.captureStackTrace(error, prompt);
        }
        throw error;
      }
      case "undefined": {
        return;
      }
      case "null": {
        return null;
      }
      case "symbol": {
        return kCancel;
      }
      default:
      case "default": {
        return opts.default ?? opts.initial;
      }
    }
  };
  if (!opts.type || opts.type === "text") {
    return await he({
      message,
      defaultValue: opts.default,
      placeholder: opts.placeholder,
      initialValue: opts.initial
    }).then(handleCancel);
  }
  if (opts.type === "confirm") {
    return await ye({
      message,
      initialValue: opts.initial
    }).then(handleCancel);
  }
  if (opts.type === "select") {
    return await ve({
      message,
      options: opts.options.map((o2) => typeof o2 === "string" ? { value: o2, label: o2 } : o2),
      initialValue: opts.initial
    }).then(handleCancel);
  }
  if (opts.type === "multiselect") {
    return await fe({
      message,
      options: opts.options.map((o2) => typeof o2 === "string" ? { value: o2, label: o2 } : o2),
      required: opts.required,
      initialValues: opts.initial
    }).then(handleCancel);
  }
  throw new Error(`Unknown prompt type: ${opts.type}`);
}
var src, hasRequiredSrc, srcExports, picocolors, hasRequiredPicocolors, picocolorsExports, e, Q, P$1, X, DD, uD = function() {
  return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|(?:\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFC-\uDFFF])|\uD83D\uDC68(?:\uD83C\uDFFB(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|[\u2695\u2696\u2708]\uFE0F|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))?|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])\uFE0F|\u200D(?:(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D[\uDC66\uDC67])|\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC)?|(?:\uD83D\uDC69(?:\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69]))|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC69(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83E\uDDD1(?:\u200D(?:\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDE36\u200D\uD83C\uDF2B|\uD83C\uDFF3\uFE0F\u200D\u26A7|\uD83D\uDC3B\u200D\u2744|(?:(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\uD83C\uDFF4\u200D\u2620|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])\u200D[\u2640\u2642]|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u2600-\u2604\u260E\u2611\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26B0\u26B1\u26C8\u26CF\u26D1\u26D3\u26E9\u26F0\u26F1\u26F4\u26F7\u26F8\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u3030\u303D\u3297\u3299]|\uD83C[\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]|\uD83D[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3])\uFE0F|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDE35\u200D\uD83D\uDCAB|\uD83D\uDE2E\u200D\uD83D\uDCA8|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83E\uDDD1(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83D\uDC69(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF4\uD83C\uDDF2|\uD83D\uDC08\u200D\u2B1B|\u2764\uFE0F\u200D(?:\uD83D\uDD25|\uD83E\uDE79)|\uD83D\uDC41\uFE0F|\uD83C\uDFF3\uFE0F|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|[#\*0-9]\uFE0F\u20E3|\u2764\uFE0F|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|\uD83C\uDFF4|(?:[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270C\u270D]|\uD83D[\uDD74\uDD90])(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC08\uDC15\uDC3B\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE2E\uDE35\uDE36\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5]|\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD]|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF]|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0D\uDD0E\uDD10-\uDD17\uDD1D\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78\uDD7A-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCB\uDDD0\uDDE0-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6]|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26A7\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5-\uDED7\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDD77\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
}, FD, m = 10, L$1 = (t = 0) => (u) => `\x1B[${u + t}m`, N = (t = 0) => (u) => `\x1B[${38 + t};5;${u}m`, I = (t = 0) => (u, F, e2) => `\x1B[${38 + t};2;${u};${F};${e2}m`, r, tD, eD, iD, v, CD = 39, w$1 = "\x07", W$1 = "[", rD = "]", R = "m", y, V$1 = (t) => `${v.values().next().value}${W$1}${t}${R}`, z = (t) => `${v.values().next().value}${y}${t}${w$1}`, ED = (t) => t.split(" ").map((u) => A$1(u)), _ = (t, u, F) => {
  const e2 = [...u];
  let s = false, i = false, D = A$1(T$1(t[t.length - 1]));
  for (const [C, o] of e2.entries()) {
    const E = A$1(o);
    if (D + E <= F ? t[t.length - 1] += o : (t.push(o), D = 0), v.has(o) && (s = true, i = e2.slice(C + 1).join("").startsWith(y)), s) {
      i ? o === w$1 && (s = false, i = false) : o === R && (s = false);
      continue;
    }
    D += E, D === F && C < e2.length - 1 && (t.push(""), D = 0);
  }
  !D && t[t.length - 1].length > 0 && t.length > 1 && (t[t.length - 2] += t.pop());
}, nD = (t) => {
  const u = t.split(" ");
  let F = u.length;
  for (;F > 0 && !(A$1(u[F - 1]) > 0); )
    F--;
  return F === u.length ? t : u.slice(0, F).join(" ") + u.slice(F).join("");
}, oD = (t, u, F = {}) => {
  if (F.trim !== false && t.trim() === "")
    return "";
  let e2 = "", s, i;
  const D = ED(t);
  let C = [""];
  for (const [E, a] of t.split(" ").entries()) {
    F.trim !== false && (C[C.length - 1] = C[C.length - 1].trimStart());
    let n = A$1(C[C.length - 1]);
    if (E !== 0 && (n >= u && (F.wordWrap === false || F.trim === false) && (C.push(""), n = 0), (n > 0 || F.trim === false) && (C[C.length - 1] += " ", n++)), F.hard && D[E] > u) {
      const B = u - n, p = 1 + Math.floor((D[E] - B - 1) / u);
      Math.floor((D[E] - 1) / u) < p && C.push(""), _(C, a, u);
      continue;
    }
    if (n + D[E] > u && n > 0 && D[E] > 0) {
      if (F.wordWrap === false && n < u) {
        _(C, a, u);
        continue;
      }
      C.push("");
    }
    if (n + D[E] > u && F.wordWrap === false) {
      _(C, a, u);
      continue;
    }
    C[C.length - 1] += a;
  }
  F.trim !== false && (C = C.map((E) => nD(E)));
  const o = [...C.join(`
`)];
  for (const [E, a] of o.entries()) {
    if (e2 += a, v.has(a)) {
      const { groups: B } = new RegExp(`(?:\\${W$1}(?<code>\\d+)m|\\${y}(?<uri>.*)${w$1})`).exec(o.slice(E).join("")) || { groups: {} };
      if (B.code !== undefined) {
        const p = Number.parseFloat(B.code);
        s = p === CD ? undefined : p;
      } else
        B.uri !== undefined && (i = B.uri.length === 0 ? undefined : B.uri);
    }
    const n = iD.codes.get(Number(s));
    o[E + 1] === `
` ? (i && (e2 += z("")), s && n && (e2 += V$1(n))) : a === `
` && (s && n && (e2 += V$1(s)), i && (e2 += z(i)));
  }
  return e2;
}, aD, c, S, AD, pD = (t, u, F) => (u in t) ? AD(t, u, { enumerable: true, configurable: true, writable: true, value: F }) : t[u] = F, h = (t, u, F) => (pD(t, typeof u != "symbol" ? u + "" : u, F), F), fD, bD, mD = (t, u, F) => (u in t) ? bD(t, u, { enumerable: true, configurable: true, writable: true, value: F }) : t[u] = F, Y = (t, u, F) => (mD(t, typeof u != "symbol" ? u + "" : u, F), F), wD, SD, $D = (t, u, F) => (u in t) ? SD(t, u, { enumerable: true, configurable: true, writable: true, value: F }) : t[u] = F, q = (t, u, F) => ($D(t, typeof u != "symbol" ? u + "" : u, F), F), jD, PD, V, u = (t, n) => V ? t : n, le, L, W, C, o, d, k, P, A, T, F, w = (t) => {
  switch (t) {
    case "initial":
    case "active":
      return e.cyan(le);
    case "cancel":
      return e.red(L);
    case "error":
      return e.yellow(W);
    case "submit":
      return e.green(C);
  }
}, B = (t) => {
  const { cursor: n, options: s, style: r2 } = t, i = t.maxItems ?? Number.POSITIVE_INFINITY, a = Math.max(process.stdout.rows - 4, 0), c2 = Math.min(a, Math.max(i, 5));
  let l = 0;
  n >= l + c2 - 3 ? l = Math.max(Math.min(n - c2 + 3, s.length - c2), 0) : n < l + 2 && (l = Math.max(n - 2, 0));
  const $ = c2 < s.length && l > 0, p = c2 < s.length && l + c2 < s.length;
  return s.slice(l, l + c2).map((M, v2, x2) => {
    const j = v2 === 0 && $, E = v2 === x2.length - 1 && p;
    return j || E ? e.dim("...") : r2(M, v2 + l === n);
  });
}, he = (t) => new PD({ validate: t.validate, placeholder: t.placeholder, defaultValue: t.defaultValue, initialValue: t.initialValue, render() {
  const n = `${e.gray(o)}
${w(this.state)} ${t.message}
`, s = t.placeholder ? e.inverse(t.placeholder[0]) + e.dim(t.placeholder.slice(1)) : e.inverse(e.hidden("_")), r2 = this.value ? this.valueWithCursor : s;
  switch (this.state) {
    case "error":
      return `${n.trim()}
${e.yellow(o)} ${r2}
${e.yellow(d)} ${e.yellow(this.error)}
`;
    case "submit":
      return `${n}${e.gray(o)} ${e.dim(this.value || t.placeholder)}`;
    case "cancel":
      return `${n}${e.gray(o)} ${e.strikethrough(e.dim(this.value ?? ""))}${this.value?.trim() ? `
${e.gray(o)}` : ""}`;
    default:
      return `${n}${e.cyan(o)} ${r2}
${e.cyan(d)}
`;
  }
} }).prompt(), ye = (t) => {
  const n = t.active ?? "Yes", s = t.inactive ?? "No";
  return new fD({ active: n, inactive: s, initialValue: t.initialValue ?? true, render() {
    const r2 = `${e.gray(o)}
${w(this.state)} ${t.message}
`, i = this.value ? n : s;
    switch (this.state) {
      case "submit":
        return `${r2}${e.gray(o)} ${e.dim(i)}`;
      case "cancel":
        return `${r2}${e.gray(o)} ${e.strikethrough(e.dim(i))}
${e.gray(o)}`;
      default:
        return `${r2}${e.cyan(o)} ${this.value ? `${e.green(k)} ${n}` : `${e.dim(P)} ${e.dim(n)}`} ${e.dim("/")} ${this.value ? `${e.dim(P)} ${e.dim(s)}` : `${e.green(k)} ${s}`}
${e.cyan(d)}
`;
    }
  } }).prompt();
}, ve = (t) => {
  const n = (s, r2) => {
    const i = s.label ?? String(s.value);
    switch (r2) {
      case "selected":
        return `${e.dim(i)}`;
      case "active":
        return `${e.green(k)} ${i} ${s.hint ? e.dim(`(${s.hint})`) : ""}`;
      case "cancelled":
        return `${e.strikethrough(e.dim(i))}`;
      default:
        return `${e.dim(P)} ${e.dim(i)}`;
    }
  };
  return new jD({ options: t.options, initialValue: t.initialValue, render() {
    const s = `${e.gray(o)}
${w(this.state)} ${t.message}
`;
    switch (this.state) {
      case "submit":
        return `${s}${e.gray(o)} ${n(this.options[this.cursor], "selected")}`;
      case "cancel":
        return `${s}${e.gray(o)} ${n(this.options[this.cursor], "cancelled")}
${e.gray(o)}`;
      default:
        return `${s}${e.cyan(o)} ${B({ cursor: this.cursor, options: this.options, maxItems: t.maxItems, style: (r2, i) => n(r2, i ? "active" : "inactive") }).join(`
${e.cyan(o)}  `)}
${e.cyan(d)}
`;
    }
  } }).prompt();
}, fe = (t) => {
  const n = (s, r2) => {
    const i = s.label ?? String(s.value);
    return r2 === "active" ? `${e.cyan(A)} ${i} ${s.hint ? e.dim(`(${s.hint})`) : ""}` : r2 === "selected" ? `${e.green(T)} ${e.dim(i)}` : r2 === "cancelled" ? `${e.strikethrough(e.dim(i))}` : r2 === "active-selected" ? `${e.green(T)} ${i} ${s.hint ? e.dim(`(${s.hint})`) : ""}` : r2 === "submitted" ? `${e.dim(i)}` : `${e.dim(F)} ${e.dim(i)}`;
  };
  return new wD({ options: t.options, initialValues: t.initialValues, required: t.required ?? true, cursorAt: t.cursorAt, validate(s) {
    if (this.required && s.length === 0)
      return `Please select at least one option.
${e.reset(e.dim(`Press ${e.gray(e.bgWhite(e.inverse(" space ")))} to select, ${e.gray(e.bgWhite(e.inverse(" enter ")))} to submit`))}`;
  }, render() {
    const s = `${e.gray(o)}
${w(this.state)} ${t.message}
`, r2 = (i, a) => {
      const c2 = this.value.includes(i.value);
      return a && c2 ? n(i, "active-selected") : c2 ? n(i, "selected") : n(i, a ? "active" : "inactive");
    };
    switch (this.state) {
      case "submit":
        return `${s}${e.gray(o)} ${this.options.filter(({ value: i }) => this.value.includes(i)).map((i) => n(i, "submitted")).join(e.dim(", ")) || e.dim("none")}`;
      case "cancel": {
        const i = this.options.filter(({ value: a }) => this.value.includes(a)).map((a) => n(a, "cancelled")).join(e.dim(", "));
        return `${s}${e.gray(o)} ${i.trim() ? `${i}
${e.gray(o)}` : ""}`;
      }
      case "error": {
        const i = this.error.split(`
`).map((a, c2) => c2 === 0 ? `${e.yellow(d)} ${e.yellow(a)}` : `   ${a}`).join(`
`);
        return `${s + e.yellow(o)} ${B({ options: this.options, cursor: this.cursor, maxItems: t.maxItems, style: r2 }).join(`
${e.yellow(o)}  `)}
${i}
`;
      }
      default:
        return `${s}${e.cyan(o)} ${B({ options: this.options, cursor: this.cursor, maxItems: t.maxItems, style: r2 }).join(`
${e.cyan(o)}  `)}
${e.cyan(d)}
`;
    }
  } }).prompt();
}, kCancel;
var init_prompt = __esm(() => {
  srcExports = requireSrc();
  picocolors = { exports: {} };
  picocolorsExports = /* @__PURE__ */ requirePicocolors();
  e = /* @__PURE__ */ getDefaultExportFromCjs(picocolorsExports);
  Q = J();
  P$1 = { exports: {} };
  (function(t) {
    var u = {};
    t.exports = u, u.eastAsianWidth = function(e2) {
      var s = e2.charCodeAt(0), i = e2.length == 2 ? e2.charCodeAt(1) : 0, D = s;
      return 55296 <= s && s <= 56319 && 56320 <= i && i <= 57343 && (s &= 1023, i &= 1023, D = s << 10 | i, D += 65536), D == 12288 || 65281 <= D && D <= 65376 || 65504 <= D && D <= 65510 ? "F" : D == 8361 || 65377 <= D && D <= 65470 || 65474 <= D && D <= 65479 || 65482 <= D && D <= 65487 || 65490 <= D && D <= 65495 || 65498 <= D && D <= 65500 || 65512 <= D && D <= 65518 ? "H" : 4352 <= D && D <= 4447 || 4515 <= D && D <= 4519 || 4602 <= D && D <= 4607 || 9001 <= D && D <= 9002 || 11904 <= D && D <= 11929 || 11931 <= D && D <= 12019 || 12032 <= D && D <= 12245 || 12272 <= D && D <= 12283 || 12289 <= D && D <= 12350 || 12353 <= D && D <= 12438 || 12441 <= D && D <= 12543 || 12549 <= D && D <= 12589 || 12593 <= D && D <= 12686 || 12688 <= D && D <= 12730 || 12736 <= D && D <= 12771 || 12784 <= D && D <= 12830 || 12832 <= D && D <= 12871 || 12880 <= D && D <= 13054 || 13056 <= D && D <= 19903 || 19968 <= D && D <= 42124 || 42128 <= D && D <= 42182 || 43360 <= D && D <= 43388 || 44032 <= D && D <= 55203 || 55216 <= D && D <= 55238 || 55243 <= D && D <= 55291 || 63744 <= D && D <= 64255 || 65040 <= D && D <= 65049 || 65072 <= D && D <= 65106 || 65108 <= D && D <= 65126 || 65128 <= D && D <= 65131 || 110592 <= D && D <= 110593 || 127488 <= D && D <= 127490 || 127504 <= D && D <= 127546 || 127552 <= D && D <= 127560 || 127568 <= D && D <= 127569 || 131072 <= D && D <= 194367 || 177984 <= D && D <= 196605 || 196608 <= D && D <= 262141 ? "W" : 32 <= D && D <= 126 || 162 <= D && D <= 163 || 165 <= D && D <= 166 || D == 172 || D == 175 || 10214 <= D && D <= 10221 || 10629 <= D && D <= 10630 ? "Na" : D == 161 || D == 164 || 167 <= D && D <= 168 || D == 170 || 173 <= D && D <= 174 || 176 <= D && D <= 180 || 182 <= D && D <= 186 || 188 <= D && D <= 191 || D == 198 || D == 208 || 215 <= D && D <= 216 || 222 <= D && D <= 225 || D == 230 || 232 <= D && D <= 234 || 236 <= D && D <= 237 || D == 240 || 242 <= D && D <= 243 || 247 <= D && D <= 250 || D == 252 || D == 254 || D == 257 || D == 273 || D == 275 || D == 283 || 294 <= D && D <= 295 || D == 299 || 305 <= D && D <= 307 || D == 312 || 319 <= D && D <= 322 || D == 324 || 328 <= D && D <= 331 || D == 333 || 338 <= D && D <= 339 || 358 <= D && D <= 359 || D == 363 || D == 462 || D == 464 || D == 466 || D == 468 || D == 470 || D == 472 || D == 474 || D == 476 || D == 593 || D == 609 || D == 708 || D == 711 || 713 <= D && D <= 715 || D == 717 || D == 720 || 728 <= D && D <= 731 || D == 733 || D == 735 || 768 <= D && D <= 879 || 913 <= D && D <= 929 || 931 <= D && D <= 937 || 945 <= D && D <= 961 || 963 <= D && D <= 969 || D == 1025 || 1040 <= D && D <= 1103 || D == 1105 || D == 8208 || 8211 <= D && D <= 8214 || 8216 <= D && D <= 8217 || 8220 <= D && D <= 8221 || 8224 <= D && D <= 8226 || 8228 <= D && D <= 8231 || D == 8240 || 8242 <= D && D <= 8243 || D == 8245 || D == 8251 || D == 8254 || D == 8308 || D == 8319 || 8321 <= D && D <= 8324 || D == 8364 || D == 8451 || D == 8453 || D == 8457 || D == 8467 || D == 8470 || 8481 <= D && D <= 8482 || D == 8486 || D == 8491 || 8531 <= D && D <= 8532 || 8539 <= D && D <= 8542 || 8544 <= D && D <= 8555 || 8560 <= D && D <= 8569 || D == 8585 || 8592 <= D && D <= 8601 || 8632 <= D && D <= 8633 || D == 8658 || D == 8660 || D == 8679 || D == 8704 || 8706 <= D && D <= 8707 || 8711 <= D && D <= 8712 || D == 8715 || D == 8719 || D == 8721 || D == 8725 || D == 8730 || 8733 <= D && D <= 8736 || D == 8739 || D == 8741 || 8743 <= D && D <= 8748 || D == 8750 || 8756 <= D && D <= 8759 || 8764 <= D && D <= 8765 || D == 8776 || D == 8780 || D == 8786 || 8800 <= D && D <= 8801 || 8804 <= D && D <= 8807 || 8810 <= D && D <= 8811 || 8814 <= D && D <= 8815 || 8834 <= D && D <= 8835 || 8838 <= D && D <= 8839 || D == 8853 || D == 8857 || D == 8869 || D == 8895 || D == 8978 || 9312 <= D && D <= 9449 || 9451 <= D && D <= 9547 || 9552 <= D && D <= 9587 || 9600 <= D && D <= 9615 || 9618 <= D && D <= 9621 || 9632 <= D && D <= 9633 || 9635 <= D && D <= 9641 || 9650 <= D && D <= 9651 || 9654 <= D && D <= 9655 || 9660 <= D && D <= 9661 || 9664 <= D && D <= 9665 || 9670 <= D && D <= 9672 || D == 9675 || 9678 <= D && D <= 9681 || 9698 <= D && D <= 9701 || D == 9711 || 9733 <= D && D <= 9734 || D == 9737 || 9742 <= D && D <= 9743 || 9748 <= D && D <= 9749 || D == 9756 || D == 9758 || D == 9792 || D == 9794 || 9824 <= D && D <= 9825 || 9827 <= D && D <= 9829 || 9831 <= D && D <= 9834 || 9836 <= D && D <= 9837 || D == 9839 || 9886 <= D && D <= 9887 || 9918 <= D && D <= 9919 || 9924 <= D && D <= 9933 || 9935 <= D && D <= 9953 || D == 9955 || 9960 <= D && D <= 9983 || D == 10045 || D == 10071 || 10102 <= D && D <= 10111 || 11093 <= D && D <= 11097 || 12872 <= D && D <= 12879 || 57344 <= D && D <= 63743 || 65024 <= D && D <= 65039 || D == 65533 || 127232 <= D && D <= 127242 || 127248 <= D && D <= 127277 || 127280 <= D && D <= 127337 || 127344 <= D && D <= 127386 || 917760 <= D && D <= 917999 || 983040 <= D && D <= 1048573 || 1048576 <= D && D <= 1114109 ? "A" : "N";
    }, u.characterLength = function(e2) {
      var s = this.eastAsianWidth(e2);
      return s == "F" || s == "W" || s == "A" ? 2 : 1;
    };
    function F(e2) {
      return e2.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
    }
    u.length = function(e2) {
      for (var s = F(e2), i = 0, D = 0;D < s.length; D++)
        i = i + this.characterLength(s[D]);
      return i;
    }, u.slice = function(e2, s, i) {
      textLen = u.length(e2), s = s || 0, i = i || 1, s < 0 && (s = textLen + s), i < 0 && (i = textLen + i);
      for (var D = "", C = 0, o = F(e2), E = 0;E < o.length; E++) {
        var a = o[E], n = u.length(a);
        if (C >= s - (n == 2 ? 1 : 0))
          if (C + n <= i)
            D += a;
          else
            break;
        C += n;
      }
      return D;
    };
  })(P$1);
  X = P$1.exports;
  DD = O(X);
  FD = O(uD);
  r = { modifier: { reset: [0, 0], bold: [1, 22], dim: [2, 22], italic: [3, 23], underline: [4, 24], overline: [53, 55], inverse: [7, 27], hidden: [8, 28], strikethrough: [9, 29] }, color: { black: [30, 39], red: [31, 39], green: [32, 39], yellow: [33, 39], blue: [34, 39], magenta: [35, 39], cyan: [36, 39], white: [37, 39], blackBright: [90, 39], gray: [90, 39], grey: [90, 39], redBright: [91, 39], greenBright: [92, 39], yellowBright: [93, 39], blueBright: [94, 39], magentaBright: [95, 39], cyanBright: [96, 39], whiteBright: [97, 39] }, bgColor: { bgBlack: [40, 49], bgRed: [41, 49], bgGreen: [42, 49], bgYellow: [43, 49], bgBlue: [44, 49], bgMagenta: [45, 49], bgCyan: [46, 49], bgWhite: [47, 49], bgBlackBright: [100, 49], bgGray: [100, 49], bgGrey: [100, 49], bgRedBright: [101, 49], bgGreenBright: [102, 49], bgYellowBright: [103, 49], bgBlueBright: [104, 49], bgMagentaBright: [105, 49], bgCyanBright: [106, 49], bgWhiteBright: [107, 49] } };
  Object.keys(r.modifier);
  tD = Object.keys(r.color);
  eD = Object.keys(r.bgColor);
  [...tD, ...eD];
  iD = sD();
  v = new Set(["\x1B", ""]);
  y = `${rD}8;;`;
  aD = ["up", "down", "left", "right", "space", "enter", "cancel"];
  c = { actions: new Set(aD), aliases: new Map([["k", "up"], ["j", "down"], ["h", "left"], ["l", "right"], ["\x03", "cancel"], ["escape", "cancel"]]) };
  globalThis.process.platform.startsWith("win");
  S = Symbol("clack:cancel");
  AD = Object.defineProperty;
  fD = class fD extends x {
    get cursor() {
      return this.value ? 0 : 1;
    }
    get _value() {
      return this.cursor === 0;
    }
    constructor(u) {
      super(u, false), this.value = !!u.initialValue, this.on("value", () => {
        this.value = this._value;
      }), this.on("confirm", (F) => {
        this.output.write(srcExports.cursor.move(0, -1)), this.value = F, this.state = "submit", this.close();
      }), this.on("cursor", () => {
        this.value = !this.value;
      });
    }
  };
  bD = Object.defineProperty;
  wD = class extends x {
    constructor(u) {
      super(u, false), Y(this, "options"), Y(this, "cursor", 0), this.options = u.options, this.value = [...u.initialValues ?? []], this.cursor = Math.max(this.options.findIndex(({ value: F }) => F === u.cursorAt), 0), this.on("key", (F) => {
        F === "a" && this.toggleAll();
      }), this.on("cursor", (F) => {
        switch (F) {
          case "left":
          case "up":
            this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
            break;
          case "down":
          case "right":
            this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
            break;
          case "space":
            this.toggleValue();
            break;
        }
      });
    }
    get _value() {
      return this.options[this.cursor].value;
    }
    toggleAll() {
      const u = this.value.length === this.options.length;
      this.value = u ? [] : this.options.map((F) => F.value);
    }
    toggleValue() {
      const u = this.value.includes(this._value);
      this.value = u ? this.value.filter((F) => F !== this._value) : [...this.value, this._value];
    }
  };
  SD = Object.defineProperty;
  jD = class jD extends x {
    constructor(u) {
      super(u, false), q(this, "options"), q(this, "cursor", 0), this.options = u.options, this.cursor = this.options.findIndex(({ value: F }) => F === u.initialValue), this.cursor === -1 && (this.cursor = 0), this.changeValue(), this.on("cursor", (F) => {
        switch (F) {
          case "left":
          case "up":
            this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
            break;
          case "down":
          case "right":
            this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
            break;
        }
        this.changeValue();
      });
    }
    get _value() {
      return this.options[this.cursor];
    }
    changeValue() {
      this.value = this._value.value;
    }
  };
  PD = class PD extends x {
    get valueWithCursor() {
      if (this.state === "submit")
        return this.value;
      if (this.cursor >= this.value.length)
        return `${this.value}█`;
      const u = this.value.slice(0, this.cursor), [F, ...e$1] = this.value.slice(this.cursor);
      return `${u}${e.inverse(F)}${e$1.join("")}`;
    }
    get cursor() {
      return this._cursor;
    }
    constructor(u) {
      super(u), this.on("finalize", () => {
        this.value || (this.value = u.defaultValue);
      });
    }
  };
  V = ce();
  le = u("❯", ">");
  L = u("■", "x");
  W = u("▲", "x");
  C = u("✔", "√");
  o = u("");
  d = u("");
  k = u("●", ">");
  P = u("○", " ");
  A = u("◻", "[•]");
  T = u("◼", "[+]");
  F = u("◻", "[ ]");
  `${e.gray(o)}  `;
  kCancel = Symbol.for("cancel");
});

// src/dispatcher/file-lock.ts
import { randomBytes } from "node:crypto";
import { linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
function currentBootId() {
  try {
    return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() || null;
  } catch {
    return null;
  }
}
function defaultIsAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}
function acquireFileLock(lockPath, opts = {}) {
  const now = opts.now ?? Date.now;
  const isAlive = opts.isAlive ?? defaultIsAlive;
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const bootIdOf = opts.bootId ?? currentBootId;
  const myBoot = bootIdOf();
  for (let attempt = 0;attempt < 2; attempt++) {
    try {
      const nonce = randomBytes(8).toString("hex");
      const ours = `${process.pid}
${now()}
${nonce}
${myBoot ?? ""}
`;
      const staging = `${lockPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
      writeFileSync(staging, ours);
      try {
        linkSync(staging, lockPath);
      } catch (linkErr) {
        try {
          unlinkSync(staging);
        } catch {}
        throw linkErr;
      }
      try {
        unlinkSync(staging);
      } catch {}
      let released = false;
      return () => {
        if (released)
          return;
        released = true;
        try {
          if (readFileSync(lockPath, "utf8") !== ours)
            return;
          unlinkSync(lockPath);
        } catch {}
      };
    } catch (err) {
      if (err.code !== "EEXIST")
        throw err;
      let holderPid = Number.NaN;
      let ts = Number.NaN;
      let holderBoot = null;
      let inspected = null;
      try {
        inspected = readFileSync(lockPath, "utf8");
        const parts = inspected.split(`
`);
        holderPid = Number.parseInt(parts[0] ?? "", 10);
        ts = Number.parseInt(parts[1] ?? "", 10);
        holderBoot = (parts[3] ?? "").trim() || null;
      } catch {}
      const rebooted = holderBoot !== null && myBoot !== null && holderBoot !== myBoot;
      const holderDead = rebooted ? true : Number.isFinite(holderPid) ? !isAlive(holderPid) : null;
      const ageStale = Number.isFinite(ts) ? now() - ts > staleMs : true;
      const reclaim = holderDead === true || holderDead === null && ageStale;
      if (reclaim) {
        try {
          if (inspected !== null && readFileSync(lockPath, "utf8") !== inspected) {
            continue;
          }
          unlinkSync(lockPath);
        } catch {}
        continue;
      }
      throw new LockHeldError(holderPid, lockPath);
    }
  }
  throw new LockHeldError(Number.NaN, lockPath);
}
async function withFileLock(lockPath, fn, opts = {}) {
  const retries = opts.retries ?? 50;
  const retryDelayMs = opts.retryDelayMs ?? 40;
  let release;
  for (let attempt = 0;; attempt++) {
    try {
      release = acquireFileLock(lockPath, opts);
      break;
    } catch (err) {
      if (err instanceof LockHeldError && attempt < retries) {
        await new Promise((r3) => setTimeout(r3, retryDelayMs));
        continue;
      }
      throw err;
    }
  }
  try {
    return await fn();
  } finally {
    release();
  }
}
var LockHeldError, DEFAULT_STALE_MS = 30000;
var init_file_lock = __esm(() => {
  LockHeldError = class LockHeldError extends Error {
    holderPid;
    lockPath;
    constructor(holderPid, lockPath) {
      super(`lock held by pid=${holderPid} at ${lockPath}`);
      this.holderPid = holderPid;
      this.lockPath = lockPath;
      this.name = "LockHeldError";
    }
  };
});

// src/dispatcher/logger.ts
import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
function configuredMaxBytes() {
  const raw = process.env["SGC_EVENTS_MAX_BYTES"];
  if (!raw)
    return EVENTS_MAX_BYTES;
  const n2 = Number.parseInt(raw, 10);
  return Number.isFinite(n2) && n2 > 0 ? n2 : EVENTS_MAX_BYTES;
}
function defaultNdjsonSink(stateRoot, maxBytes) {
  const path = resolve(stateRoot, "progress/events.ndjson");
  const rotated = `${path}.1`;
  const rotateLock = `${path}.rotate.lock`;
  mkdirSync(dirname(path), { recursive: true });
  let bytes = 0;
  try {
    bytes = statSync(path).size;
  } catch {}
  const rotateIfNeeded = (lineLen) => {
    if (bytes + lineLen <= maxBytes)
      return;
    let actual;
    try {
      actual = statSync(path).size;
    } catch {
      bytes = 0;
      return;
    }
    if (actual + lineLen <= maxBytes) {
      bytes = actual;
      return;
    }
    let release = null;
    try {
      release = acquireFileLock(rotateLock);
    } catch {
      return;
    }
    try {
      const recheck = statSync(path).size;
      if (recheck + lineLen > maxBytes) {
        renameSync(path, rotated);
        bytes = 0;
      } else {
        bytes = recheck;
      }
    } catch {} finally {
      release();
    }
  };
  return (e2) => {
    try {
      const line = JSON.stringify(e2) + `
`;
      rotateIfNeeded(line.length);
      appendFileSync(path, line, "utf8");
      bytes += line.length;
    } catch (err) {
      console.error("[sgc] ndjson write failed:", String(err));
    }
  };
}
function createLogger(opts = {}) {
  const stateRoot = opts.stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc";
  const say = opts.say ?? ((m2) => console.log(m2));
  const sink = opts.eventSink ?? defaultNdjsonSink(stateRoot, opts.maxBytes ?? configuredMaxBytes());
  return {
    say,
    event(partial) {
      const record = {
        schema_version: 1,
        ts: new Date().toISOString(),
        ...partial
      };
      try {
        sink(record);
      } catch (err) {
        console.error("[sgc] event sink failed:", String(err));
      }
    }
  };
}
var EVENTS_MAX_BYTES = 1e7;
var init_logger = __esm(() => {
  init_file_lock();
});

// src/dispatcher/dedup.ts
import { createHash } from "node:crypto";
function computeSignature(problem, errorFingerprint) {
  const normalized = normalizeText(`${problem}
${errorFingerprint ?? ""}`);
  return createHash("sha256").update(normalized).digest("hex");
}
function normalizeText(text) {
  return text.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
}
function tokenize(text) {
  if (typeof text !== "string" || text.length === 0)
    return new Set;
  const normalized = text.normalize("NFC").toLowerCase();
  const tokens = new Set;
  for (const seg of SEGMENTER.segment(normalized)) {
    if (!seg.isWordLike)
      continue;
    const w2 = seg.segment;
    const isAsciiOnly = /^[\x00-\x7F]+$/.test(w2);
    const minLen = isAsciiOnly ? 3 : 2;
    if (w2.length < minLen)
      continue;
    if (STOPWORDS.has(w2))
      continue;
    tokens.add(w2);
  }
  return tokens;
}
function jaccard(a2, b2) {
  if (a2.size === 0 && b2.size === 0)
    return 1;
  let intersect = 0;
  for (const t2 of a2)
    if (b2.has(t2))
      intersect++;
  const union = a2.size + b2.size - intersect;
  if (union === 0)
    return 0;
  return intersect / union;
}
function featureOverlap(a2, b2) {
  if (a2.size === 0 && b2.size === 0)
    return 0;
  return jaccard(a2, b2);
}
function similarity(candidate, existing) {
  if (candidate.signature && candidate.signature === existing.signature)
    return 1;
  const stripSentinel = (t2) => t2.filter((x2) => x2.toLowerCase() !== "untagged");
  const candTags = stripSentinel(Array.isArray(candidate.tags) ? candidate.tags : []);
  const exTags = stripSentinel(Array.isArray(existing.tags) ? existing.tags : []);
  const candTagSet = new Set(candTags);
  const exTagSet = new Set(exTags);
  const candProb = tokenize(candidate.problem);
  const exProb = tokenize(existing.problem);
  const candProbRaw = (candidate.problem ?? "").trim();
  const exProbRaw = (existing.problem ?? "").trim();
  const problemPresent = candProbRaw.length > 0 || exProbRaw.length > 0;
  const problemHasTokens = candProb.size > 0 || exProb.size > 0;
  const components = [];
  if (candTagSet.size > 0 || exTagSet.size > 0) {
    components.push({ value: jaccard(candTagSet, exTagSet), weight: TAG_WEIGHT });
  }
  if (problemPresent) {
    const value = problemHasTokens ? jaccard(candProb, exProb) : candProbRaw.toLowerCase() === exProbRaw.toLowerCase() ? 1 : 0;
    components.push({ value, weight: PROBLEM_WEIGHT });
  }
  if (components.length === 0)
    return 0;
  const totalWeight = components.reduce((sum, c3) => sum + c3.weight, 0);
  return components.reduce((sum, c3) => sum + c3.value * c3.weight, 0) / totalWeight;
}
function findBestMatch(candidate, existing) {
  let best = null;
  for (const s2 of existing) {
    const sim = similarity(candidate, {
      signature: s2.entry.signature,
      tags: s2.entry.tags,
      problem: s2.entry.problem
    });
    if (!best || sim > best.similarity) {
      best = { match: s2, similarity: sim };
    }
  }
  return best;
}
var DEDUP_THRESHOLD = 0.85, STOPWORDS, SEGMENTER, PROBLEM_WEIGHT = 0.9, TAG_WEIGHT = 0.1;
var init_dedup = __esm(() => {
  STOPWORDS = new Set([
    "the",
    "a",
    "an",
    "is",
    "of",
    "in",
    "to",
    "for",
    "and",
    "or",
    "on",
    "with",
    "this",
    "that",
    "we",
    "as",
    "by",
    "at",
    "from",
    "be",
    "it",
    "are",
    "have",
    "was",
    "not",
    "has",
    "but",
    "they",
    "you",
    "our",
    "its",
    "can",
    "will",
    "it's"
  ]);
  SEGMENTER = new Intl.Segmenter([], { granularity: "word" });
});

// node_modules/js-yaml/dist/js-yaml.mjs
function getDefaultExportFromCjs2(x2) {
  return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
}
function requireCommon() {
  if (hasRequiredCommon)
    return common;
  hasRequiredCommon = 1;
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray2(sequence) {
    if (Array.isArray(sequence))
      return sequence;
    else if (isNothing(sequence))
      return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index = 0, length = sourceKeys.length;index < length; index += 1) {
        const key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = "";
    for (let cycle = 0;cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  common.isNothing = isNothing;
  common.isObject = isObject;
  common.toArray = toArray2;
  common.repeat = repeat;
  common.isNegativeZero = isNegativeZero;
  common.extend = extend;
  return common;
}
function requireException() {
  if (hasRequiredException)
    return exception;
  hasRequiredException = 1;
  function formatError(exception2, compact) {
    let where = "";
    const message = exception2.reason || "(unknown reason)";
    if (!exception2.mark)
      return message;
    if (exception2.mark.name) {
      where += 'in "' + exception2.mark.name + '" ';
    }
    where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
    if (!compact && exception2.mark.snippet) {
      where += `

` + exception2.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  exception = YAMLException2;
  return exception;
}
function requireSnippet() {
  if (hasRequiredSnippet)
    return snippet;
  hasRequiredSnippet = 1;
  const common2 = requireCommon();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
      pos: position - lineStart + head.length
    };
  }
  function padStart(string, max) {
    return common2.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer)
      return null;
    if (!options.maxLength)
      options.maxLength = 79;
    if (typeof options.indent !== "number")
      options.indent = 1;
    if (typeof options.linesBefore !== "number")
      options.linesBefore = 3;
    if (typeof options.linesAfter !== "number")
      options.linesAfter = 2;
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0)
      foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (let i2 = 1;i2 <= options.linesBefore; i2++) {
      if (foundLineNo - i2 < 0)
        break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo - i2], lineEnds[foundLineNo - i2], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i2]), maxLineLength);
      result = common2.repeat(" ", options.indent) + padStart((mark.line - i2 + 1).toString(), lineNoLength) + " | " + line2.str + `
` + result;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + `
`;
    result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + `^
`;
    for (let i2 = 1;i2 <= options.linesAfter; i2++) {
      if (foundLineNo + i2 >= lineEnds.length)
        break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo + i2], lineEnds[foundLineNo + i2], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i2]), maxLineLength);
      result += common2.repeat(" ", options.indent) + padStart((mark.line + i2 + 1).toString(), lineNoLength) + " | " + line2.str + `
`;
    }
    return result.replace(/\n$/, "");
  }
  snippet = makeSnippet;
  return snippet;
}
function requireType() {
  if (hasRequiredType)
    return type;
  hasRequiredType = 1;
  const YAMLException2 = requireException();
  const TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  const YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map2) {
    const result = {};
    if (map2 !== null) {
      Object.keys(map2).forEach(function(style) {
        map2[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  type = Type2;
  return type;
}
function requireSchema() {
  if (hasRequiredSchema)
    return schema;
  hasRequiredSchema = 1;
  const YAMLException2 = requireException();
  const Type2 = requireType();
  function compileList(schema2, name) {
    const result = [];
    schema2[name].forEach(function(currentType) {
      let newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    };
    function collectType(type2) {
      if (type2.multi) {
        result.multi[type2.kind].push(type2);
        result.multi["fallback"].push(type2);
      } else {
        result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
      }
    }
    for (let index = 0, length = arguments.length;index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit)
        implicit = implicit.concat(definition.implicit);
      if (definition.explicit)
        explicit = explicit.concat(definition.explicit);
    } else {
      throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type2.loadKind && type2.loadKind !== "scalar") {
        throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type2.multi) {
        throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  schema = Schema2;
  return schema;
}
function requireStr() {
  if (hasRequiredStr)
    return str;
  hasRequiredStr = 1;
  const Type2 = requireType();
  str = new Type2("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  return str;
}
function requireSeq() {
  if (hasRequiredSeq)
    return seq;
  hasRequiredSeq = 1;
  const Type2 = requireType();
  seq = new Type2("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  return seq;
}
function requireMap() {
  if (hasRequiredMap)
    return map;
  hasRequiredMap = 1;
  const Type2 = requireType();
  map = new Type2("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  return map;
}
function requireFailsafe() {
  if (hasRequiredFailsafe)
    return failsafe;
  hasRequiredFailsafe = 1;
  const Schema2 = requireSchema();
  failsafe = new Schema2({
    explicit: [
      requireStr(),
      requireSeq(),
      requireMap()
    ]
  });
  return failsafe;
}
function require_null() {
  if (hasRequired_null)
    return _null;
  hasRequired_null = 1;
  const Type2 = requireType();
  function resolveYamlNull(data) {
    if (data === null)
      return true;
    const max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  _null = new Type2("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  return _null;
}
function requireBool() {
  if (hasRequiredBool)
    return bool;
  hasRequiredBool = 1;
  const Type2 = requireType();
  function resolveYamlBoolean(data) {
    if (data === null)
      return false;
    const max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  bool = new Type2("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  return bool;
}
function requireInt() {
  if (hasRequiredInt)
    return int;
  hasRequiredInt = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  function isHexCode(c3) {
    return c3 >= 48 && c3 <= 57 || c3 >= 65 && c3 <= 70 || c3 >= 97 && c3 <= 102;
  }
  function isOctCode(c3) {
    return c3 >= 48 && c3 <= 55;
  }
  function isDecCode(c3) {
    return c3 >= 48 && c3 <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null)
      return false;
    const max = data.length;
    let index = 0;
    let hasDigits = false;
    if (!max)
      return false;
    let ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max)
        return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (;index < max; index++) {
          ch = data[index];
          if (ch !== "0" && ch !== "1")
            return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "x") {
        index++;
        for (;index < max; index++) {
          if (!isHexCode(data.charCodeAt(index)))
            return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "o") {
        index++;
        for (;index < max; index++) {
          if (!isOctCode(data.charCodeAt(index)))
            return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
    }
    for (;index < max; index++) {
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits)
      return false;
    return isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-")
        sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0")
      return 0;
    if (ch === "0") {
      if (value[1] === "b")
        return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x")
        return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o")
        return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
  }
  int = new Type2("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  return int;
}
function requireFloat() {
  if (hasRequiredFloat)
    return float;
  hasRequiredFloat = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  const YAML_FLOAT_PATTERN = new RegExp("^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  const YAML_FLOAT_SPECIAL_PATTERN = new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat(data) {
    if (data === null)
      return false;
    if (!YAML_FLOAT_PATTERN.test(data)) {
      return false;
    }
    if (isFinite(parseFloat(data, 10))) {
      return true;
    }
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common2.isNegativeZero(object)) {
      return "-0.0";
    }
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
  }
  float = new Type2("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  return float;
}
function requireJson() {
  if (hasRequiredJson)
    return json;
  hasRequiredJson = 1;
  json = requireFailsafe().extend({
    implicit: [
      require_null(),
      requireBool(),
      requireInt(),
      requireFloat()
    ]
  });
  return json;
}
function requireCore() {
  if (hasRequiredCore)
    return core;
  hasRequiredCore = 1;
  core = requireJson();
  return core;
}
function requireTimestamp() {
  if (hasRequiredTimestamp)
    return timestamp;
  hasRequiredTimestamp = 1;
  const Type2 = requireType();
  const YAML_DATE_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
  const YAML_TIMESTAMP_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
  function resolveYamlTimestamp(data) {
    if (data === null)
      return false;
    if (YAML_DATE_REGEXP.exec(data) !== null)
      return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null)
      return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null)
      match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null)
      throw new Error("Date resolve error");
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 60000;
      if (match[9] === "-")
        delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta)
      date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  timestamp = new Type2("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  return timestamp;
}
function requireMerge() {
  if (hasRequiredMerge)
    return merge;
  hasRequiredMerge = 1;
  const Type2 = requireType();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  merge = new Type2("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  return merge;
}
function requireBinary() {
  if (hasRequiredBinary)
    return binary;
  hasRequiredBinary = 1;
  const Type2 = requireType();
  const BASE64_MAP = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
  function resolveYamlBinary(data) {
    if (data === null)
      return false;
    let bitlen = 0;
    const max = data.length;
    const map2 = BASE64_MAP;
    for (let idx = 0;idx < max; idx++) {
      const code = map2.indexOf(data.charAt(idx));
      if (code > 64)
        continue;
      if (code < 0)
        return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, "");
    const max = input.length;
    const map2 = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0;idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map2.indexOf(input.charAt(idx));
    }
    const tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = "";
    let bits = 0;
    const max = object.length;
    const map2 = BASE64_MAP;
    for (let idx = 0;idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    } else if (tail === 2) {
      result += map2[bits >> 10 & 63];
      result += map2[bits >> 4 & 63];
      result += map2[bits << 2 & 63];
      result += map2[64];
    } else if (tail === 1) {
      result += map2[bits >> 2 & 63];
      result += map2[bits << 4 & 63];
      result += map2[64];
      result += map2[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  binary = new Type2("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  return binary;
}
function requireOmap() {
  if (hasRequiredOmap)
    return omap;
  hasRequiredOmap = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null)
      return true;
    const objectKeys = [];
    const object = data;
    for (let index = 0, length = object.length;index < length; index += 1) {
      const pair = object[index];
      let pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]")
        return false;
      let pairKey;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey)
            pairHasKey = true;
          else
            return false;
        }
      }
      if (!pairHasKey)
        return false;
      if (objectKeys.indexOf(pairKey) === -1)
        objectKeys.push(pairKey);
      else
        return false;
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  omap = new Type2("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  return omap;
}
function requirePairs() {
  if (hasRequiredPairs)
    return pairs;
  hasRequiredPairs = 1;
  const Type2 = requireType();
  const _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null)
      return true;
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length;index < length; index += 1) {
      const pair = object[index];
      if (_toString.call(pair) !== "[object Object]")
        return false;
      const keys = Object.keys(pair);
      if (keys.length !== 1)
        return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null)
      return [];
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length;index < length; index += 1) {
      const pair = object[index];
      const keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  pairs = new Type2("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  return pairs;
}
function requireSet() {
  if (hasRequiredSet)
    return set;
  hasRequiredSet = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null)
      return true;
    const object = data;
    for (const key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null)
          return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  set = new Type2("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  return set;
}
function require_default() {
  if (hasRequired_default)
    return _default;
  hasRequired_default = 1;
  _default = requireCore().extend({
    implicit: [
      requireTimestamp(),
      requireMerge()
    ],
    explicit: [
      requireBinary(),
      requireOmap(),
      requirePairs(),
      requireSet()
    ]
  });
  return _default;
}
function requireLoader() {
  if (hasRequiredLoader)
    return loader;
  hasRequiredLoader = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const makeSnippet = requireSnippet();
  const DEFAULT_SCHEMA2 = require_default();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CONTEXT_FLOW_IN = 1;
  const CONTEXT_FLOW_OUT = 2;
  const CONTEXT_BLOCK_IN = 3;
  const CONTEXT_BLOCK_OUT = 4;
  const CHOMPING_CLIP = 1;
  const CHOMPING_STRIP = 2;
  const CHOMPING_KEEP = 3;
  const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c3) {
    return c3 === 10 || c3 === 13;
  }
  function isWhiteSpace(c3) {
    return c3 === 9 || c3 === 32;
  }
  function isWsOrEol(c3) {
    return c3 === 9 || c3 === 32 || c3 === 10 || c3 === 13;
  }
  function isFlowIndicator(c3) {
    return c3 === 44 || c3 === 91 || c3 === 93 || c3 === 123 || c3 === 125;
  }
  function fromHexCode(c3) {
    if (c3 >= 48 && c3 <= 57) {
      return c3 - 48;
    }
    const lc = c3 | 32;
    if (lc >= 97 && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c3) {
    if (c3 === 120) {
      return 2;
    }
    if (c3 === 117) {
      return 4;
    }
    if (c3 === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c3) {
    if (c3 >= 48 && c3 <= 57) {
      return c3 - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c3) {
    switch (c3) {
      case 48:
        return "\x00";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "\t";
      case 9:
        return "\t";
      case 110:
        return `
`;
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "";
      case 95:
        return " ";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  function charFromCodepoint(c3) {
    if (c3 <= 65535) {
      return String.fromCharCode(c3);
    }
    return String.fromCharCode((c3 - 65536 >> 10) + 55296, (c3 - 65536 & 1023) + 56320);
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key] = value;
    }
  }
  const simpleEscapeCheck = new Array(256);
  const simpleEscapeMap = new Array(256);
  for (let i2 = 0;i2 < 256; i2++) {
    simpleEscapeCheck[i2] = simpleEscapeSequence(i2) ? 1 : 0;
    simpleEscapeMap[i2] = simpleEscapeSequence(i2);
  }
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
    this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.totalMergeKeys = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name)) {
        transaction[name] = {
          existed: _hasOwnProperty.call(state.anchorMap, name),
          value: state.anchorMap[name]
        };
      }
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0)
      return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index = 0, length = names.length;index < length; index += 1) {
      const name = names[index];
      if (!_hasOwnProperty.call(parent, name)) {
        parent[name] = transaction[name];
      }
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index = names.length - 1;index >= 0; index -= 1) {
      const entry = transaction[names[index]];
      if (entry.existed) {
        state.anchorMap[names[index]] = entry.value;
      } else {
        delete state.anchorMap[names[index]];
      }
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  const directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson) {
        for (let _position = 0, _length = _result.length;_position < _length; _position += 1) {
          const _character = _result.charCodeAt(_position);
          if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common2.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    const sourceKeys = Object.keys(source);
    for (let index = 0, quantity = sourceKeys.length;index < quantity; index += 1) {
      const key = sourceKeys[index];
      if (state.maxTotalMergeKeys !== -1 && ++state.totalMergeKeys > state.maxTotalMergeKeys) {
        throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
      }
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index = 0, quantity = keyNode.length;index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        for (let index = 0, quantity = valueNode.length;index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common2.repeat(`
`, count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          break;
        }
      } else if (ch === 35) {
        const preceding = state.input.charCodeAt(state.position - 1);
        if (isWsOrEol(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
        break;
      } else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (isEol(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          let hexLength = tmp;
          let hexResult = 0;
          for (;hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (isWhiteSpace(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (isWhiteSpace(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!isEol(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0) {
        throwError(state, "missing indentation for block scalar");
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common2.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += `
`;
          }
        }
        break;
      }
      if (folding) {
        if (isWhiteSpace(ch)) {
          atMoreIndented = true;
          state.result += common2.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common2.repeat(`
`, emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common2.repeat(`
`, emptyLines);
        }
      } else {
        state.result += common2.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      const following = state.input.charCodeAt(state.position + 1);
      if (!isWsOrEol(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33)
      return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    let _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38)
      return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42)
      return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type2;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth) {
      throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
    }
    state.depth += 1;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (true) {
        const ch = state.input.charCodeAt(state.position);
        const propertyState = snapshotState(state);
        if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
          break;
        }
        if (!readTagProperty(state) && !readAnchorProperty(state)) {
          break;
        }
        if (propertyStart === null) {
          propertyStart = propertyState;
        }
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          const ch = state.input.charCodeAt(state.position);
          if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(state, propertyStart, propertyStart.position - propertyStart.lineStart, flowIndent)) {
            hasContent = true;
          } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, state.result);
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (let typeIndex = 0, typeQuantity = state.implicitTypes.length;typeIndex < typeQuantity; typeIndex += 1) {
        type2 = state.implicitTypes[typeIndex];
        if (type2.resolve(state.result)) {
          state.result = type2.construct(state.result);
          state.tag = type2.tag;
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type2 = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type2 = null;
        const typeList = state.typeMap.multi[state.kind || "fallback"];
        for (let typeIndex = 0, typeQuantity = typeList.length;typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type2 = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type2) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type2.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
      }
      if (!type2.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type2.construct(state.result, state.tag);
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch))
          break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0)
        readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += `
`;
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    const state = new State(input, options);
    const nullpos = input.indexOf("\x00");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\x00";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll2(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (let index = 0, length = documents.length;index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load2(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException2("expected a single document in the stream, but found more");
  }
  loader.loadAll = loadAll2;
  loader.load = load2;
  return loader;
}
function requireDumper() {
  if (hasRequiredDumper)
    return dumper;
  hasRequiredDumper = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const DEFAULT_SCHEMA2 = require_default();
  const _toString = Object.prototype.toString;
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CHAR_BOM = 65279;
  const CHAR_TAB = 9;
  const CHAR_LINE_FEED = 10;
  const CHAR_CARRIAGE_RETURN = 13;
  const CHAR_SPACE = 32;
  const CHAR_EXCLAMATION = 33;
  const CHAR_DOUBLE_QUOTE = 34;
  const CHAR_SHARP = 35;
  const CHAR_PERCENT = 37;
  const CHAR_AMPERSAND = 38;
  const CHAR_SINGLE_QUOTE = 39;
  const CHAR_ASTERISK = 42;
  const CHAR_COMMA = 44;
  const CHAR_MINUS = 45;
  const CHAR_COLON = 58;
  const CHAR_EQUALS = 61;
  const CHAR_GREATER_THAN = 62;
  const CHAR_QUESTION = 63;
  const CHAR_COMMERCIAL_AT = 64;
  const CHAR_LEFT_SQUARE_BRACKET = 91;
  const CHAR_RIGHT_SQUARE_BRACKET = 93;
  const CHAR_GRAVE_ACCENT = 96;
  const CHAR_LEFT_CURLY_BRACKET = 123;
  const CHAR_VERTICAL_LINE = 124;
  const CHAR_RIGHT_CURLY_BRACKET = 125;
  const ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = "\\\"";
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  const DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema2, map2) {
    if (map2 === null)
      return {};
    const result = {};
    const keys = Object.keys(map2);
    for (let index = 0, length = keys.length;index < length; index += 1) {
      let tag = keys[index];
      let style = String(map2[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      const type2 = schema2.compiledTypeMap["fallback"][tag];
      if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
        style = type2.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common2.repeat("0", length - string.length) + string;
  }
  const QUOTING_TYPE_SINGLE = 1;
  const QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common2.repeat(" ", spaces);
    let position = 0;
    let result = "";
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf(`
`, position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== `
`)
        result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return `
` + common2.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    for (let index = 0, length = state.implicitTypes.length;index < length; index += 1) {
      const type2 = state.implicitTypes[index];
      if (type2.resolve(str2)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c3) {
    return c3 === CHAR_SPACE || c3 === CHAR_TAB;
  }
  function isPrintable(c3) {
    return c3 >= 32 && c3 <= 126 || c3 >= 161 && c3 <= 55295 && c3 !== 8232 && c3 !== 8233 || c3 >= 57344 && c3 <= 65533 && c3 !== CHAR_BOM || c3 >= 65536 && c3 <= 1114111;
  }
  function isNsCharOrWhitespace(c3) {
    return isPrintable(c3) && c3 !== CHAR_BOM && c3 !== CHAR_CARRIAGE_RETURN && c3 !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c3, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c3);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c3);
    return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c3 !== CHAR_COMMA && c3 !== CHAR_LEFT_SQUARE_BRACKET && c3 !== CHAR_RIGHT_SQUARE_BRACKET && c3 !== CHAR_LEFT_CURLY_BRACKET && c3 !== CHAR_RIGHT_CURLY_BRACKET) && c3 !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c3 === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
  }
  function isPlainSafeFirst(c3) {
    return isPrintable(c3) && c3 !== CHAR_BOM && !isWhitespace(c3) && c3 !== CHAR_MINUS && c3 !== CHAR_QUESTION && c3 !== CHAR_COLON && c3 !== CHAR_COMMA && c3 !== CHAR_LEFT_SQUARE_BRACKET && c3 !== CHAR_RIGHT_SQUARE_BRACKET && c3 !== CHAR_LEFT_CURLY_BRACKET && c3 !== CHAR_RIGHT_CURLY_BRACKET && c3 !== CHAR_SHARP && c3 !== CHAR_AMPERSAND && c3 !== CHAR_ASTERISK && c3 !== CHAR_EXCLAMATION && c3 !== CHAR_VERTICAL_LINE && c3 !== CHAR_EQUALS && c3 !== CHAR_GREATER_THAN && c3 !== CHAR_SINGLE_QUOTE && c3 !== CHAR_DOUBLE_QUOTE && c3 !== CHAR_PERCENT && c3 !== CHAR_COMMERCIAL_AT && c3 !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c3) {
    return !isWhitespace(c3) && c3 !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first;
  }
  function needIndentIndicator(string) {
    const leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  const STYLE_PLAIN = 1;
  const STYLE_SINGLE = 2;
  const STYLE_LITERAL = 3;
  const STYLE_FOLDED = 4;
  const STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    let i2;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
        char = codePointAt(string, i2);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
        char = codePointAt(string, i2);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i2;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new YAMLException2("impossible error: invalid scalar style");
      }
    }();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    const clip = string[string.length - 1] === `
`;
    const keep = clip && (string[string.length - 2] === `
` || string === `
`);
    const chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + `
`;
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === `
` ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = function() {
      let nextLF = string.indexOf(`
`);
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    }();
    let prevMoreIndented = string[0] === `
` || string[0] === " ";
    let moreIndented;
    let match;
    while (match = lineRe.exec(string)) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? `
` : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ")
      return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += `
` + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += `
`;
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + `
` + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    let result = "";
    let char = 0;
    for (let i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i2];
        if (char >= 65536)
          result += string[i2 + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length;index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "")
          _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length;index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index = 0, length = objectKeyList.length;index < length; index += 1) {
      let pairBuffer = "";
      if (_result !== "")
        pairBuffer += ", ";
      if (state.condenseFlow)
        pairBuffer += '"';
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024)
        pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException2("sortKeys must be a boolean or a function");
    }
    for (let index = 0, length = objectKeyList.length;index < length; index += 1) {
      let pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index = 0, length = typeList.length;index < length; index += 1) {
      const type2 = typeList[index];
      if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
        if (explicit) {
          if (type2.multi && type2.representName) {
            state.tag = type2.representName(object);
          } else {
            state.tag = type2.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type2.represent) {
          const style = state.styleMap[type2.tag] || type2.defaultStyle;
          let _result;
          if (_toString.call(type2.represent) === "[object Function]") {
            _result = type2.represent(object, style);
          } else if (_hasOwnProperty.call(type2.represent, style)) {
            _result = type2.represent[style](object, style);
          } else {
            throw new YAMLException2("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    const type2 = _toString.call(state.dump);
    const inblock = block;
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type2 === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object Array]") {
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type2 === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid)
          return false;
        throw new YAMLException2("unacceptable kind of an object to dump " + type2);
      }
      if (state.tag !== null && state.tag !== "?") {
        let tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index = 0;index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    if (object !== null && typeof object === "object") {
      const index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (let i2 = 0, length = object.length;i2 < length; i2 += 1) {
            inspectNode(object[i2], objects, duplicatesIndexes);
          }
        } else {
          const objectKeyList = Object.keys(object);
          for (let i2 = 0, length = objectKeyList.length;i2 < length; i2 += 1) {
            inspectNode(object[objectKeyList[i2]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump2(input, options) {
    options = options || {};
    const state = new State(options);
    if (!state.noRefs)
      getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true))
      return state.dump + `
`;
    return "";
  }
  dumper.dump = dump2;
  return dumper;
}
function requireJsYaml() {
  if (hasRequiredJsYaml)
    return jsYaml;
  hasRequiredJsYaml = 1;
  const loader2 = requireLoader();
  const dumper2 = requireDumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  jsYaml.Type = requireType();
  jsYaml.Schema = requireSchema();
  jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
  jsYaml.JSON_SCHEMA = requireJson();
  jsYaml.CORE_SCHEMA = requireCore();
  jsYaml.DEFAULT_SCHEMA = require_default();
  jsYaml.load = loader2.load;
  jsYaml.loadAll = loader2.loadAll;
  jsYaml.dump = dumper2.dump;
  jsYaml.YAMLException = requireException();
  jsYaml.types = {
    binary: requireBinary(),
    float: requireFloat(),
    map: requireMap(),
    null: require_null(),
    pairs: requirePairs(),
    set: requireSet(),
    timestamp: requireTimestamp(),
    bool: requireBool(),
    int: requireInt(),
    merge: requireMerge(),
    omap: requireOmap(),
    seq: requireSeq(),
    str: requireStr()
  };
  jsYaml.safeLoad = renamed("safeLoad", "load");
  jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
  jsYaml.safeDump = renamed("safeDump", "dump");
  return jsYaml;
}
var jsYaml, loader, common, hasRequiredCommon, exception, hasRequiredException, snippet, hasRequiredSnippet, type, hasRequiredType, schema, hasRequiredSchema, str, hasRequiredStr, seq, hasRequiredSeq, map, hasRequiredMap, failsafe, hasRequiredFailsafe, _null, hasRequired_null, bool, hasRequiredBool, int, hasRequiredInt, float, hasRequiredFloat, json, hasRequiredJson, core, hasRequiredCore, timestamp, hasRequiredTimestamp, merge, hasRequiredMerge, binary, hasRequiredBinary, omap, hasRequiredOmap, pairs, hasRequiredPairs, set, hasRequiredSet, _default, hasRequired_default, hasRequiredLoader, dumper, hasRequiredDumper, hasRequiredJsYaml, jsYamlExports, yaml, Type, Schema, FAILSAFE_SCHEMA, JSON_SCHEMA, CORE_SCHEMA, DEFAULT_SCHEMA, load, loadAll, dump, YAMLException, types, safeLoad, safeLoadAll, safeDump;
var init_js_yaml = __esm(() => {
  jsYaml = {};
  loader = {};
  common = {};
  dumper = {};
  jsYamlExports = requireJsYaml();
  yaml = /* @__PURE__ */ getDefaultExportFromCjs2(jsYamlExports);
  ({
    Type,
    Schema,
    FAILSAFE_SCHEMA,
    JSON_SCHEMA,
    CORE_SCHEMA,
    DEFAULT_SCHEMA,
    load,
    loadAll,
    dump,
    YAMLException,
    types,
    safeLoad,
    safeLoadAll,
    safeDump
  } = yaml);
});

// src/dispatcher/state/atomic.ts
import {
  existsSync,
  mkdirSync as mkdirSync2,
  readFileSync as readFileSync2,
  renameSync as renameSync2,
  unlinkSync as unlinkSync2,
  writeFileSync as writeFileSync2
} from "node:fs";
import { randomBytes as randomBytes2 } from "node:crypto";
import { dirname as dirname2, resolve as resolve2 } from "node:path";
function resolveStateRoot(custom) {
  return resolve2(custom ?? process.env["SGC_STATE_ROOT"] ?? DEFAULT_STATE_DIR);
}
function ensureDefaultStateGitignored(custom) {
  if (custom !== undefined || process.env["SGC_STATE_ROOT"])
    return;
  if (!existsSync(resolve2(".git")))
    return;
  const giPath = resolve2(".gitignore");
  let content = "";
  try {
    content = readFileSync2(giPath, "utf8");
  } catch {}
  const alreadyIgnored = content.split(/\r?\n/).map((l2) => l2.trim()).some((l2) => l2 === ".sgc" || l2 === ".sgc/" || l2 === "/.sgc" || l2 === "/.sgc/");
  if (alreadyIgnored)
    return;
  const lead = content.length === 0 ? "" : content.endsWith(`
`) ? `
` : `

`;
  const block = `${lead}# sgc runtime state (not source) — safe to delete; recreated on next run
.sgc/
`;
  try {
    writeFileSync2(giPath, content + block);
  } catch {}
}
function ensureSgcStructure(stateRoot) {
  const r3 = root(stateRoot);
  for (const layer of LAYERS) {
    mkdirSync2(resolve2(r3, layer), { recursive: true });
  }
  ensureDefaultStateGitignored(stateRoot);
  return r3;
}
function parseFrontmatter(text, source) {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    const where = source ? `${source}: ` : "";
    const hint = source ? " — corrupt or partially written; .sgc/ is regenerable runtime state (delete it and re-run, or restore this file)" : "";
    throw new StateError("NoFrontmatter", `${where}file missing YAML frontmatter${hint}`);
  }
  const data = load(match[1]) ?? {};
  const body = (match[2] ?? "").replace(/^\n+/, "");
  return { data, body };
}
function serializeFrontmatter(data, body = "") {
  const yaml2 = dump(data, { lineWidth: -1, sortKeys: false }).trimEnd();
  const trimmedBody = body.replace(/^\n+/, "");
  return `---
${yaml2}
---

${trimmedBody}`;
}
function writeAtomic(path, content) {
  mkdirSync2(dirname2(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}.${atomicWriteSeq++}.${randomBytes2(4).toString("hex")}`;
  writeFileSync2(tmp, content, "utf8");
  try {
    renameSync2(tmp, path);
  } catch (err) {
    try {
      unlinkSync2(tmp);
    } catch {}
    throw err;
  }
}
function wordCount(text) {
  let n2 = 0;
  for (const seg of WORD_SEGMENTER.segment(text)) {
    if (seg.isWordLike)
      n2++;
  }
  return n2;
}
var StateError, DEFAULT_STATE_DIR = ".sgc", root, LAYERS, FRONTMATTER_RE, atomicWriteSeq = 0, WORD_SEGMENTER;
var init_atomic = __esm(() => {
  init_js_yaml();
  StateError = class StateError extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "StateError";
    }
  };
  root = resolveStateRoot;
  LAYERS = ["decisions", "progress", "solutions", "reviews"];
  FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  WORD_SEGMENTER = new Intl.Segmenter([], { granularity: "word" });
});

// src/dispatcher/types.ts
function isHeuristicMode(mode) {
  return mode === "inline";
}
var LEVELS, PLAN_VERDICTS;
var init_types = __esm(() => {
  LEVELS = ["L0", "L1", "L2", "L3"];
  PLAN_VERDICTS = ["approve", "revise", "reject"];
});

// src/dispatcher/state/decisions.ts
import { existsSync as existsSync2, readFileSync as readFileSync3 } from "node:fs";
import { resolve as resolve3 } from "node:path";
function validateIntent(intent) {
  for (const f3 of REQUIRED_INTENT_FIELDS) {
    const v2 = intent[f3];
    if (v2 === undefined || v2 === null) {
      throw new StateError("SchemaViolation", `intent missing required field: ${f3}`);
    }
  }
  if (!Array.isArray(intent.affected_readers) || intent.affected_readers.length < 1) {
    throw new StateError("SchemaViolation", "affected_readers must be a non-empty array (required even at L1)");
  }
  if (!LEVELS.includes(intent.level)) {
    throw new StateError("SchemaViolation", `level must be one of L0|L1|L2|L3 (got '${intent.level}')`);
  }
  const mwords = wordCount(intent.motivation);
  if (mwords < 20) {
    throw new StateError("SchemaViolation", `motivation must be ≥20 words (got ${mwords}); pass --motivation "<longer rationale>"`);
  }
  if (intent.level === "L3" && !intent.user_signature) {
    throw new StateError("SchemaViolation", "L3 intent requires user_signature (Invariant §4)");
  }
  if (intent.fused_verdict !== undefined && !PLAN_VERDICTS.includes(intent.fused_verdict)) {
    throw new StateError("SchemaViolation", `fused_verdict must be one of approve|revise|reject (got '${intent.fused_verdict}')`);
  }
}
function intentPath(taskId, stateRoot) {
  return resolve3(resolveStateRoot(stateRoot), "decisions", taskId, "intent.md");
}
function writeIntent(intent, stateRoot) {
  const path = intentPath(intent.task_id, stateRoot);
  if (existsSync2(path)) {
    throw new StateError("IntentImmutable", `intent.md exists for ${intent.task_id} — Invariant §2 (immutable)`);
  }
  validateIntent(intent);
  const { body, ...frontmatter } = intent;
  writeAtomic(path, serializeFrontmatter(frontmatter, body ?? ""));
  return path;
}
function readIntent(taskId, stateRoot) {
  const path = intentPath(taskId, stateRoot);
  if (!existsSync2(path)) {
    throw new StateError("NotFound", `intent.md not found for ${taskId}`);
  }
  const { data, body } = parseFrontmatter(readFileSync3(path, "utf8"), path);
  return { ...data, body };
}
function validateShip(ship) {
  for (const f3 of REQUIRED_SHIP_FIELDS) {
    const v2 = ship[f3];
    if (v2 === undefined || v2 === null) {
      throw new StateError("SchemaViolation", `ship missing required field: ${f3}`);
    }
  }
  if (ship.outcome === "reverted" && !ship.rollback_ref) {
    throw new StateError("SchemaViolation", "ship outcome=reverted requires rollback_ref");
  }
}
function shipPath(taskId, stateRoot) {
  return resolve3(resolveStateRoot(stateRoot), "decisions", taskId, "ship.md");
}
function writeShip(ship, body = "", stateRoot) {
  const path = shipPath(ship.task_id, stateRoot);
  if (existsSync2(path)) {
    throw new StateError("ShipImmutable", `ship.md exists for ${ship.task_id}`);
  }
  validateShip(ship);
  writeAtomic(path, serializeFrontmatter(ship, body));
  return path;
}
function readShip(taskId, stateRoot) {
  const path = shipPath(taskId, stateRoot);
  if (!existsSync2(path)) {
    throw new StateError("NotFound", `ship.md not found for ${taskId}`);
  }
  const { data, body } = parseFrontmatter(readFileSync3(path, "utf8"), path);
  return { ship: data, body };
}
var REQUIRED_INTENT_FIELDS, REQUIRED_SHIP_FIELDS;
var init_decisions = __esm(() => {
  init_types();
  init_atomic();
  REQUIRED_INTENT_FIELDS = [
    "task_id",
    "level",
    "created_at",
    "title",
    "motivation",
    "affected_readers",
    "scope_tokens"
  ];
  REQUIRED_SHIP_FIELDS = [
    "task_id",
    "shipped_at",
    "outcome",
    "deviations",
    "residuals",
    "linked_reviews"
  ];
});

// src/dispatcher/state/progress.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync4 } from "node:fs";
import { join, resolve as resolve4 } from "node:path";
function progressPath(file, stateRoot) {
  return resolve4(resolveStateRoot(stateRoot), "progress", `${file}.md`);
}
function validateCurrentTask(task) {
  for (const f3 of REQUIRED_CURRENT_TASK_FIELDS) {
    const v2 = task[f3];
    if (v2 === undefined || v2 === null) {
      throw new StateError("SchemaViolation", `current-task missing required field: ${f3}`);
    }
  }
}
function writeCurrentTask(task, body = "", stateRoot) {
  validateCurrentTask(task);
  const path = progressPath("current-task", stateRoot);
  writeAtomic(path, serializeFrontmatter(task, body));
  return path;
}
function readCurrentTask(stateRoot) {
  const path = progressPath("current-task", stateRoot);
  if (!existsSync3(path))
    return null;
  const { data, body } = parseFrontmatter(readFileSync4(path, "utf8"), path);
  return { task: data, body };
}
function validateFeatureList(list) {
  if (!Array.isArray(list?.features)) {
    throw new StateError("SchemaViolation", "feature-list missing required field: features (array)");
  }
  for (let i2 = 0;i2 < list.features.length; i2++) {
    const ft = list.features[i2];
    if (ft === null || typeof ft !== "object") {
      throw new StateError("SchemaViolation", `feature-list.features[${i2}] is not an object`);
    }
    for (const f3 of REQUIRED_FEATURE_FIELDS) {
      if (ft[f3] === undefined || ft[f3] === null) {
        throw new StateError("SchemaViolation", `feature-list.features[${i2}] missing required field: ${f3}`);
      }
    }
  }
}
function writeFeatureList(list, body = "", stateRoot) {
  validateFeatureList(list);
  const path = progressPath("feature-list", stateRoot);
  writeAtomic(path, serializeFrontmatter(list, body));
  return path;
}
function writePlanDoc(slug, dateIso, content, base) {
  const dir = join(base ?? process.cwd(), "docs", "superpowers", "plans");
  mkdirSync3(dir, { recursive: true });
  const path = join(dir, `${dateIso}-${slug}.md`);
  writeAtomic(path, content);
  return path;
}
function readFeatureList(stateRoot) {
  const path = progressPath("feature-list", stateRoot);
  if (!existsSync3(path))
    return null;
  const { data, body } = parseFrontmatter(readFileSync4(path, "utf8"), path);
  return { list: data, body };
}
function validateHandoff(handoff) {
  for (const f3 of REQUIRED_HANDOFF_FIELDS) {
    const v2 = handoff[f3];
    if (v2 === undefined || v2 === null) {
      throw new StateError("SchemaViolation", `handoff missing required field: ${f3}`);
    }
  }
  if (!Array.isArray(handoff?.open_questions)) {
    throw new StateError("SchemaViolation", "handoff.open_questions must be an array");
  }
}
function writeHandoff(handoff, body = "", stateRoot) {
  validateHandoff(handoff);
  const path = progressPath("handoff", stateRoot);
  writeAtomic(path, serializeFrontmatter(handoff, body));
  return path;
}
function readHandoff(stateRoot) {
  const path = progressPath("handoff", stateRoot);
  if (!existsSync3(path))
    return null;
  const { data, body } = parseFrontmatter(readFileSync4(path, "utf8"), path);
  return { handoff: data, body };
}
var REQUIRED_CURRENT_TASK_FIELDS, REQUIRED_FEATURE_FIELDS, REQUIRED_HANDOFF_FIELDS;
var init_progress = __esm(() => {
  init_atomic();
  REQUIRED_CURRENT_TASK_FIELDS = [
    "task_id",
    "level",
    "session_start",
    "last_activity"
  ];
  REQUIRED_FEATURE_FIELDS = ["id", "title", "status"];
  REQUIRED_HANDOFF_FIELDS = [
    "from_session",
    "to_session_hint",
    "summary"
  ];
});

// src/dispatcher/state/reviews.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync4, readFileSync as readFileSync5, readdirSync } from "node:fs";
import { resolve as resolve5 } from "node:path";
function redGreenSlug(title, taskId) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "feature";
  return `${base}-${taskId.slice(0, 8).toLowerCase()}`;
}
function writeRedGreenCapture(fm, stateRoot) {
  const dir = resolve5(resolveStateRoot(stateRoot), "red-green");
  mkdirSync4(dir, { recursive: true });
  const baseSlug = redGreenSlug(fm.title, fm.task_id);
  let slug = baseSlug;
  let n2 = 1;
  while (existsSync4(resolve5(dir, `${slug}.md`))) {
    n2 += 1;
    slug = `${baseSlug}-${n2}`;
    if (n2 > 50)
      throw new Error(`red-green slug collision overflow for ${fm.task_id}`);
  }
  const data = {
    kind: "red-green",
    captured_at: new Date().toISOString(),
    task_id: fm.task_id,
    feature_id: fm.feature_id,
    level: fm.level,
    prior_red: fm.prior_red,
    red_output: fm.red_output,
    verify_command: fm.verify_command,
    ...fm.evidence ? { evidence: fm.evidence } : {},
    prevention_seed: RED_GREEN_PLACEHOLDER
  };
  const body = `## RED→GREEN

- prior RED: ${fm.prior_red}
- observed: ${fm.red_output}
` + `- verified by: ${fm.verify_command}

Fill \`prevention_seed:\` with the ` + `reusable safeguard, then run \`sgc compound --from-red-green ${slug}\`.
`;
  writeAtomic(resolve5(dir, `${slug}.md`), serializeFrontmatter(data, body));
  return slug;
}
function validateReview(report) {
  for (const f3 of REQUIRED_REVIEW_FIELDS) {
    const v2 = report[f3];
    if (v2 === undefined || v2 === null) {
      throw new StateError("SchemaViolation", `review missing required field: ${f3}`);
    }
  }
  if (report.override) {
    const r3 = report.override.reason ?? "";
    if (r3.length < 40) {
      throw new StateError("SchemaViolation", `review override.reason must be ≥40 chars (Invariant §5); got ${r3.length}`);
    }
    if ((report.override.by ?? "").trim().length === 0) {
      throw new StateError("SchemaViolation", "review override.by (the signer) must be a non-empty name (Invariant §5)");
    }
  }
}
function reviewPath(taskId, stage, reviewerId, stateRoot, suffix) {
  const base = suffix ? `${reviewerId}.${suffix}.md` : `${reviewerId}.md`;
  return resolve5(resolveStateRoot(stateRoot), "reviews", taskId, stage, base);
}
function appendReview(report, body = "", stateRoot, suffix) {
  if (suffix !== undefined && !REVIEW_SUFFIX_RE.test(suffix)) {
    throw new StateError("SchemaViolation", `invalid review suffix ${JSON.stringify(suffix)} — must match ${REVIEW_SUFFIX_RE.source}`);
  }
  const path = reviewPath(report.task_id, report.stage, report.reviewer_id, stateRoot, suffix);
  if (existsSync4(path)) {
    const ref = suffix ? `${report.reviewer_id}.${suffix}` : report.reviewer_id;
    throw new StateError("AppendOnly", `review ${ref} already exists for ${report.task_id}/${report.stage} — append-only per Invariant §6`);
  }
  validateReview(report);
  writeAtomic(path, serializeFrontmatter(report, body));
  return path;
}
function readReview(taskId, stage, reviewerId, stateRoot) {
  const path = reviewPath(taskId, stage, reviewerId, stateRoot);
  if (!existsSync4(path))
    return null;
  const { data, body } = parseFrontmatter(readFileSync5(path, "utf8"));
  return { report: data, body };
}
function hasQaEvidence(taskId, stateRoot) {
  const qaDir = resolve5(resolveStateRoot(stateRoot), "reviews", taskId, "qa");
  if (!existsSync4(qaDir))
    return false;
  try {
    return readdirSync(qaDir).some((f3) => f3.endsWith(".md"));
  } catch {
    return false;
  }
}
function validateJanitorDecision(d2) {
  for (const f3 of REQUIRED_JANITOR_FIELDS) {
    const v2 = d2[f3];
    if (v2 === undefined || v2 === null || typeof v2 === "string" && v2.length === 0) {
      throw new StateError("SchemaViolation", `janitor decision missing: ${f3}`);
    }
  }
}
function janitorDecisionPath(taskId, stateRoot) {
  return resolve5(resolveStateRoot(stateRoot), "reviews", taskId, "janitor", "compound-decision.md");
}
function writeJanitorDecision(decision, body = "", stateRoot) {
  const path = janitorDecisionPath(decision.task_id, stateRoot);
  if (existsSync4(path)) {
    throw new StateError("AppendOnly", `janitor decision already written for ${decision.task_id} (Invariant §6)`);
  }
  validateJanitorDecision(decision);
  writeAtomic(path, serializeFrontmatter(decision, body));
  return path;
}
function readJanitorDecision(taskId, stateRoot) {
  const path = janitorDecisionPath(taskId, stateRoot);
  if (!existsSync4(path))
    return null;
  const { data } = parseFrontmatter(readFileSync5(path, "utf8"));
  return data;
}
function listReviewsForStage(taskId, stage, stateRoot) {
  const dir = resolve5(resolveStateRoot(stateRoot), "reviews", taskId, stage);
  if (!existsSync4(dir))
    return [];
  let files;
  try {
    files = readdirSync(dir).filter((f3) => f3.endsWith(".md"));
  } catch {
    return [];
  }
  const reports = [];
  for (const f3 of files) {
    try {
      const text = readFileSync5(resolve5(dir, f3), "utf8");
      const { data } = parseFrontmatter(text);
      reports.push(data);
    } catch {}
  }
  return reports;
}
var RED_GREEN_PLACEHOLDER = "TODO: operator-fill the reusable prevention", REQUIRED_REVIEW_FIELDS, REVIEW_SUFFIX_RE, REQUIRED_JANITOR_FIELDS;
var init_reviews = __esm(() => {
  init_atomic();
  REQUIRED_REVIEW_FIELDS = [
    "report_id",
    "task_id",
    "stage",
    "reviewer_id",
    "reviewer_version",
    "verdict",
    "severity",
    "findings",
    "created_at"
  ];
  REVIEW_SUFFIX_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,30}$/;
  REQUIRED_JANITOR_FIELDS = [
    "task_id",
    "decision",
    "reason_code",
    "reason_human",
    "inputs_hash",
    "created_at"
  ];
});

// src/dispatcher/spawn-protocol.ts
import { existsSync as existsSync5, readdirSync as readdirSync2 } from "node:fs";
import { resolve as resolve6 } from "node:path";
function parseSpawnId(spawnId) {
  const dashIdx = spawnId.indexOf("-");
  if (dashIdx === -1) {
    throw new Error(`invalid spawn_id: no dash in ${spawnId}`);
  }
  return {
    ulid: spawnId.slice(0, dashIdx),
    agentName: spawnId.slice(dashIdx + 1)
  };
}
function promptPath(spawnId, stateRoot) {
  return resolve6(stateRoot, "progress/agent-prompts", `${spawnId}.md`);
}
function resultPath(spawnId, stateRoot) {
  return resolve6(stateRoot, "progress/agent-results", `${spawnId}.md`);
}
function listAllSpawns(stateRoot) {
  const promptsDir = resolve6(stateRoot, "progress/agent-prompts");
  if (!existsSync5(promptsDir))
    return [];
  return readdirSync2(promptsDir).filter((f3) => f3.endsWith(".md")).sort().map((f3) => {
    const spawnId = f3.slice(0, -3);
    const { agentName } = parseSpawnId(spawnId);
    const pp = promptPath(spawnId, stateRoot);
    const rp = resultPath(spawnId, stateRoot);
    return {
      spawnId,
      agentName,
      promptPath: pp,
      resultPath: rp,
      hasResult: existsSync5(rp)
    };
  });
}
function listPendingSpawns(stateRoot) {
  return listAllSpawns(stateRoot).filter((s2) => !s2.hasResult);
}
var init_spawn_protocol = () => {};

// src/dispatcher/fingerprint.ts
import { existsSync as existsSync6, readdirSync as readdirSync3, readFileSync as readFileSync6, statSync as statSync2 } from "node:fs";
import { join as join2, resolve as resolve7 } from "node:path";
import { createHash as createHash2 } from "node:crypto";
function isFingerprintable(line) {
  const trimmed = line.trim();
  if (trimmed.length < MIN_LINE_LEN)
    return false;
  const c3 = trimmed[0];
  if (c3 === "#" || c3 === "-" || c3 === "*" || c3 === ">" || c3 === "|" || c3 === "`")
    return false;
  if (trimmed === "---" || trimmed === "...")
    return false;
  return true;
}
function hashLine(line) {
  const norm = line.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash2("sha256").update(norm).digest("hex").slice(0, HASH_LEN);
}
function safeReaddir(dir) {
  try {
    return readdirSync3(dir);
  } catch {
    return [];
  }
}
function isDir(path) {
  try {
    return statSync2(path).isDirectory();
  } catch {
    return false;
  }
}
function safeReadFile(path) {
  try {
    return readFileSync6(path, "utf8");
  } catch {
    return null;
  }
}
function loadSolutionsFingerprints(stateRoot) {
  const dir = resolve7(stateRoot, "solutions");
  const set2 = new Set;
  if (!existsSync6(dir))
    return set2;
  for (const cat of safeReaddir(dir)) {
    const catPath = join2(dir, cat);
    if (!isDir(catPath))
      continue;
    for (const file of safeReaddir(catPath)) {
      if (!file.endsWith(".md"))
        continue;
      const text = safeReadFile(join2(catPath, file));
      if (!text)
        continue;
      for (const line of text.split(`
`)) {
        if (!isFingerprintable(line))
          continue;
        set2.add(hashLine(line));
      }
    }
  }
  return set2;
}
function getFingerprintsCached(stateRoot) {
  const key = resolve7(stateRoot);
  let v2 = fpCache.get(key);
  if (!v2) {
    v2 = loadSolutionsFingerprints(key);
    fpCache.set(key, v2);
  }
  return v2;
}
function clearFingerprintCache() {
  fpCache.clear();
}
function isReviewerOrQaAgent(name) {
  return name.startsWith("reviewer.") || name.startsWith("qa.");
}
function scanOutputForLeak(agentName, output, fingerprints) {
  if (!isReviewerOrQaAgent(agentName) || fingerprints.size === 0) {
    return { hit: false, samples: [], count: 0 };
  }
  const samples = [];
  let count = 0;
  const seen = new Set;
  function walk(v2) {
    if (typeof v2 === "string") {
      for (const line of v2.split(`
`)) {
        if (!isFingerprintable(line))
          continue;
        const h2 = hashLine(line);
        if (fingerprints.has(h2) && !seen.has(h2)) {
          seen.add(h2);
          count++;
          if (samples.length < 3) {
            const trimmed = line.trim();
            samples.push(trimmed.length > 100 ? trimmed.slice(0, 97) + "..." : trimmed);
          }
        }
      }
    } else if (Array.isArray(v2)) {
      for (const item of v2)
        walk(item);
    } else if (v2 && typeof v2 === "object") {
      for (const val of Object.values(v2))
        walk(val);
    }
  }
  walk(output);
  return { hit: count > 0, samples, count };
}
var MIN_LINE_LEN = 25, HASH_LEN = 16, fpCache;
var init_fingerprint = __esm(() => {
  fpCache = new Map;
});

// src/dispatcher/state/solutions.ts
import { existsSync as existsSync7, mkdirSync as mkdirSync5, readFileSync as readFileSync7, readdirSync as readdirSync4 } from "node:fs";
import { dirname as dirname3, resolve as resolve8 } from "node:path";
function validateSolution(entry) {
  for (const f3 of REQUIRED_SOLUTION_FIELDS) {
    const v2 = entry[f3];
    if (v2 === undefined || v2 === null) {
      throw new StateError("SchemaViolation", `solution missing required field: ${f3}`);
    }
  }
  if (!SOLUTION_CATEGORIES.has(entry.category)) {
    throw new StateError("SchemaViolation", `solution.category '${entry.category}' not in {${Array.from(SOLUTION_CATEGORIES).join(", ")}}`);
  }
  if (!Array.isArray(entry.tags) || entry.tags.length < 1) {
    throw new StateError("SchemaViolation", "solution.tags must be a non-empty array");
  }
  if (!Array.isArray(entry.symptoms) || entry.symptoms.length < 1) {
    throw new StateError("SchemaViolation", "solution.symptoms must be a non-empty array");
  }
  if (!Array.isArray(entry.source_task_ids) || entry.source_task_ids.length < 1) {
    throw new StateError("SchemaViolation", "solution.source_task_ids must be a non-empty array");
  }
}
function solutionPath(category, slug, stateRoot) {
  return resolve8(resolveStateRoot(stateRoot), "solutions", category, `${slug}.md`);
}
function validateDedupStamp(stamp, stateRoot) {
  if (!stamp || typeof stamp !== "object") {
    throw new StateError("DedupStampMissing", "writeSolution requires a dedup_stamp (Invariant §3). " + "Callers must route through runCompound or construct a stamp from " + "an explicit compound.related spawn.");
  }
  if (typeof stamp.compound_related_spawn_id !== "string" || stamp.compound_related_spawn_id.length === 0) {
    throw new StateError("DedupStampMissing", "dedup_stamp.compound_related_spawn_id is required and must reference an on-disk spawn");
  }
  if (stamp.threshold_met_or_forced !== true) {
    throw new StateError("DedupStampMissing", `dedup_stamp.threshold_met_or_forced is false — compound.related denied the write (Invariant §3)`);
  }
  const allowedReasons = [
    "new_entry",
    "update_existing_dedup",
    "user_forced"
  ];
  if (!allowedReasons.includes(stamp.reason)) {
    throw new StateError("DedupStampMissing", `dedup_stamp.reason must be one of ${allowedReasons.join(", ")}`);
  }
  let agentName;
  try {
    agentName = parseSpawnId(stamp.compound_related_spawn_id).agentName;
  } catch {
    throw new StateError("DedupStampMissing", `dedup_stamp.compound_related_spawn_id "${stamp.compound_related_spawn_id}" is not a spawn id ` + `(expected "<ulid>-compound.related")`);
  }
  if (agentName !== "compound.related") {
    throw new StateError("DedupStampMissing", `dedup_stamp.compound_related_spawn_id must name a compound.related spawn, got "${agentName}" ` + `(Invariant §3: only compound.related's deterministic verdict authorizes a solutions write)`);
  }
  const evidence = resultPath(stamp.compound_related_spawn_id, resolveStateRoot(stateRoot));
  if (!existsSync7(evidence)) {
    throw new StateError("DedupStampMissing", `dedup_stamp cites compound.related spawn "${stamp.compound_related_spawn_id}" but no result ` + `exists at ${evidence} — the dedup verdict must be earned by running the agent (Invariant §3)`);
  }
}
function writeSolution(entry, slug, dedupStamp, body = "", stateRoot) {
  validateDedupStamp(dedupStamp, stateRoot);
  validateSolution(entry);
  const path = solutionPath(entry.category, slug, stateRoot);
  let finalEntry = entry;
  let finalBody = body;
  if (existsSync7(path)) {
    const existing = parseFrontmatter(readFileSync7(path, "utf8"));
    const mergedTasks = Array.from(new Set([...existing.data.source_task_ids ?? [], ...entry.source_task_ids]));
    const mergedWdw = [
      ...existing.data.what_didnt_work ?? [],
      ...entry.what_didnt_work.filter((nw) => !(existing.data.what_didnt_work ?? []).some((ew) => ew.approach === nw.approach))
    ];
    finalEntry = {
      ...existing.data,
      source_task_ids: mergedTasks,
      what_didnt_work: mergedWdw,
      last_updated: entry.last_updated,
      times_referenced: (existing.data.times_referenced ?? 0) + 1
    };
    finalBody = existing.body;
  }
  const { body: _bodyField, ...fm } = finalEntry;
  writeAtomic(path, serializeFrontmatter(fm, finalBody));
  clearFingerprintCache();
  return { path, entry: finalEntry };
}
function solutionLockPath(category, slug, stateRoot) {
  return solutionPath(category, slug, stateRoot) + ".lock";
}
async function writeSolutionLocked(entry, slug, dedupStamp, body = "", stateRoot, lockOpts = {}) {
  mkdirSync5(dirname3(solutionPath(entry.category, slug, stateRoot)), { recursive: true });
  const lockPath = solutionLockPath(entry.category, slug, stateRoot);
  return withFileLock(lockPath, () => writeSolution(entry, slug, dedupStamp, body, stateRoot), lockOpts);
}
function readSolution(category, slug, stateRoot) {
  const path = solutionPath(category, slug, stateRoot);
  if (!existsSync7(path))
    return null;
  const { data, body } = parseFrontmatter(readFileSync7(path, "utf8"));
  return { entry: data, body };
}
function listSolutions(stateRoot) {
  const dir = resolve8(resolveStateRoot(stateRoot), "solutions");
  if (!existsSync7(dir))
    return [];
  const out = [];
  let categories;
  try {
    categories = readdirSync4(dir, { withFileTypes: true }).filter((e2) => e2.isDirectory()).map((e2) => e2.name);
  } catch {
    return [];
  }
  for (const cat of categories) {
    if (!SOLUTION_CATEGORIES.has(cat))
      continue;
    const catDir = resolve8(dir, cat);
    let files;
    try {
      files = readdirSync4(catDir).filter((f3) => f3.endsWith(".md"));
    } catch {
      continue;
    }
    for (const f3 of files) {
      const fpath = resolve8(catDir, f3);
      try {
        const { data, body } = parseFrontmatter(readFileSync7(fpath, "utf8"));
        out.push({
          category: cat,
          slug: f3.replace(/\.md$/, ""),
          path: fpath,
          entry: data,
          body
        });
      } catch {}
    }
  }
  return out;
}
function deleteSolution(_category, _slug, _stateRoot) {
  throw new StateError("SolutionDeleteForbidden", "solutions/ is delete-forbidden per sgc-state.schema.yaml (delete_policy: forbidden)");
}
var SOLUTION_CATEGORIES, REQUIRED_SOLUTION_FIELDS;
var init_solutions = __esm(() => {
  init_spawn_protocol();
  init_fingerprint();
  init_file_lock();
  init_atomic();
  SOLUTION_CATEGORIES = new Set([
    "runtime",
    "build",
    "auth",
    "data",
    "perf",
    "ui",
    "infra",
    "other"
  ]);
  REQUIRED_SOLUTION_FIELDS = [
    "id",
    "signature",
    "category",
    "problem",
    "symptoms",
    "what_didnt_work",
    "solution",
    "prevention",
    "tags",
    "first_seen",
    "last_updated",
    "times_referenced",
    "source_task_ids"
  ];
});

// src/dispatcher/state.ts
var init_state = __esm(() => {
  init_atomic();
  init_decisions();
  init_progress();
  init_reviews();
  init_solutions();
});

// src/dispatcher/validation.ts
function detectBannedVocab(text) {
  if (!text)
    return [];
  const hits = new Set;
  for (const term of BANNED_VOCAB_EN) {
    const esc = term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    if (new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`, "i").test(text))
      hits.add(term);
  }
  for (const term of BANNED_VOCAB_CJK) {
    if (text.includes(term))
      hits.add(term);
  }
  return [...hits];
}
function validateValueAgainstDecl(value, decl, fieldName) {
  if (typeof decl !== "string")
    return null;
  const enumMatch = /^enum\[(.*)\]$/.exec(decl);
  if (enumMatch) {
    const values = enumMatch[1].split(",").map((v2) => v2.trim()).filter((v2) => v2.length > 0);
    if (values.length === 0) {
      return `field ${fieldName}: malformed declaration ${JSON.stringify(decl)} (enum declares no values)`;
    }
    if (typeof value !== "string" || !values.includes(value)) {
      return `field ${fieldName}: expected one of [${values.join(", ")}], got ${JSON.stringify(value)}`;
    }
    return null;
  }
  const arrayMatch = /^array\[(.+)\]$/.exec(decl);
  if (arrayMatch) {
    if (!Array.isArray(value)) {
      return `field ${fieldName}: expected array, got ${typeof value}`;
    }
    const innerDecl = arrayMatch[1].trim();
    const isSimpleForm = innerDecl === "string" || innerDecl === "markdown" || innerDecl === "integer" || innerDecl === "number" || /^enum\[.+\]$/.test(innerDecl);
    if (!isSimpleForm)
      return null;
    for (let i2 = 0;i2 < value.length; i2++) {
      const err = validateValueAgainstDecl(value[i2], innerDecl, `${fieldName}[${i2}]`);
      if (err)
        return err;
    }
    return null;
  }
  if (decl === "string" || decl === "markdown") {
    if (typeof value !== "string") {
      return `field ${fieldName}: expected string, got ${typeof value}`;
    }
    return null;
  }
  if (decl === "integer") {
    if (!Number.isInteger(value)) {
      return `field ${fieldName}: expected integer, got ${JSON.stringify(value)}`;
    }
    return null;
  }
  if (decl === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `field ${fieldName}: expected finite number, got ${JSON.stringify(value)}`;
    }
    return null;
  }
  return null;
}
function validateOutputShape(manifest, result) {
  if (typeof result !== "object" || result === null) {
    throw new OutputShapeMismatch(manifest.name, Object.keys(manifest.outputs ?? {}));
  }
  const hasDeclaredOutputs = manifest.outputs !== undefined && manifest.outputs !== null && Object.keys(manifest.outputs).length > 0;
  if (!hasDeclaredOutputs) {
    return;
  }
  const expected = manifest.outputs;
  const required = Object.keys(expected);
  const present = Object.keys(result);
  const missing = required.filter((k2) => !present.includes(k2));
  if (missing.length > 0) {
    throw new OutputShapeMismatch(manifest.name, missing);
  }
  const unknown = present.filter((k2) => !required.includes(k2));
  if (unknown.length > 0) {
    throw new OutputShapeMismatch(manifest.name, unknown, `agent ${manifest.name} returned undeclared output fields: ${unknown.join(", ")} (Invariant §9)`);
  }
  const typeErrors = [];
  for (const [field, decl] of Object.entries(expected)) {
    const err = validateValueAgainstDecl(result[field], decl, field);
    if (err)
      typeErrors.push(err);
  }
  if (typeErrors.length > 0) {
    throw new OutputShapeMismatch(manifest.name, typeErrors, `agent ${manifest.name} output type errors: ${typeErrors.join("; ")}`);
  }
}
function checkField(value, spec) {
  switch (spec.kind) {
    case "string":
      return typeof value === "string" ? null : `expected string, got ${typeof value}`;
    case "string-in-set":
      if (typeof value !== "string")
        return `expected string, got ${typeof value}`;
      return spec.set.has(value) ? null : `${JSON.stringify(value)} not in allowed set`;
    case "finite-number-range":
      if (typeof value !== "number" || !Number.isFinite(value) || value < spec.min || value > spec.max) {
        return `must be finite number in [${spec.min}, ${spec.max}], got ${typeof value === "number" ? String(value) : JSON.stringify(value)}`;
      }
      return null;
    case "optional-non-empty-string":
      if (value === undefined)
        return null;
      if (typeof value !== "string" || value.trim().length === 0) {
        return `must be non-empty string when present`;
      }
      return null;
    case "custom":
      return spec.check(value);
  }
}
function composeArrayObjectValidator(shape) {
  const fieldEntries = Object.entries(shape.fields);
  const dedupNoun = shape.dedupNoun ?? "entry";
  const dedupPlural = dedupNoun === "entry" ? "entries" : `${dedupNoun}s`;
  return function validateArrayObject(raw) {
    if (typeof raw !== "object" || raw === null) {
      throw new OutputShapeMismatch(shape.agentName, [shape.topField], `${shape.agentName} output not an object`);
    }
    const obj = raw;
    const arr = obj[shape.topField];
    if (!Array.isArray(arr)) {
      throw new OutputShapeMismatch(shape.agentName, [shape.topField], `${shape.agentName}.${shape.topField} expected array, got ${typeof arr}`);
    }
    const seen = shape.dedupBy ? new Set : null;
    let dedupedCount = 0;
    const entries = [];
    for (let i2 = 0;i2 < arr.length; i2++) {
      if (shape.maxLength !== undefined && entries.length >= shape.maxLength)
        break;
      const e2 = arr[i2];
      if (typeof e2 !== "object" || e2 === null) {
        throw new OutputShapeMismatch(shape.agentName, [`${shape.topField}[${i2}]`], `${shape.topField}[${i2}] not an object`);
      }
      const entry = e2;
      for (const [fieldName, spec] of fieldEntries) {
        const err = checkField(entry[fieldName], spec);
        if (err !== null) {
          throw new OutputShapeMismatch(shape.agentName, [`${shape.topField}[${i2}].${fieldName}`], `${shape.topField}[${i2}].${fieldName} ${err}`);
        }
      }
      if (shape.validateEntry) {
        const err = shape.validateEntry(entry, i2);
        if (err !== null) {
          throw new OutputShapeMismatch(shape.agentName, [`${shape.topField}[${i2}]`], `${shape.topField}[${i2}].${err}`);
        }
      }
      if (seen !== null) {
        const key = entry[shape.dedupBy];
        if (seen.has(key)) {
          dedupedCount++;
          continue;
        }
        seen.add(key);
      }
      entries.push(entry);
    }
    const llmWarnings = Array.isArray(obj["warnings"]) ? obj["warnings"].filter((w2) => typeof w2 === "string") : [];
    const warnings = [...llmWarnings];
    if (dedupedCount > 0) {
      const noun = dedupedCount === 1 ? dedupNoun : dedupPlural;
      warnings.push(`LLM emitted ${dedupedCount} duplicate ${shape.dedupBy} ${noun}; deduped to ${entries.length} unique`);
    }
    return { entries, warnings };
  };
}
var OutputShapeMismatch, BANNED_VOCAB_EN, BANNED_VOCAB_CJK;
var init_validation = __esm(() => {
  OutputShapeMismatch = class OutputShapeMismatch extends Error {
    agent;
    fields;
    constructor(agent, fields, detail) {
      super(detail ?? `agent ${agent} output missing required fields: ${fields.join(", ")}`);
      this.agent = agent;
      this.fields = fields;
      this.name = "OutputShapeMismatch";
    }
  };
  BANNED_VOCAB_EN = [
    "robust",
    "comprehensive",
    "production-ready",
    "production ready",
    "seamless",
    "cutting-edge",
    "best-in-class",
    "world-class",
    "should just work"
  ];
  BANNED_VOCAB_CJK = ["显著", "大幅", "相当不错", "应该可以", "基本可用"];
});

// src/dispatcher/agents/researcher-history.ts
import { existsSync as existsSync8 } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve as resolve9 } from "node:path";
async function walkSolutionsCorpus(stateRoot, keywords) {
  const dir = resolve9(stateRoot, "solutions");
  if (keywords.length === 0)
    return [];
  let categories;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    categories = entries.filter((e2) => e2.isDirectory()).map((e2) => e2.name);
  } catch {
    return [];
  }
  const out = [];
  for (const cat of categories) {
    const catPath = resolve9(dir, cat);
    let files;
    try {
      const entries = await readdir(catPath, { withFileTypes: true });
      files = entries.filter((e2) => e2.isFile() && e2.name.endsWith(".md")).map((e2) => e2.name);
    } catch {
      continue;
    }
    for (const file of files) {
      const filePath = resolve9(catPath, file);
      let raw;
      try {
        const st = await stat(filePath);
        if (st.size > MAX_SOLUTION_FILE_BYTES) {
          console.error(`[sgc] solution ${cat}/${file} is ${st.size} bytes (> ${MAX_SOLUTION_FILE_BYTES} cap) — skipped from corpus walk; rotate or trim it to restore reuse.`);
          continue;
        }
        raw = await readFile(filePath, "utf8");
      } catch {
        continue;
      }
      const text = raw.normalize("NFC");
      const corpusTokens = tokenize(text);
      const hits = keywords.filter((k2) => keywordHitsCorpus(k2, corpusTokens)).length;
      if (hits === 0)
        continue;
      const afterFence = text.replace(/^---[\s\S]*?---\r?\n?/, "").trimStart();
      out.push({
        category: cat,
        slug: file.replace(/\.md$/, ""),
        hits,
        text,
        afterFence
      });
    }
  }
  return out;
}
async function preFilterSolutions(intentDraft, stateRoot) {
  const root2 = resolveStateRoot(stateRoot);
  const keywords = extractKeywords(intentDraft);
  const scans = await walkSolutionsCorpus(root2, keywords);
  const candidates = scans.map((s2) => {
    const intentMatch = /^intent:\s*(.+)$/m.exec(s2.text);
    const intentLine = intentMatch ? `${intentMatch[1].trim()}
` : "";
    const excerpt = (intentLine + s2.afterFence).replace(/\s+/g, " ").trim().slice(0, 500);
    return {
      solution_ref: `${s2.category}/${s2.slug}`,
      category: s2.category,
      excerpt,
      keyword_hits: s2.hits
    };
  });
  candidates.sort((a2, b2) => b2.keyword_hits - a2.keyword_hits);
  return candidates.slice(0, 20);
}
function extractKeywords(text) {
  return Array.from(tokenize(text));
}
function keywordHitsCorpus(keyword, corpusTokens) {
  if (corpusTokens.has(keyword))
    return true;
  for (const suf of INFLECTIONS) {
    if (corpusTokens.has(keyword + suf))
      return true;
    if (keyword.endsWith(suf)) {
      const stem = keyword.slice(0, -suf.length);
      if (stem.length >= 3 && corpusTokens.has(stem))
        return true;
    }
  }
  return false;
}
function scoreRelevance(hitCount, keywordCount) {
  if (keywordCount === 0)
    return 0;
  return Math.min(1, hitCount / keywordCount);
}
async function mineSolutions(stateRoot, keywords) {
  const scans = await walkSolutionsCorpus(stateRoot, keywords);
  const results = scans.map((s2) => ({
    source: "solutions",
    relevance_score: scoreRelevance(s2.hits, keywords.length),
    excerpt: s2.afterFence.slice(0, 160).replace(/\s+/g, " ").trim(),
    solution_ref: `${s2.category}/${s2.slug}`
  }));
  results.sort((a2, b2) => b2.relevance_score - a2.relevance_score);
  return results.filter((r3) => r3.relevance_score >= 0.3).slice(0, 5);
}
async function researcherHistoryHeuristic(input, opts = {}) {
  const stateRoot = resolveStateRoot(opts.stateRoot);
  const keywords = extractKeywords(input.intent_draft ?? "");
  const prior_art = await mineSolutions(stateRoot, keywords);
  const warnings = [];
  if (keywords.length === 0) {
    warnings.push("intent_draft produced no keywords (too short or stopwords only); no scan performed");
  }
  if (prior_art.length === 0 && keywords.length > 0 && existsSync8(resolve9(stateRoot, "solutions"))) {
    warnings.push("no relevant prior solutions found in .sgc/solutions/");
  }
  return { prior_art, warnings };
}
function coerceLlmOutput(raw, candidates) {
  const refSet = new Set(candidates.map((c3) => c3.solution_ref));
  const candByRef = new Map(candidates.map((c3) => [c3.solution_ref, c3]));
  const validate2 = composeArrayObjectValidator({
    agentName: "researcher.history",
    topField: "prior_art",
    fields: {
      solution_ref: { kind: "string-in-set", set: refSet },
      relevance_score: { kind: "finite-number-range", min: 0, max: 1 },
      relevance_reason: { kind: "optional-non-empty-string" }
    },
    validateEntry: (entry) => {
      if (entry["relevance_reason"] !== undefined && entry["relevance_score"] < 0.3) {
        return `relevance_score must be ≥ 0.3 in LLM mode (with relevance_reason), got ${entry["relevance_score"]}`;
      }
      return null;
    },
    dedupBy: "solution_ref",
    maxLength: 5
  });
  const { entries, warnings } = validate2(raw);
  const prior_art = entries.map((entry) => {
    const ref = entry["solution_ref"];
    const score = entry["relevance_score"];
    const reason = entry["relevance_reason"];
    const cand = candByRef.get(ref);
    const out = {
      source: "solutions",
      solution_ref: ref,
      relevance_score: score,
      excerpt: cand.excerpt
    };
    if (reason !== undefined) {
      out.relevance_reason = reason.replace(/​/g, "").replace(/[\s]+/g, " ").trim().replace(/([*_`[\]])/g, "\\$1");
    }
    return out;
  });
  return { prior_art, warnings };
}
function handleCoerceFailure(err, logger, taskId) {
  const errName = err instanceof Error ? err.name : "unknown";
  const errMsg = err instanceof Error ? err.message : "";
  logger.event({
    task_id: taskId,
    spawn_id: null,
    agent: "researcher.history",
    event_type: "researcher.coerce_failed",
    level: "warn",
    payload: { error_class: errName, error_message: errMsg }
  });
  return {
    prior_art: [],
    warnings: [
      `researcher.history failed: ${errName}${errMsg ? `: ${errMsg}` : ""}`
    ]
  };
}
var MAX_SOLUTION_FILE_BYTES, INFLECTIONS, researcherHistory;
var init_researcher_history = __esm(() => {
  init_dedup();
  init_state();
  init_validation();
  MAX_SOLUTION_FILE_BYTES = 256 * 1024;
  INFLECTIONS = ["s", "es", "ed", "d", "ing", "ings", "er", "ers"];
  researcherHistory = researcherHistoryHeuristic;
});

// src/dispatcher/debug.ts
var exports_debug = {};
__export(exports_debug, {
  writeInvestigation: () => writeInvestigation,
  runDebugStatus: () => runDebugStatus,
  runDebugStart: () => runDebugStart,
  runDebugList: () => runDebugList,
  runDebugClose: () => runDebugClose,
  renderInvestigationBody: () => renderInvestigationBody,
  findSoleInProgressInvestigation: () => findSoleInProgressInvestigation,
  deriveInvestigationId: () => deriveInvestigationId,
  defaultHeuristic: () => defaultHeuristic
});
import { existsSync as existsSync9 } from "node:fs";
import { readFile as readFile2, readdir as readdir2, writeFile, rename, mkdir } from "node:fs/promises";
import { join as join3 } from "node:path";
import { spawnSync } from "node:child_process";
function deriveInvestigationId(symptom, now) {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const hh = now.getUTCHours().toString().padStart(2, "0");
  const min = now.getUTCMinutes().toString().padStart(2, "0");
  const prefix = `${yyyy}-${mm}-${dd}-${hh}${min}`;
  const kebab = symptom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (kebab.length === 0)
    return `${prefix}-debug`;
  const truncated = kebab.slice(0, 30).replace(/-+$/, "");
  return `${prefix}-${truncated}`;
}
async function readEventsTail(stateRoot, lineLimit) {
  const path = join3(stateRoot, "progress", "events.ndjson");
  try {
    const content = await readFile2(path, "utf8");
    const all = content.split(`
`).filter((l2) => l2.length > 0);
    return { lines: all.slice(-lineLimit) };
  } catch (err) {
    const code = err.code;
    if (code === "ENOENT")
      return { lines: [], error: "events_tail: file missing" };
    return {
      lines: [],
      error: `events_tail: ${err.message.slice(0, 80)}`
    };
  }
}
async function gatherInvestigateFactsImpl(opts) {
  const errors = [];
  const facts = {
    git_status_paths: [],
    recent_events: [],
    errors
  };
  try {
    const r3 = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: opts.repoRoot,
      encoding: "utf8"
    });
    if (r3.error)
      errors.push(`git_head: ${r3.error.message.slice(0, 80)}`);
    else if (r3.status === 0)
      facts.git_head = r3.stdout.trim();
    else
      errors.push(`git_head: ${(r3.stderr || "non-zero exit").trim().slice(0, 80)}`);
  } catch (err) {
    errors.push(`git_head: ${err.message.slice(0, 80)}`);
  }
  try {
    const r3 = spawnSync("git", ["status", "--porcelain=v1"], {
      cwd: opts.repoRoot,
      encoding: "utf8"
    });
    if (r3.error)
      errors.push(`git_status: ${r3.error.message.slice(0, 80)}`);
    else if (r3.status === 0) {
      facts.git_status_paths = r3.stdout.split(/\r?\n/).filter((l2) => l2.length > 0).slice(0, 20);
    } else {
      errors.push(`git_status: ${(r3.stderr || "non-zero exit").trim().slice(0, 80)}`);
    }
  } catch (err) {
    errors.push(`git_status: ${err.message.slice(0, 80)}`);
  }
  const tail = await readEventsTail(opts.stateRoot, 50);
  if (tail.error)
    errors.push(tail.error);
  for (const line of tail.lines) {
    try {
      const e2 = JSON.parse(line);
      facts.recent_events.push({
        ts: String(e2.ts ?? ""),
        event_type: String(e2.event_type ?? ""),
        agent: String(e2.agent ?? "")
      });
    } catch {}
  }
  return facts;
}
async function analyzeCorpusImpl(opts) {
  const keywords = extractKeywords(opts.symptom);
  if (keywords.length === 0)
    return [];
  let scans;
  try {
    scans = await walkSolutionsCorpus(opts.stateRoot, keywords);
  } catch {
    return [];
  }
  const hits = [];
  for (const scan of scans) {
    let prevention;
    try {
      const fm = parseFrontmatter(scan.text);
      prevention = (fm.data.prevention ?? "").trim();
    } catch {
      continue;
    }
    if (prevention.length === 0)
      continue;
    hits.push({
      solution_ref: `${scan.category}/${scan.slug}.md`,
      prevention_excerpt: prevention.slice(0, 240),
      overlap_score: scan.hits
    });
  }
  hits.sort((a2, b2) => b2.overlap_score - a2.overlap_score);
  return hits.slice(0, 5);
}
async function detectThreeStrikeImpl(opts) {
  const tail = await readEventsTail(opts.stateRoot, 500);
  if (tail.lines.length === 0)
    return [];
  const counts = new Map;
  for (const line of tail.lines) {
    let e2;
    try {
      e2 = JSON.parse(line);
    } catch {
      continue;
    }
    const cls = e2.payload?.error_class;
    const msg = e2.payload?.error_message;
    if (!cls || !msg)
      continue;
    const sig = `${cls}: ${msg.slice(0, 80)}`;
    const cur = counts.get(sig);
    if (cur)
      cur.count++;
    else
      counts.set(sig, { count: 1, first_ts: String(e2.ts ?? "") });
  }
  const strikes = [];
  for (const [signature, { count, first_ts }] of counts) {
    if (count >= 3)
      strikes.push({ signature, count, example_ts: first_ts });
  }
  strikes.sort((a2, b2) => b2.count - a2.count);
  return strikes;
}
async function scanDir(stateRoot, dir, needle) {
  const path = join3(stateRoot, dir);
  let entries;
  try {
    entries = await readdir2(path);
  } catch {
    return [];
  }
  const hits = [];
  for (const name of entries) {
    if (!name.endsWith(".md"))
      continue;
    let content;
    try {
      content = await readFile2(join3(path, name), "utf8");
    } catch {
      continue;
    }
    const contentLower = content.toLowerCase();
    const needleLower = needle.toLowerCase();
    const idx = contentLower.indexOf(needleLower);
    if (idx < 0)
      continue;
    const excerptStart = Math.max(0, idx - 30);
    const excerpt = content.slice(excerptStart, excerptStart + 160).replace(/\s+/g, " ").trim();
    hits.push({
      kind: dir === "ship-failures" ? "ship-failure" : "canary",
      slug: name.replace(/\.md$/, ""),
      excerpt
    });
  }
  return hits;
}
async function scanHistoricalSignaturesImpl(opts) {
  const needle = opts.symptom.slice(0, 80).trim();
  if (needle.length === 0)
    return [];
  const [shipHits, canaryHits] = await Promise.all([
    scanDir(opts.stateRoot, "ship-failures", needle),
    scanDir(opts.stateRoot, "canaries", needle)
  ]);
  return [...shipHits, ...canaryHits];
}
function defaultHeuristic() {
  return {
    gatherInvestigateFacts: gatherInvestigateFactsImpl,
    analyzeCorpus: analyzeCorpusImpl,
    detectThreeStrike: detectThreeStrikeImpl,
    scanHistoricalSignatures: scanHistoricalSignaturesImpl
  };
}
function renderInvestigationBody(parts) {
  const lines = [];
  lines.push("## 1 — Investigate");
  lines.push("");
  if (parts.investigate.git_head) {
    lines.push(`- git_head: ${parts.investigate.git_head}`);
  }
  if (parts.investigate.git_status_paths.length > 0) {
    lines.push("- git_status (first 20):");
    for (const p of parts.investigate.git_status_paths)
      lines.push(`  - ${p}`);
  } else {
    lines.push("- git_status: (clean)");
  }
  if (parts.investigate.recent_events.length > 0) {
    lines.push("- recent_events (tail 50):");
    for (const e2 of parts.investigate.recent_events.slice(-10)) {
      lines.push(`  - ${e2.ts} ${e2.event_type} ${e2.agent}`);
    }
  } else {
    lines.push("- recent_events: (none)");
  }
  for (const err of parts.investigate.errors) {
    lines.push(`- ⚠ ${err}`);
  }
  lines.push("");
  lines.push("## 2 — Analyze");
  lines.push("");
  lines.push("Prior preventions:");
  if (parts.analyze.prior_preventions.length === 0) {
    lines.push("- (none)");
  } else {
    for (const h2 of parts.analyze.prior_preventions) {
      lines.push(`- ${h2.solution_ref} (score ${h2.overlap_score.toFixed(2)}): ${h2.prevention_excerpt}`);
    }
  }
  lines.push("");
  lines.push("Historical signatures:");
  if (parts.analyze.historical_signatures.length === 0) {
    lines.push("- (none)");
  } else {
    for (const h2 of parts.analyze.historical_signatures) {
      lines.push(`- ${h2.kind}/${h2.slug}: ${h2.excerpt}`);
    }
  }
  lines.push("");
  lines.push("Three-strike:");
  if (parts.analyze.three_strike.length === 0) {
    lines.push("- (none)");
  } else {
    for (const t2 of parts.analyze.three_strike) {
      lines.push(`- ⚠ three-strike: ${t2.signature} (${t2.count} occurrences; consider rollback per §6)`);
    }
  }
  for (const err of parts.analyze.errors) {
    lines.push(`- ⚠ ${err}`);
  }
  lines.push("");
  lines.push("## 3 — Hypothesize");
  lines.push("");
  for (let i2 = 0;i2 < parts.hypothesize.length; i2++) {
    lines.push(`${i2 + 1}. ${parts.hypothesize[i2]}`);
  }
  lines.push("");
  lines.push("## 4 — Implement");
  lines.push("");
  lines.push("(operator: fill root_cause + fix_commit + verify_command, then `sgc debug close`)");
  lines.push("");
  return lines.join(`
`);
}
function renderFrontmatter(fm) {
  const lines = [
    "---",
    `id: ${fm.id}`,
    `status: ${fm.status}`,
    `current_phase: ${fm.current_phase}`,
    `symptom: ${JSON.stringify(fm.symptom)}`,
    `started_at: ${fm.started_at}`,
    `closed_at: ${fm.closed_at ?? "null"}`,
    `root_cause: ${fm.root_cause === null ? "null" : JSON.stringify(fm.root_cause)}`,
    `fix_commit: ${fm.fix_commit ?? "null"}`,
    `verify_command: ${fm.verify_command === null ? "null" : JSON.stringify(fm.verify_command)}`,
    "---"
  ];
  return lines.join(`
`) + `
`;
}
async function writeInvestigation(opts) {
  const dir = join3(opts.stateRoot, "investigations");
  await mkdir(dir, { recursive: true });
  const target = join3(dir, `${opts.id}.md`);
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  const content = renderFrontmatter(opts.frontmatter) + opts.body;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, target);
  return target;
}
async function resolveCollisionId(stateRoot, baseId) {
  const dir = join3(stateRoot, "investigations");
  if (!existsSync9(join3(dir, `${baseId}.md`)))
    return baseId;
  for (let n2 = 2;n2 < 100; n2++) {
    const candidate = `${baseId}-${n2}`;
    if (!existsSync9(join3(dir, `${candidate}.md`)))
      return candidate;
  }
  throw new Error(`collision: too many same-minute investigations for ${baseId}`);
}
async function readInvestigationContent(stateRoot, id) {
  const path = join3(stateRoot, "investigations", `${id}.md`);
  try {
    const content = await readFile2(path, "utf8");
    return { path, content };
  } catch {
    return null;
  }
}
async function runDebugClose(opts) {
  const stateRoot = resolveStateRoot(opts.stateRoot);
  const stderrWrite = opts.stderrWrite ?? ((c3) => {
    process.stderr.write(c3);
  });
  const stdoutWrite = opts.stdoutWrite ?? ((c3) => {
    process.stdout.write(c3);
  });
  const now = (opts.now ?? (() => new Date))();
  const logger = opts.logger ?? createLogger({ stateRoot });
  const rootCause = opts.rootCause.trim();
  const fixCommit = opts.fixCommit.trim();
  const verifyCommand = opts.verifyCommand.trim();
  if (rootCause.length === 0) {
    stderrWrite(`close refused: --root-cause required (Iron Law #3)
`);
    return { exitCode: 1 };
  }
  if (!SHA_RE.test(fixCommit)) {
    stderrWrite(`close refused: --fix-commit must be 7-40 hex chars (Iron Law #3)
`);
    return { exitCode: 1 };
  }
  if (verifyCommand.length === 0) {
    stderrWrite(`close refused: --verify-command required (Iron Law #3)
`);
    return { exitCode: 1 };
  }
  const existing = await readInvestigationContent(stateRoot, opts.id);
  if (!existing) {
    stderrWrite(`close refused: no investigation at ${join3(stateRoot, "investigations", `${opts.id}.md`)}
`);
    return { exitCode: 1 };
  }
  let fmData = {};
  try {
    const fm = parseFrontmatter(existing.content);
    fmData = fm.data;
  } catch {
    stderrWrite(`close refused: ${opts.id} frontmatter unparseable
`);
    return { exitCode: 1 };
  }
  if (fmData.status === "closed") {
    stderrWrite(`close refused: ${opts.id} already closed
`);
    return { exitCode: 1 };
  }
  const bodyStart = existing.content.indexOf(`
---
`);
  const bodyContent = bodyStart >= 0 ? existing.content.slice(bodyStart + `
---
`.length) : "";
  const updatedBody = bodyContent.trimEnd() + `

## 5 — Fix evidence

` + `- root_cause: ${rootCause}
` + `- fix_commit: ${fixCommit}
` + `- verify_command: \`${verifyCommand}\`
` + `- closed_at: ${now.toISOString()}
`;
  await writeInvestigation({
    stateRoot,
    id: opts.id,
    frontmatter: {
      id: opts.id,
      status: "closed",
      current_phase: "closed",
      symptom: String(fmData.symptom ?? ""),
      started_at: String(fmData.started_at ?? ""),
      closed_at: now.toISOString(),
      root_cause: rootCause,
      fix_commit: fixCommit,
      verify_command: verifyCommand
    },
    body: updatedBody
  });
  logger.event({
    task_id: opts.id,
    spawn_id: opts.id,
    agent: "sgc.debug",
    event_type: "debug.closed",
    level: "info",
    payload: {
      investigation_id: opts.id,
      root_cause: rootCause,
      fix_commit: fixCommit,
      verify_command: verifyCommand
    }
  });
  stderrWrite(`closed: ${opts.id}
`);
  return { exitCode: 0 };
}
async function runDebugStatus(opts) {
  const stateRoot = resolveStateRoot(opts.stateRoot);
  const stdoutWrite = opts.stdoutWrite ?? ((c3) => {
    process.stdout.write(c3);
  });
  const stderrWrite = opts.stderrWrite ?? ((c3) => {
    process.stderr.write(c3);
  });
  const result = await readInvestigationContent(stateRoot, opts.id);
  if (!result) {
    stderrWrite(`no investigation at ${join3(stateRoot, "investigations", `${opts.id}.md`)}
`);
    return { exitCode: 1 };
  }
  stdoutWrite(result.content);
  return { exitCode: 0 };
}
async function runDebugList(opts) {
  const stateRoot = resolveStateRoot(opts.stateRoot);
  const stdoutWrite = opts.stdoutWrite ?? ((c3) => {
    process.stdout.write(c3);
  });
  const dir = join3(stateRoot, "investigations");
  let entries;
  try {
    entries = await readdir2(dir);
  } catch {
    stdoutWrite(`no investigations
`);
    return { exitCode: 0 };
  }
  const records = [];
  for (const name of entries) {
    if (!name.endsWith(".md"))
      continue;
    try {
      const content = await readFile2(join3(dir, name), "utf8");
      const fm = parseFrontmatter(content);
      records.push({
        id: String(fm.data.id ?? name.replace(/\.md$/, "")),
        status: String(fm.data.status ?? "?"),
        started_at: String(fm.data.started_at ?? ""),
        symptom: String(fm.data.symptom ?? "").slice(0, 60)
      });
    } catch {
      continue;
    }
  }
  if (records.length === 0) {
    stdoutWrite(`no investigations
`);
    return { exitCode: 0 };
  }
  records.sort((a2, b2) => b2.started_at.localeCompare(a2.started_at));
  const idWidth = Math.max(2, ...records.map((r3) => r3.id.length)) + 2;
  const statusWidth = Math.max(6, ...records.map((r3) => r3.status.length)) + 2;
  stdoutWrite(`${"ID".padEnd(idWidth)}${"STATUS".padEnd(statusWidth)}SYMPTOM
`);
  for (const r3 of records) {
    stdoutWrite(`${r3.id.padEnd(idWidth)}${r3.status.padEnd(statusWidth)}${r3.symptom}
`);
  }
  return { exitCode: 0 };
}
async function findSoleInProgressInvestigation(stateRoot) {
  const root2 = resolveStateRoot(stateRoot);
  const dir = join3(root2, "investigations");
  let entries;
  try {
    entries = await readdir2(dir);
  } catch {
    return null;
  }
  const open = [];
  for (const name of entries) {
    if (!name.endsWith(".md"))
      continue;
    try {
      const fm = parseFrontmatter(await readFile2(join3(dir, name), "utf8"));
      if (String(fm.data.status ?? "") === "in_progress") {
        open.push(String(fm.data.id ?? name.replace(/\.md$/, "")));
      }
    } catch {
      continue;
    }
  }
  return open.length === 1 ? open[0] : null;
}
async function runDebugStart(opts) {
  const stateRoot = resolveStateRoot(opts.stateRoot ?? (opts.repoRoot ? join3(opts.repoRoot, ".sgc") : undefined));
  const repoRoot = opts.repoRoot ?? process.cwd();
  const heuristic = opts.heuristic ?? defaultHeuristic();
  const now = (opts.now ?? (() => new Date))();
  const logger = opts.logger ?? createLogger({ stateRoot });
  const stdoutWrite = opts.stdoutWrite ?? ((c3) => {
    process.stdout.write(c3);
  });
  const stderrWrite = opts.stderrWrite ?? ((c3) => {
    process.stderr.write(c3);
  });
  const baseId = deriveInvestigationId(opts.symptom, now);
  let id;
  try {
    id = await resolveCollisionId(stateRoot, baseId);
  } catch (err) {
    stderrWrite(`debug failed: ${err.message}
`);
    return { exitCode: 1 };
  }
  logger.event({
    task_id: id,
    spawn_id: id,
    agent: "sgc.debug",
    event_type: "debug.start",
    level: "info",
    payload: { investigation_id: id, symptom: opts.symptom }
  });
  let investigateFacts;
  try {
    investigateFacts = await heuristic.gatherInvestigateFacts({ stateRoot, repoRoot });
  } catch (err) {
    investigateFacts = {
      git_status_paths: [],
      recent_events: [],
      errors: [`gatherInvestigateFacts threw: ${err.message.slice(0, 80)}`]
    };
    logger.event({
      task_id: id,
      spawn_id: id,
      agent: "sgc.debug",
      event_type: "debug.heuristic_failed",
      level: "warn",
      payload: {
        investigation_id: id,
        phase: "investigate",
        error_class: err.constructor.name,
        error_message: err.message
      }
    });
  }
  logger.event({
    task_id: id,
    spawn_id: id,
    agent: "sgc.debug",
    event_type: "debug.phase_complete",
    level: "info",
    payload: { investigation_id: id, phase: "investigate" }
  });
  const failedPayloadFor = (phase, err) => ({
    investigation_id: id,
    phase,
    error_class: err.constructor.name,
    error_message: err.message
  });
  const [priorPreventions, threeStrike, historicalSignatures] = await Promise.all([
    heuristic.analyzeCorpus({ stateRoot, symptom: opts.symptom }).catch((err) => {
      logger.event({
        task_id: id,
        spawn_id: id,
        agent: "sgc.debug",
        event_type: "debug.heuristic_failed",
        level: "warn",
        payload: failedPayloadFor("analyze", err)
      });
      return [];
    }),
    heuristic.detectThreeStrike({ stateRoot }).catch((err) => {
      logger.event({
        task_id: id,
        spawn_id: id,
        agent: "sgc.debug",
        event_type: "debug.heuristic_failed",
        level: "warn",
        payload: failedPayloadFor("analyze", err)
      });
      return [];
    }),
    heuristic.scanHistoricalSignatures({ stateRoot, symptom: opts.symptom }).catch((err) => {
      logger.event({
        task_id: id,
        spawn_id: id,
        agent: "sgc.debug",
        event_type: "debug.heuristic_failed",
        level: "warn",
        payload: failedPayloadFor("analyze", err)
      });
      return [];
    })
  ]);
  const analyze = {
    prior_preventions: priorPreventions,
    historical_signatures: historicalSignatures,
    three_strike: threeStrike,
    errors: []
  };
  logger.event({
    task_id: id,
    spawn_id: id,
    agent: "sgc.debug",
    event_type: "debug.phase_complete",
    level: "info",
    payload: { investigation_id: id, phase: "analyze" }
  });
  const hypothesize = [];
  for (const h2 of priorPreventions) {
    hypothesize.push(`${h2.solution_ref} — ${h2.prevention_excerpt}`);
  }
  for (const h2 of historicalSignatures) {
    hypothesize.push(`${h2.kind}/${h2.slug} — ${h2.excerpt}`);
  }
  for (const t2 of threeStrike) {
    hypothesize.push(`three-strike: ${t2.signature} (${t2.count} occurrences)`);
  }
  if (hypothesize.length === 0) {
    hypothesize.push("No prior matches. Operator-formulated hypothesis required.");
  }
  logger.event({
    task_id: id,
    spawn_id: id,
    agent: "sgc.debug",
    event_type: "debug.phase_complete",
    level: "info",
    payload: { investigation_id: id, phase: "hypothesize" }
  });
  const body = renderInvestigationBody({ investigate: investigateFacts, analyze, hypothesize });
  const path = await writeInvestigation({
    stateRoot,
    id,
    frontmatter: {
      id,
      status: "in_progress",
      current_phase: "implement",
      symptom: opts.symptom,
      started_at: now.toISOString(),
      closed_at: null,
      root_cause: null,
      fix_commit: null,
      verify_command: null
    },
    body
  });
  stdoutWrite(`## 3 — Hypothesize

`);
  for (let i2 = 0;i2 < hypothesize.length; i2++) {
    stdoutWrite(`${i2 + 1}. ${hypothesize[i2]}
`);
  }
  stderrWrite(`started: ${path}
`);
  return { exitCode: 0 };
}
var SHA_RE;
var init_debug = __esm(() => {
  init_logger();
  init_researcher_history();
  init_state();
  SHA_RE = /^[0-9a-f]{7,40}$/;
});

// src/dispatcher/preprocessor.ts
function quoteArrayPatterns(input) {
  const out = [];
  let i2 = 0;
  while (i2 < input.length) {
    const start = input.indexOf("array[", i2);
    if (start === -1 || !isWordBoundary(input, start)) {
      out.push(input.slice(i2));
      break;
    }
    out.push(input.slice(i2, start));
    let depth = 0;
    let j = start + "array".length;
    while (j < input.length) {
      const c3 = input[j];
      if (c3 === "[")
        depth++;
      else if (c3 === "]") {
        depth--;
        if (depth === 0)
          break;
      }
      j++;
    }
    if (j >= input.length) {
      out.push(input.slice(start));
      break;
    }
    out.push(`"${input.slice(start, j + 1)}"`);
    i2 = j + 1;
  }
  return out.join("");
}
function isWordBoundary(s2, idx) {
  if (idx === 0)
    return true;
  const prev = s2[idx - 1];
  return !/[A-Za-z0-9_"]/.test(prev);
}
function quoteOptionalTokens(input) {
  let prev = "";
  let s2 = input;
  while (prev !== s2) {
    prev = s2;
    s2 = s2.replace(/(\[[^\[\]\{\}\n]*?)\b(\w+)\?(?=[\s,\]])/g, '$1"$2?"');
  }
  return s2;
}
function blockScalarOpenIndent(line) {
  const m2 = /^(\s*)\S[^:]*:\s*[|>][-+]?\s*(#.*)?$/.exec(line);
  if (!m2)
    return null;
  return m2[1].length;
}
function preprocess(yamlText) {
  const lines = yamlText.split(`
`);
  const out = [];
  let blockIndent = null;
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    const isBlank = line.trim() === "";
    if (blockIndent !== null) {
      if (isBlank || indent > blockIndent) {
        out.push(line);
        continue;
      }
      blockIndent = null;
    }
    const open = blockScalarOpenIndent(line);
    if (open !== null) {
      blockIndent = open;
      out.push(line);
      continue;
    }
    let processed = quoteArrayPatterns(line);
    processed = quoteOptionalTokens(processed);
    out.push(processed);
  }
  return out.join(`
`);
}
function loadSpec(yamlText) {
  const preprocessed = preprocess(yamlText);
  return load(preprocessed);
}
var init_preprocessor = __esm(() => {
  init_js_yaml();
});

// contracts/sgc-capabilities.yaml
var sgc_capabilities_default = `# SGC Capabilities Contract
# Version: 0.1
#
# This file defines WHAT each actor in the system is allowed to do.
# The dispatcher consults this file before every subagent spawn and
# every state write. Attempts to exceed granted scope are rejected
# at dispatch time, not at execution time.
#
# Three sections:
#   1. scope_tokens     — the capability vocabulary
#   2. permissions      — command-level RW matrix
#   3. subagents        — per-subagent manifests (contracts)

schema_version: "0.1"

# ============================================================================
# 1. SCOPE TOKENS  —  the capability vocabulary
# ============================================================================
# Every capability in the system is named here. Subagents may only hold
# tokens listed below. Introducing a new capability requires a new token
# declaration — no ad-hoc permissions.

scope_tokens:

  # ---- State layer: read ----
  "read:decisions":
    description: Read decisions/ for the current task and its ancestors
    scoped_to: task_id
    default_ttl: task_lifetime

  "read:decisions:*":
    description: Read ALL decisions, including archived
    scoped_to: none
    notes: |
      Broad access. Grant only to planner.history, researcher.history,
      planner.adversarial, and janitor.archive.

  "read:progress":
    description: Read current progress/
    scoped_to: session

  "read:solutions":
    description: Read solutions/ knowledge base
    scoped_to: none
    forbidden_for:
      - "reviewer.*"
      - "qa.*"
    rationale: |
      See sgc-invariants.md §1 (generator-evaluator separation).
      A reviewer that knows "we've seen this before" is biased toward
      confirming historical judgments. Reviewers must be amnesiac.

  "read:reviews":
    scoped_to: task_id

  # ---- State layer: write ----
  "write:decisions":
    description: Append to decisions/{task_id}/
    scoped_to: task_id
    constraints:
      - append-only
      - schema-validated
      - no edits after creation

  "write:progress":
    description: Read-write on progress/
    scoped_to: session
    constraints:
      - schema-validated

  "write:solutions":
    description: Create or update-existing solution entries
    scoped_to: none
    constraints:
      - dedup-checked (compound.related must run first)
      - no-delete
      - schema-validated
    granted_to:
      - "compound.*"

  "write:reviews":
    description: Append review reports
    scoped_to: "task_id + stage"
    constraints:
      - append-only
      - schema-validated

  # ---- Execution capabilities ----
  "exec:shell":
    description: Run shell commands in the project workspace
    requires: explicit user grant for any network egress
  "exec:browser":
    description: Launch real browser for end-to-end testing
    granted_to: ["qa.browser"]
  "exec:git:read":
    description: Read git history, refs, diffs
  "exec:git:write":
    description: Create commits and branches
    scoped_to: branch_pattern
    granted_to: ["/work", "/ship"]

  # ---- Spawn capabilities ----
  "spawn:planner.*":
    granted_to: ["/plan"]
  "spawn:researcher.*":
    granted_to: ["/plan"]
    constraints: ["level >= L2"]
  "spawn:reviewer.*":
    granted_to: ["/review"]
    constraints:
      - max_concurrent: 10
  "spawn:qa.*":
    granted_to: ["/qa"]
  "spawn:compound.*":
    granted_to: ["/compound", "janitor.compound"]
  "spawn:clarifier.*":
    granted_to: ["/discover"]

# ============================================================================
# 2. PERMISSIONS  —  command-level RW matrix
# ============================================================================
# This is the authoritative form of the permission table. The dispatcher
# uses this to compute the initial scope_token set granted to each
# subagent invocation. Any row change requires an invariant review.

permissions:

  /plan:
    decisions: ["read:decisions:*", "write:decisions"]
    progress:  ["write:progress"]
    solutions: ["read:solutions"]
    reviews:   ["read:reviews"]
    spawn:     ["spawn:planner.*", "spawn:researcher.*"]

  /work:
    decisions: ["read:decisions"]
    progress:  ["write:progress"]
    solutions: ["read:solutions"]
    reviews:   []
    exec:      ["exec:shell", "exec:git:read", "exec:git:write"]

  /review:
    decisions: ["read:decisions"]
    progress:  ["read:progress"]
    solutions: []  # INTENTIONAL — see invariants §1
    reviews:   ["write:reviews"]
    spawn:     ["spawn:reviewer.*"]

  /qa:
    decisions: ["read:decisions"]
    progress:  ["read:progress"]
    solutions: []  # same invariant as /review
    reviews:   ["write:reviews"]
    spawn:     ["spawn:qa.*"]
    exec:      ["exec:browser"]

  /compound:
    decisions: ["read:decisions"]
    progress:  ["read:progress"]
    solutions: ["read:solutions", "write:solutions"]
    reviews:   ["read:reviews"]
    spawn:     ["spawn:compound.*"]

  /ship:
    decisions: ["read:decisions:*", "write:decisions"]
    progress:  ["read:progress"]
    solutions: []
    reviews:   ["read:reviews", "write:reviews"]
    exec:      ["exec:git:read", "exec:git:write"]

  /discover:
    progress:  ["read:progress"]
    spawn:     ["spawn:clarifier.*"]
    # /discover clarifies a vague topic before /plan runs. It reads current
    # progress for context, spawns clarifier.discover to produce structured
    # forcing-questions, and prints the result. No state writes — the user
    # hand-carries the discovery output into \`sgc plan --motivation\`.

  /status:
    decisions: ["read:decisions:*"]
    progress:  ["read:progress"]
    solutions: ["read:solutions"]
    reviews:   ["read:reviews"]
    # /status is a read-only dashboard command. It reads across all state
    # layers to present a comprehensive view of the current task, its
    # decisions, progress, solutions, and review history.
    # No write permissions, no spawn capabilities.

# ============================================================================
# 3. SUBAGENT MANIFESTS  —  per-subagent contracts
# ============================================================================
# Each manifest is a contract that the dispatcher enforces:
#   - inputs:  what the subagent may receive
#   - outputs: what it MUST produce (shape-checked)
#   - scope_tokens: the only capabilities it holds
#   - token_budget: hard ceiling; overage aborts the subagent
#   - timeout_s:   hard ceiling; overage aborts the subagent
#
# A subagent that requests a file not covered by its scope_tokens is
# terminated by the dispatcher. This is the scope binding from v3.8
# applied to the subagent layer.

subagents:

  # ---- Clarifier ----
  clarifier.discover:
    version: "0.2"
    source: gstack/office-hours + CE discovery pattern (re-authored; P2#7c LLM swap mirrors G.2.a pattern)
    purpose: Turn vague topic into structured forcing-questions for /plan
    prompt_path: prompts/clarifier-discover.md
    inputs:
      topic: string
      current_task_summary: string
    outputs:
      topic: string
      goal_question: string
      constraint_questions: array[string]
      scope_questions: array[string]
      edge_case_questions: array[string]
      acceptance_questions: array[string]
      suggested_next: string
    scope_tokens: ["read:progress"]
    token_budget: 3000
    timeout_s: 60
    notes: |
      The agent must produce one goal question, then up to 5 each of
      constraints / scope / edge-cases / acceptance. Questions should be
      specific enough that the user's answer can be dropped directly into
      \`sgc plan --motivation\`. Suggested_next is the exact CLI command
      for the follow-up.

  # ---- Classifier ----
  classifier.level:
    version: "0.1"
    purpose: Classify incoming task into L0 / L1 / L2 / L3
    prompt_path: prompts/classifier-level.md
    inputs:
      user_request: string
      repo_summary: string
    outputs:
      level: enum[L0, L1, L2, L3]
      rationale: markdown
      affected_readers_candidates: array[string]
    scope_tokens: ["read:progress"]
    token_budget: 2000
    timeout_s: 30
    notes: |
      Must refuse L1+ if it cannot name at least one affected reader.
      This is the L1 bugfix-validation fix.

  # ---- Planners (gstack lineage) ----
  planner.ceo:
    version: "0.2"
    source: gstack/plan-ceo-review (re-authored, not vendored; P2#7a LLM swap mirrors G.2.a planner.eng pattern)
    purpose: Product gate — "is this worth doing?"
    prompt_path: prompts/planner-ceo.md
    inputs:
      intent_draft: markdown
    outputs:
      verdict: enum[approve, revise, reject]
      concerns: array[string]
      rewrite_hints: array[string]
    scope_tokens: ["read:decisions", "read:progress"]
    token_budget: 4000
    timeout_s: 120

  planner.eng:
    version: "0.1"
    source: gstack/plan-eng-review (re-authored)
    purpose: Architecture gate — "will this break later?"
    prompt_path: prompts/planner-eng.md
    inputs:
      intent_draft: markdown
    outputs:
      verdict: enum[approve, revise, reject]
      concerns: array[string]
      structural_risks: array[{area, risk, mitigation}]
    scope_tokens: ["read:decisions", "read:progress", "exec:git:read"]
    token_budget: 4000
    timeout_s: 120

  planner.adversarial:
    version: "0.3"
    source: gstack pre-mortem pattern (P2#7b LLM swap mirrors G.2.a planner.eng)
    purpose: L3 pre-mortem. "What is the most likely way this fails?"
    prompt_path: prompts/planner-adversarial.md
    inputs:
      # repo_map dropped at v0.2 — matches G.2.a planner.eng which removed
      # repo_map for the same reason: the LLM has no concrete codebase
      # access via this spawn and the prompt explicitly forbids inventing
      # file paths. Heuristic also ignored the field.
      intent_draft: markdown
      # CE-1 (v0.3): /plan L3 branch pre-fetches keyword-matched preventions
      # from solutions/ via extractPreventions() and passes them as input —
      # the agent itself holds NO read:solutions in scope_tokens; data
      # crosses the boundary as input only. Optional: absent on L1/L2
      # paths, and absent on L3 when corpus produces no keyword match.
      prior_preventions: array[{solution_ref, category, prevention_text}]
    outputs:
      failure_modes: array[{scenario, probability, impact, early_signal}]
    scope_tokens: ["read:decisions:*", "read:progress", "exec:git:read"]
    token_budget: 6000
    timeout_s: 180

  planner.decompose:
    version: "0.1"
    source: sp:writing-plans pattern (re-authored natively, Phase 2b; not vendored)
    purpose: >
      Decompose an approved intent into file-level tasks with bite-sized TDD
      steps. CE reuse-in: prior failure-modes/preventions become guard steps;
      prior_art solution_refs flow into per-task prior_art_refs.
    prompt_path: prompts/planner-decompose.md
    inputs:
      intent_draft: markdown
      # Prior data crosses as INPUT only — the agent holds no read:solutions
      # (Invariant §1, same relaxation as planner.adversarial / CE-1).
      structural_risks: array[{area, risk, mitigation}]
      prior_art: array[{solution_ref, relevance_score, excerpt}]
      failure_modes: array[{scenario, probability, impact, early_signal}]
      prior_preventions: array[{solution_ref, category, prevention_text}]
    outputs:
      tasks: array[{id, title, files, steps, prior_art_refs}]
    scope_tokens: ["read:decisions:*", "read:progress", "exec:git:read"]
    token_budget: 8000
    timeout_s: 240

  # ---- Researcher (CE lineage) ----
  researcher.history:
    version: "0.2"
    source: CE /ce:plan research spawner (Phase H LLM swap)
    purpose: Mine solutions/ for prior art, LLM-rerank by semantic relevance
    prompt_path: prompts/researcher-history.md
    inputs:
      intent_draft: markdown
      candidates: array[{solution_ref, category, excerpt, keyword_hits}]
    outputs:
      # solution_ref is required: heuristic emits \`\${cat}/\${slug}\` always;
      # LLM mode validated by coerceLlmOutput Guard 2 (ref ∈ candidates).
      prior_art: array[{source, relevance_score, excerpt, solution_ref, relevance_reason?}]
      warnings: array[string]
    scope_tokens:
      - "read:decisions:*"
      - "read:solutions"
      - "exec:git:read"
    # H.1: 1500 → 3000 to defend against mid-YAML truncation on verbose LLM
    # output (5 prior_art × ~30-word relevance_reason + warnings + headers).
    # 3000 gives 2× margin over the typical ~500-token shape; MAX_TOKENS_CAP
    # in {anthropic-sdk,openrouter}-agent.ts caps the upper bound regardless.
    token_budget: 3000
    timeout_s: 60

  # ---- Reviewers (CE lineage, reduced set) ----
  reviewer.correctness:   &reviewer_base
    version: "0.1"
    source: CE reviewer cluster (re-authored)
    # M5: \`purpose\` exists for the mode-ladder override path. SGC_AGENT_MODE is
    # checked BEFORE the prompt_path rules (spawn.ts:432-457), so setting it routes
    # a prompt_path: null reviewer to an LLM whose prompt formatPrompt() synthesizes
    # from this manifest. Without a purpose that synthesis produced literally
    # "# Purpose\\n\\n(no purpose declared)" — an LLM call briefed on nothing, which
    # is worse than the heuristic it replaced. Derived reviewers INHERIT this via
    # \`<<: *reviewer_base\`; it is worded to stay true for every one of them, so it
    # is a floor, not a description of any single reviewer's specialty.
    purpose: >-
      Review a git diff against the stated intent and report findings with a
      location, a description of what is wrong, and an optional fix hint.
    prompt_path: prompts/reviewer-correctness.md
    inputs:
      diff: string
      intent: markdown
    outputs:
      verdict: enum[pass, concern, fail]
      severity: enum[none, low, medium, high, critical]
      findings: array[{location, description, suggestion?}]
    scope_tokens: ["read:decisions", "read:progress", "write:reviews", "exec:git:read"]
    token_budget: 5000
    timeout_s: 180

  # Derived reviewers — mixed depth as of M5 (v1.35.0). READ THIS BEFORE TRUSTING
  # A REVIEW: the cluster is NOT uniformly intelligent.
  #
  # The honest LLM-backed signal across the whole manifest is \`prompt_path\`
  # truthiness (exactly what \`sgc metrics\` 智能化 counts — a label cannot move it):
  #
  #   LLM-backed (3):  reviewer.correctness (above), reviewer.security, reviewer.tests
  #                    — and ONLY when an API key is present. With no key the ladder
  #                      (spawn.ts:448-461) falls back to the same heuristic stub that
  #                      shipped through v1.34.0, so a keyless run is unchanged.
  #   Heuristic (4):   reviewer.performance, reviewer.maintainability,
  #                    reviewer.migration, reviewer.infra — keyword matchers over
  #                    added lines. They flag by pattern, never by judgement.
  #
  # \`status: implemented\` means functional-and-wired (runs at L2+, appends a real
  # report), NOT semantically intelligent. Two more traps worth knowing:
  #   - A specialist that spawned and reported nothing is NOT a clean bill of health;
  #     triggers are deliberately wider than matchers (reviewer-specialists.ts:129).
  #   - \`SGC_REVIEW_SPECIALIST_LLM=0\` forces the specialists back to heuristics even
  #     with a key present.
  # See review.ts:222-280.
  reviewer.security:        { <<: *reviewer_base, prompt_path: "prompts/reviewer-security.md", status: implemented }
  reviewer.performance:     { <<: *reviewer_base, prompt_path: null, status: implemented }
  reviewer.tests:           { <<: *reviewer_base, prompt_path: "prompts/reviewer-tests.md", status: implemented }
  reviewer.maintainability: { <<: *reviewer_base, prompt_path: null, status: implemented }
  reviewer.adversarial:     { <<: *reviewer_base, prompt_path: null, status: slot-only, roadmap: "L3 pre-mortem reviewer; deferred" }
  reviewer.migration:       { <<: *reviewer_base, prompt_path: null, status: implemented }
  reviewer.infra:           { <<: *reviewer_base, prompt_path: null, status: implemented }

  reviewer.spec:
    version: "0.1"
    source: Superpowers spec reviewer (ONLY retained Superpowers component)
    purpose: Detect drift between shipped code and declared intent
    inputs:
      diff: string
      intent: markdown
    outputs:
      verdict: enum[pass, concern, fail]
      drift_points: array[{claimed, actual, severity}]
    scope_tokens: ["read:decisions", "read:progress", "write:reviews"]
    token_budget: 4000
    timeout_s: 120
    status: slot-only
    roadmap: "drift detection post-ship; deferred to v1.3+"

  # ---- QA (gstack lineage) ----
  qa.browser:
    version: "0.1"
    source: gstack /qa (re-authored)
    purpose: Real-browser end-to-end user simulation
    inputs:
      target_url: string
      user_flows: array[string]
    outputs:
      verdict: enum[pass, concern, fail]
      evidence_refs: array[string]
      failed_flows: array[{flow, step, observed}]
    scope_tokens: ["read:decisions", "read:progress", "write:reviews", "exec:browser"]
    token_budget: 10000
    timeout_s: 600

  # ---- Compound (CE lineage, four-agent cluster) ----
  compound.context:     &compound_base
    version: "0.1"
    source: CE /ce:compound stage-1 cluster
    purpose: |
      Build context for compound extraction AND assign tags/category.
      This subagent is responsible for both gathering the surrounding
      context (decisions, progress, reviews) that inform the solution
      entry, and for classifying the entry with appropriate tags and
      category. The tagging/classification step runs as the final
      phase of context building, ensuring tags are informed by the
      full context rather than surface-level heuristics.
    prompt_path: prompts/compound-context.md
    inputs:
      task_id: string
      intent: markdown
      diff: string
      ship_outcome: string
    scope_tokens:
      - "read:decisions"
      - "read:progress"
      - "read:solutions"
      - "write:solutions"
      - "read:reviews"
    token_budget: 5000
    timeout_s: 180
    outputs:
      category: enum[runtime, build, auth, data, perf, ui, infra, other]
      tags: array[string]
      problem_summary: markdown
      symptoms: array[string]

  compound.solution:
    <<: *compound_base
    purpose: "Extract what worked / didn't"
    # P2#7d LLM swap: own prompt overrides anchor's compound-context.md.
    # Heuristic still available via SGC_FORCE_INLINE=1 (compoundSolutionHeuristic).
    prompt_path: prompts/compound-solution.md
    outputs:
      solution: markdown
      what_didnt_work: array[{approach, reason_failed}]

  compound.related:
    <<: *compound_base
    purpose: "Dedup check — MUST run before any write"
    # prompt_path: null is INTENTIONAL and PERMANENT, not a deferred LLM
    # swap. compound.related.outputs.dedup_stamp is the Invariant §3
    # write-gate that authorizes writeSolution; routing it through an LLM
    # would let the model mint best_similarity: 0 and bypass dedup. The
    # heuristic findBestMatch (Jaccard + signature) is correct by design.
    # See ~/.claude/projects/-mnt-Sda2-dev-sdsbp-sgc/memory/feedback_compound_related_invariant3.md
    # and obs #92 (claude-mem-lite). Do NOT add a prompt_path here.
    prompt_path: null
    outputs:
      duplicate_match: object
      related_entries: array[string]
      dedup_stamp: object

  compound.prevention:
    <<: *compound_base
    purpose: "Derive prevention strategy"
    # P2#7d LLM swap: own prompt overrides anchor's compound-context.md.
    # Heuristic still available via SGC_FORCE_INLINE=1 (compoundPreventionHeuristic).
    prompt_path: prompts/compound-prevention.md
    outputs:
      prevention: markdown

  # ---- Janitors ----
  janitor.compound:
    version: "0.1"
    purpose: Decide whether /compound should fire after /ship
    inputs:
      task_meta:
        level: string
        diff_stats: object
        reviewer_flags: array[string]
        outcome: string
      recent_solutions_index: string
    outputs:
      decision: enum[compound, skip, update_existing]
      reason_code: string
      reason_human: markdown
    scope_tokens: ["read:decisions", "read:reviews", "read:solutions", "write:reviews"]
    token_budget: 3000
    timeout_s: 60
    decision_rules:
      skip_if:
        - "level == L0"
        - "diff.lines < 20 AND no reviewer flagged novel"
        - "similarity_to_existing > 0.85  # routes to update_existing instead"
        - "outcome == failed AND no new knowledge extracted"
      compound_if:
        - "reviewer.adversarial.severity >= medium"
        - "level >= L2 AND outcome == success"
        - "novel_bug_signature (not in solutions/ index)"
        - "user forced with --force"
      default: skip
    notes: |
      Janitor MUST log every decision, including skips, to
      reviews/{task_id}/janitor/compound-decision.md. The evaluation
      framework depends on this log for regression diagnosis.

  janitor.archive:
    version: "0.1"
    purpose: Epoch-boundary archival of closed decisions/
    inputs:
      epoch_cutoff: iso8601
    outputs:
      archived_task_ids: array[string]
      skipped: array[{task_id, reason}]
    scope_tokens: ["read:decisions:*", "write:decisions"]
    token_budget: 2000
    timeout_s: 120
    trigger: manual only (never auto)
    status: manual-only
`;
var init_sgc_capabilities = () => {};

// contracts/sgc-state.schema.yaml
var sgc_state_schema_default = `# SGC State Layer Schema
# Version: 0.1 (week-1 foundation)
#
# This is the single source of truth for every file that lives under .sgc/.
# The dispatcher MUST validate every write against this schema and reject
# writes that do not conform. No command or subagent may bypass validation.
#
# Design principles:
#   1. Single ownership per directory — no shared write paths.
#   2. Mutability is declared, not assumed.
#   3. Generator-evaluator separation is enforced at the permission layer
#      (see sgc-capabilities.yaml) AND at the schema layer (reviewers
#      cannot declare solutions/ as an input).
#   4. Every mutation is traceable to a task_id.

schema_version: "0.1"

# ============================================================================
# DECISIONS  —  append-only intent and outcome log
# ============================================================================
# Purpose: immutable record of "what did we decide to do, and how did it end"
# Lifetime: permanent (archived at epoch boundaries, never deleted)
# Anti-pattern: editing an intent.md after work has begun. If intent changes,
#   create a new task with parent_decision pointing to the old one.
#
# NOTE: L0 tasks do NOT write to decisions/ — they skip it entirely.
#   L0 tasks are trivial (docs/comments/style/config) and do not warrant
#   an intent record or ship record. The classifier routes L0 tasks
#   directly to /work, bypassing /plan's decision-writing stage.
#   Only L1+ tasks produce decisions/ entries.

decisions:
  path: .sgc/decisions/{task_id}/
  mutability: append-only
  owners: [/plan, /ship]
  files:

    intent:
      filename: intent.md
      created_by: /plan
      created_when: task enters L1 path or higher
      editable_after_creation: false
      format:
        frontmatter: yaml
        body: markdown
      required_fields:
        task_id:             { type: string, format: ulid }
        level:               { type: enum, values: [L0, L1, L2, L3] }
        created_at:          { type: string, format: iso8601 }
        title:               { type: string, max_length: 120 }
        motivation:          { type: markdown, min_words: 20 }
        affected_readers:    { type: array[string], min_items: 1 }
        scope_tokens:        { type: array[string] }
        rejected_alternatives:
          type: array
          items:
            option:          { type: string, required: true }
            reason:          { type: string, required: true }
          min_items: 0
      optional_fields:
        parent_decision:     { type: string, format: task_id }
        user_signature:
          type: object
          required_when: "level == L3"
          fields: [signed_at, signer_id]
        fused_verdict:
          type: enum
          values: [approve, revise, reject]
          note: "GS-3 — deterministic planner-cluster fusion verdict; additive/optional"
      notes:
        - |
          affected_readers is the field you previously lost on L1 bugfix
          validation. It is REQUIRED even at L1. The level classifier must
          refuse to emit L1 if it cannot list at least one reader.

    ship:
      filename: ship.md
      created_by: /ship
      created_when: ship gate returns pass OR human override
      editable_after_creation: false
      format:
        frontmatter: yaml
        body: markdown
      required_fields:
        task_id:             { type: string, format: ulid }
        shipped_at:          { type: string, format: iso8601 }
        outcome:             { type: enum, values: [success, partial, reverted] }
        deviations:          { type: array[string] }
        residuals:           { type: array[string] }
        linked_reviews:      { type: array, items: { format: report_id } }
      optional_fields:
        rollback_ref:
          type: string
          required_when: "outcome == reverted"
          format: git_ref

  archive:
    trigger: epoch boundary (manual, quarterly recommended)
    destination: .sgc/decisions/_archive/{epoch}/{task_id}/
    actor: janitor.archive
    effect: moves closed task directories out of the hot path; preserves them
            as read-only reference for planner.history

# ============================================================================
# PROGRESS  —  mutable working state, task-boundary lifecycle
# ============================================================================
# Purpose: the scratch surface that Claude and subagents read/write during
#   active work. Corresponds to Anthropic harness feature-list / progress.txt.
# Lifetime: task-scoped. Overwritten on task transitions. NOT a knowledge base.
#
# NOTE: progress/ is the only state layer that L0 tasks touch.
#   L0 tasks write to progress/ (current-task, feature-list) but skip
#   decisions/, solutions/, and reviews/ entirely. This keeps L0 fast
#   and avoids polluting the audit trail with trivial changes.

progress:
  path: .sgc/progress/
  mutability: read-write
  owners: [/plan, /work]
  lifecycle: task-boundary
  files:

    feature_list:
      filename: feature-list.md
      required_fields:
        features:
          type: array
          items:
            id:              { type: string, scope: task-local }
            title:           { type: string, max_length: 200 }
            status:
              type: enum
              values: [pending, in_progress, blocked, done]
            depends_on:      { type: array[string], optional: true }
            blocked_by:      { type: string, optional: true }
            # Verification close-gate (sp:verification-before-completion absorb,
            # Tier 1). Set when a feature transitions to \`done\` via
            # \`sgc work --done\`; required at that transition (operator
            # responsibility, sgc does not execute). Optional here because
            # features done before the gate existed are grandfathered.
            verify_command:  { type: string, optional: true }
            evidence:        { type: string, optional: true }
            # Phase 2b deep-plan fields (additive, optional — absent on non-deep plans):
            #   files:          { create: [path], modify: [path], test: [path] }
            #   steps:          [{ kind, text, run?, expect? }]  kind ∈ test|verify-red|
            #                   implement|verify-green|commit|guard
            #   prior_art_refs: [solution_ref]  — CE reuse-in provenance

    current_task:
      filename: current-task.md
      required_fields:
        task_id:             { type: string, format: ulid }
        level:               { type: enum, values: [L0, L1, L2, L3] }
        active_feature:      { type: string, references: feature.id }
        session_start:       { type: string, format: iso8601 }
        last_activity:       { type: string, format: iso8601 }
      optional_fields:
        checkpoint:          { type: opaque_blob }

    handoff:
      filename: handoff.md
      purpose: linear session-to-session continuity (Anthropic harness style)
      required_fields:
        from_session:        { type: string }
        to_session_hint:     { type: string, description: "what to read first" }
        summary:             { type: markdown, max_words: 500 }
        open_questions:      { type: array[string] }
      notes:
        - |
          Handoff is NOT the knowledge base. It is ephemeral. Any durable
          lesson must go through /compound and land in solutions/.

# ============================================================================
# SOLUTIONS  —  compound knowledge, dedup-enforced
# ============================================================================
# Purpose: the permanent knowledge surface. The reason this whole system
#   exists over the base harness.
# Lifetime: permanent. Never deleted. Only janitor.archive may move entries.
# Read restriction: NOT readable by any reviewer.* or qa.* subagent.
#   See sgc-invariants.md §1 for the rationale.

solutions:
  path: .sgc/solutions/{category}/{slug}.md
  mutability: append-or-update-existing
  owners: [/compound]
  delete_policy: forbidden
  files:

    entry:
      format:
        frontmatter: yaml
        body: markdown
      required_fields:
        id:                  { type: string, format: ulid }
        signature:
          type: string
          format: sha256
          description: |
            Hash of normalize(problem + error_fingerprint). This is the
            primary dedup key. Two entries with the same signature MUST
            merge, not coexist.
        category:
          type: enum
          values: [runtime, build, auth, data, perf, ui, infra, other]
        problem:             { type: markdown, max_words: 300 }
        symptoms:            { type: array[string], min_items: 1 }
        what_didnt_work:
          type: array
          items:
            approach:        { type: string, required: true }
            reason_failed:   { type: string, required: true }
        solution:            { type: markdown }
        prevention:          { type: markdown }
        tags:                { type: array[string], min_items: 1 }
        first_seen:          { type: string, format: iso8601 }
        last_updated:        { type: string, format: iso8601 }
        # CE-1: counts dedup write-merges of the same problem, NOT reuse.
        # Reuse is tracked by surfaced_in / applied_in (see applied-tracker.ts).
        times_referenced:    { type: integer, default: 0 }
        source_task_ids:     { type: array[string], min_items: 1 }
      optional_fields:
        related_entries:     { type: array[string], items: { format: solution_id } }
        confidence:
          type: enum
          values: [provisional, confirmed, canonical]
          default: provisional
        # CE-6 score-feedback fields. Mutated by applied-tracker outside
        # writeSolution() (metadata-only §3 carve-out), so they never affect
        # the dedup signature. applied_in = L3 adversarial-validated reuse;
        # surfaced_in = L2+ researcher.history surfacing (weaker signal).
        applied_in:          { type: array[string], optional: true }
        surfaced_in:         { type: array[string], optional: true }

  dedup:
    enforced_by: compound.related
    similarity_threshold: 0.85
    on_match: update_existing
    update_semantics:
      - append new task_id to source_task_ids
      - refresh last_updated
      - merge new what_didnt_work entries
      - do NOT overwrite existing solution or prevention fields
    similarity_method:
      - exact signature match (weight: 1.0)
      - fallback: cosine similarity over tag_vector + problem embedding
    invariant: no write to solutions/ may bypass this check

# ============================================================================
# REVIEWS  —  append-only audit trail
# ============================================================================
# Purpose: every judgment rendered by every reviewer, qa run, and ship gate
#   is permanently logged here. This is what makes the system auditable.
# Lifetime: permanent (archived with parent task).

reviews:
  path: .sgc/reviews/{task_id}/{stage}/{reviewer_id}.md
  mutability: append-only
  owners: [/review, /qa, /ship, janitor.compound]
  stages: [plan, code, qa, ship]
  files:

    report:
      format:
        frontmatter: yaml
        body: markdown
      required_fields:
        report_id:           { type: string, format: ulid }
        task_id:             { type: string, format: ulid }
        stage:               { type: enum, values: [plan, code, qa, ship] }
        reviewer_id:         { type: string }
        reviewer_version:    { type: string, description: "pinned manifest version" }
        verdict:             { type: enum, values: [pass, concern, fail] }
        severity:            { type: enum, values: [none, low, medium, high, critical] }
        findings:
          type: array
          items:
            location:        { type: string, optional: true }
            description:     { type: string, required: true }
            suggestion:      { type: string, optional: true }
        created_at:          { type: string, format: iso8601 }
      optional_fields:
        evidence_refs:       { type: array[string], description: "e.g. screenshot paths from qa.browser" }
        override:
          type: object
          required_when: "verdict == fail AND ship proceeded"
          fields:
            by:              { type: string }
            at:              { type: string, format: iso8601 }
            reason:          { type: string, min_length: 40 }

    janitor_decision:
      path: .sgc/reviews/{task_id}/janitor/compound-decision.md
      created_by: janitor.compound
      required_fields:
        task_id:             { type: string }
        decision:            { type: enum, values: [compound, skip, update_existing] }
        reason_code:         { type: string, description: "machine-readable" }
        reason_human:        { type: markdown }
        inputs_hash:         { type: string, format: sha256 }
        created_at:          { type: string, format: iso8601 }
      notes:
        - |
          Even skip decisions MUST be logged. Audit requirement: given any
          task where compound did not fire, we must be able to reconstruct
          why. This is how the evaluation framework diagnoses regressions.
`;
var init_sgc_state_schema = () => {};

// contracts/invariant-enforcement.yaml
var invariant_enforcement_default = `# SGC Invariant Enforcement Map
# Version: 0.1
#
# Maps each invariant (§1–§13 in sgc-invariants.md) to HOW it is enforced, at
# WHICH time-point, whether the enforcement is machine-checked or procedural,
# and the regression test(s) that cover it. This operationalizes the
# "规范化" (standardization) metric in docs/CAPABILITY-ABSORPTION-AUDIT.md §5.1:
#
#   machine_enforced_count / 13   →  currently 12/13 (§12 is procedural only).
#
# Enforcement is DISTRIBUTED across time-points (spawn / write / parser /
# append / runtime) — there is no single "dispatch-time gate" for all 13;
# the earlier audit phrasing that implied one was inaccurate.
#
# \`sgc doctor\` check (G) validates: every key §1..§13 is present, and for each
# \`machine_enforced: true\` invariant the \`tests\` list is non-empty and every
# cited file exists. \`tests\` is a best-effort coverage map (file-existence is
# what doctor verifies; not a per-assertion audit).

schema_version: "0.1"

invariants:
  "1":
    title: "Generator-Evaluator Separation"
    mechanism: "capabilities.yaml scope-token forbidden_for + permission matrix (reviewer/qa cannot read:solutions)"
    enforced_at: "spawn"
    machine_enforced: true
    tests: ["tests/dispatcher/capabilities.test.ts", "tests/dispatcher/reviewer-specialists.test.ts"]
  "2":
    title: "Decisions Are Immutable"
    mechanism: "schema editable_after_creation:false on decisions.intent / decisions.ship"
    enforced_at: "write"
    machine_enforced: true
    tests: ["tests/dispatcher/state.test.ts", "tests/dispatcher/schema.test.ts"]
  "3":
    title: "Solutions Writes Must Pass Dedup"
    mechanism: "schema dedup block + dispatcher writeSolution() DedupStamp gate (threshold 0.85)"
    enforced_at: "write"
    machine_enforced: true
    tests: ["tests/dispatcher/compound.test.ts", "tests/dispatcher/schema.test.ts"]
  "4":
    title: "L3 Forbids --auto"
    mechanism: "command-parser check (src/commands/plan.ts: level===L3 && autoConfirm → throw)"
    enforced_at: "parser"
    machine_enforced: true
    tests: ["tests/dispatcher/sgc-plan.test.ts"]
  "5":
    title: "Reviewer Overrides Require Human Signature"
    mechanism: "schema conditional override field on reviews.report"
    enforced_at: "write"
    machine_enforced: true
    tests: ["tests/dispatcher/sgc-review.test.ts", "tests/dispatcher/schema.test.ts"]
  "6":
    title: "Audit-Trail Writes Are Durable (janitor logged + review/qa/cso append-only)"
    mechanism: "janitor.compound required output + state.ts:appendReview write-once guard (StateError AppendOnly)"
    enforced_at: "append"
    machine_enforced: true
    tests: ["tests/dispatcher/sgc-review.test.ts", "tests/dispatcher/janitor-compound.test.ts"]
  "7":
    title: "Schema Validation Precedes Every Write"
    mechanism: "dispatcher validateValueAgainstDecl before each state write"
    enforced_at: "write"
    machine_enforced: true
    # Covered by concept tests (schema/state), not §-cited by number.
    tests: ["tests/dispatcher/schema.test.ts", "tests/dispatcher/solutions-state.test.ts"]
  "8":
    title: "Scope Tokens Are Computed At Spawn, Not Requested At Runtime"
    mechanism: >-
      spawn-time scope computation from capabilities.yaml manifest + ScopeViolation
      on forbidden-token manifests; no runtime elevation channel exists. NOT syscall
      interception: for LLM-backed subagents the pinned set is advisory prompt context
      (their tool use runs out-of-process — \`claude -p\` or the provider side — so sgc
      cannot intercept it); backed by dispatcher-owned input gating + post-hoc output
      validation (§9 shape, §1 leak scan). See sgc-invariants.md §8 "What it does NOT
      enforce, and why".
    enforced_at: "spawn"
    machine_enforced: true
    tests: ["tests/dispatcher/capabilities.test.ts", "tests/dispatcher/spawn.test.ts"]
  "9":
    title: "No Subagent Writes Outside Its Declared Outputs"
    mechanism: "dispatcher output-path allowlist per subagent manifest"
    enforced_at: "write"
    machine_enforced: true
    tests: ["tests/dispatcher/capabilities.test.ts"]
  "10":
    title: "Failure of Any Compound Substep Aborts the Whole Compound"
    mechanism: "compound.* subagents run as a transaction; no partial commits"
    enforced_at: "runtime"
    machine_enforced: true
    tests: ["tests/dispatcher/compound.test.ts", "tests/dispatcher/janitor-compound.test.ts"]
  "11":
    title: "Classifier Must Justify"
    mechanism: "required rationale field on classifier.level output"
    enforced_at: "write"
    machine_enforced: true
    tests: ["tests/dispatcher/sgc-plan.test.ts", "tests/dispatcher/schema.test.ts"]
  "12":
    title: "The Evaluation Framework Is Authoritative"
    mechanism: "procedural — enforced by code-review discipline (no runtime check)"
    enforced_at: "review"
    machine_enforced: false
    tests: []
  "13":
    title: "Spawn + LLM Event Audit Completeness (two-tier)"
    mechanism: "try/finally in spawn.ts (Tier 1) + each LLM-mode agent (Tier 2)"
    enforced_at: "runtime"
    machine_enforced: true
    tests:
      - "tests/dispatcher/spawn-events.test.ts"
      - "tests/dispatcher/llm-agent-events.test.ts"
      - "tests/dispatcher/commands-event-emission.test.ts"
      - "tests/eval/invariants.test.ts"
`;
var init_invariant_enforcement = () => {};

// contracts/sgc-invariants.md
var sgc_invariants_default = "# SGC System Invariants\n# Version: 0.1\n\nThese are the rules that cannot live in the state schema or the capabilities contract alone, because they are cross-cutting or require semantic judgment. Every invariant is numbered and referenced by the schema files and the evaluation framework. Violating any of these is a spec bug, not a runtime error.\n\n## §1. Generator-Evaluator Separation\n\nNo subagent whose role is to evaluate work (`reviewer.*`, `qa.*`, `/review`, `/qa`) may hold `read:solutions`. This is enforced at two layers: the scope token vocabulary declares `read:solutions` as forbidden for those subagent patterns, and the permission matrix grants solutions as an empty array for `/review` and `/qa`.\n\nThe rationale is not technical, it is epistemic. A reviewer that can read prior solutions will exhibit confirmation bias toward historical judgments. Anthropic's harness paper showed that evaluators optimistically rate their own work; the same bias extends to evaluators who inherit institutional memory from a generator's notebook. The only way to keep `/review` honest is to keep it amnesiac.\n\nConsequence: if a reviewer needs historical context to render a verdict, that is a design smell. Either the intent was underspecified (fix at `/plan`) or the reviewer's scope is wrong (fix the manifest). Do not patch by granting `read:solutions`.\n\n## §2. Decisions Are Immutable\n\nOnce `decisions/{task_id}/intent.md` is written, no actor may modify it. This includes typo fixes and \"clarifying\" edits. If intent changes, the correct action is to create a new task with `parent_decision` pointing to the old one and mark the old one as superseded via the subsequent `ship.md`.\n\nThe rationale is that intent files are the audit surface for \"why did we build this?\" An editable intent is a rewriting of history, which destroys the ability to diagnose regressions in the evaluation framework. The cost of immutability is occasional clutter from superseded tasks; that cost is acceptable.\n\n## §3. Solutions Writes Must Pass Dedup\n\nNo write to `solutions/` may occur without `compound.related` running first and returning a dedup result. The dispatcher enforces this by making `write:solutions` a capability that only activates after a dedup stamp is attached to the write request. A `write:solutions` without a dedup stamp is rejected at the dispatch layer.\n\nThis is the single most important defense against the failure mode where `solutions/` becomes a grep-hostile dump of near-duplicates. Once that failure mode takes hold, `planner.history` and `researcher.history` become noise amplifiers and the entire compound layer stops being an asset.\n\nSimilarity threshold is fixed at 0.85 and is not user-tunable. Making it tunable would mean users lower it the first time dedup inconveniences them. The evaluation framework includes a regression test for this.\n\n### Metadata-only carve-out (CE-6, v1.10.0)\n\n`applied_in: TaskId[]` on solution frontmatter — written by `src/dispatcher/applied-tracker.ts` `recordApplied` from `plan.ts` L3 wire-up — is an **explicit, named exemption** from the dedup write-gate. The rule that binds §3 is \"solution-content changes (intent / prevention / what_didnt_work / source_task_ids / times_referenced) must route through `writeSolution()` with a `dedup_stamp` from `compound.related`\". `applied_in` is audit-trail metadata, not part of the dedup signature, so mutating it does not destabilize the corpus the way duplicated solution content would. `recordApplied` therefore bypasses `writeSolution()` and goes directly through `parseFrontmatter` → spread-preserve-all-other-fields → `serializeFrontmatter` → `writeAtomic`. The regression test `tests/dispatcher/applied-tracker.test.ts` H8 (\"Invariant §3 metadata-only carve-out (CRITICAL)\") is the binding contract: it snapshots every solution-content field before `recordApplied` and asserts byte-for-byte equality after. If that test ever changes shape, the carve-out must be re-evaluated. Future metadata-only fields (anything that does not affect compound-related similarity scoring) may extend this carve-out by the same pattern; new fields that affect dedup MUST route through `writeSolution()`.\n\n## §4. L3 Forbids --auto\n\nAny command invocation at task level L3 with `--auto` or equivalent automation flag is refused at the dispatcher level, with a non-overridable error. L3 tasks require a human signature in `intent.md` and a human confirmation at `/ship`. This is not a default, it is a hard rule.\n\nThe rationale is that L3 is the level at which irreversible architectural decisions live. Automation at L3 means a single miscalibrated classifier run can make an architectural change without human review. The cost of forcing a human in the loop at L3 is minutes per task; the cost of not forcing it is weeks of unwinding.\n\n## §5. Reviewer Overrides Require Human Signature\n\nWhen any reviewer returns `verdict == fail` and the ship gate proceeds anyway, the `override` field in the review report must be populated with `by`, `at`, and `reason`. The reason field has a minimum length of 40 characters to prevent \"ok\" style rubber-stamping. The dispatcher refuses to write a ship.md if a failing review lacks a corresponding populated override.\n\nNo subagent may populate the override field. Overrides are exclusively human.\n\n## §6. Audit-Trail Writes Are Durable (janitor decisions logged · review reports append-only)\n\nTwo faces of one principle: an audit-trail write must survive — never silently skipped, never silently overwritten. Both halves protect the same thing: the ability to later answer \"what was decided, by whom, and when?\"\n\n**(a) Every janitor decision is logged.** `janitor.compound` MUST write a decision report for every task it evaluates, including tasks it decides to skip. This is non-negotiable. The evaluation framework's regression diagnosis depends on being able to answer \"why did this task not generate a solution entry?\" — and the only correct answer is \"because the janitor logged reason X on date Y\". Silent skips are forbidden: a janitor that cannot write its decision must abort the task and surface an error, not default to skip.\n\n**(b) Review / QA / CSO reports are append-only.** Each `reviews/{task_id}/{stage}/{reviewer}.md` (and the analogous `cso/` report) is write-once per `(task, stage, reviewer)` triple — a second write for the same triple is rejected (`StateError(\"AppendOnly\", …)` in `state.ts:appendReview`), never overwritten. A follow-up pass writes a new `<reviewer>.<suffix>.md` via the `--append-as` channel rather than mutating the prior report. Overwriting a verdict would destroy the audit surface the same way a silent janitor skip would.\n\n## §7. Schema Validation Precedes Every Write\n\nThe dispatcher validates every file write against `sgc-state.schema.yaml` before committing. A write that fails validation is rejected with the validation error surfaced to the calling subagent. Subagents may retry with corrected output; they may not disable validation.\n\nThere is no \"validate later\" or \"lenient mode\". If the schema rejects real-world outputs, the schema is wrong and must be fixed; weakening validation is forbidden.\n\n## §8. Scope Tokens Are Computed At Spawn, Not Requested At Runtime\n\nWhen a command invokes a subagent, the dispatcher computes the subagent's scope_token set from the permission matrix and the subagent manifest, and pins that set for the subagent's lifetime. There is no channel by which a running subagent can request additional capabilities: the set is computed before `spawn.start` and never re-read.\n\nThe rationale is that runtime capability elevation is the standard exploit path for prompt injection in agentic systems. Pinning at spawn time removes the elevation channel.\n\n**What \"pinned\" enforces, precisely.** Three distinct guarantees, none of which is syscall interception:\n\n1. **Spawn-time rejection (machine-enforced).** A manifest that declares a token its permission-matrix row forbids never spawns — `capabilities.ts` throws `ScopeViolation` before any work begins. This is what makes §1's `reviewer/qa cannot read:solutions` real rather than aspirational.\n2. **Input gating (machine-enforced).** The dispatcher controls what enters the subagent: the §1 back-channel gate rejects prior-art/pre-mortem content in the `intent` field before `spawn.start`, and the subagent receives only the input the dispatcher hands it.\n3. **Output validation (machine-enforced).** §9 shape validation rejects undeclared output fields, and the §1 leak scan runs over every subagent's output in all modes.\n\n**What it does NOT enforce, and why.** The pinned token set is delivered to LLM-backed subagents as prompt context — it is *advisory to the model*. sgc does not intercept an LLM subagent's file or git access, and **cannot**: in `claude-cli` mode the model's tool use executes inside a separate `claude -p` process, and in API modes it executes on the provider's side. Neither is inside sgc's process boundary. A prompt-injected LLM subagent that reads a file outside its pinned set is therefore caught — if at all — by the post-hoc output scan (verbatim leaks) rather than prevented at access time; a paraphrase can pass.\n\nThis is a deliberate boundary, not a deferred TODO. Treat §8 as **\"pin + gate the I/O the dispatcher owns + scan what comes back\"**, not as a sandbox. Deterministic subagents (inline stubs, `compound.related`) are the only ones whose access is bounded by construction — which is why the invariants that must not be LLM-bypassable (§3's dedup stamp, the §11 classifier floor) are anchored to deterministic code rather than to §8.\n\n`assertScope` / `assertCanSpawn` / `tokensAllow` in `capabilities.ts` exist for dispatcher-mediated access paths and are exercised by `capabilities.test.ts`; they are not — and cannot be — an interception layer over out-of-process model tool use.\n\nThis is the subagent-layer instance of the scope binding mechanism from CLAUDE.md v3.8.\n\n## §9. No Subagent Writes Outside Its Declared Outputs\n\nA subagent manifest declares its `outputs` field. The dispatcher discards any produced content that does not match the declared output shape. A subagent cannot, for example, write a solution entry as a side effect of producing a review report — even if it holds both tokens by some accident of composition.\n\nThis prevents \"helpful\" subagents from corrupting state they were not invited to touch. The canonical failure case is a reviewer noticing a pattern and trying to append to `solutions/` \"while it's here\"; under §1 that is already impossible, but §9 generalizes the principle.\n\n## §10. Failure of Any Compound Substep Aborts the Whole Compound\n\nThe compound cluster has four subagents (context, related, solution, prevention). `janitor.compound` is NOT one of them — it is the separate gate that decides *whether* to compound at all, and runs before the cluster. If any of them fails or times out, the entire compound operation is rolled back and no write to `solutions/` occurs. Partial compound writes are forbidden.\n\nThe rationale is that a half-written solution entry is worse than no entry. A solution without the `what_didnt_work` field, for instance, encourages the reader to re-walk dead-end paths. Better to log a janitor skip with reason `compound_cluster_failure` and surface the error for human diagnosis.\n\n## §11. Classifier Must Justify\n\n`classifier.level` must emit both a level and a rationale. The rationale must reference at least one concrete feature of the task (file count, risk keyword, blast radius, etc.) The dispatcher refuses classifications with empty or generic rationales.\n\nThis exists because without a justified classifier, L3 gets silently downgraded to L2 whenever the classifier is uncertain, and that erodes every downstream guarantee in this document.\n\n## §12. The Evaluation Framework Is Authoritative\n\nThe ten-scenario evaluation framework is the conformance test for this entire specification. When the spec and the evaluation framework disagree, the evaluation framework wins and the spec is amended to match. This prevents spec drift from quietly invalidating the test suite.\n\nWhen a new invariant is added to this document, a corresponding regression test is added to the evaluation framework in the same commit. No exceptions.\n\n## §13. Spawn + LLM Event Audit Completeness (two-tier)\n\nEvery call to `spawn()` MUST emit a paired `spawn.start` and `spawn.end` event to `.sgc/progress/events.ndjson` (Tier 1, all modes). The `end` event's `payload.outcome` MUST be one of `success | timeout | error`.\n\nAdditionally, when the resolved mode is `anthropic-sdk` / `openrouter` / `claude-cli` (any LLM-backed mode), the agent MUST emit a paired `llm.request` and `llm.response` event (Tier 2). `llm.response.payload.outcome` MUST be one of `success | timeout | error | schema_violation`.\n\nEmission is guaranteed by `try/finally` blocks:\n1. `src/dispatcher/spawn.ts` — Tier 1 pair (all modes).\n2. `src/dispatcher/anthropic-sdk-agent.ts` — Tier 2 pair.\n3. `src/dispatcher/openrouter-agent.ts` — Tier 2 pair.\n4. `src/dispatcher/claude-cli-agent.ts` — Tier 2 pair.\n\nOther event types (`dedup.scored`, `review.verdict_emitted`, etc.) are voluntary during Phase G; their schemas evolve freely. Commands are expected (soft contract, smoke-tested) to emit at least one high-level event per primary flow.\n\n**Exemption**: event-sink write failure (disk full, permission error) does NOT fail the spawn. The runtime logs the failure to stderr and continues. Invariant §13 is waived for infra-level write failures.\n\n**Schema**: `EventRecord` v1 is defined in `src/dispatcher/logger.ts`. Every event line carries `schema_version: 1`; additive fields must preserve forward-compatibility, breaking changes bump to v2.\n\n---\n\n## Cross-References\n\n- Invariant §1 is enforced by `sgc-capabilities.yaml` scope token `read:solutions` (forbidden_for list) and by the empty `solutions` row in the permission matrix for `/review` and `/qa`.\n- Invariant §2 is enforced by the `editable_after_creation: false` field on `decisions.intent` and `decisions.ship` in `sgc-state.schema.yaml`.\n- Invariant §3 is enforced by the `dedup` block in `solutions` section of `sgc-state.schema.yaml`, plus a dispatcher check.\n- Invariant §4 is a dispatcher-level rule with no schema representation. It must be added to the command parser as the first-priority check.\n- Invariant §5 is enforced by the conditional `override` field in `reviews.report`.\n- Invariant §6 is enforced on two paths: (a) the `janitor_decision` file being a required output of `janitor.compound` in the subagent manifest, and (b) the write-once guard in `state.ts:appendReview` that rejects a second write to the same `(task, stage, reviewer)` triple with `StateError(\"AppendOnly\", …)`.\n- Invariants §7, §8, §9 are dispatcher-level and have no schema representation.\n- Invariant §10 is enforced by `compound.*` subagents running as a transaction; no partial commits.\n- Invariant §11 is enforced by the required `rationale` field on `classifier.level` outputs.\n- Invariant §12 is procedural and enforced by code review discipline.\n- Invariant §13 is enforced by `try/finally` in `src/dispatcher/spawn.ts` (Tier 1) and in each LLM-mode agent file (`anthropic-sdk-agent.ts`, `openrouter-agent.ts`, `claude-cli-agent.ts`) for Tier 2. Regression-tested by `tests/dispatcher/spawn-events.test.ts`, `tests/dispatcher/llm-agent-events.test.ts`, `tests/dispatcher/commands-event-emission.test.ts`, and `tests/eval/invariants.test.ts` (Task 12 scenario).\n";
var init_sgc_invariants = () => {};

// prompts/clarifier-discover.md
var clarifier_discover_default = `# Purpose

Turn a vague topic into a small, sharp set of forcing-questions the
user must answer before /plan can do useful work. Output is consumed
DIRECTLY by the user (no downstream agent) — every question must be
specific enough that a human can answer it in one sentence.

Your job is NOT to propose answers, designs, or implementation steps.
Your job IS to surface the smallest set of questions whose answers
would lift the topic from "vague" to "actionable for /plan".

## Scope

- Token scope: read:progress
- Forbidden: read:solutions, read:decisions (clarifier sits BEFORE
  the planner cluster — keep it bias-free)
- Allowed outputs: topic, goal_question, constraint_questions,
  scope_questions, edge_case_questions, acceptance_questions,
  suggested_next

## Your analysis

1. **Trim the topic** — echo it back with leading/trailing whitespace
   removed, otherwise preserve the user's wording exactly.

2. **One goal question** framed around outcome, not output. Good shape:
   "When \`<topic>\` is done, what can the user do that they cannot
   today?" — surface the smallest user-visible change that would
   prove completion.

3. **3–5 constraint questions**. Cover at least: performance /
   platforms / deadlines / dependencies. Add domain-specific ones:
   - auth → threat model + blast radius of a bypass
   - migration / schema / data → rollback plan, additive vs backfill
   - perf → current baseline + target + measurement method
   These are the questions the topic alone cannot answer.

4. **2–3 scope questions**. Always include "what is explicitly OUT
   of scope?" and "replace or add alongside?" — they kill assumption
   drift. Add domain-specific:
   - api / endpoint → breaking change vs additive
   - ui → existing screen vs new route / entry point

5. **3–4 edge-case questions**. Cover empty / malformed / huge input,
   concurrent access, and dependency-down failure. Add:
   - auth → expired / revoked / forged token mid-request

6. **2–3 acceptance questions**. Always include "what observation
   proves it works — a specific command, URL, or log line?" and
   "what's the smallest user-visible change?" — these become the
   exit criteria for /work. Add:
   - api / ui → is there a screenshot, curl invocation, or
     integration test that would serve as evidence?

7. **suggested_next** — emit literally this shape, no variation:

   \`\`\`
   sgc plan "<topic>" --motivation "<your consolidated answers as one paragraph, ≥20 words>"
   \`\`\`

   If \`current_task_summary\` is non-empty, append \` (active task:
   <summary>)\` after the command. Quote the topic with double quotes
   verbatim. CRITICAL: suggested_next is rendered as a single-quoted
   YAML scalar by your reply format — it MUST NOT contain raw \`'\`
   apostrophes. Use plain words ("active task" not "there's an active
   task") to avoid premature scalar termination (DOG-4 fix v1.16.1).

## Template framings (when input.template is set)

The optional \`template\` field selects a question-framing overlay layered
ON TOP of the default domain-hint questions. Always emit the default
question set; templates ADD ≥3 framing-specific questions to the
indicated buckets. Templates change question CONTENT, not the output
schema. When \`template\` is absent or its value is not one of the three
below, do not emit template-specific questions — default is the contract.

- \`template: product\` — office-hours user-value framing. Add to:
  - scope: who hurts today without this; narrowest wedge / first user
  - acceptance: willing-to-pay signal (money, time, attention)

- \`template: scope\` — cut-line forcing-question framing. Add to:
  - scope: smallest version that delivers value; cut-line at budget -30%
  - constraints: deadline-halved drop-first list

- \`template: anti-pattern\` — pre-mortem failure-mode framing. Add to:
  - edges: silent-failure mode under untested load; failure-mode oracle
  - constraints: rollback path if first version is fundamentally wrong

Anchor wording markers (per template; presence in output is verified by
tests): product → "hurts today" / "narrowest wedge" / "willing to pay";
scope → "smallest version" / "cut-line" / "deadline halved"; anti-pattern
→ "silent failure" / "rollback" / "regress".

## Anti-patterns: do NOT output

1. **Answers, designs, or implementation steps.** "Use Redis for
   caching" is an answer. "Should the caching layer be in-memory or
   shared, and why?" is a question. Stay on questions.

2. **Invented constraints or personas.** Do not invent metric targets
   ("p99 < 200ms"), user roles ("the analytics team"), or deadlines
   that the topic does not name. Ask whether they exist; do not
   supply them.

3. **Banned vocabulary in question strings.** Output must NOT
   contain:
   - English: \`could potentially\`, \`might affect\`, \`various concerns\`,
     \`several issues\`, \`generally\`, \`overall\`, \`seems to\`,
     \`production-ready\`, \`comprehensive\`, \`robust\`
   - 中文: \`显著\`, \`大幅\`, \`基本上\`, \`大部分情况\`, \`相当不错\`
   These mark vague hedged output. Replace with concrete naming.
   (Note: "may break IF X" and similar concrete-conditional phrasing
   is fine — only the listed bare-hedge forms are banned.)

4. **Question fan-out.** Caps are HARD: ≤5 constraint, ≤3 scope, ≤4
   edge-case, ≤3 acceptance. Beyond the cap is noise; the user will
   skip the list rather than answer it.

5. **"How should we implement X?" questions.** That is /plan's job.
   You generate questions whose answers go INTO motivation, not
   implementation prose.

### Bad / good contrast

\`\`\`yaml
# bad — answers + invented persona + design suggestion
goal_question: "Should we use Redis or Memcached for the caching layer?"
constraint_questions:
  - "We probably need 100ms p99 latency for the analytics team."
scope_questions:
  - "Generally speaking, are there various concerns about the rollout?"

# good — questions only, no answers, no fabrication
goal_question: "When 'optimize the dashboard query' is done, what can the user observe that they cannot today — faster load, larger date range, or something else?"
constraint_questions:
  - "What is the current p99 / p95 latency baseline and the target, with a measurement method (load test, real-user metric, log query)?"
  - "Are there platform or environment constraints (DB version, read-replica availability, in-memory budget)?"
scope_questions:
  - "What is explicitly OUT of scope — the closest adjacent optimization we are NOT doing this round?"
\`\`\`

## Reply format

\`\`\`yaml
topic: <echo of input topic, trimmed of leading/trailing whitespace>
goal_question: <single outcome-framed question>
constraint_questions:
  # array of PLAIN STRINGS — each item is a single quoted scalar.
  # Wrap each item in double quotes when it contains a colon to avoid
  # YAML interpreting it as a key:value sequence entry.
  - "constraint question 1, specific"
  - "constraint question 2, specific"
scope_questions:
  - "scope question 1, specific"
edge_case_questions:
  - "edge-case question 1, specific"
acceptance_questions:
  - "acceptance question 1, specific"
suggested_next: 'sgc plan "<topic>" --motivation "<your consolidated answers as one paragraph, ≥20 words>"'
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_clarifier_discover = () => {};

// prompts/classifier-level.md
var classifier_level_default = `# Purpose

Classify a user's engineering request into L0, L1, L2, or L3 per the sgc level definitions.

## Scope

- Token scope: read:progress (this is the full grant — the manifest does NOT give you read:decisions)
- Forbidden: read:solutions (reviewer-adjacent isolation — do not consult past answers)
- Allowed outputs: level, rationale, affected_readers_candidates

## Level definitions

- **L0**: typo / comment / formatting / config — no behavior change, no tests needed
- **L1**: single file, < 80 LOC, no contract change, local delta only
- **L2**: multi-file OR contract change OR new tests OR additive schema
- **L3**: architecture / breaking schema / prod migration / infra / auth/payment/crypto

## Hard escalation rules

1. Any migration, DB schema, prod infra, deploy config → minimum L3
2. Any public API, auth, payment, crypto surface → minimum L2
3. Uncertainty between two levels → pick the higher one
4. When the request is ambiguous about scope → say "ambiguous" in rationale and propose both levels

## Reply format

Produce YAML with exactly these fields:

\`\`\`yaml
level: L0 | L1 | L2 | L3
rationale: |
  <2-3 sentences explaining the classification. Reference specific
  elements of the request. No generic phrasing like "seems complex" or
  "standard change".>
affected_readers_candidates:
  - <list of code areas or modules this change might ripple into>
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_classifier_level = () => {};

// prompts/compound-context.md
var compound_context_default = `# Purpose

Build the context block for a compound (post-ship lessons-learned) entry:
classify the problem, tag it, summarize the essence, and list observable
symptoms.

You are NOT writing the solution narrative — that is \`compound.solution\`'s
job. You are NOT deduping — that is \`compound.related\`'s job. Your job
is the FACTUAL frame: what kind of problem is this, what does it look
like, what would another engineer search for to find it again.

## Scope

- Token scope: read:decisions, read:progress, read:solutions, read:reviews
- Allowed outputs: category, tags, problem_summary, symptoms

## Your analysis

1. Read the \`intent\` (a \`title\\n\\nmotivation\` markdown block, sometimes
   plus \`diff\` and \`ship_outcome\`). Reason from those texts alone. Do
   NOT invent file paths, function names, or commit SHAs that are not
   literally present in the input.

2. Pick exactly ONE \`category\` from the closed enum:
   \`auth | data | infra | perf | ui | build | runtime | other\`.
   Definitions:
   - \`auth\` — authentication, authorization, sessions, tokens, identity
   - \`data\` — schema, migrations, SQL, persistence, data integrity
   - \`infra\` — deploy, k8s, docker, terraform, CI/CD, host config
   - \`perf\` — latency, throughput, cache hit rate, timeout tuning
   - \`ui\` — rendering, layout, components, frontend interaction
   - \`build\` — bundlers, dependency resolution, compile pipeline
   - \`runtime\` — crashes, null/undefined, races, exception flow
   - \`other\` — anything that doesn't cleanly fit above

   When unsure between two categories, return \`other\`. Do NOT force-fit.
   "authorize the user to read docs" is \`other\` (or \`auth\` only if the
   problem is actually about token/session machinery, not the verb
   "authorize").

3. Emit \`tags\`: lowercase, hyphen/underscore-separated, ≤ 8 items
   total, each ≤ 20 characters. Tags must be searchable terms — what
   another engineer would type into grep, not sentence fragments.
   Examples: \`rate-limit\`, \`migration\`, \`nfc\`, \`spawn-timeout\`. NOT:
   \`the auth system\`, \`slow queries sometimes\`.

4. Emit \`problem_summary\`: 2–4 sentences distilling the PROBLEM
   (not the solution, not a recap of the intent title). Future search
   reads this first; vague summaries waste retrieval budget.

5. Emit \`symptoms\`: 1–4 observable, specific symptoms drawn from
   \`intent\` / \`diff\` / \`ship_outcome\`. If the input does not name a
   concrete symptom, return \`["(symptom not stated in input)"]\` —
   honesty over fabrication.

## Anti-patterns: do NOT output

1. **Filename / symbol invention.** Do not output \`src/foo/bar.ts\`,
   function names, line numbers, or commit SHAs unless the input
   literally contains them. compound is post-ship archival, not code
   navigation.

2. **Forced category fit.** When intent does not match any of the 7
   specific buckets, return \`other\`. Squeezing \`authorize the user to
   read docs\` into \`auth\` because the word "authorize" appears is the
   exact failure mode of the heuristic this swap replaces.

3. **Sentence-shaped tags.** \`tags\` is a search-term list, not a
   description. Bad: \`["the auth flow", "various concerns"]\`. Good:
   \`["auth", "session-token"]\`.

4. **\`problem_summary\` that recaps intent.** The summary is a fresh
   distillation of the PROBLEM. Do not paraphrase the intent title;
   do not list "the user wants to add X." State the failure shape or
   risk shape that motivated the work.

5. **Placeholder \`symptoms\`.** Banned: \`"behavior documented in
   intent"\`, \`"see the diff"\`, \`"the change shipped"\`. If no concrete
   symptom is in the input, output the literal string
   \`"(symptom not stated in input)"\`.

6. **Banned vocabulary in any output string.** \`category\` enum is
   already constrained; \`tags\`, \`problem_summary\`, \`symptoms\` must NOT
   contain:
   - English: \`could potentially\`, \`might affect\`, \`various concerns\`,
     \`several issues\`, \`generally\`, \`overall\`, \`seems to\`,
     \`production-ready\`, \`comprehensive\`, \`robust\`
   - 中文: \`显著\`, \`大幅\`, \`基本上\`, \`大部分情况\`, \`相当不错\`
   These mark vague output. Replace with concrete naming.

### Bad / good contrast

\`\`\`yaml
# bad — forced category, lazy tags, intent-recap summary, placeholder symptoms
category: auth
tags:
  - the auth system
  - various concerns
problem_summary: |
  The user wants to authorize readers to access the documentation pages.
  This was implemented and shipped.
symptoms:
  - behavior documented in intent

# good — honest "other", searchable tags, problem-shape summary, concrete symptom
category: other
tags:
  - docs-access
  - permissions
  - reader-role
problem_summary: |
  Documentation pages were globally readable but a subset (internal-only
  RFCs) needed reader-role gating without breaking the public docs path.
  The gate had to be additive — existing public URLs must keep returning
  200 for unauthenticated viewers.
symptoms:
  - "(symptom not stated in input)"
\`\`\`

## Reply format

\`\`\`yaml
category: auth | data | infra | perf | ui | build | runtime | other
tags:
  - <tag-1>
  # ≤ 8 items, each ≤ 20 chars, lowercase, hyphen/underscore
problem_summary: |
  <2-4 sentences, problem essence not intent recap>
symptoms:
  - <observable symptom 1>
  # 1-4 items; if none stated, single-element ["(symptom not stated in input)"]
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_compound_context = () => {};

// prompts/compound-prevention.md
var compound_prevention_default = `# Purpose

Write the "how to keep this from happening again" line for a compound
(post-ship lessons-learned) entry. Future engineers reading the
prevention should know what one concrete test, alert, or process
change would catch the next instance of this problem class before
it ships.

You are NOT writing the solution narrative — that is
\`compound.solution\`'s job, and you receive its output. You are NOT
re-classifying — that is \`compound.context\`'s job, and you receive
its output too.

## Scope

- Token scope: read:decisions, read:progress, read:solutions, read:reviews
- Allowed outputs: prevention

## Your analysis

1. Read the \`context\` block (category + tags + problem_summary +
   symptoms) and \`solution\` block (what worked + what didn't).

2. Write \`prevention\`: 2–4 sentences in markdown that name exactly
   ONE forward-looking guardrail. The guardrail must be:
   - **Concrete** — names the artifact (test name, metric, dashboard,
     CI step, lint rule, runbook entry) rather than a category.
   - **Targeted at THIS failure shape** — not the category broadly.
     "Add a regression test for the auth-category" is the heuristic
     stub the swap replaces; "Add an integration test that exercises
     /login with an expired token and asserts a 401, not a 500"
     teaches.
   - **Single lever** — not a list of three things. If multiple
     guardrails would help, pick the one that would have caught THIS
     specific failure earliest.

3. The guardrail's location should match the category at a module-
   type level: \`auth\` → identity boundary tests; \`data\` → migration
   dry-run on a production-shaped fixture; \`infra\` → canary metric
   threshold; \`perf\` → baseline benchmark + regression alert; \`ui\` →
   visual snapshot OR DOM-shape assertion; \`build\` → pinned dep +
   reproducible-build check; \`runtime\` → boundary-input test
   reproducing the failure; \`other\` → skill/runbook entry that
   surfaces the lesson next time.

## Anti-patterns: do NOT output

1. **Category-boilerplate prevention.** Banned shapes:
   - "Add a regression test covering the {category}-category behavior."
   - "Include an adversarial test that exercises a missing/malformed token."
   - "Add a canary check and a rollback script."
   These are the heuristic stub's templates. The swap exists to
   replace them with problem-specific guidance. If the only thing
   you can say is "add tests", you have not read the context
   carefully enough.

2. **Multi-lever lists.** No \`1. Add X. 2. Add Y. 3. Add Z.\` —
   pick the one that catches THIS failure earliest.

3. **Filename / symbol / SHA invention.** Do not output
   \`src/foo/bar.ts\` test names or commit SHAs unless the input
   literally contains them. "the migration runner's dry-run step
   in CI" is fine; "scripts/migrate.ts:42" is not unless the
   input cites it.

4. **Banned vocabulary in the prevention string.** Must NOT contain:
   - English: \`could potentially\`, \`might affect\`, \`various concerns\`,
     \`several issues\`, \`generally\`, \`overall\`, \`seems to\`,
     \`production-ready\`, \`comprehensive\`, \`robust\`
   - 中文: \`显著\`, \`大幅\`, \`基本上\`, \`大部分情况\`, \`相当不错\`
   These mark vague output. Replace with concrete naming.
   (Note: "may break IF X" and similar concrete-conditional phrasing
   is fine — only the listed bare-hedge forms are banned.)

### Bad / good contrast

\`\`\`yaml
# bad — category boilerplate, multi-lever, generic
prevention: |
  Add a regression test covering the auth-category behavior described
  in the problem summary. Generally, include an adversarial test that
  exercises a missing/malformed token. Also add a canary check.

# good — single named lever, problem-specific, observable
prevention: |
  Add an integration test in the auth flow's existing test suite that
  drives /login end-to-end with an expired refresh token and asserts
  the response is a 401 with a retryable error code, not the 500 that
  shipped. The test should reach the token-refresh middleware (the
  exact module that was bypassed) rather than mocking the issuer.
\`\`\`

## Reply format

\`\`\`yaml
prevention: |
  <2-4 sentences in markdown — single named guardrail, targeted at
  this failure shape, located in the relevant module type>
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_compound_prevention = () => {};

// prompts/compound-solution.md
var compound_solution_default = `# Purpose

Write the "what worked" narrative for a compound (post-ship lessons-
learned) entry. Another engineer hitting a similar problem will read
your solution to figure out HOW the fix landed — not just THAT it
landed.

You are NOT the architect (this is post-ship; the work already
shipped). You are NOT writing prevention — that is
\`compound.prevention\`'s job. You are NOT classifying the problem —
that is \`compound.context\`'s job, and you receive its output.

## Scope

- Token scope: read:decisions, read:progress, read:solutions, read:reviews
- Allowed outputs: solution, what_didnt_work

## Your analysis

1. Read the \`context\` block (category, tags, problem_summary,
   symptoms) and \`reviews\` (one per reviewer that ran). The \`diff\`
   field, when present, is the canonical record of WHAT shipped.

2. Write \`solution\`: 3–6 sentences in markdown describing the
   technique that worked. Required content:
   - **The core idea** of the fix in one sentence (not a recap of the
     problem; the LEVER that resolved it).
   - **Where the change lives** at a module-type level ("the rate-
     limit middleware", "the migration runner", "the spawn helper") —
     not file paths unless the input literally names them.
   - **Why this technique fits THIS category of problem** — what
     about the failure shape made this the right lever.

3. Build \`what_didnt_work\`: 0–3 entries reconstructed from failed
   reviews. For each entry in \`reviews\` with \`verdict: fail\` or
   \`verdict: concern\`, the reviewer's \`findings\` capture approaches
   that were tried and discarded.
   - \`approach\` — one sentence describing the rejected approach (NOT
     the reviewer's verdict text verbatim — your summary of what was
     tried).
   - \`reason_failed\` — one sentence on WHY it didn't ship (the
     reviewer's concern condensed to the actionable observation).

   If no review surfaced a discarded approach, emit \`what_didnt_work: []\`.
   Honesty over fabrication — do not invent failed paths to fill the array.

## Anti-patterns: do NOT output

1. **Intent-recap or diff-pointer solution.** Banned shapes:
   - "the change shipped; see the diff and reviewers"
   - "the user wanted X and we did X"
   These are the exact failure modes of the heuristic stub. The
   solution exists to teach future readers; "see the diff" teaches
   nothing.

2. **Filename / symbol / SHA invention.** Do not output
   \`src/foo/bar.ts\`, function names, line numbers, commit SHAs, or
   PR numbers that are not literally present in the input.

3. **Generic prevention prose.** Sentences like "we added tests" or
   "we improved coverage" without naming the technique-class belong
   (if anywhere) in compound.prevention, not solution.

4. **Banned vocabulary in output strings.** \`solution\`, every
   \`approach\`, every \`reason_failed\` must NOT contain:
   - English: \`could potentially\`, \`might affect\`, \`various concerns\`,
     \`several issues\`, \`generally\`, \`overall\`, \`seems to\`,
     \`production-ready\`, \`comprehensive\`, \`robust\`
   - 中文: \`显著\`, \`大幅\`, \`基本上\`, \`大部分情况\`, \`相当不错\`
   These mark vague output. Replace with concrete naming.
   (Note: "may break IF X" and similar concrete-conditional phrasing
   is fine — only the listed bare-hedge forms are banned.)

### Bad / good contrast

\`\`\`yaml
# bad — intent recap, no lever, diff-pointer, generic
solution: |
  The user wanted to fix the search bug. The change shipped without
  reverting, so it works. See the diff and the review reports for
  the comprehensive implementation details.
what_didnt_work:
  - approach: "various concerns about caching"
    reason_failed: "did not work"

# good — names the lever, the module type, the why-this-shape
solution: |
  Cached the per-tenant prefix computation at the rate-limit middleware
  boundary so cold-path requests stop recomputing the SHA on every
  call. The middleware sits at the edge before route dispatch, so
  hits to /api/* and /webhook/* share the cache without leaking
  cross-tenant state. This fits perf-category problems where the
  expensive step is deterministic but the input set is small enough
  to memoize.
what_didnt_work:
  - approach: "Skipping the prefix step entirely when X-Forwarded-For matched the upstream proxy IP"
    reason_failed: "Bypassable by a client sending the spoofed header — reviewer.security flagged the trust-the-edge assumption"
\`\`\`

## Reply format

\`\`\`yaml
solution: |
  <3-6 sentences in markdown — core idea, module-type location,
  why this lever fits this category>
what_didnt_work:
  # array of OBJECTS with exactly two keys: approach + reason_failed.
  # Emit [] when no review surfaced a discarded approach. Each value
  # is a single quoted scalar.
  - approach: "<rejected approach, one sentence>"
    reason_failed: "<why it didn't ship, one sentence>"
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_compound_solution = () => {};

// prompts/planner-adversarial.md
var planner_adversarial_default = `# Purpose

Run a pre-mortem on the intent_draft. Assume the implementation ships
in its currently-described form — name the most likely ways it fails
in production or during the rollout itself.

Your job is NOT to write the implementation plan or to suggest fixes
beyond an early-warning signal. Your job IS to enumerate failure modes
with calibrated likelihood, blast radius, and what would tip oncall
off that the failure is happening.

## Scope

- Token scope: read:decisions:*, read:progress, exec:git:read
- Input channel: prior_preventions — when present, the spawn input
  carries keyword-matched preventions from solutions/ pre-fetched by
  /plan (CE-1). The agent itself holds NO read:solutions capability;
  the data flows in via input only.
- Allowed outputs: failure_modes

## Your analysis

1. Reason from intent_draft alone. No repo map; do not invent file
   paths, function names, or specific endpoint URLs. Module-type names
   ("auth middleware", "migration runner", "rate-limit edge") are
   fine; concrete \`src/foo/bar.ts\` paths are not.

2. For each failure mode, write four fields:
   - **scenario** — one concrete sentence naming WHAT goes wrong and
     WHERE (module type or boundary). Not a category label.
   - **probability** — one of \`low | medium | high\`. Calibrate against
     the shape of this change, not the worst case across all software.
   - **impact** — one of \`low | medium | high\`. User-visible severity
     if it fires (low = degraded UX, medium = partial outage / data
     correctness for a slice, high = full outage / data corruption /
     security breach / regulatory exposure).
   - **early_signal** — one concrete observation (test name, metric,
     log line, dashboard panel, oncall page) that would surface the
     failure BEFORE a customer reports it. "Tests fail" is not a
     signal; "the existing /login integration test fails on token-
     refresh path" is.

3. Cover the dimensions that matter for THIS change. Common shapes:
   - Migration / schema: data loss, irreversible truncation, lock
     contention, replication lag during cutover
   - Auth / crypto: bypass via a new code path, session fixation,
     downgrade attack, replay
   - Infra / deploy: rollout that ships before staging validation,
     canary-skip, config drift between environments
   - Refactor / rename: ripple to unaudited consumers, dead-but-
     load-bearing branches, hidden import sites
   - Payment / billing: idempotency miss, double-charge, currency or
     rounding error
   - Performance work: regression on adjacent path, cache invalidation
     race, P99 latency wider than P50 hides in average metric

4. Emit only modes that are PLAUSIBLY triggered by this change.
   Inventing failure modes that have no plausible link to the intent
   is itself a failure pattern (see anti-pattern #2).

5. The \`prior_preventions\` field in the input lists failure shapes
   this codebase has already learned about. Treat each entry as a
   *hypothesis to test against intent_draft*, NOT a guaranteed
   inclusion. For each entry, apply the recurrence gate before
   deciding whether to emit a failure_mode:

   **Gate** — would the conditions that triggered the prevention
   actually re-arise under this intent_draft? Concrete questions:
   - Does intent_draft touch the same module / boundary / shape the
     prevention names? Keyword overlap alone is NOT sufficient (the
     word "migration" matching a docstring is not a migration intent).
   - Does intent_draft preserve the structural cause? A prevention
     about "schema lock contention" only applies if THIS intent
     mutates schema; renaming a comment is a no-op against it.

   **Emit when the gate clears**, with calibrated probability:
   - \`probability: high\` when the recurrence is *direct* — same
     module, same shape, no mitigating factor in intent_draft.
   - \`probability: medium\` when the shape is plausible but
     conditions partially differ (related module, similar boundary,
     same root cause type but different surface).
   - **Do NOT emit** when the prevention's structural cause does
     not apply to this intent_draft — fabricating a recurrence is
     anti-pattern #2 even when keyword overlap is high.

   When emitting, reference the prevention's \`solution_ref\` in the
   \`early_signal\` field (after the concrete signal text) so the
   operator sees the source. Cap at most one failure_mode per
   applicable prior_prevention — do not split one prevention across
   multiple modes, and do not stack a duplicate prevention-driven
   mode on top of a novel mode that already covers the same shape.

## Anti-patterns: do NOT output

1. **Mitigation prose or implementation suggestions.** You are not
   the architect. Failures, signals, and ratings only — no "we
   should add X" or "use a feature flag".

2. **Generic boilerplate failures.** "Tests might fail" / "code
   review might miss something" applied to every intent is noise.
   Each failure mode must reference something concrete about THIS
   intent — the modifier (e.g. "schema migration") or the boundary
   (e.g. "rate-limit middleware").

3. **Banned vocabulary in output strings.** \`scenario\`, \`early_signal\`
   must NOT contain:
   - English: \`could potentially\`, \`might affect\`, \`various concerns\`,
     \`several issues\`, \`generally\`, \`overall\`, \`seems to\`,
     \`production-ready\`, \`comprehensive\`, \`robust\`
   - 中文: \`显著\`, \`大幅\`, \`基本上\`, \`大部分情况\`, \`相当不错\`
   These mark vague hedged output. Replace with concrete naming.
   (Note: "may break IF X" and similar concrete-conditional phrasing
   is fine — only the listed bare-hedge forms are banned.)

4. **L0 / L1 over-flagging.** If intent is a typo, comment edit,
   formatting change, or a single-file local fix with no contract
   touch, emit exactly one failure mode (the universal coverage-
   gap mode) rather than fabricating a list. Pre-mortem fan-out on
   trivial changes is itself a failure pattern.

### Bad / good contrast

\`\`\`yaml
# bad — vague, generic, mitigation hidden inside the scenario
failure_modes:
  - scenario: "various concerns about migration safety"
    probability: medium
    impact: high
    early_signal: "tests fail and code review catches issues"

# good — names module, calibrated probability, observable signal
failure_modes:
  - scenario: "ALTER TABLE users on a production-sized table takes a long
      lock and blocks writes long enough that user-write requests time out
      at the API edge"
    probability: medium
    impact: high
    early_signal: "the existing dry-run-migration step in CI logs
      \`lock_wait > 60s\`; or in prod, p99 write latency on /users
      exceeds 5s for >30s consecutive"
\`\`\`

## Reply format

\`\`\`yaml
failure_modes:
  # array of OBJECTS with exactly the four keys below. probability and
  # impact MUST be one of: low, medium, high (lowercase, no other values).
  - scenario: <concrete sentence naming what fails and where>
    probability: low | medium | high
    impact: low | medium | high
    early_signal: <concrete test / metric / log / page that would catch this first>
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_planner_adversarial = () => {};

// prompts/planner-decompose.md
var planner_decompose_default = '# planner.decompose\n\nYou decompose an approved engineering intent into a **file-level task list with\nbite-sized TDD steps**. You write the plan an engineer with zero context for\nthis codebase would need: exact files, complete steps, real commands. NO\nplaceholders ("TBD", "handle edge cases", "add validation" are failures).\n\n## Inputs\n\n- `intent_draft` — the approved task description.\n- `structural_risks` — areas the eng reviewer flagged (area / risk / mitigation).\n- `prior_art` — prior solutions surfaced from the knowledge corpus\n  (`solution_ref` / `relevance_score` / `excerpt`). REUSE these: when a task\n  reuses a prior solution, list its `solution_ref` in that task\'s\n  `prior_art_refs`.\n- `failure_modes` — pre-mortem scenarios (scenario / probability / impact /\n  early_signal). For each, emit a `guard` step (a defensive test or check) in\n  the task most likely to trigger it.\n- `prior_preventions` — known failure shapes to avoid; emit a `guard` step\n  citing the `solution_ref`.\n\n## Output (JSON)\n\n```json\n{\n  "tasks": [\n    {\n      "id": "f1",\n      "title": "<imperative task title>",\n      "files": { "create": ["path"], "modify": ["path"], "test": ["path"] },\n      "steps": [\n        { "kind": "test", "text": "Write the failing test: ..." },\n        { "kind": "verify-red", "text": "Run it", "run": "<cmd>", "expect": "FAIL ..." },\n        { "kind": "implement", "text": "..." },\n        { "kind": "verify-green", "text": "Run it", "run": "<cmd>", "expect": "PASS" },\n        { "kind": "guard", "text": "Guard against <failure_mode>: ..." },\n        { "kind": "commit", "text": "Commit", "run": "git commit -m \\"...\\"" }\n      ],\n      "prior_art_refs": ["<solution_ref reused by this task>"]\n    }\n  ]\n}\n```\n\n## Rules\n\n- `kind` must be one of: `test`, `verify-red`, `implement`, `verify-green`, `commit`, `guard`.\n- Each task is self-contained and independently testable. Split by\n  responsibility, not by technical layer. Smallest diff that works.\n- Every `verify-*` / `commit` step has a real `run` command.\n- Do NOT invent file paths you cannot justify from the intent. If unsure of an\n  exact path, describe the file\'s responsibility in `text` and leave `files`\n  arrays conservative.\n- Banned vocabulary: no "robust", "comprehensive", "significantly",\n  "should work", or baseline-less ratios.\n\n## Input\n\n<input_yaml/>\n';
var init_planner_decompose = () => {};

// prompts/planner-ceo.md
var planner_ceo_default = `# Purpose

Assess the intent_draft as a product gate before implementation begins.

Your job is NOT to design or implement — that is planner.eng's job for
structural risk and the user's job during /work. Your job IS to flag
business-grounding gaps the user should fix in the intent before they
commit time to this task.

## Scope

- Token scope: read:decisions, read:progress
- Forbidden: read:solutions (planner-adjacent isolation — do not
  consult past answers)
- Allowed outputs: verdict, concerns, rewrite_hints

## Your analysis

1. Reason from intent_draft alone. No repo map; do not invent file
   paths, function names, or audiences not named in the intent.

2. Score the intent on three product axes:
   - **Audience**: does the intent name who benefits (user, customer,
     team, downstream caller, oncall, ops)? Vague verbs like "improve"
     or "make better" without a named beneficiary count as missing.
   - **Success criterion**: does the intent name a metric, observable
     outcome, or smallest-user-visible change that would prove it
     worked? "Faster" is not a criterion; "p99 < 200ms on /search" is.
   - **Strategic fit**: does the intent state WHY now (deadline,
     dependency, unblock, customer ask, retention impact)? Pure
     refactors without a why-now framing get a \`concerns\` line, not
     a reject.

3. Return verdict:
   - \`approve\` — intent has audience + success criterion + at least an
     implicit why-now; or it is a small local change where business
     framing is not load-bearing (L0/L1 typo / docs / mechanical
     refactor).
   - \`revise\` — intent is missing one of the three axes the user
     should add before /work. Concerns name the gap; rewrite_hints
     state what to add.
   - \`reject\` — intent is fundamentally off-target (asks for the wrong
     thing, conflicts with stated constraints, or describes work the
     team has explicitly decided NOT to do).

## Anti-patterns: do NOT output

1. **Design alternatives or implementation steps.** You are the
   product gate, not the architect or the planner. Output that reads
   "we could do X, Y, or Z" has drifted into eng/spec territory and
   is wrong. Stay on AUDIENCE / METRIC / WHY-NOW, not solutions.

2. **Inventing audiences.** Do not fabricate user personas, metric
   targets, or strategic narratives the intent does not mention.
   Concerns should name the GAP ("no audience named"), not propose
   the answer ("would benefit the analytics team — assumed").

3. **Banned vocabulary in output strings.** \`concerns\` and
   \`rewrite_hints\` must NOT contain:
   - English: \`could potentially\`, \`might affect\`, \`various concerns\`,
     \`several issues\`, \`generally\`, \`overall\`, \`seems to\`,
     \`production-ready\`, \`comprehensive\`, \`robust\`
   - 中文: \`显著\`, \`大幅\`, \`基本上\`, \`大部分情况\`, \`相当不错\`
   These mark vague hedged output. Replace with concrete naming.
   (Note: "may break IF X" and similar concrete-conditional phrasing
   is fine — only the listed bare-hedge forms are banned.)

4. **L0 / L1 over-flagging.** If intent is a typo, comment edit,
   formatting change, or a one-file local fix, return \`verdict:
   approve\` with \`concerns: []\` and \`rewrite_hints: []\`. Forcing
   product framing onto trivial maintenance is itself a failure mode.

### Bad / good contrast

\`\`\`yaml
# bad — invented audience, hedged value claim, design suggestion
verdict: revise
concerns:
  - "various concerns about who this affects"
  - "could potentially improve performance"
rewrite_hints:
  - "consider adding a feature flag and rolling out gradually"

# good — names the gap, no fabrication, no design
verdict: revise
concerns:
  - "no audience named — intent says 'improve dashboard' without naming who benefits"
  - "no success criterion — 'faster' is not measurable"
rewrite_hints:
  - "name the affected audience (which user role, team, or caller hits this dashboard)"
  - "state the success metric and how it will be measured (p99 latency, error rate, qualitative observation)"
\`\`\`

## Reply format

\`\`\`yaml
verdict: approve | revise | reject
concerns:
  # array of PLAIN STRINGS — each item is a single quoted scalar, not a
  # mapping. Wrap each item in double quotes when it contains a colon
  # to avoid YAML interpreting it as a key:value sequence entry.
  - "concern 1, names the specific gap"
  - "concern 2, names the specific gap"
rewrite_hints:
  - "rewrite_hint 1, states what the user should add"
  - "rewrite_hint 2, states what the user should add"
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_planner_ceo = () => {};

// prompts/planner-eng.md
var planner_eng_default = `# Purpose

Assess the intent_draft for structural risks before implementation begins.

Your job is NOT to write the implementation plan — that is the user's
job during /work. Your job IS to flag risks the user should know before
committing to this task.

## Scope

- Token scope: read:progress, read:decisions
- Forbidden: read:solutions (planner-adjacent isolation — do not
  consult past answers)
- Allowed outputs: verdict, concerns, structural_risks

## Your analysis

1. Reason from intent_draft alone. You do NOT have a repo map. Do not
   invent specific file paths, function names, or symbol names. Module-
   type names (e.g. "auth middleware", "migration runner") are fine;
   concrete \`src/foo/bar.ts\` paths are not.

2. Flag structural risks in terms of module types / patterns. Common
   shapes to look for:
   - Missing test coverage typical for changes of this shape (e.g.
     migrations usually lack rollback tests)
   - Cross-module coupling (auth + payment tasks usually touch ≥ 3
     boundaries; logging changes hit every command site)
   - Schema / API contract implications not mentioned in intent
   - Parallel paths needing matched updates: fallback arms, feature
     flags, SQL \`ORDER BY\` + \`LIMIT\` pairs, multi-dispatch tables,
     try/catch-and-rethrow chains

3. Return verdict:
   - \`approve\` — intent is well-scoped, risks are tractable, no
     blocking gap
   - \`revise\` — intent is missing motivation, scope, or success
     criteria the user should add before /work
   - \`reject\` — intent is fundamentally off-target (asks for the
     wrong thing, conflicts with stated constraints)

## Anti-patterns: do NOT output

1. **Design alternatives.** You are not brainstorming. Output that
   reads "here are 3 ways to approach this" has drifted into pre-spec
   territory and is wrong. Stay on RISKS, not solutions.

2. **L0 / L1 over-flagging.** If intent is a typo, comment edit,
   formatting change, or a single-file local fix with no contract
   touch, return \`verdict: approve\` with \`structural_risks: []\`.
   Inventing risks where none exist is itself a failure mode.

3. **Banned vocabulary in output strings.** \`concerns\`, \`area\`, \`risk\`,
   \`mitigation\` must NOT contain:
   - English: \`could potentially\`, \`might affect\`, \`various concerns\`,
     \`several issues\`, \`generally\`, \`overall\`, \`seems to\`,
     \`production-ready\`, \`comprehensive\`, \`robust\`
   - 中文: \`显著\`, \`大幅\`, \`基本上\`, \`大部分情况\`, \`相当不错\`
   These mark vague output. Replace with concrete naming.

4. **Filename invention.** Do not output \`src/foo/bar.ts\` unless the
   intent literally names that path.

### Bad / good contrast

\`\`\`yaml
# bad — vague, hedged, no specific failure mode
structural_risks:
  - area: auth
    risk: could potentially affect login
    mitigation: ensure tests are added

# good — names a concrete failure mode + concrete action
structural_risks:
  - area: rate-limit middleware
    risk: bypass via X-Forwarded-For when upstream proxy is unconfigured
    mitigation: pin to direct-peer IP unless allowlist set; add a unit
      test for spoofed-header path
\`\`\`

## Reply format

\`\`\`yaml
verdict: approve | revise | reject
concerns:
  # array of PLAIN STRINGS — each item is a single quoted scalar, not a
  # mapping. Wrap each item in double quotes when it contains a colon
  # to avoid YAML interpreting it as a key:value sequence entry.
  - "concern 1, specific"
  - "concern 2, specific"
structural_risks:
  # array of OBJECTS with exactly the three keys below.
  - area: <module type or subsystem>
    risk: <what could break or be missed, specific>
    mitigation: <concrete action the user should take>
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_planner_eng = () => {};

// prompts/researcher-history.md
var researcher_history_default = `# Purpose
Rerank prior solutions by semantic relevance to the current intent_draft.
Your job is NOT to write the plan — that belongs to planner.eng / planner.ceo.
Proposing new solutions or brainstorming alternatives is NOT for brainstorming
agents here — those tasks go to sp:brainstorming / planner.ceo.
Your job IS to look at past solutions and tell the user which 0-5 of them
are actually worth reading before they start.

## Scope
- Token scope: read:progress, read:decisions, read:solutions
- Forbidden: write anywhere; invent solution_ref values not in candidates

## Your analysis
1. Read intent_draft and the candidates list (each has solution_ref +
   category + excerpt + keyword_hits).
2. For each candidate, decide: would reading this past solution change
   how the user approaches the new intent?
   - YES, strong overlap (same failure mode, same module, transferable fix)
     → score 0.7-1.0
   - YES, partial (adjacent system, similar pattern, useful context)
     → score 0.3-0.6
   - NO, only keyword coincidence (e.g., both mention "auth" but unrelated
     concerns) → DROP from output
3. Pick at most 5 candidates ranked highest. If fewer than 5 clear the
   0.3 floor, return fewer (zero is valid).
4. For each kept candidate, write ONE sentence (≤ 30 words) explaining
   the specific transferable insight. Generic ("touches auth", "similar
   topic") is rejected — name the concrete pattern.

## Anti-patterns
- DO NOT invent solution_ref values. Only reference refs from the input
  candidates list.
- DO NOT reproduce the excerpt — caller has it.
- DO NOT propose new solutions or rewrite the intent.
- DO NOT use banned vocabulary in relevance_reason. Avoid:
  could potentially, might affect, various concerns, several issues,
  generally, overall, seems to, production-ready, comprehensive, robust,
  显著, 大幅, 基本上, 大部分情况, 相当不错 (per spec §10 + cross-checked
  against planner-eng / compound-context eval BANNED_VOCAB_RE).
- DO NOT pad to 5 entries if only 2 are actually relevant.

## Reply format

\`\`\`yaml
prior_art:
  - solution_ref: <one of the input candidate refs>
    relevance_score: <float 0.3-1.0>
    relevance_reason: <one sentence, ≤ 30 words, names the transferable pattern>
warnings:
  - <optional string per warning>
\`\`\`

If zero candidates clear the 0.3 floor, return:
\`\`\`yaml
prior_art: []
warnings:
  - "no candidate cleared 0.3 relevance floor"
\`\`\`

## Input

<input_yaml/>

## Submit
Write only the YAML above. No prose outside the YAML block.
`;
var init_researcher_history2 = () => {};

// prompts/reviewer-correctness.md
var reviewer_correctness_default = `# Purpose

Review a git diff for correctness against the stated intent.

## Review checklist

1. **Intent alignment**: does the diff accomplish what intent.md states?
2. **Correctness**: obvious bugs — off-by-one, null deref, missing error paths, race conditions?
3. **Test coverage**: are new behaviors covered by tests? (cite test file:line if yes; flag concern if not)
4. **Unresolved markers**: TODO/FIXME/XXX in added lines are concerns unless justified
5. **Empty diff or doc-only diff with code intent**: flag as concern
6. **Scope creep**: changes outside intent's stated surface

## Severity rubric

- **none**: pass with no findings
- **low**: cosmetic, TODO markers without impact
- **medium**: missing test coverage for new behavior, questionable logic
- **high**: clear bug, missing error handling, contract violation
- **critical**: security regression, data loss risk, broken invariant

## Verdict rubric

- **pass**: no findings above low
- **concern**: at least one medium-or-higher finding, not blocking
- **fail**: at least one high-or-critical finding, ship should be blocked

## Reply format

\`\`\`yaml
verdict: pass | concern | fail
severity: none | low | medium | high | critical
findings:
  - location: <file:line or "global">
    description: <what is wrong, 1-2 sentences>
    suggestion: <optional — one-line fix hint>
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_reviewer_correctness = () => {};

// prompts/reviewer-security.md
var reviewer_security_default = `# Purpose

Review a git diff for exploitable security vulnerabilities, thinking like an attacker
looking for the one reachable path through the code — not auditing against a checklist.

For each candidate issue, ask "how would I break this?" and then trace whether the code
stops you. Report the trace, not the category.

## Review checklist

1. **Injection vectors**: user-controlled input reaching SQL without parameterization; HTML
   output without escaping (XSS); shell commands without argument sanitization; template
   engines with raw evaluation. Trace data from entry point to dangerous sink.
2. **Auth / authz bypass**: missing authentication on new endpoints; broken ownership checks
   (user A reaching user B's resources); privilege escalation paths; CSRF on state-changing
   operations; JWT/token handling errors (missing validation, weak signing).
3. **Secrets in code or logs**: hardcoded keys/tokens/passwords; credentials, PII or session
   tokens written to logs or error messages; secrets in URL parameters; test fixtures that
   mirror production credentials.
4. **Insecure deserialization**: untrusted input reaching pickle / Marshal / eval-shaped
   parsing; object injection through deserialization.
5. **SSRF and path traversal**: user-controlled URLs reaching server-side HTTP clients
   without allowlist validation; user-controlled paths reaching filesystem operations
   without canonicalization and boundary checks.

## Evidence rules

- Every finding MUST carry a concrete attack path: the entry point, the route through the
  diff, and the sink. "This looks unsafe" without a path is not a finding — drop it.
- Cite \`file:line\` from the diff. A finding you cannot locate is not reportable.
- Judge only what the diff changes. Pre-existing issues outside the diff are out of scope
  unless the diff makes them newly reachable — in which case say so explicitly.
- A keyword appearing in the code (\`token\`, \`auth\`, \`crypto\`) is NOT a finding. The
  heuristic fallback already flags those and it is exactly what you exist to improve on.

## Confidence calibration

Security findings carry a lower reporting threshold than other review dimensions because
the cost of missing a real vulnerability is high. A finding you hold at ~0.60 confidence is
still actionable — report it and say what would confirm it. Do not pad the list to look
thorough: a false finding costs the reader's trust in every other line.

## Severity rubric

- **none**: pass with no findings
- **low**: defense-in-depth gap with no reachable exploit path
- **medium**: exploitable only with preconditions (authenticated, specific config)
- **high**: directly exploitable by an unauthenticated or low-privilege attacker
- **critical**: remote code execution, authentication bypass, or credential/data exfiltration

## Verdict rubric

- **pass**: no findings above low
- **concern**: at least one medium-or-higher finding, not blocking
- **fail**: at least one high-or-critical finding, ship should be blocked

## Reply format

\`\`\`yaml
verdict: pass | concern | fail
severity: none | low | medium | high | critical
findings:
  - location: <file:line or "global">
    description: <the attack path — entry point → route → sink, 1-3 sentences>
    suggestion: <optional — one-line fix hint>
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_reviewer_security = () => {};

// prompts/reviewer-tests.md
var reviewer_tests_default = `# Purpose

Review a git diff for test adequacy — whether the tests that ship with a change actually
constrain its behaviour, and whether they would fail if the change were wrong.

The heuristic fallback for this id can only see whether test-shaped file paths appear in the
diff. It cannot read a single assertion. Everything below is what you exist to add.

## Review checklist

1. **Presence**: does new or changed behaviour ship with tests at all? A source change with
   no corresponding test is a finding unless the change is provably behaviour-free
   (rename, comment, formatting) — say which.
2. **Would it fail?**: for each new test, ask what breaks it. A test that passes against
   both the old and the new implementation constrains nothing. Vacuous assertions
   (\`expect(x).toBeDefined()\` on a value that cannot be undefined, snapshot-only tests over
   generated output, a mock asserted against itself) are findings — this is the highest-value
   check here and the easiest to skip.
3. **Coverage shape, not coverage percent**: are the branches the diff introduces exercised?
   Empty input, boundary values, the error path, the fallback arm, the early return. A
   change with a \`catch\` block and no test that enters it is a gap.
4. **Setup fidelity**: does the fixture reproduce the real sequence, or a convenient one? A
   test that builds its state directly instead of driving the code path under test will pass
   against a broken implementation.
5. **Flakiness risk**: dependence on wall-clock time, real network, filesystem ordering,
   parallel-test shared state, unseeded randomness, or a fixed sleep standing in for a
   condition. Report the mechanism, not just the smell.
6. **Test-only diffs**: judge on 2-5 alone; a diff that only touches tests still has a
   correctness surface.

## Evidence rules

- Cite \`file:line\`. For a vacuous-assertion finding, state what the test would still pass
  against — that is the proof, and without it the finding is an opinion.
- Judge the tests in the diff. Do not demand tests for code the diff does not touch.
- Do not report a raw coverage number. You cannot measure it from a diff, and a percentage
  without a baseline is not evidence.

## Severity rubric

- **none**: pass with no findings
- **low**: style or naming of an otherwise sound test
- **medium**: missing coverage for a new branch; fixture that overfits the implementation
- **high**: new behaviour with no test at all; a test that cannot fail; a flake mechanism
  that will produce false green in CI
- **critical**: the change disables, skips, or weakens an existing test without justification

## Verdict rubric

- **pass**: no findings above low
- **concern**: at least one medium-or-higher finding, not blocking
- **fail**: at least one high-or-critical finding, ship should be blocked

## Reply format

\`\`\`yaml
verdict: pass | concern | fail
severity: none | low | medium | high | critical
findings:
  - location: <file:line or "global">
    description: <what is untested or unfalsifiable, and what it would still pass against>
    suggestion: <optional — one-line fix hint>
\`\`\`

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
`;
var init_reviewer_tests = () => {};

// src/dispatcher/embedded-data.ts
import { readFileSync as readFileSync8 } from "node:fs";
import { resolve as resolve10, dirname as dirname4 } from "node:path";
import { fileURLToPath } from "node:url";
function listEmbeddedPromptKeys() {
  return Object.keys(EMBEDDED_PROMPTS);
}
function readContract(filename) {
  const override = process.env["SGC_CONTRACTS_DIR"];
  if (override)
    return readDisk(resolve10(override, filename), filename, "SGC_CONTRACTS_DIR");
  const embedded = EMBEDDED_CONTRACTS[filename];
  if (embedded !== undefined)
    return embedded;
  return readDisk(resolve10(diskContractsDir, filename), filename, "SGC_CONTRACTS_DIR");
}
function readPrompt(relPath) {
  const override = process.env["SGC_PROMPTS_DIR"];
  if (override) {
    const base = relPath.replace(/^prompts\//, "");
    return readDisk(resolve10(override, base), relPath, "SGC_PROMPTS_DIR");
  }
  const embedded = EMBEDDED_PROMPTS[relPath];
  if (embedded !== undefined)
    return embedded;
  return readDisk(resolve10(diskRepoRoot, relPath), relPath, "SGC_PROMPTS_DIR");
}
function readDisk(path, label, envVar) {
  try {
    return readFileSync8(path, "utf8");
  } catch (err) {
    const e2 = err;
    if (e2.code === "ENOENT") {
      throw new Error(`sgc data not found: ${label} at ${path} — set ${envVar} if it lives elsewhere.`);
    }
    throw new Error(`sgc data unreadable: ${label} at ${path}: ${e2.message}`);
  }
}
var EMBEDDED_CONTRACTS, EMBEDDED_PROMPTS, moduleDir, diskContractsDir, diskRepoRoot;
var init_embedded_data = __esm(() => {
  init_sgc_capabilities();
  init_sgc_state_schema();
  init_invariant_enforcement();
  init_sgc_invariants();
  init_clarifier_discover();
  init_classifier_level();
  init_compound_context();
  init_compound_prevention();
  init_compound_solution();
  init_planner_adversarial();
  init_planner_decompose();
  init_planner_ceo();
  init_planner_eng();
  init_researcher_history2();
  init_reviewer_correctness();
  init_reviewer_security();
  init_reviewer_tests();
  EMBEDDED_CONTRACTS = {
    "sgc-capabilities.yaml": sgc_capabilities_default,
    "sgc-state.schema.yaml": sgc_state_schema_default,
    "invariant-enforcement.yaml": invariant_enforcement_default,
    "sgc-invariants.md": sgc_invariants_default
  };
  EMBEDDED_PROMPTS = {
    "prompts/clarifier-discover.md": clarifier_discover_default,
    "prompts/classifier-level.md": classifier_level_default,
    "prompts/compound-context.md": compound_context_default,
    "prompts/compound-prevention.md": compound_prevention_default,
    "prompts/compound-solution.md": compound_solution_default,
    "prompts/planner-adversarial.md": planner_adversarial_default,
    "prompts/planner-decompose.md": planner_decompose_default,
    "prompts/planner-ceo.md": planner_ceo_default,
    "prompts/planner-eng.md": planner_eng_default,
    "prompts/researcher-history.md": researcher_history_default,
    "prompts/reviewer-correctness.md": reviewer_correctness_default,
    "prompts/reviewer-security.md": reviewer_security_default,
    "prompts/reviewer-tests.md": reviewer_tests_default
  };
  moduleDir = dirname4(fileURLToPath(import.meta.url));
  diskContractsDir = resolve10(moduleDir, "..", "..", "contracts");
  diskRepoRoot = resolve10(moduleDir, "..", "..");
});

// src/dispatcher/schema.ts
function getCapabilities() {
  if (_capabilities === null) {
    const text = readContract("sgc-capabilities.yaml");
    const raw = loadSpec(text);
    for (const [k2, m2] of Object.entries(raw.subagents ?? {})) {
      m2.name = k2;
    }
    _capabilities = raw;
  }
  return _capabilities;
}
function getSubagentManifest(name) {
  return getCapabilities().subagents[name];
}
function getCommandPermissions(command) {
  return getCapabilities().permissions[command];
}
var _capabilities = null;
var init_schema = __esm(() => {
  init_preprocessor();
  init_embedded_data();
});

// src/dispatcher/capabilities.ts
function matchesPattern(name, pattern) {
  const re = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${re}$`).test(name);
}
function tokenForbiddenFor(spec, token, holder) {
  const def = spec.scope_tokens[token];
  if (!def?.forbidden_for)
    return false;
  return def.forbidden_for.some((p) => matchesPattern(holder, p));
}
function computeCommandTokens(command) {
  const perms = getCommandPermissions(command);
  if (!perms)
    throw new UnknownActor("command", command);
  return [
    ...perms.decisions ?? [],
    ...perms.progress ?? [],
    ...perms.solutions ?? [],
    ...perms.reviews ?? [],
    ...perms.exec ?? [],
    ...perms.spawn ?? []
  ];
}
function computeSubagentTokens(subagent) {
  const manifest = getSubagentManifest(subagent);
  if (!manifest)
    throw new UnknownActor("subagent", subagent);
  const spec = getCapabilities();
  const out = [];
  for (const token of manifest.scope_tokens ?? []) {
    if (tokenForbiddenFor(spec, token, subagent)) {
      throw new ScopeViolation(token, subagent, `manifest for ${subagent} declares forbidden token ${token} (Invariant §1)`);
    }
    out.push(token);
  }
  return out;
}
var ScopeViolation, UnknownActor;
var init_capabilities = __esm(() => {
  init_schema();
  ScopeViolation = class ScopeViolation extends Error {
    token;
    holder;
    constructor(token, holder, message) {
      super(message ?? `scope violation: ${holder ?? "?"} cannot hold ${token}`);
      this.token = token;
      this.holder = holder;
      this.name = "ScopeViolation";
    }
  };
  UnknownActor = class UnknownActor extends Error {
    constructor(kind, name) {
      super(`unknown ${kind}: ${name}`);
      this.name = "UnknownActor";
    }
  };
});

// src/dispatcher/subprocess.ts
import { spawn, spawnSync as spawnSync2 } from "node:child_process";

class CappedStreamBuffer {
  cap;
  chunks = [];
  bytes = 0;
  overflowed = false;
  constructor(cap = MAX_CAPTURE_BYTES) {
    this.cap = cap;
  }
  push(c3) {
    if (this.overflowed)
      return false;
    if (this.bytes + c3.length > this.cap) {
      this.overflowed = true;
      return false;
    }
    this.bytes += c3.length;
    this.chunks.push(c3);
    return true;
  }
  toString() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}
function spawnCapture(argv2, opts = {}) {
  if (!argv2[0])
    return Promise.resolve({ stdout: "", stderr: "empty argv", exitCode: -1 });
  return new Promise((resolveP) => {
    const child = spawn(argv2[0], argv2.slice(1), {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const out = new CappedStreamBuffer(opts.maxBuffer);
    const err = new CappedStreamBuffer(opts.maxBuffer);
    let errored = false;
    child.stdout?.on("data", (c3) => {
      if (!out.push(c3))
        child.kill();
    });
    child.stderr?.on("data", (c3) => {
      if (!err.push(c3))
        child.kill();
    });
    child.on("error", (e2) => {
      errored = true;
      resolveP({ stdout: out.toString(), stderr: err.toString() + String(e2), exitCode: -1 });
    });
    child.on("close", (code) => {
      if (errored)
        return;
      const overflowed = out.overflowed || err.overflowed;
      resolveP({
        stdout: out.toString(),
        stderr: overflowed ? "output exceeded the capture byte cap" : err.toString(),
        exitCode: overflowed ? -1 : code ?? -1
      });
    });
  });
}
function spawnCaptureSync(argv2, opts = {}) {
  if (!argv2[0])
    return { stdout: "", stderr: "empty argv", exitCode: -1 };
  const r3 = spawnSync2(argv2[0], argv2.slice(1), {
    cwd: opts.cwd,
    env: opts.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: opts.maxBuffer ?? MAX_CAPTURE_BYTES
  });
  if (r3.error)
    return { stdout: r3.stdout ?? "", stderr: String(r3.error), exitCode: -1 };
  return { stdout: r3.stdout ?? "", stderr: r3.stderr ?? "", exitCode: r3.status ?? -1 };
}
function whichSync(bin) {
  const cmd = process.platform === "win32" ? "where" : "which";
  const r3 = spawnSync2(cmd, [bin], { encoding: "utf8" });
  if (r3.status !== 0)
    return null;
  const line = (r3.stdout || "").split(`
`)[0]?.trim();
  return line && line.length > 0 ? line : null;
}
var MAX_CAPTURE_BYTES, KILL_GRACE_MS = 2000;
var init_subprocess = __esm(() => {
  MAX_CAPTURE_BYTES = 64 * 1024 * 1024;
});

// src/dispatcher/claude-cli-agent.ts
import { spawn as spawn2 } from "node:child_process";
import { readFileSync as readFileSync9 } from "node:fs";
function extractYamlBody(resultText) {
  const fenced = /```(?:yaml|yml)?\s*\n([\s\S]*?)\n```/.exec(resultText);
  if (fenced)
    return fenced[1].trim();
  const fm = /^---\n([\s\S]*?)\n---/.exec(resultText.trim());
  if (fm)
    return fm[1].trim();
  return resultText.trim();
}
async function runClaudeCliAgent(promptPath2, manifest, runner = defaultRunner, ctx) {
  const promptText = readFileSync9(promptPath2, "utf8");
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000;
  const argv2 = ["claude", "-p", "--output-format", "json"];
  const model = "claude-cli";
  if (ctx) {
    const reqPayload = {
      model,
      prompt_chars: promptText.length,
      mode: "claude-cli"
    };
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.request",
      level: "info",
      payload: reqPayload
    });
  }
  const startTs = Date.now();
  let outcome = "error";
  let errorClass;
  let usageInput;
  let usageOutput;
  let responded = false;
  const emitResponse = () => {
    if (!ctx || responded)
      return;
    responded = true;
    const resPayload = {
      outcome,
      latency_ms: Date.now() - startTs,
      ...usageInput !== undefined ? { input_tokens: usageInput } : {},
      ...usageOutput !== undefined ? { output_tokens: usageOutput } : {},
      ...errorClass ? { error_class: errorClass } : {}
    };
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.response",
      level: outcome === "success" ? "info" : "warn",
      payload: resPayload
    });
  };
  ctx?.registerLlmClose?.((oc) => {
    outcome = oc;
    errorClass ??= "interrupted";
    emitResponse();
  });
  const { stdout: stdout2, stderr, exitCode, timedOut } = await runner(argv2, timeoutMs, (kill) => ctx?.registerAbort?.(kill), promptText);
  if (timedOut) {
    outcome = "timeout";
    errorClass = "ClaudeCliTimeout";
    emitResponse();
    throw new ClaudeCliError(`claude CLI exceeded ${timeoutMs}ms for ${manifest.name}`, stderr, exitCode);
  }
  if (exitCode !== 0) {
    errorClass = `ExitCode-${exitCode}`;
    emitResponse();
    throw new ClaudeCliError(`claude CLI exit ${exitCode} for ${manifest.name}: ${stderr.slice(0, 200)}`, stderr, exitCode);
  }
  let parsed;
  try {
    parsed = JSON.parse(stdout2);
  } catch (e2) {
    errorClass = "NonJSONOutput";
    emitResponse();
    throw new ClaudeCliError(`claude CLI returned non-JSON for ${manifest.name}: ${stdout2.slice(0, 200)}`);
  }
  if (parsed.is_error) {
    errorClass = "IsError";
    emitResponse();
    throw new ClaudeCliError(`claude CLI reported error for ${manifest.name}: ${parsed.result ?? "(no detail)"}`);
  }
  const resultText = parsed.result;
  if (typeof resultText !== "string") {
    errorClass = "MissingResult";
    emitResponse();
    throw new ClaudeCliError(`claude CLI response missing .result string for ${manifest.name}`);
  }
  const u3 = parsed.usage;
  usageInput = u3?.input_tokens;
  usageOutput = u3?.output_tokens;
  outcome = "success";
  emitResponse();
  const yamlBody = extractYamlBody(resultText);
  let data;
  try {
    data = load(yamlBody);
  } catch (e2) {
    throw new ClaudeCliError(`claude CLI YAML parse failed for ${manifest.name}: ${String(e2).slice(0, 200)}`);
  }
  if (typeof data !== "object" || data === null) {
    throw new ClaudeCliError(`claude CLI output not a YAML object for ${manifest.name}: got ${typeof data}`);
  }
  return data;
}
var ClaudeCliError, defaultRunner = async (argv2, timeoutMs, onSpawn, stdin2) => {
  return new Promise((resolveP) => {
    const controller = new AbortController;
    let timedOut = false;
    controller.signal.addEventListener("abort", () => {
      timedOut = true;
    });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const child = spawn2(argv2[0], argv2.slice(1), {
      stdio: [stdin2 === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      signal: controller.signal
    });
    if (stdin2 !== undefined) {
      child.stdin?.on("error", () => {});
      child.stdin?.end(stdin2);
    }
    const killEscalate = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        return;
      }
      const sigkill = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, KILL_GRACE_MS);
      if (typeof sigkill.unref === "function")
        sigkill.unref();
      child.once("exit", () => clearTimeout(sigkill));
    };
    controller.signal.addEventListener("abort", () => {
      const sigkill = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, KILL_GRACE_MS);
      if (typeof sigkill.unref === "function")
        sigkill.unref();
      child.once("exit", () => clearTimeout(sigkill));
    });
    onSpawn?.(killEscalate);
    let resolved = false;
    const finish = (r3) => {
      if (resolved)
        return;
      resolved = true;
      clearTimeout(timer);
      resolveP(r3);
    };
    const out = new CappedStreamBuffer;
    const err = new CappedStreamBuffer;
    child.stdout?.on("data", (c3) => {
      if (!out.push(c3))
        killEscalate();
    });
    child.stderr?.on("data", (c3) => {
      if (!err.push(c3))
        killEscalate();
    });
    child.on("error", (e2) => {
      finish({
        stdout: timedOut ? "" : out.toString(),
        stderr: timedOut ? String(e2) : err.toString() + String(e2),
        exitCode: -1,
        timedOut
      });
    });
    child.on("close", (code) => {
      const overflowed = out.overflowed || err.overflowed;
      finish({
        stdout: out.toString(),
        stderr: overflowed ? "output exceeded the capture byte cap" : err.toString(),
        exitCode: timedOut || overflowed ? -1 : code ?? -1,
        timedOut
      });
    });
  });
};
var init_claude_cli_agent = __esm(() => {
  init_js_yaml();
  init_subprocess();
  ClaudeCliError = class ClaudeCliError extends Error {
    stderr;
    exitCode;
    constructor(message, stderr, exitCode) {
      super(message);
      this.stderr = stderr;
      this.exitCode = exitCode;
      this.name = "ClaudeCliError";
    }
  };
});

// node_modules/@anthropic-ai/sdk/internal/tslib.mjs
function __classPrivateFieldSet(receiver, state, value, kind, f3) {
  if (kind === "m")
    throw new TypeError("Private method is not writable");
  if (kind === "a" && !f3)
    throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f3 : !state.has(receiver))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f3.call(receiver, value) : f3 ? f3.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldGet(receiver, state, kind, f3) {
  if (kind === "a" && !f3)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f3 : !state.has(receiver))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f3 : kind === "a" ? f3.call(receiver) : f3 ? f3.value : state.get(receiver);
}
var init_tslib = () => {};

// node_modules/@anthropic-ai/sdk/internal/utils/uuid.mjs
var uuid4 = function() {
  const { crypto: crypto2 } = globalThis;
  if (crypto2?.randomUUID) {
    uuid4 = crypto2.randomUUID.bind(crypto2);
    return crypto2.randomUUID();
  }
  const u8 = new Uint8Array(1);
  const randomByte = crypto2 ? () => crypto2.getRandomValues(u8)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c3) => (+c3 ^ randomByte() & 15 >> +c3 / 4).toString(16));
};

// node_modules/@anthropic-ai/sdk/internal/errors.mjs
function isAbortError(err) {
  return typeof err === "object" && err !== null && (("name" in err) && err.name === "AbortError" || ("message" in err) && String(err.message).includes("FetchRequestCanceledException"));
}
var castToError = (err) => {
  if (err instanceof Error)
    return err;
  if (typeof err === "object" && err !== null) {
    try {
      if (Object.prototype.toString.call(err) === "[object Error]") {
        const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
        if (err.stack)
          error.stack = err.stack;
        if (err.cause && !error.cause)
          error.cause = err.cause;
        if (err.name)
          error.name = err.name;
        return error;
      }
    } catch {}
    try {
      return new Error(JSON.stringify(err));
    } catch {}
  }
  return new Error(err);
};

// node_modules/@anthropic-ai/sdk/core/error.mjs
var AnthropicError, APIError, APIUserAbortError, APIConnectionError, APIConnectionTimeoutError, BadRequestError, AuthenticationError, PermissionDeniedError, NotFoundError, ConflictError, UnprocessableEntityError, RateLimitError, InternalServerError;
var init_error = __esm(() => {
  AnthropicError = class AnthropicError extends Error {
  };
  APIError = class APIError extends AnthropicError {
    constructor(status, error, message, headers, type2) {
      super(`${APIError.makeMessage(status, error, message)}`);
      this.status = status;
      this.headers = headers;
      this.requestID = headers?.get("request-id");
      this.error = error;
      this.type = type2 ?? null;
    }
    static makeMessage(status, error, message) {
      const msg = error?.message ? typeof error.message === "string" ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
      if (status && msg) {
        return `${status} ${msg}`;
      }
      if (status) {
        return `${status} status code (no body)`;
      }
      if (msg) {
        return msg;
      }
      return "(no status code or body)";
    }
    static generate(status, errorResponse, message, headers) {
      if (!status || !headers) {
        return new APIConnectionError({ message, cause: castToError(errorResponse) });
      }
      const error = errorResponse;
      const type2 = error?.["error"]?.["type"];
      if (status === 400) {
        return new BadRequestError(status, error, message, headers, type2);
      }
      if (status === 401) {
        return new AuthenticationError(status, error, message, headers, type2);
      }
      if (status === 403) {
        return new PermissionDeniedError(status, error, message, headers, type2);
      }
      if (status === 404) {
        return new NotFoundError(status, error, message, headers, type2);
      }
      if (status === 409) {
        return new ConflictError(status, error, message, headers, type2);
      }
      if (status === 422) {
        return new UnprocessableEntityError(status, error, message, headers, type2);
      }
      if (status === 429) {
        return new RateLimitError(status, error, message, headers, type2);
      }
      if (status >= 500) {
        return new InternalServerError(status, error, message, headers, type2);
      }
      return new APIError(status, error, message, headers, type2);
    }
  };
  APIUserAbortError = class APIUserAbortError extends APIError {
    constructor({ message } = {}) {
      super(undefined, undefined, message || "Request was aborted.", undefined);
    }
  };
  APIConnectionError = class APIConnectionError extends APIError {
    constructor({ message, cause }) {
      super(undefined, undefined, message || "Connection error.", undefined);
      if (cause)
        this.cause = cause;
    }
  };
  APIConnectionTimeoutError = class APIConnectionTimeoutError extends APIConnectionError {
    constructor({ message } = {}) {
      super({ message: message ?? "Request timed out." });
    }
  };
  BadRequestError = class BadRequestError extends APIError {
  };
  AuthenticationError = class AuthenticationError extends APIError {
  };
  PermissionDeniedError = class PermissionDeniedError extends APIError {
  };
  NotFoundError = class NotFoundError extends APIError {
  };
  ConflictError = class ConflictError extends APIError {
  };
  UnprocessableEntityError = class UnprocessableEntityError extends APIError {
  };
  RateLimitError = class RateLimitError extends APIError {
  };
  InternalServerError = class InternalServerError extends APIError {
  };
});

// node_modules/@anthropic-ai/sdk/internal/utils/values.mjs
function maybeObj(x2) {
  if (typeof x2 !== "object") {
    return {};
  }
  return x2 ?? {};
}
function isEmptyObj(obj) {
  if (!obj)
    return true;
  for (const _k in obj)
    return false;
  return true;
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
var startsWithSchemeRegexp, isAbsoluteURL = (url) => {
  return startsWithSchemeRegexp.test(url);
}, isArray = (val) => (isArray = Array.isArray, isArray(val)), isReadonlyArray, validatePositiveInteger = (name, n2) => {
  if (typeof n2 !== "number" || !Number.isInteger(n2)) {
    throw new AnthropicError(`${name} must be an integer`);
  }
  if (n2 < 0) {
    throw new AnthropicError(`${name} must be a positive integer`);
  }
  return n2;
}, safeJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return;
  }
};
var init_values = __esm(() => {
  init_error();
  startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
  isReadonlyArray = isArray;
});

// node_modules/@anthropic-ai/sdk/internal/utils/sleep.mjs
var sleep = (ms) => new Promise((resolve11) => setTimeout(resolve11, ms));

// node_modules/@anthropic-ai/sdk/version.mjs
var VERSION = "0.91.1";

// node_modules/@anthropic-ai/sdk/internal/detect-platform.mjs
function getDetectedPlatform() {
  if (typeof Deno !== "undefined" && Deno.build != null) {
    return "deno";
  }
  if (typeof EdgeRuntime !== "undefined") {
    return "edge";
  }
  if (Object.prototype.toString.call(typeof globalThis.process !== "undefined" ? globalThis.process : 0) === "[object process]") {
    return "node";
  }
  return "unknown";
}
function getBrowserInfo() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const browserPatterns = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key, pattern } of browserPatterns) {
    const match = pattern.exec(navigator.userAgent);
    if (match) {
      const major = match[1] || 0;
      const minor = match[2] || 0;
      const patch = match[3] || 0;
      return { browser: key, version: `${major}.${minor}.${patch}` };
    }
  }
  return null;
}
var isRunningInBrowser = () => {
  return typeof window !== "undefined" && typeof window.document !== "undefined" && typeof navigator !== "undefined";
}, getPlatformProperties = () => {
  const detectedPlatform = getDetectedPlatform();
  if (detectedPlatform === "deno") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(Deno.build.os),
      "X-Stainless-Arch": normalizeArch(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version === "string" ? Deno.version : Deno.version?.deno ?? "unknown"
    };
  }
  if (typeof EdgeRuntime !== "undefined") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  }
  if (detectedPlatform === "node") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": normalizeArch(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
    };
  }
  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": "unknown",
      "X-Stainless-Runtime": `browser:${browserInfo.browser}`,
      "X-Stainless-Runtime-Version": browserInfo.version
    };
  }
  return {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": VERSION,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
}, normalizeArch = (arch) => {
  if (arch === "x32")
    return "x32";
  if (arch === "x86_64" || arch === "x64")
    return "x64";
  if (arch === "arm")
    return "arm";
  if (arch === "aarch64" || arch === "arm64")
    return "arm64";
  if (arch)
    return `other:${arch}`;
  return "unknown";
}, normalizePlatform = (platform2) => {
  platform2 = platform2.toLowerCase();
  if (platform2.includes("ios"))
    return "iOS";
  if (platform2 === "android")
    return "Android";
  if (platform2 === "darwin")
    return "MacOS";
  if (platform2 === "win32")
    return "Windows";
  if (platform2 === "freebsd")
    return "FreeBSD";
  if (platform2 === "openbsd")
    return "OpenBSD";
  if (platform2 === "linux")
    return "Linux";
  if (platform2)
    return `Other:${platform2}`;
  return "Unknown";
}, _platformHeaders, getPlatformHeaders = () => {
  return _platformHeaders ?? (_platformHeaders = getPlatformProperties());
};
var init_detect_platform = () => {};

// node_modules/@anthropic-ai/sdk/internal/shims.mjs
function getDefaultFetch() {
  if (typeof fetch !== "undefined") {
    return fetch;
  }
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new Anthropic({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function makeReadableStream(...args) {
  const ReadableStream = globalThis.ReadableStream;
  if (typeof ReadableStream === "undefined") {
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  }
  return new ReadableStream(...args);
}
function ReadableStreamFrom(iterable) {
  let iter = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
  return makeReadableStream({
    start() {},
    async pull(controller) {
      const { done, value } = await iter.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel() {
      await iter.return?.();
    }
  });
}
function ReadableStreamToAsyncIterable(stream) {
  if (stream[Symbol.asyncIterator])
    return stream;
  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result?.done)
          reader.releaseLock();
        return result;
      } catch (e2) {
        reader.releaseLock();
        throw e2;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function CancelReadableStream(stream) {
  if (stream === null || typeof stream !== "object")
    return;
  if (stream[Symbol.asyncIterator]) {
    await stream[Symbol.asyncIterator]().return?.();
    return;
  }
  const reader = stream.getReader();
  const cancelPromise = reader.cancel();
  reader.releaseLock();
  await cancelPromise;
}

// node_modules/@anthropic-ai/sdk/internal/request-options.mjs
var FallbackEncoder = ({ headers, body }) => {
  return {
    bodyHeaders: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

// node_modules/@anthropic-ai/sdk/internal/utils/query.mjs
function stringifyQuery(query) {
  return Object.entries(query).filter(([_3, value]) => typeof value !== "undefined").map(([key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
    if (value === null) {
      return `${encodeURIComponent(key)}=`;
    }
    throw new AnthropicError(`Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
  }).join("&");
}
var init_query = __esm(() => {
  init_error();
});

// node_modules/@anthropic-ai/sdk/internal/utils/bytes.mjs
function concatBytes(buffers) {
  let length = 0;
  for (const buffer of buffers) {
    length += buffer.length;
  }
  const output = new Uint8Array(length);
  let index = 0;
  for (const buffer of buffers) {
    output.set(buffer, index);
    index += buffer.length;
  }
  return output;
}
function encodeUTF8(str2) {
  let encoder;
  return (encodeUTF8_ ?? (encoder = new globalThis.TextEncoder, encodeUTF8_ = encoder.encode.bind(encoder)))(str2);
}
function decodeUTF8(bytes) {
  let decoder;
  return (decodeUTF8_ ?? (decoder = new globalThis.TextDecoder, decodeUTF8_ = decoder.decode.bind(decoder)))(bytes);
}
var encodeUTF8_, decodeUTF8_;

// node_modules/@anthropic-ai/sdk/internal/decoders/line.mjs
class LineDecoder {
  constructor() {
    _LineDecoder_buffer.set(this, undefined);
    _LineDecoder_carriageReturnIndex.set(this, undefined);
    __classPrivateFieldSet(this, _LineDecoder_buffer, new Uint8Array, "f");
    __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
  }
  decode(chunk) {
    if (chunk == null) {
      return [];
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? encodeUTF8(chunk) : chunk;
    __classPrivateFieldSet(this, _LineDecoder_buffer, concatBytes([__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), binaryChunk]), "f");
    const lines = [];
    let patternIndex;
    while ((patternIndex = findNewlineIndex(__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"))) != null) {
      if (patternIndex.carriage && __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") == null) {
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, patternIndex.index, "f");
        continue;
      }
      if (__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") != null && (patternIndex.index !== __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") + 1 || patternIndex.carriage)) {
        lines.push(decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") - 1)));
        __classPrivateFieldSet(this, _LineDecoder_buffer, __classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f")), "f");
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
        continue;
      }
      const endIndex = __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") !== null ? patternIndex.preceding - 1 : patternIndex.preceding;
      const line = decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, endIndex));
      lines.push(line);
      __classPrivateFieldSet(this, _LineDecoder_buffer, __classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(patternIndex.index), "f");
      __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
    }
    return lines;
  }
  flush() {
    if (!__classPrivateFieldGet(this, _LineDecoder_buffer, "f").length) {
      return [];
    }
    return this.decode(`
`);
  }
}
function findNewlineIndex(buffer, startIndex) {
  const newline = 10;
  const carriage = 13;
  for (let i2 = startIndex ?? 0;i2 < buffer.length; i2++) {
    if (buffer[i2] === newline) {
      return { preceding: i2, index: i2 + 1, carriage: false };
    }
    if (buffer[i2] === carriage) {
      return { preceding: i2, index: i2 + 1, carriage: true };
    }
  }
  return null;
}
function findDoubleNewlineIndex(buffer) {
  const newline = 10;
  const carriage = 13;
  for (let i2 = 0;i2 < buffer.length - 1; i2++) {
    if (buffer[i2] === newline && buffer[i2 + 1] === newline) {
      return i2 + 2;
    }
    if (buffer[i2] === carriage && buffer[i2 + 1] === carriage) {
      return i2 + 2;
    }
    if (buffer[i2] === carriage && buffer[i2 + 1] === newline && i2 + 3 < buffer.length && buffer[i2 + 2] === carriage && buffer[i2 + 3] === newline) {
      return i2 + 4;
    }
  }
  return -1;
}
var _LineDecoder_buffer, _LineDecoder_carriageReturnIndex;
var init_line = __esm(() => {
  init_tslib();
  _LineDecoder_buffer = new WeakMap, _LineDecoder_carriageReturnIndex = new WeakMap;
  LineDecoder.NEWLINE_CHARS = new Set([`
`, "\r"]);
  LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
});

// node_modules/@anthropic-ai/sdk/internal/utils/log.mjs
function noop() {}
function makeLogFn(fnLevel, logger, logLevel) {
  if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  } else {
    return logger[fnLevel].bind(logger);
  }
}
function loggerFor(client) {
  const logger = client.logger;
  const logLevel = client.logLevel ?? "off";
  if (!logger) {
    return noopLogger;
  }
  const cachedLogger = cachedLoggers.get(logger);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }
  const levelLogger = {
    error: makeLogFn("error", logger, logLevel),
    warn: makeLogFn("warn", logger, logLevel),
    info: makeLogFn("info", logger, logLevel),
    debug: makeLogFn("debug", logger, logLevel)
  };
  cachedLoggers.set(logger, [logLevel, levelLogger]);
  return levelLogger;
}
var levelNumbers, parseLogLevel = (maybeLevel, sourceName, client) => {
  if (!maybeLevel) {
    return;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel;
  }
  loggerFor(client).warn(`${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(Object.keys(levelNumbers))}`);
  return;
}, noopLogger, cachedLoggers, formatRequestDetails = (details) => {
  if (details.options) {
    details.options = { ...details.options };
    delete details.options["headers"];
  }
  if (details.headers) {
    details.headers = Object.fromEntries((details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(([name, value]) => [
      name,
      name.toLowerCase() === "x-api-key" || name.toLowerCase() === "authorization" || name.toLowerCase() === "cookie" || name.toLowerCase() === "set-cookie" ? "***" : value
    ]));
  }
  if ("retryOfRequestLogID" in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};
var init_log = __esm(() => {
  init_values();
  levelNumbers = {
    off: 0,
    error: 200,
    warn: 300,
    info: 400,
    debug: 500
  };
  noopLogger = {
    error: noop,
    warn: noop,
    info: noop,
    debug: noop
  };
  cachedLoggers = /* @__PURE__ */ new WeakMap;
});

// node_modules/@anthropic-ai/sdk/core/streaming.mjs
async function* _iterSSEMessages(response, controller) {
  if (!response.body) {
    controller.abort();
    if (typeof globalThis.navigator !== "undefined" && globalThis.navigator.product === "ReactNative") {
      throw new AnthropicError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
    }
    throw new AnthropicError(`Attempted to iterate over a response with no body`);
  }
  const sseDecoder = new SSEDecoder;
  const lineDecoder = new LineDecoder;
  const iter = ReadableStreamToAsyncIterable(response.body);
  for await (const sseChunk of iterSSEChunks(iter)) {
    for (const line of lineDecoder.decode(sseChunk)) {
      const sse = sseDecoder.decode(line);
      if (sse)
        yield sse;
    }
  }
  for (const line of lineDecoder.flush()) {
    const sse = sseDecoder.decode(line);
    if (sse)
      yield sse;
  }
}
async function* iterSSEChunks(iterator) {
  let data = new Uint8Array;
  for await (const chunk of iterator) {
    if (chunk == null) {
      continue;
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? encodeUTF8(chunk) : chunk;
    let newData = new Uint8Array(data.length + binaryChunk.length);
    newData.set(data);
    newData.set(binaryChunk, data.length);
    data = newData;
    let patternIndex;
    while ((patternIndex = findDoubleNewlineIndex(data)) !== -1) {
      yield data.slice(0, patternIndex);
      data = data.slice(patternIndex);
    }
  }
  if (data.length > 0) {
    yield data;
  }
}

class SSEDecoder {
  constructor() {
    this.event = null;
    this.data = [];
    this.chunks = [];
  }
  decode(line) {
    if (line.endsWith("\r")) {
      line = line.substring(0, line.length - 1);
    }
    if (!line) {
      if (!this.event && !this.data.length)
        return null;
      const sse = {
        event: this.event,
        data: this.data.join(`
`),
        raw: this.chunks
      };
      this.event = null;
      this.data = [];
      this.chunks = [];
      return sse;
    }
    this.chunks.push(line);
    if (line.startsWith(":")) {
      return null;
    }
    let [fieldname, _3, value] = partition(line, ":");
    if (value.startsWith(" ")) {
      value = value.substring(1);
    }
    if (fieldname === "event") {
      this.event = value;
    } else if (fieldname === "data") {
      this.data.push(value);
    }
    return null;
  }
}
function partition(str2, delimiter) {
  const index = str2.indexOf(delimiter);
  if (index !== -1) {
    return [str2.substring(0, index), delimiter, str2.substring(index + delimiter.length)];
  }
  return [str2, "", ""];
}
var _Stream_client, Stream;
var init_streaming = __esm(() => {
  init_tslib();
  init_error();
  init_line();
  init_values();
  init_log();
  init_error();
  Stream = class Stream {
    constructor(iterator, controller, client) {
      this.iterator = iterator;
      _Stream_client.set(this, undefined);
      this.controller = controller;
      __classPrivateFieldSet(this, _Stream_client, client, "f");
    }
    static fromSSEResponse(response, controller, client) {
      let consumed = false;
      const logger = client ? loggerFor(client) : console;
      async function* iterator() {
        if (consumed) {
          throw new AnthropicError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        }
        consumed = true;
        let done = false;
        try {
          for await (const sse of _iterSSEMessages(response, controller)) {
            if (sse.event === "completion") {
              try {
                yield JSON.parse(sse.data);
              } catch (e2) {
                logger.error(`Could not parse message into JSON:`, sse.data);
                logger.error(`From chunk:`, sse.raw);
                throw e2;
              }
            }
            if (sse.event === "message_start" || sse.event === "message_delta" || sse.event === "message_stop" || sse.event === "content_block_start" || sse.event === "content_block_delta" || sse.event === "content_block_stop" || sse.event === "message" || sse.event === "user.message" || sse.event === "user.interrupt" || sse.event === "user.tool_confirmation" || sse.event === "user.custom_tool_result" || sse.event === "agent.message" || sse.event === "agent.thinking" || sse.event === "agent.tool_use" || sse.event === "agent.tool_result" || sse.event === "agent.mcp_tool_use" || sse.event === "agent.mcp_tool_result" || sse.event === "agent.custom_tool_use" || sse.event === "agent.thread_context_compacted" || sse.event === "session.status_running" || sse.event === "session.status_idle" || sse.event === "session.status_rescheduled" || sse.event === "session.status_terminated" || sse.event === "session.error" || sse.event === "session.deleted" || sse.event === "span.model_request_start" || sse.event === "span.model_request_end") {
              try {
                yield JSON.parse(sse.data);
              } catch (e2) {
                logger.error(`Could not parse message into JSON:`, sse.data);
                logger.error(`From chunk:`, sse.raw);
                throw e2;
              }
            }
            if (sse.event === "ping") {
              continue;
            }
            if (sse.event === "error") {
              const body = safeJSON(sse.data) ?? sse.data;
              const type2 = body?.error?.type;
              throw new APIError(undefined, body, undefined, response.headers, type2);
            }
          }
          done = true;
        } catch (e2) {
          if (isAbortError(e2))
            return;
          throw e2;
        } finally {
          if (!done)
            controller.abort();
        }
      }
      return new Stream(iterator, controller, client);
    }
    static fromReadableStream(readableStream, controller, client) {
      let consumed = false;
      async function* iterLines() {
        const lineDecoder = new LineDecoder;
        const iter = ReadableStreamToAsyncIterable(readableStream);
        for await (const chunk of iter) {
          for (const line of lineDecoder.decode(chunk)) {
            yield line;
          }
        }
        for (const line of lineDecoder.flush()) {
          yield line;
        }
      }
      async function* iterator() {
        if (consumed) {
          throw new AnthropicError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        }
        consumed = true;
        let done = false;
        try {
          for await (const line of iterLines()) {
            if (done)
              continue;
            if (line)
              yield JSON.parse(line);
          }
          done = true;
        } catch (e2) {
          if (isAbortError(e2))
            return;
          throw e2;
        } finally {
          if (!done)
            controller.abort();
        }
      }
      return new Stream(iterator, controller, client);
    }
    [(_Stream_client = new WeakMap, Symbol.asyncIterator)]() {
      return this.iterator();
    }
    tee() {
      const left = [];
      const right = [];
      const iterator = this.iterator();
      const teeIterator = (queue2) => {
        return {
          next: () => {
            if (queue2.length === 0) {
              const result = iterator.next();
              left.push(result);
              right.push(result);
            }
            return queue2.shift();
          }
        };
      };
      return [
        new Stream(() => teeIterator(left), this.controller, __classPrivateFieldGet(this, _Stream_client, "f")),
        new Stream(() => teeIterator(right), this.controller, __classPrivateFieldGet(this, _Stream_client, "f"))
      ];
    }
    toReadableStream() {
      const self = this;
      let iter;
      return makeReadableStream({
        async start() {
          iter = self[Symbol.asyncIterator]();
        },
        async pull(ctrl) {
          try {
            const { value, done } = await iter.next();
            if (done)
              return ctrl.close();
            const bytes = encodeUTF8(JSON.stringify(value) + `
`);
            ctrl.enqueue(bytes);
          } catch (err) {
            ctrl.error(err);
          }
        },
        async cancel() {
          await iter.return?.();
        }
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/internal/parse.mjs
async function defaultParseResponse(client, props) {
  const { response, requestLogID, retryOfRequestLogID, startTime } = props;
  const body = await (async () => {
    if (props.options.stream) {
      loggerFor(client).debug("response", response.status, response.url, response.headers, response.body);
      if (props.options.__streamClass) {
        return props.options.__streamClass.fromSSEResponse(response, props.controller);
      }
      return Stream.fromSSEResponse(response, props.controller);
    }
    if (response.status === 204) {
      return null;
    }
    if (props.options.__binaryResponse) {
      return response;
    }
    const contentType = response.headers.get("content-type");
    const mediaType = contentType?.split(";")[0]?.trim();
    const isJSON = mediaType?.includes("application/json") || mediaType?.endsWith("+json");
    if (isJSON) {
      const contentLength = response.headers.get("content-length");
      if (contentLength === "0") {
        return;
      }
      const json2 = await response.json();
      return addRequestID(json2, response);
    }
    const text = await response.text();
    return text;
  })();
  loggerFor(client).debug(`[${requestLogID}] response parsed`, formatRequestDetails({
    retryOfRequestLogID,
    url: response.url,
    status: response.status,
    body,
    durationMs: Date.now() - startTime
  }));
  return body;
}
function addRequestID(value, response) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.defineProperty(value, "_request_id", {
    value: response.headers.get("request-id"),
    enumerable: false
  });
}
var init_parse = __esm(() => {
  init_streaming();
  init_log();
});

// node_modules/@anthropic-ai/sdk/core/api-promise.mjs
var _APIPromise_client, APIPromise;
var init_api_promise = __esm(() => {
  init_tslib();
  init_parse();
  APIPromise = class APIPromise extends Promise {
    constructor(client, responsePromise, parseResponse = defaultParseResponse) {
      super((resolve11) => {
        resolve11(null);
      });
      this.responsePromise = responsePromise;
      this.parseResponse = parseResponse;
      _APIPromise_client.set(this, undefined);
      __classPrivateFieldSet(this, _APIPromise_client, client, "f");
    }
    _thenUnwrap(transform) {
      return new APIPromise(__classPrivateFieldGet(this, _APIPromise_client, "f"), this.responsePromise, async (client, props) => addRequestID(transform(await this.parseResponse(client, props), props), props.response));
    }
    asResponse() {
      return this.responsePromise.then((p) => p.response);
    }
    async withResponse() {
      const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
      return { data, response, request_id: response.headers.get("request-id") };
    }
    parse() {
      if (!this.parsedPromise) {
        this.parsedPromise = this.responsePromise.then((data) => this.parseResponse(__classPrivateFieldGet(this, _APIPromise_client, "f"), data));
      }
      return this.parsedPromise;
    }
    then(onfulfilled, onrejected) {
      return this.parse().then(onfulfilled, onrejected);
    }
    catch(onrejected) {
      return this.parse().catch(onrejected);
    }
    finally(onfinally) {
      return this.parse().finally(onfinally);
    }
  };
  _APIPromise_client = new WeakMap;
});

// node_modules/@anthropic-ai/sdk/core/pagination.mjs
var _AbstractPage_client, AbstractPage, PagePromise, Page, PageCursor;
var init_pagination = __esm(() => {
  init_tslib();
  init_error();
  init_parse();
  init_api_promise();
  init_values();
  AbstractPage = class AbstractPage {
    constructor(client, response, body, options) {
      _AbstractPage_client.set(this, undefined);
      __classPrivateFieldSet(this, _AbstractPage_client, client, "f");
      this.options = options;
      this.response = response;
      this.body = body;
    }
    hasNextPage() {
      const items = this.getPaginatedItems();
      if (!items.length)
        return false;
      return this.nextPageRequestOptions() != null;
    }
    async getNextPage() {
      const nextOptions = this.nextPageRequestOptions();
      if (!nextOptions) {
        throw new AnthropicError("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
      }
      return await __classPrivateFieldGet(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
    }
    async* iterPages() {
      let page = this;
      yield page;
      while (page.hasNextPage()) {
        page = await page.getNextPage();
        yield page;
      }
    }
    async* [(_AbstractPage_client = new WeakMap, Symbol.asyncIterator)]() {
      for await (const page of this.iterPages()) {
        for (const item of page.getPaginatedItems()) {
          yield item;
        }
      }
    }
  };
  PagePromise = class PagePromise extends APIPromise {
    constructor(client, request, Page) {
      super(client, request, async (client2, props) => new Page(client2, props.response, await defaultParseResponse(client2, props), props.options));
    }
    async* [Symbol.asyncIterator]() {
      const page = await this;
      for await (const item of page) {
        yield item;
      }
    }
  };
  Page = class Page extends AbstractPage {
    constructor(client, response, body, options) {
      super(client, response, body, options);
      this.data = body.data || [];
      this.has_more = body.has_more || false;
      this.first_id = body.first_id || null;
      this.last_id = body.last_id || null;
    }
    getPaginatedItems() {
      return this.data ?? [];
    }
    hasNextPage() {
      if (this.has_more === false) {
        return false;
      }
      return super.hasNextPage();
    }
    nextPageRequestOptions() {
      if (this.options.query?.["before_id"]) {
        const first_id = this.first_id;
        if (!first_id) {
          return null;
        }
        return {
          ...this.options,
          query: {
            ...maybeObj(this.options.query),
            before_id: first_id
          }
        };
      }
      const cursor = this.last_id;
      if (!cursor) {
        return null;
      }
      return {
        ...this.options,
        query: {
          ...maybeObj(this.options.query),
          after_id: cursor
        }
      };
    }
  };
  PageCursor = class PageCursor extends AbstractPage {
    constructor(client, response, body, options) {
      super(client, response, body, options);
      this.data = body.data || [];
      this.next_page = body.next_page || null;
    }
    getPaginatedItems() {
      return this.data ?? [];
    }
    nextPageRequestOptions() {
      const cursor = this.next_page;
      if (!cursor) {
        return null;
      }
      return {
        ...this.options,
        query: {
          ...maybeObj(this.options.query),
          page: cursor
        }
      };
    }
  };
});

// node_modules/@anthropic-ai/sdk/internal/uploads.mjs
function makeFile(fileBits, fileName, options) {
  checkFileSupport();
  return new File(fileBits, fileName ?? "unknown_file", options);
}
function getName(value, stripPath) {
  const val = typeof value === "object" && value !== null && (("name" in value) && value.name && String(value.name) || ("url" in value) && value.url && String(value.url) || ("filename" in value) && value.filename && String(value.filename) || ("path" in value) && value.path && String(value.path)) || "";
  return stripPath ? val.split(/[\\/]/).pop() || undefined : val;
}
function supportsFormData(fetchObject) {
  const fetch2 = typeof fetchObject === "function" ? fetchObject : fetchObject.fetch;
  const cached = supportsFormDataMap.get(fetch2);
  if (cached)
    return cached;
  const promise = (async () => {
    try {
      const FetchResponse = "Response" in fetch2 ? fetch2.Response : (await fetch2("data:,")).constructor;
      const data = new FormData;
      if (data.toString() === await new FetchResponse(data).text()) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  })();
  supportsFormDataMap.set(fetch2, promise);
  return promise;
}
var checkFileSupport = () => {
  if (typeof File === "undefined") {
    const { process: process2 } = globalThis;
    const isOldNode = typeof process2?.versions?.node === "string" && parseInt(process2.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (isOldNode ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
}, isAsyncIterable = (value) => value != null && typeof value === "object" && typeof value[Symbol.asyncIterator] === "function", multipartFormRequestOptions = async (opts, fetch2, stripFilenames = true) => {
  return { ...opts, body: await createForm(opts.body, fetch2, stripFilenames) };
}, supportsFormDataMap, createForm = async (body, fetch2, stripFilenames = true) => {
  if (!await supportsFormData(fetch2)) {
    throw new TypeError("The provided fetch function does not support file uploads with the current global FormData class.");
  }
  const form = new FormData;
  await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value, stripFilenames)));
  return form;
}, isNamedBlob = (value) => value instanceof Blob && ("name" in value), addFormValue = async (form, key, value, stripFilenames) => {
  if (value === undefined)
    return;
  if (value == null) {
    throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    form.append(key, String(value));
  } else if (value instanceof Response) {
    let options = {};
    const contentType = value.headers.get("Content-Type");
    if (contentType) {
      options = { type: contentType };
    }
    form.append(key, makeFile([await value.blob()], getName(value, stripFilenames), options));
  } else if (isAsyncIterable(value)) {
    form.append(key, makeFile([await new Response(ReadableStreamFrom(value)).blob()], getName(value, stripFilenames)));
  } else if (isNamedBlob(value)) {
    form.append(key, makeFile([value], getName(value, stripFilenames), { type: value.type }));
  } else if (Array.isArray(value)) {
    await Promise.all(value.map((entry) => addFormValue(form, key + "[]", entry, stripFilenames)));
  } else if (typeof value === "object") {
    await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop, stripFilenames)));
  } else {
    throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
  }
};
var init_uploads = __esm(() => {
  supportsFormDataMap = /* @__PURE__ */ new WeakMap;
});

// node_modules/@anthropic-ai/sdk/internal/to-file.mjs
async function toFile(value, name, options) {
  checkFileSupport();
  value = await value;
  name || (name = getName(value, true));
  if (isFileLike(value)) {
    if (value instanceof File && name == null && options == null) {
      return value;
    }
    return makeFile([await value.arrayBuffer()], name ?? value.name, {
      type: value.type,
      lastModified: value.lastModified,
      ...options
    });
  }
  if (isResponseLike(value)) {
    const blob = await value.blob();
    name || (name = new URL(value.url).pathname.split(/[\\/]/).pop());
    return makeFile(await getBytes(blob), name, options);
  }
  const parts = await getBytes(value);
  if (!options?.type) {
    const type2 = parts.find((part) => typeof part === "object" && ("type" in part) && part.type);
    if (typeof type2 === "string") {
      options = { ...options, type: type2 };
    }
  }
  return makeFile(parts, name, options);
}
async function getBytes(value) {
  let parts = [];
  if (typeof value === "string" || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    parts.push(value);
  } else if (isBlobLike(value)) {
    parts.push(value instanceof Blob ? value : await value.arrayBuffer());
  } else if (isAsyncIterable(value)) {
    for await (const chunk of value) {
      parts.push(...await getBytes(chunk));
    }
  } else {
    const constructor = value?.constructor?.name;
    throw new Error(`Unexpected data type: ${typeof value}${constructor ? `; constructor: ${constructor}` : ""}${propsForError(value)}`);
  }
  return parts;
}
function propsForError(value) {
  if (typeof value !== "object" || value === null)
    return "";
  const props = Object.getOwnPropertyNames(value);
  return `; props: [${props.map((p) => `"${p}"`).join(", ")}]`;
}
var isBlobLike = (value) => value != null && typeof value === "object" && typeof value.size === "number" && typeof value.type === "string" && typeof value.text === "function" && typeof value.slice === "function" && typeof value.arrayBuffer === "function", isFileLike = (value) => value != null && typeof value === "object" && typeof value.name === "string" && typeof value.lastModified === "number" && isBlobLike(value), isResponseLike = (value) => value != null && typeof value === "object" && typeof value.url === "string" && typeof value.blob === "function";
var init_to_file = __esm(() => {
  init_uploads();
  init_uploads();
});

// node_modules/@anthropic-ai/sdk/core/uploads.mjs
var init_uploads2 = __esm(() => {
  init_to_file();
});

// node_modules/@anthropic-ai/sdk/resources/shared.mjs
var init_shared = () => {};

// node_modules/@anthropic-ai/sdk/core/resource.mjs
class APIResource {
  constructor(client) {
    this._client = client;
  }
}

// node_modules/@anthropic-ai/sdk/internal/headers.mjs
function* iterateHeaders(headers) {
  if (!headers)
    return;
  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }
  let shouldClear = false;
  let iter;
  if (headers instanceof Headers) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (let row of iter) {
    const name = row[0];
    if (typeof name !== "string")
      throw new TypeError("expected header name to be a string");
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === undefined)
        continue;
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, null];
      }
      yield [name, value];
    }
  }
}
var brand_privateNullableHeaders, buildHeaders = (newHeaders) => {
  const targetHeaders = new Headers;
  const nullHeaders = new Set;
  for (const headers of newHeaders) {
    const seenHeaders = new Set;
    for (const [name, value] of iterateHeaders(headers)) {
      const lowerName = name.toLowerCase();
      if (!seenHeaders.has(lowerName)) {
        targetHeaders.delete(name);
        seenHeaders.add(lowerName);
      }
      if (value === null) {
        targetHeaders.delete(name);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(name, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};
var init_headers = __esm(() => {
  init_values();
  brand_privateNullableHeaders = Symbol.for("brand.privateNullableHeaders");
});

// node_modules/@anthropic-ai/sdk/internal/utils/path.mjs
function encodeURIPath(str2) {
  return str2.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
var EMPTY, createPathTagFunction = (pathEncoder = encodeURIPath) => function path(statics, ...params) {
  if (statics.length === 1)
    return statics[0];
  let postPath = false;
  const invalidSegments = [];
  const path = statics.reduce((previousValue, currentValue, index) => {
    if (/[?#]/.test(currentValue)) {
      postPath = true;
    }
    const value = params[index];
    let encoded = (postPath ? encodeURIComponent : pathEncoder)("" + value);
    if (index !== params.length && (value == null || typeof value === "object" && value.toString === Object.getPrototypeOf(Object.getPrototypeOf(value.hasOwnProperty ?? EMPTY) ?? EMPTY)?.toString)) {
      encoded = value + "";
      invalidSegments.push({
        start: previousValue.length + currentValue.length,
        length: encoded.length,
        error: `Value of type ${Object.prototype.toString.call(value).slice(8, -1)} is not a valid path parameter`
      });
    }
    return previousValue + currentValue + (index === params.length ? "" : encoded);
  }, "");
  const pathOnly = path.split(/[?#]/, 1)[0];
  const invalidSegmentPattern = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
  let match;
  while ((match = invalidSegmentPattern.exec(pathOnly)) !== null) {
    invalidSegments.push({
      start: match.index,
      length: match[0].length,
      error: `Value "${match[0]}" can't be safely passed as a path parameter`
    });
  }
  invalidSegments.sort((a2, b2) => a2.start - b2.start);
  if (invalidSegments.length > 0) {
    let lastEnd = 0;
    const underline = invalidSegments.reduce((acc, segment) => {
      const spaces = " ".repeat(segment.start - lastEnd);
      const arrows = "^".repeat(segment.length);
      lastEnd = segment.start + segment.length;
      return acc + spaces + arrows;
    }, "");
    throw new AnthropicError(`Path parameters result in path with invalid segments:
${invalidSegments.map((e2) => e2.error).join(`
`)}
${path}
${underline}`);
  }
  return path;
}, path;
var init_path = __esm(() => {
  init_error();
  EMPTY = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null));
  path = /* @__PURE__ */ createPathTagFunction(encodeURIPath);
});

// node_modules/@anthropic-ai/sdk/resources/beta/environments.mjs
var Environments;
var init_environments = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Environments = class Environments extends APIResource {
    create(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/environments?beta=true", {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(environmentID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/environments/${environmentID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    update(environmentID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/environments/${environmentID}?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/environments?beta=true", PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    delete(environmentID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.delete(path`/v1/environments/${environmentID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    archive(environmentID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.post(path`/v1/environments/${environmentID}/archive?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/lib/stainless-helper-header.mjs
function wasCreatedByStainlessHelper(value) {
  return typeof value === "object" && value !== null && SDK_HELPER_SYMBOL in value;
}
function collectStainlessHelpers(tools, messages) {
  const helpers = new Set;
  if (tools) {
    for (const tool of tools) {
      if (wasCreatedByStainlessHelper(tool)) {
        helpers.add(tool[SDK_HELPER_SYMBOL]);
      }
    }
  }
  if (messages) {
    for (const message of messages) {
      if (wasCreatedByStainlessHelper(message)) {
        helpers.add(message[SDK_HELPER_SYMBOL]);
      }
      if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (wasCreatedByStainlessHelper(block)) {
            helpers.add(block[SDK_HELPER_SYMBOL]);
          }
        }
      }
    }
  }
  return Array.from(helpers);
}
function stainlessHelperHeader(tools, messages) {
  const helpers = collectStainlessHelpers(tools, messages);
  if (helpers.length === 0)
    return {};
  return { "x-stainless-helper": helpers.join(", ") };
}
function stainlessHelperHeaderFromFile(file) {
  if (wasCreatedByStainlessHelper(file)) {
    return { "x-stainless-helper": file[SDK_HELPER_SYMBOL] };
  }
  return {};
}
var SDK_HELPER_SYMBOL;
var init_stainless_helper_header = __esm(() => {
  SDK_HELPER_SYMBOL = Symbol("anthropic.sdk.stainlessHelper");
});

// node_modules/@anthropic-ai/sdk/resources/beta/files.mjs
var Files;
var init_files = __esm(() => {
  init_pagination();
  init_headers();
  init_stainless_helper_header();
  init_uploads();
  init_path();
  Files = class Files extends APIResource {
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/files?beta=true", Page, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString() },
          options?.headers
        ])
      });
    }
    delete(fileID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.delete(path`/v1/files/${fileID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString() },
          options?.headers
        ])
      });
    }
    download(fileID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/files/${fileID}/content?beta=true`, {
        ...options,
        headers: buildHeaders([
          {
            "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString(),
            Accept: "application/binary"
          },
          options?.headers
        ]),
        __binaryResponse: true
      });
    }
    retrieveMetadata(fileID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/files/${fileID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString() },
          options?.headers
        ])
      });
    }
    upload(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/files?beta=true", multipartFormRequestOptions({
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString() },
          stainlessHelperHeaderFromFile(body.file),
          options?.headers
        ])
      }, this._client));
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/models.mjs
var Models;
var init_models = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Models = class Models extends APIResource {
    retrieve(modelID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/models/${modelID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : undefined },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/models?beta=true", Page, {
        query,
        ...options,
        headers: buildHeaders([
          { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : undefined },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/user-profiles.mjs
var UserProfiles;
var init_user_profiles = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  UserProfiles = class UserProfiles extends APIResource {
    create(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/user_profiles?beta=true", {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(userProfileID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/user_profiles/${userProfileID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
          options?.headers
        ])
      });
    }
    update(userProfileID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/user_profiles/${userProfileID}?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/user_profiles?beta=true", PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
          options?.headers
        ])
      });
    }
    createEnrollmentURL(userProfileID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.post(path`/v1/user_profiles/${userProfileID}/enrollment_url?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/agents/versions.mjs
var Versions;
var init_versions = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Versions = class Versions extends APIResource {
    list(agentID, params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList(path`/v1/agents/${agentID}/versions?beta=true`, PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/agents/agents.mjs
var Agents;
var init_agents = __esm(() => {
  init_versions();
  init_versions();
  init_pagination();
  init_headers();
  init_path();
  Agents = class Agents extends APIResource {
    constructor() {
      super(...arguments);
      this.versions = new Versions(this._client);
    }
    create(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/agents?beta=true", {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(agentID, params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.get(path`/v1/agents/${agentID}?beta=true`, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    update(agentID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/agents/${agentID}?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/agents?beta=true", PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    archive(agentID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.post(path`/v1/agents/${agentID}/archive?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
  Agents.Versions = Versions;
});

// node_modules/@anthropic-ai/sdk/resources/beta/memory-stores/memories.mjs
var Memories;
var init_memories = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Memories = class Memories extends APIResource {
    create(memoryStoreID, params, options) {
      const { view, betas, ...body } = params;
      return this._client.post(path`/v1/memory_stores/${memoryStoreID}/memories?beta=true`, {
        query: { view },
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(memoryID, params, options) {
      const { memory_store_id, betas, ...query } = params;
      return this._client.get(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    update(memoryID, params, options) {
      const { memory_store_id, view, betas, ...body } = params;
      return this._client.post(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
        query: { view },
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(memoryStoreID, params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList(path`/v1/memory_stores/${memoryStoreID}/memories?beta=true`, PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    delete(memoryID, params, options) {
      const { memory_store_id, expected_content_sha256, betas } = params;
      return this._client.delete(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
        query: { expected_content_sha256 },
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/memory-stores/memory-versions.mjs
var MemoryVersions;
var init_memory_versions = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  MemoryVersions = class MemoryVersions extends APIResource {
    retrieve(memoryVersionID, params, options) {
      const { memory_store_id, betas, ...query } = params;
      return this._client.get(path`/v1/memory_stores/${memory_store_id}/memory_versions/${memoryVersionID}?beta=true`, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(memoryStoreID, params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList(path`/v1/memory_stores/${memoryStoreID}/memory_versions?beta=true`, PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    redact(memoryVersionID, params, options) {
      const { memory_store_id, betas } = params;
      return this._client.post(path`/v1/memory_stores/${memory_store_id}/memory_versions/${memoryVersionID}/redact?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/memory-stores/memory-stores.mjs
var MemoryStores;
var init_memory_stores = __esm(() => {
  init_memories();
  init_memories();
  init_memory_versions();
  init_memory_versions();
  init_pagination();
  init_headers();
  init_path();
  MemoryStores = class MemoryStores extends APIResource {
    constructor() {
      super(...arguments);
      this.memories = new Memories(this._client);
      this.memoryVersions = new MemoryVersions(this._client);
    }
    create(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/memory_stores?beta=true", {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(memoryStoreID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    update(memoryStoreID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/memory_stores?beta=true", PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    delete(memoryStoreID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.delete(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    archive(memoryStoreID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.post(path`/v1/memory_stores/${memoryStoreID}/archive?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
  MemoryStores.Memories = Memories;
  MemoryStores.MemoryVersions = MemoryVersions;
});

// node_modules/@anthropic-ai/sdk/error.mjs
var init_error2 = __esm(() => {
  init_error();
});

// node_modules/@anthropic-ai/sdk/internal/constants.mjs
var MODEL_NONSTREAMING_TOKENS;
var init_constants = __esm(() => {
  MODEL_NONSTREAMING_TOKENS = {
    "claude-opus-4-20250514": 8192,
    "claude-opus-4-0": 8192,
    "claude-4-opus-20250514": 8192,
    "anthropic.claude-opus-4-20250514-v1:0": 8192,
    "claude-opus-4@20250514": 8192,
    "claude-opus-4-1-20250805": 8192,
    "anthropic.claude-opus-4-1-20250805-v1:0": 8192,
    "claude-opus-4-1@20250805": 8192
  };
});

// node_modules/@anthropic-ai/sdk/lib/beta-parser.mjs
function getOutputFormat(params) {
  return params?.output_format ?? params?.output_config?.format;
}
function maybeParseBetaMessage(message, params, opts) {
  const outputFormat = getOutputFormat(params);
  if (!params || !("parse" in (outputFormat ?? {}))) {
    return {
      ...message,
      content: message.content.map((block) => {
        if (block.type === "text") {
          const parsedBlock = Object.defineProperty({ ...block }, "parsed_output", {
            value: null,
            enumerable: false
          });
          return Object.defineProperty(parsedBlock, "parsed", {
            get() {
              opts.logger.warn("The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead.");
              return null;
            },
            enumerable: false
          });
        }
        return block;
      }),
      parsed_output: null
    };
  }
  return parseBetaMessage(message, params, opts);
}
function parseBetaMessage(message, params, opts) {
  let firstParsedOutput = null;
  const content = message.content.map((block) => {
    if (block.type === "text") {
      const parsedOutput = parseBetaOutputFormat(params, block.text);
      if (firstParsedOutput === null) {
        firstParsedOutput = parsedOutput;
      }
      const parsedBlock = Object.defineProperty({ ...block }, "parsed_output", {
        value: parsedOutput,
        enumerable: false
      });
      return Object.defineProperty(parsedBlock, "parsed", {
        get() {
          opts.logger.warn("The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead.");
          return parsedOutput;
        },
        enumerable: false
      });
    }
    return block;
  });
  return {
    ...message,
    content,
    parsed_output: firstParsedOutput
  };
}
function parseBetaOutputFormat(params, content) {
  const outputFormat = getOutputFormat(params);
  if (outputFormat?.type !== "json_schema") {
    return null;
  }
  try {
    if ("parse" in outputFormat) {
      return outputFormat.parse(content);
    }
    return JSON.parse(content);
  } catch (error2) {
    throw new AnthropicError(`Failed to parse structured output: ${error2}`);
  }
}
var init_beta_parser = __esm(() => {
  init_error();
});

// node_modules/@anthropic-ai/sdk/_vendor/partial-json-parser/parser.mjs
var tokenize2 = (input) => {
  let current = 0;
  let tokens = [];
  while (current < input.length) {
    let char = input[current];
    if (char === "\\") {
      current++;
      continue;
    }
    if (char === "{") {
      tokens.push({
        type: "brace",
        value: "{"
      });
      current++;
      continue;
    }
    if (char === "}") {
      tokens.push({
        type: "brace",
        value: "}"
      });
      current++;
      continue;
    }
    if (char === "[") {
      tokens.push({
        type: "paren",
        value: "["
      });
      current++;
      continue;
    }
    if (char === "]") {
      tokens.push({
        type: "paren",
        value: "]"
      });
      current++;
      continue;
    }
    if (char === ":") {
      tokens.push({
        type: "separator",
        value: ":"
      });
      current++;
      continue;
    }
    if (char === ",") {
      tokens.push({
        type: "delimiter",
        value: ","
      });
      current++;
      continue;
    }
    if (char === '"') {
      let value = "";
      let danglingQuote = false;
      char = input[++current];
      while (char !== '"') {
        if (current === input.length) {
          danglingQuote = true;
          break;
        }
        if (char === "\\") {
          current++;
          if (current === input.length) {
            danglingQuote = true;
            break;
          }
          value += char + input[current];
          char = input[++current];
        } else {
          value += char;
          char = input[++current];
        }
      }
      char = input[++current];
      if (!danglingQuote) {
        tokens.push({
          type: "string",
          value
        });
      }
      continue;
    }
    let WHITESPACE = /\s/;
    if (char && WHITESPACE.test(char)) {
      current++;
      continue;
    }
    let NUMBERS = /[0-9]/;
    if (char && NUMBERS.test(char) || char === "-" || char === ".") {
      let value = "";
      if (char === "-") {
        value += char;
        char = input[++current];
      }
      while (char && NUMBERS.test(char) || char === ".") {
        value += char;
        char = input[++current];
      }
      tokens.push({
        type: "number",
        value
      });
      continue;
    }
    let LETTERS = /[a-z]/i;
    if (char && LETTERS.test(char)) {
      let value = "";
      while (char && LETTERS.test(char)) {
        if (current === input.length) {
          break;
        }
        value += char;
        char = input[++current];
      }
      if (value == "true" || value == "false" || value === "null") {
        tokens.push({
          type: "name",
          value
        });
      } else {
        current++;
        continue;
      }
      continue;
    }
    current++;
  }
  return tokens;
}, strip = (tokens) => {
  if (tokens.length === 0) {
    return tokens;
  }
  let lastToken = tokens[tokens.length - 1];
  switch (lastToken.type) {
    case "separator":
      tokens = tokens.slice(0, tokens.length - 1);
      return strip(tokens);
      break;
    case "number":
      let lastCharacterOfLastToken = lastToken.value[lastToken.value.length - 1];
      if (lastCharacterOfLastToken === "." || lastCharacterOfLastToken === "-") {
        tokens = tokens.slice(0, tokens.length - 1);
        return strip(tokens);
      }
    case "string":
      let tokenBeforeTheLastToken = tokens[tokens.length - 2];
      if (tokenBeforeTheLastToken?.type === "delimiter") {
        tokens = tokens.slice(0, tokens.length - 1);
        return strip(tokens);
      } else if (tokenBeforeTheLastToken?.type === "brace" && tokenBeforeTheLastToken.value === "{") {
        tokens = tokens.slice(0, tokens.length - 1);
        return strip(tokens);
      }
      break;
    case "delimiter":
      tokens = tokens.slice(0, tokens.length - 1);
      return strip(tokens);
      break;
  }
  return tokens;
}, unstrip = (tokens) => {
  let tail = [];
  tokens.map((token) => {
    if (token.type === "brace") {
      if (token.value === "{") {
        tail.push("}");
      } else {
        tail.splice(tail.lastIndexOf("}"), 1);
      }
    }
    if (token.type === "paren") {
      if (token.value === "[") {
        tail.push("]");
      } else {
        tail.splice(tail.lastIndexOf("]"), 1);
      }
    }
  });
  if (tail.length > 0) {
    tail.reverse().map((item) => {
      if (item === "}") {
        tokens.push({
          type: "brace",
          value: "}"
        });
      } else if (item === "]") {
        tokens.push({
          type: "paren",
          value: "]"
        });
      }
    });
  }
  return tokens;
}, generate = (tokens) => {
  let output = "";
  tokens.map((token) => {
    switch (token.type) {
      case "string":
        output += '"' + token.value + '"';
        break;
      default:
        output += token.value;
        break;
    }
  });
  return output;
}, partialParse = (input) => JSON.parse(generate(unstrip(strip(tokenize2(input)))));
var init_parser = () => {};

// node_modules/@anthropic-ai/sdk/streaming.mjs
var init_streaming2 = __esm(() => {
  init_streaming();
});

// node_modules/@anthropic-ai/sdk/lib/BetaMessageStream.mjs
function tracksToolInput(content) {
  return content.type === "tool_use" || content.type === "server_tool_use" || content.type === "mcp_tool_use";
}
function checkNever(x2) {}
var _BetaMessageStream_instances, _BetaMessageStream_currentMessageSnapshot, _BetaMessageStream_params, _BetaMessageStream_connectedPromise, _BetaMessageStream_resolveConnectedPromise, _BetaMessageStream_rejectConnectedPromise, _BetaMessageStream_endPromise, _BetaMessageStream_resolveEndPromise, _BetaMessageStream_rejectEndPromise, _BetaMessageStream_listeners, _BetaMessageStream_ended, _BetaMessageStream_errored, _BetaMessageStream_aborted, _BetaMessageStream_catchingPromiseCreated, _BetaMessageStream_response, _BetaMessageStream_request_id, _BetaMessageStream_logger, _BetaMessageStream_getFinalMessage, _BetaMessageStream_getFinalText, _BetaMessageStream_handleError, _BetaMessageStream_beginRequest, _BetaMessageStream_addStreamEvent, _BetaMessageStream_endRequest, _BetaMessageStream_accumulateMessage, JSON_BUF_PROPERTY = "__json_buf", BetaMessageStream;
var init_BetaMessageStream = __esm(() => {
  init_tslib();
  init_parser();
  init_error2();
  init_streaming2();
  init_beta_parser();
  BetaMessageStream = class BetaMessageStream {
    constructor(params, opts) {
      _BetaMessageStream_instances.add(this);
      this.messages = [];
      this.receivedMessages = [];
      _BetaMessageStream_currentMessageSnapshot.set(this, undefined);
      _BetaMessageStream_params.set(this, null);
      this.controller = new AbortController;
      _BetaMessageStream_connectedPromise.set(this, undefined);
      _BetaMessageStream_resolveConnectedPromise.set(this, () => {});
      _BetaMessageStream_rejectConnectedPromise.set(this, () => {});
      _BetaMessageStream_endPromise.set(this, undefined);
      _BetaMessageStream_resolveEndPromise.set(this, () => {});
      _BetaMessageStream_rejectEndPromise.set(this, () => {});
      _BetaMessageStream_listeners.set(this, {});
      _BetaMessageStream_ended.set(this, false);
      _BetaMessageStream_errored.set(this, false);
      _BetaMessageStream_aborted.set(this, false);
      _BetaMessageStream_catchingPromiseCreated.set(this, false);
      _BetaMessageStream_response.set(this, undefined);
      _BetaMessageStream_request_id.set(this, undefined);
      _BetaMessageStream_logger.set(this, undefined);
      _BetaMessageStream_handleError.set(this, (error2) => {
        __classPrivateFieldSet(this, _BetaMessageStream_errored, true, "f");
        if (isAbortError(error2)) {
          error2 = new APIUserAbortError;
        }
        if (error2 instanceof APIUserAbortError) {
          __classPrivateFieldSet(this, _BetaMessageStream_aborted, true, "f");
          return this._emit("abort", error2);
        }
        if (error2 instanceof AnthropicError) {
          return this._emit("error", error2);
        }
        if (error2 instanceof Error) {
          const anthropicError = new AnthropicError(error2.message);
          anthropicError.cause = error2;
          return this._emit("error", anthropicError);
        }
        return this._emit("error", new AnthropicError(String(error2)));
      });
      __classPrivateFieldSet(this, _BetaMessageStream_connectedPromise, new Promise((resolve11, reject) => {
        __classPrivateFieldSet(this, _BetaMessageStream_resolveConnectedPromise, resolve11, "f");
        __classPrivateFieldSet(this, _BetaMessageStream_rejectConnectedPromise, reject, "f");
      }), "f");
      __classPrivateFieldSet(this, _BetaMessageStream_endPromise, new Promise((resolve11, reject) => {
        __classPrivateFieldSet(this, _BetaMessageStream_resolveEndPromise, resolve11, "f");
        __classPrivateFieldSet(this, _BetaMessageStream_rejectEndPromise, reject, "f");
      }), "f");
      __classPrivateFieldGet(this, _BetaMessageStream_connectedPromise, "f").catch(() => {});
      __classPrivateFieldGet(this, _BetaMessageStream_endPromise, "f").catch(() => {});
      __classPrivateFieldSet(this, _BetaMessageStream_params, params, "f");
      __classPrivateFieldSet(this, _BetaMessageStream_logger, opts?.logger ?? console, "f");
    }
    get response() {
      return __classPrivateFieldGet(this, _BetaMessageStream_response, "f");
    }
    get request_id() {
      return __classPrivateFieldGet(this, _BetaMessageStream_request_id, "f");
    }
    async withResponse() {
      __classPrivateFieldSet(this, _BetaMessageStream_catchingPromiseCreated, true, "f");
      const response = await __classPrivateFieldGet(this, _BetaMessageStream_connectedPromise, "f");
      if (!response) {
        throw new Error("Could not resolve a `Response` object");
      }
      return {
        data: this,
        response,
        request_id: response.headers.get("request-id")
      };
    }
    static fromReadableStream(stream) {
      const runner = new BetaMessageStream(null);
      runner._run(() => runner._fromReadableStream(stream));
      return runner;
    }
    static createMessage(messages, params, options, { logger } = {}) {
      const runner = new BetaMessageStream(params, { logger });
      for (const message of params.messages) {
        runner._addMessageParam(message);
      }
      __classPrivateFieldSet(runner, _BetaMessageStream_params, { ...params, stream: true }, "f");
      runner._run(() => runner._createMessage(messages, { ...params, stream: true }, { ...options, headers: { ...options?.headers, "X-Stainless-Helper-Method": "stream" } }));
      return runner;
    }
    _run(executor) {
      executor().then(() => {
        this._emitFinal();
        this._emit("end");
      }, __classPrivateFieldGet(this, _BetaMessageStream_handleError, "f"));
    }
    _addMessageParam(message) {
      this.messages.push(message);
    }
    _addMessage(message, emit = true) {
      this.receivedMessages.push(message);
      if (emit) {
        this._emit("message", message);
      }
    }
    async _createMessage(messages, params, options) {
      const signal = options?.signal;
      let abortHandler;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        abortHandler = this.controller.abort.bind(this.controller);
        signal.addEventListener("abort", abortHandler);
      }
      try {
        __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_beginRequest).call(this);
        const { response, data: stream } = await messages.create({ ...params, stream: true }, { ...options, signal: this.controller.signal }).withResponse();
        this._connected(response);
        for await (const event of stream) {
          __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_addStreamEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
          throw new APIUserAbortError;
        }
        __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_endRequest).call(this);
      } finally {
        if (signal && abortHandler) {
          signal.removeEventListener("abort", abortHandler);
        }
      }
    }
    _connected(response) {
      if (this.ended)
        return;
      __classPrivateFieldSet(this, _BetaMessageStream_response, response, "f");
      __classPrivateFieldSet(this, _BetaMessageStream_request_id, response?.headers.get("request-id"), "f");
      __classPrivateFieldGet(this, _BetaMessageStream_resolveConnectedPromise, "f").call(this, response);
      this._emit("connect");
    }
    get ended() {
      return __classPrivateFieldGet(this, _BetaMessageStream_ended, "f");
    }
    get errored() {
      return __classPrivateFieldGet(this, _BetaMessageStream_errored, "f");
    }
    get aborted() {
      return __classPrivateFieldGet(this, _BetaMessageStream_aborted, "f");
    }
    abort() {
      this.controller.abort();
    }
    on(event, listener) {
      const listeners = __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] = []);
      listeners.push({ listener });
      return this;
    }
    off(event, listener) {
      const listeners = __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event];
      if (!listeners)
        return this;
      const index = listeners.findIndex((l2) => l2.listener === listener);
      if (index >= 0)
        listeners.splice(index, 1);
      return this;
    }
    once(event, listener) {
      const listeners = __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] = []);
      listeners.push({ listener, once: true });
      return this;
    }
    emitted(event) {
      return new Promise((resolve11, reject) => {
        __classPrivateFieldSet(this, _BetaMessageStream_catchingPromiseCreated, true, "f");
        if (event !== "error")
          this.once("error", reject);
        this.once(event, resolve11);
      });
    }
    async done() {
      __classPrivateFieldSet(this, _BetaMessageStream_catchingPromiseCreated, true, "f");
      await __classPrivateFieldGet(this, _BetaMessageStream_endPromise, "f");
    }
    get currentMessage() {
      return __classPrivateFieldGet(this, _BetaMessageStream_currentMessageSnapshot, "f");
    }
    async finalMessage() {
      await this.done();
      return __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_getFinalMessage).call(this);
    }
    async finalText() {
      await this.done();
      return __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_getFinalText).call(this);
    }
    _emit(event, ...args) {
      if (__classPrivateFieldGet(this, _BetaMessageStream_ended, "f"))
        return;
      if (event === "end") {
        __classPrivateFieldSet(this, _BetaMessageStream_ended, true, "f");
        __classPrivateFieldGet(this, _BetaMessageStream_resolveEndPromise, "f").call(this);
      }
      const listeners = __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event];
      if (listeners) {
        __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] = listeners.filter((l2) => !l2.once);
        listeners.forEach(({ listener }) => listener(...args));
      }
      if (event === "abort") {
        const error2 = args[0];
        if (!__classPrivateFieldGet(this, _BetaMessageStream_catchingPromiseCreated, "f") && !listeners?.length) {
          Promise.reject(error2);
        }
        __classPrivateFieldGet(this, _BetaMessageStream_rejectConnectedPromise, "f").call(this, error2);
        __classPrivateFieldGet(this, _BetaMessageStream_rejectEndPromise, "f").call(this, error2);
        this._emit("end");
        return;
      }
      if (event === "error") {
        const error2 = args[0];
        if (!__classPrivateFieldGet(this, _BetaMessageStream_catchingPromiseCreated, "f") && !listeners?.length) {
          Promise.reject(error2);
        }
        __classPrivateFieldGet(this, _BetaMessageStream_rejectConnectedPromise, "f").call(this, error2);
        __classPrivateFieldGet(this, _BetaMessageStream_rejectEndPromise, "f").call(this, error2);
        this._emit("end");
      }
    }
    _emitFinal() {
      const finalMessage = this.receivedMessages.at(-1);
      if (finalMessage) {
        this._emit("finalMessage", __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_getFinalMessage).call(this));
      }
    }
    async _fromReadableStream(readableStream, options) {
      const signal = options?.signal;
      let abortHandler;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        abortHandler = this.controller.abort.bind(this.controller);
        signal.addEventListener("abort", abortHandler);
      }
      try {
        __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_beginRequest).call(this);
        this._connected(null);
        const stream = Stream.fromReadableStream(readableStream, this.controller);
        for await (const event of stream) {
          __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_addStreamEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
          throw new APIUserAbortError;
        }
        __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_endRequest).call(this);
      } finally {
        if (signal && abortHandler) {
          signal.removeEventListener("abort", abortHandler);
        }
      }
    }
    [(_BetaMessageStream_currentMessageSnapshot = new WeakMap, _BetaMessageStream_params = new WeakMap, _BetaMessageStream_connectedPromise = new WeakMap, _BetaMessageStream_resolveConnectedPromise = new WeakMap, _BetaMessageStream_rejectConnectedPromise = new WeakMap, _BetaMessageStream_endPromise = new WeakMap, _BetaMessageStream_resolveEndPromise = new WeakMap, _BetaMessageStream_rejectEndPromise = new WeakMap, _BetaMessageStream_listeners = new WeakMap, _BetaMessageStream_ended = new WeakMap, _BetaMessageStream_errored = new WeakMap, _BetaMessageStream_aborted = new WeakMap, _BetaMessageStream_catchingPromiseCreated = new WeakMap, _BetaMessageStream_response = new WeakMap, _BetaMessageStream_request_id = new WeakMap, _BetaMessageStream_logger = new WeakMap, _BetaMessageStream_handleError = new WeakMap, _BetaMessageStream_instances = new WeakSet, _BetaMessageStream_getFinalMessage = function _BetaMessageStream_getFinalMessage() {
      if (this.receivedMessages.length === 0) {
        throw new AnthropicError("stream ended without producing a Message with role=assistant");
      }
      return this.receivedMessages.at(-1);
    }, _BetaMessageStream_getFinalText = function _BetaMessageStream_getFinalText() {
      if (this.receivedMessages.length === 0) {
        throw new AnthropicError("stream ended without producing a Message with role=assistant");
      }
      const textBlocks = this.receivedMessages.at(-1).content.filter((block) => block.type === "text").map((block) => block.text);
      if (textBlocks.length === 0) {
        throw new AnthropicError("stream ended without producing a content block with type=text");
      }
      return textBlocks.join(" ");
    }, _BetaMessageStream_beginRequest = function _BetaMessageStream_beginRequest() {
      if (this.ended)
        return;
      __classPrivateFieldSet(this, _BetaMessageStream_currentMessageSnapshot, undefined, "f");
    }, _BetaMessageStream_addStreamEvent = function _BetaMessageStream_addStreamEvent(event) {
      if (this.ended)
        return;
      const messageSnapshot = __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_accumulateMessage).call(this, event);
      this._emit("streamEvent", event, messageSnapshot);
      switch (event.type) {
        case "content_block_delta": {
          const content = messageSnapshot.content.at(-1);
          switch (event.delta.type) {
            case "text_delta": {
              if (content.type === "text") {
                this._emit("text", event.delta.text, content.text || "");
              }
              break;
            }
            case "citations_delta": {
              if (content.type === "text") {
                this._emit("citation", event.delta.citation, content.citations ?? []);
              }
              break;
            }
            case "input_json_delta": {
              if (tracksToolInput(content) && content.input) {
                this._emit("inputJson", event.delta.partial_json, content.input);
              }
              break;
            }
            case "thinking_delta": {
              if (content.type === "thinking") {
                this._emit("thinking", event.delta.thinking, content.thinking);
              }
              break;
            }
            case "signature_delta": {
              if (content.type === "thinking") {
                this._emit("signature", content.signature);
              }
              break;
            }
            case "compaction_delta": {
              if (content.type === "compaction" && content.content) {
                this._emit("compaction", content.content);
              }
              break;
            }
            default:
              checkNever(event.delta);
          }
          break;
        }
        case "message_stop": {
          this._addMessageParam(messageSnapshot);
          this._addMessage(maybeParseBetaMessage(messageSnapshot, __classPrivateFieldGet(this, _BetaMessageStream_params, "f"), { logger: __classPrivateFieldGet(this, _BetaMessageStream_logger, "f") }), true);
          break;
        }
        case "content_block_stop": {
          this._emit("contentBlock", messageSnapshot.content.at(-1));
          break;
        }
        case "message_start": {
          __classPrivateFieldSet(this, _BetaMessageStream_currentMessageSnapshot, messageSnapshot, "f");
          break;
        }
        case "content_block_start":
        case "message_delta":
          break;
      }
    }, _BetaMessageStream_endRequest = function _BetaMessageStream_endRequest() {
      if (this.ended) {
        throw new AnthropicError(`stream has ended, this shouldn't happen`);
      }
      const snapshot = __classPrivateFieldGet(this, _BetaMessageStream_currentMessageSnapshot, "f");
      if (!snapshot) {
        throw new AnthropicError(`request ended without sending any chunks`);
      }
      __classPrivateFieldSet(this, _BetaMessageStream_currentMessageSnapshot, undefined, "f");
      return maybeParseBetaMessage(snapshot, __classPrivateFieldGet(this, _BetaMessageStream_params, "f"), { logger: __classPrivateFieldGet(this, _BetaMessageStream_logger, "f") });
    }, _BetaMessageStream_accumulateMessage = function _BetaMessageStream_accumulateMessage(event) {
      let snapshot = __classPrivateFieldGet(this, _BetaMessageStream_currentMessageSnapshot, "f");
      if (event.type === "message_start") {
        if (snapshot) {
          throw new AnthropicError(`Unexpected event order, got ${event.type} before receiving "message_stop"`);
        }
        return event.message;
      }
      if (!snapshot) {
        throw new AnthropicError(`Unexpected event order, got ${event.type} before "message_start"`);
      }
      switch (event.type) {
        case "message_stop":
          return snapshot;
        case "message_delta":
          snapshot.container = event.delta.container;
          snapshot.stop_reason = event.delta.stop_reason;
          snapshot.stop_sequence = event.delta.stop_sequence;
          snapshot.usage.output_tokens = event.usage.output_tokens;
          snapshot.context_management = event.context_management;
          if (event.usage.input_tokens != null) {
            snapshot.usage.input_tokens = event.usage.input_tokens;
          }
          if (event.usage.cache_creation_input_tokens != null) {
            snapshot.usage.cache_creation_input_tokens = event.usage.cache_creation_input_tokens;
          }
          if (event.usage.cache_read_input_tokens != null) {
            snapshot.usage.cache_read_input_tokens = event.usage.cache_read_input_tokens;
          }
          if (event.usage.server_tool_use != null) {
            snapshot.usage.server_tool_use = event.usage.server_tool_use;
          }
          if (event.usage.iterations != null) {
            snapshot.usage.iterations = event.usage.iterations;
          }
          return snapshot;
        case "content_block_start":
          snapshot.content.push(event.content_block);
          return snapshot;
        case "content_block_delta": {
          const snapshotContent = snapshot.content.at(event.index);
          switch (event.delta.type) {
            case "text_delta": {
              if (snapshotContent?.type === "text") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  text: (snapshotContent.text || "") + event.delta.text
                };
              }
              break;
            }
            case "citations_delta": {
              if (snapshotContent?.type === "text") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  citations: [...snapshotContent.citations ?? [], event.delta.citation]
                };
              }
              break;
            }
            case "input_json_delta": {
              if (snapshotContent && tracksToolInput(snapshotContent)) {
                let jsonBuf = snapshotContent[JSON_BUF_PROPERTY] || "";
                jsonBuf += event.delta.partial_json;
                const newContent = { ...snapshotContent };
                Object.defineProperty(newContent, JSON_BUF_PROPERTY, {
                  value: jsonBuf,
                  enumerable: false,
                  writable: true
                });
                if (jsonBuf) {
                  try {
                    newContent.input = partialParse(jsonBuf);
                  } catch (err) {
                    const error2 = new AnthropicError(`Unable to parse tool parameter JSON from model. Please retry your request or adjust your prompt. Error: ${err}. JSON: ${jsonBuf}`);
                    __classPrivateFieldGet(this, _BetaMessageStream_handleError, "f").call(this, error2);
                  }
                }
                snapshot.content[event.index] = newContent;
              }
              break;
            }
            case "thinking_delta": {
              if (snapshotContent?.type === "thinking") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  thinking: snapshotContent.thinking + event.delta.thinking
                };
              }
              break;
            }
            case "signature_delta": {
              if (snapshotContent?.type === "thinking") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  signature: event.delta.signature
                };
              }
              break;
            }
            case "compaction_delta": {
              if (snapshotContent?.type === "compaction") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  content: (snapshotContent.content || "") + event.delta.content
                };
              }
              break;
            }
            default:
              checkNever(event.delta);
          }
          return snapshot;
        }
        case "content_block_stop":
          return snapshot;
      }
    }, Symbol.asyncIterator)]() {
      const pushQueue = [];
      const readQueue = [];
      let done = false;
      this.on("streamEvent", (event) => {
        const reader = readQueue.shift();
        if (reader) {
          reader.resolve(event);
        } else {
          pushQueue.push(event);
        }
      });
      this.on("end", () => {
        done = true;
        for (const reader of readQueue) {
          reader.resolve(undefined);
        }
        readQueue.length = 0;
      });
      this.on("abort", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      this.on("error", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      return {
        next: async () => {
          if (!pushQueue.length) {
            if (done) {
              return { value: undefined, done: true };
            }
            return new Promise((resolve11, reject) => readQueue.push({ resolve: resolve11, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: undefined, done: true });
          }
          const chunk = pushQueue.shift();
          return { value: chunk, done: false };
        },
        return: async () => {
          this.abort();
          return { value: undefined, done: true };
        }
      };
    }
    toReadableStream() {
      const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
      return stream.toReadableStream();
    }
  };
});

// node_modules/@anthropic-ai/sdk/lib/tools/ToolError.mjs
var ToolError;
var init_ToolError = __esm(() => {
  ToolError = class ToolError extends Error {
    constructor(content) {
      const message = typeof content === "string" ? content : content.map((block) => {
        if (block.type === "text")
          return block.text;
        return `[${block.type}]`;
      }).join(" ");
      super(message);
      this.name = "ToolError";
      this.content = content;
    }
  };
});

// node_modules/@anthropic-ai/sdk/lib/tools/CompactionControl.mjs
var DEFAULT_TOKEN_THRESHOLD = 1e5, DEFAULT_SUMMARY_PROMPT = `You have been working on the task described above but have not yet completed it. Write a continuation summary that will allow you (or another instance of yourself) to resume work efficiently in a future context window where the conversation history will be replaced with this summary. Your summary should be structured, concise, and actionable. Include:
1. Task Overview
The user's core request and success criteria
Any clarifications or constraints they specified
2. Current State
What has been completed so far
Files created, modified, or analyzed (with paths if relevant)
Key outputs or artifacts produced
3. Important Discoveries
Technical constraints or requirements uncovered
Decisions made and their rationale
Errors encountered and how they were resolved
What approaches were tried that didn't work (and why)
4. Next Steps
Specific actions needed to complete the task
Any blockers or open questions to resolve
Priority order if multiple steps remain
5. Context to Preserve
User preferences or style requirements
Domain-specific details that aren't obvious
Any promises made to the user
Be concise but complete—err on the side of including information that would prevent duplicate work or repeated mistakes. Write in a way that enables immediate resumption of the task.
Wrap your summary in <summary></summary> tags.`;

// node_modules/@anthropic-ai/sdk/lib/tools/BetaToolRunner.mjs
function promiseWithResolvers() {
  let resolve11;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve11 = res;
    reject = rej;
  });
  return { promise, resolve: resolve11, reject };
}
async function generateToolResponse(params, lastMessage = params.messages.at(-1), requestOptions) {
  if (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.content || typeof lastMessage.content === "string") {
    return null;
  }
  const toolUseBlocks = lastMessage.content.filter((content) => content.type === "tool_use");
  if (toolUseBlocks.length === 0) {
    return null;
  }
  const toolResults = await Promise.all(toolUseBlocks.map(async (toolUse) => {
    const tool = params.tools.find((t2) => ("name" in t2 ? t2.name : t2.mcp_server_name) === toolUse.name);
    if (!tool || !("run" in tool)) {
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: Tool '${toolUse.name}' not found`,
        is_error: true
      };
    }
    try {
      let input = toolUse.input;
      if ("parse" in tool && tool.parse) {
        input = tool.parse(input);
      }
      const result = await tool.run(input, {
        toolUseBlock: toolUse,
        signal: requestOptions?.signal
      });
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result
      };
    } catch (error2) {
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: error2 instanceof ToolError ? error2.content : `Error: ${error2 instanceof Error ? error2.message : String(error2)}`,
        is_error: true
      };
    }
  }));
  return {
    role: "user",
    content: toolResults
  };
}
var _BetaToolRunner_instances, _BetaToolRunner_consumed, _BetaToolRunner_mutated, _BetaToolRunner_state, _BetaToolRunner_options, _BetaToolRunner_message, _BetaToolRunner_toolResponse, _BetaToolRunner_completion, _BetaToolRunner_iterationCount, _BetaToolRunner_checkAndCompact, _BetaToolRunner_generateToolResponse, BetaToolRunner;
var init_BetaToolRunner = __esm(() => {
  init_tslib();
  init_ToolError();
  init_error();
  init_headers();
  init_stainless_helper_header();
  BetaToolRunner = class BetaToolRunner {
    constructor(client, params, options) {
      _BetaToolRunner_instances.add(this);
      this.client = client;
      _BetaToolRunner_consumed.set(this, false);
      _BetaToolRunner_mutated.set(this, false);
      _BetaToolRunner_state.set(this, undefined);
      _BetaToolRunner_options.set(this, undefined);
      _BetaToolRunner_message.set(this, undefined);
      _BetaToolRunner_toolResponse.set(this, undefined);
      _BetaToolRunner_completion.set(this, undefined);
      _BetaToolRunner_iterationCount.set(this, 0);
      __classPrivateFieldSet(this, _BetaToolRunner_state, {
        params: {
          ...params,
          messages: structuredClone(params.messages)
        }
      }, "f");
      const helpers = collectStainlessHelpers(params.tools, params.messages);
      const helperValue = ["BetaToolRunner", ...helpers].join(", ");
      __classPrivateFieldSet(this, _BetaToolRunner_options, {
        ...options,
        headers: buildHeaders([{ "x-stainless-helper": helperValue }, options?.headers])
      }, "f");
      __classPrivateFieldSet(this, _BetaToolRunner_completion, promiseWithResolvers(), "f");
      if (params.compactionControl?.enabled) {
        console.warn("Anthropic: The `compactionControl` parameter is deprecated and will be removed in a future version. " + 'Use server-side compaction instead by passing `edits: [{ type: "compact_20260112" }]` in the params passed to `toolRunner()`. ' + "See https://platform.claude.com/docs/en/build-with-claude/compaction");
      }
    }
    async* [(_BetaToolRunner_consumed = new WeakMap, _BetaToolRunner_mutated = new WeakMap, _BetaToolRunner_state = new WeakMap, _BetaToolRunner_options = new WeakMap, _BetaToolRunner_message = new WeakMap, _BetaToolRunner_toolResponse = new WeakMap, _BetaToolRunner_completion = new WeakMap, _BetaToolRunner_iterationCount = new WeakMap, _BetaToolRunner_instances = new WeakSet, _BetaToolRunner_checkAndCompact = async function _BetaToolRunner_checkAndCompact() {
      const compactionControl = __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.compactionControl;
      if (!compactionControl || !compactionControl.enabled) {
        return false;
      }
      let tokensUsed = 0;
      if (__classPrivateFieldGet(this, _BetaToolRunner_message, "f") !== undefined) {
        try {
          const message = await __classPrivateFieldGet(this, _BetaToolRunner_message, "f");
          const totalInputTokens = message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
          tokensUsed = totalInputTokens + message.usage.output_tokens;
        } catch {
          return false;
        }
      }
      const threshold = compactionControl.contextTokenThreshold ?? DEFAULT_TOKEN_THRESHOLD;
      if (tokensUsed < threshold) {
        return false;
      }
      const model = compactionControl.model ?? __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.model;
      const summaryPrompt = compactionControl.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT;
      const messages = __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages;
      if (messages[messages.length - 1].role === "assistant") {
        const lastMessage = messages[messages.length - 1];
        if (Array.isArray(lastMessage.content)) {
          const nonToolBlocks = lastMessage.content.filter((block) => block.type !== "tool_use");
          if (nonToolBlocks.length === 0) {
            messages.pop();
          } else {
            lastMessage.content = nonToolBlocks;
          }
        }
      }
      const response = await this.client.beta.messages.create({
        model,
        messages: [
          ...messages,
          {
            role: "user",
            content: [
              {
                type: "text",
                text: summaryPrompt
              }
            ]
          }
        ],
        max_tokens: __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.max_tokens
      }, {
        signal: __classPrivateFieldGet(this, _BetaToolRunner_options, "f").signal,
        headers: buildHeaders([__classPrivateFieldGet(this, _BetaToolRunner_options, "f").headers, { "x-stainless-helper": "compaction" }])
      });
      if (response.content[0]?.type !== "text") {
        throw new AnthropicError("Expected text response for compaction");
      }
      __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages = [
        {
          role: "user",
          content: response.content
        }
      ];
      return true;
    }, Symbol.asyncIterator)]() {
      var _a;
      if (__classPrivateFieldGet(this, _BetaToolRunner_consumed, "f")) {
        throw new AnthropicError("Cannot iterate over a consumed stream");
      }
      __classPrivateFieldSet(this, _BetaToolRunner_consumed, true, "f");
      __classPrivateFieldSet(this, _BetaToolRunner_mutated, true, "f");
      __classPrivateFieldSet(this, _BetaToolRunner_toolResponse, undefined, "f");
      try {
        while (true) {
          let stream;
          try {
            if (__classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.max_iterations && __classPrivateFieldGet(this, _BetaToolRunner_iterationCount, "f") >= __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.max_iterations) {
              break;
            }
            __classPrivateFieldSet(this, _BetaToolRunner_mutated, false, "f");
            __classPrivateFieldSet(this, _BetaToolRunner_toolResponse, undefined, "f");
            __classPrivateFieldSet(this, _BetaToolRunner_iterationCount, (_a = __classPrivateFieldGet(this, _BetaToolRunner_iterationCount, "f"), _a++, _a), "f");
            __classPrivateFieldSet(this, _BetaToolRunner_message, undefined, "f");
            const { max_iterations, compactionControl, ...params } = __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params;
            if (params.stream) {
              stream = this.client.beta.messages.stream({ ...params }, __classPrivateFieldGet(this, _BetaToolRunner_options, "f"));
              __classPrivateFieldSet(this, _BetaToolRunner_message, stream.finalMessage(), "f");
              __classPrivateFieldGet(this, _BetaToolRunner_message, "f").catch(() => {});
              yield stream;
            } else {
              __classPrivateFieldSet(this, _BetaToolRunner_message, this.client.beta.messages.create({ ...params, stream: false }, __classPrivateFieldGet(this, _BetaToolRunner_options, "f")), "f");
              yield __classPrivateFieldGet(this, _BetaToolRunner_message, "f");
            }
            const isCompacted = await __classPrivateFieldGet(this, _BetaToolRunner_instances, "m", _BetaToolRunner_checkAndCompact).call(this);
            if (!isCompacted) {
              if (!__classPrivateFieldGet(this, _BetaToolRunner_mutated, "f")) {
                const { role, content } = await __classPrivateFieldGet(this, _BetaToolRunner_message, "f");
                __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages.push({ role, content });
              }
              const toolMessage = await __classPrivateFieldGet(this, _BetaToolRunner_instances, "m", _BetaToolRunner_generateToolResponse).call(this, __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages.at(-1));
              if (toolMessage) {
                __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages.push(toolMessage);
              } else if (!__classPrivateFieldGet(this, _BetaToolRunner_mutated, "f")) {
                break;
              }
            }
          } finally {
            if (stream) {
              stream.abort();
            }
          }
        }
        if (!__classPrivateFieldGet(this, _BetaToolRunner_message, "f")) {
          throw new AnthropicError("ToolRunner concluded without a message from the server");
        }
        __classPrivateFieldGet(this, _BetaToolRunner_completion, "f").resolve(await __classPrivateFieldGet(this, _BetaToolRunner_message, "f"));
      } catch (error2) {
        __classPrivateFieldSet(this, _BetaToolRunner_consumed, false, "f");
        __classPrivateFieldGet(this, _BetaToolRunner_completion, "f").promise.catch(() => {});
        __classPrivateFieldGet(this, _BetaToolRunner_completion, "f").reject(error2);
        __classPrivateFieldSet(this, _BetaToolRunner_completion, promiseWithResolvers(), "f");
        throw error2;
      }
    }
    setMessagesParams(paramsOrMutator) {
      if (typeof paramsOrMutator === "function") {
        __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params = paramsOrMutator(__classPrivateFieldGet(this, _BetaToolRunner_state, "f").params);
      } else {
        __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params = paramsOrMutator;
      }
      __classPrivateFieldSet(this, _BetaToolRunner_mutated, true, "f");
      __classPrivateFieldSet(this, _BetaToolRunner_toolResponse, undefined, "f");
    }
    setRequestOptions(optionsOrMutator) {
      if (typeof optionsOrMutator === "function") {
        __classPrivateFieldSet(this, _BetaToolRunner_options, optionsOrMutator(__classPrivateFieldGet(this, _BetaToolRunner_options, "f")), "f");
      } else {
        __classPrivateFieldSet(this, _BetaToolRunner_options, { ...__classPrivateFieldGet(this, _BetaToolRunner_options, "f"), ...optionsOrMutator }, "f");
      }
    }
    async generateToolResponse(signal = __classPrivateFieldGet(this, _BetaToolRunner_options, "f").signal) {
      const message = await __classPrivateFieldGet(this, _BetaToolRunner_message, "f") ?? this.params.messages.at(-1);
      if (!message) {
        return null;
      }
      return __classPrivateFieldGet(this, _BetaToolRunner_instances, "m", _BetaToolRunner_generateToolResponse).call(this, message, signal);
    }
    done() {
      return __classPrivateFieldGet(this, _BetaToolRunner_completion, "f").promise;
    }
    async runUntilDone() {
      if (!__classPrivateFieldGet(this, _BetaToolRunner_consumed, "f")) {
        for await (const _3 of this) {}
      }
      return this.done();
    }
    get params() {
      return __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params;
    }
    pushMessages(...messages) {
      this.setMessagesParams((params) => ({
        ...params,
        messages: [...params.messages, ...messages]
      }));
    }
    then(onfulfilled, onrejected) {
      return this.runUntilDone().then(onfulfilled, onrejected);
    }
  };
  _BetaToolRunner_generateToolResponse = async function _BetaToolRunner_generateToolResponse2(lastMessage, signal = __classPrivateFieldGet(this, _BetaToolRunner_options, "f").signal) {
    if (__classPrivateFieldGet(this, _BetaToolRunner_toolResponse, "f") !== undefined) {
      return __classPrivateFieldGet(this, _BetaToolRunner_toolResponse, "f");
    }
    __classPrivateFieldSet(this, _BetaToolRunner_toolResponse, generateToolResponse(__classPrivateFieldGet(this, _BetaToolRunner_state, "f").params, lastMessage, {
      ...__classPrivateFieldGet(this, _BetaToolRunner_options, "f"),
      signal
    }), "f");
    return __classPrivateFieldGet(this, _BetaToolRunner_toolResponse, "f");
  };
});

// node_modules/@anthropic-ai/sdk/internal/decoders/jsonl.mjs
var JSONLDecoder;
var init_jsonl = __esm(() => {
  init_error();
  init_line();
  JSONLDecoder = class JSONLDecoder {
    constructor(iterator, controller) {
      this.iterator = iterator;
      this.controller = controller;
    }
    async* decoder() {
      const lineDecoder = new LineDecoder;
      for await (const chunk of this.iterator) {
        for (const line of lineDecoder.decode(chunk)) {
          yield JSON.parse(line);
        }
      }
      for (const line of lineDecoder.flush()) {
        yield JSON.parse(line);
      }
    }
    [Symbol.asyncIterator]() {
      return this.decoder();
    }
    static fromResponse(response, controller) {
      if (!response.body) {
        controller.abort();
        if (typeof globalThis.navigator !== "undefined" && globalThis.navigator.product === "ReactNative") {
          throw new AnthropicError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
        }
        throw new AnthropicError(`Attempted to iterate over a response with no body`);
      }
      return new JSONLDecoder(ReadableStreamToAsyncIterable(response.body), controller);
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/messages/batches.mjs
var Batches;
var init_batches = __esm(() => {
  init_pagination();
  init_headers();
  init_jsonl();
  init_error2();
  init_path();
  Batches = class Batches extends APIResource {
    create(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/messages/batches?beta=true", {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(messageBatchID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/messages/batches/${messageBatchID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/messages/batches?beta=true", Page, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
          options?.headers
        ])
      });
    }
    delete(messageBatchID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.delete(path`/v1/messages/batches/${messageBatchID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
          options?.headers
        ])
      });
    }
    cancel(messageBatchID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.post(path`/v1/messages/batches/${messageBatchID}/cancel?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
          options?.headers
        ])
      });
    }
    async results(messageBatchID, params = {}, options) {
      const batch = await this.retrieve(messageBatchID);
      if (!batch.results_url) {
        throw new AnthropicError(`No batch \`results_url\`; Has it finished processing? ${batch.processing_status} - ${batch.id}`);
      }
      const { betas } = params ?? {};
      return this._client.get(batch.results_url, {
        ...options,
        headers: buildHeaders([
          {
            "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString(),
            Accept: "application/binary"
          },
          options?.headers
        ]),
        stream: true,
        __binaryResponse: true
      })._thenUnwrap((_3, props) => JSONLDecoder.fromResponse(props.response, props.controller));
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.mjs
function transformOutputFormat(params) {
  if (!params.output_format) {
    return params;
  }
  if (params.output_config?.format) {
    throw new AnthropicError("Both output_format and output_config.format were provided. " + "Please use only output_config.format (output_format is deprecated).");
  }
  const { output_format, ...rest } = params;
  return {
    ...rest,
    output_config: {
      ...params.output_config,
      format: output_format
    }
  };
}
var DEPRECATED_MODELS, MODELS_TO_WARN_WITH_THINKING_ENABLED, Messages;
var init_messages = __esm(() => {
  init_error2();
  init_constants();
  init_headers();
  init_stainless_helper_header();
  init_beta_parser();
  init_BetaMessageStream();
  init_BetaToolRunner();
  init_ToolError();
  init_batches();
  init_batches();
  init_BetaToolRunner();
  init_ToolError();
  DEPRECATED_MODELS = {
    "claude-1.3": "November 6th, 2024",
    "claude-1.3-100k": "November 6th, 2024",
    "claude-instant-1.1": "November 6th, 2024",
    "claude-instant-1.1-100k": "November 6th, 2024",
    "claude-instant-1.2": "November 6th, 2024",
    "claude-3-sonnet-20240229": "July 21st, 2025",
    "claude-3-opus-20240229": "January 5th, 2026",
    "claude-2.1": "July 21st, 2025",
    "claude-2.0": "July 21st, 2025",
    "claude-3-7-sonnet-latest": "February 19th, 2026",
    "claude-3-7-sonnet-20250219": "February 19th, 2026"
  };
  MODELS_TO_WARN_WITH_THINKING_ENABLED = ["claude-mythos-preview", "claude-opus-4-6"];
  Messages = class Messages extends APIResource {
    constructor() {
      super(...arguments);
      this.batches = new Batches(this._client);
    }
    create(params, options) {
      const modifiedParams = transformOutputFormat(params);
      const { betas, ...body } = modifiedParams;
      if (body.model in DEPRECATED_MODELS) {
        console.warn(`The model '${body.model}' is deprecated and will reach end-of-life on ${DEPRECATED_MODELS[body.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`);
      }
      if (MODELS_TO_WARN_WITH_THINKING_ENABLED.includes(body.model) && body.thinking && body.thinking.type === "enabled") {
        console.warn(`Using Claude with ${body.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`);
      }
      let timeout = this._client._options.timeout;
      if (!body.stream && timeout == null) {
        const maxNonstreamingTokens = MODEL_NONSTREAMING_TOKENS[body.model] ?? undefined;
        timeout = this._client.calculateNonstreamingTimeout(body.max_tokens, maxNonstreamingTokens);
      }
      const helperHeader = stainlessHelperHeader(body.tools, body.messages);
      return this._client.post("/v1/messages?beta=true", {
        body,
        timeout: timeout ?? 600000,
        ...options,
        headers: buildHeaders([
          { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : undefined },
          helperHeader,
          options?.headers
        ]),
        stream: modifiedParams.stream ?? false
      });
    }
    parse(params, options) {
      options = {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...params.betas ?? [], "structured-outputs-2025-12-15"].toString() },
          options?.headers
        ])
      };
      return this.create(params, options).then((message) => parseBetaMessage(message, params, { logger: this._client.logger ?? console }));
    }
    stream(body, options) {
      return BetaMessageStream.createMessage(this, body, options);
    }
    countTokens(params, options) {
      const modifiedParams = transformOutputFormat(params);
      const { betas, ...body } = modifiedParams;
      return this._client.post("/v1/messages/count_tokens?beta=true", {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "token-counting-2024-11-01"].toString() },
          options?.headers
        ])
      });
    }
    toolRunner(body, options) {
      return new BetaToolRunner(this._client, body, options);
    }
  };
  Messages.Batches = Batches;
  Messages.BetaToolRunner = BetaToolRunner;
  Messages.ToolError = ToolError;
});

// node_modules/@anthropic-ai/sdk/resources/beta/sessions/events.mjs
var Events;
var init_events = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Events = class Events extends APIResource {
    list(sessionID, params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList(path`/v1/sessions/${sessionID}/events?beta=true`, PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    send(sessionID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/sessions/${sessionID}/events?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    stream(sessionID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/sessions/${sessionID}/events/stream?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ]),
        stream: true
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/sessions/resources.mjs
var Resources;
var init_resources = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Resources = class Resources extends APIResource {
    retrieve(resourceID, params, options) {
      const { session_id, betas } = params;
      return this._client.get(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    update(resourceID, params, options) {
      const { session_id, betas, ...body } = params;
      return this._client.post(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(sessionID, params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList(path`/v1/sessions/${sessionID}/resources?beta=true`, PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    delete(resourceID, params, options) {
      const { session_id, betas } = params;
      return this._client.delete(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    add(sessionID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/sessions/${sessionID}/resources?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/sessions/sessions.mjs
var Sessions;
var init_sessions = __esm(() => {
  init_events();
  init_events();
  init_resources();
  init_resources();
  init_pagination();
  init_headers();
  init_path();
  Sessions = class Sessions extends APIResource {
    constructor() {
      super(...arguments);
      this.events = new Events(this._client);
      this.resources = new Resources(this._client);
    }
    create(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/sessions?beta=true", {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(sessionID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/sessions/${sessionID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    update(sessionID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/sessions/${sessionID}?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/sessions?beta=true", PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    delete(sessionID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.delete(path`/v1/sessions/${sessionID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    archive(sessionID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.post(path`/v1/sessions/${sessionID}/archive?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
  Sessions.Events = Events;
  Sessions.Resources = Resources;
});

// node_modules/@anthropic-ai/sdk/resources/beta/skills/versions.mjs
var Versions2;
var init_versions2 = __esm(() => {
  init_pagination();
  init_headers();
  init_uploads();
  init_path();
  Versions2 = class Versions2 extends APIResource {
    create(skillID, params = {}, options) {
      const { betas, ...body } = params ?? {};
      return this._client.post(path`/v1/skills/${skillID}/versions?beta=true`, multipartFormRequestOptions({
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
          options?.headers
        ])
      }, this._client));
    }
    retrieve(version, params, options) {
      const { skill_id, betas } = params;
      return this._client.get(path`/v1/skills/${skill_id}/versions/${version}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
          options?.headers
        ])
      });
    }
    list(skillID, params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList(path`/v1/skills/${skillID}/versions?beta=true`, PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
          options?.headers
        ])
      });
    }
    delete(version, params, options) {
      const { skill_id, betas } = params;
      return this._client.delete(path`/v1/skills/${skill_id}/versions/${version}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/skills/skills.mjs
var Skills;
var init_skills = __esm(() => {
  init_versions2();
  init_versions2();
  init_pagination();
  init_headers();
  init_uploads();
  init_path();
  Skills = class Skills extends APIResource {
    constructor() {
      super(...arguments);
      this.versions = new Versions2(this._client);
    }
    create(params = {}, options) {
      const { betas, ...body } = params ?? {};
      return this._client.post("/v1/skills?beta=true", multipartFormRequestOptions({
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
          options?.headers
        ])
      }, this._client, false));
    }
    retrieve(skillID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/skills/${skillID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/skills?beta=true", PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
          options?.headers
        ])
      });
    }
    delete(skillID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.delete(path`/v1/skills/${skillID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
          options?.headers
        ])
      });
    }
  };
  Skills.Versions = Versions2;
});

// node_modules/@anthropic-ai/sdk/resources/beta/vaults/credentials.mjs
var Credentials;
var init_credentials = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Credentials = class Credentials extends APIResource {
    create(vaultID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/vaults/${vaultID}/credentials?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(credentialID, params, options) {
      const { vault_id, betas } = params;
      return this._client.get(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    update(credentialID, params, options) {
      const { vault_id, betas, ...body } = params;
      return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(vaultID, params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList(path`/v1/vaults/${vaultID}/credentials?beta=true`, PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    delete(credentialID, params, options) {
      const { vault_id, betas } = params;
      return this._client.delete(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    archive(credentialID, params, options) {
      const { vault_id, betas } = params;
      return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}/archive?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/beta/vaults/vaults.mjs
var Vaults;
var init_vaults = __esm(() => {
  init_credentials();
  init_credentials();
  init_pagination();
  init_headers();
  init_path();
  Vaults = class Vaults extends APIResource {
    constructor() {
      super(...arguments);
      this.credentials = new Credentials(this._client);
    }
    create(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/vaults?beta=true", {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    retrieve(vaultID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/vaults/${vaultID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    update(vaultID, params, options) {
      const { betas, ...body } = params;
      return this._client.post(path`/v1/vaults/${vaultID}?beta=true`, {
        body,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/vaults?beta=true", PageCursor, {
        query,
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    delete(vaultID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.delete(path`/v1/vaults/${vaultID}?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
    archive(vaultID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.post(path`/v1/vaults/${vaultID}/archive?beta=true`, {
        ...options,
        headers: buildHeaders([
          { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
          options?.headers
        ])
      });
    }
  };
  Vaults.Credentials = Credentials;
});

// node_modules/@anthropic-ai/sdk/resources/beta/beta.mjs
var Beta;
var init_beta = __esm(() => {
  init_environments();
  init_environments();
  init_files();
  init_files();
  init_models();
  init_models();
  init_user_profiles();
  init_user_profiles();
  init_agents();
  init_agents();
  init_memory_stores();
  init_memory_stores();
  init_messages();
  init_messages();
  init_sessions();
  init_sessions();
  init_skills();
  init_skills();
  init_vaults();
  init_vaults();
  Beta = class Beta extends APIResource {
    constructor() {
      super(...arguments);
      this.models = new Models(this._client);
      this.messages = new Messages(this._client);
      this.agents = new Agents(this._client);
      this.environments = new Environments(this._client);
      this.sessions = new Sessions(this._client);
      this.vaults = new Vaults(this._client);
      this.memoryStores = new MemoryStores(this._client);
      this.files = new Files(this._client);
      this.skills = new Skills(this._client);
      this.userProfiles = new UserProfiles(this._client);
    }
  };
  Beta.Models = Models;
  Beta.Messages = Messages;
  Beta.Agents = Agents;
  Beta.Environments = Environments;
  Beta.Sessions = Sessions;
  Beta.Vaults = Vaults;
  Beta.MemoryStores = MemoryStores;
  Beta.Files = Files;
  Beta.Skills = Skills;
  Beta.UserProfiles = UserProfiles;
});

// node_modules/@anthropic-ai/sdk/resources/completions.mjs
var Completions;
var init_completions = __esm(() => {
  init_headers();
  Completions = class Completions extends APIResource {
    create(params, options) {
      const { betas, ...body } = params;
      return this._client.post("/v1/complete", {
        body,
        timeout: this._client._options.timeout ?? 600000,
        ...options,
        headers: buildHeaders([
          { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : undefined },
          options?.headers
        ]),
        stream: params.stream ?? false
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/lib/parser.mjs
function getOutputFormat2(params) {
  return params?.output_config?.format;
}
function maybeParseMessage(message, params, opts) {
  const outputFormat = getOutputFormat2(params);
  if (!params || !("parse" in (outputFormat ?? {}))) {
    return {
      ...message,
      content: message.content.map((block) => {
        if (block.type === "text") {
          const parsedBlock = Object.defineProperty({ ...block }, "parsed_output", {
            value: null,
            enumerable: false
          });
          return parsedBlock;
        }
        return block;
      }),
      parsed_output: null
    };
  }
  return parseMessage(message, params, opts);
}
function parseMessage(message, params, opts) {
  let firstParsedOutput = null;
  const content = message.content.map((block) => {
    if (block.type === "text") {
      const parsedOutput = parseOutputFormat(params, block.text);
      if (firstParsedOutput === null) {
        firstParsedOutput = parsedOutput;
      }
      const parsedBlock = Object.defineProperty({ ...block }, "parsed_output", {
        value: parsedOutput,
        enumerable: false
      });
      return parsedBlock;
    }
    return block;
  });
  return {
    ...message,
    content,
    parsed_output: firstParsedOutput
  };
}
function parseOutputFormat(params, content) {
  const outputFormat = getOutputFormat2(params);
  if (outputFormat?.type !== "json_schema") {
    return null;
  }
  try {
    if ("parse" in outputFormat) {
      return outputFormat.parse(content);
    }
    return JSON.parse(content);
  } catch (error2) {
    throw new AnthropicError(`Failed to parse structured output: ${error2}`);
  }
}
var init_parser2 = __esm(() => {
  init_error();
});

// node_modules/@anthropic-ai/sdk/lib/MessageStream.mjs
function tracksToolInput2(content) {
  return content.type === "tool_use" || content.type === "server_tool_use";
}
function checkNever2(x2) {}
var _MessageStream_instances, _MessageStream_currentMessageSnapshot, _MessageStream_params, _MessageStream_connectedPromise, _MessageStream_resolveConnectedPromise, _MessageStream_rejectConnectedPromise, _MessageStream_endPromise, _MessageStream_resolveEndPromise, _MessageStream_rejectEndPromise, _MessageStream_listeners, _MessageStream_ended, _MessageStream_errored, _MessageStream_aborted, _MessageStream_catchingPromiseCreated, _MessageStream_response, _MessageStream_request_id, _MessageStream_logger, _MessageStream_getFinalMessage, _MessageStream_getFinalText, _MessageStream_handleError, _MessageStream_beginRequest, _MessageStream_addStreamEvent, _MessageStream_endRequest, _MessageStream_accumulateMessage, JSON_BUF_PROPERTY2 = "__json_buf", MessageStream;
var init_MessageStream = __esm(() => {
  init_tslib();
  init_error2();
  init_streaming2();
  init_parser();
  init_parser2();
  MessageStream = class MessageStream {
    constructor(params, opts) {
      _MessageStream_instances.add(this);
      this.messages = [];
      this.receivedMessages = [];
      _MessageStream_currentMessageSnapshot.set(this, undefined);
      _MessageStream_params.set(this, null);
      this.controller = new AbortController;
      _MessageStream_connectedPromise.set(this, undefined);
      _MessageStream_resolveConnectedPromise.set(this, () => {});
      _MessageStream_rejectConnectedPromise.set(this, () => {});
      _MessageStream_endPromise.set(this, undefined);
      _MessageStream_resolveEndPromise.set(this, () => {});
      _MessageStream_rejectEndPromise.set(this, () => {});
      _MessageStream_listeners.set(this, {});
      _MessageStream_ended.set(this, false);
      _MessageStream_errored.set(this, false);
      _MessageStream_aborted.set(this, false);
      _MessageStream_catchingPromiseCreated.set(this, false);
      _MessageStream_response.set(this, undefined);
      _MessageStream_request_id.set(this, undefined);
      _MessageStream_logger.set(this, undefined);
      _MessageStream_handleError.set(this, (error2) => {
        __classPrivateFieldSet(this, _MessageStream_errored, true, "f");
        if (isAbortError(error2)) {
          error2 = new APIUserAbortError;
        }
        if (error2 instanceof APIUserAbortError) {
          __classPrivateFieldSet(this, _MessageStream_aborted, true, "f");
          return this._emit("abort", error2);
        }
        if (error2 instanceof AnthropicError) {
          return this._emit("error", error2);
        }
        if (error2 instanceof Error) {
          const anthropicError = new AnthropicError(error2.message);
          anthropicError.cause = error2;
          return this._emit("error", anthropicError);
        }
        return this._emit("error", new AnthropicError(String(error2)));
      });
      __classPrivateFieldSet(this, _MessageStream_connectedPromise, new Promise((resolve11, reject) => {
        __classPrivateFieldSet(this, _MessageStream_resolveConnectedPromise, resolve11, "f");
        __classPrivateFieldSet(this, _MessageStream_rejectConnectedPromise, reject, "f");
      }), "f");
      __classPrivateFieldSet(this, _MessageStream_endPromise, new Promise((resolve11, reject) => {
        __classPrivateFieldSet(this, _MessageStream_resolveEndPromise, resolve11, "f");
        __classPrivateFieldSet(this, _MessageStream_rejectEndPromise, reject, "f");
      }), "f");
      __classPrivateFieldGet(this, _MessageStream_connectedPromise, "f").catch(() => {});
      __classPrivateFieldGet(this, _MessageStream_endPromise, "f").catch(() => {});
      __classPrivateFieldSet(this, _MessageStream_params, params, "f");
      __classPrivateFieldSet(this, _MessageStream_logger, opts?.logger ?? console, "f");
    }
    get response() {
      return __classPrivateFieldGet(this, _MessageStream_response, "f");
    }
    get request_id() {
      return __classPrivateFieldGet(this, _MessageStream_request_id, "f");
    }
    async withResponse() {
      __classPrivateFieldSet(this, _MessageStream_catchingPromiseCreated, true, "f");
      const response = await __classPrivateFieldGet(this, _MessageStream_connectedPromise, "f");
      if (!response) {
        throw new Error("Could not resolve a `Response` object");
      }
      return {
        data: this,
        response,
        request_id: response.headers.get("request-id")
      };
    }
    static fromReadableStream(stream) {
      const runner = new MessageStream(null);
      runner._run(() => runner._fromReadableStream(stream));
      return runner;
    }
    static createMessage(messages, params, options, { logger } = {}) {
      const runner = new MessageStream(params, { logger });
      for (const message of params.messages) {
        runner._addMessageParam(message);
      }
      __classPrivateFieldSet(runner, _MessageStream_params, { ...params, stream: true }, "f");
      runner._run(() => runner._createMessage(messages, { ...params, stream: true }, { ...options, headers: { ...options?.headers, "X-Stainless-Helper-Method": "stream" } }));
      return runner;
    }
    _run(executor) {
      executor().then(() => {
        this._emitFinal();
        this._emit("end");
      }, __classPrivateFieldGet(this, _MessageStream_handleError, "f"));
    }
    _addMessageParam(message) {
      this.messages.push(message);
    }
    _addMessage(message, emit = true) {
      this.receivedMessages.push(message);
      if (emit) {
        this._emit("message", message);
      }
    }
    async _createMessage(messages, params, options) {
      const signal = options?.signal;
      let abortHandler;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        abortHandler = this.controller.abort.bind(this.controller);
        signal.addEventListener("abort", abortHandler);
      }
      try {
        __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_beginRequest).call(this);
        const { response, data: stream } = await messages.create({ ...params, stream: true }, { ...options, signal: this.controller.signal }).withResponse();
        this._connected(response);
        for await (const event of stream) {
          __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_addStreamEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
          throw new APIUserAbortError;
        }
        __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_endRequest).call(this);
      } finally {
        if (signal && abortHandler) {
          signal.removeEventListener("abort", abortHandler);
        }
      }
    }
    _connected(response) {
      if (this.ended)
        return;
      __classPrivateFieldSet(this, _MessageStream_response, response, "f");
      __classPrivateFieldSet(this, _MessageStream_request_id, response?.headers.get("request-id"), "f");
      __classPrivateFieldGet(this, _MessageStream_resolveConnectedPromise, "f").call(this, response);
      this._emit("connect");
    }
    get ended() {
      return __classPrivateFieldGet(this, _MessageStream_ended, "f");
    }
    get errored() {
      return __classPrivateFieldGet(this, _MessageStream_errored, "f");
    }
    get aborted() {
      return __classPrivateFieldGet(this, _MessageStream_aborted, "f");
    }
    abort() {
      this.controller.abort();
    }
    on(event, listener) {
      const listeners = __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] = []);
      listeners.push({ listener });
      return this;
    }
    off(event, listener) {
      const listeners = __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event];
      if (!listeners)
        return this;
      const index = listeners.findIndex((l2) => l2.listener === listener);
      if (index >= 0)
        listeners.splice(index, 1);
      return this;
    }
    once(event, listener) {
      const listeners = __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] = []);
      listeners.push({ listener, once: true });
      return this;
    }
    emitted(event) {
      return new Promise((resolve11, reject) => {
        __classPrivateFieldSet(this, _MessageStream_catchingPromiseCreated, true, "f");
        if (event !== "error")
          this.once("error", reject);
        this.once(event, resolve11);
      });
    }
    async done() {
      __classPrivateFieldSet(this, _MessageStream_catchingPromiseCreated, true, "f");
      await __classPrivateFieldGet(this, _MessageStream_endPromise, "f");
    }
    get currentMessage() {
      return __classPrivateFieldGet(this, _MessageStream_currentMessageSnapshot, "f");
    }
    async finalMessage() {
      await this.done();
      return __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_getFinalMessage).call(this);
    }
    async finalText() {
      await this.done();
      return __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_getFinalText).call(this);
    }
    _emit(event, ...args) {
      if (__classPrivateFieldGet(this, _MessageStream_ended, "f"))
        return;
      if (event === "end") {
        __classPrivateFieldSet(this, _MessageStream_ended, true, "f");
        __classPrivateFieldGet(this, _MessageStream_resolveEndPromise, "f").call(this);
      }
      const listeners = __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event];
      if (listeners) {
        __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] = listeners.filter((l2) => !l2.once);
        listeners.forEach(({ listener }) => listener(...args));
      }
      if (event === "abort") {
        const error2 = args[0];
        if (!__classPrivateFieldGet(this, _MessageStream_catchingPromiseCreated, "f") && !listeners?.length) {
          Promise.reject(error2);
        }
        __classPrivateFieldGet(this, _MessageStream_rejectConnectedPromise, "f").call(this, error2);
        __classPrivateFieldGet(this, _MessageStream_rejectEndPromise, "f").call(this, error2);
        this._emit("end");
        return;
      }
      if (event === "error") {
        const error2 = args[0];
        if (!__classPrivateFieldGet(this, _MessageStream_catchingPromiseCreated, "f") && !listeners?.length) {
          Promise.reject(error2);
        }
        __classPrivateFieldGet(this, _MessageStream_rejectConnectedPromise, "f").call(this, error2);
        __classPrivateFieldGet(this, _MessageStream_rejectEndPromise, "f").call(this, error2);
        this._emit("end");
      }
    }
    _emitFinal() {
      const finalMessage = this.receivedMessages.at(-1);
      if (finalMessage) {
        this._emit("finalMessage", __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_getFinalMessage).call(this));
      }
    }
    async _fromReadableStream(readableStream, options) {
      const signal = options?.signal;
      let abortHandler;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        abortHandler = this.controller.abort.bind(this.controller);
        signal.addEventListener("abort", abortHandler);
      }
      try {
        __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_beginRequest).call(this);
        this._connected(null);
        const stream = Stream.fromReadableStream(readableStream, this.controller);
        for await (const event of stream) {
          __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_addStreamEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
          throw new APIUserAbortError;
        }
        __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_endRequest).call(this);
      } finally {
        if (signal && abortHandler) {
          signal.removeEventListener("abort", abortHandler);
        }
      }
    }
    [(_MessageStream_currentMessageSnapshot = new WeakMap, _MessageStream_params = new WeakMap, _MessageStream_connectedPromise = new WeakMap, _MessageStream_resolveConnectedPromise = new WeakMap, _MessageStream_rejectConnectedPromise = new WeakMap, _MessageStream_endPromise = new WeakMap, _MessageStream_resolveEndPromise = new WeakMap, _MessageStream_rejectEndPromise = new WeakMap, _MessageStream_listeners = new WeakMap, _MessageStream_ended = new WeakMap, _MessageStream_errored = new WeakMap, _MessageStream_aborted = new WeakMap, _MessageStream_catchingPromiseCreated = new WeakMap, _MessageStream_response = new WeakMap, _MessageStream_request_id = new WeakMap, _MessageStream_logger = new WeakMap, _MessageStream_handleError = new WeakMap, _MessageStream_instances = new WeakSet, _MessageStream_getFinalMessage = function _MessageStream_getFinalMessage() {
      if (this.receivedMessages.length === 0) {
        throw new AnthropicError("stream ended without producing a Message with role=assistant");
      }
      return this.receivedMessages.at(-1);
    }, _MessageStream_getFinalText = function _MessageStream_getFinalText() {
      if (this.receivedMessages.length === 0) {
        throw new AnthropicError("stream ended without producing a Message with role=assistant");
      }
      const textBlocks = this.receivedMessages.at(-1).content.filter((block) => block.type === "text").map((block) => block.text);
      if (textBlocks.length === 0) {
        throw new AnthropicError("stream ended without producing a content block with type=text");
      }
      return textBlocks.join(" ");
    }, _MessageStream_beginRequest = function _MessageStream_beginRequest() {
      if (this.ended)
        return;
      __classPrivateFieldSet(this, _MessageStream_currentMessageSnapshot, undefined, "f");
    }, _MessageStream_addStreamEvent = function _MessageStream_addStreamEvent(event) {
      if (this.ended)
        return;
      const messageSnapshot = __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_accumulateMessage).call(this, event);
      this._emit("streamEvent", event, messageSnapshot);
      switch (event.type) {
        case "content_block_delta": {
          const content = messageSnapshot.content.at(-1);
          switch (event.delta.type) {
            case "text_delta": {
              if (content.type === "text") {
                this._emit("text", event.delta.text, content.text || "");
              }
              break;
            }
            case "citations_delta": {
              if (content.type === "text") {
                this._emit("citation", event.delta.citation, content.citations ?? []);
              }
              break;
            }
            case "input_json_delta": {
              if (tracksToolInput2(content) && content.input) {
                this._emit("inputJson", event.delta.partial_json, content.input);
              }
              break;
            }
            case "thinking_delta": {
              if (content.type === "thinking") {
                this._emit("thinking", event.delta.thinking, content.thinking);
              }
              break;
            }
            case "signature_delta": {
              if (content.type === "thinking") {
                this._emit("signature", content.signature);
              }
              break;
            }
            default:
              checkNever2(event.delta);
          }
          break;
        }
        case "message_stop": {
          this._addMessageParam(messageSnapshot);
          this._addMessage(maybeParseMessage(messageSnapshot, __classPrivateFieldGet(this, _MessageStream_params, "f"), { logger: __classPrivateFieldGet(this, _MessageStream_logger, "f") }), true);
          break;
        }
        case "content_block_stop": {
          this._emit("contentBlock", messageSnapshot.content.at(-1));
          break;
        }
        case "message_start": {
          __classPrivateFieldSet(this, _MessageStream_currentMessageSnapshot, messageSnapshot, "f");
          break;
        }
        case "content_block_start":
        case "message_delta":
          break;
      }
    }, _MessageStream_endRequest = function _MessageStream_endRequest() {
      if (this.ended) {
        throw new AnthropicError(`stream has ended, this shouldn't happen`);
      }
      const snapshot = __classPrivateFieldGet(this, _MessageStream_currentMessageSnapshot, "f");
      if (!snapshot) {
        throw new AnthropicError(`request ended without sending any chunks`);
      }
      __classPrivateFieldSet(this, _MessageStream_currentMessageSnapshot, undefined, "f");
      return maybeParseMessage(snapshot, __classPrivateFieldGet(this, _MessageStream_params, "f"), { logger: __classPrivateFieldGet(this, _MessageStream_logger, "f") });
    }, _MessageStream_accumulateMessage = function _MessageStream_accumulateMessage(event) {
      let snapshot = __classPrivateFieldGet(this, _MessageStream_currentMessageSnapshot, "f");
      if (event.type === "message_start") {
        if (snapshot) {
          throw new AnthropicError(`Unexpected event order, got ${event.type} before receiving "message_stop"`);
        }
        return event.message;
      }
      if (!snapshot) {
        throw new AnthropicError(`Unexpected event order, got ${event.type} before "message_start"`);
      }
      switch (event.type) {
        case "message_stop":
          return snapshot;
        case "message_delta":
          snapshot.stop_reason = event.delta.stop_reason;
          snapshot.stop_sequence = event.delta.stop_sequence;
          snapshot.usage.output_tokens = event.usage.output_tokens;
          if (event.usage.input_tokens != null) {
            snapshot.usage.input_tokens = event.usage.input_tokens;
          }
          if (event.usage.cache_creation_input_tokens != null) {
            snapshot.usage.cache_creation_input_tokens = event.usage.cache_creation_input_tokens;
          }
          if (event.usage.cache_read_input_tokens != null) {
            snapshot.usage.cache_read_input_tokens = event.usage.cache_read_input_tokens;
          }
          if (event.usage.server_tool_use != null) {
            snapshot.usage.server_tool_use = event.usage.server_tool_use;
          }
          return snapshot;
        case "content_block_start":
          snapshot.content.push({ ...event.content_block });
          return snapshot;
        case "content_block_delta": {
          const snapshotContent = snapshot.content.at(event.index);
          switch (event.delta.type) {
            case "text_delta": {
              if (snapshotContent?.type === "text") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  text: (snapshotContent.text || "") + event.delta.text
                };
              }
              break;
            }
            case "citations_delta": {
              if (snapshotContent?.type === "text") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  citations: [...snapshotContent.citations ?? [], event.delta.citation]
                };
              }
              break;
            }
            case "input_json_delta": {
              if (snapshotContent && tracksToolInput2(snapshotContent)) {
                let jsonBuf = snapshotContent[JSON_BUF_PROPERTY2] || "";
                jsonBuf += event.delta.partial_json;
                const newContent = { ...snapshotContent };
                Object.defineProperty(newContent, JSON_BUF_PROPERTY2, {
                  value: jsonBuf,
                  enumerable: false,
                  writable: true
                });
                if (jsonBuf) {
                  newContent.input = partialParse(jsonBuf);
                }
                snapshot.content[event.index] = newContent;
              }
              break;
            }
            case "thinking_delta": {
              if (snapshotContent?.type === "thinking") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  thinking: snapshotContent.thinking + event.delta.thinking
                };
              }
              break;
            }
            case "signature_delta": {
              if (snapshotContent?.type === "thinking") {
                snapshot.content[event.index] = {
                  ...snapshotContent,
                  signature: event.delta.signature
                };
              }
              break;
            }
            default:
              checkNever2(event.delta);
          }
          return snapshot;
        }
        case "content_block_stop":
          return snapshot;
      }
    }, Symbol.asyncIterator)]() {
      const pushQueue = [];
      const readQueue = [];
      let done = false;
      this.on("streamEvent", (event) => {
        const reader = readQueue.shift();
        if (reader) {
          reader.resolve(event);
        } else {
          pushQueue.push(event);
        }
      });
      this.on("end", () => {
        done = true;
        for (const reader of readQueue) {
          reader.resolve(undefined);
        }
        readQueue.length = 0;
      });
      this.on("abort", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      this.on("error", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      return {
        next: async () => {
          if (!pushQueue.length) {
            if (done) {
              return { value: undefined, done: true };
            }
            return new Promise((resolve11, reject) => readQueue.push({ resolve: resolve11, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: undefined, done: true });
          }
          const chunk = pushQueue.shift();
          return { value: chunk, done: false };
        },
        return: async () => {
          this.abort();
          return { value: undefined, done: true };
        }
      };
    }
    toReadableStream() {
      const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
      return stream.toReadableStream();
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/messages/batches.mjs
var Batches2;
var init_batches2 = __esm(() => {
  init_pagination();
  init_headers();
  init_jsonl();
  init_error2();
  init_path();
  Batches2 = class Batches2 extends APIResource {
    create(body, options) {
      return this._client.post("/v1/messages/batches", { body, ...options });
    }
    retrieve(messageBatchID, options) {
      return this._client.get(path`/v1/messages/batches/${messageBatchID}`, options);
    }
    list(query = {}, options) {
      return this._client.getAPIList("/v1/messages/batches", Page, { query, ...options });
    }
    delete(messageBatchID, options) {
      return this._client.delete(path`/v1/messages/batches/${messageBatchID}`, options);
    }
    cancel(messageBatchID, options) {
      return this._client.post(path`/v1/messages/batches/${messageBatchID}/cancel`, options);
    }
    async results(messageBatchID, options) {
      const batch = await this.retrieve(messageBatchID);
      if (!batch.results_url) {
        throw new AnthropicError(`No batch \`results_url\`; Has it finished processing? ${batch.processing_status} - ${batch.id}`);
      }
      return this._client.get(batch.results_url, {
        ...options,
        headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
        stream: true,
        __binaryResponse: true
      })._thenUnwrap((_3, props) => JSONLDecoder.fromResponse(props.response, props.controller));
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/messages/messages.mjs
var Messages2, DEPRECATED_MODELS2, MODELS_TO_WARN_WITH_THINKING_ENABLED2;
var init_messages2 = __esm(() => {
  init_headers();
  init_stainless_helper_header();
  init_MessageStream();
  init_parser2();
  init_batches2();
  init_batches2();
  init_constants();
  Messages2 = class Messages2 extends APIResource {
    constructor() {
      super(...arguments);
      this.batches = new Batches2(this._client);
    }
    create(body, options) {
      if (body.model in DEPRECATED_MODELS2) {
        console.warn(`The model '${body.model}' is deprecated and will reach end-of-life on ${DEPRECATED_MODELS2[body.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`);
      }
      if (MODELS_TO_WARN_WITH_THINKING_ENABLED2.includes(body.model) && body.thinking && body.thinking.type === "enabled") {
        console.warn(`Using Claude with ${body.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`);
      }
      let timeout = this._client._options.timeout;
      if (!body.stream && timeout == null) {
        const maxNonstreamingTokens = MODEL_NONSTREAMING_TOKENS[body.model] ?? undefined;
        timeout = this._client.calculateNonstreamingTimeout(body.max_tokens, maxNonstreamingTokens);
      }
      const helperHeader = stainlessHelperHeader(body.tools, body.messages);
      return this._client.post("/v1/messages", {
        body,
        timeout: timeout ?? 600000,
        ...options,
        headers: buildHeaders([helperHeader, options?.headers]),
        stream: body.stream ?? false
      });
    }
    parse(params, options) {
      return this.create(params, options).then((message) => parseMessage(message, params, { logger: this._client.logger ?? console }));
    }
    stream(body, options) {
      return MessageStream.createMessage(this, body, options, { logger: this._client.logger ?? console });
    }
    countTokens(body, options) {
      return this._client.post("/v1/messages/count_tokens", { body, ...options });
    }
  };
  DEPRECATED_MODELS2 = {
    "claude-1.3": "November 6th, 2024",
    "claude-1.3-100k": "November 6th, 2024",
    "claude-instant-1.1": "November 6th, 2024",
    "claude-instant-1.1-100k": "November 6th, 2024",
    "claude-instant-1.2": "November 6th, 2024",
    "claude-3-sonnet-20240229": "July 21st, 2025",
    "claude-3-opus-20240229": "January 5th, 2026",
    "claude-2.1": "July 21st, 2025",
    "claude-2.0": "July 21st, 2025",
    "claude-3-7-sonnet-latest": "February 19th, 2026",
    "claude-3-7-sonnet-20250219": "February 19th, 2026",
    "claude-3-5-haiku-latest": "February 19th, 2026",
    "claude-3-5-haiku-20241022": "February 19th, 2026",
    "claude-opus-4-0": "June 15th, 2026",
    "claude-opus-4-20250514": "June 15th, 2026",
    "claude-sonnet-4-0": "June 15th, 2026",
    "claude-sonnet-4-20250514": "June 15th, 2026"
  };
  MODELS_TO_WARN_WITH_THINKING_ENABLED2 = ["claude-mythos-preview", "claude-opus-4-6"];
  Messages2.Batches = Batches2;
});

// node_modules/@anthropic-ai/sdk/resources/models.mjs
var Models2;
var init_models2 = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Models2 = class Models2 extends APIResource {
    retrieve(modelID, params = {}, options) {
      const { betas } = params ?? {};
      return this._client.get(path`/v1/models/${modelID}`, {
        ...options,
        headers: buildHeaders([
          { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : undefined },
          options?.headers
        ])
      });
    }
    list(params = {}, options) {
      const { betas, ...query } = params ?? {};
      return this._client.getAPIList("/v1/models", Page, {
        query,
        ...options,
        headers: buildHeaders([
          { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : undefined },
          options?.headers
        ])
      });
    }
  };
});

// node_modules/@anthropic-ai/sdk/resources/index.mjs
var init_resources2 = __esm(() => {
  init_beta();
  init_completions();
  init_messages2();
  init_models2();
  init_shared();
});

// node_modules/@anthropic-ai/sdk/internal/utils/env.mjs
var readEnv = (env2) => {
  if (typeof globalThis.process !== "undefined") {
    return globalThis.process.env?.[env2]?.trim() || undefined;
  }
  if (typeof globalThis.Deno !== "undefined") {
    return globalThis.Deno.env?.get?.(env2)?.trim() || undefined;
  }
  return;
};

// node_modules/@anthropic-ai/sdk/client.mjs
class BaseAnthropic {
  constructor({ baseURL = readEnv("ANTHROPIC_BASE_URL"), apiKey = readEnv("ANTHROPIC_API_KEY") ?? null, authToken = readEnv("ANTHROPIC_AUTH_TOKEN") ?? null, ...opts } = {}) {
    _BaseAnthropic_instances.add(this);
    _BaseAnthropic_encoder.set(this, undefined);
    const options = {
      apiKey,
      authToken,
      ...opts,
      baseURL: baseURL || `https://api.anthropic.com`
    };
    if (!options.dangerouslyAllowBrowser && isRunningInBrowser()) {
      throw new AnthropicError(`It looks like you're running in a browser-like environment.

This is disabled by default, as it risks exposing your secret API credentials to attackers.
If you understand the risks and have appropriate mitigations in place,
you can set the \`dangerouslyAllowBrowser\` option to \`true\`, e.g.,

new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
`);
    }
    this.baseURL = options.baseURL;
    this.timeout = options.timeout ?? _a.DEFAULT_TIMEOUT;
    this.logger = options.logger ?? console;
    const defaultLogLevel = "warn";
    this.logLevel = defaultLogLevel;
    this.logLevel = parseLogLevel(options.logLevel, "ClientOptions.logLevel", this) ?? parseLogLevel(readEnv("ANTHROPIC_LOG"), "process.env['ANTHROPIC_LOG']", this) ?? defaultLogLevel;
    this.fetchOptions = options.fetchOptions;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetch = options.fetch ?? getDefaultFetch();
    __classPrivateFieldSet(this, _BaseAnthropic_encoder, FallbackEncoder, "f");
    this._options = options;
    this.apiKey = typeof apiKey === "string" ? apiKey : null;
    this.authToken = authToken;
  }
  withOptions(options) {
    const client = new this.constructor({
      ...this._options,
      baseURL: this.baseURL,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      logger: this.logger,
      logLevel: this.logLevel,
      fetch: this.fetch,
      fetchOptions: this.fetchOptions,
      apiKey: this.apiKey,
      authToken: this.authToken,
      ...options
    });
    return client;
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values, nulls }) {
    if (values.get("x-api-key") || values.get("authorization")) {
      return;
    }
    if (this.apiKey && values.get("x-api-key")) {
      return;
    }
    if (nulls.has("x-api-key")) {
      return;
    }
    if (this.authToken && values.get("authorization")) {
      return;
    }
    if (nulls.has("authorization")) {
      return;
    }
    throw new Error('Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted');
  }
  async authHeaders(opts) {
    return buildHeaders([await this.apiKeyAuth(opts), await this.bearerAuth(opts)]);
  }
  async apiKeyAuth(opts) {
    if (this.apiKey == null) {
      return;
    }
    return buildHeaders([{ "X-Api-Key": this.apiKey }]);
  }
  async bearerAuth(opts) {
    if (this.authToken == null) {
      return;
    }
    return buildHeaders([{ Authorization: `Bearer ${this.authToken}` }]);
  }
  stringifyQuery(query) {
    return stringifyQuery(query);
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${VERSION}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${uuid4()}`;
  }
  makeStatusError(status, error2, message, headers) {
    return APIError.generate(status, error2, message, headers);
  }
  buildURL(path2, query, defaultBaseURL) {
    const baseURL = !__classPrivateFieldGet(this, _BaseAnthropic_instances, "m", _BaseAnthropic_baseURLOverridden).call(this) && defaultBaseURL || this.baseURL;
    const url = isAbsoluteURL(path2) ? new URL(path2) : new URL(baseURL + (baseURL.endsWith("/") && path2.startsWith("/") ? path2.slice(1) : path2));
    const defaultQuery = this.defaultQuery();
    const pathQuery = Object.fromEntries(url.searchParams);
    if (!isEmptyObj(defaultQuery) || !isEmptyObj(pathQuery)) {
      query = { ...pathQuery, ...defaultQuery, ...query };
    }
    if (typeof query === "object" && query && !Array.isArray(query)) {
      url.search = this.stringifyQuery(query);
    }
    return url.toString();
  }
  _calculateNonstreamingTimeout(maxTokens) {
    const defaultTimeout = 10 * 60;
    const expectedTimeout = 60 * 60 * maxTokens / 128000;
    if (expectedTimeout > defaultTimeout) {
      throw new AnthropicError("Streaming is required for operations that may take longer than 10 minutes. " + "See https://github.com/anthropics/anthropic-sdk-typescript#streaming-responses for more details");
    }
    return defaultTimeout * 1000;
  }
  async prepareOptions(options) {}
  async prepareRequest(request, { url, options }) {}
  get(path2, opts) {
    return this.methodRequest("get", path2, opts);
  }
  post(path2, opts) {
    return this.methodRequest("post", path2, opts);
  }
  patch(path2, opts) {
    return this.methodRequest("patch", path2, opts);
  }
  put(path2, opts) {
    return this.methodRequest("put", path2, opts);
  }
  delete(path2, opts) {
    return this.methodRequest("delete", path2, opts);
  }
  methodRequest(method, path2, opts) {
    return this.request(Promise.resolve(opts).then((opts2) => {
      return { method, path: path2, ...opts2 };
    }));
  }
  request(options, remainingRetries = null) {
    return new APIPromise(this, this.makeRequest(options, remainingRetries, undefined));
  }
  async makeRequest(optionsInput, retriesRemaining, retryOfRequestLogID) {
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
    }
    await this.prepareOptions(options);
    const { req, url, timeout } = await this.buildRequest(options, {
      retryCount: maxRetries - retriesRemaining
    });
    await this.prepareRequest(req, { url, options });
    const requestLogID = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0");
    const retryLogStr = retryOfRequestLogID === undefined ? "" : `, retryOf: ${retryOfRequestLogID}`;
    const startTime = Date.now();
    loggerFor(this).debug(`[${requestLogID}] sending request`, formatRequestDetails({
      retryOfRequestLogID,
      method: options.method,
      url,
      options,
      headers: req.headers
    }));
    if (options.signal?.aborted) {
      throw new APIUserAbortError;
    }
    const controller = new AbortController;
    const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);
    const headersTime = Date.now();
    if (response instanceof globalThis.Error) {
      const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
      if (options.signal?.aborted) {
        throw new APIUserAbortError;
      }
      const isTimeout = isAbortError(response) || /timed? ?out/i.test(String(response) + ("cause" in response ? String(response.cause) : ""));
      if (retriesRemaining) {
        loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - ${retryMessage}`);
        loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (${retryMessage})`, formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - error; no more retries left`);
      loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (error; no more retries left)`, formatRequestDetails({
        retryOfRequestLogID,
        url,
        durationMs: headersTime - startTime,
        message: response.message
      }));
      if (isTimeout) {
        throw new APIConnectionTimeoutError;
      }
      throw new APIConnectionError({ cause: response });
    }
    const specialHeaders = [...response.headers.entries()].filter(([name]) => name === "request-id").map(([name, value]) => ", " + name + ": " + JSON.stringify(value)).join("");
    const responseInfo = `[${requestLogID}${retryLogStr}${specialHeaders}] ${req.method} ${url} ${response.ok ? "succeeded" : "failed"} with status ${response.status} in ${headersTime - startTime}ms`;
    if (!response.ok) {
      const shouldRetry = await this.shouldRetry(response);
      if (retriesRemaining && shouldRetry) {
        const retryMessage2 = `retrying, ${retriesRemaining} attempts remaining`;
        await CancelReadableStream(response.body);
        loggerFor(this).info(`${responseInfo} - ${retryMessage2}`);
        loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage2})`, formatRequestDetails({
          retryOfRequestLogID,
          url: response.url,
          status: response.status,
          headers: response.headers,
          durationMs: headersTime - startTime
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID, response.headers);
      }
      const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;
      loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
      const errText = await response.text().catch((err2) => castToError(err2).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? undefined : errText;
      loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage})`, formatRequestDetails({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        headers: response.headers,
        message: errMessage,
        durationMs: Date.now() - startTime
      }));
      const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
      throw err;
    }
    loggerFor(this).info(responseInfo);
    loggerFor(this).debug(`[${requestLogID}] response start`, formatRequestDetails({
      retryOfRequestLogID,
      url: response.url,
      status: response.status,
      headers: response.headers,
      durationMs: headersTime - startTime
    }));
    return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
  }
  getAPIList(path2, Page2, opts) {
    return this.requestAPIList(Page2, opts && "then" in opts ? opts.then((opts2) => ({ method: "get", path: path2, ...opts2 })) : { method: "get", path: path2, ...opts });
  }
  requestAPIList(Page2, options) {
    const request = this.makeRequest(options, null, undefined);
    return new PagePromise(this, request, Page2);
  }
  async fetchWithTimeout(url, init2, ms, controller) {
    const { signal, method, ...options } = init2 || {};
    const abort = this._makeAbort(controller);
    if (signal)
      signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, ms);
    const isReadableBody = globalThis.ReadableStream && options.body instanceof globalThis.ReadableStream || typeof options.body === "object" && options.body !== null && Symbol.asyncIterator in options.body;
    const fetchOptions = {
      signal: controller.signal,
      ...isReadableBody ? { duplex: "half" } : {},
      method: "GET",
      ...options
    };
    if (method) {
      fetchOptions.method = method.toUpperCase();
    }
    try {
      return await this.fetch.call(undefined, url, fetchOptions);
    } finally {
      clearTimeout(timeout);
    }
  }
  async shouldRetry(response) {
    const shouldRetryHeader = response.headers.get("x-should-retry");
    if (shouldRetryHeader === "true")
      return true;
    if (shouldRetryHeader === "false")
      return false;
    if (response.status === 408)
      return true;
    if (response.status === 409)
      return true;
    if (response.status === 429)
      return true;
    if (response.status >= 500)
      return true;
    return false;
  }
  async retryRequest(options, retriesRemaining, requestLogID, responseHeaders) {
    let timeoutMillis;
    const retryAfterMillisHeader = responseHeaders?.get("retry-after-ms");
    if (retryAfterMillisHeader) {
      const timeoutMs = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(timeoutMs)) {
        timeoutMillis = timeoutMs;
      }
    }
    const retryAfterHeader = responseHeaders?.get("retry-after");
    if (retryAfterHeader && !timeoutMillis) {
      const timeoutSeconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1000;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }
    if (timeoutMillis === undefined) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);
    return this.makeRequest(options, retriesRemaining - 1, requestLogID);
  }
  calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8;
    const numRetries = maxRetries - retriesRemaining;
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
    const jitter = 1 - Math.random() * 0.25;
    return sleepSeconds * jitter * 1000;
  }
  calculateNonstreamingTimeout(maxTokens, maxNonstreamingTokens) {
    const maxTime = 60 * 60 * 1000;
    const defaultTime = 60 * 10 * 1000;
    const expectedTime = maxTime * maxTokens / 128000;
    if (expectedTime > defaultTime || maxNonstreamingTokens != null && maxTokens > maxNonstreamingTokens) {
      throw new AnthropicError("Streaming is required for operations that may take longer than 10 minutes. See https://github.com/anthropics/anthropic-sdk-typescript#long-requests for more details");
    }
    return defaultTime;
  }
  async buildRequest(inputOptions, { retryCount = 0 } = {}) {
    const options = { ...inputOptions };
    const { method, path: path2, query, defaultBaseURL } = options;
    const url = this.buildURL(path2, query, defaultBaseURL);
    if ("timeout" in options)
      validatePositiveInteger("timeout", options.timeout);
    options.timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body } = this.buildBody({ options });
    const reqHeaders = await this.buildHeaders({ options: inputOptions, method, bodyHeaders, retryCount });
    const req = {
      method,
      headers: reqHeaders,
      ...options.signal && { signal: options.signal },
      ...globalThis.ReadableStream && body instanceof globalThis.ReadableStream && { duplex: "half" },
      ...body && { body },
      ...this.fetchOptions ?? {},
      ...options.fetchOptions ?? {}
    };
    return { req, url, timeout: options.timeout };
  }
  async buildHeaders({ options, method, bodyHeaders, retryCount }) {
    let idempotencyHeaders = {};
    if (this.idempotencyHeader && method !== "get") {
      if (!options.idempotencyKey)
        options.idempotencyKey = this.defaultIdempotencyKey();
      idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
    }
    const headers = buildHeaders([
      idempotencyHeaders,
      {
        Accept: "application/json",
        "User-Agent": this.getUserAgent(),
        "X-Stainless-Retry-Count": String(retryCount),
        ...options.timeout ? { "X-Stainless-Timeout": String(Math.trunc(options.timeout / 1000)) } : {},
        ...getPlatformHeaders(),
        ...this._options.dangerouslyAllowBrowser ? { "anthropic-dangerous-direct-browser-access": "true" } : undefined,
        "anthropic-version": "2023-06-01"
      },
      await this.authHeaders(options),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers
    ]);
    this.validateHeaders(headers);
    return headers.values;
  }
  _makeAbort(controller) {
    return () => controller.abort();
  }
  buildBody({ options: { body, headers: rawHeaders } }) {
    if (!body) {
      return { bodyHeaders: undefined, body: undefined };
    }
    const headers = buildHeaders([rawHeaders]);
    if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer || body instanceof DataView || typeof body === "string" && headers.values.has("content-type") || globalThis.Blob && body instanceof globalThis.Blob || body instanceof FormData || body instanceof URLSearchParams || globalThis.ReadableStream && body instanceof globalThis.ReadableStream) {
      return { bodyHeaders: undefined, body };
    } else if (typeof body === "object" && ((Symbol.asyncIterator in body) || (Symbol.iterator in body) && ("next" in body) && typeof body.next === "function")) {
      return { bodyHeaders: undefined, body: ReadableStreamFrom(body) };
    } else if (typeof body === "object" && headers.values.get("content-type") === "application/x-www-form-urlencoded") {
      return {
        bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
        body: this.stringifyQuery(body)
      };
    } else {
      return __classPrivateFieldGet(this, _BaseAnthropic_encoder, "f").call(this, { body, headers });
    }
  }
}
var _BaseAnthropic_instances, _a, _BaseAnthropic_encoder, _BaseAnthropic_baseURLOverridden, HUMAN_PROMPT = "\\n\\nHuman:", AI_PROMPT = "\\n\\nAssistant:", Anthropic;
var init_client = __esm(() => {
  init_tslib();
  init_values();
  init_detect_platform();
  init_query();
  init_error();
  init_pagination();
  init_uploads2();
  init_resources2();
  init_api_promise();
  init_completions();
  init_models2();
  init_beta();
  init_messages2();
  init_detect_platform();
  init_headers();
  init_log();
  init_values();
  _a = BaseAnthropic, _BaseAnthropic_encoder = new WeakMap, _BaseAnthropic_instances = new WeakSet, _BaseAnthropic_baseURLOverridden = function _BaseAnthropic_baseURLOverridden2() {
    return this.baseURL !== "https://api.anthropic.com";
  };
  BaseAnthropic.Anthropic = _a;
  BaseAnthropic.HUMAN_PROMPT = HUMAN_PROMPT;
  BaseAnthropic.AI_PROMPT = AI_PROMPT;
  BaseAnthropic.DEFAULT_TIMEOUT = 600000;
  BaseAnthropic.AnthropicError = AnthropicError;
  BaseAnthropic.APIError = APIError;
  BaseAnthropic.APIConnectionError = APIConnectionError;
  BaseAnthropic.APIConnectionTimeoutError = APIConnectionTimeoutError;
  BaseAnthropic.APIUserAbortError = APIUserAbortError;
  BaseAnthropic.NotFoundError = NotFoundError;
  BaseAnthropic.ConflictError = ConflictError;
  BaseAnthropic.RateLimitError = RateLimitError;
  BaseAnthropic.BadRequestError = BadRequestError;
  BaseAnthropic.AuthenticationError = AuthenticationError;
  BaseAnthropic.InternalServerError = InternalServerError;
  BaseAnthropic.PermissionDeniedError = PermissionDeniedError;
  BaseAnthropic.UnprocessableEntityError = UnprocessableEntityError;
  BaseAnthropic.toFile = toFile;
  Anthropic = class Anthropic extends BaseAnthropic {
    constructor() {
      super(...arguments);
      this.completions = new Completions(this);
      this.messages = new Messages2(this);
      this.models = new Models2(this);
      this.beta = new Beta(this);
    }
  };
  Anthropic.Completions = Completions;
  Anthropic.Messages = Messages2;
  Anthropic.Models = Models2;
  Anthropic.Beta = Beta;
});

// node_modules/@anthropic-ai/sdk/index.mjs
var init_sdk = __esm(() => {
  init_client();
  init_uploads2();
  init_api_promise();
  init_client();
  init_pagination();
  init_error();
});

// src/dispatcher/anthropic-sdk-agent.ts
import { readFileSync as readFileSync10 } from "node:fs";
function splitPrompt(text) {
  const markerRe = /\r?\n##[ \t]+Input[ \t]*\r?\n/;
  const match = markerRe.exec(text);
  if (!match) {
    return { systemPart: "", userPart: text };
  }
  return {
    systemPart: text.slice(0, match.index).trim(),
    userPart: text.slice(match.index).trim()
  };
}
async function runAnthropicSdkAgent(promptPath2, manifest, clientFactory, ctx) {
  const promptText = readFileSync10(promptPath2, "utf8");
  const { systemPart, userPart } = splitPrompt(promptText);
  const client = clientFactory ? clientFactory() : new Anthropic;
  const maxTokens = Math.min(manifest.token_budget ?? 4096, MAX_TOKENS_CAP);
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000;
  const model = DEFAULT_MODEL;
  if (ctx) {
    const reqPayload = {
      model,
      prompt_chars: promptText.length,
      cached_prefix_chars: systemPart.length > 0 ? systemPart.length : undefined,
      mode: "anthropic-sdk"
    };
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.request",
      level: "info",
      payload: reqPayload
    });
  }
  const controller = new AbortController;
  ctx?.registerAbort?.(() => controller.abort());
  const startTs = Date.now();
  let response;
  let outcome = "error";
  let errorClass;
  let usageInput;
  let usageOutput;
  let usageCacheRead;
  let usageCacheCreation;
  let responded = false;
  const emitResponse = () => {
    if (!ctx || responded)
      return;
    responded = true;
    const resPayload = {
      outcome,
      latency_ms: Date.now() - startTs,
      ...usageInput !== undefined ? { input_tokens: usageInput } : {},
      ...usageOutput !== undefined ? { output_tokens: usageOutput } : {},
      ...usageCacheRead !== undefined ? { cache_read_tokens: usageCacheRead } : {},
      ...usageCacheCreation !== undefined ? { cache_creation_tokens: usageCacheCreation } : {},
      ...errorClass ? { error_class: errorClass } : {}
    };
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.response",
      level: outcome === "success" ? "info" : "warn",
      payload: resPayload
    });
  };
  ctx?.registerLlmClose?.((oc) => {
    outcome = oc;
    errorClass ??= "interrupted";
    emitResponse();
  });
  try {
    const createArgs = {
      model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPart
            }
          ]
        }
      ]
    };
    if (systemPart.length > 0) {
      createArgs.system = [
        {
          type: "text",
          text: systemPart,
          cache_control: { type: "ephemeral" }
        }
      ];
    }
    response = await client.messages.create(createArgs, { timeout: timeoutMs, signal: controller.signal });
    outcome = "success";
    const u3 = response.usage;
    usageInput = u3?.input_tokens;
    usageOutput = u3?.output_tokens;
    usageCacheRead = u3?.cache_read_input_tokens;
    usageCacheCreation = u3?.cache_creation_input_tokens;
  } catch (e2) {
    if (e2 instanceof Anthropic.APIError) {
      errorClass = `APIError-${e2.status ?? "?"}`;
      emitResponse();
      throw new AnthropicSdkError(`Anthropic API error ${e2.status ?? "?"} for ${manifest.name}: ${e2.message}`, e2.status);
    }
    errorClass = e2 instanceof Error ? e2.name : "unknown";
    emitResponse();
    throw e2;
  }
  emitResponse();
  const textBlock = response.content.find((b2) => b2.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AnthropicSdkError(`no text block in response for ${manifest.name} (blocks: ${response.content.map((b2) => b2.type).join(", ")})`);
  }
  const yamlBody = extractYamlBody(textBlock.text);
  let data;
  try {
    data = load(yamlBody);
  } catch (e2) {
    throw new AnthropicSdkError(`SDK YAML parse failed for ${manifest.name}: ${String(e2).slice(0, 200)}`);
  }
  if (typeof data !== "object" || data === null) {
    throw new AnthropicSdkError(`SDK response YAML not an object for ${manifest.name}: got ${typeof data}`);
  }
  return data;
}
var AnthropicSdkError, DEFAULT_MODEL = "claude-opus-4-6", MAX_TOKENS_CAP = 8192;
var init_anthropic_sdk_agent = __esm(() => {
  init_js_yaml();
  init_sdk();
  init_claude_cli_agent();
  AnthropicSdkError = class AnthropicSdkError extends Error {
    status;
    constructor(message, status) {
      super(message);
      this.status = status;
      this.name = "AnthropicSdkError";
    }
  };
});

// src/dispatcher/openrouter-agent.ts
import { readFileSync as readFileSync11 } from "node:fs";
function noticeThirdPartyEgress(model) {
  if (egressNoticeShown)
    return;
  egressNoticeShown = true;
  console.error(`[sgc] OPENROUTER_API_KEY is set → subagents run on openrouter.ai (model: ${model}). ` + `Prompt content (your task text, code and diffs) is sent to that third party. ` + `Unset OPENROUTER_API_KEY, or set SGC_FORCE_INLINE=1, to keep everything local.`);
}
function extractYamlBlock(text) {
  const tagged = text.match(/```ya?ml\s*\n([\s\S]*?)```/);
  if (tagged)
    return tagged[1].trim();
  const generic = text.match(/```[^\n]*\n([\s\S]*?)```/);
  if (generic)
    return generic[1].trim();
  return text.split(`
`).filter((l2) => !/^\s*```/.test(l2)).join(`
`).trim();
}
async function runOpenRouterAgent(promptPath2, manifest, fetchFn, ctx) {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY not set");
  }
  const promptText = readFileSync11(promptPath2, "utf8");
  const { systemPart, userPart } = splitPrompt(promptText);
  const maxTokens = Math.min(manifest.token_budget ?? 4096, MAX_TOKENS_CAP2);
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000;
  const messages = [];
  if (systemPart.length > 0) {
    messages.push({ role: "system", content: systemPart });
  }
  messages.push({ role: "user", content: userPart });
  const model = process.env["SGC_OPENROUTER_MODEL"] ?? DEFAULT_MODEL2;
  noticeThirdPartyEgress(model);
  const body = {
    model,
    max_tokens: maxTokens,
    messages
  };
  if (ctx) {
    const reqPayload = {
      model,
      prompt_chars: promptText.length,
      cached_prefix_chars: systemPart.length > 0 ? systemPart.length : undefined,
      mode: "openrouter"
    };
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.request",
      level: "info",
      payload: reqPayload
    });
  }
  const doFetch = fetchFn ?? globalThis.fetch;
  const controller = new AbortController;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  ctx?.registerAbort?.(() => controller.abort());
  const startTs = Date.now();
  let outcome = "error";
  let errorClass;
  let usageInput;
  let usageOutput;
  let responded = false;
  const emitResponse = () => {
    if (!ctx || responded)
      return;
    responded = true;
    const resPayload = {
      outcome,
      latency_ms: Date.now() - startTs,
      ...usageInput !== undefined ? { input_tokens: usageInput } : {},
      ...usageOutput !== undefined ? { output_tokens: usageOutput } : {},
      ...errorClass ? { error_class: errorClass } : {}
    };
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.response",
      level: outcome === "success" ? "info" : "warn",
      payload: resPayload
    });
  };
  ctx?.registerLlmClose?.((oc) => {
    outcome = oc;
    errorClass ??= "interrupted";
    emitResponse();
  });
  let response;
  try {
    response = await doFetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/sdsrss/sgc",
        "X-Title": "sgc-dispatcher"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e2) {
    if (e2.name === "AbortError") {
      outcome = "timeout";
      errorClass = "AbortError";
      emitResponse();
      throw new OpenRouterError(`OpenRouter request timed out after ${timeoutMs}ms for ${manifest.name}`);
    }
    errorClass = e2?.name ?? "unknown";
    emitResponse();
    throw new OpenRouterError(`OpenRouter fetch failed for ${manifest.name}: ${e2.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    errorClass = `HTTPError-${response.status}`;
    emitResponse();
    const errorText = await response.text().catch(() => "(unreadable)");
    throw new OpenRouterError(`OpenRouter ${response.status} for ${manifest.name}: ${errorText.slice(0, 200)}`, response.status);
  }
  const json2 = await response.json();
  const content = json2?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    errorClass = "MissingContent";
    emitResponse();
    throw new OpenRouterError(`OpenRouter returned no content for ${manifest.name}: ${JSON.stringify(json2).slice(0, 200)}`);
  }
  const u3 = json2?.usage;
  usageInput = u3?.prompt_tokens;
  usageOutput = u3?.completion_tokens;
  outcome = "success";
  emitResponse();
  const yamlBody = extractYamlBlock(content);
  let data;
  try {
    data = load(yamlBody);
  } catch (e2) {
    throw new OpenRouterError(`OpenRouter YAML parse failed for ${manifest.name}: ${String(e2).slice(0, 200)}`);
  }
  if (typeof data !== "object" || data === null) {
    throw new OpenRouterError(`OpenRouter response YAML not an object for ${manifest.name}: got ${typeof data}`);
  }
  return data;
}
var OpenRouterError, OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions", DEFAULT_MODEL2 = "anthropic/claude-opus-4.7", MAX_TOKENS_CAP2 = 8192, egressNoticeShown = false;
var init_openrouter_agent = __esm(() => {
  init_js_yaml();
  init_anthropic_sdk_agent();
  OpenRouterError = class OpenRouterError extends Error {
    status;
    constructor(message, status) {
      super(message);
      this.status = status;
      this.name = "OpenRouterError";
    }
  };
});

// src/dispatcher/spawn.ts
import { existsSync as existsSync10, readFileSync as readFileSync12 } from "node:fs";
import { resolve as resolve11 } from "node:path";
function clampTimeout(rawMs) {
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, rawMs));
}
async function retryWithBackoff(fn, opts) {
  const sleep2 = opts.sleep ?? defaultSleep;
  const rng = opts.rng ?? Math.random;
  const base = opts.baseDelayMs ?? 1000;
  for (let attempt = 0;; attempt++) {
    try {
      return await fn();
    } catch (e2) {
      if (attempt < opts.maxRetries && opts.isRetryable(e2)) {
        const baseMs = Math.pow(2, attempt) * base;
        const jitter = baseMs * 0.2 * (2 * rng() - 1);
        await sleep2(Math.max(100, baseMs + jitter));
        continue;
      }
      throw e2;
    }
  }
}
function isTransientLlmError(e2) {
  const status = e2?.status;
  if (typeof status === "number") {
    if (status === 408 || status === 409 || status === 429 || status >= 500) {
      return true;
    }
    return false;
  }
  const name = e2?.name;
  if (name === "AbortError")
    return true;
  const msg = e2 instanceof Error ? e2.message : "";
  return /\b(timed out|exceeded \d+\s*ms|aborted|overloaded|too many requests|service unavailable|temporarily unavailable|rate[ _-]?limit(ed|ing)?)\b/i.test(msg);
}
function installSignalHandlersOnce() {
  if (signalHandlersInstalled)
    return;
  signalHandlersInstalled = true;
  const onSignal = (sig) => {
    drainOpenSpawnsForSignal(sig);
    const code = sig === "SIGINT" ? 130 : sig === "SIGTERM" ? 143 : 1;
    process.exit(code);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
}
function registerOpenSpawn(spawnId, agent, taskId, startTs, logger) {
  installSignalHandlersOnce();
  openSpawns.set(spawnId, { agent, taskId, startTs, logger });
}
function deregisterOpenSpawn(spawnId) {
  openSpawns.delete(spawnId);
}
function drainOpenSpawnsForSignal(signal) {
  for (const [spawnId, e2] of openSpawns) {
    try {
      e2.abort?.();
    } catch {}
    try {
      e2.llmClose?.("interrupted");
    } catch {}
    try {
      e2.logger.event({
        task_id: e2.taskId,
        spawn_id: spawnId,
        agent: e2.agent,
        event_type: "spawn.end",
        level: "warn",
        payload: {
          outcome: "interrupted",
          elapsed_ms: Date.now() - e2.startTs,
          signal
        }
      });
    } catch {}
  }
  openSpawns.clear();
}
function isReviewerOrQaAgent2(name) {
  return name.startsWith("reviewer.") || name.startsWith("qa.");
}
function checkInvariantOneBackChannel(agentName, input) {
  if (!isReviewerOrQaAgent2(agentName))
    return;
  if (typeof input !== "object" || input === null)
    return;
  const intent = input["intent"];
  if (typeof intent !== "string")
    return;
  if (PRIOR_ART_BACK_CHANNEL_RE.test(intent)) {
    throw new SpawnError(`Invariant §1 violation: agent ${agentName} intent input contains a "## Prior art (researcher.history)" back-channel heading — reviewers/qa must remain amnesiac to past solutions. Run stripBackChannelSections on intent.body before spawn (review.ts pattern).`);
  }
  if (PRE_MORTEM_BACK_CHANNEL_RE.test(intent)) {
    throw new SpawnError(`Invariant §1 violation: agent ${agentName} intent input contains a "## Pre-mortem (planner.adversarial)" back-channel heading — when CE-1 injects prior_preventions, planner.adversarial output may carry solution_ref strings that must not reach reviewers/qa. Run stripBackChannelSections on intent.body before spawn (review.ts pattern).`);
  }
}
function generateUlid() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function resolveMode(opts = {}, manifest) {
  for (const route of ROUTES) {
    const m2 = route.resolve(opts, manifest);
    if (m2)
      return m2;
  }
  return "file-poll";
}
function forbiddenTokensFor(agentName) {
  const spec = getCapabilities();
  const out = [];
  for (const [token, def] of Object.entries(spec.scope_tokens)) {
    if (!def.forbidden_for)
      continue;
    for (const pat of def.forbidden_for) {
      const re = pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      if (new RegExp(`^${re}$`).test(agentName)) {
        out.push(token);
        break;
      }
    }
  }
  return out;
}
function formatPrompt(spawnId, manifest, input, tokens, resultPath2) {
  if (manifest.prompt_path) {
    let template;
    try {
      template = readPrompt(manifest.prompt_path);
    } catch {
      throw new SpawnError(`prompt_path declared (${manifest.prompt_path}) but file does not exist for agent ${manifest.name}`);
    }
    if (!template.includes("<input_yaml/>")) {
      throw new SpawnError(`prompt_path ${manifest.prompt_path} missing <input_yaml/> placeholder for agent ${manifest.name}`);
    }
    if (!/(^|\r?\n)##[ \t]+Input[ \t]*\r?\n/.test(template)) {
      throw new SpawnError(`prompt_path ${manifest.prompt_path} missing '## Input' heading for agent ${manifest.name}`);
    }
    const inputYaml = dump(input).trimEnd();
    return template.replace("<input_yaml/>", inputYaml);
  }
  const forbidden = forbiddenTokensFor(manifest.name);
  const systemPrefix = `# Purpose

${manifest.purpose ?? "(no purpose declared)"}

` + `## Expected output

` + `\`\`\`yaml
${dump(manifest.outputs ?? {}).trimEnd()}
\`\`\`

` + `## Reply format

` + `Your response must be a YAML document whose frontmatter matches the \`Expected output\` schema above — exact keys, matching types (enum members, array shapes, string/number primitives). Extra fields are rejected by the dispatcher (Invariant §9).
`;
  const fm = {
    spawn_id: spawnId,
    agent: manifest.name,
    version: manifest.version,
    scope_tokens: tokens,
    forbidden_tokens: forbidden,
    timeout_s: manifest.timeout_s ?? 60
  };
  const inputBlock = `## Input

` + `${serializeFrontmatter(fm, "").trimEnd()}

` + `### Your scope (this call)

` + `You hold these pinned tokens: ${tokens.map((t2) => `\`${t2}\``).join(", ") || "(none)"}.
` + (forbidden.length > 0 ? `You are FORBIDDEN from: ${forbidden.map((t2) => `\`${t2}\``).join(", ")} (Invariant §1).
` : "") + `
### Task input

\`\`\`yaml
${dump(input).trimEnd()}
\`\`\`

` + `## Submit

` + `Write your YAML to: \`${resultPath2}\`

` + `Or use the helper:

` + `\`\`\`bash
` + `echo 'your YAML here' | bun src/sgc.ts agent-loop --submit ${spawnId}
` + `# or:
` + `bun src/sgc.ts agent-loop --submit ${spawnId} --from /path/to/result.yaml
` + `\`\`\`
`;
  return `${systemPrefix}
${inputBlock}`;
}
async function pollForResult(resultPath2, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync10(resultPath2)) {
      const text = readFileSync12(resultPath2, "utf8");
      const { data } = parseFrontmatter(text);
      return data;
    }
    await new Promise((r3) => setTimeout(r3, intervalMs));
  }
  throw new SpawnTimeout(resultPath2, timeoutMs);
}
async function spawn3(agentName, input, opts = {}) {
  const manifest = getSubagentManifest(agentName);
  if (!manifest) {
    throw new StateError("NotFound", `subagent manifest not found: ${agentName}`);
  }
  const tokens = computeSubagentTokens(agentName);
  checkInvariantOneBackChannel(agentName, input);
  ensureSgcStructure(opts.stateRoot);
  const stateRoot = root2(opts.stateRoot);
  const ulid = opts.ulid ?? generateUlid();
  const spawnId = `${ulid}-${agentName}`;
  const promptPath2 = promptPath(spawnId, stateRoot);
  const resultPath2 = resultPath(spawnId, stateRoot);
  writeAtomic(promptPath2, formatPrompt(spawnId, manifest, input, tokens, resultPath2));
  const mode = resolveMode(opts, manifest);
  if (mode === "file-poll" && process.env["CLAUDE_PLUGIN_ROOT"]) {
    throw new SpawnError(`Agent ${agentName}: file-poll mode is disabled inside Claude Code sessions ` + `(CLAUDE_PLUGIN_ROOT detected). Options: ` + `(1) unset SGC_USE_FILE_AGENTS to use inline/anthropic-sdk/openrouter modes; ` + `(2) set ANTHROPIC_API_KEY or OPENROUTER_API_KEY for direct LLM dispatch; ` + `(3) invoke the agent via Task("${agentName}", input) from your Claude session, ` + `then submit the YAML output via \`sgc agent-loop --submit ${spawnId} --from <file>\`. ` + `Prompt written to: ${promptPath2}`);
  }
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot });
  const startTs = Date.now();
  logger.event({
    task_id: opts.taskId ?? null,
    spawn_id: spawnId,
    agent: agentName,
    event_type: "spawn.start",
    level: "info",
    payload: { mode, manifest_version: manifest.version ?? "unknown" }
  });
  registerOpenSpawn(spawnId, agentName, opts.taskId ?? null, startTs, logger);
  let outcome = "error";
  try {
    if (opts.forceError) {
      throw opts.forceError;
    }
    let output;
    const llmRetry = {
      maxRetries: opts.llmMaxRetries ?? 2,
      isRetryable: isTransientLlmError,
      sleep: opts.sleep,
      rng: opts.rng
    };
    const llmCtx = {
      spawnId,
      taskId: opts.taskId ?? null,
      agentName,
      logger,
      registerAbort: (abort) => {
        const e2 = openSpawns.get(spawnId);
        if (e2)
          e2.abort = abort;
      },
      registerLlmClose: (close) => {
        const e2 = openSpawns.get(spawnId);
        if (e2)
          e2.llmClose = close;
      }
    };
    if (mode === "inline" && opts.inlineStub) {
      output = await opts.inlineStub(input);
      writeAtomic(resultPath2, serializeFrontmatter(output, ""));
    } else if (mode === "claude-cli") {
      output = await retryWithBackoff(() => runClaudeCliAgent(promptPath2, manifest, opts.claudeCliRunner, llmCtx), llmRetry);
      writeAtomic(resultPath2, serializeFrontmatter(output, ""));
    } else if (mode === "anthropic-sdk") {
      output = await retryWithBackoff(() => runAnthropicSdkAgent(promptPath2, manifest, opts.anthropicClientFactory, llmCtx), llmRetry);
      writeAtomic(resultPath2, serializeFrontmatter(output, ""));
    } else if (mode === "openrouter") {
      output = await retryWithBackoff(() => runOpenRouterAgent(promptPath2, manifest, opts.openRouterFetch, llmCtx), llmRetry);
      writeAtomic(resultPath2, serializeFrontmatter(output, ""));
    } else {
      const rawTimeoutMs = opts.timeoutMs ?? (manifest.timeout_s ?? 60) * 1000;
      const timeoutMs = clampTimeout(rawTimeoutMs);
      output = await retryWithBackoff(() => pollForResult(resultPath2, timeoutMs, opts.pollIntervalMs ?? 1000), {
        maxRetries: opts.maxRetries ?? 0,
        isRetryable: (e2) => e2 instanceof SpawnTimeout,
        sleep: opts.sleep,
        rng: opts.rng
      });
    }
    validateOutputShape(manifest, output);
    const leak = scanOutputForLeak(agentName, output, getFingerprintsCached(stateRoot));
    if (leak.hit) {
      throw new SpawnError(`Invariant §1 violation (output leak): agent ${agentName} output contains ${leak.count} line(s) matching solutions/ content. ` + `Sample(s): ${leak.samples.map((s2) => `"${s2}"`).join(", ")}. ` + `The LLM likely accessed solutions/ outside its pinned scope (§8). ` + `See sgc-invariants.md §1 + sgc-capabilities.yaml /review.solutions=[].`);
    }
    const bannedTerms = detectBannedVocab(JSON.stringify(output));
    if (bannedTerms.length > 0) {
      logger.event({
        task_id: opts.taskId ?? null,
        spawn_id: spawnId,
        agent: agentName,
        event_type: "output.banned_vocab",
        level: "warn",
        payload: { terms: bannedTerms.slice(0, 10), count: bannedTerms.length }
      });
    }
    outcome = "success";
    return { spawnId, output, promptPath: promptPath2, resultPath: resultPath2, mode };
  } catch (e2) {
    outcome = e2 instanceof SpawnTimeout ? "timeout" : "error";
    throw e2;
  } finally {
    logger.event({
      task_id: opts.taskId ?? null,
      spawn_id: spawnId,
      agent: agentName,
      event_type: "spawn.end",
      level: outcome === "success" ? "info" : "warn",
      payload: { outcome, elapsed_ms: Date.now() - startTs }
    });
    deregisterOpenSpawn(spawnId);
  }
}
var MIN_TIMEOUT_MS = 30000, MAX_TIMEOUT_MS = 300000, SpawnTimeout, defaultSleep = (ms) => new Promise((r3) => setTimeout(r3, ms)), openSpawns, signalHandlersInstalled = false, SpawnError, PRIOR_ART_SENTINEL_BEGIN = "<!-- sgc:prior-art:begin -->", PRIOR_ART_SENTINEL_END = "<!-- sgc:prior-art:end -->", PRE_MORTEM_SENTINEL_BEGIN = "<!-- sgc:pre-mortem:begin -->", PRE_MORTEM_SENTINEL_END = "<!-- sgc:pre-mortem:end -->", PRIOR_ART_BACK_CHANNEL_RE, PRE_MORTEM_BACK_CHANNEL_RE, root2 = (custom) => resolve11(custom ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"), VALID_ENV_MODES, ROUTES;
var init_spawn = __esm(() => {
  init_js_yaml();
  init_capabilities();
  init_schema();
  init_state();
  init_spawn_protocol();
  init_validation();
  init_fingerprint();
  init_claude_cli_agent();
  init_subprocess();
  init_anthropic_sdk_agent();
  init_openrouter_agent();
  init_logger();
  init_embedded_data();
  init_validation();
  SpawnTimeout = class SpawnTimeout extends Error {
    constructor(spawnId, timeoutMs) {
      super(`spawn ${spawnId} timed out waiting for result after ${timeoutMs}ms`);
      this.name = "SpawnTimeout";
    }
  };
  openSpawns = new Map;
  SpawnError = class SpawnError extends Error {
    constructor(message) {
      super(message);
      this.name = "SpawnError";
    }
  };
  PRIOR_ART_BACK_CHANNEL_RE = /(^|\n)[ \t]*(<!--[ \t]*sgc:prior-art:begin[ \t]*-->|## Prior art \(researcher\.history\))/;
  PRE_MORTEM_BACK_CHANNEL_RE = /(^|\n)[ \t]*(<!--[ \t]*sgc:pre-mortem:begin[ \t]*-->|## Pre-mortem \(planner\.adversarial\))/;
  VALID_ENV_MODES = new Set([
    "inline",
    "file-poll",
    "claude-cli",
    "anthropic-sdk",
    "openrouter"
  ]);
  ROUTES = [
    {
      reason: "explicit opts.mode (tests + programmatic embedding)",
      resolve: (opts) => opts.mode ?? null
    },
    {
      reason: "SGC_AGENT_MODE env override",
      resolve: () => {
        const m2 = process.env["SGC_AGENT_MODE"];
        return m2 && VALID_ENV_MODES.has(m2) ? m2 : null;
      }
    },
    {
      reason: "SGC_USE_FILE_AGENTS=1 (legacy alias for file-poll)",
      resolve: () => process.env["SGC_USE_FILE_AGENTS"] === "1" ? "file-poll" : null
    },
    {
      reason: "SGC_FORCE_INLINE=1 test escape (forces stubs regardless of keys)",
      resolve: (opts) => process.env["SGC_FORCE_INLINE"] === "1" && opts.inlineStub ? "inline" : null
    },
    {
      reason: "manifest.prompt_path + ANTHROPIC_API_KEY → anthropic-sdk",
      resolve: (_opts, m2) => m2?.prompt_path && process.env["ANTHROPIC_API_KEY"] ? "anthropic-sdk" : null
    },
    {
      reason: "manifest.prompt_path + OPENROUTER_API_KEY → openrouter",
      resolve: (_opts, m2) => m2?.prompt_path && process.env["OPENROUTER_API_KEY"] ? "openrouter" : null
    },
    {
      reason: "inline-stub fallback for templateless agents",
      resolve: (opts) => opts.inlineStub ? "inline" : null
    },
    {
      reason: "ANTHROPIC_API_KEY catch-all (templateless agents without stub)",
      resolve: () => process.env["ANTHROPIC_API_KEY"] ? "anthropic-sdk" : null
    },
    {
      reason: "OPENROUTER_API_KEY catch-all",
      resolve: () => process.env["OPENROUTER_API_KEY"] ? "openrouter" : null
    },
    {
      reason: "`claude` CLI in PATH (subscription-friendly)",
      resolve: (opts) => {
        const hasCli = opts.hasClaudeCli ?? (() => whichSync("claude") !== null);
        return hasCli() ? "claude-cli" : null;
      }
    },
    {
      reason: "default file-poll",
      resolve: () => "file-poll"
    }
  ];
});

// src/dispatcher/agents/clarifier-discover.ts
function clarifierDiscoverHeuristic(input) {
  const topic = (input.topic ?? "").trim();
  if (topic.length === 0) {
    throw new Error("clarifier.discover: topic is required");
  }
  const goal = `When "${topic}" is done, what can the user do that they can't do today?`;
  const constraints = [
    "Are there performance requirements (latency, throughput, data volume)?",
    "What platforms / browsers / runtimes must this support?",
    "Is there a deadline or release window this is blocking?"
  ];
  if (AUTH_RE.test(topic)) {
    constraints.push("What's the threat model — who is trusted, who isn't, and what's the blast radius of a bypass?");
  }
  if (DATA_RE.test(topic)) {
    constraints.push("What's the rollback plan if the schema change is wrong after deploy (additive-safe vs. backfill-required)?");
  }
  if (PERF_RE.test(topic)) {
    constraints.push("What's the current baseline number and the target, with a measurement method?");
  }
  const scope = [
    "What is explicitly OUT of scope — the closest adjacent feature we are NOT building?",
    "Does this replace existing behavior, or add alongside it?"
  ];
  if (API_RE.test(topic)) {
    scope.push("Is this a breaking change to any consumer, or purely additive (new endpoint / optional field / new status)?");
  }
  if (UI_RE.test(topic)) {
    scope.push("Does this touch an existing screen, or introduce a new route / entry point?");
  }
  const edges = [
    "What happens if the input is empty, malformed, or enormous?",
    "What happens under concurrent access — two users / tabs / requests at once?",
    "What's the failure mode if a dependency (network, DB, third-party) is down?"
  ];
  if (AUTH_RE.test(topic)) {
    edges.push("What happens if a token is expired / revoked / forged mid-request?");
  }
  const acceptance = [
    "What test or observation proves this works — a specific command, URL, or log line?",
    "What's the smallest user-visible change that would tell us it's done?"
  ];
  if (UI_RE.test(topic) || API_RE.test(topic)) {
    acceptance.push("Is there a screenshot, curl invocation, or integration test that would serve as evidence?");
  }
  if (input.template === "product") {
    scope.push("Who hurts today without this — and what do they do instead?", "What's the narrowest wedge — the single first user who would adopt this and refuse to give it up?");
    acceptance.push("Are early users willing to pay (in money, time, or attention) — and what's the lightest signal that proves it?");
  } else if (input.template === "scope") {
    scope.push("What's the smallest version that delivers any user-visible value — and what gets cut to reach it?", "Where is the cut-line — what changes from in-scope to out-of-scope if 30% of the budget were removed?");
    constraints.push("If the deadline halved, which features drop first (and which stay)?");
  } else if (input.template === "anti-pattern") {
    edges.push("How will this regress under load you haven't tested — and what's the silent-failure mode that bypasses your test?", "If this regresses silently in production, how would you find out — and what's the failure-mode oracle?");
    constraints.push("What's the rollback path if the first version is fundamentally wrong — code revert, data revert, or user-comms?");
  }
  const contextNote = input.current_task_summary.trim().length > 0 ? ` (active task: ${input.current_task_summary.trim()})` : "";
  return {
    topic,
    goal_question: goal,
    constraint_questions: constraints,
    scope_questions: scope,
    edge_case_questions: edges,
    acceptance_questions: acceptance,
    suggested_next: `sgc plan "${topic}" --motivation "<your consolidated answers as one paragraph, ≥20 words>"${contextNote}`
  };
}
var DISCOVER_TEMPLATES, AUTH_RE, DATA_RE, UI_RE, PERF_RE, API_RE, clarifierDiscover;
var init_clarifier_discover2 = __esm(() => {
  DISCOVER_TEMPLATES = ["product", "scope", "anti-pattern"];
  AUTH_RE = /\b(auth|login|token|session|jwt|oauth|permission|role)\b/i;
  DATA_RE = /\b(migration|schema|column|table|sql|database|backfill|index)\b/i;
  UI_RE = /\b(ui|page|component|form|modal|dropdown|button|layout|render)\b/i;
  PERF_RE = /\b(slow|fast|latency|throughput|cache|p95|p99|benchmark|optimi[sz]e)\b/i;
  API_RE = /\b(api|endpoint|route|request|response|webhook|rpc)\b/i;
  clarifierDiscover = clarifierDiscoverHeuristic;
});

// src/commands/discover.ts
var exports_discover = {};
__export(exports_discover, {
  runDiscover: () => runDiscover
});
function summarizeActiveTask(stateRoot) {
  try {
    const ct = readCurrentTask(stateRoot);
    if (!ct)
      return "";
    return `${ct.task.task_id} (${ct.task.level})`;
  } catch {
    return "";
  }
}
function renderQuestions(out, log) {
  log(`topic: ${out.topic}`);
  log("");
  log(`Goal:`);
  log(`  ${out.goal_question}`);
  log("");
  const sections = [
    ["Constraints:", out.constraint_questions],
    ["Scope:", out.scope_questions],
    ["Edge cases:", out.edge_case_questions],
    ["Acceptance:", out.acceptance_questions]
  ];
  for (const [header, qs] of sections) {
    if (qs.length === 0)
      continue;
    log(header);
    for (const q2 of qs)
      log(`  - ${q2}`);
    log("");
  }
  log(`Next:`);
  log(`  ${out.suggested_next}`);
}
async function runDiscover(opts) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot = opts.stateRoot;
  const topic = (opts.topic ?? "").trim();
  if (topic.length === 0) {
    throw new Error('topic required — usage: sgc discover "<what do you want to clarify>"');
  }
  let template;
  if (opts.template !== undefined) {
    if (!DISCOVER_TEMPLATES.includes(opts.template)) {
      throw new Error(`unknown template: '${opts.template}'. valid: ${DISCOVER_TEMPLATES.join(", ")}`);
    }
    template = opts.template;
  }
  const current_task_summary = summarizeActiveTask(stateRoot);
  const r3 = await spawn3("clarifier.discover", { topic, current_task_summary, ...template ? { template } : {} }, {
    stateRoot,
    inlineStub: (i2) => clarifierDiscover(i2),
    logger,
    taskId: undefined
  });
  renderQuestions(r3.output, log);
  return r3.output;
}
var init_discover = __esm(() => {
  init_spawn();
  init_clarifier_discover2();
  init_state();
  init_logger();
});

// src/dispatcher/plan-jobs.ts
var exports_plan_jobs = {};
__export(exports_plan_jobs, {
  showJob: () => showJob,
  listJobs: () => listJobs,
  forkAsyncPlanJob: () => forkAsyncPlanJob,
  failPlanJob: () => failPlanJob,
  emitAsyncStart: () => emitAsyncStart,
  completePlanJob: () => completePlanJob,
  PlanJobError: () => PlanJobError
});
import {
  closeSync,
  existsSync as existsSync11,
  openSync,
  readdirSync as readdirSync5,
  readFileSync as readFileSync13,
  writeFileSync as writeFileSync3
} from "node:fs";
import { mkdir as mkdir2 } from "node:fs/promises";
import { spawn as nodeSpawn } from "node:child_process";
import { resolve as resolve12 } from "node:path";
function generateUlid2() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function defaultIsAlive2(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e2) {
    if (e2 && typeof e2 === "object" && "code" in e2) {
      const code = e2.code;
      if (code === "ESRCH")
        return false;
    }
    return true;
  }
}
function getSgcEntry() {
  return process.argv[1] ?? "";
}
function defaultSpawnImpl(argv2, opts) {
  const [cmd, ...rest] = argv2;
  if (!cmd)
    throw new Error("forkAsyncPlanJob: argv[0] missing");
  const proc = nodeSpawn(cmd, rest, {
    stdio: ["ignore", opts.logFd, opts.logFd],
    detached: true,
    env: opts.env
  });
  proc.unref();
  return { pid: proc.pid ?? -1 };
}
function jobsDir(stateRoot) {
  return resolve12(resolveStateRoot(stateRoot), "plan-jobs");
}
function jobPath(stateRoot, jobId) {
  return resolve12(jobsDir(stateRoot), `${jobId}.md`);
}
function forkLockPath(stateRoot) {
  return resolve12(jobsDir(stateRoot), ".fork.lock");
}
function logPathFor(stateRoot, jobId) {
  return resolve12(jobsDir(stateRoot), `${jobId}.log`);
}
function doneSentinel(stateRoot, jobId) {
  return resolve12(jobsDir(stateRoot), `${jobId}.done`);
}
function failedSentinel(stateRoot, jobId) {
  return resolve12(jobsDir(stateRoot), `${jobId}.failed`);
}
function readJob(path2) {
  let text;
  try {
    text = readFileSync13(path2, "utf8");
  } catch (err) {
    throw new PlanJobError("MalformedJobFile", `plan-job file unreadable at ${path2}: ${err.message}`, { path: path2 });
  }
  try {
    const { data } = parseFrontmatter(text);
    return data;
  } catch (err) {
    throw new PlanJobError("MalformedJobFile", `plan-job file unparseable at ${path2}: ${err.message}`, { path: path2 });
  }
}
function writeJob(path2, job) {
  const content = serializeFrontmatter(job, "");
  writeAtomic(path2, content);
}
function listJobsRaw(stateRoot) {
  const dir = jobsDir(stateRoot);
  if (!existsSync11(dir))
    return [];
  const out = [];
  for (const fn of readdirSync5(dir)) {
    if (!fn.endsWith(".md"))
      continue;
    try {
      out.push(readJob(resolve12(dir, fn)));
    } catch {}
  }
  return out;
}
function applyStaleProbe(job, stateRoot, isAlive) {
  if (job.status !== "running")
    return job;
  if (isAlive(job.pid))
    return job;
  const updated = { ...job, status: "stale" };
  writeJob(jobPath(stateRoot, job.job_id), updated);
  return updated;
}
async function forkAsyncPlanJob(task, opts = {}) {
  const stateRoot = opts.stateRoot;
  const now = opts.now ?? Date.now;
  const ulid = opts.ulid ?? generateUlid2;
  const isAlive = opts.isAlive ?? defaultIsAlive2;
  const spawnImpl = opts.spawnImpl ?? defaultSpawnImpl;
  await mkdir2(jobsDir(stateRoot), { recursive: true });
  let releaseLock;
  try {
    releaseLock = acquireFileLock(forkLockPath(stateRoot), { isAlive });
  } catch (err) {
    if (err instanceof LockHeldError) {
      throw new PlanJobError("ConcurrentJobActive", `another plan fork is in progress (holder pid=${err.holderPid}). Retry once it completes.`, { active_pid: err.holderPid });
    }
    throw err;
  }
  try {
    return await claimAndFork(task, stateRoot, { now, ulid, isAlive, spawnImpl, extraEnv: opts.extraEnv });
  } finally {
    releaseLock();
  }
}
async function claimAndFork(task, stateRoot, { now, ulid, isAlive, spawnImpl, extraEnv }) {
  for (const prior of listJobsRaw(stateRoot)) {
    if (prior.status === "running") {
      if (isAlive(prior.pid)) {
        throw new PlanJobError("ConcurrentJobActive", `another plan job is running (job_id=${prior.job_id}, pid=${prior.pid}). Tail with: sgc plan --status ${prior.job_id}`, { active_job_id: prior.job_id, active_pid: prior.pid });
      }
      writeJob(jobPath(stateRoot, prior.job_id), {
        ...prior,
        status: "stale"
      });
    }
  }
  const job_id = ulid();
  const log_path = logPathFor(stateRoot, job_id);
  const job_path = jobPath(stateRoot, job_id);
  const logFd = openSync(log_path, "a", 420);
  const env2 = {};
  for (const k2 of Object.keys(process.env)) {
    const v2 = process.env[k2];
    if (v2 !== undefined)
      env2[k2] = v2;
  }
  env2["SGC_PLAN_ASYNC_CHILD"] = job_id;
  env2["SGC_STATE_ROOT"] = resolveStateRoot(stateRoot);
  if (extraEnv) {
    for (const [k2, v2] of Object.entries(extraEnv))
      env2[k2] = v2;
  }
  const argv2 = [process.execPath, getSgcEntry(), "plan", task];
  try {
    const { pid } = spawnImpl(argv2, { logFd, env: env2 });
    const job = {
      job_id,
      task,
      started_at: new Date(now()).toISOString(),
      pid,
      log_path,
      status: "running"
    };
    writeJob(job_path, job);
    return { job, jobPath: job_path };
  } finally {
    try {
      closeSync(logFd);
    } catch {}
  }
}
async function listJobs(opts = {}) {
  const isAlive = opts.isAlive ?? defaultIsAlive2;
  const raw = listJobsRaw(opts.stateRoot);
  const probed = raw.map((j) => applyStaleProbe(j, opts.stateRoot, isAlive));
  probed.sort((a2, b2) => b2.started_at.localeCompare(a2.started_at));
  return probed;
}
async function showJob(jobId, opts = {}) {
  const path2 = jobPath(opts.stateRoot, jobId);
  if (!existsSync11(path2)) {
    throw new PlanJobError("JobNotFound", `plan-jobs/${jobId}.md not found under ${resolveStateRoot(opts.stateRoot)}`, { job_id: jobId });
  }
  const raw = readJob(path2);
  const isAlive = opts.isAlive ?? defaultIsAlive2;
  const job = applyStaleProbe(raw, opts.stateRoot, isAlive);
  let logTail = "";
  if (existsSync11(job.log_path)) {
    const text = readFileSync13(job.log_path, "utf8");
    const lines = text.split(`
`);
    if (lines.length > 0 && lines[lines.length - 1] === "")
      lines.pop();
    const n2 = opts.logTailLines ?? 100;
    logTail = lines.length === 0 ? "" : lines.slice(-n2).join(`
`) + `
`;
  }
  return { job, logTail };
}
async function completePlanJob(jobId, completion, opts = {}) {
  const path2 = jobPath(opts.stateRoot, jobId);
  if (!existsSync11(path2)) {
    throw new PlanJobError("JobNotFound", `plan-jobs/${jobId}.md not found`);
  }
  const job = readJob(path2);
  const now = opts.now ?? Date.now;
  const updated = {
    ...job,
    status: "done",
    completed_at: new Date(now()).toISOString()
  };
  if (completion.taskId)
    updated.task_id = completion.taskId;
  if (completion.level)
    updated.level = completion.level;
  if (completion.intentPath)
    updated.intent_path = completion.intentPath;
  writeJob(path2, updated);
  writeFileSync3(doneSentinel(opts.stateRoot, jobId), "", "utf8");
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot });
  logger.event({
    task_id: completion.taskId ?? null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_complete",
    level: "info",
    payload: {
      job_id: jobId,
      task_id: completion.taskId ?? null,
      level: completion.level ?? null,
      intent_path: completion.intentPath ?? null
    }
  });
}
async function failPlanJob(jobId, error2, opts = {}) {
  const path2 = jobPath(opts.stateRoot, jobId);
  if (!existsSync11(path2)) {
    throw new PlanJobError("JobNotFound", `plan-jobs/${jobId}.md not found`);
  }
  const job = readJob(path2);
  const now = opts.now ?? Date.now;
  const updated = {
    ...job,
    status: "failed",
    completed_at: new Date(now()).toISOString(),
    error: error2
  };
  writeJob(path2, updated);
  writeFileSync3(failedSentinel(opts.stateRoot, jobId), "", "utf8");
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot });
  logger.event({
    task_id: null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_failed",
    level: "error",
    payload: { job_id: jobId, error: error2 }
  });
}
function emitAsyncStart(jobId, task, logger, payload = {}) {
  logger.event({
    task_id: null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_start",
    level: "info",
    payload: { job_id: jobId, task, ...payload }
  });
}
var PlanJobError;
var init_plan_jobs = __esm(() => {
  init_state();
  init_logger();
  init_file_lock();
  PlanJobError = class PlanJobError extends Error {
    code;
    detail;
    constructor(code, message, detail) {
      super(message);
      this.name = "PlanJobError";
      this.code = code;
      this.detail = detail;
    }
  };
});

// src/dispatcher/agents/classifier-level.ts
function classifierLevelHeuristic(input) {
  const req = input.user_request;
  if (STRONG_L0.some((re) => re.test(req))) {
    return {
      level: "L0",
      rationale: "request is an unambiguous trivial edit (typo/spelling/variable-rename); fast-path despite any incidental API/schema keyword",
      affected_readers_candidates: ["dispatcher"]
    };
  }
  if (L3_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L3",
      rationale: "request mentions architecture/migration/infra keywords; minimum L3 per HARD escalation rule",
      affected_readers_candidates: ["dispatcher", "future maintainers"]
    };
  }
  if (L2_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L2",
      rationale: "request involves public API/auth/payment surface; minimum L2 per HARD escalation rule",
      affected_readers_candidates: ["dispatcher", "downstream callers"]
    };
  }
  if (SECURITY_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L2",
      rationale: "request touches security/auth surface (login/credential/oauth/vuln/rate-limit); minimum L2 so the change gets independent review + qa gate",
      affected_readers_candidates: ["dispatcher", "downstream callers", "security reviewers"]
    };
  }
  if (ARCHITECTURAL_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L2",
      rationale: "request uses restructuring / cross-cutting language (rework/restructure/across-modules/data-flow) with no explicit keyword; minimum L2 so the review + qa cluster runs on an architectural change the keyword sets miss (B4/F5)",
      affected_readers_candidates: ["dispatcher", "downstream callers"]
    };
  }
  if (L0_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L0",
      rationale: "request is a trivial text-only change (typo/format/comment); fast-path",
      affected_readers_candidates: ["dispatcher"]
    };
  }
  return {
    level: "L1",
    rationale: "default classification — single-file or simple change with no keyword hits for L0/L2/L3",
    affected_readers_candidates: ["dispatcher"]
  };
}
function applyHeuristicFloor(llm, input) {
  const floor = classifierLevelHeuristic(input);
  if (LEVEL_RANK[llm.level] >= LEVEL_RANK[floor.level])
    return llm;
  return {
    level: floor.level,
    rationale: `${floor.rationale} [deterministic heuristic floor raised ${llm.level} → ${floor.level}; ` + `LLM verdict was: ${llm.rationale}]`,
    affected_readers_candidates: [
      ...new Set([...floor.affected_readers_candidates, ...llm.affected_readers_candidates])
    ]
  };
}
var L3_KEYWORDS, L2_KEYWORDS, SECURITY_KEYWORDS, ARCHITECTURAL_KEYWORDS, STRONG_L0, L0_KEYWORDS, classifierLevel, LEVEL_RANK;
var init_classifier_level2 = __esm(() => {
  L3_KEYWORDS = [
    /\bmigration\b/i,
    /\bschema\b/i,
    /\bDROP\b|\bALTER\b|\bCREATE TABLE\b/,
    /\binfra(structure)?\b/i,
    /\bdeploy(ment)?\b/i,
    /\barchitect(ure)?\b/i
  ];
  L2_KEYWORDS = [
    /\bAPI\b/,
    /\bauth(entication|orization)?\b/i,
    /\bpayment\b/i,
    /\bcrypto\b|\bjwt\b|\btoken\b|\bsession\b/i,
    /\bmulti[- ]file\b/i,
    /\brefactor\b/i
  ];
  SECURITY_KEYWORDS = [
    /\blog[- ]?in\b|\bsign[- ]?in\b|\bsign[- ]?up\b|\bsignup\b|\bsignin\b/i,
    /\bpassword\b|\bpasswd\b|\bcredentials?\b/i,
    /\boauth\b|\bopenid\b|\bsaml\b|\bsso\b/i,
    /\b2fa\b|\bmfa\b|\botp\b/i,
    /\bcsrf\b|\bxss\b|\binjection\b|\bvulnerabilit(y|ies)\b|\bexploit\b/i,
    /\brate[- ]?limit(ing|ed|er|s)?\b|\bthrottl(e|ing|ed)\b/i
  ];
  ARCHITECTURAL_KEYWORDS = [
    /\b(rework|restructure|overhaul|revamp|re-?wire|re-?architect|re-?design)\b/i,
    /\bacross\b[^.]{0,30}\b(modules?|components?|stages?|services?|packages?|subsystems?|layers?|boundaries)\b/i,
    /\b(data|control)[- ]?flow\b/i,
    /\bhow\b[^.]{0,45}\b(hand|pass|flow|move|route|thread)\w*\b[^.]{0,25}\bbetween\b/i
  ];
  STRONG_L0 = [
    /\btypos?\b/i,
    /\b(misspelling|spelling)\b/i,
    /\brename\b[^.]{0,40}\bvariable\b/i
  ];
  L0_KEYWORDS = [
    /\btypos?\b/i,
    /\b(misspelling|spelling)\b/i,
    /\breformat(ting)?\b/i,
    /\bformatting\b/i,
    /\bwhitespace\b/i,
    /\bindentation\b/i,
    /\bcode comments?\b/i,
    /\bdocstrings?\b/i,
    /\brename (a |the )?(local )?variable\b/i,
    /^(fix|update) (a |the )?(typo|formatting|comment|whitespace|spelling|docstring)/i
  ];
  classifierLevel = classifierLevelHeuristic;
  LEVEL_RANK = { L0: 0, L1: 1, L2: 2, L3: 3 };
});

// src/dispatcher/agents/planner-eng.ts
function plannerEngHeuristic(input) {
  const len = input.intent_draft.length;
  return {
    verdict: "approve",
    concerns: len < 20 ? ["intent_draft is very short; consider clarifying motivation"] : [],
    structural_risks: []
  };
}
var plannerEng;
var init_planner_eng2 = __esm(() => {
  plannerEng = plannerEngHeuristic;
});

// src/dispatcher/agents/planner-ceo.ts
function plannerCeoHeuristic(input) {
  const draft = input.intent_draft ?? "";
  const concerns = [];
  const rewrite_hints = [];
  if (draft.trim().length < 50) {
    concerns.push("intent is short; business context may not be clear to later reviewers");
    rewrite_hints.push("expand the motivation to describe user impact and a success metric");
  }
  if (!AUDIENCE_RE.test(draft)) {
    rewrite_hints.push("name the affected audience (users, team, downstream callers, customers)");
  }
  return {
    verdict: "approve",
    concerns,
    rewrite_hints
  };
}
var AUDIENCE_RE, plannerCeo;
var init_planner_ceo2 = __esm(() => {
  AUDIENCE_RE = /\b(user|customer|team|downstream|caller|reader|stakeholder|impact|metric|outcome|revenue|latency|adoption|retention)\b/i;
  plannerCeo = plannerCeoHeuristic;
});

// src/dispatcher/agents/planner-adversarial.ts
function plannerAdversarialHeuristic(input) {
  const draft = input.intent_draft ?? "";
  const matched = [];
  for (const pattern of RISK_PATTERNS) {
    if (pattern.re.test(draft)) {
      matched.push(pattern.mode);
    }
  }
  if (matched.length === 0) {
    matched.push(DEFAULT_FAILURE_MODE);
  }
  return { failure_modes: matched };
}
var RISK_PATTERNS, DEFAULT_FAILURE_MODE, plannerAdversarial;
var init_planner_adversarial2 = __esm(() => {
  RISK_PATTERNS = [
    {
      re: /\b(migration|ALTER|DROP|CREATE TABLE|schema)\b/i,
      mode: {
        scenario: "data loss or corruption from a migration script that misbehaves on real data",
        probability: "medium",
        impact: "high",
        early_signal: "schema check fails on pre-merge dry-run; backup snapshot size drops sharply"
      }
    },
    {
      re: /\b(auth|authentication|authorization|jwt|token|session|crypto)\b/i,
      mode: {
        scenario: "auth bypass or session fixation if a new code path skips an existing check",
        probability: "medium",
        impact: "high",
        early_signal: "integration test that drives /login end-to-end fails or skips a step"
      }
    },
    {
      re: /\b(infra|infrastructure|deploy|deployment|prod|production|k8s|terraform|docker)\b/i,
      mode: {
        scenario: "production outage if the change is shipped without staging validation",
        probability: "low",
        impact: "high",
        early_signal: "canary metrics (error rate, p99 latency) diverge from baseline on first rollout"
      }
    },
    {
      re: /\b(architecture|refactor|rename|cross[- ]module)\b/i,
      mode: {
        scenario: "ripple effect across downstream consumers that haven't been audited",
        probability: "medium",
        impact: "medium",
        early_signal: "grep for the renamed/moved symbol returns import sites that weren't in the plan"
      }
    },
    {
      re: /\b(payment|billing|charge|stripe|subscription)\b/i,
      mode: {
        scenario: "user is charged incorrectly or a transaction is double-processed",
        probability: "low",
        impact: "high",
        early_signal: "idempotency test or billing-event de-dupe test regresses"
      }
    }
  ];
  DEFAULT_FAILURE_MODE = {
    scenario: "insufficient test coverage masks a behavioral change; the bug ships because the regression test did not fire",
    probability: "medium",
    impact: "medium",
    early_signal: "coverage drops below baseline or reviewer.tests flags missing edge-case tests"
  };
  plannerAdversarial = plannerAdversarialHeuristic;
});

// src/dispatcher/agents/planner-decompose.ts
function plannerDecomposeHeuristic(input) {
  const title = (input.intent_draft ?? "").trim().slice(0, 200) || "implement the task";
  const steps = [
    { kind: "test", text: `Write a failing test for: ${title}` },
    { kind: "verify-red", text: "Run the test and confirm it fails", run: "bun test", expect: "FAIL" },
    { kind: "implement", text: "Write the minimal implementation to make the test pass" },
    { kind: "verify-green", text: "Run the test and confirm it passes", run: "bun test", expect: "PASS" }
  ];
  for (const fm of input.failure_modes ?? []) {
    steps.push({
      kind: "guard",
      text: `Guard against prior failure mode: ${fm.scenario}. Early signal: ${fm.early_signal}`
    });
  }
  for (const p of input.prior_preventions ?? []) {
    steps.push({
      kind: "guard",
      text: `Apply prevention from ${p.solution_ref}: ${p.prevention_text}`
    });
  }
  steps.push({ kind: "commit", text: "Commit the change", run: 'git commit -m "<conventional message>"' });
  const prior_art_refs = (input.prior_art ?? []).map((p) => p.solution_ref);
  return {
    tasks: [{ id: "f1", title, files: { create: [], modify: [], test: [] }, steps, prior_art_refs }]
  };
}
var plannerDecompose;
var init_planner_decompose2 = __esm(() => {
  plannerDecompose = plannerDecomposeHeuristic;
});

// src/dispatcher/plan-render.ts
function renderPlanMarkdown(list, intent) {
  const out = [];
  out.push(`# ${intent.title} Implementation Plan`);
  out.push("");
  out.push("> **For agentic workers:** REQUIRED SUB-SKILL: Use " + "superpowers:subagent-driven-development (recommended) or " + "superpowers:executing-plans to implement this plan task-by-task. " + "Steps use checkbox (`- [ ]`) syntax for tracking.");
  out.push("");
  out.push(`**Level:** ${intent.level}`);
  out.push("");
  out.push("---");
  out.push("");
  let taskNo = 1;
  for (const f3 of list.features) {
    out.push(`### Task ${taskNo}: ${f3.title}`);
    out.push("");
    if (f3.files) {
      out.push("**Files:**");
      for (const p of f3.files.create)
        out.push(`- Create: \`${p}\``);
      for (const p of f3.files.modify)
        out.push(`- Modify: \`${p}\``);
      for (const p of f3.files.test)
        out.push(`- Test: \`${p}\``);
      out.push("");
    }
    if (f3.prior_art_refs && f3.prior_art_refs.length > 0) {
      out.push(`**Prior art (reused):** ${f3.prior_art_refs.map((r3) => `\`${r3}\``).join(", ")}`);
      out.push("");
    }
    let stepNo = 1;
    for (const s2 of f3.steps ?? []) {
      out.push(`- [ ] **Step ${stepNo} (${s2.kind}):** ${s2.text}`);
      if (s2.run)
        out.push(`  - Run: \`${s2.run}\``);
      if (s2.expect)
        out.push(`  - Expected: ${s2.expect}`);
      stepNo++;
    }
    out.push("");
    taskNo++;
  }
  return out.join(`
`);
}

// src/dispatcher/preventions.ts
function truncateOnWordBoundary(text, maxChars) {
  if (text.length <= maxChars)
    return text;
  const limit = maxChars - 3;
  const lastSpace = text.lastIndexOf(" ", limit);
  const cutAt = lastSpace > Math.floor(limit / 2) ? lastSpace : limit;
  return text.slice(0, cutAt).trimEnd() + "...";
}
function clamp(n2, lo, hi) {
  return Math.max(lo, Math.min(hi, n2));
}
function sanitizePreventionText(text) {
  let out = text;
  for (const re of INJECTION_PATTERNS)
    out = out.replace(re, " ");
  return out.replace(/\s+/g, " ").trim();
}
function emitSkip(logger, taskId, solutionRef, reason) {
  if (!logger)
    return;
  logger.event({
    task_id: taskId ?? null,
    spawn_id: null,
    agent: "plan.preventions",
    event_type: "prevention.skipped",
    level: "warn",
    payload: { solution_ref: solutionRef, reason }
  });
}
async function extractPreventions(intentDraft, stateRoot, opts = {}) {
  const root3 = resolveStateRoot(stateRoot);
  const topN = clamp(opts.topN ?? DEFAULT_TOP_N, MIN_TOP_N, MAX_TOP_N);
  const maxChars = clamp(opts.maxCharsPerText ?? DEFAULT_MAX_CHARS, MIN_MAX_CHARS, MAX_MAX_CHARS);
  const keywords = extractKeywords(intentDraft ?? "");
  if (keywords.length === 0)
    return [];
  const scans = await walkSolutionsCorpus(root3, keywords);
  const scored = [];
  for (const scan of scans) {
    const solutionRef = `${scan.category}/${scan.slug}`;
    let parsed;
    try {
      parsed = parseFrontmatter(scan.text);
    } catch {
      emitSkip(opts.logger, opts.taskId, solutionRef, "frontmatter_parse_failed");
      continue;
    }
    const raw = parsed.data["prevention"];
    if (typeof raw !== "string") {
      emitSkip(opts.logger, opts.taskId, solutionRef, "prevention_field_missing");
      continue;
    }
    const folded = raw.replace(/\s+/g, " ").trim();
    if (folded.length === 0) {
      emitSkip(opts.logger, opts.taskId, solutionRef, "prevention_field_empty");
      continue;
    }
    const sanitized = sanitizePreventionText(folded);
    if (sanitized !== folded) {
      opts.logger?.event({
        task_id: opts.taskId ?? null,
        spawn_id: null,
        agent: "plan.preventions",
        event_type: "prevention.sanitized",
        level: "warn",
        payload: { solution_ref: solutionRef, removed_chars: folded.length - sanitized.length }
      });
    }
    if (sanitized.length === 0) {
      emitSkip(opts.logger, opts.taskId, solutionRef, "prevention_field_empty");
      continue;
    }
    scored.push({ scan, text: truncateOnWordBoundary(sanitized, maxChars) });
  }
  scored.sort((a2, b2) => b2.scan.hits - a2.scan.hits);
  return scored.slice(0, topN).map((s2) => ({
    solution_ref: `${s2.scan.category}/${s2.scan.slug}`,
    category: s2.scan.category,
    prevention_text: s2.text
  }));
}
var DEFAULT_TOP_N = 3, DEFAULT_MAX_CHARS = 240, MIN_TOP_N = 1, MAX_TOP_N = 10, MIN_MAX_CHARS = 40, MAX_MAX_CHARS = 1000, INJECTION_PATTERNS;
var init_preventions = __esm(() => {
  init_researcher_history();
  init_state();
  INJECTION_PATTERNS = [
    /<\|[^|]*\|>/g,
    /<\/?\s*(?:system|assistant|user|tool|instructions?)\s*>/gi,
    /\[\/?\s*INST\s*\]/gi,
    /\u0000/g
  ];
});

// src/dispatcher/applied-tracker.ts
import { existsSync as existsSync12, readFileSync as readFileSync14, statSync as statSync3 } from "node:fs";
function selectSurfacedRefs(prior_art, floor = SURFACED_RELEVANCE_FLOOR) {
  return Array.from(new Set(prior_art.filter((p) => p.relevance_score >= floor).map((p) => p.solution_ref)));
}
function extractAppliedSolutionRefs(failure_modes, prior_preventions) {
  if (failure_modes.length === 0 || prior_preventions.length === 0)
    return [];
  const MIN_SLUG_MATCH_LEN = 8;
  const refs = new Set;
  for (const fm of failure_modes) {
    const signal = fm.early_signal ?? "";
    if (signal.length === 0)
      continue;
    for (const pp of prior_preventions) {
      const slug = pp.solution_ref.split("/")[1] ?? "";
      const slugMatch = slug.length >= MIN_SLUG_MATCH_LEN && signal.includes(slug);
      if (signal.includes(pp.solution_ref) || slugMatch)
        refs.add(pp.solution_ref);
    }
  }
  return Array.from(refs);
}
function recordInto(field, eventAgent, stateRoot, solution_refs, task_id, opts) {
  const result = {
    updated: [],
    skipped_already_applied: [],
    skipped_missing: [],
    skipped_malformed: [],
    stale_skipped: [],
    write_failed: []
  };
  for (const ref of solution_refs) {
    recordOne(ref, task_id, stateRoot, opts, result, field, eventAgent);
  }
  return result;
}
function recordApplied(stateRoot, solution_refs, task_id, opts = {}) {
  return recordInto("applied_in", "plan.applied", stateRoot, solution_refs, task_id, opts);
}
function recordSurfaced(stateRoot, solution_refs, task_id, opts = {}) {
  return recordInto("surfaced_in", "plan.surfaced", stateRoot, solution_refs, task_id, opts);
}
function recordOne(ref, task_id, stateRoot, opts, result, field, eventAgent) {
  if (!SOLUTION_REF_RE.test(ref)) {
    result.skipped_malformed.push(ref);
    emitFailed(opts, task_id, ref, "malformed_ref", "ref shape rejected by SOLUTION_REF_RE", eventAgent);
    return;
  }
  const [category, slug] = ref.split("/");
  const filePath = solutionPath(category, slug, stateRoot);
  if (!existsSync12(filePath)) {
    result.skipped_missing.push(ref);
    return;
  }
  for (let attempt = 0;attempt <= MAX_MTIME_RETRIES; attempt++) {
    const mtimeBefore = statSync3(filePath).mtimeMs;
    let parsed;
    try {
      parsed = parseFrontmatter(readFileSync14(filePath, "utf8"));
    } catch (err) {
      result.skipped_malformed.push(ref);
      emitFailed(opts, task_id, ref, "parse_failed", err instanceof Error ? err.message : String(err), eventAgent);
      return;
    }
    const existing = parsed.data[field] ?? [];
    if (existing.includes(task_id)) {
      result.skipped_already_applied.push(ref);
      return;
    }
    const nextEntry = {
      ...parsed.data,
      [field]: [...existing, task_id]
    };
    const mtimeReread = statSync3(filePath).mtimeMs;
    if (mtimeReread !== mtimeBefore) {
      if (attempt === MAX_MTIME_RETRIES) {
        result.stale_skipped.push(ref);
        emitFailed(opts, task_id, ref, "stale_mtime_after_retry", "mtime drift after retry", eventAgent);
        return;
      }
      continue;
    }
    try {
      writeAtomic(filePath, serializeFrontmatter(nextEntry, parsed.body));
      result.updated.push(ref);
      return;
    } catch (err) {
      emitFailed(opts, task_id, ref, "io_error", err instanceof Error ? err.message : String(err), eventAgent);
      result.write_failed.push(ref);
      return;
    }
  }
}
function emitFailed(opts, task_id, solution_ref, reason, error_message, eventAgent) {
  opts.logger?.event({
    task_id,
    spawn_id: null,
    agent: eventAgent,
    event_type: `${eventAgent}_failed`,
    level: "warn",
    payload: { solution_ref, reason, error_message }
  });
}
var SOLUTION_REF_RE, MAX_MTIME_RETRIES = 1, SURFACED_RELEVANCE_FLOOR = 0.5;
var init_applied_tracker = __esm(() => {
  init_state();
  SOLUTION_REF_RE = /^[a-z0-9_]+\/[a-zA-Z0-9._-]+$/;
});

// src/dispatcher/rationale.ts
function rationaleIsConcrete(rationale) {
  if (typeof rationale !== "string" || rationale.trim().length === 0)
    return false;
  return KEYWORD_RE.test(rationale) || FILE_EXT_RE.test(rationale) || PATH_RE.test(rationale) || LINE_NUM_RE.test(rationale) || LEVEL_RE.test(rationale) || COUNT_RE.test(rationale);
}
function validateClassifierRationale(rationale) {
  if (!rationaleIsConcrete(rationale)) {
    throw new ClassifierRationaleTooGeneric(rationale);
  }
}
var ClassifierRationaleTooGeneric, CONCRETE_KEYWORDS, KEYWORD_RE, FILE_EXT_RE, PATH_RE, LINE_NUM_RE, LEVEL_RE, COUNT_RE;
var init_rationale = __esm(() => {
  ClassifierRationaleTooGeneric = class ClassifierRationaleTooGeneric extends Error {
    constructor(rationale) {
      super(`classifier rationale too generic (Invariant §11): "${rationale.slice(0, 120)}". ` + `Must reference at least one concrete feature — a filename (e.g. ` + `foo.ts, plan/SKILL.md), line number (:42), level (L0/L1/L2/L3), ` + `risk keyword (auth, schema, migration, typo, format, API, ...), or ` + `blast radius ("3 files").`);
      this.name = "ClassifierRationaleTooGeneric";
    }
  };
  CONCRETE_KEYWORDS = [
    "file",
    "function",
    "test",
    "class",
    "method",
    "module",
    "path",
    "field",
    "column",
    "endpoint",
    "route",
    "query",
    "hook",
    "event",
    "flag",
    "config",
    "manifest",
    "contract",
    "schema",
    "typo",
    "format",
    "comment",
    "docstring",
    "whitespace",
    "rename",
    "refactor",
    "API",
    "auth",
    "authentication",
    "authorization",
    "payment",
    "crypto",
    "jwt",
    "token",
    "session",
    "migration",
    "ALTER",
    "DROP",
    "infra",
    "infrastructure",
    "deploy",
    "architecture",
    "security",
    "dispatcher",
    "classifier",
    "planner",
    "reviewer",
    "qa",
    "ship",
    "compound",
    "janitor",
    "invariant",
    "scope",
    "permission",
    "error",
    "exception",
    "timeout",
    "cache",
    "index",
    "lock",
    "branch",
    "null",
    "undefined",
    "race"
  ];
  KEYWORD_RE = new RegExp(`\\b(${CONCRETE_KEYWORDS.join("|")})\\b`, "i");
  FILE_EXT_RE = /\b[\w-]+\.(ts|tsx|js|jsx|mjs|cjs|md|json|ya?ml|yml|py|go|rs|sh|bash|toml|lock|txt|css|scss|html|sql)\b/i;
  PATH_RE = /\b[\w-]+\/[\w./-]+/;
  LINE_NUM_RE = /[A-Za-z_)]:\d+\b/;
  LEVEL_RE = /\bL[0-3]\b/;
  COUNT_RE = /\b\d+\s*(files?|lines?|tests?|commits?|modules?|functions?)\b/i;
});

// src/dispatcher/delegation.ts
import { existsSync as existsSync13, readFileSync as readFileSync15 } from "node:fs";
import { homedir } from "node:os";
import { resolve as resolve13 } from "node:path";
function parsePluginSet(installedJson) {
  try {
    const data = JSON.parse(installedJson);
    const keys = Object.keys(data.plugins ?? {});
    const has = (q2) => keys.some((k2) => k2 === q2 || k2.startsWith(`${q2}@`));
    return {
      superpowers: has("superpowers"),
      codeGraphMcp: has("code-graph-mcp"),
      claudeMemLite: has("claude-mem-lite"),
      frontendDesign: has("frontend-design")
    };
  } catch {
    return { ...EMPTY_PLUGIN_SET };
  }
}
function detectInstalledPlugins() {
  if (cached)
    return cached;
  const path2 = process.env["SGC_PLUGIN_REGISTRY"] ?? resolve13(homedir(), ".claude/plugins/installed_plugins.json");
  if (!existsSync13(path2)) {
    cached = { ...EMPTY_PLUGIN_SET };
    return cached;
  }
  try {
    cached = parsePluginSet(readFileSync15(path2, "utf8"));
  } catch {
    cached = { ...EMPTY_PLUGIN_SET };
  }
  return cached;
}
function delegationHintsFor(context, plugins = detectInstalledPlugins()) {
  const hints = [];
  switch (context) {
    case "plan.adversarial":
      if (plugins.superpowers) {
        hints.push({
          agent: "planner.adversarial",
          recommended: "/superpowers:dispatching-parallel-agents",
          reason: "sgc runs the L3 pre-mortem fan-out natively; sp's parallel-agent contract is an optional richer orchestration if you've installed it"
        });
      }
      break;
    case "plan.researcher":
      if (plugins.codeGraphMcp) {
        hints.push({
          agent: "researcher.history",
          recommended: "/code-graph-mcp:impact-analysis on touched symbols",
          reason: "code-graph's blast-radius narrows researcher's candidate space before the LLM rerank"
        });
      }
      if (plugins.claudeMemLite) {
        hints.push({
          agent: "researcher.history",
          recommended: "mem_recall(file=<touched-file>)",
          reason: "claude-mem-lite's bugfix-lesson layer is orthogonal to .sgc/solutions/ — complementary signal at the dispatch boundary"
        });
      }
      break;
    case "review.cluster":
      if (plugins.superpowers) {
        hints.push({
          agent: "reviewer.correctness",
          recommended: "/superpowers:requesting-code-review",
          reason: "sgc Invariant §1 already enforces author/reviewer context separation natively; sp's review contract is an optional richer path if installed"
        });
      }
      if (plugins.codeGraphMcp) {
        hints.push({
          agent: "reviewer.correctness",
          recommended: "/code-graph-mcp:impact-analysis on changed symbols",
          reason: "for L2+ multi-file changes, surface the call graph before reviewer.correctness focuses on local logic"
        });
      }
      break;
    case "ship.pr":
      break;
  }
  return hints;
}
function formatHint(hint) {
  return `(hint) ${hint.agent}: consider ${hint.recommended} — ${hint.reason}`;
}
var EMPTY_PLUGIN_SET, cached = null;
var init_delegation = __esm(() => {
  EMPTY_PLUGIN_SET = Object.freeze({
    superpowers: false,
    codeGraphMcp: false,
    claudeMemLite: false,
    frontendDesign: false
  });
});

// src/dispatcher/fuse-plan.ts
function normVerdict(v2) {
  return Object.prototype.hasOwnProperty.call(PLAN_VERDICT_RANK, v2) ? v2 : "reject";
}
function worstPlanVerdict(a2, b2) {
  const na = normVerdict(a2);
  const nb = normVerdict(b2);
  return PLAN_VERDICT_RANK[na] >= PLAN_VERDICT_RANK[nb] ? na : nb;
}
function collectConcerns(input) {
  const out = [];
  if (input.ceo) {
    for (const c3 of input.ceo.concerns)
      out.push({ source: "ceo", text: c3, severity: "medium", _key: c3 });
  }
  for (const c3 of input.eng.concerns)
    out.push({ source: "eng", text: c3, severity: "medium", _key: c3 });
  for (const r3 of input.eng.structural_risks) {
    out.push({
      source: "eng.structural_risk",
      text: `${r3.area}: ${r3.risk} (mitigation: ${r3.mitigation})`,
      severity: "high",
      _key: r3.risk
    });
  }
  if (input.adversarial) {
    for (const m2 of input.adversarial.failure_modes) {
      const text = `[${m2.probability}/${m2.impact}] ${m2.scenario} — early signal: ${m2.early_signal}`;
      out.push({ source: "adversarial", text, severity: m2.impact, _key: m2.scenario });
    }
  }
  return out;
}
function addFlaggedBy(existing, add, representative) {
  const set2 = new Set([...existing ?? [], add]);
  set2.delete(representative);
  return [...set2];
}
function dedupeConcerns(concerns) {
  const kept = [];
  for (const c3 of concerns) {
    const cTokens = tokenize(c3._key);
    let merged = false;
    for (const k2 of kept) {
      if (featureOverlap(cTokens, tokenize(k2._key)) >= DEDUP_THRESHOLD) {
        if (SEVERITY_RANK[c3.severity] > SEVERITY_RANK[k2.severity]) {
          k2.also_flagged_by = addFlaggedBy(k2.also_flagged_by, k2.source, c3.source);
          k2.severity = c3.severity;
          k2.text = c3.text;
          k2.source = c3.source;
        } else {
          k2.also_flagged_by = addFlaggedBy(k2.also_flagged_by, c3.source, k2.source);
        }
        merged = true;
        break;
      }
    }
    if (!merged)
      kept.push({ ...c3 });
  }
  return kept.map(({ _key: _k, ...pub }) => pub);
}
function rankConcerns(concerns) {
  return [...concerns].sort((a2, b2) => {
    const sev = SEVERITY_RANK[b2.severity] - SEVERITY_RANK[a2.severity];
    if (sev !== 0)
      return sev;
    return SOURCE_ORDER[a2.source] - SOURCE_ORDER[b2.source];
  });
}
function hasHighHighFailure(adversarial) {
  if (!adversarial)
    return false;
  return adversarial.failure_modes.some((m2) => m2.probability === "high" && m2.impact === "high");
}
function fusePlan(input) {
  const ceoV = input.ceo?.verdict;
  const engV = input.eng.verdict;
  let base = ceoV ? worstPlanVerdict(ceoV, engV) : engV;
  const conflicts = [];
  if (ceoV && ceoV !== engV)
    conflicts.push(`ceo=${ceoV} vs eng=${engV}`);
  let basis;
  if (hasHighHighFailure(input.adversarial) && base === "approve") {
    base = "revise";
    basis = "high/high pre-mortem risk floors approve → revise";
    conflicts.push(ceoV ? "adversarial high/high risk overrode unanimous approve" : "adversarial high/high risk overrode eng=approve");
  } else if (ceoV && ceoV !== engV) {
    basis = `${base} dominates (ceo=${ceoV}, eng=${engV})`;
  } else {
    basis = base === "approve" ? "all perspectives approve" : `consensus ${base}`;
  }
  const ranked = rankConcerns(dedupeConcerns(collectConcerns(input)));
  return { fused_verdict: base, decision_basis: basis, ranked_concerns: ranked, conflicts };
}
function renderFusedSection(d2) {
  const lines = ["## Fused decision", ""];
  lines.push(`**Verdict:** ${d2.fused_verdict}`);
  lines.push(`**Basis:** ${d2.decision_basis}`);
  lines.push("");
  if (d2.conflicts.length > 0) {
    lines.push("### Conflicts", "");
    for (const c3 of d2.conflicts)
      lines.push(`- ${c3}`);
    lines.push("");
  }
  if (d2.ranked_concerns.length > 0) {
    lines.push("### Ranked concerns", "");
    for (const c3 of d2.ranked_concerns) {
      const also = c3.also_flagged_by?.length ? ` (also flagged by ${c3.also_flagged_by.join(", ")})` : "";
      lines.push(`- [${c3.severity}] (${c3.source}) ${c3.text}${also}`);
    }
    lines.push("");
  }
  return lines.join(`
`);
}
var PLAN_VERDICT_RANK, SEVERITY_RANK, SOURCE_ORDER;
var init_fuse_plan = __esm(() => {
  init_dedup();
  PLAN_VERDICT_RANK = {
    approve: 0,
    revise: 1,
    reject: 2
  };
  SEVERITY_RANK = { high: 2, medium: 1, low: 0 };
  SOURCE_ORDER = {
    "eng.structural_risk": 0,
    adversarial: 1,
    eng: 2,
    ceo: 3
  };
});

// src/dispatcher/plan-jobs.ts
import {
  closeSync as closeSync2,
  existsSync as existsSync14,
  openSync as openSync2,
  readdirSync as readdirSync6,
  readFileSync as readFileSync16,
  writeFileSync as writeFileSync4
} from "node:fs";
import { mkdir as mkdir3 } from "node:fs/promises";
import { spawn as nodeSpawn2 } from "node:child_process";
import { resolve as resolve14 } from "node:path";
function generateUlid3() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function defaultIsAlive3(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e2) {
    if (e2 && typeof e2 === "object" && "code" in e2) {
      const code = e2.code;
      if (code === "ESRCH")
        return false;
    }
    return true;
  }
}
function getSgcEntry2() {
  return process.argv[1] ?? "";
}
function defaultSpawnImpl2(argv2, opts) {
  const [cmd, ...rest] = argv2;
  if (!cmd)
    throw new Error("forkAsyncPlanJob: argv[0] missing");
  const proc = nodeSpawn2(cmd, rest, {
    stdio: ["ignore", opts.logFd, opts.logFd],
    detached: true,
    env: opts.env
  });
  proc.unref();
  return { pid: proc.pid ?? -1 };
}
function jobsDir2(stateRoot) {
  return resolve14(resolveStateRoot(stateRoot), "plan-jobs");
}
function jobPath2(stateRoot, jobId) {
  return resolve14(jobsDir2(stateRoot), `${jobId}.md`);
}
function forkLockPath2(stateRoot) {
  return resolve14(jobsDir2(stateRoot), ".fork.lock");
}
function logPathFor2(stateRoot, jobId) {
  return resolve14(jobsDir2(stateRoot), `${jobId}.log`);
}
function doneSentinel2(stateRoot, jobId) {
  return resolve14(jobsDir2(stateRoot), `${jobId}.done`);
}
function failedSentinel2(stateRoot, jobId) {
  return resolve14(jobsDir2(stateRoot), `${jobId}.failed`);
}
function readJob2(path2) {
  let text;
  try {
    text = readFileSync16(path2, "utf8");
  } catch (err) {
    throw new PlanJobError2("MalformedJobFile", `plan-job file unreadable at ${path2}: ${err.message}`, { path: path2 });
  }
  try {
    const { data } = parseFrontmatter(text);
    return data;
  } catch (err) {
    throw new PlanJobError2("MalformedJobFile", `plan-job file unparseable at ${path2}: ${err.message}`, { path: path2 });
  }
}
function writeJob2(path2, job) {
  const content = serializeFrontmatter(job, "");
  writeAtomic(path2, content);
}
function listJobsRaw2(stateRoot) {
  const dir = jobsDir2(stateRoot);
  if (!existsSync14(dir))
    return [];
  const out = [];
  for (const fn of readdirSync6(dir)) {
    if (!fn.endsWith(".md"))
      continue;
    try {
      out.push(readJob2(resolve14(dir, fn)));
    } catch {}
  }
  return out;
}
function applyStaleProbe2(job, stateRoot, isAlive) {
  if (job.status !== "running")
    return job;
  if (isAlive(job.pid))
    return job;
  const updated = { ...job, status: "stale" };
  writeJob2(jobPath2(stateRoot, job.job_id), updated);
  return updated;
}
async function forkAsyncPlanJob2(task, opts = {}) {
  const stateRoot = opts.stateRoot;
  const now = opts.now ?? Date.now;
  const ulid = opts.ulid ?? generateUlid3;
  const isAlive = opts.isAlive ?? defaultIsAlive3;
  const spawnImpl = opts.spawnImpl ?? defaultSpawnImpl2;
  await mkdir3(jobsDir2(stateRoot), { recursive: true });
  let releaseLock;
  try {
    releaseLock = acquireFileLock(forkLockPath2(stateRoot), { isAlive });
  } catch (err) {
    if (err instanceof LockHeldError) {
      throw new PlanJobError2("ConcurrentJobActive", `another plan fork is in progress (holder pid=${err.holderPid}). Retry once it completes.`, { active_pid: err.holderPid });
    }
    throw err;
  }
  try {
    return await claimAndFork2(task, stateRoot, { now, ulid, isAlive, spawnImpl, extraEnv: opts.extraEnv });
  } finally {
    releaseLock();
  }
}
async function claimAndFork2(task, stateRoot, { now, ulid, isAlive, spawnImpl, extraEnv }) {
  for (const prior of listJobsRaw2(stateRoot)) {
    if (prior.status === "running") {
      if (isAlive(prior.pid)) {
        throw new PlanJobError2("ConcurrentJobActive", `another plan job is running (job_id=${prior.job_id}, pid=${prior.pid}). Tail with: sgc plan --status ${prior.job_id}`, { active_job_id: prior.job_id, active_pid: prior.pid });
      }
      writeJob2(jobPath2(stateRoot, prior.job_id), {
        ...prior,
        status: "stale"
      });
    }
  }
  const job_id = ulid();
  const log_path = logPathFor2(stateRoot, job_id);
  const job_path = jobPath2(stateRoot, job_id);
  const logFd = openSync2(log_path, "a", 420);
  const env2 = {};
  for (const k2 of Object.keys(process.env)) {
    const v2 = process.env[k2];
    if (v2 !== undefined)
      env2[k2] = v2;
  }
  env2["SGC_PLAN_ASYNC_CHILD"] = job_id;
  env2["SGC_STATE_ROOT"] = resolveStateRoot(stateRoot);
  if (extraEnv) {
    for (const [k2, v2] of Object.entries(extraEnv))
      env2[k2] = v2;
  }
  const argv2 = [process.execPath, getSgcEntry2(), "plan", task];
  try {
    const { pid } = spawnImpl(argv2, { logFd, env: env2 });
    const job = {
      job_id,
      task,
      started_at: new Date(now()).toISOString(),
      pid,
      log_path,
      status: "running"
    };
    writeJob2(job_path, job);
    return { job, jobPath: job_path };
  } finally {
    try {
      closeSync2(logFd);
    } catch {}
  }
}
async function listJobs2(opts = {}) {
  const isAlive = opts.isAlive ?? defaultIsAlive3;
  const raw = listJobsRaw2(opts.stateRoot);
  const probed = raw.map((j) => applyStaleProbe2(j, opts.stateRoot, isAlive));
  probed.sort((a2, b2) => b2.started_at.localeCompare(a2.started_at));
  return probed;
}
async function completePlanJob2(jobId, completion, opts = {}) {
  const path2 = jobPath2(opts.stateRoot, jobId);
  if (!existsSync14(path2)) {
    throw new PlanJobError2("JobNotFound", `plan-jobs/${jobId}.md not found`);
  }
  const job = readJob2(path2);
  const now = opts.now ?? Date.now;
  const updated = {
    ...job,
    status: "done",
    completed_at: new Date(now()).toISOString()
  };
  if (completion.taskId)
    updated.task_id = completion.taskId;
  if (completion.level)
    updated.level = completion.level;
  if (completion.intentPath)
    updated.intent_path = completion.intentPath;
  writeJob2(path2, updated);
  writeFileSync4(doneSentinel2(opts.stateRoot, jobId), "", "utf8");
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot });
  logger.event({
    task_id: completion.taskId ?? null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_complete",
    level: "info",
    payload: {
      job_id: jobId,
      task_id: completion.taskId ?? null,
      level: completion.level ?? null,
      intent_path: completion.intentPath ?? null
    }
  });
}
async function failPlanJob2(jobId, error2, opts = {}) {
  const path2 = jobPath2(opts.stateRoot, jobId);
  if (!existsSync14(path2)) {
    throw new PlanJobError2("JobNotFound", `plan-jobs/${jobId}.md not found`);
  }
  const job = readJob2(path2);
  const now = opts.now ?? Date.now;
  const updated = {
    ...job,
    status: "failed",
    completed_at: new Date(now()).toISOString(),
    error: error2
  };
  writeJob2(path2, updated);
  writeFileSync4(failedSentinel2(opts.stateRoot, jobId), "", "utf8");
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot });
  logger.event({
    task_id: null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_failed",
    level: "error",
    payload: { job_id: jobId, error: error2 }
  });
}
function emitAsyncStart2(jobId, task, logger, payload = {}) {
  logger.event({
    task_id: null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_start",
    level: "info",
    payload: { job_id: jobId, task, ...payload }
  });
}
var PlanJobError2;
var init_plan_jobs2 = __esm(() => {
  init_state();
  init_logger();
  init_file_lock();
  PlanJobError2 = class PlanJobError2 extends Error {
    code;
    detail;
    constructor(code, message, detail) {
      super(message);
      this.name = "PlanJobError";
      this.code = code;
      this.detail = detail;
    }
  };
});

// src/commands/plan.ts
var exports_plan = {};
__export(exports_plan, {
  runPlan: () => runPlan,
  degradedEngOutput: () => degradedEngOutput,
  degradedCeoOutput: () => degradedCeoOutput,
  _readLineSyncForFutureInteractiveFlow: () => readLineSync
});
function generateTaskId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function nowIso() {
  return new Date().toISOString();
}
async function readLineSync() {
  const stdin2 = process.stdin;
  return new Promise((resolve15) => {
    stdin2.resume();
    stdin2.setEncoding("utf8");
    let buf = "";
    const onData = (chunk) => {
      buf += chunk;
      const nl = buf.indexOf(`
`);
      if (nl !== -1) {
        stdin2.removeListener("data", onData);
        stdin2.pause();
        resolve15(buf.slice(0, nl).trim());
      }
    };
    stdin2.on("data", onData);
  });
}
async function defaultReadConfirmation() {
  return readLineSync();
}
async function runPlan(taskDescription, opts = {}) {
  const asyncChildJobId = process.env["SGC_PLAN_ASYNC_CHILD"];
  if (opts.async && !asyncChildJobId) {
    const parentLogger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
    const childOpts = {};
    if (opts.forceLevel !== undefined)
      childOpts.forceLevel = opts.forceLevel;
    if (opts.userSignature !== undefined)
      childOpts.userSignature = opts.userSignature;
    if (opts.motivation !== undefined)
      childOpts.motivation = opts.motivation;
    if (opts.autoConfirm !== undefined)
      childOpts.autoConfirm = opts.autoConfirm;
    if (opts.forceNewTask !== undefined)
      childOpts.forceNewTask = opts.forceNewTask;
    const fork = await forkAsyncPlanJob2(taskDescription, {
      stateRoot: opts.stateRoot,
      extraEnv: { SGC_PLAN_CHILD_OPTS: JSON.stringify(childOpts) }
    });
    emitAsyncStart2(fork.job.job_id, taskDescription, parentLogger, {
      pid: fork.job.pid,
      log_path: fork.job.log_path
    });
    process.stderr.write(`async plan job ${fork.job.job_id} (pid=${fork.job.pid})
`);
    process.stderr.write(`  task:    ${taskDescription}
`);
    process.stderr.write(`  log:     ${fork.job.log_path}
`);
    process.stderr.write(`  watch:   sgc plan --status ${fork.job.job_id}
`);
    process.stderr.write(`  events:  sgc tail --event-type plan.async_start,plan.async_complete,plan.async_failed --follow
`);
    return {
      taskId: fork.job.job_id,
      intentPath: fork.jobPath
    };
  }
  if (asyncChildJobId) {
    let childMerged = opts;
    const rawChildOpts = process.env["SGC_PLAN_CHILD_OPTS"];
    if (rawChildOpts) {
      try {
        const parsed = JSON.parse(rawChildOpts);
        childMerged = { ...opts, ...parsed, async: false };
      } catch {}
    }
    try {
      const result = await runPlanCore(taskDescription, childMerged);
      await completePlanJob2(asyncChildJobId, {
        taskId: result.taskId,
        level: result.level,
        intentPath: result.intentPath
      }, { stateRoot: opts.stateRoot, logger: opts.logger });
      return result;
    } catch (err) {
      await failPlanJob2(asyncChildJobId, err instanceof Error ? err.message : String(err), { stateRoot: opts.stateRoot, logger: opts.logger });
      throw err;
    }
  }
  return runPlanCore(taskDescription, opts);
}
function planEvalLabel(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/\s+/g, " ").slice(0, 120);
}
function emitPlannerFailed(agent, err, logger, taskId) {
  logger.event({
    task_id: taskId,
    spawn_id: null,
    agent,
    event_type: "planner.spawn_failed",
    level: "warn",
    payload: {
      error_class: err instanceof Error ? err.name : "unknown",
      error_message: planEvalLabel(err)
    }
  });
}
function degradedEngOutput(err, logger, taskId) {
  emitPlannerFailed("planner.eng", err, logger, taskId);
  return {
    verdict: "revise",
    concerns: [`planner.eng could not be evaluated (${planEvalLabel(err)}) — treat as needs-review`],
    structural_risks: []
  };
}
function degradedCeoOutput(err, logger, taskId) {
  emitPlannerFailed("planner.ceo", err, logger, taskId);
  return {
    verdict: "revise",
    concerns: [`planner.ceo could not be evaluated (${planEvalLabel(err)}) — treat as needs-review`],
    rewrite_hints: []
  };
}
async function runPlanCore(taskDescription, opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot = opts.stateRoot;
  ensureSgcStructure(stateRoot);
  const existingHandoff = readHandoff(stateRoot);
  if (existingHandoff) {
    const { handoff: handoff2 } = existingHandoff;
    const isCompleted = handoff2.to_session_hint === "next task" || handoff2.summary?.includes("shipped") || handoff2.summary?.includes("Ready for next task");
    if (!isCompleted && !opts.forceNewTask) {
      log(`Active task detected in handoff: ${handoff2.from_session}.
` + `Summary: ${handoff2.summary}
` + `Pass --force-new-task to start a new task anyway.`);
      throw new Error(`active task in handoff.md — complete it or pass --force-new-task`);
    }
  }
  const taskId = generateTaskId();
  const createdAt = nowIso();
  log(`task_id = ${taskId}`);
  const classRes = await spawn3("classifier.level", { user_request: taskDescription }, {
    stateRoot,
    inlineStub: (i2) => opts.classifierOverride ?? classifierLevel(i2),
    logger,
    taskId
  });
  validateClassifierRationale(classRes.output.rationale);
  const classified = applyHeuristicFloor(classRes.output, { user_request: taskDescription });
  if (classified.level !== classRes.output.level) {
    log(`classifier verdict ${classRes.output.level} raised to ${classified.level} ` + `by the deterministic heuristic floor (HARD escalation rule)`);
  }
  let level = classified.level;
  log(`classifier verdict: ${level} — ${classified.rationale}`);
  if (opts.forceLevel) {
    if (LEVEL_RANK[opts.forceLevel] < LEVEL_RANK[level]) {
      throw new Error(`forceLevel ${opts.forceLevel} would downgrade ${level} — refused (upgrade-only rule)`);
    }
    level = opts.forceLevel;
    log(`level overridden to ${level} (upgrade)`);
  }
  const motivation = opts.motivation ?? taskDescription;
  if (level !== "L0") {
    const motivationWords = wordCount(motivation);
    if (motivationWords < 20) {
      throw new Error(`motivation must be ≥20 words (sgc-state.schema.yaml min_words rule); ` + `got ${motivationWords} word(s). Re-run with ` + `--motivation "<longer rationale describing why this matters and what changes>".`);
    }
  }
  let plannerEngOut = null;
  let plannerCeoOut = null;
  let researcherOut = null;
  let adversarialOut = null;
  let capturedPriorPreventions = [];
  if (LEVEL_RANK[level] >= 2) {
    for (const hint of delegationHintsFor("plan.researcher"))
      log(formatHint(hint));
    if (level === "L3") {
      for (const hint of delegationHintsFor("plan.adversarial"))
        log(formatHint(hint));
    }
    const tasks = [
      (async () => {
        try {
          return await spawn3("planner.eng", { intent_draft: taskDescription }, { stateRoot, inlineStub: (i2) => plannerEng(i2), logger, taskId });
        } catch (err) {
          return { output: degradedEngOutput(err, logger, taskId) };
        }
      })(),
      (async () => {
        try {
          return await spawn3("planner.ceo", { intent_draft: taskDescription }, { stateRoot, inlineStub: (i2) => plannerCeo(i2), logger, taskId });
        } catch (err) {
          return { output: degradedCeoOutput(err, logger, taskId) };
        }
      })(),
      (async () => {
        const candidates = await preFilterSolutions(taskDescription, stateRoot);
        if (candidates.length === 0) {
          return {
            output: {
              prior_art: [],
              warnings: ["no candidates from pre-filter"]
            }
          };
        }
        try {
          const r3 = await spawn3("researcher.history", { intent_draft: taskDescription, candidates }, {
            stateRoot,
            inlineStub: (i2) => researcherHistory(i2, { stateRoot }),
            logger,
            taskId
          });
          return { output: coerceLlmOutput(r3.output, candidates) };
        } catch (err) {
          return { output: handleCoerceFailure(err, logger, taskId) };
        }
      })()
    ];
    if (level === "L3") {
      tasks.push((async () => {
        let priorPreventions = [];
        try {
          priorPreventions = await extractPreventions(taskDescription, stateRoot, { logger, taskId });
          capturedPriorPreventions = priorPreventions;
        } catch (err) {
          const errName = err instanceof Error ? err.name : "unknown";
          const errMsg = err instanceof Error ? err.message : "";
          logger.event({
            task_id: taskId,
            spawn_id: null,
            agent: "plan.preventions",
            event_type: "prevention.extract_failed",
            level: "warn",
            payload: { error_class: errName, error_message: errMsg }
          });
        }
        if (priorPreventions.length > 0) {
          log(`prevention recall: ${priorPreventions.length} prior failure shape(s) matched`);
          for (const p of priorPreventions) {
            log(`  prevention: ${p.solution_ref}`);
          }
        }
        const adversarialInput = {
          intent_draft: taskDescription,
          ...priorPreventions.length > 0 ? { prior_preventions: priorPreventions } : {}
        };
        return spawn3("planner.adversarial", adversarialInput, {
          stateRoot,
          inlineStub: (i2) => opts.adversarialOverride ?? plannerAdversarial(i2),
          logger,
          taskId
        });
      })());
    }
    const results = await Promise.all(tasks);
    plannerEngOut = results[0].output;
    plannerCeoOut = results[1].output;
    researcherOut = results[2].output;
    if (level === "L3") {
      adversarialOut = results[3].output;
      if (capturedPriorPreventions.length > 0 && adversarialOut.failure_modes.length > 0) {
        try {
          const refs = extractAppliedSolutionRefs(adversarialOut.failure_modes, capturedPriorPreventions);
          if (refs.length > 0) {
            const appliedResult = recordApplied(stateRoot, refs, taskId, { logger });
            logger.event({
              task_id: taskId,
              spawn_id: null,
              agent: "plan.applied",
              event_type: "plan.applied_recorded",
              level: "info",
              payload: {
                solution_refs_input: refs,
                updated: appliedResult.updated,
                skipped_already_applied: appliedResult.skipped_already_applied,
                skipped_missing: appliedResult.skipped_missing,
                skipped_malformed: appliedResult.skipped_malformed,
                stale_skipped: appliedResult.stale_skipped,
                write_failed: appliedResult.write_failed
              }
            });
            if (appliedResult.updated.length > 0) {
              log(`applied_in updated: ${appliedResult.updated.length} solution(s) tracked task ${taskId}`);
            }
          }
        } catch (err) {
          const errName = err instanceof Error ? err.name : "unknown";
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.event({
            task_id: taskId,
            spawn_id: null,
            agent: "plan.applied",
            event_type: "plan.applied_wire_failed",
            level: "warn",
            payload: { error_class: errName, error_message: errMsg, reason: "wire_up_throw" }
          });
        }
      }
    }
    const surfacedRefs = selectSurfacedRefs(researcherOut.prior_art);
    if (surfacedRefs.length > 0) {
      try {
        const surfacedResult = recordSurfaced(stateRoot, surfacedRefs, taskId, { logger });
        logger.event({
          task_id: taskId,
          spawn_id: null,
          agent: "plan.surfaced",
          event_type: "plan.surfaced_recorded",
          level: "info",
          payload: {
            solution_refs_input: surfacedRefs,
            updated: surfacedResult.updated,
            skipped_already_applied: surfacedResult.skipped_already_applied,
            skipped_missing: surfacedResult.skipped_missing,
            skipped_malformed: surfacedResult.skipped_malformed,
            stale_skipped: surfacedResult.stale_skipped,
            write_failed: surfacedResult.write_failed
          }
        });
        if (surfacedResult.updated.length > 0) {
          log(`surfaced_in updated: ${surfacedResult.updated.length} solution(s) tracked task ${taskId}`);
        }
      } catch (err) {
        const errName = err instanceof Error ? err.name : "unknown";
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.event({
          task_id: taskId,
          spawn_id: null,
          agent: "plan.surfaced",
          event_type: "plan.surfaced_wire_failed",
          level: "warn",
          payload: { error_class: errName, error_message: errMsg, reason: "wire_up_throw" }
        });
      }
    }
    log(`planner.eng verdict: ${plannerEngOut.verdict}`);
    if (plannerEngOut.concerns.length > 0) {
      for (const c3 of plannerEngOut.concerns)
        log(`  eng concern: ${c3}`);
    }
    log(`planner.ceo verdict: ${plannerCeoOut.verdict}`);
    if (plannerCeoOut.concerns.length > 0) {
      for (const c3 of plannerCeoOut.concerns)
        log(`  ceo concern: ${c3}`);
    }
    if (plannerCeoOut.rewrite_hints.length > 0) {
      for (const h2 of plannerCeoOut.rewrite_hints)
        log(`  ceo hint: ${h2}`);
    }
    log(`researcher.history: ${researcherOut.prior_art.length} prior art entries${researcherOut.warnings.length ? `, ${researcherOut.warnings.length} warning(s)` : ""}`);
    for (const w2 of researcherOut.warnings)
      log(`  research warning: ${w2}`);
    if (adversarialOut) {
      log(`planner.adversarial: ${adversarialOut.failure_modes.length} failure mode(s)`);
      for (const fm of adversarialOut.failure_modes) {
        log(`  [${fm.probability}/${fm.impact}] ${fm.scenario}`);
      }
    }
  } else if (LEVEL_RANK[level] >= 1) {
    try {
      const planRes = await spawn3("planner.eng", { intent_draft: taskDescription }, { stateRoot, inlineStub: (i2) => plannerEng(i2), logger, taskId });
      plannerEngOut = planRes.output;
    } catch (err) {
      plannerEngOut = degradedEngOutput(err, logger, taskId);
    }
    log(`planner.eng verdict: ${plannerEngOut.verdict}`);
    if (plannerEngOut.concerns.length > 0) {
      for (const c3 of plannerEngOut.concerns)
        log(`  concern: ${c3}`);
    }
  }
  if (level === "L3" && !opts.userSignature) {
    throw new Error(`L3 plan requires human signature. Re-run with --signed-by <signer_id> ` + `to acknowledge architecture-level scope.`);
  }
  if (level === "L3" && opts.autoConfirm) {
    throw new Error(`L3 plan refuses --auto (Invariant §4). Human confirmation at stdin is required.`);
  }
  let fused;
  if (plannerCeoOut && plannerEngOut) {
    fused = fusePlan({ ceo: plannerCeoOut, eng: plannerEngOut, adversarial: adversarialOut });
  }
  const fusedSection = fused ? renderFusedSection(fused) + `

` : "";
  const fusedVerdict = fused?.fused_verdict;
  const deepActive = level !== "L0" && (LEVEL_RANK[level] >= 2 || level === "L1" && opts.deep === true);
  let decomposed = null;
  if (deepActive) {
    const decomposeInput = {
      intent_draft: taskDescription,
      ...plannerEngOut ? { structural_risks: plannerEngOut.structural_risks } : {},
      ...researcherOut ? { prior_art: researcherOut.prior_art } : {},
      ...adversarialOut ? { failure_modes: adversarialOut.failure_modes } : {},
      ...capturedPriorPreventions.length > 0 ? { prior_preventions: capturedPriorPreventions } : {}
    };
    const decRes = await spawn3("planner.decompose", decomposeInput, {
      stateRoot,
      inlineStub: (i2) => plannerDecompose(i2),
      logger,
      taskId
    });
    decomposed = decRes.output;
    log(`planner.decompose: ${decomposed.tasks.length} task(s)`);
  }
  if (level === "L3") {
    log("");
    log("=== L3 PLAN SUMMARY — confirm before intent.md is written (immutable) ===");
    log(`  task_id:    ${taskId}`);
    log(`  task:       ${taskDescription.slice(0, 120)}`);
    log(`  classifier: ${classRes.output.rationale}`);
    if (plannerEngOut)
      log(`  eng:        ${plannerEngOut.verdict} (${plannerEngOut.concerns.length} concerns)`);
    if (plannerCeoOut)
      log(`  ceo:        ${plannerCeoOut.verdict} (${plannerCeoOut.concerns.length} concerns)`);
    if (researcherOut)
      log(`  research:   ${researcherOut.prior_art.length} prior art entries`);
    if (adversarialOut)
      log(`  pre-mortem: ${adversarialOut.failure_modes.length} failure mode(s)`);
    if (fused) {
      log(`  fused:      ${fused.fused_verdict} — ${fused.decision_basis} (advisory; human signature still required)`);
    }
    log(`  signer:     ${opts.userSignature.signer_id}`);
    log("");
    log("Type 'yes' to commit intent.md (or Ctrl+C to abort):");
    const reader = opts.readConfirmation ?? defaultReadConfirmation;
    const answer = (await reader()).trim().toLowerCase();
    if (answer !== "yes") {
      throw new Error(`L3 plan not confirmed at stdin (got '${answer || "(empty)"}'); intent.md NOT written.`);
    }
    log("confirmed — writing intent.md");
  }
  let intentPath2 = "(skipped — L0)";
  if (level !== "L0") {
    const intent = {
      task_id: taskId,
      level,
      created_at: createdAt,
      title: taskDescription.slice(0, 120),
      motivation,
      affected_readers: classRes.output.affected_readers_candidates,
      scope_tokens: computeCommandTokens("/plan"),
      user_signature: opts.userSignature,
      fused_verdict: fusedVerdict,
      body: fusedSection + `## Classifier rationale

${classified.rationale}

` + (plannerEngOut ? `## Planner.eng verdict

${plannerEngOut.verdict}

` + (plannerEngOut.concerns.length ? `### Eng concerns

${plannerEngOut.concerns.map((c3) => `- ${c3}`).join(`
`)}

` : "") : "") + (plannerCeoOut ? `## Planner.ceo verdict

${plannerCeoOut.verdict}

` + (plannerCeoOut.concerns.length ? `### CEO concerns

${plannerCeoOut.concerns.map((c3) => `- ${c3}`).join(`
`)}

` : "") + (plannerCeoOut.rewrite_hints.length ? `### CEO rewrite hints

${plannerCeoOut.rewrite_hints.map((h2) => `- ${h2}`).join(`
`)}

` : "") : "") + (researcherOut ? `${PRIOR_ART_SENTINEL_BEGIN}
` + `## Prior art (researcher.history)

` + (researcherOut.prior_art.length === 0 ? `_No prior art found._

` : researcherOut.prior_art.map((p) => {
        const excerpt = p.excerpt?.trim();
        const ref = `- **${p.solution_ref}** (score ${p.relevance_score.toFixed(2)})`;
        const head = excerpt ? `${ref}: ${excerpt}` : ref;
        return p.relevance_reason ? `${head}
  Reason: ${p.relevance_reason}` : head;
      }).join(`
`) + `

`) + (researcherOut.warnings.length ? `### Research warnings

${researcherOut.warnings.map((w2) => `- ${w2}`).join(`
`)}

` : "") + `${PRIOR_ART_SENTINEL_END}

` : "") + (adversarialOut ? `${PRE_MORTEM_SENTINEL_BEGIN}
` + `## Pre-mortem (planner.adversarial)

` + adversarialOut.failure_modes.map((fm) => `### [${fm.probability}/${fm.impact}] ${fm.scenario}
` + `Early signal: ${fm.early_signal}
`).join(`
`) + `
${PRE_MORTEM_SENTINEL_END}
` : "")
    };
    intentPath2 = writeIntent(intent, stateRoot);
    log(`wrote ${intentPath2}`);
  } else {
    log(`L0 task: skipping intent.md per schema (decisions/ not written for L0)`);
  }
  if (decomposed && decomposed.tasks.length > 0) {
    const features = decomposed.tasks.map((t2) => ({
      id: t2.id,
      title: t2.title,
      status: "pending",
      files: t2.files,
      steps: t2.steps,
      ...t2.prior_art_refs.length > 0 ? { prior_art_refs: t2.prior_art_refs } : {}
    }));
    writeFeatureList({ features }, "Authored by `sgc plan` deep decomposition. Each task carries file-level scope + bite-sized TDD steps.\n", stateRoot);
    const slug = taskDescription.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "plan";
    const dateIso = createdAt.slice(0, 10);
    const md = renderPlanMarkdown({ features }, { title: taskDescription.slice(0, 120), level });
    const docPath = writePlanDoc(slug, dateIso, md, stateRoot);
    log(`wrote plan doc ${docPath}`);
  } else {
    writeFeatureList({
      features: [
        {
          id: "f1",
          title: taskDescription.slice(0, 200),
          status: "pending"
        }
      ]
    }, "Refine this list during `sgc work`. The dispatcher does not infer fine-grained features in MVP.\n", stateRoot);
  }
  writeCurrentTask({
    task_id: taskId,
    level,
    active_feature: "f1",
    session_start: createdAt,
    last_activity: createdAt
  }, "", stateRoot);
  const handoff = {
    from_session: taskId,
    to_session_hint: "sgc work",
    summary: `Plan created for task ${taskId} at level ${level}.`,
    open_questions: []
  };
  writeHandoff(handoff, `Plan written for task ${taskId}. Level ${level}. Resume via 'sgc work'.
`, stateRoot);
  log(``);
  log(`Plan complete. Run \`sgc work\` to begin execution.`);
  return { taskId, level, intentPath: intentPath2 };
}
var init_plan = __esm(() => {
  init_spawn();
  init_classifier_level2();
  init_planner_eng2();
  init_planner_ceo2();
  init_researcher_history();
  init_planner_adversarial2();
  init_planner_decompose2();
  init_preventions();
  init_applied_tracker();
  init_rationale();
  init_state();
  init_capabilities();
  init_delegation();
  init_fuse_plan();
  init_logger();
  init_plan_jobs2();
});

// src/commands/work.ts
var exports_work = {};
__export(exports_work, {
  runWork: () => runWork
});
import { join as join4 } from "node:path";
function isTrivialWaive(reason) {
  const r3 = reason.trim().toLowerCase();
  return r3.length < WAIVE_MIN_CHARS || WAIVE_PLACEHOLDERS.has(r3);
}
function nowIso2() {
  return new Date().toISOString();
}
function nextActiveId(list) {
  const done = new Set(list.features.filter((f3) => f3.status === "done").map((f3) => f3.id));
  const depsMet = (f3) => (f3.depends_on ?? []).every((d2) => done.has(d2));
  const inProgress = list.features.find((f3) => f3.status === "in_progress" && depsMet(f3));
  if (inProgress)
    return inProgress.id;
  const pending = list.features.find((f3) => f3.status === "pending" && depsMet(f3));
  return pending ? pending.id : null;
}
function printList(log, list, activeId) {
  if (list.features.length === 0) {
    log('(feature list is empty — use `sgc work --add "<title>"` to add one)');
    return;
  }
  for (const f3 of list.features) {
    const marker = f3.status === "done" ? "[x]" : f3.id === activeId ? "[>]" : "[ ]";
    const status = f3.status === "done" ? "" : ` (${f3.status})`;
    let meta = "";
    if (f3.files) {
      const n2 = f3.files.create.length + f3.files.modify.length + f3.files.test.length;
      meta += ` — ${n2} file${n2 === 1 ? "" : "s"}`;
    }
    if (f3.steps && f3.steps.length > 0) {
      meta += `${f3.files ? "," : " —"} ${f3.steps.length} step${f3.steps.length === 1 ? "" : "s"}`;
    }
    log(`  ${marker} ${f3.id}: ${f3.title}${status}${meta}`);
  }
}
async function runWork(opts = {}) {
  if (opts.add || opts.done) {
    const root3 = resolveStateRoot(opts.stateRoot);
    return withFileLock(join4(root3, ".work.lock"), () => runWorkUnlocked(opts));
  }
  return runWorkUnlocked(opts);
}
async function runWorkUnlocked(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot = opts.stateRoot;
  const ct = readCurrentTask(stateRoot);
  if (!ct) {
    throw new Error("no active task — run `sgc plan <task>` first");
  }
  const flRead = readFeatureList(stateRoot);
  if (!flRead) {
    throw new Error("no feature-list.md — was the plan complete?");
  }
  let list = flRead.list;
  if (opts.add) {
    const nextId = `f${list.features.length + 1}`;
    list = {
      features: [
        ...list.features,
        { id: nextId, title: opts.add, status: "pending" }
      ]
    };
    writeFeatureList(list, "", stateRoot);
    log(`added feature ${nextId}: ${opts.add}`);
  }
  if (opts.done) {
    const idx = list.features.findIndex((f3) => f3.id === opts.done);
    if (idx === -1) {
      throw new Error(`feature ${opts.done} not found in feature-list`);
    }
    if (list.features[idx].status === "done") {
      log(`feature ${opts.done} was already done; no change`);
    } else {
      const verifyCommand = opts.verifyCommand?.trim();
      if (!verifyCommand) {
        throw new Error(`done refused: --verify-command required to mark ${opts.done} done ` + `(operator responsibility; sgc does not execute it)`);
      }
      const priorRed = opts.priorRed?.trim();
      const redOutput = opts.redOutput?.trim();
      const waiveRed = opts.waiveRed?.trim();
      const hasPair = Boolean(priorRed) && Boolean(redOutput);
      if (Boolean(priorRed) !== Boolean(redOutput)) {
        throw new Error(`done refused: --prior-red and --red-output must be supplied together`);
      }
      if (hasPair && waiveRed) {
        throw new Error(`done refused: supply a prior-RED pair OR --waive-red, not both (conflict)`);
      }
      if (!hasPair && !waiveRed) {
        throw new Error(`done refused: record a prior-RED (--prior-red "<failing test>" ` + `--red-output "<observed failure>") or pass --waive-red "<reason>"`);
      }
      if (waiveRed && isTrivialWaive(waiveRed)) {
        throw new Error(`done refused: --waive-red reason ${JSON.stringify(waiveRed)} is too trivial — ` + `state WHY no failing-test path exists (≥${WAIVE_MIN_CHARS} chars, not a ` + `placeholder like x / n/a / todo)`);
      }
      const evidence = opts.evidence?.trim();
      list.features[idx] = {
        ...list.features[idx],
        status: "done",
        verify_command: verifyCommand,
        ...evidence ? { evidence } : {},
        ...hasPair ? { prior_red: priorRed, red_output: redOutput } : {},
        ...waiveRed ? { waived_red: waiveRed } : {}
      };
      writeFeatureList(list, "", stateRoot);
      log(`marked ${opts.done} done`);
      if (waiveRed && !hasPair) {
        log(`⚠ RED waived for ${opts.done} (no failing-test evidence): ${waiveRed}`);
      }
      if (hasPair) {
        writeRedGreenCapture({
          title: list.features[idx].title,
          task_id: ct.task.task_id,
          feature_id: opts.done,
          level: String(ct.task.level),
          prior_red: priorRed,
          red_output: redOutput,
          verify_command: verifyCommand,
          ...evidence ? { evidence } : {}
        }, stateRoot);
      }
    }
  }
  const activeId = nextActiveId(list);
  const allDone = list.features.length > 0 && list.features.every((f3) => f3.status === "done");
  writeCurrentTask({
    ...ct.task,
    active_feature: activeId ?? undefined,
    last_activity: nowIso2()
  }, "", stateRoot);
  log(`task ${ct.task.task_id} (level ${ct.task.level}):`);
  printList(log, list, activeId);
  log("");
  if (allDone) {
    if (ct.task.level === "L0") {
      log(`L0 task complete (fast-path — review/qa/ship gates apply at L2+).`);
    } else {
      log(`All features done. Run \`sgc review\` for independent code review.`);
    }
  } else if (activeId) {
    const active2 = list.features.find((f3) => f3.id === activeId);
    log(`Active: ${activeId} — ${active2.title}`);
    log(`When implemented, run: \`sgc work --done ${activeId}\``);
  }
  const remaining = list.features.filter((f3) => f3.status !== "done");
  const active = activeId ? list.features.find((f3) => f3.id === activeId) ?? null : null;
  return { remaining, active, allDone };
}
var WAIVE_MIN_CHARS = 6, WAIVE_PLACEHOLDERS;
var init_work = __esm(() => {
  init_state();
  init_logger();
  init_file_lock();
  WAIVE_PLACEHOLDERS = new Set([
    "n/a",
    "na",
    "none",
    "nil",
    "null",
    "todo",
    "tbd",
    "tba",
    "wip",
    "fixme",
    "xxx",
    "test",
    "skip",
    "waive",
    "waived",
    "-",
    "."
  ]);
});

// src/dispatcher/agents/reviewer-correctness.ts
function reviewerCorrectnessHeuristic(input) {
  const diff = input.diff ?? "";
  if (diff.trim() === "") {
    return {
      verdict: "concern",
      severity: "low",
      findings: [{ description: "no diff to review (empty change)" }]
    };
  }
  const findings = [];
  const lines = diff.split(`
`);
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++") && MARKER_RE.test(line)) {
      findings.push({
        description: `unresolved marker in added line: ${line.slice(1, 100).trim()}`
      });
    }
  }
  return {
    verdict: findings.length > 0 ? "concern" : "pass",
    severity: findings.length > 0 ? "low" : "none",
    findings
  };
}
var MARKER_RE, reviewerCorrectness;
var init_reviewer_correctness2 = __esm(() => {
  MARKER_RE = /\b(TODO|FIXME|XXX)\b/;
  reviewerCorrectness = reviewerCorrectnessHeuristic;
});

// src/dispatcher/agents/terms.ts
function buildPattern(terms, flags = "i") {
  if (terms.length === 0) {
    throw new Error("buildPattern needs at least one term — an empty alternation matches everything");
  }
  const bounded = terms.filter((t2) => t2.wordBounded).map((t2) => t2.re);
  const free = terms.filter((t2) => !t2.wordBounded).map((t2) => t2.re);
  const parts = [];
  if (bounded.length > 0)
    parts.push(`\\b(${bounded.join("|")})\\b`);
  if (free.length > 0)
    parts.push(free.join("|"));
  return new RegExp(parts.join("|"), flags);
}
function displayList(terms) {
  return terms.map((t2) => t2.display).join("|");
}

// src/dispatcher/agents/reviewer-specialists.ts
function addedLines(diff) {
  return diff.split(`
`).filter((l2) => l2.startsWith("+") && !l2.startsWith("+++"));
}
function reviewBy(def, input) {
  const findings = [];
  for (const line of addedLines(input.diff ?? "")) {
    if (def.pattern.test(line)) {
      findings.push({ description: def.describe(line.slice(1, 200).trim()) });
    }
  }
  return {
    verdict: findings.length > 0 ? "concern" : "pass",
    severity: findings.length > 0 ? def.severity : "none",
    findings
  };
}
function reviewerSecurity(input) {
  return reviewBy(SECURITY, input);
}
function reviewerMigration(input) {
  return reviewBy(MIGRATION, input);
}
function reviewerPerformance(input) {
  return reviewBy(PERFORMANCE, input);
}
function reviewerInfra(input) {
  return reviewBy(INFRA, input);
}
function matchSpecialists(diff) {
  return DIFF_CONDITIONAL_SPECIALISTS.filter((s2) => s2.trigger.test(diff));
}
var SECURITY_TERMS, SECURITY, MIGRATION_TERMS, MIGRATION, PERFORMANCE_TERMS, PERFORMANCE, INFRA_TERMS, INFRA, PERFORMANCE_TRIGGER_ONLY, unbound = (ts) => ts.map((t2) => ({ ...t2, wordBounded: false })), DIFF_CONDITIONAL_SPECIALISTS;
var init_reviewer_specialists = __esm(() => {
  SECURITY_TERMS = [
    { display: "auth", re: "auth", wordBounded: false },
    { display: "jwt", re: "jwt", wordBounded: false },
    { display: "token", re: "token", wordBounded: false },
    { display: "session", re: "session", wordBounded: false },
    { display: "crypto", re: "crypto", wordBounded: false },
    { display: "password", re: "password", wordBounded: false },
    { display: "secret", re: "secret", wordBounded: false },
    { display: "signature", re: "signature", wordBounded: false },
    { display: "encrypt", re: "encrypt", wordBounded: false },
    { display: "decrypt", re: "decrypt", wordBounded: false },
    { display: "verifyAuth", re: "verifyAuth", wordBounded: false },
    { display: "signJwt", re: "signJwt", wordBounded: false },
    { display: "signToken", re: "signToken", wordBounded: false }
  ];
  SECURITY = {
    name: "reviewer.security",
    terms: SECURITY_TERMS,
    pattern: buildPattern(SECURITY_TERMS),
    severity: "medium",
    describe: (line) => `security-sensitive change in added line: ${line}`
  };
  MIGRATION_TERMS = [
    { display: "ALTER TABLE", re: String.raw`ALTER\s+TABLE`, wordBounded: true },
    { display: "DROP TABLE", re: String.raw`DROP\s+TABLE`, wordBounded: true },
    { display: "CREATE TABLE", re: String.raw`CREATE\s+TABLE`, wordBounded: true },
    { display: "ALTER COLUMN", re: String.raw`ALTER\s+COLUMN`, wordBounded: true },
    { display: "RENAME COLUMN", re: String.raw`RENAME\s+COLUMN`, wordBounded: true },
    { display: "migration", re: "migration", wordBounded: true },
    { display: "backfill", re: "backfill", wordBounded: true }
  ];
  MIGRATION = {
    name: "reviewer.migration",
    terms: MIGRATION_TERMS,
    pattern: buildPattern(MIGRATION_TERMS),
    severity: "high",
    describe: (line) => `migration-shaped change requires explicit rollback + concurrency review: ${line}`
  };
  PERFORMANCE_TERMS = [
    { display: "cache", re: "cache", wordBounded: true },
    { display: "cached/caching", re: "cach(ed|ing)", wordBounded: true },
    { display: "index", re: "index", wordBounded: true },
    { display: "memoize/memoise", re: "memoi[sz]e", wordBounded: true },
    { display: "debounce", re: "debounce", wordBounded: true },
    { display: "throttle", re: "throttle", wordBounded: true },
    { display: "n+1", re: String.raw`n\+1`, wordBounded: true },
    { display: "benchmark", re: "benchmark", wordBounded: true },
    { display: "p95/p99", re: "p9[59]", wordBounded: true },
    { display: "O(n…)", re: String.raw`O\(n\^?\d*\)`, wordBounded: false }
  ];
  PERFORMANCE = {
    name: "reviewer.performance",
    terms: PERFORMANCE_TERMS,
    pattern: buildPattern(PERFORMANCE_TERMS),
    severity: "medium",
    describe: (line) => `performance-touching change in added line: ${line}`
  };
  INFRA_TERMS = [
    { display: "Dockerfile", re: "Dockerfile", wordBounded: false },
    { display: "FROM <image>", re: String.raw`FROM\s+\w`, wordBounded: false },
    { display: "kubectl", re: "kubectl", wordBounded: false },
    { display: "k8s", re: String.raw`k8s\b`, wordBounded: false },
    { display: "terraform", re: "terraform", wordBounded: false },
    { display: "helm", re: "helm", wordBounded: true },
    { display: "argo", re: "argo", wordBounded: true },
    { display: "fly.toml", re: String.raw`fly\.toml`, wordBounded: false },
    { display: "render.yaml", re: String.raw`render\.yaml`, wordBounded: false },
    { display: "vercel.json", re: String.raw`vercel\.json`, wordBounded: false },
    { display: "github/workflows", re: String.raw`github\/workflows`, wordBounded: false }
  ];
  INFRA = {
    name: "reviewer.infra",
    terms: INFRA_TERMS,
    pattern: buildPattern(INFRA_TERMS),
    severity: "high",
    describe: (line) => `infra-shaped change requires deploy + rollback review: ${line}`
  };
  PERFORMANCE_TRIGGER_ONLY = [
    { display: "perf", re: "perf", wordBounded: false },
    { display: "performance", re: "performance", wordBounded: false }
  ];
  DIFF_CONDITIONAL_SPECIALISTS = [
    {
      name: "reviewer.security",
      trigger: buildPattern(unbound(SECURITY_TERMS)),
      triggerOnly: [],
      agent: reviewerSecurity
    },
    {
      name: "reviewer.migration",
      trigger: buildPattern(unbound(MIGRATION_TERMS)),
      triggerOnly: [],
      agent: reviewerMigration
    },
    {
      name: "reviewer.performance",
      trigger: buildPattern(unbound([...PERFORMANCE_TERMS, ...PERFORMANCE_TRIGGER_ONLY])),
      triggerOnly: PERFORMANCE_TRIGGER_ONLY,
      agent: reviewerPerformance
    },
    {
      name: "reviewer.infra",
      trigger: buildPattern(unbound(INFRA_TERMS)),
      triggerOnly: [],
      agent: reviewerInfra
    }
  ];
});

// src/dispatcher/agents/reviewer-quality.ts
function addedLines2(diff) {
  return (diff ?? "").split(`
`).filter((l2) => l2.startsWith("+") && !l2.startsWith("+++"));
}
function changedFilePaths(diff) {
  const paths = [];
  for (const line of (diff ?? "").split(`
`)) {
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).replace(/^[ab]\//, "").trim();
      if (p && p !== "/dev/null")
        paths.push(p);
    }
  }
  return paths;
}
function isTestPath(path2) {
  return /(^|\/)(tests?|spec|__tests__)(\/|$)/i.test(path2) || /\.(test|spec)\./i.test(path2) || /_test\./i.test(path2);
}
function reviewerTests(input) {
  const paths = changedFilePaths(input.diff ?? "");
  const sourceChanged = paths.filter((p) => !isTestPath(p) && !NON_SOURCE.test(p));
  const testChanged = paths.filter((p) => isTestPath(p));
  if (sourceChanged.length > 0 && testChanged.length === 0) {
    const findings = [
      {
        description: `source/behavior change without test additions: ${sourceChanged.slice(0, 5).join(", ")}`
      }
    ];
    return { verdict: "concern", severity: TESTS_SEVERITY, findings };
  }
  return { verdict: "pass", severity: "none", findings: [] };
}
function reviewerMaintainability(input) {
  const findings = [];
  for (const raw of addedLines2(input.diff ?? "")) {
    const line = raw.slice(1);
    if (line.length > MAX_LINE) {
      findings.push({
        description: `long added line (${line.length} > ${MAX_LINE} chars): ${line.slice(0, 80).trim()}`
      });
    }
    if (MAINT_MARKERS.test(line)) {
      findings.push({
        description: `maintainability marker in added line: ${line.slice(0, 120).trim()}`
      });
    }
  }
  const severity = findings.length > 0 ? MAINTAINABILITY_SEVERITY : "none";
  const verdict = findings.length > 0 ? "concern" : "pass";
  return { verdict, severity, findings };
}
var NON_SOURCE, MAINT_MARKER_TERMS, MAINT_MARKERS, MAX_LINE = 120, MAINTAINABILITY_SEVERITY = "low", TESTS_SEVERITY = "medium", TESTS_MECHANISM = "a file-path check over the diff's `+++ b/<path>` headers";
var init_reviewer_quality = __esm(() => {
  NON_SOURCE = /\.(md|markdown|txt|json|ya?ml|toml|lock|cfg|ini)$/i;
  MAINT_MARKER_TERMS = [
    { display: "TODO", re: "TODO", wordBounded: false },
    { display: "FIXME", re: "FIXME", wordBounded: false },
    { display: "@ts-ignore", re: "@ts-ignore", wordBounded: false },
    { display: "@ts-nocheck", re: "@ts-nocheck", wordBounded: false },
    { display: "eslint-disable", re: "eslint-disable", wordBounded: false },
    { display: "as any", re: "as any", wordBounded: true }
  ];
  MAINT_MARKERS = buildPattern(MAINT_MARKER_TERMS, "");
});

// src/commands/review.ts
var exports_review = {};
__export(exports_review, {
  worstVerdict: () => worstVerdict,
  runReview: () => runReview,
  captureDiff: () => captureDiff
});
function generateReportId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function nowIso3() {
  return new Date().toISOString();
}
function captureDiff(base, cwd, maxBytes) {
  const r3 = spawnCaptureSync(["git", "diff", base], { cwd, maxBuffer: maxBytes });
  if (r3.exitCode === 0)
    return r3.stdout;
  if (r3.exitCode === -1) {
    throw new Error(`git diff capture failed (base=${base}) — the diff was not captured, ` + `so review cannot run against it: ${r3.stderr.slice(0, 200)}`);
  }
  return "";
}
function stripSentinelBlock(body, begin, end, legacyHeadingRe) {
  const beginIdx = body.indexOf(begin);
  if (beginIdx !== -1) {
    const endIdx = body.indexOf(end, beginIdx);
    if (endIdx !== -1) {
      const after = endIdx + end.length;
      const cut = body[after] === `
` ? after + 1 : after;
      return body.slice(0, beginIdx) + body.slice(cut);
    }
    const tail = body.slice(beginIdx);
    const next = /\n## /.exec(tail);
    const cutEnd = beginIdx + (next?.index ?? tail.length);
    return body.slice(0, beginIdx) + body.slice(cutEnd);
  }
  const m2 = legacyHeadingRe.exec(body);
  if (!m2)
    return body;
  const afterHeading = body.slice(m2.index + m2[0].length);
  const nextHeading = /^## /m.exec(afterHeading);
  const sectionEnd = m2.index + m2[0].length + (nextHeading?.index ?? afterHeading.length);
  return body.slice(0, m2.index) + body.slice(sectionEnd);
}
function stripBackChannelSections(body) {
  let stripped = body;
  stripped = stripSentinelBlock(stripped, PRIOR_ART_SENTINEL_BEGIN, PRIOR_ART_SENTINEL_END, /^## Prior art \(researcher\.history\)\r?\n/m);
  stripped = stripSentinelBlock(stripped, PRE_MORTEM_SENTINEL_BEGIN, PRE_MORTEM_SENTINEL_END, /^## Pre-mortem \(planner\.adversarial\)\r?\n/m);
  return stripped;
}
function worstVerdict(verdicts) {
  return verdicts.reduce((acc, v2) => VERDICT_ORDER[v2] > VERDICT_ORDER[acc] ? v2 : acc, "pass");
}
async function runReview(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot = opts.stateRoot;
  const ct = readCurrentTask(stateRoot);
  if (!ct)
    throw new Error("no active task — run `sgc plan <task>` first");
  const taskId = ct.task.task_id;
  const level = ct.task.level;
  if (level === "L0") {
    throw new Error("L0 tasks are fast-path: no intent.md is written and review/qa/ship are L2+ gates. Nothing to review.");
  }
  for (const hint of delegationHintsFor("review.cluster"))
    log(formatHint(hint));
  const intent = readIntent(taskId, stateRoot);
  const intentForReviewer = stripBackChannelSections(intent.body ?? "");
  const diff = opts.diffOverride ?? captureDiff(opts.base ?? "HEAD");
  const r3 = await spawn3("reviewer.correctness", { diff, intent: intentForReviewer }, {
    stateRoot,
    inlineStub: (i2) => reviewerCorrectness(i2),
    logger,
    taskId
  });
  const correctnessReport = {
    report_id: generateReportId(),
    task_id: taskId,
    stage: "code",
    reviewer_id: "reviewer.correctness",
    reviewer_version: "0.1",
    verdict: r3.output.verdict,
    severity: r3.output.severity,
    findings: r3.output.findings,
    created_at: nowIso3(),
    engine: r3.mode
  };
  const reportPath = appendReview(correctnessReport, "", stateRoot, opts.appendAs);
  log(`reviewer.correctness: ${correctnessReport.verdict} (severity: ${correctnessReport.severity}, ${correctnessReport.findings.length} finding(s))`);
  for (const f3 of correctnessReport.findings.slice(0, 5)) {
    log(`  - ${f3.description}`);
  }
  if (correctnessReport.findings.length > 5) {
    log(`  ... ${correctnessReport.findings.length - 5} more findings (see ${reportPath})`);
  }
  const isL2Plus = level === "L2" || level === "L3";
  const clusterReports = [];
  async function runClusterReviewer(name, agent) {
    const res = await spawn3(name, { diff, intent: intentForReviewer }, { stateRoot, inlineStub: (i2) => agent(i2), logger, taskId });
    const report = {
      report_id: generateReportId(),
      task_id: taskId,
      stage: "code",
      reviewer_id: name,
      reviewer_version: "0.1",
      verdict: res.output.verdict,
      severity: res.output.severity,
      findings: res.output.findings,
      created_at: nowIso3(),
      engine: res.mode
    };
    const path2 = appendReview(report, "", stateRoot, opts.appendAs);
    clusterReports.push({
      reviewerId: name,
      verdict: res.output.verdict,
      severity: res.output.severity,
      reportPath: path2,
      findingsCount: res.output.findings.length
    });
    log(`${name}: ${res.output.verdict} (severity: ${res.output.severity}, ${res.output.findings.length} finding(s))`);
  }
  if (isL2Plus) {
    await runClusterReviewer("reviewer.tests", reviewerTests);
    await runClusterReviewer("reviewer.maintainability", reviewerMaintainability);
  }
  const specialistReports = [];
  if (isL2Plus) {
    const matched = matchSpecialists(diff);
    if (matched.length > 0) {
      const specialistMode = process.env["SGC_REVIEW_SPECIALIST_LLM"] === "0" ? "inline" : undefined;
      const specResults = await Promise.all(matched.map((s2) => spawn3(s2.name, { diff, intent: intentForReviewer }, {
        stateRoot,
        inlineStub: (i2) => s2.agent(i2),
        ...specialistMode ? { mode: specialistMode } : {},
        logger,
        taskId
      })));
      for (let i2 = 0;i2 < matched.length; i2++) {
        const s2 = matched[i2];
        const out = specResults[i2].output;
        const report = {
          report_id: generateReportId(),
          task_id: taskId,
          stage: "code",
          reviewer_id: s2.name,
          reviewer_version: "0.1",
          verdict: out.verdict,
          severity: out.severity,
          findings: out.findings,
          created_at: nowIso3(),
          engine: specResults[i2].mode
        };
        const path2 = appendReview(report, "", stateRoot, opts.appendAs);
        specialistReports.push({
          reviewerId: s2.name,
          verdict: out.verdict,
          severity: out.severity,
          reportPath: path2,
          findingsCount: out.findings.length
        });
        log(`${s2.name}: ${out.verdict} (severity: ${out.severity}, ${out.findings.length} finding(s))`);
        for (const f3 of out.findings.slice(0, 3)) {
          log(`  - ${f3.description}`);
        }
      }
    }
  }
  log(`wrote ${reportPath}${specialistReports.length > 0 ? ` (+${specialistReports.length} specialists)` : ""}`);
  const aggregateVerdict = worstVerdict([
    correctnessReport.verdict,
    ...clusterReports.map((s2) => s2.verdict),
    ...specialistReports.map((s2) => s2.verdict)
  ]);
  return { taskId, verdict: aggregateVerdict, reportPath, specialistReports: [...clusterReports, ...specialistReports] };
}
var VERDICT_ORDER;
var init_review = __esm(() => {
  init_subprocess();
  init_spawn();
  init_reviewer_correctness2();
  init_reviewer_specialists();
  init_reviewer_quality();
  init_state();
  init_delegation();
  init_logger();
  VERDICT_ORDER = { pass: 0, concern: 1, fail: 2 };
});

// src/dispatcher/agents/qa-browser.ts
async function qaBrowser(input, opts = {}) {
  if (opts.browseRunner) {
    return opts.browseRunner(input);
  }
  if (!input.target_url || input.target_url.trim() === "") {
    return {
      verdict: "fail",
      evidence_refs: [],
      failed_flows: [
        {
          flow: "(all)",
          step: "setup",
          observed: "target_url is empty — pass the URL as a positional argument: " + "`sgc qa <url> --flows <a,b>` (it is positional, not `--target`)"
        }
      ]
    };
  }
  if (!Array.isArray(input.user_flows) || input.user_flows.length === 0) {
    return {
      verdict: "concern",
      evidence_refs: [],
      failed_flows: [
        {
          flow: "(none)",
          step: "input",
          observed: "no user_flows provided — nothing to validate"
        }
      ]
    };
  }
  return {
    verdict: "concern",
    evidence_refs: [],
    failed_flows: [
      {
        flow: "(all)",
        step: "runner",
        observed: "no browser runner — real-browser QA is opt-in: pass --browse or " + "set SGC_QA_REAL=1 (Playwright; install a browser with " + "`npx playwright install chromium`). Running stub mode " + "(verdict: concern — gate not rubber-stamped)."
      }
    ]
  };
}

// src/dispatcher/agents/playwright-runner.ts
import { join as join5 } from "node:path";
function firstLine(s2) {
  return (s2.split(`
`).find((l2) => l2.trim().length > 0) ?? "").trim();
}
function safeLabel(label) {
  return label.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "target";
}
function joinUrl(base, path2) {
  try {
    return new URL(path2, base).toString();
  } catch {
    return base.replace(/\/+$/, "") + "/" + path2.replace(/^\/+/, "");
  }
}
function planTargets(input) {
  const targets = [{ label: "(target)", url: input.target_url }];
  const prose = [];
  for (const f3 of input.user_flows) {
    if (/^https?:\/\//i.test(f3))
      targets.push({ label: f3, url: f3 });
    else if (f3.startsWith("/"))
      targets.push({ label: f3, url: joinUrl(input.target_url, f3) });
    else
      prose.push(f3);
  }
  return { targets, prose };
}
function makeBrowseRunner(opts) {
  const { launch, screenshotDir } = opts;
  return async (input) => {
    if (!input.target_url || input.target_url.trim() === "") {
      return {
        verdict: "fail",
        evidence_refs: [],
        failed_flows: [
          {
            flow: "(all)",
            step: "setup",
            observed: "target_url is empty — pass the URL as a positional argument: " + "`sgc qa <url> --flows <a,b>` (it is positional, not `--target`)"
          }
        ]
      };
    }
    let session;
    try {
      session = await launch();
    } catch (e2) {
      return {
        verdict: "concern",
        evidence_refs: [],
        failed_flows: [
          {
            flow: "(all)",
            step: "launch",
            observed: `browser unavailable: ${firstLine(e2?.message ?? String(e2))}`
          }
        ]
      };
    }
    const { targets, prose } = planTargets(input);
    const evidence_refs = [];
    const failed_flows = [];
    let navOk = 0;
    try {
      for (let i2 = 0;i2 < targets.length; i2++) {
        const t2 = targets[i2];
        const shot = join5(screenshotDir, `qa-${i2}-${safeLabel(t2.label)}.png`);
        const r3 = await session.smoke(t2.url, shot);
        if (r3.screenshot)
          evidence_refs.push(r3.screenshot);
        if (!r3.navOk) {
          failed_flows.push({
            flow: t2.label,
            step: "goto",
            observed: `navigation failed: ${firstLine(r3.navError ?? "unknown")}`
          });
          continue;
        }
        navOk++;
        for (const e2 of r3.consoleErrors) {
          failed_flows.push({ flow: t2.label, step: "console", observed: e2 });
        }
        if (!r3.screenshot) {
          failed_flows.push({
            flow: t2.label,
            step: "screenshot",
            observed: "screenshot capture failed (evidence omitted)"
          });
        }
      }
    } finally {
      try {
        await session.close();
      } catch {}
    }
    const notes = prose.map((f3) => ({
      flow: f3,
      step: "note",
      observed: "recorded as label; not individually navigated (no path/URL)"
    }));
    const realFailures = failed_flows.filter((f3) => f3.step === "goto" || f3.step === "console");
    const verdict = navOk === 0 || realFailures.length > 0 ? "fail" : "pass";
    return { verdict, evidence_refs, failed_flows: [...failed_flows, ...notes] };
  };
}
async function launchPlaywrightSession(env2 = process.env) {
  const pw = await import("playwright");
  const channel = env2["SGC_QA_BROWSER"] === "chrome" ? "chrome" : undefined;
  const browser = await pw.chromium.launch({
    headless: true,
    chromiumSandbox: false,
    ...channel ? { channel } : {}
  });
  const context = await browser.newContext();
  return {
    async smoke(url, screenshotPath) {
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("pageerror", (e2) => consoleErrors.push(`pageerror: ${e2.message}`));
      page.on("console", (m2) => {
        if (m2.type() === "error")
          consoleErrors.push(`console.error: ${m2.text()}`);
      });
      let navOk = true;
      let navError;
      try {
        const resp = await page.goto(url, { waitUntil: "load", timeout: 30000 });
        if (resp && resp.status() >= 400) {
          navOk = false;
          navError = `HTTP ${resp.status()}`;
        }
      } catch (e2) {
        navOk = false;
        navError = e2?.message ?? String(e2);
      }
      await page.waitForTimeout(150);
      let screenshot;
      for (let attempt = 0;attempt < 2 && !screenshot; attempt++) {
        if (attempt > 0)
          await page.waitForTimeout(200);
        try {
          await page.screenshot({ path: screenshotPath });
          screenshot = screenshotPath;
        } catch {}
      }
      await page.close();
      return { navOk, navError, consoleErrors, screenshot };
    },
    async close() {
      try {
        await browser.close();
      } catch {}
    }
  };
}
var init_playwright_runner = () => {};

// src/commands/qa.ts
var exports_qa = {};
__export(exports_qa, {
  runQa: () => runQa,
  qaScreenshotDir: () => qaScreenshotDir
});
import { mkdirSync as mkdirSync6 } from "node:fs";
import { join as join6 } from "node:path";
function qaScreenshotDir(stateRoot, taskId) {
  return join6(resolveStateRoot(stateRoot), "reviews", taskId, "qa");
}
function generateReportId2() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function nowIso4() {
  return new Date().toISOString();
}
function verdictToSeverity(v2) {
  if (v2 === "pass")
    return "none";
  if (v2 === "concern")
    return "low";
  return "high";
}
async function runQa(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot = opts.stateRoot;
  const ct = readCurrentTask(stateRoot);
  if (!ct)
    throw new Error("no active task — run `sgc plan <task>` first");
  const taskId = ct.task.task_id;
  const target = opts.target ?? "";
  const flows = opts.flows ?? [];
  const optIn = opts.browse === true || process.env["SGC_QA_REAL"] === "1";
  let browseRunner = opts.browseRunner;
  if (!browseRunner && optIn) {
    const shotDir = qaScreenshotDir(stateRoot, String(taskId));
    mkdirSync6(shotDir, { recursive: true });
    browseRunner = makeBrowseRunner({ launch: launchPlaywrightSession, screenshotDir: shotDir });
  }
  const r3 = await spawn3("qa.browser", { target_url: target, user_flows: flows }, {
    stateRoot,
    inlineStub: (i2) => qaBrowser(i2, browseRunner ? { browseRunner } : {}),
    logger,
    taskId
  });
  const realFlows = r3.output.failed_flows.filter((f3) => f3.step !== "note");
  const report = {
    report_id: generateReportId2(),
    task_id: taskId,
    stage: "qa",
    reviewer_id: "qa.browser",
    reviewer_version: "0.1",
    verdict: r3.output.verdict,
    severity: verdictToSeverity(r3.output.verdict),
    findings: realFlows.map((f3) => ({
      location: f3.flow,
      description: `Step '${f3.step}' failed: ${f3.observed}`
    })),
    evidence_refs: r3.output.evidence_refs,
    created_at: nowIso4(),
    engine: r3.mode
  };
  const reportPath = appendReview(report, "", stateRoot);
  log(`qa.browser: ${report.verdict} (severity: ${report.severity}, ${realFlows.length} failed flow(s), ${r3.output.evidence_refs.length} evidence ref(s))`);
  for (const f3 of r3.output.failed_flows.slice(0, 5)) {
    log(`  - [${f3.flow}] ${f3.step}: ${f3.observed}`);
  }
  log(`wrote ${reportPath}`);
  return { taskId, verdict: report.verdict, reportPath };
}
var init_qa = __esm(() => {
  init_spawn();
  init_playwright_runner();
  init_state();
  init_logger();
});

// src/dispatcher/gh-runner.ts
function extractPrUrl(stdout2) {
  const lines = stdout2.trim().split(`
`).map((l2) => l2.trim());
  for (let i2 = lines.length - 1;i2 >= 0; i2--) {
    if (lines[i2].startsWith("http"))
      return lines[i2];
  }
  return null;
}
async function gitOutput(args) {
  const { stdout: stdout2, stderr, exitCode } = await spawnCapture(["git", ...args]);
  return { stdout: stdout2.trim(), stderr: stderr.trim(), code: exitCode };
}
var GhRunnerError, UpstreamCheckError, defaultUpstreamCheck = async () => {
  const inside = await gitOutput(["rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.stdout !== "true") {
    throw new UpstreamCheckError(`not inside a git work tree (cwd=${process.cwd()}); cannot ship --pr without a repo`);
  }
  const branchRes = await gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]);
  const branch = branchRes.code === 0 ? branchRes.stdout : "(unknown)";
  const upstreamRes = await gitOutput([
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}"
  ]);
  const upstream = upstreamRes.code === 0 && upstreamRes.stdout.length > 0 ? upstreamRes.stdout : null;
  return { branch, upstream };
}, defaultGhRunner;
var init_gh_runner = __esm(() => {
  init_subprocess();
  GhRunnerError = class GhRunnerError extends Error {
    stderr;
    exitCode;
    constructor(message, stderr, exitCode) {
      super(message);
      this.stderr = stderr;
      this.exitCode = exitCode;
      this.name = "GhRunnerError";
    }
  };
  UpstreamCheckError = class UpstreamCheckError extends Error {
    constructor(message) {
      super(message);
      this.name = "UpstreamCheckError";
    }
  };
  defaultGhRunner = {
    async createPr({ title, body, draft }) {
      const argv2 = ["gh", "pr", "create", "--title", title, "--body", body];
      if (draft)
        argv2.push("--draft");
      const { stdout: stdout2, stderr, exitCode } = await spawnCapture(argv2);
      if (exitCode !== 0) {
        throw new GhRunnerError(`gh pr create failed (exit ${exitCode}): ${stderr.slice(0, 300)}`, stderr, exitCode);
      }
      const url = extractPrUrl(stdout2);
      if (!url) {
        throw new GhRunnerError(`gh pr create returned no URL. stdout: ${stdout2.slice(0, 300)}`);
      }
      return { url };
    }
  };
});

// src/dispatcher/agents/janitor-compound.ts
function janitorCompound(input) {
  if (input.force) {
    return {
      decision: "compound",
      reason_code: "user_force",
      reason_human: "user forced compound via --force; decision rules bypassed"
    };
  }
  if (input.level === "L0") {
    return {
      decision: "skip",
      reason_code: "level_L0",
      reason_human: "L0 tasks are trivial (docs/typos/config); not worth compounding"
    };
  }
  if (input.outcome === "reverted") {
    return {
      decision: "skip",
      reason_code: "outcome_reverted",
      reason_human: "ship was reverted; no durable knowledge to extract"
    };
  }
  const hasSevere = input.reviewer_flags.some((f3) => SEVERE.has(f3.severity));
  if (hasSevere) {
    return {
      decision: "compound",
      reason_code: "reviewer_severity_medium_plus",
      reason_human: "at least one reviewer returned severity ≥ medium; capture the reasoning before it decays"
    };
  }
  if ((input.level === "L2" || input.level === "L3") && input.outcome === "success") {
    const novel = input.reviewer_flags.some((f3) => f3.novel);
    const tinyDiff = typeof input.diff_lines === "number" && input.diff_lines > 0 && input.diff_lines < MIN_REUSABLE_DIFF_LINES;
    if (tinyDiff && !novel) {
      return {
        decision: "skip",
        reason_code: "L2_plus_success_low_signal",
        reason_human: `${input.level} shipped but the diff is small (${input.diff_lines} lines) with no reviewer-flagged novelty — no reusable knowledge to index`
      };
    }
    return {
      decision: "compound",
      reason_code: "L2_plus_success",
      reason_human: `${input.level} shipped successfully; multi-file/cross-context work is worth indexing`
    };
  }
  if (input.reviewer_flags.some((f3) => f3.novel)) {
    return {
      decision: "compound",
      reason_code: "reviewer_flagged_novel",
      reason_human: "a reviewer flagged novel signal; index to avoid repeating the investigation"
    };
  }
  return {
    decision: "skip",
    reason_code: "default_conservative",
    reason_human: "no compound rule matched; skipping to avoid polluting solutions/ with low-signal entries"
  };
}
var MIN_REUSABLE_DIFF_LINES = 20, SEVERE;
var init_janitor_compound = __esm(() => {
  SEVERE = new Set(["medium", "high", "critical"]);
});

// src/dispatcher/agents/compound.ts
function compoundContextHeuristic(input) {
  const text = `${input.intent} ${input.diff ?? ""}`;
  let category = "other";
  for (const p of CATEGORY_PATTERNS) {
    if (p.re.test(text)) {
      category = p.category;
      break;
    }
  }
  const tags = TAG_CANDIDATES.filter((c3) => new RegExp(`\\b${c3}\\b`, "i").test(text));
  const problem_summary = input.intent.slice(0, 400).trim() || "(no intent text)";
  const symptoms = input.ship_outcome === "success" ? ["the change shipped without reverting"] : ["behavior documented in intent"];
  return { category, tags, problem_summary, symptoms };
}
function compoundSolutionHeuristic(input) {
  const wdw = [];
  for (const r3 of input.reviews) {
    if (r3.verdict === "fail" || r3.verdict === "concern") {
      for (const f3 of r3.findings.slice(0, 2)) {
        wdw.push({
          approach: f3.description.slice(0, 120),
          reason_failed: `flagged by ${r3.reviewer_id} (${r3.verdict})`
        });
      }
    }
  }
  const symptomsPart = input.context.symptoms.length > 0 ? ` Observed symptoms: ${input.context.symptoms.join("; ")}.` : "";
  const solution = `${input.context.problem_summary}${symptomsPart}` + ` (Heuristic capture — no LLM synthesis available; enrich for a teaching-quality solution.)`;
  return { solution, what_didnt_work: wdw };
}
function compoundRelatedHeuristic(input) {
  const candidate = {
    signature: input.signature,
    tags: input.context.tags,
    problem: input.context.problem_summary
  };
  const best = findBestMatch(candidate, input.existing_solutions);
  const duplicate_match = best && best.similarity >= DEDUP_THRESHOLD ? {
    ref: `${best.match.category}/${best.match.slug}`,
    similarity: best.similarity
  } : null;
  const related_entries = input.existing_solutions.map((s2) => ({
    ref: `${s2.category}/${s2.slug}`,
    sim: similarity(candidate, {
      signature: s2.entry.signature,
      tags: s2.entry.tags,
      problem: s2.entry.problem
    })
  })).filter((r3) => r3.sim > 0.3 && r3.sim < DEDUP_THRESHOLD).sort((a2, b2) => b2.sim - a2.sim).slice(0, 5).map((r3) => r3.ref);
  return {
    duplicate_match,
    related_entries,
    dedup_stamp: {
      threshold: DEDUP_THRESHOLD,
      best_similarity: best ? best.similarity : 0
    }
  };
}
function compoundPreventionHeuristic(input) {
  const catHint = CATEGORY_PREVENTION[input.context.category];
  const base = `Add a regression test covering the ${input.context.category}-category behavior described in the problem summary.`;
  return {
    prevention: `${base} ${catHint}`
  };
}
var CATEGORY_PATTERNS, TAG_CANDIDATES, compoundContext, compoundSolution, compoundRelated, compoundPrevention, CATEGORY_PREVENTION;
var init_compound = __esm(() => {
  init_dedup();
  CATEGORY_PATTERNS = [
    { re: /\b(auth|token|jwt|session|oauth|credential)\b/i, category: "auth" },
    { re: /\b(schema|migration|sql|database|postgres|mysql|sqlite)\b/i, category: "data" },
    { re: /\b(infra|deploy|k8s|docker|kubernetes|terraform|helm)\b/i, category: "infra" },
    { re: /\b(perf|slow|latency|cache|throughput|timeout)\b/i, category: "perf" },
    { re: /\b(ui|render|layout|button|css|style)\b/i, category: "ui" },
    { re: /\b(build|compile|dependency|bundler|webpack|vite)\b/i, category: "build" },
    { re: /\b(crash|error|exception|null|undefined|race)\b/i, category: "runtime" }
  ];
  TAG_CANDIDATES = [
    "auth",
    "schema",
    "migration",
    "perf",
    "ui",
    "infra",
    "test",
    "api",
    "typo",
    "refactor",
    "security",
    "timeout",
    "cache"
  ];
  compoundContext = compoundContextHeuristic;
  compoundSolution = compoundSolutionHeuristic;
  compoundRelated = compoundRelatedHeuristic;
  compoundPrevention = compoundPreventionHeuristic;
  CATEGORY_PREVENTION = {
    auth: "Include an adversarial test that exercises a missing/malformed token.",
    data: "Dry-run the migration against a production-shaped fixture before merge.",
    infra: "Add a canary check and a rollback script; gate on staging metrics.",
    perf: "Record a baseline benchmark and alert on regressions beyond a set %.",
    ui: "Add a visual snapshot or a DOM-shape assertion.",
    build: "Pin the critical dependency version and add a reproducible-build check.",
    runtime: "Add a boundary-input test that would have reproduced the failure.",
    other: "Document the change in the relevant skill reference so it surfaces next time."
  };
});

// src/dispatcher/compound-promote.ts
import { existsSync as existsSync15, readFileSync as readFileSync17, writeFileSync as writeFileSync5 } from "node:fs";
import { resolve as resolve15 } from "node:path";
function nowIso5() {
  return new Date().toISOString();
}
function generateUlid4() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function shortSha(sha) {
  return sha.slice(0, 7);
}
function extractStepSummary(body) {
  const re = /## \$GITHUB_STEP_SUMMARY excerpt\n\n([\s\S]*?)\n+## Next steps/;
  const m2 = re.exec(body);
  return m2?.[1]?.trim() ?? "";
}
async function promoteShipFailure(opts) {
  const stateRoot = opts.stateRoot;
  const root3 = resolveStateRoot(stateRoot);
  const shipFailurePath = resolve15(root3, "ship-failures", `${opts.slug}.md`);
  if (!existsSync15(shipFailurePath)) {
    throw new PromoteError("MissingShipFailure", `ship-failures/${opts.slug}.md does not exist under ${root3}. ` + `Run \`ls ${root3}/ship-failures/\` to see available slugs.`, { slug: opts.slug, stateRoot: root3 });
  }
  const raw = readFileSync17(shipFailurePath, "utf8");
  const parsed = parseFrontmatter(raw);
  const fm = parsed.data;
  if (typeof fm.promoted_to === "string" && fm.promoted_to.length > 0) {
    throw new PromoteError("AlreadyPromoted", `ship-failures/${opts.slug}.md already carries promoted_to: ${fm.promoted_to}. ` + `Remove the field manually to re-promote; --force does NOT override.`, { promoted_to: fm.promoted_to });
  }
  const seed = String(fm.prevention_seed ?? "").trim();
  if (seed.length === 0 || seed.startsWith(PLACEHOLDER_PREFIX)) {
    throw new PromoteError("PlaceholderPreventionSeed", `ship-failures/${opts.slug}.md still carries the capture-time ` + `prevention_seed placeholder (or empty). Edit the file's ` + `\`prevention_seed:\` frontmatter into the actual safeguard ` + `before re-running promote.`, { prevention_seed: seed.slice(0, 80) });
  }
  const summary = extractStepSummary(parsed.body);
  const intentText = `${summary}

${fm.workflow_name}`;
  const logger = opts.logger ?? createLogger({ stateRoot });
  const ctxRes = await spawn3("compound.context", { task_id: "(promote)", intent: intentText }, {
    stateRoot,
    inlineStub: (i2) => compoundContext(i2),
    logger
  });
  const context = ctxRes.output;
  const signature = computeSignature(context.problem_summary);
  const existing = listSolutions(stateRoot);
  const relRes = await spawn3("compound.related", { context, signature, existing_solutions: existing }, {
    stateRoot,
    inlineStub: (i2) => compoundRelated(i2),
    logger
  });
  const related = relRes.output;
  if (related.duplicate_match && !opts.force) {
    throw new PromoteError("DuplicateMatch", `compound.related found a duplicate at ${related.duplicate_match.ref} ` + `(similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ` + `${related.dedup_stamp.threshold}). Pass --force to write anyway, ` + `or edit prevention_seed: to differentiate.`, {
      duplicate_ref: related.duplicate_match.ref,
      similarity: related.duplicate_match.similarity
    });
  }
  const current = readCurrentTask(stateRoot);
  const taskId = current?.task.task_id ?? `SHIP-FAILURE-${shortSha(fm.commit_sha)}`;
  const now = nowIso5();
  const entry = {
    id: generateUlid4(),
    signature,
    category: context.category,
    problem: context.problem_summary,
    symptoms: context.symptoms.length > 0 ? context.symptoms : [
      `captured ship failure of ${fm.workflow_name} at ${shortSha(fm.commit_sha)}`
    ],
    what_didnt_work: [],
    solution: `Ship failure of ${fm.workflow_name} at ${shortSha(fm.commit_sha)} ` + `(run ${fm.workflow_run_id}); see body for $GITHUB_STEP_SUMMARY excerpt + ` + `operator's prevention_seed.`,
    prevention: seed,
    tags: context.tags.length > 0 ? context.tags : ["untagged"],
    first_seen: now,
    last_updated: now,
    times_referenced: 0,
    source_task_ids: [taskId],
    related_entries: related.related_entries.length > 0 ? related.related_entries : undefined,
    confidence: "provisional"
  };
  const solutionSlug = opts.solutionSlug ?? `ship-failure-${shortSha(fm.commit_sha)}`;
  const dedupAction = opts.force && related.duplicate_match ? "user_forced" : "new_entry";
  const stamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: dedupAction
  };
  const written = await writeSolutionLocked(entry, solutionSlug, stamp, "", stateRoot);
  const promotedRef = `${entry.category}/${solutionSlug}`;
  const updatedFm = { ...fm, promoted_to: promotedRef };
  writeFileSync5(shipFailurePath, serializeFrontmatter(updatedFm, parsed.body), "utf8");
  return {
    shipFailurePath,
    solutionPath: written.path,
    dedupAction,
    relatedRefs: related.related_entries
  };
}
async function promoteRedGreen(opts) {
  const stateRoot = opts.stateRoot;
  const root3 = resolveStateRoot(stateRoot);
  const capturePath = resolve15(root3, "red-green", `${opts.slug}.md`);
  if (!existsSync15(capturePath)) {
    throw new PromoteError("MissingRedGreen", `red-green/${opts.slug}.md does not exist under ${root3}. ` + `Run \`ls ${root3}/red-green/\` to see available slugs.`, { slug: opts.slug, stateRoot: root3 });
  }
  const raw = readFileSync17(capturePath, "utf8");
  const parsed = parseFrontmatter(raw);
  const fm = parsed.data;
  if (typeof fm.promoted_to === "string" && fm.promoted_to.length > 0) {
    throw new PromoteError("AlreadyPromoted", `red-green/${opts.slug}.md already carries promoted_to: ${fm.promoted_to}. ` + `Remove the field manually to re-promote; --force does NOT override.`, { promoted_to: fm.promoted_to });
  }
  const seed = String(fm.prevention_seed ?? "").trim();
  if (seed.length === 0 || seed.startsWith(PLACEHOLDER_PREFIX)) {
    throw new PromoteError("PlaceholderPreventionSeed", `red-green/${opts.slug}.md still carries the capture-time prevention_seed ` + `placeholder (or empty). Edit \`prevention_seed:\` into the actual ` + `safeguard before re-running promote.`, { prevention_seed: seed.slice(0, 80) });
  }
  const intentText = `${fm.red_output}

${fm.prior_red}`;
  const logger = opts.logger ?? createLogger({ stateRoot });
  const ctxRes = await spawn3("compound.context", { task_id: fm.task_id, intent: intentText }, {
    stateRoot,
    inlineStub: (i2) => compoundContext(i2),
    logger
  });
  const context = ctxRes.output;
  const signature = computeSignature(context.problem_summary);
  const existing = listSolutions(stateRoot);
  const relRes = await spawn3("compound.related", { context, signature, existing_solutions: existing }, {
    stateRoot,
    inlineStub: (i2) => compoundRelated(i2),
    logger
  });
  const related = relRes.output;
  if (related.duplicate_match && !opts.force) {
    throw new PromoteError("DuplicateMatch", `compound.related found a duplicate at ${related.duplicate_match.ref} ` + `(similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ` + `${related.dedup_stamp.threshold}). Pass --force to write anyway, ` + `or edit prevention_seed: to differentiate.`, {
      duplicate_ref: related.duplicate_match.ref,
      similarity: related.duplicate_match.similarity
    });
  }
  const now = nowIso5();
  const entry = {
    id: generateUlid4(),
    signature,
    category: context.category,
    problem: context.problem_summary,
    symptoms: context.symptoms.length > 0 ? context.symptoms : [`RED→GREEN of ${fm.feature_id} (${fm.prior_red})`],
    what_didnt_work: [],
    solution: `RED→GREEN for ${fm.feature_id} in task ${fm.task_id} (level ${fm.level}): ` + `prior-RED ${fm.prior_red} → green via ${fm.verify_command}` + (fm.evidence ? `; evidence: ${fm.evidence}` : "") + `. See body + operator's prevention_seed.`,
    prevention: seed,
    tags: context.tags.length > 0 ? Array.from(new Set([...context.tags, "tdd", "red-green"])) : ["tdd", "red-green"],
    first_seen: now,
    last_updated: now,
    times_referenced: 0,
    source_task_ids: [fm.task_id],
    related_entries: related.related_entries.length > 0 ? related.related_entries : undefined,
    confidence: "provisional"
  };
  const solutionSlug = opts.solutionSlug ?? `red-green-${fm.task_id.slice(0, 8).toLowerCase()}-${fm.feature_id}`;
  const dedupAction = opts.force && related.duplicate_match ? "user_forced" : "new_entry";
  const stamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: dedupAction
  };
  const written = await writeSolutionLocked(entry, solutionSlug, stamp, "", stateRoot);
  const promotedRef = `${entry.category}/${solutionSlug}`;
  const updatedFm = { ...fm, promoted_to: promotedRef };
  writeFileSync5(capturePath, serializeFrontmatter(updatedFm, parsed.body), "utf8");
  return {
    shipFailurePath: capturePath,
    solutionPath: written.path,
    dedupAction,
    relatedRefs: related.related_entries
  };
}
var PromoteError, PLACEHOLDER_PREFIX = "TODO: operator-fill";
var init_compound_promote = __esm(() => {
  init_compound();
  init_dedup();
  init_logger();
  init_spawn();
  init_state();
  PromoteError = class PromoteError extends Error {
    code;
    detail;
    constructor(code, message, detail) {
      super(message);
      this.name = "PromoteError";
      this.code = code;
      this.detail = detail;
    }
  };
});

// src/dispatcher/canary-promote.ts
import { existsSync as existsSync16, readFileSync as readFileSync18, writeFileSync as writeFileSync6 } from "node:fs";
import { resolve as resolve16 } from "node:path";
function nowIso6() {
  return new Date().toISOString();
}
function generateUlid5() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function shortSha2(sha) {
  return sha.slice(0, 7);
}
function extractPhaseOutput(body) {
  const re = /## Phase output excerpt\n\n([\s\S]*?)\n+## Next steps/;
  const m2 = re.exec(body);
  return m2?.[1]?.trim() ?? "";
}
async function promoteCanaryFailure(opts) {
  const stateRoot = opts.stateRoot;
  const root3 = resolveStateRoot(stateRoot);
  const canaryPath = resolve16(root3, "canaries", `${opts.slug}.md`);
  if (!existsSync16(canaryPath)) {
    throw new PromoteCanaryError("MissingCanaryFailure", `canaries/${opts.slug}.md does not exist under ${root3}. ` + `Run \`ls ${root3}/canaries/\` to see available slugs.`, { slug: opts.slug, stateRoot: root3 });
  }
  const raw = readFileSync18(canaryPath, "utf8");
  const parsed = parseFrontmatter(raw);
  const fm = parsed.data;
  if (typeof fm.promoted_to === "string" && fm.promoted_to.length > 0) {
    throw new PromoteCanaryError("AlreadyPromoted", `canaries/${opts.slug}.md already carries promoted_to: ${fm.promoted_to}. ` + `Remove the field manually to re-promote; --force does NOT override.`, { promoted_to: fm.promoted_to });
  }
  const seed = String(fm.regression_seed ?? "").trim();
  if (seed.length === 0 || seed.startsWith(PLACEHOLDER_PREFIX2)) {
    throw new PromoteCanaryError("PlaceholderRegressionSeed", `canaries/${opts.slug}.md still carries the capture-time ` + `regression_seed placeholder (or empty). Edit the file's ` + `\`regression_seed:\` frontmatter into the actual safeguard ` + `before re-running promote.`, { regression_seed: seed.slice(0, 80) });
  }
  const phaseOutput = extractPhaseOutput(parsed.body);
  const intentText = `${phaseOutput}

${fm.package_name} ${fm.failed_phase}`;
  const logger = opts.logger ?? createLogger({ stateRoot });
  const ctxRes = await spawn3("compound.context", { task_id: "(promote)", intent: intentText }, {
    stateRoot,
    inlineStub: (i2) => compoundContext(i2),
    logger
  });
  const context = ctxRes.output;
  const signature = computeSignature(context.problem_summary);
  const existing = listSolutions(stateRoot);
  const relRes = await spawn3("compound.related", { context, signature, existing_solutions: existing }, {
    stateRoot,
    inlineStub: (i2) => compoundRelated(i2),
    logger
  });
  const related = relRes.output;
  if (related.duplicate_match && !opts.force) {
    throw new PromoteCanaryError("DuplicateMatch", `compound.related found a duplicate at ${related.duplicate_match.ref} ` + `(similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ` + `${related.dedup_stamp.threshold}). Pass --force to write anyway, ` + `or edit regression_seed: to differentiate.`, {
      duplicate_ref: related.duplicate_match.ref,
      similarity: related.duplicate_match.similarity
    });
  }
  const current = readCurrentTask(stateRoot);
  const taskId = current?.task.task_id ?? `CANARY-${shortSha2(fm.commit_sha)}-${fm.failed_phase}`;
  const now = nowIso6();
  const entry = {
    id: generateUlid5(),
    signature,
    category: context.category,
    problem: context.problem_summary,
    symptoms: context.symptoms.length > 0 ? context.symptoms : [
      `captured canary failure of ${fm.package_name}@${fm.expected_version} ` + `at ${fm.failed_phase} on ${shortSha2(fm.commit_sha)}`
    ],
    what_didnt_work: [],
    solution: `Canary failure of ${fm.package_name}@${fm.expected_version} at phase ` + `${fm.failed_phase} on ${shortSha2(fm.commit_sha)}; see body for phase ` + `output excerpt + operator's regression_seed.`,
    prevention: seed,
    tags: context.tags.length > 0 ? context.tags : ["untagged"],
    first_seen: now,
    last_updated: now,
    times_referenced: 0,
    source_task_ids: [taskId],
    related_entries: related.related_entries.length > 0 ? related.related_entries : undefined,
    confidence: "provisional"
  };
  const solutionSlug = opts.solutionSlug ?? `canary-${shortSha2(fm.commit_sha)}-${fm.failed_phase}`;
  const dedupAction = opts.force && related.duplicate_match ? "user_forced" : "new_entry";
  const stamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: dedupAction
  };
  const written = await writeSolutionLocked(entry, solutionSlug, stamp, "", stateRoot);
  const promotedRef = `${entry.category}/${solutionSlug}`;
  const updatedFm = {
    ...fm,
    promoted_to: promotedRef
  };
  writeFileSync6(canaryPath, serializeFrontmatter(updatedFm, parsed.body), "utf8");
  return {
    canaryPath,
    solutionPath: written.path,
    dedupAction,
    relatedRefs: related.related_entries
  };
}
var PromoteCanaryError, PLACEHOLDER_PREFIX2 = "TODO: operator-fill";
var init_canary_promote = __esm(() => {
  init_compound();
  init_dedup();
  init_logger();
  init_spawn();
  init_state();
  PromoteCanaryError = class PromoteCanaryError extends Error {
    code;
    detail;
    constructor(code, message, detail) {
      super(message);
      this.name = "PromoteCanaryError";
      this.code = code;
      this.detail = detail;
    }
  };
});

// src/commands/compound.ts
import { existsSync as existsSync17 } from "node:fs";
function nowIso7() {
  return new Date().toISOString();
}
function generateUlid6() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
async function runCompound(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot = opts.stateRoot;
  const ct = readCurrentTask(stateRoot);
  if (!ct)
    throw new Error("no active task — run `sgc plan <task>` first");
  const taskId = ct.task.task_id;
  const level = ct.task.level;
  let intentText = "";
  if (level !== "L0" && existsSync17(intentPath(taskId, stateRoot))) {
    const intent = readIntent(taskId, stateRoot);
    intentText = `${intent.title}

${intent.motivation}`;
  } else {
    intentText = `${ct.task.task_id} (L0 task; no intent.md)`;
  }
  const reviews2 = listReviewsForStage(taskId, "code", stateRoot);
  const ctxRes = await spawn3("compound.context", { task_id: taskId, intent: intentText }, {
    stateRoot,
    inlineStub: (i2) => compoundContext(i2),
    logger,
    taskId
  });
  const context = ctxRes.output;
  const signature = computeSignature(context.problem_summary);
  const existing = listSolutions(stateRoot);
  const relRes = await spawn3("compound.related", { context, signature, existing_solutions: existing }, {
    stateRoot,
    inlineStub: (i2) => compoundRelated(i2),
    logger,
    taskId
  });
  const related = relRes.output;
  if (related.duplicate_match && !opts.force) {
    const [catRaw, slugRaw] = related.duplicate_match.ref.split("/");
    const existingFile = existing.find((s2) => s2.category === catRaw && s2.slug === slugRaw);
    if (!existingFile) {
      throw new Error(`compound.related returned ref ${related.duplicate_match.ref} but entry not on disk`);
    }
    const stamp2 = {
      compound_related_spawn_id: relRes.spawnId,
      threshold_met_or_forced: true,
      reason: "update_existing_dedup"
    };
    const updated = await writeSolutionLocked({
      ...existingFile.entry,
      source_task_ids: [...existingFile.entry.source_task_ids, taskId],
      last_updated: nowIso7()
    }, existingFile.slug, stamp2, "", stateRoot);
    log(`compound: action=update_existing ref=${related.duplicate_match.ref} similarity=${related.duplicate_match.similarity.toFixed(3)}`);
    return {
      taskId,
      action: "update_existing",
      solutionPath: updated.path,
      duplicateRef: related.duplicate_match.ref,
      reason: `similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ${related.dedup_stamp.threshold}`
    };
  }
  const [solRes, prevRes] = await Promise.all([
    spawn3("compound.solution", { context, reviews: reviews2 }, {
      stateRoot,
      inlineStub: (i2) => compoundSolution(i2),
      logger,
      taskId
    }),
    spawn3("compound.prevention", { context, solution: {} }, {
      stateRoot,
      inlineStub: () => compoundPrevention({
        context,
        solution: { solution: "", what_didnt_work: [] }
      }),
      logger,
      taskId
    })
  ]);
  const now = nowIso7();
  const entry = {
    id: generateUlid6(),
    signature,
    category: context.category,
    problem: context.problem_summary,
    symptoms: context.symptoms.length > 0 ? context.symptoms : ["(no symptoms captured)"],
    what_didnt_work: solRes.output.what_didnt_work,
    solution: solRes.output.solution,
    prevention: prevRes.output.prevention,
    tags: context.tags.length > 0 ? context.tags : ["untagged"],
    first_seen: now,
    last_updated: now,
    times_referenced: 0,
    source_task_ids: [taskId],
    related_entries: related.related_entries.length > 0 ? related.related_entries : undefined,
    confidence: "provisional"
  };
  const slug = opts.slug ?? (slugify(context.problem_summary) || `task-${taskId.slice(0, 8).toLowerCase()}`);
  const stamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: opts.force && related.duplicate_match ? "user_forced" : "new_entry"
  };
  const written = await writeSolutionLocked(entry, slug, stamp, "", stateRoot);
  log(`compound: action=compound category=${context.category} slug=${slug} related=${related.related_entries.length}`);
  return {
    taskId,
    action: "compound",
    solutionPath: written.path,
    reason: opts.force && related.duplicate_match ? `forced write despite similarity ${related.duplicate_match.similarity.toFixed(3)}` : "new solution entry created"
  };
}
var init_compound2 = __esm(() => {
  init_compound();
  init_compound_promote();
  init_canary_promote();
  init_dedup();
  init_spawn();
  init_state();
  init_logger();
});

// src/commands/ship.ts
var exports_ship = {};
__export(exports_ship, {
  runShip: () => runShip
});
import { createHash as createHash3 } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync as existsSync18 } from "node:fs";
function nowIso8() {
  return new Date().toISOString();
}
function gitDiffLineCount(cwd) {
  try {
    const out = execSync("git diff --numstat HEAD", {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "ignore"]
    });
    let total = 0;
    for (const line of out.split(`
`)) {
      const m2 = line.match(/^(\d+)\t(\d+)\t/);
      if (m2)
        total += Number(m2[1]) + Number(m2[2]);
    }
    return total;
  } catch {
    return;
  }
}
async function readLineFromStdin() {
  const stdin2 = process.stdin;
  return new Promise((resolve17) => {
    stdin2.resume();
    stdin2.setEncoding("utf8");
    let buf = "";
    const onData = (chunk) => {
      buf += chunk;
      const nl = buf.indexOf(`
`);
      if (nl !== -1) {
        stdin2.removeListener("data", onData);
        stdin2.pause();
        resolve17(buf.slice(0, nl).trim());
      }
    };
    stdin2.on("data", onData);
  });
}
async function runShip(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot = opts.stateRoot;
  const ct = readCurrentTask(stateRoot);
  if (!ct)
    throw new Error("no active task — run `sgc plan <task>` first");
  const taskId = ct.task.task_id;
  const level = ct.task.level;
  if (level === "L3" && opts.autoConfirm) {
    throw new Error("L3 ship refuses --auto (Invariant §4); human confirmation required");
  }
  const fl = readFeatureList(stateRoot);
  if (!fl)
    throw new Error("no feature-list — was the plan complete?");
  if (fl.list.features.length === 0)
    throw new Error("feature-list is empty; nothing to ship");
  const remaining = fl.list.features.filter((f3) => f3.status !== "done");
  if (remaining.length > 0) {
    throw new Error(`${remaining.length} feature(s) not done: ${remaining.map((f3) => f3.id).join(", ")}`);
  }
  if (level !== "L0") {
    if (!existsSync18(intentPath(taskId, stateRoot))) {
      throw new Error(`no decisions/${taskId}/intent.md — cannot ship L${level} without intent`);
    }
  }
  const codeReviews = listReviewsForStage(taskId, "code", stateRoot);
  if (level !== "L0" && codeReviews.length === 0) {
    throw new Error(`no code reviews for ${taskId} — run \`sgc review\` first`);
  }
  const failedWithoutOverride = codeReviews.filter((r3) => r3.verdict === "fail" && (!r3.override || (r3.override.reason ?? "").length < 40 || (r3.override.by ?? "").trim().length === 0));
  if (failedWithoutOverride.length > 0) {
    throw new Error(`${failedWithoutOverride.length} review(s) with verdict=fail need an override with reason ≥40 chars (Invariant §5)`);
  }
  let degradedAcceptance;
  if (level === "L2" || level === "L3") {
    const qaReports = listReviewsForStage(taskId, "qa", stateRoot);
    if (qaReports.length === 0) {
      throw new Error(`${level} ship requires qa evidence — run \`sgc qa <target> --flows ...\` first`);
    }
    const failedQaWithoutOverride = qaReports.filter((r3) => r3.verdict === "fail" && (!r3.override || (r3.override.reason ?? "").length < 40 || (r3.override.by ?? "").trim().length === 0));
    if (failedQaWithoutOverride.length > 0) {
      throw new Error(`${failedQaWithoutOverride.length} qa report(s) with verdict=fail need an override with reason ≥40 chars (Invariant §5)`);
    }
    const degraded = codeReviews.length > 0 && !codeReviews.some((r3) => r3.engine !== undefined && !isHeuristicMode(r3.engine));
    if (degraded) {
      const by = (opts.acceptedBy ?? "").trim();
      const reason = (opts.acceptDegradedReview ?? "").trim();
      if (by.length > 0 || reason.length > 0) {
        if (by.length === 0) {
          throw new Error(`--accept-degraded-review requires --accepted-by "<name>" — a named signer (Invariant §5)`);
        }
        if (reason.length < 40) {
          throw new Error(`--accept-degraded-review reason must be ≥40 chars (Invariant §5); got ${reason.length}`);
        }
        degradedAcceptance = { by, at: nowIso8(), reason };
        log(`⚠ shipped on a heuristic-only review, accepted by ${by}: ${reason}`);
      } else {
        throw new Error(`${level} ship blocked: every code review is heuristic (no LLM was configured), so the ` + `correctness gate verified only that a report exists — not that the code was reviewed ` + `(audit F1). Either configure an LLM (OPENROUTER_API_KEY, or the claude CLI) and re-run ` + `\`sgc review\`, or accept the degraded review explicitly: ` + `sgc ship --accepted-by "<name>" --accept-degraded-review "<why, ≥40 chars>".`);
      }
    }
  }
  if (opts.createPr && level !== "L0") {
    const check = opts.upstreamCheck ?? defaultUpstreamCheck;
    const u3 = await check();
    if (u3.upstream === null) {
      throw new Error(`current branch '${u3.branch}' has no upstream — run \`git push -u origin ${u3.branch}\` before \`sgc ship --pr\`. ship.md NOT written.`);
    }
  }
  if (level === "L3") {
    log("");
    log("=== L3 SHIP SUMMARY — confirm before ship.md is written (immutable) ===");
    log(`  task_id:        ${taskId}`);
    log(`  features done:  ${fl.list.features.length}`);
    log(`  code reviews:   ${codeReviews.length}`);
    log(`  qa evidence:    yes`);
    log("");
    log("Type 'yes' to ship (or Ctrl+C to abort):");
    const reader = opts.readConfirmation ?? readLineFromStdin;
    const answer = (await reader()).trim().toLowerCase();
    if (answer !== "yes") {
      throw new Error(`L3 ship not confirmed at stdin (got '${answer || "(empty)"}'); ship.md NOT written.`);
    }
    log("confirmed — writing ship.md");
  }
  let shipFilePath = null;
  if (level !== "L0") {
    const ship = {
      task_id: taskId,
      shipped_at: nowIso8(),
      outcome: "success",
      deviations: [],
      residuals: [],
      linked_reviews: codeReviews.map((r3) => r3.report_id),
      ...degradedAcceptance ? { degraded_review_acceptance: degradedAcceptance } : {}
    };
    shipFilePath = writeShip(ship, "", stateRoot);
    log(`wrote ${shipFilePath}`);
  } else {
    log(`L0 task: skipping ship.md per schema (decisions/ not written for L0)`);
  }
  writeCurrentTask({
    ...ct.task,
    active_feature: undefined,
    last_activity: nowIso8()
  }, "", stateRoot);
  let prUrl;
  if (opts.createPr) {
    if (level === "L0") {
      log(`L0 task: skipping PR creation (L0 tasks typically don't merit a PR)`);
    } else {
      const runner = opts.ghRunner ?? defaultGhRunner;
      const intent = readIntent(taskId, stateRoot);
      const title = opts.prTitle ?? `sgc ship: ${intent.title}`.slice(0, 200);
      const body = opts.prBody ?? [
        `Automated PR from \`sgc ship\`.`,
        ``,
        `- **Task**: \`${taskId}\``,
        `- **Level**: ${level}`,
        `- **Code reviews**: ${codeReviews.length}`,
        shipFilePath ? `- **Ship record**: \`${shipFilePath}\`` : "",
        ``,
        `See \`decisions/${taskId}/intent.md\` for the full plan.`
      ].filter(Boolean).join(`
`);
      log(`creating PR via gh pr create…`);
      try {
        const res = await runner.createPr({ title, body });
        prUrl = res.url;
        log(`PR: ${prUrl}`);
      } catch (e2) {
        log(`PR creation failed: ${e2.message}`);
        throw e2;
      }
    }
  }
  let janitorDecision;
  let compoundAction;
  if (opts.janitorSkipReason !== undefined) {
    const reason = opts.janitorSkipReason.trim();
    if (reason.length < 40) {
      throw new Error(`--janitor-skip-reason must be ≥40 chars (got ${reason.length}). Invariant §6 forbids silent skips; supply a real justification.`);
    }
    const inputs_hash = createHash3("sha256").update(`user_opt_out:${reason}`).digest("hex");
    const skipDecision = {
      task_id: taskId,
      decision: "skip",
      reason_code: "user_opt_out",
      reason_human: reason,
      inputs_hash,
      created_at: nowIso8()
    };
    const decisionPath = writeJanitorDecision(skipDecision, "", stateRoot);
    janitorDecision = {
      decision: "skip",
      reason_code: "user_opt_out",
      reason_human: reason
    };
    log(`janitor.compound: skip (user_opt_out) — reason logged`);
    log(`  logged to: ${decisionPath}`);
  } else if (opts.runJanitor !== false) {
    const janitorInput = {
      task_id: taskId,
      level,
      outcome: "success",
      reviewer_flags: codeReviews.map((r3) => ({
        severity: r3.severity,
        novel: undefined
      })),
      force: opts.forceCompound ?? false,
      diff_lines: (opts.diffLineCount ?? gitDiffLineCount)()
    };
    const jRes = await spawn3("janitor.compound", janitorInput, {
      stateRoot,
      inlineStub: (i2) => janitorCompound(i2),
      logger,
      taskId
    });
    janitorDecision = jRes.output;
    const inputs_hash = createHash3("sha256").update(JSON.stringify(janitorInput)).digest("hex");
    const decisionRecord = {
      task_id: taskId,
      decision: janitorDecision.decision,
      reason_code: janitorDecision.reason_code,
      reason_human: janitorDecision.reason_human,
      inputs_hash,
      created_at: nowIso8()
    };
    const decisionPath = writeJanitorDecision(decisionRecord, "", stateRoot);
    log(`janitor.compound: ${janitorDecision.decision} (${janitorDecision.reason_code})`);
    log(`  logged to: ${decisionPath}`);
    if (janitorDecision.decision === "compound" || janitorDecision.decision === "update_existing") {
      try {
        const c3 = await runCompound({
          stateRoot,
          force: opts.forceCompound,
          log: () => {}
        });
        compoundAction = c3.action;
        log(`compound: action=${c3.action}${c3.duplicateRef ? ` ref=${c3.duplicateRef}` : ""}`);
      } catch (e2) {
        log(`compound failed: ${e2.message}`);
      }
    }
  }
  const handoff = {
    from_session: taskId,
    to_session_hint: "next task",
    summary: `Task ${taskId} shipped at level ${level}.`,
    open_questions: []
  };
  writeHandoff(handoff, `Task ${taskId} shipped. Ready for next task.
`, stateRoot);
  log(`shipped ${taskId} (${level})`);
  return { taskId, shipPath: shipFilePath, prUrl, janitorDecision, compoundAction };
}
var init_ship = __esm(() => {
  init_state();
  init_state();
  init_gh_runner();
  init_spawn();
  init_janitor_compound();
  init_compound2();
  init_types();
  init_logger();
});

// src/commands/compound.ts
var exports_compound = {};
__export(exports_compound, {
  runRedGreenPromote: () => runRedGreenPromote,
  runCompoundPromote: () => runCompoundPromote,
  runCompound: () => runCompound2,
  runCanaryPromote: () => runCanaryPromote
});
import { existsSync as existsSync19 } from "node:fs";
function nowIso9() {
  return new Date().toISOString();
}
function generateUlid7() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function slugify2(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
async function runCompound2(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot = opts.stateRoot;
  const ct = readCurrentTask(stateRoot);
  if (!ct)
    throw new Error("no active task — run `sgc plan <task>` first");
  const taskId = ct.task.task_id;
  const level = ct.task.level;
  let intentText = "";
  if (level !== "L0" && existsSync19(intentPath(taskId, stateRoot))) {
    const intent = readIntent(taskId, stateRoot);
    intentText = `${intent.title}

${intent.motivation}`;
  } else {
    intentText = `${ct.task.task_id} (L0 task; no intent.md)`;
  }
  const reviews2 = listReviewsForStage(taskId, "code", stateRoot);
  const ctxRes = await spawn3("compound.context", { task_id: taskId, intent: intentText }, {
    stateRoot,
    inlineStub: (i2) => compoundContext(i2),
    logger,
    taskId
  });
  const context = ctxRes.output;
  const signature = computeSignature(context.problem_summary);
  const existing = listSolutions(stateRoot);
  const relRes = await spawn3("compound.related", { context, signature, existing_solutions: existing }, {
    stateRoot,
    inlineStub: (i2) => compoundRelated(i2),
    logger,
    taskId
  });
  const related = relRes.output;
  if (related.duplicate_match && !opts.force) {
    const [catRaw, slugRaw] = related.duplicate_match.ref.split("/");
    const existingFile = existing.find((s2) => s2.category === catRaw && s2.slug === slugRaw);
    if (!existingFile) {
      throw new Error(`compound.related returned ref ${related.duplicate_match.ref} but entry not on disk`);
    }
    const stamp2 = {
      compound_related_spawn_id: relRes.spawnId,
      threshold_met_or_forced: true,
      reason: "update_existing_dedup"
    };
    const updated = await writeSolutionLocked({
      ...existingFile.entry,
      source_task_ids: [...existingFile.entry.source_task_ids, taskId],
      last_updated: nowIso9()
    }, existingFile.slug, stamp2, "", stateRoot);
    log(`compound: action=update_existing ref=${related.duplicate_match.ref} similarity=${related.duplicate_match.similarity.toFixed(3)}`);
    return {
      taskId,
      action: "update_existing",
      solutionPath: updated.path,
      duplicateRef: related.duplicate_match.ref,
      reason: `similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ${related.dedup_stamp.threshold}`
    };
  }
  const [solRes, prevRes] = await Promise.all([
    spawn3("compound.solution", { context, reviews: reviews2 }, {
      stateRoot,
      inlineStub: (i2) => compoundSolution(i2),
      logger,
      taskId
    }),
    spawn3("compound.prevention", { context, solution: {} }, {
      stateRoot,
      inlineStub: () => compoundPrevention({
        context,
        solution: { solution: "", what_didnt_work: [] }
      }),
      logger,
      taskId
    })
  ]);
  const now = nowIso9();
  const entry = {
    id: generateUlid7(),
    signature,
    category: context.category,
    problem: context.problem_summary,
    symptoms: context.symptoms.length > 0 ? context.symptoms : ["(no symptoms captured)"],
    what_didnt_work: solRes.output.what_didnt_work,
    solution: solRes.output.solution,
    prevention: prevRes.output.prevention,
    tags: context.tags.length > 0 ? context.tags : ["untagged"],
    first_seen: now,
    last_updated: now,
    times_referenced: 0,
    source_task_ids: [taskId],
    related_entries: related.related_entries.length > 0 ? related.related_entries : undefined,
    confidence: "provisional"
  };
  const slug = opts.slug ?? (slugify2(context.problem_summary) || `task-${taskId.slice(0, 8).toLowerCase()}`);
  const stamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: opts.force && related.duplicate_match ? "user_forced" : "new_entry"
  };
  const written = await writeSolutionLocked(entry, slug, stamp, "", stateRoot);
  log(`compound: action=compound category=${context.category} slug=${slug} related=${related.related_entries.length}`);
  return {
    taskId,
    action: "compound",
    solutionPath: written.path,
    reason: opts.force && related.duplicate_match ? `forced write despite similarity ${related.duplicate_match.similarity.toFixed(3)}` : "new solution entry created"
  };
}
async function runCompoundPromote(opts) {
  return promoteShipFailure(opts);
}
async function runRedGreenPromote(opts) {
  return promoteRedGreen(opts);
}
async function runCanaryPromote(opts) {
  return promoteCanaryFailure(opts);
}
var init_compound3 = __esm(() => {
  init_compound();
  init_compound_promote();
  init_canary_promote();
  init_dedup();
  init_spawn();
  init_state();
  init_logger();
});

// src/dispatcher/state.ts
var exports_state = {};
__export(exports_state, {
  writeSolutionLocked: () => writeSolutionLocked,
  writeSolution: () => writeSolution,
  writeShip: () => writeShip,
  writeRedGreenCapture: () => writeRedGreenCapture,
  writePlanDoc: () => writePlanDoc,
  writeJanitorDecision: () => writeJanitorDecision,
  writeIntent: () => writeIntent,
  writeHandoff: () => writeHandoff,
  writeFeatureList: () => writeFeatureList,
  writeCurrentTask: () => writeCurrentTask,
  writeAtomic: () => writeAtomic,
  wordCount: () => wordCount,
  solutionPath: () => solutionPath,
  solutionLockPath: () => solutionLockPath,
  shipPath: () => shipPath,
  serializeFrontmatter: () => serializeFrontmatter,
  reviewPath: () => reviewPath,
  resolveStateRoot: () => resolveStateRoot,
  readSolution: () => readSolution,
  readShip: () => readShip,
  readReview: () => readReview,
  readJanitorDecision: () => readJanitorDecision,
  readIntent: () => readIntent,
  readHandoff: () => readHandoff,
  readFeatureList: () => readFeatureList,
  readCurrentTask: () => readCurrentTask,
  parseFrontmatter: () => parseFrontmatter,
  listSolutions: () => listSolutions,
  listReviewsForStage: () => listReviewsForStage,
  janitorDecisionPath: () => janitorDecisionPath,
  intentPath: () => intentPath,
  hasQaEvidence: () => hasQaEvidence,
  ensureSgcStructure: () => ensureSgcStructure,
  deleteSolution: () => deleteSolution,
  appendReview: () => appendReview,
  StateError: () => StateError,
  RED_GREEN_PLACEHOLDER: () => RED_GREEN_PLACEHOLDER
});
var init_state2 = __esm(() => {
  init_atomic();
  init_decisions();
  init_progress();
  init_reviews();
  init_solutions();
});

// src/commands/tail.ts
var exports_tail = {};
__export(exports_tail, {
  runTail: () => runTail
});
import { closeSync as closeSync3, existsSync as existsSync20, openSync as openSync3, readSync, statSync as statSync4 } from "node:fs";
import { resolve as resolve17 } from "node:path";
function globMatch(pattern, value) {
  if (value === null)
    return false;
  const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return re.test(value);
}
function matchFilters(e2, opts) {
  if (opts.task && e2.task_id !== opts.task)
    return false;
  if (opts.agent && !globMatch(opts.agent, e2.agent))
    return false;
  if (opts.eventType && !e2.event_type.includes(opts.eventType))
    return false;
  if (opts.since && e2.ts < opts.since)
    return false;
  return true;
}
function eventsPath(stateRoot) {
  const root3 = stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc";
  return resolve17(root3, "progress/events.ndjson");
}
function parseLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (parsed.schema_version !== 1)
      return null;
    return parsed;
  } catch {
    return null;
  }
}
function briefPayload(eventType, payload) {
  switch (eventType) {
    case "spawn.start":
      return `mode=${payload["mode"]}`;
    case "spawn.end":
      return `${payload["outcome"]} ${payload["elapsed_ms"]}ms`;
    case "llm.request":
      return `model=${payload["model"]} chars=${payload["prompt_chars"]}`;
    case "llm.response": {
      const tokenInfo = payload["input_tokens"] !== undefined ? ` in=${payload["input_tokens"]} out=${payload["output_tokens"]}` : "";
      return `${payload["outcome"]} ${payload["latency_ms"]}ms${tokenInfo}`;
    }
    default: {
      const keys = Object.keys(payload);
      return keys.length === 0 ? "…" : `… (${keys.length} fields)`;
    }
  }
}
function formatHuman(e2) {
  const time = e2.ts.slice(11, 23);
  const spawnHead = (e2.spawn_id ?? "").split("-")[0].slice(0, 12).padEnd(12, " ");
  const agent = (e2.agent ?? "").padEnd(18);
  const brief = briefPayload(e2.event_type, e2.payload);
  return `${time}  ${e2.level.padEnd(5)}  ${e2.event_type.padEnd(18)}  ${spawnHead}  ${agent}  ${brief}`;
}
async function runTail(opts = {}) {
  const say = opts.log ?? ((m2) => console.log(m2));
  const path2 = eventsPath(opts.stateRoot);
  let offset = 0;
  let lastSize = 0;
  let initialDrainDone = false;
  const emitFromBuffer = (buf, applyLimit) => {
    const lines = buf.split(`
`).filter((l2) => l2.length > 0);
    const matched = [];
    for (const line of lines) {
      const rec = parseLine(line);
      if (!rec) {
        console.error(`[sgc tail] malformed line skipped: ${line.slice(0, 80)}`);
        continue;
      }
      if (!matchFilters(rec, opts))
        continue;
      matched.push(opts.json ? line : formatHuman(rec));
    }
    let out;
    if (applyLimit && opts.limit !== undefined && opts.limit >= 0) {
      out = opts.limit === 0 ? [] : matched.slice(-opts.limit);
    } else {
      out = matched;
    }
    for (const m2 of out)
      say(m2);
  };
  const readNew = () => {
    if (!existsSync20(path2))
      return;
    const sz = statSync4(path2).size;
    if (sz < lastSize) {
      offset = 0;
    }
    lastSize = sz;
    if (sz <= offset)
      return;
    const fd = openSync3(path2, "r");
    try {
      const buf = Buffer.alloc(sz - offset);
      readSync(fd, buf, 0, buf.length, offset);
      offset = sz;
      emitFromBuffer(buf.toString("utf8"), !initialDrainDone);
    } finally {
      closeSync3(fd);
    }
  };
  readNew();
  initialDrainDone = true;
  if (!opts.follow)
    return;
  const interval = opts.pollIntervalMs ?? 500;
  await new Promise((resolvePromise) => {
    const timer = setInterval(readNew, interval);
    if (opts.abortSignal) {
      if (opts.abortSignal.aborted) {
        clearInterval(timer);
        resolvePromise();
        return;
      }
      opts.abortSignal.addEventListener("abort", () => {
        clearInterval(timer);
        resolvePromise();
      }, { once: true });
    }
  });
}
var init_tail = () => {};

// src/commands/agent-loop.ts
var exports_agent_loop = {};
__export(exports_agent_loop, {
  runAgentLoop: () => runAgentLoop
});
import { existsSync as existsSync21, readFileSync as readFileSync19 } from "node:fs";
function stateRoot(custom) {
  return custom ?? process.env["SGC_STATE_ROOT"] ?? ".sgc";
}
async function readAllStdin() {
  const chunks = [];
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin)
    chunks.push(chunk);
  return chunks.join("");
}
async function runAgentLoop(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const root3 = stateRoot(opts.stateRoot);
  if (opts.list) {
    const all = listAllSpawns(root3);
    if (all.length === 0) {
      log(`no spawns under ${root3}/progress/agent-prompts/`);
      return { action: "list" };
    }
    const pending2 = all.filter((s2) => !s2.hasResult).length;
    log(`${all.length} spawn(s) (${pending2} pending):`);
    for (const s2 of all) {
      const marker = s2.hasResult ? "[x]" : "[ ]";
      log(`  ${marker} ${s2.spawnId}`);
    }
    return { action: "list" };
  }
  if (opts.show) {
    const pp = promptPath(opts.show, root3);
    if (!existsSync21(pp)) {
      throw new Error(`prompt file not found: ${pp}`);
    }
    log(readFileSync19(pp, "utf8"));
    return { action: "show" };
  }
  if (opts.submit) {
    const { agentName } = parseSpawnId(opts.submit);
    const manifest = getSubagentManifest(agentName);
    if (!manifest) {
      throw new Error(`unknown agent '${agentName}' (from spawn_id ${opts.submit})`);
    }
    const pp = promptPath(opts.submit, root3);
    const rp = resultPath(opts.submit, root3);
    if (!existsSync21(pp)) {
      throw new Error(`no prompt file for ${opts.submit}; maybe typo, or the spawn was never requested`);
    }
    if (existsSync21(rp)) {
      throw new Error(`result already written for ${opts.submit}; submissions are one-shot`);
    }
    const text = opts.fromFile ? readFileSync19(opts.fromFile, "utf8") : await (opts.readStdin ?? readAllStdin)();
    const stripped = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)?.[1] ?? text;
    const parsed = load(stripped);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("submitted YAML must parse to an object");
    }
    validateOutputShape(manifest, parsed);
    const leak = scanOutputForLeak(agentName, parsed, getFingerprintsCached(root3));
    if (leak.hit) {
      logger.event({
        task_id: null,
        spawn_id: opts.submit,
        agent: agentName,
        event_type: "submit.rejected",
        level: "error",
        payload: { reason: "invariant_1_output_leak", match_count: leak.count }
      });
      throw new Error(`Invariant §1 violation (output leak): submitted result for ${agentName} contains ${leak.count} line(s) matching solutions/ content. ` + `Sample(s): ${leak.samples.map((s2) => `"${s2}"`).join(", ")}. ` + `Reviewers and qa agents must stay amnesiac to past solutions — see sgc-invariants.md §1.`);
    }
    writeAtomic(rp, serializeFrontmatter(parsed, ""));
    log(`wrote ${rp}`);
    return { action: "submit", submittedTo: rp };
  }
  const pending = listPendingSpawns(root3);
  if (pending.length === 0) {
    log(`no pending spawns; dispatcher has nothing to process`);
    return { action: "interactive" };
  }
  const next = pending[0];
  const { agentName: nextAgent } = parseSpawnId(next.spawnId);
  log(`Next pending: ${next.spawnId}`);
  log(``);
  log(`Prompt:  ${next.promptPath}`);
  log(`Reply:   ${next.resultPath}`);
  log(``);
  if (process.env["CLAUDE_PLUGIN_ROOT"]) {
    log(`Inside Claude Code session — invoke via Task() directly:`);
    log(`  Task({ subagent_type: "${nextAgent}", prompt: <prompt body>, ... })`);
    log(`Then submit the YAML output:`);
    log(`  sgc agent-loop --submit ${next.spawnId} --from <yaml-file>`);
    log(``);
    log(`(file-poll dispatch is disabled inside Claude Code per P3#10; ` + `set SGC_USE_FILE_AGENTS=0 or use anthropic-sdk/openrouter for direct LLM dispatch)`);
  } else {
    log(`Read the prompt, then submit via:`);
    log(`  sgc agent-loop --submit ${next.spawnId} --from <yaml-file>`);
    log(`  cat <yaml-file> | sgc agent-loop --submit ${next.spawnId}`);
  }
  log(``);
  log(`(${pending.length - 1} more pending after this)`);
  return { action: "interactive" };
}
var init_agent_loop = __esm(() => {
  init_js_yaml();
  init_schema();
  init_fingerprint();
  init_spawn_protocol();
  init_state();
  init_validation();
  init_logger();
});

// src/dispatcher/agent-facts.ts
function fallbackTerms(id) {
  switch (id) {
    case "reviewer.security":
      return displayList(SECURITY.terms);
    case "reviewer.migration":
      return displayList(MIGRATION.terms);
    case "reviewer.performance":
      return displayList(PERFORMANCE.terms);
    case "reviewer.infra":
      return displayList(INFRA.terms);
    default:
      throw new Error(`${id} has no term list`);
  }
}
function severityOf(id) {
  switch (id) {
    case "reviewer.security":
      return SECURITY.severity;
    case "reviewer.migration":
      return MIGRATION.severity;
    case "reviewer.performance":
      return PERFORMANCE.severity;
    case "reviewer.infra":
      return INFRA.severity;
    case "reviewer.tests":
      return TESTS_SEVERITY;
    case "reviewer.maintainability":
      return MAINTAINABILITY_SEVERITY;
    default:
      throw new Error(`${id} has no severity`);
  }
}
function spawnCaveat(agentId) {
  const spec = DIFF_CONDITIONAL_SPECIALISTS.find((s2) => s2.name === agentId);
  if (!spec)
    return "";
  const extra = spec.triggerOnly.length > 0 ? ` It also spawns on ${displayList(spec.triggerOnly)}, which the matcher never reports on.` : "";
  return ` Its spawn trigger is wider than that matcher in scope: it tests the whole diff — file headers, context lines, removed lines — while the matcher reads only added lines.${extra} So a spawned reviewer reporting zero findings is not evidence of a clean diff.`;
}
function deriveCliFact(agentId) {
  if (!DERIVED_AGENT_IDS.includes(agentId)) {
    throw new Error(`${agentId} is not in the derived set — see DERIVED_AGENT_IDS`);
  }
  const m2 = getSubagentManifest(agentId);
  if (!m2)
    throw new Error(`${agentId} has no manifest entry`);
  if (m2.status === "slot-only" || m2.status === "manual-only") {
    const why = agentId === "janitor.archive" ? "there is no archive command and no janitor-archive module" : "this id is not wired into the CLI";
    return `${CLI_FACT_MARKER} ${why} (manifest status: ${m2.status}), so \`sgc review\` never produces a result for it — Claude Code dispatch is the only executor.`;
  }
  if (m2.prompt_path) {
    const fb = agentId === "reviewer.tests" ? `${TESTS_MECHANISM} that only asks whether source files changed without any test file changing, at ${severityOf(agentId)} severity` : `a keyword matcher (${fallbackTerms(agentId)}) at ${severityOf(agentId)} severity`;
    return `${CLI_FACT_MARKER} ${NO_BODY} — with an API key it runs ${m2.prompt_path}; without one it falls back to ${fb}.${spawnCaveat(agentId)}`;
  }
  if (agentId === "reviewer.maintainability") {
    return `${CLI_FACT_MARKER} ${NO_BODY} — there, reviewer.maintainability is a heuristic matcher over added lines: longer than ${MAX_LINE} characters, or carrying a suppression marker (${displayList(MAINT_MARKER_TERMS)}, matched case-sensitively), at ${severityOf(agentId)} severity. That is the whole of it: no function length, no file size, no naming, coupling or design analysis.`;
  }
  return `${CLI_FACT_MARKER} ${NO_BODY} — there, ${agentId} is a heuristic keyword matcher over added lines (${fallbackTerms(agentId)}) at ${severityOf(agentId)} severity, which matches words about the problem rather than detecting it.${spawnCaveat(agentId)}`;
}
var CLI_FACT_MARKER = "Separate fact for sgc CLI users:", DERIVED_AGENT_IDS, NO_BODY = "`sgc review` does not run this file's body";
var init_agent_facts = __esm(() => {
  init_schema();
  init_reviewer_specialists();
  init_reviewer_quality();
  DERIVED_AGENT_IDS = [
    "reviewer.security",
    "reviewer.tests",
    "reviewer.performance",
    "reviewer.maintainability",
    "reviewer.migration",
    "reviewer.infra",
    "reviewer.adversarial",
    "reviewer.spec",
    "janitor.archive"
  ];
});

// src/dispatcher/loop.ts
import { existsSync as existsSync22, readdirSync as readdirSync7, readFileSync as readFileSync20 } from "node:fs";
import { mkdir as mkdir4 } from "node:fs/promises";
import { resolve as resolve18 } from "node:path";
function generateUlid8() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function loopRunsDir(stateRoot2) {
  return resolve18(resolveStateRoot(stateRoot2), "loop-runs");
}
function runPath(stateRoot2, runId) {
  return resolve18(loopRunsDir(stateRoot2), `${runId}.md`);
}
function loopClaimLockPath(stateRoot2) {
  return resolve18(loopRunsDir(stateRoot2), ".claim.lock");
}
function runExecLockPath(stateRoot2, runId) {
  return resolve18(loopRunsDir(stateRoot2), `.${runId}.exec.lock`);
}
function readRun(path2) {
  const text = readFileSync20(path2, "utf8");
  try {
    const { data } = parseFrontmatter(text);
    return data;
  } catch (err) {
    throw new LoopError("MalformedRunFile", `failed to parse ${path2}: ${String(err)}`);
  }
}
function writeRun(path2, run) {
  const content = serializeFrontmatter(run, "");
  writeAtomic(path2, content);
}
function freshSteps() {
  return STEPS.map((step) => ({ step, status: "pending" }));
}
function findStep(run, name) {
  const entry = run.steps.find((s2) => s2.step === name);
  if (!entry) {
    throw new LoopError("MalformedRunFile", `run ${run.run_id} missing step entry for "${name}"`);
  }
  return entry;
}
async function runLoop(task, opts) {
  const stateRoot2 = opts.stateRoot;
  const now = opts.now ?? Date.now;
  const ulid = opts.ulid ?? generateUlid8;
  await mkdir4(loopRunsDir(stateRoot2), { recursive: true });
  let run;
  let runFilePath;
  if (opts.resume) {
    runFilePath = runPath(stateRoot2, opts.resume);
    if (!existsSync22(runFilePath)) {
      throw new LoopError("RunNotFound", `loop-runs/${opts.resume}.md does not exist under ${resolveStateRoot(stateRoot2)}`, { run_id: opts.resume });
    }
    run = readRun(runFilePath);
  } else {
    if (!task) {
      throw new LoopError("RunNotFound", "task arg required for fresh runLoop (or pass opts.resume)");
    }
    let releaseClaimLock;
    try {
      releaseClaimLock = acquireFileLock(loopClaimLockPath(stateRoot2));
    } catch (err) {
      if (err instanceof LockHeldError) {
        throw new LoopError("ConcurrentRunActive", `another loop start is in progress (holder pid=${err.holderPid}). Retry once it completes.`, { active_pid: err.holderPid });
      }
      throw err;
    }
    try {
      for (const prior of listRunsRaw(stateRoot2)) {
        if (prior.status === "running" || prior.status === "paused" || prior.status === "failed") {
          const sameTask = prior.task === task;
          const detail = sameTask ? `another loop run for task "${task}" is ${prior.status} (run_id=${prior.run_id}). Continue with: sgc loop --resume ${prior.run_id} (or delete the run file to start over).` : `a different loop run is ${prior.status} (run_id=${prior.run_id}, task="${prior.task}"). Finish it with: sgc loop --resume ${prior.run_id} (or delete the run file) before starting a new loop.`;
          throw new LoopError("ConcurrentRunActive", detail, {
            active_run_id: prior.run_id,
            active_status: prior.status
          });
        }
      }
      const run_id = ulid();
      const startedIso = new Date(now()).toISOString();
      run = {
        run_id,
        task,
        started_at: startedIso,
        last_updated_at: startedIso,
        current_step: "plan",
        status: "running",
        steps: freshSteps()
      };
      runFilePath = runPath(stateRoot2, run_id);
      writeRun(runFilePath, run);
    } finally {
      releaseClaimLock();
    }
  }
  let releaseExecLock;
  const execLockPath = runExecLockPath(stateRoot2, run.run_id);
  try {
    releaseExecLock = acquireFileLock(execLockPath);
  } catch (err) {
    if (err instanceof LockHeldError) {
      throw new LoopError("ConcurrentRunActive", `loop run ${run.run_id} is already in progress (holder pid=${err.holderPid}, lock=${execLockPath}). ` + `Wait for it to finish or park, then resume. If that pid is not an sgc run — a reboot can leave the ` + `lock behind — delete ${execLockPath} and resume.`, { run_id: run.run_id, active_pid: err.holderPid, lock_path: execLockPath });
    }
    throw err;
  }
  try {
    const steps = opts.steps;
    if (!steps?.plan || !steps.review || !steps.qa || !steps.compound) {
      throw new LoopError("MissingStepRunners", `runLoop requires opts.steps with all of plan/review/qa/compound — the command layer ` + `(commands/loop.ts) supplies the production runners, tests inject their own. This is a wiring error.`, { run_id: run.run_id, reason: "missing_step_runners" });
    }
    const runners = steps;
    for (const stepName of STEPS) {
      const entry = findStep(run, stepName);
      if (entry.status === "done" || entry.status === "skipped")
        continue;
      if (entry.status === "paused") {
        entry.status = "done";
        entry.completed_at = new Date(now()).toISOString();
        run.last_updated_at = entry.completed_at;
        writeRun(runFilePath, run);
        continue;
      }
      if (MANUAL_GATES.has(stepName)) {
        entry.status = "paused";
        entry.started_at = new Date(now()).toISOString();
        run.current_step = stepName;
        run.status = "paused";
        run.last_updated_at = entry.started_at;
        delete run.failed_step;
        delete run.error;
        delete run.error_code;
        writeRun(runFilePath, run);
        const pauseReason = stepName === "work" ? "paused_work" : stepName === "qa" ? "paused_qa" : "paused_ship";
        return { run, terminal_reason: pauseReason };
      }
      entry.status = "in_progress";
      entry.started_at = new Date(now()).toISOString();
      run.current_step = stepName;
      run.status = "running";
      try {
        if (stepName === "plan") {
          const out = await runners.plan(run, opts);
          run.task_id = out.task_id;
          run.level = out.level;
          entry.output_ref = out.task_id;
          if (run.level === "L0") {
            for (const skipName of ["review", "qa", "ship", "compound"]) {
              const skipEntry = findStep(run, skipName);
              if (skipEntry.status === "pending") {
                skipEntry.status = "skipped";
                skipEntry.completed_at = new Date(now()).toISOString();
              }
            }
          }
        } else if (stepName === "review") {
          await runners.review(run, opts);
        } else if (stepName === "qa") {
          await runners.qa(run, opts);
        } else if (stepName === "compound") {
          await runners.compound(run, opts);
        }
        entry.status = "done";
        entry.completed_at = new Date(now()).toISOString();
        delete entry.error;
        run.last_updated_at = entry.completed_at;
        delete run.failed_step;
        delete run.error;
        delete run.error_code;
        writeRun(runFilePath, run);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        entry.status = "failed";
        entry.error = msg;
        entry.completed_at = new Date(now()).toISOString();
        run.status = "failed";
        run.failed_step = stepName;
        run.error = msg;
        if (err instanceof LoopError)
          run.error_code = err.code;
        else
          delete run.error_code;
        run.last_updated_at = entry.completed_at;
        run.current_step = stepName;
        writeRun(runFilePath, run);
        return { run, terminal_reason: "failed" };
      }
    }
    run.status = "complete";
    run.current_step = "done";
    run.last_updated_at = new Date(now()).toISOString();
    delete run.failed_step;
    delete run.error;
    delete run.error_code;
    writeRun(runFilePath, run);
    return { run, terminal_reason: "complete" };
  } finally {
    releaseExecLock();
  }
}
function listRunsRaw(stateRoot2) {
  const dir = loopRunsDir(stateRoot2);
  if (!existsSync22(dir))
    return [];
  const out = [];
  for (const fn of readdirSync7(dir)) {
    if (!fn.endsWith(".md"))
      continue;
    try {
      out.push(readRun(resolve18(dir, fn)));
    } catch {}
  }
  return out;
}
async function listLoopRuns(opts = {}) {
  const out = listRunsRaw(opts.stateRoot);
  out.sort((a2, b2) => b2.started_at.localeCompare(a2.started_at));
  return out;
}
async function showLoopRun(runId, opts = {}) {
  const path2 = runPath(opts.stateRoot, runId);
  if (!existsSync22(path2)) {
    throw new LoopError("RunNotFound", `loop-runs/${runId}.md not found under ${resolveStateRoot(opts.stateRoot)}`, { run_id: runId });
  }
  return readRun(path2);
}
var STEPS, MANUAL_GATES, LoopError;
var init_loop = __esm(() => {
  init_state();
  init_file_lock();
  STEPS = [
    "plan",
    "work",
    "review",
    "qa",
    "ship",
    "compound"
  ];
  MANUAL_GATES = new Set(["work", "qa", "ship"]);
  LoopError = class LoopError extends Error {
    code;
    detail;
    constructor(code, message, detail) {
      super(message);
      this.name = "LoopError";
      this.code = code;
      this.detail = detail;
    }
  };
});

// package.json
var package_default2;
var init_package = __esm(() => {
  package_default2 = {
    name: "@sdsrs/sgc",
    version: "1.38.1",
    description: "All-in-one engineering workflow & knowledge engine for Claude Code: L0-L3 task classification, 13 runtime invariants, code review, browser QA, security review, and a deduplicated knowledge base that compounds across tasks. Self-contained — one-command install, Node-only, no other plugins required.",
    type: "module",
    bin: {
      sgc: "./plugins/sgc/bin/sgc.mjs"
    },
    files: [
      "plugins/sgc/bin/sgc.mjs",
      "README.md",
      "LICENSE",
      "CHANGELOG.md"
    ],
    engines: {
      node: ">=18"
    },
    publishConfig: {
      access: "public",
      provenance: true
    },
    repository: {
      type: "git",
      url: "git+https://github.com/sdsrss/sgc.git"
    },
    bugs: {
      url: "https://github.com/sdsrss/sgc/issues"
    },
    homepage: "https://github.com/sdsrss/sgc#readme",
    keywords: [
      "claude-code",
      "ai-coding",
      "task-classifier",
      "invariants",
      "knowledge-engine",
      "dispatcher",
      "dedup"
    ],
    scripts: {
      "build:cli": "node scripts/build-cli.mjs",
      typecheck: "tsc --noEmit",
      test: "SGC_FORCE_INLINE=1 bun test tests/dispatcher",
      "test:eval": "bun test tests/eval",
      "test:all": "SGC_FORCE_INLINE=1 bun test tests/"
    },
    author: {
      name: "SDS"
    },
    license: "MIT",
    devDependencies: {
      "@types/bun": "latest",
      "@types/js-yaml": "^4.0.9",
      typescript: "^6.0.3"
    },
    dependencies: {
      "@anthropic-ai/sdk": "^0.91.1",
      citty: "^0.1.6",
      "js-yaml": "^4.1.1"
    },
    optionalDependencies: {
      playwright: "^1.52.0"
    }
  };
});

// src/dispatcher/metrics.ts
import { readFileSync as readFileSync21, statSync as statSync5 } from "node:fs";
import { resolve as resolve19, dirname as dirname5 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function computeStandardization(invariantYaml) {
  const doc = load(invariantYaml);
  const entries = Object.values(doc?.invariants ?? {});
  return {
    machine_enforced: entries.filter((e2) => e2 != null && e2.machine_enforced === true && Array.isArray(e2.tests) && e2.tests.length > 0).length,
    total: entries.length
  };
}
function computeIntelligence(capabilitiesYaml) {
  const spec = loadSpec(capabilitiesYaml);
  const subs = Object.values(spec.subagents ?? {});
  return {
    llm_invokable: subs.filter((m2) => typeof m2.prompt_path === "string" && m2.prompt_path.length > 0).length,
    total_subagents: subs.length
  };
}
function computeAutomation() {
  const loopAuto = STEPS.filter((s2) => !MANUAL_GATES.has(s2)).length;
  const ceAuto = CE_ARC_STAGES.filter((s2) => !CE_ARC_HUMAN_GATES.has(s2)).length;
  return {
    automated_steps: loopAuto + ceAuto,
    total_steps: STEPS.length + CE_ARC_STAGES.length
  };
}
function computeFromInputs(inputs) {
  return {
    standardization: computeStandardization(inputs.invariantYaml),
    intelligence: computeIntelligence(inputs.capabilitiesYaml),
    automation: computeAutomation(),
    efficiency: { install_steps: 1, runtime_node: inputs.runtimeNode, bundle_bytes: inputs.bundleBytes }
  };
}
function computeMetricsLive(root3) {
  const pkg = JSON.parse(readFileSync21(resolve19(root3, "package.json"), "utf8"));
  let bundleBytes = 0;
  try {
    bundleBytes = statSync5(resolve19(root3, "plugins/sgc/bin/sgc.mjs")).size;
  } catch {
    bundleBytes = 0;
  }
  return computeFromInputs({
    invariantYaml: readFileSync21(resolve19(root3, "contracts/invariant-enforcement.yaml"), "utf8"),
    capabilitiesYaml: readFileSync21(resolve19(root3, "contracts/sgc-capabilities.yaml"), "utf8"),
    runtimeNode: pkg.engines?.node ?? "unknown",
    bundleBytes
  });
}
function computeRuntimeMetrics() {
  let bundleBytes = 0;
  try {
    const self = fileURLToPath2(import.meta.url);
    if (self.endsWith("sgc.mjs")) {
      bundleBytes = statSync5(self).size;
    } else {
      const repoRoot = resolve19(dirname5(self), "..", "..");
      bundleBytes = statSync5(resolve19(repoRoot, "plugins/sgc/bin/sgc.mjs")).size;
    }
  } catch {
    bundleBytes = 0;
  }
  const engines = package_default2.engines;
  return computeFromInputs({
    invariantYaml: readContract("invariant-enforcement.yaml"),
    capabilitiesYaml: readContract("sgc-capabilities.yaml"),
    runtimeNode: engines?.node ?? "unknown",
    bundleBytes
  });
}
function serializeBaseline(m2) {
  const s2 = m2.standardization;
  const i2 = m2.intelligence;
  const a2 = m2.automation;
  const e2 = m2.efficiency;
  return BASELINE_BANNER + `schema_version: "1"
` + `standardization: { machine_enforced: ${s2.machine_enforced}, total: ${s2.total} }
` + `intelligence: { llm_invokable: ${i2.llm_invokable}, total_subagents: ${i2.total_subagents} }
` + `automation: { automated_steps: ${a2.automated_steps}, total_steps: ${a2.total_steps} }
` + `efficiency: { install_steps: ${e2.install_steps}, runtime_node: "${e2.runtime_node}", bundle_bytes: ${e2.bundle_bytes} }
`;
}
function parseBaseline(text) {
  const d2 = load(text);
  return {
    standardization: d2.standardization,
    intelligence: d2.intelligence,
    automation: d2.automation,
    efficiency: d2.efficiency
  };
}
function diffMetrics(live, baseline) {
  const out = [];
  const cmp = (label, x2, y3) => {
    if (x2 !== y3)
      out.push(`${label}: live=${x2} baseline=${y3}`);
  };
  cmp("standardization.machine_enforced", live.standardization.machine_enforced, baseline.standardization.machine_enforced);
  cmp("standardization.total", live.standardization.total, baseline.standardization.total);
  cmp("intelligence.llm_invokable", live.intelligence.llm_invokable, baseline.intelligence.llm_invokable);
  cmp("intelligence.total_subagents", live.intelligence.total_subagents, baseline.intelligence.total_subagents);
  cmp("automation.automated_steps", live.automation.automated_steps, baseline.automation.automated_steps);
  cmp("automation.total_steps", live.automation.total_steps, baseline.automation.total_steps);
  cmp("efficiency.install_steps", live.efficiency.install_steps, baseline.efficiency.install_steps);
  cmp("efficiency.runtime_node", live.efficiency.runtime_node, baseline.efficiency.runtime_node);
  return out;
}
function humanGates() {
  return [...MANUAL_GATES, ...[...CE_ARC_HUMAN_GATES].map((g3) => `compound-${g3}`)];
}
function formatScorecard(m2) {
  const kb = Math.round(m2.efficiency.bundle_bytes / 1024);
  const gates = humanGates();
  return [
    "sgc four-化 scorecard",
    "",
    `  规范化 standardization  ${m2.standardization.machine_enforced}/${m2.standardization.total} machine-enforced invariants`,
    `  智能化 intelligence     ${m2.intelligence.llm_invokable}/${m2.intelligence.total_subagents} LLM-invokable subagents (capacity, not quality)`,
    `  自动化 automation       ${m2.automation.automated_steps}/${m2.automation.total_steps} automated lifecycle stages (${gates.length} human gates: ${gates.join(", ")})`,
    `  高效化 efficiency       ${m2.efficiency.install_steps} install step · node ${m2.efficiency.runtime_node} · ~${kb} KB bundle`
  ].join(`
`);
}
var CE_ARC_STAGES, CE_ARC_HUMAN_GATES, BASELINE_BANNER = `# metrics/metrics-baseline.yaml
# GENERATED by \`sgc metrics --write-baseline\` — do not hand-edit.
# Dev/CI drift reference for the Phase-3 four-化 scorecard + README source.
# Regenerate after a drift-gated 化 changes (规范化 / 智能化 / 自动化 /
# 高效化 install_steps|runtime_node). efficiency.bundle_bytes is display-only.
`;
var init_metrics = __esm(() => {
  init_preprocessor();
  init_js_yaml();
  init_loop();
  init_embedded_data();
  init_package();
  CE_ARC_STAGES = ["capture", "promote", "reuse"];
  CE_ARC_HUMAN_GATES = new Set(["promote"]);
});

// src/commands/doctor.ts
var exports_doctor = {};
__export(exports_doctor, {
  statusHeaderFreshness: () => statusHeaderFreshness,
  runDoctor: () => runDoctor,
  rewriteCliFact: () => rewriteCliFact,
  readmeScorecardDrift: () => readmeScorecardDrift,
  readAgentMdFiles: () => readAgentMdFiles,
  extractCliSubcommands: () => extractCliSubcommands,
  cliFactDrift: () => cliFactDrift,
  ciPinnedBunVersion: () => ciPinnedBunVersion,
  bundleStaleSeverity: () => bundleStaleSeverity,
  bundleParityCheck: () => bundleParityCheck,
  bundleExecBitOk: () => bundleExecBitOk,
  agentMetadataDrift: () => agentMetadataDrift
});
import { createHash as createHash4 } from "node:crypto";
import { existsSync as existsSync23, mkdtempSync, readdirSync as readdirSync8, readFileSync as readFileSync22, rmSync, statSync as statSync6, writeFileSync as writeFileSync7 } from "node:fs";
import { tmpdir } from "node:os";
import { dirname as dirname6, resolve as resolve20 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
function extractCliSubcommands(src2) {
  const marker = "subCommands: {";
  const start = src2.indexOf(marker);
  if (start === -1)
    return [];
  const rest = src2.slice(start + marker.length);
  const end = rest.indexOf(`
  }`);
  const block = end === -1 ? rest : rest.slice(0, end);
  const names = [];
  const re = /["']?([a-z][a-z0-9-]*)["']?\s*:\s*\(\)\s*=>/g;
  let m2;
  while ((m2 = re.exec(block)) !== null)
    names.push(m2[1]);
  return names;
}
function statusHeaderFreshness(claudeMd, pkgVersion) {
  const h2 = /##\s+Implementation Status\s*\(v(\d+)\.(\d+)\.(\d+)/.exec(claudeMd);
  const p = /^(\d+)\.(\d+)\.(\d+)/.exec(pkgVersion);
  if (!h2)
    return { severity: "warn", msg: 'no "## Implementation Status (vX.Y.Z" header in CLAUDE.md' };
  if (!p)
    return { severity: "warn", msg: `unparseable package.json version: ${pkgVersion}` };
  const hMaj = Number(h2[1]), hMin = Number(h2[2]), hPat = Number(h2[3]);
  const pMaj = Number(p[1]), pMin = Number(p[2]), pPat = Number(p[3]);
  const behind = hMaj < pMaj || hMaj === pMaj && (hMin < pMin || hMin === pMin && hPat < pPat);
  const hVer = `${hMaj}.${hMin}.${hPat}`;
  const pVer = `${pMaj}.${pMin}.${pPat}`;
  return behind ? {
    severity: "warn",
    msg: `CLAUDE.md status header v${hVer} trails package.json v${pVer} — refresh the status header`
  } : { severity: "ok", msg: `CLAUDE.md status header v${hVer} ≥ package.json v${pVer}` };
}
function bundleExecBitOk(lsFilesStdout) {
  const line = lsFilesStdout.trim();
  if (!line)
    return null;
  const mode = line.split(/\s+/)[0] ?? "";
  if (!/^\d{6}$/.test(mode))
    return null;
  return (parseInt(mode, 8) & 73) !== 0;
}
function readmeScorecardDrift(readme, live) {
  const expected = [
    ["规范化", live.standardization.machine_enforced, live.standardization.total],
    ["智能化", live.intelligence.llm_invokable, live.intelligence.total_subagents],
    ["自动化", live.automation.automated_steps, live.automation.total_steps]
  ];
  const drifts = [];
  for (const [label, num, den] of expected) {
    const m2 = readme.match(new RegExp(`${label}\\s+(\\d+)\\s*/\\s*(\\d+)`));
    if (!m2) {
      drifts.push(`${label}: no "${label} <n>/<d>" found in README (expected ${num}/${den})`);
      continue;
    }
    if (Number(m2[1]) !== num || Number(m2[2]) !== den) {
      drifts.push(`${label}: README says ${m2[1]}/${m2[2]}, live metrics say ${num}/${den}`);
    }
  }
  return drifts;
}
function agentMetadataDrift(files, lookup, manifestIds = []) {
  const drifts = [];
  for (const f3 of files) {
    const entry = lookup(f3.id);
    if (!entry) {
      drifts.push(`${f3.id}: ${f3.file} has no manifest entry (orphan registry file)`);
      continue;
    }
    let desc;
    try {
      desc = readFrontmatterDescription(f3.text).toLowerCase();
    } catch (err) {
      drifts.push(`${f3.id}: ${f3.file} frontmatter does not parse (${String(err).slice(0, 80)})`);
      continue;
    }
    const cliNeverRuns = entry.status === "slot-only" || entry.status === "manual-only";
    const heuristic = !entry.prompt_path;
    if (cliNeverRuns) {
      if (!/(not implemented|slot-only|manual-only|never dispatched|not wired|never runs)/.test(desc)) {
        drifts.push(`${f3.id}: manifest says status slot-only (never dispatched) but ${f3.file} advertises it as working`);
      } else if (/dispatched by/.test(desc)) {
        drifts.push(`${f3.id}: ${f3.file} is slot-only yet still says "dispatched by" — a disclaimer elsewhere does not undo it`);
      }
      continue;
    }
    if (heuristic && !/(heuristic|keyword match|deterministic|not llm-backed|rule-based|not implemented)/.test(desc)) {
      drifts.push(`${f3.id}: manifest says prompt_path null (not LLM-backed) but ${f3.file} does not disclose it`);
    }
  }
  const present = new Set(files.map((f3) => f3.id));
  for (const id of manifestIds) {
    if (present.has(id) || REGISTRY_EXEMPT_IDS.has(id))
      continue;
    drifts.push(`${id}: manifested but has no registry file under plugins/sgc/agents/ (missing)`);
  }
  return drifts;
}
function cliFactDrift(files) {
  const drifts = [];
  for (const f3 of files) {
    if (!DERIVED_AGENT_IDS.includes(f3.id))
      continue;
    let desc;
    try {
      desc = readFrontmatterDescription(f3.text);
    } catch (err) {
      drifts.push(`${f3.id}: ${f3.file} frontmatter does not parse (${String(err).slice(0, 80)})`);
      continue;
    }
    const at = desc.indexOf(CLI_FACT_MARKER);
    if (at < 0) {
      drifts.push(`${f3.id}: ${f3.file} has no \`${CLI_FACT_MARKER}\` clause — run \`sgc doctor --write-descriptions\``);
      continue;
    }
    if (at === 0) {
      drifts.push(`${f3.id}: ${f3.file} opens with the CLI fact — the capability sentence must come first. ` + `This field's only consumer is Claude Code's dispatch decision; leading with a disclaimer suppresses it.`);
      continue;
    }
    const actual = desc.slice(at);
    const expected = deriveCliFact(f3.id);
    if (actual !== expected) {
      drifts.push(`${f3.id}: ${f3.file} CLI-fact clause is stale.
    expected: ${expected}
    actual:   ${actual}
` + `    fix: sgc doctor --write-descriptions`);
    }
  }
  return drifts;
}
function rewriteCliFact(text, id) {
  const m2 = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m2)
    throw new Error(`${id}: no frontmatter block`);
  const parsed = load(m2[1]);
  const desc = typeof parsed["description"] === "string" ? parsed["description"] : "";
  const at = desc.indexOf(CLI_FACT_MARKER);
  const capability = (at < 0 ? desc : desc.slice(0, at)).trimEnd();
  parsed["description"] = `${capability} ${deriveCliFact(id)}`;
  const front = dump(parsed, { lineWidth: -1, quotingType: '"', forceQuotes: false });
  return `---
${front.trimEnd()}
---
${text.slice(m2[0].length)}`;
}
function readFrontmatterDescription(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (block === undefined)
    throw new Error("no frontmatter block");
  const parsed = load(block);
  if (typeof parsed !== "object" || parsed === null)
    throw new Error("frontmatter is not a mapping");
  const d2 = parsed["description"];
  return typeof d2 === "string" ? d2 : "";
}
function readAgentMdFiles(root3) {
  const dir = resolve20(root3, "plugins", "sgc", "agents");
  if (!existsSync23(dir))
    return [];
  const out = [];
  for (const group of readdirSync8(dir)) {
    const gdir = resolve20(dir, group);
    if (!statSync6(gdir).isDirectory())
      continue;
    for (const f3 of readdirSync8(gdir)) {
      if (!f3.endsWith(".md"))
        continue;
      out.push({
        id: `${group}.${f3.slice(0, -3)}`,
        file: `plugins/sgc/agents/${group}/${f3}`,
        text: readFileSync22(resolve20(gdir, f3), "utf8")
      });
    }
  }
  return out;
}
function ciPinnedBunVersion(workflowYaml) {
  const m2 = workflowYaml.match(/bun-version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)["']?/);
  return m2?.[1] ?? null;
}
function bundleStaleSeverity(localBun, ciBun) {
  if (localBun && ciBun && localBun !== ciBun) {
    return {
      severity: "warn",
      msg: `  ⚠ bundle-hash differs, but your bun (${localBun}) is not CI's pinned bun (${ciBun}) — ` + `inconclusive, and bun's output is not byte-stable across versions. ` + `Do NOT rebuild-and-commit from this bun: CI rebuilds with ${ciBun} and would reject it. ` + `To check for real: npx bun@${ciBun} build (or match CI's bun), then re-run doctor.`
    };
  }
  return {
    severity: "fail",
    msg: "  ✗ committed bundle STALE — run `npm run build:cli` and commit"
  };
}
async function bundleParityCheck(root3) {
  const srcEntry = resolve20(root3, "src", "sgc.ts");
  const committed = resolve20(root3, "plugins", "sgc", "bin", "sgc.mjs");
  const buildScript = resolve20(root3, "scripts", "build-cli.mjs");
  if (!existsSync23(srcEntry) || !existsSync23(committed) || !existsSync23(buildScript)) {
    return { severity: "ok", msg: "  ⓘ bundle-hash parity skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" };
  }
  const tmp = mkdtempSync(resolve20(tmpdir(), "sgc-bundle-"));
  const out = resolve20(tmp, "sgc.mjs");
  try {
    const r3 = await spawnCapture(["node", buildScript, "--outfile", out], { cwd: root3 });
    if (r3.exitCode !== 0)
      return { severity: "warn", msg: `  ⚠ bundle-hash parity: rebuild failed (${r3.stderr.slice(0, 120)})` };
    const sha = (buf) => createHash4("sha256").update(buf).digest("hex");
    const strip2 = (b3) => Buffer.from(b3.toString("utf8").replace(/^#![^\n]*\n/, ""));
    const a2 = sha(strip2(readFileSync22(out)));
    const b2 = sha(strip2(readFileSync22(committed)));
    if (a2 !== b2) {
      const localBun = (await spawnCapture(["bun", "--version"], { cwd: root3 })).stdout.trim() || null;
      let ciBun = null;
      try {
        ciBun = ciPinnedBunVersion(readFileSync22(resolve20(root3, ".github/workflows/test.yml"), "utf8"));
      } catch {}
      return bundleStaleSeverity(localBun, ciBun);
    }
    const ls = await spawnCapture(["git", "ls-files", "--stage", "plugins/sgc/bin/sgc.mjs"], { cwd: root3 });
    const execOk = ls.exitCode === 0 ? bundleExecBitOk(ls.stdout) : null;
    if (execOk === false) {
      return {
        severity: "fail",
        msg: "  ✗ committed bundle missing git exec bit (100644) — run `git add --chmod=+x plugins/sgc/bin/sgc.mjs` and commit"
      };
    }
    return { severity: "ok", msg: "  ✓ committed bundle matches source rebuild (content + exec bit)" };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
function checkManifestPromptPath(ctx) {
  const rows = [];
  for (const [name, m2] of ctx.manifests) {
    if (m2.prompt_path == null)
      continue;
    const present = EMBEDDED_PROMPTS[m2.prompt_path] !== undefined;
    if (present) {
      rows.push({ severity: "ok", msg: `  ✓ ${name} → ${m2.prompt_path}` });
    } else {
      rows.push({
        severity: "fail",
        msg: `  ✗ ${name} → ${m2.prompt_path} (NOT EMBEDDED)`
      });
    }
  }
  return rows;
}
function checkPromptsReferenced(ctx) {
  const rows = [];
  const declaredPrompts = new Set;
  for (const [, m2] of ctx.manifests) {
    if (m2.prompt_path)
      declaredPrompts.add(m2.prompt_path);
  }
  for (const rel of listEmbeddedPromptKeys().sort()) {
    if (declaredPrompts.has(rel)) {
      rows.push({ severity: "ok", msg: `  ✓ ${rel}` });
    } else {
      rows.push({
        severity: "warn",
        msg: `  ⚠ ${rel} (orphan — embedded but unreferenced)`
      });
    }
  }
  return rows;
}
function checkSlotOnly(ctx) {
  const rows = [];
  for (const [name, m2] of ctx.manifests) {
    if (m2.status !== "slot-only")
      continue;
    if (m2.prompt_path == null) {
      rows.push({
        severity: "ok",
        msg: `  ✓ ${name} (slot-only, no prompt_path)`
      });
    } else {
      rows.push({
        severity: "fail",
        msg: `  ✗ ${name} (slot-only but declares prompt_path: ${m2.prompt_path})`
      });
    }
  }
  return rows;
}
function checkBunfigRoot(ctx) {
  const rows = [];
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ bunfig.toml root skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" });
  } else {
    const bunfigPath = resolve20(ctx.root, "bunfig.toml");
    if (!existsSync23(bunfigPath)) {
      rows.push({
        severity: "warn",
        msg: "  ⚠ bunfig.toml not found — bare `bun test` may sweep vendored suites (R0)"
      });
    } else if (/root\s*=\s*["']tests["']/.test(readFileSync22(bunfigPath, "utf8"))) {
      rows.push({ severity: "ok", msg: '  ✓ bunfig.toml [test] root="tests"' });
    } else {
      rows.push({
        severity: "fail",
        msg: '  ✗ bunfig.toml present but [test] root!="tests" — bare `bun test` would scan the whole repo, not just tests/'
      });
    }
  }
  return rows;
}
function checkPackageFiles(ctx) {
  const rows = [];
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ package.json files skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" });
  } else {
    const pkgPath = resolve20(ctx.root, "package.json");
    if (!existsSync23(pkgPath)) {
      rows.push({ severity: "warn", msg: "  ⚠ package.json not found" });
    } else {
      let files = [];
      try {
        const pkg = JSON.parse(readFileSync22(pkgPath, "utf8"));
        files = Array.isArray(pkg.files) ? pkg.files : [];
      } catch (e2) {
        rows.push({
          severity: "fail",
          msg: `  ✗ package.json parse error: ${e2.message.slice(0, 80)}`
        });
        files = [];
      }
      const leaks = files.filter((f3) => {
        const norm = f3.replace(/^\.?\//, "");
        if (!norm.startsWith("plugins"))
          return false;
        const last = norm.split("/").at(-1) ?? "";
        if (last === "" || !last.includes("."))
          return true;
        return !norm.startsWith("plugins/sgc/bin/");
      });
      if (files.length === 0) {
        rows.push({
          severity: "warn",
          msg: '  ⚠ package.json has no "files" allowlist — npm would publish the plugin payload'
        });
      } else if (leaks.length) {
        rows.push({
          severity: "fail",
          msg: `  ✗ package.json files includes vendored path(s): ${leaks.join(", ")}`
        });
      } else {
        rows.push({
          severity: "ok",
          msg: "  ✓ package.json files excludes plugins/ (plugin payload not npm-published)"
        });
      }
    }
  }
  return rows;
}
function checkInvariantEnforcementCoverage(ctx) {
  const rows = [];
  const iePath = ctx.iePath;
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ invariant-enforcement.yaml skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" });
  } else if (!existsSync23(iePath)) {
    rows.push({
      severity: "warn",
      msg: "  ⚠ contracts/invariant-enforcement.yaml not found — invariant→test map unverified"
    });
  } else {
    let inv = {};
    try {
      const doc = load(readFileSync22(iePath, "utf8"));
      inv = doc?.invariants && typeof doc.invariants === "object" ? doc.invariants : {};
    } catch (e2) {
      rows.push({
        severity: "fail",
        msg: `  ✗ invariant-enforcement.yaml parse error: ${e2.message.slice(0, 80)}`
      });
      inv = null;
    }
    if (inv) {
      const missingSections = [];
      for (let n2 = 1;n2 <= 13; n2++)
        if (inv[String(n2)] == null)
          missingSections.push(`§${n2}`);
      if (missingSections.length) {
        rows.push({
          severity: "fail",
          msg: `  ✗ invariant map missing: ${missingSections.join(", ")}`
        });
      }
      let machineCount = 0;
      for (let n2 = 1;n2 <= 13; n2++) {
        const e2 = inv[String(n2)];
        if (e2 == null)
          continue;
        const title = typeof e2["title"] === "string" ? e2["title"].slice(0, 32) : "";
        if (e2["machine_enforced"] === true) {
          machineCount++;
          const tests = Array.isArray(e2["tests"]) ? e2["tests"] : [];
          if (tests.length === 0) {
            rows.push({ severity: "fail", msg: `  ✗ §${n2} machine_enforced but lists no tests` });
          } else {
            const missingTests = tests.filter((t2) => !existsSync23(resolve20(ctx.root, t2)));
            if (missingTests.length) {
              rows.push({
                severity: "fail",
                msg: `  ✗ §${n2} cites missing test file(s): ${missingTests.join(", ")}`
              });
            } else {
              rows.push({ severity: "ok", msg: `  ✓ §${n2} ${title} (${tests.length} test file(s))` });
            }
          }
        } else {
          rows.push({ severity: "ok", msg: `  ✓ §${n2} ${title} (procedural)` });
        }
      }
      rows.push({ severity: "ok", msg: `  · machine-enforced invariants: ${machineCount}/13` });
    }
  }
  return rows;
}
function checkSlashParity(ctx) {
  const rows = [];
  const SLASH_EXEMPT = new Set(["canary", "watch-ci-failure", "land"]);
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ slash↔CLI parity skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" });
  } else {
    const sgcSrcPath = resolve20(ctx.root, "src/sgc.ts");
    const commandsDir = resolve20(ctx.root, "plugins/sgc/commands");
    if (!existsSync23(sgcSrcPath) || !existsSync23(commandsDir)) {
      rows.push({
        severity: "warn",
        msg: "  ⚠ src/sgc.ts or plugins/sgc/commands/ not found — slash parity unchecked (npm-install layout?)"
      });
    } else {
      const cliNames = extractCliSubcommands(readFileSync22(sgcSrcPath, "utf8"));
      const slashNames = new Set(readdirSync8(commandsDir).filter((f3) => f3.endsWith(".md")).map((f3) => f3.slice(0, -3)));
      if (cliNames.length === 0) {
        rows.push({ severity: "warn", msg: "  ⚠ could not parse subCommands block in src/sgc.ts" });
      }
      for (const name of cliNames) {
        if (slashNames.has(name)) {
          rows.push({ severity: "ok", msg: `  ✓ ${name} (CLI + slash command)` });
        } else if (SLASH_EXEMPT.has(name)) {
          rows.push({ severity: "ok", msg: `  ✓ ${name} (CLI-only, slash-exempt)` });
        } else {
          rows.push({
            severity: "fail",
            msg: `  ✗ ${name} (CLI subcommand has no slash command — add plugins/sgc/commands/${name}.md or add to SLASH_EXEMPT)`
          });
        }
      }
      const cliSet = new Set(cliNames);
      for (const slash of [...slashNames].sort()) {
        if (!cliSet.has(slash)) {
          rows.push({
            severity: "warn",
            msg: `  ⚠ ${slash}.md (orphan slash command — no matching CLI subcommand)`
          });
        }
      }
    }
  }
  return rows;
}
function checkInvariantSourceParity(ctx) {
  const rows = [];
  const iePath = ctx.iePath;
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ invariant-source parity skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" });
  } else {
    const invMdPath = resolve20(ctx.root, "contracts/sgc-invariants.md");
    if (!existsSync23(invMdPath) || !existsSync23(iePath)) {
      rows.push({
        severity: "warn",
        msg: "  ⚠ sgc-invariants.md or invariant-enforcement.yaml missing — § parity unchecked"
      });
    } else {
      const mdNums = new Set;
      const secRe = /^##\s*§(\d+)\./gm;
      let sm;
      const mdText = readFileSync22(invMdPath, "utf8");
      while ((sm = secRe.exec(mdText)) !== null)
        mdNums.add(Number(sm[1]));
      const yamlNums = new Set;
      try {
        const doc = load(readFileSync22(iePath, "utf8"));
        if (doc?.invariants)
          for (const k2 of Object.keys(doc.invariants))
            yamlNums.add(Number(k2));
      } catch {}
      const onlyMd = [...mdNums].filter((n2) => !yamlNums.has(n2)).sort((a2, b2) => a2 - b2);
      const onlyYaml = [...yamlNums].filter((n2) => !mdNums.has(n2)).sort((a2, b2) => a2 - b2);
      if (mdNums.size > 0 && onlyMd.length === 0 && onlyYaml.length === 0) {
        rows.push({
          severity: "ok",
          msg: `  ✓ both sources define §1–§${Math.max(...mdNums)} (${mdNums.size} invariants)`
        });
      } else {
        rows.push({
          severity: "fail",
          msg: `  ✗ invariant sources disagree — only in .md: [${onlyMd.join(",") || "—"}], only in .yaml: [${onlyYaml.join(",") || "—"}]`
        });
      }
    }
  }
  return rows;
}
async function checkBundleParity(ctx) {
  return [await bundleParityCheck(ctx.root)];
}
function checkMetricsBaseline(ctx) {
  const rows = [];
  const baselinePath = resolve20(ctx.root, "metrics", "metrics-baseline.yaml");
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ metrics baseline skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" });
  } else if (!existsSync23(baselinePath)) {
    rows.push({ severity: "fail", msg: "  ✗ metrics/metrics-baseline.yaml missing — run `sgc metrics --write-baseline`" });
  } else {
    try {
      const live = computeMetricsLive(ctx.root);
      const baseline = parseBaseline(readFileSync22(baselinePath, "utf8"));
      const drifts = diffMetrics(live, baseline);
      if (drifts.length === 0) {
        rows.push({ severity: "ok", msg: "  ✓ metrics baseline in sync (live == baseline; bundle_bytes excluded)" });
      } else {
        for (const d2 of drifts)
          rows.push({ severity: "fail", msg: `  ✗ metrics drift — ${d2}` });
        rows.push({ severity: "fail", msg: "  ✗ regenerate: `sgc metrics --write-baseline`" });
      }
    } catch (e2) {
      rows.push({ severity: "fail", msg: `  ✗ metrics baseline check error: ${e2.message.slice(0, 80)}` });
    }
  }
  return rows;
}
function checkAgentRegistry(ctx) {
  const rows = [];
  try {
    const files = readAgentMdFiles(ctx.root);
    if (files.length === 0) {
      rows.push({ severity: "ok", msg: "  ⓘ agent registry check skipped (no plugins/sgc/agents/ — npm channel)" });
    } else {
      const drifts = agentMetadataDrift(files, (id) => getSubagentManifest(id) ?? null, Object.keys(getCapabilities().subagents));
      if (drifts.length === 0) {
        rows.push({ severity: "ok", msg: `  ✓ ${files.length} agent descriptions wired to manifest (disclosure checked, not accuracy)` });
      } else {
        for (const d2 of drifts)
          rows.push({ severity: "fail", msg: `  ✗ agent metadata drift — ${d2}` });
      }
    }
  } catch (e2) {
    rows.push({ severity: "fail", msg: `  ✗ agent registry check error: ${e2.message.slice(0, 80)}` });
  }
  return rows;
}
function checkCliFactDerivation(ctx) {
  const rows = [];
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ CLI-fact derivation skipped (no src/sgc.ts — npm channel, no derivation to check against)" });
  } else {
    try {
      const files = readAgentMdFiles(ctx.root);
      if (files.length === 0) {
        rows.push({ severity: "ok", msg: "  ⓘ CLI-fact derivation skipped (no plugins/sgc/agents/ — npm channel)" });
      } else {
        const present = new Set(files.map((f3) => f3.id));
        const missingIds = DERIVED_AGENT_IDS.filter((id) => !present.has(id));
        for (const id of missingIds) {
          rows.push({
            severity: "fail",
            msg: `  ✗ ${id}: no plugins/sgc/agents/${id.replace(".", "/")}.md — a missing file cannot carry the derived clause`
          });
        }
        const factDrifts = cliFactDrift(files);
        if (factDrifts.length === 0 && missingIds.length === 0) {
          const checked = files.filter((f3) => DERIVED_AGENT_IDS.includes(f3.id)).length;
          rows.push({ severity: "ok", msg: `  ✓ ${checked} agent CLI-fact clauses match the code` });
        } else {
          for (const d2 of factDrifts)
            rows.push({ severity: "fail", msg: `  ✗ ${d2}` });
        }
      }
    } catch (e2) {
      rows.push({ severity: "fail", msg: `  ✗ CLI-fact check error: ${e2.message.slice(0, 80)}` });
    }
  }
  return rows;
}
function checkReadmeScorecard(ctx) {
  const rows = [];
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ README scorecard parity skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" });
  } else {
    const readmePath = resolve20(ctx.root, "README.md");
    if (!existsSync23(readmePath)) {
      rows.push({ severity: "warn", msg: "  ⚠ README.md not found" });
    } else {
      try {
        const drifts = readmeScorecardDrift(readFileSync22(readmePath, "utf8"), computeMetricsLive(ctx.root));
        if (drifts.length === 0) {
          rows.push({ severity: "ok", msg: "  ✓ README scorecard matches live metrics" });
        } else {
          for (const d2 of drifts)
            rows.push({ severity: "fail", msg: `  ✗ README scorecard drift — ${d2}` });
          rows.push({ severity: "fail", msg: "  ✗ fix README.md to match `sgc metrics` output" });
        }
      } catch (e2) {
        rows.push({ severity: "fail", msg: `  ✗ README scorecard check error: ${e2.message.slice(0, 80)}` });
      }
    }
  }
  return rows;
}
function checkStatusHeaderFreshness(ctx) {
  const rows = [];
  if (!ctx.hasSource) {
    rows.push({ severity: "ok", msg: "  ⓘ CLAUDE.md freshness skipped (no src/sgc.ts at the resolved root — bundle/npm channel; dev/CI-only check)" });
  } else {
    const claudeMdPath = resolve20(ctx.root, "plugins", "sgc", "CLAUDE.md");
    const pkgPath = resolve20(ctx.root, "package.json");
    if (!existsSync23(claudeMdPath) || !existsSync23(pkgPath)) {
      rows.push({ severity: "warn", msg: "  ⚠ plugins/sgc/CLAUDE.md or package.json not found" });
    } else {
      try {
        const pkgVer = JSON.parse(readFileSync22(pkgPath, "utf8")).version ?? "";
        const r3 = statusHeaderFreshness(readFileSync22(claudeMdPath, "utf8"), pkgVer);
        rows.push({ severity: r3.severity, msg: `  ${r3.severity === "ok" ? "✓" : "⚠"} ${r3.msg}` });
      } catch (e2) {
        rows.push({ severity: "warn", msg: `  ⚠ CLAUDE.md freshness check error: ${e2.message.slice(0, 80)}` });
      }
    }
  }
  return rows;
}
async function runDoctor(opts = {}) {
  const log = opts.log ?? ((m2) => console.log(m2));
  const root3 = opts.repoRoot ?? repoRoot;
  const rows = [];
  const emit = (row) => {
    rows.push(row);
    log(row.msg);
  };
  const caps = getCapabilities();
  const manifests = Object.entries(caps.subagents);
  const hasSource = existsSync23(resolve20(root3, "src", "sgc.ts"));
  if (opts.writeDescriptions) {
    try {
      const written = [];
      for (const f3 of readAgentMdFiles(root3)) {
        if (!DERIVED_AGENT_IDS.includes(f3.id))
          continue;
        const next = rewriteCliFact(f3.text, f3.id);
        if (next !== f3.text) {
          writeFileSync7(resolve20(root3, f3.file), next, "utf8");
          written.push(f3.id);
        }
      }
      log(written.length > 0 ? `wrote CLI-fact clause for: ${written.join(", ")}` : "all CLI-fact clauses already match the code");
    } catch (e2) {
      log(`✗ --write-descriptions failed: ${e2.message.slice(0, 120)}`);
    }
  }
  const ctx = {
    root: root3,
    hasSource,
    manifests,
    iePath: resolve20(root3, "contracts/invariant-enforcement.yaml")
  };
  for (let i2 = 0;i2 < CHECKS.length; i2++) {
    const check = CHECKS[i2];
    if (i2 > 0)
      log("");
    log(check.header);
    for (const row of await check.run(ctx))
      emit(row);
  }
  const ok = rows.filter((r3) => r3.severity === "ok").length;
  const warn = rows.filter((r3) => r3.severity === "warn").length;
  const fail = rows.filter((r3) => r3.severity === "fail").length;
  log("");
  log(`=== Summary ===`);
  log(`${ok} OK · ${warn} warn · ${fail} fail`);
  return { ok, warn, fail, rows };
}
var moduleDir2, repoRoot, REGISTRY_EXEMPT_IDS, CHECKS;
var init_doctor = __esm(() => {
  init_subprocess();
  init_js_yaml();
  init_schema();
  init_agent_facts();
  init_embedded_data();
  init_metrics();
  moduleDir2 = dirname6(fileURLToPath3(import.meta.url));
  repoRoot = resolve20(moduleDir2, "..", "..");
  REGISTRY_EXEMPT_IDS = new Set(["clarifier.discover", "planner.decompose"]);
  CHECKS = [
    { header: "=== Manifest prompt_path ↔ prompts/ ===", run: checkManifestPromptPath },
    { header: "=== prompts/ ↔ manifest ===", run: checkPromptsReferenced },
    { header: "=== status: slot-only ↔ prompt_path: null ===", run: checkSlotOnly },
    { header: "=== bunfig.toml [test] root ===", run: checkBunfigRoot },
    { header: "=== package.json files ↔ no vendored plugins/ ===", run: checkPackageFiles },
    { header: "=== invariant-enforcement.yaml coverage ===", run: checkInvariantEnforcementCoverage },
    { header: "=== slash commands ↔ CLI subcommands ===", run: checkSlashParity },
    { header: "=== invariant sources aligned (§ count) ===", run: checkInvariantSourceParity },
    { header: "=== bundle parity ===", run: checkBundleParity },
    { header: "=== metrics baseline drift ===", run: checkMetricsBaseline },
    { header: "=== agent registry ↔ manifest ===", run: checkAgentRegistry },
    { header: "=== agent description ↔ derived CLI fact ===", run: checkCliFactDerivation },
    { header: "=== README four-化 scorecard parity ===", run: checkReadmeScorecard },
    { header: "=== plugins/sgc/CLAUDE.md status header freshness ===", run: checkStatusHeaderFreshness }
  ];
});

// src/dispatcher/reflect.ts
import { readFile as readFile3, readdir as readdir3, mkdir as mkdir5, writeFile as writeFile2 } from "node:fs/promises";
import { resolve as resolve21 } from "node:path";
function slicePreMortem(raw) {
  const idx = raw.indexOf(PRE_MORTEM_HEADER);
  if (idx < 0)
    return "";
  const tail = raw.slice(idx + PRE_MORTEM_HEADER.length);
  const endRel = tail.search(/\n## (?!#)/);
  return endRel < 0 ? raw.slice(idx) : raw.slice(idx, idx + PRE_MORTEM_HEADER.length + endRel);
}
function extractEarlySignals(preMortem) {
  const out = [];
  for (const line of preMortem.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith(EARLY_SIGNAL_PREFIX)) {
      out.push(trimmed.slice(EARLY_SIGNAL_PREFIX.length).trim());
    }
  }
  return out;
}
function detectDiscussion(preMortem, solutionRef, preventionText, earlySignals) {
  if (preMortem.includes(solutionRef)) {
    return {
      discussed: true,
      evidence: `solution_ref direct match: ${solutionRef}`
    };
  }
  const firstSentence = preventionText.split(/[.!?]/)[0] ?? "";
  const previewTokens = tokenize(firstSentence);
  if (previewTokens.size === 0 || earlySignals.length === 0) {
    return { discussed: false, evidence: null };
  }
  for (const signal of earlySignals) {
    const signalTokens = tokenize(signal);
    let overlap = 0;
    for (const t2 of previewTokens) {
      if (signalTokens.has(t2))
        overlap++;
    }
    if (overlap >= MIN_SIGNAL_OVERLAP) {
      return {
        discussed: true,
        evidence: `signal-token overlap (${overlap}): ${signal.slice(0, 80)}`
      };
    }
  }
  return { discussed: false, evidence: null };
}
async function auditDecision(taskId, stateRoot2, _opts = {}) {
  const root3 = resolveStateRoot(stateRoot2);
  const decisionPath = resolve21(root3, "decisions", taskId, "intent.md");
  let raw;
  try {
    raw = await readFile3(decisionPath, "utf8");
  } catch {
    return { task_id: taskId, decision_path: decisionPath, candidates: [] };
  }
  let frontmatter;
  try {
    frontmatter = parseFrontmatter(raw).data;
  } catch {
    return { task_id: taskId, decision_path: decisionPath, candidates: [] };
  }
  const keywordSource = `${frontmatter.motivation ?? ""}
${frontmatter.title ?? ""}`;
  const keywords = extractKeywords(keywordSource);
  if (keywords.length === 0) {
    return { task_id: taskId, decision_path: decisionPath, candidates: [] };
  }
  const scans = await walkSolutionsCorpus(root3, keywords);
  const preMortem = slicePreMortem(raw);
  const earlySignals = extractEarlySignals(preMortem);
  const candidates = [];
  for (const scan of scans) {
    let solutionFrontmatter;
    try {
      solutionFrontmatter = parseFrontmatter(scan.text).data;
    } catch {
      continue;
    }
    const preventionText = solutionFrontmatter.prevention?.trim() ?? "";
    if (preventionText === "")
      continue;
    const solutionRef = `${scan.category}/${scan.slug}`;
    const { discussed, evidence } = detectDiscussion(preMortem, solutionRef, preventionText, earlySignals);
    candidates.push({
      solution_ref: solutionRef,
      category: scan.category,
      prevention_text: preventionText,
      keyword_overlap: scan.hits,
      discussed,
      discussed_evidence: evidence,
      applied_count: Array.isArray(solutionFrontmatter.applied_in) ? solutionFrontmatter.applied_in.length : 0,
      surfaced_count: Array.isArray(solutionFrontmatter.surfaced_in) ? solutionFrontmatter.surfaced_in.length : 0
    });
  }
  candidates.sort((a2, b2) => {
    if (a2.discussed !== b2.discussed)
      return a2.discussed ? 1 : -1;
    return b2.keyword_overlap - a2.keyword_overlap;
  });
  return { task_id: taskId, decision_path: decisionPath, candidates };
}
async function auditAllDecisions(stateRoot2, opts = {}) {
  const root3 = resolveStateRoot(stateRoot2);
  const decisionsDir = resolve21(root3, "decisions");
  let entries;
  try {
    entries = await readdir3(decisionsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const sinceMs = opts.since ? Date.parse(opts.since) : null;
  if (sinceMs !== null && Number.isNaN(sinceMs)) {
    throw new Error(`--since: not a parseable date: ${opts.since}`);
  }
  const pending = [];
  for (const entry of entries) {
    if (!entry.isDirectory())
      continue;
    const intentPath2 = resolve21(decisionsDir, entry.name, "intent.md");
    let raw;
    try {
      raw = await readFile3(intentPath2, "utf8");
    } catch {
      continue;
    }
    let frontmatter;
    try {
      frontmatter = parseFrontmatter(raw).data;
    } catch {
      continue;
    }
    const createdAtMs = frontmatter.created_at ? Date.parse(frontmatter.created_at) : 0;
    if (sinceMs !== null && createdAtMs < sinceMs)
      continue;
    pending.push({ taskId: entry.name, createdAtMs });
  }
  pending.sort((a2, b2) => b2.createdAtMs - a2.createdAtMs);
  const reports = [];
  for (const p of pending) {
    reports.push(await auditDecision(p.taskId, root3));
  }
  return reports;
}
function formatReport(report) {
  const lines = [];
  lines.push(`# Reflect: ${report.task_id}`);
  lines.push("");
  lines.push(`Decision: ${report.decision_path}`);
  lines.push("");
  if (report.candidates.length === 0) {
    lines.push("No matched preventions.");
    return lines.join(`
`);
  }
  lines.push(`Matched preventions: ${report.candidates.length}`);
  lines.push("Legend: overlap=recall match · applied=cited by an L3 pre-mortem · surfaced=L2 meaningful surfacing · [discussed]=engaged in this pre-mortem");
  lines.push("Caveat: `applied` counts refs the pre-mortem echoed from its own input (it was given them) — salience, not proof of prevention.");
  for (const c3 of report.candidates) {
    const tag = c3.discussed ? "[discussed]" : "[silent]    ";
    lines.push(`  - ${tag} ${c3.solution_ref} (overlap: ${c3.keyword_overlap}, applied: ${c3.applied_count}, surfaced: ${c3.surfaced_count})`);
    if (c3.discussed && c3.discussed_evidence) {
      lines.push(`    evidence: ${c3.discussed_evidence}`);
    }
    if (!c3.discussed && c3.prevention_text) {
      const preview = c3.prevention_text.split(/[.!?]/)[0]?.trim().slice(0, 80) ?? "";
      lines.push(`    prevention: ${preview}`);
    }
  }
  return lines.join(`
`);
}
async function writeReflectionFile(report, stateRoot2) {
  const root3 = resolveStateRoot(stateRoot2);
  const dir = resolve21(root3, "reflections");
  await mkdir5(dir, { recursive: true });
  const path2 = resolve21(dir, `${report.task_id}.md`);
  await writeFile2(path2, formatReport(report), "utf8");
  return path2;
}
var MIN_SIGNAL_OVERLAP = 3, PRE_MORTEM_HEADER = "## Pre-mortem", EARLY_SIGNAL_PREFIX = "Early signal:";
var init_reflect = __esm(() => {
  init_researcher_history();
  init_state();
  init_dedup();
});

// src/commands/reflect.ts
var exports_reflect = {};
__export(exports_reflect, {
  runReflect: () => runReflect
});
async function runReflect(opts = {}) {
  let reports;
  if (opts.task) {
    reports = [await auditDecision(opts.task, undefined, { since: opts.since })];
  } else {
    reports = await auditAllDecisions(undefined, { since: opts.since });
  }
  if (opts.json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    if (reports.length === 0) {
      console.log("No decisions audited.");
    } else {
      console.log(reports.map(formatReport).join(`

`));
    }
  }
  if (opts.save) {
    for (const r3 of reports) {
      const path2 = await writeReflectionFile(r3);
      console.error(`saved: ${path2}`);
    }
  }
}
var init_reflect2 = __esm(() => {
  init_reflect();
});

// src/commands/metrics.ts
var exports_metrics = {};
__export(exports_metrics, {
  runMetrics: () => runMetrics
});
import { mkdirSync as mkdirSync7, writeFileSync as writeFileSync8 } from "node:fs";
import { dirname as dirname7, resolve as resolve22 } from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
async function runMetrics(opts = {}) {
  const root3 = opts.repoRoot ?? defaultRoot;
  if (opts.writeBaseline) {
    const live = computeMetricsLive(root3);
    const path2 = resolve22(root3, "metrics", "metrics-baseline.yaml");
    mkdirSync7(dirname7(path2), { recursive: true });
    writeFileSync8(path2, serializeBaseline(live), "utf8");
    console.error(`wrote: ${path2}`);
    return;
  }
  const m2 = opts.repoRoot ? computeMetricsLive(root3) : computeRuntimeMetrics();
  console.log(opts.json ? JSON.stringify(m2, null, 2) : formatScorecard(m2));
}
var moduleDir3, defaultRoot;
var init_metrics2 = __esm(() => {
  init_metrics();
  moduleDir3 = dirname7(fileURLToPath4(import.meta.url));
  defaultRoot = resolve22(moduleDir3, "..", "..");
});

// src/dispatcher/ship-failure.ts
import { mkdir as mkdir6, stat as stat2, writeFile as writeFile3 } from "node:fs/promises";
import { resolve as resolve23 } from "node:path";
function clamp2(n2, lo, hi) {
  return Math.max(lo, Math.min(hi, n2));
}
function shortSha3(sha) {
  return sha.slice(0, 7);
}
function todayUtcDate(now) {
  return new Date(now()).toISOString().slice(0, 10);
}
async function defaultRunCommand(args) {
  return spawnCapture(args);
}
async function defaultSleep2(ms) {
  await new Promise((r3) => setTimeout(r3, ms));
}
async function watchPublishWorkflow(opts = {}) {
  const runCommand2 = opts.runCommand ?? defaultRunCommand;
  const now = opts.now ?? Date.now;
  const sleep2 = opts.sleep ?? defaultSleep2;
  const intervalSec = clamp2(opts.intervalSec ?? DEFAULT_INTERVAL_SEC, MIN_INTERVAL_SEC, MAX_INTERVAL_SEC);
  const timeoutSec = clamp2(opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC, MIN_TIMEOUT_SEC, MAX_TIMEOUT_SEC);
  const workflowName = opts.workflowName ?? "publish-npm";
  const expectedSha = opts.expectedSha ?? null;
  const startMs = now();
  const timeoutMs = timeoutSec * 1000;
  const intervalMs = intervalSec * 1000;
  const remaining = () => timeoutMs - (now() - startMs);
  let runId = opts.runId ?? null;
  let cachedRun = null;
  while (runId === null) {
    if (remaining() <= 0)
      return { status: "timeout" };
    const args = [
      "gh",
      "run",
      "list",
      "--workflow",
      workflowName,
      "--limit",
      "10",
      "--json",
      "databaseId,status,conclusion,name,headSha,headBranch,url"
    ];
    const res = await runCommand2(args);
    if (res.exitCode === 0 && res.stdout.trim().length > 0) {
      try {
        const rows = JSON.parse(res.stdout);
        const matched = expectedSha ? rows.find((r3) => r3.headSha.startsWith(expectedSha)) : rows[0];
        if (matched) {
          runId = String(matched.databaseId);
          cachedRun = {
            id: runId,
            url: matched.url,
            name: matched.name,
            headSha: matched.headSha,
            headBranch: matched.headBranch
          };
          if (matched.status === "completed") {
            if (matched.conclusion === "success") {
              return { status: "success", run: cachedRun };
            }
            const excerpt = await fetchFailingLog(runCommand2, runId);
            return { status: "failure", run: cachedRun, summaryExcerpt: excerpt };
          }
          break;
        }
      } catch {}
    }
    await sleep2(intervalMs);
  }
  while (true) {
    if (remaining() <= 0)
      return { status: "timeout", ...cachedRun ? { run: cachedRun } : {} };
    const args = [
      "gh",
      "run",
      "view",
      runId,
      "--json",
      "databaseId,status,conclusion,name,headSha,headBranch,url"
    ];
    const res = await runCommand2(args);
    if (res.exitCode === 0 && res.stdout.trim().length > 0) {
      try {
        const row = JSON.parse(res.stdout);
        cachedRun = {
          id: String(row.databaseId),
          url: row.url,
          name: row.name,
          headSha: row.headSha,
          headBranch: row.headBranch
        };
        if (row.status === "completed") {
          if (row.conclusion === "success") {
            return { status: "success", run: cachedRun };
          }
          const excerpt = await fetchFailingLog(runCommand2, runId);
          return { status: "failure", run: cachedRun, summaryExcerpt: excerpt };
        }
      } catch {}
    }
    await sleep2(intervalMs);
  }
}
async function fetchFailingLog(runCommand2, runId) {
  const res = await runCommand2(["gh", "run", "view", runId, "--log-failed"]);
  if (res.exitCode !== 0 || res.stdout.trim().length === 0)
    return "";
  return res.stdout;
}
function renderBody(failure) {
  let excerpt = failure.summaryExcerpt;
  if (excerpt.length === 0) {
    excerpt = EMPTY_SUMMARY_FALLBACK;
  } else if (excerpt.length > SUMMARY_MAX_CHARS) {
    excerpt = excerpt.slice(0, SUMMARY_MAX_CHARS) + TRUNCATION_SENTINEL;
  }
  return [
    "## Failure context",
    "",
    `- workflow: ${failure.workflowName}`,
    `- run id:   ${failure.workflowRunId}`,
    `- run url:  ${failure.workflowRunUrl}`,
    `- commit:   ${failure.commitSha}`,
    `- tag:      ${failure.tag ?? "(none)"}`,
    "",
    "## $GITHUB_STEP_SUMMARY excerpt",
    "",
    excerpt,
    "",
    "## Next steps for operator",
    "",
    "- Investigate the failing step in the run url above.",
    "- Once root cause is known, edit `prevention_seed:` in the frontmatter with the safeguard to apply.",
    "- Promote to a finished prevention via `sgc compound` (manual today; auto-promotion is future scope).",
    ""
  ].join(`
`);
}
async function captureShipFailure(failure, stateRoot2, opts = {}) {
  const now = opts.now ?? Date.now;
  const root3 = resolveStateRoot(stateRoot2);
  const dir = resolve23(root3, "ship-failures");
  await mkdir6(dir, { recursive: true });
  const slug = `${todayUtcDate(now)}-${shortSha3(failure.commitSha)}`;
  const path2 = resolve23(dir, `${slug}.md`);
  try {
    await stat2(path2);
    return { action: "deduped", path: path2 };
  } catch {}
  const preventionSeed = `TODO: operator-fill; captured failure of ${failure.workflowName} ` + `at ${shortSha3(failure.commitSha)}. Convert via \`sgc compound\`.`;
  const frontmatter = {
    kind: "ship-failure",
    captured_at: new Date(now()).toISOString(),
    commit_sha: failure.commitSha,
    tag: failure.tag ?? "(none)",
    workflow_run_id: failure.workflowRunId,
    workflow_run_url: failure.workflowRunUrl,
    workflow_name: failure.workflowName,
    conclusion: "failure",
    prevention_seed: preventionSeed
  };
  const content = serializeFrontmatter(frontmatter, renderBody(failure));
  await writeFile3(path2, content, "utf8");
  return { action: "captured", path: path2 };
}
var DEFAULT_INTERVAL_SEC = 15, DEFAULT_TIMEOUT_SEC = 600, MIN_INTERVAL_SEC = 5, MAX_INTERVAL_SEC = 60, MIN_TIMEOUT_SEC = 60, MAX_TIMEOUT_SEC = 1800, SUMMARY_MAX_CHARS = 2000, TRUNCATION_SENTINEL = "...", EMPTY_SUMMARY_FALLBACK = "(empty — workflow did not write $GITHUB_STEP_SUMMARY)";
var init_ship_failure = __esm(() => {
  init_state();
  init_subprocess();
});

// src/commands/watch-ci-failure.ts
var exports_watch_ci_failure = {};
__export(exports_watch_ci_failure, {
  runWatchCiFailure: () => runWatchCiFailure
});
async function gitOutput2(args) {
  const { stdout: stdout2, exitCode } = await spawnCapture(["git", ...args]);
  if (exitCode !== 0)
    return null;
  const trimmed = stdout2.trim();
  return trimmed.length > 0 ? trimmed : null;
}
async function runWatchCiFailure(opts = {}) {
  const branch = opts.branch ?? await gitOutput2(["rev-parse", "--abbrev-ref", "HEAD"]);
  const headSha = await gitOutput2(["rev-parse", "HEAD"]);
  const tag = await gitOutput2(["describe", "--tags", "--abbrev=0"]);
  const workflow = opts.workflow ?? "publish.yml";
  if (!opts.runId) {
    const remotes = await gitOutput2(["remote"]);
    if (!remotes) {
      throw new Error("no git remote configured — `sgc watch-ci-failure` polls a GitHub Actions run that does not exist for a local-only repo. Add a remote (or pass --run-id <id> to attach directly).");
    }
  }
  const announceTimeout = opts.timeoutSec ?? 600;
  console.error(`watching ${workflow} for ${(headSha ?? "HEAD").slice(0, 7)} on ${branch ?? "(detached)"} — polling up to ${announceTimeout}s…`);
  const result = await watchPublishWorkflow({
    branch: branch ?? undefined,
    expectedSha: headSha ?? undefined,
    runId: opts.runId,
    intervalSec: opts.intervalSec,
    timeoutSec: opts.timeoutSec,
    workflowName: workflow
  });
  if (result.status === "success") {
    const sha = result.run?.headSha ?? headSha ?? "(unknown)";
    console.error(`CI green for ${sha.slice(0, 7)}; no capture.`);
    return;
  }
  if (result.status === "timeout") {
    const t2 = opts.timeoutSec ?? "default";
    console.error(`[PARTIAL: watch timed out after ${t2}s; CI still in progress; no capture written]`);
    return;
  }
  if (!result.run) {
    console.error(`[PARTIAL: failure detected but no run metadata available; no capture written]`);
    return;
  }
  const failure = {
    commitSha: result.run.headSha,
    tag,
    workflowName: workflow,
    workflowRunId: result.run.id,
    workflowRunUrl: result.run.url,
    summaryExcerpt: result.summaryExcerpt ?? ""
  };
  const captured = await captureShipFailure(failure);
  if (captured.action === "captured") {
    console.error(`captured: ${captured.path}`);
  } else {
    console.error(`deduped: ${captured.path} (same SHA already recorded)`);
  }
}
var init_watch_ci_failure = __esm(() => {
  init_ship_failure();
  init_subprocess();
});

// src/dispatcher/canary.ts
import { mkdir as mkdir7, mkdtemp, rm, stat as stat3, writeFile as writeFile4 } from "node:fs/promises";
import { tmpdir as osTmpdir } from "node:os";
import { join as join7, resolve as resolve24 } from "node:path";
function clamp3(n2, lo, hi) {
  return Math.max(lo, Math.min(hi, n2));
}
function shortSha4(sha) {
  return sha.slice(0, 7);
}
function todayUtcDate2(now) {
  return new Date(now()).toISOString().slice(0, 10);
}
function truncate(s2, max) {
  return s2.length > max ? s2.slice(0, max) + TRUNCATION_SENTINEL2 : s2;
}
function isSafeUrl(url) {
  try {
    const u3 = new URL(url);
    return u3.protocol === "http:" || u3.protocol === "https:";
  } catch {
    return false;
  }
}
async function defaultNpmView(pkg) {
  const { stdout: stdout2 } = await spawnCapture(["npm", "view", pkg, "dist-tags.latest", "--json"]);
  return stdout2;
}
function deriveBinName(pkg) {
  if (pkg.startsWith("@")) {
    const tail = pkg.split("/")[1];
    return tail ?? pkg;
  }
  return pkg;
}
async function defaultNpxSmoke(pkg, ver, bin) {
  const dir = await mkdtemp(join7(osTmpdir(), "sgc-canary-smoke-"));
  try {
    const {
      stdout: installStdout,
      stderr: installStderr,
      exitCode: installExit
    } = await spawnCapture(["npm", "install", "--prefix", dir, "--no-save", "--silent", `${pkg}@${ver}`], { env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" } });
    if (installExit !== 0) {
      return {
        exitCode: installExit,
        stdout: installStdout,
        stderr: `npm install ${pkg}@${ver} failed: ${installStderr}`
      };
    }
    const binName = bin ?? deriveBinName(pkg);
    const binPath = resolve24(dir, "node_modules", ".bin", binName);
    const { stdout: stdout2, stderr, exitCode } = await spawnCapture([binPath, "--version"]);
    return { stdout: stdout2, stderr, exitCode };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
async function defaultHttpFetch(url) {
  const controller = new AbortController;
  const timer = setTimeout(() => controller.abort(), HEALTH_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}
async function defaultSleep3(ms) {
  await new Promise((r3) => setTimeout(r3, ms));
}
async function runCanaryChecks(opts) {
  const phases = opts.phases ?? DEFAULT_PHASES;
  const npmView = opts.npmView ?? defaultNpmView;
  const npxSmoke = opts.npxSmoke ?? defaultNpxSmoke;
  const httpFetch = opts.httpFetch ?? defaultHttpFetch;
  const now = opts.now ?? Date.now;
  const sleep2 = opts.sleep ?? defaultSleep3;
  const intervalSec = clamp3(opts.intervalSec ?? DEFAULT_INTERVAL_SEC2, MIN_INTERVAL_SEC2, MAX_INTERVAL_SEC2);
  const timeoutSec = clamp3(opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC2, MIN_TIMEOUT_SEC2, MAX_TIMEOUT_SEC2);
  const intervalMs = intervalSec * 1000;
  const timeoutMs = timeoutSec * 1000;
  if (phases.includes("health_url")) {
    if (!opts.healthUrl) {
      throw new Error("health_url phase requires healthUrl option");
    }
    if (!isSafeUrl(opts.healthUrl)) {
      throw new UnsafeUrlScheme(opts.healthUrl);
    }
  }
  const phaseOutputs = {};
  for (const phase of phases) {
    if (phase === "npm_propagation") {
      const startMs = now();
      let propagated = false;
      while (!propagated) {
        if (now() - startMs >= timeoutMs) {
          return { status: "timeout", phaseOutputs };
        }
        try {
          const raw = await npmView(opts.packageName);
          const parsed = JSON.parse(raw);
          if (typeof parsed === "string" && parsed === opts.expectedVersion) {
            propagated = true;
            break;
          }
        } catch {}
        await sleep2(intervalMs);
      }
    } else if (phase === "smoke_install") {
      const res = await npxSmoke(opts.packageName, opts.expectedVersion, opts.binName);
      if (res.exitCode !== 0) {
        const out = truncate(res.stderr || res.stdout || `npx exited ${res.exitCode}`, PHASE_OUTPUT_MAX_CHARS);
        phaseOutputs.smoke_install = out;
        return { status: "failure", failedPhase: "smoke_install", phaseOutputs };
      }
      if (!res.stdout.includes(opts.expectedVersion)) {
        const out = truncate(`exitCode=0 but stdout missing ${opts.expectedVersion}; stdout=${res.stdout}`, PHASE_OUTPUT_MAX_CHARS);
        phaseOutputs.smoke_install = out;
        return { status: "failure", failedPhase: "smoke_install", phaseOutputs };
      }
    } else if (phase === "health_url") {
      const url = opts.healthUrl;
      const regex2 = opts.healthRegex ? new RegExp(opts.healthRegex) : null;
      let lastResult = null;
      let lastError = null;
      let ok = false;
      for (let attempt = 0;attempt < HEALTH_RETRY_COUNT; attempt++) {
        try {
          const res = await httpFetch(url);
          lastResult = res;
          if (res.status >= 200 && res.status < 300) {
            if (!regex2 || regex2.test(res.body)) {
              ok = true;
              break;
            }
            lastError = `body regex mismatch; body excerpt: ${res.body.slice(0, 500)}`;
          } else {
            lastError = `non-2xx status: ${res.status}; body excerpt: ${res.body.slice(0, 500)}`;
          }
        } catch (err) {
          lastError = `fetch error: ${err instanceof Error ? err.message : String(err)}`;
        }
        if (attempt < HEALTH_RETRY_COUNT - 1) {
          await sleep2(HEALTH_RETRY_INTERVAL_SEC * 1000);
        }
      }
      if (!ok) {
        phaseOutputs.health_url = truncate(lastError ?? "health_url failed with no captured error", PHASE_OUTPUT_MAX_CHARS);
        return { status: "failure", failedPhase: "health_url", phaseOutputs };
      }
    } else {
      throw new Error(`unknown canary phase: ${String(phase)}`);
    }
  }
  return { status: "success", phaseOutputs };
}
function renderBody2(failure) {
  const raw = failure.phaseOutputs[failure.failedPhase] ?? "";
  const excerpt = raw.length === 0 ? "(empty — phase produced no output)" : raw.length > PHASE_OUTPUT_MAX_CHARS ? raw.slice(0, PHASE_OUTPUT_MAX_CHARS) + TRUNCATION_SENTINEL2 : raw;
  return [
    "## Failure context",
    "",
    `- package:    ${failure.packageName}`,
    `- version:    ${failure.expectedVersion}`,
    `- phase:      ${failure.failedPhase}`,
    `- commit:     ${failure.commitSha}`,
    `- tag:        ${failure.tag ?? "(none)"}`,
    `- health url: ${failure.healthUrl ?? "(none)"}`,
    "",
    "## Phase output excerpt",
    "",
    excerpt,
    "",
    "## Next steps for operator",
    "",
    "- Reproduce the failing phase locally with the same arguments.",
    "- Once root cause is known, edit `regression_seed:` in the frontmatter with the safeguard to apply.",
    "- Promote to a finished prevention via `sgc compound --from-canary <slug>` (pending GS-1.1; manual `sgc compound` works today).",
    ""
  ].join(`
`);
}
async function captureCanaryFailure(failure, stateRoot2, opts = {}) {
  const now = opts.now ?? Date.now;
  const root3 = resolveStateRoot(stateRoot2);
  const dir = resolve24(root3, "canaries");
  await mkdir7(dir, { recursive: true });
  const slug = `${todayUtcDate2(now)}-${shortSha4(failure.commitSha)}-${failure.failedPhase}`;
  const path2 = resolve24(dir, `${slug}.md`);
  try {
    await stat3(path2);
    return { action: "deduped", path: path2 };
  } catch {}
  const regressionSeed = `TODO: operator-fill; canary failed at ${failure.failedPhase} ` + `for ${failure.packageName}@${failure.expectedVersion} on ${shortSha4(failure.commitSha)}. ` + `Convert via \`sgc compound --from-canary ${slug}\` (pending GS-1.1).`;
  const frontmatter = {
    kind: "canary-failure",
    captured_at: new Date(now()).toISOString(),
    commit_sha: failure.commitSha,
    tag: failure.tag ?? "(none)",
    package_name: failure.packageName,
    expected_version: failure.expectedVersion,
    failed_phase: failure.failedPhase,
    health_url: failure.healthUrl ?? "(none)",
    regression_seed: regressionSeed
  };
  const content = serializeFrontmatter(frontmatter, renderBody2(failure));
  await writeFile4(path2, content, "utf8");
  return { action: "captured", path: path2 };
}
var DEFAULT_INTERVAL_SEC2 = 15, DEFAULT_TIMEOUT_SEC2 = 300, MIN_INTERVAL_SEC2 = 5, MAX_INTERVAL_SEC2 = 60, MIN_TIMEOUT_SEC2 = 60, MAX_TIMEOUT_SEC2 = 1800, PHASE_OUTPUT_MAX_CHARS = 2000, TRUNCATION_SENTINEL2 = "...", DEFAULT_PHASES, HEALTH_RETRY_COUNT = 3, HEALTH_RETRY_INTERVAL_SEC = 5, HEALTH_FETCH_TIMEOUT_MS = 1e4, UnsafeUrlScheme;
var init_canary = __esm(() => {
  init_state();
  init_subprocess();
  DEFAULT_PHASES = ["npm_propagation", "smoke_install"];
  UnsafeUrlScheme = class UnsafeUrlScheme extends Error {
    constructor(url) {
      super(`UnsafeUrlScheme: ${url} (only http:// and https:// allowed)`);
      this.name = "UnsafeUrlScheme";
    }
  };
});

// src/commands/canary.ts
var exports_canary = {};
__export(exports_canary, {
  runCanary: () => runCanary,
  parsePhases: () => parsePhases,
  VALID_PHASES: () => VALID_PHASES
});
import { readFile as readFile4 } from "node:fs/promises";
import { resolve as resolve25 } from "node:path";
async function gitOutput3(args) {
  const { stdout: stdout2, exitCode } = await spawnCapture(["git", ...args]);
  if (exitCode !== 0)
    return null;
  const trimmed = stdout2.trim();
  return trimmed.length > 0 ? trimmed : null;
}
async function readPackageJson() {
  try {
    const raw = await readFile4(resolve25(process.cwd(), "package.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function parsePhases(csv) {
  if (!csv)
    return DEFAULT_PHASES;
  const tokens = csv.split(",").map((s2) => s2.trim()).filter((s2) => s2.length > 0);
  const invalid = tokens.filter((t2) => !VALID_PHASES.includes(t2));
  if (invalid.length > 0) {
    throw new Error(`unknown canary phase(s): ${invalid.join(", ")}; valid: ${VALID_PHASES.join(", ")}`);
  }
  return tokens;
}
async function runCanary(opts = {}) {
  const pkgJson = await readPackageJson();
  const packageName = opts.packageName ?? pkgJson?.name;
  if (!packageName) {
    console.error("sgc canary: cannot resolve package name — pass --package <name> or run from a directory with package.json");
    process.exitCode = 2;
    return;
  }
  const tagFromGit = await gitOutput3(["describe", "--tags", "--exact-match", "HEAD"]);
  const expectedVersion = opts.expectedVersion ?? pkgJson?.version ?? tagFromGit?.replace(/^v/, "");
  if (!expectedVersion) {
    console.error("sgc canary: cannot resolve expected version — pass --version <ver>, run from a directory with package.json, or tag HEAD");
    process.exitCode = 2;
    return;
  }
  const commitSha = await gitOutput3(["rev-parse", "HEAD"]) ?? "(unknown)";
  const tag = (await gitOutput3(["tag", "--points-at", "HEAD"]))?.split(`
`)[0] ?? null;
  const phases = opts.phases ?? DEFAULT_PHASES;
  const result = await runCanaryChecks({
    packageName,
    expectedVersion,
    phases,
    healthUrl: opts.healthUrl,
    healthRegex: opts.healthRegex,
    binName: opts.binName,
    intervalSec: opts.intervalSec,
    timeoutSec: opts.timeoutSec
  });
  if (result.status === "success") {
    console.error(`canary green for ${packageName}@${expectedVersion}; no capture.`);
    return;
  }
  if (result.status === "timeout") {
    const t2 = opts.timeoutSec ?? "default";
    console.error(`[PARTIAL: canary timed out after ${t2}s; ${packageName}@${expectedVersion} not yet propagated to npm; no capture written]`);
    return;
  }
  if (!result.failedPhase) {
    console.error(`[PARTIAL: failure detected but no failedPhase recorded; no capture written]`);
    process.exitCode = 1;
    return;
  }
  const failure = {
    commitSha,
    tag,
    packageName,
    expectedVersion,
    failedPhase: result.failedPhase,
    healthUrl: opts.healthUrl ?? null,
    phaseOutputs: result.phaseOutputs
  };
  const captured = await captureCanaryFailure(failure);
  if (captured.action === "captured") {
    console.error(`canary failure: phase ${result.failedPhase} for ${packageName}@${expectedVersion}; captured: ${captured.path}`);
  } else {
    console.error(`canary failure: phase ${result.failedPhase} for ${packageName}@${expectedVersion}; deduped: ${captured.path} (same (sha, phase) already recorded)`);
  }
  process.exitCode = 1;
}
var VALID_PHASES;
var init_canary2 = __esm(() => {
  init_canary();
  init_subprocess();
  VALID_PHASES = [
    "npm_propagation",
    "smoke_install",
    "health_url"
  ];
});

// src/dispatcher/handoff.ts
import { existsSync as existsSync24 } from "node:fs";
import * as fs from "node:fs/promises";
import { join as join8 } from "node:path";
import { spawn as nodeSpawn3 } from "node:child_process";
function kebabize(s2) {
  return s2.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function timestampFallback(now) {
  const iso = now.toISOString();
  return `${iso.slice(0, 10)}-${iso.slice(11, 16).replace(":", "")}-handoff`;
}
async function deriveSlug(stateRoot2, now) {
  const dateStr = now.toISOString().slice(0, 10);
  const decisionsDir = join8(stateRoot2, "decisions");
  if (!existsSync24(decisionsDir))
    return timestampFallback(now);
  const entries = await fs.readdir(decisionsDir, { withFileTypes: true });
  const intents = [];
  for (const e2 of entries) {
    if (!e2.isDirectory())
      continue;
    const intentPath2 = join8(decisionsDir, e2.name, "intent.md");
    try {
      const stat5 = await fs.stat(intentPath2);
      intents.push({ path: intentPath2, mtime: stat5.mtimeMs, id: e2.name });
    } catch {}
  }
  if (intents.length === 0)
    return timestampFallback(now);
  intents.sort((a2, b2) => b2.mtime - a2.mtime || a2.id.localeCompare(b2.id));
  const newest = intents[0];
  try {
    const text = await fs.readFile(newest.path, "utf-8");
    const fm = parseFrontmatter(text).data;
    const title = typeof fm.title === "string" ? fm.title : "";
    const kebab = kebabize(title);
    if (kebab.length === 0)
      return timestampFallback(now);
    const truncated = kebab.slice(0, SLUG_KEBAB_MAX).replace(/-+$/, "");
    if (truncated.length === 0)
      return timestampFallback(now);
    return `${dateStr}-${truncated}`;
  } catch {
    return timestampFallback(now);
  }
}
function inferVerifyCommand(snapshot) {
  const pausedLoop = snapshot.loop_runs.find((r3) => r3.status === "paused");
  if (pausedLoop) {
    return {
      source: "loop-run",
      command: `sgc loop --resume ${pausedLoop.run_id}`,
      context: `loop-run ${pausedLoop.run_id} paused at step:${pausedLoop.current_step}`
    };
  }
  const runningJob = snapshot.plan_jobs.find((j) => j.status === "running");
  if (runningJob) {
    return {
      source: "plan-job",
      command: `sgc plan --status ${runningJob.job_id}`,
      context: `plan-job ${runningJob.job_id} running (pid ${runningJob.pid ?? "unknown"})`
    };
  }
  const unclosed = snapshot.unclosed_spawns[0];
  if (unclosed) {
    return {
      source: "events-spawn",
      command: `sgc tail --since ${unclosed.start_ts}`,
      context: `spawn.start for agent ${unclosed.agent} (spawn_id ${unclosed.spawn_id}) at ${unclosed.start_ts} has no paired spawn.end in last ${EVENTS_TAIL_LINES} lines`
    };
  }
  return {
    source: "todo",
    context: "no in-flight loop/plan/spawn detected — operator-fill"
  };
}
async function gatherActiveIntent(stateRoot2) {
  const decisionsDir = join8(stateRoot2, "decisions");
  if (!existsSync24(decisionsDir))
    return;
  try {
    const entries = await fs.readdir(decisionsDir, { withFileTypes: true });
    const refs = [];
    for (const e2 of entries) {
      if (!e2.isDirectory())
        continue;
      const p = join8(decisionsDir, e2.name, "intent.md");
      try {
        const stat5 = await fs.stat(p);
        refs.push({ path: p, mtime: stat5.mtimeMs, id: e2.name });
      } catch {}
    }
    if (refs.length === 0)
      return;
    refs.sort((a2, b2) => b2.mtime - a2.mtime || a2.id.localeCompare(b2.id));
    const newest = refs[0];
    const text = await fs.readFile(newest.path, "utf-8");
    const fm = parseFrontmatter(text).data;
    if (typeof fm.task_id !== "string" || typeof fm.title !== "string" || fm.level !== "L0" && fm.level !== "L1" && fm.level !== "L2" && fm.level !== "L3") {
      return;
    }
    return {
      task_id: fm.task_id,
      level: fm.level,
      title: fm.title,
      intent_path: newest.path,
      mtime: new Date(newest.mtime).toISOString()
    };
  } catch {
    return;
  }
}
async function gatherPlanJobs(stateRoot2) {
  try {
    const jobs = await listJobs2({ stateRoot: stateRoot2 });
    return jobs.filter((j) => j.status !== "done").map((j) => ({
      job_id: j.job_id,
      status: j.status,
      task: j.task.slice(0, TASK_EXCERPT_MAX),
      pid: j.pid,
      started_at: j.started_at
    }));
  } catch {
    return [];
  }
}
async function gatherLoopRuns(stateRoot2) {
  try {
    const runs = await listLoopRuns({ stateRoot: stateRoot2 });
    return runs.filter((r3) => r3.status !== "complete").map((r3) => ({
      run_id: r3.run_id,
      status: r3.status,
      current_step: String(r3.current_step),
      task: r3.task.slice(0, TASK_EXCERPT_MAX),
      started_at: r3.started_at
    }));
  } catch {
    return [];
  }
}
async function scanCaptureDir(dir, kind, seedField) {
  if (!existsSync24(dir))
    return [];
  try {
    const entries = await fs.readdir(dir);
    const out = [];
    for (const name of entries) {
      if (!name.endsWith(".md"))
        continue;
      const slug = name.slice(0, -3);
      try {
        const text = await fs.readFile(join8(dir, name), "utf-8");
        const fm = parseFrontmatter(text).data;
        if (typeof fm.promoted_to === "string" && fm.promoted_to.length > 0)
          continue;
        const rawSeed = fm[seedField];
        const seed = typeof rawSeed === "string" ? rawSeed.slice(0, SEED_EXCERPT_MAX) : undefined;
        out.push({ kind, slug, seed_excerpt: seed });
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}
async function gatherUnpromotedCaptures(stateRoot2) {
  const [ships, canaries] = await Promise.all([
    scanCaptureDir(join8(stateRoot2, "ship-failures"), "ship-failure", "prevention_seed"),
    scanCaptureDir(join8(stateRoot2, "canaries"), "canary", "regression_seed")
  ]);
  return [...ships, ...canaries];
}
async function gatherUnclosedSpawns(stateRoot2, tailLines) {
  const eventsPath2 = join8(stateRoot2, "progress", "events.ndjson");
  if (!existsSync24(eventsPath2))
    return [];
  try {
    const text = await fs.readFile(eventsPath2, "utf-8");
    const allLines = text.split(`
`).filter((l2) => l2.length > 0);
    const lines = allLines.slice(-tailLines);
    const starts = new Map;
    const endedIds = new Set;
    for (const line of lines) {
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof evt.spawn_id !== "string" || typeof evt.event_type !== "string")
        continue;
      if (evt.event_type === "spawn.start") {
        if (typeof evt.agent === "string" && typeof evt.ts === "string") {
          starts.set(evt.spawn_id, {
            spawn_id: evt.spawn_id,
            agent: evt.agent,
            ts: evt.ts
          });
        }
      } else if (evt.event_type === "spawn.end") {
        endedIds.add(evt.spawn_id);
      }
    }
    const unclosed = [];
    for (const [id, s2] of starts) {
      if (!endedIds.has(id)) {
        unclosed.push({ spawn_id: id, agent: s2.agent, start_ts: s2.ts });
      }
    }
    unclosed.sort((a2, b2) => b2.start_ts.localeCompare(a2.start_ts));
    return unclosed;
  } catch {
    return [];
  }
}
async function runGit(args, cwd = process.cwd()) {
  return new Promise((resolve26, reject) => {
    const child = nodeSpawn3("git", args, { cwd });
    let stdout2 = "";
    let stderr = "";
    child.stdout?.on("data", (d2) => stdout2 += d2.toString());
    child.stderr?.on("data", (d2) => stderr += d2.toString());
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0)
        resolve26(stdout2);
      else
        reject(new Error(`git ${args.join(" ")} exited ${code}: ${stderr}`));
    });
  });
}
function defaultGitProbe(cwd = process.cwd()) {
  return {
    async branchAheadBehind() {
      const branch = (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd)).trim();
      let ahead;
      let behind;
      try {
        const counts = (await runGit(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"], cwd)).trim();
        const [b2, a2] = counts.split(/\s+/).map(Number);
        if (!Number.isNaN(a2) && !Number.isNaN(b2)) {
          ahead = a2;
          behind = b2;
        }
      } catch {}
      return { branch, ahead, behind };
    },
    async statusPorcelain() {
      const text = await runGit(["status", "--porcelain=v1"], cwd);
      return text.split(/\r?\n/).filter((l2) => l2.length > 0).slice(0, 10);
    },
    async recentCommits(n2) {
      const text = await runGit(["log", `-${n2}`, "--pretty=format:%h\t%s"], cwd);
      return text.split(/\r?\n/).filter((l2) => l2.length > 0).map((l2) => {
        const [sha, ...rest] = l2.split("\t");
        return { sha: sha ?? "", subject: rest.join("\t").slice(0, 80) };
      });
    }
  };
}
async function gatherGit(probe) {
  const p = probe ?? defaultGitProbe();
  try {
    const { branch, ahead, behind } = await p.branchAheadBehind();
    const changes = await p.statusPorcelain();
    return { branch, ahead, behind, changes };
  } catch {
    return { branch: "(not a git repo)", changes: [] };
  }
}
async function gatherRecentCommits(probe) {
  const p = probe ?? defaultGitProbe();
  try {
    return await p.recentCommits(3);
  } catch {
    return [];
  }
}
async function gatherHandoffState(stateRoot2, repoRoot2, opts) {
  const now = opts?.now ?? new Date;
  const probe = opts?.git ?? defaultGitProbe(repoRoot2);
  const sgcVersion = opts?.sgcVersion ?? "unknown";
  const [
    slug,
    activeIntent,
    planJobs,
    loopRuns,
    unpromoted,
    unclosed,
    git,
    recentCommits
  ] = await Promise.all([
    deriveSlug(stateRoot2, now),
    gatherActiveIntent(stateRoot2),
    gatherPlanJobs(stateRoot2),
    gatherLoopRuns(stateRoot2),
    gatherUnpromotedCaptures(stateRoot2),
    gatherUnclosedSpawns(stateRoot2, EVENTS_TAIL_LINES),
    gatherGit(probe),
    gatherRecentCommits(probe)
  ]);
  const partial = {
    slug,
    generated_at: now.toISOString(),
    cwd: repoRoot2,
    sgc_version: sgcVersion,
    active_intent: activeIntent,
    verify_command: { source: "todo" },
    plan_jobs: planJobs,
    loop_runs: loopRuns,
    unpromoted_captures: unpromoted,
    git,
    recent_commits: recentCommits,
    unclosed_spawns: unclosed
  };
  partial.verify_command = inferVerifyCommand(partial);
  return partial;
}
function renderHandoffMarkdown(snap) {
  const vc = snap.verify_command;
  const verifyCmdField = vc.source === "todo" ? '"TODO: operator-fill"' : vc.command ?? '"TODO: operator-fill"';
  const fm = [
    "---",
    `slug: ${snap.slug}`,
    `generated_at: ${snap.generated_at}`,
    `sgc_version: ${snap.sgc_version}`,
    `verify_command_source: ${vc.source}`,
    `verify_command: ${verifyCmdField}`,
    "---",
    ""
  ];
  const lines = [...fm];
  const title = snap.active_intent?.title ?? "(no active decision)";
  lines.push(`# Paused — ${title}`);
  lines.push("");
  lines.push(`Generated by \`sgc handoff --auto\` at ${snap.generated_at} (cwd: ${snap.cwd}; sgc ${snap.sgc_version}).`);
  lines.push("");
  lines.push("## 1 — Active decision + verify command (Iron Law #2)");
  if (snap.active_intent) {
    lines.push(`- task: \`${snap.active_intent.task_id}\` (${snap.active_intent.level}) — "${snap.active_intent.title}"`);
    lines.push(`- intent: \`${snap.active_intent.intent_path}\` (mtime ${snap.active_intent.mtime})`);
  } else {
    lines.push("- (no active decision — `.sgc/decisions/` empty or absent)");
  }
  if (vc.command) {
    lines.push(`- **verify_command** (source: ${vc.context ?? vc.source}):`);
    lines.push("  ```sh");
    lines.push(`  ${vc.command}`);
    lines.push("  ```");
  } else {
    lines.push(`- **verify_command**: TODO — ${vc.context ?? "operator-fill"}`);
  }
  lines.push("");
  lines.push("## 2 — Plan jobs (in-flight)");
  if (snap.plan_jobs.length === 0) {
    lines.push("- (none)");
  } else {
    for (const j of snap.plan_jobs.slice(0, 5)) {
      lines.push(`- \`${j.job_id}\` ${j.status}${j.pid !== undefined ? ` (pid ${j.pid})` : ""} — "${j.task}"`);
    }
  }
  lines.push("");
  lines.push("## 3 — Loop runs (in-flight)");
  if (snap.loop_runs.length === 0) {
    lines.push("- (none)");
  } else {
    for (const r3 of snap.loop_runs.slice(0, 5)) {
      lines.push(`- \`${r3.run_id}\` ${r3.status} at step:${r3.current_step} — "${r3.task}"`);
    }
  }
  lines.push("");
  lines.push("## 4 — Unpromoted captures");
  if (snap.unpromoted_captures.length === 0) {
    lines.push("- (none)");
  } else {
    for (const c3 of snap.unpromoted_captures.slice(0, 5)) {
      const excerpt = c3.seed_excerpt ?? "(no seed)";
      lines.push(`- ${c3.kind} \`${c3.slug}\` — "${excerpt}"`);
    }
  }
  lines.push("");
  lines.push("## 5 — Git");
  const aheadStr = snap.git.ahead !== undefined || snap.git.behind !== undefined ? ` (ahead ${snap.git.ahead ?? 0}, behind ${snap.git.behind ?? 0})` : "";
  lines.push(`branch: ${snap.git.branch}${aheadStr}`);
  if (snap.git.changes.length > 0) {
    lines.push("```");
    for (const c3 of snap.git.changes)
      lines.push(c3);
    lines.push("```");
  } else {
    lines.push("(clean)");
  }
  lines.push("");
  lines.push("## 6 — Recent commits");
  if (snap.recent_commits.length === 0) {
    lines.push("- (none)");
  } else {
    for (const c3 of snap.recent_commits.slice(0, 3)) {
      lines.push(`- \`${c3.sha}\` ${c3.subject}`);
    }
  }
  lines.push("");
  return lines.join(`
`);
}
async function writeHandoffMarkdown(repoRoot2, slug, content) {
  const tasksDir = join8(repoRoot2, "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  const target = join8(tasksDir, `${slug}-paused.md`);
  const tmp = join8(tasksDir, `.${slug}-paused.md.tmp.${process.pid}.${Date.now()}`);
  await fs.writeFile(tmp, content, "utf-8");
  await fs.rename(tmp, target);
  return target;
}
var EVENTS_TAIL_LINES = 500, SEED_EXCERPT_MAX = 80, SLUG_KEBAB_MAX = 40, TASK_EXCERPT_MAX = 80;
var init_handoff = __esm(() => {
  init_state();
  init_plan_jobs2();
  init_loop();
});

// src/commands/handoff.ts
var exports_handoff = {};
__export(exports_handoff, {
  runHandoff: () => runHandoff
});
import { existsSync as existsSync25 } from "node:fs";
import * as fs2 from "node:fs/promises";
import { join as join9 } from "node:path";
async function runHandoff(opts) {
  const repoRoot2 = opts.repoRoot ?? process.cwd();
  const stateRoot2 = resolveStateRoot(opts.stateRoot);
  const stdout2 = opts.stdoutWrite ?? ((s2) => process.stdout.write(s2));
  const stderr = opts.stderrWrite ?? ((s2) => process.stderr.write(s2));
  if (typeof opts.print === "string" && opts.print.length > 0) {
    const target = join9(repoRoot2, "tasks", `${opts.print}-paused.md`);
    if (!existsSync25(target)) {
      stderr(`no paused.md for slug ${opts.print}
`);
      return { exitCode: 1 };
    }
    const text = await fs2.readFile(target, "utf-8");
    stdout2(text);
    return { exitCode: 0 };
  }
  try {
    const snap = await gatherHandoffState(stateRoot2, repoRoot2, {
      now: opts.now,
      git: opts.gitProbe,
      sgcVersion: opts.sgcVersion
    });
    const md = renderHandoffMarkdown(snap);
    const writtenPath = await writeHandoffMarkdown(repoRoot2, snap.slug, md);
    stderr(`paused: ${writtenPath}
`);
    return { exitCode: 0, writtenPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stderr(`handoff failed: ${msg}
`);
    return { exitCode: 1 };
  }
}
var init_handoff2 = __esm(() => {
  init_handoff();
  init_state();
});

// src/dispatcher/land.ts
import { readFile as readFile7 } from "node:fs/promises";
import { resolve as resolve26 } from "node:path";
async function deriveLandInputs(opts) {
  const repoRoot2 = opts.repoRoot ?? process.cwd();
  let pkgName = opts.package;
  let pkgVersion = opts.version;
  if (!pkgName || !pkgVersion) {
    let parsed = null;
    try {
      const raw = await readFile7(resolve26(repoRoot2, "package.json"), "utf8");
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!pkgName)
      pkgName = parsed?.name;
    if (!pkgVersion)
      pkgVersion = parsed?.version;
  }
  if (!pkgName) {
    throw new LandError("cannot_derive_package", `cannot derive package name (no readable package.json at ${repoRoot2}; pass --package <name>)`);
  }
  if (!pkgVersion) {
    throw new LandError("cannot_derive_version", `cannot derive version (no readable package.json at ${repoRoot2}; pass --version <ver>)`);
  }
  return { packageName: pkgName, version: pkgVersion };
}
function emitLandEvent(logger, event_type, level, payload) {
  logger.event({
    task_id: null,
    spawn_id: null,
    agent: "land",
    event_type,
    level,
    payload
  });
}
async function runLand(opts = {}) {
  const repoRoot2 = opts.repoRoot ?? process.cwd();
  const stateRoot2 = resolveStateRoot(opts.stateRoot ?? (opts.repoRoot ? resolve26(opts.repoRoot, ".sgc") : undefined));
  const stdoutWrite = opts.stdoutWrite ?? ((c3) => {
    process.stdout.write(c3);
  });
  const stderrWrite = opts.stderrWrite ?? ((c3) => {
    process.stderr.write(c3);
  });
  const now = opts.now ?? (() => new Date);
  const logger = opts.logger ?? createLogger({ stateRoot: stateRoot2 });
  const steps = opts.steps ?? defaultStepRunners();
  let derived;
  try {
    derived = await deriveLandInputs({
      repoRoot: repoRoot2,
      package: opts.package,
      version: opts.version
    });
  } catch (e2) {
    if (e2 instanceof LandError) {
      stderrWrite(`land error: ${e2.message}
`);
      return { exitCode: 1, step: "arg-error", errorMessage: e2.message };
    }
    throw e2;
  }
  const start = now();
  emitLandEvent(logger, "land.start", "info", {
    package: derived.packageName,
    version: derived.version
  });
  stdoutWrite(`[1/2] watch-ci-failure ...
`);
  let watchResult;
  try {
    watchResult = await steps.watchCiFailure({ logger, stateRoot: stateRoot2 });
  } catch (e2) {
    const message = e2 instanceof Error ? e2.message : String(e2);
    const errorClass = e2 instanceof Error ? e2.constructor.name : "Unknown";
    stderrWrite(`land error in watch-ci-failure: ${message}
`);
    emitLandEvent(logger, "land.failed", "warn", {
      package: derived.packageName,
      version: derived.version,
      failed_step: "watch-ci-failure",
      error_class: errorClass,
      error_message: message
    });
    return {
      exitCode: 1,
      step: "watch-ci-failure",
      package: derived.packageName,
      version: derived.version,
      errorMessage: message
    };
  }
  if (watchResult.status !== "success") {
    const capturePath = watchResult.captured?.path;
    const detail = capturePath ? `inspect ${capturePath}; ` : "";
    stderrWrite(`land failed at watch-ci-failure: ${detail}fix CI; rerun sgc land
`);
    emitLandEvent(logger, "land.failed", "warn", {
      package: derived.packageName,
      version: derived.version,
      failed_step: "watch-ci-failure",
      capture_path: capturePath ?? null
    });
    return {
      exitCode: 1,
      step: "watch-ci-failure",
      package: derived.packageName,
      version: derived.version,
      watchResult
    };
  }
  stdoutWrite(`[2/2] canary ${derived.packageName}@${derived.version} ...
`);
  let canaryResult;
  try {
    canaryResult = await steps.canary({
      packageName: derived.packageName,
      expectedVersion: derived.version,
      logger,
      stateRoot: stateRoot2
    });
  } catch (e2) {
    const message = e2 instanceof Error ? e2.message : String(e2);
    const errorClass = e2 instanceof Error ? e2.constructor.name : "Unknown";
    stderrWrite(`land error in canary: ${message}
`);
    emitLandEvent(logger, "land.failed", "warn", {
      package: derived.packageName,
      version: derived.version,
      failed_step: "canary",
      error_class: errorClass,
      error_message: message
    });
    return {
      exitCode: 1,
      step: "canary",
      package: derived.packageName,
      version: derived.version,
      watchResult,
      errorMessage: message
    };
  }
  if (canaryResult.status !== "success") {
    const capturePath = canaryResult.captured?.path;
    const detail = capturePath ? `inspect ${capturePath}; ` : "";
    stderrWrite(`land failed at canary: ${detail}check npm registry propagation; rerun sgc land
`);
    emitLandEvent(logger, "land.failed", "warn", {
      package: derived.packageName,
      version: derived.version,
      failed_step: "canary",
      capture_path: capturePath ?? null
    });
    return {
      exitCode: 1,
      step: "canary",
      package: derived.packageName,
      version: derived.version,
      watchResult,
      canaryResult
    };
  }
  stdoutWrite(`land complete: ${derived.packageName}@${derived.version}
`);
  const end = now();
  emitLandEvent(logger, "land.complete", "info", {
    package: derived.packageName,
    version: derived.version,
    duration_ms: end.getTime() - start.getTime()
  });
  return {
    exitCode: 0,
    step: "complete",
    package: derived.packageName,
    version: derived.version,
    watchResult,
    canaryResult
  };
}
async function gitOutput4(args) {
  const { stdout: stdout2, exitCode } = await spawnCapture(["git", ...args]);
  if (exitCode !== 0)
    return null;
  const trimmed = stdout2.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function defaultStepRunners() {
  return {
    async watchCiFailure(_opts) {
      const remotes = await gitOutput4(["remote"]);
      if (!remotes) {
        throw new Error("no git remote configured — `sgc land` watches a GitHub Actions run that does not exist for a local-only repo. Add a remote first.");
      }
      const headSha = await gitOutput4(["rev-parse", "HEAD"]);
      const tag = await gitOutput4(["describe", "--tags", "--abbrev=0"]);
      const workflowName = "publish-npm";
      const result = await watchPublishWorkflow({
        expectedSha: headSha ?? undefined,
        workflowName
      });
      if (result.status === "success" || result.status === "timeout") {
        return { status: result.status, run: result.run };
      }
      if (!result.run) {
        return { status: "failure", run: result.run };
      }
      const failure = {
        commitSha: result.run.headSha,
        tag,
        workflowName,
        workflowRunId: result.run.id,
        workflowRunUrl: result.run.url,
        summaryExcerpt: result.summaryExcerpt ?? ""
      };
      const captured = await captureShipFailure(failure);
      return { status: "failure", run: result.run, captured };
    },
    async canary(opts) {
      const commitSha = await gitOutput4(["rev-parse", "HEAD"]) ?? "(unknown)";
      const tag = (await gitOutput4(["tag", "--points-at", "HEAD"]))?.split(`
`)[0] ?? null;
      const result = await runCanaryChecks({
        packageName: opts.packageName,
        expectedVersion: opts.expectedVersion
      });
      if (result.status === "success" || result.status === "timeout") {
        return { status: result.status, failedPhase: result.failedPhase };
      }
      if (!result.failedPhase) {
        return { status: "failure" };
      }
      const failure = {
        commitSha,
        tag,
        packageName: opts.packageName,
        expectedVersion: opts.expectedVersion,
        failedPhase: result.failedPhase,
        healthUrl: null,
        phaseOutputs: result.phaseOutputs
      };
      const captured = await captureCanaryFailure(failure);
      return { status: "failure", failedPhase: result.failedPhase, captured };
    }
  };
}
var LandError;
var init_land = __esm(() => {
  init_ship_failure();
  init_canary();
  init_logger();
  init_state();
  init_subprocess();
  LandError = class LandError extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "LandError";
    }
  };
});

// src/commands/land.ts
var exports_land = {};
__export(exports_land, {
  runLandCli: () => runLandCli
});
async function runLandCli(opts = {}) {
  const result = await runLand({
    package: opts.package,
    version: opts.version,
    repoRoot: opts.repoRoot,
    stateRoot: opts.stateRoot,
    stdoutWrite: opts.stdoutWrite,
    stderrWrite: opts.stderrWrite
  });
  return { exitCode: result.exitCode };
}
var init_land2 = __esm(() => {
  init_land();
});

// src/commands/plan.ts
function generateTaskId2() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function nowIso10() {
  return new Date().toISOString();
}
async function readLineSync2() {
  const stdin2 = process.stdin;
  return new Promise((resolve27) => {
    stdin2.resume();
    stdin2.setEncoding("utf8");
    let buf = "";
    const onData = (chunk) => {
      buf += chunk;
      const nl = buf.indexOf(`
`);
      if (nl !== -1) {
        stdin2.removeListener("data", onData);
        stdin2.pause();
        resolve27(buf.slice(0, nl).trim());
      }
    };
    stdin2.on("data", onData);
  });
}
async function defaultReadConfirmation2() {
  return readLineSync2();
}
async function runPlan2(taskDescription, opts = {}) {
  const asyncChildJobId = process.env["SGC_PLAN_ASYNC_CHILD"];
  if (opts.async && !asyncChildJobId) {
    const parentLogger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
    const childOpts = {};
    if (opts.forceLevel !== undefined)
      childOpts.forceLevel = opts.forceLevel;
    if (opts.userSignature !== undefined)
      childOpts.userSignature = opts.userSignature;
    if (opts.motivation !== undefined)
      childOpts.motivation = opts.motivation;
    if (opts.autoConfirm !== undefined)
      childOpts.autoConfirm = opts.autoConfirm;
    if (opts.forceNewTask !== undefined)
      childOpts.forceNewTask = opts.forceNewTask;
    const fork = await forkAsyncPlanJob2(taskDescription, {
      stateRoot: opts.stateRoot,
      extraEnv: { SGC_PLAN_CHILD_OPTS: JSON.stringify(childOpts) }
    });
    emitAsyncStart2(fork.job.job_id, taskDescription, parentLogger, {
      pid: fork.job.pid,
      log_path: fork.job.log_path
    });
    process.stderr.write(`async plan job ${fork.job.job_id} (pid=${fork.job.pid})
`);
    process.stderr.write(`  task:    ${taskDescription}
`);
    process.stderr.write(`  log:     ${fork.job.log_path}
`);
    process.stderr.write(`  watch:   sgc plan --status ${fork.job.job_id}
`);
    process.stderr.write(`  events:  sgc tail --event-type plan.async_start,plan.async_complete,plan.async_failed --follow
`);
    return {
      taskId: fork.job.job_id,
      intentPath: fork.jobPath
    };
  }
  if (asyncChildJobId) {
    let childMerged = opts;
    const rawChildOpts = process.env["SGC_PLAN_CHILD_OPTS"];
    if (rawChildOpts) {
      try {
        const parsed = JSON.parse(rawChildOpts);
        childMerged = { ...opts, ...parsed, async: false };
      } catch {}
    }
    try {
      const result = await runPlanCore2(taskDescription, childMerged);
      await completePlanJob2(asyncChildJobId, {
        taskId: result.taskId,
        level: result.level,
        intentPath: result.intentPath
      }, { stateRoot: opts.stateRoot, logger: opts.logger });
      return result;
    } catch (err) {
      await failPlanJob2(asyncChildJobId, err instanceof Error ? err.message : String(err), { stateRoot: opts.stateRoot, logger: opts.logger });
      throw err;
    }
  }
  return runPlanCore2(taskDescription, opts);
}
function planEvalLabel2(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/\s+/g, " ").slice(0, 120);
}
function emitPlannerFailed2(agent, err, logger, taskId) {
  logger.event({
    task_id: taskId,
    spawn_id: null,
    agent,
    event_type: "planner.spawn_failed",
    level: "warn",
    payload: {
      error_class: err instanceof Error ? err.name : "unknown",
      error_message: planEvalLabel2(err)
    }
  });
}
function degradedEngOutput2(err, logger, taskId) {
  emitPlannerFailed2("planner.eng", err, logger, taskId);
  return {
    verdict: "revise",
    concerns: [`planner.eng could not be evaluated (${planEvalLabel2(err)}) — treat as needs-review`],
    structural_risks: []
  };
}
function degradedCeoOutput2(err, logger, taskId) {
  emitPlannerFailed2("planner.ceo", err, logger, taskId);
  return {
    verdict: "revise",
    concerns: [`planner.ceo could not be evaluated (${planEvalLabel2(err)}) — treat as needs-review`],
    rewrite_hints: []
  };
}
async function runPlanCore2(taskDescription, opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot2 = opts.stateRoot;
  ensureSgcStructure(stateRoot2);
  const existingHandoff = readHandoff(stateRoot2);
  if (existingHandoff) {
    const { handoff: handoff2 } = existingHandoff;
    const isCompleted = handoff2.to_session_hint === "next task" || handoff2.summary?.includes("shipped") || handoff2.summary?.includes("Ready for next task");
    if (!isCompleted && !opts.forceNewTask) {
      log(`Active task detected in handoff: ${handoff2.from_session}.
` + `Summary: ${handoff2.summary}
` + `Pass --force-new-task to start a new task anyway.`);
      throw new Error(`active task in handoff.md — complete it or pass --force-new-task`);
    }
  }
  const taskId = generateTaskId2();
  const createdAt = nowIso10();
  log(`task_id = ${taskId}`);
  const classRes = await spawn3("classifier.level", { user_request: taskDescription }, {
    stateRoot: stateRoot2,
    inlineStub: (i2) => opts.classifierOverride ?? classifierLevel(i2),
    logger,
    taskId
  });
  validateClassifierRationale(classRes.output.rationale);
  const classified = applyHeuristicFloor(classRes.output, { user_request: taskDescription });
  if (classified.level !== classRes.output.level) {
    log(`classifier verdict ${classRes.output.level} raised to ${classified.level} ` + `by the deterministic heuristic floor (HARD escalation rule)`);
  }
  let level = classified.level;
  log(`classifier verdict: ${level} — ${classified.rationale}`);
  if (opts.forceLevel) {
    if (LEVEL_RANK[opts.forceLevel] < LEVEL_RANK[level]) {
      throw new Error(`forceLevel ${opts.forceLevel} would downgrade ${level} — refused (upgrade-only rule)`);
    }
    level = opts.forceLevel;
    log(`level overridden to ${level} (upgrade)`);
  }
  const motivation = opts.motivation ?? taskDescription;
  if (level !== "L0") {
    const motivationWords = wordCount(motivation);
    if (motivationWords < 20) {
      throw new Error(`motivation must be ≥20 words (sgc-state.schema.yaml min_words rule); ` + `got ${motivationWords} word(s). Re-run with ` + `--motivation "<longer rationale describing why this matters and what changes>".`);
    }
  }
  let plannerEngOut = null;
  let plannerCeoOut = null;
  let researcherOut = null;
  let adversarialOut = null;
  let capturedPriorPreventions = [];
  if (LEVEL_RANK[level] >= 2) {
    for (const hint of delegationHintsFor("plan.researcher"))
      log(formatHint(hint));
    if (level === "L3") {
      for (const hint of delegationHintsFor("plan.adversarial"))
        log(formatHint(hint));
    }
    const tasks = [
      (async () => {
        try {
          return await spawn3("planner.eng", { intent_draft: taskDescription }, { stateRoot: stateRoot2, inlineStub: (i2) => plannerEng(i2), logger, taskId });
        } catch (err) {
          return { output: degradedEngOutput2(err, logger, taskId) };
        }
      })(),
      (async () => {
        try {
          return await spawn3("planner.ceo", { intent_draft: taskDescription }, { stateRoot: stateRoot2, inlineStub: (i2) => plannerCeo(i2), logger, taskId });
        } catch (err) {
          return { output: degradedCeoOutput2(err, logger, taskId) };
        }
      })(),
      (async () => {
        const candidates = await preFilterSolutions(taskDescription, stateRoot2);
        if (candidates.length === 0) {
          return {
            output: {
              prior_art: [],
              warnings: ["no candidates from pre-filter"]
            }
          };
        }
        try {
          const r3 = await spawn3("researcher.history", { intent_draft: taskDescription, candidates }, {
            stateRoot: stateRoot2,
            inlineStub: (i2) => researcherHistory(i2, { stateRoot: stateRoot2 }),
            logger,
            taskId
          });
          return { output: coerceLlmOutput(r3.output, candidates) };
        } catch (err) {
          return { output: handleCoerceFailure(err, logger, taskId) };
        }
      })()
    ];
    if (level === "L3") {
      tasks.push((async () => {
        let priorPreventions = [];
        try {
          priorPreventions = await extractPreventions(taskDescription, stateRoot2, { logger, taskId });
          capturedPriorPreventions = priorPreventions;
        } catch (err) {
          const errName = err instanceof Error ? err.name : "unknown";
          const errMsg = err instanceof Error ? err.message : "";
          logger.event({
            task_id: taskId,
            spawn_id: null,
            agent: "plan.preventions",
            event_type: "prevention.extract_failed",
            level: "warn",
            payload: { error_class: errName, error_message: errMsg }
          });
        }
        if (priorPreventions.length > 0) {
          log(`prevention recall: ${priorPreventions.length} prior failure shape(s) matched`);
          for (const p of priorPreventions) {
            log(`  prevention: ${p.solution_ref}`);
          }
        }
        const adversarialInput = {
          intent_draft: taskDescription,
          ...priorPreventions.length > 0 ? { prior_preventions: priorPreventions } : {}
        };
        return spawn3("planner.adversarial", adversarialInput, {
          stateRoot: stateRoot2,
          inlineStub: (i2) => opts.adversarialOverride ?? plannerAdversarial(i2),
          logger,
          taskId
        });
      })());
    }
    const results = await Promise.all(tasks);
    plannerEngOut = results[0].output;
    plannerCeoOut = results[1].output;
    researcherOut = results[2].output;
    if (level === "L3") {
      adversarialOut = results[3].output;
      if (capturedPriorPreventions.length > 0 && adversarialOut.failure_modes.length > 0) {
        try {
          const refs = extractAppliedSolutionRefs(adversarialOut.failure_modes, capturedPriorPreventions);
          if (refs.length > 0) {
            const appliedResult = recordApplied(stateRoot2, refs, taskId, { logger });
            logger.event({
              task_id: taskId,
              spawn_id: null,
              agent: "plan.applied",
              event_type: "plan.applied_recorded",
              level: "info",
              payload: {
                solution_refs_input: refs,
                updated: appliedResult.updated,
                skipped_already_applied: appliedResult.skipped_already_applied,
                skipped_missing: appliedResult.skipped_missing,
                skipped_malformed: appliedResult.skipped_malformed,
                stale_skipped: appliedResult.stale_skipped,
                write_failed: appliedResult.write_failed
              }
            });
            if (appliedResult.updated.length > 0) {
              log(`applied_in updated: ${appliedResult.updated.length} solution(s) tracked task ${taskId}`);
            }
          }
        } catch (err) {
          const errName = err instanceof Error ? err.name : "unknown";
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.event({
            task_id: taskId,
            spawn_id: null,
            agent: "plan.applied",
            event_type: "plan.applied_wire_failed",
            level: "warn",
            payload: { error_class: errName, error_message: errMsg, reason: "wire_up_throw" }
          });
        }
      }
    }
    const surfacedRefs = selectSurfacedRefs(researcherOut.prior_art);
    if (surfacedRefs.length > 0) {
      try {
        const surfacedResult = recordSurfaced(stateRoot2, surfacedRefs, taskId, { logger });
        logger.event({
          task_id: taskId,
          spawn_id: null,
          agent: "plan.surfaced",
          event_type: "plan.surfaced_recorded",
          level: "info",
          payload: {
            solution_refs_input: surfacedRefs,
            updated: surfacedResult.updated,
            skipped_already_applied: surfacedResult.skipped_already_applied,
            skipped_missing: surfacedResult.skipped_missing,
            skipped_malformed: surfacedResult.skipped_malformed,
            stale_skipped: surfacedResult.stale_skipped,
            write_failed: surfacedResult.write_failed
          }
        });
        if (surfacedResult.updated.length > 0) {
          log(`surfaced_in updated: ${surfacedResult.updated.length} solution(s) tracked task ${taskId}`);
        }
      } catch (err) {
        const errName = err instanceof Error ? err.name : "unknown";
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.event({
          task_id: taskId,
          spawn_id: null,
          agent: "plan.surfaced",
          event_type: "plan.surfaced_wire_failed",
          level: "warn",
          payload: { error_class: errName, error_message: errMsg, reason: "wire_up_throw" }
        });
      }
    }
    log(`planner.eng verdict: ${plannerEngOut.verdict}`);
    if (plannerEngOut.concerns.length > 0) {
      for (const c3 of plannerEngOut.concerns)
        log(`  eng concern: ${c3}`);
    }
    log(`planner.ceo verdict: ${plannerCeoOut.verdict}`);
    if (plannerCeoOut.concerns.length > 0) {
      for (const c3 of plannerCeoOut.concerns)
        log(`  ceo concern: ${c3}`);
    }
    if (plannerCeoOut.rewrite_hints.length > 0) {
      for (const h2 of plannerCeoOut.rewrite_hints)
        log(`  ceo hint: ${h2}`);
    }
    log(`researcher.history: ${researcherOut.prior_art.length} prior art entries${researcherOut.warnings.length ? `, ${researcherOut.warnings.length} warning(s)` : ""}`);
    for (const w2 of researcherOut.warnings)
      log(`  research warning: ${w2}`);
    if (adversarialOut) {
      log(`planner.adversarial: ${adversarialOut.failure_modes.length} failure mode(s)`);
      for (const fm of adversarialOut.failure_modes) {
        log(`  [${fm.probability}/${fm.impact}] ${fm.scenario}`);
      }
    }
  } else if (LEVEL_RANK[level] >= 1) {
    try {
      const planRes = await spawn3("planner.eng", { intent_draft: taskDescription }, { stateRoot: stateRoot2, inlineStub: (i2) => plannerEng(i2), logger, taskId });
      plannerEngOut = planRes.output;
    } catch (err) {
      plannerEngOut = degradedEngOutput2(err, logger, taskId);
    }
    log(`planner.eng verdict: ${plannerEngOut.verdict}`);
    if (plannerEngOut.concerns.length > 0) {
      for (const c3 of plannerEngOut.concerns)
        log(`  concern: ${c3}`);
    }
  }
  if (level === "L3" && !opts.userSignature) {
    throw new Error(`L3 plan requires human signature. Re-run with --signed-by <signer_id> ` + `to acknowledge architecture-level scope.`);
  }
  if (level === "L3" && opts.autoConfirm) {
    throw new Error(`L3 plan refuses --auto (Invariant §4). Human confirmation at stdin is required.`);
  }
  let fused;
  if (plannerCeoOut && plannerEngOut) {
    fused = fusePlan({ ceo: plannerCeoOut, eng: plannerEngOut, adversarial: adversarialOut });
  }
  const fusedSection = fused ? renderFusedSection(fused) + `

` : "";
  const fusedVerdict = fused?.fused_verdict;
  const deepActive = level !== "L0" && (LEVEL_RANK[level] >= 2 || level === "L1" && opts.deep === true);
  let decomposed = null;
  if (deepActive) {
    const decomposeInput = {
      intent_draft: taskDescription,
      ...plannerEngOut ? { structural_risks: plannerEngOut.structural_risks } : {},
      ...researcherOut ? { prior_art: researcherOut.prior_art } : {},
      ...adversarialOut ? { failure_modes: adversarialOut.failure_modes } : {},
      ...capturedPriorPreventions.length > 0 ? { prior_preventions: capturedPriorPreventions } : {}
    };
    const decRes = await spawn3("planner.decompose", decomposeInput, {
      stateRoot: stateRoot2,
      inlineStub: (i2) => plannerDecompose(i2),
      logger,
      taskId
    });
    decomposed = decRes.output;
    log(`planner.decompose: ${decomposed.tasks.length} task(s)`);
  }
  if (level === "L3") {
    log("");
    log("=== L3 PLAN SUMMARY — confirm before intent.md is written (immutable) ===");
    log(`  task_id:    ${taskId}`);
    log(`  task:       ${taskDescription.slice(0, 120)}`);
    log(`  classifier: ${classRes.output.rationale}`);
    if (plannerEngOut)
      log(`  eng:        ${plannerEngOut.verdict} (${plannerEngOut.concerns.length} concerns)`);
    if (plannerCeoOut)
      log(`  ceo:        ${plannerCeoOut.verdict} (${plannerCeoOut.concerns.length} concerns)`);
    if (researcherOut)
      log(`  research:   ${researcherOut.prior_art.length} prior art entries`);
    if (adversarialOut)
      log(`  pre-mortem: ${adversarialOut.failure_modes.length} failure mode(s)`);
    if (fused) {
      log(`  fused:      ${fused.fused_verdict} — ${fused.decision_basis} (advisory; human signature still required)`);
    }
    log(`  signer:     ${opts.userSignature.signer_id}`);
    log("");
    log("Type 'yes' to commit intent.md (or Ctrl+C to abort):");
    const reader = opts.readConfirmation ?? defaultReadConfirmation2;
    const answer = (await reader()).trim().toLowerCase();
    if (answer !== "yes") {
      throw new Error(`L3 plan not confirmed at stdin (got '${answer || "(empty)"}'); intent.md NOT written.`);
    }
    log("confirmed — writing intent.md");
  }
  let intentPath2 = "(skipped — L0)";
  if (level !== "L0") {
    const intent = {
      task_id: taskId,
      level,
      created_at: createdAt,
      title: taskDescription.slice(0, 120),
      motivation,
      affected_readers: classRes.output.affected_readers_candidates,
      scope_tokens: computeCommandTokens("/plan"),
      user_signature: opts.userSignature,
      fused_verdict: fusedVerdict,
      body: fusedSection + `## Classifier rationale

${classified.rationale}

` + (plannerEngOut ? `## Planner.eng verdict

${plannerEngOut.verdict}

` + (plannerEngOut.concerns.length ? `### Eng concerns

${plannerEngOut.concerns.map((c3) => `- ${c3}`).join(`
`)}

` : "") : "") + (plannerCeoOut ? `## Planner.ceo verdict

${plannerCeoOut.verdict}

` + (plannerCeoOut.concerns.length ? `### CEO concerns

${plannerCeoOut.concerns.map((c3) => `- ${c3}`).join(`
`)}

` : "") + (plannerCeoOut.rewrite_hints.length ? `### CEO rewrite hints

${plannerCeoOut.rewrite_hints.map((h2) => `- ${h2}`).join(`
`)}

` : "") : "") + (researcherOut ? `${PRIOR_ART_SENTINEL_BEGIN}
` + `## Prior art (researcher.history)

` + (researcherOut.prior_art.length === 0 ? `_No prior art found._

` : researcherOut.prior_art.map((p) => {
        const excerpt = p.excerpt?.trim();
        const ref = `- **${p.solution_ref}** (score ${p.relevance_score.toFixed(2)})`;
        const head = excerpt ? `${ref}: ${excerpt}` : ref;
        return p.relevance_reason ? `${head}
  Reason: ${p.relevance_reason}` : head;
      }).join(`
`) + `

`) + (researcherOut.warnings.length ? `### Research warnings

${researcherOut.warnings.map((w2) => `- ${w2}`).join(`
`)}

` : "") + `${PRIOR_ART_SENTINEL_END}

` : "") + (adversarialOut ? `${PRE_MORTEM_SENTINEL_BEGIN}
` + `## Pre-mortem (planner.adversarial)

` + adversarialOut.failure_modes.map((fm) => `### [${fm.probability}/${fm.impact}] ${fm.scenario}
` + `Early signal: ${fm.early_signal}
`).join(`
`) + `
${PRE_MORTEM_SENTINEL_END}
` : "")
    };
    intentPath2 = writeIntent(intent, stateRoot2);
    log(`wrote ${intentPath2}`);
  } else {
    log(`L0 task: skipping intent.md per schema (decisions/ not written for L0)`);
  }
  if (decomposed && decomposed.tasks.length > 0) {
    const features = decomposed.tasks.map((t2) => ({
      id: t2.id,
      title: t2.title,
      status: "pending",
      files: t2.files,
      steps: t2.steps,
      ...t2.prior_art_refs.length > 0 ? { prior_art_refs: t2.prior_art_refs } : {}
    }));
    writeFeatureList({ features }, "Authored by `sgc plan` deep decomposition. Each task carries file-level scope + bite-sized TDD steps.\n", stateRoot2);
    const slug = taskDescription.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "plan";
    const dateIso = createdAt.slice(0, 10);
    const md = renderPlanMarkdown({ features }, { title: taskDescription.slice(0, 120), level });
    const docPath = writePlanDoc(slug, dateIso, md, stateRoot2);
    log(`wrote plan doc ${docPath}`);
  } else {
    writeFeatureList({
      features: [
        {
          id: "f1",
          title: taskDescription.slice(0, 200),
          status: "pending"
        }
      ]
    }, "Refine this list during `sgc work`. The dispatcher does not infer fine-grained features in MVP.\n", stateRoot2);
  }
  writeCurrentTask({
    task_id: taskId,
    level,
    active_feature: "f1",
    session_start: createdAt,
    last_activity: createdAt
  }, "", stateRoot2);
  const handoff = {
    from_session: taskId,
    to_session_hint: "sgc work",
    summary: `Plan created for task ${taskId} at level ${level}.`,
    open_questions: []
  };
  writeHandoff(handoff, `Plan written for task ${taskId}. Level ${level}. Resume via 'sgc work'.
`, stateRoot2);
  log(``);
  log(`Plan complete. Run \`sgc work\` to begin execution.`);
  return { taskId, level, intentPath: intentPath2 };
}
var init_plan2 = __esm(() => {
  init_spawn();
  init_classifier_level2();
  init_planner_eng2();
  init_planner_ceo2();
  init_researcher_history();
  init_planner_adversarial2();
  init_planner_decompose2();
  init_preventions();
  init_applied_tracker();
  init_rationale();
  init_state();
  init_capabilities();
  init_delegation();
  init_fuse_plan();
  init_logger();
  init_plan_jobs2();
});

// src/commands/review.ts
function generateReportId3() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function nowIso11() {
  return new Date().toISOString();
}
function captureDiff2(base, cwd, maxBytes) {
  const r3 = spawnCaptureSync(["git", "diff", base], { cwd, maxBuffer: maxBytes });
  if (r3.exitCode === 0)
    return r3.stdout;
  if (r3.exitCode === -1) {
    throw new Error(`git diff capture failed (base=${base}) — the diff was not captured, ` + `so review cannot run against it: ${r3.stderr.slice(0, 200)}`);
  }
  return "";
}
function stripSentinelBlock2(body, begin, end, legacyHeadingRe) {
  const beginIdx = body.indexOf(begin);
  if (beginIdx !== -1) {
    const endIdx = body.indexOf(end, beginIdx);
    if (endIdx !== -1) {
      const after = endIdx + end.length;
      const cut = body[after] === `
` ? after + 1 : after;
      return body.slice(0, beginIdx) + body.slice(cut);
    }
    const tail = body.slice(beginIdx);
    const next = /\n## /.exec(tail);
    const cutEnd = beginIdx + (next?.index ?? tail.length);
    return body.slice(0, beginIdx) + body.slice(cutEnd);
  }
  const m2 = legacyHeadingRe.exec(body);
  if (!m2)
    return body;
  const afterHeading = body.slice(m2.index + m2[0].length);
  const nextHeading = /^## /m.exec(afterHeading);
  const sectionEnd = m2.index + m2[0].length + (nextHeading?.index ?? afterHeading.length);
  return body.slice(0, m2.index) + body.slice(sectionEnd);
}
function stripBackChannelSections2(body) {
  let stripped = body;
  stripped = stripSentinelBlock2(stripped, PRIOR_ART_SENTINEL_BEGIN, PRIOR_ART_SENTINEL_END, /^## Prior art \(researcher\.history\)\r?\n/m);
  stripped = stripSentinelBlock2(stripped, PRE_MORTEM_SENTINEL_BEGIN, PRE_MORTEM_SENTINEL_END, /^## Pre-mortem \(planner\.adversarial\)\r?\n/m);
  return stripped;
}
function worstVerdict2(verdicts) {
  return verdicts.reduce((acc, v2) => VERDICT_ORDER2[v2] > VERDICT_ORDER2[acc] ? v2 : acc, "pass");
}
async function runReview2(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot2 = opts.stateRoot;
  const ct = readCurrentTask(stateRoot2);
  if (!ct)
    throw new Error("no active task — run `sgc plan <task>` first");
  const taskId = ct.task.task_id;
  const level = ct.task.level;
  if (level === "L0") {
    throw new Error("L0 tasks are fast-path: no intent.md is written and review/qa/ship are L2+ gates. Nothing to review.");
  }
  for (const hint of delegationHintsFor("review.cluster"))
    log(formatHint(hint));
  const intent = readIntent(taskId, stateRoot2);
  const intentForReviewer = stripBackChannelSections2(intent.body ?? "");
  const diff = opts.diffOverride ?? captureDiff2(opts.base ?? "HEAD");
  const r3 = await spawn3("reviewer.correctness", { diff, intent: intentForReviewer }, {
    stateRoot: stateRoot2,
    inlineStub: (i2) => reviewerCorrectness(i2),
    logger,
    taskId
  });
  const correctnessReport = {
    report_id: generateReportId3(),
    task_id: taskId,
    stage: "code",
    reviewer_id: "reviewer.correctness",
    reviewer_version: "0.1",
    verdict: r3.output.verdict,
    severity: r3.output.severity,
    findings: r3.output.findings,
    created_at: nowIso11(),
    engine: r3.mode
  };
  const reportPath = appendReview(correctnessReport, "", stateRoot2, opts.appendAs);
  log(`reviewer.correctness: ${correctnessReport.verdict} (severity: ${correctnessReport.severity}, ${correctnessReport.findings.length} finding(s))`);
  for (const f3 of correctnessReport.findings.slice(0, 5)) {
    log(`  - ${f3.description}`);
  }
  if (correctnessReport.findings.length > 5) {
    log(`  ... ${correctnessReport.findings.length - 5} more findings (see ${reportPath})`);
  }
  const isL2Plus = level === "L2" || level === "L3";
  const clusterReports = [];
  async function runClusterReviewer(name, agent) {
    const res = await spawn3(name, { diff, intent: intentForReviewer }, { stateRoot: stateRoot2, inlineStub: (i2) => agent(i2), logger, taskId });
    const report = {
      report_id: generateReportId3(),
      task_id: taskId,
      stage: "code",
      reviewer_id: name,
      reviewer_version: "0.1",
      verdict: res.output.verdict,
      severity: res.output.severity,
      findings: res.output.findings,
      created_at: nowIso11(),
      engine: res.mode
    };
    const path2 = appendReview(report, "", stateRoot2, opts.appendAs);
    clusterReports.push({
      reviewerId: name,
      verdict: res.output.verdict,
      severity: res.output.severity,
      reportPath: path2,
      findingsCount: res.output.findings.length
    });
    log(`${name}: ${res.output.verdict} (severity: ${res.output.severity}, ${res.output.findings.length} finding(s))`);
  }
  if (isL2Plus) {
    await runClusterReviewer("reviewer.tests", reviewerTests);
    await runClusterReviewer("reviewer.maintainability", reviewerMaintainability);
  }
  const specialistReports = [];
  if (isL2Plus) {
    const matched = matchSpecialists(diff);
    if (matched.length > 0) {
      const specialistMode = process.env["SGC_REVIEW_SPECIALIST_LLM"] === "0" ? "inline" : undefined;
      const specResults = await Promise.all(matched.map((s2) => spawn3(s2.name, { diff, intent: intentForReviewer }, {
        stateRoot: stateRoot2,
        inlineStub: (i2) => s2.agent(i2),
        ...specialistMode ? { mode: specialistMode } : {},
        logger,
        taskId
      })));
      for (let i2 = 0;i2 < matched.length; i2++) {
        const s2 = matched[i2];
        const out = specResults[i2].output;
        const report = {
          report_id: generateReportId3(),
          task_id: taskId,
          stage: "code",
          reviewer_id: s2.name,
          reviewer_version: "0.1",
          verdict: out.verdict,
          severity: out.severity,
          findings: out.findings,
          created_at: nowIso11(),
          engine: specResults[i2].mode
        };
        const path2 = appendReview(report, "", stateRoot2, opts.appendAs);
        specialistReports.push({
          reviewerId: s2.name,
          verdict: out.verdict,
          severity: out.severity,
          reportPath: path2,
          findingsCount: out.findings.length
        });
        log(`${s2.name}: ${out.verdict} (severity: ${out.severity}, ${out.findings.length} finding(s))`);
        for (const f3 of out.findings.slice(0, 3)) {
          log(`  - ${f3.description}`);
        }
      }
    }
  }
  log(`wrote ${reportPath}${specialistReports.length > 0 ? ` (+${specialistReports.length} specialists)` : ""}`);
  const aggregateVerdict = worstVerdict2([
    correctnessReport.verdict,
    ...clusterReports.map((s2) => s2.verdict),
    ...specialistReports.map((s2) => s2.verdict)
  ]);
  return { taskId, verdict: aggregateVerdict, reportPath, specialistReports: [...clusterReports, ...specialistReports] };
}
var VERDICT_ORDER2;
var init_review2 = __esm(() => {
  init_subprocess();
  init_spawn();
  init_reviewer_correctness2();
  init_reviewer_specialists();
  init_reviewer_quality();
  init_state();
  init_delegation();
  init_logger();
  VERDICT_ORDER2 = { pass: 0, concern: 1, fail: 2 };
});

// src/commands/qa.ts
import { mkdirSync as mkdirSync8 } from "node:fs";
import { join as join10 } from "node:path";
function qaScreenshotDir2(stateRoot2, taskId) {
  return join10(resolveStateRoot(stateRoot2), "reviews", taskId, "qa");
}
function generateReportId4() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
}
function nowIso12() {
  return new Date().toISOString();
}
function verdictToSeverity2(v2) {
  if (v2 === "pass")
    return "none";
  if (v2 === "concern")
    return "low";
  return "high";
}
async function runQa2(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const stateRoot2 = opts.stateRoot;
  const ct = readCurrentTask(stateRoot2);
  if (!ct)
    throw new Error("no active task — run `sgc plan <task>` first");
  const taskId = ct.task.task_id;
  const target = opts.target ?? "";
  const flows = opts.flows ?? [];
  const optIn = opts.browse === true || process.env["SGC_QA_REAL"] === "1";
  let browseRunner = opts.browseRunner;
  if (!browseRunner && optIn) {
    const shotDir = qaScreenshotDir2(stateRoot2, String(taskId));
    mkdirSync8(shotDir, { recursive: true });
    browseRunner = makeBrowseRunner({ launch: launchPlaywrightSession, screenshotDir: shotDir });
  }
  const r3 = await spawn3("qa.browser", { target_url: target, user_flows: flows }, {
    stateRoot: stateRoot2,
    inlineStub: (i2) => qaBrowser(i2, browseRunner ? { browseRunner } : {}),
    logger,
    taskId
  });
  const realFlows = r3.output.failed_flows.filter((f3) => f3.step !== "note");
  const report = {
    report_id: generateReportId4(),
    task_id: taskId,
    stage: "qa",
    reviewer_id: "qa.browser",
    reviewer_version: "0.1",
    verdict: r3.output.verdict,
    severity: verdictToSeverity2(r3.output.verdict),
    findings: realFlows.map((f3) => ({
      location: f3.flow,
      description: `Step '${f3.step}' failed: ${f3.observed}`
    })),
    evidence_refs: r3.output.evidence_refs,
    created_at: nowIso12(),
    engine: r3.mode
  };
  const reportPath = appendReview(report, "", stateRoot2);
  log(`qa.browser: ${report.verdict} (severity: ${report.severity}, ${realFlows.length} failed flow(s), ${r3.output.evidence_refs.length} evidence ref(s))`);
  for (const f3 of r3.output.failed_flows.slice(0, 5)) {
    log(`  - [${f3.flow}] ${f3.step}: ${f3.observed}`);
  }
  log(`wrote ${reportPath}`);
  return { taskId, verdict: report.verdict, reportPath };
}
var init_qa2 = __esm(() => {
  init_spawn();
  init_playwright_runner();
  init_state();
  init_logger();
});

// src/commands/loop.ts
var exports_loop = {};
__export(exports_loop, {
  runLoopCommand: () => runLoopCommand,
  defaultStepRunners: () => defaultStepRunners2
});
function renderRunSummary(run) {
  return [
    `run_id:          ${run.run_id}`,
    `task:            ${run.task}`,
    `status:          ${run.status}`,
    `current_step:    ${run.current_step}`,
    `started_at:      ${run.started_at}`,
    `last_updated_at: ${run.last_updated_at}`,
    run.task_id ? `task_id:         ${run.task_id}` : null,
    run.level ? `level:           ${run.level}` : null,
    run.failed_step ? `failed_step:     ${run.failed_step}` : null,
    run.error ? `error:           ${run.error}` : null,
    "",
    "steps:",
    ...run.steps.map((s2) => `  ${s2.step.padEnd(9)} ${s2.status.padEnd(11)} ${s2.completed_at ?? s2.started_at ?? ""}`)
  ].filter((l2) => l2 !== null).join(`
`);
}
function renderTerminalHint(r3) {
  const id = r3.run.run_id;
  switch (r3.terminal_reason) {
    case "paused_work":
      return `
next: implement the change, then \`sgc loop --resume ${id}\` to continue.`;
    case "paused_qa":
      return `
next: run \`sgc qa <url> --flows <a,b>\` (or set SGC_QA_REAL=1 / --browse for a real-browser smoke), then \`sgc loop --resume ${id}\` to continue.`;
    case "paused_ship":
      return `
next: run \`sgc ship${r3.run.level === "L3" ? " --signed-by <id>" : ""}\`, then \`sgc loop --resume ${id}\` to continue.`;
    case "failed":
      return `
next: fix the underlying issue, then \`sgc loop --resume ${id}\` to retry the failed step (${r3.run.failed_step}).`;
    case "complete":
      return `
run complete. All 6 steps done.`;
  }
}
function defaultStepRunners2() {
  return {
    plan: async (state, opts) => {
      try {
        const r3 = await runPlan2(state.task, {
          stateRoot: opts.stateRoot,
          motivation: opts.motivation,
          userSignature: opts.userSignature,
          forceLevel: opts.forceLevel,
          ...process.stdin.isTTY ? {} : {
            readConfirmation: async () => {
              throw new LoopError("L3NeedsConfirmation", `task classified L3 — Invariant §4 requires a human confirmation at stdin, and ` + `this loop has no terminal attached. Plan it by hand first:
` + `  sgc plan "${state.task}" --signed-by <you> --motivation "..."
` + `then resume: sgc loop --resume ${state.run_id}`, { run_id: state.run_id, reason: "l3_needs_tty" });
            }
          }
        });
        return {
          task_id: r3.taskId,
          level: r3.level,
          intent_path: r3.intentPath
        };
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2);
        const existing = /active task/i.test(msg) ? readCurrentTask(opts.stateRoot) : null;
        if (!existing)
          throw e2;
        const t2 = existing.task;
        console.error(`loop: adopting active task ${t2.task_id} (level ${t2.level}) — already planned, not re-planning`);
        return {
          task_id: t2.task_id,
          level: String(t2.level),
          intent_path: t2.level === "L0" ? "(L0 — no intent.md)" : intentPath(t2.task_id, opts.stateRoot)
        };
      }
    },
    review: async (_state, opts) => {
      await runReview2({ stateRoot: opts.stateRoot });
    },
    qa: async (_state, opts) => {
      await runQa2({ stateRoot: opts.stateRoot });
    },
    compound: async (_state, opts) => {
      await runCompound({ stateRoot: opts.stateRoot });
    }
  };
}
async function runLoopCommand(cliOpts) {
  if (cliOpts.runs) {
    const runs = await listLoopRuns({ stateRoot: cliOpts.stateRoot });
    if (runs.length === 0) {
      process.stderr.write(`no loop runs found.
`);
      return;
    }
    for (const r3 of runs) {
      process.stdout.write(`${r3.run_id}  ${r3.status.padEnd(8)}  step=${r3.current_step.padEnd(9)}  started=${r3.started_at}  task=${r3.task}
`);
    }
    return;
  }
  if (cliOpts.status !== undefined && cliOpts.status.length > 0) {
    const run = await showLoopRun(cliOpts.status, {
      stateRoot: cliOpts.stateRoot
    });
    process.stdout.write(renderRunSummary(run) + `
`);
    return;
  }
  const opts = {
    steps: defaultStepRunners2(),
    stateRoot: cliOpts.stateRoot,
    resume: cliOpts.resume,
    motivation: cliOpts.motivation,
    forceLevel: cliOpts.forceLevel,
    userSignature: cliOpts.signedBy ? {
      signed_at: new Date().toISOString(),
      signer_id: cliOpts.signedBy
    } : undefined
  };
  if (!cliOpts.resume && (!cliOpts.task || cliOpts.task.trim().length === 0)) {
    process.stderr.write(`error: TASK arg required (unless --resume <id>, --runs, or --status <id> is set)
`);
    process.exit(1);
  }
  const result = await runLoop(cliOpts.resume ? null : cliOpts.task, opts);
  process.stderr.write(renderRunSummary(result.run) + `
`);
  process.stderr.write(renderTerminalHint(result) + `
`);
  if (result.terminal_reason === "failed") {
    process.exit(1);
  }
}
var init_loop2 = __esm(() => {
  init_loop();
  init_state();
  init_plan2();
  init_review2();
  init_qa2();
  init_compound2();
});

// src/commands/cso.ts
var exports_cso = {};
__export(exports_cso, {
  scanSecrets: () => scanSecrets,
  runCso: () => runCso,
  parseNpmAudit: () => parseNpmAudit,
  parseBunAudit: () => parseBunAudit,
  parseAuditErrorEnvelope: () => parseAuditErrorEnvelope,
  ensureCsoDir: () => ensureCsoDir,
  detectAnomalies: () => detectAnomalies,
  auditDependencies: () => auditDependencies,
  aggregateVerdict: () => aggregateVerdict
});
import { execSync as execSync2 } from "node:child_process";
import { existsSync as existsSync26, mkdirSync as mkdirSync9, readFileSync as readFileSync23, statSync as statSync7 } from "node:fs";
import { resolve as resolve27 } from "node:path";
function isoStamp() {
  const d2 = new Date;
  const iso = d2.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16).replace(":", ""), iso };
}
function rankVerdict(v2) {
  return v2 === "fail" ? 2 : v2 === "warn" ? 1 : 0;
}
function aggregateVerdict(checks) {
  let worst = "pass";
  for (const c3 of checks) {
    if (rankVerdict(c3.verdict) > rankVerdict(worst))
      worst = c3.verdict;
  }
  return worst;
}
function ensureCsoDir(stateRoot2) {
  const root3 = resolveStateRoot(stateRoot2);
  const dir = resolve27(root3, "cso");
  mkdirSync9(dir, { recursive: true });
  return dir;
}
function renderReportBody(report) {
  const lines = [];
  lines.push(`# CSO security review — ${report.verdict.toUpperCase()}`);
  lines.push("");
  lines.push(`Generated: ${report.generated_at}`);
  lines.push("");
  for (const c3 of report.checks) {
    lines.push(`## ${c3.name} — ${c3.verdict}`);
    lines.push("");
    if (c3.findings.length > 0) {
      lines.push("### Findings");
      for (const f3 of c3.findings)
        lines.push(`- ${f3}`);
      lines.push("");
    }
    if (c3.warnings.length > 0) {
      lines.push("### Warnings");
      for (const w2 of c3.warnings)
        lines.push(`- ${w2}`);
      lines.push("");
    }
    if (c3.findings.length === 0 && c3.warnings.length === 0) {
      lines.push("_(no findings)_");
      lines.push("");
    }
  }
  return lines.join(`
`);
}
function reportSlug(stamp) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp.date}-${stamp.time}-${rand}`;
}
function isDocPath(rel) {
  return /\.mdx?$/i.test(rel) || /(^|\/)docs?\//.test(rel);
}
function isExcludedPath(rel) {
  if (SCAN_EXCLUDE_PREFIXES.some((ex) => rel.startsWith(ex)))
    return true;
  if (SCAN_EXCLUDE_PATTERNS.some((re) => re.test(rel)))
    return true;
  return false;
}
function listScanFiles(repoRoot2) {
  const warnings = [];
  let raw = "";
  try {
    raw = execSync2("git ls-files --cached --modified --others --exclude-standard", {
      cwd: repoRoot2,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`git ls-files failed: ${msg.slice(0, 120)}; secret-scan skipped`);
    return { files: [], warnings };
  }
  const files = raw.split(/\r?\n/).map((s2) => s2.trim()).filter((s2) => s2.length > 0).filter((p) => !isExcludedPath(p));
  return { files, warnings };
}
function maxScanBytes() {
  const raw = process.env.SGC_CSO_MAX_SCAN_BYTES;
  if (!raw)
    return DEFAULT_MAX_SCAN_BYTES;
  const n2 = Number.parseInt(raw, 10);
  return Number.isFinite(n2) && n2 > 0 ? n2 : DEFAULT_MAX_SCAN_BYTES;
}
function scanSecrets(repoRoot2) {
  const { files, warnings } = listScanFiles(repoRoot2);
  const findings = [];
  const capBytes = maxScanBytes();
  for (const rel of files) {
    const abs = resolve27(repoRoot2, rel);
    if (!existsSync26(abs))
      continue;
    let stat5;
    try {
      stat5 = statSync7(abs);
    } catch {
      continue;
    }
    if (!stat5.isFile())
      continue;
    if (stat5.size > capBytes) {
      warnings.push(`${rel}: ${stat5.size} bytes exceeds ${capBytes} scan cap, skipped`);
      continue;
    }
    let content;
    try {
      content = readFileSync23(abs, "utf8");
    } catch {
      continue;
    }
    const inDocs = isDocPath(rel);
    for (const { name, re, commonInDocs } of SECRET_PATTERNS) {
      const m2 = re.exec(content);
      if (!m2)
        continue;
      const line = content.slice(0, m2.index).split(/\r?\n/).length;
      if (commonInDocs && inDocs) {
        warnings.push(`${rel}:${line} matches ${name} — documentation, treated as an example; confirm it is not live`);
        continue;
      }
      findings.push(`${rel}:${line} matches ${name}`);
    }
  }
  const verdict = findings.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass";
  return { name: "secret-scan", verdict, findings, warnings };
}
function tryAudit(repoRoot2, cmd) {
  try {
    const stdout2 = execSync2(cmd, {
      cwd: repoRoot2,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000
    });
    return { tool: cmd.split(/\s+/)[0], cmd, stdout: stdout2, exitCode: 0 };
  } catch (err) {
    const e2 = err;
    if (e2.stdout) {
      const stdout2 = typeof e2.stdout === "string" ? e2.stdout : e2.stdout.toString("utf8");
      if (stdout2.trim().length > 0) {
        return { tool: cmd.split(/\s+/)[0], cmd, stdout: stdout2, exitCode: e2.status ?? 1 };
      }
    }
    return null;
  }
}
function parseNpmAudit(stdout2) {
  try {
    const j = JSON.parse(stdout2);
    const v2 = j.metadata?.vulnerabilities;
    if (!v2)
      return null;
    return {
      critical: v2.critical ?? 0,
      high: v2.high ?? 0,
      moderate: v2.moderate ?? 0,
      low: v2.low ?? 0,
      total: v2.total ?? (v2.critical ?? 0) + (v2.high ?? 0) + (v2.moderate ?? 0) + (v2.low ?? 0)
    };
  } catch {
    return null;
  }
}
function parseBunAudit(stdout2) {
  let j;
  try {
    j = JSON.parse(stdout2);
  } catch {
    return null;
  }
  if (typeof j !== "object" || j === null || Array.isArray(j))
    return null;
  if ("metadata" in j)
    return null;
  const counts = { critical: 0, high: 0, moderate: 0, low: 0, total: 0 };
  let sawAdvisoryArray = false;
  for (const advisories of Object.values(j)) {
    if (!Array.isArray(advisories))
      return null;
    sawAdvisoryArray = true;
    for (const a2 of advisories) {
      if (typeof a2 !== "object" || a2 === null)
        continue;
      const sev = a2["severity"];
      if (sev === "critical")
        counts.critical++;
      else if (sev === "high")
        counts.high++;
      else if (sev === "moderate")
        counts.moderate++;
      else if (sev === "low")
        counts.low++;
      counts.total = counts.critical + counts.high + counts.moderate + counts.low;
    }
  }
  if (!sawAdvisoryArray && Object.keys(j).length > 0)
    return null;
  return counts;
}
function parseAuditErrorEnvelope(stdout2) {
  let j;
  try {
    j = JSON.parse(stdout2);
  } catch {
    return null;
  }
  if (typeof j !== "object" || j === null)
    return null;
  const e2 = j.error;
  if (typeof e2 !== "object" || e2 === null)
    return null;
  const code = e2.code;
  const summary = e2.summary;
  return {
    code: typeof code === "string" ? code : "unknown",
    summary: typeof summary === "string" ? summary : ""
  };
}
function parseAuditByTool(tool, stdout2) {
  if (tool === "bun")
    return parseBunAudit(stdout2) ?? parseNpmAudit(stdout2);
  return parseNpmAudit(stdout2) ?? parseBunAudit(stdout2);
}
function auditDependencies(repoRoot2) {
  const findings = [];
  const warnings = [];
  const attempts = ["bun audit --json", "npm audit --json"];
  let result = null;
  for (const cmd of attempts) {
    result = tryAudit(repoRoot2, cmd);
    if (result)
      break;
  }
  if (!result) {
    warnings.push(`no audit tool available (tried: ${attempts.join(", ")}); dep audit skipped`);
    return { name: "dependency-audit", verdict: "warn", findings, warnings };
  }
  const counts = parseAuditByTool(result.tool, result.stdout);
  if (!counts) {
    const envelope = parseAuditErrorEnvelope(result.stdout);
    if (envelope) {
      const fixHint = envelope.code === "ENOLOCK" ? " — create a lockfile (`npm i --package-lock-only`) and re-run `sgc cso`" : "";
      warnings.push(`dep audit could not run: ${result.tool} reported ${envelope.code}` + (envelope.summary ? ` (${envelope.summary})` : "") + `${fixHint}; dep audit skipped`);
    } else {
      warnings.push(`${result.tool} audit returned non-JSON or unparseable output; dep audit skipped`);
    }
    return { name: "dependency-audit", verdict: "warn", findings, warnings };
  }
  if (counts.critical > 0)
    findings.push(`${counts.critical} critical vulnerability(ies) via ${result.tool}`);
  if (counts.high > 0)
    findings.push(`${counts.high} high vulnerability(ies) via ${result.tool}`);
  if (counts.moderate > 0)
    warnings.push(`${counts.moderate} moderate vulnerability(ies) via ${result.tool}`);
  if (counts.low > 0)
    warnings.push(`${counts.low} low vulnerability(ies) via ${result.tool}`);
  const verdict = findings.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass";
  return { name: "dependency-audit", verdict, findings, warnings };
}
function readEventsTail2(eventsPath2) {
  const warnings = [];
  if (!existsSync26(eventsPath2)) {
    warnings.push(`events.ndjson not found at ${eventsPath2}; anomaly check skipped`);
    return { lines: [], warnings };
  }
  let raw;
  try {
    const st = statSync7(eventsPath2);
    if (st.size === 0) {
      warnings.push("events.ndjson is empty; anomaly check skipped");
      return { lines: [], warnings };
    }
    raw = readFileSync23(eventsPath2, "utf8");
    if (raw.length > ANOMALY_TAIL_BYTES) {
      const tail = raw.slice(-ANOMALY_TAIL_BYTES);
      const firstNl = tail.indexOf(`
`);
      raw = firstNl >= 0 ? tail.slice(firstNl + 1) : tail;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`failed to read events.ndjson: ${msg.slice(0, 120)}; anomaly check skipped`);
    return { lines: [], warnings };
  }
  const lines = raw.split(/\r?\n/).filter((s2) => s2.length > 0);
  return { lines, warnings };
}
function parseEventLine(line) {
  try {
    const j = JSON.parse(line);
    if (typeof j.event_type !== "string")
      return null;
    return {
      ts: typeof j.ts === "string" ? j.ts : "",
      task_id: typeof j.task_id === "string" ? j.task_id : null,
      spawn_id: typeof j.spawn_id === "string" ? j.spawn_id : null,
      event_type: j.event_type
    };
  } catch {
    return null;
  }
}
function detectAnomalies(stateRoot2) {
  const root3 = resolveStateRoot(stateRoot2);
  const eventsPath2 = resolve27(root3, "progress/events.ndjson");
  const findings = [];
  const { lines, warnings } = readEventsTail2(eventsPath2);
  if (lines.length === 0) {
    return { name: "events-anomaly", verdict: "warn", findings, warnings };
  }
  const openSpawns2 = new Map;
  let malformed = 0;
  for (const line of lines) {
    const e2 = parseEventLine(line);
    if (!e2) {
      malformed++;
      continue;
    }
    if (e2.event_type === "spawn.start" && e2.spawn_id) {
      openSpawns2.set(e2.spawn_id, e2);
    } else if (e2.event_type === "spawn.end" && e2.spawn_id) {
      openSpawns2.delete(e2.spawn_id);
    }
  }
  if (malformed > 0) {
    warnings.push(`${malformed} malformed event line(s) skipped`);
  }
  for (const [spawnId, e2] of openSpawns2) {
    findings.push(`unpaired spawn.start: ${spawnId} (ts=${e2.ts}, task_id=${e2.task_id ?? "null"})`);
  }
  if (findings.length > 20) {
    const overflow = findings.length - 20;
    findings.length = 20;
    findings.push(`… ${overflow} more unpaired spawn.start entries truncated`);
  }
  const verdict = findings.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass";
  return { name: "events-anomaly", verdict, findings, warnings };
}
async function runCso(opts = {}) {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log });
  const log = (m2) => logger.say(m2);
  const dir = ensureCsoDir(opts.stateRoot);
  const repoRoot2 = opts.repoRoot ?? process.cwd();
  const secretsCheck = scanSecrets(repoRoot2);
  const depsCheck = auditDependencies(repoRoot2);
  const anomalyCheck = detectAnomalies(opts.stateRoot);
  const stamp = isoStamp();
  const checks = [secretsCheck, depsCheck, anomalyCheck];
  const report = {
    generated_at: stamp.iso,
    verdict: aggregateVerdict(checks),
    checks
  };
  const slug = reportSlug(stamp);
  const mdPath = resolve27(dir, `${slug}.md`);
  const md = serializeFrontmatter({ generated_at: stamp.iso, verdict: report.verdict, slug }, renderReportBody(report));
  writeAtomic(mdPath, md);
  const lastReportPath = resolve27(dir, "last-report.json");
  writeAtomic(lastReportPath, JSON.stringify(report, null, 2) + `
`);
  log(`cso verdict: ${report.verdict}`);
  for (const c3 of checks) {
    log(`  ${c3.name}: ${c3.verdict} (${c3.findings.length} finding(s), ${c3.warnings.length} warning(s))`);
  }
  log(`report: ${mdPath}`);
  return { report, reportPath: mdPath, lastReportPath };
}
var SECRET_PATTERNS, SCAN_EXCLUDE_PREFIXES, SCAN_EXCLUDE_PATTERNS, DEFAULT_MAX_SCAN_BYTES = 2000000, ANOMALY_TAIL_BYTES = 2000000;
var init_cso = __esm(() => {
  init_state();
  init_logger();
  SECRET_PATTERNS = [
    { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
    { name: "private key block", re: /-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/ },
    { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
    { name: "GitHub fine-grained PAT", re: /github_pat_[A-Za-z0-9_]{22,}/ },
    { name: "OpenAI API key", re: /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/ },
    { name: "Slack token", re: /xox[abprs]-[A-Za-z0-9-]{10,}/ },
    { name: "Slack app-level token", re: /xapp-[0-9]-[A-Za-z0-9-]{20,}/ },
    { name: "Stripe live key", re: /(?:sk|rk)_live_[A-Za-z0-9]{16,}/ },
    { name: "Stripe webhook secret", re: /whsec_[A-Za-z0-9]{32,}/ },
    { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/, commonInDocs: true },
    { name: "Google API key", re: /AIza[A-Za-z0-9_-]{35}/, commonInDocs: true },
    { name: "Google OAuth client secret", re: /GOCSPX-[A-Za-z0-9_-]{24,}/ },
    { name: "npm token", re: /npm_[A-Za-z0-9]{36}/ },
    {
      name: "Slack webhook URL",
      re: /hooks\.slack\.com\/(?:services|triggers)\/T[A-Za-z0-9]{8,}\/[A-Za-z0-9]{8,}\/[A-Za-z0-9]{20,}/,
      commonInDocs: true
    },
    {
      name: "generic api-key/password assignment",
      re: /\b(?:api[_-]?key|api[_-]?secret|access[_-]?token|password|secret[_-]?key|private[_-]?key)\s*[=:]\s*["'][^"'\s]{16,}["']/i
    }
  ];
  SCAN_EXCLUDE_PREFIXES = [
    ".sgc/cso/",
    "node_modules/",
    ".git/",
    "dist/",
    "build/",
    "coverage/",
    "tmp/"
  ];
  SCAN_EXCLUDE_PATTERNS = [
    /(^|\/)tests?\//,
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /(^|\/)__fixtures__\//,
    /(^|\/)__mocks__\//
  ];
});

// node_modules/consola/dist/core.mjs
var LogLevels = {
  silent: Number.NEGATIVE_INFINITY,
  fatal: 0,
  error: 0,
  warn: 1,
  log: 2,
  info: 3,
  success: 3,
  fail: 3,
  ready: 3,
  start: 3,
  box: 3,
  debug: 4,
  trace: 5,
  verbose: Number.POSITIVE_INFINITY
};
var LogTypes = {
  silent: {
    level: -1
  },
  fatal: {
    level: LogLevels.fatal
  },
  error: {
    level: LogLevels.error
  },
  warn: {
    level: LogLevels.warn
  },
  log: {
    level: LogLevels.log
  },
  info: {
    level: LogLevels.info
  },
  success: {
    level: LogLevels.success
  },
  fail: {
    level: LogLevels.fail
  },
  ready: {
    level: LogLevels.info
  },
  start: {
    level: LogLevels.info
  },
  box: {
    level: LogLevels.info
  },
  debug: {
    level: LogLevels.debug
  },
  trace: {
    level: LogLevels.trace
  },
  verbose: {
    level: LogLevels.verbose
  }
};
function isPlainObject$1(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
    return false;
  }
  if (Symbol.iterator in value) {
    return false;
  }
  if (Symbol.toStringTag in value) {
    return Object.prototype.toString.call(value) === "[object Module]";
  }
  return true;
}
function _defu(baseObject, defaults, namespace = ".", merger) {
  if (!isPlainObject$1(defaults)) {
    return _defu(baseObject, {}, namespace, merger);
  }
  const object = Object.assign({}, defaults);
  for (const key in baseObject) {
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = baseObject[key];
    if (value === null || value === undefined) {
      continue;
    }
    if (merger && merger(object, key, value, namespace)) {
      continue;
    }
    if (Array.isArray(value) && Array.isArray(object[key])) {
      object[key] = [...value, ...object[key]];
    } else if (isPlainObject$1(value) && isPlainObject$1(object[key])) {
      object[key] = _defu(value, object[key], (namespace ? `${namespace}.` : "") + key.toString(), merger);
    } else {
      object[key] = value;
    }
  }
  return object;
}
function createDefu(merger) {
  return (...arguments_) => arguments_.reduce((p, c) => _defu(p, c, "", merger), {});
}
var defu = createDefu();
function isPlainObject(obj) {
  return Object.prototype.toString.call(obj) === "[object Object]";
}
function isLogObj(arg) {
  if (!isPlainObject(arg)) {
    return false;
  }
  if (!arg.message && !arg.args) {
    return false;
  }
  if (arg.stack) {
    return false;
  }
  return true;
}
var paused = false;
var queue = [];

class Consola {
  options;
  _lastLog;
  _mockFn;
  constructor(options = {}) {
    const types = options.types || LogTypes;
    this.options = defu({
      ...options,
      defaults: { ...options.defaults },
      level: _normalizeLogLevel(options.level, types),
      reporters: [...options.reporters || []]
    }, {
      types: LogTypes,
      throttle: 1000,
      throttleMin: 5,
      formatOptions: {
        date: true,
        colors: false,
        compact: true
      }
    });
    for (const type in types) {
      const defaults = {
        type,
        ...this.options.defaults,
        ...types[type]
      };
      this[type] = this._wrapLogFn(defaults);
      this[type].raw = this._wrapLogFn(defaults, true);
    }
    if (this.options.mockFn) {
      this.mockTypes();
    }
    this._lastLog = {};
  }
  get level() {
    return this.options.level;
  }
  set level(level) {
    this.options.level = _normalizeLogLevel(level, this.options.types, this.options.level);
  }
  prompt(message, opts) {
    if (!this.options.prompt) {
      throw new Error("prompt is not supported!");
    }
    return this.options.prompt(message, opts);
  }
  create(options) {
    const instance = new Consola({
      ...this.options,
      ...options
    });
    if (this._mockFn) {
      instance.mockTypes(this._mockFn);
    }
    return instance;
  }
  withDefaults(defaults) {
    return this.create({
      ...this.options,
      defaults: {
        ...this.options.defaults,
        ...defaults
      }
    });
  }
  withTag(tag) {
    return this.withDefaults({
      tag: this.options.defaults.tag ? this.options.defaults.tag + ":" + tag : tag
    });
  }
  addReporter(reporter) {
    this.options.reporters.push(reporter);
    return this;
  }
  removeReporter(reporter) {
    if (reporter) {
      const i = this.options.reporters.indexOf(reporter);
      if (i !== -1) {
        return this.options.reporters.splice(i, 1);
      }
    } else {
      this.options.reporters.splice(0);
    }
    return this;
  }
  setReporters(reporters) {
    this.options.reporters = Array.isArray(reporters) ? reporters : [reporters];
    return this;
  }
  wrapAll() {
    this.wrapConsole();
    this.wrapStd();
  }
  restoreAll() {
    this.restoreConsole();
    this.restoreStd();
  }
  wrapConsole() {
    for (const type in this.options.types) {
      if (!console["__" + type]) {
        console["__" + type] = console[type];
      }
      console[type] = this[type].raw;
    }
  }
  restoreConsole() {
    for (const type in this.options.types) {
      if (console["__" + type]) {
        console[type] = console["__" + type];
        delete console["__" + type];
      }
    }
  }
  wrapStd() {
    this._wrapStream(this.options.stdout, "log");
    this._wrapStream(this.options.stderr, "log");
  }
  _wrapStream(stream, type) {
    if (!stream) {
      return;
    }
    if (!stream.__write) {
      stream.__write = stream.write;
    }
    stream.write = (data) => {
      this[type].raw(String(data).trim());
    };
  }
  restoreStd() {
    this._restoreStream(this.options.stdout);
    this._restoreStream(this.options.stderr);
  }
  _restoreStream(stream) {
    if (!stream) {
      return;
    }
    if (stream.__write) {
      stream.write = stream.__write;
      delete stream.__write;
    }
  }
  pauseLogs() {
    paused = true;
  }
  resumeLogs() {
    paused = false;
    const _queue = queue.splice(0);
    for (const item of _queue) {
      item[0]._logFn(item[1], item[2]);
    }
  }
  mockTypes(mockFn) {
    const _mockFn = mockFn || this.options.mockFn;
    this._mockFn = _mockFn;
    if (typeof _mockFn !== "function") {
      return;
    }
    for (const type in this.options.types) {
      this[type] = _mockFn(type, this.options.types[type]) || this[type];
      this[type].raw = this[type];
    }
  }
  _wrapLogFn(defaults, isRaw) {
    return (...args) => {
      if (paused) {
        queue.push([this, defaults, args, isRaw]);
        return;
      }
      return this._logFn(defaults, args, isRaw);
    };
  }
  _logFn(defaults, args, isRaw) {
    if ((defaults.level || 0) > this.level) {
      return false;
    }
    const logObj = {
      date: /* @__PURE__ */ new Date,
      args: [],
      ...defaults,
      level: _normalizeLogLevel(defaults.level, this.options.types)
    };
    if (!isRaw && args.length === 1 && isLogObj(args[0])) {
      Object.assign(logObj, args[0]);
    } else {
      logObj.args = [...args];
    }
    if (logObj.message) {
      logObj.args.unshift(logObj.message);
      delete logObj.message;
    }
    if (logObj.additional) {
      if (!Array.isArray(logObj.additional)) {
        logObj.additional = logObj.additional.split(`
`);
      }
      logObj.args.push(`
` + logObj.additional.join(`
`));
      delete logObj.additional;
    }
    logObj.type = typeof logObj.type === "string" ? logObj.type.toLowerCase() : "log";
    logObj.tag = typeof logObj.tag === "string" ? logObj.tag : "";
    const resolveLog = (newLog = false) => {
      const repeated = (this._lastLog.count || 0) - this.options.throttleMin;
      if (this._lastLog.object && repeated > 0) {
        const args2 = [...this._lastLog.object.args];
        if (repeated > 1) {
          args2.push(`(repeated ${repeated} times)`);
        }
        this._log({ ...this._lastLog.object, args: args2 });
        this._lastLog.count = 1;
      }
      if (newLog) {
        this._lastLog.object = logObj;
        this._log(logObj);
      }
    };
    clearTimeout(this._lastLog.timeout);
    const diffTime = this._lastLog.time && logObj.date ? logObj.date.getTime() - this._lastLog.time.getTime() : 0;
    this._lastLog.time = logObj.date;
    if (diffTime < this.options.throttle) {
      try {
        const serializedLog = JSON.stringify([
          logObj.type,
          logObj.tag,
          logObj.args
        ]);
        const isSameLog = this._lastLog.serialized === serializedLog;
        this._lastLog.serialized = serializedLog;
        if (isSameLog) {
          this._lastLog.count = (this._lastLog.count || 0) + 1;
          if (this._lastLog.count > this.options.throttleMin) {
            this._lastLog.timeout = setTimeout(resolveLog, this.options.throttle);
            return;
          }
        }
      } catch {}
    }
    resolveLog(true);
  }
  _log(logObj) {
    for (const reporter of this.options.reporters) {
      reporter.log(logObj, {
        options: this.options
      });
    }
  }
}
function _normalizeLogLevel(input, types = {}, defaultLevel = 3) {
  if (input === undefined) {
    return defaultLevel;
  }
  if (typeof input === "number") {
    return input;
  }
  if (types[input] && types[input].level !== undefined) {
    return types[input].level;
  }
  return defaultLevel;
}
Consola.prototype.add = Consola.prototype.addReporter;
Consola.prototype.remove = Consola.prototype.removeReporter;
Consola.prototype.clear = Consola.prototype.removeReporter;
Consola.prototype.withScope = Consola.prototype.withTag;
Consola.prototype.mock = Consola.prototype.mockTypes;
Consola.prototype.pause = Consola.prototype.pauseLogs;
Consola.prototype.resume = Consola.prototype.resumeLogs;
function createConsola(options = {}) {
  return new Consola(options);
}
// node_modules/consola/dist/shared/consola.DRwqZj3T.mjs
import { formatWithOptions } from "node:util";
import { sep } from "node:path";
function parseStack(stack, message) {
  const cwd = process.cwd() + sep;
  const lines = stack.split(`
`).splice(message.split(`
`).length).map((l) => l.trim().replace("file://", "").replace(cwd, ""));
  return lines;
}
function writeStream(data, stream) {
  const write = stream.__write || stream.write;
  return write.call(stream, data);
}
var bracket = (x) => x ? `[${x}]` : "";

class BasicReporter {
  formatStack(stack, message, opts) {
    const indent = "  ".repeat((opts?.errorLevel || 0) + 1);
    return indent + parseStack(stack, message).join(`
${indent}`);
  }
  formatError(err, opts) {
    const message = err.message ?? formatWithOptions(opts, err);
    const stack = err.stack ? this.formatStack(err.stack, message, opts) : "";
    const level = opts?.errorLevel || 0;
    const causedPrefix = level > 0 ? `${"  ".repeat(level)}[cause]: ` : "";
    const causedError = err.cause ? `

` + this.formatError(err.cause, { ...opts, errorLevel: level + 1 }) : "";
    return causedPrefix + message + `
` + stack + causedError;
  }
  formatArgs(args, opts) {
    const _args = args.map((arg) => {
      if (arg && typeof arg.stack === "string") {
        return this.formatError(arg, opts);
      }
      return arg;
    });
    return formatWithOptions(opts, ..._args);
  }
  formatDate(date, opts) {
    return opts.date ? date.toLocaleTimeString() : "";
  }
  filterAndJoin(arr) {
    return arr.filter(Boolean).join(" ");
  }
  formatLogObj(logObj, opts) {
    const message = this.formatArgs(logObj.args, opts);
    if (logObj.type === "box") {
      return `
` + [
        bracket(logObj.tag),
        logObj.title && logObj.title,
        ...message.split(`
`)
      ].filter(Boolean).map((l) => " > " + l).join(`
`) + `
`;
    }
    return this.filterAndJoin([
      bracket(logObj.type),
      bracket(logObj.tag),
      message
    ]);
  }
  log(logObj, ctx) {
    const line = this.formatLogObj(logObj, {
      columns: ctx.options.stdout.columns || 0,
      ...ctx.options.formatOptions
    });
    return writeStream(line + `
`, logObj.level < 2 ? ctx.options.stderr || process.stderr : ctx.options.stdout || process.stdout);
  }
}

// node_modules/consola/dist/index.mjs
import g$1 from "node:process";

// node_modules/consola/dist/shared/consola.DXBYu-KD.mjs
import * as tty from "node:tty";
var {
  env = {},
  argv = [],
  platform = ""
} = typeof process === "undefined" ? {} : process;
var isDisabled = "NO_COLOR" in env || argv.includes("--no-color");
var isForced = "FORCE_COLOR" in env || argv.includes("--color");
var isWindows = platform === "win32";
var isDumbTerminal = env.TERM === "dumb";
var isCompatibleTerminal = tty && tty.isatty && tty.isatty(1) && env.TERM && !isDumbTerminal;
var isCI = "CI" in env && (("GITHUB_ACTIONS" in env) || ("GITLAB_CI" in env) || ("CIRCLECI" in env));
var isColorSupported = !isDisabled && (isForced || isWindows && !isDumbTerminal || isCompatibleTerminal || isCI);
function replaceClose(index, string, close, replace, head = string.slice(0, Math.max(0, index)) + replace, tail = string.slice(Math.max(0, index + close.length)), next = tail.indexOf(close)) {
  return head + (next < 0 ? tail : replaceClose(next, tail, close, replace));
}
function clearBleed(index, string, open, close, replace) {
  return index < 0 ? open + string + close : open + replaceClose(index, string, close, replace) + close;
}
function filterEmpty(open, close, replace = open, at = open.length + 1) {
  return (string) => string || !(string === "" || string === undefined) ? clearBleed(("" + string).indexOf(close, at), string, open, close, replace) : "";
}
function init(open, close, replace) {
  return filterEmpty(`\x1B[${open}m`, `\x1B[${close}m`, replace);
}
var colorDefs = {
  reset: init(0, 0),
  bold: init(1, 22, "\x1B[22m\x1B[1m"),
  dim: init(2, 22, "\x1B[22m\x1B[2m"),
  italic: init(3, 23),
  underline: init(4, 24),
  inverse: init(7, 27),
  hidden: init(8, 28),
  strikethrough: init(9, 29),
  black: init(30, 39),
  red: init(31, 39),
  green: init(32, 39),
  yellow: init(33, 39),
  blue: init(34, 39),
  magenta: init(35, 39),
  cyan: init(36, 39),
  white: init(37, 39),
  gray: init(90, 39),
  bgBlack: init(40, 49),
  bgRed: init(41, 49),
  bgGreen: init(42, 49),
  bgYellow: init(43, 49),
  bgBlue: init(44, 49),
  bgMagenta: init(45, 49),
  bgCyan: init(46, 49),
  bgWhite: init(47, 49),
  blackBright: init(90, 39),
  redBright: init(91, 39),
  greenBright: init(92, 39),
  yellowBright: init(93, 39),
  blueBright: init(94, 39),
  magentaBright: init(95, 39),
  cyanBright: init(96, 39),
  whiteBright: init(97, 39),
  bgBlackBright: init(100, 49),
  bgRedBright: init(101, 49),
  bgGreenBright: init(102, 49),
  bgYellowBright: init(103, 49),
  bgBlueBright: init(104, 49),
  bgMagentaBright: init(105, 49),
  bgCyanBright: init(106, 49),
  bgWhiteBright: init(107, 49)
};
function createColors(useColor = isColorSupported) {
  return useColor ? colorDefs : Object.fromEntries(Object.keys(colorDefs).map((key) => [key, String]));
}
var colors = createColors();
function getColor(color, fallback = "reset") {
  return colors[color] || colors[fallback];
}
var ansiRegex = [
  String.raw`[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)`,
  String.raw`(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))`
].join("|");
function stripAnsi(text) {
  return text.replace(new RegExp(ansiRegex, "g"), "");
}
var boxStylePresets = {
  solid: {
    tl: "┌",
    tr: "┐",
    bl: "└",
    br: "┘",
    h: "─",
    v: "│"
  },
  double: {
    tl: "╔",
    tr: "╗",
    bl: "╚",
    br: "╝",
    h: "═",
    v: "║"
  },
  doubleSingle: {
    tl: "╓",
    tr: "╖",
    bl: "╙",
    br: "╜",
    h: "─",
    v: "║"
  },
  doubleSingleRounded: {
    tl: "╭",
    tr: "╮",
    bl: "╰",
    br: "╯",
    h: "─",
    v: "║"
  },
  singleThick: {
    tl: "┏",
    tr: "┓",
    bl: "┗",
    br: "┛",
    h: "━",
    v: "┃"
  },
  singleDouble: {
    tl: "╒",
    tr: "╕",
    bl: "╘",
    br: "╛",
    h: "═",
    v: "│"
  },
  singleDoubleRounded: {
    tl: "╭",
    tr: "╮",
    bl: "╰",
    br: "╯",
    h: "═",
    v: "│"
  },
  rounded: {
    tl: "╭",
    tr: "╮",
    bl: "╰",
    br: "╯",
    h: "─",
    v: "│"
  }
};
var defaultStyle = {
  borderColor: "white",
  borderStyle: "rounded",
  valign: "center",
  padding: 2,
  marginLeft: 1,
  marginTop: 1,
  marginBottom: 1
};
function box(text, _opts = {}) {
  const opts = {
    ..._opts,
    style: {
      ...defaultStyle,
      ..._opts.style
    }
  };
  const textLines = text.split(`
`);
  const boxLines = [];
  const _color = getColor(opts.style.borderColor);
  const borderStyle = {
    ...typeof opts.style.borderStyle === "string" ? boxStylePresets[opts.style.borderStyle] || boxStylePresets.solid : opts.style.borderStyle
  };
  if (_color) {
    for (const key in borderStyle) {
      borderStyle[key] = _color(borderStyle[key]);
    }
  }
  const paddingOffset = opts.style.padding % 2 === 0 ? opts.style.padding : opts.style.padding + 1;
  const height = textLines.length + paddingOffset;
  const width = Math.max(...textLines.map((line) => stripAnsi(line).length), opts.title ? stripAnsi(opts.title).length : 0) + paddingOffset;
  const widthOffset = width + paddingOffset;
  const leftSpace = opts.style.marginLeft > 0 ? " ".repeat(opts.style.marginLeft) : "";
  if (opts.style.marginTop > 0) {
    boxLines.push("".repeat(opts.style.marginTop));
  }
  if (opts.title) {
    const title = _color ? _color(opts.title) : opts.title;
    const left = borderStyle.h.repeat(Math.floor((width - stripAnsi(opts.title).length) / 2));
    const right = borderStyle.h.repeat(width - stripAnsi(opts.title).length - stripAnsi(left).length + paddingOffset);
    boxLines.push(`${leftSpace}${borderStyle.tl}${left}${title}${right}${borderStyle.tr}`);
  } else {
    boxLines.push(`${leftSpace}${borderStyle.tl}${borderStyle.h.repeat(widthOffset)}${borderStyle.tr}`);
  }
  const valignOffset = opts.style.valign === "center" ? Math.floor((height - textLines.length) / 2) : opts.style.valign === "top" ? height - textLines.length - paddingOffset : height - textLines.length;
  for (let i = 0;i < height; i++) {
    if (i < valignOffset || i >= valignOffset + textLines.length) {
      boxLines.push(`${leftSpace}${borderStyle.v}${" ".repeat(widthOffset)}${borderStyle.v}`);
    } else {
      const line = textLines[i - valignOffset];
      const left = " ".repeat(paddingOffset);
      const right = " ".repeat(width - stripAnsi(line).length);
      boxLines.push(`${leftSpace}${borderStyle.v}${left}${line}${right}${borderStyle.v}`);
    }
  }
  boxLines.push(`${leftSpace}${borderStyle.bl}${borderStyle.h.repeat(widthOffset)}${borderStyle.br}`);
  if (opts.style.marginBottom > 0) {
    boxLines.push("".repeat(opts.style.marginBottom));
  }
  return boxLines.join(`
`);
}

// node_modules/consola/dist/index.mjs
var r2 = Object.create(null);
var i = (e2) => globalThis.process?.env || import.meta.env || globalThis.Deno?.env.toObject() || globalThis.__env__ || (e2 ? r2 : globalThis);
var o2 = new Proxy(r2, { get(e2, s) {
  return i()[s] ?? r2[s];
}, has(e2, s) {
  const E = i();
  return s in E || s in r2;
}, set(e2, s, E) {
  const B2 = i(true);
  return B2[s] = E, true;
}, deleteProperty(e2, s) {
  if (!s)
    return false;
  const E = i(true);
  return delete E[s], true;
}, ownKeys() {
  const e2 = i(true);
  return Object.keys(e2);
} });
var t = typeof process < "u" && process.env && "development" || "";
var f2 = [["APPVEYOR"], ["AWS_AMPLIFY", "AWS_APP_ID", { ci: true }], ["AZURE_PIPELINES", "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"], ["AZURE_STATIC", "INPUT_AZURE_STATIC_WEB_APPS_API_TOKEN"], ["APPCIRCLE", "AC_APPCIRCLE"], ["BAMBOO", "bamboo_planKey"], ["BITBUCKET", "BITBUCKET_COMMIT"], ["BITRISE", "BITRISE_IO"], ["BUDDY", "BUDDY_WORKSPACE_ID"], ["BUILDKITE"], ["CIRCLE", "CIRCLECI"], ["CIRRUS", "CIRRUS_CI"], ["CLOUDFLARE_PAGES", "CF_PAGES", { ci: true }], ["CODEBUILD", "CODEBUILD_BUILD_ARN"], ["CODEFRESH", "CF_BUILD_ID"], ["DRONE"], ["DRONE", "DRONE_BUILD_EVENT"], ["DSARI"], ["GITHUB_ACTIONS"], ["GITLAB", "GITLAB_CI"], ["GITLAB", "CI_MERGE_REQUEST_ID"], ["GOCD", "GO_PIPELINE_LABEL"], ["LAYERCI"], ["HUDSON", "HUDSON_URL"], ["JENKINS", "JENKINS_URL"], ["MAGNUM"], ["NETLIFY"], ["NETLIFY", "NETLIFY_LOCAL", { ci: false }], ["NEVERCODE"], ["RENDER"], ["SAIL", "SAILCI"], ["SEMAPHORE"], ["SCREWDRIVER"], ["SHIPPABLE"], ["SOLANO", "TDDIUM"], ["STRIDER"], ["TEAMCITY", "TEAMCITY_VERSION"], ["TRAVIS"], ["VERCEL", "NOW_BUILDER"], ["VERCEL", "VERCEL", { ci: false }], ["VERCEL", "VERCEL_ENV", { ci: false }], ["APPCENTER", "APPCENTER_BUILD_ID"], ["CODESANDBOX", "CODESANDBOX_SSE", { ci: false }], ["CODESANDBOX", "CODESANDBOX_HOST", { ci: false }], ["STACKBLITZ"], ["STORMKIT"], ["CLEAVR"], ["ZEABUR"], ["CODESPHERE", "CODESPHERE_APP_ID", { ci: true }], ["RAILWAY", "RAILWAY_PROJECT_ID"], ["RAILWAY", "RAILWAY_SERVICE_ID"], ["DENO-DEPLOY", "DENO_DEPLOYMENT_ID"], ["FIREBASE_APP_HOSTING", "FIREBASE_APP_HOSTING", { ci: true }]];
function b() {
  if (globalThis.process?.env)
    for (const e2 of f2) {
      const s = e2[1] || e2[0];
      if (globalThis.process?.env[s])
        return { name: e2[0].toLowerCase(), ...e2[2] };
    }
  return globalThis.process?.env?.SHELL === "/bin/jsh" && globalThis.process?.versions?.webcontainer ? { name: "stackblitz", ci: false } : { name: "", ci: false };
}
var l = b();
l.name;
function n(e2) {
  return e2 ? e2 !== "false" : false;
}
var I2 = globalThis.process?.platform || "";
var T2 = n(o2.CI) || l.ci !== false;
var a = n(globalThis.process?.stdout && globalThis.process?.stdout.isTTY);
var g2 = n(o2.DEBUG);
var R2 = t === "test" || n(o2.TEST);
n(o2.MINIMAL);
var A2 = /^win/i.test(I2);
!n(o2.NO_COLOR) && (n(o2.FORCE_COLOR) || (a || A2) && o2.TERM);
var C2 = (globalThis.process?.versions?.node || "").replace(/^v/, "") || null;
Number(C2?.split(".")[0]);
var y2 = globalThis.process || Object.create(null);
var _2 = { versions: {} };
new Proxy(y2, { get(e2, s) {
  if (s === "env")
    return o2;
  if (s in e2)
    return e2[s];
  if (s in _2)
    return _2[s];
} });
var c2 = globalThis.process?.release?.name === "node";
var O2 = !!globalThis.Bun || !!globalThis.process?.versions?.bun;
var D = !!globalThis.Deno;
var L2 = !!globalThis.fastly;
var S2 = !!globalThis.Netlify;
var u2 = !!globalThis.EdgeRuntime;
var N2 = globalThis.navigator?.userAgent === "Cloudflare-Workers";
var F2 = [[S2, "netlify"], [u2, "edge-light"], [N2, "workerd"], [L2, "fastly"], [D, "deno"], [O2, "bun"], [c2, "node"]];
function G2() {
  const e2 = F2.find((s) => s[0]);
  if (e2)
    return { name: e2[1] };
}
var P2 = G2();
P2?.name;
function ansiRegex2({ onlyFirst = false } = {}) {
  const ST = "(?:\\u0007|\\u001B\\u005C|\\u009C)";
  const pattern = [
    `[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?${ST})`,
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"
  ].join("|");
  return new RegExp(pattern, onlyFirst ? undefined : "g");
}
var regex = ansiRegex2();
function stripAnsi2(string) {
  if (typeof string !== "string") {
    throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``);
  }
  return string.replace(regex, "");
}
function isAmbiguous(x2) {
  return x2 === 161 || x2 === 164 || x2 === 167 || x2 === 168 || x2 === 170 || x2 === 173 || x2 === 174 || x2 >= 176 && x2 <= 180 || x2 >= 182 && x2 <= 186 || x2 >= 188 && x2 <= 191 || x2 === 198 || x2 === 208 || x2 === 215 || x2 === 216 || x2 >= 222 && x2 <= 225 || x2 === 230 || x2 >= 232 && x2 <= 234 || x2 === 236 || x2 === 237 || x2 === 240 || x2 === 242 || x2 === 243 || x2 >= 247 && x2 <= 250 || x2 === 252 || x2 === 254 || x2 === 257 || x2 === 273 || x2 === 275 || x2 === 283 || x2 === 294 || x2 === 295 || x2 === 299 || x2 >= 305 && x2 <= 307 || x2 === 312 || x2 >= 319 && x2 <= 322 || x2 === 324 || x2 >= 328 && x2 <= 331 || x2 === 333 || x2 === 338 || x2 === 339 || x2 === 358 || x2 === 359 || x2 === 363 || x2 === 462 || x2 === 464 || x2 === 466 || x2 === 468 || x2 === 470 || x2 === 472 || x2 === 474 || x2 === 476 || x2 === 593 || x2 === 609 || x2 === 708 || x2 === 711 || x2 >= 713 && x2 <= 715 || x2 === 717 || x2 === 720 || x2 >= 728 && x2 <= 731 || x2 === 733 || x2 === 735 || x2 >= 768 && x2 <= 879 || x2 >= 913 && x2 <= 929 || x2 >= 931 && x2 <= 937 || x2 >= 945 && x2 <= 961 || x2 >= 963 && x2 <= 969 || x2 === 1025 || x2 >= 1040 && x2 <= 1103 || x2 === 1105 || x2 === 8208 || x2 >= 8211 && x2 <= 8214 || x2 === 8216 || x2 === 8217 || x2 === 8220 || x2 === 8221 || x2 >= 8224 && x2 <= 8226 || x2 >= 8228 && x2 <= 8231 || x2 === 8240 || x2 === 8242 || x2 === 8243 || x2 === 8245 || x2 === 8251 || x2 === 8254 || x2 === 8308 || x2 === 8319 || x2 >= 8321 && x2 <= 8324 || x2 === 8364 || x2 === 8451 || x2 === 8453 || x2 === 8457 || x2 === 8467 || x2 === 8470 || x2 === 8481 || x2 === 8482 || x2 === 8486 || x2 === 8491 || x2 === 8531 || x2 === 8532 || x2 >= 8539 && x2 <= 8542 || x2 >= 8544 && x2 <= 8555 || x2 >= 8560 && x2 <= 8569 || x2 === 8585 || x2 >= 8592 && x2 <= 8601 || x2 === 8632 || x2 === 8633 || x2 === 8658 || x2 === 8660 || x2 === 8679 || x2 === 8704 || x2 === 8706 || x2 === 8707 || x2 === 8711 || x2 === 8712 || x2 === 8715 || x2 === 8719 || x2 === 8721 || x2 === 8725 || x2 === 8730 || x2 >= 8733 && x2 <= 8736 || x2 === 8739 || x2 === 8741 || x2 >= 8743 && x2 <= 8748 || x2 === 8750 || x2 >= 8756 && x2 <= 8759 || x2 === 8764 || x2 === 8765 || x2 === 8776 || x2 === 8780 || x2 === 8786 || x2 === 8800 || x2 === 8801 || x2 >= 8804 && x2 <= 8807 || x2 === 8810 || x2 === 8811 || x2 === 8814 || x2 === 8815 || x2 === 8834 || x2 === 8835 || x2 === 8838 || x2 === 8839 || x2 === 8853 || x2 === 8857 || x2 === 8869 || x2 === 8895 || x2 === 8978 || x2 >= 9312 && x2 <= 9449 || x2 >= 9451 && x2 <= 9547 || x2 >= 9552 && x2 <= 9587 || x2 >= 9600 && x2 <= 9615 || x2 >= 9618 && x2 <= 9621 || x2 === 9632 || x2 === 9633 || x2 >= 9635 && x2 <= 9641 || x2 === 9650 || x2 === 9651 || x2 === 9654 || x2 === 9655 || x2 === 9660 || x2 === 9661 || x2 === 9664 || x2 === 9665 || x2 >= 9670 && x2 <= 9672 || x2 === 9675 || x2 >= 9678 && x2 <= 9681 || x2 >= 9698 && x2 <= 9701 || x2 === 9711 || x2 === 9733 || x2 === 9734 || x2 === 9737 || x2 === 9742 || x2 === 9743 || x2 === 9756 || x2 === 9758 || x2 === 9792 || x2 === 9794 || x2 === 9824 || x2 === 9825 || x2 >= 9827 && x2 <= 9829 || x2 >= 9831 && x2 <= 9834 || x2 === 9836 || x2 === 9837 || x2 === 9839 || x2 === 9886 || x2 === 9887 || x2 === 9919 || x2 >= 9926 && x2 <= 9933 || x2 >= 9935 && x2 <= 9939 || x2 >= 9941 && x2 <= 9953 || x2 === 9955 || x2 === 9960 || x2 === 9961 || x2 >= 9963 && x2 <= 9969 || x2 === 9972 || x2 >= 9974 && x2 <= 9977 || x2 === 9979 || x2 === 9980 || x2 === 9982 || x2 === 9983 || x2 === 10045 || x2 >= 10102 && x2 <= 10111 || x2 >= 11094 && x2 <= 11097 || x2 >= 12872 && x2 <= 12879 || x2 >= 57344 && x2 <= 63743 || x2 >= 65024 && x2 <= 65039 || x2 === 65533 || x2 >= 127232 && x2 <= 127242 || x2 >= 127248 && x2 <= 127277 || x2 >= 127280 && x2 <= 127337 || x2 >= 127344 && x2 <= 127373 || x2 === 127375 || x2 === 127376 || x2 >= 127387 && x2 <= 127404 || x2 >= 917760 && x2 <= 917999 || x2 >= 983040 && x2 <= 1048573 || x2 >= 1048576 && x2 <= 1114109;
}
function isFullWidth(x2) {
  return x2 === 12288 || x2 >= 65281 && x2 <= 65376 || x2 >= 65504 && x2 <= 65510;
}
function isWide(x2) {
  return x2 >= 4352 && x2 <= 4447 || x2 === 8986 || x2 === 8987 || x2 === 9001 || x2 === 9002 || x2 >= 9193 && x2 <= 9196 || x2 === 9200 || x2 === 9203 || x2 === 9725 || x2 === 9726 || x2 === 9748 || x2 === 9749 || x2 >= 9776 && x2 <= 9783 || x2 >= 9800 && x2 <= 9811 || x2 === 9855 || x2 >= 9866 && x2 <= 9871 || x2 === 9875 || x2 === 9889 || x2 === 9898 || x2 === 9899 || x2 === 9917 || x2 === 9918 || x2 === 9924 || x2 === 9925 || x2 === 9934 || x2 === 9940 || x2 === 9962 || x2 === 9970 || x2 === 9971 || x2 === 9973 || x2 === 9978 || x2 === 9981 || x2 === 9989 || x2 === 9994 || x2 === 9995 || x2 === 10024 || x2 === 10060 || x2 === 10062 || x2 >= 10067 && x2 <= 10069 || x2 === 10071 || x2 >= 10133 && x2 <= 10135 || x2 === 10160 || x2 === 10175 || x2 === 11035 || x2 === 11036 || x2 === 11088 || x2 === 11093 || x2 >= 11904 && x2 <= 11929 || x2 >= 11931 && x2 <= 12019 || x2 >= 12032 && x2 <= 12245 || x2 >= 12272 && x2 <= 12287 || x2 >= 12289 && x2 <= 12350 || x2 >= 12353 && x2 <= 12438 || x2 >= 12441 && x2 <= 12543 || x2 >= 12549 && x2 <= 12591 || x2 >= 12593 && x2 <= 12686 || x2 >= 12688 && x2 <= 12773 || x2 >= 12783 && x2 <= 12830 || x2 >= 12832 && x2 <= 12871 || x2 >= 12880 && x2 <= 42124 || x2 >= 42128 && x2 <= 42182 || x2 >= 43360 && x2 <= 43388 || x2 >= 44032 && x2 <= 55203 || x2 >= 63744 && x2 <= 64255 || x2 >= 65040 && x2 <= 65049 || x2 >= 65072 && x2 <= 65106 || x2 >= 65108 && x2 <= 65126 || x2 >= 65128 && x2 <= 65131 || x2 >= 94176 && x2 <= 94180 || x2 === 94192 || x2 === 94193 || x2 >= 94208 && x2 <= 100343 || x2 >= 100352 && x2 <= 101589 || x2 >= 101631 && x2 <= 101640 || x2 >= 110576 && x2 <= 110579 || x2 >= 110581 && x2 <= 110587 || x2 === 110589 || x2 === 110590 || x2 >= 110592 && x2 <= 110882 || x2 === 110898 || x2 >= 110928 && x2 <= 110930 || x2 === 110933 || x2 >= 110948 && x2 <= 110951 || x2 >= 110960 && x2 <= 111355 || x2 >= 119552 && x2 <= 119638 || x2 >= 119648 && x2 <= 119670 || x2 === 126980 || x2 === 127183 || x2 === 127374 || x2 >= 127377 && x2 <= 127386 || x2 >= 127488 && x2 <= 127490 || x2 >= 127504 && x2 <= 127547 || x2 >= 127552 && x2 <= 127560 || x2 === 127568 || x2 === 127569 || x2 >= 127584 && x2 <= 127589 || x2 >= 127744 && x2 <= 127776 || x2 >= 127789 && x2 <= 127797 || x2 >= 127799 && x2 <= 127868 || x2 >= 127870 && x2 <= 127891 || x2 >= 127904 && x2 <= 127946 || x2 >= 127951 && x2 <= 127955 || x2 >= 127968 && x2 <= 127984 || x2 === 127988 || x2 >= 127992 && x2 <= 128062 || x2 === 128064 || x2 >= 128066 && x2 <= 128252 || x2 >= 128255 && x2 <= 128317 || x2 >= 128331 && x2 <= 128334 || x2 >= 128336 && x2 <= 128359 || x2 === 128378 || x2 === 128405 || x2 === 128406 || x2 === 128420 || x2 >= 128507 && x2 <= 128591 || x2 >= 128640 && x2 <= 128709 || x2 === 128716 || x2 >= 128720 && x2 <= 128722 || x2 >= 128725 && x2 <= 128727 || x2 >= 128732 && x2 <= 128735 || x2 === 128747 || x2 === 128748 || x2 >= 128756 && x2 <= 128764 || x2 >= 128992 && x2 <= 129003 || x2 === 129008 || x2 >= 129292 && x2 <= 129338 || x2 >= 129340 && x2 <= 129349 || x2 >= 129351 && x2 <= 129535 || x2 >= 129648 && x2 <= 129660 || x2 >= 129664 && x2 <= 129673 || x2 >= 129679 && x2 <= 129734 || x2 >= 129742 && x2 <= 129756 || x2 >= 129759 && x2 <= 129769 || x2 >= 129776 && x2 <= 129784 || x2 >= 131072 && x2 <= 196605 || x2 >= 196608 && x2 <= 262141;
}
function validate(codePoint) {
  if (!Number.isSafeInteger(codePoint)) {
    throw new TypeError(`Expected a code point, got \`${typeof codePoint}\`.`);
  }
}
function eastAsianWidth(codePoint, { ambiguousAsWide = false } = {}) {
  validate(codePoint);
  if (isFullWidth(codePoint) || isWide(codePoint) || ambiguousAsWide && isAmbiguous(codePoint)) {
    return 2;
  }
  return 1;
}
var emojiRegex = () => {
  return /[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26D3\uFE0F?(?:\u200D\uD83D\uDCA5)?|\u26F9(?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF43\uDF45-\uDF4A\uDF4C-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDF44(?:\u200D\uD83D\uDFEB)?|\uDF4B(?:\u200D\uD83D\uDFE9)?|\uDFC3(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4\uDEB5](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE41\uDE43\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC08(?:\u200D\u2B1B)?|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC26(?:\u200D(?:\u2B1B|\uD83D\uDD25))?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE])))?))?|\uDC6F(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDD75(?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?|\uDE42(?:\u200D[\u2194\u2195]\uFE0F?)?|\uDEB6(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE89\uDE8F-\uDEC2\uDEC6\uDECE-\uDEDC\uDEDF-\uDEE9]|\uDD3C(?:\u200D[\u2640\u2642]\uFE0F?|\uD83C[\uDFFB-\uDFFF])?|\uDDCE(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1|\uDDD1\u200D\uD83E\uDDD2(?:\u200D\uD83E\uDDD2)?|\uDDD2(?:\u200D\uD83E\uDDD2)?))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?)/g;
};
var segmenter = globalThis.Intl?.Segmenter ? new Intl.Segmenter : { segment: (str) => str.split("") };
var defaultIgnorableCodePointRegex = /^\p{Default_Ignorable_Code_Point}$/u;
function stringWidth$1(string, options = {}) {
  if (typeof string !== "string" || string.length === 0) {
    return 0;
  }
  const {
    ambiguousIsNarrow = true,
    countAnsiEscapeCodes = false
  } = options;
  if (!countAnsiEscapeCodes) {
    string = stripAnsi2(string);
  }
  if (string.length === 0) {
    return 0;
  }
  let width = 0;
  const eastAsianWidthOptions = { ambiguousAsWide: !ambiguousIsNarrow };
  for (const { segment: character } of segmenter.segment(string)) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 31 || codePoint >= 127 && codePoint <= 159) {
      continue;
    }
    if (codePoint >= 8203 && codePoint <= 8207 || codePoint === 65279) {
      continue;
    }
    if (codePoint >= 768 && codePoint <= 879 || codePoint >= 6832 && codePoint <= 6911 || codePoint >= 7616 && codePoint <= 7679 || codePoint >= 8400 && codePoint <= 8447 || codePoint >= 65056 && codePoint <= 65071) {
      continue;
    }
    if (codePoint >= 55296 && codePoint <= 57343) {
      continue;
    }
    if (codePoint >= 65024 && codePoint <= 65039) {
      continue;
    }
    if (defaultIgnorableCodePointRegex.test(character)) {
      continue;
    }
    if (emojiRegex().test(character)) {
      width += 2;
      continue;
    }
    width += eastAsianWidth(codePoint, eastAsianWidthOptions);
  }
  return width;
}
function isUnicodeSupported() {
  const { env: env2 } = g$1;
  const { TERM, TERM_PROGRAM } = env2;
  if (g$1.platform !== "win32") {
    return TERM !== "linux";
  }
  return Boolean(env2.WT_SESSION) || Boolean(env2.TERMINUS_SUBLIME) || env2.ConEmuTask === "{cmd::Cmder}" || TERM_PROGRAM === "Terminus-Sublime" || TERM_PROGRAM === "vscode" || TERM === "xterm-256color" || TERM === "alacritty" || TERM === "rxvt-unicode" || TERM === "rxvt-unicode-256color" || env2.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
var TYPE_COLOR_MAP = {
  info: "cyan",
  fail: "red",
  success: "green",
  ready: "green",
  start: "magenta"
};
var LEVEL_COLOR_MAP = {
  0: "red",
  1: "yellow"
};
var unicode = isUnicodeSupported();
var s = (c3, fallback) => unicode ? c3 : fallback;
var TYPE_ICONS = {
  error: s("✖", "×"),
  fatal: s("✖", "×"),
  ready: s("✔", "√"),
  warn: s("⚠", "‼"),
  info: s("ℹ", "i"),
  success: s("✔", "√"),
  debug: s("⚙", "D"),
  trace: s("→", "→"),
  fail: s("✖", "×"),
  start: s("◐", "o"),
  log: ""
};
function stringWidth(str) {
  const hasICU = typeof Intl === "object";
  if (!hasICU || !Intl.Segmenter) {
    return stripAnsi(str).length;
  }
  return stringWidth$1(str);
}

class FancyReporter extends BasicReporter {
  formatStack(stack, message, opts) {
    const indent = "  ".repeat((opts?.errorLevel || 0) + 1);
    return `
${indent}` + parseStack(stack, message).map((line) => "  " + line.replace(/^at +/, (m2) => colors.gray(m2)).replace(/\((.+)\)/, (_3, m2) => `(${colors.cyan(m2)})`)).join(`
${indent}`);
  }
  formatType(logObj, isBadge, opts) {
    const typeColor = TYPE_COLOR_MAP[logObj.type] || LEVEL_COLOR_MAP[logObj.level] || "gray";
    if (isBadge) {
      return getBgColor(typeColor)(colors.black(` ${logObj.type.toUpperCase()} `));
    }
    const _type = typeof TYPE_ICONS[logObj.type] === "string" ? TYPE_ICONS[logObj.type] : logObj.icon || logObj.type;
    return _type ? getColor2(typeColor)(_type) : "";
  }
  formatLogObj(logObj, opts) {
    const [message, ...additional] = this.formatArgs(logObj.args, opts).split(`
`);
    if (logObj.type === "box") {
      return box(characterFormat(message + (additional.length > 0 ? `
` + additional.join(`
`) : "")), {
        title: logObj.title ? characterFormat(logObj.title) : undefined,
        style: logObj.style
      });
    }
    const date = this.formatDate(logObj.date, opts);
    const coloredDate = date && colors.gray(date);
    const isBadge = logObj.badge ?? logObj.level < 2;
    const type = this.formatType(logObj, isBadge, opts);
    const tag = logObj.tag ? colors.gray(logObj.tag) : "";
    let line;
    const left = this.filterAndJoin([type, characterFormat(message)]);
    const right = this.filterAndJoin(opts.columns ? [tag, coloredDate] : [tag]);
    const space = (opts.columns || 0) - stringWidth(left) - stringWidth(right) - 2;
    line = space > 0 && (opts.columns || 0) >= 80 ? left + " ".repeat(space) + right : (right ? `${colors.gray(`[${right}]`)} ` : "") + left;
    line += characterFormat(additional.length > 0 ? `
` + additional.join(`
`) : "");
    if (logObj.type === "trace") {
      const _err = new Error("Trace: " + logObj.message);
      line += this.formatStack(_err.stack || "", _err.message);
    }
    return isBadge ? `
` + line + `
` : line;
  }
}
function characterFormat(str) {
  return str.replace(/`([^`]+)`/gm, (_3, m2) => colors.cyan(m2)).replace(/\s+_([^_]+)_\s+/gm, (_3, m2) => ` ${colors.underline(m2)} `);
}
function getColor2(color = "white") {
  return colors[color] || colors.white;
}
function getBgColor(color = "bgWhite") {
  return colors[`bg${color[0].toUpperCase()}${color.slice(1)}`] || colors.bgWhite;
}
function createConsola2(options = {}) {
  let level = _getDefaultLogLevel();
  if (process.env.CONSOLA_LEVEL) {
    level = Number.parseInt(process.env.CONSOLA_LEVEL) ?? level;
  }
  const consola2 = createConsola({
    level,
    defaults: { level },
    stdout: process.stdout,
    stderr: process.stderr,
    prompt: (...args) => Promise.resolve().then(() => (init_prompt(), exports_prompt)).then((m2) => m2.prompt(...args)),
    reporters: options.reporters || [
      options.fancy ?? !(T2 || R2) ? new FancyReporter : new BasicReporter
    ],
    ...options
  });
  return consola2;
}
function _getDefaultLogLevel() {
  if (g2) {
    return LogLevels.debug;
  }
  if (R2) {
    return LogLevels.warn;
  }
  return LogLevels.info;
}
var consola = createConsola2();
// node_modules/citty/dist/index.mjs
function toArray(val) {
  if (Array.isArray(val)) {
    return val;
  }
  return val === undefined ? [] : [val];
}
function formatLineColumns(lines, linePrefix = "") {
  const maxLengh = [];
  for (const line of lines) {
    for (const [i2, element] of line.entries()) {
      maxLengh[i2] = Math.max(maxLengh[i2] || 0, element.length);
    }
  }
  return lines.map((l2) => l2.map((c3, i2) => linePrefix + c3[i2 === 0 ? "padStart" : "padEnd"](maxLengh[i2])).join("  ")).join(`
`);
}
function resolveValue(input) {
  return typeof input === "function" ? input() : input;
}

class CLIError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "CLIError";
  }
}
var NUMBER_CHAR_RE = /\d/;
var STR_SPLITTERS = ["-", "_", "/", "."];
function isUppercase(char = "") {
  if (NUMBER_CHAR_RE.test(char)) {
    return;
  }
  return char !== char.toLowerCase();
}
function splitByCase(str, separators) {
  const splitters = separators ?? STR_SPLITTERS;
  const parts = [];
  if (!str || typeof str !== "string") {
    return parts;
  }
  let buff = "";
  let previousUpper;
  let previousSplitter;
  for (const char of str) {
    const isSplitter = splitters.includes(char);
    if (isSplitter === true) {
      parts.push(buff);
      buff = "";
      previousUpper = undefined;
      continue;
    }
    const isUpper = isUppercase(char);
    if (previousSplitter === false) {
      if (previousUpper === false && isUpper === true) {
        parts.push(buff);
        buff = char;
        previousUpper = isUpper;
        continue;
      }
      if (previousUpper === true && isUpper === false && buff.length > 1) {
        const lastChar = buff.at(-1);
        parts.push(buff.slice(0, Math.max(0, buff.length - 1)));
        buff = lastChar + char;
        previousUpper = isUpper;
        continue;
      }
    }
    buff += char;
    previousUpper = isUpper;
    previousSplitter = isSplitter;
  }
  parts.push(buff);
  return parts;
}
function upperFirst(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : "";
}
function lowerFirst(str) {
  return str ? str[0].toLowerCase() + str.slice(1) : "";
}
function pascalCase(str, opts) {
  return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => upperFirst(opts?.normalize ? p.toLowerCase() : p)).join("") : "";
}
function camelCase(str, opts) {
  return lowerFirst(pascalCase(str || "", opts));
}
function kebabCase(str, joiner) {
  return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => p.toLowerCase()).join(joiner ?? "-") : "";
}
function toArr(any) {
  return any == undefined ? [] : Array.isArray(any) ? any : [any];
}
function toVal(out, key, val, opts) {
  let x2;
  const old = out[key];
  const nxt = ~opts.string.indexOf(key) ? val == undefined || val === true ? "" : String(val) : typeof val === "boolean" ? val : ~opts.boolean.indexOf(key) ? val === "false" ? false : val === "true" || (out._.push((x2 = +val, x2 * 0 === 0) ? x2 : val), !!val) : (x2 = +val, x2 * 0 === 0) ? x2 : val;
  out[key] = old == undefined ? nxt : Array.isArray(old) ? old.concat(nxt) : [old, nxt];
}
function parseRawArgs(args = [], opts = {}) {
  let k2;
  let arr;
  let arg;
  let name;
  let val;
  const out = { _: [] };
  let i2 = 0;
  let j = 0;
  let idx = 0;
  const len = args.length;
  const alibi = opts.alias !== undefined;
  const strict = opts.unknown !== undefined;
  const defaults = opts.default !== undefined;
  opts.alias = opts.alias || {};
  opts.string = toArr(opts.string);
  opts.boolean = toArr(opts.boolean);
  if (alibi) {
    for (k2 in opts.alias) {
      arr = opts.alias[k2] = toArr(opts.alias[k2]);
      for (i2 = 0;i2 < arr.length; i2++) {
        (opts.alias[arr[i2]] = arr.concat(k2)).splice(i2, 1);
      }
    }
  }
  for (i2 = opts.boolean.length;i2-- > 0; ) {
    arr = opts.alias[opts.boolean[i2]] || [];
    for (j = arr.length;j-- > 0; ) {
      opts.boolean.push(arr[j]);
    }
  }
  for (i2 = opts.string.length;i2-- > 0; ) {
    arr = opts.alias[opts.string[i2]] || [];
    for (j = arr.length;j-- > 0; ) {
      opts.string.push(arr[j]);
    }
  }
  if (defaults) {
    for (k2 in opts.default) {
      name = typeof opts.default[k2];
      arr = opts.alias[k2] = opts.alias[k2] || [];
      if (opts[name] !== undefined) {
        opts[name].push(k2);
        for (i2 = 0;i2 < arr.length; i2++) {
          opts[name].push(arr[i2]);
        }
      }
    }
  }
  const keys = strict ? Object.keys(opts.alias) : [];
  for (i2 = 0;i2 < len; i2++) {
    arg = args[i2];
    if (arg === "--") {
      out._ = out._.concat(args.slice(++i2));
      break;
    }
    for (j = 0;j < arg.length; j++) {
      if (arg.charCodeAt(j) !== 45) {
        break;
      }
    }
    if (j === 0) {
      out._.push(arg);
    } else if (arg.substring(j, j + 3) === "no-") {
      name = arg.slice(Math.max(0, j + 3));
      if (strict && !~keys.indexOf(name)) {
        return opts.unknown(arg);
      }
      out[name] = false;
    } else {
      for (idx = j + 1;idx < arg.length; idx++) {
        if (arg.charCodeAt(idx) === 61) {
          break;
        }
      }
      name = arg.substring(j, idx);
      val = arg.slice(Math.max(0, ++idx)) || i2 + 1 === len || ("" + args[i2 + 1]).charCodeAt(0) === 45 || args[++i2];
      arr = j === 2 ? [name] : name;
      for (idx = 0;idx < arr.length; idx++) {
        name = arr[idx];
        if (strict && !~keys.indexOf(name)) {
          return opts.unknown("-".repeat(j) + name);
        }
        toVal(out, name, idx + 1 < arr.length || val, opts);
      }
    }
  }
  if (defaults) {
    for (k2 in opts.default) {
      if (out[k2] === undefined) {
        out[k2] = opts.default[k2];
      }
    }
  }
  if (alibi) {
    for (k2 in out) {
      arr = opts.alias[k2] || [];
      while (arr.length > 0) {
        out[arr.shift()] = out[k2];
      }
    }
  }
  return out;
}
function parseArgs(rawArgs, argsDef) {
  const parseOptions = {
    boolean: [],
    string: [],
    mixed: [],
    alias: {},
    default: {}
  };
  const args = resolveArgs(argsDef);
  for (const arg of args) {
    if (arg.type === "positional") {
      continue;
    }
    if (arg.type === "string") {
      parseOptions.string.push(arg.name);
    } else if (arg.type === "boolean") {
      parseOptions.boolean.push(arg.name);
    }
    if (arg.default !== undefined) {
      parseOptions.default[arg.name] = arg.default;
    }
    if (arg.alias) {
      parseOptions.alias[arg.name] = arg.alias;
    }
  }
  const parsed = parseRawArgs(rawArgs, parseOptions);
  const [...positionalArguments] = parsed._;
  const parsedArgsProxy = new Proxy(parsed, {
    get(target, prop) {
      return target[prop] ?? target[camelCase(prop)] ?? target[kebabCase(prop)];
    }
  });
  for (const [, arg] of args.entries()) {
    if (arg.type === "positional") {
      const nextPositionalArgument = positionalArguments.shift();
      if (nextPositionalArgument !== undefined) {
        parsedArgsProxy[arg.name] = nextPositionalArgument;
      } else if (arg.default === undefined && arg.required !== false) {
        throw new CLIError(`Missing required positional argument: ${arg.name.toUpperCase()}`, "EARG");
      } else {
        parsedArgsProxy[arg.name] = arg.default;
      }
    } else if (arg.required && parsedArgsProxy[arg.name] === undefined) {
      throw new CLIError(`Missing required argument: --${arg.name}`, "EARG");
    }
  }
  return parsedArgsProxy;
}
function resolveArgs(argsDef) {
  const args = [];
  for (const [name, argDef] of Object.entries(argsDef || {})) {
    args.push({
      ...argDef,
      name,
      alias: toArray(argDef.alias)
    });
  }
  return args;
}
function defineCommand(def) {
  return def;
}
async function runCommand(cmd, opts) {
  const cmdArgs = await resolveValue(cmd.args || {});
  const parsedArgs = parseArgs(opts.rawArgs, cmdArgs);
  const context = {
    rawArgs: opts.rawArgs,
    args: parsedArgs,
    data: opts.data,
    cmd
  };
  if (typeof cmd.setup === "function") {
    await cmd.setup(context);
  }
  let result;
  try {
    const subCommands = await resolveValue(cmd.subCommands);
    if (subCommands && Object.keys(subCommands).length > 0) {
      const subCommandArgIndex = opts.rawArgs.findIndex((arg) => !arg.startsWith("-"));
      const subCommandName = opts.rawArgs[subCommandArgIndex];
      if (subCommandName) {
        if (!subCommands[subCommandName]) {
          throw new CLIError(`Unknown command \`${subCommandName}\``, "E_UNKNOWN_COMMAND");
        }
        const subCommand = await resolveValue(subCommands[subCommandName]);
        if (subCommand) {
          await runCommand(subCommand, {
            rawArgs: opts.rawArgs.slice(subCommandArgIndex + 1)
          });
        }
      } else if (!cmd.run) {
        throw new CLIError(`No command specified.`, "E_NO_COMMAND");
      }
    }
    if (typeof cmd.run === "function") {
      result = await cmd.run(context);
    }
  } finally {
    if (typeof cmd.cleanup === "function") {
      await cmd.cleanup(context);
    }
  }
  return { result };
}
async function resolveSubCommand(cmd, rawArgs, parent) {
  const subCommands = await resolveValue(cmd.subCommands);
  if (subCommands && Object.keys(subCommands).length > 0) {
    const subCommandArgIndex = rawArgs.findIndex((arg) => !arg.startsWith("-"));
    const subCommandName = rawArgs[subCommandArgIndex];
    const subCommand = await resolveValue(subCommands[subCommandName]);
    if (subCommand) {
      return resolveSubCommand(subCommand, rawArgs.slice(subCommandArgIndex + 1), cmd);
    }
  }
  return [cmd, parent];
}
async function showUsage(cmd, parent) {
  try {
    consola.log(await renderUsage(cmd, parent) + `
`);
  } catch (error) {
    consola.error(error);
  }
}
async function renderUsage(cmd, parent) {
  const cmdMeta = await resolveValue(cmd.meta || {});
  const cmdArgs = resolveArgs(await resolveValue(cmd.args || {}));
  const parentMeta = await resolveValue(parent?.meta || {});
  const commandName = `${parentMeta.name ? `${parentMeta.name} ` : ""}` + (cmdMeta.name || process.argv[1]);
  const argLines = [];
  const posLines = [];
  const commandsLines = [];
  const usageLine = [];
  for (const arg of cmdArgs) {
    if (arg.type === "positional") {
      const name = arg.name.toUpperCase();
      const isRequired = arg.required !== false && arg.default === undefined;
      const defaultHint = arg.default ? `="${arg.default}"` : "";
      posLines.push([
        "`" + name + defaultHint + "`",
        arg.description || "",
        arg.valueHint ? `<${arg.valueHint}>` : ""
      ]);
      usageLine.push(isRequired ? `<${name}>` : `[${name}]`);
    } else {
      const isRequired = arg.required === true && arg.default === undefined;
      const argStr = (arg.type === "boolean" && arg.default === true ? [
        ...(arg.alias || []).map((a2) => `--no-${a2}`),
        `--no-${arg.name}`
      ].join(", ") : [...(arg.alias || []).map((a2) => `-${a2}`), `--${arg.name}`].join(", ")) + (arg.type === "string" && (arg.valueHint || arg.default) ? `=${arg.valueHint ? `<${arg.valueHint}>` : `"${arg.default || ""}"`}` : "");
      argLines.push([
        "`" + argStr + (isRequired ? " (required)" : "") + "`",
        arg.description || ""
      ]);
      if (isRequired) {
        usageLine.push(argStr);
      }
    }
  }
  if (cmd.subCommands) {
    const commandNames = [];
    const subCommands = await resolveValue(cmd.subCommands);
    for (const [name, sub] of Object.entries(subCommands)) {
      const subCmd = await resolveValue(sub);
      const meta = await resolveValue(subCmd?.meta);
      commandsLines.push([`\`${name}\``, meta?.description || ""]);
      commandNames.push(name);
    }
    usageLine.push(commandNames.join("|"));
  }
  const usageLines = [];
  const version = cmdMeta.version || parentMeta.version;
  usageLines.push(colors.gray(`${cmdMeta.description} (${commandName + (version ? ` v${version}` : "")})`), "");
  const hasOptions = argLines.length > 0 || posLines.length > 0;
  usageLines.push(`${colors.underline(colors.bold("USAGE"))} \`${commandName}${hasOptions ? " [OPTIONS]" : ""} ${usageLine.join(" ")}\``, "");
  if (posLines.length > 0) {
    usageLines.push(colors.underline(colors.bold("ARGUMENTS")), "");
    usageLines.push(formatLineColumns(posLines, "  "));
    usageLines.push("");
  }
  if (argLines.length > 0) {
    usageLines.push(colors.underline(colors.bold("OPTIONS")), "");
    usageLines.push(formatLineColumns(argLines, "  "));
    usageLines.push("");
  }
  if (commandsLines.length > 0) {
    usageLines.push(colors.underline(colors.bold("COMMANDS")), "");
    usageLines.push(formatLineColumns(commandsLines, "  "));
    usageLines.push("", `Use \`${commandName} <command> --help\` for more information about a command.`);
  }
  return usageLines.filter((l2) => typeof l2 === "string").join(`
`);
}
async function runMain(cmd, opts = {}) {
  const rawArgs = opts.rawArgs || process.argv.slice(2);
  const showUsage$1 = opts.showUsage || showUsage;
  try {
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      await showUsage$1(...await resolveSubCommand(cmd, rawArgs));
      process.exit(0);
    } else if (rawArgs.length === 1 && rawArgs[0] === "--version") {
      const meta = typeof cmd.meta === "function" ? await cmd.meta() : await cmd.meta;
      if (!meta?.version) {
        throw new CLIError("No version specified", "E_NO_VERSION");
      }
      consola.log(meta.version);
    } else {
      await runCommand(cmd, { rawArgs });
    }
  } catch (error) {
    const isCLIError = error instanceof CLIError;
    if (!isCLIError) {
      consola.error(error, `
`);
    }
    if (isCLIError) {
      await showUsage$1(...await resolveSubCommand(cmd, rawArgs));
    }
    consola.error(error.message);
    process.exit(1);
  }
}

// src/sgc.ts
import { existsSync as existsSync27 } from "fs";
// package.json
var package_default = {
  name: "@sdsrs/sgc",
  version: "1.38.1",
  description: "All-in-one engineering workflow & knowledge engine for Claude Code: L0-L3 task classification, 13 runtime invariants, code review, browser QA, security review, and a deduplicated knowledge base that compounds across tasks. Self-contained — one-command install, Node-only, no other plugins required.",
  type: "module",
  bin: {
    sgc: "./plugins/sgc/bin/sgc.mjs"
  },
  files: [
    "plugins/sgc/bin/sgc.mjs",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  engines: {
    node: ">=18"
  },
  publishConfig: {
    access: "public",
    provenance: true
  },
  repository: {
    type: "git",
    url: "git+https://github.com/sdsrss/sgc.git"
  },
  bugs: {
    url: "https://github.com/sdsrss/sgc/issues"
  },
  homepage: "https://github.com/sdsrss/sgc#readme",
  keywords: [
    "claude-code",
    "ai-coding",
    "task-classifier",
    "invariants",
    "knowledge-engine",
    "dispatcher",
    "dedup"
  ],
  scripts: {
    "build:cli": "node scripts/build-cli.mjs",
    typecheck: "tsc --noEmit",
    test: "SGC_FORCE_INLINE=1 bun test tests/dispatcher",
    "test:eval": "bun test tests/eval",
    "test:all": "SGC_FORCE_INLINE=1 bun test tests/"
  },
  author: {
    name: "SDS"
  },
  license: "MIT",
  devDependencies: {
    "@types/bun": "latest",
    "@types/js-yaml": "^4.0.9",
    typescript: "^6.0.3"
  },
  dependencies: {
    "@anthropic-ai/sdk": "^0.91.1",
    citty: "^0.1.6",
    "js-yaml": "^4.1.1"
  },
  optionalDependencies: {
    playwright: "^1.52.0"
  }
};

// node_modules/citty/dist/index.mjs
function defineCommand2(def) {
  return def;
}

// src/commands/debug.ts
var debugCommand = defineCommand2({
  meta: {
    name: "debug",
    description: "4-phase systematic-debugging walker (investigate, analyze, hypothesize, implement). Iron Law #3 hard-gate on close."
  },
  args: {
    subcommand: {
      type: "positional",
      required: false,
      description: "subcommand: start | close (omit to use --runs/--status flag mode)"
    },
    symptom: {
      type: "positional",
      required: false,
      description: "(start) one-liner symptom description"
    },
    id: {
      type: "string",
      description: "(close | --status) investigation id"
    },
    "root-cause": {
      type: "string",
      description: "(close) Iron Law #3 root cause explanation"
    },
    "fix-commit": {
      type: "string",
      description: "(close) Iron Law #3 fix commit SHA (7-40 hex chars)"
    },
    "verify-command": {
      type: "string",
      description: "(close) Iron Law #3 verify command (arbitrary string; operator responsibility)"
    },
    runs: {
      type: "boolean",
      default: false,
      description: "list all investigations"
    },
    status: {
      type: "string",
      description: "show single investigation by id"
    },
    "state-root": {
      type: "string",
      description: "(hidden test seam) override .sgc/ location"
    },
    "repo-root": {
      type: "string",
      description: "(hidden test seam) override cwd"
    }
  },
  async run({ args }) {
    const stateRoot = args["state-root"];
    const repoRoot = args["repo-root"];
    const subcommand = args.subcommand;
    let result;
    if (args.runs === true) {
      const { runDebugList: runDebugList2 } = await Promise.resolve().then(() => (init_debug(), exports_debug));
      result = await runDebugList2({ stateRoot });
    } else if (typeof args.status === "string" && args.status.length > 0) {
      const { runDebugStatus: runDebugStatus2 } = await Promise.resolve().then(() => (init_debug(), exports_debug));
      result = await runDebugStatus2({ id: args.status, stateRoot });
    } else if (subcommand === "start") {
      const symptom = args.symptom ?? "";
      if (symptom.length === 0) {
        process.stderr.write(`usage: sgc debug start "<symptom>"
`);
        process.exit(1);
      }
      const { runDebugStart: runDebugStart2 } = await Promise.resolve().then(() => (init_debug(), exports_debug));
      result = await runDebugStart2({ symptom, stateRoot, repoRoot });
    } else if (subcommand === "close") {
      let id = args.id ?? "";
      const rootCause = args["root-cause"] ?? "";
      const fixCommit = args["fix-commit"] ?? "";
      const verifyCommand = args["verify-command"] ?? "";
      const { findSoleInProgressInvestigation: findSoleInProgressInvestigation2, runDebugClose: runDebugClose2 } = await Promise.resolve().then(() => (init_debug(), exports_debug));
      if (id.length === 0) {
        id = await findSoleInProgressInvestigation2(stateRoot) ?? "";
      }
      if (id.length === 0 || rootCause.length === 0 || fixCommit.length === 0 || verifyCommand.length === 0) {
        process.stderr.write(`usage: sgc debug close [--id <id>] --root-cause "<text>" --fix-commit <sha> --verify-command "<cmd>"
(--id is inferred when exactly one investigation is in_progress; pass it explicitly otherwise)
`);
        process.exit(1);
      }
      result = await runDebugClose2({ id, rootCause, fixCommit, verifyCommand, stateRoot });
    } else {
      process.stderr.write(`usage: sgc debug start "<symptom>" | close --id <id> --root-cause "<text>" --fix-commit <sha> --verify-command "<cmd>" | --runs | --status <id>
`);
      process.exit(1);
    }
    process.exit(result.exitCode);
  }
});

// src/dispatcher/types.ts
var LEVELS2 = ["L0", "L1", "L2", "L3"];

// src/sgc.ts
var discover = defineCommand({
  meta: { name: "discover", description: "Clarify requirements before planning" },
  args: {
    topic: { type: "positional", required: true, description: "What to clarify" },
    template: {
      type: "string",
      required: false,
      description: "Framing overlay: product | scope | anti-pattern (GS-6)"
    }
  },
  async run({ args }) {
    const { runDiscover: runDiscover2 } = await Promise.resolve().then(() => (init_discover(), exports_discover));
    await runDiscover2({
      topic: args.topic,
      ...args.template ? { template: args.template } : {}
    });
  }
});
var plan = defineCommand({
  meta: { name: "plan", description: "Classify task level, run planners, write intent" },
  args: {
    task: {
      type: "positional",
      required: false,
      description: "Task description (one sentence) \u2014 required unless --jobs or --status is set"
    },
    level: {
      type: "string",
      required: false,
      description: "Override classifier level (upgrade only \u2014 L1\u2192L2, L2\u2192L3)"
    },
    "signed-by": {
      type: "string",
      required: false,
      description: "Human signer_id required for L3 intents (Invariant \xA74)"
    },
    motivation: {
      type: "string",
      required: false,
      description: "Long-form rationale (\u226520 words; required for L1+ if task description is short)"
    },
    auto: {
      type: "boolean",
      required: false,
      description: "Skip interactive confirmation. REFUSED at L3 (Invariant \xA74)."
    },
    "force-new-task": {
      type: "boolean",
      required: false,
      description: "Override active handoff and start a new task"
    },
    deep: {
      type: "boolean",
      required: false,
      description: "Force deep decomposition at L1 (implied at L2/L3)"
    },
    async: {
      type: "boolean",
      required: false,
      description: "CE-4: fork a detached child running the planner cluster; print job_id and exit. Tail with `sgc plan --status <id>`."
    },
    jobs: {
      type: "boolean",
      required: false,
      description: "List async plan jobs (running, done, failed, stale). No TASK arg needed."
    },
    status: {
      type: "string",
      required: false,
      description: "Show one async plan job by id (frontmatter + tail log). No TASK arg needed."
    },
    log: {
      type: "boolean",
      required: false,
      description: "With --status: print the entire log file instead of the last 100 lines."
    }
  },
  async run({ args }) {
    const showJobsFlag = args.jobs;
    const showStatusId = args.status;
    const showLog = args.log;
    if (showJobsFlag) {
      const { listJobs: listJobs3 } = await Promise.resolve().then(() => (init_plan_jobs(), exports_plan_jobs));
      const jobs = await listJobs3();
      if (jobs.length === 0) {
        process.stderr.write(`no plan jobs found.
`);
        return;
      }
      for (const j of jobs) {
        process.stdout.write(`${j.job_id}  ${j.status.padEnd(7)}  pid=${String(j.pid).padEnd(7)}  started=${j.started_at}  task=${j.task}
`);
      }
      return;
    }
    if (showStatusId !== undefined && showStatusId.length > 0) {
      const { showJob: showJob2 } = await Promise.resolve().then(() => (init_plan_jobs(), exports_plan_jobs));
      const r3 = await showJob2(showStatusId, {
        logTailLines: showLog ? Number.MAX_SAFE_INTEGER : 100
      });
      const j = r3.job;
      process.stdout.write(`job_id:       ${j.job_id}
`);
      process.stdout.write(`task:         ${j.task}
`);
      process.stdout.write(`status:       ${j.status}
`);
      process.stdout.write(`pid:          ${j.pid}
`);
      process.stdout.write(`started_at:   ${j.started_at}
`);
      if (j.completed_at)
        process.stdout.write(`completed_at: ${j.completed_at}
`);
      if (j.level)
        process.stdout.write(`level:        ${j.level}
`);
      if (j.task_id)
        process.stdout.write(`task_id:      ${j.task_id}
`);
      if (j.intent_path)
        process.stdout.write(`intent_path:  ${j.intent_path}
`);
      if (j.error)
        process.stdout.write(`error:        ${j.error}
`);
      process.stdout.write(`log_path:     ${j.log_path}
`);
      process.stdout.write(`
--- log${showLog ? "" : " (tail 100)"} ---
`);
      process.stdout.write(r3.logTail);
      return;
    }
    const task = args.task;
    if (!task || task.trim().length === 0) {
      process.stderr.write(`error: TASK arg required (unless --jobs or --status <id> is set)
`);
      process.exit(1);
    }
    const { runPlan: runPlan3 } = await Promise.resolve().then(() => (init_plan(), exports_plan));
    const force = args.level;
    if (force !== undefined && !LEVELS2.includes(force)) {
      process.stderr.write(`error: --level must be one of L0|L1|L2|L3 (got '${force}')
`);
      process.exit(1);
    }
    const signedBy = args["signed-by"];
    const userSignature = signedBy ? { signed_at: new Date().toISOString(), signer_id: signedBy } : undefined;
    await runPlan3(task, {
      forceLevel: force,
      userSignature,
      motivation: args.motivation,
      autoConfirm: args.auto,
      forceNewTask: args["force-new-task"],
      async: args.async,
      deep: args.deep
    });
  }
});
var work = defineCommand({
  meta: { name: "work", description: "Track feature-list progress for the active task" },
  args: {
    add: {
      type: "string",
      required: false,
      description: "Append a new feature to feature-list with this title"
    },
    done: {
      type: "string",
      required: false,
      description: "Mark feature with this id as done (requires --verify-command)"
    },
    "verify-command": {
      type: "string",
      required: false,
      description: "(with --done) how the feature was verified \u2014 required to close. Operator responsibility; sgc does not execute it (parity with debug close)"
    },
    evidence: {
      type: "string",
      required: false,
      description: "(with --done) optional free-text evidence naming what was observed"
    },
    "prior-red": {
      type: "string",
      required: false,
      description: "(with --done) failing test / repro that was RED before the fix (TDD-ledger). Pairs with --red-output."
    },
    "red-output": {
      type: "string",
      required: false,
      description: "(with --done) the observed failure output of --prior-red."
    },
    "waive-red": {
      type: "string",
      required: false,
      description: '(with --done) close without a prior-RED, giving a reason (e.g. "docs-only"). Escape hatch for the TDD-ledger gate.'
    }
  },
  async run({ args }) {
    const { runWork: runWork2 } = await Promise.resolve().then(() => (init_work(), exports_work));
    await runWork2({
      add: args.add,
      done: args.done,
      verifyCommand: args["verify-command"],
      evidence: args.evidence,
      priorRed: args["prior-red"],
      redOutput: args["red-output"],
      waiveRed: args["waive-red"]
    });
  }
});
var review = defineCommand({
  meta: { name: "review", description: "Independent static review of the diff" },
  args: {
    base: {
      type: "string",
      required: false,
      description: "Git ref to diff against (default: HEAD)"
    },
    "append-as": {
      type: "string",
      required: false,
      description: "Follow-up suffix \u2014 write reports to <reviewer>.<suffix>.md instead of <reviewer>.md (F-5)"
    }
  },
  async run({ args }) {
    const { runReview: runReview3 } = await Promise.resolve().then(() => (init_review(), exports_review));
    await runReview3({
      base: args.base,
      appendAs: args["append-as"]
    });
  }
});
var qa = defineCommand({
  meta: {
    name: "qa",
    description: "End-to-end QA gate (L2+ ship). Real-browser smoke (Playwright) is opt-in via --browse / SGC_QA_REAL=1; stub by default \u2014 returns concern, never rubber-stamps"
  },
  args: {
    target: {
      type: "positional",
      required: false,
      description: "URL or local path to test (e.g. http://localhost:3000)"
    },
    flows: {
      type: "string",
      required: false,
      description: "Comma-separated user flow descriptions (e.g. 'login,dashboard-load,logout')"
    },
    browse: {
      type: "boolean",
      required: false,
      description: "Opt in to the real-browser smoke (Playwright); default is the non-rubber-stamping stub"
    }
  },
  async run({ args }) {
    const { runQa: runQa3 } = await Promise.resolve().then(() => (init_qa(), exports_qa));
    const result = await runQa3({
      target: args.target,
      flows: args.flows ? String(args.flows).split(",").map((s2) => s2.trim()).filter(Boolean) : undefined,
      browse: args.browse === true
    });
    if (result.verdict === "fail")
      process.exit(1);
  }
});
var ship = defineCommand({
  meta: {
    name: "ship",
    description: "Ship gate: verify evidence (reviews, qa, feature-list) and write ship.md"
  },
  args: {
    auto: {
      type: "boolean",
      required: false,
      description: "Skip interactive confirmation. REFUSED at L3 (Invariant \xA74)."
    },
    pr: {
      type: "boolean",
      required: false,
      description: "Create a GitHub PR via `gh pr create` after writing ship.md"
    },
    "pr-title": {
      type: "string",
      required: false,
      description: "PR title override (default: 'sgc ship: <intent.title>')"
    },
    "pr-body": {
      type: "string",
      required: false,
      description: "PR body override (default: auto-generated summary)"
    },
    "janitor-skip-reason": {
      type: "string",
      required: false,
      description: "Opt out of janitor.compound invocation. Writes a synthetic skip decision (reason_code=user_opt_out) with your \u226540-char justification. Required field \u2014 there is no silent-skip flag (Invariant \xA76)."
    },
    "force-compound": {
      type: "boolean",
      required: false,
      description: "Force janitor.compound to decide 'compound' (bypass decision_rules). Also bypasses dedup inside runCompound."
    },
    "accept-degraded-review": {
      type: "string",
      required: false,
      description: "Accept shipping an L2+ task whose code review is heuristic-only (no LLM configured). Requires --accepted-by; reason must be \u226540 chars. Recorded in ship.md (audit F1)."
    },
    "accepted-by": {
      type: "string",
      required: false,
      description: "Signer name for --accept-degraded-review (the human accepting a no-LLM review). Non-empty."
    }
  },
  async run({ args }) {
    const { runShip: runShip2 } = await Promise.resolve().then(() => (init_ship(), exports_ship));
    await runShip2({
      autoConfirm: args.auto,
      createPr: args.pr,
      prTitle: args["pr-title"],
      prBody: args["pr-body"],
      janitorSkipReason: args["janitor-skip-reason"],
      forceCompound: args["force-compound"],
      acceptDegradedReview: args["accept-degraded-review"],
      acceptedBy: args["accepted-by"]
    });
  }
});
var compound = defineCommand({
  meta: {
    name: "compound",
    description: "Extract and store knowledge into solutions/ (usually janitor-triggered)"
  },
  args: {
    force: {
      type: "boolean",
      required: false,
      description: "Bypass dedup threshold; force a new write even if similarity \u2265 0.85"
    },
    slug: {
      type: "string",
      required: false,
      description: "Override the solution filename slug (default: slugify(problem_summary))"
    },
    "from-ship-failure": {
      type: "string",
      required: false,
      description: "CE-3 promote: convert a captured ship-failure record into a solutions/ entry. Pass the slug under <stateRoot>/ship-failures/<slug>.md."
    },
    "from-canary": {
      type: "string",
      required: false,
      description: "GS-1.1 promote: convert a captured canary-failure record into a solutions/ entry. Pass the slug under <stateRoot>/canaries/<slug>.md (e.g. 2026-05-25-c29f021-smoke_install)."
    },
    "from-red-green": {
      type: "string",
      required: false,
      description: "TDD-ledger promote: convert a captured red-green record into a solutions/ entry. Pass the slug under <stateRoot>/red-green/<slug>.md."
    },
    "solution-slug": {
      type: "string",
      required: false,
      description: "Override the solution slug when promoting (default: ship-failure-<short-sha> for --from-ship-failure; canary-<short-sha>-<phase> for --from-canary). Only valid alongside a promote flag."
    }
  },
  async run({ args }) {
    const fromCanary = args["from-canary"];
    if (fromCanary !== undefined && fromCanary.length > 0) {
      const { runCanaryPromote: runCanaryPromote2 } = await Promise.resolve().then(() => (init_compound3(), exports_compound));
      const result = await runCanaryPromote2({
        slug: fromCanary,
        force: args.force,
        solutionSlug: args["solution-slug"]
      });
      process.stderr.write(`promote: action=${result.dedupAction} solution=${result.solutionPath} canary=${result.canaryPath}
`);
      return;
    }
    const fromRedGreen = args["from-red-green"];
    if (fromRedGreen !== undefined && fromRedGreen.length > 0) {
      const { runRedGreenPromote: runRedGreenPromote2 } = await Promise.resolve().then(() => (init_compound3(), exports_compound));
      const result = await runRedGreenPromote2({
        slug: fromRedGreen,
        force: args.force,
        solutionSlug: args["solution-slug"]
      });
      process.stderr.write(`promote: action=${result.dedupAction} solution=${result.solutionPath} red-green=${result.shipFailurePath}
`);
      return;
    }
    const fromShipFailure = args["from-ship-failure"];
    if (fromShipFailure !== undefined && fromShipFailure.length > 0) {
      const { runCompoundPromote: runCompoundPromote2 } = await Promise.resolve().then(() => (init_compound3(), exports_compound));
      const result = await runCompoundPromote2({
        slug: fromShipFailure,
        force: args.force,
        solutionSlug: args["solution-slug"]
      });
      process.stderr.write(`promote: action=${result.dedupAction} solution=${result.solutionPath} ship-failure=${result.shipFailurePath}
`);
      return;
    }
    const { runCompound: runCompound3 } = await Promise.resolve().then(() => (init_compound3(), exports_compound));
    await runCompound3({
      force: args.force,
      slug: args.slug
    });
  }
});
var status = defineCommand({
  meta: {
    name: "status",
    description: "Show current task state, decisions history, and knowledge stats"
  },
  async run() {
    const { readCurrentTask: readCurrentTask2 } = await Promise.resolve().then(() => (init_state2(), exports_state));
    const stateRoot2 = process.env["SGC_STATE_ROOT"] ?? ".sgc";
    if (!existsSync27(stateRoot2)) {
      console.log(`No .sgc/ state directory at ${stateRoot2}.`);
      console.log(`Run 'sgc plan <task>' to start your first task.`);
      return;
    }
    const ct = readCurrentTask2(stateRoot2);
    if (!ct) {
      console.log(`State directory exists at ${stateRoot2} but no active task.`);
      console.log(`Run 'sgc plan <task>' to begin one.`);
      return;
    }
    const rows = [
      ["task_id", ct.task.task_id],
      ["level", ct.task.level],
      ["active_feature", ct.task.active_feature ?? "(none)"],
      ["session_start", ct.task.session_start],
      ["last_activity", ct.task.last_activity]
    ];
    const labelW = Math.max(...rows.map(([k2]) => k2.length));
    console.log(`Active task (state root: ${stateRoot2}):`);
    for (const [k2, v2] of rows) {
      console.log(`  ${k2.padEnd(labelW)}  ${v2}`);
    }
  }
});
var tail = defineCommand({
  meta: {
    name: "tail",
    description: "Tail .sgc/progress/events.ndjson (structured event stream)"
  },
  args: {
    task: { type: "string", description: "Filter by task_id (exact match)" },
    agent: {
      type: "string",
      description: "Glob-match agent name (e.g. planner.* or reviewer.correctness)"
    },
    "event-type": {
      type: "string",
      description: "Substring filter on event_type (e.g. spawn. or llm.)"
    },
    since: {
      type: "string",
      description: "ISO 8601 timestamp; only events at/after this moment"
    },
    follow: {
      type: "boolean",
      default: false,
      description: "Tail -f behavior: poll for new events as they land"
    },
    json: {
      type: "boolean",
      default: false,
      description: "Emit raw NDJSON (default is human-readable)"
    },
    limit: {
      type: "string",
      description: "Emit only the last N matching events on initial drain (post-filter). In --follow mode applies to the initial drain only, then streams unbounded."
    }
  },
  async run({ args }) {
    const { runTail: runTail2 } = await Promise.resolve().then(() => (init_tail(), exports_tail));
    const limitRaw = args.limit;
    let limit;
    if (limitRaw !== undefined) {
      const n2 = Number.parseInt(limitRaw, 10);
      if (!Number.isFinite(n2) || n2 < 0) {
        throw new Error(`--limit must be a non-negative integer; got ${limitRaw}`);
      }
      limit = n2;
    }
    const sinceRaw = args.since;
    let since;
    if (sinceRaw !== undefined) {
      const ms = Date.parse(sinceRaw);
      if (Number.isNaN(ms)) {
        throw new Error(`--since must be an ISO 8601 timestamp; got ${sinceRaw}`);
      }
      since = new Date(ms).toISOString();
    }
    await runTail2({
      task: args.task,
      agent: args.agent,
      eventType: args["event-type"],
      since,
      follow: args.follow,
      json: args.json,
      limit
    });
  }
});
var agentLoop = defineCommand({
  meta: {
    name: "agent-loop",
    description: "Helper for external actors (Claude main session, user) to fulfill pending agent spawns"
  },
  args: {
    list: {
      type: "boolean",
      required: false,
      description: "List all spawns with [x]/[ ] status markers"
    },
    show: {
      type: "string",
      required: false,
      description: "Print the prompt file for a given spawn_id"
    },
    submit: {
      type: "string",
      required: false,
      description: "Write the result file for a given spawn_id"
    },
    from: {
      type: "string",
      required: false,
      description: "With --submit: read YAML from this file (else from stdin)"
    }
  },
  async run({ args }) {
    const { runAgentLoop: runAgentLoop2 } = await Promise.resolve().then(() => (init_agent_loop(), exports_agent_loop));
    await runAgentLoop2({
      list: args.list,
      show: args.show,
      submit: args.submit,
      fromFile: args.from
    });
  }
});
var doctor = defineCommand({
  meta: {
    name: "doctor",
    description: "Consistency check across contracts/sgc-capabilities.yaml \u2194 prompts/ \u2194 slot-only annotations. Exit 1 on any failure."
  },
  args: {
    "write-descriptions": {
      type: "boolean",
      required: false,
      description: "Regenerate the derived CLI-fact clause in plugins/sgc/agents/**/*.md"
    }
  },
  async run({ args }) {
    const { runDoctor: runDoctor2 } = await Promise.resolve().then(() => (init_doctor(), exports_doctor));
    const report = await runDoctor2({ writeDescriptions: args["write-descriptions"] });
    if (report.fail > 0)
      process.exit(1);
  }
});
var reflect = defineCommand({
  meta: {
    name: "reflect",
    description: "Audit decisions against accumulated preventions (read-only, heuristic-only)"
  },
  args: {
    task: {
      type: "string",
      required: false,
      description: "Audit only this task_id (default: all decisions/)"
    },
    since: {
      type: "string",
      required: false,
      description: "YYYY-MM-DD; audit only decisions created on or after this date"
    },
    save: {
      type: "boolean",
      required: false,
      description: "Write each report to <stateRoot>/reflections/<task_id>.md (replace semantics)"
    },
    json: {
      type: "boolean",
      required: false,
      description: "Emit JSON ReflectReport[] (default: human-readable)"
    }
  },
  async run({ args }) {
    const { runReflect: runReflect2 } = await Promise.resolve().then(() => (init_reflect2(), exports_reflect));
    await runReflect2({
      task: args.task,
      since: args.since,
      save: args.save,
      json: args.json
    });
  }
});
var metrics = defineCommand({
  meta: {
    name: "metrics",
    description: "Four-\u5316 product self-scorecard (\u89C4\u8303\u5316/\u667A\u80FD\u5316/\u81EA\u52A8\u5316/\u9AD8\u6548\u5316), git-tracked, read-only"
  },
  args: {
    json: {
      type: "boolean",
      required: false,
      description: "Emit JSON FourHuaMetrics (default: human-readable scorecard)"
    },
    "write-baseline": {
      type: "boolean",
      required: false,
      description: "Recompute from sources and rewrite metrics/metrics-baseline.yaml (dev)"
    }
  },
  async run({ args }) {
    const { runMetrics: runMetrics2 } = await Promise.resolve().then(() => (init_metrics2(), exports_metrics));
    await runMetrics2({
      json: args.json,
      writeBaseline: args["write-baseline"]
    });
  }
});
var watchCiFailure = defineCommand({
  meta: {
    name: "watch-ci-failure",
    description: "Poll the publish CI workflow for the current branch's HEAD and capture failures as ship-failure seed records"
  },
  args: {
    workflow: {
      type: "string",
      required: false,
      description: "Workflow filename (default: publish.yml)"
    },
    branch: {
      type: "string",
      required: false,
      description: "Branch to watch (default: current git branch)"
    },
    "run-id": {
      type: "string",
      required: false,
      description: "Attach directly to a specific gh run id; skips discovery polling"
    },
    interval: {
      type: "string",
      required: false,
      description: "Polling interval seconds (default: 15; clamped to [5, 60])"
    },
    timeout: {
      type: "string",
      required: false,
      description: "Total timeout seconds (default: 600; clamped to [60, 1800])"
    }
  },
  async run({ args }) {
    const { runWatchCiFailure: runWatchCiFailure2 } = await Promise.resolve().then(() => (init_watch_ci_failure(), exports_watch_ci_failure));
    const parseSec = (key) => {
      const v2 = args[key];
      if (v2 === undefined)
        return;
      const n2 = Number.parseInt(v2, 10);
      if (!Number.isFinite(n2) || n2 < 1) {
        throw new Error(`--${key} must be a positive integer; got ${v2}`);
      }
      return n2;
    };
    await runWatchCiFailure2({
      workflow: args.workflow,
      branch: args.branch,
      runId: args["run-id"],
      intervalSec: parseSec("interval"),
      timeoutSec: parseSec("timeout")
    });
  }
});
var canary = defineCommand({
  meta: {
    name: "canary",
    description: "GS-1: post-publish health check \u2014 poll npm propagation, smoke install via npx, optional health-url GET. Failure writes a templated record under .sgc/canaries/ and exits 1."
  },
  args: {
    package: {
      type: "string",
      required: false,
      description: "Package name (default: package.json `name` in cwd)"
    },
    version: {
      type: "string",
      required: false,
      description: "Expected version (default: package.json `version` \u2192 `git describe --tags --exact-match HEAD`)"
    },
    phases: {
      type: "string",
      required: false,
      description: "Comma-separated phases (default: npm_propagation,smoke_install); valid: npm_propagation, smoke_install, health_url"
    },
    "health-url": {
      type: "string",
      required: false,
      description: "Required when phases includes health_url. https?:// only."
    },
    "health-regex": {
      type: "string",
      required: false,
      description: "On a 2xx response, body must match this regex."
    },
    bin: {
      type: "string",
      required: false,
      description: "Bin name to invoke during smoke_install (default: derived from package name; @scope/foo \u2192 foo)"
    },
    interval: {
      type: "string",
      required: false,
      description: "Polling interval seconds (default: 15; clamped to [5, 60])"
    },
    timeout: {
      type: "string",
      required: false,
      description: "npm_propagation timeout seconds (default: 300; clamped to [60, 1800])"
    }
  },
  async run({ args }) {
    const { parsePhases: parsePhases2, runCanary: runCanary2 } = await Promise.resolve().then(() => (init_canary2(), exports_canary));
    const parseSec = (key) => {
      const v2 = args[key];
      if (v2 === undefined)
        return;
      const n2 = Number.parseInt(v2, 10);
      if (!Number.isFinite(n2) || n2 < 1) {
        throw new Error(`--${key} must be a positive integer; got ${v2}`);
      }
      return n2;
    };
    await runCanary2({
      packageName: args.package,
      expectedVersion: args.version,
      phases: parsePhases2(args.phases),
      healthUrl: args["health-url"],
      healthRegex: args["health-regex"],
      binName: args.bin,
      intervalSec: parseSec("interval"),
      timeoutSec: parseSec("timeout")
    });
  }
});
var handoff = defineCommand({
  meta: {
    name: "handoff",
    description: "GS-2: session-state checkpoint capture \u2014 scans .sgc/ state across 6 namespaces, derives Iron Law #2 verify command, writes tasks/<slug>-paused.md."
  },
  args: {
    auto: {
      type: "boolean",
      required: false,
      description: "Auto-detect slug + state from mtime-newest .sgc/decisions/<id>/intent.md and scan all 6 namespaces."
    },
    print: {
      type: "string",
      required: false,
      description: "Print existing tasks/<slug>-paused.md to stdout (exit 1 if missing)."
    }
  },
  async run({ args }) {
    const { runHandoff: runHandoff2 } = await Promise.resolve().then(() => (init_handoff2(), exports_handoff));
    const result = await runHandoff2({
      auto: args.auto,
      print: args.print,
      sgcVersion: package_default.version
    });
    process.exit(result.exitCode);
  }
});
var land = defineCommand({
  meta: {
    name: "land",
    description: "Post-publish ship chain: watch-ci-failure + canary, fail-fast on either."
  },
  args: {
    package: {
      type: "string",
      description: "Package name (default: package.json#name)."
    },
    version: {
      type: "string",
      description: "Expected version (default: package.json#version)."
    }
  },
  async run({ args }) {
    const { runLandCli: runLandCli2 } = await Promise.resolve().then(() => (init_land2(), exports_land));
    const result = await runLandCli2({
      package: args.package,
      version: args.version
    });
    process.exit(result.exitCode);
  }
});
var loop = defineCommand({
  meta: {
    name: "loop",
    description: "CE-5: end-to-end orchestrator chaining plan \u2192 [pause work] \u2192 review \u2192 [pause qa] \u2192 [pause ship] \u2192 compound. Resume with --resume <run-id>."
  },
  args: {
    task: {
      type: "positional",
      required: false,
      description: "Task description (one sentence) \u2014 required unless --resume, --runs, or --status is set"
    },
    resume: {
      type: "string",
      required: false,
      description: "Resume a paused/failed loop run by id"
    },
    runs: {
      type: "boolean",
      required: false,
      description: "List loop runs (running, paused, failed, complete). No TASK arg needed."
    },
    status: {
      type: "string",
      required: false,
      description: "Show one loop run by id (frontmatter + per-step status). No TASK arg needed."
    },
    motivation: {
      type: "string",
      required: false,
      description: "Pass-through to plan: long-form rationale (\u226520 words)"
    },
    level: {
      type: "string",
      required: false,
      description: "Pass-through to plan: override classifier level (upgrade only)"
    },
    "signed-by": {
      type: "string",
      required: false,
      description: "Pass-through to plan: human signer_id required for L3 intents (Invariant \xA74)"
    }
  },
  async run({ args }) {
    const { runLoopCommand: runLoopCommand2 } = await Promise.resolve().then(() => (init_loop2(), exports_loop));
    await runLoopCommand2({
      task: args.task,
      resume: args.resume,
      runs: args.runs,
      status: args.status,
      motivation: args.motivation,
      forceLevel: args.level,
      signedBy: args["signed-by"]
    });
  }
});
var cso = defineCommand({
  meta: {
    name: "cso",
    description: "GS-5: pre-ship security review \u2014 secret scan + dep audit + events.ndjson anomaly detection. Writes append-only report under .sgc/cso/. Exit 1 on fail, 0 on pass/warn."
  },
  async run() {
    const { runCso: runCso2 } = await Promise.resolve().then(() => (init_cso(), exports_cso));
    const { report } = await runCso2();
    if (report.verdict === "fail")
      process.exit(1);
  }
});
var main = defineCommand({
  meta: {
    name: "sgc",
    version: package_default.version,
    description: "SGC \u2014 self-contained engineering super-plugin: plan, execute, review, QA, security, ship, and compound knowledge (L0\u2013L3, standalone, no other plugins required)"
  },
  subCommands: {
    discover: () => discover,
    plan: () => plan,
    work: () => work,
    review: () => review,
    qa: () => qa,
    ship: () => ship,
    compound: () => compound,
    reflect: () => reflect,
    loop: () => loop,
    "watch-ci-failure": () => watchCiFailure,
    canary: () => canary,
    cso: () => cso,
    debug: () => debugCommand,
    land: () => land,
    handoff: () => handoff,
    status: () => status,
    "agent-loop": () => agentLoop,
    tail: () => tail,
    metrics: () => metrics,
    doctor: () => doctor
  }
});
var rawArgs = process.argv.slice(2);
var wantsHelp = rawArgs.includes("--help") || rawArgs.includes("-h");
var wantsVersion = rawArgs.length === 1 && rawArgs[0] === "--version";
if (wantsHelp || wantsVersion) {
  runMain(main);
} else {
  runCommand(main, { rawArgs }).catch(async (error2) => {
    const err = error2;
    const message = err?.message ?? String(error2);
    if (err?.name === "CLIError")
      await showUsage(main);
    process.stderr.write(`
error: ${message}
`);
    if (process.env["SGC_DEBUG"] && err?.stack) {
      process.stderr.write(`
${err.stack}
`);
    }
    process.exit(1);
  });
}
