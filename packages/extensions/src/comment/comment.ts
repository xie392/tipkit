import { Mark } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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
    const { options } = this;
    return [
      new Plugin({
        key: new PluginKey("comment"),
        props: {
          handleClickOn(_view, _pos, _node, _nodePos, event, _direct) {
            const target = event.target as HTMLElement;
            const commentEl = target.closest(".tk-comment") as HTMLElement | null;
            if (!commentEl) return false;

            const id = commentEl.getAttribute("data-comment-id");
            if (id && options.onCommentClick) {
              options.onCommentClick(id, event);
            }
            return false;
          },
        },
      }),
    ];
  },
});

export default Comment;
