# storybook-addon-canvas-comments

Storybook Canvas 上で UI 修正用のインラインコメントを残すための addon です。

## Setup

workspace package として登録している場合は `.storybook/main.ts` の `addons` に追加します。

```ts
import type { StorybookConfig } from "@storybook/react-native-web-vite";

const config: StorybookConfig = {
  addons: ["storybook-addon-canvas-comments"],
};

export default config;
```

このリポジトリ内で source package を直接参照する場合は、既存の各 Storybook と同じように `resolve(import.meta.dirname, "...")` で addon preset entry を渡します。

```ts
import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/react-native-web-vite";

const canvasCommentsAddon = resolve(
  import.meta.dirname,
  "../../../../packages/storybook-addon-canvas-comments/src/index.ts",
);

const config: StorybookConfig = {
  addons: [canvasCommentsAddon],
};

export default config;
```

## Usage

1. Storybook の toolbar に表示される “UI Feedback” を ON にします。
2. Canvas 上の対象 UI をクリックします。
3. prompt にコメントを入力します。
4. addon panel の “UI Feedback” にコメントが表示されます。

toolbar の目アイコン、または panel header の “Pins” checkbox で、保存済みコメントの canvas 上 pin 表示を ON/OFF できます。pin に hover / focus するとコメント本文を tooltip として表示します。

コメントは Storybook dev server の実行ディレクトリ配下に保存されます。

```text
.storybook/canvas-comments/comments.json
```

このリポジトリでは local feedback data として `**/.storybook/canvas-comments/comments.json` を ignore しています。AI エージェントに読ませる場合は、作業中の workspace にあるこの JSON を直接参照します。

## API

Vite builder では addon preset が middleware を追加します。

```text
GET   /__canvas-comments/comments
POST  /__canvas-comments/comments
PATCH /__canvas-comments/comments/:id
DELETE /__canvas-comments/comments/:id
```

`PATCH` は `status` を `open` / `resolved` に更新します。

```json
{
  "status": "resolved"
}
```

`DELETE` は対象コメントを `comments.json` から削除し、削除したコメントを返します。

addon の保存 API への fetch は `Accept: msw/passthrough` を付けて送信します。`msw-storybook-addon` を使っている story でも、`POST /__canvas-comments/comments` が unhandled request warning にならず、Storybook dev server の middleware へそのまま届きます。

## CLI

Storybook dev server が起動している状態で、保存済みコメントと canvas 内の実 DOM を対応付けた JSON を出力できます。

```bash
pnpm --filter storybook-addon-canvas-comments dom-map -- \
  --storybook-url http://localhost:6006 \
  --story-id features-bookmark-list--success
```

`--story-id` を省略すると、コメントがある story をすべて処理します。既定では `open` コメントのみを対象にします。

```bash
pnpm --filter storybook-addon-canvas-comments dom-map -- \
  --storybook-url http://localhost:6006 \
  --status all \
  --viewport 390x844 \
  --include-dom-tree
```

CLI は次の順でコメント対象を解決します。

1. 保存済み `selector` を `document.querySelector` で解決
2. 解決できない場合、保存時 viewport から現在 viewport に pointer を scale し、`document.elementsFromPoint` で fallback

出力には comment の保存座標、現在座標、対応 DOM 要素の tag / attributes / rect / text / ancestor 情報が含まれます。`--include-dom-tree` を付けると bounded DOM tree も含めます。snapshot エンジンでは **コメント対象要素を起点とした subtree** のみを保持するため AI エージェントのコンテキスト消費を抑えられます。playwright エンジンでは従来どおり `#storybook-root` 配下の subtree になります。

DOM 取得前には `role="progressbar"`、`loading` / `spinner` / `skeleton` 系の属性、`読み込み中` / `Loading` テキストが消えるまで待機します。Loading 状態そのものの story を調べる場合は `--skip-loading-wait` を指定します。

## JSON Schema

AI エージェントが読む前提で、コメントは配列として保存されます。

```json
[
  {
    "id": "42f3dcbf-4e8d-49e4-86c4-7a61a62b7e70",
    "storyId": "features-bookmark-list--success",
    "storyTitle": "features/bookmark-list",
    "storyName": "Success",
    "note": "ボタンの余白を少し広げたい",
    "selector": "[data-ai-source=\"apps/curio/mobile/src/features/bookmark-list/index.tsx:42\"]",
    "dataTestId": "bookmark-submit",
    "dataAiComponent": "BookmarkSubmitButton",
    "dataAiSource": "apps/curio/mobile/src/features/bookmark-list/index.tsx:42",
    "rect": {
      "x": 24,
      "y": 120,
      "width": 160,
      "height": 44
    },
    "pointer": {
      "x": 84,
      "y": 138
    },
    "viewport": {
      "width": 390,
      "height": 844
    },
    "createdAt": "2026-06-12T00:00:00.000Z",
    "status": "open"
  }
]
```

`selector` は次の優先順位で作ります。

1. `data-ai-source`
2. `data-testid`
3. `id`
4. tag / class / path の簡易 selector
