import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        Blob: "readonly",
        CanvasRenderingContext2D: "readonly",
        console: "readonly",
        crypto: "readonly",
        Document: "readonly",
        File: "readonly",
        FileReader: "readonly",
        HTMLElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        Image: "readonly",
        ImageData: "readonly",
        MouseEvent: "readonly",
        PointerEvent: "readonly",
        URL: "readonly",
        alert: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
