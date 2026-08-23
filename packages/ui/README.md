# @tipkit/ui

TipKit 交互原语：编辑器浮层（斜杠菜单、文字工具条、链接气泡、块手柄、表格控件等）与工具栏组件。**仅布局**——只负责定位、键盘导航、激活态，不携带颜色 / 字体 / 阴影。

## 安装

```bash
pnpm add @tipkit/ui
```

## 快速使用

```tsx
import {
  SlashMenu,
  EmojiSuggestion,
  TextMenu,
  LinkBubble,
  LinkDialogHost,
  BlockBubbleMenu,
  BlockHandleMenu,
  TableControls,
} from "@tipkit/ui";

export function EditorOverlays({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <>
      <SlashMenu editor={editor} onUploadImage={uploadImage} iconRenderer={renderIcon} />
      <EmojiSuggestion editor={editor} />
      <TextMenu editor={editor} />
      <LinkBubble editor={editor} />
      <LinkDialogHost editor={editor} />
      <BlockBubbleMenu editor={editor} />
      <BlockHandleMenu editor={editor} />
      <TableControls editor={editor} />
    </>
  );
}
```

## 主要导出

| 分类 | 组件 |
| --- | --- |
| 浮层 | `SlashMenu`、`TextMenu`、`LinkBubble`、`LinkDialogHost`、`BlockBubbleMenu`、`BlockHandleMenu`、`TableControls` |
| 建议 | `EmojiSuggestion` |
| 工具栏 | `BlockStyleMenu`、`FontFamilyPicker`、`FontSizePicker`、`AlignMenu`、`ColorMenu`、`TablePicker`、`openLinkDialog` |

## 设计约束

- 仅布局（flex / gap / z-index），禁止颜色、字体、阴影、边框视觉
- 视觉样式统一由 `@tipkit/themes` 主题层提供
