import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
	plugins: [viteSingleFile()],
  base: "/concept-annotator/", // https://vitejs.dev/guide/static-deploy.html#github-pages
});
