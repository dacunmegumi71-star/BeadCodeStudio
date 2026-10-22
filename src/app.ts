
export interface Bead {
  x: number;
  y: number;
  color: string;
}

export interface BoardData {
  width: number;
  height: number;
  beads: Bead[];
}

type Tool = "pencil" | "eraser" | "eyedropper";

interface HistoryEntry {
  board: BoardData;
}

interface ProjectFile {
  format: "BeadCodeStudio";
  version: 1;
  board: BoardData;
  code: string;
}

const DEFAULT_WIDTH = 29;
const DEFAULT_HEIGHT = 29;
const CELL_SIZE = 24;
const MAX_BOARD_SIZE = 200;
const MAX_CODE_LENGTH = 100_000;

const COLORS: Record<string, string> = {
  RED: "#e53935",
  BLUE: "#1e88e5",
  GREEN: "#43a047",
  YELLOW: "#fdd835",
  WHITE: "#ffffff",
  BLACK: "#212121",
  ORANGE: "#fb8c00",
  PINK: "#f48fb1",
  PURPLE: "#8e24aa",
  BROWN: "#795548",
  GRAY: "#9e9e9e",
  GREY: "#9e9e9e",
  CYAN: "#00acc1",
  LIME: "#c0ca33",
  NAVY: "#283593",
  GOLD: "#ffc107",
  TRANSPARENT: "",
};

const PALETTE = [
  "#e53935",
  "#fb8c00",
  "#fdd835",
  "#c0ca33",
  "#43a047",
  "#00acc1",
  "#1e88e5",
  "#283593",
  "#8e24aa",
  "#f48fb1",
  "#795548",
  "#9e9e9e",
  "#212121",
  "#ffffff",
];

const DEFAULT_CODE = `// BeadCode Studio
// 座標は左上が (0, 0) です。

BOARD(29, 29);

BEAD(14, 5, RED);
BEAD(13, 6, RED);
BEAD(14, 6, RED);
BEAD(15, 6, RED);

LINE(11, 10, 17, 10, BLUE);
RECT(12, 11, 5, 4, YELLOW);

RUN();
`;

function cloneBoard(board: BoardData): BoardData {
  return {
    width: board.width,
    height: board.height,
    beads: board.beads.map((bead) => ({ ...bead })),
  };
}

function isValidDimension(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_BOARD_SIZE
  );
}

function isValidColor(color: string): boolean {
  return (
    /^#[0-9a-fA-F]{6}$/.test(color) ||
    color === ""
  );
}

function normalizeColor(value: string): string {
  const name = value.trim().toUpperCase();

  if (Object.prototype.hasOwnProperty.call(COLORS, name)) {
    return COLORS[name];
  }

  if (/^#[0-9a-fA-F]{6}$/.test(name)) {
    return name.toLowerCase();
  }

  throw new Error(`不明な色です: ${value}`);
}

function validateBoard(board: BoardData): void {
  if (
    !isValidDimension(board.width) ||
    !isValidDimension(board.height)
  ) {
    throw new Error(
      `盤面の幅と高さは1〜${MAX_BOARD_SIZE}で指定してください。`,
    );
  }

  const seen = new Set<string>();

  for (const bead of board.beads) {
    if (
      !Number.isInteger(bead.x) ||
      !Number.isInteger(bead.y) ||
      bead.x < 0 ||
      bead.y < 0 ||
      bead.x >= board.width ||
      bead.y >= board.height
    ) {
      throw new Error("盤面の範囲外にビーズがあります。");
    }

    if (!isValidColor(bead.color) || bead.color === "") {
      throw new Error("ビーズの色データが不正です。");
    }

    const key = `${bead.x},${bead.y}`;

    if (seen.has(key)) {
      throw new Error("同じ座標に複数のビーズがあります。");
    }

    seen.add(key);
  }
}

function beadKey(x: number, y: number): string {
  return `${x},${y}`;
}

function setBead(
  board: BoardData,
  x: number,
  y: number,
  color: string,
): void {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= board.width ||
    y >= board.height
  ) {
    throw new Error(
      `座標 (${x}, ${y}) は盤面の範囲外です。`,
    );
  }

  const index = board.beads.findIndex(
    (bead) => bead.x === x && bead.y === y,
  );

  if (color === "") {
    if (index !== -1) board.beads.splice(index, 1);
    return;
  }

  if (index !== -1) {
    board.beads[index].color = color;
  } else {
    board.beads.push({ x, y, color });
  }
}

/**
 * 対応コマンド:
 * BOARD(width, height)
 * BEAD(x, y, color)
 * LINE(x1, y1, x2, y2, color)
 * RECT(x, y, width, height, color)
 * FILL(color)
 * FILL(x, y, width, height, color)
 * RUN()
 */
function executeCode(source: string): BoardData {
  if (source.length > MAX_CODE_LENGTH) {
    throw new Error("コードが長すぎます。");
  }

  let board: BoardData = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    beads: [],
  };

  let boardWasDeclared = false;
  const statements = source
    .split(/\r?\n/)
    .flatMap((line, lineIndex) => {
      const withoutComment = line.replace(/\/\/.*$/, "").trim();

      if (!withoutComment) return [];

      return [{
        text: withoutComment,
        line: lineIndex + 1,
      }];
    });

  for (const statement of statements) {
    const { text, line } = statement;

    try {
      const match = text.match(
        /^([A-Za-z_]\w*)\s*\((.*)\)\s*;?$/,
      );

      if (!match) {
        throw new Error(
          "コマンドの書き方が正しくありません。",
        );
      }

      const command = match[1].toUpperCase();
      const args = match[2]
        .split(",")
        .map((part) => part.trim());

      const numberArg = (index: number): number => {
        const value = args[index];

        if (value === undefined || value === "") {
          throw new Error("引数が不足しています。");
        }

        const number = Number(value);

        if (!Number.isInteger(number)) {
          throw new Error(
            `整数が必要です: ${value}`,
          );
        }

        return number;
      };

      const colorArg = (index: number): string => {
        const value = args[index];

        if (value === undefined || value === "") {
          throw new Error("色の指定がありません。");
        }

        return normalizeColor(value);
      };

      const checkCount = (count: number): void => {
        if (args.length !== count) {
          throw new Error(
            `引数は${count}個必要です。`,
          );
        }
      };

      switch (command) {
        case "BOARD": {
          checkCount(2);

          const width = numberArg(0);
          const height = numberArg(1);

          if (
            !isValidDimension(width) ||
            !isValidDimension(height)
          ) {
            throw new Error(
              `盤面は1〜${MAX_BOARD_SIZE}の範囲で指定してください。`,
            );
          }

          board = {
            width,
            height,
            beads: [],
          };

          boardWasDeclared = true;
          break;
        }

        case "BEAD": {
          checkCount(3);

          if (!boardWasDeclared) {
            // BOARDを省略した場合は初期サイズを使用します。
            boardWasDeclared = true;
          }

          setBead(
            board,
            numberArg(0),
            numberArg(1),
            colorArg(2),
          );
          break;
        }

        case "LINE": {
          checkCount(5);

          const x1 = numberArg(0);
          const y1 = numberArg(1);
          const x2 = numberArg(2);
          const y2 = numberArg(3);
          const color = colorArg(4);

          // Bresenham方式で直線上の座標を求めます。
          let x = x1;
          let y = y1;
          const dx = Math.abs(x2 - x1);
          const dy = Math.abs(y2 - y1);
          const sx = x1 < x2 ? 1 : -1;
          const sy = y1 < y2 ? 1 : -1;
          let error = dx - dy;
          let steps = 0;

          while (true) {
            setBead(board, x, y, color);

            if (x === x2 && y === y2) break;

            if (++steps > MAX_BOARD_SIZE * 2) {
              throw new Error("直線が長すぎます。");
            }

            const doubledError = 2 * error;

            if (doubledError > -dy) {
              error -= dy;
              x += sx;
            }

            if (doubledError < dx) {
              error += dx;
              y += sy;
            }
          }

          break;
        }

        case "RECT": {
          checkCount(5);

          const x = numberArg(0);
          const y = numberArg(1);
          const width = numberArg(2);
          const height = numberArg(3);
          const color = colorArg(4);

          if (width < 1 || height < 1) {
            throw new Error(
              "四角形の幅と高さは1以上にしてください。",
            );
          }

          if (width * height > MAX_BOARD_SIZE ** 2) {
            throw new Error("四角形が大きすぎます。");
          }

          for (let row = y; row < y + height; row++) {
            for (let col = x; col < x + width; col++) {
              setBead(board, col, row, color);
            }
          }

          break;
        }

        case "FILL": {
          if (args.length === 1) {
            const color = colorArg(0);

            board.beads = [];

            if (color !== "") {
              for (let y = 0; y < board.height; y++) {
                for (let x = 0; x < board.width; x++) {
                  board.beads.push({ x, y, color });
                }
              }
            }
          } else if (args.length === 5) {
            const x = numberArg(0);
            const y = numberArg(1);
            const width = numberArg(2);
            const height = numberArg(3);
            const color = colorArg(4);

            if (width < 1 || height < 1) {
              throw new Error(
                "塗りつぶしの幅と高さは1以上にしてください。",
              );
            }

            if (width * height > MAX_BOARD_SIZE ** 2) {
              throw new Error("塗りつぶし範囲が大きすぎます。");
            }

            for (let row = y; row < y + height; row++) {
              for (let col = x; col < x + width; col++) {
                setBead(board, col, row, color);
              }
            }
          } else {
            throw new Error(
              "FILLは1個または5個の引数を指定してください。",
            );
          }

          break;
        }

        case "RUN": {
          checkCount(0);
          break;
        }

        default:
          throw new Error(
            `未対応のコマンドです: ${command}`,
          );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "不明なエラーです。";

      throw new Error(`${line}行目: ${message}`);
    }
  }

  validateBoard(board);
  return board;
}

export class BeadCodeApp {
  private root: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private codeEditor!: HTMLTextAreaElement;
  private statusElement!: HTMLElement;
  private countElement!: HTMLElement;
  private colorElement!: HTMLElement;
  private widthInput!: HTMLInputElement;
  private heightInput!: HTMLInputElement;
  private fileInput!: HTMLInputElement;
  private selectedColor = "#e53935";
  private tool: Tool = "pencil";
  private board: BoardData = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    beads: [],
  };
  private history: HistoryEntry[] = [];
  private historyIndex = -1;
  private pointerDown = false;
  private lastPointerKey = "";
  private isReady = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.init();
  }

  private init(): void {
    this.renderLayout();

    const canvas = this.root.querySelector<HTMLCanvasElement>(
      "#bead-canvas",
    );
    const editor = this.root.querySelector<HTMLTextAreaElement>(
      "#bead-code",
    );
    const ctx = canvas?.getContext("2d");

    if (!canvas || !editor || !ctx) {
      throw new Error("画面の初期化に失敗しました。");
    }

    this.canvas = canvas;
    this.codeEditor = editor;
    this.ctx = ctx;

    this.statusElement = this.mustGet("#app-status");
    this.countElement = this.mustGet("#bead-count");
    this.colorElement = this.mustGet("#color-counts");
    this.widthInput = this.mustGet("#board-width");
    this.heightInput = this.mustGet("#board-height");
    this.fileInput = this.mustGet("#project-file");

    this.bindEvents();
    this.renderPalette();

    this.codeEditor.value = DEFAULT_CODE;
    this.resizeCanvas();
    this.pushHistory();
    this.renderBoard();
    this.updateStatistics();
    this.setStatus("準備完了");
    this.isReady = true;
  }

  private mustGet<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);

    if (!element) {
      throw new Error(`必要な要素が見つかりません: ${selector}`);
    }

    return element;
  }

  private renderLayout(): void {
    this.root.innerHTML = `
      <style>
        .bcs {
          color: #202124;
          font-family: system-ui, sans-serif;
          max-width: 1400px;
          margin: 0 auto;
          padding: 16px;
        }
        .bcs * { box-sizing: border-box; }
        .bcs button, .bcs input, .bcs textarea { font: inherit; }
        .bcs button {
          padding: 7px 11px;
          border: 1px solid #c7cbd1;
          border-radius: 7px;
          background: #fff;
          color: #202124;
          cursor: pointer;
        }
        .bcs button:hover { background: #edf2f7; }
        .bcs button:focus-visible,
        .bcs input:focus-visible,
        .bcs textarea:focus-visible {
          outline: 2px solid #2879df;
          outline-offset: 2px;
        }
        .bcs button:disabled { opacity: .45; cursor: not-allowed; }
        .bcs-header {
          display: flex; flex-wrap: wrap; align-items: center;
          justify-content: space-between; gap: 12px; margin-bottom: 16px;
        }
        .bcs-header h1 { font-size: 1.5rem; margin: 0; }
        .bcs-actions, .bcs-tools, .bcs-sizes {
          display: flex; flex-wrap: wrap; gap: 7px; align-items: center;
        }
        .bcs-workspace {
          display: grid;
          grid-template-columns: minmax(270px, 1fr) minmax(300px, 1fr);
          gap: 16px;
          align-items: start;
        }
        .bcs-panel {
          min-width: 0; border: 1px solid #d8dce2;
          border-radius: 10px; padding: 14px; background: #fff;
        }
        .bcs-panel h2 { font-size: 1.05rem; margin: 0 0 12px; }
        .bcs-label { display: block; font-size: .9rem; margin-bottom: 5px; }
        .bcs input[type="number"] {
          width: 76px; padding: 7px; border: 1px solid #c7cbd1;
          border-radius: 6px;
        }
        .bcs textarea {
          width: 100%; min-height: 300px; resize: vertical;
          padding: 12px; border: 1px solid #c7cbd1; border-radius: 8px;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 13px; line-height: 1.55; tab-size: 2;
        }
        .bcs-code-actions { display: flex; gap: 8px; margin: 10px 0; flex-wrap: wrap; }
        .bcs-primary { background: #1769d2 !important; color: #fff !important; border-color: #1769d2 !important; }
        .bcs-status { font-size: .9rem; min-height: 1.5em; overflow-wrap: anywhere; }
        .bcs-status[data-kind="error"] { color: #c62828; }
        .bcs-status[data-kind="success"] { color: #16803d; }
        .bcs-canvas-wrap {
          overflow: auto; max-height: 70vh; border: 1px solid #d8dce2;
          border-radius: 8px; background: #f4f6f8; padding: 8px;
        }
        .bcs canvas { display: block; max-width: none; touch-action: none; }
        .bcs-palette { display: flex; flex-wrap: wrap; gap: 7px; margin: 12px 0; }
        .bcs-swatch {
          width: 30px; height: 30px; padding: 0 !important;
          border: 2px solid #aeb4bc !important; border-radius: 50% !important;
        }
        .bcs-swatch[aria-pressed="true"] { outline: 3px solid #1769d2; outline-offset: 2px; }
        .bcs-small { font-size: .85rem; color: #5f6368; }
        .bcs-stats { margin-top: 12px; }
        .bcs-stats ul { margin: 6px 0; padding-left: 20px; }
        .bcs-footer { margin-top: 12px; font-size: .85rem; color: #5f6368; }
        .bcs-tool-active { outline: 2px solid #1769d2; }
        @media (max-width: 760px) {
          .bcs-workspace { grid-template-columns: 1fr; }
          .bcs { padding: 8px; }
        }
        @media print {
          .bcs-header, .bcs-editor-panel, .bcs-tools,
          .bcs-palette, .bcs-sizes, .bcs-footer { display: none !important; }
          .bcs-workspace { display: block; }
          .bcs-panel { border: 0; }
          .bcs-canvas-wrap { max-height: none; overflow: visible; }
        }
      </style>

      <div class="bcs">
        <header class="bcs-header">
          <h1>BeadCode Studio</h1>
          <div class="bcs-actions">
            <button type="button" id="new-project">新規</button>
            <button type="button" id="save-project">保存</button>
            <button type="button" id="load-project">読み込み</button>
            <button type="button" id="print-project">印刷</button>
            <input id="project-file" type="file" accept=".json,application/json" hidden>
          </div>
        </header>

        <div class="bcs-workspace">
          <section class="bcs-panel bcs-editor-panel">
            <h2>コードエディタ</h2>
            <label class="bcs-label" for="bead-code">
              図案コード
            </label>
            <textarea id="bead-code" spellcheck="false"
              aria-label="ビーズ図案のコード"></textarea>
            <div class="bcs-code-actions">
              <button type="button" class="bcs-primary" id="run-code">
                ▶ 実行
              </button>
              <button type="button" id="clear-code">コードを消去</button>
            </div>
            <p class="bcs-small">
              色は RED、BLUE、GREEN など、または #RRGGBB で指定できます。
              座標は左上が (0, 0) です。
            </p>
            <div id="app-status" class="bcs-status"
              role="status" aria-live="polite">起動中...</div>
          </section>

          <section class="bcs-panel">
            <h2>図案プレビュー</h2>

            <div class="bcs-sizes">
              <label>
                幅
                <input id="board-width" type="number" min="1" max="200"
                  value="${DEFAULT_WIDTH}">
              </label>
              <label>
                高さ
                <input id="board-height" type="number" min="1" max="200"
                  value="${DEFAULT_HEIGHT}">
              </label>
              <button type="button" id="apply-size">サイズ変更</button>
            </div>

            <div class="bcs-tools" style="margin:12px 0">
              <button type="button" data-tool="pencil" aria-pressed="true">
                ✏️ 描く
              </button>
              <button type="button" data-tool="eraser" aria-pressed="false">
                消しゴム
              </button>
              <button type="button" data-tool="eyedropper" aria-pressed="false">
                色を拾う
              </button>
              <button type="button" id="undo" disabled>↶ 戻す</button>
              <button type="button" id="redo" disabled>↷ やり直す</button>
            </div>

            <div class="bcs-palette" id="color-palette"
              aria-label="色パレット"></div>

            <div class="bcs-canvas-wrap">
              <canvas id="bead-canvas"
                aria-label="ビーズ図案。クリックまたはドラッグして編集できます。"></canvas>
            </div>

            <div class="bcs-stats">
              <strong>ビーズ合計: <span id="bead-count">0</span> 個</strong>
              <h3 style="font-size:.95rem">色別の個数</h3>
              <ul id="color-counts"></ul>
            </div>
          </section>
        </div>

        <p class="bcs-footer">
          BeadCode Studio · 2Dアイロンビーズ図案エディタ
        </p>
      </div>
    `;
  }

  private bindEvents(): void {
    this.mustGet("#run-code").addEventListener("click", () => {
      this.runCode();
    });

    this.mustGet("#clear-code").addEventListener("click", () => {
      this.codeEditor.value = "";
      this.setStatus("コードを消去しました。");
    });

    this.mustGet("#new-project").addEventListener("click", () => {
      if (
        !window.confirm(
          "現在の図案を破棄して新規作成しますか？",
        )
      ) {
        return;
      }

      this.board = {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        beads: [],
      };

      this.codeEditor.value = DEFAULT_CODE;
      this.widthInput.value = String(DEFAULT_WIDTH);
      this.heightInput.value = String(DEFAULT_HEIGHT);
      this.pushHistory();
      this.resizeCanvas();
      this.renderBoard();
      this.updateStatistics();
      this.setStatus("新しい図案を作成しました。", "success");
    });

    this.mustGet("#save-project").addEventListener("click", () => {
      this.saveProject();
    });

    this.mustGet("#load-project").addEventListener("click", () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener("change", () => {
      void this.loadProject();
    });

    this.mustGet("#print-project").addEventListener("click", () => {
      this.printProject();
    });

    this.mustGet("#apply-size").addEventListener("click", () => {
      this.applySize();
    });

    this.mustGet("#undo").addEventListener("click", () => {
      this.undo();
    });

    this.mustGet("#redo").addEventListener("click", () => {
      this.redo();
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-tool]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const tool = button.dataset.tool as Tool | undefined;

          if (
            tool === "pencil" ||
            tool === "eraser" ||
            tool === "eyedropper"
          ) {
            this.setTool(tool);
          }
        });
      });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.onPointerDown(event);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      this.onPointerMove(event);
    });

    this.canvas.addEventListener("pointerup", () => {
      this.pointerDown = false;
      this.lastPointerKey = "";
    });

    this.canvas.addEventListener("pointercancel", () => {
      this.pointerDown = false;
      this.lastPointerKey = "";
    });

    this.canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  }

  private renderPalette(): void {
    const palette = this.mustGet("#color-palette");
    palette.replaceChildren();

    for (const color of PALETTE) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bcs-swatch";
      button.style.backgroundColor = color;
      button.title = color;
      button.setAttribute(
        "aria-label",
        `色を選択 ${color}`,
      );
      button.setAttribute(
        "aria-pressed",
        String(color === this.selectedColor),
      );

      if (color === "#ffffff") {
        button.style.boxShadow = "inset 0 0 0 1px #ddd";
      }

      button.addEventListener("click", () => {
        this.selectedColor = color;
        this.setTool("pencil");
        this.renderPalette();
      });

      palette.append(button);
    }
  }

  private setTool(tool: Tool): void {
    this.tool = tool;

    this.root.querySelectorAll<HTMLButtonElement>("[data-tool]")
      .forEach((button) => {
        const active = button.dataset.tool === tool;

        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("bcs-tool-active", active);
      });
  }

  private runCode(): void {
    try {
      const nextBoard = executeCode(this.codeEditor.value);

      validateBoard(nextBoard);

      this.board = nextBoard;
      this.widthInput.value = String(this.board.width);
      this.heightInput.value = String(this.board.height);

      this.pushHistory();
      this.resizeCanvas();
      this.renderBoard();
      this.updateStatistics();
      this.setStatus("コードを実行しました。", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "不明なエラーです。";

      this.setStatus(message, "error");
    }
  }

  private applySize(): void {
    const width = Number(this.widthInput.value);
    const height = Number(this.heightInput.value);

    if (
      !isValidDimension(width) ||
      !isValidDimension(height)
    ) {
      this.setStatus(
        `幅と高さは1〜${MAX_BOARD_SIZE}の整数にしてください。`,
        "error",
      );
      return;
    }

    const nextBoard: BoardData = {
      width,
      height,
      beads: this.board.beads.filter(
        (bead) => bead.x < width && bead.y < height,
      ),
    };

    this.board = nextBoard;
    this.pushHistory();
    this.resizeCanvas();
    this.renderBoard();
    this.updateStatistics();
    this.setStatus("盤面サイズを変更しました。", "success");
  }

  private resizeCanvas(): void {
    this.canvas.width = this.board.width * CELL_SIZE;
    this.canvas.height = this.board.height * CELL_SIZE;
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
  }

  private renderBoard(): void {
    const { ctx, board } = this;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 盤面の背景とグリッド
    ctx.strokeStyle = "#d5d9df";
    ctx.lineWidth = 1;

    for (let x = 0; x <= board.width; x++) {
      const px = x * CELL_SIZE + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, this.canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= board.height; y++) {
      const py = y * CELL_SIZE + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(this.canvas.width, py);
      ctx.stroke();
    }

    // ビーズの描画
    for (const bead of board.beads) {
      const cx = bead.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = bead.y * CELL_SIZE + CELL_SIZE / 2;
      const radius = CELL_SIZE * 0.39;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = bead.color;
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ビーズ中央の穴
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_SIZE * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.stroke();
    }
  }

  private getCanvasCell(
    event: PointerEvent,
  ): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.floor(
      ((event.clientX - rect.left) / rect.width) *
        this.canvas.width /
        CELL_SIZE,
    );

    const y = Math.floor(
      ((event.clientY - rect.top) / rect.height) *
        this.canvas.height /
        CELL_SIZE,
    );

    if (
      x < 0 ||
      y < 0 ||
      x >= this.board.width ||
      y >= this.board.height
    ) {
      return null;
    }

    return { x, y };
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.isReady && this.history.length === 0) return;

    const cell = this.getCanvasCell(event);
    if (!cell) return;

    event.preventDefault();

    if (this.tool === "eyedropper") {
      const bead = this.board.beads.find(
        (item) => item.x === cell.x && item.y === cell.y,
      );

      if (bead) {
        this.selectedColor = bead.color;
        this.renderPalette();
        this.setTool("pencil");
        this.setStatus(`色を選択しました: ${bead.color}`);
      } else {
        this.setStatus("この位置にはビーズがありません。");
      }

      return;
    }

    this.pointerDown = true;
    this.lastPointerKey = "";
    this.canvas.setPointerCapture(event.pointerId);
    this.paintCell(cell.x, cell.y);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.pointerDown) return;

    const cell = this.getCanvasCell(event);
    if (!cell) return;

    this.paintCell(cell.x, cell.y);
  }

  private paintCell(x: number, y: number): void {
    const key = beadKey(x, y);

    if (key === this.lastPointerKey) return;
    this.lastPointerKey = key;

    const color = this.tool === "eraser" ? "" : this.selectedColor;
    const previous = this.board.beads.find(
      (bead) => bead.x === x && bead.y === y,
    );

    if (
      (color === "" && !previous) ||
      (color !== "" && previous?.color === color)
    ) {
      return;
    }

    setBead(this.board, x, y, color);
    this.renderBoard();
    this.updateStatistics();
    this.setStatus(`座標 (${x}, ${y}) を編集しました。`);
  }

  private pushHistory(): void {
    const snapshot = cloneBoard(this.board);
    const current = this.history[this.historyIndex];

    if (
      current &&
      JSON.stringify(current.board) === JSON.stringify(snapshot)
    ) {
      this.updateHistoryButtons();
      return;
    }

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push({ board: snapshot });

    // 履歴が増えすぎないように上限を設定
    if (this.history.length > 100) {
      this.history.shift();
    }

    this.historyIndex = this.history.length - 1;
    this.updateHistoryButtons();
  }

  private undo(): void {
    if (this.historyIndex <= 0) return;

    this.historyIndex--;
    this.restoreHistory();
    this.setStatus("ひとつ前の状態に戻しました。");
  }

  private redo(): void {
    if (this.historyIndex >= this.history.length - 1) return;

    this.historyIndex++;
    this.restoreHistory();
    this.setStatus("操作をやり直しました。");
  }

  private restoreHistory(): void {
    const entry = this.history[this.historyIndex];
    if (!entry) return;

    this.board = cloneBoard(entry.board);
    this.widthInput.value = String(this.board.width);
    this.heightInput.value = String(this.board.height);

    this.resizeCanvas();
    this.renderBoard();
    this.updateStatistics();
    this.updateHistoryButtons();
  }

  private updateHistoryButtons(): void {
    const undo = this.root.querySelector<HTMLButtonElement>("#undo");
    const redo = this.root.querySelector<HTMLButtonElement>("#redo");

    if (undo) undo.disabled = this.historyIndex <= 0;
    if (redo) {
      redo.disabled =
        this.historyIndex >= this.history.length - 1;
    }
  }

  private updateStatistics(): void {
    this.countElement.textContent = String(this.board.beads.length);

    const counts = new Map<string, number>();

    for (const bead of this.board.beads) {
      counts.set(
        bead.color,
        (counts.get(bead.color) ?? 0) + 1,
      );
    }

    this.colorElement.replaceChildren();

    const sorted = [...counts.entries()].sort(
      (a, b) => b[1] - a[1],
    );

    if (sorted.length === 0) {
      const item = document.createElement("li");
      item.textContent = "まだビーズがありません。";
      this.colorElement.append(item);
      return;
    }

    for (const [color, count] of sorted) {
      const item = document.createElement("li");
      const swatch = document.createElement("span");

      swatch.style.display = "inline-block";
      swatch.style.width = "12px";
      swatch.style.height = "12px";
      swatch.style.marginRight = "6px";
      swatch.style.border = "1px solid #999";
      swatch.style.backgroundColor = color;

      item.append(swatch);
      item.append(
        document.createTextNode(`${color}: ${count}個`),
      );

      this.colorElement.append(item);
    }
  }

  private saveProject(): void {
    const project: ProjectFile = {
      format: "BeadCodeStudio",
      version: 1,
      board: cloneBoard(this.board),
      code: this.codeEditor.value,
    };

    const blob = new Blob(
      [JSON.stringify(project, null, 2)],
      { type: "application/json;charset=utf-8" },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "bead-project.json";
    link.click();

    URL.revokeObjectURL(url);
    this.setStatus("図案をJSONファイルに保存しました。", "success");
  }

  private async loadProject(): Promise<void> {
    const file = this.fileInput.files?.[0];

    if (!file) return;

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("ファイルが大きすぎます（上限10MB）。");
      }

      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("format" in parsed) ||
        !("version" in parsed) ||
        !("board" in parsed) ||
        !("code" in parsed)
      ) {
        throw new Error("プロジェクトファイルの形式が違います。");
      }

      const project = parsed as ProjectFile;

      if (
        project.format !== "BeadCodeStudio" ||
        project.version !== 1
      ) {
        throw new Error("未対応のプロジェクト形式です。");
      }

      if (
        typeof project.code !== "string" ||
        project.code.length > MAX_CODE_LENGTH
      ) {
        throw new Error("コードデータが不正です。");
      }

      const rawBoard = project.board as BoardData;

      if (
        !rawBoard ||
        !Array.isArray(rawBoard.beads) ||
        rawBoard.beads.length > MAX_BOARD_SIZE ** 2
      ) {
        throw new Error("盤面データが不正です。");
      }

      const nextBoard: BoardData = {
        width: rawBoard.width,
        height: rawBoard.height,
        beads: rawBoard.beads.map((bead) => ({
          x: bead.x,
          y: bead.y,
          color: bead.color,
        })),
      };

      validateBoard(nextBoard);

      this.board = nextBoard;
      this.codeEditor.value = project.code;
      this.widthInput.value = String(nextBoard.width);
      this.heightInput.value = String(nextBoard.height);

      this.pushHistory();
      this.resizeCanvas();
      this.renderBoard();
      this.updateStatistics();
      this.setStatus("図案を読み込みました。", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "読み込みに失敗しました。";

      this.setStatus(message, "error");
    } finally {
      this.fileInput.value = "";
    }
  }

  private printProject(): void {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      this.setStatus(
        "印刷画面を開けません。ポップアップを許可してください。",
        "error",
      );
      return;
    }

    const image = this.canvas.toDataURL("image/png");

    const counts = new Map<string, number>();

    for (const bead of this.board.beads) {
      counts.set(
        bead.color,
        (counts.get(bead.color) ?? 0) + 1,
      );
    }

    const rows = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([color, count]) => {
        return `<tr>
          <td><span class="swatch" style="background:${color}"></span>${color}</td>
          <td>${count}</td>
        </tr>`;
      })
      .join("");

    const doc = printWindow.document;
    doc.open();
    doc.write(`<!doctype html>
      <html lang="ja">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>BeadCode Studio - 印刷</title>
        <style>
          body { font-family: sans-serif; margin: 16mm; color: #222; }
          h1 { font-size: 20px; }
          .info { margin-bottom: 16px; }
          img { display: block; max-width: 100%; height: auto; image-rendering: pixelated; }
          table { border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #888; padding: 6px 12px; text-align: left; }
          .swatch { display:inline-block; width:12px; height:12px; border:1px solid #777; margin-right:6px; }
          @media print { body { margin: 8mm; } img { max-height: 210mm; object-fit: contain; } }
        </style>
      </head>
      <body>
        <h1>BeadCode Studio 図案</h1>
        <p class="info">盤面サイズ: ${this.board.width} × ${this.board.height}
          ／ ビーズ合計: ${this.board.beads.length}個</p>
        <img src="${image}" alt="アイロンビーズ図案">
        <h2>色別の個数</h2>
        <table>
          <thead><tr><th>色</th><th>個数</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2">ビーズなし</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>`);
    doc.close();

    this.setStatus("印刷画面を開きました。", "success");
  }

  private setStatus(
    message: string,
    kind: "normal" | "success" | "error" = "normal",
  ): void {
    this.statusElement.textContent = message;
    this.statusElement.dataset.kind = kind;
  }
}

export function createApp(root: HTMLElement): BeadCodeApp {
  return new BeadCodeApp(root);
}
