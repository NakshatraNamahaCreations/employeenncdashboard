// Small bottom toast
export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(el._h);
  el._h = setTimeout(() => el.classList.remove("on"), 2600);
}
