// glyph-tester.js
(() => {
  class GlyphTester {
    constructor(rootEl) {
      this.rootEl = rootEl;

      // Default font family from data attribute (fallback)
      this.defaultFontFamily =
        rootEl.dataset.cssFontFamily || "system-ui, sans-serif";

      // NOTE: controls live outside .glyph-tester in the HTML,
      // so we query the document instead of rootEl
      this.fontSelect = document.querySelector(".glyph-font-select");
      this.modeSelect = document.querySelector(".glyph-mode-select");

      this.viewerCharEl = rootEl.querySelector(".glyph-viewer-char");
      this.viewerCodeEl = rootEl.querySelector(".glyph-viewer-code");
      this.groupEls = Array.from(rootEl.querySelectorAll(".glyph-group"));

      // Current state (family + axes)
      this.currentFontFamily = this.getSelectedFontFamily();
      this.currentWeight = this.getSelectedWeight();
      this.currentMode = this.getSelectedMode();
      this.currentActiveCell = null;

      this.buildGlyphGrids();
      this.bindFontSelect();
      this.bindModeSelect();
      this.applyFontStyles();
      this.initDefaultGlyph();
    }

    // --- helpers to read selects ---

    getSelectedFontFamily() {
      if (!this.fontSelect) return this.defaultFontFamily;
      const opt = this.fontSelect.selectedOptions[0];
      if (!opt) return this.defaultFontFamily;
      return opt.dataset.font || opt.value || this.defaultFontFamily;
    }

    getSelectedWeight() {
      if (!this.fontSelect) return 400;
      const opt = this.fontSelect.selectedOptions[0];
      if (!opt) return 400;
      const raw = opt.dataset.wght || opt.dataset.weight;
      const w = parseFloat(raw);
      return Number.isFinite(w) ? w : 400;
    }

    getSelectedMode() {
      if (!this.modeSelect) return 0;
      const raw =
        this.modeSelect.value ||
        (this.modeSelect.selectedOptions[0] &&
          this.modeSelect.selectedOptions[0].dataset.mode);
      const m = parseFloat(raw);
      return Number.isFinite(m) ? m : 0;
    }

    // --- binding ---

    bindFontSelect() {
      if (!this.fontSelect) return;

      this.fontSelect.addEventListener("change", () => {
        this.currentFontFamily = this.getSelectedFontFamily();
        this.currentWeight = this.getSelectedWeight(); // keep MODE as-is
        this.applyFontStyles();
      });
    }

    bindModeSelect() {
      if (!this.modeSelect) return;

      this.modeSelect.addEventListener("change", () => {
        this.currentMode = this.getSelectedMode(); // keep weight as-is
        this.applyFontStyles();
      });
    }

    // --- applying style ---

    applyFontStyles() {
      const family = this.currentFontFamily || this.defaultFontFamily;
      const wght = this.currentWeight ?? 400;
      const mode = this.currentMode ?? 0;

      const variation = `"wght" ${wght}, "MODE" ${mode}`;

      // Left big glyph
      if (this.viewerCharEl) {
        this.viewerCharEl.style.fontFamily = family;
        this.viewerCharEl.style.fontVariationSettings = variation;
      }

      // All glyph cells
      this.rootEl.querySelectorAll(".glyph-cell").forEach((cell) => {
        cell.style.fontFamily = family;
        cell.style.fontVariationSettings = variation;
      });
    }

    // --- build glyph grid from data-chars ---

    buildGlyphGrids() {
      this.groupEls.forEach((groupEl) => {
        const labelText = groupEl.dataset.label || "";
        const chars = groupEl.dataset.chars || "";

        // Clear any existing content
        groupEl.innerHTML = "";

        // Label
        if (labelText) {
          const label = document.createElement("div");
          label.className = "glyph-group-label";
          label.textContent = labelText;
          groupEl.appendChild(label);
        }

        // Grid container
        const grid = document.createElement("div");
        grid.className = "glyph-grid";
        groupEl.appendChild(grid);

        // Each character -> a tile
        for (const ch of chars) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "glyph-cell";
          cell.textContent = ch;

          cell.addEventListener("click", () => {
            this.setActiveGlyph(cell, ch);
          });

          grid.appendChild(cell);
        }
      });
    }

    // --- selection + viewer ---

    initDefaultGlyph() {
      const firstCell = this.rootEl.querySelector(".glyph-cell");
      if (!firstCell) return;

      const ch = firstCell.textContent || "A";
      this.setActiveGlyph(firstCell, ch);
    }

    setActiveGlyph(cell, ch) {
      // Update active styling
      if (this.currentActiveCell) {
        this.currentActiveCell.classList.remove("glyph-cell--active");
      }
      this.currentActiveCell = cell;
      this.currentActiveCell.classList.add("glyph-cell--active");

      // Update viewer glyph
      if (this.viewerCharEl) {
        this.viewerCharEl.textContent = ch;
      }

      // Update codepoint label (U+XXXX)
      if (this.viewerCodeEl) {
        const code = ch.codePointAt(0);
        const hex = code.toString(16).toUpperCase().padStart(4, "0");
        this.viewerCodeEl.textContent = `U+${hex}`;
      }

      // Ensure style is applied (in case you add dynamic stuff later)
      this.applyFontStyles();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document
      .querySelectorAll(".glyph-tester")
      .forEach((el) => new GlyphTester(el));
  });
})();
