// Puente de carga para tests durante la migración incremental a módulos ES.
//
// Los tests cargan los archivos de `src/` como scripts (vm.runInThisContext) o con
// require(), un modelo que NO entiende la sintaxis `import`/`export`. A medida que
// migramos módulos a ES reales, este puente los "des-moduliza" al vuelo SOLO para el
// entorno de test: quita `export`, reescribe `import { x } from '...'` a
// `const { x } = window.FMG` (los módulos migrados siguen exponiendo su API en
// window.FMG como compatibilidad), y deja intactos los archivos que todavía son IIFE.
//
// Se inyecta con `node -r ./tests/_esmBridge.js`. Es un no-op para archivos sin
// sintaxis de módulo, así que no altera los tests de módulos aún no migrados.

const fs = require("fs");
const Module = require("module");

const hasEsmSyntax = (code) => /^[ \t]*(export|import)[ \t\n{]/m.test(code);

function demodulize(code) {
  if (!hasEsmSyntax(code)) return code;
  const transformed = code
    // import { a, b } from '...';  ->  const { a, b } = window.FMG;
    .replace(/^[ \t]*import[ \t]+\{([^}]*)\}[ \t]+from[ \t]+['"][^'"]+['"];?[ \t]*$/gm, "const {$1} = (typeof window!==\"undefined\"?window:globalThis).FMG;")
    // import Nombre from '...';  ->  const Nombre = window.FMG default holder (raro; se ignora el binding)
    .replace(/^[ \t]*import[ \t]+([A-Za-z_$][\w$]*)[ \t]+from[ \t]+['"][^'"]+['"];?[ \t]*$/gm, "")
    // import '...';  (solo efecto secundario)  ->  se elimina (la dependencia ya se cargó en orden)
    .replace(/^[ \t]*import[ \t]+['"][^'"]+['"];?[ \t]*$/gm, "")
    // export { ... };  ->  se elimina (los símbolos ya se puentean a window.FMG)
    .replace(/^[ \t]*export[ \t]+\{[^}]*\}[ \t]*;?[ \t]*$/gm, "")
    // export default X  ->  const __esmDefault = X
    .replace(/^([ \t]*)export[ \t]+default[ \t]+/gm, "$1const __esmDefault = ")
    // export function/const/let/class/async  ->  se quita 'export '
    .replace(/^([ \t]*)export[ \t]+(function|const|let|class|var|async)\b/gm, "$1$2");
  // Envolver en un IIFE: al quitar el envoltorio original, las declaraciones de nivel
  // superior (const FMG, etc.) quedarían en el ámbito global compartido de vm y
  // colisionarían entre módulos migrados. El IIFE re-aísla cada archivo; sus efectos
  // secundarios (window.FMG.x = ...) siguen aplicando al global.
  return "(function(){\n" + transformed + "\n})();";
}

const isSrcJs = (p) =>
  typeof p === "string" && p.endsWith(".js") && p.replace(/\\/g, "/").includes("/src/");

// --- Puente para vm/lectura de texto (patrón mayoritario de los tests) ---
const origReadFileSync = fs.readFileSync;
fs.readFileSync = function (target, options) {
  const result = origReadFileSync.call(this, target, options);
  const wantsText = options === "utf8" || (options && options.encoding === "utf8");
  if (wantsText && isSrcJs(target) && typeof result === "string") {
    return demodulize(result);
  }
  return result;
};

// --- Puente para require() de archivos src (patrón minoritario) ---
const origCompileExt = Module._extensions[".js"];
Module._extensions[".js"] = function (module, filename) {
  if (isSrcJs(filename)) {
    const code = demodulize(origReadFileSync.call(fs, filename, "utf8"));
    return module._compile(code, filename);
  }
  return origCompileExt(module, filename);
};
