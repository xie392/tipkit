/**
 * Status 节点的原生 DOM 编辑面板（无 React portal / 无第三方 UI 库）。
 * 只负责布局与交互逻辑；视觉样式全部在 themes/base.css 的 .tk-status-popover。
 * 文案由视图层 useT() 翻译后通过 labels 传入，本文件不出现自然语言硬编码。
 */

export interface StatusPopoverAttrs {
  text: string;
  color: string;
}

export interface StatusPopoverLabels {
  textPlaceholder: string;
  selectColor: string;
  delete: string;
}

export interface StatusPopoverOptions {
  /** 锚点元素（状态标签本身），用于定位 */
  anchor: HTMLElement;
  text: string;
  color: string;
  editable: boolean;
  /** 保存：点击色块立即保存；回车确认保存并关闭 */
  onSave: (attrs: StatusPopoverAttrs) => void;
  /** 删除按钮（仅在可编辑且提供回调时显示） */
  onDelete?: () => void;
  /** 面板关闭时回调（任意关闭方式都会触发） */
  onClose: () => void;
  /** 已翻译文案 */
  labels?: StatusPopoverLabels;
}

/** 6 种预设色板（唯一允许硬编码的视觉常量，其余视觉归主题） */
export const STATUS_PALETTE = [
  "#ffcccc",
  "#fff3cd",
  "#d1fadf",
  "#e5e7eb",
  "#dbeafe",
  "#f3e8ff",
];

const POPOVER_MARGIN = 6;

/**
 * 打开状态标签编辑面板（fixed 定位到 body，避开祖先 overflow/transform）。
 * 返回清理函数：移除监听并卸载面板。
 */
export function openStatusPopover(options: StatusPopoverOptions): () => void {
  const { anchor, text, color, editable, onSave, onDelete, onClose } = options;
  const labels = options.labels;

  let currentText = text;
  let selectedColor = color;

  const popover = document.createElement("div");
  popover.className = "tk-status-popover";
  popover.setAttribute("role", "dialog");

  /* ── 文本输入 ── */
  const input = document.createElement("input");
  input.className = "tk-status-input";
  input.type = "text";
  input.value = currentText;
  input.placeholder = labels?.textPlaceholder ?? "";
  if (!editable) input.disabled = true;

  /* ── 颜色色板 ── */
  const colors = document.createElement("div");
  colors.className = "tk-status-colors";
  const colorLabel = document.createElement("span");
  colorLabel.className = "tk-status-colors-label";
  colorLabel.textContent = labels?.selectColor ?? "";
  const swatches = document.createElement("div");
  swatches.className = "tk-status-swatches";
  colors.append(colorLabel, swatches);

  const swatchEls = STATUS_PALETTE.map((hex) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tk-status-swatch";
    btn.dataset.color = hex;
    btn.style.backgroundColor = hex;
    btn.setAttribute("aria-label", hex);
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      selectedColor = hex;
      syncSwatches();
      onSave({ text: currentText, color: hex });
    });
    swatches.appendChild(btn);
    return btn;
  });

  const syncSwatches = () => {
    for (const btn of swatchEls) {
      const isSelected = btn.dataset.color === selectedColor;
      btn.classList.toggle("is-selected", isSelected);
      btn.innerHTML = isSelected ? "✓" : "";
    }
  };
  syncSwatches();

  /* ── footer：删除按钮 ── */
  const footer = document.createElement("div");
  footer.className = "tk-status-popover-footer";
  if (editable && onDelete) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "tk-status-delete";
    del.textContent = labels?.delete ?? "";
    del.addEventListener("mousedown", (e) => e.preventDefault());
    del.addEventListener("click", () => {
      close();
      onDelete();
    });
    footer.appendChild(del);
  }

  const body = document.createElement("div");
  body.className = "tk-status-popover-body";
  body.append(input, colors);
  popover.append(body, footer);

  document.body.appendChild(popover);

  /* ── 定位：锚点下方，空间不足则上方，视口内夹紧 ── */
  const position = () => {
    const aRect = anchor.getBoundingClientRect();
    const pRect = popover.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = aRect.bottom + POPOVER_MARGIN;
    let below = true;
    if (top + pRect.height > vh - POPOVER_MARGIN) {
      const aboveTop = aRect.top - POPOVER_MARGIN - pRect.height;
      if (aboveTop >= POPOVER_MARGIN) {
        top = aboveTop;
        below = false;
      } else {
        top = Math.max(POPOVER_MARGIN, vh - POPOVER_MARGIN - pRect.height);
      }
    }
    const left = Math.max(
      POPOVER_MARGIN,
      Math.min(aRect.left, vw - POPOVER_MARGIN - pRect.width),
    );

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.classList.toggle("is-below", below);
    popover.classList.toggle("is-above", !below);
  };
  position();

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("mousedown", onDocMouseDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    popover.remove();
    onClose();
  };

  /* 点击面板外关闭（忽略面板内部点击） */
  const onDocMouseDown = (e: MouseEvent) => {
    if (popover.contains(e.target as Node)) return;
    close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter" && e.target === input) {
      e.preventDefault();
      close();
      onSave({ text: currentText, color: selectedColor });
    }
  };

  /* 面板内部 mousedown 停止冒泡：点击色块 / 按钮不会立即触发外部关闭或干扰编辑器焦点 */
  popover.addEventListener("mousedown", (e) => e.stopPropagation());

  input.addEventListener("input", () => {
    currentText = input.value;
  });

  document.addEventListener("mousedown", onDocMouseDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  requestAnimationFrame(() => input.focus());

  return close;
}
