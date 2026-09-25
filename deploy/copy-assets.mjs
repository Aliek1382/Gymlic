// `next build` writes out/, but the two files beside it are ours, not Next's:
// .htaccess is what makes /join/<code> invite links work on Apache, and
// serve.json repeats that one rule for `npm run preview`.
//
// This was a `cp` in the build script until the first Windows deploy, where
// cmd.exe has no cp. The documented deploy path is Windows, so the copy has to
// run the same on both -- and a build that quietly finishes without .htaccess
// would ship a site whose invite links all 404.
import { copyFileSync } from "node:fs";

// npm runs scripts from the directory holding package.json, so these are
// relative to the project root.
for (const name of [".htaccess", "serve.json"]) {
  copyFileSync(`deploy/${name}`, `out/${name}`);
}
