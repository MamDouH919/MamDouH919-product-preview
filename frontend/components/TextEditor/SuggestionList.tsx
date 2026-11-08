import { Chip, List, ListItem, ListItemButton, ListItemText, Paper, Typography } from "@mui/material";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useImperativeHandle, useState } from "react";
import { MENTION_KIND_LABEL } from "@/lib/mentions";
import type { EditorLang, MentionNodeAttrs, MentionSuggestion } from "./mentionSuggestionOptions";

export type SuggestionListRef = {
  // Same signature as the `onKeyDown` of SuggestionOptions' `render`, so
  // mentionSuggestionOptions can hand key presses straight to the list.
  onKeyDown: NonNullable<ReturnType<NonNullable<SuggestionOptions<MentionSuggestion>["render"]>>["onKeyDown"]>;
};

export type SuggestionListProps = SuggestionProps<MentionSuggestion, MentionNodeAttrs> & { lang: EditorLang };

const KIND_COLOR = { product: "primary", category: "secondary", subCategory: "default" } as const;

/** The `@` menu: the store's products, categories and sub-categories matching what was typed. */
const SuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevItems, setPrevItems] = useState(props.items);

  if (props.items !== prevItems) {
    setPrevItems(props.items);
    setSelectedIndex(0);
  }

  const selectItem = (index: number) => {
    // Enter with no results lands here with nothing to pick.
    const item = props.items[index];
    if (!item) return;
    props.command({ id: item.id, label: item.label, kind: item.kind, href: item.href });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      const count = props.items.length;
      if (event.key === "ArrowUp" && count) {
        setSelectedIndex((selectedIndex + count - 1) % count);
        return true;
      }
      if (event.key === "ArrowDown" && count) {
        setSelectedIndex((selectedIndex + 1) % count);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  const { lang } = props;

  return (
    <Paper elevation={5} sx={{ minWidth: 260, maxWidth: 360 }} dir={lang === "ar" ? "rtl" : "ltr"}>
      {props.items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          {lang === "ar" ? "مفيش نتائج" : "No matches"}
        </Typography>
      ) : (
        <List dense sx={{ overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
          {props.items.map((item, index) => (
            <ListItem key={item.key} disablePadding>
              <ListItemButton selected={index === selectedIndex} onClick={() => selectItem(index)} sx={{ gap: 1 }}>
                <ListItemText primary={item.label} primaryTypographyProps={{ noWrap: true }} />
                <Chip
                  size="small"
                  variant="outlined"
                  color={KIND_COLOR[item.kind]}
                  label={MENTION_KIND_LABEL[item.kind][lang]}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
});

SuggestionList.displayName = "SuggestionList";

export default SuggestionList;
