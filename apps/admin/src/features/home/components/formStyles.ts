import { color } from "@biawin/ui";

/** Shared plain input/select/textarea/checkbox styling for every Home resource form field — matches `@biawin/ui`'s `Input` visual style without needing a `<select>`/`<textarea>` variant from the design system. */
export const plainFieldStyles = `
  .biawin-plain-input, .biawin-plain-select, .biawin-plain-textarea{
    height:46px;width:100%;border:1px solid ${color.line};background:${color.ice};
    border-radius:14px;padding:0 14px;font-size:14px;color:${color.ink};font-family:inherit;
  }
  .biawin-plain-textarea{height:auto;min-height:96px;padding:12px 14px;resize:vertical}
  .biawin-plain-checkbox{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:${color.ink}}
`;
