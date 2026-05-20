'use client';

import { Lock, LockOpen, TextFields } from "@mui/icons-material";
import { Stack } from "@mui/material";
import type { EditorOptions } from "@tiptap/core";
import { useCallback, useRef, useState, useEffect } from "react";
import {
  LinkBubbleMenu,
  MenuButton,
  RichTextEditor,
  TableBubbleMenu,
  insertImages,
  type RichTextEditorRef,
} from "mui-tiptap";
import EditorMenuControls from "./EditorMenuControls";
import useExtensions from "./useExtensions";

interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
}

function fileListToImageFiles(fileList: FileList): File[] {
  return Array.from(fileList).filter((file) => {
    const mimeType = (file.type || "").toLowerCase();
    return mimeType.startsWith("image/");
  });
}

export default function Editor({ value, onChange }: EditorProps) {
  const extensions = useExtensions({
    placeholder: ""
  });

  const rteRef = useRef<RichTextEditorRef>(null);

  const [isEditable, setIsEditable] = useState(true);
  const [showMenuBar, setShowMenuBar] = useState(true);

  /** Sync value when form reset */
  useEffect(() => {
    if (rteRef.current?.editor && value !== undefined) {
      const current = rteRef.current.editor.getHTML();
      if (current !== value) {
        rteRef.current.editor.commands.setContent(value || "");
      }
    }
  }, [value]);

  /** Insert images */
  const handleNewImageFiles = useCallback(
    (files: File[], insertPosition?: number): void => {
      if (!rteRef.current?.editor) return;

      const attributesForImageFiles = files.map((file) => ({
        src: URL.createObjectURL(file),
        alt: file.name,
      }));

      insertImages({
        images: attributesForImageFiles,
        editor: rteRef.current.editor,
        position: insertPosition,
      });
    },
    []
  );

  /** Drop images */
  const handleDrop: NonNullable<EditorOptions["editorProps"]["handleDrop"]> =
    useCallback(
      (view, event) => {
        if (!(event instanceof DragEvent) || !event.dataTransfer) return false;

        const imageFiles = fileListToImageFiles(event.dataTransfer.files);

        if (imageFiles.length > 0) {
          const insertPosition = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })?.pos;

          handleNewImageFiles(imageFiles, insertPosition);
          event.preventDefault();
          return true;
        }

        return false;
      },
      [handleNewImageFiles]
    );

  /** Paste images */
  const handlePaste: NonNullable<EditorOptions["editorProps"]["handlePaste"]> =
    useCallback(
      (_view, event) => {
        if (!event.clipboardData) return false;

        const pastedImageFiles = fileListToImageFiles(
          event.clipboardData.files
        );

        if (pastedImageFiles.length > 0) {
          handleNewImageFiles(pastedImageFiles);
          return true;
        }

        return false;
      },
      [handleNewImageFiles]
    );

  return (
    <RichTextEditor
      ref={rteRef}
      extensions={extensions}
      content={value || ""}
      editable={isEditable}
      immediatelyRender={false}
      editorProps={{
        handleDrop,
        handlePaste,
      }}
      onUpdate={({ editor }) => {
        const html = editor.getHTML();
        onChange?.(html);
      }}
      renderControls={() => <EditorMenuControls />}
      RichTextFieldProps={{
        variant: "outlined",
        MenuBarProps: {
          hide: !showMenuBar,
        },
        footer: (
          <Stack
            direction="row"
            spacing={2}
            sx={{
              borderTop: 1,
              borderColor: "divider",
              py: 1,
              px: 1.5,
            }}
          >
            <MenuButton
              tooltipLabel={
                showMenuBar ? "Hide formatting" : "Show formatting"
              }
              size="small"
              onClick={() => setShowMenuBar((prev) => !prev)}
              selected={showMenuBar}
              IconComponent={TextFields}
            />

            <MenuButton
              tooltipLabel={
                isEditable ? "Read only" : "Allow edits"
              }
              size="small"
              onClick={() => setIsEditable((prev) => !prev)}
              selected={!isEditable}
              IconComponent={isEditable ? Lock : LockOpen}
            />
          </Stack>
        ),
      }}
      sx={{
        "& .ProseMirror": {
          fontFamily: "inherit",
          "& h1, & h2, & h3, & h4, & h5, & h6": {
            scrollMarginTop: showMenuBar ? 50 : 0,
            fontFamily: "inherit",
          },
          "& p, & li, & td, & th": {
            fontFamily: "inherit",
          },
        },
      }}
    >
      {() => (
        <>
          <LinkBubbleMenu />
          <TableBubbleMenu />
        </>
      )}
    </RichTextEditor>
  );
}
