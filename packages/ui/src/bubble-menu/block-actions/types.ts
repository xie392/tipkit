"use client";

import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface BlockActionProps {
  editor: Editor;
  node: ProseMirrorNode;
  pos: number;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
}

export interface BlockActionDefinition {
  match: (node: ProseMirrorNode) => boolean;
  render: (props: BlockActionProps) => ReactNode;
}
