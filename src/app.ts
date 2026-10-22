
/**
 * BeadCode Studio
 * File: src/app.ts
 *
 * アイロンビーズ設計図エディタのアプリケーション本体
 * 2D専用・ブラウザ動作
 */

export type BeadColor = string;

export interface Bead {
  x: number;
  y: number;
  color: BeadColor;
}

export interface BoardData {
  width: number;
  height: number;
  beads: Bead[];
}

type ToolName = "pencil" | "eraser" | "eyedropper";

const DEFAULT_WIDTH = 16;
const DEFAULT_HEIGHT = 16;

const COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF0000",
  "#FF8C00",
  "#FFD700",
  "#00AA00",
  "#00BFFF",
  "#0000FF",
  "#8A2BE2",
  "#FF69B4",
  "#A0522D",
  "#808080",
];

const DEFAULT_CODE = `BOARD(16, 16);

BEAD(6, 5, RED);
BEAD(7, 5, RED);
BEAD(8, 5, RED);

BEAD(5, 6, PINK);
BEAD(6, 6, RED);
BEAD(7, 6, RED);
BEAD(8, 6, RED);
BEAD(9, 6, PINK);

RUN();`;

export class BeadCodeApp {
  private root: HTMLElement;

  private board: BoardData = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    beads: [],
  };

  private selectedColor = "#FF0000";
  private activeTool: ToolName = "pencil";
  private isPointerDown = false;
  private lastPointerCell = "";
  private hasUnsavedChanges = false;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private editor!: HTMLTextAreaElement;
  private status!: HTMLElement;
  private statistics!: HTMLElement;
  private colorPalette!: HTMLElement;
  private boardSizeLabel!: HTMLElement;

  private readonly cellSize = 24;
  private readonly padding = 20;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /**
   * アプリを初期化する
   */
  public init(): void {
    this.renderLayout();
    this.cacheElements();
    this.bindEvents();
    this.createPalette();
    this.loadDefaultCode();
    this.renderBoard();
    this.updateStatistics();
    this.setStatus("準備完了");
  }

  /**
   * アプリの基本レイアウト
   */
  private renderLayout(): void {
    this.root.innerHTML = `
      <main class="bead-app">
        <header class="app-header">
          <div class="app-brand">
            <span class="brand-icon">◉</span>
            <div>
              <h1>BeadCode Studio</h1>
              <p>アイロンビーズ設計図エディタ</p>
            </div>
          </div>

          <div class="header-actions">
            <button type="button" data-action="new">
              新規作成
            </button>
            <button type="button" data-action="save">
              保存
            </button>
            <button type="button" data-action="load">
              読み込み
            </button>
            <button type="button" data-action="print">
              印刷 / PDF
            </button>
          </div>
        </header>

        <section class="toolbar">
          <button type="button" data-tool="pencil">
            ✏️ ペン
          </button>
          <button type="button" data-tool="eraser">
            ◻ 消しゴム
          </button>
          <button type="button" data-tool="eyedropper">
            🎨 色取得
          </button>

          <span class="toolbar-divider"></span>

          <button type="button" data-action="undo">
            元に戻す
          </button>
          <button type="button" data-action="redo">
            やり直す
          </button>

          <label class="board-size-control">
            幅
            <input
              type="number"
              id="board-width"
              min="1"
              max="200"
              value="${DEFAULT_WIDTH}"
            />

            高さ
            <input
              type="number"
              id="board-height"
              min="1"
              max="200"
              value="${DEFAULT_HEIGHT}"
            />

            <button type="button" data-action="resize">
              サイズ変更
            </button>
          </label>
        </section>

        <section class="workspace">
          <section class="editor-panel">
            <div class="panel-heading">
              <h2>コードエディタ</h2>
              <button type="button" data-action="run">
                ▶ 実行
              </button>
            </div>

            <textarea
              id="bead-code"
              spellcheck="false"
              aria-label="BeadCodeコードエディタ"
              placeholder="ここに設計図コードを入力してください"
            ></textarea>

            <div class="editor-footer">
              <span>BeadCode</span>
              <span id="code-status">未実行</span>
            </div>
          </section>

          <section class="preview-panel">
            <div class="panel-heading">
              <h2>設計図プレビュー</h2>
              <span id="board-size-label"></span>
            </div>

            <div class="board-scroll">
              <canvas
                id="bead-canvas"
                aria-label="アイロンビーズ設計図"
                role="img"
              ></canvas>
            </div>

            <div class="board-legend">
              <span>座標原点：左上 (0, 0)</span>
              <span>X：右方向 / Y：下方向</span>
            </div>
          </section>

          <aside class="settings-panel">
            <section>
              <h2>色パレット</h2>
              <div id="color-palette"></div>
              <div class="selected-color">
                選択色：
                <span id="selected-color-preview"></span>
                <code id="selected-color-value"></code>
              </div>

              <label>
                カスタムカラー
                <input
                  id="custom-color"
                  type="color"
                  value="#FF0000"
                />
              </label>
            </section>

            <section>
              <h2>ビーズ集計</h2>
              <div id="bead-statistics"></div>
            </section>

            <section>
              <h2>操作</h2>
              <p>
                ペン：マスにビーズを置く
              </p>
              <p>
                消しゴム：ビーズを消す
              </p>
              <p>
                色取得：配置済みビーズの色を選択
              </p>
            </section>
          </aside>
        </section>

        <footer class="app-footer">
          <span id="app-status" role="status">
            初期化中...
          </span>
          <span>BeadCode Studio</span>
        </footer>

        <input
          type="file"
          id="project-file"
          accept=".json,application/json"
          hidden
        />
      </main>
    `;
  }

  /**
   * DOM要素を取得する
   */
  private cacheElements(): void {
    this.canvas = this.requireElement<HTMLCanvasElement>(
      "#bead-canvas",
    );

    const context = this.canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas 2Dを初期化できません。");
    }

    this.ctx = context;

    this.editor =
      this.requireElement<HTMLTextAreaElement>("#bead-code");

    this.status = this.requireElement<HTMLElement>("#app-status");

    this.statistics =
      this.requireElement<HTMLElement>("#bead-statistics");

    this.colorPalette =
      this.requireElement<HTMLElement>("#color-palette");

    this.boardSizeLabel =
      this.requireElement<HTMLElement>("#board-size-label");
  }

  private requireElement<T extends HTMLElement>(
    selector: string,
  ): T {
    const element = this.root.querySelector<T>(selector);

    if (!element) {
      throw new Error(`必要な要素が見つかりません: ${selector}`);
    }

    return element;
  }

  /**
   * イベント登録
   */
  private bindEvents(): void {
    this.root.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const actionButton =
        target.closest<HTMLButtonElement>("[data-action]");

      if (actionButton) {
        this.handleAction(actionButton.dataset.action ?? "");
        return;
      }

      const toolButton =
        target.closest<HTMLButtonElement>("[data-tool]");

      if (toolButton) {
        const tool = toolButton.dataset.tool;

        if (
          tool === "pencil" ||
          tool === "eraser" ||
          tool === "eyedropper"
        ) {
          this.activeTool = tool;
          this.updateToolButtons();
          this.setStatus(`ツール変更：${tool}`);
        }
      }
    });

    this.colorPalette.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest<HTMLButtonElement>(
        "[data-color]",
      );

      if (button?.dataset.color) {
        this.selectColor(button.dataset.color);
      }
    });

    const customColor =
      this.requireElement<HTMLInputElement>("#custom-color");

    customColor.addEventListener("input", () => {
      this.selectColor(customColor.value);
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.isPointerDown = true;
      this.canvas.setPointerCapture(event.pointerId);
      this.applyPointer(event);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (this.isPointerDown && this.activeTool === "pencil") {
        this.applyPointer(event);
      }
    });

    this.canvas.addEventListener("pointerup", () => {
      this.isPointerDown = false;
      this.lastPointerCell = "";
    });

    this.canvas.addEventListener("pointercancel", () => {
      this.isPointerDown = false;
      this.lastPointerCell = "";
    });

    this.editor.addEventListener("input", () => {
      this.hasUnsavedChanges = true;
      this.setCodeStatus("未実行・変更あり");
    });

    this.editor.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;

        this.editor.setRangeText(
          "  ",
          start,
          end,
          "end",
        );
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        this.runCode();
      }
    });

    const fileInput =
      this.requireElement<HTMLInputElement>("#project-file");

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];

      if (file) {
        await this.loadProjectFile(file);
      }

      fileInput.value = "";
    });

    this.updateToolButtons();
  }

  /**
   * ツールバーの操作
   */
  private handleAction(action: string): void {
    switch (action) {
      case "run":
        this.runCode();
        break;

      case "new":
        this.newProject();
        break;

      case "save":
        this.saveProject();
        break;

      case "load":
        this.requireElement<HTMLInputElement>(
          "#project-file",
        ).click();
        break;

      case "print":
        this.printDesign();
        break;

      case "resize":
        this.resizeBoardFromInputs();
        break;

      case "undo":
        this.setStatus(
          "元に戻す機能は履歴管理モジュールとの接続後に有効になります。",
        );
        break;

      case "redo":
        this.setStatus(
          "やり直し機能は履歴管理モジュールとの接続後に有効になります。",
        );
        break;

      default:
        this.setStatus(`不明な操作：${action}`);
    }
  }

  /**
   * 初期コードを設定
   */
  private loadDefaultCode(): void {
    this.editor.value = DEFAULT_CODE;
  }

  /**
   * 独自コードを実行
   *
   * 注意：
   * この基本版では独自言語の最小構文だけを解析する。
   * JavaScriptのeval()は使用しない。
   */
  public runCode(): void {
    try {
      const result = this.parseCode(this.editor.value);

      this.board = result;
      this.renderBoard();
      this.updateStatistics();

      this.hasUnsavedChanges = true;
      this.setCodeStatus("実行成功");
      this.setStatus("設計図を生成しました。");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      this.setCodeStatus("エラー");
      this.setStatus(`コードエラー：${message}`);
    }
  }

  /**
   * BeadCodeの基本パーサー
   *
   * 対応命令：
   * BOARD(width, height);
   * BEAD(x, y, COLOR);
   * RUN();
   */
  private parseCode(source: string): BoardData {
    let width = DEFAULT_WIDTH;
    let height = DEFAULT_HEIGHT;

    const beads = new Map<string, Bead>();

    const lines = source.split(/\r?\n/);

    for (let index = 0; index < lines.length; index++) {
      const rawLine = lines[index];
      const line = rawLine.replace(/\/\/.*$/, "").trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      if (/^RUN\s*\(\s*\)\s*;?$/.test(line)) {
        continue;
      }

      const boardMatch = line.match(
        /^BOARD\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?$/,
      );

      if (boardMatch) {
        width = Number(boardMatch[1]);
        height = Number(boardMatch[2]);

        this.validateBoardSize(width, height);
        continue;
      }

      const beadMatch = line.match(
        /^BEAD\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([A-Z][A-Z0-9_-]*|#[0-9A-Fa-f]{6})\s*\)\s*;?$/,
      );

      if (beadMatch) {
        const x = Number(beadMatch[1]);
        const y = Number(beadMatch[2]);
        const colorName = beadMatch[3];

        const color = this.resolveColor(colorName);

        if (x < 0 || y < 0 || x >= width || y >= height) {
          throw new Error(
            `${index + 1}行目：座標 (${x}, ${y}) が盤面の範囲外です。`,
          );
        }

        beads.set(`${x},${y}`, { x, y, color });
        continue;
      }

      throw new Error(
        `${index + 1}行目：認識できない命令です。`,
      );
    }

    return {
      width,
      height,
      beads: Array.from(beads.values()),
    };
  }

  private validateBoardSize(
    width: number,
    height: number,
  ): void {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 200 ||
      height > 200
    ) {
      throw new Error(
        "盤面の幅と高さは1～200の整数で指定してください。",
      );
    }
  }

  private resolveColor(name: string): string {
    if (/^#[0-9A-Fa-f]{6}$/.test(name)) {
      return name.toUpperCase();
    }

    const namedColors: Record<string, string> = {
      RED: "#FF0000",
      BLUE: "#0000FF",
      GREEN: "#00AA00",
      YELLOW: "#FFD700",
      WHITE: "#FFFFFF",
      BLACK: "#000000",
      ORANGE: "#FF8C00",
      PINK: "#FF69B4",
      PURPLE: "#8A2BE2",
      BROWN: "#A0522D",
      GRAY: "#808080",
      GREY: "#808080",
      CYAN: "#00BFFF",
    };

    const color = namedColors[name];

    if (!color) {
      throw new Error(`未対応の色です：${name}`);
    }

    return color;
  }

  /**
   * Canvasの描画
   */
  private renderBoard(): void {
    const { width, height, beads } = this.board;

    const boardWidth = width * this.cellSize;
    const boardHeight = height * this.cellSize;

    const dpr = Math.max(
      1,
      Math.min(window.devicePixelRatio || 1, 2),
    );

    this.canvas.width = Math.ceil(
      (boardWidth + this.padding * 2) * dpr,
    );

    this.canvas.height = Math.ceil(
      (boardHeight + this.padding * 2) * dpr,
    );

    this.canvas.style.width =
      `${boardWidth + this.padding * 2}px`;

    this.canvas.style.height =
      `${boardHeight + this.padding * 2}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.ctx.clearRect(
      0,
      0,
      boardWidth + this.padding * 2,
      boardHeight + this.padding * 2,
    );

    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.fillRect(
      this.padding,
      this.padding,
      boardWidth,
      boardHeight,
    );

    this.ctx.strokeStyle = "#D4D4D4";
    this.ctx.lineWidth = 0.7;

    for (let x = 0; x <= width; x++) {
      const px = this.padding + x * this.cellSize;

      this.ctx.beginPath();
      this.ctx.moveTo(px, this.padding);
      this.ctx.lineTo(px, this.padding + boardHeight);
      this.ctx.stroke();
    }

    for (let y = 0; y <= height; y++) {
      const py = this.padding + y * this.cellSize;

      this.ctx.beginPath();
      this.ctx.moveTo(this.padding, py);
      this.ctx.lineTo(this.padding + boardWidth, py);
      this.ctx.stroke();
    }

    for (const bead of beads) {
      const centerX =
        this.padding + bead.x * this.cellSize +
        this.cellSize / 2;

      const centerY =
        this.padding + bead.y * this.cellSize +
        this.cellSize / 2;

      this.ctx.beginPath();
      this.ctx.arc(
        centerX,
        centerY,
        this.cellSize * 0.39,
        0,
        Math.PI * 2,
      );

      this.ctx.fillStyle = bead.color;
      this.ctx.fill();

      this.ctx.strokeStyle = "#555555";
      this.ctx.lineWidth = 0.6;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(
        centerX,
        centerY,
        this.cellSize * 0.12,
        0,
        Math.PI * 2,
      );

      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.fill();
    }

    this.boardSizeLabel.textContent =
      `${width} × ${height} / ${beads.length}個`;
  }

  /**
   * マウス・タッチでの編集
   */
  private applyPointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();

    const x = Math.floor(
      (event.clientX - rect.left - this.padding) /
      this.cellSize,
    );

    const y = Math.floor(
      (event.clientY - rect.top - this.padding) /
      this.cellSize,
    );

    if (
      x < 0 ||
      y < 0 ||
      x >= this.board.width ||
      y >= this.board.height
    ) {
      return;
    }

    const key = `${x},${y}`;

    if (key === this.lastPointerCell) {
      return;
    }

    this.lastPointerCell = key;

    const existing = this.board.beads.find(
      (bead) => bead.x === x && bead.y === y,
    );

    if (this.activeTool === "eyedropper") {
      if (existing) {
        this.selectColor(existing.color);
      }
      return;
    }

    if (this.activeTool === "eraser") {
      this.board.beads = this.board.beads.filter(
        (bead) => bead.x !== x || bead.y !== y,
      );
    } else {
      if (existing) {
        existing.color = this.selectedColor;
      } else {
        this.board.beads.push({
          x,
          y,
          color: this.selectedColor,
        });
      }
    }

    this.hasUnsavedChanges = true;
    this.renderBoard();
    this.updateStatistics();
  }

  /**
   * 色パレットを生成
   */
  private createPalette(): void {
    this.colorPalette.innerHTML = "";

    for (const color of COLORS) {
      const button = document.createElement("button");

      button.type = "button";
      button.dataset.color = color;
      button.title = color;
      button.setAttribute("aria-label", `色 ${color}`);

      button.style.backgroundColor = color;
      button.className = "palette-color";

      this.colorPalette.appendChild(button);
    }

    this.updateSelectedColorDisplay();
  }

  private selectColor(color: string): void {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return;
    }

    this.selectedColor = color.toUpperCase();

    this.updateSelectedColorDisplay();
  }

  private updateSelectedColorDisplay(): void {
    const preview =
      this.requireElement<HTMLElement>(
        "#selected-color-preview",
      );

    const value =
      this.requireElement<HTMLElement>(
        "#selected-color-value",
      );

    preview.style.backgroundColor = this.selectedColor;
    value.textContent = this.selectedColor;

    this.colorPalette
      .querySelectorAll<HTMLButtonElement>("[data-color]")
      .forEach((button) => {
        const selected =
          button.dataset.color === this.selectedColor;

        button.setAttribute(
          "aria-pressed",
          String(selected),
        );

        button.classList.toggle("selected", selected);
      });
  }

  private updateToolButtons(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-tool]")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.tool === this.activeTool,
        );
      });
  }

  /**
   * ビーズ数の集計
   */
  private updateStatistics(): void {
    const counts = new Map<string, number>();

    for (const bead of this.board.beads) {
      counts.set(
        bead.color,
        (counts.get(bead.color) ?? 0) + 1,
      );
    }

    this.statistics.replaceChildren();

    const total = document.createElement("p");
    total.textContent =
      `合計：${this.board.beads.length}個`;

    this.statistics.appendChild(total);

    for (const [color, count] of counts) {
      const row = document.createElement("div");
      row.className = "statistics-row";

      const swatch = document.createElement("span");
      swatch.className = "statistics-swatch";
      swatch.style.backgroundColor = color;

      const label = document.createElement("span");
      label.textContent = color;

      const amount = document.createElement("strong");
      amount.textContent = `${count}個`;

      row.append(swatch, label, amount);
      this.statistics.appendChild(row);
    }
  }

  /**
   * 盤面サイズを変更
   */
  private resizeBoardFromInputs(): void {
    const widthInput =
      this.requireElement<HTMLInputElement>("#board-width");

    const heightInput =
      this.requireElement<HTMLInputElement>("#board-height");

    const width = Number(widthInput.value);
    const height = Number(heightInput.value);

    try {
      this.validateBoardSize(width, height);

      this.board.width = width;
      this.board.height = height;

      this.board.beads = this.board.beads.filter(
        (bead) => bead.x < width && bead.y < height,
      );

      this.renderBoard();
      this.updateStatistics();

      this.hasUnsavedChanges = true;
      this.setStatus("盤面サイズを変更しました。");
    } catch (error) {
      this.setStatus(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  /**
   * 新規プロジェクト
   */
  private newProject(): void {
    if (
      this.hasUnsavedChanges &&
      !window.confirm(
        "変更が保存されていない可能性があります。新規作成しますか？",
      )
    ) {
      return;
    }

    this.board = {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      beads: [],
    };

    this.editor.value = DEFAULT_CODE;

    this.requireElement<HTMLInputElement>(
      "#board-width",
    ).value = String(DEFAULT_WIDTH);

    this.requireElement<HTMLInputElement>(
      "#board-height",
    ).value = String(DEFAULT_HEIGHT);

    this.renderBoard();
    this.updateStatistics();

    this.hasUnsavedChanges = false;
    this.setCodeStatus("未実行");
    this.setStatus("新しい設計図を作成しました。");
  }

  /**
   * JSON形式で保存
   */
  private saveProject(): void {
    const data = {
      format: "BeadCodeStudio",
      version: 1,
      code: this.editor.value,
      board: this.board,
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" },
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "design.bead.json";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    this.hasUnsavedChanges = false;
    this.setStatus("設計図ファイルを保存しました。");
  }

  /**
   * JSONファイルから読み込み
   */
  private async loadProjectFile(file: File): Promise<void> {
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("ファイルサイズが大きすぎます。");
      }

      const data: unknown = JSON.parse(await file.text());

      if (
        typeof data !== "object" ||
        data === null ||
        !("board" in data)
      ) {
        throw new Error("対応していない設計図ファイルです。");
      }

      const project = data as {
        format?: unknown;
        code?: unknown;
        board?: unknown;
      };

      if (project.format !== "BeadCodeStudio") {
        throw new Error("ファイル形式が一致しません。");
      }

      if (
        typeof project.board !== "object" ||
        project.board === null
      ) {
        throw new Error("盤面データがありません。");
      }

      const board = project.board as Partial<BoardData>;

      this.validateBoardSize(
        Number(board.width),
        Number(board.height),
      );

      if (!Array.isArray(board.beads)) {
        throw new Error("ビーズデータが不正です。");
      }

      const beads: Bead[] = board.beads.map(
        (item: unknown) => {
          if (
            typeof item !== "object" ||
            item === null ||
            !("x" in item) ||
            !("y" in item) ||
            !("color" in item)
          ) {
            throw new Error("ビーズデータが不正です。");
          }

          const bead = item as Bead;

          if (
            !Number.isInteger(bead.x) ||
            !Number.isInteger(bead.y) ||
            bead.x < 0 ||
            bead.y < 0 ||
            bead.x >= Number(board.width) ||
            bead.y >= Number(board.height) ||
            typeof bead.color !== "string" ||
            !/^#[0-9A-Fa-f]{6}$/.test(bead.color)
          ) {
            throw new Error("ビーズの座標または色が不正です。");
          }

          return {
            x: bead.x,
            y: bead.y,
            color: bead.color.toUpperCase(),
          };
        },
      );

      this.board = {
        width: Number(board.width),
        height: Number(board.height),
        beads,
      };

      if (typeof project.code === "string") {
        this.editor.value = project.code;
      }

      this.requireElement<HTMLInputElement>(
        "#board-width",
      ).value = String(this.board.width);

      this.requireElement<HTMLInputElement>(
        "#board-height",
      ).value = String(this.board.height);

      this.renderBoard();
      this.updateStatistics();

      this.hasUnsavedChanges = false;
      this.setCodeStatus("読み込み済み");
      this.setStatus("設計図を読み込みました。");
    } catch (error) {
      this.setStatus(
        `読み込みエラー：${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  /**
   * 印刷
   */
  private printDesign(): void {
    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=700",
    );

    if (!printWindow) {
      this.setStatus(
        "印刷画面を開けません。ポップアップ設定を確認してください。",
      );
      return;
    }

    const canvasImage = this.canvas.toDataURL("image/png");

    const rows = Array.from(
      { length: this.board.height },
      (_, y) => {
        const cells = Array.from(
          { length: this.board.width },
          (_, x) => {
            const bead = this.board.beads.find(
              (item) => item.x === x && item.y === y,
            );

            const color = bead?.color ?? "#FFFFFF";

            return `<td style="background:${color}"></td>`;
          },
        ).join("");

        return `<tr><th>${y}</th>${cells}</tr>`;
      },
    ).join("");

    const counts = new Map<string, number>();

    for (const bead of this.board.beads) {
      counts.set(
        bead.color,
        (counts.get(bead.color) ?? 0) + 1,
      );
    }

    const statistics = Array.from(counts.entries())
      .map(([color, count]) =>
        `<li><span style="display:inline-block;width:12px;height:12px;background:${color};border:1px solid #777"></span> ${color}: ${count}個</li>`,
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>アイロンビーズ設計図</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body {
            font-family: sans-serif;
            color: #222;
          }
          h1 { font-size: 20px; }
          .preview {
            max-width: 100%;
            max-height: 100mm;
            object-fit: contain;
          }
          table {
            border-collapse: collapse;
            margin-top: 12px;
          }
          th, td {
            border: 0.5px solid #777;
            width: 7mm;
            height: 7mm;
            text-align: center;
            padding: 0;
          }
          th {
            background: #eee;
            font-size: 8pt;
          }
          td {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          ul {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            padding: 0;
            list-style: none;
          }
          li { font-size: 10pt; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>アイロンビーズ設計図</h1>
        <p>
          サイズ：${this.board.width} × ${this.board.height}
          ／ 合計 ${this.board.beads.length} 個
        </p>

        <img class="preview" src="${canvasImage}" alt="設計図">

        <h2>色別ビーズ数</h2>
        <ul>${statistics}</ul>

        <h2>座標付き設計図</h2>
        <table>
          <thead>
            <tr>
              <th>Y\\X</th>
              ${Array.from(
                { length: this.board.width },
                (_, x) => `<th>${x}</th>`,
              ).join("")}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p>
          座標原点：(0, 0) ／ Xは右方向、Yは下方向
        </p>

        <button onclick="window.print()">印刷 / PDF保存</button>
      </body>
      </html>
    `);

    printWindow.document.close();

    this.setStatus("印刷用の設計図を作成しました。");
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
  }

  private setCodeStatus(message: string): void {
    this.requireElement<HTMLElement>(
      "#code-status",
    ).textContent = message;
  }
}

/**
 * 外部から呼び出す初期化関数
 */
export function createApp(
  root: HTMLElement = document.body,
): BeadCodeApp {
  const app = new BeadCodeApp(root);
  app.init();
  return app;
}
