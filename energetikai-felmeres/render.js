// Általános űrlap-megjelenítő: a schema.js-ben leírt mezőkből épít HTML mezőket,
// és minden változásnál elmenti az adatot.
"use strict";

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
  }
  (children || []).forEach((c) => c && node.appendChild(c));
  return node;
}

// Egy mezőcsoportot (fields) jelenít meg data objektumba kötve. onChange minden módosításnál hívódik.
function renderFieldGroup(fields, data, onChange) {
  const wrap = el("div", { class: "field-grid" });
  fields.forEach((field) => {
    const fieldWrap = el("div", { class: "field field-" + field.type });
    const labelText = field.label + (field.unit ? " (" + field.unit + ")" : "");
    const label = el("label", { text: labelText });
    fieldWrap.appendChild(label);

    if (field.type === "select") {
      const select = el("select");
      select.appendChild(el("option", { value: "", text: "— válassz —" }));
      field.options.forEach((opt) => {
        const o = el("option", { value: opt, text: opt });
        if (data[field.key] === opt) o.setAttribute("selected", "selected");
        select.appendChild(o);
      });
      select.value = data[field.key] || "";
      select.addEventListener("change", () => {
        data[field.key] = select.value;
        onChange();
      });
      fieldWrap.appendChild(select);
    } else if (field.type === "textarea") {
      const ta = el("textarea", { rows: "3" });
      ta.value = data[field.key] || "";
      ta.addEventListener("input", () => {
        data[field.key] = ta.value;
        onChange();
      });
      fieldWrap.appendChild(ta);
    } else if (field.type === "checkboxgroup") {
      const group = el("div", { class: "checkbox-group" });
      const current = Array.isArray(data[field.key]) ? data[field.key] : [];
      field.options.forEach((opt) => {
        const id = "cb_" + Math.random().toString(36).slice(2);
        const row = el("label", { class: "checkbox-row", for: id });
        const cb = el("input", { type: "checkbox", id });
        cb.checked = current.includes(opt);
        cb.addEventListener("change", () => {
          const arr = Array.isArray(data[field.key]) ? data[field.key].slice() : [];
          if (cb.checked) {
            if (!arr.includes(opt)) arr.push(opt);
          } else {
            const i = arr.indexOf(opt);
            if (i >= 0) arr.splice(i, 1);
          }
          data[field.key] = arr;
          onChange();
        });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(" " + opt));
        group.appendChild(row);
      });
      fieldWrap.appendChild(group);
    } else {
      const input = el("input", { type: field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "number" ? "number" : "text" });
      if (field.type === "number") {
        input.setAttribute("inputmode", "decimal");
        input.setAttribute("step", "any");
      }
      input.value = data[field.key] !== undefined && data[field.key] !== null ? data[field.key] : "";
      input.addEventListener("input", () => {
        data[field.key] = field.type === "number" ? (input.value === "" ? "" : Number(input.value)) : input.value;
        onChange();
      });
      fieldWrap.appendChild(input);
    }
    wrap.appendChild(fieldWrap);
  });
  return wrap;
}

// Ismételhető alegységek (pl. hőtermelők, hőleadók) megjelenítése kártyákként.
// options: { title, itemArray, fields, createItem, summaryFn, onChange, extraRenderer, addLabel }
function renderRepeatable(options) {
  const { title, itemArray, fields, createItem, summaryFn, onChange, extraRenderer, addLabel } = options;
  const section = el("div", { class: "repeatable-section" });
  section.appendChild(el("h4", { text: title }));
  const list = el("div", { class: "repeatable-list" });

  function redraw() {
    list.innerHTML = "";
    itemArray.forEach((item, index) => {
      const details = el("details", { class: "item-card", open: "" });
      const summary = el("summary", {
        text: (summaryFn ? summaryFn(item, index) : title + " #" + (index + 1)),
      });
      details.appendChild(summary);

      const body = el("div", { class: "item-card-body" });
      if (fields && fields.length) {
        body.appendChild(renderFieldGroup(fields, item, onChange));
      }
      if (extraRenderer) {
        body.appendChild(extraRenderer(item, index));
      }
      const delBtn = el("button", { class: "btn btn-danger btn-small", type: "button", text: "Törlés" });
      delBtn.addEventListener("click", () => {
        if (confirm("Biztosan törlöd ezt a tételt? (" + summary.textContent + ")")) {
          itemArray.splice(index, 1);
          onChange();
          redraw();
        }
      });
      body.appendChild(delBtn);
      details.appendChild(body);
      list.appendChild(details);
    });
  }
  redraw();
  section.appendChild(list);

  const addBtn = el("button", { class: "btn btn-add", type: "button", text: addLabel || ("+ Új hozzáadása") });
  addBtn.addEventListener("click", () => {
    itemArray.push(createItem());
    onChange();
    redraw();
  });
  section.appendChild(addBtn);
  return section;
}
