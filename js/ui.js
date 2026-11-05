/* Utilidades de interface compartilhadas pelo app do aluno e pelo painel. */
import { CONFIG } from "./config.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const primeiro = n => (n || "você").trim().split(/\s+/)[0];
export const so_digitos = s => String(s || "").replace(/\D/g, "");

/** Número de WhatsApp no formato do wa.me (acrescenta 55 se vier só com DDD). */
export function waNum(n) {
  const d = so_digitos(n);
  if (!d) return "";
  return d.length <= 11 ? "55" + d : d;
}
export function waLink(numero, msg) {
  const n = waNum(numero || CONFIG.whatsappContato);
  return "https://wa.me/" + n + (msg ? "?text=" + encodeURIComponent(msg) : "");
}

export function fmtData(iso, opts = { day: "2-digit", month: "2-digit" }) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", opts) : "–";
}
export function diasDesde(iso) {
  if (!iso) return null;
  const a = new Date(iso); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 864e5);
}
export const kg = v => (v == null ? "–" : Number(v).toFixed(1).replace(".", ","));

let toastT;
export function toast(t) {
  document.querySelectorAll(".toast").forEach(x => x.remove());
  const d = document.createElement("div");
  d.className = "toast"; d.setAttribute("role", "status"); d.textContent = t;
  document.body.appendChild(d);
  clearTimeout(toastT); toastT = setTimeout(() => d.remove(), 2800);
}

/** Mensagem de erro do Supabase/rede em português que o aluno entende. */
export function msgErro(e) {
  const m = String(e && (e.message || e.error_description || e) || "");
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha não conferem.";
  if (/already registered|already been registered/i.test(m)) return "Esse e-mail já tem conta. Tente entrar.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/Password should be|weak/i.test(m)) return "Senha fraca: use pelo menos 8 caracteres.";
  if (/18 anos/i.test(m)) return "O app é só para maiores de 18 anos.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sem internet agora. Tente de novo em instantes.";
  return m || "Algo deu errado. Tente de novo.";
}

/** Anima números [data-count] subindo de 0 (mantém em quem pediu menos movimento: só troca o valor). */
export function contar(root) {
  root.querySelectorAll("[data-count]").forEach(el => {
    const n = +el.dataset.count, t0 = performance.now();
    const passo = now => {
      const k = Math.min(1, (now - t0) / 700);
      el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}

export function alternarTema() {
  const atual = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = atual === "dark" ? "light" : "dark";
  try { localStorage.setItem("mpc-theme", document.documentElement.dataset.theme); } catch (e) {}
}
try { const th = localStorage.getItem("mpc-theme"); if (th) document.documentElement.dataset.theme = th; } catch (e) {}

const svg = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
export const I = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  dumb: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>', 'stroke-width="2.4"'),
  play: '<svg viewBox="0 0 24 24" fill="#0E1111" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'width="16" height="16" stroke-width="3"'),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 'width="20" height="20"'),
  wa: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>',
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  out: svg('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  leg: svg('<circle cx="13" cy="4" r="2"/><path d="M12 7l-2 6 4 3v5M10 13l-3 4-3 0M12 7l4 3"/>', 'stroke-width="2"'),
  push: svg('<path d="M3 9h3M18 9h3M6 7v4M18 7v4M6 9h12"/><circle cx="12" cy="15" r="2"/><path d="M12 17v4M9 21h6"/>', 'stroke-width="2"'),
  pull: svg('<path d="M4 3h16M7 3l3 7M17 3l-3 7"/><circle cx="12" cy="12" r="2"/><path d="M12 14v7M9 21h6"/>', 'stroke-width="2"'),
  core: svg('<circle cx="5" cy="11" r="2"/><path d="M7 12h12l2 3M9 12l-1 4M3 16h18"/>', 'stroke-width="2"')
};
