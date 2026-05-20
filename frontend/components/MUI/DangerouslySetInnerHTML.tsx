import { Stack, styled } from '@mui/material';
import clsx from 'clsx';
import React from 'react'

const PREFIX = "html";
const classes = {
    serviceLines: `${PREFIX}-serviceLines`,
};

const Root = styled(Stack)(({ theme }) => ({
    padding: 0,
    margin: 0,
    overflowY: "unset",

    // overflowY: "",
    // ["& ul"]: {
    //     padding: 0,
    //     ["& li"]: {
    //         padding: 0,
    //         ["&::before"]: {
    //             margin: "0px !important"
    //         }
    //     }
    // },
    [`&.${classes.serviceLines}`]: {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical", /* Specify vertical text flow */
        overflow: "hidden", /* Hide overflow text */
        textOverflow: "ellipsis", /* Add ellipsis for truncated text */
        WebkitLineClamp: 2, /* Limit to 2 lines */
        lineClamp: 2, /* Standard property for line clamping */
    },
    "& img": { maxWidth: "100%", borderRadius: 8 },
    "& p": { marginBottom: 0, lineHeight: 1.8 },
    "& h1, & h2, & h3": { marginBottom: 12, marginTop: 24 },
    "& ul": { paddingInlineStart: 24, marginBottom: 12, listStyleType: "disc" },
    "& ol": { paddingInlineStart: 24, marginBottom: 12, listStyleType: "decimal" },
    "& li": { marginBottom: 4, lineHeight: 1.8 },
    "& li::marker": { color: "inherit" },

    // task list — hide native checkbox, show ✓ / ○ via pseudo-element
    '& ul[data-type="taskList"]': {
        listStyle: "none",
        paddingInlineStart: 4,
        "& li[data-type='taskItem']": {
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 6,
            // hide the real <input>
            "& label input[type='checkbox']": { display: "none" },
            // hide the <span> inside label
            "& label span": { display: "none" },
            // replace label with icon
            "& label::before": {
                content: '""',
                display: "inline-block",
                width: 18,
                height: 18,
                minWidth: 18,
                borderRadius: 4,
                border: "2px solid",
                borderColor: "inherit",
                marginTop: 3,
                backgroundSize: "70%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
            },
            "&[data-checked='true'] label::before": {
                content: '"✓"',
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.getContrastText(theme.palette.primary.main), // 👈 make checkmark white
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
            },
            // hide the wrapping <div> default spacing
            "& > div": { flex: 1 },
        },
    },
}));

const DangerouslySetInnerHTML = ({ data, limit = false }: { data: string, limit?: boolean }) => {
    return (
        <Root
            className={clsx({
                [classes.serviceLines]: limit,
            })}
            spacing={0}
            dangerouslySetInnerHTML={{ __html: data }}
        />
    )
}

export default DangerouslySetInnerHTML