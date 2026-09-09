(function () {
  const form = document.getElementById("policy-search-form");
  const input = document.getElementById("policy-search-input");
  const status = document.getElementById("policy-search-status");
  const prevBtn = document.getElementById("policy-search-prev");
  const nextBtn = document.getElementById("policy-search-next");
  const clearBtn = document.getElementById("policy-search-clear");
  const article = document.querySelector(".policy-document");

  if (!form || !input || !article) return;

  let marks = [];
  let current = -1;

  function clearHighlights() {
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    marks = [];
    current = -1;
    updateStatus();
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlight(query) {
    clearHighlights();
    const q = query.trim();
    if (!q) return;

    const re = new RegExp(escapeRegExp(q), "gi");
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (!re.test(node.nodeValue)) continue;
      re.lastIndex = 0;
      textNodes.push(node);
    }

    textNodes.forEach((node) => {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0;
      let match;
      re.lastIndex = 0;
      while ((match = re.exec(text)) !== null) {
        if (match.index > last) {
          frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        }
        const mark = document.createElement("mark");
        mark.className = "policy-search-hit";
        mark.textContent = match[0];
        frag.appendChild(mark);
        marks.push(mark);
        last = match.index + match[0].length;
      }
      if (last < text.length) {
        frag.appendChild(document.createTextNode(text.slice(last)));
      }
      node.parentNode.replaceChild(frag, node);
    });

    if (marks.length) {
      current = 0;
      focusCurrent();
    }
    updateStatus();
  }

  function focusCurrent() {
    marks.forEach((m) => m.classList.remove("is-current"));
    if (current < 0 || !marks[current]) return;
    const mark = marks[current];
    mark.classList.add("is-current");
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function updateStatus() {
    if (!status) return;
    if (!marks.length) {
      status.textContent = input.value.trim() ? "No matches" : "";
    } else {
      status.textContent = `${current + 1} of ${marks.length}`;
    }
    if (prevBtn) prevBtn.disabled = marks.length < 2;
    if (nextBtn) nextBtn.disabled = marks.length < 2;
  }

  function step(delta) {
    if (!marks.length) return;
    current = (current + delta + marks.length) % marks.length;
    focusCurrent();
    updateStatus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    highlight(input.value);
  });

  input.addEventListener("input", () => {
    if (!input.value.trim()) clearHighlights();
  });

  if (nextBtn) nextBtn.addEventListener("click", () => step(1));
  if (prevBtn) prevBtn.addEventListener("click", () => step(-1));
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      clearHighlights();
      input.focus();
    });
  }

  updateStatus();
})();
