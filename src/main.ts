
/**
 * BeadCode Studio
 * File: src/main.ts
 *
 * アプリケーションのエントリーポイント。
 *
 * 担当:
 * - ブラウザ環境の確認
 * - アプリケーションの初期化
 * - 起動エラーの表示
 * - 未処理エラーの通知
 * - 起動状態の管理
 *
 * 実際の設計図機能は src/app.ts が担当する。
 */

import { createApp, type BeadCodeApp } from "./app";

/* =========================================
   型定義
========================================= */

type AppStatus =
  | "starting"
  | "ready"
  | "error";

interface StartupState {
  status: AppStatus;
  message: string;
  error?: string;
}

/* =========================================
   起動状態
========================================= */

const startupState: StartupState = {
  status: "starting",
  message: "BeadCode Studio を起動しています...",
};

let appInstance: BeadCodeApp | null = null;
let initialized = false;

/* =========================================
   起動メッセージ
========================================= */

function updateStartupMessage(
  message: string,
  status: AppStatus,
): void {
  startupState.message = message;
  startupState.status = status;

  const statusElement =
    document.querySelector<HTMLElement>("#app-status");

  if (statusElement) {
    statusElement.textContent = message;
    statusElement.dataset.status = status;
    statusElement.setAttribute("role", "status");
    statusElement.setAttribute("aria-live", "polite");
  }

  document.documentElement.dataset.appStatus = status;
}

/* =========================================
   エラー表示
========================================= */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "原因不明のエラーが発生しました。";
}

function showFatalError(error: unknown): void {
  const message = getErrorMessage(error);

  startupState.status = "error";
  startupState.message = "アプリケーションの起動に失敗しました。";
  startupState.error = message;

  console.error(
    "[BeadCode Studio] 起動エラー:",
    error,
  );

  let errorElement =
    document.querySelector<HTMLElement>("#startup-error");

  if (!errorElement) {
    errorElement = document.createElement("section");
    errorElement.id = "startup-error";
    errorElement.setAttribute("role", "alert");

    errorElement.style.cssText = `
      margin: 16px;
      padding: 16px;
      border: 1px solid #dc2626;
      border-radius: 8px;
      background: #fef2f2;
      color: #991b1b;
      font-family: sans-serif;
      overflow-wrap: anywhere;
    `;

    document.body.prepend(errorElement);
  }

  errorElement.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "起動エラー";

  const description = document.createElement("p");
  description.textContent =
    "アプリケーションを起動できませんでした。";

  const detail = document.createElement("pre");
  detail.textContent = message;

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.textContent = "再読み込み";
  retryButton.addEventListener("click", () => {
    window.location.reload();
  });

  errorElement.append(
    heading,
    description,
    detail,
    retryButton,
  );

  updateStartupMessage(
    "起動に失敗しました。エラー内容を確認してください。",
    "error",
  );
}

/* =========================================
   ブラウザ環境の確認
========================================= */

function checkBrowserSupport(): void {
  if (typeof window === "undefined") {
    throw new Error(
      "ブラウザ環境で実行してください。",
    );
  }

  if (typeof document === "undefined") {
    throw new Error(
      "HTMLドキュメントを利用できません。",
    );
  }

  if (typeof HTMLCanvasElement === "undefined") {
    throw new Error(
      "Canvas APIを利用できません。",
    );
  }

  const canvas = document.createElement("canvas");

  if (!canvas.getContext("2d")) {
    throw new Error(
      "Canvas 2Dに対応したブラウザが必要です。",
    );
  }
}

/* =========================================
   アプリの初期化
========================================= */

function initializeApplication(): void {
  if (initialized) {
    console.warn(
      "[BeadCode Studio] 初期化はすでに実行されています。",
    );
    return;
  }

  updateStartupMessage(
    "ブラウザ環境を確認しています...",
    "starting",
  );

  checkBrowserSupport();

  updateStartupMessage(
    "画面を初期化しています...",
    "starting",
  );

  const root = document.querySelector<HTMLElement>(
    "#app",
  );

  if (!root) {
    throw new Error(
      'index.html に id="app" の要素がありません。',
    );
  }

  appInstance = createApp(root);

  initialized = true;

  updateStartupMessage(
    "準備完了",
    "ready",
  );

  console.info(
    "[BeadCode Studio] 起動しました。",
  );
}

/* =========================================
   エラーイベント
========================================= */

function registerErrorHandlers(): void {
  window.addEventListener("error", (event: ErrorEvent) => {
    console.error(
      "[BeadCode Studio] 実行時エラー:",
      event.error ?? event.message,
    );
  });

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      console.error(
        "[BeadCode Studio] 未処理の非同期エラー:",
        event.reason,
      );
    },
  );
}

/* =========================================
   起動処理
========================================= */

function startApplication(): void {
  registerErrorHandlers();

  try {
    initializeApplication();
  } catch (error) {
    showFatalError(error);
  }
}

/* =========================================
   DOM読み込み後に起動
========================================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    startApplication,
    { once: true },
  );
} else {
  startApplication();
}

/* =========================================
   デバッグ用API
========================================= */

/**
 * 開発中にブラウザのコンソールから状態を確認する。
 *
 * 本番環境では必要に応じて削除できる。
 */
export function getStartupState(): Readonly<StartupState> {
  return { ...startupState };
}

/**
 * アプリのインスタンスを取得する。
 * 初期化前の場合は null を返す。
 */
export function getAppInstance(): BeadCodeApp | null {
  return appInstance;
}
