import { Mark } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId?: string) => ReturnType;
      unsetComment: (commentId?: string) => ReturnType;
      /** 移除整篇文档中所有匹配 commentId 的评论标记（用于面板删除按钮，不依赖当前选区） */
      removeComment: (commentId: string) => ReturnType;
    };
  }
}

export interface CommentOptions {
  /**
   * 评论锚点点击回调（可选）。
   * 注意：默认点击评论文字不会阻止 ProseMirror 放置光标，也不会自动触发此回调；
   * 消费方如需"点击评论定位面板"等行为，应在 hover 卡片等 UI 中主动调用，
   * 避免点击评论文字时弹出遮罩/抽屉阻断正常编辑。
   */
  onCommentClick?: (commentId: string, event: MouseEvent) => void;
}

const generateCommentId = () =>
  `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const Comment = Mark.create<CommentOptions>({
  name: "comment",

  addOptions() {
    return {
      onCommentClick: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs) =>
          attrs.commentId ? { "data-comment-id": attrs.commentId } : {},
      },
      commentIds: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-ids"),
        renderHTML: (attrs) =>
          attrs.commentIds ? { "data-comment-ids": attrs.commentIds } : {},
      },
    };
  },

  parseHTML() {
    return [
      { tag: "span[data-comment-id]" },
      { tag: "mark[data-comment-id]" },
      { tag: "[class~=tk-comment]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: "tk-comment" }, 0];
  },

  addCommands() {
    return {
      setComment:
        (commentId?: string) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          if (selection.empty) return false;

          const id = commentId ?? generateCommentId();

          if (dispatch) {
            tr.addMark(
              selection.from,
              selection.to,
              this.type.create({ commentId: id }),
            );
          }
          return true;
        },

      unsetComment:
        (commentId?: string) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          if (selection.empty) return false;

          if (dispatch) {
            if (commentId) {
              state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
                if (node.marks) {
                  node.marks.forEach((mark) => {
                    if (
                      mark.type === this.type &&
                      mark.attrs.commentId === commentId
                    ) {
                      tr.removeMark(pos, pos + node.nodeSize, mark);
                    }
                  });
                }
              });
            } else {
              tr.removeMark(selection.from, selection.to, this.type);
            }
          }
          return true;
        },

      removeComment:
        (commentId: string) =>
        ({ tr, state, dispatch }) => {
          if (!commentId) return false;
          if (dispatch) {
            state.doc.descendants((node, pos) => {
              if (!node.marks) return;
              node.marks.forEach((mark) => {
                if (
                  mark.type === this.type &&
                  mark.attrs.commentId === commentId
                ) {
                  tr.removeMark(pos, pos + node.nodeSize, mark);
                }
              });
            });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    // 不在插件层拦截评论点击——让点击行为回归正常的光标放置。
    // 消费方如需"点击评论弹出卡片/面板"，应在 hover 卡片等 UI 层自行实现，
    // 避免点击评论文字时弹出遮罩阻断编辑（参考语雀/飞书：hover 出卡片，卡片内按钮展开面板）。
    return [];
  },
});

export default Comment;
