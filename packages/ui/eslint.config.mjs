import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import shared from "@biawin/config/eslint";

export default tseslint.config(...shared, eslint.configs.recommended, ...tseslint.configs.recommended);
